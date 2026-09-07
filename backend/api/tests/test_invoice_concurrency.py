"""
Duplicate invoice generation — P1-1.

Three gaps compound. `Invoice` had no unique constraint on
`(staff_user, start_date, end_date)` — confirmed across every migration in
`api/migrations/`. `generate_for_staff_period` does check-then-create with no
lock, and its own docstring acknowledged the race as known and unfixed.
`payroll_generate` loops staff doing the same check-then-create with no
enclosing `atomic`, and `auto_generate_invoice()` fires on every shift
approval, so bulk approval multiplies the window.

Two concurrent calls that both pass the existence check before either inserts
both create an invoice for the same period. That is double payment.

`TransactionTestCase` is required: `TestCase` wraps each test in a single
transaction, so the threads below would not see each other's writes and the
race would not be exercised at all.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone

from api.models import Invoice, SecurityCompany, Shift, UserCompanyMembership, Venue

User = get_user_model()


class InvoiceGenerationConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Race Co", registration_number="RACE001",
        )
        self.staff = User.objects.create_user(
            username="race_staff", email="race@test.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=self.staff, company=self.company, is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Race Venue", address="1 Race St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="Contact", contact_phone="07700900000",
            contact_email="race@venue.test", terms_and_conditions="Terms",
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
        self.shift.status = "approved"
        self.shift.save()
        # `auto_generate_invoice` fires on approval; clear it so the race below
        # starts from nothing.
        Invoice.objects.all().delete()

        self.start_date = start.date() - timedelta(days=1)
        self.end_date = start.date() + timedelta(days=1)

    def tearDown(self):
        for conn in connections.all():
            conn.close()

    def _generate(self):
        try:
            return Invoice.generate_for_staff_period(
                staff_user=self.staff,
                start_date=self.start_date,
                end_date=self.end_date,
            )
        finally:
            connection.close()

    def test_two_concurrent_generations_produce_one_invoice(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self._generate) for _ in range(2)]
            results = []
            for future in futures:
                # Neither call may raise: a race must be a no-op for the loser,
                # not a 500 for whichever manager clicked second.
                results.append(future.result())

        live = Invoice.objects.filter(
            staff_user=self.staff,
            start_date=self.start_date,
            end_date=self.end_date,
            superseded_by__isnull=True,
        )
        self.assertEqual(
            live.count(), 1,
            f"expected exactly one invoice, found {live.count()} — double payment",
        )
        self.assertTrue(all(r is not None for r in results))
        self.assertEqual(len({r.pk for r in results}), 1, "callers saw different invoices")

    def test_regenerating_an_existing_period_is_a_no_op(self):
        first = self._generate()
        second = self._generate()

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(
            Invoice.objects.filter(
                staff_user=self.staff, superseded_by__isnull=True,
            ).count(),
            1,
        )

    def test_the_database_refuses_a_duplicate_outright(self):
        """The constraint is the backstop, independent of application code."""
        from django.db.utils import IntegrityError

        self._generate()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Invoice.objects.create(
                    staff_user=self.staff,
                    start_date=self.start_date,
                    end_date=self.end_date,
                    total_hours=Decimal("8.00"),
                    hourly_rate=Decimal("15.00"),
                    total_amount=Decimal("120.00"),
                    status="pending",
                )

    def test_a_superseded_invoice_does_not_block_a_reissue(self):
        """The constraint is partial — resolved invoices stay out of its way."""
        original = self._generate()

        # Supersede the original, then a fresh invoice for the same period must
        # be allowed — this is the credit-note / reissue path.
        replacement = Invoice.objects.create(
            staff_user=self.staff,
            start_date=self.start_date,
            end_date=self.end_date + timedelta(days=7),
            total_hours=Decimal("0.00"),
            hourly_rate=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            status="pending",
        )
        original.superseded_by = replacement
        original.save(update_fields=["superseded_by"])

        reissued = Invoice.objects.create(
            staff_user=self.staff,
            start_date=self.start_date,
            end_date=self.end_date,
            total_hours=Decimal("8.00"),
            hourly_rate=Decimal("15.00"),
            total_amount=Decimal("120.00"),
            status="pending",
        )
        self.assertIsNotNone(reissued.pk)


class ShiftOverlapConstraintTests(TransactionTestCase):
    """P1-4 — an officer cannot be in two places at once.

    Migration 0006 added a unique constraint on shifts, 0007 replaced it, and
    0008 removed it entirely. Since then the table has carried no uniqueness
    of any kind, and `bulk_create` runs its conflict detection *outside* the
    `atomic()` block that does the inserts, re-checking nothing inside — a
    textbook TOCTOU. Two managers scheduling concurrently could double-book
    one person, and nothing at any layer would notice.

    The fix is a Postgres exclusion constraint over `(staff_user, [start, end))`,
    which is the database's own expression of the rule and holds regardless of
    which code path inserts.
    """
    reset_sequences = True

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Overlap Co", registration_number="OVER001",
        )
        self.staff = User.objects.create_user(
            username="overlap_staff", email="overlap@test.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=self.staff, company=self.company, is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Overlap Venue", address="1 Over St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="Contact", contact_phone="07700900000",
            contact_email="over@venue.test", terms_and_conditions="Terms",
        )
        self.start = (timezone.now() + timedelta(days=3)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )

    def tearDown(self):
        for conn in connections.all():
            conn.close()

    def _shift(self, offset_hours=0, length=8, **overrides):
        start = self.start + timedelta(hours=offset_hours)
        defaults = dict(
            venue=self.venue, staff_user=self.staff, start_time=start,
            end_time=start + timedelta(hours=length), status="scheduled",
            required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )
        defaults.update(overrides)
        return Shift.objects.create(**defaults)

    def test_an_overlapping_assignment_is_refused_by_the_database(self):
        from django.db.utils import IntegrityError

        self._shift()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._shift(offset_hours=4)

    def test_back_to_back_shifts_are_allowed(self):
        """The range is half-open: 09:00–17:00 and 17:00–01:00 do not clash."""
        first = self._shift()
        second = self._shift(offset_hours=8)

        self.assertIsNotNone(second.pk)
        self.assertEqual(second.start_time, first.end_time)

    def test_a_cancelled_shift_frees_the_window(self):
        """A released officer must be free to take another shift that day."""
        original = self._shift()
        original.status = "cancelled"
        original.save()

        replacement = self._shift(offset_hours=2)

        self.assertIsNotNone(replacement.pk)

    def test_two_officers_may_work_the_same_window(self):
        colleague = User.objects.create_user(
            username="overlap_colleague", email="colleague@test.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=colleague, company=self.company, is_active=True,
        )

        self._shift()
        theirs = self._shift(staff_user=colleague)

        self.assertIsNotNone(theirs.pk)

    def test_unassigned_open_shifts_may_overlap_freely(self):
        """Open slots are not commitments — a venue can advertise many."""
        self._shift(staff_user=None, status="open")
        second = self._shift(staff_user=None, status="open", offset_hours=1)

        self.assertIsNotNone(second.pk)
