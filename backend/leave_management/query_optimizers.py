"""
Django ORM Query Optimizers for Leave Management
===============================================

This module provides optimized database queries for leave management operations:
- Real-time balance calculations with minimal database hits
- Efficient aggregation queries for reporting
- Bulk operations for performance
- Advanced analytics queries

Author: Django ORM Expert Agent
Phase: 1 - Leave Management System Enhancement
Task: TASK-007 - Create optimized queries for leave balance calculations
"""

from django.db import models
from django.db.models import (
    F, Q, Count, Sum, Avg, Max, Min, Case, When, Value,
    Prefetch, OuterRef, Subquery, Exists, Window,
    ExpressionWrapper, DecimalField, IntegerField, BooleanField,
    DateTimeField, DateField
)
from django.db.models.functions import (
    Coalesce, Greatest, Least, Now, TruncMonth, TruncYear,
    ExtractYear, ExtractMonth, Concat, Cast, Round
)
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
import logging

from .models import LeaveEntitlement, LeavePolicy, LeaveType
from .optimized_models import (
    OptimizedLeaveEntitlement, OptimizedLeavePolicy, OptimizedLeaveType
)

User = get_user_model()
logger = logging.getLogger(__name__)


class LeaveBalanceCalculator:
    """
    High-performance leave balance calculations with minimal database queries
    """

    @staticmethod
    def get_user_balances_for_year(user, year=None, use_optimized=True):
        """
        Get all leave balances for a user in a specific year with one query

        Args:
            user: User instance or user_id
            year: Year to calculate for (defaults to current year)
            use_optimized: Whether to use optimized models

        Returns:
            QuerySet with annotated balance calculations
        """
        if year is None:
            year = timezone.now().year

        user_id = user.id if hasattr(user, 'id') else user

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        return model_class.objects.filter(
            user_id=user_id,
            year=year
        ).select_related(
            'policy__leave_type', 'user'
        ).annotate(
            # Calculate current balance
            current_balance=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over') +
                F('accrued_to_date') - F('used_to_date'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            ),

            # Calculate total entitlement
            total_entitlement=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            ),

            # Calculate utilization percentage
            utilization_percentage=Case(
                When(
                    annual_entitlement__gt=0,
                    then=ExpressionWrapper(
                        Round(F('used_to_date') * 100.0 / F('annual_entitlement'), 2),
                        output_field=DecimalField(max_digits=5, decimal_places=2)
                    )
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=5, decimal_places=2)
            ),

            # Calculate accrual progress (monthly accrual types)
            months_elapsed=ExpressionWrapper(
                ExtractMonth(Now()) - 1,  # 0-based month index
                output_field=IntegerField()
            ),

            # Expected accrual to date (for monthly accrual)
            expected_accrual_to_date=Case(
                When(
                    policy__accrual_method='monthly',
                    then=ExpressionWrapper(
                        F('policy__accrual_rate') * F('months_elapsed'),
                        output_field=DecimalField(max_digits=8, decimal_places=2)
                    )
                ),
                default=F('accrued_to_date'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            ),

            # Balance status
            balance_status=Case(
                When(current_balance__lte=0, then=Value('depleted')),
                When(current_balance__lte=5, then=Value('low')),
                When(current_balance__lte=10, then=Value('medium')),
                default=Value('healthy'),
                output_field=models.CharField(max_length=20)
            )
        ).order_by('policy__leave_type__display_order', 'policy__leave_type__name')

    @staticmethod
    def calculate_bulk_balances(user_ids, year=None, use_optimized=True):
        """
        Calculate balances for multiple users efficiently

        Args:
            user_ids: List of user IDs
            year: Year to calculate for
            use_optimized: Whether to use optimized models

        Returns:
            QuerySet with user balances
        """
        if year is None:
            year = timezone.now().year

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        return model_class.objects.filter(
            user_id__in=user_ids,
            year=year
        ).select_related(
            'user', 'policy__leave_type'
        ).annotate(
            current_balance=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over') +
                F('accrued_to_date') - F('used_to_date'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            )
        ).values(
            'user_id', 'user__username', 'user__first_name', 'user__last_name',
            'policy__leave_type__name', 'policy__leave_type__code',
            'annual_entitlement', 'carried_over', 'accrued_to_date',
            'used_to_date', 'current_balance'
        )

    @staticmethod
    def get_leave_summary_by_type(year=None, use_optimized=True):
        """
        Get aggregated leave summary by leave type

        Args:
            year: Year to analyze (defaults to current year)
            use_optimized: Whether to use optimized models

        Returns:
            QuerySet with leave type summaries
        """
        if year is None:
            year = timezone.now().year

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        return model_class.objects.filter(
            year=year
        ).values(
            'policy__leave_type__name',
            'policy__leave_type__code',
            'policy__leave_type__color_code'
        ).annotate(
            employee_count=Count('user', distinct=True),
            total_entitlement=Sum('annual_entitlement'),
            total_carried_over=Sum('carried_over'),
            total_accrued=Sum('accrued_to_date'),
            total_used=Sum('used_to_date'),

            # Calculate totals
            total_available=ExpressionWrapper(
                Sum('annual_entitlement') + Sum('carried_over') + Sum('accrued_to_date'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            ),

            total_remaining=ExpressionWrapper(
                Sum('annual_entitlement') + Sum('carried_over') +
                Sum('accrued_to_date') - Sum('used_to_date'),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            ),

            # Calculate utilization rate
            utilization_rate=Case(
                When(
                    total_available__gt=0,
                    then=ExpressionWrapper(
                        Round(Sum('used_to_date') * 100.0 / F('total_available'), 2),
                        output_field=DecimalField(max_digits=5, decimal_places=2)
                    )
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=5, decimal_places=2)
            ),

            # Average balance per employee
            avg_balance_per_employee=ExpressionWrapper(
                F('total_remaining') / F('employee_count'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            )
        ).order_by('policy__leave_type__display_order')


class LeaveAnalyticsQueries:
    """
    Advanced analytics queries for leave management reporting
    """

    @staticmethod
    def get_monthly_leave_trends(year=None, leave_type=None, use_optimized=True):
        """
        Get monthly leave usage trends with year-over-year comparison
        """
        if year is None:
            year = timezone.now().year

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        base_query = model_class.objects.filter(year=year)

        if leave_type:
            base_query = base_query.filter(policy__leave_type=leave_type)

        # This would typically require a separate LeaveRequest model
        # For now, showing the structure for when that's implemented
        return base_query.annotate(
            month=TruncMonth('last_calculated')
        ).values('month').annotate(
            total_used_this_month=Sum('used_to_date'),
            employee_count=Count('user', distinct=True),
            avg_usage_per_employee=ExpressionWrapper(
                Sum('used_to_date') / Count('user', distinct=True),
                output_field=DecimalField(max_digits=6, decimal_places=2)
            )
        ).order_by('month')

    @staticmethod
    def identify_high_usage_employees(threshold_percentage=80, year=None, use_optimized=True):
        """
        Identify employees with high leave utilization

        Args:
            threshold_percentage: Utilization threshold (default 80%)
            year: Year to analyze
            use_optimized: Whether to use optimized models
        """
        if year is None:
            year = timezone.now().year

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        return model_class.objects.filter(
            year=year,
            annual_entitlement__gt=0
        ).select_related('user', 'policy__leave_type').annotate(
            utilization_rate=ExpressionWrapper(
                Round(F('used_to_date') * 100.0 / F('annual_entitlement'), 2),
                output_field=DecimalField(max_digits=5, decimal_places=2)
            ),
            remaining_balance=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over') +
                F('accrued_to_date') - F('used_to_date'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            )
        ).filter(
            utilization_rate__gte=threshold_percentage
        ).order_by('-utilization_rate')

    @staticmethod
    def get_carryover_analysis(year=None, use_optimized=True):
        """
        Analyze carryover patterns and potential forfeitures
        """
        if year is None:
            year = timezone.now().year

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        return model_class.objects.filter(
            year=year,
            carried_over__gt=0
        ).select_related('user', 'policy__leave_type').annotate(
            days_until_expiry=ExpressionWrapper(
                F('carryover_expiry_date') - Now().date(),
                output_field=IntegerField()
            ),
            potential_forfeiture=Case(
                When(
                    carryover_expiry_date__lte=timezone.now().date() + timedelta(days=30),
                    then=F('carried_over')
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=6, decimal_places=2)
            )
        ).filter(
            carryover_expiry_date__isnull=False
        ).values(
            'user__username', 'user__first_name', 'user__last_name',
            'policy__leave_type__name', 'carried_over', 'carryover_expiry_date',
            'days_until_expiry', 'potential_forfeiture'
        ).order_by('carryover_expiry_date')

    @staticmethod
    def get_policy_effectiveness_report(use_optimized=True):
        """
        Analyze effectiveness of different leave policies
        """
        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement
        policy_model = OptimizedLeavePolicy if use_optimized else LeavePolicy

        current_year = timezone.now().year

        return policy_model.objects.filter(
            is_active=True
        ).select_related('leave_type').annotate(
            # Employee count
            employee_count=Count(
                'entitlements__user',
                filter=Q(entitlements__year=current_year),
                distinct=True
            ),

            # Usage statistics
            total_allocated=Sum(
                'entitlements__annual_entitlement',
                filter=Q(entitlements__year=current_year)
            ),
            total_used=Sum(
                'entitlements__used_to_date',
                filter=Q(entitlements__year=current_year)
            ),
            total_carried_over=Sum(
                'entitlements__carried_over',
                filter=Q(entitlements__year=current_year)
            ),

            # Calculate policy effectiveness metrics
            average_utilization=Case(
                When(
                    total_allocated__gt=0,
                    then=ExpressionWrapper(
                        Round(F('total_used') * 100.0 / F('total_allocated'), 2),
                        output_field=DecimalField(max_digits=5, decimal_places=2)
                    )
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=5, decimal_places=2)
            ),

            # Average entitlement per employee
            avg_entitlement_per_employee=Case(
                When(
                    employee_count__gt=0,
                    then=ExpressionWrapper(
                        F('total_allocated') / F('employee_count'),
                        output_field=DecimalField(max_digits=8, decimal_places=2)
                    )
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            ),

            # Carryover rate
            carryover_rate=Case(
                When(
                    total_allocated__gt=0,
                    then=ExpressionWrapper(
                        Round(F('total_carried_over') * 100.0 / F('total_allocated'), 2),
                        output_field=DecimalField(max_digits=5, decimal_places=2)
                    )
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=5, decimal_places=2)
            )
        ).filter(
            employee_count__gt=0  # Only include policies with employees
        ).order_by('leave_type__display_order', 'name')


class LeaveBalancePerformanceQueries:
    """
    Performance-optimized queries for real-time balance calculations
    """

    @staticmethod
    def get_real_time_balance(user, leave_type, year=None, use_optimized=True):
        """
        Get real-time balance for a specific user and leave type

        This query is optimized for speed and minimal database hits
        """
        if year is None:
            year = timezone.now().year

        user_id = user.id if hasattr(user, 'id') else user
        leave_type_id = leave_type.id if hasattr(leave_type, 'id') else leave_type

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        try:
            entitlement = model_class.objects.select_related(
                'policy', 'policy__leave_type'
            ).get(
                user_id=user_id,
                policy__leave_type_id=leave_type_id,
                year=year
            )

            return {
                'annual_entitlement': entitlement.annual_entitlement,
                'carried_over': entitlement.carried_over,
                'accrued_to_date': entitlement.accrued_to_date,
                'used_to_date': entitlement.used_to_date,
                'current_balance': entitlement.current_balance,
                'last_calculated': entitlement.last_calculated if hasattr(entitlement, 'last_calculated') else entitlement.updated_at
            }
        except model_class.DoesNotExist:
            return {
                'annual_entitlement': Decimal('0.00'),
                'carried_over': Decimal('0.00'),
                'accrued_to_date': Decimal('0.00'),
                'used_to_date': Decimal('0.00'),
                'current_balance': Decimal('0.00'),
                'last_calculated': timezone.now()
            }

    @staticmethod
    def check_leave_availability_bulk(user_leave_requests, use_optimized=True):
        """
        Check leave availability for multiple requests efficiently

        Args:
            user_leave_requests: List of tuples (user_id, leave_type_id, days_requested, year)
            use_optimized: Whether to use optimized models

        Returns:
            Dictionary mapping (user_id, leave_type_id) to availability info
        """
        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        # Build query conditions
        q_conditions = Q()
        user_leave_map = {}

        for user_id, leave_type_id, days_requested, year in user_leave_requests:
            q_conditions |= Q(
                user_id=user_id,
                policy__leave_type_id=leave_type_id,
                year=year or timezone.now().year
            )
            user_leave_map[(user_id, leave_type_id)] = days_requested

        # Single query to get all relevant entitlements
        entitlements = model_class.objects.filter(
            q_conditions
        ).select_related(
            'policy', 'policy__leave_type'
        ).annotate(
            current_balance=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over') +
                F('accrued_to_date') - F('used_to_date'),
                output_field=DecimalField(max_digits=8, decimal_places=2)
            )
        )

        # Process results
        availability_map = {}
        for entitlement in entitlements:
            key = (entitlement.user_id, entitlement.policy.leave_type_id)
            days_requested = user_leave_map.get(key, 0)

            can_take_leave = False
            if entitlement.policy.allow_negative_balance:
                max_negative = entitlement.policy.negative_balance_limit or Decimal('0')
                can_take_leave = entitlement.current_balance + max_negative >= days_requested
            else:
                can_take_leave = entitlement.current_balance >= days_requested

            availability_map[key] = {
                'can_take_leave': can_take_leave,
                'current_balance': entitlement.current_balance,
                'days_requested': days_requested,
                'shortfall': max(0, days_requested - entitlement.current_balance)
            }

        return availability_map

    @staticmethod
    def get_accrual_processing_queue(target_date=None, use_optimized=True):
        """
        Get entitlements that need accrual processing

        Optimized for bulk accrual processing jobs
        """
        if target_date is None:
            target_date = timezone.now().date()

        model_class = OptimizedLeaveEntitlement if use_optimized else LeaveEntitlement

        return model_class.objects.filter(
            policy__is_active=True,
            policy__accrual_method__in=['monthly', 'per_shift'],
            year=target_date.year
        ).filter(
            Q(last_accrual_date__lt=target_date) |
            Q(last_accrual_date__isnull=True)
        ).select_related(
            'user', 'policy', 'policy__leave_type'
        ).prefetch_related(
            'policy__employment_types'
        ).order_by('last_accrual_date', 'user_id')


# Query optimization utility functions
class QueryProfiler:
    """
    Utility class for profiling and analyzing query performance
    """

    @staticmethod
    def profile_query_performance(queryset, description="Query"):
        """Profile query execution time and log results"""
        import time
        from django.db import connection

        # Reset query log
        connection.queries_log.clear()

        # Execute query and measure time
        start_time = time.time()
        result_count = len(list(queryset))
        execution_time = time.time() - start_time

        # Log performance metrics
        logger.info(
            f"{description} Performance: "
            f"{result_count} results in {execution_time:.4f}s "
            f"({len(connection.queries)} queries)"
        )

        return {
            'result_count': result_count,
            'execution_time': execution_time,
            'query_count': len(connection.queries)
        }

    @staticmethod
    def explain_query_plan(queryset, database_alias='default'):
        """Get database query plan for analysis"""
        from django.db import connections

        connection = connections[database_alias]
        sql, params = queryset.query.sql_with_params()

        with connection.cursor() as cursor:
            cursor.execute(f"EXPLAIN ANALYZE {sql}", params)
            return cursor.fetchall()