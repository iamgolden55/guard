"""
Management command to find and clean up duplicate shifts in the database.

This command identifies shifts where the same staff member is assigned to
overlapping time windows and provides options to:
1. Report duplicates (dry-run mode)
2. Delete duplicates keeping the oldest shift
3. Cancel duplicates instead of deleting

Usage:
    python manage.py clean_duplicate_shifts                  # Dry-run, report only
    python manage.py clean_duplicate_shifts --delete         # Delete duplicates
    python manage.py clean_duplicate_shifts --cancel         # Cancel duplicates instead
    python manage.py clean_duplicate_shifts --user 20        # Check specific user
    python manage.py clean_duplicate_shifts --venue 5        # Check specific venue
"""

from django.core.management.base import BaseCommand
from django.db.models import Count, Min, Q
from django.utils import timezone
from api.models import Shift, User, Venue
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Find and clean up duplicate/overlapping shifts in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--delete',
            action='store_true',
            help='Actually delete duplicate shifts (default is dry-run)',
        )
        parser.add_argument(
            '--cancel',
            action='store_true',
            help='Cancel duplicate shifts instead of deleting',
        )
        parser.add_argument(
            '--user',
            type=int,
            help='Only check shifts for a specific user ID',
        )
        parser.add_argument(
            '--venue',
            type=int,
            help='Only check shifts at a specific venue ID',
        )
        parser.add_argument(
            '--include-past',
            action='store_true',
            help='Include past shifts in the check (default: future shifts only)',
        )

    def handle(self, *args, **options):
        dry_run = not (options['delete'] or options['cancel'])
        cancel_mode = options['cancel']
        user_id = options['user']
        venue_id = options['venue']
        include_past = options['include_past']

        if dry_run:
            self.stdout.write(self.style.WARNING(
                'DRY-RUN MODE: No changes will be made. Use --delete or --cancel to make changes.'
            ))

        # Find exact duplicates (same staff, venue, start_time, end_time)
        exact_duplicates = self.find_exact_duplicates(user_id, venue_id, include_past)

        # Find overlapping shifts (same staff, overlapping time windows)
        overlapping_shifts = self.find_overlapping_shifts(user_id, venue_id, include_past)

        total_issues = len(exact_duplicates) + len(overlapping_shifts)

        if total_issues == 0:
            self.stdout.write(self.style.SUCCESS('No duplicate or overlapping shifts found!'))
            return

        self.stdout.write(self.style.ERROR(f'\nFound {total_issues} issues:'))
        self.stdout.write(f'  - {len(exact_duplicates)} exact duplicates')
        self.stdout.write(f'  - {len(overlapping_shifts)} overlapping shifts')

        # Report exact duplicates
        if exact_duplicates:
            self.stdout.write(self.style.WARNING('\n=== EXACT DUPLICATES ==='))
            for dup in exact_duplicates:
                self.report_exact_duplicate(dup)

        # Report overlapping shifts
        if overlapping_shifts:
            self.stdout.write(self.style.WARNING('\n=== OVERLAPPING SHIFTS ==='))
            for overlap in overlapping_shifts:
                self.report_overlap(overlap)

        if not dry_run:
            # Handle exact duplicates
            deleted_count = 0
            cancelled_count = 0

            for dup in exact_duplicates:
                shifts_to_remove = Shift.objects.filter(
                    id__in=dup['duplicate_ids']
                )

                if cancel_mode:
                    count = shifts_to_remove.update(status='cancelled')
                    cancelled_count += count
                else:
                    count, _ = shifts_to_remove.delete()
                    deleted_count += count

            # For overlapping shifts, we cancel/delete the newer ones
            for overlap in overlapping_shifts:
                newer_shift = Shift.objects.filter(id=overlap['newer_shift_id']).first()
                if newer_shift:
                    if cancel_mode:
                        newer_shift.status = 'cancelled'
                        newer_shift.save()
                        cancelled_count += 1
                    else:
                        newer_shift.delete()
                        deleted_count += 1

            if cancel_mode:
                self.stdout.write(self.style.SUCCESS(f'\nCancelled {cancelled_count} shifts'))
            else:
                self.stdout.write(self.style.SUCCESS(f'\nDeleted {deleted_count} shifts'))

            logger.info(
                f"clean_duplicate_shifts: Processed {total_issues} issues. "
                f"Deleted: {deleted_count}, Cancelled: {cancelled_count}"
            )

    def find_exact_duplicates(self, user_id=None, venue_id=None, include_past=False):
        """Find exact duplicate shifts (same staff, venue, start_time, end_time)"""

        # Build base filter
        filters = Q(staff_user__isnull=False)
        if not include_past:
            filters &= Q(start_time__gte=timezone.now())
        if user_id:
            filters &= Q(staff_user_id=user_id)
        if venue_id:
            filters &= Q(venue_id=venue_id)

        # Exclude cancelled shifts
        filters &= ~Q(status='cancelled')

        # Find duplicate combinations
        duplicates = Shift.objects.filter(filters).values(
            'staff_user', 'venue', 'start_time', 'end_time'
        ).annotate(
            count=Count('id'),
            min_id=Min('id')  # Keep the oldest
        ).filter(count__gt=1)

        results = []
        for dup in duplicates:
            # Get all shifts for this combination except the oldest
            duplicate_shifts = Shift.objects.filter(
                staff_user_id=dup['staff_user'],
                venue_id=dup['venue'],
                start_time=dup['start_time'],
                end_time=dup['end_time']
            ).exclude(
                id=dup['min_id']
            ).exclude(
                status='cancelled'
            )

            if duplicate_shifts.exists():
                staff = User.objects.get(id=dup['staff_user'])
                venue = Venue.objects.get(id=dup['venue'])

                results.append({
                    'staff_user': staff,
                    'venue': venue,
                    'start_time': dup['start_time'],
                    'end_time': dup['end_time'],
                    'count': dup['count'],
                    'keep_id': dup['min_id'],
                    'duplicate_ids': list(duplicate_shifts.values_list('id', flat=True)),
                    'duplicate_shifts': list(duplicate_shifts),
                })

        return results

    def find_overlapping_shifts(self, user_id=None, venue_id=None, include_past=False):
        """Find overlapping shifts for the same staff member (different time windows that overlap)"""

        # Build base filter for users to check
        user_filter = Q()
        if user_id:
            user_filter = Q(id=user_id)

        # Get users with assigned shifts
        users_with_shifts = User.objects.filter(
            shifts__isnull=False
        ).filter(user_filter).distinct()

        results = []

        for user in users_with_shifts:
            # Get all non-cancelled shifts for this user
            shift_filter = Q(staff_user=user) & ~Q(status='cancelled')
            if not include_past:
                shift_filter &= Q(start_time__gte=timezone.now())
            if venue_id:
                shift_filter &= Q(venue_id=venue_id)

            shifts = list(Shift.objects.filter(shift_filter).order_by('start_time', 'id'))

            # Check for overlaps between different shifts
            for i, shift_a in enumerate(shifts):
                # Skip shifts with missing times
                if not shift_a.start_time or not shift_a.end_time:
                    continue

                for shift_b in shifts[i+1:]:
                    # Skip shifts with missing times
                    if not shift_b.start_time or not shift_b.end_time:
                        continue
                    # Skip exact duplicates (handled separately)
                    if (shift_a.start_time == shift_b.start_time and
                        shift_a.end_time == shift_b.end_time and
                        shift_a.venue_id == shift_b.venue_id):
                        continue

                    # Check for overlap: A starts before B ends AND A ends after B starts
                    if shift_a.start_time < shift_b.end_time and shift_a.end_time > shift_b.start_time:
                        # Determine which is newer (by ID or created_at)
                        newer_shift = shift_b if shift_b.id > shift_a.id else shift_a
                        older_shift = shift_a if shift_b.id > shift_a.id else shift_b

                        results.append({
                            'staff_user': user,
                            'older_shift': older_shift,
                            'newer_shift': newer_shift,
                            'older_shift_id': older_shift.id,
                            'newer_shift_id': newer_shift.id,
                        })

        return results

    def report_exact_duplicate(self, dup):
        """Print details about an exact duplicate"""
        self.stdout.write(f"\n  Staff: {dup['staff_user'].get_full_name() or dup['staff_user'].username}")
        self.stdout.write(f"  Venue: {dup['venue'].name}")
        self.stdout.write(f"  Time: {dup['start_time']} - {dup['end_time']}")
        self.stdout.write(f"  Count: {dup['count']} duplicates")
        self.stdout.write(f"  Keeping shift ID: {dup['keep_id']}")
        self.stdout.write(f"  Removing shift IDs: {dup['duplicate_ids']}")

    def report_overlap(self, overlap):
        """Print details about overlapping shifts"""
        self.stdout.write(f"\n  Staff: {overlap['staff_user'].get_full_name() or overlap['staff_user'].username}")
        self.stdout.write(f"  Shift A (keeping): ID {overlap['older_shift'].id}")
        self.stdout.write(f"    Venue: {overlap['older_shift'].venue.name if overlap['older_shift'].venue else 'N/A'}")
        self.stdout.write(f"    Time: {overlap['older_shift'].start_time} - {overlap['older_shift'].end_time}")
        self.stdout.write(f"  Shift B (removing): ID {overlap['newer_shift'].id}")
        self.stdout.write(f"    Venue: {overlap['newer_shift'].venue.name if overlap['newer_shift'].venue else 'N/A'}")
        self.stdout.write(f"    Time: {overlap['newer_shift'].start_time} - {overlap['newer_shift'].end_time}")
