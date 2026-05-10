"""Read-only billing facade and payroll-run viewsets for the Payroll & Invoices UI.

The frontend's ledger toggle (Clients ⇄ Staff) is served by a single facade
endpoint at /api/v1/billing/invoices/ that merges staff Invoice and ClientInvoice
into a unified InvoiceRecord shape. Mutations are out of scope for this iteration
EXCEPT statement create/send and Xero export-stub (which records intent only).
"""
import logging
from decimal import Decimal
from itertools import chain

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    AuditLog,
    ClientInvoice,
    Invoice,
    InvoiceItem,
    PayrollRun,
    Statement,
    StatementInvoice,
    TimeAdjustment,
    User,
    Venue,
)
from .serializers_billing import (
    ClientBillingInvoiceSerializer,
    FinanceProviderSerializer,
    InvoiceStatsSerializer,
    PayrollHistoryRunSerializer,
    PayrollRunSerializer,
    StaffBillingInvoiceSerializer,
    StatementSerializer,
    _adjustment_payload,
    _aggregate_officer,
    _line_item_payload,
    compute_stats_for_queryset,
)

try:
    from finance_integrations.models import AccountingProvider, InvoiceExport, ClientInvoiceExport
except ImportError:  # pragma: no cover — finance_integrations always present in this repo
    AccountingProvider = None
    InvoiceExport = None
    ClientInvoiceExport = None


# ---------------------------------------------------------------------------
# Multi-tenant helpers (mirrors ClientInvoiceViewSet.get_user_company)
# ---------------------------------------------------------------------------

def _current_company(request):
    """Resolve the company in scope from the TenantMiddleware or fall back to membership."""
    if hasattr(request, 'current_company') and request.current_company:
        return request.current_company
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        membership = (
            user.company_memberships
            .filter(is_active=True, company__is_active=True)
            .select_related('company')
            .order_by('-joined_at')
            .first()
        )
        return membership.company if membership else None
    return None


logger = logging.getLogger(__name__)


def _notify_invoice_paid(invoice, *, marked_by):
    """Email + in-app Notification when an admin marks an invoice paid.

    The Notification post_save signal broadcasts the row over WebSocket, so
    the mobile dashboard fires confetti the moment this lands. Reuses the
    existing branded `invoice_notification` template (handles paid + pending
    via its `status` block). Failures are swallowed — payment state has
    already been recorded.
    """
    staff_user = getattr(invoice, 'staff_user', None)
    if not staff_user:
        return

    # Resolve company: prefer payroll_run.company, fall back to staff_user's
    # primary active membership.
    company = None
    pr = getattr(invoice, 'payroll_run', None)
    if pr is not None:
        company = getattr(pr, 'company', None)
    if company is None:
        m = staff_user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').first()
        company = m.company if m else None

    invoice_number = getattr(invoice, 'invoice_number', '') or str(invoice.pk)
    total_amount = f"{float(invoice.total_amount or 0):,.2f}"
    total_hours = f"{float(getattr(invoice, 'total_hours', 0) or 0):.2f}"
    pay_date_label = invoice.paid_date.strftime('%a %d %b') if invoice.paid_date else ''
    # period_label — match the existing template's "w/c 20 Apr 2026" voice
    period_label = ''
    if invoice.start_date:
        period_label = f"w/c {invoice.start_date.strftime('%d %b %Y')}"

    # Build line items for the table. Match the field names the template
    # iterates over: line.label / line.hours / line.rate / line.amount.
    lines = []
    try:
        for item in invoice.items.all().select_related('venue'):
            label = (item.venue.name if item.venue else '') or item.description or 'Shift'
            if item.item_type == 'overtime_1':
                label = f"{label} (OT)"
            elif item.item_type == 'overtime_2':
                label = f"{label} (OT2)"
            hours = item.hours_worked if item.hours_worked is not None else item.days
            lines.append({
                'label': label,
                'hours': f"{float(hours or 0):.2f}",
                'rate': f"{float(item.rate or 0):.2f}",
                'amount': f"{float(item.amount or 0):.2f}",
            })
    except Exception as e:
        logger.warning(f"Failed to assemble invoice line items for {invoice.pk}: {e}")

    # Bank last4 (best effort, optional in the template)
    bank_last4 = ''
    profile = getattr(staff_user, 'profile', None)
    if profile is not None:
        acct = getattr(profile, 'bank_account_number', '') or ''
        if acct:
            bank_last4 = acct[-4:]

    # Email — reuse the branded `invoice_notification` template (paid variant).
    try:
        from .services import email_notification_service
        email_notification_service.send_email(
            user_id=staff_user.id,
            subject=f"Payment received: £{total_amount}",
            template_name='invoice_notification',
            context={
                'invoice_number': invoice_number,
                'period_label': period_label,
                'total_amount': total_amount,
                'total_hours': total_hours,
                'pay_date': pay_date_label,
                'status': 'paid',
                'lines': lines,
                'bank_last4': bank_last4,
            },
            notification_type='invoice_paid',
        )
    except Exception as e:
        logger.warning(f"Failed to send invoice_paid email: {e}")

    # In-app Notification (post_save signal broadcasts on the WS group)
    try:
        from .models import Notification
        Notification.send(
            user=staff_user,
            title='Payment received',
            message=(
                f"You've been paid £{total_amount}"
                + (f" for {period_label}" if period_label else '')
                + '.'
            ),
            notification_type='invoice_paid',
            priority='high',
            related_type='invoice',
            related_id=str(invoice.pk),
            action_url=f'/invoices/{invoice.pk}',
            company=company,
        )
    except Exception as e:
        logger.warning(f"Failed to create invoice_paid notification: {e}")


# ---------------------------------------------------------------------------
# /api/v1/billing/invoices/
# ---------------------------------------------------------------------------

class BillingInvoiceFacadeViewSet(viewsets.ViewSet):
    """Unified read facade across staff Invoice and ClientInvoice.

    Endpoints:
      GET /billing/invoices/?kind=client|staff   list InvoiceRecord[]
      GET /billing/invoices/{id}/                 single InvoiceRecord (id = invoice_number)
      GET /billing/invoices/stats/?kind=...       InvoiceStats
      GET /billing/invoices/aging/?kind=...       same shape as stats.buckets
      GET /billing/invoices/{id}/activity/        history timeline
    """

    permission_classes = [IsAuthenticated]

    def _kind(self, request):
        return request.query_params.get('kind', 'client')

    def _client_qs(self, request):
        company = _current_company(request)
        qs = ClientInvoice.objects.select_related('venue', 'company').prefetch_related('line_items', 'exports')
        if company:
            qs = qs.filter(company=company)
        return qs

    def _staff_qs(self, request):
        company = _current_company(request)
        qs = Invoice.objects.select_related('staff_user', 'staff_user__profile').prefetch_related('items', 'items__venue', 'exports')
        # Hide invoices that have been superseded (resolved by reissue or
        # replaced by a period invoice in the hybrid flow). They remain in the
        # DB for audit but fall out of the default work queue.
        qs = qs.filter(superseded_by__isnull=True)
        if company:
            qs = qs.filter(staff_user__company_memberships__company=company).distinct()
        return qs

    def _resolve_one(self, request, pk):
        """Find an Invoice or ClientInvoice by its UI id (invoice_number)."""
        client = self._client_qs(request).filter(invoice_number=pk).first()
        if client:
            return client, 'client'
        staff = self._staff_qs(request).filter(invoice_number=pk).first()
        if staff:
            return staff, 'staff'
        # Fallback: a staff invoice without a generated invoice_number — try PK suffix
        if pk and pk.startswith('PAY-'):
            try:
                pk_id = int(pk.rsplit('-', 1)[-1])
                staff = self._staff_qs(request).filter(pk=pk_id).first()
                if staff:
                    return staff, 'staff'
            except ValueError:
                pass
        return None, None

    def list(self, request):
        kind = self._kind(request)
        if kind == 'client':
            qs = self._client_qs(request).order_by('-created_at')
            data = ClientBillingInvoiceSerializer(qs, many=True).data
        else:
            qs = self._staff_qs(request).order_by('-created_at')
            data = StaffBillingInvoiceSerializer(qs, many=True).data

        # Optional filters
        status_param = request.query_params.get('status')
        if status_param:
            data = [d for d in data if d.get('status') == status_param]
        search = (request.query_params.get('search') or '').strip().lower()
        if search:
            def _match(d):
                p = d.get('party') or {}
                return (
                    search in (d.get('id') or '').lower()
                    or search in (p.get('name') or '').lower()
                    or search in (p.get('email') or '').lower()
                )
            data = [d for d in data if _match(d)]

        return Response(data)

    def retrieve(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        ser = (
            ClientBillingInvoiceSerializer if kind == 'client' else StaffBillingInvoiceSerializer
        )
        return Response(ser(instance).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        kind = self._kind(request)
        qs = self._client_qs(request) if kind == 'client' else self._staff_qs(request)
        return Response(compute_stats_for_queryset(qs, kind))

    @action(detail=False, methods=['get'])
    def aging(self, request):
        kind = self._kind(request)
        qs = self._client_qs(request) if kind == 'client' else self._staff_qs(request)
        return Response(compute_stats_for_queryset(qs, kind)['buckets'])

    @action(detail=True, methods=['get'])
    def activity(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        resource_type = 'ClientInvoice' if kind == 'client' else 'Invoice'
        logs = AuditLog.objects.filter(
            resource_type=resource_type, resource_id=str(instance.pk)
        ).order_by('-timestamp')[:50]
        from .serializers_billing import HistoryEntrySerializer
        return Response(HistoryEntrySerializer(logs, many=True).data)

    # ---------- Mutations (Tier 1) ----------

    def _serializer_for(self, kind):
        return ClientBillingInvoiceSerializer if kind == 'client' else StaffBillingInvoiceSerializer

    def _resource_type(self, kind):
        return 'ClientInvoice' if kind == 'client' else 'Invoice'

    def _bump_run_totals(self, instance):
        """Recalculate the parent PayrollRun's cached totals + derived status.

        Called after any invoice mutation (mark-paid, reject, void) so the
        run's gross_total, invoice_count, and the right-rail status pill stay
        in sync without a separate cron pass.
        """
        run = getattr(instance, 'payroll_run', None)
        if run is not None:
            run.recompute_totals()
            run.update_status_from_invoices()

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if instance.status not in ('draft', 'pending', 'sent', 'overdue', 'approved'):
            return Response(
                {'detail': f"Cannot mark a '{instance.status}' invoice as paid."},
                status=status.HTTP_409_CONFLICT,
            )
        instance.status = 'paid'
        paid_date = request.data.get('paid_date') or timezone.localdate().isoformat()
        # paid_date may arrive as ISO string; let DRF DateField parsing keep it simple.
        from datetime import date as _date
        if isinstance(paid_date, str):
            instance.paid_date = _date.fromisoformat(paid_date)
        else:
            instance.paid_date = paid_date
        instance.save(update_fields=['status', 'paid_date', 'updated_at'])
        if kind == 'staff':
            _notify_invoice_paid(instance, marked_by=request.user)
        AuditLog.objects.create(
            user=request.user,
            action='invoice_paid',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={'amount': float(instance.total_amount or 0),
                     'paid_date': instance.paid_date.isoformat()},
        )
        self._bump_run_totals(instance)
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if instance.status == 'paid':
            return Response({'detail': 'Cannot reject a paid invoice.'},
                            status=status.HTTP_409_CONFLICT)
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'A reason is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        instance.status = 'rejected'
        instance.reject_reason = reason
        instance.save(update_fields=['status', 'reject_reason', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='invoice_rejected',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={'reason': reason},
        )
        self._bump_run_totals(instance)
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if instance.status == 'paid':
            return Response({'detail': 'Cannot void a paid invoice.'},
                            status=status.HTTP_409_CONFLICT)
        # 'cancelled' exists as a legacy ClientInvoice status; staff invoices use 'rejected'.
        instance.status = 'cancelled' if kind == 'client' else 'rejected'
        update_fields = ['status', 'updated_at']
        if not getattr(instance, 'reject_reason', ''):
            instance.reject_reason = request.data.get('reason') or 'Voided'
            update_fields.append('reject_reason')
        instance.save(update_fields=update_fields)
        AuditLog.objects.create(
            user=request.user,
            action='invoice_voided',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={},
        )
        self._bump_run_totals(instance)
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """Transition a draft invoice to pending.

        Used by the "Issue & send" action on a draft invoice — typically the
        result of "Resolve & re-issue" on a previously-rejected invoice. Once
        issued the manager can use Mark paid / Send reminder / Email payslip
        like any other pending invoice.
        """
        from django.utils import timezone
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if instance.status != 'draft':
            return Response(
                {'detail': f"Can only issue draft invoices (current: {instance.status})."},
                status=status.HTTP_409_CONFLICT,
            )
        instance.status = 'pending'
        instance.issued_date = timezone.localdate()
        instance.save(update_fields=['status', 'issued_date', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='invoice_issued',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={'issued_date': instance.issued_date.isoformat()},
        )
        self._bump_run_totals(instance)
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """P3.2 (C2 fix): force-recompute invoice line items from current shift
        state and pay rates. Bypasses the idempotency guard in
        generate_for_staff_period so rate corrections / shift edits actually
        apply to existing invoices without faking a TimeAdjustment.

        Refuses paid invoices (locked) and ClientInvoice (only staff invoices
        have recalculate_from_shifts). Audit-logged with before/after amounts.
        """
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if kind != 'staff':
            return Response(
                {'detail': 'Recalculate is only supported on staff invoices.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.status == 'paid':
            return Response(
                {'detail': 'Cannot recalculate a paid invoice — it is locked.'},
                status=status.HTTP_409_CONFLICT,
            )
        if instance.superseded_by_id is not None:
            return Response(
                {'detail': 'Cannot recalculate a superseded invoice.'},
                status=status.HTTP_409_CONFLICT,
            )

        before_amount = float(instance.total_amount or 0)
        before_hours = float(instance.total_hours or 0)
        instance.recalculate_from_shifts()
        instance.refresh_from_db()

        AuditLog.objects.create(
            user=request.user,
            action='invoice_recalculated',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={
                'before_amount': before_amount,
                'after_amount': float(instance.total_amount or 0),
                'before_hours': before_hours,
                'after_hours': float(instance.total_hours or 0),
                'version': instance.version,
            },
        )
        self._bump_run_totals(instance)
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['post'])
    def edit_shift_rate(self, request, pk=None):
        """Update the hourly_rate on one shift attached to this draft invoice
        and recalculate in a single mutation. Powers the click-to-edit rate
        cell on the invoice document — saves the admin a trip to Scheduling.

        Body: {"shift_id": <int>, "hourly_rate": <decimal>}.

        Constraints:
          - Staff invoices only (ClientInvoice line items aren't shift-backed).
          - Draft only — issued/paid/rejected invoices already represent a
            committed record; rate corrections there go through `resolve` to
            preserve audit trail.
          - The shift must already be on this invoice (no sneaking new shifts in).
        """
        from decimal import Decimal, InvalidOperation
        from .models import Shift

        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if kind != 'staff':
            return Response(
                {'detail': 'Edit shift rate is only supported on staff invoices.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.status != 'draft':
            return Response(
                {'detail': f"Can only edit rates on draft invoices (current: {instance.status})."},
                status=status.HTTP_409_CONFLICT,
            )
        if instance.superseded_by_id is not None:
            return Response(
                {'detail': 'Cannot edit a superseded invoice.'},
                status=status.HTTP_409_CONFLICT,
            )

        shift_id = request.data.get('shift_id')
        raw_rate = request.data.get('hourly_rate')
        if shift_id in (None, ''):
            return Response({'detail': "Field 'shift_id' is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if raw_rate in (None, ''):
            return Response({'detail': "Field 'hourly_rate' is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            new_rate = Decimal(str(raw_rate))
        except (InvalidOperation, TypeError):
            return Response({'detail': "'hourly_rate' must be a decimal."},
                            status=status.HTTP_400_BAD_REQUEST)
        if new_rate <= 0:
            return Response({'detail': "'hourly_rate' must be greater than 0."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Confirm the shift is actually on this invoice — prevents using this
        # endpoint as a generic shift-update sidedoor.
        if not instance.items.filter(shift_id=shift_id).exists():
            return Response(
                {'detail': 'That shift is not on this invoice.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            shift = Shift.objects.get(pk=shift_id)
        except Shift.DoesNotExist:
            return Response({'detail': 'Shift not found.'},
                            status=status.HTTP_404_NOT_FOUND)

        before_rate = shift.hourly_rate
        before_amount = float(instance.total_amount or 0)

        shift.hourly_rate = new_rate
        shift.save(update_fields=['hourly_rate', 'updated_at'])
        instance.recalculate_from_shifts()
        instance.refresh_from_db()

        AuditLog.objects.create(
            user=request.user,
            action='invoice_shift_rate_edited',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={
                'shift_id': int(shift_id),
                'before_rate': float(before_rate) if before_rate is not None else None,
                'after_rate': float(new_rate),
                'before_amount': before_amount,
                'after_amount': float(instance.total_amount or 0),
            },
        )
        self._bump_run_totals(instance)
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['patch'])
    def update_note(self, request, pk=None):
        """Update an invoice's `note` field (free-text caption shown on the
        payslip and Activity timeline). Used by the "Edit" modal.
        """
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        new_note = request.data.get('note')
        if new_note is None:
            return Response(
                {'detail': "Field 'note' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.notes = (new_note or '').strip()
        instance.save(update_fields=['notes', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='invoice_note_updated',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={'length': len(instance.notes)},
        )
        return Response(self._serializer_for(kind)(instance).data)

    @action(detail=True, methods=['post'])
    def remind(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Best-effort notification — uses the existing Notification.send pattern.
        try:
            from .models import Notification
            recipient = instance.staff_user if kind == 'staff' else None
            if recipient is not None:
                Notification.send(
                    user=recipient,
                    company=getattr(instance, 'company', None) or _current_company(request),
                    notification_type='invoice_ready',
                    title='Payment reminder',
                    message=f"Reminder for invoice {instance.invoice_number or instance.pk}.",
                    related_type=self._resource_type(kind),
                    related_id=instance.pk,
                )
        except Exception:
            # Don't block the audit log on notification delivery failures.
            pass
        AuditLog.objects.create(
            user=request.user,
            action='invoice_reminder_sent',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={},
        )
        return Response(self._serializer_for(kind)(instance).data)

    def _clone_to_draft(self, instance, kind, actor):
        """Create a draft clone of the given invoice. Returns the new instance."""
        if kind == 'client':
            from .models import ClientInvoice, ClientInvoiceItem
            new_inv = ClientInvoice.objects.create(
                company=instance.company,
                venue=instance.venue,
                invoice_number=ClientInvoice.generate_invoice_number(instance.company),
                start_date=instance.start_date,
                end_date=instance.end_date,
                tax_rate=instance.tax_rate,
                client_name=instance.client_name,
                client_address=instance.client_address,
                client_email=instance.client_email,
                notes=instance.notes,
                created_by=actor,
                status='draft',
            )
            for li in instance.line_items.all():
                ClientInvoiceItem.objects.create(
                    invoice=new_inv,
                    shift=li.shift,
                    description=li.description,
                    date=li.date,
                    hours=li.hours,
                    rate=li.rate,
                )
            new_inv.calculate_totals()
        else:
            from .models import Invoice, InvoiceItem
            new_inv = Invoice.objects.create(
                staff_user=instance.staff_user,
                start_date=instance.start_date,
                end_date=instance.end_date,
                total_hours=instance.total_hours,
                hourly_rate=instance.hourly_rate,
                total_amount=instance.total_amount,
                status='draft',
                source='admin',
                created_by=actor,
                notes=instance.notes,
            )
            for li in instance.items.all():
                InvoiceItem.objects.create(
                    invoice=new_inv,
                    item_type=li.item_type,
                    shift=li.shift,
                    leave_request=li.leave_request,
                    bank_holiday=li.bank_holiday,
                    date=li.date,
                    venue=li.venue,
                    description=li.description,
                    hours_worked=li.hours_worked,
                    days=li.days,
                    rate=li.rate,
                    amount=li.amount,
                )
        return new_inv

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        new_inv = self._clone_to_draft(instance, kind, request.user)
        AuditLog.objects.create(
            user=request.user,
            action='invoice_duplicated',
            resource_type=self._resource_type(kind),
            resource_id=str(new_inv.pk),
            details={'source_id': str(instance.pk)},
        )
        return Response(self._serializer_for(kind)(new_inv).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='from-shifts')
    def from_shifts(self, request):
        """Create a draft client invoice from approved shifts at a venue.

        Body: {"venueId": "<uuid>", "periodStart": "YYYY-MM-DD", "periodEnd": "YYYY-MM-DD", "notes": "..."}
        Builds line items from every approved shift in the period at the
        named venue. Used by the "+ New invoice" button on the Clients ledger.
        Staff invoices are *not* created this way — they roll up via the
        weekly/monthly payroll cron from the staff side.
        """
        from datetime import date as _date
        from .models import ClientInvoice, Venue

        company = _current_company(request)
        if not company:
            return Response({'detail': 'No company in context.'},
                            status=status.HTTP_400_BAD_REQUEST)

        venue_id = request.data.get('venueId')
        period_start = request.data.get('periodStart')
        period_end = request.data.get('periodEnd')
        notes = request.data.get('notes') or ''

        if not (venue_id and period_start and period_end):
            return Response(
                {'detail': 'venueId, periodStart, and periodEnd are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start = _date.fromisoformat(period_start)
            end = _date.fromisoformat(period_end)
        except ValueError:
            return Response(
                {'detail': 'periodStart/periodEnd must be ISO YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end < start:
            return Response(
                {'detail': 'periodEnd must be on or after periodStart.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        venue = Venue.objects.filter(pk=venue_id, company=company).first()
        if not venue:
            return Response(
                {'detail': 'Venue not found in your company.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            invoice = ClientInvoice.generate_for_venue_period(
                venue=venue,
                start_date=start,
                end_date=end,
                created_by=request.user,
                notes=notes,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        AuditLog.objects.create(
            user=request.user,
            action='client_invoice_created',
            resource_type='ClientInvoice',
            resource_id=str(invoice.pk),
            details={
                'venue_id': str(venue.id),
                'venue_name': venue.name,
                'period_start': start.isoformat(),
                'period_end': end.isoformat(),
                'invoice_number': invoice.invoice_number,
            },
        )
        return Response(
            ClientBillingInvoiceSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Duplicate the invoice as a draft AND mark the original as superseded.

        Used by the "Resolve & re-issue" button on rejected invoices. The
        original stays in the DB as the audit trail (its `reject_reason` and
        history are preserved) but its `superseded_by` link points to the new
        draft, so the UI shows it as 'Resolved' instead of 'Rejected' — out
        of the manager's open work queue.
        """
        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        new_inv = self._clone_to_draft(instance, kind, request.user)
        instance.superseded_by = new_inv
        instance.save(update_fields=['superseded_by', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='invoice_resolved_and_reissued',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={'replaced_by': str(new_inv.pk)},
        )
        return Response(self._serializer_for(kind)(new_inv).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Stream a generated payslip PDF for the invoice.

        Resolves the same identifiers (invoice_number / PAY-{id}) as every
        other facade action. Staff invoices use the rich payslip template
        in api.utils.invoice_pdf; client invoices fall back to the same
        renderer for now (which already covers their line-item structure).
        """
        from django.http import FileResponse
        from .utils.invoice_pdf import generate_invoice_pdf

        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if kind != 'staff':
            return Response(
                {'detail': 'Client-invoice PDF rendering is not yet implemented.'},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        try:
            pdf_buffer = generate_invoice_pdf(instance)
            number = instance.invoice_number or f"PAY-{instance.pk}"
            return FileResponse(
                pdf_buffer,
                content_type='application/pdf',
                filename=f"{number}.pdf",
                as_attachment=True,
            )
        except Exception as e:
            return Response(
                {'detail': f'Failed to generate PDF: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'], url_path='email-payslip')
    def email_payslip(self, request, pk=None):
        """Generate the payslip PDF and email it to the staff member.

        Uses the configured Django mail backend (MailHog in dev, Brevo in prod).
        The recipient is `staff_user.email`; refuses gracefully if missing.
        Sends a branded HTML body with a plain-text fallback and the PDF
        attached.
        """
        from django.core.mail import EmailMultiAlternatives
        from django.conf import settings
        from .utils.invoice_pdf import generate_invoice_pdf

        instance, kind = self._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if kind != 'staff':
            return Response(
                {'detail': 'Email payslip is only supported for staff invoices.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recipient = (instance.staff_user.email or '').strip()
        if not recipient:
            return Response(
                {'detail': 'Officer has no email address on file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pdf_buffer = generate_invoice_pdf(instance)
        except Exception as e:
            return Response(
                {'detail': f'Failed to generate PDF: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        number = instance.invoice_number or f"PAY-{instance.pk}"
        period = (
            f"{instance.start_date.strftime('%d %b')} – "
            f"{instance.end_date.strftime('%d %b %Y')}"
        )
        subject = f"Your payslip for {period} ({number})"

        first_name = instance.staff_user.first_name or instance.staff_user.username

        # Resolve company branding once — used in both header and footer.
        membership = instance.staff_user.company_memberships.filter(is_active=True).first()
        company = membership.company if membership else None
        company_name = (getattr(company, 'name', None) or 'Mead Security').strip()
        contact_email = (
            getattr(company, 'contact_email', None)
            or getattr(settings, 'DEFAULT_FROM_EMAIL', '')
            or 'no-reply@meadsecurity.co.uk'
        )

        # Per-tier composition for the summary table — only shown when non-zero.
        from decimal import Decimal
        from collections import OrderedDict
        rollup = OrderedDict([
            ('Shifts', Decimal('0')),
            ('Overtime · 1.5×', Decimal('0')),
            ('Overtime · 2×', Decimal('0')),
            ('Bank holiday', Decimal('0')),
            ('Annual leave', Decimal('0')),
            ('Special event', Decimal('0')),
        ])
        type_to_label = {
            'shift': 'Shifts',
            'overtime_1': 'Overtime · 1.5×',
            'overtime_2': 'Overtime · 2×',
            'bank_holiday': 'Bank holiday',
            'annual_leave': 'Annual leave',
            'special': 'Special event',
        }
        for item in instance.items.all():
            label = type_to_label.get(item.item_type)
            if label:
                rollup[label] += Decimal(str(item.amount or 0))

        active_rows = [(k, v) for k, v in rollup.items() if v > 0]

        plain_lines = [
            f"Hi {first_name},",
            "",
            f"Your payslip for {period} is attached as a PDF.",
            f"Total payable: £{instance.total_amount}",
            "",
        ]
        if active_rows:
            plain_lines.append("Breakdown:")
            for k, v in active_rows:
                plain_lines.append(f"  - {k}: £{v}")
            plain_lines.append("")
        plain_lines += [
            "If anything looks off, reply to this email and we'll take a look.",
            "",
            f"— {company_name}",
        ]
        plain_body = "\n".join(plain_lines)

        # Inline-styled HTML — single column, ~560px, table-based layout for
        # maximum compatibility (Gmail/Outlook strip head <style>).
        rows_html = ''.join(
            f'<tr>'
            f'<td style="padding:6px 0;color:#5f6166;font-size:13px;">{k}</td>'
            f'<td style="padding:6px 0;color:#1a1a2e;font-size:13px;text-align:right;'
            f'font-variant-numeric:tabular-nums;">£{v:,.2f}</td>'
            f'</tr>'
            for k, v in active_rows
        )
        breakdown_block = (
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'style="width:100%;border-collapse:collapse;margin:0 0 18px;">'
            f'{rows_html}'
            f'<tr><td colspan="2" style="border-top:1px solid #e5e7eb;height:1px;"></td></tr>'
            f'<tr>'
            f'<td style="padding:10px 0 0;font-weight:700;color:#1a1a2e;font-size:14px;">Total payable</td>'
            f'<td style="padding:10px 0 0;font-weight:700;color:#1a1a2e;font-size:16px;text-align:right;'
            f'font-variant-numeric:tabular-nums;">£{instance.total_amount:,.2f}</td>'
            f'</tr></table>'
        ) if active_rows else (
            f'<p style="margin:0 0 18px;color:#1a1a2e;font-size:18px;font-weight:700;">'
            f'Total payable: £{instance.total_amount:,.2f}</p>'
        )

        html_body = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#1a1a2e;padding:24px 28px;color:#ffffff;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#cbd5e1;margin-bottom:4px;">PAYSLIP</div>
          <div style="font-size:20px;font-weight:700;line-height:1.2;">{company_name}</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;color:#1a1a2e;font-size:15px;line-height:1.5;">Hi {first_name},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.55;">
            Your payslip for <strong>{period}</strong> is ready. Reference <code style="background:#f1f3f5;padding:1px 6px;border-radius:3px;font-size:12px;">{number}</code> &mdash; the full breakdown is attached as a PDF.
          </p>
          {breakdown_block}
          <p style="margin:0 0 8px;color:#5f6166;font-size:13px;line-height:1.55;">
            If anything looks off, reply to this email and we&rsquo;ll take a look.
          </p>
        </td></tr>
        <tr><td style="background:#fafbfc;padding:16px 28px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11.5px;line-height:1.5;">
          Sent by {company_name} &middot; <a href="mailto:{contact_email}" style="color:#9ca3af;text-decoration:underline;">{contact_email}</a><br>
          This is an automated message. The attached PDF is the canonical record of your pay for this period.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
"""

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'no-reply@meadsecurity.co.uk'

        try:
            email = EmailMultiAlternatives(subject, plain_body, from_email, [recipient])
            email.attach_alternative(html_body, 'text/html')
            email.attach(f"{number}.pdf", pdf_buffer.getvalue(), 'application/pdf')
            email.send(fail_silently=False)
        except Exception as e:
            return Response(
                {'detail': f'Failed to send email: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        AuditLog.objects.create(
            user=request.user,
            action='invoice_payslip_emailed',
            resource_type=self._resource_type(kind),
            resource_id=str(instance.pk),
            details={'recipient': recipient, 'invoice_number': number},
        )

        return Response({'sent': True, 'recipient': recipient})


# ---------------------------------------------------------------------------
# /api/v1/payroll/runs/
# ---------------------------------------------------------------------------

class PayrollRunViewSet(viewsets.ViewSet):
    """Read-only payroll-run views.

    Endpoints:
      GET /payroll/runs/                            PayrollHistoryRun[]
      GET /payroll/runs/current/                    current PayrollRun (creates if missing)
      GET /payroll/runs/{run_code}/                 PayrollRun
      GET /payroll/runs/{run_code}/officers/        Officer[]
      GET /payroll/runs/{run_code}/officers/{id}/   OfficerBundle (items + adjustments)
      GET /payroll/runs/{run_code}/composition/     dict<itemType, totalAmount>
      GET /payroll/runs/{run_code}/sia-holds/       Officer[] filtered to SIA expired/expiring
      GET /payroll/providers/                       FinanceProvider[]
    """

    permission_classes = [IsAuthenticated]
    lookup_field = 'run_code'
    lookup_value_regex = r'[\w-]+'

    def _company_qs(self, request):
        company = _current_company(request)
        qs = PayrollRun.objects.all()
        if company:
            qs = qs.filter(company=company)
        return qs

    def _cycle_filter(self, request):
        """Read ?cycle=weekly|monthly query param; default to weekly."""
        cycle = (request.query_params.get('cycle') or 'weekly').lower()
        if cycle not in ('weekly', 'monthly'):
            cycle = 'weekly'
        return cycle

    def list(self, request):
        cycle = self._cycle_filter(request)
        qs = self._company_qs(request).filter(cycle=cycle).order_by('-period_start')[:12]
        return Response(PayrollHistoryRunSerializer(qs, many=True).data)

    def retrieve(self, request, run_code=None):
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PayrollRunSerializer(run).data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        company = _current_company(request)
        if not company:
            return Response({'detail': 'No company in context.'}, status=status.HTTP_400_BAD_REQUEST)
        cycle = self._cycle_filter(request)
        today = timezone.localdate()
        if cycle == 'monthly':
            params = PayrollRun.for_calendar_month(today)
        else:
            params = PayrollRun.for_iso_week(today)
        run, _ = PayrollRun.objects.get_or_create(
            company=company,
            cycle=cycle,
            period_start=params['period_start'],
            period_end=params['period_end'],
            defaults={
                'run_code': params['run_code'],
                'label': params['label'],
                'process_date': params['process_date'],
            },
        )
        run.recompute_totals()
        return Response(PayrollRunSerializer(run).data)

    def _run_invoices(self, run):
        return (
            Invoice.objects.filter(payroll_run=run, superseded_by__isnull=True)
            .select_related('staff_user', 'staff_user__profile')
            .prefetch_related('items', 'items__venue')
        )

    @action(detail=True, methods=['post'])
    def regenerate(self, request, run_code=None):
        """Re-run the payroll aggregation for a single run.

        Mirrors the per-company branch of `tasks._run_payroll_for_period` but
        scoped to the requesting user's company and this one run, so a manager
        can pick up newly-approved shifts or rate corrections without waiting
        for the Monday cron.
        """
        from django.db import transaction as _txn
        from .models import Shift

        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        company = run.company
        params = {
            'period_start': run.period_start,
            'period_end': run.period_end,
            'cycle': run.cycle,
        }

        regenerated = 0
        errors = 0
        skipped_staff_ids = []
        with _txn.atomic():
            # P4 (H2 fix): all staff with eligible shifts in this period,
            # regardless of pay_frequency. We then split into included vs
            # skipped so the manager sees who got dropped and can act on it
            # (set their pay_frequency or trigger a different cycle).
            shift_filter = dict(
                venue__company=company,
                start_time__date__gte=params['period_start'],
                start_time__date__lte=params['period_end'],
                status='approved',
                actual_hours_worked__isnull=False,
            )
            all_staff_ids = set(
                Shift.objects.filter(**shift_filter)
                .values_list('staff_user_id', flat=True)
                .distinct()
            )
            eligible_staff_ids = set(
                Shift.objects.filter(
                    **shift_filter,
                    staff_user__profile__pay_frequency=run.cycle,
                )
                .values_list('staff_user_id', flat=True)
                .distinct()
            )
            skipped_staff_ids = sorted(all_staff_ids - eligible_staff_ids)

            for staff_user in User.objects.filter(pk__in=eligible_staff_ids):
                try:
                    invoice = Invoice.generate_for_staff_period(
                        staff_user=staff_user,
                        start_date=params['period_start'],
                        end_date=params['period_end'],
                        source='system',
                    )
                    if invoice.payroll_run_id != run.id:
                        invoice.payroll_run = run
                        invoice.save(update_fields=['payroll_run', 'updated_at'])
                    regenerated += 1
                except ValueError:
                    continue
                except Exception:
                    errors += 1

            run.recompute_totals()

            AuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action='payroll_run_regenerated',
                resource_type='PayrollRun',
                resource_id=str(run.id),
                details={
                    'run_code': run.run_code,
                    'regenerated': regenerated,
                    'errors': errors,
                    'skipped_staff_count': len(skipped_staff_ids),
                    'skipped_staff_ids': skipped_staff_ids,
                },
            )

        return Response({
            'run': PayrollRunSerializer(run).data,
            'regenerated': regenerated,
            'errors': errors,
            'skipped_staff': [
                {
                    'id': uid,
                    'reason': 'pay_frequency does not match run cycle',
                }
                for uid in skipped_staff_ids
            ],
        })

    @action(detail=True, methods=['get'])
    def officers(self, request, run_code=None):
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        rows = [_aggregate_officer(inv, run) for inv in self._run_invoices(run)]
        return Response(rows)

    @action(detail=True, methods=['get'], url_path=r'officers/(?P<officer_id>\d+)')
    def officer_detail(self, request, run_code=None, officer_id=None):
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        invoice = self._run_invoices(run).filter(staff_user_id=officer_id).first()
        if not invoice:
            return Response({'detail': 'Officer not in run.'}, status=status.HTTP_404_NOT_FOUND)

        items = invoice.items.all().order_by('date', 'item_type')
        adjustments = []
        shift_ids = list(items.exclude(shift__isnull=True).values_list('shift_id', flat=True).distinct())
        if shift_ids:
            adjs = TimeAdjustment.objects.filter(shift_id__in=shift_ids).order_by('-created_at')
            adjustments = [_adjustment_payload(a) for a in adjs]

        return Response({
            'items': [_line_item_payload(i) for i in items],
            'adjustments': adjustments,
        })

    @action(detail=True, methods=['get'])
    def composition(self, request, run_code=None):
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        from django.db.models import Sum
        items = InvoiceItem.objects.filter(invoice__payroll_run=run)
        breakdown = (
            items.values('item_type')
            .annotate(amount=Sum('amount'))
            .order_by('item_type')
        )
        result = {'shift': 0.0, 'overtime_1': 0.0, 'overtime_2': 0.0,
                  'bank_holiday': 0.0, 'annual_leave': 0.0, 'special': 0.0}
        for row in breakdown:
            result[row['item_type']] = float(row['amount'] or 0)
        result['total'] = sum(result.values())
        return Response(result)

    @action(detail=True, methods=['get'], url_path='sia-holds')
    def sia_holds(self, request, run_code=None):
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        rows = [_aggregate_officer(inv, run) for inv in self._run_invoices(run)]
        # Surface officers with expired or expiring (<=14 days) SIA
        flagged = [r for r in rows if r['sia']['expired'] or 0 <= r['sia']['expiresInDays'] <= 14]
        return Response(flagged)

    # ---------- Officer mutations (Tier 1) ----------

    def _officer_invoice(self, request, run_code, officer_id):
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return None, None
        invoice = self._run_invoices(run).filter(staff_user_id=officer_id).first()
        return run, invoice

    @action(detail=True, methods=['post'], url_path=r'officers/(?P<officer_id>\d+)/approve')
    def approve_officer(self, request, run_code=None, officer_id=None):
        """Manager sign-off: pending → approved. Money has NOT moved yet.

        Approval is reversible (-> rejected) until the invoice is exported
        and paid. The actual payment step is mark_paid_officer below.
        """
        run, invoice = self._officer_invoice(request, run_code, officer_id)
        if not run or not invoice:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Idempotent on terminal/already-approved states.
        if invoice.status in ('approved', 'paid'):
            return Response(_aggregate_officer(invoice, run))
        if invoice.status == 'rejected':
            return Response(
                {'detail': 'Cannot approve a rejected invoice — reissue first.'},
                status=status.HTTP_409_CONFLICT,
            )
        invoice.status = 'approved'
        invoice.save(update_fields=['status', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='officer_approved',
            resource_type='Invoice',
            resource_id=str(invoice.pk),
            details={'run': run.run_code, 'officer_id': int(officer_id),
                     'amount': float(invoice.total_amount or 0)},
        )
        run.recompute_totals()
        return Response(_aggregate_officer(invoice, run))

    @action(detail=True, methods=['post'], url_path=r'officers/(?P<officer_id>\d+)/mark-paid')
    def mark_paid_officer(self, request, run_code=None, officer_id=None):
        """Settlement step: approved → paid. Sets paid_date.

        Intended for the path where the accountant has confirmed payment
        was sent (or the Xero webhook tells us so). Refuses if the invoice
        hasn't been approved yet, so payment can't bypass manager review.
        """
        run, invoice = self._officer_invoice(request, run_code, officer_id)
        if not run or not invoice:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if invoice.status == 'paid':
            return Response(_aggregate_officer(invoice, run))
        if invoice.status != 'approved':
            return Response(
                {'detail': f"Cannot mark a '{invoice.status}' invoice as paid — approve it first."},
                status=status.HTTP_409_CONFLICT,
            )
        invoice.status = 'paid'
        invoice.paid_date = timezone.localdate()
        invoice.save(update_fields=['status', 'paid_date', 'updated_at'])
        _notify_invoice_paid(invoice, marked_by=request.user)
        AuditLog.objects.create(
            user=request.user,
            action='invoice_paid',
            resource_type='Invoice',
            resource_id=str(invoice.pk),
            details={'run': run.run_code, 'officer_id': int(officer_id),
                     'amount': float(invoice.total_amount or 0)},
        )
        run.recompute_totals()
        return Response(_aggregate_officer(invoice, run))

    @action(detail=True, methods=['post'], url_path='approve-all')
    def approve_all(self, request, run_code=None):
        """Bulk manager sign-off: every pending invoice in the run flips to
        'approved'. Money has NOT moved yet — that's mark_paid_all.

        Optional `officer_ids` body param scopes to checkbox-selected staff.
        """
        from django.db import transaction
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        officer_ids = request.data.get('officer_ids') or []
        if officer_ids and not isinstance(officer_ids, list):
            return Response(
                {'detail': 'officer_ids must be a list of staff_user IDs.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending_qs = self._run_invoices(run).filter(
            status__in=('pending', 'draft', 'sent')
        )
        if officer_ids:
            pending_qs = pending_qs.filter(staff_user_id__in=officer_ids)
        pending = list(pending_qs)
        if not pending:
            return Response(
                {'detail': 'Nothing to approve — no pending invoices in this run.',
                 'approved_count': 0},
                status=status.HTTP_200_OK,
            )

        approved_count = 0
        with transaction.atomic():
            for invoice in pending:
                invoice.status = 'approved'
                invoice.save(update_fields=['status', 'updated_at'])
                AuditLog.objects.create(
                    user=request.user,
                    action='officer_approved',
                    resource_type='Invoice',
                    resource_id=str(invoice.pk),
                    details={
                        'run': run.run_code,
                        'officer_id': invoice.staff_user_id,
                        'amount': float(invoice.total_amount or 0),
                        'bulk': True,
                        'scoped': bool(officer_ids),
                    },
                )
                approved_count += 1

            run.recompute_totals()
            run.update_status_from_invoices()

        # Re-read so the response reflects what the signals just updated.
        run.refresh_from_db()

        officers = [
            _aggregate_officer(inv, run)
            for inv in self._run_invoices(run).order_by('staff_user__username')
        ]
        return Response({
            'approved_count': approved_count,
            'run_status': run.status,
            'officers': officers,
        })

    @action(detail=True, methods=['post'], url_path='mark-paid-all')
    def mark_paid_all(self, request, run_code=None):
        """Bulk settlement: every approved invoice in the run flips to 'paid'
        with paid_date=today.

        This is the manual fallback for when payment is confirmed but the
        Xero webhook hasn't fired (or isn't wired yet). Refuses to flip
        anything that hasn't been approved first, so payment can't bypass
        manager review.

        Optional `officer_ids` body param scopes to checkbox-selected staff.
        """
        from django.db import transaction
        run = self._company_qs(request).filter(run_code=run_code).first()
        if not run:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        officer_ids = request.data.get('officer_ids') or []
        if officer_ids and not isinstance(officer_ids, list):
            return Response(
                {'detail': 'officer_ids must be a list of staff_user IDs.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        approved_qs = self._run_invoices(run).filter(status='approved')
        if officer_ids:
            approved_qs = approved_qs.filter(staff_user_id__in=officer_ids)
        approved = list(approved_qs)
        if not approved:
            return Response(
                {'detail': 'Nothing to mark paid — no approved invoices waiting.',
                 'paid_count': 0},
                status=status.HTTP_200_OK,
            )

        today = timezone.localdate()
        paid_count = 0
        with transaction.atomic():
            for invoice in approved:
                invoice.status = 'paid'
                invoice.paid_date = today
                invoice.save(update_fields=['status', 'paid_date', 'updated_at'])
                _notify_invoice_paid(invoice, marked_by=request.user)
                AuditLog.objects.create(
                    user=request.user,
                    action='invoice_paid',
                    resource_type='Invoice',
                    resource_id=str(invoice.pk),
                    details={
                        'run': run.run_code,
                        'officer_id': invoice.staff_user_id,
                        'amount': float(invoice.total_amount or 0),
                        'bulk': True,
                        'scoped': bool(officer_ids),
                    },
                )
                paid_count += 1

            run.recompute_totals()
            run.update_status_from_invoices()

        # Re-read so the response reflects what the signals just updated.
        run.refresh_from_db()

        officers = [
            _aggregate_officer(inv, run)
            for inv in self._run_invoices(run).order_by('staff_user__username')
        ]
        return Response({
            'paid_count': paid_count,
            'run_status': run.status,
            'officers': officers,
        })

    @action(detail=True, methods=['post'], url_path=r'officers/(?P<officer_id>\d+)/reject')
    def reject_officer(self, request, run_code=None, officer_id=None):
        run, invoice = self._officer_invoice(request, run_code, officer_id)
        if not run or not invoice:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'A reason is required.'},
                            status=status.HTTP_400_BAD_REQUEST)
        invoice.status = 'rejected'
        invoice.reject_reason = reason
        invoice.save(update_fields=['status', 'reject_reason', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='officer_rejected',
            resource_type='Invoice',
            resource_id=str(invoice.pk),
            details={'run': run.run_code, 'officer_id': int(officer_id),
                     'reason': reason},
        )
        run.recompute_totals()
        return Response(_aggregate_officer(invoice, run))


# ---------------------------------------------------------------------------
# /api/v1/billing/finance-providers/
# ---------------------------------------------------------------------------

class FinanceProviderViewSet(viewsets.ViewSet):
    """Lists the AccountingProvider rows joined with company connection state."""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        if AccountingProvider is None:
            return Response([])
        providers = AccountingProvider.objects.filter(is_active=True).prefetch_related('connections')
        return Response(FinanceProviderSerializer(providers, many=True).data)


# ---------------------------------------------------------------------------
# /api/v1/billing/statements/
# ---------------------------------------------------------------------------

class StatementViewSet(viewsets.ModelViewSet):
    """Statement composer + send. The 'Send statement…' button creates one of these."""

    permission_classes = [IsAuthenticated]
    serializer_class = StatementSerializer

    def get_queryset(self):
        company = _current_company(self.request)
        qs = Statement.objects.select_related('venue', 'company').prefetch_related('invoices')
        if company:
            qs = qs.filter(company=company)
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        company = _current_company(request)
        if not company:
            return Response({'detail': 'No company in context.'}, status=status.HTTP_400_BAD_REQUEST)

        venue_id = request.data.get('venueId') or request.data.get('venue_id')
        period_start = request.data.get('periodStart') or request.data.get('period_start')
        period_end = request.data.get('periodEnd') or request.data.get('period_end')
        invoice_ids = request.data.get('invoiceIds') or request.data.get('invoice_ids') or []
        notes = request.data.get('notes', '')
        sent_to_email = request.data.get('sentToEmail') or request.data.get('sent_to_email') or ''

        if not (venue_id and period_start and period_end):
            return Response(
                {'detail': 'venueId, periodStart, periodEnd are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        venue = get_object_or_404(Venue, pk=venue_id)

        statement = Statement.objects.create(
            company=company,
            venue=venue,
            statement_number=Statement.generate_statement_number(company),
            period_start=period_start,
            period_end=period_end,
            notes=notes,
            sent_to_email=sent_to_email,
            created_by=request.user,
        )

        # Attach existing client invoices either by explicit list, or auto-pick
        # all client invoices for this venue in the period.
        if invoice_ids:
            invoices_qs = ClientInvoice.objects.filter(pk__in=invoice_ids, company=company)
        else:
            invoices_qs = ClientInvoice.objects.filter(
                company=company, venue=venue,
                start_date__gte=period_start, end_date__lte=period_end,
            )
        for idx, inv in enumerate(invoices_qs):
            StatementInvoice.objects.create(statement=statement, invoice=inv, sort_order=idx)

        AuditLog.objects.create(
            user=request.user,
            action='statement_created',
            resource_type='Statement',
            resource_id=str(statement.id),
            details={'venue_id': str(venue.id), 'invoices': invoices_qs.count()},
        )

        return Response(StatementSerializer(statement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send_statement(self, request, pk=None):
        statement = self.get_object()
        statement.status = 'sent'
        statement.issued_date = timezone.localdate()
        if request.data.get('sentToEmail'):
            statement.sent_to_email = request.data['sentToEmail']
        statement.save(update_fields=['status', 'issued_date', 'sent_to_email', 'updated_at'])
        statement.freeze_snapshot()
        AuditLog.objects.create(
            user=request.user,
            action='statement_sent',
            resource_type='Statement',
            resource_id=str(statement.id),
            details={'sent_to': statement.sent_to_email},
        )
        return Response(StatementSerializer(statement).data)


# ---------------------------------------------------------------------------
# /api/v1/billing/invoices/{id}/export-to-xero/
# Persist intent only (no real Xero call until OAuth ships).
# ---------------------------------------------------------------------------

class InvoiceExportStubViewSet(viewsets.ViewSet):
    """Records a 'pending' export attempt for a billing invoice. The Xero
    worker is not yet implemented — this just makes the UI's exportStatus
    pill switch from null/'failed' to 'pending' truthfully.
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path=r'(?P<pk>[\w-]+)/export-to-xero')
    def export(self, request, pk=None):
        if InvoiceExport is None or AccountingProvider is None:
            return Response({'detail': 'Finance integrations unavailable.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Resolve the invoice via the same logic as the facade
        facade = BillingInvoiceFacadeViewSet()
        instance, kind = facade._resolve_one(request, pk)
        if not instance:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        provider = AccountingProvider.objects.filter(provider_key='xero', is_active=True).first()
        if not provider:
            return Response({'detail': 'Xero provider not configured.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        connection = provider.connections.filter(status='connected').first()
        if not connection:
            # No active Xero connection — surface as failed so the UI shows the right pill.
            return Response(
                {'detail': 'No active Xero connection. Connect a Xero account first.',
                 'status': 'failed'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if kind == 'staff':
            export, created = InvoiceExport.objects.get_or_create(
                connection=connection, local_invoice=instance,
                defaults={'status': 'pending', 'exported_by': request.user},
            )
        else:
            export, created = ClientInvoiceExport.objects.get_or_create(
                connection=connection, local_invoice=instance,
                defaults={'status': 'pending', 'exported_by': request.user},
            )

        AuditLog.objects.create(
            user=request.user,
            action='invoice_xero_synced' if not created else 'invoice_xero_queued',
            resource_type='ClientInvoice' if kind == 'client' else 'Invoice',
            resource_id=str(instance.pk),
            details={'export_id': str(export.pk), 'status': export.status},
        )
        return Response({'status': export.status, 'created': created})
