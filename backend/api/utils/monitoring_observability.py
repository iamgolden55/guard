"""
Comprehensive Monitoring & Observability System
==============================================

This module provides detailed monitoring, metrics collection, health checks,
and alerting for the reporting system.
"""

import time
import logging
import json
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from threading import Lock
import psutil
import redis

from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db import connection, connections
from django.core.cache import cache

from ..models import ReportJob, ReportTemplate

logger = logging.getLogger(__name__)


@dataclass
class HealthCheckResult:
    """Result of a health check"""
    service: str
    healthy: bool
    response_time_ms: float
    details: Dict[str, Any]
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = timezone.now()


@dataclass
class MetricPoint:
    """Single metric data point"""
    name: str
    value: float
    tags: Dict[str, str]
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = timezone.now()


@dataclass
class PerformanceBenchmark:
    """Performance benchmark data"""
    operation: str
    duration_ms: float
    rows_processed: int
    memory_used_mb: int
    success: bool
    error_message: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = timezone.now()

    @property
    def throughput_rows_per_second(self) -> float:
        """Calculate throughput in rows per second"""
        if self.duration_ms > 0:
            return (self.rows_processed * 1000) / self.duration_ms
        return 0


class MetricsCollector:
    """Collect and aggregate system metrics"""

    def __init__(self, max_history_size: int = 10000):
        self.metrics_history = deque(maxlen=max_history_size)
        self.performance_benchmarks = deque(maxlen=1000)
        self._lock = Lock()

        # Metric aggregations
        self.metric_aggregates = defaultdict(list)

    def record_metric(self, name: str, value: float, tags: Dict[str, str] = None):
        """Record a metric point"""
        metric = MetricPoint(name=name, value=value, tags=tags or {})

        with self._lock:
            self.metrics_history.append(metric)
            self.metric_aggregates[name].append(metric)

            # Keep only recent aggregates to prevent memory bloat
            if len(self.metric_aggregates[name]) > 1000:
                self.metric_aggregates[name] = self.metric_aggregates[name][-500:]

    def record_performance_benchmark(self, operation: str, duration_ms: float,
                                   rows_processed: int, memory_used_mb: int,
                                   success: bool = True, error_message: str = None):
        """Record performance benchmark"""
        benchmark = PerformanceBenchmark(
            operation=operation,
            duration_ms=duration_ms,
            rows_processed=rows_processed,
            memory_used_mb=memory_used_mb,
            success=success,
            error_message=error_message
        )

        with self._lock:
            self.performance_benchmarks.append(benchmark)

    def get_metric_summary(self, metric_name: str, minutes: int = 60) -> Dict[str, float]:
        """Get summary statistics for a metric over time period"""
        cutoff_time = timezone.now() - timedelta(minutes=minutes)

        with self._lock:
            recent_metrics = [
                m for m in self.metric_aggregates.get(metric_name, [])
                if m.timestamp >= cutoff_time
            ]

        if not recent_metrics:
            return {}

        values = [m.value for m in recent_metrics]
        return {
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'avg': sum(values) / len(values),
            'latest': values[-1] if values else 0
        }

    def get_performance_summary(self, operation: str = None,
                              minutes: int = 60) -> Dict[str, Any]:
        """Get performance summary for operations"""
        cutoff_time = timezone.now() - timedelta(minutes=minutes)

        with self._lock:
            recent_benchmarks = [
                b for b in self.performance_benchmarks
                if b.timestamp >= cutoff_time and
                   (operation is None or b.operation == operation)
            ]

        if not recent_benchmarks:
            return {}

        total_benchmarks = len(recent_benchmarks)
        successful_benchmarks = [b for b in recent_benchmarks if b.success]
        failed_benchmarks = [b for b in recent_benchmarks if not b.success]

        success_rate = len(successful_benchmarks) / total_benchmarks if total_benchmarks > 0 else 0

        # Calculate throughput statistics
        throughputs = [b.throughput_rows_per_second for b in successful_benchmarks if b.rows_processed > 0]
        durations = [b.duration_ms for b in successful_benchmarks]
        memory_usage = [b.memory_used_mb for b in successful_benchmarks]

        summary = {
            'operation': operation or 'all',
            'period_minutes': minutes,
            'total_operations': total_benchmarks,
            'successful_operations': len(successful_benchmarks),
            'failed_operations': len(failed_benchmarks),
            'success_rate': success_rate,
            'error_rate': 1 - success_rate
        }

        if durations:
            summary['performance'] = {
                'avg_duration_ms': sum(durations) / len(durations),
                'min_duration_ms': min(durations),
                'max_duration_ms': max(durations)
            }

        if throughputs:
            summary['throughput'] = {
                'avg_rows_per_second': sum(throughputs) / len(throughputs),
                'min_rows_per_second': min(throughputs),
                'max_rows_per_second': max(throughputs)
            }

        if memory_usage:
            summary['memory'] = {
                'avg_memory_mb': sum(memory_usage) / len(memory_usage),
                'min_memory_mb': min(memory_usage),
                'max_memory_mb': max(memory_usage)
            }

        # Common error patterns
        if failed_benchmarks:
            error_patterns = defaultdict(int)
            for benchmark in failed_benchmarks:
                if benchmark.error_message:
                    # Classify errors
                    error_type = self._classify_error(benchmark.error_message)
                    error_patterns[error_type] += 1

            summary['error_patterns'] = dict(error_patterns)

        return summary

    def _classify_error(self, error_message: str) -> str:
        """Classify error message into category"""
        error_lower = error_message.lower()

        if any(keyword in error_lower for keyword in ['connection', 'network']):
            return 'network_error'
        elif any(keyword in error_lower for keyword in ['memory', 'ram']):
            return 'memory_error'
        elif any(keyword in error_lower for keyword in ['database', 'sql']):
            return 'database_error'
        elif 'timeout' in error_lower:
            return 'timeout_error'
        else:
            return 'system_error'


class HealthChecker:
    """Perform health checks on system components"""

    def __init__(self):
        self.health_checks = {}
        self.last_results = {}
        self._register_default_checks()

    def _register_default_checks(self):
        """Register default health checks"""
        self.register_health_check('database', self._check_database_health)
        self.register_health_check('redis', self._check_redis_health)
        self.register_health_check('file_system', self._check_file_system_health)
        self.register_health_check('report_system', self._check_report_system_health)

    def register_health_check(self, name: str, check_function: Callable[[], HealthCheckResult]):
        """Register a health check function"""
        self.health_checks[name] = check_function

    def run_health_check(self, service_name: str) -> HealthCheckResult:
        """Run health check for specific service"""
        if service_name not in self.health_checks:
            return HealthCheckResult(
                service=service_name,
                healthy=False,
                response_time_ms=0,
                details={'error': f'No health check registered for {service_name}'}
            )

        start_time = time.time()
        try:
            result = self.health_checks[service_name]()
            result.response_time_ms = (time.time() - start_time) * 1000
            self.last_results[service_name] = result
            return result
        except Exception as e:
            logger.error(f"Health check failed for {service_name}: {str(e)}")
            result = HealthCheckResult(
                service=service_name,
                healthy=False,
                response_time_ms=(time.time() - start_time) * 1000,
                details={'error': str(e), 'traceback': traceback.format_exc()}
            )
            self.last_results[service_name] = result
            return result

    def run_all_health_checks(self) -> Dict[str, HealthCheckResult]:
        """Run all registered health checks"""
        results = {}
        for service_name in self.health_checks:
            results[service_name] = self.run_health_check(service_name)
        return results

    def get_overall_health_status(self) -> Dict[str, Any]:
        """Get overall system health status"""
        results = self.run_all_health_checks()

        healthy_services = sum(1 for r in results.values() if r.healthy)
        total_services = len(results)
        overall_healthy = healthy_services == total_services

        return {
            'healthy': overall_healthy,
            'services_healthy': healthy_services,
            'total_services': total_services,
            'health_percentage': (healthy_services / total_services * 100) if total_services > 0 else 0,
            'services': {name: asdict(result) for name, result in results.items()},
            'timestamp': timezone.now().isoformat()
        }

    def _check_database_health(self) -> HealthCheckResult:
        """Check database connectivity and performance"""
        try:
            start_time = time.time()

            # Test basic connectivity
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

            # Test report-related tables
            cursor.execute("SELECT COUNT(*) FROM report_jobs WHERE created_at > %s",
                          [timezone.now() - timedelta(days=1)])
            recent_jobs = cursor.fetchone()[0]

            db_time = (time.time() - start_time) * 1000

            # Check connection pool status
            pool_info = self._get_connection_pool_info()

            return HealthCheckResult(
                service='database',
                healthy=db_time < 1000,  # Healthy if response < 1 second
                response_time_ms=db_time,
                details={
                    'recent_jobs_24h': recent_jobs,
                    'connection_pool': pool_info,
                    'query_response_time_ms': db_time
                }
            )

        except Exception as e:
            return HealthCheckResult(
                service='database',
                healthy=False,
                response_time_ms=0,
                details={'error': str(e)}
            )

    def _check_redis_health(self) -> HealthCheckResult:
        """Check Redis connectivity and performance"""
        try:
            start_time = time.time()

            # Test Redis connection
            r = redis.Redis.from_url('redis://localhost:6379')
            r.ping()

            # Test cache operations
            test_key = 'health_check_test'
            r.set(test_key, 'test_value', ex=60)
            value = r.get(test_key)
            r.delete(test_key)

            redis_time = (time.time() - start_time) * 1000

            # Get Redis info
            redis_info = r.info()

            return HealthCheckResult(
                service='redis',
                healthy=redis_time < 500 and value == b'test_value',
                response_time_ms=redis_time,
                details={
                    'connected_clients': redis_info.get('connected_clients'),
                    'used_memory_mb': redis_info.get('used_memory', 0) / (1024 * 1024),
                    'keyspace_hits': redis_info.get('keyspace_hits'),
                    'keyspace_misses': redis_info.get('keyspace_misses')
                }
            )

        except Exception as e:
            return HealthCheckResult(
                service='redis',
                healthy=False,
                response_time_ms=0,
                details={'error': str(e)}
            )

    def _check_file_system_health(self) -> HealthCheckResult:
        """Check file system health and disk space"""
        try:
            start_time = time.time()

            # Check disk usage
            disk_usage = psutil.disk_usage('/')
            disk_percent = (disk_usage.used / disk_usage.total) * 100

            # Check if we can write to temp directory
            import tempfile
            import os

            test_file = None
            try:
                with tempfile.NamedTemporaryFile(delete=False) as f:
                    test_file = f.name
                    f.write(b'health check test')

                # Try to read back
                with open(test_file, 'rb') as f:
                    content = f.read()

                write_test_success = content == b'health check test'

            finally:
                if test_file and os.path.exists(test_file):
                    os.unlink(test_file)

            fs_time = (time.time() - start_time) * 1000

            return HealthCheckResult(
                service='file_system',
                healthy=disk_percent < 90 and write_test_success,
                response_time_ms=fs_time,
                details={
                    'disk_usage_percent': disk_percent,
                    'disk_free_gb': disk_usage.free / (1024 ** 3),
                    'write_test_success': write_test_success
                }
            )

        except Exception as e:
            return HealthCheckResult(
                service='file_system',
                healthy=False,
                response_time_ms=0,
                details={'error': str(e)}
            )

    def _check_report_system_health(self) -> HealthCheckResult:
        """Check report system specific health"""
        try:
            start_time = time.time()

            # Check recent report job statistics
            recent_jobs = ReportJob.objects.filter(
                created_at__gte=timezone.now() - timedelta(hours=24)
            )

            total_recent = recent_jobs.count()
            completed_recent = recent_jobs.filter(status='completed').count()
            failed_recent = recent_jobs.filter(status='failed').count()
            processing_recent = recent_jobs.filter(status='processing').count()

            success_rate = (completed_recent / total_recent * 100) if total_recent > 0 else 100

            # Check for stuck jobs (processing for too long)
            stuck_jobs = ReportJob.objects.filter(
                status='processing',
                started_at__lt=timezone.now() - timedelta(hours=2)
            ).count()

            # Check template availability
            active_templates = ReportTemplate.objects.filter(is_active=True).count()

            system_time = (time.time() - start_time) * 1000

            healthy = (success_rate >= 80 and stuck_jobs == 0 and active_templates > 0)

            return HealthCheckResult(
                service='report_system',
                healthy=healthy,
                response_time_ms=system_time,
                details={
                    'recent_24h': {
                        'total_jobs': total_recent,
                        'completed_jobs': completed_recent,
                        'failed_jobs': failed_recent,
                        'processing_jobs': processing_recent,
                        'success_rate_percent': success_rate
                    },
                    'stuck_jobs': stuck_jobs,
                    'active_templates': active_templates
                }
            )

        except Exception as e:
            return HealthCheckResult(
                service='report_system',
                healthy=False,
                response_time_ms=0,
                details={'error': str(e)}
            )

    def _get_connection_pool_info(self) -> Dict[str, Any]:
        """Get database connection pool information"""
        try:
            # This is Django-specific and may need adjustment based on your setup
            pool_info = {}
            for alias, conn in connections.all():
                if hasattr(conn, 'connection') and conn.connection:
                    pool_info[alias] = {
                        'queries': len(conn.queries),
                        'vendor': conn.vendor
                    }
            return pool_info
        except Exception:
            return {'error': 'Could not retrieve connection pool info'}


class AlertManager:
    """Manage alerting for system issues"""

    def __init__(self):
        self.alert_thresholds = {
            'disk_usage_percent': 85,
            'memory_usage_percent': 85,
            'cpu_usage_percent': 90,
            'error_rate_percent': 10,
            'response_time_ms': 5000
        }

        self.alert_cooldowns = {}  # Prevent spam
        self.cooldown_period = timedelta(minutes=30)

    def check_and_alert(self, metrics: Dict[str, Any], health_status: Dict[str, Any]):
        """Check metrics and send alerts if thresholds are exceeded"""
        alerts_to_send = []

        # Check health status alerts
        if not health_status['healthy']:
            alert_key = 'system_unhealthy'
            if self._should_send_alert(alert_key):
                alerts_to_send.append({
                    'type': 'health',
                    'severity': 'critical',
                    'message': f"System health check failed: {health_status['services_healthy']}/{health_status['total_services']} services healthy",
                    'details': health_status
                })

        # Check performance metrics alerts
        system_metrics = self._get_current_system_metrics()

        for metric_name, threshold in self.alert_thresholds.items():
            if metric_name in system_metrics:
                current_value = system_metrics[metric_name]
                if current_value > threshold:
                    alert_key = f'{metric_name}_threshold'
                    if self._should_send_alert(alert_key):
                        alerts_to_send.append({
                            'type': 'performance',
                            'severity': 'warning' if current_value < threshold * 1.1 else 'critical',
                            'message': f"{metric_name} exceeded threshold: {current_value:.1f} > {threshold}",
                            'details': {'metric': metric_name, 'value': current_value, 'threshold': threshold}
                        })

        # Send alerts
        for alert in alerts_to_send:
            self._send_alert(alert)

    def _should_send_alert(self, alert_key: str) -> bool:
        """Check if alert should be sent based on cooldown"""
        last_sent = self.alert_cooldowns.get(alert_key)
        if last_sent is None:
            return True

        return timezone.now() - last_sent > self.cooldown_period

    def _send_alert(self, alert: Dict[str, Any]):
        """Send alert via configured channels"""
        try:
            # Log alert
            logger.critical(f"ALERT [{alert['severity'].upper()}]: {alert['message']}")

            # Send email alert if configured
            if hasattr(settings, 'ALERT_EMAIL_RECIPIENTS'):
                self._send_email_alert(alert)

            # Update cooldown
            alert_key = alert.get('type', 'unknown')
            self.alert_cooldowns[alert_key] = timezone.now()

        except Exception as e:
            logger.error(f"Failed to send alert: {str(e)}")

    def _send_email_alert(self, alert: Dict[str, Any]):
        """Send email alert"""
        subject = f"[{alert['severity'].upper()}] Report System Alert: {alert['type']}"
        message = f"""
Alert Details:
- Type: {alert['type']}
- Severity: {alert['severity']}
- Message: {alert['message']}
- Timestamp: {timezone.now().isoformat()}

Additional Details:
{json.dumps(alert.get('details', {}), indent=2, default=str)}

This is an automated alert from the Security Staff Management Report System.
        """

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=settings.ALERT_EMAIL_RECIPIENTS,
                fail_silently=False
            )
            logger.info(f"Alert email sent for {alert['type']}")
        except Exception as e:
            logger.error(f"Failed to send alert email: {str(e)}")

    def _get_current_system_metrics(self) -> Dict[str, float]:
        """Get current system metrics for alerting"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            return {
                'cpu_usage_percent': cpu_percent,
                'memory_usage_percent': memory.percent,
                'disk_usage_percent': (disk.used / disk.total) * 100
            }
        except Exception:
            return {}


class MonitoringObservabilitySystem:
    """Main monitoring and observability system"""

    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.health_checker = HealthChecker()
        self.alert_manager = AlertManager()

        # Start background monitoring
        self._start_background_monitoring()

    def _start_background_monitoring(self):
        """Start background monitoring tasks"""
        # This would typically be implemented with Celery beat or similar scheduler
        pass

    def get_comprehensive_status(self) -> Dict[str, Any]:
        """Get comprehensive system status and metrics"""
        health_status = self.health_checker.get_overall_health_status()

        # Get performance summaries for different operations
        report_generation_perf = self.metrics_collector.get_performance_summary('report_generation', 60)
        export_perf = self.metrics_collector.get_performance_summary('export', 60)

        # System resource metrics
        system_metrics = self._get_detailed_system_metrics()

        # Recent job statistics
        job_stats = self._get_job_statistics()

        return {
            'timestamp': timezone.now().isoformat(),
            'overall_status': {
                'healthy': health_status['healthy'],
                'services_status': health_status['services']
            },
            'performance': {
                'report_generation': report_generation_perf,
                'export_operations': export_perf
            },
            'system_resources': system_metrics,
            'job_statistics': job_stats,
            'health_details': health_status
        }

    def _get_detailed_system_metrics(self) -> Dict[str, Any]:
        """Get detailed system resource metrics"""
        try:
            cpu_times = psutil.cpu_times()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()

            return {
                'cpu': {
                    'percent': psutil.cpu_percent(interval=1),
                    'count': psutil.cpu_count(),
                    'times': {
                        'user': cpu_times.user,
                        'system': cpu_times.system,
                        'idle': cpu_times.idle
                    }
                },
                'memory': {
                    'total_gb': memory.total / (1024 ** 3),
                    'available_gb': memory.available / (1024 ** 3),
                    'used_gb': memory.used / (1024 ** 3),
                    'percent': memory.percent
                },
                'disk': {
                    'total_gb': disk.total / (1024 ** 3),
                    'free_gb': disk.free / (1024 ** 3),
                    'used_gb': disk.used / (1024 ** 3),
                    'percent': (disk.used / disk.total) * 100
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                }
            }
        except Exception as e:
            logger.error(f"Error getting system metrics: {str(e)}")
            return {'error': str(e)}

    def _get_job_statistics(self) -> Dict[str, Any]:
        """Get report job statistics"""
        try:
            now = timezone.now()
            last_24h = now - timedelta(hours=24)
            last_1h = now - timedelta(hours=1)

            # 24 hour statistics
            jobs_24h = ReportJob.objects.filter(created_at__gte=last_24h)
            stats_24h = {
                'total': jobs_24h.count(),
                'completed': jobs_24h.filter(status='completed').count(),
                'failed': jobs_24h.filter(status='failed').count(),
                'processing': jobs_24h.filter(status='processing').count(),
                'pending': jobs_24h.filter(status='pending').count()
            }

            # 1 hour statistics
            jobs_1h = ReportJob.objects.filter(created_at__gte=last_1h)
            stats_1h = {
                'total': jobs_1h.count(),
                'completed': jobs_1h.filter(status='completed').count(),
                'failed': jobs_1h.filter(status='failed').count(),
                'processing': jobs_1h.filter(status='processing').count(),
                'pending': jobs_1h.filter(status='pending').count()
            }

            return {
                'last_24_hours': stats_24h,
                'last_1_hour': stats_1h
            }

        except Exception as e:
            logger.error(f"Error getting job statistics: {str(e)}")
            return {'error': str(e)}

    def record_operation_performance(self, operation: str, duration_ms: float,
                                   rows_processed: int = 0, memory_used_mb: int = 0,
                                   success: bool = True, error_message: str = None):
        """Record performance data for an operation"""
        self.metrics_collector.record_performance_benchmark(
            operation=operation,
            duration_ms=duration_ms,
            rows_processed=rows_processed,
            memory_used_mb=memory_used_mb,
            success=success,
            error_message=error_message
        )

    def run_health_checks(self) -> Dict[str, Any]:
        """Run all health checks and return results"""
        return self.health_checker.get_overall_health_status()

    def check_alerts(self):
        """Check for alert conditions and send notifications"""
        try:
            health_status = self.health_checker.get_overall_health_status()
            system_metrics = self._get_detailed_system_metrics()

            self.alert_manager.check_and_alert(system_metrics, health_status)

        except Exception as e:
            logger.error(f"Error checking alerts: {str(e)}")


# Global monitoring instance
monitoring_system = MonitoringObservabilitySystem()