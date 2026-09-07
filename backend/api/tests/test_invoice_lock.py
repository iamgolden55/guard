"""
When an invoice stops being editable — P1-5.

The recalculation signal skipped only `status == 'paid'`. But per
`PayrollRun`'s own docstring, `approved` means *exportable to Xero*: an
attendance correction after export silently restated the local invoice while
Xero kept the original, and nothing alerted anyone to the divergence.

Skipping quietly was the second half of the problem. The endpoint returned
201, so the operator believed their correction had landed. A refusal has to be
visible, and the correction has to go somewhere — `superseded_by` already
models credit note / reissue.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    Invoice, InvoiceItem, SecurityCompany, Shift, UserCompanyMembership, Venue,
)

User = get_user_model()


class LockedInvoiceTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Lock Co", registration_number="LOCK001",
        )
        self.admin = User.objects.create_user(
            username="lock_admin", email="lockadmin@test.test",
            password="testpass123", role="admin",
        )
        self.staff = User.objects.create_user(
            username="lock_staff", email="lockstaff@test.test",
            password="testpass123", role="staff",
        )
        for user in (self.admin, self.staff):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True,
            )
        self.venue = Venue.objects.create(
            company=self.company, name="Lock Venue", address="1 Lock St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="Contact", contact_phone="07700900000",
            contact_email="lock@venue.test", terms_and_conditions="Terms",
        )
        start = (timezone.now() - timedelta(days=2)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        self.shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=start + timedelta(hours=8),
            status="scheduled", required_security_role="sg",
            is_published=True, hourly_rate=Decimal("15.00"),
            check_in_time=start, check_out_time=start + timedelta(hours=8),
        )
        self.invoice = Invoice.objects.create(
            staff_user=self.staff,
            start_date=start.date() - timedelta(days=1),
            end_date=start.date() + timedelta(days=1),
            total_hours=Decimal("8.00"), hourly_rate=Decimal("15.00"),
            total_amount=Decimal("120.00"), status="pending",
        )
        InvoiceItem.objects.create(
            invoice=self.invoice, shift=self.shift, item_type="shift",
            date=start.date(), venue=self.venue, description="Shift",
            hours_worked=Decimal("8.00"),
            rate=Decimal("15.00"), amount=Decimal("120.00"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _adjust(self, hours="7.00"):
        return self.client.post(
            f"/api/v1/shifts/{self.shift.id}/adjust_time/",
            {
                "adjusted_check_in_time": self.shift.start_time.isoformat(),
                "adjusted_check_out_time": (
                    self.shift.start_time + timedelta(hours=7)
                ).isoformat(),
                "reason": "Officer left an hour early.",
                "manager_signature": "manager",
            },
            format="json",
        )

    def test_a_correction_against_an_approved_invoice_is_refused(self):
        self.invoice.status = "approved"
        self.invoice.save(update_fields=["status"])
        before = self.invoice.total_amount

        response = self._adjust()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data.get("code"), "invoice_locked")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.total_amount, before)

    def test_a_correction_against_a_paid_invoice_is_refused(self):
        self.invoice.status = "paid"
        self.invoice.save(update_fields=["status"])

        response = self._adjust()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_a_correction_against_a_pending_invoice_still_recalculates(self):
        """Regression guard — the reject → adjust → reissue cycle must work."""
        response = self._adjust()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.total_hours, Decimal("7.00"))

    def test_an_exported_payroll_run_locks_its_invoices(self):
        from api.models import PayrollRun

        run = PayrollRun.objects.create(
            company=self.company,
            label="Test run",
            period_start=self.invoice.start_date,
            period_end=self.invoice.end_date,
            process_date=self.invoice.end_date,
            status="pending",
            export_status="completed",
        )
        self.invoice.payroll_run = run
        self.invoice.save(update_fields=["payroll_run"])

        self.assertTrue(self.invoice.is_locked())
        self.assertEqual(self._adjust().status_code, status.HTTP_409_CONFLICT)
