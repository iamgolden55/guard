"""
Shift swaps and releases — AUDIT-2026-09-17 escalation table, Phase 2A.

The audit named the shape: business rules enforced in custom actions
(`approve`, `accept`, `claim`) and absent from the default CRUD routes on the
same ViewSet. The serializers are `fields='__all__'`, so:

- a party to a swap could PATCH it to `approved` (notifications go out as
  though a manager had signed off) or DELETE it outright;
- worse, creating a swap never checked that the requester owned the shift
  being offered. An officer could offer a colleague's shift — or another
  company's — to an accomplice, who accepts; with auto-approval on, the
  colleague's shift was reassigned.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    OpenShiftRequest, SecurityCompany, Shift, ShiftExchange, UserCompanyMembership, Venue,
)

User = get_user_model()


class SwapTestCase(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name="Swap Co", registration_number="SWP001")
        self.other = SecurityCompany.objects.create(name="Other Co", registration_number="SWP002")
        self.manager = self._user("swap_mgr", "manager", self.company)
        self.officer = self._user("swap_officer", "staff", self.company)
        self.colleague = self._user("swap_colleague", "staff", self.company)
        self.accomplice = self._user("swap_accomplice", "staff", self.company)
        self.outsider = self._user("swap_outsider", "staff", self.other)
        self.venue = self._venue(self.company, "Swap Venue")
        self.start = (timezone.now() + timedelta(days=5)).replace(minute=0, second=0, microsecond=0)
        self.own_shift = self._shift(self.officer, self.start)
        self.colleague_shift = self._shift(self.colleague, self.start + timedelta(days=1))

    def _user(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test", password="x", role=role,
            security_roles=["sg"],
        )
        UserCompanyMembership.objects.create(user=user, company=company, is_active=True)
        return user

    def _venue(self, company, name):
        return Venue.objects.create(
            company=company, name=name, address="1 St", city="Bristol", postal_code="BS1 1AA",
            country="UK", capacity=100, contact_name="C", contact_phone="07700900000",
            contact_email=f"{name.split()[0].lower()}@venue.test", terms_and_conditions="Terms",
        )

    def _shift(self, staff, start):
        return Shift.objects.create(
            venue=self.venue, staff_user=staff, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True, hourly_rate=Decimal("15.00"),
        )

    def _offer(self, as_user, shift, target, **extra):
        self.client.force_authenticate(user=as_user)
        body = {"original_shift": shift.pk, "target_user": target.pk, "request_reason": "cover"}
        body.update(extra)
        return self.client.post("/api/v1/shift-exchanges/", body, format="json")


class SwapCreationTests(SwapTestCase):
    def test_an_officer_cannot_offer_a_colleagues_shift(self):
        response = self._offer(self.officer, self.colleague_shift, self.accomplice)

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(ShiftExchange.objects.exists())
        self.colleague_shift.refresh_from_db()
        self.assertEqual(self.colleague_shift.staff_user, self.colleague)

    def test_a_swap_cannot_reach_into_another_company(self):
        response = self._offer(self.officer, self.own_shift, self.outsider)

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(ShiftExchange.objects.exists())

    def test_a_swap_cannot_be_created_already_approved(self):
        response = self._offer(
            self.officer, self.own_shift, self.colleague,
            status="approved", manager_user=self.manager.pk, manager_notes="fine",
        )

        self.assertEqual(response.status_code, 201, response.data)
        exchange = ShiftExchange.objects.get()
        self.assertEqual(exchange.status, "pending")
        self.assertIsNone(exchange.manager_user)
        self.assertIn(exchange.manager_notes, (None, ""))

    def test_the_genuine_swap_still_works_end_to_end(self):
        response = self._offer(self.officer, self.own_shift, self.colleague)
        self.assertEqual(response.status_code, 201, response.data)
        exchange_id = response.data["id"]

        self.client.force_authenticate(user=self.colleague)
        response = self.client.post(f"/api/v1/shift-exchanges/{exchange_id}/accept/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.own_shift.refresh_from_db()
        self.assertEqual(self.own_shift.staff_user, self.colleague)


class SwapStateTests(SwapTestCase):
    def setUp(self):
        super().setUp()
        self.exchange = ShiftExchange.objects.create(
            original_shift=self.own_shift, requesting_user=self.officer,
            target_user=self.colleague, request_reason="cover",
        )

    def test_a_party_cannot_patch_a_swap_to_approved(self):
        for user in (self.officer, self.colleague):
            with self.subTest(user=user.username):
                self.client.force_authenticate(user=user)
                response = self.client.patch(
                    f"/api/v1/shift-exchanges/{self.exchange.pk}/",
                    {"status": "approved", "manager_user": self.manager.pk}, format="json",
                )
                self.assertEqual(response.status_code, 405)
                self.exchange.refresh_from_db()
                self.assertEqual(self.exchange.status, "pending")
                self.assertIsNone(self.exchange.manager_user)

    def test_a_party_cannot_delete_a_swap_record(self):
        self.client.force_authenticate(user=self.officer)
        response = self.client.delete(f"/api/v1/shift-exchanges/{self.exchange.pk}/")
        self.assertEqual(response.status_code, 405)
        self.assertTrue(ShiftExchange.objects.filter(pk=self.exchange.pk).exists())

    def test_the_cancel_action_still_works(self):
        self.client.force_authenticate(user=self.officer)
        response = self.client.delete(f"/api/v1/shift-exchanges/{self.exchange.pk}/cancel/")
        self.assertIn(response.status_code, (200, 204), response.data if hasattr(response, "data") else None)
        self.exchange.refresh_from_db()
        self.assertEqual(self.exchange.status, "cancelled")


class ReleaseStateTests(SwapTestCase):
    def setUp(self):
        super().setUp()
        self.release = OpenShiftRequest.objects.create(
            original_shift=self.own_shift, requesting_user=self.officer, request_reason="ill",
        )

    def test_nobody_can_patch_a_release_to_approved_or_claimed(self):
        self.client.force_authenticate(user=self.colleague)
        response = self.client.patch(
            f"/api/v1/open-shift-requests/{self.release.pk}/",
            {"status": "approved", "claimed_by": self.colleague.pk}, format="json",
        )
        self.assertEqual(response.status_code, 405)
        self.release.refresh_from_db()
        self.assertEqual(self.release.status, "open")
        self.assertIsNone(self.release.claimed_by)

    def test_a_release_record_cannot_be_deleted_directly(self):
        self.client.force_authenticate(user=self.officer)
        response = self.client.delete(f"/api/v1/open-shift-requests/{self.release.pk}/")
        self.assertEqual(response.status_code, 405)
        self.assertTrue(OpenShiftRequest.objects.filter(pk=self.release.pk).exists())
