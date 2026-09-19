"""
Deletes that silently destroyed pay history — AUDIT-2026-09-17, Phase 2C.

Every foreign key between the roster and the money was CASCADE:

- deleting a shift took its line off the officer's invoice (and its signed
  time adjustments with it), so an approved or paid invoice stopped adding up;
- deleting a venue — one admin click — took every shift ever worked there,
  every staff invoice line for them, and every client invoice for the venue;
- deleting a user outside the API's soft delete (Django admin, a script) took
  their shifts and invoices.

These deletes now refuse with 409 and say what is in the way. Nothing that has
no pay attached is affected: an unworked shift or an unused venue still goes.

Also here: the nightly account purge ended in `return result` — a NameError
on every run — so the job reported failure every night, whatever it did.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    ClientInvoice, Invoice, InvoiceItem, SecurityCompany, Shift, TimeAdjustment,
    UserCompanyMembership, Venue,
)

User = get_user_model()


class IntegrityTestCase(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name="Keep Co", registration_number="KEEP001")
        self.admin = self._user("keep_admin", "admin")
        self.manager = self._user("keep_mgr", "manager")
        self.officer = self._user("keep_officer", "staff")
        self.venue = self._venue("Keep Venue")
        self.day = (timezone.now() - timedelta(days=3)).replace(hour=9, minute=0, second=0, microsecond=0)

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test", password="x", role=role,
        )
        UserCompanyMembership.objects.create(user=user, company=self.company, is_active=True)
        return user

    def _venue(self, name):
        return Venue.objects.create(
            company=self.company, name=name, address="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK", capacity=100, contact_name="C",
            contact_phone="07700900000", contact_email=f"{name.split()[-1].lower()}@venue.test",
            terms_and_conditions="Terms",
        )

    def _shift(self, venue=None, **kwargs):
        defaults = dict(
            venue=venue or self.venue, staff_user=self.officer,
            start_time=self.day, end_time=self.day + timedelta(hours=8),
            status="scheduled", required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )
        defaults.update(kwargs)
        return Shift.objects.create(**defaults)

    def _invoiced_shift(self):
        shift = self._shift()
        invoice = Invoice.objects.create(
            staff_user=self.officer, start_date=self.day.date(), end_date=self.day.date(),
            total_hours=Decimal("8.00"), hourly_rate=Decimal("15.00"),
            total_amount=Decimal("120.00"), status="approved",
        )
        item = InvoiceItem.objects.create(
            invoice=invoice, shift=shift, item_type="shift", date=self.day.date(),
            venue=self.venue, description="Shift", hours_worked=Decimal("8.00"),
            rate=Decimal("15.00"), amount=Decimal("120.00"),
        )
        return shift, invoice, item

    def _delete_shift(self, shift):
        self.client.force_authenticate(user=self.manager)
        return self.client.delete(f"/api/v1/shifts/{shift.pk}/")

    def _delete_venue(self, venue):
        self.client.force_authenticate(user=self.admin)
        return self.client.delete(f"/api/v1/venues/{venue.pk}/")


class ShiftDeleteTests(IntegrityTestCase):
    def test_an_invoiced_shift_cannot_be_deleted(self):
        shift, invoice, item = self._invoiced_shift()

        response = self._delete_shift(shift)

        self.assertEqual(response.status_code, 409, getattr(response, "data", None))
        self.assertTrue(Shift.objects.filter(pk=shift.pk).exists())
        self.assertTrue(InvoiceItem.objects.filter(pk=item.pk).exists())
        self.assertEqual(response.data["error"], "in_use")
        self.assertIn("invoice", response.data["detail"].lower())

    def test_a_shift_with_a_signed_time_adjustment_cannot_be_deleted(self):
        shift = self._shift(check_in_time=self.day, check_out_time=self.day + timedelta(hours=8))
        adjustment = TimeAdjustment.objects.create(
            shift=shift, adjusted_by=self.manager,
            original_check_in_time=self.day, original_actual_hours=Decimal("7.00"),
            adjusted_check_in_time=self.day, adjusted_actual_hours=Decimal("8.00"),
            manager_signature="data:image/png;base64,AAAA", reason="Signed in late, was on post",
        )

        response = self._delete_shift(shift)

        self.assertEqual(response.status_code, 409)
        self.assertTrue(TimeAdjustment.objects.filter(pk=adjustment.pk).exists())

    def test_an_unworked_shift_still_deletes(self):
        shift = self._shift()

        response = self._delete_shift(shift)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Shift.objects.filter(pk=shift.pk).exists())


class VenueDeleteTests(IntegrityTestCase):
    def test_a_venue_with_shifts_cannot_be_deleted(self):
        shift, _, item = self._invoiced_shift()

        response = self._delete_venue(self.venue)

        self.assertEqual(response.status_code, 409, getattr(response, "data", None))
        self.assertTrue(Venue.objects.filter(pk=self.venue.pk).exists())
        self.assertTrue(Shift.objects.filter(pk=shift.pk).exists())
        self.assertTrue(InvoiceItem.objects.filter(pk=item.pk).exists())
        # The refusal points at what to do instead.
        self.assertIn("deactivate", response.data["detail"].lower())

    def test_a_venue_with_client_invoices_cannot_be_deleted(self):
        venue = self._venue("Billed Venue")
        invoice = ClientInvoice.objects.create(
            company=self.company, venue=venue, invoice_number="CI-KEEP-1",
            start_date=self.day.date(), end_date=self.day.date(),
            client_name="Billed Venue", status="sent",
        )

        response = self._delete_venue(venue)

        self.assertEqual(response.status_code, 409)
        self.assertTrue(ClientInvoice.objects.filter(pk=invoice.pk).exists())

    def test_an_unused_venue_still_deletes(self):
        venue = self._venue("Spare Venue")

        response = self._delete_venue(venue)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Venue.objects.filter(pk=venue.pk).exists())


class UserDeleteTests(IntegrityTestCase):
    """The API only ever soft-deletes users; these cover every other route in
    (Django admin, a shell, a script)."""

    def test_deleting_an_officer_with_shifts_is_refused(self):
        self._shift()
        with self.assertRaises(ProtectedError):
            self.officer.delete()
        self.assertTrue(Shift.objects.filter(staff_user=self.officer).exists())

    def test_deleting_an_officer_with_invoices_is_refused(self):
        Invoice.objects.create(
            staff_user=self.officer, start_date=self.day.date(), end_date=self.day.date(),
            total_hours=Decimal("0"), hourly_rate=Decimal("15.00"),
            total_amount=Decimal("0"), status="draft",
        )
        with self.assertRaises(ProtectedError):
            self.officer.delete()
        self.assertTrue(Invoice.objects.filter(staff_user=self.officer).exists())


class AccountPurgeTests(IntegrityTestCase):
    def test_the_nightly_purge_completes_and_keeps_pay_history(self):
        from api.tasks import hard_delete_expired_accounts

        shift, invoice, _ = self._invoiced_shift()
        User.objects.filter(pk=self.officer.pk).update(
            is_active=False, deletion_scheduled_at=timezone.now() - timedelta(days=31),
        )

        result = hard_delete_expired_accounts()

        self.assertEqual(result, {"anonymized": 1, "failed": 0})
        self.officer.refresh_from_db()
        self.assertEqual(self.officer.first_name, "Deleted")
        self.assertIsNone(self.officer.deletion_scheduled_at)
        self.assertTrue(Shift.objects.filter(pk=shift.pk).exists())
        self.assertTrue(Invoice.objects.filter(pk=invoice.pk).exists())

    def test_the_nightly_purge_succeeds_with_nothing_to_do(self):
        from api.tasks import hard_delete_expired_accounts

        self.assertEqual(hard_delete_expired_accounts(), {"anonymized": 0, "failed": 0})


class PayableHoursBackfillTests(IntegrityTestCase):
    """Migration 0071 added `payable_hours` with no backfill. With
    OT_BASIS_ALIGNED on, a NULL row adds nothing to the weekly overtime
    accumulator, so the report on what flipping the flag costs, and the flip
    itself, both need the old rows filled first."""

    def _run(self, *args):
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        call_command("backfill_payable_hours", *args, stdout=out, stderr=StringIO())
        return out.getvalue()

    def _legacy_shift(self, **kwargs):
        """A shift as it looks when written before 0071."""
        shift = self._shift(status="approved", break_duration=30, **kwargs)
        Shift.objects.filter(pk=shift.pk).update(payable_hours=None)
        return shift

    def test_a_dry_run_writes_nothing(self):
        shift = self._legacy_shift()

        out = self._run()

        shift.refresh_from_db()
        self.assertIsNone(shift.payable_hours)
        self.assertIn("Dry run", out)

    def test_apply_fills_scheduled_minus_break(self):
        shift = self._legacy_shift()
        status_before = shift.status

        self._run("--apply")

        shift.refresh_from_db()
        self.assertEqual(shift.payable_hours, Decimal("7.50"))
        self.assertEqual(shift.status, status_before)

    def test_apply_honours_a_signed_time_adjustment(self):
        shift = self._legacy_shift()
        TimeAdjustment.objects.create(
            shift=shift, adjusted_by=self.manager,
            original_check_in_time=self.day, original_actual_hours=Decimal("7.50"),
            adjusted_check_in_time=self.day, adjusted_actual_hours=Decimal("6.25"),
            manager_signature="data:image/png;base64,AAAA", reason="Left early, agreed",
        )
        Shift.objects.filter(pk=shift.pk).update(payable_hours=None)

        self._run("--apply")

        shift.refresh_from_db()
        self.assertEqual(shift.payable_hours, Decimal("6.25"))

    def test_an_existing_value_is_never_rewritten(self):
        shift = self._shift(status="approved")
        Shift.objects.filter(pk=shift.pk).update(payable_hours=Decimal("5.00"))

        self._run("--apply")

        shift.refresh_from_db()
        self.assertEqual(shift.payable_hours, Decimal("5.00"))

    def test_the_ot_report_warns_while_rows_are_missing(self):
        from io import StringIO

        from django.core.management import call_command

        self._legacy_shift()
        out = StringIO()
        call_command("report_ot_basis_delta", stdout=out, stderr=StringIO())

        self.assertIn("backfill_payable_hours", out.getvalue())


class OutstandingDefinitionTests(IntegrityTestCase):
    """The web's Outstanding total covered sent + overdue only, while the
    Outbox beside it counted draft + pending + sent + overdue, pending and
    approved invoices were in no money total at all, and the officer's phone
    counted all of them as earnings. One definition now: everything not yet
    paid."""

    AMOUNTS = {"draft": "10.00", "pending": "20.00", "approved": "40.00",
               "sent": "80.00", "paid": "160.00", "rejected": "320.00"}

    def setUp(self):
        super().setUp()
        first = timezone.localdate().replace(month=1, day=5)
        for week, (status, amount) in enumerate(self.AMOUNTS.items()):
            start = first + timedelta(weeks=week)  # one live invoice per period
            Invoice.objects.create(
                staff_user=self.officer, start_date=start, end_date=start,
                total_hours=Decimal("1.00"), hourly_rate=Decimal(amount),
                total_amount=Decimal(amount), status=status,
            )

    def test_outstanding_is_everything_not_yet_paid(self):
        from api.serializers_billing import compute_stats_for_queryset

        stats = compute_stats_for_queryset(Invoice.objects.filter(staff_user=self.officer), "staff")

        self.assertEqual(stats["totals"]["pending"], 20.0)
        self.assertEqual(stats["totals"]["approved"], 40.0)
        self.assertEqual(stats["counts"]["approved"], 1)
        self.assertEqual(stats["totals"]["outstanding"], 10.0 + 20.0 + 40.0 + 80.0)

    def test_web_paid_plus_outstanding_equals_the_officers_earnings(self):
        from api.serializers_billing import compute_stats_for_queryset

        web = compute_stats_for_queryset(Invoice.objects.filter(staff_user=self.officer), "staff")
        self.client.force_authenticate(user=self.officer)
        phone = self.client.get("/api/v1/invoices/stats/").json()

        self.assertEqual(web["totals"]["paid"] + web["totals"]["outstanding"], phone["ytd"])
