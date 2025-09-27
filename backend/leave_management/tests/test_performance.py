"""
Performance tests for Leave Management System
Created by django-orm-expert agent for query optimization validation
"""
import time
import random
from decimal import Decimal
from datetime import date, datetime, timedelta

from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import override_settings
from django.db import connection, reset_queries
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.management import call_command

from leave_management.models import (
    LeaveType, LeavePolicy, LeaveRequest, LeaveBalance, BlackoutPeriod
)
from leave_management.utils import LeaveBalanceOptimizer, LeaveReportGenerator
from api.models import StaffProfile, EmploymentType

User = get_user_model()


class LeaveManagementPerformanceTest(TransactionTestCase):
    """Test performance optimizations for leave management queries"""

    def setUp(self):
        """Set up test data for performance testing"""
        # Create employment type
        self.employment_type = EmploymentType.objects.create(
            name="Full-time Staff",
            description="Full-time security staff"
        )

        # Create leave types
        self.annual_leave = LeaveType.objects.create(
            name="Annual Leave",
            code="AL",
            color_code="#007bff"
        )
        self.sick_leave = LeaveType.objects.create(
            name="Sick Leave",
            code="SL",
            color_code="#dc3545"
        )

        # Create leave policies
        self.annual_policy = LeavePolicy.objects.create(
            name="Standard Annual Leave",
            leave_type=self.annual_leave,
            accrual_method='monthly',
            accrual_rate=Decimal('2.08'),  # 25 days per year
            max_accrual_per_year=Decimal('25.00')
        )
        self.annual_policy.employment_types.set([self.employment_type])

        self.sick_policy = LeavePolicy.objects.create(
            name="Standard Sick Leave",
            leave_type=self.sick_leave,
            accrual_method='annual',
            accrual_rate=Decimal('10.00')
        )
        self.sick_policy.employment_types.set([self.employment_type])

        # Create test users with profiles (simulate team of 50)
        self.test_users = []
        for i in range(50):
            user = User.objects.create_user(
                username=f'teststaff{i:03d}',
                email=f'teststaff{i:03d}@example.com',
                first_name=f'Test{i:03d}',
                last_name='Staff',
                role='staff'
            )

            # Create staff profile
            StaffProfile.objects.create(
                user=user,
                employment_type=self.employment_type,
                phone_number=f'+44123456{i:04d}',
                date_of_birth=date(1985, 1, 1) + timedelta(days=i*30),
                street=f'{i} Test Street',
                city='London',
                postal_code=f'SW1 {i%10}AA',
                country='UK',
                is_approved=True
            )

            self.test_users.append(user)

        # Create leave balances for current year
        current_year = timezone.now().year
        for user in self.test_users:
            # Annual leave balance
            LeaveBalance.objects.create(
                staff_user=user,
                leave_type=self.annual_leave,
                year=current_year,
                opening_balance=Decimal('25.00'),
                accrued_balance=Decimal(str(random.uniform(0, 10))),
                used_balance=Decimal(str(random.uniform(0, 15))),
                pending_balance=Decimal(str(random.uniform(0, 3)))
            )

            # Sick leave balance
            LeaveBalance.objects.create(
                staff_user=user,
                leave_type=self.sick_leave,
                year=current_year,
                opening_balance=Decimal('10.00'),
                accrued_balance=Decimal('0.00'),
                used_balance=Decimal(str(random.uniform(0, 5))),
                pending_balance=Decimal('0.00')
            )

        # Create sample leave requests (100 requests across all users)
        start_date = date.today() - timedelta(days=30)
        for i in range(100):
            user = random.choice(self.test_users)
            leave_type = random.choice([self.annual_leave, self.sick_leave])
            request_start = start_date + timedelta(days=random.randint(0, 60))
            days = random.randint(1, 5)

            LeaveRequest.objects.create(
                staff_user=user,
                leave_type=leave_type,
                start_date=request_start,
                end_date=request_start + timedelta(days=days-1),
                days_requested=Decimal(str(days)),
                reason="Test leave request",
                status=random.choice(['pending', 'approved', 'rejected']),
                submitted_at=timezone.now() - timedelta(days=random.randint(1, 30))
            )

        # Create blackout periods
        BlackoutPeriod.objects.create(
            name="Christmas Period",
            start_date=date(current_year, 12, 23),
            end_date=date(current_year, 12, 31),
            restriction_level='limit_percentage',
            max_staff_percentage=25
        )

    @override_settings(DEBUG=True)
    def test_team_overview_query_performance(self):
        """Test optimized team overview queries"""
        reset_queries()

        # Get team user IDs
        team_user_ids = [user.id for user in self.test_users[:20]]

        start_time = time.time()

        # Test optimized team overview query
        requests = LeaveRequest.objects.team_overview_requests(
            team_user_ids=team_user_ids,
            status_filter='pending'
        )

        # Force evaluation
        list(requests)

        end_time = time.time()
        query_time = end_time - start_time
        query_count = len(connection.queries)

        print(f"\nTeam Overview Performance:")
        print(f"  Query time: {query_time:.3f}s")
        print(f"  Query count: {query_count}")
        print(f"  Users processed: {len(team_user_ids)}")

        # Performance assertions
        self.assertLess(query_time, 0.1, "Team overview query should complete in <100ms")
        self.assertLess(query_count, 5, "Should use minimal queries with proper prefetching")

    @override_settings(DEBUG=True)
    def test_leave_balance_bulk_operations(self):
        """Test bulk leave balance operations performance"""
        reset_queries()

        start_time = time.time()

        # Test bulk balance creation
        optimizer = LeaveBalanceOptimizer()
        created_count = optimizer.bulk_create_annual_balances(
            year=2025,
            user_ids=[user.id for user in self.test_users[:10]]
        )

        end_time = time.time()
        query_time = end_time - start_time
        query_count = len(connection.queries)

        print(f"\nBulk Balance Creation Performance:")
        print(f"  Query time: {query_time:.3f}s")
        print(f"  Query count: {query_count}")
        print(f"  Balances created: {created_count}")

        # Should be efficient bulk operation
        self.assertLess(query_time, 0.5, "Bulk creation should complete in <500ms")
        self.assertGreater(created_count, 0, "Should create balances for eligible users")

    @override_settings(DEBUG=True)
    def test_calendar_query_performance(self):
        """Test calendar view query optimization"""
        reset_queries()

        # Date range for calendar (30 days)
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        start_time = time.time()

        # Test optimized calendar query
        events = LeaveRequest.objects.calendar_events(
            start_date=start_date,
            end_date=end_date,
            user_ids=[user.id for user in self.test_users[:20]]
        )

        # Force evaluation
        event_list = list(events)

        end_time = time.time()
        query_time = end_time - start_time
        query_count = len(connection.queries)

        print(f"\nCalendar Query Performance:")
        print(f"  Query time: {query_time:.3f}s")
        print(f"  Query count: {query_count}")
        print(f"  Events found: {len(event_list)}")

        # Calendar queries should be fast with proper indexing
        self.assertLess(query_time, 0.05, "Calendar query should complete in <50ms")
        self.assertLess(query_count, 3, "Should use efficient date range index")

    @override_settings(DEBUG=True)
    def test_reports_aggregation_performance(self):
        """Test leave reports aggregation performance"""
        reset_queries()

        start_time = time.time()

        # Test optimized aggregation query
        stats = LeaveRequest.objects.usage_statistics(
            year=timezone.now().year,
            user_ids=[user.id for user in self.test_users]
        )

        end_time = time.time()
        query_time = end_time - start_time
        query_count = len(connection.queries)

        print(f"\nReports Aggregation Performance:")
        print(f"  Query time: {query_time:.3f}s")
        print(f"  Query count: {query_count}")
        print(f"  Total requests: {stats.get('total_requests', 0)}")
        print(f"  Total days: {stats.get('total_days_taken', 0)}")

        # Aggregation should be efficient with proper indexes
        self.assertLess(query_time, 0.2, "Aggregation query should complete in <200ms")
        self.assertEqual(query_count, 1, "Should use single optimized aggregation query")
        self.assertIsNotNone(stats.get('total_requests'), "Should return aggregated data")

    def test_blackout_period_overlap_detection(self):
        """Test blackout period overlap detection performance"""
        # Create a leave request that overlaps with blackout period
        test_request = LeaveRequest(
            staff_user=self.test_users[0],
            leave_type=self.annual_leave,
            start_date=date(timezone.now().year, 12, 20),
            end_date=date(timezone.now().year, 12, 27),
            days_requested=Decimal('5.00'),
            reason="Christmas holiday",
            status='pending'
        )

        start_time = time.time()

        # Test optimized overlap detection
        overlapping_periods = BlackoutPeriod.objects.overlapping_with_request(test_request)
        period_list = list(overlapping_periods)

        end_time = time.time()
        query_time = end_time - start_time

        print(f"\nBlackout Overlap Detection Performance:")
        print(f"  Query time: {query_time:.3f}s")
        print(f"  Overlapping periods: {len(period_list)}")

        # Should find the Christmas period overlap
        self.assertEqual(len(period_list), 1, "Should detect Christmas period overlap")
        self.assertLess(query_time, 0.02, "Overlap detection should be very fast")

    def test_team_utilization_report_performance(self):
        """Test team utilization report generation performance"""
        team_user_ids = [user.id for user in self.test_users[:20]]

        start_time = time.time()

        # Generate comprehensive utilization report
        report_generator = LeaveReportGenerator()
        report = report_generator.team_utilization_report(
            team_user_ids=team_user_ids,
            year=timezone.now().year
        )

        end_time = time.time()
        query_time = end_time - start_time

        print(f"\nTeam Utilization Report Performance:")
        print(f"  Query time: {query_time:.3f}s")
        print(f"  Team members: {len(team_user_ids)}")
        print(f"  Report generated: {report.get('team_count', 0)} records")

        # Complex report should still be reasonable
        self.assertLess(query_time, 1.0, "Complex report should complete in <1s")
        self.assertEqual(report['team_count'], len(team_user_ids), "Should include all team members")

    def test_n_plus_one_prevention(self):
        """Test that optimized queries prevent N+1 problems"""
        reset_queries()

        # Get requests with related data (this could cause N+1 without optimization)
        requests = LeaveRequest.objects.team_overview_requests(
            team_user_ids=[user.id for user in self.test_users[:10]]
        )

        # Access related fields that could trigger additional queries
        for request in requests:
            _ = request.staff_user.username
            _ = request.staff_user.first_name
            _ = request.leave_type.name
            if request.approved_by:
                _ = request.approved_by.username

        query_count = len(connection.queries)

        print(f"\nN+1 Prevention Test:")
        print(f"  Query count after accessing related fields: {query_count}")

        # Should not increase significantly from the initial queries
        self.assertLess(query_count, 5, "Should prevent N+1 queries with proper prefetching")


class IndexUsageTest(TransactionTestCase):
    """Test that our custom indexes are being used properly"""

    def setUp(self):
        """Set up minimal test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff'
        )
        self.leave_type = LeaveType.objects.create(
            name="Test Leave",
            code="TL"
        )

    def test_query_plan_uses_indexes(self):
        """Test that queries use our optimized indexes (PostgreSQL only)"""
        if connection.vendor != 'postgresql':
            self.skipTest("Query plan analysis only available for PostgreSQL")

        # Create some test data
        for i in range(10):
            LeaveRequest.objects.create(
                staff_user=self.user,
                leave_type=self.leave_type,
                start_date=date.today() + timedelta(days=i),
                end_date=date.today() + timedelta(days=i+1),
                days_requested=Decimal('1.00'),
                reason="Test",
                status='pending'
            )

        with connection.cursor() as cursor:
            # Test date range query uses proper index
            cursor.execute("""
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT * FROM leave_requests
                WHERE start_date >= %s AND end_date <= %s
                AND status = 'pending'
            """, [date.today(), date.today() + timedelta(days=30)])

            plan = cursor.fetchall()
            plan_text = ' '.join([row[0] for row in plan])

            print(f"\nQuery Plan Analysis:")
            for row in plan:
                print(f"  {row[0]}")

            # Should use index scan, not sequential scan for date ranges
            self.assertIn('Index', plan_text, "Should use index for date range queries")
            self.assertNotIn('Seq Scan on leave_requests', plan_text,
                           "Should not use sequential scan with proper indexes")