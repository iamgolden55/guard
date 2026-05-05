"""UI-shape serializers for the Payroll & Invoices pages.

These mirror the TypeScript interfaces in:
- frontend/src/features/invoices/data/mocks.ts
- frontend/src/features/payroll/data/mocks.ts

Field names are camelCase via `source=` aliases. Naming and shape match
the mocks 1:1 so React components can swap mock imports for query hooks
without changing any rendering logic.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Avg, Max, Q
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Invoice,
    InvoiceItem,
    ClientInvoice,
    ClientInvoiceItem,
    PayrollRun,
    Statement,
    Venue,
    User,
    SIALicense,
    TimeAdjustment,
    AuditLog,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def stable_hue(seed):
    """Deterministic 0-359 hue for a party id. Mirrors the mock convention
    where every officer/client has a `hue` field used to colourise avatars."""
    if seed is None:
        return 0
    s = str(seed)
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h % 360


def derived_overdue(status, due_date):
    """A 'sent' invoice past its due_date renders as 'overdue' in the UI."""
    if status == 'sent' and due_date and due_date < timezone.localdate():
        return 'overdue'
    return status


def latest_export_status_for_invoice(invoice):
    """Return the latest finance_integrations.InvoiceExport status for a staff
    Invoice, or None if no export attempts exist."""
    exp = invoice.exports.order_by('-exported_at').first() if hasattr(invoice, 'exports') else None
    return exp.status if exp else None


def latest_export_status_for_client_invoice(client_invoice):
    """Same, for a ClientInvoice."""
    exp = client_invoice.exports.order_by('-exported_at').first() if hasattr(client_invoice, 'exports') else None
    return exp.status if exp else None


# ---------------------------------------------------------------------------
# Party serializers (the right-rail party card)
# ---------------------------------------------------------------------------

class ClientPartySerializer(serializers.Serializer):
    """Maps a Venue (acting as the billing client) to ClientPartyDetails."""

    id = serializers.SerializerMethodField()
    name = serializers.CharField()
    contact = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    terms = serializers.SerializerMethodField()
    hue = serializers.SerializerMethodField()

    def get_id(self, obj):
        return str(obj.id)

    def get_contact(self, obj):
        return getattr(obj, 'contact_name', '') or ''

    def get_email(self, obj):
        return getattr(obj, 'contact_email', '') or ''

    def get_address(self, obj):
        parts = []
        addr = getattr(obj, 'address', '') or ''
        city = getattr(obj, 'city', '') or ''
        postal = getattr(obj, 'postal_code', '') or ''
        if addr:
            parts.append(addr)
        line2 = ' '.join(p for p in [city, postal] if p)
        if line2:
            parts.append(line2)
        return parts

    def get_terms(self, obj):
        # Default to 30 days if not configured. Net-30 is the SystemSettings default.
        return 30

    def get_hue(self, obj):
        return stable_hue(obj.id)


class StaffPartySerializer(serializers.Serializer):
    """Maps a User (officer being paid) to StaffPartyDetails."""

    id = serializers.SerializerMethodField()
    staffProfileId = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    hue = serializers.SerializerMethodField()
    utr = serializers.SerializerMethodField()
    bank = serializers.SerializerMethodField()

    def get_id(self, obj):
        return str(obj.id)

    def get_staffProfileId(self, obj):
        prof = getattr(obj, 'profile', None)
        return prof.id if prof else None

    def get_name(self, obj):
        full = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return full or obj.username

    def get_role(self, obj):
        prof = getattr(obj, 'profile', None)
        return getattr(prof, 'role', None) or 'Officer'

    def get_hue(self, obj):
        return stable_hue(obj.id)

    def get_utr(self, obj):
        prof = getattr(obj, 'profile', None)
        return getattr(prof, 'utr', None) or ''

    def get_bank(self, obj):
        """Return the staff member's BankDetails as {name, sort, account}, or None.

        BankDetails.account_number / sort_code are EncryptedCharField, so the
        ORM returns them already decrypted. The payslip is intended for the
        staff member themselves (and admins reviewing pay), so we expose the
        full values rather than masking.
        """
        prof = getattr(obj, 'profile', None)
        bank = getattr(prof, 'bank_details', None) if prof else None
        if not bank:
            return None
        return {
            'name': bank.bank_name,
            'sort': bank.sort_code,
            'account': bank.account_number,
        }


# ---------------------------------------------------------------------------
# Invoice line items
# ---------------------------------------------------------------------------

class StaffInvoiceItemSerializer(serializers.Serializer):
    """Maps api.InvoiceItem to UI's `InvoiceItem` shape (date/desc/venue/hours/rate/amount).

    Money/hours fields use FloatField so the JSON is `number`-typed; the UI
    renders these via `it.rate.toFixed(2)` etc. and trips on DRF's default
    string serialisation for DecimalField.
    """

    date = serializers.DateField()
    desc = serializers.SerializerMethodField()
    venue = serializers.SerializerMethodField()
    hours = serializers.SerializerMethodField()
    rate = serializers.FloatField()
    amount = serializers.FloatField()

    def get_desc(self, obj):
        if obj.description:
            return obj.description
        if obj.item_type == 'shift':
            return f"Shift · {obj.venue.name if obj.venue else 'Site'}"
        if obj.item_type in ('overtime_1', 'overtime_2'):
            mult = '1.5×' if obj.item_type == 'overtime_1' else '2×'
            return f"Overtime ({mult})"
        if obj.item_type == 'bank_holiday':
            return obj.description or 'Bank Holiday'
        if obj.item_type == 'annual_leave':
            return 'Annual Leave'
        if obj.item_type == 'special':
            return obj.description or 'Special Event'
        return obj.item_type

    def get_venue(self, obj):
        return obj.venue.name if obj.venue else None

    def get_hours(self, obj):
        if obj.hours_worked is not None:
            return float(obj.hours_worked)
        if obj.days is not None:
            return float(obj.days)
        return 0.0


class ClientInvoiceItemSerializer(serializers.Serializer):
    date = serializers.DateField()
    desc = serializers.CharField(source='description')
    venue = serializers.SerializerMethodField()
    # FloatField so the UI receives `number`s, not strings. ModernInvoice
    # calls `.toFixed()` on these directly.
    hours = serializers.FloatField()
    rate = serializers.FloatField()
    amount = serializers.FloatField(source='total')

    def get_venue(self, obj):
        if obj.shift and obj.shift.venue:
            return obj.shift.venue.name
        return obj.invoice.venue.name if obj.invoice and obj.invoice.venue else None


# ---------------------------------------------------------------------------
# History (activity timeline)
# ---------------------------------------------------------------------------

class HistoryEntrySerializer(serializers.Serializer):
    """Renders an AuditLog row in the {at, by, action} shape the timeline expects."""

    at = serializers.SerializerMethodField()
    by = serializers.SerializerMethodField()
    action = serializers.SerializerMethodField()

    _ACTION_TEXT = {
        'invoice_created': 'Invoice created',
        'invoice_issued': 'Invoice issued',
        'invoice_sent': 'Sent to client',
        'invoice_paid': 'Marked paid',
        'invoice_rejected': 'Invoice rejected',
        'invoice_reminder_sent': 'Reminder sent',
        'invoice_xero_synced': 'Synced to Xero',
        'invoice_xero_queued': 'Queued for Xero',
        'invoice_status_change': 'Status changed',
        'invoice_voided': 'Invoice voided',
        'invoice_duplicated': 'Duplicated to draft',
        'officer_approved': 'Officer approved',
        'officer_rejected': 'Officer rejected',
        'statement_created': 'Statement created',
        'statement_sent': 'Statement sent',
        'time_adjusted': 'Hours adjusted',
    }

    def get_at(self, obj):
        # AuditLog uses `timestamp`; other models may use `created_at`. Try both.
        ts = getattr(obj, 'timestamp', None) or getattr(obj, 'created_at', None)
        return ts.isoformat() if ts else None

    def get_by(self, obj):
        u = getattr(obj, 'user', None)
        if not u:
            return 'system'
        full = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return full or u.username

    def get_action(self, obj):
        text = self._ACTION_TEXT.get(obj.action, obj.action.replace('_', ' ').title())
        details = obj.details or {}
        ref = details.get('ref')
        if ref:
            return f"{text} · {ref}"
        return text


# ---------------------------------------------------------------------------
# Billing facade — list (lighter) and detail (heavier)
# ---------------------------------------------------------------------------

class BaseBillingInvoiceSerializer(serializers.Serializer):
    """Common fields shared by Staff/Client invoice serializers."""

    id = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()  # 'staff' | 'client'
    periodStart = serializers.DateField(source='start_date')
    periodEnd = serializers.DateField(source='end_date')
    issueDate = serializers.DateField(source='issued_date', allow_null=True)
    dueDate = serializers.DateField(source='due_date', allow_null=True)
    paidDate = serializers.DateField(source='paid_date', allow_null=True)
    status = serializers.SerializerMethodField()
    exportStatus = serializers.SerializerMethodField()
    note = serializers.CharField(source='notes')
    rejectReason = serializers.SerializerMethodField()
    supersededById = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    vat = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    totalHours = serializers.SerializerMethodField()

    def get_id(self, obj):
        return obj.invoice_number or f"PAY-{obj.pk}"

    def get_kind(self, obj):
        return 'staff'  # overridden by ClientBillingInvoiceSerializer

    def get_status(self, obj):
        # If this invoice has been replaced (superseded_by set), surface a
        # synthetic 'resolved' status so the UI renders it neutrally instead
        # of red 'Rejected'. The DB status is preserved as-is for audit.
        if getattr(obj, 'superseded_by_id', None):
            return 'resolved'
        return derived_overdue(obj.status, getattr(obj, 'due_date', None))

    def get_exportStatus(self, obj):
        return None  # overridden

    def get_rejectReason(self, obj):
        return getattr(obj, 'reject_reason', '') or None

    def get_supersededById(self, obj):
        """Return the invoice number of the replacement draft, or None.

        When set, the UI renders this invoice as 'Resolved' rather than
        'Rejected' — it has been re-issued as a fresh draft (linked here)
        and falls out of the manager's open work queue.
        """
        replacement = getattr(obj, 'superseded_by', None)
        if not replacement:
            return None
        # Same id format the rest of the facade uses (PAY-XX or invoice_number).
        if hasattr(replacement, 'invoice_number') and replacement.invoice_number:
            return replacement.invoice_number
        return f"PAY-{replacement.pk}"

    def get_subtotal(self, obj):
        return float(getattr(obj, 'subtotal', 0) or 0)

    def get_vat(self, obj):
        return 0.0

    def get_total(self, obj):
        return float(getattr(obj, 'total_amount', 0) or 0)

    def get_totalHours(self, obj):
        return float(getattr(obj, 'total_hours', 0) or 0)


class StaffBillingInvoiceSerializer(BaseBillingInvoiceSerializer):
    """Staff-side (officer payslip) invoice rendered as InvoiceRecord."""

    clientId = serializers.SerializerMethodField()
    staffId = serializers.SerializerMethodField()
    party = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()

    def get_kind(self, obj):
        return 'staff'

    def get_clientId(self, obj):
        return None

    def get_staffId(self, obj):
        return str(obj.staff_user_id) if obj.staff_user_id else None

    def get_party(self, obj):
        return StaffPartySerializer(obj.staff_user).data

    def get_items(self, obj):
        items = obj.items.all().order_by('date', 'item_type') if hasattr(obj, 'items') else []
        return StaffInvoiceItemSerializer(items, many=True).data

    def get_history(self, obj):
        logs = AuditLog.objects.filter(
            resource_type='Invoice', resource_id=str(obj.pk)
        ).order_by('-timestamp')[:50]
        return HistoryEntrySerializer(logs, many=True).data

    def get_subtotal(self, obj):
        return float(obj.total_amount or 0)

    def get_vat(self, obj):
        return 0.0  # Staff invoices have no VAT row in the UI

    def get_exportStatus(self, obj):
        return latest_export_status_for_invoice(obj)


class ClientBillingInvoiceSerializer(BaseBillingInvoiceSerializer):
    """Client-side (B2B) invoice rendered as InvoiceRecord."""

    clientId = serializers.SerializerMethodField()
    staffId = serializers.SerializerMethodField()
    party = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()

    def get_id(self, obj):
        return obj.invoice_number

    def get_kind(self, obj):
        return 'client'

    def get_clientId(self, obj):
        return str(obj.venue_id) if obj.venue_id else None

    def get_staffId(self, obj):
        return None

    def get_party(self, obj):
        return ClientPartySerializer(obj.venue).data

    def get_items(self, obj):
        items = obj.line_items.all().order_by('date') if hasattr(obj, 'line_items') else []
        return ClientInvoiceItemSerializer(items, many=True).data

    def get_history(self, obj):
        logs = AuditLog.objects.filter(
            resource_type='ClientInvoice', resource_id=str(obj.pk)
        ).order_by('-timestamp')[:50]
        return HistoryEntrySerializer(logs, many=True).data

    def get_subtotal(self, obj):
        return float(obj.subtotal or 0)

    def get_vat(self, obj):
        return float(obj.tax_amount or 0)

    def get_total(self, obj):
        return float(obj.total_amount or 0)

    def get_totalHours(self, obj):
        return float(
            obj.line_items.aggregate(s=Sum('hours'))['s'] or 0
        )

    def get_exportStatus(self, obj):
        return latest_export_status_for_client_invoice(obj)


# ---------------------------------------------------------------------------
# Stats and aging
# ---------------------------------------------------------------------------

class InvoiceStatsSerializer(serializers.Serializer):
    """The InvoiceStats shape from the mocks."""

    counts = serializers.DictField()
    totals = serializers.DictField()
    buckets = serializers.DictField()


def compute_stats_for_queryset(qs, kind):
    """Aggregate `counts`/`totals`/`buckets` for a billing queryset.

    Works for both staff Invoice and ClientInvoice — relies on
    `total_amount`/`status`/`due_date` being present on both.
    """
    today = timezone.localdate()
    counts = {'total': 0, 'draft': 0, 'sent': 0, 'pending': 0, 'overdue': 0,
              'paid': 0, 'rejected': 0, 'resolved': 0}
    totals = {'sent': 0.0, 'overdue': 0.0, 'paid': 0.0, 'draft': 0.0, 'outstanding': 0.0}
    buckets = {'0-30': 0.0, '31-60': 0.0, '61-90': 0.0, '90+': 0.0}

    for inv in qs:
        counts['total'] += 1
        amt = float(inv.total_amount or 0)
        # Mirror the serializer's get_status: superseded invoices report as
        # 'resolved' rather than their underlying DB status, so the chip
        # counts match what the user sees in the list pills.
        if getattr(inv, 'superseded_by_id', None):
            derived_status = 'resolved'
        else:
            derived_status = derived_overdue(inv.status, getattr(inv, 'due_date', None))
        if derived_status in counts:
            counts[derived_status] = counts.get(derived_status, 0) + 1
        if derived_status in totals:
            totals[derived_status] += amt
        if derived_status in ('sent', 'overdue'):
            totals['outstanding'] += amt
        if derived_status == 'overdue' and inv.due_date:
            days_late = (today - inv.due_date).days
            if days_late <= 30:
                buckets['0-30'] += amt
            elif days_late <= 60:
                buckets['31-60'] += amt
            elif days_late <= 90:
                buckets['61-90'] += amt
            else:
                buckets['90+'] += amt

    return {'counts': counts, 'totals': totals, 'buckets': buckets}


# ---------------------------------------------------------------------------
# Payroll run, officers, officer bundle
# ---------------------------------------------------------------------------

class PayrollRunSerializer(serializers.ModelSerializer):
    """Mirrors the `PayrollRun` mock interface.

    Money/hours fields use FloatField so the JSON response is `number`-typed
    rather than DRF's default DecimalField string ('0.00'). The mock TS
    interface declares these as `number`.
    """

    id = serializers.CharField(source='run_code')
    label = serializers.CharField()
    cycle = serializers.CharField()
    periodStart = serializers.DateField(source='period_start')
    periodEnd = serializers.DateField(source='period_end')
    processDate = serializers.DateField(source='process_date')
    status = serializers.CharField()
    exportStatus = serializers.CharField(source='export_status', allow_null=True)
    invoices = serializers.IntegerField(source='invoice_count')
    lineItems = serializers.IntegerField(source='line_item_count')
    hoursBilled = serializers.FloatField(source='hours_billed')
    grossTotal = serializers.FloatField(source='gross_total')
    prevGross = serializers.FloatField(source='prev_gross')
    timeAdjustments = serializers.IntegerField(source='time_adjustments')
    siaBlocks = serializers.IntegerField(source='sia_blocks')

    class Meta:
        model = PayrollRun
        fields = (
            'id', 'label', 'cycle', 'periodStart', 'periodEnd', 'processDate',
            'status', 'exportStatus', 'invoices', 'lineItems', 'hoursBilled',
            'grossTotal', 'prevGross', 'timeAdjustments', 'siaBlocks',
        )


class PayrollHistoryRunSerializer(serializers.ModelSerializer):
    """Mirrors the `PayrollHistoryRun` mock interface for the right-rail card."""

    id = serializers.CharField(source='run_code')
    label = serializers.CharField()
    cycle = serializers.CharField()
    gross = serializers.FloatField(source='gross_total')
    status = serializers.CharField()
    exported = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = ('id', 'label', 'cycle', 'gross', 'status', 'exported')

    def get_exported(self, obj):
        return obj.export_status or '—'


def _aggregate_officer(invoice, run):
    """Compute the Officer row payload for a staff Invoice in a given run."""
    items = invoice.items.all()

    def sum_hours(qs_filter):
        return float(items.filter(**qs_filter).aggregate(s=Sum('hours_worked'))['s'] or 0)

    def sum_days(qs_filter):
        return float(items.filter(**qs_filter).aggregate(s=Sum('days'))['s'] or 0)

    def avg_rate(qs_filter):
        return float(items.filter(**qs_filter).aggregate(s=Avg('rate'))['s'] or 0)

    base_hrs = sum_hours({'item_type': 'shift'})
    ot1_hrs = sum_hours({'item_type': 'overtime_1'})
    ot2_hrs = sum_hours({'item_type': 'overtime_2'})
    bh_days = sum_days({'item_type': 'bank_holiday'})
    al_days = sum_days({'item_type': 'annual_leave'})
    special_hrs = sum_hours({'item_type': 'special'})

    rate = avg_rate({'item_type': 'shift'}) or float(invoice.hourly_rate or 0)
    bh_rate = avg_rate({'item_type': 'bank_holiday'}) or 0
    al_rate = avg_rate({'item_type': 'annual_leave'}) or 0

    user = invoice.staff_user
    profile = getattr(user, 'profile', None)
    role = getattr(profile, 'role', None) or 'Officer'

    # Dominant venue: most frequent venue across this invoice's shift items
    venue_qs = (
        items.exclude(venue__isnull=True)
        .values('venue__name')
        .annotate(n=Count('id'))
        .order_by('-n')
    )
    venue_name = venue_qs.first()['venue__name'] if venue_qs.exists() else ''

    # Time adjustments touching shifts in this invoice
    shift_ids = list(items.exclude(shift__isnull=True).values_list('shift_id', flat=True).distinct())
    adj_count = TimeAdjustment.objects.filter(shift_id__in=shift_ids).count() if shift_ids else 0

    # SIA: latest license — SIALicense FK is to StaffProfile, not directly to User.
    profile_obj = getattr(user, 'profile', None)
    sia = (
        SIALicense.objects.filter(staff_profile=profile_obj).order_by('-expiry_date').first()
        if profile_obj else None
    )
    if sia:
        delta = (sia.expiry_date - timezone.localdate()).days
        sia_payload = {
            'number': sia.license_number,
            'level': (getattr(sia, 'license_type', '') or '').upper() or 'DS',
            'expiresInDays': delta,
            'expired': delta < 0,
        }
    else:
        sia_payload = {'number': '', 'level': '', 'expiresInDays': 0, 'expired': False}

    # Latest export status
    export_status = latest_export_status_for_invoice(invoice)

    return {
        'id': user.id,
        'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        'role': role,
        'hue': stable_hue(user.id),
        'venue': venue_name,
        'baseHrs': base_hrs,
        'ot1Hrs': ot1_hrs,
        'ot2Hrs': ot2_hrs,
        'bhDays': bh_days,
        'alDays': al_days,
        'special': special_hrs,
        'rate': rate,
        'bhRate': bh_rate,
        'alRate': al_rate,
        'gross': float(invoice.total_amount or 0),
        'status': invoice.status,
        'exportStatus': export_status,
        'adjustments': adj_count,
        'sia': sia_payload,
        'rejectReason': invoice.reject_reason or None,
        # Invoice identifier the UI uses to call the billing facade (export, PDF, etc.).
        # Falls back to PAY-{pk} when invoice_number wasn't generated yet.
        'invoiceId': invoice.invoice_number or f"PAY-{invoice.pk}",
    }


# Item type -> UI badge metadata
ITEM_TYPE_LABELS = {
    'shift': 'Shift',
    'overtime_1': 'OT 1.5×',
    'overtime_2': 'OT 2×',
    'bank_holiday': 'Bank holiday',
    'annual_leave': 'Annual leave',
    'special': 'Special event',
}


def _line_item_payload(item):
    """Maps an InvoiceItem to the UI's `InvoiceLineItem`."""
    detail = item.description or ''
    if item.item_type in ('shift', 'overtime_1', 'overtime_2', 'special'):
        venue = item.venue.name if item.venue else ''
        if not detail:
            detail = f"{venue}".strip()
        elif venue and venue not in detail:
            detail = f"{venue} · {detail}"

    if item.hours_worked is not None:
        hrs = float(item.hours_worked)
    elif item.days is not None:
        hrs = float(item.days)
    else:
        hrs = None

    rate = float(item.rate) if item.rate is not None else None
    if item.item_type in ('bank_holiday', 'annual_leave'):
        rate = float(item.rate) if item.rate is not None else None

    # Recorded check-in/out timestamps so the AdjustHoursModal can prefill
    # rather than asking the manager to retype both ends from scratch.
    shift = item.shift
    check_in = shift.check_in_time if shift else None
    check_out = shift.check_out_time if shift else None

    return {
        'type': item.item_type,
        'date': item.date.isoformat(),
        'venue': item.venue.name if item.venue else '',
        'detail': detail,
        'hrs': hrs,
        'rate': rate,
        'amount': float(item.amount or 0),
        # Shift FK so the AdjustHoursModal knows which shift to target.
        'shiftId': item.shift_id,
        'checkInTime': check_in.isoformat() if check_in else None,
        'checkOutTime': check_out.isoformat() if check_out else None,
    }


def _adjustment_payload(adj):
    """Maps a TimeAdjustment to the UI's `ShiftAdjustment`."""
    from decimal import Decimal

    shift = adj.shift
    venue_name = shift.venue.name if (shift and shift.venue) else ''
    by_user = getattr(adj, 'adjusted_by', None) or getattr(adj, 'created_by', None)
    by_name = (
        f"{by_user.first_name or ''} {by_user.last_name or ''}".strip()
        if by_user else 'system'
    )

    def _fmt_time(dt):
        return dt.strftime('%H:%M') if dt else ''

    # Delta in minutes from the hours-worked change. Signed: '+15m' / '-10m'.
    delta_str = ''
    if adj.original_actual_hours is not None and adj.adjusted_actual_hours is not None:
        delta_minutes = int(
            (adj.adjusted_actual_hours - adj.original_actual_hours) * Decimal('60')
        )
        sign = '+' if delta_minutes >= 0 else '-'
        delta_str = f"{sign}{abs(delta_minutes)}m"

    return {
        'date': adj.created_at.date().isoformat() if adj.created_at else '',
        'shift': f"{venue_name} · shift" if venue_name else 'shift',
        'before': _fmt_time(adj.original_check_in_time),
        'after': _fmt_time(adj.adjusted_check_in_time),
        'delta': delta_str,
        'by': by_name,
        'on': adj.created_at.isoformat() if adj.created_at else '',
    }


# ---------------------------------------------------------------------------
# Statement (basic read shape)
# ---------------------------------------------------------------------------

class StatementSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField()
    venueId = serializers.UUIDField(source='venue_id')
    venueName = serializers.SerializerMethodField()
    statementNumber = serializers.CharField(source='statement_number')
    periodStart = serializers.DateField(source='period_start')
    periodEnd = serializers.DateField(source='period_end')
    issuedDate = serializers.DateField(source='issued_date', allow_null=True)
    sentToEmail = serializers.CharField(source='sent_to_email')
    invoiceIds = serializers.SerializerMethodField()

    class Meta:
        model = Statement
        fields = (
            'id', 'venueId', 'venueName', 'statementNumber', 'periodStart', 'periodEnd',
            'status', 'issuedDate', 'sentToEmail', 'notes', 'snapshot', 'invoiceIds',
        )

    def get_venueName(self, obj):
        return obj.venue.name if obj.venue else ''

    def get_invoiceIds(self, obj):
        return [str(i.id) for i in obj.invoices.all()]


# ---------------------------------------------------------------------------
# Finance providers (the ExportStrip card)
# ---------------------------------------------------------------------------

# Brand colours for the FinanceProvider strip
PROVIDER_COLORS = {
    'xero': '#13B5EA',
    'quickbooks': '#2CA01C',
    'sage': '#00DC00',
    'freeagent': '#7A2C7E',
    'freshbooks': '#0075DD',
    'zoho': '#E42527',
    'wave': '#1F9CFF',
    'netsuite': '#125580',
}


class FinanceProviderSerializer(serializers.Serializer):
    """Mirrors the `FinanceProvider` mock interface.

    Reads from finance_integrations.AccountingProvider (registry) joined with
    ProviderConnection for the company's connection state. Connection state
    is derived: 'connected' iff at least one ProviderConnection in
    'connected' status exists for this provider.
    """

    id = serializers.SerializerMethodField()
    name = serializers.CharField(source='display_name')
    color = serializers.SerializerMethodField()
    connected = serializers.SerializerMethodField()
    default = serializers.SerializerMethodField()

    def get_id(self, obj):
        return obj.provider_key

    def get_color(self, obj):
        return PROVIDER_COLORS.get(obj.provider_key, '#999999')

    def get_connected(self, obj):
        # `connections` is the related_name on ProviderConnection
        return obj.connections.filter(status='connected').exists()

    def get_default(self, obj):
        return obj.provider_key == 'xero'
