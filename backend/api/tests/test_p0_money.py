"""
Money P0s from AUDIT-2026-09-17.md, Phase 1C.

- P0-D / ENG-008: client invoices priced at the officer's *pay* rate instead of
  `Shift.bill_rate` (measured: 1.45% realised margin against 25% intended).
  A line whose shift has no bill rate is held as a draft until a manager sets
  one (decision D-A).
- P1-a / P1-b: `force_complete` and `manual_checkout` bypassed
  `record_attendance`, so the manager's typed hours were overwritten from the
  timestamps, negative hours were stored, junk returned a raw 500, and the
  invoice lock never fired.
- Payments that never happened: facade `mark-paid` accepted draft and pending
  invoices, skipping the approval the run-level endpoint enforces.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    ClientInvoice, Invoice, InvoiceItem, SecurityCompany, Shift,
    UserCompanyMembership, Venue,
)

User = get_user_model()


class MoneyTestCase(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Money Co", registration_number="MONEY001",
        )
        self.manager = self._user("money_mgr", "manager")
        self.officer = self._user("money_officer", "staff")
        self.venue = Venue.objects.create(
            company=self.company, name="Money Venue", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="money@venue.test", terms_and_conditions="Terms",
        )
        self.day = (timezone.now() - timedelta(days=3)).replace(
            hour=9, minute=0, second=0, microsecond=0,
        )

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(user=user, company=self.company, is_active=True)
        return user

    def _shift(self, **kwargs):
        defaults = dict(
            venue=self.venue, staff_user=self.officer,
            start_time=self.day, end_time=self.day + timedelta(hours=8),
            status="scheduled", required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )
        defaults.update(kwargs)
        return Shift.objects.create(**defaults)


# ---------------------------------------------------------------------------
# P0-D — bill clients at bill_rate
# ---------------------------------------------------------------------------

class ClientBillRateTests(MoneyTestCase):
    def _approved_shift(self, bill_rate):
        shift = self._shift(
            check_in_time=self.day, check_out_time=self.day + timedelta(hours=8),
            bill_rate=bill_rate,
        )
        Shift.objects.filter(pk=shift.pk).update(
            status="approved", actual_hours_worked=Decimal("8.00"),
        )
        return Shift.objects.get(pk=shift.pk)

    def _generate(self):
        return ClientInvoice.generate_for_venue_period(
            venue=self.venue, start_date=self.day.date(), end_date=self.day.date(),
            created_by=self.manager,
        )

    def test_client_line_is_priced_at_the_bill_rate_not_the_pay_rate(self):
        self._approved_shift(bill_rate=Decimal("20.00"))
        invoice = self._generate()
        line = invoice.line_items.get()
        self.assertEqual(line.rate, Decimal("20.00"))
        self.assertNotEqual(line.rate, Decimal("15.00"), "billed at the officer's pay rate")
        self.assertFalse(line.needs_rate)
        self.assertEqual(line.total, Decimal("160.00"))

    def test_a_line_with_no_bill_rate_is_held_rather_than_priced_at_pay(self):
        self._approved_shift(bill_rate=None)
        invoice = self._generate()
        line = invoice.line_items.get()
        self.assertEqual(line.rate, Decimal("0"))
        self.assertTrue(line.needs_rate)

    def test_a_held_invoice_cannot_be_issued_until_the_rate_is_set(self):
        shift = self._approved_shift(bill_rate=None)
        invoice = self._generate()
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(f"/api/v1/billing/invoices/{invoice.invoice_number}/issue/", {})
        self.assertEqual(response.status_code, 409)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "draft")

        # The manager sets the client rate from the invoice itself.
        response = self.client.post(
            f"/api/v1/billing/invoices/{invoice.invoice_number}/edit_shift_rate/",
            {"shift_id": shift.pk, "hourly_rate": "21.50"}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.bill_rate, Decimal("21.50"))
        self.assertEqual(shift.hourly_rate, Decimal("15.00"), "officer pay must not move")
        line = invoice.line_items.get()
        self.assertEqual(line.rate, Decimal("21.50"))
        self.assertFalse(line.needs_rate)
        invoice.refresh_from_db()
        self.assertEqual(invoice.subtotal, Decimal("172.00"))

        response = self.client.post(f"/api/v1/billing/invoices/{invoice.invoice_number}/issue/", {})
        self.assertEqual(response.status_code, 200, response.data)

    def test_the_ui_is_told_which_lines_need_a_rate(self):
        shift = self._approved_shift(bill_rate=None)
        invoice = self._generate()
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(f"/api/v1/billing/invoices/{invoice.invoice_number}/")
        item = response.data["items"][0]
        self.assertTrue(item["needsRate"])
        self.assertEqual(item["shiftId"], shift.pk)
        self.assertEqual(item["type"], "shift")


# ---------------------------------------------------------------------------
# P1-a / P1-b — manager overrides go through the attendance chokepoint
# ---------------------------------------------------------------------------

class ForceCompleteTests(MoneyTestCase):
    def _post(self, shift, **body):
        self.client.force_authenticate(user=self.manager)
        body.setdefault("manager_signature", "sig")
        return self.client.post(f"/api/v1/shifts/{shift.pk}/force_complete/", body, format="json")

    def test_the_hours_the_manager_types_are_the_hours_stored(self):
        """Audit: manager types 8, payroll stores 9 — recomputed from start to now()."""
        shift = self._shift()
        response = self._post(
            shift, actual_hours="8",
            checkin_time=self.day.isoformat(),
            checkout_time=(self.day + timedelta(hours=9)).isoformat(),
        )
        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.actual_hours_worked, Decimal("8.00"))
        self.assertEqual(shift.status, "completed")

    def test_negative_and_junk_hours_are_refused_without_writing(self):
        shift = self._shift()
        status_before = shift.status  # save() moves a past 'scheduled' shift to 'active'
        for bad in ("-5", "eight", "30"):
            with self.subTest(hours=bad):
                response = self._post(shift, actual_hours=bad)
                self.assertEqual(response.status_code, 400)
                shift.refresh_from_db()
                self.assertIsNone(shift.actual_hours_worked)
                self.assertEqual(shift.status, status_before)

    def test_a_checkout_that_would_exceed_24_hours_is_a_400_not_a_500(self):
        """No checkout_time means now(); three days after the shift, the model's
        24-hour guard fired and surfaced as a raw 500."""
        shift = self._shift()
        status_before = shift.status
        response = self._post(shift, actual_hours="8")
        self.assertEqual(response.status_code, 400, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.status, status_before)
        self.assertIsNone(shift.check_out_time)

    def test_a_locked_invoice_refuses_the_change(self):
        shift = self._shift(check_in_time=self.day, check_out_time=self.day + timedelta(hours=8))
        Shift.objects.filter(pk=shift.pk).update(status="in_progress", check_out_time=None)
        shift.refresh_from_db()
        invoice = Invoice.objects.create(
            staff_user=self.officer, start_date=self.day.date(), end_date=self.day.date(),
            total_hours=Decimal("8.00"), hourly_rate=Decimal("15.00"),
            total_amount=Decimal("120.00"), status="approved",
        )
        InvoiceItem.objects.create(
            invoice=invoice, shift=shift, item_type="shift", date=self.day.date(),
            venue=self.venue, description="Shift", hours_worked=Decimal("8.00"),
            rate=Decimal("15.00"), amount=Decimal("120.00"),
        )
        response = self._post(
            shift, actual_hours="10",
            checkout_time=(self.day + timedelta(hours=10)).isoformat(),
        )
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data.get("code"), "invoice_locked")
        invoice.refresh_from_db()
        self.assertEqual(invoice.total_amount, Decimal("120.00"))


class ManualCheckoutTests(MoneyTestCase):
    def _post(self, shift, **body):
        self.client.force_authenticate(user=self.manager)
        body.setdefault("manager_signature", "sig")
        return self.client.post(f"/api/v1/shifts/{shift.pk}/manual_checkout/", body, format="json")

    def _checked_in(self):
        shift = self._shift(check_in_time=self.day)
        Shift.objects.filter(pk=shift.pk).update(status="in_progress")
        return Shift.objects.get(pk=shift.pk)

    def test_typed_hours_survive_the_checkout(self):
        shift = self._checked_in()
        response = self._post(
            shift, actual_hours="6",
            checkout_time=(self.day + timedelta(hours=8)).isoformat(),
        )
        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.actual_hours_worked, Decimal("6.00"))
        self.assertEqual(shift.status, "completed")

    def test_junk_hours_are_refused(self):
        shift = self._checked_in()
        response = self._post(shift, actual_hours="-2")
        self.assertEqual(response.status_code, 400)
        shift.refresh_from_db()
        self.assertIsNone(shift.check_out_time)


# ---------------------------------------------------------------------------
# Payments that never happened — mark-paid must not skip approval
# ---------------------------------------------------------------------------

class MarkPaidApprovalTests(MoneyTestCase):
    def _invoice(self, status):
        # One live invoice per officer and period is a database constraint, so
        # each status gets its own day.
        offset = {"draft": 0, "pending": 1, "approved": 2}[status]
        day = self.day.date() - timedelta(days=7 * offset)
        return Invoice.objects.create(
            staff_user=self.officer, invoice_number=f"PAY-GATE-{status}",
            start_date=day, end_date=day,
            total_hours=Decimal("8.00"), hourly_rate=Decimal("15.00"),
            total_amount=Decimal("120.00"), status=status,
        )

    def test_an_unapproved_staff_invoice_cannot_be_marked_paid(self):
        self.client.force_authenticate(user=self.manager)
        for status_ in ("draft", "pending"):
            with self.subTest(status=status_):
                invoice = self._invoice(status_)
                response = self.client.post(
                    f"/api/v1/billing/invoices/{invoice.invoice_number}/mark-paid/", {},
                )
                self.assertEqual(response.status_code, 409)
                invoice.refresh_from_db()
                self.assertEqual(invoice.status, status_)
                self.assertIsNone(invoice.paid_date)

    def test_an_approved_staff_invoice_can_be_marked_paid(self):
        invoice = self._invoice("approved")
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f"/api/v1/billing/invoices/{invoice.invoice_number}/mark-paid/", {})
        self.assertEqual(response.status_code, 200)

    def test_a_draft_client_invoice_cannot_be_marked_paid(self):
        invoice = ClientInvoice.objects.create(
            company=self.company, venue=self.venue, invoice_number="CI-GATE-1",
            start_date=self.day.date(), end_date=self.day.date(),
            client_name="Money Venue", status="draft",
        )
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f"/api/v1/billing/invoices/{invoice.invoice_number}/mark-paid/", {})
        self.assertEqual(response.status_code, 409)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "draft")
