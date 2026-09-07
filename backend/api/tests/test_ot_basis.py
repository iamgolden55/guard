"""
Overtime basis — P1-3, P3-3. Built, tested, and switched off.

The weekly accumulator sums `Shift.actual_hours_worked` while the hours it
pays are scheduled minus break, so `prior_hours` and `current_hours` are
different quantities compared against one threshold. An officer who checks in
fifteen minutes early and out fifteen minutes late accrues half an hour of
phantom hours per shift, crosses the threshold sooner than their paid hours
justify, and is paid the excess at 1.5x or 2x. Separately, invoice headers
report actual hours while their line items report the payable figure, so the
two never reconcile.

Correcting either moves real pay in both directions, so `OT_BASIS_ALIGNED`
defaults to False and these tests hold both states: with the flag off the
behaviour must be exactly what it was, and with it on the arithmetic must be
right. Flipping it is a decision to take with
`manage.py report_ot_basis_delta` in hand.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    SecurityCompany, Shift, UserCompanyMembership, Venue, WorkingHoursRegulation,
)

User = get_user_model()


class OvertimeBasisTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="OT Co", registration_number="OT001",
            country_code="GB", timezone="Europe/London",
        )
        self.staff = User.objects.create_user(
            username="ot_staff", email="ot@test.test",
            password="testpass123", role="staff",
        )
        self.manager = User.objects.create_user(
            username="ot_manager", email="otmgr@test.test",
            password="testpass123", role="manager",
        )
        for user in (self.staff, self.manager):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True,
            )
        self.venue = Venue.objects.create(
            company=self.company, name="OT Venue", address="1 OT St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="ot@venue.test", terms_and_conditions="Terms",
        )
        WorkingHoursRegulation.objects.create(
            country_code="GB", country_name="United Kingdom", is_active=True,
            standard_weekly_hours=Decimal("40.00"),
            standard_daily_hours=Decimal("8.00"),
            max_daily_hours=Decimal("13.00"),
            max_weekly_hours=Decimal("60.00"),
            overtime_threshold_hours=Decimal("40.00"),
            overtime_multiplier_1=Decimal("1.50"),
        )
        # A Monday, so all five shifts land in one ISO week.
        base = (timezone.now() - timedelta(days=21)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        self.monday = base - timedelta(days=base.weekday())

    def _week_of_shifts(self, count=5, scheduled=8, actual=9):
        """`count` shifts scheduled for `scheduled` h, each worked `actual` h.

        The officer arrives early and leaves late every day: paid hours come to
        `count * scheduled`, clock time to `count * actual`.
        """
        shifts = []
        for day in range(count):
            start = self.monday + timedelta(days=day)
            shift = Shift.objects.create(
                venue=self.venue, staff_user=self.staff,
                start_time=start, end_time=start + timedelta(hours=scheduled),
                status="scheduled", required_security_role="sg",
                is_published=True, hourly_rate=Decimal("15.00"),
            )
            overrun = timedelta(hours=(actual - scheduled)) / 2
            shift.check_in_time = start - overrun
            shift.check_out_time = start + timedelta(hours=scheduled) + overrun
            shift.status = "approved"
            shift.save()
            shifts.append(shift)
        return shifts

    def _adjust(self, shift, hours, reason):
        """A manager correction. `TimeAdjustment.clean` cross-checks the hours
        against the adjusted times, so both have to move together."""
        from api.models import TimeAdjustment

        adjusted_out = shift.check_in_time + timedelta(hours=float(hours))
        return TimeAdjustment.objects.create(
            shift=shift,
            original_check_in_time=shift.check_in_time,
            original_check_out_time=shift.check_out_time,
            original_actual_hours=shift.actual_hours_worked,
            adjusted_check_in_time=shift.check_in_time,
            adjusted_check_out_time=adjusted_out,
            adjusted_actual_hours=Decimal(str(hours)),
            adjusted_by=self.manager,
            manager_signature="manager",
            reason=reason,
        )

    def _overtime_hours(self, shifts):
        total = Decimal("0")
        for shift in shifts:
            breakdown = shift.calculate_payment_breakdown()
            if breakdown:
                total += breakdown["ot1_hours"] + breakdown["ot2_hours"]
        return total

    # ── the column itself ───────────────────────────────────────────────────

    def test_payable_hours_is_persisted_and_is_not_clock_time(self):
        shift = self._week_of_shifts(count=1)[0]

        shift.refresh_from_db()
        self.assertEqual(shift.payable_hours, Decimal("8.00"))
        self.assertEqual(shift.actual_hours_worked, Decimal("9.00"))

    def test_payable_hours_follows_an_admin_adjustment(self):
        shift = self._week_of_shifts(count=1)[0]
        self._adjust(shift, "6.00", "Officer left two hours early.")

        self.assertEqual(shift.compute_payable_hours(), Decimal("6.00"))

    # ── flag off: nothing moves ─────────────────────────────────────────────

    @override_settings(OT_BASIS_ALIGNED=False)
    def test_with_the_flag_off_phantom_overtime_still_accrues(self):
        """The bug, pinned. 40 paid hours, yet overtime is booked.

        Clock time reaches 45 h across the week, so the accumulator crosses the
        40 h threshold on the fifth shift even though the officer is paid for
        exactly 40.
        """
        shifts = self._week_of_shifts()

        self.assertGreater(
            self._overtime_hours(shifts), Decimal("0"),
            "expected the pre-fix behaviour to book overtime it has not earned",
        )

    @override_settings(OT_BASIS_ALIGNED=False)
    def test_with_the_flag_off_the_revenue_neutral_split_still_holds(self):
        for shift in self._week_of_shifts():
            breakdown = shift.calculate_payment_breakdown()
            self.assertEqual(
                breakdown["base_amount"] + breakdown["ot1_amount"] + breakdown["ot2_amount"],
                shift.calculate_payment(),
            )

    # ── flag on: the arithmetic is right ────────────────────────────────────

    @override_settings(OT_BASIS_ALIGNED=True)
    def test_forty_paid_hours_earn_no_overtime(self):
        shifts = self._week_of_shifts()

        self.assertEqual(
            self._overtime_hours(shifts), Decimal("0"),
            "an officer paid for exactly the threshold has not worked overtime",
        )

    @override_settings(OT_BASIS_ALIGNED=True)
    def test_genuine_excess_still_earns_overtime(self):
        """Six 8-hour shifts is 48 paid hours: 8 of them are real overtime."""
        shifts = self._week_of_shifts(count=6)

        self.assertEqual(self._overtime_hours(shifts), Decimal("8.00"))

    @override_settings(OT_BASIS_ALIGNED=True)
    def test_an_adjustment_raising_one_shift_earns_overtime_for_the_excess(self):
        shifts = self._week_of_shifts()
        last = shifts[-1]
        self._adjust(last, "10.00", "Manager-approved overtime.")
        last.refresh_from_db()

        # 4 x 8 paid + 10 = 42; two hours past the 40 h threshold.
        self.assertEqual(self._overtime_hours(shifts), Decimal("2.00"))

    @override_settings(OT_BASIS_ALIGNED=True)
    def test_the_revenue_neutral_split_still_holds_when_aligned(self):
        for shift in self._week_of_shifts(count=6):
            breakdown = shift.calculate_payment_breakdown()
            self.assertEqual(
                breakdown["base_amount"] + breakdown["ot1_amount"] + breakdown["ot2_amount"],
                shift.calculate_payment(),
            )

    # ── P3-3: the invoice header ────────────────────────────────────────────

    @override_settings(OT_BASIS_ALIGNED=True)
    def test_the_invoice_header_reconciles_against_its_line_items(self):
        from api.models import Invoice

        shifts = self._week_of_shifts()
        invoice = Invoice.generate_for_staff_period(
            staff_user=self.staff,
            start_date=self.monday.date(),
            end_date=(self.monday + timedelta(days=7)).date(),
        )

        item_hours = sum(
            (item.hours_worked or Decimal("0")) for item in invoice.items.all()
        )
        self.assertEqual(invoice.total_hours, Decimal("40.00"))
        self.assertEqual(invoice.total_hours, item_hours)

    @override_settings(OT_BASIS_ALIGNED=False)
    def test_with_the_flag_off_the_header_still_reports_actual_hours(self):
        """Pinned so a flip is visible as a change, not a silent drift."""
        from api.models import Invoice

        self._week_of_shifts()
        invoice = Invoice.generate_for_staff_period(
            staff_user=self.staff,
            start_date=self.monday.date(),
            end_date=(self.monday + timedelta(days=7)).date(),
        )

        self.assertEqual(invoice.total_hours, Decimal("45.00"))
