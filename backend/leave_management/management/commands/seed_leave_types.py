"""Seed the five default LeaveType rows.

Production-safe: creates LeaveTypes only, idempotent via get_or_create.
Run after a fresh deploy or when onboarding a fresh database:

    python manage.py seed_leave_types

LeaveType is a global table (not company-scoped today), so this only
needs to run once per environment.
"""

from django.core.management.base import BaseCommand
from leave_management.models import LeaveType


DEFAULTS = [
    {'name': 'Annual Leave', 'code': 'AL', 'color_code': '#0078d4',
     'requires_approval': True, 'max_consecutive_days': 20, 'min_notice_days': 1},
    {'name': 'Sick Leave', 'code': 'SL', 'color_code': '#d13438',
     'requires_approval': True, 'max_consecutive_days': 20, 'min_notice_days': 0},
    {'name': 'Personal Leave', 'code': 'PL', 'color_code': '#00a599',
     'requires_approval': True, 'max_consecutive_days': 5, 'min_notice_days': 1},
    {'name': 'Unpaid Leave', 'code': 'UL', 'color_code': '#666666',
     'requires_approval': True, 'max_consecutive_days': 30, 'min_notice_days': 7},
    {'name': 'Bereavement Leave', 'code': 'BL', 'color_code': '#8a8a8a',
     'requires_approval': True, 'max_consecutive_days': 5, 'min_notice_days': 0},
]


class Command(BaseCommand):
    help = "Create the 5 default LeaveType rows (Annual / Sick / Personal / Unpaid / Bereavement)."

    def handle(self, *args, **options):
        created_count = 0
        existed_count = 0
        for data in DEFAULTS:
            obj, created = LeaveType.objects.get_or_create(
                code=data['code'],
                defaults={
                    'name': data['name'],
                    'color_code': data['color_code'],
                    'is_active': True,
                    'requires_approval': data['requires_approval'],
                    'max_consecutive_days': data['max_consecutive_days'],
                    'min_notice_days': data['min_notice_days'],
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  created: {obj.name} ({obj.code})'))
            else:
                existed_count += 1
                self.stdout.write(f'  exists:  {obj.name} ({obj.code})')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {created_count} created, {existed_count} already existed.'
        ))
