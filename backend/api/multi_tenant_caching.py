"""
Advanced Multi-Tenant Caching Strategy for Security Firm Onboarding System

This module implements a sophisticated caching layer for multi-tenant operations,
ensuring optimal performance while maintaining data isolation between companies.
"""

from django.core.cache import cache, caches
from django.core.cache.utils import make_template_fragment_key
from django.conf import settings
from django.utils import timezone
from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from typing import Optional, Dict, List, Any, Union
import hashlib
import json
import logging
from datetime import timedelta
from functools import wraps

logger = logging.getLogger(__name__)


class MultiTenantCacheManager:
    """
    Advanced cache manager for multi-tenant operations with automatic invalidation
    """

    # Cache timeout configurations
    CACHE_TIMEOUTS = {
        'company_stats': 300,      # 5 minutes
        'company_venues': 600,     # 10 minutes
        'company_staff': 300,      # 5 minutes
        'company_shifts': 180,     # 3 minutes
        'dashboard_data': 240,     # 4 minutes
        'compliance_data': 1800,   # 30 minutes (changes less frequently)
        'onboarding_progress': 60, # 1 minute (frequently updated)
        'user_permissions': 900,   # 15 minutes
    }

    # Cache key prefixes
    CACHE_PREFIXES = {
        'company': 'cmp',
        'user': 'usr',
        'venue': 'ven',
        'shift': 'shf',
        'dashboard': 'dash',
        'compliance': 'comp',
        'onboarding': 'onb',
        'analytics': 'ana',
    }

    @classmethod
    def _generate_cache_key(cls, prefix: str, company_id: str, *args, **kwargs) -> str:
        """Generate a structured cache key with optional parameters"""
        key_parts = [
            cls.CACHE_PREFIXES.get(prefix, prefix),
            str(company_id)
        ]

        # Add positional arguments
        key_parts.extend(str(arg) for arg in args)

        # Add keyword arguments (sorted for consistency)
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            kwargs_str = '_'.join(f"{k}:{v}" for k, v in sorted_kwargs)
            key_parts.append(kwargs_str)

        # Create hash for very long keys
        key = '_'.join(key_parts)
        if len(key) > 200:  # Redis key length limit consideration
            key_hash = hashlib.md5(key.encode()).hexdigest()
            key = f"{cls.CACHE_PREFIXES.get(prefix, prefix)}_{company_id}_{key_hash}"

        return key

    @classmethod
    def get_company_stats_key(cls, company_id: str) -> str:
        """Get cache key for company statistics"""
        return cls._generate_cache_key('company', company_id, 'stats')

    @classmethod
    def get_company_venues_key(cls, company_id: str, filters: Dict = None) -> str:
        """Get cache key for company venues with optional filters"""
        return cls._generate_cache_key('company', company_id, 'venues', **(filters or {}))

    @classmethod
    def get_company_staff_key(cls, company_id: str, role: str = None) -> str:
        """Get cache key for company staff by role"""
        return cls._generate_cache_key('company', company_id, 'staff', role=role or 'all')

    @classmethod
    def get_dashboard_key(cls, company_id: str, date_range: str = None) -> str:
        """Get cache key for company dashboard data"""
        return cls._generate_cache_key('dashboard', company_id, date_range=date_range or 'default')

    @classmethod
    def get_user_permissions_key(cls, user_id: str, company_id: str) -> str:
        """Get cache key for user permissions in specific company"""
        return cls._generate_cache_key('user', company_id, user_id, 'permissions')

    @classmethod
    def get_compliance_key(cls, company_id: str, country_code: str) -> str:
        """Get cache key for compliance data by country"""
        return cls._generate_cache_key('compliance', company_id, country=country_code)

    @classmethod
    def get_onboarding_key(cls, company_id: str) -> str:
        """Get cache key for onboarding progress"""
        return cls._generate_cache_key('onboarding', company_id, 'progress')


class CompanyDataCache:
    """
    High-level caching interface for company-specific data
    """

    @staticmethod
    def cache_company_stats(company_id: str, stats_data: Dict, timeout: int = None) -> bool:
        """Cache company statistics with automatic timeout"""
        cache_key = MultiTenantCacheManager.get_company_stats_key(company_id)
        timeout = timeout or MultiTenantCacheManager.CACHE_TIMEOUTS['company_stats']

        try:
            # Add metadata to cached data
            cached_data = {
                'data': stats_data,
                'cached_at': timezone.now().isoformat(),
                'company_id': company_id,
                'cache_version': '1.0'
            }

            cache.set(cache_key, cached_data, timeout)
            logger.debug(f"Cached company stats for {company_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to cache company stats for {company_id}: {e}")
            return False

    @staticmethod
    def get_cached_company_stats(company_id: str) -> Optional[Dict]:
        """Retrieve cached company statistics"""
        cache_key = MultiTenantCacheManager.get_company_stats_key(company_id)

        try:
            cached_data = cache.get(cache_key)
            if cached_data and isinstance(cached_data, dict):
                # Validate cache structure
                if 'data' in cached_data and 'company_id' in cached_data:
                    if cached_data['company_id'] == company_id:
                        return cached_data['data']
                    else:
                        logger.warning(f"Cache company ID mismatch for key {cache_key}")
                        cache.delete(cache_key)

            return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached company stats for {company_id}: {e}")
            return None

    @staticmethod
    def cache_dashboard_data(company_id: str, dashboard_data: Dict, date_range: str = None) -> bool:
        """Cache comprehensive dashboard data"""
        cache_key = MultiTenantCacheManager.get_dashboard_key(company_id, date_range)
        timeout = MultiTenantCacheManager.CACHE_TIMEOUTS['dashboard_data']

        try:
            cached_data = {
                'data': dashboard_data,
                'cached_at': timezone.now().isoformat(),
                'company_id': company_id,
                'date_range': date_range,
                'expiry': (timezone.now() + timedelta(seconds=timeout)).isoformat()
            }

            cache.set(cache_key, cached_data, timeout)
            logger.debug(f"Cached dashboard data for {company_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to cache dashboard data for {company_id}: {e}")
            return False

    @staticmethod
    def get_cached_dashboard_data(company_id: str, date_range: str = None) -> Optional[Dict]:
        """Retrieve cached dashboard data"""
        cache_key = MultiTenantCacheManager.get_dashboard_key(company_id, date_range)

        try:
            cached_data = cache.get(cache_key)
            if cached_data and isinstance(cached_data, dict):
                return cached_data.get('data')
            return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached dashboard data for {company_id}: {e}")
            return None

    @staticmethod
    def cache_user_permissions(user_id: str, company_id: str, permissions: List[str]) -> bool:
        """Cache user permissions for specific company"""
        cache_key = MultiTenantCacheManager.get_user_permissions_key(user_id, company_id)
        timeout = MultiTenantCacheManager.CACHE_TIMEOUTS['user_permissions']

        try:
            cached_data = {
                'permissions': permissions,
                'user_id': user_id,
                'company_id': company_id,
                'cached_at': timezone.now().isoformat()
            }

            cache.set(cache_key, cached_data, timeout)
            return True

        except Exception as e:
            logger.error(f"Failed to cache user permissions for {user_id} in {company_id}: {e}")
            return False

    @staticmethod
    def get_cached_user_permissions(user_id: str, company_id: str) -> Optional[List[str]]:
        """Retrieve cached user permissions"""
        cache_key = MultiTenantCacheManager.get_user_permissions_key(user_id, company_id)

        try:
            cached_data = cache.get(cache_key)
            if cached_data and isinstance(cached_data, dict):
                return cached_data.get('permissions', [])
            return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached user permissions for {user_id} in {company_id}: {e}")
            return None

    @staticmethod
    def invalidate_company_cache(company_id: str, cache_types: List[str] = None) -> int:
        """
        Invalidate all or specific cache types for a company
        Returns number of keys invalidated
        """
        if cache_types is None:
            cache_types = ['company_stats', 'company_venues', 'company_staff', 'dashboard_data']

        keys_to_delete = []

        try:
            # Generate all possible cache keys for this company
            for cache_type in cache_types:
                if cache_type == 'company_stats':
                    keys_to_delete.append(MultiTenantCacheManager.get_company_stats_key(company_id))
                elif cache_type == 'dashboard_data':
                    # Delete dashboard data for different date ranges
                    for date_range in ['default', 'week', 'month', 'quarter']:
                        keys_to_delete.append(MultiTenantCacheManager.get_dashboard_key(company_id, date_range))
                elif cache_type == 'company_venues':
                    keys_to_delete.append(MultiTenantCacheManager.get_company_venues_key(company_id))
                elif cache_type == 'company_staff':
                    for role in ['all', 'staff', 'manager', 'admin']:
                        keys_to_delete.append(MultiTenantCacheManager.get_company_staff_key(company_id, role))

            # Delete all keys
            if keys_to_delete:
                cache.delete_many(keys_to_delete)
                logger.info(f"Invalidated {len(keys_to_delete)} cache keys for company {company_id}")

            return len(keys_to_delete)

        except Exception as e:
            logger.error(f"Failed to invalidate cache for company {company_id}: {e}")
            return 0


def cached_company_query(cache_key_func, timeout: int = 300, invalidate_on: List[str] = None):
    """
    Decorator for caching company-scoped query results
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract company_id from arguments
            company_id = None
            if args:
                company_id = args[0] if isinstance(args[0], (str, int)) else getattr(args[0], 'company_id', None)
            if not company_id and 'company_id' in kwargs:
                company_id = kwargs['company_id']

            if not company_id:
                # If no company_id, execute function directly
                return func(*args, **kwargs)

            # Generate cache key
            cache_key = cache_key_func(company_id, *args[1:], **kwargs)

            # Try to get cached result
            try:
                cached_result = cache.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Cache hit for {cache_key}")
                    return cached_result

                # Execute function and cache result
                result = func(*args, **kwargs)

                # Cache the result
                cache.set(cache_key, result, timeout)
                logger.debug(f"Cached result for {cache_key}")

                return result

            except Exception as e:
                logger.error(f"Cache error for {cache_key}: {e}")
                # Fall back to executing function directly
                return func(*args, **kwargs)

        return wrapper
    return decorator


class CacheInvalidationManager:
    """
    Manages automatic cache invalidation based on model changes
    """

    @staticmethod
    def invalidate_related_caches(instance, cache_types: List[str] = None):
        """Invalidate caches related to a model instance"""
        company_id = getattr(instance, 'company_id', None)
        if not company_id:
            # Try to get company through relationships
            if hasattr(instance, 'company'):
                company_id = instance.company.id
            elif hasattr(instance, 'venue') and hasattr(instance.venue, 'company'):
                company_id = instance.venue.company.id
            elif hasattr(instance, 'user') and hasattr(instance.user, 'companies'):
                # Handle user-related invalidations for all their companies
                for membership in instance.user.companies.all():
                    CompanyDataCache.invalidate_company_cache(membership.company.id, cache_types)
                return

        if company_id:
            CompanyDataCache.invalidate_company_cache(company_id, cache_types)


# Signal handlers for automatic cache invalidation
@receiver([post_save, post_delete], sender='api.Venue')
def invalidate_venue_caches(sender, instance, **kwargs):
    """Invalidate venue-related caches when venues are modified"""
    CacheInvalidationManager.invalidate_related_caches(
        instance,
        ['company_venues', 'dashboard_data', 'company_stats']
    )


@receiver([post_save, post_delete], sender='api.Shift')
def invalidate_shift_caches(sender, instance, **kwargs):
    """Invalidate shift-related caches when shifts are modified"""
    CacheInvalidationManager.invalidate_related_caches(
        instance,
        ['dashboard_data', 'company_stats']
    )


@receiver([post_save, post_delete], sender='api.UserCompanyMembership')
def invalidate_user_company_caches(sender, instance, **kwargs):
    """Invalidate user and company caches when memberships change"""
    # Invalidate company staff cache
    CompanyDataCache.invalidate_company_cache(
        instance.company.id,
        ['company_staff', 'company_stats']
    )

    # Invalidate user permissions cache
    cache_key = MultiTenantCacheManager.get_user_permissions_key(
        instance.user.id,
        instance.company.id
    )
    cache.delete(cache_key)


@receiver(post_save, sender='api.SecurityCompany')
def invalidate_company_caches(sender, instance, **kwargs):
    """Invalidate all caches when company data changes"""
    CompanyDataCache.invalidate_company_cache(instance.id)


class CacheWarmupManager:
    """
    Manages cache warming strategies for optimal performance
    """

    @staticmethod
    def warm_company_caches(company_id: str, priority_data: List[str] = None):
        """
        Warm up caches for a specific company
        """
        if priority_data is None:
            priority_data = ['stats', 'venues', 'dashboard']

        try:
            from .multi_tenant_optimizations import MultiTenantQueryOptimizer
            from .models import Venue, UserCompanyMembership

            optimizer = MultiTenantQueryOptimizer(company_id)

            if 'stats' in priority_data:
                # Warm company stats cache
                stats = optimizer.get_company_dashboard_data()
                CompanyDataCache.cache_company_stats(company_id, stats)

            if 'venues' in priority_data:
                # Warm venues cache
                venues = list(Venue.objects.for_company(company_id)[:50])
                venues_data = [{'id': v.id, 'name': v.name} for v in venues]
                cache_key = MultiTenantCacheManager.get_company_venues_key(company_id)
                cache.set(cache_key, venues_data, 600)

            if 'staff' in priority_data:
                # Warm staff cache
                staff = list(UserCompanyMembership.objects.company_staff_list(company_id)[:100])
                staff_data = [{'id': s.user.id, 'name': s.user.get_full_name()} for s in staff]
                cache_key = MultiTenantCacheManager.get_company_staff_key(company_id)
                cache.set(cache_key, staff_data, 300)

            logger.info(f"Warmed caches for company {company_id}")

        except Exception as e:
            logger.error(f"Failed to warm caches for company {company_id}: {e}")

    @staticmethod
    def warm_popular_company_caches(limit: int = 10):
        """
        Warm caches for most active companies
        """
        try:
            from .models import SecurityCompany, Shift

            # Get companies with most recent activity
            popular_companies = SecurityCompany.objects.annotate(
                recent_shifts=models.Count('shifts', filter=models.Q(
                    shifts__created_at__gte=timezone.now() - timedelta(days=7)
                ))
            ).order_by('-recent_shifts')[:limit]

            for company in popular_companies:
                CacheWarmupManager.warm_company_caches(
                    company.id,
                    ['stats', 'venues', 'dashboard']
                )

            logger.info(f"Warmed caches for {len(popular_companies)} popular companies")

        except Exception as e:
            logger.error(f"Failed to warm popular company caches: {e}")


class CacheMonitoringMixin:
    """
    Mixin to add cache monitoring capabilities
    """

    def get_cache_stats(self, company_id: str) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        stats = {
            'company_id': company_id,
            'cache_keys': [],
            'hit_rate': 0.0,
            'memory_usage': 0,
            'last_updated': timezone.now().isoformat()
        }

        try:
            # Check various cache keys
            cache_keys = [
                MultiTenantCacheManager.get_company_stats_key(company_id),
                MultiTenantCacheManager.get_dashboard_key(company_id),
                MultiTenantCacheManager.get_company_venues_key(company_id),
                MultiTenantCacheManager.get_company_staff_key(company_id),
            ]

            cached_keys = []
            for key in cache_keys:
                if cache.get(key) is not None:
                    cached_keys.append(key)

            stats['cache_keys'] = cached_keys
            stats['hit_rate'] = len(cached_keys) / len(cache_keys) if cache_keys else 0.0

            return stats

        except Exception as e:
            logger.error(f"Failed to get cache stats for {company_id}: {e}")
            return stats