"""
Compliance System Redis Caching Implementation
High-performance caching layer for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

This module provides optimized caching strategies for compliance data with:
- Intelligent cache invalidation
- Performance monitoring
- User-specific and global cache patterns
- Cache warming strategies
"""

import logging
import json
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from functools import wraps
from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('compliance')


class ComplianceCacheKeys:
    """
    Centralized cache key management for compliance system.
    Ensures consistent naming and easy cache invalidation.
    """

    # Dashboard and summary data
    DASHBOARD_METRICS = 'compliance:dashboard:metrics:{user_id}:{venue_id}:{start}:{end}'
    VIOLATION_SUMMARY = 'compliance:summary:{user_id}'
    PENDING_VIOLATIONS = 'compliance:pending:{user_id}'
    VIOLATION_TRENDS = 'compliance:trends:{days}:{group_by}:{user_id}'

    # Real-time data
    REALTIME_CHECK = 'compliance:realtime:{user_id}:{venue_id}:{date}'
    LIVE_STATUS = 'compliance:live_status:{venue_id}'

    # User and settings data
    USER_COMPLIANCE_PROFILE = 'compliance:profile:{user_id}'
    VENUE_COMPLIANCE_SETTINGS = 'compliance:settings:{venue_id}'
    WORKING_HOURS_REGULATION = 'compliance:regulation:{regulation_id}'

    # Report data
    WORKING_HOURS_METRICS = 'compliance:metrics:{user_id}:{period_type}:{start}:{end}'
    BULK_REPORT_DATA = 'compliance:bulk_report:{hash}'

    # Global data
    ACTIVE_COMPLIANCE_PROFILE = 'compliance:active_profile'
    VIOLATION_TYPES = 'compliance:violation_types'
    COUNTRIES_LIST = 'compliance:countries'

    # Performance tracking
    CACHE_STATS = 'compliance:cache_stats'
    SLOW_QUERIES = 'compliance:slow_queries'

    @staticmethod
    def format_key(template: str, **kwargs) -> str:
        """Format cache key with provided parameters"""
        # Clean None values
        clean_kwargs = {k: v for k, v in kwargs.items() if v is not None}
        return template.format(**clean_kwargs)

    @staticmethod
    def generate_hash_key(data: Dict[str, Any]) -> str:
        """Generate hash-based cache key for complex queries"""
        data_str = json.dumps(data, sort_keys=True, cls=DjangoJSONEncoder)
        return hashlib.md5(data_str.encode()).hexdigest()[:16]


class ComplianceCacheManager:
    """
    High-level cache management for compliance system.
    Provides intelligent caching with automatic invalidation.
    """

    def __init__(self):
        self.keys = ComplianceCacheKeys()
        self.default_ttl = getattr(settings, 'COMPLIANCE_CACHE_SETTINGS', {}).get(
            'DASHBOARD_METRICS_TTL', 300
        )

    def get_cache_config(self) -> Dict[str, int]:
        """Get TTL configuration for different data types"""
        return getattr(settings, 'COMPLIANCE_CACHE_SETTINGS', {
            'DASHBOARD_METRICS_TTL': 300,     # 5 minutes
            'VIOLATION_SUMMARY_TTL': 120,     # 2 minutes
            'TRENDS_DATA_TTL': 1800,          # 30 minutes
            'USER_SPECIFIC_TTL': 60,          # 1 minute
            'REALTIME_CHECK_TTL': 30,         # 30 seconds
        })

    def cache_dashboard_metrics(self, user_id: int, venue_id: Optional[int],
                              start_date: Optional[str], end_date: Optional[str],
                              data: Dict[str, Any]) -> bool:
        """Cache dashboard metrics with intelligent TTL"""
        try:
            key = self.keys.format_key(
                self.keys.DASHBOARD_METRICS,
                user_id=user_id,
                venue_id=venue_id or 'all',
                start=start_date or 'none',
                end=end_date or 'none'
            )

            ttl = self.get_cache_config()['DASHBOARD_METRICS_TTL']

            # Add metadata for cache management
            cache_data = {
                'data': data,
                'cached_at': timezone.now().isoformat(),
                'ttl': ttl,
                'user_id': user_id,
                'venue_id': venue_id,
            }

            success = cache.set(key, cache_data, timeout=ttl)

            if success:
                self._track_cache_operation('dashboard_metrics', 'set', key)
                logger.info(f"Cached dashboard metrics for user {user_id}, venue {venue_id}")

            return success

        except Exception as e:
            logger.error(f"Failed to cache dashboard metrics: {str(e)}")
            return False

    def get_dashboard_metrics(self, user_id: int, venue_id: Optional[int],
                            start_date: Optional[str], end_date: Optional[str]) -> Optional[Dict[str, Any]]:
        """Retrieve cached dashboard metrics"""
        try:
            key = self.keys.format_key(
                self.keys.DASHBOARD_METRICS,
                user_id=user_id,
                venue_id=venue_id or 'all',
                start=start_date or 'none',
                end=end_date or 'none'
            )

            cached_data = cache.get(key)

            if cached_data:
                self._track_cache_operation('dashboard_metrics', 'hit', key)
                logger.debug(f"Cache hit for dashboard metrics: {key}")
                return cached_data['data']
            else:
                self._track_cache_operation('dashboard_metrics', 'miss', key)
                logger.debug(f"Cache miss for dashboard metrics: {key}")
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached dashboard metrics: {str(e)}")
            return None

    def cache_violation_summary(self, user_id: int, data: Dict[str, Any]) -> bool:
        """Cache violation summary data"""
        try:
            key = self.keys.format_key(self.keys.VIOLATION_SUMMARY, user_id=user_id)
            ttl = self.get_cache_config()['VIOLATION_SUMMARY_TTL']

            cache_data = {
                'data': data,
                'cached_at': timezone.now().isoformat(),
                'user_id': user_id,
            }

            success = cache.set(key, cache_data, timeout=ttl)

            if success:
                self._track_cache_operation('violation_summary', 'set', key)
                logger.info(f"Cached violation summary for user {user_id}")

            return success

        except Exception as e:
            logger.error(f"Failed to cache violation summary: {str(e)}")
            return False

    def get_violation_summary(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve cached violation summary"""
        try:
            key = self.keys.format_key(self.keys.VIOLATION_SUMMARY, user_id=user_id)
            cached_data = cache.get(key)

            if cached_data:
                self._track_cache_operation('violation_summary', 'hit', key)
                return cached_data['data']
            else:
                self._track_cache_operation('violation_summary', 'miss', key)
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached violation summary: {str(e)}")
            return None

    def cache_trends_data(self, days: int, group_by: str, user_id: Optional[int],
                         data: List[Dict[str, Any]]) -> bool:
        """Cache trends analysis data"""
        try:
            key = self.keys.format_key(
                self.keys.VIOLATION_TRENDS,
                days=days,
                group_by=group_by,
                user_id=user_id or 'all'
            )

            ttl = self.get_cache_config()['TRENDS_DATA_TTL']

            cache_data = {
                'data': data,
                'cached_at': timezone.now().isoformat(),
                'parameters': {'days': days, 'group_by': group_by, 'user_id': user_id},
            }

            success = cache.set(key, cache_data, timeout=ttl)

            if success:
                self._track_cache_operation('trends_data', 'set', key)
                logger.info(f"Cached trends data: {days} days, group by {group_by}")

            return success

        except Exception as e:
            logger.error(f"Failed to cache trends data: {str(e)}")
            return False

    def get_trends_data(self, days: int, group_by: str,
                       user_id: Optional[int]) -> Optional[List[Dict[str, Any]]]:
        """Retrieve cached trends data"""
        try:
            key = self.keys.format_key(
                self.keys.VIOLATION_TRENDS,
                days=days,
                group_by=group_by,
                user_id=user_id or 'all'
            )

            cached_data = cache.get(key)

            if cached_data:
                self._track_cache_operation('trends_data', 'hit', key)
                return cached_data['data']
            else:
                self._track_cache_operation('trends_data', 'miss', key)
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached trends data: {str(e)}")
            return None

    def cache_realtime_check(self, user_id: int, venue_id: Optional[int],
                           check_date: str, result: Dict[str, Any]) -> bool:
        """Cache real-time compliance check results"""
        try:
            key = self.keys.format_key(
                self.keys.REALTIME_CHECK,
                user_id=user_id,
                venue_id=venue_id or 'any',
                date=check_date
            )

            ttl = self.get_cache_config()['REALTIME_CHECK_TTL']

            cache_data = {
                'result': result,
                'cached_at': timezone.now().isoformat(),
                'user_id': user_id,
                'venue_id': venue_id,
            }

            success = cache.set(key, cache_data, timeout=ttl)

            if success:
                self._track_cache_operation('realtime_check', 'set', key)

            return success

        except Exception as e:
            logger.error(f"Failed to cache realtime check: {str(e)}")
            return False

    def get_realtime_check(self, user_id: int, venue_id: Optional[int],
                          check_date: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached real-time compliance check"""
        try:
            key = self.keys.format_key(
                self.keys.REALTIME_CHECK,
                user_id=user_id,
                venue_id=venue_id or 'any',
                date=check_date
            )

            cached_data = cache.get(key)

            if cached_data:
                self._track_cache_operation('realtime_check', 'hit', key)
                return cached_data['result']
            else:
                self._track_cache_operation('realtime_check', 'miss', key)
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve cached realtime check: {str(e)}")
            return None

    def invalidate_user_cache(self, user_id: int):
        """Invalidate all cached data for a specific user"""
        try:
            patterns = [
                self.keys.format_key(self.keys.DASHBOARD_METRICS, user_id=user_id, venue_id='*', start='*', end='*'),
                self.keys.format_key(self.keys.VIOLATION_SUMMARY, user_id=user_id),
                self.keys.format_key(self.keys.PENDING_VIOLATIONS, user_id=user_id),
                self.keys.format_key(self.keys.VIOLATION_TRENDS, days='*', group_by='*', user_id=user_id),
                self.keys.format_key(self.keys.REALTIME_CHECK, user_id=user_id, venue_id='*', date='*'),
                self.keys.format_key(self.keys.USER_COMPLIANCE_PROFILE, user_id=user_id),
            ]

            invalidated_count = 0
            for pattern in patterns:
                # Note: In production, you might use Redis SCAN with pattern matching
                # For now, we'll delete specific known keys
                keys_to_delete = cache.keys(pattern) if hasattr(cache, 'keys') else []
                for key in keys_to_delete:
                    if cache.delete(key):
                        invalidated_count += 1

            self._track_cache_operation('invalidation', 'user', f'user_{user_id}')
            logger.info(f"Invalidated {invalidated_count} cache entries for user {user_id}")

        except Exception as e:
            logger.error(f"Failed to invalidate user cache: {str(e)}")

    def invalidate_venue_cache(self, venue_id: int):
        """Invalidate all cached data for a specific venue"""
        try:
            patterns = [
                self.keys.format_key(self.keys.DASHBOARD_METRICS, user_id='*', venue_id=venue_id, start='*', end='*'),
                self.keys.format_key(self.keys.LIVE_STATUS, venue_id=venue_id),
                self.keys.format_key(self.keys.VENUE_COMPLIANCE_SETTINGS, venue_id=venue_id),
                self.keys.format_key(self.keys.REALTIME_CHECK, user_id='*', venue_id=venue_id, date='*'),
            ]

            invalidated_count = 0
            for pattern in patterns:
                keys_to_delete = cache.keys(pattern) if hasattr(cache, 'keys') else []
                for key in keys_to_delete:
                    if cache.delete(key):
                        invalidated_count += 1

            self._track_cache_operation('invalidation', 'venue', f'venue_{venue_id}')
            logger.info(f"Invalidated {invalidated_count} cache entries for venue {venue_id}")

        except Exception as e:
            logger.error(f"Failed to invalidate venue cache: {str(e)}")

    def invalidate_global_cache(self):
        """Invalidate global compliance cache (compliance profiles, regulations, etc.)"""
        try:
            global_keys = [
                self.keys.ACTIVE_COMPLIANCE_PROFILE,
                self.keys.VIOLATION_TYPES,
                self.keys.COUNTRIES_LIST,
            ]

            invalidated_count = 0
            for key in global_keys:
                if cache.delete(key):
                    invalidated_count += 1

            self._track_cache_operation('invalidation', 'global', 'global_data')
            logger.info(f"Invalidated {invalidated_count} global cache entries")

        except Exception as e:
            logger.error(f"Failed to invalidate global cache: {str(e)}")

    def warm_cache_for_user(self, user_id: int):
        """Warm cache with commonly accessed data for a user"""
        try:
            from .models import User
            from .views import ComplianceViolationViewSet, ComplianceReportViewSet

            user = User.objects.get(id=user_id)

            # Warm violation summary
            try:
                viewset = ComplianceViolationViewSet()
                # This would call the actual view method to populate cache
                logger.info(f"Cache warming initiated for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to warm cache for user {user_id}: {str(e)}")

        except Exception as e:
            logger.error(f"Cache warming failed: {str(e)}")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        try:
            stats = cache.get(self.keys.CACHE_STATS, {
                'hits': 0,
                'misses': 0,
                'sets': 0,
                'invalidations': 0,
                'last_reset': timezone.now().isoformat()
            })

            # Calculate hit rate
            total_requests = stats['hits'] + stats['misses']
            hit_rate = (stats['hits'] / total_requests * 100) if total_requests > 0 else 0

            return {
                **stats,
                'hit_rate_percentage': round(hit_rate, 2),
                'total_requests': total_requests
            }

        except Exception as e:
            logger.error(f"Failed to get cache stats: {str(e)}")
            return {}

    def reset_cache_stats(self):
        """Reset cache performance statistics"""
        try:
            stats = {
                'hits': 0,
                'misses': 0,
                'sets': 0,
                'invalidations': 0,
                'last_reset': timezone.now().isoformat()
            }

            cache.set(self.keys.CACHE_STATS, stats, timeout=86400)  # 24 hours
            logger.info("Cache statistics reset")

        except Exception as e:
            logger.error(f"Failed to reset cache stats: {str(e)}")

    def _track_cache_operation(self, operation_type: str, operation: str, key: str):
        """Track cache operations for performance monitoring"""
        try:
            stats = cache.get(self.keys.CACHE_STATS, {
                'hits': 0,
                'misses': 0,
                'sets': 0,
                'invalidations': 0,
                'last_reset': timezone.now().isoformat()
            })

            if operation == 'hit':
                stats['hits'] += 1
            elif operation == 'miss':
                stats['misses'] += 1
            elif operation == 'set':
                stats['sets'] += 1
            elif operation in ['user', 'venue', 'global']:
                stats['invalidations'] += 1

            cache.set(self.keys.CACHE_STATS, stats, timeout=86400)  # 24 hours

        except Exception as e:
            logger.error(f"Failed to track cache operation: {str(e)}")


# Decorator for automatic caching
def cache_compliance_data(cache_key_template: str, ttl: Optional[int] = None,
                         user_specific: bool = True):
    """
    Decorator for automatic caching of compliance data.

    Args:
        cache_key_template: Template for cache key (e.g., 'compliance:data:{user_id}')
        ttl: Time to live in seconds (defaults to configured value)
        user_specific: Whether to include user_id in cache key
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_manager = ComplianceCacheManager()

            # Try to generate cache key
            try:
                if user_specific and 'user_id' in kwargs:
                    cache_key = cache_key_template.format(**kwargs)
                elif user_specific and args and hasattr(args[0], 'user'):
                    cache_key = cache_key_template.format(user_id=args[0].user.id, **kwargs)
                else:
                    cache_key = cache_key_template.format(**kwargs)

                # Try to get from cache
                cached_result = cache.get(cache_key)
                if cached_result is not None:
                    cache_manager._track_cache_operation('decorator', 'hit', cache_key)
                    return cached_result

                # Execute function and cache result
                result = func(*args, **kwargs)

                # Determine TTL
                effective_ttl = ttl or cache_manager.default_ttl

                # Cache result
                cache.set(cache_key, result, timeout=effective_ttl)
                cache_manager._track_cache_operation('decorator', 'set', cache_key)

                return result

            except Exception as e:
                logger.error(f"Cache decorator error: {str(e)}")
                # If caching fails, still execute the function
                return func(*args, **kwargs)

        return wrapper
    return decorator


# Global cache manager instance
compliance_cache = ComplianceCacheManager()