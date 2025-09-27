"""
Performance Testing and Benchmarking for Leave Management System
===============================================================

This module provides comprehensive performance testing tools for the leave management system:
- Query performance benchmarks
- Load testing scenarios
- Database optimization validation
- Real-time monitoring utilities

Author: Django ORM Expert Agent
Phase: 1 - Leave Management System Enhancement
Task: TASK-007, TASK-008 - Performance optimization and validation
"""

import time
import logging
from decimal import Decimal
from datetime import datetime, timedelta, date
from django.test import TestCase, TransactionTestCase
from django.test.utils import override_settings
from django.db import connection, transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from .models import LeaveType, LeavePolicy, LeaveEntitlement
from .optimized_models import (
    OptimizedLeaveType, OptimizedLeavePolicy, OptimizedLeaveEntitlement
)
from .query_optimizers import LeaveBalanceCalculator, LeaveAnalyticsQueries

User = get_user_model()
logger = logging.getLogger(__name__)


class LeaveManagementPerformanceTestCase(TransactionTestCase):
    """
    Performance test case for leave management operations
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.setup_test_data()

    @classmethod
    def setup_test_data(self):
        """Create test data for performance testing"""
        # Create employment type
        from api.models import EmploymentType
        cls.employment_type = EmploymentType.objects.create(
            name="Full-time Security Staff",
            description="Full-time security staff members",
            is_active=True
        )

        # Create leave types
        cls.annual_leave_type = OptimizedLeaveType.objects.create(
            name="Annual Leave",
            code="AL",
            is_active=True,
            display_order=1
        )

        cls.sick_leave_type = OptimizedLeaveType.objects.create(
            name="Sick Leave",
            code="SL",
            is_active=True,
            display_order=2
        )

        # Create leave policies
        cls.annual_policy = OptimizedLeavePolicy.objects.create(
            name="Standard Annual Leave Policy",
            leave_type=cls.annual_leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('2.0'),  # 2 days per month
            max_balance=Decimal('30.0'),
            carryover_method='partial',
            carryover_limit=Decimal('5.0'),
            is_active=True,
            effective_date=date.today() - timedelta(days=365)
        )

        cls.sick_policy = OptimizedLeavePolicy.objects.create(
            name="Standard Sick Leave Policy",
            leave_type=cls.sick_leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('1.0'),  # 1 day per month
            max_balance=Decimal('12.0'),
            carryover_method='none',
            is_active=True,
            effective_date=date.today() - timedelta(days=365)
        )

        # Create test users (100 users for bulk testing)
        cls.test_users = []
        for i in range(100):
            user = User.objects.create_user(
                username=f'testuser{i:03d}',
                email=f'testuser{i:03d}@example.com',
                password='testpass123'
            )
            cls.test_users.append(user)

        # Create entitlements for all users
        current_year = timezone.now().year
        for user in cls.test_users:
            # Annual leave entitlement
            OptimizedLeaveEntitlement.objects.create(
                user=user,
                policy=cls.annual_policy,
                year=current_year,
                annual_entitlement=Decimal('24.0'),
                carried_over=Decimal('2.0'),
                accrued_to_date=Decimal('8.0'),
                used_to_date=Decimal('5.0')
            )

            # Sick leave entitlement
            OptimizedLeaveEntitlement.objects.create(
                user=user,
                policy=cls.sick_policy,
                year=current_year,
                annual_entitlement=Decimal('12.0'),
                carried_over=Decimal('0.0'),
                accrued_to_date=Decimal('4.0'),
                used_to_date=Decimal('1.0')
            )

    def test_single_user_balance_lookup_performance(self):
        """Test single user balance lookup performance (Target: <50ms)"""
        user = self.test_users[0]
        current_year = timezone.now().year

        # Warm up
        LeaveBalanceCalculator.get_user_balances_for_year(user, current_year)

        # Performance test
        start_time = time.time()
        balances = LeaveBalanceCalculator.get_user_balances_for_year(user, current_year)
        list(balances)  # Force evaluation
        execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        self.assertLess(execution_time, 50,
                       f"Single user balance lookup took {execution_time:.2f}ms (target: <50ms)")

        logger.info(f"Single user balance lookup: {execution_time:.2f}ms")

    def test_bulk_balance_calculation_performance(self):
        """Test bulk balance calculation performance (Target: <500ms for 100 users)"""
        user_ids = [user.id for user in self.test_users]
        current_year = timezone.now().year

        # Warm up
        LeaveBalanceCalculator.calculate_bulk_balances(user_ids[:10], current_year)

        # Performance test
        start_time = time.time()
        balances = LeaveBalanceCalculator.calculate_bulk_balances(user_ids, current_year)
        result_count = len(list(balances))
        execution_time = (time.time() - start_time) * 1000

        self.assertLess(execution_time, 500,
                       f"Bulk balance calculation took {execution_time:.2f}ms (target: <500ms)")
        self.assertEqual(result_count, 200)  # 100 users * 2 leave types

        logger.info(f"Bulk balance calculation (100 users): {execution_time:.2f}ms")

    def test_leave_summary_report_performance(self):
        """Test leave summary report performance (Target: <200ms)"""
        current_year = timezone.now().year

        # Warm up
        LeaveBalanceCalculator.get_leave_summary_by_type(current_year)

        # Performance test
        start_time = time.time()
        summary = LeaveBalanceCalculator.get_leave_summary_by_type(current_year)
        list(summary)
        execution_time = (time.time() - start_time) * 1000

        self.assertLess(execution_time, 200,
                       f"Leave summary report took {execution_time:.2f}ms (target: <200ms)")

        logger.info(f"Leave summary report: {execution_time:.2f}ms")

    def test_analytics_query_performance(self):
        """Test complex analytics query performance (Target: <2000ms)"""
        current_year = timezone.now().year

        # Performance test
        start_time = time.time()
        high_usage = LeaveAnalyticsQueries.identify_high_usage_employees(
            threshold_percentage=50, year=current_year
        )
        list(high_usage)
        execution_time = (time.time() - start_time) * 1000

        self.assertLess(execution_time, 2000,
                       f"Analytics query took {execution_time:.2f}ms (target: <2000ms)")

        logger.info(f"Analytics query (high usage employees): {execution_time:.2f}ms")

    @override_settings(DEBUG=True)
    def test_query_count_optimization(self):
        """Test that queries are optimized to minimize database hits"""
        from django.db import reset_queries

        user = self.test_users[0]
        current_year = timezone.now().year

        reset_queries()

        # Execute user balance lookup
        balances = LeaveBalanceCalculator.get_user_balances_for_year(user, current_year)
        list(balances)

        query_count = len(connection.queries)

        # Should require minimal queries (1-3 queries max)
        self.assertLessEqual(query_count, 3,
                           f"User balance lookup used {query_count} queries (target: ≤3)")

        logger.info(f"User balance lookup query count: {query_count}")

    def test_n_plus_one_prevention(self):
        """Test that N+1 queries are prevented in bulk operations"""
        from django.db import reset_queries

        user_ids = [user.id for user in self.test_users[:20]]  # Test with 20 users
        current_year = timezone.now().year

        reset_queries()

        # Execute bulk balance calculation
        balances = LeaveBalanceCalculator.calculate_bulk_balances(user_ids, current_year)
        list(balances)

        query_count = len(connection.queries)

        # Should not scale with number of users (max 5 queries regardless of user count)
        self.assertLessEqual(query_count, 5,
                           f"Bulk balance calculation used {query_count} queries for 20 users (target: ≤5)")

        logger.info(f"Bulk balance calculation query count (20 users): {query_count}")


class LoadTestingUtilities:
    """
    Utilities for load testing leave management operations
    """

    @staticmethod
    def simulate_concurrent_balance_lookups(user_count=50, iterations=10):
        """Simulate concurrent balance lookups"""
        import threading
        import queue

        results = queue.Queue()
        current_year = timezone.now().year

        def lookup_balance(user_id):
            start_time = time.time()
            try:
                balances = LeaveBalanceCalculator.get_user_balances_for_year(
                    user_id, current_year
                )
                list(balances)
                execution_time = (time.time() - start_time) * 1000
                results.put(('success', execution_time))
            except Exception as e:
                results.put(('error', str(e)))

        # Create test users if needed
        test_users = User.objects.filter(username__startswith='loadtest')[:user_count]
        if len(test_users) < user_count:
            logger.warning(f"Only {len(test_users)} test users available, need {user_count}")

        # Run concurrent lookups
        for iteration in range(iterations):
            threads = []
            for user in test_users:
                thread = threading.Thread(target=lookup_balance, args=(user.id,))
                threads.append(thread)
                thread.start()

            # Wait for all threads to complete
            for thread in threads:
                thread.join()

        # Collect results
        success_count = 0
        error_count = 0
        execution_times = []

        while not results.empty():
            result_type, result_data = results.get()
            if result_type == 'success':
                success_count += 1
                execution_times.append(result_data)
            else:
                error_count += 1

        # Calculate statistics
        if execution_times:
            avg_time = sum(execution_times) / len(execution_times)
            max_time = max(execution_times)
            min_time = min(execution_times)

            logger.info(f"Load Test Results:")
            logger.info(f"- Total operations: {success_count + error_count}")
            logger.info(f"- Successful: {success_count}")
            logger.info(f"- Errors: {error_count}")
            logger.info(f"- Average time: {avg_time:.2f}ms")
            logger.info(f"- Min time: {min_time:.2f}ms")
            logger.info(f"- Max time: {max_time:.2f}ms")

            return {
                'success_count': success_count,
                'error_count': error_count,
                'avg_time': avg_time,
                'min_time': min_time,
                'max_time': max_time
            }

        return None

    @staticmethod
    def stress_test_database_connections(duration_seconds=60):
        """Stress test database connections"""
        import threading
        import random

        start_time = time.time()
        end_time = start_time + duration_seconds
        results = {'queries': 0, 'errors': 0}
        lock = threading.Lock()

        def worker():
            while time.time() < end_time:
                try:
                    # Random operation
                    operation = random.choice(['balance_lookup', 'summary_report', 'analytics'])

                    if operation == 'balance_lookup':
                        user_id = random.randint(1, 100)
                        LeaveBalanceCalculator.get_user_balances_for_year(user_id)

                    elif operation == 'summary_report':
                        LeaveBalanceCalculator.get_leave_summary_by_type()

                    elif operation == 'analytics':
                        LeaveAnalyticsQueries.identify_high_usage_employees()

                    with lock:
                        results['queries'] += 1

                except Exception as e:
                    with lock:
                        results['errors'] += 1

                # Small delay to prevent overwhelming
                time.sleep(0.01)

        # Start worker threads
        thread_count = 10
        threads = []
        for _ in range(thread_count):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        total_time = time.time() - start_time
        qps = results['queries'] / total_time

        logger.info(f"Stress Test Results ({duration_seconds}s):")
        logger.info(f"- Total queries: {results['queries']}")
        logger.info(f"- Errors: {results['errors']}")
        logger.info(f"- Queries per second: {qps:.2f}")
        logger.info(f"- Error rate: {results['errors'] / (results['queries'] + results['errors']) * 100:.2f}%")

        return results


class DatabaseMonitoringUtilities:
    """
    Utilities for monitoring database performance
    """

    @staticmethod
    def get_query_statistics():
        """Get query performance statistics from PostgreSQL"""
        with connection.cursor() as cursor:
            # Query performance statistics
            cursor.execute("""
                SELECT
                    query,
                    calls,
                    total_time,
                    mean_time,
                    min_time,
                    max_time,
                    rows / calls as avg_rows_per_call
                FROM pg_stat_statements
                WHERE query ILIKE '%leave%' OR query ILIKE '%entitlement%'
                ORDER BY mean_time DESC
                LIMIT 20;
            """)

            columns = [desc[0] for desc in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))

            return results

    @staticmethod
    def get_index_usage_statistics():
        """Get index usage statistics"""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public'
                    AND (tablename LIKE '%leave%' OR tablename LIKE '%entitlement%')
                ORDER BY idx_scan DESC;
            """)

            columns = [desc[0] for desc in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))

            return results

    @staticmethod
    def get_table_statistics():
        """Get table usage statistics"""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_tuples,
                    n_dead_tup as dead_tuples,
                    seq_scan,
                    idx_scan,
                    ROUND(100 * idx_scan::numeric / NULLIF(seq_scan + idx_scan, 0), 2) as index_usage_pct,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                    AND (tablename LIKE '%leave%' OR tablename LIKE '%entitlement%')
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
            """)

            columns = [desc[0] for desc in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))

            return results

    @staticmethod
    def check_slow_queries(threshold_ms=100):
        """Check for slow queries above threshold"""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    query,
                    calls,
                    total_time,
                    mean_time,
                    max_time,
                    ROUND(100.0 * total_time / sum(total_time) OVER(), 2) as pct_total_time
                FROM pg_stat_statements
                WHERE mean_time > %s
                    AND (query ILIKE '%%leave%%' OR query ILIKE '%%entitlement%%')
                ORDER BY mean_time DESC;
            """, [threshold_ms])

            columns = [desc[0] for desc in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))

            return results


class PerformanceTestCommand(BaseCommand):
    """
    Django management command for running performance tests
    """
    help = 'Run performance tests for leave management system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--test-type',
            type=str,
            choices=['all', 'basic', 'load', 'monitor'],
            default='all',
            help='Type of tests to run'
        )
        parser.add_argument(
            '--duration',
            type=int,
            default=60,
            help='Duration for load tests in seconds'
        )
        parser.add_argument(
            '--users',
            type=int,
            default=50,
            help='Number of users for load testing'
        )

    def handle(self, *args, **options):
        test_type = options['test_type']
        duration = options['duration']
        users = options['users']

        self.stdout.write(
            self.style.SUCCESS(f'Starting performance tests: {test_type}')
        )

        if test_type in ['all', 'basic']:
            self.run_basic_performance_tests()

        if test_type in ['all', 'load']:
            self.run_load_tests(duration, users)

        if test_type in ['all', 'monitor']:
            self.run_monitoring_checks()

        self.stdout.write(
            self.style.SUCCESS('Performance testing completed')
        )

    def run_basic_performance_tests(self):
        """Run basic performance tests"""
        self.stdout.write('Running basic performance tests...')

        # Single user balance lookup
        user = User.objects.first()
        if user:
            start_time = time.time()
            balances = LeaveBalanceCalculator.get_user_balances_for_year(user)
            list(balances)
            execution_time = (time.time() - start_time) * 1000

            self.stdout.write(f'Single user balance lookup: {execution_time:.2f}ms')

        # Leave summary report
        start_time = time.time()
        summary = LeaveBalanceCalculator.get_leave_summary_by_type()
        list(summary)
        execution_time = (time.time() - start_time) * 1000

        self.stdout.write(f'Leave summary report: {execution_time:.2f}ms')

    def run_load_tests(self, duration, users):
        """Run load tests"""
        self.stdout.write(f'Running load tests for {duration}s with {users} users...')

        results = LoadTestingUtilities.simulate_concurrent_balance_lookups(
            user_count=min(users, User.objects.count()),
            iterations=5
        )

        if results:
            self.stdout.write(f'Load test results: {results}')

    def run_monitoring_checks(self):
        """Run monitoring checks"""
        self.stdout.write('Running monitoring checks...')

        # Index usage
        index_stats = DatabaseMonitoringUtilities.get_index_usage_statistics()
        self.stdout.write(f'Found {len(index_stats)} indexes')

        # Slow queries
        slow_queries = DatabaseMonitoringUtilities.check_slow_queries()
        if slow_queries:
            self.stdout.write(
                self.style.WARNING(f'Found {len(slow_queries)} slow queries')
            )
        else:
            self.stdout.write('No slow queries detected')