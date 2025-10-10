from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import random

from leave_management.models import LeaveType, LeaveRequest

User = get_user_model()


class Command(BaseCommand):
    help = 'Create test leave request data for analytics testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=50,
            help='Number of leave requests to create (default: 50)'
        )
        parser.add_argument(
            '--year',
            type=int,
            default=2025,
            help='Year to create requests for (default: 2025)'
        )

    def handle(self, *args, **options):
        count = options['count']
        year = options['year']

        self.stdout.write(f'Creating {count} test leave requests for year {year}...')

        # Get or create leave types
        leave_types = self._ensure_leave_types()
        if not leave_types:
            self.stdout.write(self.style.ERROR('Failed to create leave types'))
            return

        # Get or create test users
        users = self._ensure_test_users()
        if not users:
            self.stdout.write(self.style.ERROR('Failed to create test users'))
            return

        # Create leave requests
        created_count = 0
        statuses = ['approved', 'pending', 'rejected', 'cancelled']
        status_weights = [60, 20, 15, 5]  # 60% approved, 20% pending, etc.

        for i in range(count):
            user = random.choice(users)
            leave_type = random.choice(leave_types)
            status = random.choices(statuses, weights=status_weights)[0]

            # Random month in the year
            month = random.randint(1, 12)
            day = random.randint(1, 28)  # Safe day for all months

            # Random duration 1-10 days
            duration = random.randint(1, 10)

            start_date = datetime(year, month, day).date()
            end_date = start_date + timedelta(days=duration - 1)

            # Create leave request
            leave_request = LeaveRequest.objects.create(
                staff_user=user,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                days_requested=Decimal(str(duration)),
                status=status,
                reason=f'Test leave request #{i+1}',
                created_at=timezone.make_aware(datetime(year, month, day, random.randint(0, 23), random.randint(0, 59)))
            )

            # If approved, add approval details
            if status == 'approved':
                leave_request.approved_by = User.objects.filter(is_staff=True).first()
                leave_request.approval_date = leave_request.created_at + timedelta(hours=random.randint(1, 48))
                leave_request.approval_notes = f'Approved - test request'
                leave_request.save()

            elif status == 'rejected':
                leave_request.approved_by = User.objects.filter(is_staff=True).first()
                leave_request.approval_date = leave_request.created_at + timedelta(hours=random.randint(1, 24))
                leave_request.approval_notes = f'Rejected - test request'
                leave_request.save()

            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} test leave requests for {year}')
        )

    def _ensure_leave_types(self):
        """Ensure leave types exist"""
        leave_type_data = [
            {'name': 'Annual Leave', 'code': 'AL', 'color_code': '#0078d4'},
            {'name': 'Sick Leave', 'code': 'SL', 'color_code': '#d13438'},
            {'name': 'Personal Leave', 'code': 'PL', 'color_code': '#00a599'},
            {'name': 'Unpaid Leave', 'code': 'UL', 'color_code': '#666666'},
            {'name': 'Bereavement Leave', 'code': 'BL', 'color_code': '#8a8a8a'},
        ]

        leave_types = []
        for data in leave_type_data:
            leave_type, created = LeaveType.objects.get_or_create(
                code=data['code'],
                defaults={
                    'name': data['name'],
                    'color_code': data['color_code'],
                    'is_active': True,
                    'requires_approval': True,
                    'max_consecutive_days': 20,
                    'min_notice_days': 1
                }
            )
            leave_types.append(leave_type)
            if created:
                self.stdout.write(f'  Created leave type: {leave_type.name}')

        return leave_types

    def _ensure_test_users(self):
        """Ensure test users exist"""
        users = []

        # Get existing users or create test users
        existing_users = User.objects.filter(is_active=True)[:10]

        if existing_users.count() >= 5:
            return list(existing_users)

        # Create test users if needed
        for i in range(10):
            username = f'testuser{i+1}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@example.com',
                    'first_name': f'Test',
                    'last_name': f'User {i+1}',
                    'is_active': True,
                    'is_staff': i == 0  # First user is staff
                }
            )
            if created:
                user.set_password('testpass123')
                user.save()
                self.stdout.write(f'  Created user: {user.username}')
            users.append(user)

        return users
