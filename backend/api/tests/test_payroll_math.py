"""Regression tests pinning current correct behaviour of payroll math.

Covers:
- Shift.calculate_payment_breakdown OT1/OT2 splits
- Invoice.generate_for_staff_period idempotency + line-item totals

These tests are the safety net for upcoming refactors (P1.1 hybrid invoice
flow, P2.x correctness fixes). They lock in the math we trust today so we
notice immediately if a change breaks it.
"""
from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from api.models import (
    Invoice,
    InvoiceItem,
    SecurityCompany,
    Shift,
    TimeAdjustment,
    Venue,
    WorkingHoursRegulation,
)
from api.serializers_billing import _adjustment_payload

User = get_user_model()


class PayrollMathTestBase(TestCase):
    """Shared fixtures: company in GB, GB regulation (40h/50h thresholds), one venue, one staff user."""

    @classmethod
    def setUpTestData(cls):
        cls.company = SecurityCompany.objects.create(
            name="Test Sec",
            registration_number="REG-TEST-1",
            country_code="GB",
            city="London",
            postal_code="SW1A 1AA",
        )
        cls.venue = Venue.objects.create(
            company=cls.company,
            name="Test Venue",
            address="1 Test St",
            city="London",
            postal_code="SW1A 1AA",
            country="GB",
            capacity=100,
            contact_name="Contact",
            contact_phone="0",
            contact_email="c@test.com",
            terms_and_conditions="t",
        )
        cls.regulation = WorkingHoursRegulation.objects.create(
            country_code="GB",
            country_name="United Kingdom",
            standard_weekly_hours=Decimal("40.0"),
            standard_daily_hours=Decimal("8.0"),
            overtime_threshold_hours=Decimal("40.0"),
            overtime_multiplier_1=Decimal("1.5"),
            overtime_threshold_2=Decimal("50.0"),
            overtime_multiplier_2=Decimal("2.0"),
            max_daily_hours=Decimal("13.0"),
            max_weekly_hours=Decimal("60.0"),
        )
        cls.staff = User.objects.create_user(
            username="ot_test_staff",
            email="ot@test.com",
            password="x",
            role="staff",
        )
        # Anchor on a Monday so weekday()==0 and the week boundary calc lands cleanly.
        cls.monday = timezone.make_aware(
            datetime(2026, 1, 5, 9, 0)  # 2026-01-05 is a Monday
        )

    def _make_shift(
        self,
        *,
        hours,
        day_offset=0,
        rate="10.00",
        special=False,
        status="approved",
    ):
        """Create an approved shift with deterministic actual_hours_worked.

        Sets hourly_rate explicitly so rate resolution short-circuits at level 1
        and doesn't need PayRate / SystemSettings fixtures.
        """
        start = self.monday + timedelta(days=day_offset)
        end = start + timedelta(hours=hours)
        shift = Shift(
            staff_user=self.staff,
            venue=self.venue,
            start_time=start,
            end_time=end,
            check_in_time=start,
            check_out_time=end,
            required_security_role="security",
            status=status,
            manager_approved=(status == "approved"),
            is_special_event=special,
            break_duration=0,
            hourly_rate=Decimal(rate),
            terms_accepted=True,
        )
        shift.save()
        # save() recomputes actual_hours_worked from check_in/out — confirm it matches.
        assert shift.actual_hours_worked == Decimal(str(hours)).quantize(
            Decimal("0.01")
        ), f"expected {hours}h, got {shift.actual_hours_worked}"
        return shift


class CalculatePaymentBreakdownTests(PayrollMathTestBase):
    """Pin OT classification logic in Shift.calculate_payment_breakdown."""

    def test_under_threshold_all_base_no_overtime(self):
        """A 6h shift on Monday with no prior hours → all base, zero OT."""
        shift = self._make_shift(hours=6)
        bd = shift.calculate_payment_breakdown()

        self.assertEqual(bd["base_hours"], Decimal("6"))
        self.assertEqual(bd["ot1_hours"], Decimal("0"))
        self.assertEqual(bd["ot2_hours"], Decimal("0"))
        self.assertEqual(bd["base_amount"], Decimal("60.00"))
        self.assertEqual(bd["ot1_amount"], Decimal("0"))
        self.assertEqual(bd["ot2_amount"], Decimal("0"))

    def test_ot1_only_when_cumulative_crosses_threshold_1(self):
        """Prior 38h + current 4h, threshold_1=40 → 2h base + 2h OT1, no OT2."""
        # Prior: one 38h "shift" via two days of 19h each (avoid 24h validator).
        self._make_shift(hours=19, day_offset=0)  # Mon 19h
        self._make_shift(hours=19, day_offset=1)  # Tue 19h → prior=38
        current = self._make_shift(hours=4, day_offset=2)  # Wed 4h

        bd = current.calculate_payment_breakdown()
        self.assertEqual(bd["base_hours"], Decimal("2"))
        self.assertEqual(bd["ot1_hours"], Decimal("2"))
        self.assertEqual(bd["ot2_hours"], Decimal("0"))
        self.assertEqual(bd["base_amount"], Decimal("20.00"))
        self.assertEqual(bd["ot1_amount"], Decimal("30.00"))  # 2 * 10 * 1.5
        self.assertEqual(bd["ot2_amount"], Decimal("0"))

    def test_ot2_split_when_cumulative_crosses_both_thresholds(self):
        """Prior 44h, current 10h: thresholds 40/50 → 0 base + 6 OT1 + 4 OT2."""
        self._make_shift(hours=22, day_offset=0)  # Mon 22h
        self._make_shift(hours=22, day_offset=1)  # Tue 22h → prior=44
        current = self._make_shift(hours=10, day_offset=2)  # Wed 10h, cumulative 54

        bd = current.calculate_payment_breakdown()
        self.assertEqual(bd["base_hours"], Decimal("0"))
        self.assertEqual(bd["ot1_hours"], Decimal("6"))   # 50 - 44 = 6 hours of OT1
        self.assertEqual(bd["ot2_hours"], Decimal("4"))   # remaining 4h above 50
        self.assertEqual(bd["base_amount"], Decimal("0"))
        self.assertEqual(bd["ot1_amount"], Decimal("90.00"))   # 6 * 10 * 1.5
        self.assertEqual(bd["ot2_amount"], Decimal("80.00"))   # 4 * 10 * 2.0

    def test_breakdown_total_matches_scalar_calculate_payment(self):
        """Revenue-neutrality: breakdown amounts sum to calculate_payment()."""
        self._make_shift(hours=20, day_offset=0)
        self._make_shift(hours=20, day_offset=1)  # prior=40
        current = self._make_shift(hours=12, day_offset=2)  # cumulative 52

        bd = current.calculate_payment_breakdown()
        scalar = current.calculate_payment()
        tier_sum = bd["base_amount"] + bd["ot1_amount"] + bd["ot2_amount"]
        self.assertEqual(tier_sum, scalar)

    def test_special_event_flag_is_carried_through(self):
        """is_special_event=True is preserved; explicit shift rate still wins."""
        shift = self._make_shift(hours=4, special=True)
        self.assertTrue(shift.is_special_event)
        bd = shift.calculate_payment_breakdown()
        # Per-shift rate override (£10) is level 1 of the cascade, beats even
        # special_event_pay_rate (intentional — admins can set explicit rates).
        self.assertEqual(bd["base_hours"], Decimal("4"))
        self.assertEqual(bd["base_amount"], Decimal("40.00"))

    def test_special_event_uses_special_pay_rate_when_no_shift_override(self):
        """P3.3 (C5 fix): without an explicit shift.hourly_rate, a special-event
        shift uses SystemSettings.special_event_pay_rate (was previously
        unreachable because PayRate cascade beat the SystemSettings fallback)."""
        from api.models import SystemSettings
        SystemSettings.objects.create(
            default_hourly_rate=Decimal("10.00"),
            special_event_pay_rate=Decimal("18.00"),
        )
        # Build a shift without an explicit hourly_rate
        start = self.monday
        end = start + timedelta(hours=4)
        shift = Shift(
            staff_user=self.staff,
            venue=self.venue,
            start_time=start,
            end_time=end,
            check_in_time=start,
            check_out_time=end,
            required_security_role="security",
            status="approved",
            manager_approved=True,
            is_special_event=True,
            break_duration=0,
            terms_accepted=True,
            # NB: no hourly_rate set
        )
        shift.save()
        rate = shift.get_effective_hourly_rate()
        self.assertEqual(rate, Decimal("18.00"))

    def test_earlier_shift_in_same_week_does_not_count_later_shifts_as_prior(self):
        """P3.5 regression: the FIRST shift in a week, when its breakdown is
        computed, must NOT see later shifts as 'prior'. Otherwise it gets
        falsely classified as OT due to hours that happen *after* it."""
        first = self._make_shift(hours=20, day_offset=0)   # Mon 20h
        self._make_shift(hours=20, day_offset=1)            # Tue 20h
        self._make_shift(hours=8, day_offset=2)             # Wed 8h

        bd = first.calculate_payment_breakdown()
        # Before P3.5: first shift saw 28h (Tue+Wed) as prior, falsely
        # triggering OT for itself. After P3.5: prior=0, all base.
        self.assertEqual(bd["base_hours"], Decimal("20"))
        self.assertEqual(bd["ot1_hours"], Decimal("0"))
        self.assertEqual(bd["ot2_hours"], Decimal("0"))

    def test_middle_shift_only_counts_temporally_preceding_shifts(self):
        """The middle shift (Tue) sees only Mon as prior, not Wed."""
        self._make_shift(hours=20, day_offset=0)            # Mon 20h
        middle = self._make_shift(hours=20, day_offset=1)   # Tue 20h
        self._make_shift(hours=8, day_offset=2)             # Wed 8h

        bd = middle.calculate_payment_breakdown()
        # prior=20 (Mon), current=20, cumulative=40, exactly at threshold → no OT
        self.assertEqual(bd["base_hours"], Decimal("20"))
        self.assertEqual(bd["ot1_hours"], Decimal("0"))


class GenerateForStaffPeriodTests(PayrollMathTestBase):
    """Pin Invoice.generate_for_staff_period behaviour."""

    def test_period_invoice_total_matches_sum_of_items(self):
        """invoice.total_amount equals the sum of its InvoiceItem.amount values."""
        self._make_shift(hours=8, day_offset=0)
        self._make_shift(hours=8, day_offset=1)
        self._make_shift(hours=8, day_offset=2)

        invoice = Invoice.generate_for_staff_period(
            staff_user=self.staff,
            start_date=self.monday.date(),
            end_date=(self.monday + timedelta(days=6)).date(),
        )
        items_sum = sum(
            (item.amount for item in invoice.items.all()),
            start=Decimal("0"),
        )
        self.assertEqual(invoice.total_amount, items_sum)
        self.assertEqual(invoice.total_hours, Decimal("24"))

    def test_idempotency_exact_period_match_returns_existing(self):
        """Calling generate_for_staff_period twice for the same period returns
        the same Invoice and does not duplicate items."""
        self._make_shift(hours=8, day_offset=0)
        start = self.monday.date()
        end = (self.monday + timedelta(days=6)).date()

        first = Invoice.generate_for_staff_period(self.staff, start, end)
        first_items = list(first.items.values_list("id", flat=True))

        second = Invoice.generate_for_staff_period(self.staff, start, end)
        self.assertEqual(first.id, second.id)
        # Items unchanged — no duplicate emission
        self.assertEqual(
            sorted(first_items),
            sorted(second.items.values_list("id", flat=True)),
        )

    def test_two_pending_invoices_with_overlap_still_coexist(self):
        """Pins behaviour: when admin/cron explicitly creates two non-draft
        invoices with overlapping periods, both persist. The hybrid supersede
        only triggers when an existing invoice is a 'draft'. This case is rare
        in practice (real auto-invoices use default_status='draft' now)."""
        self._make_shift(hours=8, day_offset=0)

        single = Invoice.generate_for_staff_period(
            self.staff, self.monday.date(), self.monday.date(),
        )
        weekly = Invoice.generate_for_staff_period(
            self.staff, self.monday.date(), (self.monday + timedelta(days=6)).date(),
        )
        self.assertNotEqual(single.id, weekly.id)
        self.assertIsNone(single.superseded_by)
        self.assertIsNone(weekly.superseded_by)


class HybridInvoiceFlowTests(PayrollMathTestBase):
    """P1.1: auto-generate creates drafts that get superseded by period invoices."""

    def test_auto_generate_creates_draft_status(self):
        """Shift approval triggers auto_generate_invoice which now creates a
        DRAFT invoice (not 'pending'). The draft is the staff's live earnings
        view until a period regenerate creates the official invoice."""
        # Use status='pending_approval' first, then transition to approved so
        # the save() side-effect fires auto_generate_invoice.
        shift = self._make_shift(hours=6, status="pending_approval")
        # Trigger the approval transition explicitly
        shift.status = "approved"
        shift.manager_approved = True
        shift.save()

        invoice = Invoice.objects.filter(staff_user=self.staff).first()
        self.assertIsNotNone(invoice, "auto_generate_invoice did not create an invoice")
        self.assertEqual(invoice.status, "draft")
        self.assertEqual(invoice.start_date, invoice.end_date)  # single-day
        self.assertIsNone(invoice.superseded_by)

    def test_period_invoice_supersedes_overlapping_draft(self):
        """generate_for_staff_period with default_status='pending' (the
        regenerate path) supersedes overlapping draft invoices for the same
        staff, replacing the auto-draft with the official period invoice."""
        # Create a draft directly (simulating what auto_generate_invoice does)
        self._make_shift(hours=6, day_offset=0)
        draft = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            self.monday.date(),
            default_status="draft",
        )
        self.assertEqual(draft.status, "draft")

        # Now run the period regenerate — should supersede the draft
        period = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            (self.monday + timedelta(days=6)).date(),
        )
        draft.refresh_from_db()
        self.assertEqual(draft.superseded_by_id, period.id)
        self.assertIsNone(period.superseded_by)

    def test_period_invoice_does_not_supersede_pending_or_paid(self):
        """Only DRAFT invoices are superseded. Pending/paid invoices represent
        committed state and must not be silently replaced."""
        self._make_shift(hours=6, day_offset=0)
        pending = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            self.monday.date(),
            # default 'pending'
        )
        self.assertEqual(pending.status, "pending")

        period = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            (self.monday + timedelta(days=6)).date(),
        )
        pending.refresh_from_db()
        self.assertIsNone(pending.superseded_by)
        self.assertNotEqual(pending.id, period.id)

    def test_multiple_drafts_supersede_to_one_period_invoice(self):
        """FK (not OneToOne) on superseded_by allows many drafts → one period.
        This is the common case: 5 daily auto-drafts replaced by one weekly
        regenerate."""
        # 3 separate days, each with its own draft auto-invoice
        for day in (0, 1, 2):
            self._make_shift(hours=4, day_offset=day)
            Invoice.generate_for_staff_period(
                self.staff,
                (self.monday + timedelta(days=day)).date(),
                (self.monday + timedelta(days=day)).date(),
                default_status="draft",
            )
        drafts = list(Invoice.objects.filter(staff_user=self.staff, status="draft"))
        self.assertEqual(len(drafts), 3)

        # Weekly regenerate
        period = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            (self.monday + timedelta(days=6)).date(),
        )
        for draft in drafts:
            draft.refresh_from_db()
            self.assertEqual(
                draft.superseded_by_id, period.id,
                f"draft {draft.id} ({draft.start_date}) was not superseded",
            )

    def test_creating_a_draft_does_not_supersede_existing_drafts(self):
        """A new draft must NOT supersede other drafts. Only non-draft
        invoices trigger supersede. This protects against auto_generate firing
        repeatedly and chain-superseding earlier drafts."""
        self._make_shift(hours=4, day_offset=0)
        first_draft = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            self.monday.date(),
            default_status="draft",
        )
        # Calling again with a different period but still draft should not touch
        # the first draft.
        self._make_shift(hours=4, day_offset=1)
        second_draft = Invoice.generate_for_staff_period(
            self.staff,
            (self.monday + timedelta(days=1)).date(),
            (self.monday + timedelta(days=1)).date(),
            default_status="draft",
        )
        first_draft.refresh_from_db()
        self.assertIsNone(first_draft.superseded_by)
        self.assertIsNone(second_draft.superseded_by)

    def test_adjustment_payload_returns_real_field_data(self):
        """P2.1: _adjustment_payload reads correct field names off TimeAdjustment.
        Before the fix, before/after/delta were always blank because the
        serializer read 'original_check_in' / 'adjusted_check_in' /
        'adjustment_minutes' which don't exist on the model."""
        from datetime import datetime as _dt
        shift = self._make_shift(hours=6, day_offset=0)
        adj = TimeAdjustment.objects.create(
            shift=shift,
            original_check_in_time=timezone.make_aware(_dt(2026, 1, 5, 9, 0)),
            original_check_out_time=timezone.make_aware(_dt(2026, 1, 5, 15, 0)),
            original_actual_hours=Decimal("6.00"),
            adjusted_check_in_time=timezone.make_aware(_dt(2026, 1, 5, 9, 15)),
            adjusted_check_out_time=timezone.make_aware(_dt(2026, 1, 5, 15, 30)),
            adjusted_actual_hours=Decimal("6.25"),
            reason="Late check-in due to gate scanner outage",
            manager_signature="sig",
            adjusted_by=self.staff,
        )
        payload = _adjustment_payload(adj)
        self.assertEqual(payload["before"], "09:00")
        self.assertEqual(payload["after"], "09:15")
        # 6.25h - 6.00h = 0.25h = 15min
        self.assertEqual(payload["delta"], "+15m")

    def test_time_adjustment_cascades_to_sibling_invoices_in_same_week(self):
        """P3.4 (C3 fix): when a shift adjustment changes hours, sibling
        invoices in the same ISO week containing later-starting shifts must
        have their OT split re-emitted. Without cascade, sibling invoices
        keep stale OT classifications."""
        # Shift A on Monday (20h), invoice_A is its single-day draft
        shift_a = self._make_shift(hours=20, day_offset=0)
        invoice_a = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            self.monday.date(),
            default_status="draft",
        )

        # Shift B on Wednesday (22h), invoice_B is its single-day draft
        # B's breakdown sees A as prior → cumulative 42 > 40 → 20 base + 2 OT1
        shift_b = self._make_shift(hours=22, day_offset=2)
        invoice_b = Invoice.generate_for_staff_period(
            self.staff,
            (self.monday + timedelta(days=2)).date(),
            (self.monday + timedelta(days=2)).date(),
            default_status="draft",
        )
        ot_before = sum(
            (i.hours_worked for i in invoice_b.items.filter(item_type="overtime_1")),
            start=Decimal("0"),
        )
        self.assertEqual(ot_before, Decimal("2"))

        # Manager corrects shift A down to 10h. Cumulative becomes 32 < 40.
        # B should no longer have any OT.
        TimeAdjustment.objects.create(
            shift=shift_a,
            original_check_in_time=shift_a.check_in_time,
            original_check_out_time=shift_a.check_out_time,
            original_actual_hours=Decimal("20.00"),
            adjusted_check_in_time=shift_a.check_in_time,
            adjusted_check_out_time=shift_a.check_in_time + timedelta(hours=10),
            adjusted_actual_hours=Decimal("10.00"),
            reason="Recorded too many hours",
            manager_signature="sig",
            adjusted_by=self.staff,
        )

        invoice_b.refresh_from_db()
        ot_after = sum(
            (i.hours_worked for i in invoice_b.items.filter(item_type="overtime_1")),
            start=Decimal("0"),
        )
        self.assertEqual(ot_after, Decimal("0"))
        # B's base hours should now be the full 22
        base_after = sum(
            (i.hours_worked for i in invoice_b.items.filter(item_type="shift")),
            start=Decimal("0"),
        )
        self.assertEqual(base_after, Decimal("22"))

    def test_time_adjustment_writes_through_to_shift(self):
        """P3.1 (C4 fix): TimeAdjustment must update the Shift's check-in/out
        and actual_hours_worked even when the Shift already has those values
        populated. Previously the sync guard 'not shift.check_in_time' meant
        manager corrections never reached the Shift in the common case."""
        from datetime import datetime as _dt
        # Create a shift with populated check-in/out (the normal post-checkout state)
        shift = self._make_shift(hours=6, day_offset=0)
        original_check_in = shift.check_in_time
        original_check_out = shift.check_out_time

        # Manager creates a TimeAdjustment correcting both times
        new_check_in = original_check_in + timedelta(minutes=15)
        new_check_out = original_check_out + timedelta(minutes=30)
        TimeAdjustment.objects.create(
            shift=shift,
            original_check_in_time=original_check_in,
            original_check_out_time=original_check_out,
            original_actual_hours=Decimal("6.00"),
            adjusted_check_in_time=new_check_in,
            adjusted_check_out_time=new_check_out,
            adjusted_actual_hours=Decimal("6.25"),
            reason="Gate scanner outage delayed check-in",
            manager_signature="sig",
            adjusted_by=self.staff,
        )
        shift.refresh_from_db()
        self.assertEqual(shift.check_in_time, new_check_in)
        self.assertEqual(shift.check_out_time, new_check_out)
        # actual_hours_worked is derived in Shift.save() from the times, but
        # the times are now the adjusted values, so the math matches.
        self.assertEqual(shift.actual_hours_worked, Decimal("6.25"))

    def test_adjustment_payload_handles_negative_delta(self):
        """Negative deltas (manager reduced hours) format as '-Nm'."""
        from datetime import datetime as _dt
        shift = self._make_shift(hours=6, day_offset=0)
        adj = TimeAdjustment.objects.create(
            shift=shift,
            original_check_in_time=timezone.make_aware(_dt(2026, 1, 5, 9, 0)),
            original_check_out_time=timezone.make_aware(_dt(2026, 1, 5, 15, 0)),
            original_actual_hours=Decimal("6.00"),
            adjusted_check_in_time=timezone.make_aware(_dt(2026, 1, 5, 9, 0)),
            adjusted_check_out_time=timezone.make_aware(_dt(2026, 1, 5, 14, 30)),
            adjusted_actual_hours=Decimal("5.50"),
            reason="Left early — break overran",
            manager_signature="sig",
            adjusted_by=self.staff,
        )
        payload = _adjustment_payload(adj)
        self.assertEqual(payload["delta"], "-30m")

    def test_get_payment_breakdown_includes_overtime_and_special_buckets(self):
        """P4 (H3 fix): get_payment_breakdown surfaces OT and special-event
        items in its summary. Previously only item_type='shift' was queried,
        so any invoice with OT or special-event line items showed zero in
        per-category buckets even though invoice.total_amount was correct."""
        # Build a week with OT triggering: 20+22 = 42h, threshold 40 → 2h OT1
        self._make_shift(hours=20, day_offset=0)
        self._make_shift(hours=22, day_offset=2)
        invoice = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            (self.monday + timedelta(days=6)).date(),
        )
        bd = invoice.get_payment_breakdown()
        # Both buckets must be present and populated
        self.assertIn("overtime_1", bd)
        self.assertEqual(bd["overtime_1"]["hours"], 2.0)
        self.assertGreater(bd["overtime_1"]["amount"], 0)
        # overtime_2 bucket also present (zero since we didn't trigger tier 2)
        self.assertIn("overtime_2", bd)
        self.assertEqual(bd["overtime_2"]["hours"], 0)
        # Total still matches header
        self.assertEqual(bd["total"]["amount"], float(invoice.total_amount))

    def test_recalculate_from_shifts_picks_up_rate_changes(self):
        """P3.2 (C2 fix verification): recalculate_from_shifts re-emits items
        from the current shift state, so a rate correction applied AFTER the
        invoice was generated propagates when recalculate is called.
        Without this path (or the new /recalculate/ endpoint), rate fixes are
        permanently stuck because of the exact-period idempotency guard."""
        shift = self._make_shift(hours=4, day_offset=0, rate="10.00")
        invoice = Invoice.generate_for_staff_period(
            self.staff, self.monday.date(), self.monday.date(),
        )
        original_total = invoice.total_amount
        self.assertEqual(original_total, Decimal("40.00"))

        # Admin corrects the shift's rate after invoice was generated
        shift.hourly_rate = Decimal("15.00")
        shift.save(update_fields=["hourly_rate"])

        # Calling generate_for_staff_period again would return the stale invoice
        # (idempotency guard). Instead we use recalculate_from_shifts.
        invoice.recalculate_from_shifts()
        invoice.refresh_from_db()
        self.assertEqual(invoice.total_amount, Decimal("60.00"))
        self.assertGreater(invoice.version, 1)

    def test_supersede_only_targets_non_superseded_drafts(self):
        """A draft that's already superseded must not be re-superseded.
        Defensive guard for re-run scenarios."""
        self._make_shift(hours=6, day_offset=0)
        draft = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            self.monday.date(),
            default_status="draft",
        )
        first_period = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            (self.monday + timedelta(days=6)).date(),
        )
        # Manually create a second period invoice covering the same window
        second_period = Invoice.objects.create(
            staff_user=self.staff,
            start_date=self.monday.date(),
            end_date=(self.monday + timedelta(days=6)).date() + timedelta(days=1),
            total_hours=Decimal("0"),
            hourly_rate=Decimal("0"),
            total_amount=Decimal("0"),
            status="pending",
        )
        # The draft should still point to first_period, not second_period
        draft.refresh_from_db()
        self.assertEqual(draft.superseded_by_id, first_period.id)

    def test_invoice_emits_overtime_items_when_threshold_crossed(self):
        """A period that triggers OT produces overtime_1 InvoiceItems with the
        correct overage. P3.5 fixed the algorithm to count only shifts that
        STARTED BEFORE the current one as prior, so the 8h overage above the
        40h threshold is booked exactly once (not 24h across 3 shifts)."""
        self._make_shift(hours=20, day_offset=0)
        self._make_shift(hours=20, day_offset=1)
        self._make_shift(hours=8, day_offset=2)

        invoice = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            (self.monday + timedelta(days=6)).date(),
        )
        ot1_items = invoice.items.filter(item_type="overtime_1")
        self.assertTrue(ot1_items.exists(), "expected overtime_1 items but found none")
        ot1_hours = sum(
            (i.hours_worked for i in ot1_items), start=Decimal("0")
        )
        # Correct: 48h cumulative - 40h threshold = 8h of OT1.
        self.assertEqual(ot1_hours, Decimal("8"))

        # Total invoice money: 40h base @ £10 + 8h @ £10 × 1.5 = £400 + £120 = £520
        self.assertEqual(invoice.total_amount, Decimal("520.00"))

    def test_special_event_emits_special_item_type(self):
        """is_special_event=True → InvoiceItem.item_type='special' (not 'shift')."""
        self._make_shift(hours=6, day_offset=0, special=True)
        invoice = Invoice.generate_for_staff_period(
            self.staff,
            self.monday.date(),
            self.monday.date(),
        )
        special_items = invoice.items.filter(item_type="special")
        shift_items = invoice.items.filter(item_type="shift")
        self.assertTrue(special_items.exists())
        self.assertFalse(shift_items.exists())
