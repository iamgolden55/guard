"""Shift lists cost the same number of queries for one shift as for twenty.

Sentry flagged N+1 queries on both lists the staff app loads:

- `GET /api/v1/shifts/manager/all/` (PYTHON-DJANGO-1A) ran three COUNT queries
  per shift for "critical issues" on top of its prefetches, and built every
  shift in the company in Python before cutting out the requested page.
- `GET /api/v1/shifts/my_shifts/` (PYTHON-DJANGO-1B) looked up each shift's
  pending exchange, pending release, approved transfer, co-workers and pay rate
  one shift at a time.

Each test builds a list of one shift and a list of twenty, with the related
rows that trigger every per-shift lookup, and asserts the two cost the same.
The rows' content is checked too, so a batched lookup that returns the wrong
thing for a shift fails here rather than in the app.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from api.models import (
    FireExitCheck, OpenShiftRequest, PayRate, SecurityCompany, Shift,
    ShiftExchange, ToiletCheck, UserCompanyMembership, Venue,
    WorkingHoursRegulation,
)

User = get_user_model()


class ShiftListQueryCountTests(APITestCase):
    def setUp(self):
        # GB with the UK regulation, as in production, so every shift's pay
        # goes through the weekly overtime path.
        self.company = SecurityCompany.objects.create(
            name="Count Co", registration_number="CNT001", country_code="GB",
        )
        WorkingHoursRegulation.objects.create(
            country_code="GB", country_name="United Kingdom",
            standard_weekly_hours=Decimal("40.0"), standard_daily_hours=Decimal("8.0"),
            overtime_threshold_hours=Decimal("40.0"), overtime_multiplier_1=Decimal("1.5"),
            overtime_threshold_2=Decimal("50.0"), overtime_multiplier_2=Decimal("2.0"),
            max_daily_hours=Decimal("13.0"), max_weekly_hours=Decimal("60.0"),
        )
        self.other_company = SecurityCompany.objects.create(name="Other Co", registration_number="CNT002")
        self.manager = self._member("count_manager", "manager", self.company)
        self.officer = self._member("count_officer", "staff", self.company)
        self.colleague = self._member("count_colleague", "staff", self.company)
        # Target of the swaps: free at every shift's time, with the right role.
        self.swapper = self._member("count_swapper", "staff", self.company)
        self.venue = self._venue(self.company, "Count Venue")
        self.other_venue = self._venue(self.other_company, "Other Venue")
        # The officer has a default rate; the colleague falls through to
        # system settings.
        PayRate.objects.create(staff_user=self.officer, hourly_rate=Decimal("14.50"), is_default=True)
        self.client = APIClient()
        self.base = timezone.now() + timedelta(days=2)
        self.made = 0

    def _member(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test", password="testpass123",
            role=role, first_name=username.title(), security_roles=["sg", "ds"],
        )
        UserCompanyMembership.objects.create(
            user=user, company=company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def _venue(self, company, name):
        return Venue.objects.create(
            company=company, name=name, address="1 St", city="Bristol",
            postal_code="BS1", country="UK", capacity=100, contact_name="C",
            contact_phone="07700900000",
            contact_email=f"{name.replace(' ', '').lower()}@venue.test",
            terms_and_conditions="T",
        )

    def _shifts(self, n):
        """n of the officer's shifts, each with every kind of related row."""
        shifts = []
        for _ in range(n):
            i = self.made
            self.made += 1
            start = self.base + timedelta(days=i)
            group = f"group-{i}"
            # Eleven hours a day: by the fourth day of a week the officer is
            # past the 40-hour threshold, so pay includes overtime.
            shift = Shift.objects.create(
                staff_user=self.officer, venue=self.venue, start_time=start,
                end_time=start + timedelta(hours=11), status="scheduled", required_security_role="ds",
                is_published=True, shift_group=group,
                check_in_time=start, check_out_time=start + timedelta(hours=11),
                actual_hours_worked=Decimal("11"),
            )
            # A co-worker on the same group.
            Shift.objects.create(
                staff_user=self.colleague, venue=self.venue, start_time=start,
                end_time=start + timedelta(hours=8), status="scheduled", required_security_role="ds",
                is_published=True, shift_group=group,
            )
            ShiftExchange.objects.create(
                original_shift=shift, requesting_user=self.officer,
                target_user=self.swapper, request_reason="swap", status="pending",
            )
            ShiftExchange.objects.create(
                original_shift=shift, requesting_user=self.officer,
                target_user=self.swapper, request_reason="old", status="approved",
            )
            OpenShiftRequest.objects.create(
                original_shift=shift, requesting_user=self.officer,
                request_reason="release", status="open",
            )
            # Completed after the exchanges exist (they refuse a finished shift),
            # so the weekly accumulator counts it for the shifts after it.
            Shift.objects.filter(pk=shift.pk).update(status="completed", payable_hours=Decimal("11"))
            FireExitCheck.objects.create(shift=shift, timestamp=start, exit_name="A", is_clear=False)
            FireExitCheck.objects.create(shift=shift, timestamp=start, exit_name="B", is_clear=True)
            ToiletCheck.objects.create(shift=shift, timestamp=start, location_name="T", condition="poor")
            shifts.append(shift)
        # Another company's shift, which no list may show.
        Shift.objects.create(
            staff_user=self._member(f"outsider_{self.made}", "staff", self.other_company),
            venue=self.other_venue, start_time=self.base, end_time=self.base + timedelta(hours=8),
            status="scheduled", is_published=True,
        )
        return shifts

    def _count(self, user, url):
        self.client.force_authenticate(user)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        return len(ctx.captured_queries), response

    def _flat(self, user, url, n_small=1, n_large=20):
        self._shifts(n_small)
        small, _ = self._count(user, url)
        self._shifts(n_large - n_small)
        large, response = self._count(user, url)
        self.assertEqual(
            small, large,
            f"{url}: {small} queries for {n_small} shift(s), {large} for {n_large}",
        )
        return response

    # -- my_shifts ----------------------------------------------------------

    def test_my_shifts_for_an_officer_is_flat(self):
        response = self._flat(self.officer, "/api/v1/shifts/my_shifts/?page_size=50")
        rows = response.data["results"]
        self.assertEqual(len(rows), 20)
        row = rows[0]
        self.assertEqual(row["pending_exchange"]["status"], "pending")
        self.assertEqual(row["pending_exchange"]["target_user"]["id"], self.swapper.id)
        self.assertEqual(row["pending_release"]["status"], "open")
        self.assertEqual(row["approved_transfer"]["target_user"]["id"], self.swapper.id)
        self.assertEqual([c["id"] for c in row["coworkers"]], [self.colleague.id])
        self.assertEqual(row["staff_details"]["id"], self.officer.id)
        self.assertEqual(row["venue_details"]["name"], "Count Venue")

    def test_my_shifts_for_a_manager_is_flat(self):
        # A manager's own shifts go through the manager serializer.
        self.officer.role = "manager"
        self.officer.save(update_fields=["role"])
        response = self._flat(self.officer, "/api/v1/shifts/my_shifts/?page_size=50")
        self.assertEqual(len(response.data["results"]), 20)

    def test_my_shifts_pay_matches_each_shift_computed_alone(self):
        self._shifts(9)
        _, response = self._count(self.officer, "/api/v1/shifts/my_shifts/?page_size=50")
        rows = response.data["results"]
        self.assertEqual(len(rows), 9)
        for row in rows:
            alone = Shift.objects.get(pk=row["id"]).calculated_payment
            self.assertEqual(Decimal(str(row["calculated_payment"])), alone, row["id"])
        # The batch must not have flattened the overtime away.
        plain = Decimal("11") * Decimal("14.50")
        self.assertTrue(any(Decimal(str(r["calculated_payment"])) > plain for r in rows))

    def test_my_shifts_shows_only_the_callers_shifts(self):
        self._shifts(2)
        _, response = self._count(self.colleague, "/api/v1/shifts/my_shifts/?page_size=50")
        self.assertTrue(all(r["staff_user"] == self.colleague.id for r in response.data["results"]))

    # -- manager/all --------------------------------------------------------

    def test_manager_all_is_flat(self):
        response = self._flat(self.manager, "/api/v1/shifts/manager/all/?page_size=100")
        # 20 officer shifts and 20 co-worker shifts; never the other company's.
        self.assertEqual(response.data["count"], 40)
        self.assertTrue(all(r["venue_details"]["id"] == self.venue.id for r in response.data["results"]))
        officer_rows = [r for r in response.data["results"] if r["staff_details"]["id"] == self.officer.id]
        summary = officer_rows[0]["venue_checks_summary"]
        self.assertEqual(summary["fireExitChecks"], 2)
        self.assertEqual(summary["toiletChecks"], 1)
        self.assertEqual(summary["capacityChecks"], 0)
        self.assertEqual(summary["totalChecks"], 3)
        # One blocked fire exit and one toilet in poor condition.
        self.assertEqual(summary["criticalIssues"], 2)
        self.assertEqual(officer_rows[0]["duration_hours"], 11.0)

    def test_manager_all_pages_in_the_database(self):
        self._shifts(5)
        _, first = self._count(self.manager, "/api/v1/shifts/manager/all/?page=1&page_size=4")
        _, third = self._count(self.manager, "/api/v1/shifts/manager/all/?page=3&page_size=4")
        self.assertEqual(first.data["count"], 10)
        self.assertEqual(first.data["total_pages"], 3)
        self.assertEqual(len(first.data["results"]), 4)
        self.assertEqual(len(third.data["results"]), 2)
        ids = [r["id"] for r in first.data["results"]] + [r["id"] for r in third.data["results"]]
        self.assertEqual(len(set(ids)), 6)
