"""
Integration Tests for Optimized Reporting Pipeline
=================================================

Comprehensive test suite for the complete async reporting pipeline with
performance optimizations, monitoring, and production features.
"""

import os
import json
import time
import tempfile
import threading
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, mock_open
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from celery import current_app
from celery.result import AsyncResult

from ..models import ReportJob, ReportTemplate, User
from ..utils.optimized_report_generator import (
    OptimizedReportGenerator, ConnectionPool, MemoryManager,
    QueryOptimizer, CacheManager, PerformanceMetrics
)
from ..utils.advanced_task_manager import (
    AdvancedTaskManager, TaskPriority, TaskDeduplicationManager,
    RateLimitManager, RetryStrategyManager, ErrorType
)
from ..utils.monitoring_observability import (
    MonitoringObservabilitySystem, HealthChecker, MetricsCollector, AlertManager
)
from ..utils.production_ready_tasks import (
    ProductionTaskSystem, GracefulShutdownManager, TaskRecoveryManager
)
from ..utils.enhanced_export_handlers import (
    get_streaming_export_handler, StreamingPDFExportHandler,
    StreamingExcelExportHandler, StreamingCSVExportHandler
)
from ..optimized_tasks import generate_report_optimized, generate_batch_reports

User = get_user_model()


class OptimizedReportGeneratorTests(TestCase):
    """Test the optimized report generator"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        self.template = ReportTemplate.objects.create(
            name='Test Performance Report',
            description='Test template for performance testing',
            sql_query="""
                SELECT
                    id,
                    username,
                    email,
                    date_joined,
                    is_active
                FROM users
                WHERE date_joined >= %(date_start)s
                    AND date_joined <= %(date_end)s
                ORDER BY date_joined DESC
                LIMIT 1000
            """,
            template_type='system',
            parameters={
                'date_start': {'type': 'datetime', 'required': True},
                'date_end': {'type': 'datetime', 'required': True}
            },
            is_active=True,
            created_by=self.user
        )

    def test_connection_pool_optimization(self):
        """Test database connection pooling"""
        pool = ConnectionPool()

        # Test connection acquisition and reuse
        with pool.get_connection() as conn1:
            conn1_id = id(conn1)

        with pool.get_connection() as conn2:
            conn2_id = id(conn2)

        # Should reuse connections
        self.assertIsNotNone(pool.connection_stats)

    def test_memory_manager_optimization(self):
        """Test memory management features"""
        memory_manager = MemoryManager(max_memory_mb=128)

        # Test memory checking
        used_mb, available_mb = memory_manager.check_memory()
        self.assertGreater(used_mb, 0)
        self.assertGreaterEqual(available_mb, 0)

        # Test chunking decision
        should_chunk = memory_manager.should_chunk_data(100000)
        self.assertTrue(should_chunk)

        should_not_chunk = memory_manager.should_chunk_data(100)
        self.assertFalse(should_not_chunk)

    def test_query_optimizer(self):
        """Test SQL query optimization"""
        optimizer = QueryOptimizer()

        # Test query analysis
        simple_query = "SELECT * FROM users WHERE id = 1"
        analysis = optimizer.analyze_query(simple_query)
        self.assertEqual(analysis['estimated_complexity'], 'low')
        self.assertFalse(analysis['has_joins'])

        complex_query = """
            SELECT u.*, p.name as profile_name, COUNT(s.id) as shift_count
            FROM users u
            JOIN profiles p ON u.id = p.user_id
            LEFT JOIN shifts s ON u.id = s.user_id
            WHERE u.created_at > '2024-01-01'
            GROUP BY u.id, p.name
            ORDER BY shift_count DESC
        """
        complex_analysis = optimizer.analyze_query(complex_query)
        self.assertEqual(complex_analysis['estimated_complexity'], 'high')
        self.assertTrue(complex_analysis['has_joins'])
        self.assertTrue(complex_analysis['has_aggregations'])

    def test_cache_manager(self):
        """Test intelligent caching"""
        cache_manager = CacheManager()

        # Test cache key generation
        template_id = 1
        params = {'date_start': '2024-01-01', 'date_end': '2024-12-31'}
        cache_key = cache_manager.generate_cache_key(template_id, params)
        self.assertIsInstance(cache_key, str)
        self.assertTrue(cache_key.startswith('report_cache:'))

        # Test caching decision
        should_cache_large = cache_manager.should_cache(10000, 10.0)
        self.assertTrue(should_cache_large)

        should_cache_slow = cache_manager.should_cache(100, 6.0)
        self.assertTrue(should_cache_slow)

        should_not_cache = cache_manager.should_cache(10, 1.0)
        self.assertFalse(should_not_cache)

    @patch('api.utils.optimized_report_generator.cache')
    def test_optimized_report_generation(self, mock_cache):
        """Test complete optimized report generation"""
        # Mock cache miss
        mock_cache.get.return_value = None

        generator = OptimizedReportGenerator(
            template=self.template,
            export_format='csv',
            date_range_start=timezone.now() - timedelta(days=30),
            date_range_end=timezone.now(),
            user=self.user,
            job_id='test-job-123'
        )

        # Mock the database query execution
        with patch.object(generator, '_execute_optimized_query') as mock_execute:
            mock_data = [
                {'id': 1, 'username': 'user1', 'email': 'user1@test.com'},
                {'id': 2, 'username': 'user2', 'email': 'user2@test.com'},
            ]
            mock_execute.return_value = mock_data

            result = generator.generate()

            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['row_count'], 2)
            self.assertIn('data', result)

    def test_performance_metrics_tracking(self):
        """Test performance metrics collection"""
        metrics = PerformanceMetrics(start_time=time.time())

        # Simulate metrics updates
        metrics.query_time = 2.5
        metrics.processing_time = 1.2
        metrics.export_time = 0.8
        metrics.memory_peak = 256
        metrics.rows_processed = 5000
        metrics.cache_hits = 3
        metrics.cache_misses = 1

        # Verify metrics
        self.assertEqual(metrics.rows_processed, 5000)
        self.assertEqual(metrics.cache_hits, 3)
        self.assertEqual(metrics.memory_peak, 256)


class AdvancedTaskManagerTests(TestCase):
    """Test advanced task management features"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.task_manager = AdvancedTaskManager()

    def test_task_deduplication(self):
        """Test task deduplication"""
        dedup_manager = TaskDeduplicationManager()

        # Generate task signature
        signature = dedup_manager.generate_task_signature(
            template_id=1,
            params={'date_start': '2024-01-01'},
            export_format='csv',
            user_id=self.user.id
        )

        self.assertIsInstance(signature, str)
        self.assertEqual(len(signature), 64)  # SHA256 hash length

        # Test duplicate detection
        with patch.object(dedup_manager.redis_client, 'get') as mock_get:
            mock_get.return_value = None
            duplicate_task = dedup_manager.is_duplicate_task(signature)
            self.assertIsNone(duplicate_task)

            # Mock existing task
            mock_get.return_value = b'existing-task-123'
            duplicate_task = dedup_manager.is_duplicate_task(signature)
            self.assertEqual(duplicate_task, 'existing-task-123')

    def test_rate_limiting(self):
        """Test rate limiting functionality"""
        rate_limiter = RateLimitManager()

        # Test rate limit checking
        with patch.object(rate_limiter.redis_client, 'zcard') as mock_zcard, \
             patch.object(rate_limiter.redis_client, 'zremrangebyscore') as mock_zrem, \
             patch.object(rate_limiter.redis_client, 'zadd') as mock_zadd:

            mock_zcard.return_value = 5
            allowed, remaining = rate_limiter.check_rate_limit('per_user', str(self.user.id), 100)

            self.assertTrue(allowed)
            self.assertEqual(remaining, 94)

            # Test limit exceeded
            mock_zcard.return_value = 100
            allowed, remaining = rate_limiter.check_rate_limit('per_user', str(self.user.id), 100)

            self.assertFalse(allowed)
            self.assertEqual(remaining, 0)

    def test_retry_strategy_manager(self):
        """Test intelligent retry strategies"""
        # Test error classification
        network_error = ConnectionError("Network connection failed")
        error_type = RetryStrategyManager.classify_error(network_error)
        self.assertEqual(error_type, ErrorType.NETWORK_ERROR)

        database_error = Exception("database connection timeout")
        error_type = RetryStrategyManager.classify_error(database_error)
        self.assertEqual(error_type, ErrorType.DATABASE_ERROR)

        validation_error = ValueError("Invalid parameter value")
        error_type = RetryStrategyManager.classify_error(validation_error)
        self.assertEqual(error_type, ErrorType.VALIDATION_ERROR)

        # Test retry decisions
        should_retry_network = RetryStrategyManager.should_retry(ErrorType.NETWORK_ERROR, 2)
        self.assertTrue(should_retry_network)

        should_not_retry_validation = RetryStrategyManager.should_retry(ErrorType.VALIDATION_ERROR, 0)
        self.assertFalse(should_not_retry_validation)

        # Test retry delays
        delay = RetryStrategyManager.get_retry_delay(ErrorType.NETWORK_ERROR, 0)
        self.assertEqual(delay, 2)

        delay = RetryStrategyManager.get_retry_delay(ErrorType.DATABASE_ERROR, 1)
        self.assertEqual(delay, 15)

    def test_task_submission_with_constraints(self):
        """Test task submission with all constraints"""
        with patch.object(self.task_manager.deduplication_manager, 'is_duplicate_task') as mock_duplicate, \
             patch.object(self.task_manager.rate_limit_manager, 'check_rate_limit') as mock_rate_limit:

            # Mock no duplicate and within rate limits
            mock_duplicate.return_value = None
            mock_rate_limit.return_value = (True, 10)

            success, task_id = self.task_manager.submit_task(
                template_id=1,
                export_format='csv',
                user_id=self.user.id,
                priority=TaskPriority.HIGH
            )

            self.assertTrue(success)
            self.assertIsInstance(task_id, str)


class MonitoringObservabilityTests(TestCase):
    """Test monitoring and observability features"""

    def setUp(self):
        self.monitoring_system = MonitoringObservabilitySystem()

    def test_metrics_collection(self):
        """Test metrics collection and aggregation"""
        collector = MetricsCollector()

        # Record some metrics
        collector.record_metric('cpu_usage', 45.5, {'server': 'worker-1'})
        collector.record_metric('memory_usage', 67.2, {'server': 'worker-1'})
        collector.record_metric('cpu_usage', 52.1, {'server': 'worker-1'})

        # Get metric summary
        cpu_summary = collector.get_metric_summary('cpu_usage', 60)
        self.assertEqual(cpu_summary['count'], 2)
        self.assertEqual(cpu_summary['min'], 45.5)
        self.assertEqual(cpu_summary['max'], 52.1)
        self.assertAlmostEqual(cpu_summary['avg'], 48.8, places=1)

    def test_performance_benchmarking(self):
        """Test performance benchmark recording"""
        collector = MetricsCollector()

        # Record performance benchmarks
        collector.record_performance_benchmark(
            operation='report_generation',
            duration_ms=2500.0,
            rows_processed=10000,
            memory_used_mb=128,
            success=True
        )

        collector.record_performance_benchmark(
            operation='report_generation',
            duration_ms=3200.0,
            rows_processed=15000,
            memory_used_mb=156,
            success=True
        )

        # Get performance summary
        summary = collector.get_performance_summary('report_generation', 60)

        self.assertEqual(summary['total_operations'], 2)
        self.assertEqual(summary['successful_operations'], 2)
        self.assertEqual(summary['success_rate'], 1.0)
        self.assertIn('performance', summary)
        self.assertIn('throughput', summary)

    def test_health_checker(self):
        """Test health checking functionality"""
        health_checker = HealthChecker()

        # Test database health check
        with patch('django.db.connection.cursor') as mock_cursor:
            mock_cursor.return_value.__enter__.return_value.fetchone.return_value = [1]

            result = health_checker.run_health_check('database')

            self.assertEqual(result.service, 'database')
            self.assertTrue(result.healthy)
            self.assertGreater(result.response_time_ms, 0)

    def test_alert_manager(self):
        """Test alerting functionality"""
        alert_manager = AlertManager()

        # Mock system metrics that exceed thresholds
        mock_metrics = {
            'disk_usage_percent': 90,
            'memory_usage_percent': 88,
            'cpu_usage_percent': 95
        }

        mock_health_status = {
            'healthy': False,
            'services_healthy': 2,
            'total_services': 3
        }

        with patch.object(alert_manager, '_get_current_system_metrics') as mock_get_metrics, \
             patch.object(alert_manager, '_send_alert') as mock_send_alert:

            mock_get_metrics.return_value = mock_metrics

            alert_manager.check_and_alert(mock_metrics, mock_health_status)

            # Should have called _send_alert for multiple threshold violations
            self.assertGreater(mock_send_alert.call_count, 0)


class StreamingExportHandlerTests(TestCase):
    """Test streaming export handlers"""

    def test_streaming_csv_export(self):
        """Test streaming CSV export handler"""
        handler = get_streaming_export_handler('csv')
        self.assertIsInstance(handler, StreamingCSVExportHandler)

        # Test export process
        with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as temp_file:
            temp_path = temp_file.name

        try:
            metadata = {
                'title': 'Test Report',
                'generated_at': timezone.now().isoformat(),
                'user': 'testuser'
            }

            handler.init_streaming_export(temp_path, metadata)

            # Add test data chunks
            chunk1 = {
                'data': [
                    {'id': 1, 'name': 'John Doe', 'email': 'john@example.com'},
                    {'id': 2, 'name': 'Jane Smith', 'email': 'jane@example.com'}
                ]
            }

            chunk2 = {
                'data': [
                    {'id': 3, 'name': 'Bob Johnson', 'email': 'bob@example.com'},
                    {'id': 4, 'name': 'Alice Brown', 'email': 'alice@example.com'}
                ]
            }

            handler.append_streaming_data(chunk1)
            handler.append_streaming_data(chunk2)

            result = handler.finalize_streaming_export()

            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['format'], 'csv')
            self.assertEqual(result['row_count'], 4)
            self.assertTrue(os.path.exists(temp_path))

            # Verify CSV content
            with open(temp_path, 'r') as f:
                content = f.read()
                self.assertIn('John Doe')
                self.assertIn('Alice Brown')
                self.assertIn('id,name,email')

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_streaming_json_export(self):
        """Test streaming JSON export handler"""
        handler = get_streaming_export_handler('json')

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as temp_file:
            temp_path = temp_file.name

        try:
            metadata = {
                'title': 'Test JSON Report',
                'generated_at': timezone.now().isoformat()
            }

            handler.init_streaming_export(temp_path, metadata)

            # Add test data
            chunk = {
                'data': [
                    {'id': 1, 'name': 'Test User', 'active': True},
                    {'id': 2, 'name': 'Another User', 'active': False}
                ]
            }

            handler.append_streaming_data(chunk)
            result = handler.finalize_streaming_export()

            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['format'], 'json')
            self.assertEqual(result['row_count'], 2)

            # Verify JSON structure
            with open(temp_path, 'r') as f:
                content = json.load(f)
                self.assertEqual(len(content), 2)
                self.assertEqual(content[0]['id'], 1)
                self.assertEqual(content[1]['name'], 'Another User')

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class ProductionReadyFeaturesTests(TestCase):
    """Test production-ready features"""

    def test_graceful_shutdown_manager(self):
        """Test graceful shutdown functionality"""
        shutdown_manager = GracefulShutdownManager()

        # Test task registration
        shutdown_manager.register_task('test-task-123')
        self.assertIn('test-task-123', shutdown_manager.in_progress_tasks)

        # Test shutdown signal check
        self.assertFalse(shutdown_manager.check_shutdown_signal())

        # Test task unregistration
        shutdown_manager.unregister_task('test-task-123')
        self.assertNotIn('test-task-123', shutdown_manager.in_progress_tasks)

    def test_task_recovery_manager(self):
        """Test task recovery functionality"""
        recovery_manager = TaskRecoveryManager()

        # Test state saving and retrieval
        task_id = 'test-recovery-task'
        state = {
            'progress': 50,
            'current_step': 'processing_data',
            'rows_processed': 1000
        }

        with patch.object(recovery_manager.redis_client, 'setex') as mock_setex, \
             patch.object(recovery_manager.redis_client, 'get') as mock_get:

            mock_setex.return_value = True
            mock_get.return_value = json.dumps({
                'task_id': task_id,
                'saved_at': timezone.now().isoformat(),
                'state': state
            }).encode()

            # Save state
            recovery_manager.save_task_state(task_id, state)

            # Retrieve state
            retrieved_state = recovery_manager.get_task_state(task_id)
            self.assertIsNotNone(retrieved_state)
            self.assertEqual(retrieved_state['state']['progress'], 50)


class IntegrationTests(TestCase):
    """Integration tests for the complete pipeline"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='integrationtest',
            email='integration@example.com',
            password='testpass123'
        )

        self.template = ReportTemplate.objects.create(
            name='Integration Test Report',
            description='Template for integration testing',
            sql_query="""
                SELECT
                    id, username, email, date_joined
                FROM users
                WHERE id = %(user_id)s
            """,
            template_type='system',
            parameters={
                'user_id': {'type': 'integer', 'required': True}
            },
            is_active=True,
            created_by=self.user
        )

        self.report_job = ReportJob.objects.create(
            template=self.template,
            requested_by=self.user,
            export_format='csv',
            date_range_start=timezone.now() - timedelta(days=1),
            date_range_end=timezone.now(),
            filters={'user_id': self.user.id},
            expires_at=timezone.now() + timedelta(days=7)
        )

    @patch('api.optimized_tasks.OptimizedReportGenerator')
    def test_complete_optimized_task_pipeline(self, mock_generator_class):
        """Test the complete optimized task execution pipeline"""
        # Mock the generator
        mock_generator = MagicMock()
        mock_generator.generate.return_value = {
            'status': 'success',
            'format': 'csv',
            'row_count': 100,
            'data': 'id,username,email\n1,testuser,test@example.com',
            'message': 'CSV generated with 100 rows'
        }
        mock_generator.metrics = MagicMock()
        mock_generator.metrics.memory_peak = 64
        mock_generator.metrics.cache_hits = 2
        mock_generator.metrics.cache_misses = 1

        mock_generator_class.return_value = mock_generator

        # Execute the task synchronously for testing
        with patch('api.optimized_tasks.production_task_system') as mock_prod_system:
            result = generate_report_optimized(
                str(self.report_job.job_id),
                self.user.id
            )

            self.assertEqual(result['status'], 'success')
            self.assertEqual(result['row_count'], 100)

            # Verify production system interactions
            mock_prod_system.shutdown_manager.register_task.assert_called()
            mock_prod_system.complete_task.assert_called()

        # Verify job was updated
        self.report_job.refresh_from_db()
        self.assertEqual(self.report_job.status, 'completed')
        self.assertIsNotNone(self.report_job.completed_at)

    def test_batch_processing_pipeline(self):
        """Test batch processing functionality"""
        # Create additional report jobs
        jobs = [self.report_job]
        for i in range(3):
            job = ReportJob.objects.create(
                template=self.template,
                requested_by=self.user,
                export_format='csv',
                date_range_start=timezone.now() - timedelta(days=1),
                date_range_end=timezone.now(),
                filters={'user_id': self.user.id},
                expires_at=timezone.now() + timedelta(days=7)
            )
            jobs.append(job)

        job_ids = [str(job.job_id) for job in jobs]

        # Mock individual task execution
        with patch('api.optimized_tasks.generate_report_optimized') as mock_task:
            mock_result = AsyncResult('mock-task-id')
            mock_result.get.return_value = {
                'status': 'success',
                'row_count': 50
            }
            mock_task.delay.return_value = mock_result

            # Execute batch task
            batch_result = generate_batch_reports(job_ids, self.user.id)

            self.assertEqual(batch_result['total_jobs'], 4)
            self.assertEqual(batch_result['completed_jobs'], 4)
            self.assertEqual(batch_result['failed_jobs'], 0)

    def test_system_monitoring_integration(self):
        """Test integration with monitoring system"""
        from api.utils.monitoring_observability import monitoring_system

        # Record some test metrics
        monitoring_system.record_operation_performance(
            operation='integration_test',
            duration_ms=1500.0,
            rows_processed=500,
            memory_used_mb=128,
            success=True
        )

        # Get comprehensive status
        status = monitoring_system.get_comprehensive_status()

        self.assertIn('timestamp', status)
        self.assertIn('overall_status', status)
        self.assertIn('system_resources', status)
        self.assertIn('job_statistics', status)

        # Check performance data
        performance_summary = monitoring_system.metrics_collector.get_performance_summary(
            'integration_test', 60
        )
        self.assertEqual(performance_summary['total_operations'], 1)
        self.assertEqual(performance_summary['success_rate'], 1.0)

    def test_error_handling_and_recovery(self):
        """Test comprehensive error handling and recovery"""
        # Create a job that will fail
        failing_job = ReportJob.objects.create(
            template=self.template,
            requested_by=self.user,
            export_format='pdf',
            date_range_start=timezone.now() - timedelta(days=1),
            date_range_end=timezone.now(),
            filters={'user_id': 'invalid'},  # Invalid user_id
            expires_at=timezone.now() + timedelta(days=7)
        )

        # Mock generator to raise an error
        with patch('api.optimized_tasks.OptimizedReportGenerator') as mock_generator_class:
            mock_generator = MagicMock()
            mock_generator.generate.side_effect = ValueError("Invalid user_id parameter")
            mock_generator_class.return_value = mock_generator

            # Mock production system
            with patch('api.optimized_tasks.production_task_system') as mock_prod_system:
                # Execute task and expect it to handle the error
                try:
                    generate_report_optimized(str(failing_job.job_id), self.user.id)
                except ValueError:
                    pass  # Expected to be raised after handling

                # Verify error handling
                mock_prod_system.complete_task.assert_called_with(
                    unittest.mock.ANY, False
                )

        # Verify job was marked as failed
        failing_job.refresh_from_db()
        self.assertEqual(failing_job.status, 'failed')
        self.assertIn('Invalid user_id parameter', failing_job.error_message)


class PerformanceBenchmarkTests(TestCase):
    """Performance benchmark tests"""

    def test_large_dataset_processing(self):
        """Benchmark processing of large datasets"""
        # This would typically use real data, but for testing we'll simulate
        large_dataset = [
            {'id': i, 'name': f'User {i}', 'email': f'user{i}@example.com'}
            for i in range(10000)
        ]

        handler = get_streaming_export_handler('csv')

        with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as temp_file:
            temp_path = temp_file.name

        try:
            start_time = time.time()

            handler.init_streaming_export(temp_path, {'title': 'Benchmark Test'})

            # Process in chunks of 1000
            chunk_size = 1000
            for i in range(0, len(large_dataset), chunk_size):
                chunk = {
                    'data': large_dataset[i:i+chunk_size]
                }
                handler.append_streaming_data(chunk)

            result = handler.finalize_streaming_export()

            processing_time = time.time() - start_time

            self.assertEqual(result['row_count'], 10000)
            self.assertLess(processing_time, 30)  # Should complete within 30 seconds

            # Verify file was created and has reasonable size
            self.assertTrue(os.path.exists(temp_path))
            file_size = os.path.getsize(temp_path)
            self.assertGreater(file_size, 100000)  # At least 100KB for 10k records

            print(f"Processed 10,000 records in {processing_time:.2f} seconds")
            print(f"File size: {file_size / 1024:.1f} KB")

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_memory_efficiency(self):
        """Test memory efficiency during processing"""
        import psutil

        process = psutil.Process()
        initial_memory = process.memory_info().rss

        # Process a reasonably large dataset
        memory_manager = MemoryManager(max_memory_mb=256)

        # Simulate processing chunks
        for i in range(100):
            # Check memory after each chunk
            memory_manager._check_memory_usage()
            current_memory = process.memory_info().rss

            # Memory growth should be controlled
            memory_growth = (current_memory - initial_memory) / (1024 * 1024)
            self.assertLess(memory_growth, 256)  # Should not exceed 256MB

        print(f"Memory growth during processing: {memory_growth:.1f} MB")