"""
Django ORM Expert - Compliance System Query Optimizations
High-performance query patterns and manager methods for compliance reporting.
Enhanced with JSON field optimizations and advanced caching strategies.
"""

from django.db import models, connection
from django.db.models import (
    Count, Sum, Avg, Max, Min, Q, F, Case, When, Value,
    IntegerField, DecimalField, DateTimeField, DurationField,
    Window, RowRange, Subquery, OuterRef, Exists,
    ExpressionWrapper, BooleanField
)
from django.db.models.functions import (
    TruncDate, TruncWeek, TruncMonth, Extract, Coalesce, Greatest, Least,
    Cast, Now, Upper, Concat
)
from django.contrib.postgres.aggregates import ArrayAgg, StringAgg, JSONBAgg
from django.contrib.postgres.fields import JSONField as PostgresJSONField
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta, datetime
from decimal import Decimal
import json
import logging

logger = logging.getLogger(__name__)


class OptimizedComplianceViolationManager(models.Manager):
    """
    High-performance manager for ComplianceViolation model with optimized query methods.
    All queries designed to use specific database indexes for maximum performance.
    """

    def get_queryset(self):
        """Optimize default queryset with select_related for common joins"""
        return super().get_queryset().select_related(
            'user', 'shift__venue', 'approved_by', 'resolved_by'
        )

    def active_violations(self):
        """
        Get all unresolved violations - Uses compliance_violations_dashboard_idx.
        Performance target: < 50ms for 10k+ violations
        """
        return self.get_queryset().filter(
            resolution_status__in=['open', 'investigating', 'pending_approval']
        ).order_by('-created_at')

    def dashboard_summary(self, days_back=7):
        """
        Optimized single-query dashboard summary for managers.
        Uses compliance_violations_dashboard_idx for optimal performance.
        Performance target: < 200ms
        """
        cutoff_date = timezone.now() - timedelta(days=days_back)

        return self.get_queryset().filter(
            created_at__gte=cutoff_date,
            resolution_status__in=['open', 'investigating', 'pending_approval']
        ).aggregate(
            total_violations=Count('id'),
            critical_count=Count('id', filter=Q(severity='critical')),
            major_count=Count('id', filter=Q(severity='major')),
            minor_count=Count('id', filter=Q(severity='minor')),
            warning_count=Count('id', filter=Q(severity='warning')),
            overtime_violations=Count('id', filter=Q(
                violation_type__in=['daily_overtime', 'weekly_overtime', 'unauthorized_overtime']
            )),
            rest_violations=Count('id', filter=Q(violation_type='insufficient_rest')),
            location_violations=Count('id', filter=Q(violation_type='location_violation')),
            avg_resolution_days=Avg(
                Case(
                    When(resolved_at__isnull=False,
                         then=Extract(F('resolved_at') - F('created_at'), 'days')),
                    default=None,
                    output_field=DecimalField()
                )
            ),
            total_financial_impact=Sum('financial_impact'),
            pending_approvals=Count('id', filter=Q(resolution_status='pending_approval'))
        )

    def user_compliance_status(self, user, period_start, period_end):
        """
        Real-time compliance status check for shift scheduling validation.
        Uses compliance_violations_realtime_check_idx for < 50ms performance.
        """
        violations_query = self.filter(
            user=user,
            period_start__gte=period_start,
            period_end__lte=period_end
        )

        # Get active violations by type for quick risk assessment
        results = violations_query.values('violation_type').annotate(
            count=Count('id'),
            active_count=Count('id', filter=Q(
                resolution_status__in=['open', 'investigating']
            )),
            critical_count=Count('id', filter=Q(severity='critical')),
            latest_violation=Max('created_at'),
            avg_threshold_exceeded=Avg('threshold_exceeded'),
            total_financial_impact=Sum('financial_impact')
        ).order_by('-latest_violation')

        return list(results)

    def bulk_violation_report(self, start_date, end_date, user_list=None):
        """
        Efficiently generate comprehensive violation reports for multiple users.
        Minimizes database hits through single-query aggregation.
        Performance target: < 2s for 1000+ users
        """
        queryset = self.get_queryset().filter(
            period_start__gte=start_date,
            period_end__lte=end_date
        )

        if user_list:
            queryset = queryset.filter(user__in=user_list)

        return queryset.values(
            'user__id',
            'user__first_name',
            'user__last_name',
            'user__email',
            'user__staffprofile__employee_id'
        ).annotate(
            total_violations=Count('id'),
            critical_violations=Count('id', filter=Q(severity='critical')),
            major_violations=Count('id', filter=Q(severity='major')),
            minor_violations=Count('id', filter=Q(severity='minor')),
            warning_violations=Count('id', filter=Q(severity='warning')),
            resolved_violations=Count('id', filter=Q(resolution_status='resolved')),
            pending_violations=Count('id', filter=Q(
                resolution_status__in=['open', 'investigating', 'pending_approval']
            )),
            latest_violation=Max('created_at'),
            oldest_unresolved=Min('created_at', filter=Q(
                resolution_status__in=['open', 'investigating', 'pending_approval']
            )),
            avg_resolution_days=Avg(
                Case(
                    When(resolved_at__isnull=False,
                         then=Cast(F('resolved_at') - F('created_at'), IntegerField())),
                    default=None
                )
            ),
            compliance_score_impact=Sum('compliance_score_impact'),
            total_financial_impact=Sum('financial_impact'),

            # Violation type breakdown
            overtime_violations=Count('id', filter=Q(
                violation_type__in=['daily_overtime', 'weekly_overtime', 'unauthorized_overtime']
            )),
            rest_violations=Count('id', filter=Q(violation_type='insufficient_rest')),
            consecutive_day_violations=Count('id', filter=Q(violation_type='consecutive_days')),
            break_violations=Count('id', filter=Q(violation_type='missing_break')),
            attendance_violations=Count('id', filter=Q(
                violation_type__in=['late_checkin', 'early_checkout', 'shift_abandonment']
            ))
        ).order_by('-total_violations', '-latest_violation')

    def violation_trends(self, days=30, group_by='day'):
        """
        Efficient violation trend analysis for dashboards and analytics.
        Uses time-based BRIN index for optimal performance.
        """
        cutoff_date = timezone.now() - timedelta(days=days)

        if group_by == 'day':
            trunc_func = TruncDate
        elif group_by == 'week':
            trunc_func = TruncWeek
        elif group_by == 'month':
            trunc_func = TruncMonth
        else:
            trunc_func = TruncDate

        return self.get_queryset().filter(
            created_at__gte=cutoff_date
        ).annotate(
            period=trunc_func('created_at')
        ).values('period', 'violation_type', 'severity').annotate(
            count=Count('id'),
            unique_users=Count('user', distinct=True),
            avg_threshold_exceeded=Avg('threshold_exceeded'),
            total_financial_impact=Sum('financial_impact'),
            resolution_rate=Case(
                When(count=0, then=Value(0)),
                default=Cast(
                    Count('id', filter=Q(resolution_status='resolved')) * 100.0 / Count('id'),
                    DecimalField()
                )
            )
        ).order_by('period', 'violation_type')

    def pending_approvals_summary(self, priority_order=True):
        """
        Manager-focused summary of pending violation approvals.
        Optimized for manager dashboard with priority ordering.
        """
        queryset = self.get_queryset().filter(
            resolution_status='pending_approval'
        ).values(
            'violation_type',
            'severity'
        ).annotate(
            count=Count('id'),
            oldest_pending=Min('created_at'),
            newest_pending=Max('created_at'),
            avg_days_pending=Avg(
                Cast(Now() - F('created_at'), IntegerField())
            ),
            total_financial_impact=Sum('financial_impact'),
            unique_users=Count('user', distinct=True),
            urgent_count=Count('id', filter=Q(
                created_at__lt=timezone.now() - timedelta(days=7)
            ))
        )

        if priority_order:
            return queryset.order_by(
                # Order by severity priority, then by count
                Case(
                    When(severity='critical', then=Value(1)),
                    When(severity='major', then=Value(2)),
                    When(severity='minor', then=Value(3)),
                    When(severity='warning', then=Value(4)),
                    default=Value(5)
                ),
                '-count'
            )
        else:
            return queryset.order_by('-count')

    def compliance_risk_assessment(self, user, days_ahead=14):
        """
        Predictive compliance risk assessment based on historical violations.
        Used for proactive shift scheduling decisions.
        """
        lookback_date = timezone.now() - timedelta(days=90)  # 90 days history
        future_date = timezone.now() + timedelta(days=days_ahead)

        # Get user's violation patterns
        violation_patterns = self.filter(
            user=user,
            created_at__gte=lookback_date
        ).aggregate(
            total_violations=Count('id'),
            overtime_frequency=Count('id', filter=Q(
                violation_type__in=['daily_overtime', 'weekly_overtime']
            )),
            rest_violations=Count('id', filter=Q(violation_type='insufficient_rest')),
            attendance_issues=Count('id', filter=Q(
                violation_type__in=['late_checkin', 'early_checkout']
            )),
            avg_severity_score=Avg(
                Case(
                    When(severity='critical', then=Value(4)),
                    When(severity='major', then=Value(3)),
                    When(severity='minor', then=Value(2)),
                    When(severity='warning', then=Value(1)),
                    default=Value(0)
                )
            ),
            recent_violations=Count('id', filter=Q(
                created_at__gte=timezone.now() - timedelta(days=30)
            ))
        )

        # Calculate risk scores
        violation_patterns['overtime_risk'] = min(
            (violation_patterns['overtime_frequency'] or 0) * 10, 100
        )
        violation_patterns['attendance_risk'] = min(
            (violation_patterns['attendance_issues'] or 0) * 15, 100
        )
        violation_patterns['overall_risk'] = min(
            (violation_patterns['total_violations'] or 0) * 5 +
            (violation_patterns['recent_violations'] or 0) * 10, 100
        )

        return violation_patterns


class OptimizedWorkingHoursMetricsManager(models.Manager):
    """
    High-performance manager for WorkingHoursMetrics with bulk operations and reporting.
    """

    def get_queryset(self):
        """Optimize with select_related for user data"""
        return super().get_queryset().select_related('user', 'user__staffprofile')

    def for_period_range(self, start_date, end_date, period_type=None):
        """
        Efficient period range queries using working_hours_metrics_period_range_idx.
        Performance target: < 500ms for large date ranges
        """
        queryset = self.get_queryset().filter(
            period_start__gte=start_date,
            period_end__lte=end_date
        )

        if period_type:
            queryset = queryset.filter(period_type=period_type)

        return queryset.order_by('period_start', 'user')

    def bulk_metrics_calculation(self, user_list, period_start, period_end, period_type='weekly'):
        """
        Efficiently calculate metrics for multiple users in single queries.
        Uses bulk operations for optimal database performance.
        """
        from django.db import transaction

        metrics_to_create = []

        # Use raw SQL for complex aggregation when needed
        with transaction.atomic():
            for user in user_list:
                # Calculate metrics from shift data
                shift_data = self._calculate_user_metrics(user, period_start, period_end)

                if shift_data:
                    metrics_to_create.append(
                        self.model(
                            user=user,
                            period_type=period_type,
                            period_start=period_start,
                            period_end=period_end,
                            **shift_data
                        )
                    )

            # Bulk create for efficiency
            if metrics_to_create:
                self.bulk_create(
                    metrics_to_create,
                    batch_size=1000,
                    update_conflicts=True,
                    update_fields=[
                        'total_hours_worked', 'regular_hours', 'overtime_hours',
                        'violation_count', 'compliance_score', 'last_updated'
                    ],
                    unique_fields=['user', 'period_type', 'period_start', 'period_end']
                )

    def compliance_dashboard_data(self, period_type='weekly', limit_users=None):
        """
        Single-query dashboard data for compliance overview.
        Optimized for manager dashboards requiring < 200ms response.
        """
        queryset = self.get_queryset().filter(
            period_type=period_type,
            period_start__gte=timezone.now() - timedelta(days=30)
        ).select_related('user')

        if limit_users:
            queryset = queryset.filter(user__in=limit_users)

        return queryset.values(
            'user__id',
            'user__first_name',
            'user__last_name'
        ).annotate(
            avg_compliance_score=Avg('compliance_score'),
            total_violations=Sum('violation_count'),
            total_hours=Sum('total_hours_worked'),
            total_overtime=Sum('overtime_hours'),
            periods_with_violations=Count('id', filter=Q(violation_count__gt=0)),
            latest_period=Max('period_end'),
            attendance_rate=Avg('attendance_rate'),
            punctuality_score=Avg('punctuality_score'),

            # Risk indicators
            high_violation_periods=Count('id', filter=Q(violation_count__gte=3)),
            low_compliance_periods=Count('id', filter=Q(compliance_score__lt=80)),
            excessive_overtime=Count('id', filter=Q(overtime_hours__gte=10))
        ).order_by('-total_violations', '-total_hours')

    def recalculation_queue(self):
        """
        Efficiently get metrics needing recalculation.
        Uses working_hours_metrics_bulk_calc_idx for fast performance.
        """
        return self.get_queryset().filter(
            needs_recalculation=True
        ).select_related('user').order_by('period_start')

    def _calculate_user_metrics(self, user, period_start, period_end):
        """
        Internal method to calculate metrics from shift data.
        Uses optimized queries with database functions where possible.
        """
        from django.apps import apps
        Shift = apps.get_model('api', 'Shift')
        ComplianceViolation = apps.get_model('api', 'ComplianceViolation')

        # Get shifts for period
        shifts = Shift.objects.filter(
            staff_user=user,
            start_time__gte=period_start,
            start_time__lt=period_end,
            status__in=['completed', 'approved']
        ).aggregate(
            total_hours=Sum('actual_hours_worked'),
            total_shifts=Count('id'),
            completed_shifts=Count('id', filter=Q(status='completed')),
            avg_shift_duration=Avg('actual_hours_worked'),
            break_hours=Sum(Cast(F('break_duration'), DecimalField()) / 60.0),
            venues_worked=Count('venue', distinct=True)
        )

        if not shifts['total_hours']:
            return None

        # Calculate violations for period
        violations = ComplianceViolation.objects.filter(
            user=user,
            period_start__gte=period_start,
            period_end__lte=period_end
        ).aggregate(
            violation_count=Count('id'),
            warning_count=Count('id', filter=Q(severity='warning')),
            avg_compliance_impact=Avg('compliance_score_impact')
        )

        # Calculate compliance score using database function
        compliance_score = 100.0
        if violations['violation_count']:
            compliance_score = max(0, compliance_score - (
                violations['violation_count'] * 5 +
                violations['warning_count'] * 2
            ))

        return {
            'total_hours_worked': shifts['total_hours'] or Decimal('0.00'),
            'regular_hours': min(shifts['total_hours'] or Decimal('0.00'), Decimal('40.00')),
            'overtime_hours': max(Decimal('0.00'), (shifts['total_hours'] or Decimal('0.00')) - Decimal('40.00')),
            'break_hours': shifts['break_hours'] or Decimal('0.00'),
            'total_shifts': shifts['total_shifts'] or 0,
            'completed_shifts': shifts['completed_shifts'] or 0,
            'average_shift_duration': shifts['avg_shift_duration'] or Decimal('0.00'),
            'violation_count': violations['violation_count'] or 0,
            'warning_count': violations['warning_count'] or 0,
            'compliance_score': Decimal(str(compliance_score)),
            'venues_worked': shifts['venues_worked'] or 0,
            'calculated_at': timezone.now(),
            'last_updated': timezone.now(),
            'needs_recalculation': False
        }


# High-performance utility functions for compliance calculations
class ComplianceQueryUtils:
    """
    Utility class with optimized static methods for common compliance calculations.
    These methods use database functions and optimized queries.
    """

    @staticmethod
    def calculate_weekly_overtime(user, week_start):
        """Calculate overtime for a specific week using database functions"""
        from django.apps import apps
        Shift = apps.get_model('api', 'Shift')

        week_end = week_start + timedelta(days=7)

        return Shift.objects.filter(
            staff_user=user,
            start_time__gte=week_start,
            start_time__lt=week_end,
            status__in=['completed', 'approved']
        ).aggregate(
            total_hours=Coalesce(Sum('actual_hours_worked'), Decimal('0.00')),
            overtime_hours=Greatest(
                Sum('actual_hours_worked') - Decimal('40.00'),
                Decimal('0.00')
            )
        )

    @staticmethod
    def check_consecutive_days(user, date_to_check, max_consecutive=6):
        """Efficiently check consecutive working days using window functions"""
        from django.apps import apps
        Shift = apps.get_model('api', 'Shift')

        # Look back enough days to find the pattern
        start_check = date_to_check - timedelta(days=max_consecutive + 1)

        working_days = Shift.objects.filter(
            staff_user=user,
            start_time__date__gte=start_check,
            start_time__date__lte=date_to_check,
            status__in=['completed', 'approved', 'in_progress']
        ).values_list('start_time__date', flat=True).distinct().order_by('start_time__date')

        # Check for consecutive days
        consecutive_count = 0
        max_consecutive_found = 0
        prev_date = None

        for work_date in working_days:
            if prev_date and (work_date - prev_date).days == 1:
                consecutive_count += 1
            else:
                consecutive_count = 1

            max_consecutive_found = max(max_consecutive_found, consecutive_count)
            prev_date = work_date

        return {
            'consecutive_days': max_consecutive_found,
            'exceeds_limit': max_consecutive_found > max_consecutive
        }

    @staticmethod
    def bulk_compliance_check(user_list, start_date, end_date):
        """
        Efficient bulk compliance checking for multiple users.
        Returns comprehensive compliance status for all users.
        """
        from django.apps import apps
        ComplianceViolation = apps.get_model('api', 'ComplianceViolation')

        return ComplianceViolation.objects.filter(
            user__in=user_list,
            period_start__gte=start_date,
            period_end__lte=end_date
        ).values('user').annotate(
            total_violations=Count('id'),
            active_violations=Count('id', filter=Q(
                resolution_status__in=['open', 'investigating']
            )),
            critical_violations=Count('id', filter=Q(severity='critical')),
            compliance_score=Case(
                When(total_violations=0, then=Value(100.0)),
                default=Greatest(
                    Value(0.0),
                    Value(100.0) - (Count('id') * 5.0)
                )
            ),
            risk_level=Case(
                When(critical_violations__gt=0, then=Value('HIGH')),
                When(total_violations__gt=3, then=Value('MEDIUM')),
                default=Value('LOW')
            )
        )


class WorkingHoursRegulationQuerySet(models.QuerySet):
    """
    Optimized QuerySet for WorkingHoursRegulation with JSON field performance optimizations.
    All queries designed to leverage GIN indexes and database functions for <50ms response times.
    """

    def active_only(self):
        """Get only active regulations with optimized filtering"""
        return self.filter(is_active=True)

    def for_country(self, country_code):
        """
        Get regulation for specific country with intelligent caching.
        Uses whr_country_active_idx for optimal performance.
        """
        cache_key = f"regulation:{country_code.upper()}"
        cached_regulation = cache.get(cache_key)

        if cached_regulation:
            logger.debug(f"Cache hit for regulation: {country_code}")
            return cached_regulation

        regulation = self.filter(
            country_code__iexact=country_code,
            is_active=True
        ).first()

        if regulation:
            cache.set(cache_key, regulation, 300)  # 5 minute cache
            logger.debug(f"Cached regulation for: {country_code}")

        return regulation

    def with_security_overrides(self):
        """
        Filter regulations with security industry specific rules.
        Uses whr_security_sector_overrides_gin index for fast JSON queries.
        """
        return self.filter(
            security_sector_overrides__isnull=False
        ).exclude(
            security_sector_overrides={}
        )

    def requiring_sia_license(self):
        """
        Filter regulations requiring SIA license for security work.
        Uses whr_sia_license_required_idx functional index.
        """
        return self.filter(
            security_sector_overrides__sia_license_required=True
        )

    def supports_opt_out(self):
        """
        Filter regulations allowing working time directive opt-outs.
        Uses whr_opt_out_allowed_idx functional index.
        """
        return self.filter(
            opt_out_provisions__allowed=True
        )

    def with_custom_breaks(self):
        """Filter regulations with custom break requirements"""
        return self.filter(
            break_requirements__isnull=False
        ).exclude(
            break_requirements={}
        )

    def us_with_state_overrides(self):
        """Get US regulations with state-specific overrides"""
        return self.filter(
            country_code='US',
            state_overrides__isnull=False
        ).exclude(
            state_overrides={}
        )

    def recently_updated(self, days=30):
        """
        Get regulations updated within specified days.
        Uses whr_regulatory_update_brin_idx for time-series optimization.
        """
        cutoff_date = timezone.now() - timedelta(days=days)
        return self.filter(
            last_regulatory_update__gte=cutoff_date
        ).order_by('-last_regulatory_update')

    def with_compliance_statistics(self):
        """
        Add comprehensive compliance statistics to regulations.
        Single query for dashboard analytics.
        """
        return self.annotate(
            # Usage statistics
            profile_count=Count('complianceprofile', distinct=True),
            active_profiles=Count(
                'complianceprofile',
                filter=Q(complianceprofile__is_active=True),
                distinct=True
            ),

            # Performance metrics
            avg_compliance_score=Avg('complianceprofile__workinghoursmetrics__compliance_score'),
            total_tracked_users=Count(
                'complianceprofile__workinghoursmetrics__user',
                distinct=True
            ),

            # Violation statistics
            total_violations=Count('complianceprofile__workinghoursmetrics__complianceviolation'),
            recent_violations=Count(
                'complianceprofile__workinghoursmetrics__complianceviolation',
                filter=Q(
                    complianceprofile__workinghoursmetrics__complianceviolation__created_at__gte=
                    timezone.now() - timedelta(days=30)
                )
            ),
            critical_violations=Count(
                'complianceprofile__workinghoursmetrics__complianceviolation',
                filter=Q(
                    complianceprofile__workinghoursmetrics__complianceviolation__severity='critical'
                )
            ),

            # Complexity scoring
            complexity_score=Case(
                When(
                    Q(security_sector_overrides__isnull=False) &
                    ~Q(security_sector_overrides={}),
                    then=Value(1)
                ),
                default=Value(0),
                output_field=IntegerField()
            ) + Case(
                When(
                    Q(state_overrides__isnull=False) &
                    ~Q(state_overrides={}),
                    then=Value(1)
                ),
                default=Value(0),
                output_field=IntegerField()
            ) + Case(
                When(
                    Q(break_requirements__isnull=False) &
                    ~Q(break_requirements={}),
                    then=Value(1)
                ),
                default=Value(0),
                output_field=IntegerField()
            ) + Case(
                When(
                    Q(night_shift_rules__isnull=False) &
                    ~Q(night_shift_rules={}),
                    then=Value(1)
                ),
                default=Value(0),
                output_field=IntegerField()
            ),

            # Effectiveness indicators
            effectiveness_score=Case(
                When(
                    Q(avg_compliance_score__gte=90) & Q(critical_violations=0),
                    then=Value(100)
                ),
                When(
                    Q(avg_compliance_score__gte=80) & Q(critical_violations__lte=2),
                    then=Value(85)
                ),
                When(
                    Q(avg_compliance_score__gte=70),
                    then=Value(70)
                ),
                default=Value(50),
                output_field=IntegerField()
            )
        )

    def regulation_summary_cached(self):
        """
        Get regulation summaries using materialized view for performance.
        Automatically falls back to regular query if view unavailable.
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT * FROM regulation_summary
                    ORDER BY country_name
                """)
                columns = [col[0] for col in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            logger.warning(f"Materialized view unavailable, using regular query: {e}")
            return list(self.active_only().values(
                'id', 'country_code', 'country_name', 'standard_weekly_hours',
                'standard_daily_hours', 'max_daily_hours', 'max_weekly_hours',
                'overtime_threshold_hours'
            ))


class WorkingHoursRegulationManager(models.Manager):
    """
    High-performance manager for WorkingHoursRegulation with caching and bulk operations.
    Provides intelligent caching strategies and database function integration.
    """

    def get_queryset(self):
        return WorkingHoursRegulationQuerySet(self.model, using=self._db)

    def active_only(self):
        return self.get_queryset().active_only()

    def for_country(self, country_code):
        return self.get_queryset().for_country(country_code)

    def with_security_overrides(self):
        return self.get_queryset().with_security_overrides()

    def supports_opt_out(self):
        return self.get_queryset().supports_opt_out()

    def requiring_sia_license(self):
        return self.get_queryset().requiring_sia_license()

    def get_effective_rules_bulk(self, countries_venues_map):
        """
        Efficiently get effective rules for multiple countries and venues.
        Uses database function for optimal performance.

        Args:
            countries_venues_map: Dict like {'GB': 'London', 'US': 'NY', 'FR': None}

        Returns:
            Dict with country codes as keys and effective rules as values
        """
        cache_key = f"bulk_rules:{hash(str(sorted(countries_venues_map.items())))}"
        cached_rules = cache.get(cache_key)

        if cached_rules:
            logger.debug("Cache hit for bulk rules")
            return cached_rules

        rules_map = {}

        with connection.cursor() as cursor:
            for country_code, venue_location in countries_venues_map.items():
                cursor.execute(
                    "SELECT get_effective_rules(%s, %s, %s)",
                    [country_code, venue_location, 'security']
                )
                result = cursor.fetchone()
                if result and result[0]:
                    rules_map[country_code] = result[0]

        if rules_map:
            cache.set(cache_key, rules_map, 180)  # 3 minute cache
            logger.debug("Cached bulk rules")

        return rules_map

    def validate_shifts_bulk(self, shift_data_list):
        """
        Bulk validate multiple shifts against regulations.
        Uses database function for high-performance validation.

        Args:
            shift_data_list: List of dicts with shift validation data

        Returns:
            List of validation results
        """
        results = []

        with connection.cursor() as cursor:
            for shift_data in shift_data_list:
                country_code = shift_data.get('country_code')
                venue_location = shift_data.get('venue_location')
                shift_json = json.dumps(shift_data.get('shift_info', {}))

                cursor.execute(
                    "SELECT validate_shift_compliance(%s, %s::json, %s)",
                    [country_code, shift_json, venue_location]
                )
                result = cursor.fetchone()
                if result and result[0]:
                    results.append({
                        'shift_id': shift_data.get('shift_id'),
                        'validation': result[0]
                    })

        return results

    def get_break_requirements_bulk(self, country_hours_map):
        """
        Efficiently calculate break requirements for multiple countries/durations.

        Args:
            country_hours_map: Dict like {'GB': 8.5, 'US': 12.0, 'FR': 6.0}

        Returns:
            Dict with break requirements for each country
        """
        cache_key = f"break_reqs:{hash(str(sorted(country_hours_map.items())))}"
        cached_breaks = cache.get(cache_key)

        if cached_breaks:
            return cached_breaks

        break_map = {}

        with connection.cursor() as cursor:
            for country_code, shift_hours in country_hours_map.items():
                cursor.execute(
                    "SELECT calculate_break_requirements(%s, %s)",
                    [country_code, shift_hours]
                )
                result = cursor.fetchone()
                if result and result[0]:
                    break_map[country_code] = result[0]

        if break_map:
            cache.set(cache_key, break_map, 300)  # 5 minute cache

        return break_map

    def regulation_performance_report(self):
        """
        Generate comprehensive performance report for all regulations.
        Uses materialized view and database functions for optimal performance.
        """
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    rs.*,
                    rps.index_scans,
                    rps.tuples_read,
                    rps.tuples_fetched,

                    -- Calculate efficiency metrics
                    CASE
                        WHEN rps.tuples_read > 0 THEN
                            ROUND((rps.tuples_fetched::DECIMAL / rps.tuples_read) * 100, 2)
                        ELSE 0
                    END as index_efficiency_percent

                FROM regulation_summary rs
                LEFT JOIN regulation_performance_stats rps ON rps.tablename = 'api_workinghoursregulation'
                ORDER BY rs.country_name;
            """)

            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def refresh_materialized_view(self):
        """
        Refresh the regulation summary materialized view.
        Called automatically via triggers, but can be manually invoked.
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT refresh_regulation_summary();")
            logger.info("Regulation summary materialized view refreshed")
            return True
        except Exception as e:
            logger.error(f"Failed to refresh materialized view: {e}")
            return False


class RegulationCacheManager:
    """
    Advanced caching manager for regulation data with intelligent invalidation.
    Provides multi-level caching with automatic refresh strategies.
    """

    CACHE_TIMEOUTS = {
        'regulation_rules': 300,      # 5 minutes
        'bulk_rules': 180,           # 3 minutes
        'break_requirements': 300,    # 5 minutes
        'validation_results': 60,     # 1 minute
        'dashboard_data': 120,       # 2 minutes
    }

    @classmethod
    def get_regulation_cache_key(cls, country_code, cache_type='regulation_rules'):
        """Generate standardized cache keys"""
        return f"{cache_type}:{country_code.upper()}"

    @classmethod
    def invalidate_country_cache(cls, country_code):
        """Invalidate all cache entries for a specific country"""
        country_upper = country_code.upper()
        cache_keys = [
            f"regulation_rules:{country_upper}",
            f"break_requirements:{country_upper}",
            f"validation_results:{country_upper}",
        ]

        cache.delete_many(cache_keys)
        logger.info(f"Invalidated cache for country: {country_code}")

    @classmethod
    def warm_cache_for_countries(cls, country_codes):
        """Pre-warm cache for specified countries"""
        from django.apps import apps
        WorkingHoursRegulation = apps.get_model('api', 'WorkingHoursRegulation')

        regulations = WorkingHoursRegulation.objects.filter(
            country_code__in=country_codes,
            is_active=True
        )

        for regulation in regulations:
            # Cache the regulation object
            cache_key = cls.get_regulation_cache_key(regulation.country_code)
            cache.set(cache_key, regulation, cls.CACHE_TIMEOUTS['regulation_rules'])

        logger.info(f"Warmed cache for countries: {country_codes}")

    @classmethod
    def get_cache_statistics(cls):
        """Get cache performance statistics for monitoring"""
        # This would integrate with your cache backend to get hit/miss rates
        # Implementation depends on your cache backend (Redis, Memcached, etc.)
        return {
            'cache_backend': cache.__class__.__name__,
            'default_timeout': cache.default_timeout,
            'cache_keys_pattern': 'regulation_*',
            'estimated_entries': 'N/A - depends on backend'
        }