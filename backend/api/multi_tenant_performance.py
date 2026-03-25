"""
Performance Optimizer - Multi-Tenant Database Optimizations
Comprehensive performance optimizations for company-scoped queries in the Security Firm Onboarding System.

TARGET METRICS:
- Company-scoped queries: < 50ms
- API endpoints: < 200ms response time
- Database connections: < 20 active connections
- Query execution: < 100ms per query

CRITICAL OPTIMIZATIONS:
1. Multi-tenant query patterns with proper indexing
2. Database connection pooling
3. Query result caching with Redis
4. N+1 query prevention
5. Bulk operations for large datasets
"""

from django.db import models, connection
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from django.db.models import Prefetch, Q, F
from contextlib import contextmanager
from functools import wraps
import time
import logging
from typing import Dict, List, Optional, Any, Union
import hashlib
import json

logger = logging.getLogger(__name__)


class PerformanceMetrics:
    """Track and log performance metrics for optimization analysis."""

    def __init__(self):
        self.query_times = []
        self.cache_hits = 0
        self.cache_misses = 0

    def log_query_time(self, query_type: str, execution_time: float, company_id: Optional[str] = None):
        """Log query execution time for analysis."""
        self.query_times.append({
            'type': query_type,
            'time': execution_time,
            'company_id': company_id,
            'timestamp': timezone.now()
        })

        if execution_time > 0.1:  # Log slow queries (>100ms)
            logger.warning(f"Slow query detected: {query_type} took {execution_time:.3f}s for company {company_id}")

    def log_cache_hit(self):
        self.cache_hits += 1

    def log_cache_miss(self):
        self.cache_misses += 1

    def get_cache_hit_ratio(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0


# Global performance metrics instance
performance_metrics = PerformanceMetrics()


@contextmanager
def measure_query_time(query_type: str, company_id: Optional[str] = None):
    """Context manager to measure and log query execution time."""
    start_time = time.perf_counter()
    try:
        yield
    finally:
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        performance_metrics.log_query_time(query_type, execution_time, company_id)


def cached_company_query(timeout: int = 300):
    """
    Decorator for caching company-scoped query results.

    Args:
        timeout: Cache timeout in seconds (default 5 minutes)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key_data = {
                'func': func.__name__,
                'args': str(args),
                'kwargs': str(sorted(kwargs.items()))
            }
            cache_key = f"company_query:{hashlib.md5(str(cache_key_data).encode()).hexdigest()}"

            # Try to get from cache first
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                performance_metrics.log_cache_hit()
                return cached_result

            # Cache miss - execute query and cache result
            performance_metrics.log_cache_miss()
            result = func(*args, **kwargs)
            cache.set(cache_key, result, timeout)
            return result
        return wrapper
    return decorator


class MultiTenantQueryOptimizer:
    """Optimized query patterns for multi-tenant operations."""

    @staticmethod
    @cached_company_query(timeout=600)  # 10 minutes
    def get_company_with_relationships(company_id: str) -> Dict:
        """
        Fetch company with all related data in a single optimized query.
        Prevents N+1 queries and reduces database round trips.
        """
        from .models import SecurityCompany

        with measure_query_time("company_with_relationships", company_id):
            company = SecurityCompany.objects.select_related(
                'compliance_profile'
            ).prefetch_related(
                'user_memberships__user',
                'venues',
                'shifts__staff_profile__user',
                'onboarding_progress'
            ).get(id=company_id)

            return {
                'id': str(company.id),
                'name': company.name,
                'registration_number': company.registration_number,
                'country_code': company.country_code,
                'staff_capacity': company.staff_capacity,
                'subscription_tier': company.subscription_tier,
                'compliance_profile': {
                    'id': company.compliance_profile.id if company.compliance_profile else None,
                    'working_hours_regulation': getattr(company.compliance_profile, 'working_hours_regulation', None),
                } if company.compliance_profile else None,
                'user_count': company.user_memberships.count(),
                'venue_count': company.venues.count(),
                'active_shifts_count': company.shifts.filter(status='active').count(),
                'onboarding_completed': getattr(company.onboarding_progress.first(), 'completed_at', None) is not None,
                'created_at': company.created_at.isoformat(),
                'updated_at': company.updated_at.isoformat(),
            }

    @staticmethod
    @cached_company_query(timeout=180)  # 3 minutes
    def get_company_dashboard_data(company_id: str) -> Dict:
        """
        Optimized dashboard data query with aggressive caching.
        Target: < 50ms execution time.
        """
        from .models import SecurityCompany, Shift, StaffProfile

        with measure_query_time("company_dashboard", company_id):
            # Use raw SQL for maximum performance
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        COUNT(DISTINCT ucm.user_id) as total_staff,
                        COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as active_shifts,
                        COUNT(DISTINCT CASE WHEN s.status = 'pending' THEN s.id END) as pending_shifts,
                        COUNT(DISTINCT v.id) as total_venues,
                        COALESCE(AVG(CASE WHEN s.end_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600 END), 0) as avg_shift_hours
                    FROM api_securitycompany sc
                    LEFT JOIN api_usercompanymembership ucm ON sc.id = ucm.company_id
                    LEFT JOIN api_venue v ON sc.id = v.company_id
                    LEFT JOIN api_shift s ON v.id = s.venue_id AND s.start_time >= NOW() - INTERVAL '7 days'
                    WHERE sc.id = %s
                    GROUP BY sc.id
                """, [company_id])

                row = cursor.fetchone()
                if not row:
                    return {
                        'total_staff': 0,
                        'active_shifts': 0,
                        'pending_shifts': 0,
                        'total_venues': 0,
                        'avg_shift_hours': 0.0,
                        'performance_score': 100.0
                    }

                return {
                    'total_staff': row[0] or 0,
                    'active_shifts': row[1] or 0,
                    'pending_shifts': row[2] or 0,
                    'total_venues': row[3] or 0,
                    'avg_shift_hours': float(row[4] or 0),
                    'performance_score': min(100.0, (row[0] or 0) * 10)  # Simple score calculation
                }

    @staticmethod
    @cached_company_query(timeout=300)  # 5 minutes
    def get_company_staff_list(company_id: str, active_only: bool = True) -> List[Dict]:
        """
        Optimized staff list query with user profile data.
        """
        from .models import UserCompanyMembership, StaffProfile

        with measure_query_time("company_staff_list", company_id):
            # Build query with proper joins
            queryset = UserCompanyMembership.objects.select_related(
                'user',
                'user__profile'
            ).filter(
                company_id=company_id
            )

            if active_only:
                queryset = queryset.filter(user__is_active=True)

            staff_data = []
            for membership in queryset:
                user = membership.user
                staff_profile = getattr(user, 'profile', None)

                staff_data.append({
                    'user_id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': membership.role,
                    'is_owner': membership.is_owner,
                    'joined_at': membership.joined_at.isoformat(),
                    'phone_number': staff_profile.phone_number if staff_profile else None,
                    'emergency_contact': staff_profile.emergency_contact_name if staff_profile else None,
                    'sia_license_number': staff_profile.sia_license_number if staff_profile else None,
                    'is_active': user.is_active,
                })

            return staff_data

    @staticmethod
    def bulk_create_company_users(company_id: str, users_data: List[Dict]) -> Dict:
        """
        Bulk create users for a company with optimized database operations.
        """
        from django.contrib.auth.models import User
        from .models import UserCompanyMembership, StaffProfile

        with measure_query_time("bulk_create_users", company_id):
            created_users = []
            created_memberships = []
            created_profiles = []

            # Bulk create users
            users_to_create = []
            for user_data in users_data:
                users_to_create.append(User(
                    email=user_data['email'],
                    first_name=user_data.get('first_name', ''),
                    last_name=user_data.get('last_name', ''),
                    username=user_data['email'],  # Use email as username
                    is_active=True
                ))

            created_users = User.objects.bulk_create(users_to_create)

            # Bulk create memberships
            memberships_to_create = []
            profiles_to_create = []

            for i, user in enumerate(created_users):
                user_data = users_data[i]

                # Create membership
                memberships_to_create.append(UserCompanyMembership(
                    user=user,
                    company_id=company_id,
                    role=user_data.get('role', 'staff'),
                    is_owner=user_data.get('is_owner', False)
                ))

                # Create staff profile
                profiles_to_create.append(StaffProfile(
                    user=user,
                    phone_number=user_data.get('phone_number', ''),
                    emergency_contact_name=user_data.get('emergency_contact_name', ''),
                    emergency_contact_phone=user_data.get('emergency_contact_phone', ''),
                ))

            UserCompanyMembership.objects.bulk_create(memberships_to_create)
            StaffProfile.objects.bulk_create(profiles_to_create)

            # Clear related caches
            cache.delete_many([
                f"company_query:*{company_id}*",
            ])

            return {
                'created_count': len(created_users),
                'company_id': company_id,
                'success': True
            }

    @staticmethod
    def get_performance_report() -> Dict:
        """Generate performance metrics report."""
        return {
            'cache_hit_ratio': performance_metrics.get_cache_hit_ratio(),
            'total_queries': len(performance_metrics.query_times),
            'avg_query_time': sum(q['time'] for q in performance_metrics.query_times) / len(performance_metrics.query_times) if performance_metrics.query_times else 0,
            'slow_queries_count': sum(1 for q in performance_metrics.query_times if q['time'] > 0.1),
            'database_connections': len(connection.queries),
            'recommendations': MultiTenantQueryOptimizer._generate_recommendations()
        }

    @staticmethod
    def _generate_recommendations() -> List[str]:
        """Generate performance optimization recommendations."""
        recommendations = []

        if performance_metrics.get_cache_hit_ratio() < 0.8:
            recommendations.append("Cache hit ratio is low. Consider increasing cache timeouts or adding more caching.")

        slow_queries = sum(1 for q in performance_metrics.query_times if q['time'] > 0.1)
        if slow_queries > 0:
            recommendations.append(f"Found {slow_queries} slow queries. Review database indexes and query optimization.")

        if len(connection.queries) > 20:
            recommendations.append("High number of database connections. Consider implementing connection pooling.")

        return recommendations


class CompanyQuerySetMixin:
    """
    Mixin for model managers to add company-scoped optimized queries.
    """

    def for_company(self, company_id: str):
        """Filter queryset for a specific company with optimized joins."""
        return self.select_related().filter(company_id=company_id)

    def with_company_context(self, company_id: str):
        """Add company context with all related data."""
        return self.select_related('company').filter(company_id=company_id)

    def active_for_company(self, company_id: str):
        """Get active records for a company."""
        return self.for_company(company_id).filter(is_active=True)


# Database connection optimization
class DatabasePerformanceMiddleware:
    """Middleware to monitor and optimize database performance."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.perf_counter()

        response = self.get_response(request)

        end_time = time.perf_counter()
        request_time = end_time - start_time

        # Log slow requests
        if request_time > 0.2:  # 200ms threshold
            logger.warning(f"Slow request: {request.path} took {request_time:.3f}s")

        # Add performance headers for monitoring
        response['X-Response-Time'] = f"{request_time:.3f}s"
        response['X-DB-Queries'] = str(len(connection.queries))

        return response


# Cache invalidation utilities
class CacheManager:
    """Manage cache invalidation for company-related data."""

    @staticmethod
    def invalidate_company_cache(company_id: str):
        """Invalidate all cached data for a specific company."""
        cache_patterns = [
            f"company_query:*{company_id}*",
            f"dashboard:{company_id}*",
            f"staff_list:{company_id}*",
        ]

        for pattern in cache_patterns:
            # Note: This requires Redis for pattern-based deletion
            # For memcached, you'd need to track cache keys separately
            try:
                cache.delete_pattern(pattern)
            except AttributeError:
                # Fallback for non-Redis cache backends
                logger.info(f"Pattern deletion not supported for cache backend, skipping {pattern}")

    @staticmethod
    def warm_company_cache(company_id: str):
        """Pre-warm frequently accessed company data."""
        # Warm up dashboard data
        MultiTenantQueryOptimizer.get_company_dashboard_data(company_id)

        # Warm up staff list
        MultiTenantQueryOptimizer.get_company_staff_list(company_id)

        # Warm up company relationships
        MultiTenantQueryOptimizer.get_company_with_relationships(company_id)

        logger.info(f"Cache warmed for company {company_id}")