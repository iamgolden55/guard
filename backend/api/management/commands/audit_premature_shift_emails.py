"""
Read-only audit of officers who were emailed about shifts prematurely.

Until this was fixed, ShiftViewSet.perform_create sent "New Shift Assigned"
synchronously on *every* shift create, with no is_published check. Any draft
shift that had an officer attached at creation time emailed that officer
immediately, before the manager published anything.

There is no email log table — EmailNotificationService.send_email only writes
to the application log — so the shift table is the proxy. Cross-check a
specific officer against the API logs for:

    Email sent: user=<id>, type=shift_assignment

This command only reads. It sends nothing and writes nothing.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Shift


class Command(BaseCommand):
    help = "List staff who received premature or duplicate shift-assignment emails (read-only)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--since',
            type=str,
            default=None,
            help='Only consider shifts created on/after this date (YYYY-MM-DD). Default: 30 days ago.',
        )
        parser.add_argument(
            '--company',
            type=int,
            default=None,
            help='Restrict to a single company id (matches venue__company_id).',
        )

    def handle(self, *args, **options):
        since_opt = options.get('since')
        if since_opt:
            parsed = timezone.datetime.strptime(since_opt, '%Y-%m-%d')
            since = timezone.make_aware(parsed)
        else:
            since = timezone.now() - timedelta(days=30)

        qs = (
            Shift.objects
            .filter(created_at__gte=since, staff_user__isnull=False)
            .select_related('venue', 'staff_user')
            .order_by('created_at')
        )
        if options.get('company'):
            qs = qs.filter(venue__company_id=options['company'])

        self.stdout.write(f"Shifts created since {since:%Y-%m-%d} with an officer attached\n")

        # Every draft with an assignee emailed its officer at creation, while
        # the dashboard still showed the shift as a draft. These are the ones
        # that produced a confusing "you've been assigned" message.
        premature = [s for s in qs if not s.is_published]
        self.stdout.write(self.style.WARNING(
            f"\nPREMATURE — draft shifts whose officer was emailed anyway: {len(premature)}"
        ))
        self._dump(premature)

        # A shift created already published emailed twice: once synchronously
        # from perform_create, once queued by the post_save signal.
        duplicated = [s for s in qs if s.is_published]
        self.stdout.write(self.style.WARNING(
            f"\nPOSSIBLE DUPLICATES — shifts created already published "
            f"(emailed once sync + once via signal): {len(duplicated)}"
        ))
        self.stdout.write(
            "  Note: a shift published *after* creation is not in this list — "
            "publishing never sent an email, so those officers got exactly one "
            "(premature) email and are counted above.\n"
        )
        self._dump(duplicated)

        affected = {s.staff_user_id for s in premature} | {s.staff_user_id for s in duplicated}
        self.stdout.write(self.style.NOTICE(
            f"\nDistinct officers affected: {len(affected)}"
        ))

    def _dump(self, shifts):
        if not shifts:
            self.stdout.write("  (none)")
            return
        header = f"  {'id':>7}  {'created':<16}  {'starts':<16}  {'venue':<24}  officer"
        self.stdout.write(header)
        self.stdout.write("  " + "-" * (len(header) - 2))
        for s in shifts:
            officer = s.staff_user
            name = (officer.get_full_name() or officer.username) if officer else '-'
            email = officer.email if officer else '-'
            venue = s.venue.name if s.venue else '-'
            self.stdout.write(
                f"  {s.id:>7}  {s.created_at:%Y-%m-%d %H:%M}  "
                f"{s.start_time:%Y-%m-%d %H:%M}  {venue[:24]:<24}  {name} <{email}>"
            )
