"""
Multi-Tenant Database Query Optimizations for Security Firm Onboarding System

This module provides optimized Django ORM patterns for multi-tenant operations,
ensuring efficient company-scoped queries and proper data isolation.
"""

from django.db import models, connection
from django.db.models import (
    Q, F, Count, Sum, Avg, Max, Min,
    Prefetch, OuterRef, Subquery, Exists,
    Window, Value, Case, When, ExpressionWrapper
)
from django.db.models.functions import Coalesce, TruncMonth, TruncDate
from django.contrib.postgres.indexes import GinIndex
from django.core.cache import cache
from django.utils import timezone
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class CompanyQuerySetMixin:
    """
    Mixin to add company-scoped filtering to any QuerySet.
    Ensures all queries are properly scoped to a specific company.
    """

    def for_company(self, company_id):
        """Filter queryset to specific company"""
        if company_id is None:
            raise ValueError("Company ID cannot be None for multi-tenant queries")
        return self.filter(company_id=company_id)

    def for_company_with_prefetch(self, company_id, *prefetch_related):
        """Filter by company with optimized prefetch"""
        return self.for_company(company_id).select_related('company').prefetch_related(*prefetch_related)


class OptimizedVenueQuerySet(models.QuerySet, CompanyQuerySetMixin):
    """Optimized queries for Venue model with company scoping"""

    def active_venues_for_company(self, company_id):
        """Get active venues for a company with location data"""
        return self.for_company(company_id).filter(
            is_active=True
        ).select_related('company').order_by('name')

    def venues_with_shift_stats(self, company_id, date_range=None):
        """Get venues with shift statistics for analytics"""
        queryset = self.for_company(company_id).annotate(
            total_shifts=Count('shifts'),
            active_shifts=Count('shifts', filter=Q(shifts__status='active')),
            completed_shifts=Count('shifts', filter=Q(shifts__status='completed')),
            upcoming_shifts=Count('shifts', filter=Q(shifts__start_time__gte=timezone.now())),
            avg_capacity_utilization=Avg(
                F('shifts__staff_count') * 100.0 / F('capacity'),
                output_field=models.DecimalField()
            )
        )

        if date_range:
            queryset = queryset.filter(
                shifts__start_time__range=date_range
            )

        return queryset.select_related('company')

    def venues_near_location(self, company_id, latitude, longitude, radius_km=50):
        """Find venues near a specific location using Haversine formula"""
        # Use database function for efficient geolocation queries
        return self.for_company(company_id).filter(
            latitude__isnull=False,
            longitude__isnull=False
        ).annotate(
            distance=ExpressionWrapper(
                6371 * models.functions.ACos(
                    models.functions.Cos(models.functions.Radians(latitude)) *
                    models.functions.Cos(models.functions.Radians(F('latitude'))) *
                    models.functions.Cos(models.functions.Radians(F('longitude') - longitude)) +
                    models.functions.Sin(models.functions.Radians(latitude)) *
                    models.functions.Sin(models.functions.Radians(F('latitude')))
                ),
                output_field=models.DecimalField(max_digits=8, decimal_places=3)
            )
        ).filter(distance__lte=radius_km).order_by('distance')


class OptimizedShiftQuerySet(models.QuerySet, CompanyQuerySetMixin):
    """Optimized queries for Shift model with company scoping"""

    def shifts_for_company_dashboard(self, company_id, date_range=None):
        """Get shifts optimized for company dashboard with all related data"""
        queryset = self.for_company(company_id).select_related(
            'staff_user',
            'venue',
            'venue__company'
        ).prefetch_related(
            Prefetch(
                'staff_user__profile',
                to_attr='staff_profile'
            )
        )

        if date_range:
            queryset = queryset.filter(start_time__range=date_range)

        return queryset.order_by('-start_time')

    def company_shift_analytics(self, company_id, start_date=None, end_date=None):
        """Generate comprehensive shift analytics for a company"""
        queryset = self.for_company(company_id)

        if start_date and end_date:
            queryset = queryset.filter(
                start_time__gte=start_date,
                end_time__lte=end_date
            )

        # Use window functions for advanced analytics
        return queryset.annotate(
            # Monthly grouping
            month=TruncMonth('start_time'),
            date=TruncDate('start_time'),

            # Running totals
            running_total_hours=Window(
                expression=Sum('actual_hours_worked'),
                order_by=F('start_time').asc(),
                frame=models.RowRange(start=None, end=0)
            ),

            # Staff utilization metrics
            venue_utilization=F('staff_count') * 100.0 / F('venue__capacity'),

            # Cost calculations
            shift_cost=F('actual_hours_worked') * F('hourly_rate'),
        ).values(
            'month', 'date', 'status'
        ).annotate(
            shift_count=Count('id'),
            total_hours=Sum('actual_hours_worked'),
            total_cost=Sum('shift_cost'),
            avg_utilization=Avg('venue_utilization'),
            unique_staff=Count('staff_user', distinct=True),
            unique_venues=Count('venue', distinct=True)
        )

    def shifts_requiring_approval(self, company_id):
        """Get shifts pending approval for company managers"""
        return self.for_company(company_id).filter(
            status='pending_approval'
        ).select_related(
            'staff_user',
            'venue',
            'staff_user__profile'
        ).order_by('end_time')

    def company_staff_utilization(self, company_id, date_range=None):
        """Analyze staff utilization across company"""
        queryset = self.for_company(company_id).filter(
            status__in=['completed', 'approved']
        )

        if date_range:
            queryset = queryset.filter(start_time__range=date_range)

        return queryset.values(
            'staff_user__id',
            'staff_user__username',
            'staff_user__first_name',
            'staff_user__last_name'
        ).annotate(
            total_shifts=Count('id'),
            total_hours=Sum('actual_hours_worked'),
            avg_hours_per_shift=Avg('actual_hours_worked'),
            total_earnings=Sum(F('actual_hours_worked') * F('hourly_rate')),
            venues_worked=Count('venue', distinct=True),
            last_shift=Max('end_time')
        ).order_by('-total_hours')


class OptimizedUserCompanyQuerySet(models.QuerySet):
    """Optimized queries for UserCompanyMembership model"""

    def active_memberships_for_user(self, user_id):
        """Get active company memberships for a user"""
        return self.filter(
            user_id=user_id,
            company__is_active=True
        ).select_related(
            'company',
            'user'
        ).order_by('-is_owner', 'joined_at')

    def company_staff_list(self, company_id, role=None):
        """Get staff list for a company with optimized queries"""
        queryset = self.filter(
            company_id=company_id
        ).select_related(
            'user',
            'company'
        ).prefetch_related(
            Prefetch(
                'user__profile',
                to_attr='staff_profile'
            ),
            Prefetch(
                'user__sia_licenses',
                queryset=models.Q(status='valid'),
                to_attr='valid_licenses'
            )
        )

        if role:
            queryset = queryset.filter(role=role)

        return queryset.order_by('user__first_name', 'user__last_name')

    def company_managers(self, company_id):
        """Get all managers for a company"""
        return self.filter(
            company_id=company_id,
            role__in=['admin', 'manager']
        ).select_related('user', 'company')

    def users_with_multiple_companies(self):
        """Find users belonging to multiple companies (for analytics)"""
        return self.values('user').annotate(
            company_count=Count('company')
        ).filter(company_count__gt=1)


class CompanyDataCache:
    """
    Caching strategies for frequently accessed company data
    """

    CACHE_TIMEOUT = 300  # 5 minutes

    @classmethod
    def get_company_stats_cache_key(cls, company_id):
        return f"company_stats_{company_id}"

    @classmethod
    def get_company_venues_cache_key(cls, company_id):
        return f"company_venues_{company_id}"

    @classmethod
    def get_company_staff_cache_key(cls, company_id):
        return f"company_staff_{company_id}"

    @classmethod
    def cache_company_stats(cls, company_id, stats):
        """Cache company statistics"""
        cache_key = cls.get_company_stats_cache_key(company_id)
        cache.set(cache_key, stats, cls.CACHE_TIMEOUT)

    @classmethod
    def get_cached_company_stats(cls, company_id):
        """Retrieve cached company statistics"""
        cache_key = cls.get_company_stats_cache_key(company_id)
        return cache.get(cache_key)

    @classmethod
    def invalidate_company_cache(cls, company_id):
        """Invalidate all cache entries for a company"""
        cache_keys = [
            cls.get_company_stats_cache_key(company_id),
            cls.get_company_venues_cache_key(company_id),
            cls.get_company_staff_cache_key(company_id)
        ]
        cache.delete_many(cache_keys)


class DatabaseFunctions:
    """
    Custom database functions for common multi-tenant operations
    """

    @staticmethod
    def create_company_scoped_view(company_model_name, related_models):
        """
        Create database view for efficient company-scoped queries
        """
        sql = f"""
        CREATE OR REPLACE VIEW company_dashboard_view AS
        SELECT
            c.id as company_id,
            c.name as company_name,
            c.country_code,
            COUNT(DISTINCT v.id) as total_venues,
            COUNT(DISTINCT s.id) as total_shifts,
            COUNT(DISTINCT ucm.user_id) as total_staff,
            SUM(CASE WHEN s.status = 'completed' THEN s.actual_hours_worked ELSE 0 END) as total_hours_worked,
            AVG(v.capacity) as avg_venue_capacity
        FROM {company_model_name} c
        LEFT JOIN venues v ON v.company_id = c.id
        LEFT JOIN shifts s ON s.company_id = c.id
        LEFT JOIN user_company_memberships ucm ON ucm.company_id = c.id
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.country_code;
        """

        with connection.cursor() as cursor:
            cursor.execute(sql)

    @staticmethod
    def bulk_update_company_stats():
        """
        Efficiently update denormalized company statistics
        """
        sql = """
        WITH company_stats AS (
            SELECT
                c.id,
                COUNT(DISTINCT v.id) as venue_count,
                COUNT(DISTINCT ucm.user_id) as staff_count,
                COUNT(DISTINCT s.id) as total_shifts,
                SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed_shifts
            FROM security_companies c
            LEFT JOIN venues v ON v.company_id = c.id AND v.is_active = true
            LEFT JOIN user_company_memberships ucm ON ucm.company_id = c.id
            LEFT JOIN shifts s ON s.company_id = c.id
            WHERE c.is_active = true
            GROUP BY c.id
        )
        UPDATE security_companies
        SET
            venue_count = cs.venue_count,
            staff_count = cs.staff_count,
            total_shifts = cs.total_shifts,
            completed_shifts = cs.completed_shifts,
            updated_at = NOW()
        FROM company_stats cs
        WHERE security_companies.id = cs.id;
        """

        with connection.cursor() as cursor:
            cursor.execute(sql)
            return cursor.rowcount


class MultiTenantQueryOptimizer:
    """
    Main class for coordinating multi-tenant query optimizations
    """

    def __init__(self, company_id):
        self.company_id = company_id
        if not company_id:
            raise ValueError("Company ID is required for multi-tenant operations")

    def get_company_dashboard_data(self):
        """
        Get comprehensive dashboard data for a company with optimized queries
        """
        # Use cached data if available
        cached_stats = CompanyDataCache.get_cached_company_stats(self.company_id)
        if cached_stats:
            return cached_stats

        from .models import Venue, Shift, UserCompanyMembership

        # Execute optimized queries in parallel conceptually
        venue_stats = Venue.objects.venues_with_shift_stats(self.company_id)[:10]
        shift_analytics = Shift.objects.company_shift_analytics(
            self.company_id,
            start_date=timezone.now() - timezone.timedelta(days=30)
        )
        staff_utilization = Shift.objects.company_staff_utilization(
            self.company_id,
            date_range=[timezone.now() - timezone.timedelta(days=30), timezone.now()]
        )[:10]

        dashboard_data = {
            'company_id': self.company_id,
            'venue_stats': list(venue_stats),
            'shift_analytics': list(shift_analytics),
            'staff_utilization': list(staff_utilization),
            'generated_at': timezone.now().isoformat()
        }

        # Cache the results
        CompanyDataCache.cache_company_stats(self.company_id, dashboard_data)

        return dashboard_data

    def validate_company_access(self, user_id):
        """
        Validate that a user has access to the company
        """
        from .models import UserCompanyMembership

        return UserCompanyMembership.objects.filter(
            user_id=user_id,
            company_id=self.company_id
        ).exists()

    def get_company_compliance_data(self):
        """
        Get compliance-related data for the company based on region
        """
        from .models import SecurityCompany, WorkingHoursRegulation

        try:
            company = SecurityCompany.objects.select_related('compliance_profile').get(
                id=self.company_id
            )

            # Get applicable working hours regulations
            regulations = WorkingHoursRegulation.objects.filter(
                country=company.country_code,
                is_active=True
            ).order_by('-updated_at')[:1]

            return {
                'company': company,
                'regulations': list(regulations),
                'compliance_profile': company.compliance_profile
            }

        except SecurityCompany.DoesNotExist:
            logger.error(f"Company {self.company_id} not found for compliance data")
            return None


# Custom managers for models to use optimized querysets
class OptimizedVenueManager(models.Manager):
    def get_queryset(self):
        return OptimizedVenueQuerySet(self.model, using=self._db)

    def for_company(self, company_id):
        return self.get_queryset().for_company(company_id)


class OptimizedShiftManager(models.Manager):
    def get_queryset(self):
        return OptimizedShiftQuerySet(self.model, using=self._db)

    def for_company(self, company_id):
        return self.get_queryset().for_company(company_id)


class OptimizedUserCompanyManager(models.Manager):
    def get_queryset(self):
        return OptimizedUserCompanyQuerySet(self.model, using=self._db)