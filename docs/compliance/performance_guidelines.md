# Performance Guidelines and Caching Strategies

## Overview

This document provides comprehensive performance optimization guidelines for the Regional Compliance API system. These strategies ensure sub-second response times, optimal resource utilization, and scalable performance under high load conditions.

## Performance Targets

### API Response Time SLAs

| Operation Type | Target (95th percentile) | Maximum Acceptable |
|---|---|---|
| Cached compliance data retrieval | <100ms | 200ms |
| Real-time schedule validation | <500ms | 1000ms |
| Regional comparison queries | <2000ms | 3000ms |
| Complex violation analysis | <3000ms | 5000ms |
| Report generation | <5000ms | 10000ms |

### System Performance Metrics

| Metric | Target | Monitoring Threshold |
|---|---|---|
| API Uptime | 99.9% | <99.8% triggers alert |
| Cache Hit Rate | >85% | <80% triggers investigation |
| Database Query Time | <50ms average | >100ms average triggers alert |
| Memory Usage | <80% of available | >90% triggers scaling |
| CPU Usage | <70% average | >85% triggers scaling |

## Multi-Layer Caching Architecture

### Layer 1: Redis Cache (Hot Data)

**Purpose**: Frequently accessed compliance data with sub-millisecond access times.

**Configuration**:
```python
# Redis configuration for compliance caching
REDIS_COMPLIANCE_CONFIG = {
    'HOST': 'redis-compliance.internal',
    'PORT': 6379,
    'DB': 1,  # Dedicated DB for compliance
    'PASSWORD': 'secure_redis_password',
    'MAX_CONNECTIONS': 50,
    'SOCKET_TIMEOUT': 5,
    'SOCKET_CONNECT_TIMEOUT': 5,
    'RETRY_ON_TIMEOUT': True,
    'HEALTH_CHECK_INTERVAL': 30
}

# Connection pool
import redis
from redis.connection import ConnectionPool

compliance_redis_pool = ConnectionPool(
    host=REDIS_COMPLIANCE_CONFIG['HOST'],
    port=REDIS_COMPLIANCE_CONFIG['PORT'],
    db=REDIS_COMPLIANCE_CONFIG['DB'],
    password=REDIS_COMPLIANCE_CONFIG['PASSWORD'],
    max_connections=REDIS_COMPLIANCE_CONFIG['MAX_CONNECTIONS'],
    socket_timeout=REDIS_COMPLIANCE_CONFIG['SOCKET_TIMEOUT'],
    socket_connect_timeout=REDIS_COMPLIANCE_CONFIG['SOCKET_CONNECT_TIMEOUT'],
    retry_on_timeout=REDIS_COMPLIANCE_CONFIG['RETRY_ON_TIMEOUT']
)

compliance_redis = redis.Redis(connection_pool=compliance_redis_pool)
```

**Cache Key Strategy**:
```python
# Hierarchical cache key naming convention
CACHE_KEY_PATTERNS = {
    'user_compliance': 'comp:user:{user_id}:status',
    'weekly_hours': 'comp:user:{user_id}:week:{year}-W{week}:hours',
    'regulation': 'comp:reg:{region_code}:rules',
    'violation_count': 'comp:user:{user_id}:violations:count',
    'venue_region': 'comp:venue:{venue_id}:region',
    'schedule_validation': 'comp:user:{user_id}:schedule:{hash}:validation',
    'comparison': 'comp:compare:{region_codes_hash}:matrix'
}

def generate_cache_key(pattern: str, **kwargs) -> str:
    """Generate standardized cache keys"""
    return pattern.format(**kwargs)

# Example usage
user_status_key = generate_cache_key(
    CACHE_KEY_PATTERNS['user_compliance'], 
    user_id=123
)
# Result: 'comp:user:123:status'
```

**TTL Strategy**:
```python
CACHE_TTL_SETTINGS = {
    'user_compliance_status': 300,      # 5 minutes - frequently changing
    'weekly_hours_calculation': 1800,   # 30 minutes - changes during shifts
    'regulation_rules': 86400,          # 24 hours - rarely changes
    'violation_counts': 600,            # 10 minutes - moderate frequency
    'venue_region_mapping': 3600,      # 1 hour - static data
    'schedule_validation': 1800,        # 30 minutes - session-based
    'comparison_matrix': 7200,          # 2 hours - complex calculations
    'user_metrics_summary': 3600,      # 1 hour - aggregated data
}

def set_with_appropriate_ttl(cache_type: str, key: str, value: any):
    """Set cache with appropriate TTL based on data type"""
    ttl = CACHE_TTL_SETTINGS.get(cache_type, 3600)  # Default 1 hour
    compliance_redis.setex(key, ttl, json.dumps(value))
```

### Layer 2: Database Query Cache

**Purpose**: Cache expensive database queries and aggregations.

**Query Optimization**:
```python
from django.core.cache import cache
from django.db import connection
import hashlib

class OptimizedComplianceQueries:
    """Optimized query methods with caching"""
    
    @staticmethod
    def get_user_weekly_hours(user_id: int, year: int, week: int) -> dict:
        """Get user's weekly hours with aggressive caching"""
        cache_key = f"weekly_hours:{user_id}:{year}:W{week}"
        
        # Check cache first
        cached_result = cache.get(cache_key)
        if cached_result:
            return cached_result
        
        # Execute optimized query
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(
                        EXTRACT(EPOCH FROM (end_time - start_time))/3600
                    ), 0) as total_hours,
                    COALESCE(SUM(
                        CASE WHEN overtime_hours > 0 
                        THEN overtime_hours 
                        ELSE 0 END
                    ), 0) as overtime_hours,
                    COUNT(*) as shift_count
                FROM api_shift 
                WHERE user_id = %s 
                AND EXTRACT(YEAR FROM start_time) = %s 
                AND EXTRACT(WEEK FROM start_time) = %s
                AND status = 'completed'
            """, [user_id, year, week])
            
            result = cursor.fetchone()
            
        weekly_data = {
            'total_hours': float(result[0]),
            'overtime_hours': float(result[1]),
            'shift_count': int(result[2]),
            'calculated_at': timezone.now().isoformat()
        }
        
        # Cache for 30 minutes
        cache.set(cache_key, weekly_data, 1800)
        return weekly_data
    
    @staticmethod
    def get_compliance_violations_summary(user_id: int, days: int = 30) -> dict:
        """Get violation summary with optimized query"""
        cache_key = f"violations_summary:{user_id}:{days}d"
        
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        # Use optimized manager method
        from api.models import ComplianceViolation
        
        violations = ComplianceViolation.objects.recent_violations(days=days).filter(
            user=user_id
        ).values('severity').annotate(
            count=Count('id')
        ).order_by('severity')
        
        summary = {
            'total_violations': 0,
            'by_severity': {},
            'resolution_rate': 0
        }
        
        for violation in violations:
            summary['by_severity'][violation['severity']] = violation['count']
            summary['total_violations'] += violation['count']
        
        # Calculate resolution rate
        resolved_count = ComplianceViolation.objects.filter(
            user=user_id,
            created_at__gte=timezone.now() - timedelta(days=days)
        ).exclude(resolution_status='open').count()
        
        if summary['total_violations'] > 0:
            summary['resolution_rate'] = (resolved_count / summary['total_violations']) * 100
        
        # Cache for 10 minutes
        cache.set(cache_key, summary, 600)
        return summary
```

### Layer 3: CDN Edge Cache

**Purpose**: Cache static regulation content and documentation at edge locations.

**CDN Configuration**:
```nginx
# Nginx configuration for compliance API CDN
location /api/v1/compliance/regulations/ {
    # Cache static regulation content
    proxy_cache compliance_zone;
    proxy_cache_valid 200 24h;
    proxy_cache_valid 404 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri$args";
    
    # Add cache headers
    add_header X-Cache-Status $upstream_cache_status;
    add_header Cache-Control "public, max-age=86400";
    
    proxy_pass http://compliance_backend;
}

location /api/v1/compliance/regional/compare/ {
    # Cache comparison results
    proxy_cache compliance_zone;
    proxy_cache_valid 200 2h;
    proxy_cache_key "$scheme$request_method$host$request_uri$sorted_args";
    
    add_header X-Cache-Status $upstream_cache_status;
    add_header Cache-Control "public, max-age=7200";
    
    proxy_pass http://compliance_backend;
}
```

## Database Optimization

### Index Strategy

**Primary Indexes**:
```sql
-- High-performance indexes for compliance queries
CREATE INDEX CONCURRENTLY idx_compliance_violations_user_created 
ON compliance_violations (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_compliance_violations_type_severity 
ON compliance_violations (violation_type, severity, resolution_status);

CREATE INDEX CONCURRENTLY idx_shifts_user_timerange 
ON api_shift (user_id, start_time, end_time) 
WHERE status = 'completed';

CREATE INDEX CONCURRENTLY idx_working_hours_metrics_user_period 
ON working_hours_metrics (user_id, period_type, period_start DESC);

-- GIN indexes for JSON field queries
CREATE INDEX CONCURRENTLY idx_working_hours_regulation_uk_rules 
ON api_workinghours_regulation USING GIN (uk_rules);

CREATE INDEX CONCURRENTLY idx_working_hours_regulation_us_rules 
ON api_workinghours_regulation USING GIN (us_federal_rules);

CREATE INDEX CONCURRENTLY idx_compliance_violation_evidence 
ON compliance_violations USING GIN (evidence_data);
```

**Composite Indexes for Complex Queries**:
```sql
-- Multi-column indexes for frequent query patterns
CREATE INDEX CONCURRENTLY idx_violations_resolution_workflow 
ON compliance_violations (resolution_status, severity, created_at DESC, user_id);

CREATE INDEX CONCURRENTLY idx_shifts_compliance_validation 
ON api_shift (user_id, venue_id, start_time, status) 
INCLUDE (end_time, shift_type);

CREATE INDEX CONCURRENTLY idx_metrics_reporting 
ON working_hours_metrics (period_type, period_start, compliance_score) 
INCLUDE (user_id, total_hours_worked, violation_count);
```

### Query Optimization Patterns

**Efficient Pagination**:
```python
def get_violations_paginated(user_id: int, page: int = 1, limit: int = 20) -> dict:
    """Efficient cursor-based pagination for violations"""
    offset = (page - 1) * limit
    
    # Use cursor-based pagination for better performance
    violations = ComplianceViolation.objects.select_related(
        'user', 'shift', 'resolved_by'
    ).prefetch_related(
        'related_shifts'
    ).filter(
        user_id=user_id
    ).order_by(
        '-created_at', '-id'  # Stable ordering
    )[offset:offset + limit + 1]  # Fetch one extra to check if more exist
    
    has_more = len(violations) > limit
    if has_more:
        violations = violations[:limit]
    
    return {
        'violations': [v.to_dict() for v in violations],
        'pagination': {
            'page': page,
            'limit': limit,
            'has_more': has_more,
            'next_page': page + 1 if has_more else None
        }
    }
```

**Bulk Operations**:
```python
def bulk_update_compliance_metrics(user_ids: List[int], period_start: date) -> int:
    """Efficiently update metrics for multiple users"""
    from django.db import transaction
    
    with transaction.atomic():
        # Use bulk operations for performance
        metrics_to_create = []
        metrics_to_update = []
        
        for user_id in user_ids:
            # Calculate metrics for user
            metrics_data = calculate_user_metrics(user_id, period_start)
            
            try:
                existing_metric = WorkingHoursMetrics.objects.get(
                    user_id=user_id,
                    period_start=period_start,
                    period_type='weekly'
                )
                # Update existing
                for field, value in metrics_data.items():
                    setattr(existing_metric, field, value)
                metrics_to_update.append(existing_metric)
                
            except WorkingHoursMetrics.DoesNotExist:
                # Create new
                metrics_to_create.append(WorkingHoursMetrics(
                    user_id=user_id,
                    period_start=period_start,
                    period_type='weekly',
                    **metrics_data
                ))
        
        # Bulk operations
        created_count = 0
        updated_count = 0
        
        if metrics_to_create:
            WorkingHoursMetrics.objects.bulk_create(
                metrics_to_create, 
                batch_size=100
            )
            created_count = len(metrics_to_create)
        
        if metrics_to_update:
            WorkingHoursMetrics.objects.bulk_update(
                metrics_to_update,
                fields=['total_hours_worked', 'overtime_hours', 'violation_count', 
                       'compliance_score', 'last_updated'],
                batch_size=100
            )
            updated_count = len(metrics_to_update)
        
        return created_count + updated_count
```

## Background Processing

### Celery Task Optimization

**Task Configuration**:
```python
# celery_config.py
from celery import Celery

app = Celery('compliance_tasks')

app.conf.update(
    # Task routing for compliance tasks
    task_routes={
        'compliance.tasks.calculate_metrics': {'queue': 'compliance_heavy'},
        'compliance.tasks.validate_schedule': {'queue': 'compliance_fast'},
        'compliance.tasks.generate_report': {'queue': 'compliance_reports'},
        'compliance.tasks.send_notifications': {'queue': 'notifications'}
    },
    
    # Optimization settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Performance tuning
    worker_prefetch_multiplier=4,
    task_acks_late=True,
    worker_disable_rate_limits=True,
    
    # Result backend
    result_backend='redis://redis-compliance:6379/2',
    result_expires=3600,
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True
)
```

**Optimized Task Implementation**:
```python
from celery import shared_task
from celery.utils.log import get_task_logger
from django.core.cache import cache
import time

logger = get_task_logger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def calculate_weekly_compliance_metrics(self, user_id: int, year: int, week: int):
    """Calculate weekly compliance metrics with error handling and caching"""
    task_id = self.request.id
    cache_key = f"task:metrics:{user_id}:{year}:W{week}"
    
    # Check if already processing
    if cache.get(f"{cache_key}:processing"):
        logger.info(f"Task {task_id}: Metrics calculation already in progress")
        return {"status": "already_processing"}
    
    # Mark as processing
    cache.set(f"{cache_key}:processing", task_id, 600)  # 10 minute lock
    
    try:
        start_time = time.time()
        
        # Perform calculation
        metrics = OptimizedComplianceQueries.calculate_user_metrics(
            user_id, year, week
        )
        
        # Update database
        working_hours_metric, created = WorkingHoursMetrics.objects.update_or_create(
            user_id=user_id,
            period_type='weekly',
            period_start=date(year, 1, 1) + timedelta(weeks=week-1),
            defaults=metrics
        )
        
        calculation_time = time.time() - start_time
        
        # Cache result
        cache.set(cache_key, {
            'metrics': metrics,
            'calculation_time': calculation_time,
            'calculated_at': timezone.now().isoformat()
        }, 1800)
        
        # Clear processing lock
        cache.delete(f"{cache_key}:processing")
        
        logger.info(f"Task {task_id}: Completed in {calculation_time:.2f}s")
        
        return {
            'status': 'completed',
            'user_id': user_id,
            'metrics': metrics,
            'calculation_time': calculation_time
        }
        
    except Exception as exc:
        # Clear processing lock on error
        cache.delete(f"{cache_key}:processing")
        
        logger.error(f"Task {task_id}: Error calculating metrics: {str(exc)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        
        raise exc

@shared_task(bind=True)
def batch_validate_schedules(self, validation_requests: List[dict]):
    """Batch validation for improved throughput"""
    results = []
    
    for i, request in enumerate(validation_requests):
        try:
            result = validate_single_schedule(request)
            results.append({
                'index': i,
                'status': 'success',
                'result': result
            })
        except Exception as e:
            results.append({
                'index': i,
                'status': 'error',
                'error': str(e)
            })
    
    return {
        'total_processed': len(validation_requests),
        'successful': len([r for r in results if r['status'] == 'success']),
        'failed': len([r for r in results if r['status'] == 'error']),
        'results': results
    }
```

## API Performance Optimization

### Response Compression

```python
# Middleware for response compression
class ComplianceCompressionMiddleware:
    """Custom compression for compliance API responses"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        response = self.get_response(request)
        
        # Only compress compliance API responses
        if (request.path.startswith('/api/v1/compliance/') and 
            response.status_code == 200 and 
            len(response.content) > 1024):  # Only compress responses > 1KB
            
            if 'gzip' in request.META.get('HTTP_ACCEPT_ENCODING', ''):
                response = self.compress_response(response)
        
        return response
    
    def compress_response(self, response):
        import gzip
        
        compressed_content = gzip.compress(response.content)
        
        if len(compressed_content) < len(response.content):
            response.content = compressed_content
            response['Content-Encoding'] = 'gzip'
            response['Content-Length'] = str(len(compressed_content))
        
        return response
```

### Response Pagination

```python
class OptimizedPaginationMixin:
    """High-performance pagination for compliance data"""
    
    def paginate_compliance_data(self, queryset, request):
        """Optimized pagination with cursor support"""
        
        # Get pagination parameters
        page_size = min(int(request.GET.get('limit', 20)), 100)  # Max 100 items
        cursor = request.GET.get('cursor')
        
        if cursor:
            # Cursor-based pagination for better performance
            try:
                cursor_data = self.decode_cursor(cursor)
                queryset = queryset.filter(
                    created_at__lt=cursor_data['created_at'],
                    id__lt=cursor_data['id']
                )
            except (ValueError, KeyError):
                # Invalid cursor, fallback to first page
                pass
        
        # Fetch one extra item to determine if there are more pages
        items = list(queryset[:page_size + 1])
        has_more = len(items) > page_size
        
        if has_more:
            items = items[:page_size]
        
        # Generate next cursor
        next_cursor = None
        if has_more and items:
            last_item = items[-1]
            next_cursor = self.encode_cursor({
                'created_at': last_item.created_at.isoformat(),
                'id': last_item.id
            })
        
        return {
            'data': items,
            'pagination': {
                'has_more': has_more,
                'next_cursor': next_cursor,
                'page_size': page_size
            }
        }
    
    def encode_cursor(self, data):
        """Encode cursor data"""
        import base64
        import json
        return base64.b64encode(json.dumps(data).encode()).decode()
    
    def decode_cursor(self, cursor):
        """Decode cursor data"""
        import base64
        import json
        return json.loads(base64.b64decode(cursor.encode()).decode())
```

### Field Selection

```python
class FieldSelectionMixin:
    """Allow clients to specify which fields to include in response"""
    
    def filter_response_fields(self, data, request):
        """Filter response fields based on 'fields' parameter"""
        
        fields_param = request.GET.get('fields')
        if not fields_param:
            return data
        
        # Parse field selection
        requested_fields = set(fields_param.split(','))
        
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if k in requested_fields}
        elif isinstance(data, list):
            return [
                {k: v for k, v in item.items() if k in requested_fields}
                for item in data
            ]
        
        return data

# Usage example in view
class ComplianceViolationViewSet(FieldSelectionMixin, viewsets.ModelViewSet):
    
    def list(self, request):
        # ... get violations ...
        
        serialized_data = self.serializer_class(violations, many=True).data
        filtered_data = self.filter_response_fields(serialized_data, request)
        
        return Response({
            'status': 'success',
            'data': {
                'violations': filtered_data,
                'count': len(filtered_data)
            }
        })
```

## Monitoring and Performance Metrics

### Performance Monitoring

```python
import time
import logging
from django.core.cache import cache
from functools import wraps

# Performance monitoring decorator
def monitor_performance(cache_key_prefix: str = None):
    """Decorator to monitor API performance"""
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                
                execution_time = time.time() - start_time
                
                # Log performance metrics
                logger.info(f"Performance: {func.__name__} executed in {execution_time:.3f}s")
                
                # Store in cache for monitoring
                if cache_key_prefix:
                    cache_key = f"perf:{cache_key_prefix}:{func.__name__}"
                    performance_data = cache.get(cache_key, [])
                    performance_data.append({
                        'timestamp': time.time(),
                        'execution_time': execution_time,
                        'success': True
                    })
                    
                    # Keep last 100 measurements
                    if len(performance_data) > 100:
                        performance_data = performance_data[-100:]
                    
                    cache.set(cache_key, performance_data, 3600)
                
                return result
                
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(f"Performance: {func.__name__} failed in {execution_time:.3f}s: {str(e)}")
                
                if cache_key_prefix:
                    cache_key = f"perf:{cache_key_prefix}:{func.__name__}"
                    performance_data = cache.get(cache_key, [])
                    performance_data.append({
                        'timestamp': time.time(),
                        'execution_time': execution_time,
                        'success': False,
                        'error': str(e)
                    })
                    cache.set(cache_key, performance_data, 3600)
                
                raise
                
        return wrapper
    return decorator

# Usage
@monitor_performance(cache_key_prefix='compliance_api')
def validate_schedule_performance(user_id, proposed_shifts):
    # ... validation logic ...
    pass
```

### Cache Performance Analytics

```python
class CachePerformanceAnalyzer:
    """Analyze cache performance and optimization opportunities"""
    
    @staticmethod
    def get_cache_stats() -> dict:
        """Get comprehensive cache performance statistics"""
        
        # Redis stats
        redis_info = compliance_redis.info()
        
        return {
            'redis_stats': {
                'memory_used': redis_info.get('used_memory_human'),
                'memory_peak': redis_info.get('used_memory_peak_human'),
                'hit_rate': redis_info.get('keyspace_hits', 0) / max(
                    redis_info.get('keyspace_hits', 0) + redis_info.get('keyspace_misses', 0), 1
                ) * 100,
                'operations_per_sec': redis_info.get('instantaneous_ops_per_sec'),
                'connected_clients': redis_info.get('connected_clients'),
                'evicted_keys': redis_info.get('evicted_keys')
            },
            'django_cache_stats': {
                'backend': cache._cache.__class__.__name__,
                'version': getattr(cache, '_version', 'unknown')
            }
        }
    
    @staticmethod
    def analyze_slow_queries() -> List[dict]:
        """Identify slow database queries for optimization"""
        
        from django.db import connection
        
        slow_queries = []
        
        for query in connection.queries:
            query_time = float(query['time'])
            if query_time > 0.1:  # Queries slower than 100ms
                slow_queries.append({
                    'sql': query['sql'],
                    'time': query_time,
                    'optimization_suggestions': analyze_query_performance(query['sql'])
                })
        
        return sorted(slow_queries, key=lambda x: x['time'], reverse=True)
    
    @staticmethod
    def get_cache_key_distribution() -> dict:
        """Analyze cache key usage patterns"""
        
        keys = compliance_redis.keys('comp:*')
        distribution = {}
        
        for key in keys:
            prefix = key.decode().split(':')[1] if ':' in key.decode() else 'unknown'
            distribution[prefix] = distribution.get(prefix, 0) + 1
        
        return distribution

def analyze_query_performance(sql: str) -> List[str]:
    """Suggest optimizations for slow queries"""
    suggestions = []
    
    sql_lower = sql.lower()
    
    if 'order by' in sql_lower and 'limit' not in sql_lower:
        suggestions.append("Consider adding LIMIT to ORDER BY queries")
    
    if 'like' in sql_lower and not sql_lower.startswith('like \'%'):
        suggestions.append("Use database indexes for LIKE patterns not starting with %")
    
    if sql_lower.count('join') > 3:
        suggestions.append("Consider denormalizing data for complex multi-join queries")
    
    if 'distinct' in sql_lower:
        suggestions.append("Evaluate if DISTINCT is necessary or can be replaced with GROUP BY")
    
    return suggestions
```

## Performance Testing

### Load Testing Configuration

```python
# locustfile.py for performance testing
from locust import HttpUser, task, between
import random
import json

class ComplianceAPIUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Authenticate user
        self.login()
    
    def login(self):
        response = self.client.post("/api/auth/login/", json={
            "username": "test_user",
            "password": "test_password"
        })
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
    
    @task(3)
    def get_compliance_status(self):
        """Test compliance status retrieval"""
        user_id = random.randint(1, 100)
        with self.client.get(
            f"/api/v1/compliance/users/{user_id}/status/",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def validate_schedule(self):
        """Test schedule validation performance"""
        validation_data = {
            "user_id": random.randint(1, 100),
            "proposed_shifts": [
                {
                    "venue_id": random.randint(1, 50),
                    "start_time": "2024-01-15T09:00:00Z",
                    "end_time": "2024-01-15T17:00:00Z",
                    "shift_type": "security_guard"
                }
            ],
            "validation_options": {
                "check_weekly_limits": True,
                "check_rest_periods": True,
                "include_warnings": True
            }
        }
        
        with self.client.post(
            "/api/v1/compliance/regional/validate-schedule/",
            json=validation_data,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response_time = response.elapsed.total_seconds()
                if response_time > 0.5:  # SLA violation
                    response.failure(f"Response time {response_time:.2f}s exceeds SLA")
                else:
                    response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def get_violations(self):
        """Test violation retrieval with pagination"""
        params = {
            "user_id": random.randint(1, 100),
            "limit": 20,
            "sort": "-created_at"
        }
        
        with self.client.get(
            "/api/v1/compliance/violations/",
            params=params,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(1)
    def compare_regulations(self):
        """Test regulation comparison performance"""
        regions = random.sample(['UK', 'US-CA', 'EU-DE', 'EU-FR'], 3)
        params = {
            "regions[]": regions,
            "include_sia_requirements": True,
            "include_break_rules": True
        }
        
        with self.client.get(
            "/api/v1/compliance/regional/compare/",
            params=params,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response_time = response.elapsed.total_seconds()
                if response_time > 2.0:  # SLA violation for complex queries
                    response.failure(f"Response time {response_time:.2f}s exceeds SLA")
                else:
                    response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
```

### Performance Benchmarking

```bash
#!/bin/bash
# performance_benchmark.sh

echo "Starting Compliance API Performance Benchmark"

# Run load test with different user loads
for users in 10 50 100 200; do
    echo "Testing with $users concurrent users..."
    
    locust -f locustfile.py \
           --host=http://localhost:8000 \
           --users=$users \
           --spawn-rate=10 \
           --run-time=5m \
           --headless \
           --html=reports/performance_${users}users.html \
           --csv=reports/performance_${users}users
    
    echo "Completed test with $users users"
done

# Generate summary report
python generate_performance_report.py reports/
```

## Scaling Strategies

### Horizontal Scaling

```yaml
# docker-compose.production.yml
version: '3.8'
services:
  compliance-api:
    image: ssms/compliance-api:latest
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    environment:
      - DJANGO_SETTINGS_MODULE=core.settings.production
      - REDIS_URL=redis://redis-compliance:6379
      - DATABASE_URL=postgresql://user:pass@db-compliance:5432/compliance
    
  nginx-lb:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - compliance-api
  
  redis-compliance:
    image: redis:7-alpine
    command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
    
  db-compliance:
    image: postgres:15
    environment:
      POSTGRES_DB: compliance
      POSTGRES_USER: compliance_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - compliance_db_data:/var/lib/postgresql/data
```

### Auto-scaling Configuration

```yaml
# kubernetes/compliance-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliance-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: compliance-api
  template:
    metadata:
      labels:
        app: compliance-api
    spec:
      containers:
      - name: compliance-api
        image: ssms/compliance-api:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: REDIS_URL
          value: "redis://redis-compliance:6379"
        readinessProbe:
          httpGet:
            path: /health/
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health/
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 30

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: compliance-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: compliance-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

These performance guidelines ensure the Regional Compliance API can handle enterprise-scale workloads while maintaining sub-second response times and optimal resource utilization. The multi-layer caching, database optimization, and scaling strategies provide a robust foundation for high-performance compliance management.