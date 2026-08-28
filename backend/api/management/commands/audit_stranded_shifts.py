"""
Read-only report on shifts that were never checked out, and why auto-checkout
left them alone.

Auto-checkout runs every 5 minutes and closes a shift at its scheduled end, so
an officer forgetting to sign out should be self-healing. When it isn't, a
manager has to close the shift by hand — and until that happens the shift can't
be approved and its hours never reach payroll.

can_auto_checkout() gates on `status == 'in_progress'`, which is the weak link:
several write paths save with update_fields and drop Shift.save()'s in-memory
status flip, so a shift can carry a real check_in_time while its status still
reads 'scheduled'. That shift is invisible to the job forever.

This command only reads. It closes nothing and writes nothing.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Shift, SystemSettings


class Command(BaseCommand):
    help = "Report shifts stuck without a check-out, and which gate blocked auto-checkout (read-only)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--since',
            type=str,
            default=None,
            help='Only consider shifts starting on/after this date (YYYY-MM-DD). Default: 30 days ago.',
        )
        parser.add_argument(
            '--company',
            type=int,
            default=None,
            help='Restrict to a single company id (matches venue__company_id).',
        )

    def handle(self, *args, **options):
        now = timezone.now()

        since_opt = options.get('since')
        if since_opt:
            parsed = timezone.datetime.strptime(since_opt, '%Y-%m-%d')
            since = timezone.make_aware(parsed)
        else:
            since = now - timedelta(days=30)

        try:
            settings = SystemSettings.get_settings()
            enabled = settings.auto_checkout_enabled
            grace = settings.auto_checkout_grace_period
        except Exception as e:
            enabled, grace = None, 30
            self.stdout.write(self.style.ERROR(f"Could not read SystemSettings: {e}"))

        self.stdout.write(f"auto_checkout_enabled = {enabled}")
        self.stdout.write(f"auto_checkout_grace_period = {grace} min\n")
        if enabled is False:
            self.stdout.write(self.style.ERROR(
                "Auto-checkout is switched off system-wide — that alone explains every row below."
            ))

        qs = (
            Shift.objects
            .filter(
                start_time__gte=since,
                check_in_time__isnull=False,
                check_out_time__isnull=True,
                end_time__lt=now - timedelta(minutes=grace),
            )
            .exclude(status__in=['cancelled', 'no_show', 'rejected'])
            .select_related('venue', 'staff_user')
            .order_by('start_time')
        )
        if options.get('company'):
            qs = qs.filter(venue__company_id=options['company'])

        shifts = list(qs)
        self.stdout.write(
            f"Shifts checked in but never checked out, past their end + grace: {len(shifts)}\n"
        )
        if not shifts:
            self.stdout.write("  (none)")
            return

        buckets = {}
        for s in shifts:
            buckets.setdefault(self._blocked_by(s), []).append(s)

        for reason in sorted(buckets, key=lambda r: -len(buckets[r])):
            rows = buckets[reason]
            self.stdout.write(self.style.WARNING(f"\n{reason}: {len(rows)}"))
            self._dump(rows)

        overnight = [
            s for s in shifts
            if s.end_time and s.start_time
            and timezone.localtime(s.end_time).date() > timezone.localtime(s.start_time).date()
        ]
        self.stdout.write(self.style.NOTICE(
            f"\nOf those, {len(overnight)} ran past midnight — the ones a manager "
            f"also couldn't close by hand before the Attendance editor was fixed."
        ))

    def _blocked_by(self, shift):
        """Which can_auto_checkout() gate rejected this shift."""
        if shift.status != 'in_progress':
            return (
                f"status is '{shift.status}', not 'in_progress' "
                f"— invisible to auto-checkout despite a recorded check-in"
            )
        if not shift.end_time:
            return "no scheduled end_time to check out at"
        try:
            if shift.can_auto_checkout():
                return "eligible now — auto-checkout should close it on the next run"
        except Exception as e:
            return f"can_auto_checkout() raised: {e}"
        return "venue-required checks incomplete, and not yet past the force-timeout threshold"

    def _dump(self, shifts):
        header = f"  {'id':>7}  {'starts':<16}  {'ends':<16}  {'venue':<24}  officer"
        self.stdout.write(header)
        self.stdout.write("  " + "-" * (len(header) - 2))
        for s in shifts[:40]:
            officer = s.staff_user
            name = (officer.get_full_name() or officer.username) if officer else '-'
            venue = s.venue.name if s.venue else '-'
            end = f"{timezone.localtime(s.end_time):%Y-%m-%d %H:%M}" if s.end_time else '-'
            self.stdout.write(
                f"  {s.id:>7}  {timezone.localtime(s.start_time):%Y-%m-%d %H:%M}  "
                f"{end:<16}  {venue[:24]:<24}  {name}"
            )
        if len(shifts) > 40:
            self.stdout.write(f"  … and {len(shifts) - 40} more")
