"""
Cross-tenant matrix — P0-2, P1-7.

Seed identical data in two companies, then assert that a manager in one never
sees a number that includes the other. The leak these cover was not in the
ViewSets that look like they hold data — `LeaveRequestViewSet` was correctly
scoped all along — but in the reporting and settings endpoints beside them,
which counted, aggregated and charted straight off `LeaveRequest.objects` with
no company predicate at all.

Counts are the giveaway that a leak is a leak: company A seeds one request and
company B seeds three, so any endpoint returning four is reading across the
platform.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue
from leave_management.models import (
    LeaveEntitlement, LeavePolicy, LeaveRequest, LeaveType,
)

User = get_user_model()


class Tenant:
    """One company with a manager, staff, venue and seeded leave."""

    def __init__(self, name, reg, leave_type, staff_count):
        self.company = SecurityCompany.objects.create(
            name=name, registration_number=reg,
        )
        self.manager = self._user(f"{reg.lower()}_mgr", "manager")
        self.venue = Venue.objects.create(
            company=self.company, name=f"{name} Venue", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email=f"{reg.lower()}@venue.test",
            terms_and_conditions="Terms",
        )
        self.staff = []
        for i in range(staff_count):
            member = self._user(f"{reg.lower()}_staff{i}", "staff")
            self.staff.append(member)
            LeaveRequest.objects.create(
                staff_user=member, leave_type=leave_type,
                start_date=date.today() + timedelta(days=10 + i),
                end_date=date.today() + timedelta(days=11 + i),
                days_requested=Decimal("2.0"), status="pending",
                reason="Test leave",
            )

    def _user(self, username, role):
        # `is_staff` because `leave_management.permissions` resolves role via
        # `user.profile.role`, a field StaffProfile does not have — so
        # `get_user_role` returns 'staff' for everyone and its
        # ManagerOrAdminPermission passes only on Django's own is_staff /
        # is_superuser. That is a pre-existing quirk of that module, separate
        # from the tenancy leak under test here; without this flag the manager
        # cannot reach the reporting endpoints at all.
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
            is_staff=(role != "staff"),
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user


class LeaveTenantIsolationTests(APITestCase):
    def setUp(self):
        self.leave_type = LeaveType.objects.create(
            name="Annual Leave", code="annual", is_active=True,
        )
        self.a = Tenant("Alpha Security", "ALPHA1", self.leave_type, staff_count=1)
        self.b = Tenant("Bravo Security", "BRAVO1", self.leave_type, staff_count=3)
        self.client = APIClient()
        self.client.force_authenticate(user=self.a.manager)

    def _rows(self, response):
        body = response.json()
        if isinstance(body, dict):
            for key in ("results", "events", "requests", "data"):
                if key in body and isinstance(body[key], list):
                    return body[key]
        return body if isinstance(body, list) else []

    def test_leave_requests_are_scoped(self):
        """Regression guard — this viewset was already correct."""
        response = self.client.get("/api/v1/leave/requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._rows(response)), 1)

    def test_report_counts_do_not_include_the_other_company(self):
        response = self.client.get("/api/v1/leave/reports/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        body = response.json()
        payload = body.get("data", body) if isinstance(body, dict) else {}
        for key in ("total_requests", "pending_requests"):
            if key in payload:
                self.assertLessEqual(
                    payload[key], 1,
                    f"{key}={payload[key]} — includes another company's leave",
                )

    def test_the_calendar_does_not_render_the_other_company(self):
        for request in LeaveRequest.objects.all():
            request.status = "approved"
            request.save(update_fields=["status"])

        response = self.client.get("/api/v1/leave/calendar/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        rows = self._rows(response)
        names = " ".join(str(row) for row in rows)
        self.assertNotIn("bravo1_staff", names, "calendar leaked another company's staff")
        self.assertLessEqual(len(rows), 1)


class ShiftTenantIsolationTests(APITestCase):
    """P0-2 — the shift surfaces must not cross companies either."""

    def setUp(self):
        self.a = SecurityCompany.objects.create(
            name="Shift Alpha", registration_number="SALPHA",
        )
        self.b = SecurityCompany.objects.create(
            name="Shift Bravo", registration_number="SBRAVO",
        )
        self.manager_a = self._user("shift_mgr_a", "manager", self.a)
        self.staff_b = self._user("shift_staff_b", "staff", self.b)
        self.venue_b = Venue.objects.create(
            company=self.b, name="B Venue", address="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="b@venue.test", terms_and_conditions="Terms",
        )
        from django.utils import timezone
        start = (timezone.now() + timedelta(days=1)).replace(
            minute=0, second=0, microsecond=0
        )
        self.shift_b = Shift.objects.create(
            venue=self.venue_b, staff_user=self.staff_b,
            start_time=start, end_time=start + timedelta(hours=8),
            status="scheduled", required_security_role="sg",
            is_published=True, hourly_rate=Decimal("15.00"),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager_a)

    def _user(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def test_the_shift_list_does_not_include_another_company(self):
        response = self.client.get("/api/v1/shifts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertNotIn(self.shift_b.id, [row["id"] for row in rows])

    def test_another_companys_shift_cannot_be_retrieved(self):
        response = self.client.get(f"/api/v1/shifts/{self.shift_b.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_another_companys_shift_cannot_be_edited(self):
        response = self.client.patch(
            f"/api/v1/shifts/{self.shift_b.id}/",
            {"hourly_rate": "99.00"}, format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.shift_b.refresh_from_db()
        self.assertEqual(self.shift_b.hourly_rate, Decimal("15.00"))
