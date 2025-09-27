"""
Performance benchmark tests for multi-tenant query optimizations.

These tests validate that company-scoped queries perform efficiently
and that database indexes are being used correctly.
"""

import time
import statistics
from django.test import TestCase, TransactionTestCase
from django.test.utils import override_settings
from django.db import connection, transaction
from django.utils import timezone
from django.core.cache import cache
from unittest.mock import patch
from datetime import timedelta
import logging

from .models import User, Venue, Shift, SecurityCompany, UserCompanyMembership
from .multi_tenant_optimizations import (
    MultiTenantQueryOptimizer,
    CompanyDataCache,
    DatabaseFunctions
)

logger = logging.getLogger(__name__)


class MultiTenantPerformanceTestCase(TransactionTestCase):
    """
    Test multi-tenant query performance with realistic data volumes
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.create_performance_test_data()

    @classmethod
    def create_performance_test_data(cls):
        """Create realistic test data for performance testing"""

        # Create multiple companies
        cls.companies = []
        for i in range(10):
            company = SecurityCompany.objects.create(
                name=f"Security Company {i+1}",
                registration_number=f"SC{i+1:03d}",
                country_code='GB',
                staff_capacity=100 + (i * 10),
                subscription_tier='professional'
            )
            cls.companies.append(company)

        # Create users and assign to companies
        cls.test_users = []
        for i in range(100):  # 100 users total
            user = User.objects.create(
                username=f"testuser{i+1}",
                email=f"user{i+1}@example.com",
                first_name=f"User{i+1}",
                last_name="Test",
                role='staff'
            )
            cls.test_users.append(user)

            # Assign user to a company (roughly 10 users per company)
            company = cls.companies[i % 10]
            UserCompanyMembership.objects.create(
                user=user,
                company=company,
                role='staff',
                is_owner=i % 10 == 0  # First user of each company is owner
            )

        # Create venues for each company
        cls.test_venues = []
        for company in cls.companies:
            for j in range(5):  # 5 venues per company
                venue = Venue.objects.create(
                    name=f"{company.name} Venue {j+1}",
                    address=f"Test Address {j+1}",
                    city="London",
                    postal_code=f"E1 {j+1}AB",
                    country="United Kingdom",
                    capacity=50 + (j * 10),
                    latitude=51.5074 + (j * 0.01),
                    longitude=-0.1278 + (j * 0.01),
                    company=company
                )
                cls.test_venues.append(venue)

        # Create shifts for performance testing
        cls.test_shifts = []
        base_date = timezone.now() - timedelta(days=90)

        for i in range(500):  # 500 shifts total
            venue = cls.test_venues[i % len(cls.test_venues)]
            user = cls.test_users[i % len(cls.test_users)]

            # Ensure user belongs to the same company as venue
            membership = UserCompanyMembership.objects.filter(
                user=user,
                company=venue.company
            ).first()

            if membership:  # Only create shift if user belongs to company
                shift_date = base_date + timedelta(days=i % 90)
                shift = Shift.objects.create(
                    staff_user=user,
                    venue=venue,
                    company=venue.company,
                    start_time=shift_date.replace(hour=9),
                    end_time=shift_date.replace(hour=17),
                    status='completed' if i % 3 == 0 else 'approved',
                    hourly_rate=15.50,
                    actual_hours_worked=8.0
                )
                cls.test_shifts.append(shift)

    def setUp(self):
        """Reset connection queries for each test"""
        connection.queries_log.clear()
        cache.clear()

    def measure_query_performance(self, query_func, iterations=5):
        """
        Measure query performance over multiple iterations
        """
        execution_times = []

        for _ in range(iterations):
            start_time = time.perf_counter()
            result = query_func()
            end_time = time.perf_counter()

            execution_time = (end_time - start_time) * 1000  # Convert to milliseconds
            execution_times.append(execution_time)

            # Force evaluation if it's a queryset
            if hasattr(result, '__iter__'):
                list(result)

        return {
            'avg_time_ms': statistics.mean(execution_times),
            'min_time_ms': min(execution_times),
            'max_time_ms': max(execution_times),
            'std_dev_ms': statistics.stdev(execution_times) if len(execution_times) > 1 else 0
        }

    def test_company_scoped_venue_query_performance(self):
        """Test performance of company-scoped venue queries"""
        company = self.companies[0]

        def query_func():
            return Venue.objects.for_company(company.id).select_related('company')

        performance = self.measure_query_performance(query_func)

        # Performance assertions
        self.assertLess(performance['avg_time_ms'], 50,
                       f"Company venue query too slow: {performance['avg_time_ms']:.2f}ms")

        # Check that proper indexes are being used
        with connection.cursor() as cursor:
            cursor.execute("EXPLAIN ANALYZE SELECT * FROM venues WHERE company_id = %s", [company.id])
            explain_plan = cursor.fetchall()

        explain_text = '\n'.join([str(row) for row in explain_plan])
        self.assertIn('Index Scan', explain_text, "Query should use index scan")

    def test_company_scoped_shift_query_performance(self):
        """Test performance of company-scoped shift queries with joins"""
        company = self.companies[0]

        def query_func():
            return Shift.objects.shifts_for_company_dashboard(company.id)[:20]

        performance = self.measure_query_performance(query_func)

        # Performance assertions
        self.assertLess(performance['avg_time_ms'], 100,
                       f"Company shift dashboard query too slow: {performance['avg_time_ms']:.2f}ms")

        # Verify minimal queries (should use select_related)
        queries_before = len(connection.queries)
        list(Shift.objects.shifts_for_company_dashboard(company.id)[:20])
        queries_after = len(connection.queries)

        query_count = queries_after - queries_before
        self.assertLess(query_count, 3, f"Too many queries executed: {query_count}")

    def test_company_analytics_query_performance(self):
        """Test performance of complex analytics queries"""
        company = self.companies[0]

        def query_func():
            return Shift.objects.company_shift_analytics(
                company.id,
                start_date=timezone.now() - timedelta(days=30),
                end_date=timezone.now()
            )

        performance = self.measure_query_performance(query_func)

        # Performance assertions for complex analytics
        self.assertLess(performance['avg_time_ms'], 200,
                       f"Company analytics query too slow: {performance['avg_time_ms']:.2f}ms")

    def test_multi_company_isolation_performance(self):
        """Test that multi-company queries maintain isolation and performance"""

        results = {}
        for company in self.companies[:3]:  # Test first 3 companies
            def query_func():
                return Venue.objects.for_company(company.id).count()

            performance = self.measure_query_performance(query_func)
            results[company.id] = performance

            # Each company should have consistent performance
            self.assertLess(performance['avg_time_ms'], 30,
                           f"Company {company.id} venue count too slow: {performance['avg_time_ms']:.2f}ms")

        # Performance should be consistent across companies
        avg_times = [result['avg_time_ms'] for result in results.values()]
        time_variance = max(avg_times) - min(avg_times)
        self.assertLess(time_variance, 20, "Performance varies too much between companies")

    def test_dashboard_query_optimization(self):
        """Test the optimized dashboard query performance"""
        company = self.companies[0]
        optimizer = MultiTenantQueryOptimizer(company.id)

        def query_func():
            return optimizer.get_company_dashboard_data()

        performance = self.measure_query_performance(query_func, iterations=3)

        # Dashboard should load quickly
        self.assertLess(performance['avg_time_ms'], 300,
                       f"Dashboard query too slow: {performance['avg_time_ms']:.2f}ms")

    def test_caching_performance_improvement(self):
        """Test that caching improves performance"""
        company = self.companies[0]
        cache.clear()

        # First query (no cache)
        def first_query():
            cache_key = CompanyDataCache.get_company_stats_cache_key(company.id)
            cache.delete(cache_key)  # Ensure no cache
            optimizer = MultiTenantQueryOptimizer(company.id)
            return optimizer.get_company_dashboard_data()

        first_performance = self.measure_query_performance(first_query, iterations=1)

        # Second query (with cache)
        def cached_query():
            optimizer = MultiTenantQueryOptimizer(company.id)
            return optimizer.get_company_dashboard_data()

        cached_performance = self.measure_query_performance(cached_query, iterations=1)

        # Cached query should be significantly faster
        improvement_ratio = first_performance['avg_time_ms'] / cached_performance['avg_time_ms']
        self.assertGreater(improvement_ratio, 2,
                          "Caching should provide at least 2x performance improvement")

    def test_bulk_operations_performance(self):
        """Test performance of bulk update operations"""

        def bulk_update_func():
            return DatabaseFunctions.bulk_update_company_stats()

        performance = self.measure_query_performance(bulk_update_func, iterations=2)

        # Bulk updates should be efficient
        self.assertLess(performance['avg_time_ms'], 500,
                       f"Bulk update too slow: {performance['avg_time_ms']:.2f}ms")

    def test_query_plan_optimization(self):
        """Test that queries use optimal execution plans"""
        company = self.companies[0]

        # Test venue query plan
        with connection.cursor() as cursor:
            cursor.execute("""
                EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
                SELECT * FROM venues v
                JOIN security_companies c ON v.company_id = c.id
                WHERE v.company_id = %s AND v.is_active = true
            """, [company.id])

            plan = cursor.fetchone()[0][0]

            # Check for index usage
            plan_text = str(plan)
            self.assertIn('Index', plan_text, "Query should use index")

            # Check execution time is reasonable
            execution_time = plan['Execution Time']
            self.assertLess(execution_time, 10, f"Query execution time too high: {execution_time}ms")

    def test_concurrent_company_access_performance(self):
        """Test performance under concurrent company access scenarios"""
        import threading
        import queue

        results_queue = queue.Queue()

        def company_query_worker(company_id):
            try:
                start_time = time.perf_counter()

                # Simulate typical company operations
                venues = list(Venue.objects.for_company(company_id)[:10])
                shifts = list(Shift.objects.for_company(company_id)[:20])

                end_time = time.perf_counter()
                execution_time = (end_time - start_time) * 1000

                results_queue.put(('success', execution_time))
            except Exception as e:
                results_queue.put(('error', str(e)))

        # Create threads for concurrent access
        threads = []
        for company in self.companies[:5]:
            thread = threading.Thread(target=company_query_worker, args=(company.id,))
            threads.append(thread)

        # Start all threads
        for thread in threads:
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        # Analyze results
        execution_times = []
        errors = []

        while not results_queue.empty():
            status, result = results_queue.get()
            if status == 'success':
                execution_times.append(result)
            else:
                errors.append(result)

        # Assertions
        self.assertEqual(len(errors), 0, f"Concurrent access errors: {errors}")
        self.assertEqual(len(execution_times), 5, "All concurrent queries should complete")

        avg_concurrent_time = statistics.mean(execution_times)
        self.assertLess(avg_concurrent_time, 200,
                       f"Concurrent query average too slow: {avg_concurrent_time:.2f}ms")


class IndexUsageTestCase(TestCase):
    """
    Test that database indexes are being used correctly
    """

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Test Company",
            registration_number="TC001",
            country_code="GB"
        )

        self.user = User.objects.create(
            username="testuser",
            email="test@example.com"
        )

        UserCompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role="staff"
        )

    def test_company_user_index_usage(self):
        """Test that company-user queries use proper indexes"""
        with connection.cursor() as cursor:
            # Test company users index
            cursor.execute("""
                EXPLAIN (FORMAT JSON)
                SELECT * FROM user_company_memberships
                WHERE company_id = %s
            """, [self.company.id])

            plan = cursor.fetchone()[0][0]

            # Should use index scan on company_id
            self.assertIn('Index', str(plan), "Query should use index")

    def test_multi_column_index_usage(self):
        """Test that multi-column indexes are used effectively"""
        # Create test venue
        venue = Venue.objects.create(
            name="Test Venue",
            address="Test Address",
            city="London",
            postal_code="E1 1AA",
            country="UK",
            capacity=100,
            company=self.company
        )

        with connection.cursor() as cursor:
            # Test compound index usage
            cursor.execute("""
                EXPLAIN (FORMAT JSON)
                SELECT * FROM venues
                WHERE company_id = %s AND is_active = true
            """, [self.company.id])

            plan = cursor.fetchone()[0][0]
            plan_text = str(plan)

            # Should use compound index efficiently
            self.assertIn('Index', plan_text, "Query should use index")


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
)
class CachePerformanceTestCase(TestCase):
    """
    Test caching performance optimizations
    """

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Cache Test Company",
            registration_number="CTC001",
            country_code="GB"
        )

    def test_cache_hit_performance(self):
        """Test that cache hits are significantly faster"""
        cache.clear()

        # Cache miss
        start_time = time.perf_counter()
        cached_data = CompanyDataCache.get_cached_company_stats(self.company.id)
        miss_time = time.perf_counter() - start_time

        self.assertIsNone(cached_data, "Should be cache miss")

        # Set cache
        test_data = {"test": "data", "company_id": self.company.id}
        CompanyDataCache.cache_company_stats(self.company.id, test_data)

        # Cache hit
        start_time = time.perf_counter()
        cached_data = CompanyDataCache.get_cached_company_stats(self.company.id)
        hit_time = time.perf_counter() - start_time

        self.assertIsNotNone(cached_data, "Should be cache hit")
        self.assertEqual(cached_data["test"], "data")

        # Cache hit should be much faster (though both are very fast in tests)
        self.assertLess(hit_time, miss_time + 0.001, "Cache hit should not be slower")

    def test_cache_invalidation(self):
        """Test that cache invalidation works correctly"""
        # Set cache
        test_data = {"test": "data"}
        CompanyDataCache.cache_company_stats(self.company.id, test_data)

        # Verify cache exists
        cached_data = CompanyDataCache.get_cached_company_stats(self.company.id)
        self.assertIsNotNone(cached_data)

        # Invalidate cache
        CompanyDataCache.invalidate_company_cache(self.company.id)

        # Verify cache is cleared
        cached_data = CompanyDataCache.get_cached_company_stats(self.company.id)
        self.assertIsNone(cached_data)


class ScalabilityTestCase(TransactionTestCase):
    """
    Test system scalability with large datasets
    """

    def test_large_dataset_performance(self):
        """Test performance with larger datasets"""
        # Create a company with many venues and shifts
        company = SecurityCompany.objects.create(
            name="Large Scale Company",
            registration_number="LSC001",
            country_code="GB",
            staff_capacity=1000
        )

        # Create many venues
        venues = []
        for i in range(50):
            venue = Venue.objects.create(
                name=f"Large Venue {i}",
                address=f"Address {i}",
                city="London",
                postal_code=f"E{i%9+1} {i}AA",
                country="UK",
                capacity=100,
                company=company
            )
            venues.append(venue)

        # Test query performance with large dataset
        start_time = time.perf_counter()
        venue_list = list(Venue.objects.for_company(company.id).order_by('name'))
        end_time = time.perf_counter()

        execution_time = (end_time - start_time) * 1000

        self.assertEqual(len(venue_list), 50, "Should retrieve all venues")
        self.assertLess(execution_time, 100,
                       f"Large dataset query too slow: {execution_time:.2f}ms")

    def test_memory_usage_efficiency(self):
        """Test that queries don't load unnecessary data into memory"""
        import psutil
        import os

        company = SecurityCompany.objects.create(
            name="Memory Test Company",
            registration_number="MTC001",
            country_code="GB"
        )

        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss

        # Execute query that could potentially load lots of data
        venues = Venue.objects.for_company(company.id).iterator(chunk_size=10)
        venue_count = sum(1 for _ in venues)

        # Get final memory usage
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable
        self.assertLess(memory_increase, 50 * 1024 * 1024,  # 50MB
                       f"Memory usage too high: {memory_increase / 1024 / 1024:.2f}MB")