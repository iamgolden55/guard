from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class TimestampedModel(models.Model):
    """Abstract base model with timestamps"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LeaveTypeManager(models.Manager):
    """Manager for LeaveType with common queries"""

    def active(self):
        return self.filter(is_active=True)

    def by_employment_type(self, employment_type):
        return self.filter(
            models.Q(employment_types__isnull=True) |
            models.Q(employment_types=employment_type)
        ).distinct()


class LeaveType(TimestampedModel):
    """Define different types of leave available in the system"""

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Name of the leave type (e.g., 'Annual Leave', 'Sick Leave')"
    )
    code = models.CharField(
        max_length=10,
        unique=True,
        help_text="Short code for the leave type (e.g., 'AL', 'SL')"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of this leave type"
    )
    color_code = models.CharField(
        max_length=7,
        default='#007bff',
        help_text="HEX color code for UI display"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this leave type is currently available"
    )
    requires_approval = models.BooleanField(
        default=True,
        help_text="Whether requests for this leave type require manager approval"
    )
    min_notice_days = models.PositiveIntegerField(
        default=0,
        help_text="Minimum notice required in days before leave start date"
    )
    max_consecutive_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum consecutive days allowed for this leave type"
    )
    employment_types = models.ManyToManyField(
        'api.EmploymentType',
        blank=True,
        related_name='leave_types',
        help_text="Employment types eligible for this leave type (empty = all types)"
    )

    objects = LeaveTypeManager()

    class Meta:
        db_table = 'leave_types'
        ordering = ['name']
        verbose_name = 'Leave Type'
        verbose_name_plural = 'Leave Types'

    def __str__(self):
        return f"{self.name} ({self.code})"

    def clean(self):
        """Validate the model"""
        if self.color_code and not self.color_code.startswith('#'):
            raise ValidationError({'color_code': 'Color code must start with #'})


class LeavePolicyManager(models.Manager):
    """Manager for LeavePolicy with common queries"""

    def active(self):
        return self.filter(is_active=True)

    def for_user(self, user):
        """Get leave policies applicable to a specific user"""
        if hasattr(user, 'profile') and user.profile.employment_type:
            return self.active().filter(
                models.Q(employment_types__isnull=True) |
                models.Q(employment_types=user.profile.employment_type)
            ).distinct()
        return self.active().filter(employment_types__isnull=True)

    def by_leave_type(self, leave_type):
        return self.filter(leave_type=leave_type)


class LeavePolicy(TimestampedModel):
    """Define leave accrual policies and business rules"""

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
        help_text="Descriptive name for this leave policy"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='policies'
    )
    employment_types = models.ManyToManyField(
        'api.EmploymentType',
        blank=True,
        related_name='leave_policies',
        help_text="Employment types this policy applies to (empty = all types)"
    )

    # Accrual Settings
    accrual_method = models.CharField(
        max_length=20,
        choices=ACCRUAL_METHOD_CHOICES,
        default='monthly'
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

    # Service-based accrual (for length_of_service method)
    service_brackets = models.JSONField(
        default=list,
        blank=True,
        help_text="Service brackets for length-of-service accrual: [{'months': 12, 'rate': 20}, ...]"
    )

    # Carryover Settings
    carryover_method = models.CharField(
        max_length=15,
        choices=CARRYOVER_METHOD_CHOICES,
        default='partial'
    )
    carryover_limit = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Maximum days that can be carried over (for partial carryover)"
    )
    carryover_expiry_months = models.PositiveIntegerField(
        default=3,
        help_text="Months after which carried over leave expires"
    )

    # Probation and Eligibility
    probation_months = models.PositiveIntegerField(
        default=0,
        help_text="Months of employment before leave accrual begins"
    )
    min_employment_days = models.PositiveIntegerField(
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
        help_text="Maximum negative balance allowed (if enabled)"
    )

    # Policy Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this policy is currently active"
    )
    effective_date = models.DateField(
        default=timezone.now,
        help_text="Date when this policy becomes effective"
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when this policy expires (optional)"
    )

    objects = LeavePolicyManager()

    class Meta:
        db_table = 'leave_policies'
        ordering = ['leave_type__name', 'name']
        verbose_name = 'Leave Policy'
        verbose_name_plural = 'Leave Policies'
        unique_together = ['name', 'leave_type']
        indexes = [
            models.Index(fields=['leave_type', 'is_active']),
            models.Index(fields=['effective_date', 'expiry_date']),
        ]

    def __str__(self):
        return f"{self.name} - {self.leave_type.name}"

    def clean(self):
        """Validate the leave policy"""
        errors = {}

        # Validate effective and expiry dates
        if self.expiry_date and self.effective_date >= self.expiry_date:
            errors['expiry_date'] = 'Expiry date must be after effective date'

        # Validate accrual settings
        if self.accrual_method == 'none' and self.accrual_rate > 0:
            errors['accrual_rate'] = 'Accrual rate should be 0 for no accrual method'

        # Validate carryover settings
        if self.carryover_method == 'partial' and not self.carryover_limit:
            errors['carryover_limit'] = 'Carryover limit is required for partial carryover'

        # Validate service brackets for length_of_service method
        if self.accrual_method == 'length_of_service':
            if not self.service_brackets:
                errors['service_brackets'] = 'Service brackets are required for length-of-service accrual'
            else:
                try:
                    for bracket in self.service_brackets:
                        if not isinstance(bracket, dict) or 'months' not in bracket or 'rate' not in bracket:
                            errors['service_brackets'] = 'Invalid service bracket format'
                            break
                except (TypeError, ValueError):
                    errors['service_brackets'] = 'Invalid service brackets format'

        # Validate negative balance settings
        if not self.allow_negative_balance and self.negative_balance_limit > 0:
            errors['negative_balance_limit'] = 'Negative balance limit should be 0 if negative balance is not allowed'

        if errors:
            raise ValidationError(errors)

    def get_accrual_rate_for_service_period(self, months_of_service):
        """Get the accrual rate based on length of service"""
        if self.accrual_method != 'length_of_service':
            return self.accrual_rate

        if not self.service_brackets:
            return Decimal('0')

        # Sort brackets by months in descending order to get the highest applicable rate
        sorted_brackets = sorted(
            self.service_brackets,
            key=lambda x: x.get('months', 0),
            reverse=True
        )

        for bracket in sorted_brackets:
            if months_of_service >= bracket.get('months', 0):
                return Decimal(str(bracket.get('rate', 0)))

        return Decimal('0')

    def calculate_monthly_accrual(self, user, reference_date=None):
        """Calculate monthly accrual for a user based on this policy"""
        if reference_date is None:
            reference_date = timezone.now().date()

        # Calculate months employed based on date_joined
        employment_start = user.date_joined.date()
        months_employed = (reference_date.year - employment_start.year) * 12 + (reference_date.month - employment_start.month)

        # Check if user is past probation period
        if months_employed < self.probation_months:
            return Decimal('0')

        if self.accrual_method == 'length_of_service':
            return self.get_accrual_rate_for_service_period(months_employed)

        return self.accrual_rate

    def calculate_annual_accrual(self, user, year=None):
        """Calculate total annual accrual for a user"""
        if year is None:
            year = timezone.now().year

        if self.accrual_method == 'annual':
            return self.accrual_rate
        elif self.accrual_method == 'monthly':
            return self.accrual_rate * 12
        elif self.accrual_method == 'length_of_service':
            # Calculate based on service as of January 1st of the year
            reference_date = date(year, 1, 1)
            if hasattr(user, 'profile') and user.profile:
                employment_start = user.date_joined.date()
                months_employed = (reference_date.year - employment_start.year) * 12 + (reference_date.month - employment_start.month)
                return self.get_accrual_rate_for_service_period(months_employed)

        return Decimal('0')

    def is_applicable_to_user(self, user):
        """Check if this policy applies to a specific user"""
        if not self.is_active:
            return False

        # Check effective/expiry dates
        current_date = timezone.now().date()
        if current_date < self.effective_date:
            return False
        if self.expiry_date and current_date > self.expiry_date:
            return False

        # Check employment type
        if self.employment_types.exists():
            if not hasattr(user, 'profile') or not user.profile or not user.profile.employment_type:
                return False
            if user.profile.employment_type not in self.employment_types.all():
                return False

        return True

    def get_carryover_amount(self, current_balance):
        """Calculate how much can be carried over based on carryover rules"""
        if self.carryover_method == 'none':
            return Decimal('0')
        elif self.carryover_method == 'full':
            return current_balance
        elif self.carryover_method == 'partial':
            if self.carryover_limit:
                return min(current_balance, self.carryover_limit)
            return current_balance
        elif self.carryover_method == 'use_or_lose':
            # For use_or_lose, this would typically be handled by a separate process
            # that expires leave after a certain date
            return current_balance

        return Decimal('0')


class LeaveRequestManager(models.Manager):
    """Manager for LeaveRequest with common queries"""

    def by_status(self, status):
        return self.filter(status=status)

    def pending_approval(self):
        return self.filter(status='pending')

    def for_user(self, user):
        return self.filter(staff_user=user)

    def for_manager(self, manager):
        """Get requests that manager can approve"""
        # This would typically check team relationships
        # For now, return all pending requests for manager role
        if manager.role == 'manager':
            return self.pending_approval()
        return self.none()

    def overlapping_requests(self, user, start_date, end_date, exclude_id=None):
        """Find overlapping leave requests for a user"""
        queryset = self.filter(
            staff_user=user,
            start_date__lte=end_date,
            end_date__gte=start_date,
            status__in=['approved', 'pending']
        )
        if exclude_id:
            queryset = queryset.exclude(id=exclude_id)
        return queryset


class LeaveRequest(TimestampedModel):
    """Leave requests submitted by staff members"""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('withdrawn', 'Withdrawn'),
    ]

    REQUEST_TYPE_CHOICES = [
        ('full_day', 'Full Day'),
        ('half_day_am', 'Half Day (Morning)'),
        ('half_day_pm', 'Half Day (Afternoon)'),
        ('hours', 'Specific Hours'),
    ]

    staff_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='leave_requests',
        help_text="Staff member submitting the request"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='requests',
        help_text="Type of leave being requested"
    )

    # Request Details
    start_date = models.DateField(
        help_text="First day of leave"
    )
    end_date = models.DateField(
        help_text="Last day of leave"
    )
    request_type = models.CharField(
        max_length=15,
        choices=REQUEST_TYPE_CHOICES,
        default='full_day'
    )
    start_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Start time for hourly leave requests"
    )
    end_time = models.TimeField(
        null=True,
        blank=True,
        help_text="End time for hourly leave requests"
    )
    days_requested = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Total days being requested"
    )

    # Request Information
    reason = models.TextField(
        help_text="Reason for leave request"
    )
    emergency = models.BooleanField(
        default=False,
        help_text="Emergency leave request (reduced notice)"
    )

    # Approval Workflow
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='draft'
    )
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the request was submitted for approval"
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leave_requests',
        help_text="Manager who approved/rejected the request"
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the request was approved/rejected"
    )
    manager_notes = models.TextField(
        blank=True,
        help_text="Manager's notes on the approval decision"
    )

    # System Tracking
    balance_deducted = models.BooleanField(
        default=False,
        help_text="Whether leave balance has been deducted"
    )
    notification_sent = models.BooleanField(
        default=False,
        help_text="Whether notification has been sent to staff"
    )

    objects = LeaveRequestManager()

    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
        verbose_name = 'Leave Request'
        verbose_name_plural = 'Leave Requests'
        indexes = [
            models.Index(fields=['staff_user', 'status']),
            models.Index(fields=['leave_type', 'start_date']),
            models.Index(fields=['status', 'submitted_at']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return f"{self.staff_user.username} - {self.leave_type.name} ({self.start_date} to {self.end_date})"

    def clean(self):
        """Validate the leave request"""
        errors = {}

        # Validate date range
        if self.end_date < self.start_date:
            errors['end_date'] = 'End date must be after start date'

        # Validate time range for hourly requests
        if self.request_type == 'hours':
            if not self.start_time or not self.end_time:
                errors['start_time'] = 'Start and end times are required for hourly requests'
            elif self.start_time >= self.end_time:
                errors['end_time'] = 'End time must be after start time'

        # Validate days_requested calculation
        if self.request_type == 'full_day':
            expected_days = (self.end_date - self.start_date).days + 1
            if abs(float(self.days_requested) - expected_days) > 0.01:
                errors['days_requested'] = f'Days requested should be {expected_days} for full day requests'
        elif self.request_type in ['half_day_am', 'half_day_pm']:
            expected_days = 0.5
            if abs(float(self.days_requested) - expected_days) > 0.01:
                errors['days_requested'] = 'Days requested should be 0.5 for half day requests'

        # Check for overlapping requests
        if self.staff_user:
            overlapping = LeaveRequest.objects.overlapping_requests(
                user=self.staff_user,
                start_date=self.start_date,
                end_date=self.end_date,
                exclude_id=self.id
            )
            if overlapping.exists():
                errors['start_date'] = 'This request overlaps with existing leave requests'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Auto-calculate days_requested if not provided
        if not self.days_requested:
            if self.request_type == 'full_day':
                self.days_requested = (self.end_date - self.start_date).days + 1
            elif self.request_type in ['half_day_am', 'half_day_pm']:
                self.days_requested = Decimal('0.5')
            elif self.request_type == 'hours' and self.start_time and self.end_time:
                # Calculate hours and convert to days (8 hours = 1 day)
                start_datetime = datetime.combine(self.start_date, self.start_time)
                end_datetime = datetime.combine(self.end_date, self.end_time)
                hours = (end_datetime - start_datetime).total_seconds() / 3600
                self.days_requested = Decimal(str(hours / 8)).quantize(Decimal('0.01'))

        # Set submitted_at when status changes to pending
        if self.status == 'pending' and not self.submitted_at:
            self.submitted_at = timezone.now()

        # Set approved_at when status changes to approved/rejected
        if self.status in ['approved', 'rejected'] and not self.approved_at:
            self.approved_at = timezone.now()

        super().save(*args, **kwargs)

    @property
    def duration_days(self):
        """Calculate duration in days"""
        return (self.end_date - self.start_date).days + 1

    @property
    def is_pending(self):
        """Check if request is pending approval"""
        return self.status == 'pending'

    @property
    def is_approved(self):
        """Check if request is approved"""
        return self.status == 'approved'

    @property
    def can_be_cancelled(self):
        """Check if request can be cancelled by user"""
        return self.status in ['draft', 'pending']

    def approve(self, manager, notes=''):
        """Approve the leave request"""
        self.status = 'approved'
        self.approved_by = manager
        self.approved_at = timezone.now()
        self.manager_notes = notes
        self.save()

        logger.info(
            f"Leave request approved: {self.staff_user.username} - "
            f"{self.leave_type.name} ({self.start_date} to {self.end_date}) "
            f"by {manager.username}"
        )

    def reject(self, manager, notes=''):
        """Reject the leave request"""
        self.status = 'rejected'
        self.approved_by = manager
        self.approved_at = timezone.now()
        self.manager_notes = notes
        self.save()

        logger.info(
            f"Leave request rejected: {self.staff_user.username} - "
            f"{self.leave_type.name} ({self.start_date} to {self.end_date}) "
            f"by {manager.username}"
        )

    def cancel(self):
        """Cancel the leave request (by user)"""
        if self.can_be_cancelled:
            self.status = 'cancelled'
            self.save()

            logger.info(
                f"Leave request cancelled: {self.staff_user.username} - "
                f"{self.leave_type.name} ({self.start_date} to {self.end_date})"
            )


class LeaveBalanceManager(models.Manager):
    """Manager for LeaveBalance with common queries"""

    def for_user(self, user):
        return self.filter(staff_user=user)

    def for_year(self, year):
        return self.filter(year=year)

    def current_year(self):
        current_year = timezone.now().year
        return self.filter(year=current_year)

    def by_leave_type(self, leave_type):
        return self.filter(leave_type=leave_type)

    def with_positive_balance(self):
        return self.filter(current_balance__gt=0)


class LeaveBalance(TimestampedModel):
    """Real-time leave balance tracking for staff members"""

    staff_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='leave_balances',
        help_text="Staff member whose balance this tracks"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='balances',
        help_text="Type of leave this balance tracks"
    )
    year = models.PositiveIntegerField(
        help_text="Calendar year this balance applies to"
    )

    # Balance Components (in days)
    opening_balance = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Balance at start of year (including carryover)"
    )
    accrued_balance = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Total accrued during the year"
    )
    used_balance = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Total used during the year"
    )
    pending_balance = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Total pending approval"
    )
    adjustment_balance = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Manual adjustments (positive or negative)"
    )

    # Tracking Information
    last_updated = models.DateTimeField(
        auto_now=True,
        help_text="When balance was last recalculated"
    )
    last_accrual_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of last accrual processing"
    )

    objects = LeaveBalanceManager()

    class Meta:
        db_table = 'leave_balances'
        unique_together = ['staff_user', 'leave_type', 'year']
        ordering = ['-year', 'leave_type__name']
        verbose_name = 'Leave Balance'
        verbose_name_plural = 'Leave Balances'
        indexes = [
            models.Index(fields=['staff_user', 'year']),
            models.Index(fields=['leave_type', 'year']),
            models.Index(fields=['year', 'last_updated']),
        ]

    def __str__(self):
        return f"{self.staff_user.username} - {self.leave_type.name} - {self.year} (Balance: {self.current_balance})"

    @property
    def current_balance(self):
        """Calculate current available balance"""
        return (
            self.opening_balance +
            self.accrued_balance -
            self.used_balance +
            self.adjustment_balance
        )

    @property
    def available_balance(self):
        """Calculate available balance (excluding pending requests)"""
        return self.current_balance - self.pending_balance

    @property
    def total_entitlement(self):
        """Total entitlement for the year"""
        return self.opening_balance + self.accrued_balance + self.adjustment_balance

    def add_accrual(self, amount, accrual_date=None):
        """Add accrued leave to balance"""
        if accrual_date is None:
            accrual_date = timezone.now().date()

        self.accrued_balance += Decimal(str(amount))
        self.last_accrual_date = accrual_date
        self.save()

        logger.info(
            f"Leave accrual added: {self.staff_user.username} - "
            f"{amount} days of {self.leave_type.name} for year {self.year}"
        )

    def use_leave(self, amount):
        """Deduct used leave from balance"""
        self.used_balance += Decimal(str(amount))
        self.save()

        logger.info(
            f"Leave usage recorded: {self.staff_user.username} - "
            f"{amount} days of {self.leave_type.name} used in year {self.year}"
        )

    def add_pending(self, amount):
        """Add pending leave request to balance"""
        self.pending_balance += Decimal(str(amount))
        self.save()

    def remove_pending(self, amount):
        """Remove pending leave request from balance"""
        self.pending_balance = max(Decimal('0'), self.pending_balance - Decimal(str(amount)))
        self.save()

    def adjust_balance(self, amount, reason=''):
        """Manual balance adjustment"""
        self.adjustment_balance += Decimal(str(amount))
        self.save()

        logger.info(
            f"Leave balance adjusted: {self.staff_user.username} - "
            f"{amount} days of {self.leave_type.name} for year {self.year}. "
            f"Reason: {reason}"
        )

    def can_take_leave(self, amount):
        """Check if user can take the requested amount of leave"""
        return self.available_balance >= Decimal(str(amount))

    def refresh_from_entitlements(self):
        """Refresh balance from entitlement records"""
        try:
            entitlement = LeaveEntitlement.objects.get(
                user=self.staff_user,
                policy__leave_type=self.leave_type,
                year=self.year
            )

            # Update opening balance (annual entitlement + carryover)
            self.opening_balance = entitlement.annual_entitlement + entitlement.carried_over

            # Update accrued balance
            self.accrued_balance = entitlement.accrued_to_date

            # Update used balance
            self.used_balance = entitlement.used_to_date

            self.save()

            logger.info(
                f"Balance refreshed from entitlement: {self.staff_user.username} - "
                f"{self.leave_type.name} for year {self.year}"
            )

        except LeaveEntitlement.DoesNotExist:
            logger.warning(
                f"No entitlement found for balance refresh: {self.staff_user.username} - "
                f"{self.leave_type.name} for year {self.year}"
            )


class BlackoutPeriodManager(models.Manager):
    """Manager for BlackoutPeriod with common queries"""

    def active(self):
        current_date = timezone.now().date()
        return self.filter(
            is_active=True,
            start_date__lte=current_date,
            end_date__gte=current_date
        )

    def for_leave_type(self, leave_type):
        return self.filter(
            models.Q(leave_types__isnull=True) |
            models.Q(leave_types=leave_type)
        ).distinct()

    def system_wide(self):
        return self.filter(venue__isnull=True)

    def for_venue(self, venue):
        return self.filter(venue=venue)

    def overlapping_period(self, start_date, end_date):
        return self.filter(
            start_date__lte=end_date,
            end_date__gte=start_date,
            is_active=True
        )


class BlackoutPeriod(TimestampedModel):
    """Define periods when leave requests are restricted"""

    RESTRICTION_LEVEL_CHOICES = [
        ('no_requests', 'No Leave Requests Allowed'),
        ('emergency_only', 'Emergency Leave Only'),
        ('manager_approval', 'Requires Manager Approval'),
        ('limit_percentage', 'Limit by Percentage of Staff'),
    ]

    name = models.CharField(
        max_length=200,
        help_text="Descriptive name for this blackout period"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of the restriction"
    )

    # Period Definition
    start_date = models.DateField(
        help_text="Start date of the blackout period"
    )
    end_date = models.DateField(
        help_text="End date of the blackout period"
    )

    # Scope
    venue = models.ForeignKey(
        'api.Venue',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='blackout_periods',
        help_text="Specific venue (leave empty for system-wide)"
    )
    leave_types = models.ManyToManyField(
        LeaveType,
        blank=True,
        related_name='blackout_periods',
        help_text="Specific leave types (leave empty for all types)"
    )

    # Restriction Settings
    restriction_level = models.CharField(
        max_length=20,
        choices=RESTRICTION_LEVEL_CHOICES,
        default='no_requests'
    )
    max_staff_percentage = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text="Maximum percentage of staff allowed on leave (for limit_percentage)"
    )

    # Override Settings
    allow_manager_override = models.BooleanField(
        default=True,
        help_text="Allow managers to override this restriction"
    )
    override_reason_required = models.BooleanField(
        default=True,
        help_text="Require reason for manager override"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this blackout period is active"
    )

    objects = BlackoutPeriodManager()

    class Meta:
        db_table = 'blackout_periods'
        ordering = ['start_date', 'name']
        verbose_name = 'Blackout Period'
        verbose_name_plural = 'Blackout Periods'
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['venue', 'is_active']),
            models.Index(fields=['is_active', 'start_date']),
        ]

    def __str__(self):
        scope = f"Venue: {self.venue.name}" if self.venue else "System-wide"
        return f"{self.name} ({self.start_date} to {self.end_date}) - {scope}"

    def clean(self):
        """Validate the blackout period"""
        errors = {}

        # Validate date range
        if self.end_date < self.start_date:
            errors['end_date'] = 'End date must be after start date'

        # Validate percentage restriction
        if self.restriction_level == 'limit_percentage' and not self.max_staff_percentage:
            errors['max_staff_percentage'] = 'Max staff percentage is required for limit_percentage restriction'

        if errors:
            raise ValidationError(errors)

    def is_applicable_to_request(self, leave_request):
        """Check if this blackout period applies to a leave request"""
        if not self.is_active:
            return False

        # Check date overlap
        if (leave_request.end_date < self.start_date or
            leave_request.start_date > self.end_date):
            return False

        # Check venue scope
        if self.venue:
            # Would need to check if user is assigned to this venue
            # This would require venue assignment logic
            pass

        # Check leave type scope
        if self.leave_types.exists():
            if leave_request.leave_type not in self.leave_types.all():
                return False

        return True

    def get_restriction_message(self):
        """Get user-friendly restriction message"""
        messages = {
            'no_requests': 'No leave requests are allowed during this period.',
            'emergency_only': 'Only emergency leave requests are allowed during this period.',
            'manager_approval': 'All leave requests during this period require manager approval.',
            'limit_percentage': f'Leave is limited to {self.max_staff_percentage}% of staff during this period.',
        }
        return messages.get(self.restriction_level, 'Leave restrictions apply during this period.')


class LeaveEntitlement(TimestampedModel):
    """Track user's leave entitlements per policy per year"""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='leave_entitlements'
    )
    policy = models.ForeignKey(
        LeavePolicy,
        on_delete=models.CASCADE,
        related_name='entitlements'
    )
    year = models.PositiveIntegerField(
        help_text="Calendar year this entitlement applies to"
    )

    # Entitlement amounts (in days)
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

    # Tracking
    last_accrual_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of last accrual calculation"
    )
    carryover_expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when carried over leave expires"
    )

    class Meta:
        db_table = 'leave_entitlements'
        unique_together = ['user', 'policy', 'year']
        ordering = ['-year', 'policy__leave_type__name']
        indexes = [
            models.Index(fields=['user', 'year']),
            models.Index(fields=['policy', 'year']),
            models.Index(fields=['last_accrual_date']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.policy.leave_type.name} - {self.year}"

    @property
    def current_balance(self):
        """Calculate current available balance"""
        return self.annual_entitlement + self.carried_over + self.accrued_to_date - self.used_to_date

    @property
    def total_entitlement(self):
        """Total entitlement including carryover"""
        return self.annual_entitlement + self.carried_over

    def update_accrued_amount(self, accrual_amount, accrual_date=None):
        """Update the accrued amount and tracking date"""
        if accrual_date is None:
            accrual_date = timezone.now().date()

        self.accrued_to_date += accrual_amount
        self.last_accrual_date = accrual_date

        # Respect maximum balance if set
        if self.policy.max_balance:
            total_balance = self.current_balance
            if total_balance > self.policy.max_balance:
                excess = total_balance - self.policy.max_balance
                self.accrued_to_date -= excess

        self.save()

        # Log the accrual
        logger.info(
            f"Leave accrual updated for {self.user.username}: "
            f"{accrual_amount} days of {self.policy.leave_type.name} "
            f"for year {self.year}"
        )

    def use_leave(self, days_used):
        """Update used amount when leave is taken"""
        self.used_to_date += days_used
        self.save()

        logger.info(
            f"Leave usage updated for {self.user.username}: "
            f"{days_used} days of {self.policy.leave_type.name} "
            f"used in year {self.year}"
        )

    def can_take_leave(self, days_requested):
        """Check if user can take the requested amount of leave"""
        if self.policy.allow_negative_balance:
            max_negative = self.policy.negative_balance_limit or Decimal('0')
            return self.current_balance + max_negative >= days_requested

        return self.current_balance >= days_requested

    def process_carryover_from_previous_year(self, previous_entitlement):
        """Process carryover from previous year's entitlement"""
        carryover_amount = self.policy.get_carryover_amount(
            previous_entitlement.current_balance
        )

        self.carried_over = carryover_amount

        # Set expiry date for carried over leave if applicable
        if carryover_amount > 0 and self.policy.carryover_expiry_months:
            self.carryover_expiry_date = date(
                self.year, 1, 1
            ) + relativedelta(months=self.policy.carryover_expiry_months)

        self.save()

        logger.info(
            f"Carryover processed for {self.user.username}: "
            f"{carryover_amount} days of {self.policy.leave_type.name} "
            f"carried over to year {self.year}"
        )

        return carryover_amount


class SystemConfig(TimestampedModel):
    """
    Model to store system-wide leave management configuration

    Stores configuration as JSON to allow flexible schema changes
    without database migrations. Each configuration type (accrual_settings,
    notification_settings, etc.) is stored as a separate record.
    """
    config_key = models.CharField(
        max_length=100,
        unique=True,
        help_text="Unique identifier for this configuration type"
    )
    config_data = models.JSONField(
        default=dict,
        help_text="Configuration data as JSON"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of what this configuration controls"
    )
    updated_by = models.ForeignKey(
        'api.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_config_updates',
        help_text="User who last updated this configuration"
    )

    class Meta:
        db_table = 'leave_system_config'
        verbose_name = 'System Configuration'
        verbose_name_plural = 'System Configurations'
        ordering = ['config_key']

    def __str__(self):
        return f"{self.config_key} (Updated: {self.updated_at.strftime('%Y-%m-%d %H:%M')})"
