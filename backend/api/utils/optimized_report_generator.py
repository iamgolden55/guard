"""
Optimized Report Generation with Performance Enhancements
===========================================================

This module provides high-performance report generation capabilities with:
- Database query optimizations and connection pooling
- Memory-efficient data processing for large datasets
- Progress tracking and cancellation support
- Intelligent caching strategies
- Resource monitoring and management
"""

import os
import gc
import csv
import json
import time
import logging
import hashlib
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Generator, Tuple
from contextlib import contextmanager
from dataclasses import dataclass
from threading import Lock
import psutil
import weakref

from django.db import connection, connections, transaction
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from celery import current_task
from celery.exceptions import WorkerLostError

from .export_handlers import get_export_handler
from ..models import ReportJob

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Track performance metrics during report generation"""
    start_time: float
    query_time: float = 0
    processing_time: float = 0
    export_time: float = 0
    memory_peak: int = 0  # Peak memory usage in MB
    rows_processed: int = 0
    cache_hits: int = 0
    cache_misses: int = 0


class ConnectionPool:
    """Optimized database connection pool for report generation"""

    _instance = None
    _lock = Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.connections = weakref.WeakValueDictionary()
            self.connection_stats = {}
            self._initialized = True

    @contextmanager
    def get_connection(self, alias: str = 'default'):
        """Get optimized database connection with proper cleanup"""
        conn = connections[alias]
        conn_id = id(conn)

        try:
            # Configure connection for reporting workloads
            with conn.cursor() as cursor:
                # Optimize for read-heavy operations
                cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED")
                cursor.execute("SET SESSION query_cache_type = ON")
                cursor.execute("SET SESSION read_buffer_size = 2097152")  # 2MB
                cursor.execute("SET SESSION sort_buffer_size = 4194304")  # 4MB

            # Track connection usage
            if conn_id not in self.connection_stats:
                self.connection_stats[conn_id] = {'queries': 0, 'last_used': time.time()}

            yield conn

        finally:
            # Update stats
            self.connection_stats[conn_id]['queries'] += 1
            self.connection_stats[conn_id]['last_used'] = time.time()

            # Force close if connection has been used too much
            if self.connection_stats[conn_id]['queries'] > 1000:
                conn.close()
                del self.connection_stats[conn_id]


class MemoryManager:
    """Manage memory usage during large report generation"""

    def __init__(self, max_memory_mb: int = 512):
        self.max_memory_mb = max_memory_mb
        self.initial_memory = None

    def check_memory(self) -> Tuple[int, int]:
        """Check current memory usage, return (used_mb, available_mb)"""
        process = psutil.Process()
        memory_info = process.memory_info()
        used_mb = memory_info.rss // (1024 * 1024)

        if self.initial_memory is None:
            self.initial_memory = used_mb

        return used_mb, self.max_memory_mb - used_mb

    def force_cleanup(self):
        """Force garbage collection and memory cleanup"""
        gc.collect()

        # Close unused database connections
        for conn in connections.all():
            if hasattr(conn, 'close_if_unusable_or_obsolete'):
                conn.close_if_unusable_or_obsolete()

    def should_chunk_data(self, estimated_rows: int) -> bool:
        """Determine if data should be processed in chunks"""
        # Estimate memory usage (rough calculation)
        estimated_memory_mb = (estimated_rows * 1024) // (1024 * 1024)  # 1KB per row estimate
        return estimated_memory_mb > (self.max_memory_mb * 0.7)


class QueryOptimizer:
    """Optimize SQL queries for performance"""

    @staticmethod
    def analyze_query(sql: str) -> Dict[str, Any]:
        """Analyze query for optimization opportunities"""
        analysis = {
            'has_joins': 'JOIN' in sql.upper(),
            'has_subqueries': '(' in sql and 'SELECT' in sql.upper(),
            'has_aggregations': any(agg in sql.upper() for agg in ['GROUP BY', 'COUNT', 'SUM', 'AVG']),
            'has_ordering': 'ORDER BY' in sql.upper(),
            'estimated_complexity': 'medium'
        }

        # Estimate complexity
        complexity_score = 0
        if analysis['has_joins']:
            complexity_score += 2
        if analysis['has_subqueries']:
            complexity_score += 3
        if analysis['has_aggregations']:
            complexity_score += 2
        if analysis['has_ordering']:
            complexity_score += 1

        if complexity_score <= 2:
            analysis['estimated_complexity'] = 'low'
        elif complexity_score >= 6:
            analysis['estimated_complexity'] = 'high'

        return analysis

    @staticmethod
    def get_optimized_query(original_query: str, analysis: Dict[str, Any]) -> str:
        """Return optimized version of the query"""
        optimized = original_query

        # Add query hints for complex queries
        if analysis['estimated_complexity'] == 'high':
            if 'SELECT' in optimized.upper():
                optimized = optimized.replace(
                    'SELECT',
                    'SELECT /*+ USE_INDEX, NO_QUERY_TRANSFORMATION */',
                    1
                )

        return optimized


class CacheManager:
    """Intelligent caching for report data"""

    CACHE_PREFIX = 'report_cache'
    DEFAULT_TIMEOUT = 3600  # 1 hour

    @staticmethod
    def generate_cache_key(template_id: int, params: Dict[str, Any]) -> str:
        """Generate consistent cache key for report data"""
        # Create hash from sorted parameters
        param_str = json.dumps(params, sort_keys=True, default=str)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()
        return f"{CacheManager.CACHE_PREFIX}:{template_id}:{param_hash}"

    @staticmethod
    def get_cached_result(cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached report result if available"""
        try:
            cached_data = cache.get(cache_key)
            if cached_data:
                logger.info(f"Cache hit for key: {cache_key}")
                return cached_data
        except Exception as e:
            logger.warning(f"Cache retrieval error: {e}")

        logger.info(f"Cache miss for key: {cache_key}")
        return None

    @staticmethod
    def cache_result(cache_key: str, data: List[Dict[str, Any]], timeout: int = None) -> bool:
        """Cache report result with appropriate timeout"""
        try:
            timeout = timeout or CacheManager.DEFAULT_TIMEOUT
            cache.set(cache_key, data, timeout)
            logger.info(f"Cached result with key: {cache_key}, timeout: {timeout}s")
            return True
        except Exception as e:
            logger.error(f"Cache storage error: {e}")
            return False

    @staticmethod
    def should_cache(row_count: int, query_time: float) -> bool:
        """Determine if result should be cached based on size and generation time"""
        # Cache if query took more than 5 seconds or returned many rows
        return query_time > 5.0 or row_count > 1000


class OptimizedReportGenerator:
    """High-performance report generator with advanced optimizations"""

    def __init__(self, template, export_format, date_range_start=None,
                 date_range_end=None, filters=None, user=None, job_id=None):
        self.template = template
        self.export_format = export_format
        self.date_range_start = date_range_start
        self.date_range_end = date_range_end
        self.filters = filters or {}
        self.user = user
        self.job_id = job_id

        # Performance components
        self.connection_pool = ConnectionPool()
        self.memory_manager = MemoryManager()
        self.query_optimizer = QueryOptimizer()
        self.cache_manager = CacheManager()

        # Performance tracking
        self.metrics = PerformanceMetrics(start_time=time.time())
        self._cancelled = False

    def generate(self) -> Dict[str, Any]:
        """Generate report with full optimization pipeline"""
        try:
            logger.info(f"Starting optimized report generation for template {self.template.id}")

            # Check if task was cancelled before starting
            self._check_cancellation()

            # Execute optimized query
            self._update_progress(10, "Analyzing query")
            query_analysis = self.query_optimizer.analyze_query(self.template.sql_query)

            self._update_progress(20, "Executing optimized query")
            data = self._execute_optimized_query(query_analysis)

            self._check_cancellation()

            # Process and export data
            self._update_progress(60, "Processing data")
            report_data = self._prepare_optimized_report_data(data)

            self._update_progress(80, "Generating export")
            result = self._generate_optimized_export(report_data)

            # Update metrics
            self.metrics.rows_processed = len(data) if data else 0
            total_time = time.time() - self.metrics.start_time

            logger.info(f"Report generation completed in {total_time:.2f}s")
            self._log_performance_metrics()

            return result

        except Exception as e:
            logger.error(f"Optimized report generation failed: {str(e)}")
            self._handle_generation_error(e)
            raise

    def _execute_optimized_query(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute query with full optimization pipeline"""
        start_time = time.time()

        # Prepare parameters and cache key
        params = self._prepare_query_parameters()
        cache_key = self.cache_manager.generate_cache_key(self.template.id, params)

        # Try cache first
        cached_result = self.cache_manager.get_cached_result(cache_key)
        if cached_result:
            self.metrics.cache_hits += 1
            self.metrics.query_time = time.time() - start_time
            return cached_result

        self.metrics.cache_misses += 1

        # Execute query with optimized connection
        with self.connection_pool.get_connection() as conn:
            with conn.cursor() as cursor:
                try:
                    # Get optimized query
                    optimized_query = self.query_optimizer.get_optimized_query(
                        self.template.sql_query, analysis
                    )

                    # Execute with server-side cursor for large results
                    if analysis['estimated_complexity'] == 'high':
                        cursor = conn.cursor(name=f'report_cursor_{self.job_id}')

                    cursor.execute(optimized_query, params)

                    # Process results efficiently
                    columns = [col[0] for col in cursor.description]
                    data = self._fetch_results_optimized(cursor, columns)

                    self.metrics.query_time = time.time() - start_time

                    # Cache if beneficial
                    if self.cache_manager.should_cache(len(data), self.metrics.query_time):
                        self.cache_manager.cache_result(cache_key, data)

                    return data

                except Exception as e:
                    logger.error(f"Optimized query execution failed: {str(e)}")
                    raise

    def _fetch_results_optimized(self, cursor, columns: List[str]) -> List[Dict[str, Any]]:
        """Fetch results with memory optimization and progress tracking"""
        data = []
        batch_size = 1000
        total_processed = 0

        while True:
            self._check_cancellation()

            # Check memory before processing batch
            used_memory, available_memory = self.memory_manager.check_memory()
            if available_memory < 50:  # Less than 50MB available
                logger.warning("Low memory detected, forcing cleanup")
                self.memory_manager.force_cleanup()

            # Fetch batch
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break

            # Convert to dictionaries
            batch_data = [dict(zip(columns, row)) for row in rows]
            data.extend(batch_data)

            total_processed += len(rows)

            # Update progress
            if total_processed % 5000 == 0:
                self._update_progress(
                    30 + min(25, (total_processed // 1000)),
                    f"Processed {total_processed} rows"
                )

            # Update peak memory usage
            current_memory = used_memory
            if current_memory > self.metrics.memory_peak:
                self.metrics.memory_peak = current_memory

        logger.info(f"Fetched {total_processed} rows efficiently")
        return data

    def _prepare_optimized_report_data(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Prepare report data with memory optimization"""
        start_time = time.time()

        if not data:
            return {
                'data': [],
                'metadata': {
                    'title': self.template.name,
                    'generated_at': timezone.now().isoformat(),
                    'row_count': 0,
                    'filters': self.filters,
                    'user': self.user.username if self.user else 'system'
                }
            }

        # Process data in chunks for memory efficiency
        chunk_size = 5000
        processed_data = []

        for i in range(0, len(data), chunk_size):
            self._check_cancellation()

            chunk = data[i:i+chunk_size]
            processed_chunk = self._process_data_chunk(chunk)
            processed_data.extend(processed_chunk)

            # Update progress
            progress = 60 + int((i / len(data)) * 15)
            self._update_progress(progress, f"Processing chunk {i//chunk_size + 1}")

        self.metrics.processing_time = time.time() - start_time

        return {
            'data': processed_data,
            'metadata': {
                'title': self.template.name,
                'generated_at': timezone.now().isoformat(),
                'row_count': len(processed_data),
                'filters': self.filters,
                'user': self.user.username if self.user else 'system',
                'performance_metrics': {
                    'query_time': self.metrics.query_time,
                    'processing_time': self.metrics.processing_time,
                    'memory_peak_mb': self.metrics.memory_peak
                }
            }
        }

    def _process_data_chunk(self, chunk: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a chunk of data with optimizations"""
        # Apply any data transformations needed
        processed_chunk = []

        for row in chunk:
            # Convert any datetime objects to strings for JSON serialization
            processed_row = {}
            for key, value in row.items():
                if isinstance(value, datetime):
                    processed_row[key] = value.isoformat()
                else:
                    processed_row[key] = value
            processed_chunk.append(processed_row)

        return processed_chunk

    def _generate_optimized_export(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate export with memory-efficient streaming"""
        start_time = time.time()

        # Use streaming export for large datasets
        row_count = len(report_data['data'])
        use_streaming = row_count > 10000

        if self.export_format in ['pdf', 'excel', 'xlsx']:
            handler = get_export_handler(self.export_format)

            # Create temporary file
            temp_dir = tempfile.mkdtemp(prefix='report_')
            file_path = os.path.join(temp_dir, f"report_{self.job_id}.{self.export_format}")

            if use_streaming:
                result = self._streaming_export(handler, report_data, file_path)
            else:
                result = handler.export(report_data, file_path)

            self.metrics.export_time = time.time() - start_time
            return result

        else:
            # Handle CSV/JSON formats with memory optimization
            return self._generate_text_export_optimized(report_data)

    def _streaming_export(self, handler, report_data: Dict[str, Any], file_path: str) -> Dict[str, Any]:
        """Streaming export for large datasets"""
        logger.info("Using streaming export for large dataset")

        # For large datasets, process in chunks
        chunk_size = 1000
        data = report_data['data']
        total_chunks = (len(data) + chunk_size - 1) // chunk_size

        # Initialize streaming export (handler-specific implementation needed)
        if hasattr(handler, 'init_streaming_export'):
            handler.init_streaming_export(file_path, report_data['metadata'])

            for i in range(0, len(data), chunk_size):
                self._check_cancellation()

                chunk = data[i:i+chunk_size]
                chunk_data = {'data': chunk, 'metadata': report_data['metadata']}

                handler.append_streaming_data(chunk_data)

                # Update progress
                progress = 80 + int((i / len(data)) * 15)
                self._update_progress(progress, f"Exporting chunk {i//chunk_size + 1}/{total_chunks}")

            return handler.finalize_streaming_export()

        else:
            # Fallback to regular export
            return handler.export(report_data, file_path)

    def _generate_text_export_optimized(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate CSV/JSON with memory optimization"""
        data = report_data['data']

        if self.export_format == 'csv':
            return self._generate_csv_streaming(data)
        elif self.export_format == 'json':
            return self._generate_json_streaming(data)

    def _generate_csv_streaming(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate CSV with streaming for memory efficiency"""
        if not data:
            return {
                'status': 'success',
                'format': 'csv',
                'row_count': 0,
                'data': '',
                'message': 'No data found'
            }

        # Use temporary file for large datasets
        if len(data) > 5000:
            temp_dir = tempfile.mkdtemp(prefix='csv_')
            temp_file = os.path.join(temp_dir, f"report_{self.job_id}.csv")

            with open(temp_file, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=list(data[0].keys()))
                writer.writeheader()

                # Write in chunks
                chunk_size = 1000
                for i in range(0, len(data), chunk_size):
                    self._check_cancellation()
                    chunk = data[i:i+chunk_size]
                    writer.writerows(chunk)

            return {
                'status': 'success',
                'format': 'csv',
                'row_count': len(data),
                'file_path': temp_file,
                'message': f'CSV generated with {len(data)} rows'
            }

        else:
            # Small datasets - generate in memory
            import io
            csv_buffer = io.StringIO()
            writer = csv.DictWriter(csv_buffer, fieldnames=list(data[0].keys()))
            writer.writeheader()
            writer.writerows(data)

            return {
                'status': 'success',
                'format': 'csv',
                'row_count': len(data),
                'data': csv_buffer.getvalue(),
                'message': f'CSV generated with {len(data)} rows'
            }

    def _generate_json_streaming(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate JSON with streaming for memory efficiency"""
        if len(data) > 5000:
            # Large dataset - write to file
            temp_dir = tempfile.mkdtemp(prefix='json_')
            temp_file = os.path.join(temp_dir, f"report_{self.job_id}.json")

            with open(temp_file, 'w', encoding='utf-8') as jsonfile:
                json.dump(data, jsonfile, indent=2, default=str)

            return {
                'status': 'success',
                'format': 'json',
                'row_count': len(data),
                'file_path': temp_file,
                'message': f'JSON generated with {len(data)} rows'
            }

        else:
            # Small dataset - generate in memory
            return {
                'status': 'success',
                'format': 'json',
                'row_count': len(data),
                'data': json.dumps(data, indent=2, default=str),
                'message': f'JSON generated with {len(data)} rows'
            }

    def _prepare_query_parameters(self) -> Dict[str, Any]:
        """Prepare query parameters with validation"""
        params = {}

        # Add date range parameters
        if self.date_range_start:
            params['date_start'] = self.date_range_start
        if self.date_range_end:
            params['date_range_end'] = self.date_range_end

        # Add filter parameters with validation
        for key, value in self.filters.items():
            # Basic SQL injection prevention
            if isinstance(value, str):
                if any(dangerous in value.upper() for dangerous in ['DROP', 'DELETE', 'TRUNCATE']):
                    logger.warning(f"Potentially dangerous filter value detected: {key}={value}")
                    continue
            params[key] = value

        # Add template parameters
        for param_name, param_config in self.template.parameters.items():
            if param_name not in params:
                if 'default' in param_config:
                    params[param_name] = param_config['default']

        return params

    def _check_cancellation(self):
        """Check if task has been cancelled"""
        if self._cancelled:
            raise WorkerLostError("Task was cancelled")

        # Check Celery task status
        if current_task and hasattr(current_task, 'AsyncResult'):
            task_result = current_task.AsyncResult(current_task.request.id)
            if hasattr(task_result, 'state') and task_result.state == 'REVOKED':
                self._cancelled = True
                raise WorkerLostError("Task was revoked")

    def _update_progress(self, percent: int, message: str):
        """Update task progress with Celery"""
        if current_task:
            current_task.update_state(
                state='PROGRESS',
                meta={
                    'current': percent,
                    'total': 100,
                    'percent': percent,
                    'message': message,
                    'metrics': {
                        'memory_mb': self.memory_manager.check_memory()[0],
                        'rows_processed': self.metrics.rows_processed
                    }
                }
            )

    def _log_performance_metrics(self):
        """Log detailed performance metrics"""
        total_time = time.time() - self.metrics.start_time

        logger.info("=== Report Generation Performance Metrics ===")
        logger.info(f"Template: {self.template.name}")
        logger.info(f"Export Format: {self.export_format}")
        logger.info(f"Total Time: {total_time:.2f}s")
        logger.info(f"Query Time: {self.metrics.query_time:.2f}s ({(self.metrics.query_time/total_time*100):.1f}%)")
        logger.info(f"Processing Time: {self.metrics.processing_time:.2f}s ({(self.metrics.processing_time/total_time*100):.1f}%)")
        logger.info(f"Export Time: {self.metrics.export_time:.2f}s ({(self.metrics.export_time/total_time*100):.1f}%)")
        logger.info(f"Rows Processed: {self.metrics.rows_processed:,}")
        logger.info(f"Peak Memory: {self.metrics.memory_peak} MB")
        logger.info(f"Cache Performance: {self.metrics.cache_hits} hits, {self.metrics.cache_misses} misses")

        if self.metrics.rows_processed > 0:
            rows_per_second = self.metrics.rows_processed / total_time
            logger.info(f"Processing Rate: {rows_per_second:.0f} rows/second")

    def _handle_generation_error(self, error: Exception):
        """Handle errors during generation"""
        logger.error(f"Report generation error: {str(error)}")

        # Update job status if we have a job ID
        if self.job_id:
            try:
                job = ReportJob.objects.get(job_id=self.job_id)
                job.mark_as_failed(str(error))
            except ReportJob.DoesNotExist:
                logger.error(f"Could not find ReportJob with ID {self.job_id}")

    def cancel(self):
        """Cancel the report generation"""
        self._cancelled = True
        logger.info(f"Report generation cancelled for job {self.job_id}")