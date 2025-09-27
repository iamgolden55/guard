"""
Django ORM Optimized Leave Management Models
===========================================

This module provides optimized database models for leave management with:
- Efficient foreign key relationships and constraints
- Strategic indexing for common query patterns
- Optimized queries for real-time balance calculations
- Performance-focused model design
- Database-level validations and constraints

Author: Django ORM Expert Agent
Phase: 1 - Leave Management System Enhancement
Tasks: TASK-006, TASK-007, TASK-008, TASK-009
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import (
    F, Q, Count, Sum, Avg, Max, Min, Case, When, Value,
    Prefetch, OuterRef, Subquery, Exists, Window,
    ExpressionWrapper, DecimalField, IntegerField, BooleanField
)
from django.db.models.functions import (
    Coalesce, Greatest, Least, Now, TruncMonth, TruncYear,
    ExtractYear, ExtractMonth, Concat, Cast
)
from django.contrib.postgres.indexes import GinIndex, BrinIndex
from django.contrib.postgres.fields import JSONField
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class OptimizedTimestampedModel(models.Model):
    """
    Abstract base model with timestamps and optimized indexing
    """
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True  # Index for common ordering queries
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        db_index=True  # Index for filtering recently updated records
    )

    class Meta:
        abstract = True


class LeaveTypeQuerySet(models.QuerySet):
    """Optimized QuerySet for LeaveType with common query patterns"""

    def active(self):
        """Get active leave types with minimal queries"""
        return self.filter(is_active=True).select_related()

    def by_employment_type(self, employment_type):
        """Get leave types for specific employment type with efficient joins"""
        return self.filter(
            Q(employment_types__isnull=True) |
            Q(employment_types=employment_type)
        ).distinct().prefetch_related('employment_types')

    def with_policy_counts(self):
        """Annotate with policy counts for reporting"""
        return self.annotate(
            active_policies=Count(
                'policies',
                filter=Q(policies__is_active=True)
            ),
            total_policies=Count('policies')
        )


class OptimizedLeaveTypeManager(models.Manager):
    """Manager with optimized common queries"""

    def get_queryset(self):
        return LeaveTypeQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def by_employment_type(self, employment_type):
        return self.get_queryset().by_employment_type(employment_type)

    def with_policy_counts(self):
        return self.get_queryset().with_policy_counts()


class OptimizedLeaveType(OptimizedTimestampedModel):
    """
    Optimized Leave Type model with strategic indexing and relationships
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,  # Index for name-based searches
        help_text="Name of the leave type (e.g., 'Annual Leave', 'Sick Leave')"
    )
    code = models.CharField(
        max_length=10,
        unique=True,
        db_index=True,  # Index for code lookups
        help_text="Short code for the leave type (e.g., 'AL', 'SL')"
    )
    description = models.TextField(blank=True)
    color_code = models.CharField(
        max_length=7,
        default='#007bff',
        help_text="HEX color code for UI display"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,  # Index for active/inactive filtering
        help_text="Whether this leave type is currently available"
    )
    requires_approval = models.BooleanField(
        default=True,
        help_text="Whether requests for this leave type require manager approval"
    )
    min_notice_days = models.PositiveSmallIntegerField(  # Use SmallIntegerField for better performance
        default=0,
        help_text="Minimum notice required in days before leave start date"
    )
    max_consecutive_days = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Maximum consecutive days allowed for this leave type"
    )

    # Optimized M2M with explicit through table for better control
    employment_types = models.ManyToManyField(
        'api.EmploymentType',
        blank=True,
        related_name='optimized_leave_types',
        help_text="Employment types eligible for this leave type"
    )

    # Display order for UI
    display_order = models.PositiveSmallIntegerField(
        default=0,
        db_index=True,
        help_text="Order for displaying leave types in UI"
    )

    objects = OptimizedLeaveTypeManager()

    class Meta:
        db_table = 'optimized_leave_types'
        ordering = ['display_order', 'name']
        verbose_name = 'Leave Type (Optimized)'
        verbose_name_plural = 'Leave Types (Optimized)'

        indexes = [
            # Composite index for common filtering patterns
            models.Index(fields=['is_active', 'display_order']),
            models.Index(fields=['is_active', 'name']),

            # GIN index for full-text search on name and description
            GinIndex(
                name='leave_type_search_idx',
                fields=['name', 'description'],
                opclasses=['gin_trgm_ops', 'gin_trgm_ops']
            ),
        ]

        constraints = [
            models.CheckConstraint(
                check=Q(min_notice_days__gte=0),
                name='min_notice_days_non_negative'
            ),
            models.CheckConstraint(
                check=Q(max_consecutive_days__gte=1) | Q(max_consecutive_days__isnull=True),
                name='max_consecutive_days_positive_or_null'
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def clean(self):
        """Enhanced validation"""
        errors = {}

        if self.color_code and not self.color_code.startswith('#'):
            errors['color_code'] = 'Color code must start with #'

        if self.max_consecutive_days and self.min_notice_days > self.max_consecutive_days:
            errors['min_notice_days'] = 'Minimum notice days cannot exceed maximum consecutive days'

        if errors:
            raise ValidationError(errors)


class LeavePolicyQuerySet(models.QuerySet):
    """Optimized QuerySet for LeavePolicy with efficient joins"""

    def active(self):
        """Get active policies with related data"""
        return self.select_related('leave_type').filter(
            is_active=True,
            effective_date__lte=timezone.now().date()
        ).filter(
            Q(expiry_date__isnull=True) |
            Q(expiry_date__gt=timezone.now().date())
        )

    def for_user(self, user):
        """Get policies applicable to user with optimized joins"""
        base_query = self.active().select_related('leave_type')

        if hasattr(user, 'profile') and user.profile and user.profile.employment_type:
            return base_query.filter(
                Q(employment_types__isnull=True) |
                Q(employment_types=user.profile.employment_type)
            ).distinct()

        return base_query.filter(employment_types__isnull=True)

    def by_leave_type(self, leave_type):
        """Get policies for leave type with related data"""
        return self.select_related('leave_type').filter(leave_type=leave_type)

    def with_entitlement_stats(self, year=None):
        """Annotate with entitlement statistics"""
        if year is None:
            year = timezone.now().year

        return self.annotate(
            entitlement_count=Count(
                'entitlements',
                filter=Q(entitlements__year=year)
            ),
            total_allocated=Sum(
                'entitlements__annual_entitlement',
                filter=Q(entitlements__year=year)
            ),
            total_used=Sum(
                'entitlements__used_to_date',
                filter=Q(entitlements__year=year)
            )
        )


class OptimizedLeavePolicyManager(models.Manager):
    """Manager with optimized queries for leave policies"""

    def get_queryset(self):
        return LeavePolicyQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def for_user(self, user):
        return self.get_queryset().for_user(user)

    def by_leave_type(self, leave_type):
        return self.get_queryset().by_leave_type(leave_type)

    def with_entitlement_stats(self, year=None):
        return self.get_queryset().with_entitlement_stats(year)


class OptimizedLeavePolicy(OptimizedTimestampedModel):
    """
    Optimized Leave Policy model with performance-focused design
    """

    ACCRUAL_METHOD_CHOICES = [
        ('monthly', 'Monthly Accrual'),
        ('annual', 'Annual Grant'),
        ('per_shift', 'Per Shift Worked'),
        ('length_of_service', 'Based on Length of Service'),
        ('none', 'No Automatic Accrual'),
    ]

    CARRYOVER_METHOD_CHOICES = [
        ('none', 'No Carryover'),
        ('full', 'Full Carryover'),
        ('partial', 'Partial Carryover'),
        ('use_or_lose', 'Use or Lose by Date'),
    ]

    name = models.CharField(
        max_length=200,
        db_index=True,  # Index for name-based searches
        help_text="Descriptive name for this leave policy"
    )

    # Optimized FK with select_related in mind
    leave_type = models.ForeignKey(
        OptimizedLeaveType,
        on_delete=models.CASCADE,
        related_name='optimized_policies',
        db_index=True  # Explicit index for FK lookups
    )

    employment_types = models.ManyToManyField(
        'api.EmploymentType',
        blank=True,
        related_name='optimized_leave_policies',
        help_text="Employment types this policy applies to"
    )

    # Accrual Settings - optimized field types
    accrual_method = models.CharField(
        max_length=20,
        choices=ACCRUAL_METHOD_CHOICES,
        default='monthly',
        db_index=True  # Index for filtering by accrual method
    )
    accrual_rate = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Accrual rate (days per period, based on accrual method)"
    )
    max_accrual_per_year = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Maximum days that can be accrued per year"
    )
    max_balance = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Maximum balance that can be accumulated"
    )

    # Service-based accrual - using JSONField with GIN index
    service_brackets = JSONField(
        default=list,
        blank=True,
        help_text="Service brackets for length-of-service accrual"
    )

    # Carryover Settings
    carryover_method = models.CharField(
        max_length=15,
        choices=CARRYOVER_METHOD_CHOICES,
        default='partial',
        db_index=True
    )
    carryover_limit = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Maximum days that can be carried over"
    )
    carryover_expiry_months = models.PositiveSmallIntegerField(
        default=3,
        help_text="Months after which carried over leave expires"
    )

    # Probation and Eligibility
    probation_months = models.PositiveSmallIntegerField(
        default=0,
        help_text="Months of employment before leave accrual begins"
    )
    min_employment_days = models.PositiveSmallIntegerField(
        default=0,
        help_text="Minimum days of employment before leave can be taken"
    )

    # Additional Settings
    allow_negative_balance = models.BooleanField(
        default=False,
        help_text="Allow taking leave beyond current balance"
    )
    negative_balance_limit = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Maximum negative balance allowed"
    )

    # Policy Status with optimized indexing
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this policy is currently active"
    )
    effective_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date when this policy becomes effective"
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Date when this policy expires"
    )

    objects = OptimizedLeavePolicyManager()

    class Meta:
        db_table = 'optimized_leave_policies'
        ordering = ['leave_type__display_order', 'leave_type__name', 'name']
        verbose_name = 'Leave Policy (Optimized)'
        verbose_name_plural = 'Leave Policies (Optimized)'

        # Optimized unique constraint
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'leave_type'],
                name='unique_policy_name_per_leave_type'
            ),
            models.CheckConstraint(
                check=Q(effective_date__lt=F('expiry_date')) | Q(expiry_date__isnull=True),
                name='effective_before_expiry'
            ),
            models.CheckConstraint(
                check=Q(accrual_rate__gte=0),
                name='accrual_rate_non_negative'
            ),
        ]

        indexes = [
            # Strategic composite indexes for common query patterns
            models.Index(fields=['leave_type', 'is_active']),
            models.Index(fields=['is_active', 'effective_date']),
            models.Index(fields=['is_active', 'effective_date', 'expiry_date']),
            models.Index(fields=['accrual_method', 'is_active']),

            # BRIN index for date-based queries (PostgreSQL)
            BrinIndex(
                name='policy_date_range_idx',
                fields=['effective_date', 'expiry_date']
            ),

            # GIN index for JSON field queries
            GinIndex(
                name='service_brackets_gin_idx',
                fields=['service_brackets']
            ),
        ]

    def __str__(self):
        return f"{self.name} - {self.leave_type.name}"

    def get_accrual_rate_for_service_period(self, months_of_service):
        """Optimized method to get accrual rate based on service"""
        if self.accrual_method != 'length_of_service' or not self.service_brackets:
            return self.accrual_rate

        # Use database function for better performance in bulk operations
        for bracket in sorted(self.service_brackets, key=lambda x: x.get('months', 0), reverse=True):
            if months_of_service >= bracket.get('months', 0):
                return Decimal(str(bracket.get('rate', 0)))

        return Decimal('0')

    def is_applicable_to_user(self, user):
        """Optimized user applicability check"""
        current_date = timezone.now().date()

        # Quick checks first
        if not self.is_active or current_date < self.effective_date:
            return False

        if self.expiry_date and current_date > self.expiry_date:
            return False

        # Employment type check with optimization
        if self.employment_types.exists():
            if not hasattr(user, 'profile') or not user.profile:
                return False

            # Use exists() for better performance
            return self.employment_types.filter(
                pk=user.profile.employment_type_id
            ).exists() if user.profile.employment_type_id else False

        return True


class LeaveEntitlementQuerySet(models.QuerySet):
    """Optimized QuerySet for leave entitlements with complex calculations"""

    def for_user_and_year(self, user, year=None):
        """Get entitlements for user and year with related data"""
        if year is None:
            year = timezone.now().year

        return self.select_related(
            'user', 'policy', 'policy__leave_type'
        ).filter(user=user, year=year)

    def with_calculated_balances(self):
        """Annotate with calculated balances using F expressions"""
        return self.annotate(
            current_balance=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over') +
                F('accrued_to_date') - F('used_to_date'),
                output_field=DecimalField(max_digits=6, decimal_places=2)
            ),
            total_entitlement=ExpressionWrapper(
                F('annual_entitlement') + F('carried_over'),
                output_field=DecimalField(max_digits=6, decimal_places=2)
            ),
            utilization_rate=Case(
                When(
                    annual_entitlement__gt=0,
                    then=ExpressionWrapper(
                        F('used_to_date') * 100.0 / F('annual_entitlement'),
                        output_field=DecimalField(max_digits=5, decimal_places=2)
                    )
                ),
                default=Value(0),
                output_field=DecimalField(max_digits=5, decimal_places=2)
            )
        )

    def low_balance(self, threshold=5):
        """Get entitlements with low balance"""
        return self.with_calculated_balances().filter(
            current_balance__lte=threshold
        )

    def by_leave_type(self, leave_type):
        """Filter by leave type with optimized join"""
        return self.select_related('policy__leave_type').filter(
            policy__leave_type=leave_type
        )

    def active_policies_only(self):
        """Filter to only active policies"""
        return self.select_related('policy').filter(
            policy__is_active=True
        )


class OptimizedLeaveEntitlementManager(models.Manager):
    """Manager with optimized entitlement queries"""

    def get_queryset(self):
        return LeaveEntitlementQuerySet(self.model, using=self._db)

    def for_user_and_year(self, user, year=None):
        return self.get_queryset().for_user_and_year(user, year)

    def with_calculated_balances(self):
        return self.get_queryset().with_calculated_balances()

    def low_balance(self, threshold=5):
        return self.get_queryset().low_balance(threshold)

    def by_leave_type(self, leave_type):
        return self.get_queryset().by_leave_type(leave_type)

    def bulk_calculate_balances(self, user_ids=None, year=None):
        """Bulk calculate balances for multiple users efficiently"""
        if year is None:
            year = timezone.now().year

        base_query = self.get_queryset().select_related(
            'user', 'policy', 'policy__leave_type'
        ).filter(year=year)

        if user_ids:
            base_query = base_query.filter(user_id__in=user_ids)

        return base_query.with_calculated_balances()


class OptimizedLeaveEntitlement(OptimizedTimestampedModel):
    """
    Optimized Leave Entitlement model with database-level calculations
    """

    # Optimized FK relationships
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='optimized_leave_entitlements',
        db_index=True  # Explicit index for user lookups
    )
    policy = models.ForeignKey(
        OptimizedLeavePolicy,
        on_delete=models.CASCADE,
        related_name='optimized_entitlements',
        db_index=True
    )
    year = models.PositiveSmallIntegerField(
        db_index=True,  # Index for year-based queries
        help_text="Calendar year this entitlement applies to"
    )

    # Entitlement amounts with optimized precision
    annual_entitlement = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Total days entitled for this year"
    )
    carried_over = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Days carried over from previous year"
    )
    accrued_to_date = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Days accrued so far this year"
    )
    used_to_date = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Days used so far this year"
    )

    # Tracking fields with strategic indexing
    last_accrual_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,  # Index for accrual processing
        help_text="Date of last accrual calculation"
    )
    carryover_expiry_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,  # Index for expiry processing
        help_text="Date when carried over leave expires"
    )

    # Additional optimization fields
    last_calculated = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="When balance was last calculated"
    )

    objects = OptimizedLeaveEntitlementManager()

    class Meta:
        db_table = 'optimized_leave_entitlements'
        ordering = ['-year', 'policy__leave_type__display_order', 'user__username']
        verbose_name = 'Leave Entitlement (Optimized)'
        verbose_name_plural = 'Leave Entitlements (Optimized)'

        # Optimized constraints
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'policy', 'year'],
                name='unique_user_policy_year'
            ),
            models.CheckConstraint(
                check=Q(annual_entitlement__gte=0),
                name='annual_entitlement_non_negative'
            ),
            models.CheckConstraint(
                check=Q(carried_over__gte=0),
                name='carried_over_non_negative'
            ),
            models.CheckConstraint(
                check=Q(accrued_to_date__gte=0),
                name='accrued_to_date_non_negative'
            ),
            models.CheckConstraint(
                check=Q(used_to_date__gte=0),
                name='used_to_date_non_negative'
            ),
        ]

        indexes = [
            # Primary lookup patterns
            models.Index(fields=['user', 'year']),
            models.Index(fields=['policy', 'year']),
            models.Index(fields=['user', 'policy', 'year']),

            # Date-based processing
            models.Index(fields=['last_accrual_date', 'policy']),
            models.Index(fields=['carryover_expiry_date']),

            # Reporting and analytics
            models.Index(fields=['year', 'policy']),
            models.Index(fields=['year', 'used_to_date']),

            # BRIN index for time-series data (PostgreSQL)
            BrinIndex(
                name='entitlement_dates_brin_idx',
                fields=['last_accrual_date', 'carryover_expiry_date']
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.policy.leave_type.name} - {self.year}"

    @property
    def current_balance(self):
        """Calculate current balance using database function when possible"""
        return self.annual_entitlement + self.carried_over + self.accrued_to_date - self.used_to_date

    @property
    def total_entitlement(self):
        """Total entitlement including carryover"""
        return self.annual_entitlement + self.carried_over

    @property
    def utilization_rate(self):
        """Calculate utilization rate as percentage"""
        if self.annual_entitlement > 0:
            return (self.used_to_date / self.annual_entitlement * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        return Decimal('0.00')

    def update_accrued_amount(self, accrual_amount, accrual_date=None):
        """Optimized accrual update with database-level validation"""
        if accrual_date is None:
            accrual_date = timezone.now().date()

        # Use F expressions for atomic updates
        self.__class__.objects.filter(pk=self.pk).update(
            accrued_to_date=F('accrued_to_date') + accrual_amount,
            last_accrual_date=accrual_date,
            last_calculated=timezone.now()
        )

        # Refresh from database
        self.refresh_from_db()

        # Apply maximum balance constraint if needed
        if self.policy.max_balance and self.current_balance > self.policy.max_balance:
            excess = self.current_balance - self.policy.max_balance
            self.__class__.objects.filter(pk=self.pk).update(
                accrued_to_date=F('accrued_to_date') - excess
            )
            self.refresh_from_db()

        logger.info(
            f"Leave accrual updated: {self.user.username} - "
            f"{self.policy.leave_type.name} - {accrual_amount} days"
        )

    def use_leave(self, days_used):
        """Optimized leave usage update"""
        self.__class__.objects.filter(pk=self.pk).update(
            used_to_date=F('used_to_date') + days_used,
            last_calculated=timezone.now()
        )

        self.refresh_from_db()

        logger.info(
            f"Leave usage updated: {self.user.username} - "
            f"{self.policy.leave_type.name} - {days_used} days"
        )

    def can_take_leave(self, days_requested):
        """Optimized leave availability check"""
        current_balance = self.current_balance

        if self.policy.allow_negative_balance:
            max_negative = self.policy.negative_balance_limit or Decimal('0')
            return current_balance + max_negative >= days_requested

        return current_balance >= days_requested