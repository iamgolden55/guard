"""
Write authorisation on the staff invoice API — P0-3.

`InvoiceViewSet.update_status` checks `request.user.role not in ['admin',
'manager']`. The default `PATCH` sitting beside it on the same ViewSet checked
nothing, and `InvoiceSerializer` used `fields = '__all__'` with only timestamps
and provenance marked read-only — so `total_amount`, `total_hours`,
`hourly_rate`, `status`, `paid_date`, `staff_user`, `payroll_run`,
`superseded_by` and `invoice_number` were all client-writable.

Authorisation had been implemented per-action rather than per-verb: the action
that *looks* like the write path was guarded, the framework's own write path
was not.

`get_queryset` limits staff to their own invoices, so the PATCH is
self-payment rather than cross-tenant — but `create` is not queryset-filtered
and `staff_user` was writable, so invoices could be minted for arbitrary users.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import Invoice, SecurityCompany, UserCompanyMembership

User = get_user_model()


class InvoiceWriteAuthzTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Invoice Co", registration_number="INV001",
        )
        self.manager = self._user("invoice_manager", "manager")
        self.staff = self._user("invoice_staff", "staff")
        self.other_staff = self._user("invoice_other", "staff")
        self.invoice = self._invoice(self.staff)
        self.client = APIClient()

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def _invoice(self, staff_user, **overrides):
        today = date.today()
        defaults = dict(
            staff_user=staff_user,
            start_date=today - timedelta(days=7),
            end_date=today,
            total_hours=Decimal("40.00"),
            hourly_rate=Decimal("15.00"),
            total_amount=Decimal("600.00"),
            status="pending",
        )
        defaults.update(overrides)
        return Invoice.objects.create(**defaults)

    def test_staff_cannot_inflate_their_own_invoice(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.patch(
            f"/api/v1/invoices/{self.invoice.id}/",
            {"total_amount": "9999.00"}, format="json",
        )

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.total_amount, Decimal("600.00"))
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_staff_cannot_approve_their_own_invoice(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.patch(
            f"/api/v1/invoices/{self.invoice.id}/",
            {"status": "paid", "paid_date": str(date.today())},
            format="json",
        )

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "pending")
        self.assertIsNone(self.invoice.paid_date)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_staff_cannot_mint_an_invoice_for_another_user(self):
        self.client.force_authenticate(user=self.staff)
        today = date.today()

        response = self.client.post("/api/v1/invoices/", {
            "staff_user": self.other_staff.id,
            "start_date": str(today - timedelta(days=7)),
            "end_date": str(today),
            "total_hours": "40.00",
            "hourly_rate": "500.00",
            "total_amount": "20000.00",
            "status": "paid",
        }, format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )
        self.assertFalse(Invoice.objects.filter(staff_user=self.other_staff).exists())

    def test_staff_cannot_delete_their_own_invoice(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.delete(f"/api/v1/invoices/{self.invoice.id}/")

        self.assertTrue(Invoice.objects.filter(id=self.invoice.id).exists())
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_manager_cannot_rewrite_money_through_the_default_patch(self):
        """Even an authorised manager writes money through the domain methods.

        `total_amount` is derived from shifts by `generate_for_staff_period` /
        `recalculate_from_shifts`. A free-text PATCH would put the header out
        of step with its own line items with nothing recording why.
        """
        self.client.force_authenticate(user=self.manager)

        self.client.patch(
            f"/api/v1/invoices/{self.invoice.id}/",
            {"total_amount": "1234.00"}, format="json",
        )

        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.total_amount, Decimal("600.00"))

    def test_manager_can_still_change_status(self):
        """Regression guard — `update_status` is the supported write path."""
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            f"/api/v1/invoices/{self.invoice.id}/update-status/",
            {"status": "paid"}, format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "paid")

    def test_staff_can_still_read_their_own_invoices(self):
        """Regression guard — the mobile earnings screen depends on this."""
        self.client.force_authenticate(user=self.staff)

        response = self.client.get("/api/v1/invoices/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertIn(self.invoice.id, [row["id"] for row in rows])
