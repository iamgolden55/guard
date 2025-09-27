"""
Optimized database managers for Leave Management System
Created by django-orm-expert agent for performance optimization
"""
from django.db import models
from django.db.models import (
    Q, F, Count, Sum, Avg, Max, Min, Case, When, Value,
    Prefetch, OuterRef, Subquery, Exists, Window
)
from django.db.models.functions import (
    Coalesce, TruncMonth, TruncYear, ExtractYear, ExtractMonth
)
from django.utils import timezone
from decimal import Decimal
from datetime import datetime, timedelta, date
import logging

logger = logging.getLogger(__name__)


class OptimizedLeaveRequestManager(models.Manager):
    """Optimized manager for LeaveRequest with performance-focused queries"""

    def team_overview_requests(self, team_user_ids=None, status_filter=None):
        """
        Optimized query for Team Overview page - all team members' requests
        Uses strategic indexes and minimal queries
        """
        queryset = self.select_related(
            'staff_user__profile',
            'leave_type',
            'approved_by'
        ).only(
            # Only fetch required fields to reduce memory usage
            'id', 'staff_user_id', 'leave_type_id', 'start_date', 'end_date',
            'days_requested', 'status', 'submitted_at', 'approved_at',
            'emergency', 'approved_by_id',
            # Related fields
            'staff_user__username', 'staff_user__first_name', 'staff_user__last_name',
            'leave_type__name', 'leave_type__color_code',
            'approved_by__username'
        ).annotate(
            # Add calculated fields for UI
            is_upcoming=Case(
                When(start_date__gt=timezone.now().date(), then=True),
                default=False,
                output_field=models.BooleanField()
            ),
            days_until_start=Case(
                When(start_date__gt=timezone.now().date(),
                     then=F('start_date') - timezone.now().date()),
                default=None,
                output_field=models.DurationField()
            )
        )

        # Apply filters efficiently using indexed fields
        if team_user_ids:
            queryset = queryset.filter(staff_user_id__in=team_user_ids)

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        else:
            # Default to active requests (pending, approved)
            queryset = queryset.filter(status__in=['pending', 'approved'])

        return queryset.order_by('-submitted_at', '-start_date')

    def calendar_events(self, start_date, end_date, user_ids=None, leave_type_ids=None):
        """
        Optimized query for calendar view with date range filtering
        Uses covering indexes for efficient date range queries
        """
        queryset = self.filter(
            start_date__lte=end_date,
            end_date__gte=start_date,
            status='approved'
        ).select_related(
            'staff_user',
            'leave_type'
        ).only(
            'id', 'staff_user_id', 'leave_type_id', 'start_date',
            'end_date', 'days_requested', 'request_type',
            'staff_user__username', 'staff_user__first_name', 'staff_user__last_name',
            'leave_type__name', 'leave_type__color_code'
        )

        if user_ids:
            queryset = queryset.filter(staff_user_id__in=user_ids)

        if leave_type_ids:
            queryset = queryset.filter(leave_type_id__in=leave_type_ids)

        return queryset.order_by('start_date', 'staff_user__username')

    def pending_approvals_for_manager(self, manager, limit=50):
        """
        Optimized query for manager approval dashboard
        """
        return self.filter(
            status='pending'
        ).select_related(
            'staff_user__profile',
            'leave_type'
        ).prefetch_related(
            # Prefetch overlapping requests for context
            Prefetch(
                'staff_user__leave_requests',
                queryset=self.filter(
                    status__in=['approved', 'pending'],
                    start_date__lte=OuterRef('end_date'),
                    end_date__gte=OuterRef('start_date')
                ).exclude(id=OuterRef('id')),
                to_attr='overlapping_requests'
            )
        ).annotate(
            # Add helpful fields for approval decision
            staff_current_balance=Subquery(
                self.model._meta.get_field('staff_user').related_model.leave_balances.filter(
                    leave_type=OuterRef('leave_type'),
                    year=timezone.now().year
                ).values('current_balance')[:1]
            ),
            notice_days=Case(
                When(submitted_at__isnull=False,
                     then=F('start_date') - timezone.now().date()),
                default=None,
                output_field=models.DurationField()
            )
        ).order_by('submitted_at')[:limit]

    def usage_statistics(self, year=None, user_ids=None, leave_type_ids=None):
        """
        Optimized aggregation queries for Leave Reports page
        Uses aggregation-friendly indexes
        """
        if year is None:
            year = timezone.now().year

        queryset = self.filter(
            start_date__year=year,
            status='approved'
        )

        if user_ids:
            queryset = queryset.filter(staff_user_id__in=user_ids)

        if leave_type_ids:
            queryset = queryset.filter(leave_type_id__in=leave_type_ids)

        return queryset.aggregate(
            total_requests=Count('id'),
            total_days_taken=Sum('days_requested'),
            average_request_length=Avg('days_requested'),
            unique_staff_count=Count('staff_user', distinct=True),
            emergency_requests=Count('id', filter=Q(emergency=True)),
            # Monthly breakdown
            jan_days=Sum('days_requested', filter=Q(start_date__month=1)),
            feb_days=Sum('days_requested', filter=Q(start_date__month=2)),
            mar_days=Sum('days_requested', filter=Q(start_date__month=3)),
            apr_days=Sum('days_requested', filter=Q(start_date__month=4)),
            may_days=Sum('days_requested', filter=Q(start_date__month=5)),
            jun_days=Sum('days_requested', filter=Q(start_date__month=6)),
            jul_days=Sum('days_requested', filter=Q(start_date__month=7)),
            aug_days=Sum('days_requests', filter=Q(start_date__month=8)),
            sep_days=Sum('days_requested', filter=Q(start_date__month=9)),
            oct_days=Sum('days_requested', filter=Q(start_date__month=10)),
            nov_days=Sum('days_requested', filter=Q(start_date__month=11)),
            dec_days=Sum('days_requested', filter=Q(start_date__month=12)),
        )

    def monthly_trends(self, start_year=None, end_year=None):
        """
        Generate monthly trend data for analytics dashboard
        """
        if start_year is None:
            start_year = timezone.now().year - 1
        if end_year is None:
            end_year = timezone.now().year

        return self.filter(
            start_date__year__gte=start_year,
            start_date__year__lte=end_year,
            status='approved'
        ).annotate(
            month=TruncMonth('start_date'),
            year=ExtractYear('start_date')
        ).values('month', 'year', 'leave_type__name').annotate(
            request_count=Count('id'),
            total_days=Sum('days_requested'),
            unique_staff=Count('staff_user', distinct=True)
        ).order_by('month', 'leave_type__name')


class OptimizedLeaveBalanceManager(models.Manager):
    """Optimized manager for LeaveBalance with performance-focused queries"""

    def team_overview_balances(self, team_user_ids, year=None):
        """
        Optimized query for Team Overview page - all team members' balances
        Uses covering indexes to minimize disk I/O
        """
        if year is None:
            year = timezone.now().year

        return self.filter(
            staff_user_id__in=team_user_ids,
            year=year
        ).select_related(
            'staff_user',
            'leave_type'
        ).only(
            'id', 'staff_user_id', 'leave_type_id', 'year',
            'opening_balance', 'accrued_balance', 'used_balance',
            'pending_balance', 'adjustment_balance',
            'staff_user__username', 'staff_user__first_name', 'staff_user__last_name',
            'leave_type__name', 'leave_type__color_code'
        ).annotate(
            # Calculated fields for UI
            current_balance=F('opening_balance') + F('accrued_balance') -
                          F('used_balance') + F('adjustment_balance'),
            available_balance=F('opening_balance') + F('accrued_balance') -
                            F('used_balance') + F('adjustment_balance') - F('pending_balance'),
            utilization_percentage=Case(
                When(opening_balance__gt=0,
                     then=F('used_balance') * 100.0 / F('opening_balance')),
                default=None,
                output_field=models.DecimalField(max_digits=5, decimal_places=2)
            )
        ).order_by('staff_user__username', 'leave_type__name')

    def low_balance_alerts(self, threshold_days=5, year=None):
        """
        Find staff with low leave balances for proactive management
        """
        if year is None:
            year = timezone.now().year

        return self.filter(
            year=year
        ).annotate(
            current_balance=F('opening_balance') + F('accrued_balance') -
                          F('used_balance') + F('adjustment_balance'),
            available_balance=F('opening_balance') + F('accrued_balance') -
                            F('used_balance') + F('adjustment_balance') - F('pending_balance')
        ).filter(
            available_balance__lte=threshold_days,
            available_balance__gt=0  # Exclude negative balances
        ).select_related(
            'staff_user',
            'leave_type'
        ).order_by('available_balance', 'staff_user__username')

    def bulk_refresh_balances(self, user_ids, year=None):
        """
        Bulk refresh balances from entitlements for multiple users
        Optimized for mass updates
        """
        if year is None:
            year = timezone.now().year

        # Use bulk operations for efficiency
        balances = self.filter(
            staff_user_id__in=user_ids,
            year=year
        ).select_related('staff_user')

        updated_count = 0
        for balance in balances.iterator(chunk_size=100):
            try:
                balance.refresh_from_entitlements()
                updated_count += 1
            except Exception as e:
                logger.warning(
                    f"Failed to refresh balance for {balance.staff_user.username}: {e}"
                )

        return updated_count


class OptimizedLeavePolicyManager(models.Manager):
    """Optimized manager for LeavePolicy with employment type filtering"""

    def for_employment_type(self, employment_type, active_only=True):
        """
        Efficiently find policies for specific employment type
        Uses partial index for active policies
        """
        queryset = self.filter(
            Q(employment_types__isnull=True) |
            Q(employment_types=employment_type)
        ).distinct()

        if active_only:
            current_date = timezone.now().date()
            queryset = queryset.filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=current_date),
                is_active=True,
                effective_date__lte=current_date
            )

        return queryset.select_related('leave_type').order_by(
            'leave_type__name', 'name'
        )

    def policy_summary(self):
        """
        Generate summary statistics for Leave Policies page
        """
        return self.aggregate(
            total_policies=Count('id'),
            active_policies=Count('id', filter=Q(is_active=True)),
            policies_by_accrual_method=Count('id'),
            # Count by accrual method
            monthly_accrual=Count('id', filter=Q(accrual_method='monthly')),
            annual_accrual=Count('id', filter=Q(accrual_method='annual')),
            service_based=Count('id', filter=Q(accrual_method='length_of_service')),
            # Carryover statistics
            full_carryover=Count('id', filter=Q(carryover_method='full')),
            partial_carryover=Count('id', filter=Q(carryover_method='partial')),
            no_carryover=Count('id', filter=Q(carryover_method='none')),
        )


class OptimizedBlackoutPeriodManager(models.Manager):
    """Optimized manager for BlackoutPeriod with overlap detection"""

    def overlapping_with_request(self, leave_request):
        """
        Efficiently find blackout periods that overlap with a leave request
        Uses optimized overlap index
        """
        return self.filter(
            is_active=True,
            start_date__lte=leave_request.end_date,
            end_date__gte=leave_request.start_date
        ).select_related('venue').prefetch_related('leave_types')

    def active_for_date_range(self, start_date, end_date, venue=None, leave_type=None):
        """
        Find active blackout periods for a specific date range
        """
        queryset = self.filter(
            is_active=True,
            start_date__lte=end_date,
            end_date__gte=start_date
        )

        if venue:
            queryset = queryset.filter(Q(venue__isnull=True) | Q(venue=venue))

        if leave_type:
            queryset = queryset.filter(
                Q(leave_types__isnull=True) | Q(leave_types=leave_type)
            ).distinct()

        return queryset.order_by('start_date')


# Add optimized methods to existing models by monkey-patching
# This allows us to enhance existing managers without modifying the main models file

def enhance_existing_managers():
    """
    Enhance existing model managers with optimized methods
    Called during app initialization
    """
    from .models import LeaveRequest, LeaveBalance, LeavePolicy, BlackoutPeriod

    # Replace managers with optimized versions
    LeaveRequest.add_to_class('objects', OptimizedLeaveRequestManager())
    LeaveBalance.add_to_class('objects', OptimizedLeaveBalanceManager())
    LeavePolicy.add_to_class('objects', OptimizedLeavePolicyManager())
    BlackoutPeriod.add_to_class('objects', OptimizedBlackoutPeriodManager())

    logger.info("Enhanced leave management models with optimized managers")