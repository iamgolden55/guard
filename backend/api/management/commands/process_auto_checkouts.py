from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Shift
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Process automatic checkouts for eligible shifts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show eligible shifts without processing them',
        )

    def handle(self, *args, **options):
        """Process shifts eligible for auto-checkout"""
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )

        # Find shifts eligible for auto-checkout
        eligible_shifts = Shift.objects.filter(
            status='in_progress',
            check_out_time__isnull=True,
            auto_checkout=False
        ).select_related('staff_user', 'venue')

        processed_count = 0
        eligible_count = 0

        for shift in eligible_shifts:
            if shift.can_auto_checkout():
                eligible_count += 1
                
                if dry_run:
                    self.stdout.write(
                        f"ELIGIBLE: Shift {shift.id} - {shift.staff_user.username} "
                        f"at {shift.venue.name} (ended {shift.end_time})"
                    )
                else:
                    success = shift.perform_auto_checkout()
                    if success:
                        processed_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"AUTO-CHECKOUT: Shift {shift.id} - {shift.staff_user.username} "
                                f"at {shift.venue.name}"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(
                                f"FAILED: Could not auto-checkout shift {shift.id}"
                            )
                        )

        # Summary
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f"Found {eligible_count} shifts eligible for auto-checkout")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Processed {processed_count} auto-checkouts out of {eligible_count} eligible shifts"
                )
            )
            
            # Log the summary
            logger.info(f"Auto-checkout processing completed: {processed_count}/{eligible_count} shifts processed")