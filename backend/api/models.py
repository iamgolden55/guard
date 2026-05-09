from django.db import models, transaction
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import datetime, timedelta
from django.conf import settings
from model_utils import FieldTracker
import googlemaps
import math
import logging
import uuid

from .fields import EncryptedCharField

# Import optimized managers
from .compliance_query_optimizations import (
    OptimizedComplianceViolationManager,
    OptimizedWorkingHoursMetricsManager
)

logger = logging.getLogger(__name__)


# =====================================================
# MULTI-TENANT ONBOARDING MODELS (PLACED EARLY TO AVOID FORWARD REFERENCES)
# =====================================================

class SecurityCompany(models.Model):
    """
    Main company model for multi-tenant system.
    Each security firm has their own company record with compliance and subscription settings.
    """
    SUBSCRIPTION_TIER_CHOICES = [
        ('starter', 'Starter'),
        ('professional', 'Professional'),
        ('enterprise', 'Enterprise'),
        ('custom', 'Custom'),
    ]

    COMPANY_SIZE_CHOICES = [
        ('small', '1-10 employees'),
        ('medium', '11-50 employees'),
        ('large', '51-200 employees'),
        ('enterprise', '200+ employees'),
    ]

    INDUSTRY_TYPE_CHOICES = [
        ('events', 'Event Security'),
        ('retail', 'Retail Security'),
        ('corporate', 'Corporate Security'),
        ('construction', 'Construction Security'),
        ('healthcare', 'Healthcare Security'),
        ('education', 'Education Security'),
        ('hospitality', 'Hospitality Security'),
        ('transport', 'Transport Security'),
        ('mixed', 'Mixed Services'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Basic Company Information
    name = models.CharField(
        max_length=255,
        help_text="Official company name"
    )
    slug = models.SlugField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        help_text="URL-friendly identifier for company recruitment pages"
    )
    trading_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Trading name if different from official name"
    )
    registration_number = models.CharField(
        max_length=100,
        unique=True,
        help_text="Company registration number"
    )
    tax_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Tax ID or VAT number"
    )

    # Location and Compliance
    country_code = models.CharField(
        max_length=3,
        help_text="ISO 3166-1 alpha-3 country code"
    )
    state_province = models.CharField(
        max_length=100,
        blank=True,
        help_text="State or province"
    )
    city = models.CharField(
        max_length=100,
        help_text="Primary city of operations"
    )
    postal_code = models.CharField(
        max_length=20,
        help_text="Postal or ZIP code"
    )
    address_line_1 = models.CharField(
        max_length=255,
        help_text="Primary address"
    )
    address_line_2 = models.CharField(
        max_length=255,
        blank=True,
        help_text="Secondary address (suite, floor, etc.)"
    )

    # Business Details
    industry_type = models.CharField(
        max_length=20,
        choices=INDUSTRY_TYPE_CHOICES,
        default='mixed',
        help_text="Primary industry focus"
    )
    company_size = models.CharField(
        max_length=20,
        choices=COMPANY_SIZE_CHOICES,
        default='small',
        help_text="Current company size"
    )

    # Operational Configuration
    compliance_profile = models.ForeignKey(
        'ComplianceProfile',  # Forward reference since ComplianceProfile comes later
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Associated compliance profile for regulatory requirements"
    )
    staff_capacity = models.IntegerField(
        default=50,
        validators=[MinValueValidator(1), MaxValueValidator(10000)],
        help_text="Maximum number of staff members allowed"
    )
    venue_capacity = models.IntegerField(
        default=20,
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
        help_text="Maximum number of venues allowed"
    )

    # Subscription and Billing
    subscription_tier = models.CharField(
        max_length=50,
        choices=SUBSCRIPTION_TIER_CHOICES,
        default='starter',
        help_text="Current subscription tier"
    )
    subscription_start_date = models.DateTimeField(
        default=timezone.now,
        help_text="When subscription started"
    )
    subscription_end_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When subscription ends (null for active subscriptions)"
    )
    billing_email = models.EmailField(
        help_text="Email for billing and invoices"
    )

    # Contact Information
    primary_contact_name = models.CharField(
        max_length=255,
        help_text="Name of primary contact person"
    )
    primary_contact_email = models.EmailField(
        help_text="Email of primary contact person"
    )
    primary_contact_phone = models.CharField(
        max_length=20,
        help_text="Phone number of primary contact"
    )

    # Company Settings and Preferences
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="Company timezone for shift scheduling"
    )
    currency = models.CharField(
        max_length=3,
        default='USD',
        help_text="Currency for billing and payments"
    )
    date_format = models.CharField(
        max_length=20,
        default='DD/MM/YYYY',
        choices=[
            ('DD/MM/YYYY', 'DD/MM/YYYY'),
            ('MM/DD/YYYY', 'MM/DD/YYYY'),
            ('YYYY-MM-DD', 'YYYY-MM-DD'),
        ]
    )

    # Features and Limits
    features_enabled = models.JSONField(
        default=dict,
        help_text="Dictionary of enabled features for this company"
    )
    custom_settings = models.JSONField(
        default=dict,
        help_text="Company-specific custom settings"
    )

    # Status and Metadata
    is_active = models.BooleanField(
        default=True,
        help_text="Whether the company account is active"
    )
    is_trial = models.BooleanField(
        default=False,
        help_text="Whether this is a trial account"
    )
    trial_end_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When trial period ends"
    )

    # Audit Fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='companies_created',
        help_text="User who created this company"
    )

    class Meta:
        db_table = 'security_companies'
        ordering = ['name']
        verbose_name = 'Security Company'
        verbose_name_plural = 'Security Companies'
        indexes = [
            models.Index(fields=['country_code']),
            models.Index(fields=['subscription_tier']),
            models.Index(fields=['is_active']),
            models.Index(fields=['registration_number']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_subscription_tier_display()})"

    def save(self, *args, **kwargs):
        """Auto-generate slug for new companies"""
        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1

            while SecurityCompany.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug
        super().save(*args, **kwargs)

    def get_current_staff_count(self):
        """Get current number of staff members"""
        return self.memberships.filter(is_active=True).count()

    def get_current_venue_count(self):
        """Get current number of venues"""
        return self.venues.filter(is_active=True).count()

    def can_add_staff(self):
        """Check if company can add more staff members"""
        return self.get_current_staff_count() < self.staff_capacity

    def can_add_venue(self):
        """Check if company can add more venues"""
        return self.get_current_venue_count() < self.venue_capacity

    def is_feature_enabled(self, feature_name):
        """Check if a specific feature is enabled for this company"""
        return self.features_enabled.get(feature_name, False)

    def get_subscription_status(self):
        """Get current subscription status"""
        now = timezone.now()

        if self.is_trial:
            if self.trial_end_date and now > self.trial_end_date:
                return 'trial_expired'
            return 'trial_active'

        if self.subscription_end_date and now > self.subscription_end_date:
            return 'subscription_expired'

        return 'active'

    def get_trial_days_remaining(self):
        """Get number of days remaining in trial period"""
        if not self.is_trial or not self.trial_end_date:
            return 0

        now = timezone.now()
        if now > self.trial_end_date:
            return 0

        delta = self.trial_end_date - now
        return delta.days

    def has_feature_access(self, feature_name):
        """
        Check if company has access to a specific feature based on trial status and subscription tier.

        During trial: All features enabled
        After trial: Features restricted to subscription tier
        """
        status = self.get_subscription_status()

        # During active trial, all features are enabled
        if status == 'trial_active':
            return True

        # Trial expired - restrict to tier features
        if status == 'trial_expired':
            return self._get_tier_features().get(feature_name, False)

        # Paid subscription - restrict to tier features
        if status == 'active':
            return self._get_tier_features().get(feature_name, False)

        # Subscription expired - no access
        return False

    def _get_tier_features(self):
        """Get features allowed for current subscription tier"""
        TIER_FEATURES = {
            'starter': {
                'basic_scheduling': True,
                'staff_management': True,
                'venue_management': True,
                'shift_tracking': True,
                'basic_reports': True,
                'deputy_integration': False,
                'advanced_reports': False,
                'api_access': False,
                'custom_branding': False,
                'priority_support': False,
                'leave_management': False,
                'compliance_tracking': False,
            },
            'professional': {
                'basic_scheduling': True,
                'staff_management': True,
                'venue_management': True,
                'shift_tracking': True,
                'basic_reports': True,
                'deputy_integration': True,
                'advanced_reports': True,
                'api_access': False,
                'custom_branding': False,
                'priority_support': True,
                'leave_management': True,
                'compliance_tracking': True,
            },
            'enterprise': {
                'basic_scheduling': True,
                'staff_management': True,
                'venue_management': True,
                'shift_tracking': True,
                'basic_reports': True,
                'deputy_integration': True,
                'advanced_reports': True,
                'api_access': True,
                'custom_branding': True,
                'priority_support': True,
                'leave_management': True,
                'compliance_tracking': True,
            },
        }

        return TIER_FEATURES.get(self.subscription_tier, TIER_FEATURES['starter'])

    def get_feature_access_summary(self):
        """Get summary of all feature access for this company"""
        status = self.get_subscription_status()
        tier_features = self._get_tier_features()

        return {
            'subscription_status': status,
            'is_trial': self.is_trial,
            'trial_days_remaining': self.get_trial_days_remaining(),
            'subscription_tier': self.subscription_tier,
            'features': tier_features if status != 'trial_active' else {
                key: True for key in tier_features.keys()
            },
            'staff_capacity': self.staff_capacity,
            'venue_capacity': self.venue_capacity,
            'current_staff_count': self.get_current_staff_count(),
            'current_venue_count': self.get_current_venue_count(),
        }


class UserCompanyMembership(models.Model):
    """
    Links users to companies with role-based access control.
    Supports multi-tenant access where users can belong to multiple companies.
    """
    MEMBERSHIP_ROLE_CHOICES = [
        ('owner', 'Company Owner'),
        ('admin', 'Company Administrator'),
        ('manager', 'Manager'),
        ('staff', 'Staff Member'),
        ('viewer', 'Viewer'),
    ]

    INVITATION_STATUS_CHOICES = [
        ('pending', 'Invitation Pending'),
        ('accepted', 'Invitation Accepted'),
        ('declined', 'Invitation Declined'),
        ('expired', 'Invitation Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Core Relationships
    user = models.ForeignKey(
        'User',  # Forward reference to User model that comes later
        on_delete=models.CASCADE,
        related_name='company_memberships'
    )
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='memberships'
    )

    # Membership Details
    role = models.CharField(
        max_length=20,
        choices=MEMBERSHIP_ROLE_CHOICES,
        default='staff'
    )
    is_owner = models.BooleanField(
        default=False,
        help_text="Whether this user is the company owner"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this membership is currently active"
    )

    # Invitation Management
    invitation_status = models.CharField(
        max_length=20,
        choices=INVITATION_STATUS_CHOICES,
        default='accepted',
        help_text="Status of the membership invitation"
    )
    invited_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='company_invitations_sent',
        help_text="User who sent the invitation"
    )
    invitation_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When invitation was sent"
    )
    invitation_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When invitation expires"
    )

    # Access Control
    permissions = models.JSONField(
        default=dict,
        help_text="Custom permissions for this membership"
    )
    access_restrictions = models.JSONField(
        default=dict,
        help_text="Any access restrictions for this user"
    )

    # Audit Fields
    joined_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When user last accessed this company's data"
    )

    class Meta:
        db_table = 'user_company_memberships'
        unique_together = ['user', 'company']
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['company', 'is_active']),
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['role']),
            models.Index(fields=['is_owner']),
        ]

    def __str__(self):
        return f"{self.user.username} at {self.company.name} ({self.role})"

    def has_permission(self, permission_name):
        """Check if user has a specific permission in this company"""
        return self.permissions.get(permission_name, False)

    def is_invitation_valid(self):
        """Check if invitation is still valid"""
        if self.invitation_status != 'pending':
            return False

        if self.invitation_expires_at and timezone.now() > self.invitation_expires_at:
            return False

        return True


class CompanyOnboarding(models.Model):
    """
    Tracks the progress of company onboarding through the wizard steps.
    Stores step completion status and collects data during the onboarding process.
    """
    ONBOARDING_STEPS = [
        (1, 'Company Information'),
        (2, 'Regional Compliance Setup'),
        (3, 'Staff Operations Configuration'),
        (4, 'Integrations Setup'),
        (5, 'Account Finalization'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Core Relationship
    company = models.OneToOneField(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='onboarding'
    )

    # Progress Tracking
    current_step = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    total_steps = models.IntegerField(default=5)

    # Step Completion Status
    company_info_completed = models.BooleanField(default=False)
    regional_setup_completed = models.BooleanField(default=False)
    staff_setup_completed = models.BooleanField(default=False)
    integrations_completed = models.BooleanField(default=False)
    finalization_completed = models.BooleanField(default=False)

    # Onboarding Data (stored temporarily during process)
    step_data = models.JSONField(
        default=dict,
        help_text="Temporary storage for step data during onboarding"
    )
    validation_errors = models.JSONField(
        default=dict,
        help_text="Validation errors for each step"
    )

    # Session Management
    session_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Browser session ID for onboarding continuity"
    )
    last_step_accessed = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When user last accessed any step"
    )

    # Completion Tracking
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When onboarding was fully completed"
    )
    completed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='onboardings_completed',
        help_text="User who completed the onboarding"
    )

    # Time Tracking
    time_spent_minutes = models.IntegerField(
        default=0,
        help_text="Total time spent in onboarding (minutes)"
    )
    estimated_time_remaining = models.IntegerField(
        null=True,
        blank=True,
        help_text="Estimated remaining time in minutes"
    )

    # Audit Fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'company_onboarding'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['company', 'current_step']),
            models.Index(fields=['completed_at']),
            models.Index(fields=['session_id']),
        ]

    def __str__(self):
        status = "Completed" if self.is_completed else f"Step {self.current_step}/{self.total_steps}"
        return f"{self.company.name} Onboarding - {status}"

    @property
    def is_completed(self):
        """Check if onboarding is fully completed"""
        return self.completed_at is not None

    @property
    def progress_percentage(self):
        """Calculate completion percentage"""
        completed_steps = sum([
            self.company_info_completed,
            self.regional_setup_completed,
            self.staff_setup_completed,
            self.integrations_completed,
            self.finalization_completed,
        ])
        return int((completed_steps / self.total_steps) * 100)

    def get_next_step(self):
        """Get the next incomplete step"""
        if not self.company_info_completed:
            return 1
        elif not self.regional_setup_completed:
            return 2
        elif not self.staff_setup_completed:
            return 3
        elif not self.integrations_completed:
            return 4
        elif not self.finalization_completed:
            return 5
        return None

    def mark_step_completed(self, step_number):
        """Mark a specific step as completed"""
        step_mapping = {
            1: 'company_info_completed',
            2: 'regional_setup_completed',
            3: 'staff_setup_completed',
            4: 'integrations_completed',
            5: 'finalization_completed',
        }

        if step_number in step_mapping:
            setattr(self, step_mapping[step_number], True)
            self.current_step = min(step_number + 1, self.total_steps)
            self.last_step_accessed = timezone.now()

            # Check if all steps are complete
            if all([
                self.company_info_completed,
                self.regional_setup_completed,
                self.staff_setup_completed,
                self.integrations_completed,
                self.finalization_completed,
            ]):
                if not self.completed_at:
                    self.completed_at = timezone.now()

            self.save()

    def update_session_activity(self, session_id=None):
        """Update session activity for onboarding continuity"""
        self.last_step_accessed = timezone.now()
        if session_id:
            self.session_id = session_id
        self.save()


class CompanyIntegration(models.Model):
    """
    Manages third-party integrations for each company.
    Stores configuration and status for various external services.
    """
    INTEGRATION_TYPE_CHOICES = [
        ('deputy', 'Deputy Workforce Management'),
        ('payroll', 'Payroll System'),
        ('accounting', 'Accounting Software'),
        ('crm', 'Customer Relationship Management'),
        ('security', 'Security Monitoring'),
        ('communication', 'Communication Platform'),
        ('analytics', 'Analytics Platform'),
        ('custom', 'Custom Integration'),
    ]

    STATUS_CHOICES = [
        ('inactive', 'Not Configured'),
        ('configuring', 'Being Configured'),
        ('testing', 'Testing Connection'),
        ('active', 'Active'),
        ('error', 'Configuration Error'),
        ('suspended', 'Temporarily Suspended'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Core Relationships
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='integrations'
    )

    # Integration Details
    integration_type = models.CharField(
        max_length=50,
        choices=INTEGRATION_TYPE_CHOICES
    )
    name = models.CharField(
        max_length=100,
        help_text="Display name for this integration"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of what this integration does"
    )

    # Configuration
    configuration = models.JSONField(
        default=dict,
        help_text="Integration-specific configuration settings"
    )
    credentials = models.JSONField(
        default=dict,
        help_text="Encrypted credentials for the integration"
    )

    # Status and Health
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='inactive'
    )
    is_enabled = models.BooleanField(
        default=True,
        help_text="Whether this integration is enabled"
    )
    last_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When data was last synchronized"
    )
    last_health_check = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When connection was last tested"
    )
    health_status = models.CharField(
        max_length=20,
        choices=[
            ('healthy', 'Healthy'),
            ('warning', 'Warning'),
            ('error', 'Error'),
            ('unknown', 'Unknown'),
        ],
        default='unknown'
    )

    # Error Tracking
    last_error = models.TextField(
        blank=True,
        help_text="Last error message if any"
    )
    error_count = models.IntegerField(
        default=0,
        help_text="Number of consecutive errors"
    )

    # Sync Settings
    sync_frequency = models.CharField(
        max_length=20,
        choices=[
            ('realtime', 'Real-time'),
            ('hourly', 'Hourly'),
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('manual', 'Manual only'),
        ],
        default='daily'
    )
    auto_sync_enabled = models.BooleanField(
        default=True,
        help_text="Whether automatic syncing is enabled"
    )

    # Audit Fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    configured_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='integrations_configured',
        help_text="User who configured this integration"
    )

    class Meta:
        db_table = 'company_integrations'
        unique_together = ['company', 'integration_type', 'name']
        ordering = ['integration_type', 'name']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['integration_type']),
            models.Index(fields=['is_enabled', 'status']),
        ]

    def __str__(self):
        return f"{self.company.name} - {self.name} ({self.get_status_display()})"

    def test_connection(self):
        """Test the integration connection"""
        # This would be implemented with actual integration testing logic
        self.last_health_check = timezone.now()
        # For now, just mark as healthy
        self.health_status = 'healthy'
        self.save()
        return True

    def perform_sync(self):
        """Perform data synchronization"""
        # This would be implemented with actual sync logic
        self.last_sync_at = timezone.now()
        self.save()
        return True


class User(AbstractUser):
    # Main role choices for all users
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('staff', 'Staff'),
    )
    
    # Security role choices for staff members
    SECURITY_ROLE_CHOICES = (
        ('ds', 'Door Supervisor'),
        ('sg', 'Security Guard'),
        ('cctv', 'CCTV Operator'),
        ('cp', 'Close Protection Officer'),
        ('steward', 'Steward/Marshal'),
        ('k9', 'Dog Handler'),
        ('retail', 'Retail Security'),
        ('static', 'Static Guard'),
        ('mobile', 'Mobile Patrol'),
        ('event', 'Event Security'),
    )
    
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='staff')
    security_roles = models.JSONField(default=list, help_text="List of security roles for staff members", blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)
    password_last_changed = models.DateTimeField(null=True, blank=True, help_text="Timestamp of last password change")

    # Account lockout fields for security
    failed_login_attempts = models.IntegerField(default=0, help_text="Number of consecutive failed login attempts")
    account_locked_until = models.DateTimeField(null=True, blank=True, help_text="Account locked until this timestamp")
    last_failed_login = models.DateTimeField(null=True, blank=True, help_text="Timestamp of last failed login attempt")

    # Account deletion
    deletion_scheduled_at = models.DateTimeField(null=True, blank=True, help_text="When account deletion was requested. Hard delete occurs 30 days after this date.")

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='api_user_set',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='api_user_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        if self.role == 'staff' and self.security_roles:
            security_roles_display = ', '.join(role for role in self.security_roles)
            return f"{self.username} (Staff - {security_roles_display})"
        return f"{self.username} ({self.get_role_display()})"

    def has_security_role(self, role):
        """Check if staff member has a specific security role"""
        return self.role == 'staff' and role in self.security_roles

    def get_pending_earnings(self):
        """Calculate total pending earnings from approved shifts not yet invoiced"""
        from decimal import Decimal
        
        # Get all approved shifts that have actual hours worked
        approved_shifts = self.shifts.filter(
            status='approved',
            actual_hours_worked__isnull=False
        )
        
        # Calculate total pending earnings
        total_pending = Decimal('0.00')
        pending_shifts = []
        
        for shift in approved_shifts:
            # Check if this shift is already in an invoice
            is_invoiced = shift.invoice_items.exists()
            
            if not is_invoiced:
                payment = shift.calculate_payment()
                if payment:
                    total_pending += payment
                    pending_shifts.append({
                        'shift': shift,
                        'estimated_payment': payment
                    })
        
        return {
            'total_pending': total_pending,
            'pending_shifts': pending_shifts,
            'shift_count': len(pending_shifts)
        }
    
    def get_estimated_weekly_earnings(self):
        """Calculate estimated earnings for current week including unapproved shifts"""
        from decimal import Decimal
        from datetime import timedelta
        from django.utils import timezone
        
        # Get current Monday-Sunday period
        today = timezone.now().date()
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        
        # Get all shifts for this week
        week_shifts = self.shifts.filter(
            start_time__date__gte=monday,
            start_time__date__lte=sunday
        )
        
        approved_total = Decimal('0.00')
        estimated_total = Decimal('0.00')
        shift_breakdown = []
        
        for shift in week_shifts:
            if shift.status == 'approved' and shift.actual_hours_worked:
                # Confirmed earnings
                payment = shift.calculate_payment() or Decimal('0.00')
                approved_total += payment
                estimated_total += payment
                
                shift_breakdown.append({
                    'shift': shift,
                    'amount': payment,
                    'status': 'confirmed',
                    'is_invoiced': shift.invoice_items.exists()
                })
            
            elif shift.status in ['scheduled', 'in_progress', 'pending_approval']:
                # Estimated earnings based on scheduled hours
                if shift.start_time and shift.end_time:
                    # Calculate scheduled hours
                    duration = shift.end_time - shift.start_time
                    scheduled_hours = Decimal(str(duration.total_seconds() / 3600))
                    
                    # Use effective hourly rate
                    hourly_rate = Decimal(str(shift.get_effective_hourly_rate()))
                    estimated_payment = scheduled_hours * hourly_rate
                    
                    estimated_total += estimated_payment
                    
                    shift_breakdown.append({
                        'shift': shift,
                        'amount': estimated_payment,
                        'status': 'estimated',
                        'is_invoiced': False
                    })
        
        # Calculate next Monday payment date
        next_monday = monday + timedelta(days=7)
        
        return {
            'week_period': {'start': monday, 'end': sunday},
            'approved_earnings': approved_total,
            'estimated_total': estimated_total,
            'next_payment_date': next_monday,
            'shift_breakdown': shift_breakdown,
            'shift_count': len(shift_breakdown)
        }

class StaffProfile(models.Model):
    PAY_FREQUENCY_CHOICES = (
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    employment_type = models.ForeignKey('EmploymentType', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_profiles', help_text="Employment type for this staff member")
    phone_number = models.CharField(max_length=20)
    date_of_birth = models.DateField()
    national_insurance_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    profile_image_url = models.URLField(max_length=500, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    password_last_changed = models.DateTimeField(default=timezone.now)
    is_approved = models.BooleanField(default=False, help_text="Admin approval required before staff can take shifts")
    pay_frequency = models.CharField(
        max_length=10,
        choices=PAY_FREQUENCY_CHOICES,
        default='weekly',
        help_text="How often this officer is paid; selects which payroll cycle (weekly W-runs vs monthly M-runs) generates their invoices.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f"Profile for {self.user.username}"

    def is_eligible_for_shifts(self):
        # Check for valid SIA license that hasn't expired
        has_valid_sia = self.sia_licenses.filter(
            status='valid',
            expiry_date__gte=timezone.now().date()
        ).exists()
        return self.is_approved and has_valid_sia

class EmergencyContact(models.Model):
    staff_profile = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='emergency_contacts')
    name = models.CharField(max_length=255)
    relationship = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'emergency_contacts'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.relationship})"

class BankDetails(models.Model):
    staff_profile = models.OneToOneField(StaffProfile, on_delete=models.CASCADE, related_name='bank_details')
    account_name = models.CharField(max_length=255)
    account_number = EncryptedCharField(max_length=255)
    sort_code = EncryptedCharField(max_length=255)
    bank_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bank_details'
        ordering = ['-created_at']

    def __str__(self):
        return f"Bank details for {self.staff_profile.user.username}"

class SIALicense(models.Model):
    LICENSE_TYPE_CHOICES = (
        ('ds', 'Door Supervisor'),
        ('sg', 'Security Guard'),
        ('cctv', 'CCTV Operator'),
        ('cp', 'Close Protection'),
        ('k9', 'Dog Handler'),
        ('vs', 'Vehicle Security'),
        ('key', 'Key Holding'),
    )
    
    LEVEL_CHOICES = (
        ('trainee', 'Trainee'),
        ('qualified', 'Qualified'),
        ('advanced', 'Advanced'),
        ('instructor', 'Instructor'),
    )
    
    STATUS_CHOICES = (
        ('valid', 'Valid'),
        ('expired', 'Expired'),
        ('pending', 'Pending'),
    )

    staff_profile = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='sia_licenses')
    license_number = models.CharField(max_length=50, unique=True)
    license_type = models.CharField(max_length=10, choices=LICENSE_TYPE_CHOICES)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='qualified')
    issue_date = models.DateField()
    expiry_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='valid')
    document_url = models.URLField(max_length=500, blank=True, default='')
    additional_certifications = models.JSONField(default=list, help_text="Additional certifications related to this license")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sia_licenses'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.license_number} ({self.get_license_type_display()})"

class SecurityQualification(models.Model):
    QUALIFICATION_TYPE_CHOICES = (
        ('first_aid', 'First Aid'),
        ('conflict_management', 'Conflict Management'),
        ('physical_intervention', 'Physical Intervention'),
        ('fire_safety', 'Fire Safety'),
        ('health_safety', 'Health & Safety'),
        ('customer_service', 'Customer Service'),
        ('radio_comms', 'Radio Communications'),
        ('emergency_response', 'Emergency Response'),
        ('crowd_management', 'Crowd Management'),
        ('risk_assessment', 'Risk Assessment'),
    )

    staff_profile = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='qualifications')
    qualification_type = models.CharField(max_length=50, choices=QUALIFICATION_TYPE_CHOICES)
    provider = models.CharField(max_length=255)
    certificate_number = models.CharField(max_length=100)
    issue_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    document_url = models.URLField(max_length=500)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'security_qualifications'
        ordering = ['-created_at']
        unique_together = ['staff_profile', 'qualification_type', 'certificate_number']

    def __str__(self):
        return f"{self.get_qualification_type_display()} - {self.staff_profile.user.username}"

class StaffAvailability(models.Model):
    DAY_CHOICES = (
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    )

    staff_profile = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='availability')
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_availability'
        ordering = ['day_of_week']
        unique_together = ['staff_profile', 'day_of_week']

    def __str__(self):
        return f"{self.staff_profile.user.username} - {self.get_day_of_week_display()}"

class Venue(models.Model):
    # Company relationship for multi-tenancy
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='venues',
        help_text="Company that owns this venue"
    )

    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    capacity = models.IntegerField()
    latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
    longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
    check_radius = models.IntegerField(default=100, help_text="Radius in meters for location verification")
    contact_name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=20)
    contact_email = models.EmailField()
    description = models.TextField(blank=True, null=True, help_text="venue description")
    terms_and_conditions = models.TextField(help_text="venue terms and conditions")
    terms_version = models.CharField(max_length=50, null=True, blank=True, help_text="optional version identifier for terms")
    
    # Venue check requirements
    requires_fire_safety_checks = models.BooleanField(default=False, help_text="Whether this venue requires regular fire safety checks")
    requires_capacity_monitoring = models.BooleanField(default=False, help_text="Whether this venue requires capacity monitoring")
    requires_toilet_checks = models.BooleanField(default=False, help_text="Whether this venue requires regular toilet checks")

    # Capacity-monitoring configuration
    capacity_check_interval_minutes = models.PositiveSmallIntegerField(
        default=30,
        help_text="How often (minutes) staff must log a capacity count when capacity monitoring is required"
    )
    capacity_warning_threshold_pct = models.PositiveSmallIntegerField(
        default=80,
        help_text="Percentage of venue capacity at which the UI should highlight 'approaching capacity'"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Track changes to address fields
    tracker = FieldTracker(fields=['address', 'city', 'postal_code', 'country'])

    class Meta:
        db_table = 'venues'
        ordering = ['name']

    def __str__(self):
        return self.name

    def update_coordinates(self):
        """Update venue coordinates using Google Maps Geocoding API"""
        if not hasattr(settings, 'GOOGLE_MAPS_API_KEY'):
            logger.warning("No Google Maps API key configured. Skipping geocoding.")
            return False

        try:
            gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
            address = f"{self.address}, {self.city}, {self.postal_code}, {self.country}"
            
            # Attempt to geocode the address
            result = gmaps.geocode(address)
            
            if not result:
                logger.error(f"No geocoding results found for address: {address}")
                return False
                
            location = result[0]['geometry']['location']
            self.latitude = location['lat']
            self.longitude = location['lng']
            return True
            
        except Exception as e:
            logger.error(f"Error geocoding address: {e}")
            return False

    def save(self, *args, **kwargs):
        # Check if this is a new venue or if address fields have changed
        address_changed = (
            not self.pk or  # New venue
            self.tracker.has_changed('address') or
            self.tracker.has_changed('city') or
            self.tracker.has_changed('postal_code') or
            self.tracker.has_changed('country')
        )
        
        if address_changed:
            self.update_coordinates()
                
        super().save(*args, **kwargs)

    def verify_location(self, lat, lng):
        """Verify if given coordinates are within venue's check radius using Google Maps Distance Matrix API"""
        if not (self.latitude and self.longitude and hasattr(settings, 'GOOGLE_MAPS_API_KEY')):
            logger.warning("Cannot verify location: missing coordinates or API key")
            return False
        
        try:
            gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
            
            # Get actual walking/driving distance using Distance Matrix API
            result = gmaps.distance_matrix(
                origins=f"{lat},{lng}",
                destinations=f"{self.latitude},{self.longitude}",
                mode="walking",  # or "driving" depending on your needs
                units="metric"
            )
            
            if result['status'] == 'OK':
                distance = result['rows'][0]['elements'][0]['distance']['value']  # distance in meters
                return distance <= self.check_radius
                
        except Exception as e:
            logger.error(f"Error verifying location with Google Maps API: {e}")
            
            # Fallback to basic geometric distance calculation
            logger.info("Falling back to geometric distance calculation")
            R = 6371000  # Earth's radius in meters
            lat1, lon1 = float(self.latitude), float(self.longitude)
            lat2, lon2 = float(lat), float(lng)
            
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            delta_phi = math.radians(lat2 - lat1)
            delta_lambda = math.radians(lon2 - lon1)
            
            a = math.sin(delta_phi/2) * math.sin(delta_phi/2) + \
                math.cos(phi1) * math.cos(phi2) * \
                math.sin(delta_lambda/2) * math.sin(delta_lambda/2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            distance = R * c
            
            return distance <= self.check_radius
            
        return False

class VenueTermsAcceptance(models.Model):
    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='venue_terms_acceptances')
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='terms_acceptances')
    terms_version = models.CharField(max_length=50, help_text="version of terms accepted")
    accepted_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'venue_terms_acceptance'
        ordering = ['-accepted_at']
        unique_together = ['staff_user', 'venue', 'terms_version']

    def __str__(self):
        return f"{self.staff_user.username} - {self.venue.name} ({self.terms_version})"

    @classmethod
    def has_accepted_terms(cls, staff_user, venue):
        """Check if staff has accepted the current terms for this venue"""
        # Use the same logic as when creating terms: default to '1' if terms_version is None
        terms_version = venue.terms_version or '1'
        return cls.objects.filter(
            staff_user=staff_user,
            venue=venue,
            terms_version=terms_version
        ).exists()

class PreferredVenue(models.Model):
    staff_profile = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='preferred_venues')
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='preferred_by_staff')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'preferred_venues'
        ordering = ['-created_at']
        unique_together = ['staff_profile', 'venue']

    def __str__(self):
        return f"{self.staff_profile.user.username} - {self.venue.name}"

class ShiftStatusHistory(models.Model):
    shift = models.ForeignKey('Shift', on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20, default='')
    # Keep legacy 'status' field as alias for new_status for backward compatibility
    status = models.CharField(max_length=20, blank=True, default='')
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='shift_status_changes')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shift_status_history'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # Keep status field in sync with new_status for backward compatibility
        if self.new_status and not self.status:
            self.status = self.new_status
        super().save(*args, **kwargs)

    def __str__(self):
        changed_by_name = self.changed_by.username if self.changed_by else 'system'
        return f"Shift {self.shift.id} status: {self.old_status} -> {self.new_status} by {changed_by_name}"

class ShiftTemplate(models.Model):
    DAYS_OF_WEEK = (
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    )

    name = models.CharField(max_length=255, help_text="Template name (e.g., 'Weekend Night Shift')")
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='shift_templates')
    # Multiple days can be selected
    days_of_week = models.JSONField(help_text="List of days this template applies to")
    start_time = models.TimeField()
    end_time = models.TimeField()
    required_security_role = models.CharField(max_length=20)
    min_staff_required = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    color_code = models.CharField(max_length=7, help_text="HEX color code for UI display", null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shift_templates'
        ordering = ['venue', 'start_time']
        unique_together = ['venue', 'name']

    def __str__(self):
        return f"{self.name} - {self.venue.name}"

    def generate_shifts_for_month(self, year, month):
        """Generate all shifts for this template for a specific month"""
        from calendar import monthrange
        import datetime
        
        # Get the number of days in the month
        _, num_days = monthrange(year, month)
        
        shifts = []
        for day in range(1, num_days + 1):
            try:
                # Create datetime for this day
                shift_date = datetime.date(year, month, day)
                
                # Check if this day's weekday is in our template
                if shift_date.weekday() in self.days_of_week:
                    # Create shift start and end times
                    shift_start = datetime.datetime.combine(shift_date, self.start_time)
                    shift_end = datetime.datetime.combine(shift_date, self.end_time)
                    
                    # Handle overnight shifts
                    if self.end_time < self.start_time:
                        shift_end += datetime.timedelta(days=1)
                    
                    # Create the shift
                    shift = Shift.objects.create(
                        venue=self.venue,
                        template=self,
                        start_time=shift_start,
                        end_time=shift_end,
                        required_security_role=self.required_security_role,
                        status='open',  # Start as open if no staff assigned
                        notes=self.notes
                    )
                    shifts.append(shift)
                    
            except Exception as e:
                logger.error(f"Error generating shift for {shift_date}: {e}")
                continue
                
        return shifts

    def bulk_create_shifts(self, start_date, end_date):
        """Create shifts for a date range using this template"""
        current_date = start_date
        shifts = []
        
        while current_date <= end_date:
            if current_date.weekday() in self.days_of_week:
                shift_start = datetime.combine(current_date, self.start_time)
                shift_end = datetime.combine(current_date, self.end_time)
                
                # Handle overnight shifts
                if self.end_time < self.start_time:
                    shift_end += timedelta(days=1)
                
                shift = Shift.objects.create(
                    venue=self.venue,
                    template=self,
                    start_time=shift_start,
                    end_time=shift_end,
                    required_security_role=self.required_security_role,
                    status='open'
                )
                shifts.append(shift)
            
            current_date += timedelta(days=1)
            
        return shifts

    @classmethod
    def from_shift(cls, shift, name):
        """Create a template from an existing shift"""
        template = cls.objects.create(
            name=name,
            venue=shift.venue,
            days_of_week=[shift.start_time.weekday()],
            start_time=shift.start_time.time(),
            end_time=shift.end_time.time(),
            required_security_role=shift.required_security_role,
            min_staff_required=1,
            notes=shift.notes
        )
        return template

class OpenShiftRequest(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),
        ('claimed', 'Claimed'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    )

    original_shift = models.ForeignKey('Shift', on_delete=models.CASCADE, related_name='open_requests')
    requesting_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requested_releases')
    claimed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='claimed_shifts')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    request_reason = models.TextField()
    claim_time = models.DateTimeField(null=True, blank=True)
    manager_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_open_shifts')
    manager_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'open_shift_requests'
        ordering = ['-created_at']

    def __str__(self):
        if self.claimed_by:
            return f"Open shift request by {self.requesting_user.username} - claimed by {self.claimed_by.username}"
        return f"Open shift request by {self.requesting_user.username} - {self.get_status_display()}"

    def clean(self):
        """Validate the open shift request"""
        if self.original_shift.start_time <= timezone.now():
            raise ValueError("Cannot release shifts that have already started")

        if self.claimed_by:
            # Validate claiming user has required role
            if not self.claimed_by.has_security_role(self.original_shift.required_security_role):
                raise ValueError(f"You do not have the required security role '{self.original_shift.required_security_role}' for this shift")
            # Check for schedule conflicts (exclude the current shift being claimed)
            conflicting_shifts = Shift.objects.filter(
                staff_user=self.claimed_by,
                start_time__lt=self.original_shift.end_time,
                end_time__gt=self.original_shift.start_time
            ).exclude(status__in=['cancelled', 'rejected']).exclude(id=self.original_shift.id)
            if conflicting_shifts.exists():
                raise ValueError("You already have a shift during this time")
            # Check staff eligibility
            profile = getattr(self.claimed_by, 'profile', None)
            if not profile or not profile.is_eligible_for_shifts():
                raise ValueError("Your profile must be admin approved and you must have a valid SIA license to claim shifts.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def claim_shift(self, claiming_user):
        """Staff member claims the open shift, with atomic locking to prevent race conditions."""
        from django.db import transaction

        if claiming_user == self.requesting_user:
            raise ValueError("Cannot claim your own released shift")

        with transaction.atomic():
            locked = OpenShiftRequest.objects.select_for_update().get(pk=self.pk)
            if locked.status != 'open':
                raise ValueError("This shift has already been claimed")
            locked.claimed_by = claiming_user
            locked.claim_time = timezone.now()
            locked.status = 'claimed'
            locked.save()

    def approve_claim(self, manager_user, notes=None):
        """Manager approves the shift claim"""
        if self.status != 'claimed':
            raise ValueError("Can only approve claimed shifts")
            
        # Update the original shift
        self.original_shift.staff_user = self.claimed_by
        self.original_shift.status = 'scheduled'
        self.original_shift.save()
        
        self.status = 'approved'
        self.manager_user = manager_user
        self.manager_notes = notes
        self.save()

    def reject_claim(self, manager_user, notes):
        """Manager rejects the shift claim"""
        if self.status != 'claimed':
            raise ValueError("Can only reject claimed shifts")
            
        self.status = 'rejected'
        self.manager_user = manager_user
        self.manager_notes = notes
        self.save()

    def cancel(self):
        """Cancel the open shift request"""
        if self.status not in ['open', 'claimed']:
            raise ValueError("Cannot cancel approved or rejected requests")
            
        self.status = 'cancelled'
        self.save()

    @classmethod
    def get_available_shifts(cls, staff_user):
        """Get all open shifts that a staff member is qualified for"""
        from django.utils import timezone

        # Get all open shift requests (exclude shifts the user released themselves)
        # Also exclude shifts that have already started
        now = timezone.now()
        open_requests = cls.objects.filter(
            status='open',
            original_shift__start_time__gt=now  # Only future shifts
        ).exclude(requesting_user=staff_user)

        # Filter to shifts the staff member is qualified for
        qualified_shifts = []
        for request in open_requests:
            if staff_user.has_security_role(request.original_shift.required_security_role):
                # Check for schedule conflicts (exclude the shift being offered)
                conflicts = Shift.objects.filter(
                    staff_user=staff_user,
                    start_time__lt=request.original_shift.end_time,
                    end_time__gt=request.original_shift.start_time
                ).exclude(status__in=['cancelled', 'rejected']).exclude(id=request.original_shift.id)

                if not conflicts.exists():
                    qualified_shifts.append(request)

        return qualified_shifts

class Shift(models.Model):
    STATUS_CHOICES = (
        ('open', 'Open'),  # New status for unclaimed shifts
        ('scheduled', 'Scheduled'),
        ('active', 'Active'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    )

    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shifts', null=True, blank=True)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='shifts')
    template = models.ForeignKey(ShiftTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_shifts')
    shift_group = models.CharField(max_length=50, null=True, blank=True, help_text="Groups multiple staff shifts for the same venue/time")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    required_security_role = models.CharField(max_length=20)
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    check_in_location = models.JSONField(null=True, blank=True, help_text="Latitude and longitude of check-in location")
    check_out_location = models.JSONField(null=True, blank=True, help_text="Latitude and longitude of check-out location")
    start_signature = models.TextField(help_text="base64", null=True, blank=True)
    end_signature = models.TextField(null=True, blank=True, help_text="base64")
    check_in_photo = models.TextField(help_text="base64", null=True, blank=True)
    check_out_photo = models.TextField(help_text="base64", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    manager_approved = models.BooleanField(default=False)
    manager_signature = models.TextField(null=True, blank=True, help_text="base64")
    manager_notes = models.TextField(null=True, blank=True)
    manager_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_shifts')
    terms_accepted = models.BooleanField(default=False, help_text="whether venue terms were accepted for this shift")
    actual_hours_worked = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    break_duration = models.IntegerField(default=0, help_text="Break duration in minutes")
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Hourly pay rate for this shift")
    is_special_event = models.BooleanField(default=False, help_text="Whether this shift is for a special event")
    auto_checkout = models.BooleanField(default=False, help_text="Whether this shift was automatically checked out")
    is_published = models.BooleanField(default=False, help_text="Whether this shift is visible to staff (draft vs published)")
    bill_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Hourly bill rate charged to client for this shift")
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shifts'
        ordering = ['-start_time']
        permissions = [
            ("can_approve_shifts", "Can approve shifts"),
            ("can_view_all_shifts", "Can view all shifts"),
            ("can_manage_shifts", "Can manage shifts"),
        ]
        # Note: Unique constraint for shift groups is handled in serializer validation
        # to allow NULL values for single shifts

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Read from __dict__ so deferred fields (.only()/.defer()) don't trigger
        # refresh_from_db, which recurses through __init__ during query iteration.
        self._original_status = self.__dict__.get('status')
        self._original_staff_user_id = (
            self.__dict__.get('staff_user_id') if self.pk else None
        )

    def __str__(self):
        staff_name = self.staff_user.username if self.staff_user else "Unassigned"
        group_info = f" (Group: {self.shift_group})" if self.shift_group else ""
        return f"{staff_name} at {self.venue.name} ({self.start_time}){group_info}"
    
    @staticmethod
    def generate_shift_group_id(venue_id, start_time):
        """Generate a unique shift group ID for multi-staff shifts"""
        import uuid
        timestamp = start_time.strftime('%Y%m%d_%H%M')
        return f"SG_{venue_id}_{timestamp}_{str(uuid.uuid4())[:8]}"
    
    def get_group_shifts(self):
        """Get all shifts in the same shift group"""
        if not self.shift_group:
            return Shift.objects.filter(id=self.id)
        return Shift.objects.filter(shift_group=self.shift_group)

    def clean(self):
        """Validate shift data"""
        from django.core.exceptions import ValidationError

        # Validate check-in/check-out times
        if self.check_in_time and self.check_out_time:
            if self.check_out_time <= self.check_in_time:
                raise ValidationError("Check-out time must be after check-in time")

            # Validate realistic hours (max 24 hours)
            duration = self.check_out_time - self.check_in_time
            hours_worked = duration.total_seconds() / 3600
            if hours_worked > 24:
                raise ValidationError(f"Shift duration cannot exceed 24 hours. Current duration: {hours_worked:.2f} hours")

            # Validate check-out is within reasonable time of scheduled end
            if self.end_time:
                # Allow check-out up to 12 hours after scheduled end time
                max_checkout = self.end_time + timezone.timedelta(hours=12)
                if self.check_out_time > max_checkout:
                    raise ValidationError(f"Check-out time is too far from scheduled end time. Check-out: {self.check_out_time}, Scheduled end: {self.end_time}")

        # Validate staff availability/leave for assigned shifts
        if self.staff_user and self.start_time:
            shift_date = self.start_time.date() if hasattr(self.start_time, 'date') else self.start_time
            self._validate_staff_availability(shift_date)

    def _validate_staff_availability(self, shift_date):
        """
        Check if staff is available on the shift date.
        - Contractors: Check ContractorUnavailability
        - Permanent employees: Check approved LeaveRequests
        """
        from django.core.exceptions import ValidationError

        # Get staff's employment category
        employment_category = None
        if hasattr(self.staff_user, 'profile') and self.staff_user.profile:
            employment_type = self.staff_user.profile.employment_type
            if employment_type:
                employment_category = getattr(employment_type, 'employment_category', None)

        # Check contractor unavailability (hard block)
        if employment_category in ('contractor', 'temporary', None):
            if not ContractorUnavailability.is_user_available(self.staff_user, shift_date):
                unavailability = ContractorUnavailability.objects.filter(
                    staff_user=self.staff_user,
                    start_date__lte=shift_date,
                    end_date__gte=shift_date
                ).first()
                reason = f" Reason: {unavailability.reason}" if unavailability and unavailability.reason else ""
                raise ValidationError(
                    f"Staff member {self.staff_user.username} is marked as unavailable on {shift_date}.{reason}"
                )

        # Check permanent employee leave (hard block)
        if employment_category == 'permanent':
            # Import here to avoid circular imports
            from leave_management.models import LeaveRequest as LeaveManagementRequest

            approved_leave = LeaveManagementRequest.objects.filter(
                staff_user=self.staff_user,
                status='approved',
                start_date__lte=shift_date,
                end_date__gte=shift_date
            ).first()

            if approved_leave:
                raise ValidationError(
                    f"Staff member {self.staff_user.username} has approved leave from "
                    f"{approved_leave.start_date} to {approved_leave.end_date}. "
                    f"Cannot assign shift on {shift_date}."
                )

    def save(self, *args, **kwargs):
        # Validate before saving
        self.clean()
        
        # Calculate actual hours worked
        if self.check_in_time and self.check_out_time:
            duration = self.check_out_time - self.check_in_time
            hours_worked = duration.total_seconds() / 3600
            break_hours = self.break_duration / 60
            self.actual_hours_worked = round(hours_worked - break_hours, 2)

        # Track if this is a new unassigned shift
        is_new_unassigned = not self.pk and not self.staff_user
        
        # Ensure unassigned shifts are marked as 'open'
        if not self.staff_user and self.status == 'scheduled':
            self.status = 'open'

        # Auto-update status based on time and conditions (only for assigned shifts)
        now = timezone.now()
        if self.staff_user:  # Only apply these status changes if shift is assigned
            if self.status == 'scheduled' and self.start_time <= now:
                self.status = 'active'
            elif self.status == 'active' and self.check_in_time:
                self.status = 'in_progress'
            elif self.status == 'in_progress' and self.check_out_time:
                self.status = 'pending_approval'
            
        # Auto-approve if conditions are met
        old_status = self._original_status
        if self.status == 'pending_approval' and self.end_signature and self.check_out_time:
            if self.check_out_location and self.venue.verify_location(
                self.check_out_location.get('latitude'),
                self.check_out_location.get('longitude')
            ):
                self.status = 'approved'
                self.manager_approved = True

        super().save(*args, **kwargs)

        # OpenShiftRequest creation is handled by the post_save signal
        # in signals.py (auto_create_open_shift_request) to avoid duplicates.

        # Cancel any OpenShiftRequest when staff is assigned to a previously open shift
        # OR when status changes from 'open' to something else
        # This fixes the bug where shifts show in both "available" and assigned user's shifts
        staff_was_assigned = (
            self._original_staff_user_id is None and
            self.staff_user_id is not None
        )
        status_changed_from_open = (
            self._original_status == 'open' and
            self.status != 'open'
        )
        if staff_was_assigned or status_changed_from_open:
            self.cancel_open_shift_requests()

        # Auto-generate invoice when shift is approved
        if self.status == 'approved' and old_status != 'approved' and self.staff_user:
            self.auto_generate_invoice()

    def auto_generate_invoice(self):
        """Auto-generate invoice for staff when shift is approved.

        Creates a 'draft' invoice (hybrid flow, P1.1). The draft will be
        superseded automatically when an official period invoice is created via
        regenerate(). Skipped if any non-superseded invoice already covers this
        shift's date.
        """
        from django.core.exceptions import ValidationError
        from django.db import DatabaseError

        try:
            # Get the shift date for invoice period
            shift_date = self.start_time.date()

            # Check if a non-superseded invoice already covers this shift date
            existing_invoice = Invoice.objects.filter(
                staff_user=self.staff_user,
                superseded_by__isnull=True,
                start_date__lte=shift_date,
                end_date__gte=shift_date,
            ).first()

            if not existing_invoice:
                # Generate a draft invoice for the shift date
                Invoice.generate_for_staff_period(
                    staff_user=self.staff_user,
                    start_date=shift_date,
                    end_date=shift_date,
                    default_status='draft',
                )
        except (DatabaseError, ValidationError, ValueError, TypeError) as e:
            # Log loudly but don't fail the shift-save itself. Specific
            # exception classes only — bubble up unexpected errors so they
            # surface to monitoring instead of being swallowed silently.
            import logging
            logger = logging.getLogger(__name__)
            logger.error(
                "Failed to auto-generate draft invoice for shift %s: %s: %s",
                self.id, type(e).__name__, e,
                exc_info=True,
            )

    def create_open_shift_request(self):
        """Create an OpenShiftRequest for this unassigned shift"""
        try:
            # Import here to avoid circular imports
            from django.contrib.auth.models import User
            
            # Find an admin user to be the "requesting" user for system-generated requests
            # Exclude the current user if they have superuser privileges to avoid self-claim issues
            admin_user = User.objects.filter(is_superuser=True).exclude(id=getattr(self.staff_user, 'id', None)).first()
            if not admin_user:
                return
                
            # Create the OpenShiftRequest
            OpenShiftRequest.objects.create(
                original_shift=self,
                requesting_user=admin_user,
                status='open',
                request_reason='System-generated: Open shift created for unassigned venue position'
            )
            
        except Exception as e:
            # Log error but don't fail the save operation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create OpenShiftRequest for shift {self.id}: {str(e)}")

    def cancel_open_shift_requests(self):
        """Cancel any open/claimed OpenShiftRequest records when staff is directly assigned

        This prevents the bug where a shift appears in both the assigned user's shifts
        AND the available shifts list after an admin directly assigns staff.
        """
        try:
            import logging
            logger = logging.getLogger(__name__)

            # Find and cancel any open or claimed requests for this shift
            open_requests = OpenShiftRequest.objects.filter(
                original_shift=self,
                status__in=['open', 'claimed']
            )

            count = open_requests.count()
            if count > 0:
                open_requests.update(status='cancelled')
                logger.info(f"Cancelled {count} OpenShiftRequest(s) for shift {self.id} - staff directly assigned")

        except Exception as e:
            # Log error but don't fail the save operation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to cancel OpenShiftRequests for shift {self.id}: {str(e)}")

    def can_start_shift(self):
        """Check if staff can start this shift"""
        if not self.staff_user:
            return False, "No staff assigned to shift"
            
        # Check if staff has accepted venue terms
        if not VenueTermsAcceptance.has_accepted_terms(self.staff_user, self.venue):
            return False, "Must accept venue terms before starting shift"
            
        return True, "OK"

    def check_in(self, latitude, longitude, signature=None, photo=None):
        """Staff checks in for their shift with location verification and time restrictions"""
        from datetime import timedelta
        
        # Time-based restrictions
        now = timezone.now()
        shift_start = self.start_time
        shift_end = self.end_time
        shift_start_date = shift_start.date()
        current_date = now.date()
        
        # Restriction 1: Must be within valid check-in window (handles overnight shifts)
        is_overnight_shift = shift_end.date() > shift_start_date
        is_valid_checkin_period = False
        
        if is_overnight_shift:
            # For overnight shifts: allow check-in if we're on start date OR 
            # if we're on end date but before the shift end time
            if current_date == shift_start_date:
                is_valid_checkin_period = True
            elif current_date == shift_end.date() and now <= shift_end:
                is_valid_checkin_period = True
        else:
            # For same-day shifts: must be on the same date
            is_valid_checkin_period = (current_date == shift_start_date)
        
        if not is_valid_checkin_period:
            if current_date < shift_start_date:
                days_diff = (shift_start_date - current_date).days
                raise ValueError(f"Cannot check in {days_diff} day{'s' if days_diff > 1 else ''} early. You can only check in on the day of your shift ({shift_start_date.strftime('%B %d, %Y')}).")
            elif is_overnight_shift and now > shift_end:
                # Special case for overnight shifts that have ended
                shift_end_time = shift_end.strftime('%I:%M %p on %B %d, %Y')
                raise ValueError(f"Cannot check in to an overnight shift that ended at {shift_end_time}. Please contact your manager if you need to check in late.")
            else:
                raise ValueError("Cannot check in to a shift from a previous date. Please contact your manager.")
        
        # Restriction 2: Cannot check in more than 15 minutes early
        early_checkin_window = timedelta(minutes=15)
        earliest_checkin_time = self.start_time - early_checkin_window
        
        if now < earliest_checkin_time:
            time_diff = earliest_checkin_time - now
            hours = int(time_diff.total_seconds() // 3600)
            minutes = int((time_diff.total_seconds() % 3600) // 60)
            
            if hours > 0:
                wait_time = f"{hours} hour{'s' if hours > 1 else ''} and {minutes} minute{'s' if minutes != 1 else ''}"
            else:
                wait_time = f"{minutes} minute{'s' if minutes != 1 else ''}"
                
            available_time = earliest_checkin_time.strftime('%I:%M %p')
            raise ValueError(f"Cannot check in {wait_time} early. Check-in becomes available at {available_time} (15 minutes before shift start).")
        
        # First verify they can start the shift
        can_start, message = self.can_start_shift()
        if not can_start:
            raise ValueError(message)
            
        if self.status not in ['active', 'scheduled']:
            raise ValueError("Shift must be active or scheduled to check in")
        
        if not self.venue.verify_location(latitude, longitude):
            raise ValueError("Location verification failed")
        
        self.check_in_time = timezone.now()
        self.check_in_location = {'latitude': latitude, 'longitude': longitude}
        if signature:
            self.start_signature = signature
        if photo:
            self.check_in_photo = photo
        self.status = 'in_progress'
        self.save()

    def check_out(self, latitude, longitude, signature=None, photo=None):
        """Staff checks out from their shift with location verification"""
        if self.status != 'in_progress':
            raise ValueError("Shift must be in progress to check out")
        
        if not self.venue.verify_location(latitude, longitude):
            raise ValueError("Location verification failed")
        
        self.check_out_time = timezone.now()
        self.check_out_location = {'latitude': latitude, 'longitude': longitude}
        if signature:
            self.end_signature = signature
        if photo:
            self.check_out_photo = photo
        self.status = 'pending_approval'
        self.save()

    def clone_to_date(self, target_date):
        """Clone this shift to a specific date"""
        if isinstance(target_date, str):
            target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
        # Calculate time difference in days
        current_date = self.start_time.date()
        days_difference = (target_date - current_date).days
        
        # Create new shift with adjusted dates
        new_shift = Shift.objects.create(
            venue=self.venue,
            template=self.template,
            required_security_role=self.required_security_role,
            start_time=self.start_time + timedelta(days=days_difference),
            end_time=self.end_time + timedelta(days=days_difference) if self.end_time else None,
            notes=self.notes,
            status='open'  # Always start as open
        )
        return new_shift

    @classmethod
    def bulk_clone_to_month(cls, year, month, shifts=None):
        """Clone multiple shifts to a specific month
        
        Args:
            year (int): Target year
            month (int): Target month (1-12)
            shifts (QuerySet, optional): Shifts to clone. If None, uses all approved shifts.
        
        Returns:
            list: List of created shifts
        """
        if shifts is None:
            # Default to approved shifts if none specified
            shifts = cls.objects.filter(status='approved')
            
        new_shifts = []
        target_date = datetime(year, month, 1).date()
        
        for shift in shifts:
            # Calculate the same day in target month
            try:
                new_date = target_date.replace(day=shift.start_time.day)
            except ValueError:
                # Handle cases like Feb 31 -> Feb 28
                new_date = (target_date.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                
            new_shifts.append(shift.clone_to_date(new_date))
            
        return new_shifts

    @classmethod
    def copy_week_pattern(cls, start_date, end_date, shifts=None):
        """Copy a week's pattern of shifts to a date range
        
        Args:
            start_date (date): Start date for new shifts
            end_date (date): End date for new shifts
            shifts (QuerySet, optional): Shifts to use as pattern. If None, uses all approved shifts from the last week.
        
        Returns:
            list: List of created shifts
        """
        if shifts is None:
            # Get shifts from the last week if none specified
            one_week_ago = timezone.now() - timedelta(days=7)
            shifts = cls.objects.filter(
                status='approved',
                start_time__gte=one_week_ago
            )
        
        new_shifts = []
        current_date = start_date
        
        while current_date <= end_date:
            # Find shifts that match this day of week
            day_shifts = [s for s in shifts if s.start_time.weekday() == current_date.weekday()]
            
            for shift in day_shifts:
                new_shifts.append(shift.clone_to_date(current_date))
                
            current_date += timedelta(days=1)
            
        return new_shifts

    def release_to_pool(self, reason):
        """Release this shift to the open shift pool"""
        if self.start_time <= timezone.now():
            raise ValueError("Cannot release shifts that have already started")
            
        if not self.staff_user:
            raise ValueError("This shift is already unassigned")
            
        return OpenShiftRequest.objects.create(
            original_shift=self,
            requesting_user=self.staff_user,
            request_reason=reason
        )

    def get_latest_time_adjustment(self):
        """Get the most recent time adjustment for this shift"""
        return self.time_adjustments.first()  # Already ordered by -created_at

    def get_effective_check_in_time(self):
        """Return adjusted check-in time if exists, otherwise original"""
        adjustment = self.get_latest_time_adjustment()
        if adjustment and adjustment.adjusted_check_in_time:
            return adjustment.adjusted_check_in_time
        return self.check_in_time

    def get_effective_check_out_time(self):
        """Return adjusted check-out time if exists, otherwise original"""
        adjustment = self.get_latest_time_adjustment()
        if adjustment and adjustment.adjusted_check_out_time:
            return adjustment.adjusted_check_out_time
        return self.check_out_time

    def get_effective_actual_hours(self):
        """Return adjusted hours if exists, otherwise calculated hours"""
        adjustment = self.get_latest_time_adjustment()
        if adjustment and adjustment.adjusted_actual_hours:
            return adjustment.adjusted_actual_hours
        return self.actual_hours_worked

    def calculate_payment_breakdown(self):
        """Return a per-tier breakdown of this shift's payment.

        Splits the capped/adjusted shift hours into base, OT tier 1 (1.5×), and
        OT tier 2 (2×) buckets driven by the relevant WorkingHoursRegulation.
        Used by Invoice.generate_for_staff_period to emit separate
        InvoiceItem rows per tier so the Payroll UI can show base+OT splits.

        Revenue-neutral: base_amount + ot1_amount + ot2_amount equals
        calculate_payment() exactly.

        Returns:
            dict with keys: rate, base_hours, base_amount, ot1_hours,
            ot1_amount, ot1_multiplier, ot2_hours, ot2_amount, ot2_multiplier.
            Returns None if hours/rate cannot be determined.
        """
        from decimal import Decimal

        effective_hours = self.get_effective_actual_hours()
        if not effective_hours:
            return None

        effective_rate = self.get_effective_hourly_rate()
        if not effective_rate:
            return None

        # Capped/adjusted hours (same logic as the legacy calculate_payment)
        scheduled_duration = self.end_time - self.start_time
        scheduled_hours = Decimal(str(scheduled_duration.total_seconds() / 3600))
        break_hours = Decimal(str(self.break_duration / 60))
        max_payable_hours = scheduled_hours - break_hours

        hours = Decimal(str(effective_hours))
        if not self.get_latest_time_adjustment() and not self.auto_checkout:
            hours = min(hours, max_payable_hours)

        rate = Decimal(str(effective_rate))

        # Default: everything is base (no OT)
        ot1_hours = Decimal('0')
        ot2_hours = Decimal('0')
        multiplier_1 = Decimal('1')
        multiplier_2 = Decimal('1')

        try:
            company = getattr(self.venue, 'company', None) if self.venue else None
            if company and company.country_code:
                regulation = (
                    WorkingHoursRegulation.objects.filter(
                        country_code__iexact=company.country_code,
                        is_active=True,
                    ).first()
                    or WorkingHoursRegulation.objects.filter(
                        country_code__iexact=company.country_code[:2],
                        is_active=True,
                    ).first()
                )

                if regulation and regulation.overtime_threshold_hours is not None and self.staff_user:
                    from datetime import timedelta as td

                    # P5 (L1 fix): convert to the company's timezone before
                    # extracting the date. Shifts near midnight UTC for venues
                    # in other timezones could otherwise land in the wrong
                    # ISO week, breaking weekly OT accumulation.
                    shift_date = None
                    if self.start_time:
                        try:
                            import zoneinfo
                            tz_name = (company.timezone or 'UTC') if company else 'UTC'
                            company_tz = zoneinfo.ZoneInfo(tz_name)
                            shift_date = self.start_time.astimezone(company_tz).date()
                        except (KeyError, ImportError, AttributeError):
                            # Fallback to UTC date on bad/missing timezone data
                            shift_date = self.start_time.date()
                    if shift_date:
                        week_start = shift_date - td(days=shift_date.weekday())
                        week_end = week_start + td(days=6)

                        from django.db.models import Sum as _Sum
                        # P3.5: only count shifts that started BEFORE this one
                        # in the same ISO week. Without start_time__lt the same
                        # threshold-overflow gets booked once per shift in the
                        # week (3 shifts in a 48h week with 40h threshold would
                        # each book 8h of OT, totalling 24h instead of 8h).
                        other_hours = (
                            Shift.objects.filter(
                                staff_user=self.staff_user,
                                start_time__date__gte=week_start,
                                start_time__date__lte=week_end,
                                start_time__lt=self.start_time,
                                status__in=['completed', 'approved', 'in_progress'],
                            )
                            .exclude(pk=self.pk)
                            .aggregate(total=_Sum('actual_hours_worked'))['total']
                        ) or Decimal('0')

                        prior_hours = Decimal(str(other_hours))
                        current_hours = hours
                        cumulative_after = prior_hours + current_hours

                        threshold_1 = Decimal(str(regulation.overtime_threshold_hours))
                        multiplier_1 = Decimal(str(regulation.overtime_multiplier_1))

                        threshold_2 = (
                            Decimal(str(regulation.overtime_threshold_2))
                            if regulation.overtime_threshold_2
                            else None
                        )
                        multiplier_2_val = (
                            Decimal(str(regulation.overtime_multiplier_2))
                            if regulation.overtime_multiplier_2
                            else None
                        )

                        if cumulative_after > threshold_1:
                            # OT-eligible hours from this shift
                            ot_start = max(threshold_1 - prior_hours, Decimal('0'))
                            shift_ot_hours = current_hours - ot_start

                            if threshold_2 and multiplier_2_val and cumulative_after > threshold_2:
                                ot2_start = max(threshold_2 - prior_hours, Decimal('0'))
                                ot2_hours = current_hours - ot2_start
                                ot1_hours = shift_ot_hours - ot2_hours
                                multiplier_2 = multiplier_2_val
                            else:
                                ot1_hours = shift_ot_hours
                                multiplier_2 = Decimal('1')

                            if ot1_hours < 0:
                                ot1_hours = Decimal('0')
                            if ot2_hours < 0:
                                ot2_hours = Decimal('0')
        except Exception:
            import logging as _logging
            _logging.getLogger(__name__).warning(
                f"Overtime calculation failed for shift {self.pk}", exc_info=True
            )
            ot1_hours = Decimal('0')
            ot2_hours = Decimal('0')
            multiplier_1 = Decimal('1')
            multiplier_2 = Decimal('1')

        base_hours = hours - ot1_hours - ot2_hours
        if base_hours < 0:
            base_hours = Decimal('0')

        base_amount = base_hours * rate
        ot1_amount = ot1_hours * rate * multiplier_1
        ot2_amount = ot2_hours * rate * multiplier_2

        return {
            'rate': rate,
            'base_hours': base_hours,
            'base_amount': base_amount,
            'ot1_hours': ot1_hours,
            'ot1_amount': ot1_amount,
            'ot1_multiplier': multiplier_1,
            'ot2_hours': ot2_hours,
            'ot2_amount': ot2_amount,
            'ot2_multiplier': multiplier_2,
        }

    def calculate_payment(self):
        """Calculate the payment for this shift based on actual hours worked and effective hourly rate

        Payment is capped at scheduled hours to prevent overtime exploitation from late checkouts.
        Only auto-checkout and manager-approved overtime can exceed scheduled hours.
        Uses adjusted hours from TimeAdjustment if available.

        Implementation note: this delegates to calculate_payment_breakdown() and
        sums the per-tier amounts so the legacy scalar return matches the
        breakdown exactly (revenue-neutral split).
        """
        breakdown = self.calculate_payment_breakdown()
        if breakdown is None:
            return None
        return breakdown['base_amount'] + breakdown['ot1_amount'] + breakdown['ot2_amount']

    @property
    def calculated_payment(self):
        """Property to expose payment calculation through the API"""
        return self.calculate_payment()

    def get_effective_hourly_rate(self):
        """Get the effective hourly rate for this shift, checking PayRate model first.

        For special-event shifts (is_special_event=True), the resolution order is:
          1. shift.hourly_rate (per-shift override always wins)
          2. SystemSettings.special_event_pay_rate (P3.3 fix — was unreachable)
          3. PayRate venue-specific
          4. PayRate default
          5. SystemSettings.default_hourly_rate
          6. Hardcoded fallback

        For regular shifts the order is the same minus step 2.
        """
        # First check if shift has its own hourly rate set
        if self.hourly_rate:
            return self.hourly_rate

        # P3.3 (C5 fix): special-event premium short-circuits PayRate cascade.
        # Without this, a staff member with a venue-specific PayRate will always
        # be paid at the venue rate even on special events, ignoring the
        # configured special_event_pay_rate.
        if self.is_special_event:
            try:
                settings = SystemSettings.objects.first()
                if settings and settings.special_event_pay_rate:
                    return settings.special_event_pay_rate
            except Exception:
                logger.exception('Error reading special_event_pay_rate')

        # Check for venue-specific pay rate for this staff member
        if self.staff_user and self.venue:
            venue_rate = PayRate.objects.filter(
                staff_user=self.staff_user,
                venue=self.venue
            ).first()
            if venue_rate:
                return venue_rate.hourly_rate

        # Check for default pay rate for this staff member
        if self.staff_user:
            default_rate = PayRate.objects.filter(
                staff_user=self.staff_user,
                venue=None,
                is_default=True
            ).first()
            if default_rate:
                return default_rate.hourly_rate

        # Fallback to system settings if no pay rates are set
        try:
            settings = SystemSettings.objects.first()
            if settings:
                return settings.special_event_pay_rate if self.is_special_event else settings.default_hourly_rate
        except Exception:
            logger.exception('Error in get_effective_hourly_rate')

        # Final fallback to hardcoded defaults
        return 14.00 if self.is_special_event else 12.50

    def get_completed_venue_checks(self):
        """Check if all venue-required checks are completed for this shift"""
        completed_requirements = []
        
        # Only check if shift is saved to database
        if not self.pk:
            return completed_requirements
        
        # Check fire safety requirements
        if self.venue.requires_fire_safety_checks:
            has_fire_check = FireExitCheck.objects.filter(shift=self).exists()
            completed_requirements.append(('fire_safety', has_fire_check))
        
        # Check capacity monitoring requirements  
        if self.venue.requires_capacity_monitoring:
            has_capacity_check = CapacityCheck.objects.filter(shift=self).exists()
            completed_requirements.append(('capacity', has_capacity_check))
            
        # Check toilet requirements
        if self.venue.requires_toilet_checks:
            has_toilet_check = ToiletCheck.objects.filter(shift=self).exists()
            completed_requirements.append(('toilet', has_toilet_check))
            
        return completed_requirements

    def can_force_timeout(self):
        """Determine if this shift is eligible for force timeout (bypassing venue checks)"""
        from django.utils import timezone
        from datetime import timedelta
        
        # Must be in progress and not already checked out
        if self.status != 'in_progress' or self.check_out_time is not None:
            return False
            
        # Must be past scheduled end time
        if not self.end_time:
            return False
            
        # Get force timeout threshold from system settings
        try:
            settings = SystemSettings.get_settings()
            force_timeout_minutes = settings.auto_checkout_force_timeout
        except Exception:
            logger.exception('Error in can_force_timeout')
            # Fallback to default if settings unavailable
            force_timeout_minutes = 720  # 12 hours
            
        force_timeout_threshold = timedelta(minutes=force_timeout_minutes)
        force_timeout_cutoff = self.end_time + force_timeout_threshold
        
        if timezone.now() >= force_timeout_cutoff:
            return True
            
        return False

    def can_auto_checkout(self):
        """Determine if this shift is eligible for automatic checkout"""
        from django.utils import timezone
        from datetime import timedelta
        
        # Check if auto-checkout is enabled in system settings
        try:
            settings = SystemSettings.get_settings()
            if not settings.auto_checkout_enabled:
                return False
            grace_period_minutes = settings.auto_checkout_grace_period
        except Exception:
            logger.exception('Error in can_auto_checkout')
            # Fallback to defaults if settings unavailable
            grace_period_minutes = 30
        
        # Must be in progress and not already checked out
        if self.status != 'in_progress' or self.check_out_time is not None:
            return False
            
        # Must be past scheduled end time + grace period
        if not self.end_time:
            return False
            
        grace_period = timedelta(minutes=grace_period_minutes)
        cutoff_time = self.end_time + grace_period
        
        if timezone.now() < cutoff_time:
            return False
            
        # Force timeout condition - bypasses all other checks for excessive overtime
        if self.can_force_timeout():
            return True
            
        # Must have completed all venue-required checks
        check_results = self.get_completed_venue_checks()
        
        # If venue has no check requirements, allow auto-checkout
        if not check_results:
            return True
            
        # All required checks must be completed
        return all(completed for check_type, completed in check_results)

    def perform_auto_checkout(self):
        """Execute automatic checkout for this shift"""
        if not self.can_auto_checkout():
            return False
            
        from django.utils import timezone
        import logging
        logger = logging.getLogger(__name__)
        
        # Determine if this is a force timeout scenario
        is_force_timeout = self.can_force_timeout()
        
        # Set checkout time to scheduled end time (not current time)
        self.check_out_time = self.end_time
        
        # Use venue's main location for checkout location
        self.check_out_location = {
            'latitude': float(self.venue.latitude) if self.venue.latitude else 0,
            'longitude': float(self.venue.longitude) if self.venue.longitude else 0
        }
        
        # Mark as auto-checkout and set appropriate signature
        self.auto_checkout = True
        if is_force_timeout:
            self.end_signature = "AUTO_CHECKOUT_FORCE_TIMEOUT_EXCESSIVE_OVERTIME"
            # Log force timeout with warning level
            logger.warning(f"FORCE TIMEOUT auto-checkout performed for shift {self.id} - Staff: {self.staff_user.username}, Venue: {self.venue.name}, Excessive overtime detected")
        else:
            self.end_signature = "AUTO_CHECKOUT_VENUE_REQUIREMENTS_COMPLETED"
            # Log normal auto-checkout
            logger.info(f"Auto-checkout performed for shift {self.id} - Staff: {self.staff_user.username}, Venue: {self.venue.name}")
        
        self.status = 'pending_approval'
        
        # Save the shift
        self.save()
        
        return True


class TimeAdjustment(models.Model):
    """Records manual time adjustments made by managers/admins

    Preserves original shift times while allowing corrections when staff were present
    on time but signed in late due to technical issues. All adjustments require
    manager digital signature and reason.
    """

    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='time_adjustments')

    # Original times (copied from shift at time of adjustment)
    original_check_in_time = models.DateTimeField(null=True, blank=True, help_text="Original check-in time before adjustment")
    original_check_out_time = models.DateTimeField(null=True, blank=True, help_text="Original check-out time before adjustment")
    original_actual_hours = models.DecimalField(max_digits=5, decimal_places=2, help_text="Original actual hours worked")

    # Adjusted times (corrected values)
    adjusted_check_in_time = models.DateTimeField(null=True, blank=True, help_text="Corrected check-in time")
    adjusted_check_out_time = models.DateTimeField(null=True, blank=True, help_text="Corrected check-out time")
    adjusted_actual_hours = models.DecimalField(max_digits=5, decimal_places=2, help_text="Corrected actual hours worked")

    # Audit fields
    reason = models.TextField(help_text="Explanation for the adjustment (required)")
    adjusted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='time_adjustments_made')
    manager_signature = models.TextField(help_text="Base64 encoded signature image")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'time_adjustments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['shift', '-created_at']),
        ]

    def __str__(self):
        return f"Time Adjustment for Shift {self.shift.id} by {self.adjusted_by.username if self.adjusted_by else 'Unknown'}"

    def clean(self):
        """Validate time adjustment constraints"""
        from django.core.exceptions import ValidationError
        from datetime import timedelta
        from decimal import Decimal

        errors = {}

        # A TimeAdjustment is an audit row for a real correction. It MUST
        # capture the prior state (original_*) of the Shift it adjusted.
        # First-time recordings should write Shift fields directly via
        # shifts.services.record_attendance and not create a TimeAdjustment.
        if self.pk is None:
            has_prior_state = bool(
                self.original_check_in_time
                or self.original_check_out_time
                or (self.original_actual_hours and self.original_actual_hours > Decimal('0'))
            )
            if not has_prior_state:
                errors['original_actual_hours'] = (
                    'TimeAdjustment requires non-empty original_* fields. '
                    'For first-time attendance recording use '
                    'shifts.services.record_attendance instead.'
                )

        # Validate check-in time adjustment
        if self.adjusted_check_in_time:
            # Cannot be more than 2 hours before scheduled start
            max_early_checkin = self.shift.start_time - timedelta(hours=2)
            if self.adjusted_check_in_time < max_early_checkin:
                errors['adjusted_check_in_time'] = f"Adjusted check-in cannot be more than 2 hours before scheduled start time ({self.shift.start_time})"

        # Validate check-out time adjustment
        if self.adjusted_check_out_time:
            # Cannot be more than 4 hours after scheduled end
            max_late_checkout = self.shift.end_time + timedelta(hours=4)
            if self.adjusted_check_out_time > max_late_checkout:
                errors['adjusted_check_out_time'] = f"Adjusted check-out cannot be more than 4 hours after scheduled end time ({self.shift.end_time})"

        # Check-out must be after check-in
        if self.adjusted_check_in_time and self.adjusted_check_out_time:
            if self.adjusted_check_out_time <= self.adjusted_check_in_time:
                errors['adjusted_check_out_time'] = "Check-out time must be after check-in time"

        # Adjusted hours cannot exceed 24
        if self.adjusted_actual_hours and self.adjusted_actual_hours > 24:
            errors['adjusted_actual_hours'] = "Adjusted hours cannot exceed 24 hours"

        # Validate adjusted hours match calculated hours from times
        if self.adjusted_check_in_time and self.adjusted_check_out_time and self.adjusted_actual_hours:
            from decimal import Decimal
            duration = self.adjusted_check_out_time - self.adjusted_check_in_time
            calculated_hours = Decimal(str(duration.total_seconds() / 3600))
            # Allow small rounding differences
            if abs(calculated_hours - self.adjusted_actual_hours) > Decimal('0.1'):
                errors['adjusted_actual_hours'] = f"Adjusted hours ({self.adjusted_actual_hours}) don't match calculated hours from times ({calculated_hours:.2f})"

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        """Run validation before saving"""
        self.full_clean()
        super().save(*args, **kwargs)


class ShiftCheck(models.Model):
    """Abstract base class for all types of checks during a shift"""
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    photo_evidence = models.URLField(max_length=500, null=True, blank=True)
    location = models.JSONField(null=True, blank=True, help_text="Latitude and longitude of check location")
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Multi-staff shift support: share checks across grouped shifts
    shift_group = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        db_index=True,
        help_text="Links check to all shifts in a group for multi-staff visibility"
    )
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_performed',
        help_text="Staff member who performed this check"
    )

    class Meta:
        abstract = True
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if not self.timestamp:
            self.timestamp = timezone.now()
        # Auto-populate shift_group so every check has a stable group key.
        # Multi-staff shifts pass through the real shift_group; single-staff
        # shifts get a synthesized 'shift_<id>' so the capacity logbook,
        # missed-slot detector, and signoff all key off the same value
        # without special-casing single vs multi-staff anywhere.
        if not self.shift_group and self.shift:
            self.shift_group = self.shift.shift_group or f'shift_{self.shift.id}'
        # Auto-populate performed_by from the shift's staff_user if not set
        if not self.performed_by and self.shift and self.shift.staff_user:
            self.performed_by = self.shift.staff_user
        super().save(*args, **kwargs)

class FireExitCheck(ShiftCheck):
    exit_name = models.CharField(max_length=255)
    is_clear = models.BooleanField(default=True)
    is_properly_marked = models.BooleanField(default=True)
    is_accessible = models.BooleanField(default=True)

    class Meta:
        db_table = 'fire_exit_checks'

    def __str__(self):
        status = "Clear" if self.is_clear and self.is_properly_marked and self.is_accessible else "Issues Found"
        return f"{self.exit_name} - {status} at {self.timestamp}"

class CapacityCheck(ShiftCheck):
    current_count = models.IntegerField(validators=[MinValueValidator(0)])
    venue_capacity = models.IntegerField()
    is_at_capacity = models.BooleanField(default=False)
    action_taken = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'capacity_checks'

    def save(self, *args, **kwargs):
        self.is_at_capacity = self.current_count >= self.venue_capacity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Count: {self.current_count}/{self.venue_capacity} at {self.timestamp}"


class CapacityCheckSlotMiss(models.Model):
    """
    Records a 30-minute (or venue-configured) capacity-check window that
    elapsed without any CapacityCheck being logged for the shift_group.
    Created by the flag_missed_capacity_checks Celery task.
    """
    shift_group = models.CharField(max_length=50, db_index=True)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='capacity_misses')
    expected_at = models.DateTimeField(help_text="Start of the slot window that was missed")
    detected_at = models.DateTimeField(auto_now_add=True)
    acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='capacity_misses_acknowledged'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledgement_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'capacity_check_slot_misses'
        ordering = ['-expected_at']
        unique_together = [('shift_group', 'expected_at')]
        indexes = [models.Index(fields=['shift_group', 'expected_at'])]

    def __str__(self):
        return f"Missed capacity slot {self.expected_at} for {self.shift_group}"


class CapacityLogbookSignoff(models.Model):
    """
    End-of-shift signoff of the digital capacity-check logbook.
    Signed by the venue's duty manager (an external person, not a Guard
    user). One row per shift_group; if the venue admin is unavailable,
    staff may submit an override_reason instead of a signature.
    """
    shift_group = models.CharField(max_length=50, unique=True, db_index=True)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='capacity_signoffs')
    closed_by_name = models.CharField(max_length=120, blank=True, help_text="Typed name of the venue's duty manager (blank if overridden)")
    closed_by_role = models.CharField(max_length=80, blank=True, help_text="Role/title of the signer, e.g. 'Duty Manager'")
    signature = models.TextField(blank=True, help_text="Base64-encoded signature image (blank if overridden)")
    signed_at = models.DateTimeField(null=True, blank=True)
    override_reason = models.TextField(blank=True, help_text="Reason why no signature was captured (e.g. 'Duty manager left early')")
    closed_by_staff = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='capacity_signoffs_submitted',
        help_text="Guard staff member who submitted this signoff"
    )
    notes = models.TextField(blank=True)
    total_checks = models.PositiveIntegerField(default=0, help_text="Snapshot: number of CapacityCheck rows in the shift_group at signoff time")
    total_missed = models.PositiveIntegerField(default=0, help_text="Snapshot: number of CapacityCheckSlotMiss rows in the shift_group at signoff time")
    auto_closed = models.BooleanField(
        default=False,
        help_text=(
            "True when the signoff was created by the system on auto-checkout "
            "(no staff input). Distinguishes audit-trail noise from a "
            "deliberate staff override."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'capacity_logbook_signoffs'
        ordering = ['-created_at']

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        has_signature = bool(self.signature and self.closed_by_name)
        has_override = bool(self.override_reason)
        if not (has_signature or has_override):
            raise ValidationError("Either a signature with name, or an override_reason, is required.")
        if has_signature and not self.signed_at:
            self.signed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.override_reason:
            return f"Logbook for {self.shift_group} closed via override"
        return f"Logbook for {self.shift_group} signed by {self.closed_by_name}"


class ToiletCheck(ShiftCheck):
    CONDITION_CHOICES = (
        ('excellent', 'Excellent'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('poor', 'Poor'),
        ('critical', 'Critical'),
    )

    location_name = models.CharField(max_length=255)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    needs_attention = models.BooleanField(default=False)
    is_out_of_order = models.BooleanField(default=False)
    supplies_needed = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'toilet_checks'

    def __str__(self):
        return f"{self.location_name} - {self.get_condition_display()} at {self.timestamp}"

class ShiftExchange(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted_by_target', 'Accepted by Target User'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    )

    original_shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='exchange_requests')
    target_shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='target_exchange_requests', null=True, blank=True, help_text="Shift offered by target user in exchange")
    requesting_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requested_exchanges')
    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_exchanges')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    request_reason = models.TextField()
    target_response = models.TextField(null=True, blank=True, help_text="Response from target user")
    manager_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_exchanges')
    manager_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shift_exchanges'
        ordering = ['-created_at']

    def __str__(self):
        return f"Exchange request from {self.requesting_user.username} to {self.target_user.username}"

    def clean(self):
        """Validate the shift exchange"""
        # Skip validation for approved, rejected, or cancelled exchanges
        if self.status in ['approved', 'rejected', 'cancelled']:
            return
            
        if self.requesting_user == self.target_user:
            raise ValueError("Cannot exchange shift with yourself")
            
        if self.original_shift.start_time <= timezone.now():
            raise ValueError("Cannot exchange shifts that have already started")
            
        if not self.target_user.has_security_role(self.original_shift.required_security_role):
            raise ValueError("Target user does not have the required security role for this shift")
            
        # Check if target user already has a shift at this time (excluding the original shift)
        conflicting_shifts = Shift.objects.filter(
            staff_user=self.target_user,
            start_time__lt=self.original_shift.end_time,
            end_time__gt=self.original_shift.start_time
        ).exclude(status__in=['cancelled', 'rejected']).exclude(id=self.original_shift.id)
        
        if conflicting_shifts.exists():
            raise ValueError("Target user already has a shift during this time")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def accept_by_target(self, response=None):
        """Target user accepts the exchange request - may auto-approve if no conflicts"""
        if self.status != 'pending':
            raise ValueError("Can only accept pending requests")

        self.target_response = response

        # Check if automatic approval is possible
        try:
            # Re-run validation to check for conflicts
            self.clean()  # Raises ValueError if conflicts exist

            # Check company policy (if auto-approval is enabled)
            system_settings = SystemSettings.objects.first()
            auto_approve_enabled = getattr(system_settings, 'auto_approve_shift_exchanges', True)

            if auto_approve_enabled:
                # NO CONFLICTS - Automatically approve
                logger.info(f"Auto-approving shift exchange {self.id} - no conflicts detected")

                # Perform the shift transfer immediately
                if self.target_shift:
                    # Bilateral exchange
                    original_user = self.original_shift.staff_user
                    target_user = self.target_shift.staff_user

                    self.original_shift.staff_user = target_user
                    self.target_shift.staff_user = original_user

                    self.original_shift.status = 'scheduled'
                    self.target_shift.status = 'scheduled'

                    self.original_shift.save()
                    self.target_shift.save()
                else:
                    # Simple transfer
                    self.original_shift.staff_user = self.target_user
                    self.original_shift.status = 'scheduled'
                    self.original_shift.save()

                # Mark as approved (no manager needed)
                self.status = 'approved'
                self.manager_notes = 'Auto-approved: No conflicts detected'
                self.save()

                return True  # Indicates auto-approval happened
            else:
                # Auto-approval disabled - require manager
                self.status = 'accepted_by_target'
                self.save()
                return False

        except ValueError as e:
            # CONFLICTS DETECTED - Require manager approval
            logger.info(f"Shift exchange {self.id} requires manager approval: {str(e)}")
            self.status = 'accepted_by_target'
            self.manager_notes = f'Requires review: {str(e)}'
            self.save()
            return False

    def approve(self, manager_user, notes=None):
        """Manager approves the exchange request"""
        if self.status != 'accepted_by_target':
            raise ValueError("Can only approve requests accepted by target user")
            
        if self.target_shift:
            # True bilateral exchange - swap both shifts
            original_user = self.original_shift.staff_user  # Current owner of original shift
            target_user = self.target_shift.staff_user      # Current owner of target shift
            
            # Swap the shifts
            self.original_shift.staff_user = target_user    # Target user gets original shift
            self.target_shift.staff_user = original_user    # Original user gets target shift
            
            # Ensure both shifts are active
            self.original_shift.status = 'scheduled'
            self.target_shift.status = 'scheduled'
            
            # Save both shifts
            self.original_shift.save()
            self.target_shift.save()
        else:
            # Simple transfer - target user takes over the original shift
            # This is for backward compatibility with existing exchange requests
            self.original_shift.staff_user = self.target_user
            self.original_shift.status = 'scheduled'
            self.original_shift.save()
        
        self.status = 'approved'
        self.manager_user = manager_user
        self.manager_notes = notes
        self.save()

    def reject(self, manager_user, notes):
        """Manager rejects the exchange request"""
        if self.status not in ['pending', 'accepted_by_target']:
            raise ValueError("Can only reject pending or accepted requests")
            
        self.status = 'rejected'
        self.manager_user = manager_user
        self.manager_notes = notes
        self.save()

    def cancel(self, cancelled_by_user):
        """Cancel the exchange request"""
        if self.status not in ['pending', 'accepted_by_target']:
            raise ValueError("Can only cancel pending or accepted requests")
            
        if cancelled_by_user not in [self.requesting_user, self.target_user]:
            raise ValueError("Only requesting or target user can cancel the exchange")
            
        self.status = 'cancelled'
        self.save()

class Invoice(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        # 'approved' (Phase 2): manager has signed off on the hours but
        # money has not left the bank yet. Sits between 'pending' (unreviewed)
        # and 'paid' (settled). Approved invoices are exportable to Xero;
        # only the Xero webhook (or a manual mark-paid) flips them to 'paid'.
        ('approved', 'Approved'),
        ('paid', 'Paid'),
        ('rejected', 'Rejected'),
    )

    SOURCE_CHOICES = (
        ('system', 'System/Shift Generated'),
        ('admin', 'Admin Generated'),
    )

    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(
        max_length=50, unique=True, null=True, blank=True,
        help_text="Display invoice number, e.g. PAY-2026-00481"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    total_hours = models.DecimalField(max_digits=10, decimal_places=2)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    issued_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    reject_reason = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    payroll_run = models.ForeignKey(
        'PayrollRun', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='staff_invoices'
    )
    superseded_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supersedes',
        help_text=(
            "When set, this invoice has been replaced by another invoice. "
            "Many-to-one: a single replacement invoice can supersede multiple "
            "draft auto-invoices in the hybrid flow, or a single rejected "
            "invoice can be superseded by its reissue. Display as 'Resolved' "
            "instead of 'Rejected' so it falls out of the manager's open work "
            "queue."
        ),
    )
    pdf_url = models.URLField(max_length=500, null=True, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='system')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_invoices')
    version = models.IntegerField(default=1, help_text="Increments on each recalculation")
    last_recalculated_at = models.DateTimeField(null=True, blank=True, help_text="Last time invoice was recalculated from shift adjustments")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice for {self.staff_user.username} ({self.start_date} to {self.end_date})"
    
    @classmethod
    @transaction.atomic
    def generate_for_staff_period(cls, staff_user, start_date, end_date, source='system', created_by=None, default_status='pending'):
        """Generate an invoice for a staff member for a specific period using shift-specific payments.

        Wrapped in transaction.atomic so a mid-loop failure on InvoiceItem
        creation rolls back the partial invoice header. Without this, a failure
        between creating the Invoice row and emitting all its line items would
        leave Invoice.total_amount mismatched with the sum of its items.

        Note on C6 (concurrent-approval race, deferred): two concurrent calls
        racing the existence check before either has inserted can both create
        an invoice for the same (staff_user, start_date, end_date). A proper
        fix requires a partial UNIQUE constraint (where superseded_by IS NULL)
        added by migration. The hybrid + cascade architecture limits practical
        exposure: any race-created drafts are superseded on the next regenerate
        and any sibling-week OT drift is healed by the cascade signal.

        Args:
            staff_user: The staff member the invoice is for
            start_date: Start date of the invoice period
            end_date: End date of the invoice period
            source: 'system' for shift-generated, 'admin' for admin-generated (default: 'system')
            created_by: User who created the invoice (for admin-generated invoices)
            default_status: Status to assign to the new invoice. Use 'draft' for
                preliminary auto-generated invoices that should be superseded
                when an official period invoice is later created. Default 'pending'.
        """
        from decimal import Decimal

        # Check if an invoice already exists for this staff member and period
        existing_invoice = cls.objects.filter(
            staff_user=staff_user,
            start_date=start_date,
            end_date=end_date
        ).first()

        if existing_invoice:
            # Invoice already exists - skip creation
            return existing_invoice

        # Get all approved shifts for the staff member in the date range
        shifts = Shift.objects.filter(
            staff_user=staff_user,
            start_time__date__gte=start_date,
            start_time__date__lte=end_date,
            status='approved',
            actual_hours_worked__isnull=False
        ).order_by('start_time')

        # Determine if staff is a permanent employee (for leave items)
        is_permanent = False
        daily_rate = None
        company = None

        if hasattr(staff_user, 'profile') and staff_user.profile:
            # Get company through UserCompanyMembership, not profile
            membership = staff_user.company_memberships.filter(is_active=True).first()
            company = membership.company if membership else None
            employment_type = staff_user.profile.employment_type
            if employment_type and getattr(employment_type, 'employment_category', None) == 'permanent':
                is_permanent = True
                # Get the staff's leave daily rate
                if hasattr(staff_user, 'leave_daily_rate'):
                    daily_rate_obj = staff_user.leave_daily_rate
                    if daily_rate_obj and daily_rate_obj.effective_from <= end_date:
                        daily_rate = daily_rate_obj.daily_rate

        # Get bank holidays and approved leave for permanent employees
        bank_holidays = []
        approved_leave_days = []

        if is_permanent and daily_rate and company:
            # Get bank holidays in the period
            bank_holidays = list(BankHoliday.objects.filter(
                company=company,
                date__gte=start_date,
                date__lte=end_date,
                is_active=True
            ).order_by('date'))

            # Get approved leave requests in the period
            try:
                from leave_management.models import LeaveRequest
                leave_requests = LeaveRequest.objects.filter(
                    staff_user=staff_user,
                    status='approved',
                    start_date__lte=end_date,
                    end_date__gte=start_date
                )
                # Generate individual leave days
                for leave_req in leave_requests:
                    leave_start = max(leave_req.start_date, start_date)
                    leave_end = min(leave_req.end_date, end_date)
                    current_date = leave_start
                    while current_date <= leave_end:
                        # Don't duplicate bank holidays as annual leave
                        if not any(bh.date == current_date for bh in bank_holidays):
                            approved_leave_days.append({
                                'date': current_date,
                                'leave_request': leave_req
                            })
                        current_date += timedelta(days=1)
            except ImportError:
                # leave_management app not installed
                pass

        # Check if we have any items to invoice
        has_shifts = bool(shifts)
        has_leave_items = bool(bank_holidays or approved_leave_days)

        if not has_shifts and not has_leave_items:
            raise ValueError(f"No approved shifts or leave items found for {staff_user.username} between {start_date} and {end_date}")

        # Calculate totals from individual shifts
        total_hours = Decimal('0.00')
        total_amount = Decimal('0.00')
        regular_hours = Decimal('0.00')
        special_event_hours = Decimal('0.00')

        for shift in shifts:
            if shift.actual_hours_worked:
                total_hours += shift.actual_hours_worked
                if shift.is_special_event:
                    special_event_hours += shift.actual_hours_worked
                else:
                    regular_hours += shift.actual_hours_worked

                # Use shift-specific payment calculation
                shift_payment = shift.calculate_payment()
                if shift_payment:
                    total_amount += shift_payment

        # Add leave amounts to total
        leave_total = Decimal('0.00')
        if daily_rate:
            leave_total = daily_rate * (len(bank_holidays) + len(approved_leave_days))
            total_amount += leave_total

        # Calculate average hourly rate for the invoice (for display purposes)
        average_rate = total_amount / total_hours if total_hours > 0 else Decimal('0.00')

        # Create the invoice
        invoice = cls.objects.create(
            staff_user=staff_user,
            start_date=start_date,
            end_date=end_date,
            total_hours=total_hours,
            hourly_rate=average_rate,  # This is now an average of all shift rates
            total_amount=total_amount,
            status=default_status,
            source=source,
            created_by=created_by
        )

        # Hybrid invoice flow (P1.1): when an official period invoice is created
        # (default_status != 'draft'), supersede any preliminary draft invoices
        # for this staff member whose period overlaps the new invoice. The
        # superseded_by FK already drives 'Resolved' rendering in serializers.
        if default_status != 'draft':
            overlapping_drafts = cls.objects.filter(
                staff_user=staff_user,
                status='draft',
                superseded_by__isnull=True,
                start_date__lte=end_date,
                end_date__gte=start_date,
            ).exclude(pk=invoice.pk)
            for draft in overlapping_drafts:
                draft.superseded_by = invoice
                draft.save(update_fields=['superseded_by', 'updated_at'])

        # Create invoice items for each shift, splitting into base + OT tier rows
        # so the Payroll UI can show base/OT1/OT2 separately.
        for shift in shifts:
            if not shift.actual_hours_worked:
                continue
            breakdown = shift.calculate_payment_breakdown()
            if not breakdown:
                continue

            base_rate = breakdown['rate']
            shift_date = shift.start_time.date()

            # Determine the item_type for the base row: special-event shifts
            # become a 'special' line item per the UI's 6-type taxonomy.
            base_item_type = 'special' if shift.is_special_event else 'shift'

            base_hours = breakdown['base_hours']
            base_amount = breakdown['base_amount']
            if base_hours > 0:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_type=base_item_type,
                    shift=shift,
                    date=shift_date,
                    venue=shift.venue,
                    hours_worked=base_hours,
                    rate=base_rate,
                    amount=base_amount,
                )

            # OT tier 1 (1.5×): emit only if hours > 0
            if breakdown['ot1_hours'] > 0:
                ot1_effective_rate = base_rate * breakdown['ot1_multiplier']
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_type='overtime_1',
                    shift=shift,
                    date=shift_date,
                    venue=shift.venue,
                    hours_worked=breakdown['ot1_hours'],
                    rate=ot1_effective_rate,
                    amount=breakdown['ot1_amount'],
                )

            # OT tier 2 (2×): emit only if hours > 0
            if breakdown['ot2_hours'] > 0:
                ot2_effective_rate = base_rate * breakdown['ot2_multiplier']
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_type='overtime_2',
                    shift=shift,
                    date=shift_date,
                    venue=shift.venue,
                    hours_worked=breakdown['ot2_hours'],
                    rate=ot2_effective_rate,
                    amount=breakdown['ot2_amount'],
                )

            # Revenue-neutral assertion: per-tier sum must equal calculate_payment().
            # Floats from calculate_payment_breakdown are Decimals so equality is exact.
            tier_sum = breakdown['base_amount'] + breakdown['ot1_amount'] + breakdown['ot2_amount']
            scalar = shift.calculate_payment() or Decimal('0')
            if abs(tier_sum - scalar) > Decimal('0.01'):
                logger.warning(
                    "Payment breakdown sum (%s) drifts from calculate_payment (%s) for shift %s",
                    tier_sum, scalar, shift.pk,
                )

        # Create invoice items for bank holidays (permanent employees only)
        for bank_holiday in bank_holidays:
            InvoiceItem.objects.create(
                invoice=invoice,
                item_type='bank_holiday',
                bank_holiday=bank_holiday,
                date=bank_holiday.date,
                description=f"Bank Holiday: {bank_holiday.name}",
                days=Decimal('1'),
                rate=daily_rate,
                amount=daily_rate
            )

        # Create invoice items for approved annual leave (permanent employees only)
        for leave_day in approved_leave_days:
            InvoiceItem.objects.create(
                invoice=invoice,
                item_type='annual_leave',
                leave_request=leave_day['leave_request'],
                date=leave_day['date'],
                description='Annual Leave',
                days=Decimal('1'),
                rate=daily_rate,
                amount=daily_rate
            )

        return invoice

    def recalculate_from_shifts(self):
        """Recalculate invoice totals from all linked shifts and leave items.

        Triggered by the TimeAdjustment post-save signal. Because an adjustment
        can change a shift's OT distribution (more hours pushed past threshold,
        for example), shift-backed line items are deleted and re-emitted via the
        same per-tier logic used by generate_for_staff_period.
        Leave items (bank holidays, annual leave) are preserved unchanged.
        """
        from decimal import Decimal
        from django.utils import timezone

        total_hours = Decimal('0.00')
        total_amount = Decimal('0.00')

        # Snapshot the distinct shift FKs that contribute to this invoice
        shift_ids = list(
            self.items.filter(shift__isnull=False)
            .values_list('shift_id', flat=True)
            .distinct()
        )
        shifts = list(Shift.objects.filter(pk__in=shift_ids).order_by('start_time'))

        # Drop the existing shift-backed rows so we can re-emit cleanly with
        # the latest OT distribution.
        self.items.filter(shift__isnull=False).delete()

        for shift in shifts:
            if not shift.actual_hours_worked:
                continue
            breakdown = shift.calculate_payment_breakdown()
            if not breakdown:
                continue

            base_rate = breakdown['rate']
            shift_date = shift.start_time.date()
            base_item_type = 'special' if shift.is_special_event else 'shift'

            base_hours = breakdown['base_hours']
            if base_hours > 0:
                InvoiceItem.objects.create(
                    invoice=self,
                    item_type=base_item_type,
                    shift=shift,
                    date=shift_date,
                    venue=shift.venue,
                    hours_worked=base_hours,
                    rate=base_rate,
                    amount=breakdown['base_amount'],
                )
                total_hours += base_hours
                total_amount += breakdown['base_amount']

            if breakdown['ot1_hours'] > 0:
                InvoiceItem.objects.create(
                    invoice=self,
                    item_type='overtime_1',
                    shift=shift,
                    date=shift_date,
                    venue=shift.venue,
                    hours_worked=breakdown['ot1_hours'],
                    rate=base_rate * breakdown['ot1_multiplier'],
                    amount=breakdown['ot1_amount'],
                )
                total_hours += breakdown['ot1_hours']
                total_amount += breakdown['ot1_amount']

            if breakdown['ot2_hours'] > 0:
                InvoiceItem.objects.create(
                    invoice=self,
                    item_type='overtime_2',
                    shift=shift,
                    date=shift_date,
                    venue=shift.venue,
                    hours_worked=breakdown['ot2_hours'],
                    rate=base_rate * breakdown['ot2_multiplier'],
                    amount=breakdown['ot2_amount'],
                )
                total_hours += breakdown['ot2_hours']
                total_amount += breakdown['ot2_amount']

        # Add leave amounts (untouched by this recalc)
        for item in self.items.filter(item_type__in=('bank_holiday', 'annual_leave')):
            total_amount += item.amount or Decimal('0.00')

        self.total_hours = total_hours
        self.total_amount = total_amount
        self.hourly_rate = total_amount / total_hours if total_hours > 0 else Decimal('0.00')
        self.version = (self.version or 0) + 1
        self.last_recalculated_at = timezone.now()
        self.save()
        return self

    @property
    def payment_breakdown(self):
        """Get detailed payment breakdown by rate type"""
        return self.get_payment_breakdown()
    
    def get_payment_breakdown(self):
        """Get detailed payment breakdown by rate type including leave items.

        P4 (H3 fix): now includes overtime_1, overtime_2, and special_event
        item types in the breakdown buckets. Previously these were silently
        excluded so any invoice with OT or special-event shifts showed zero
        in its per-category summary even though invoice.total_amount was
        correct.
        """
        from decimal import Decimal

        # Base hours for non-special shifts (item_type='shift')
        regular_shifts = self.items.filter(item_type='shift')
        # Base hours for special-event shifts (item_type='special')
        special_event_shifts = self.items.filter(item_type='special')
        # Overtime items (apply to both regular and special shifts)
        overtime_1_items = self.items.filter(item_type='overtime_1')
        overtime_2_items = self.items.filter(item_type='overtime_2')

        # Filter leave items
        bank_holiday_items = self.items.filter(item_type='bank_holiday')
        annual_leave_items = self.items.filter(item_type='annual_leave')

        regular_hours = regular_shifts.aggregate(
            total_hours=models.Sum('hours_worked')
        )['total_hours'] or Decimal('0.00')

        regular_amount = regular_shifts.aggregate(
            total_amount=models.Sum('amount')
        )['total_amount'] or Decimal('0.00')

        special_hours = special_event_shifts.aggregate(
            total_hours=models.Sum('hours_worked')
        )['total_hours'] or Decimal('0.00')

        special_amount = special_event_shifts.aggregate(
            total_amount=models.Sum('amount')
        )['total_amount'] or Decimal('0.00')

        bank_holiday_days = bank_holiday_items.aggregate(
            total_days=models.Sum('days')
        )['total_days'] or Decimal('0.00')

        bank_holiday_amount = bank_holiday_items.aggregate(
            total_amount=models.Sum('amount')
        )['total_amount'] or Decimal('0.00')

        annual_leave_days = annual_leave_items.aggregate(
            total_days=models.Sum('days')
        )['total_days'] or Decimal('0.00')

        annual_leave_amount = annual_leave_items.aggregate(
            total_amount=models.Sum('amount')
        )['total_amount'] or Decimal('0.00')

        # Convert Decimals to float for JSON serialization
        return {
            'regular_shifts': {
                'count': regular_shifts.count(),
                'hours': float(regular_hours),
                'amount': float(regular_amount),
                'average_rate': float(regular_amount / regular_hours) if regular_hours > 0 else 0.0
            },
            'special_event_shifts': {
                'count': special_event_shifts.count(),
                'hours': float(special_hours),
                'amount': float(special_amount),
                'average_rate': float(special_amount / special_hours) if special_hours > 0 else 0.0
            },
            'bank_holidays': {
                'count': bank_holiday_items.count(),
                'days': float(bank_holiday_days),
                'amount': float(bank_holiday_amount),
                'daily_rate': float(bank_holiday_amount / bank_holiday_days) if bank_holiday_days > 0 else 0.0
            },
            'annual_leave': {
                'count': annual_leave_items.count(),
                'days': float(annual_leave_days),
                'amount': float(annual_leave_amount),
                'daily_rate': float(annual_leave_amount / annual_leave_days) if annual_leave_days > 0 else 0.0
            },
            'overtime_1': {
                'count': overtime_1_items.count(),
                'hours': float(
                    overtime_1_items.aggregate(t=models.Sum('hours_worked'))['t']
                    or Decimal('0.00')
                ),
                'amount': float(
                    overtime_1_items.aggregate(t=models.Sum('amount'))['t']
                    or Decimal('0.00')
                ),
            },
            'overtime_2': {
                'count': overtime_2_items.count(),
                'hours': float(
                    overtime_2_items.aggregate(t=models.Sum('hours_worked'))['t']
                    or Decimal('0.00')
                ),
                'amount': float(
                    overtime_2_items.aggregate(t=models.Sum('amount'))['t']
                    or Decimal('0.00')
                ),
            },
            'total': {
                'count': self.items.count(),
                'hours': float(self.total_hours) if self.total_hours else 0.0,
                'amount': float(self.total_amount) if self.total_amount else 0.0
            }
        }

INVOICE_ITEM_TYPE_CHOICES = (
    ('shift', 'Shift Work'),
    ('overtime_1', 'Overtime tier 1 (1.5x)'),
    ('overtime_2', 'Overtime tier 2 (2x)'),
    ('bank_holiday', 'Bank Holiday Pay'),
    ('annual_leave', 'Annual Leave Pay'),
    ('special', 'Special Event'),
)

# Item types that consume a shift FK (allows splitting one shift into base/OT items)
SHIFT_BACKED_ITEM_TYPES = ('shift', 'overtime_1', 'overtime_2')


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')

    # Item type to differentiate between shifts and leave items
    item_type = models.CharField(
        max_length=20,
        choices=INVOICE_ITEM_TYPE_CHOICES,
        default='shift',
        help_text="Type of invoice item"
    )

    # Shift reference (required for shift items, null for leave items)
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name='invoice_items',
        null=True,
        blank=True,
        help_text="Shift for shift items (null for leave items)"
    )

    # Leave references (for leave items)
    leave_request = models.ForeignKey(
        'leave_management.LeaveRequest',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='invoice_items',
        help_text="Leave request for annual leave items"
    )
    bank_holiday = models.ForeignKey(
        'BankHoliday',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='invoice_items',
        help_text="Bank holiday for bank holiday pay items"
    )

    # Common fields
    date = models.DateField()
    venue = models.ForeignKey(
        Venue,
        on_delete=models.CASCADE,
        related_name='invoice_items',
        null=True,
        blank=True,
        help_text="Venue for shift items (null for leave items)"
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        help_text="Description for the line item (e.g., 'Bank Holiday: Christmas Day')"
    )
    hours_worked = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Hours worked for shift items (null for leave items)"
    )
    days = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Days for leave items (e.g., 1 for full day, 0.5 for half day)"
    )
    rate = models.DecimalField(max_digits=10, decimal_places=2, help_text="Hourly rate for shifts or daily rate for leave")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invoice_items'
        ordering = ['date', 'item_type']
        constraints = [
            # A given (invoice, shift) pair can have at most one row of each type
            # (shift|overtime_1|overtime_2). One shift may produce multiple line
            # items when its hours are split across overtime tiers.
            models.UniqueConstraint(
                fields=['invoice', 'shift', 'item_type'],
                name='unique_shift_invoice_item_type',
                condition=models.Q(shift__isnull=False),
                violation_error_message="This shift has already been added to this invoice for this item type."
            ),
            # Bank holiday uniqueness per invoice
            models.UniqueConstraint(
                fields=['invoice', 'bank_holiday'],
                name='unique_bank_holiday_per_invoice',
                condition=models.Q(bank_holiday__isnull=False),
                violation_error_message="This bank holiday has already been added to this invoice."
            ),
            # Leave request uniqueness per invoice and date
            models.UniqueConstraint(
                fields=['invoice', 'leave_request', 'date'],
                name='unique_leave_request_date_per_invoice',
                condition=models.Q(leave_request__isnull=False),
                violation_error_message="This leave day has already been added to this invoice."
            ),
        ]

    def __str__(self):
        if self.item_type in SHIFT_BACKED_ITEM_TYPES and self.venue:
            return f"{self.date} - {self.venue.name} ({self.hours_worked} hours, {self.item_type})"
        elif self.item_type == 'bank_holiday':
            return f"{self.date} - Bank Holiday: {self.description or 'Holiday'} ({self.days} day)"
        elif self.item_type == 'annual_leave':
            return f"{self.date} - Annual Leave ({self.days} day)"
        elif self.item_type == 'special':
            return f"{self.date} - Special: {self.description or 'Event'}"
        return f"{self.date} - {self.description or self.item_type}"

    def clean(self):
        """Validate the invoice item based on its type"""
        from django.core.exceptions import ValidationError
        errors = {}

        if self.item_type in SHIFT_BACKED_ITEM_TYPES:
            if not self.shift:
                errors['shift'] = f'Shift is required for {self.item_type} items'
            if not self.venue:
                errors['venue'] = f'Venue is required for {self.item_type} items'
            if self.hours_worked is None:
                errors['hours_worked'] = f'Hours worked is required for {self.item_type} items'
        elif self.item_type == 'bank_holiday':
            if not self.bank_holiday:
                errors['bank_holiday'] = 'Bank holiday is required for bank holiday items'
            if self.days is None:
                errors['days'] = 'Days is required for leave items'
        elif self.item_type == 'annual_leave':
            if not self.leave_request:
                errors['leave_request'] = 'Leave request is required for annual leave items'
            if self.days is None:
                errors['days'] = 'Days is required for leave items'
        elif self.item_type == 'special':
            # Special items may be free-form admin entries; only require hours
            if self.hours_worked is None:
                errors['hours_worked'] = 'Hours worked is required for special items'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

class PayRate(models.Model):
    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pay_rates')
    venue = models.ForeignKey(Venue, on_delete=models.SET_NULL, null=True, blank=True, related_name='pay_rates', help_text="null for default rate")
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pay_rates'
        ordering = ['-created_at']
        unique_together = ['staff_user', 'venue']

    def __str__(self):
        venue_name = self.venue.name if self.venue else 'Default'
        return f"{self.staff_user.username} - {venue_name} (£{self.hourly_rate})"

class DeputyConfig(models.Model):
    api_endpoint = models.URLField(max_length=500)
    api_key = models.CharField(max_length=500, help_text="encrypted")  # Will be encrypted
    is_active = models.BooleanField(default=True)
    last_sync_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deputy_config'
        ordering = ['-created_at']

    def __str__(self):
        return f"Deputy Config ({self.api_endpoint})"

class DeputyEmployee(models.Model):
    deputy_id = models.CharField(max_length=100, unique=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    mapped_to_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deputy_employee')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deputy_employees'
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name} (Deputy ID: {self.deputy_id})"

class DeputyTimesheet(models.Model):
    deputy_id = models.CharField(max_length=100, unique=True)
    employee = models.ForeignKey(DeputyEmployee, on_delete=models.CASCADE, related_name='timesheets')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    break_length = models.IntegerField(help_text="Break length in minutes")
    status = models.CharField(max_length=50)
    comments = models.TextField(null=True, blank=True)
    mapped_to_shift = models.OneToOneField(Shift, on_delete=models.SET_NULL, null=True, blank=True, related_name='deputy_timesheet')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deputy_timesheets'
        ordering = ['-start_time']

    def __str__(self):
        return f"{self.employee.first_name} {self.employee.last_name} - {self.start_time}"

class LatenessRecord(models.Model):
    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lateness_records')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='lateness_records')
    minutes_late = models.IntegerField()
    reason = models.TextField(null=True, blank=True)
    acknowledged = models.BooleanField(default=False)
    acknowledgement_date = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_lateness_records')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lateness_records'
        indexes = [
            models.Index(fields=['staff_user', 'created_at']),
            models.Index(fields=['shift', 'created_at']),
        ]

    def __str__(self):
        return f"{self.staff_user.username} - {self.minutes_late} minutes late on {self.shift.start_time}"

    @classmethod
    def get_monthly_late_count(cls, staff_user, month=None, year=None):
        """Get count of late instances for a staff member in a given month"""
        if month is None:
            month = timezone.now().month
        if year is None:
            year = timezone.now().year
            
        return cls.objects.filter(
            staff_user=staff_user,
            minutes_late__gte=20,
            created_at__year=year,
            created_at__month=month
        ).count()

class IncidentReport(models.Model):
    SEVERITY_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    )
    
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='incident_reports')
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reported_incidents')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='incident_reports')
    incident_time = models.DateTimeField()
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS)
    actions_taken = models.TextField()
    requires_followup = models.BooleanField(default=False)
    followup_notes = models.TextField(null=True, blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_incidents')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'incident_reports'
        ordering = ['-incident_time']
        indexes = [
            models.Index(fields=['venue', 'incident_time']),
            models.Index(fields=['severity', 'resolved']),
        ]

    def __str__(self):
        return f"{self.get_severity_display()} incident at {self.venue.name} on {self.incident_time}"

class CapacityFlow(models.Model):
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='capacity_flows')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='capacity_flows')
    timestamp = models.DateTimeField(auto_now_add=True)
    entry_count = models.IntegerField(default=0)
    exit_count = models.IntegerField(default=0)
    current_total = models.IntegerField()
    recorded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recorded_capacity_flows')
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'capacity_flows'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['venue', 'timestamp']),
            models.Index(fields=['shift', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.venue.name} - Current Total: {self.current_total} at {self.timestamp}"

    def save(self, *args, **kwargs):
        # Calculate current total if not provided
        if self.current_total is None:
            previous = CapacityFlow.objects.filter(venue=self.venue).order_by('-timestamp').first()
            previous_total = previous.current_total if previous else 0
            self.current_total = previous_total + self.entry_count - self.exit_count
        super().save(*args, **kwargs)

class VenueHandover(models.Model):
    outgoing_shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='outgoing_handovers')
    incoming_shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='incoming_handovers')
    notes = models.TextField()
    issues_flagged = models.BooleanField(default=False)
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_handovers')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_handovers')

    class Meta:
        db_table = 'venue_handovers'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['outgoing_shift', 'created_at']),
            models.Index(fields=['incoming_shift', 'acknowledged']),
        ]

    def __str__(self):
        return f"Handover between shifts {self.outgoing_shift.id} and {self.incoming_shift.id}"

class QualificationReminder(models.Model):
    REMINDER_TYPE = (
        ('sia', 'SIA License'),
        ('first_aid', 'First Aid'),
        ('security_qual', 'Security Qualification')
    )
    
    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='qualification_reminders')
    qualification_type = models.CharField(max_length=20, choices=REMINDER_TYPE)
    expiry_date = models.DateField()
    reminder_sent = models.BooleanField(default=False)
    reminder_date = models.DateField()
    reminder_acknowledged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'qualification_reminders'
        ordering = ['expiry_date']
        indexes = [
            models.Index(fields=['staff_user', 'expiry_date']),
            models.Index(fields=['reminder_date', 'reminder_sent']),
        ]

    def __str__(self):
        return f"{self.staff_user.username} - {self.get_qualification_type_display()} expires on {self.expiry_date}"

class SystemSettings(models.Model):
    # Company relationship for multi-tenancy
    company = models.OneToOneField(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='settings',
        null=True,  # Temporary for migration - will be changed to NOT NULL after migration
        help_text="Company that owns these settings"
    )
    company_name = models.CharField(max_length=255, default="Mead Security")
    support_email = models.EmailField(max_length=255, default="support@meadsecurity.co.uk")
    support_phone = models.CharField(max_length=50, default="+44 1234 567890")
    default_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=15.50, help_text="Default rate for regular shifts")
    special_event_pay_rate = models.DecimalField(max_digits=10, decimal_places=2, default=18.00, help_text="Default rate for special event shifts")
    default_payment_terms = models.CharField(max_length=100, default="Net 30")
    invoice_prefix = models.CharField(max_length=10, default="MSD-")
    automatic_invoicing = models.BooleanField(default=True)
    
    # Notification settings
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=True)
    shift_reminders = models.BooleanField(default=True)
    invoice_reminders = models.BooleanField(default=True)
    report_generation = models.BooleanField(default=False)
    
    # Security settings
    require_signatures = models.BooleanField(default=True)
    require_manager_approval = models.BooleanField(default=True)
    require_shift_photos = models.BooleanField(default=False)
    session_timeout = models.IntegerField(default=30) # In minutes
    allow_shift_exchange = models.BooleanField(default=True)
    auto_approve_shift_exchanges = models.BooleanField(
        default=True,
        help_text="Automatically approve shift exchanges when no conflicts exist"
    )
    
    # Auto-checkout settings
    auto_checkout_grace_period = models.IntegerField(default=30, help_text="Minutes after scheduled end time before auto-checkout is allowed")
    auto_checkout_force_timeout = models.IntegerField(default=720, help_text="Minutes after scheduled end time for force timeout (bypassing venue checks)")
    auto_checkout_enabled = models.BooleanField(default=True, help_text="Enable automatic checkout system")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name = 'System Settings'
        verbose_name_plural = 'System Settings'
    
    def __str__(self):
        return f"System Settings"
    
    @classmethod
    def get_settings(cls, company=None):
        """Get the system settings for a company or create default if none exist"""
        if not company:
            # Fallback to singleton behavior for backward compatibility
            try:
                settings = cls.objects.get(pk=1)
                return settings
            except cls.DoesNotExist:
                # Create new singleton if it doesn't exist
                settings = cls.objects.create(
                    pk=1,
                    special_event_pay_rate=18.00
                )
                return settings

        # Use the OneToOne relationship to get settings for the specific company
        try:
            return company.settings
        except cls.DoesNotExist:
            # Create settings for the company
            settings = cls.objects.create(
                company=company,
                company_name=company.name,
                support_email=f'support@{company.name.lower().replace(" ", "")}.com',
                support_phone='+44 1234 567890',
                default_hourly_rate=15.50,
                special_event_pay_rate=18.00,
                default_payment_terms='Net 30',
                invoice_prefix=f'{company.name[:3].upper()}-',
                automatic_invoicing=True,
                email_notifications=True,
                sms_notifications=True,
                shift_reminders=True,
                invoice_reminders=True,
                report_generation=False,
                require_signatures=True,
                require_manager_approval=True,
                require_shift_photos=False,
                session_timeout=30,
                allow_shift_exchange=True,
                auto_checkout_grace_period=30,
                auto_checkout_force_timeout=720,
                auto_checkout_enabled=True
            )
            return settings


EMPLOYMENT_CATEGORY_CHOICES = (
    ('permanent', 'Permanent Employee'),
    ('contractor', 'Contractor'),
    ('temporary', 'Temporary Staff'),
)


class EmploymentType(models.Model):
    # Company relationship for multi-tenancy
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='employment_types',
        null=True,  # Temporary for migration - will be changed to NOT NULL after migration
        help_text="Company that owns this employment type"
    )
    name = models.CharField(max_length=100, help_text="Employment type name (e.g., 'Contract Workers', 'Temporary Staff')")
    description = models.TextField(help_text="Description of this employment type")
    employment_category = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_CATEGORY_CHOICES,
        default='contractor',
        help_text="Category determining leave/availability behavior: permanent gets paid leave, contractors mark availability"
    )
    is_active = models.BooleanField(default=True, help_text="Whether this employment type is currently available")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employment_types'
        ordering = ['name']
        # Names should be unique per company, not globally
        unique_together = [['company', 'name']]

    def __str__(self):
        return self.name


class ContractorUnavailability(models.Model):
    """
    Tracks periods when contractors mark themselves as unavailable.
    No approval needed - purely informational for scheduling.
    Hard blocks shift assignment during these periods.
    """
    staff_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='unavailability_periods',
        help_text="Contractor who is marking unavailability"
    )
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='contractor_unavailability',
        help_text="Company this record belongs to"
    )
    start_date = models.DateField(help_text="First day of unavailability")
    end_date = models.DateField(help_text="Last day of unavailability")
    reason = models.TextField(blank=True, help_text="Optional reason for unavailability")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contractor_unavailability'
        ordering = ['-start_date']
        verbose_name = 'Contractor Unavailability'
        verbose_name_plural = 'Contractor Unavailability Periods'
        indexes = [
            models.Index(fields=['staff_user', 'start_date', 'end_date']),
            models.Index(fields=['company', 'start_date']),
        ]

    def __str__(self):
        return f"{self.staff_user.username}: {self.start_date} to {self.end_date}"

    def clean(self):
        """Validate the unavailability period"""
        from django.core.exceptions import ValidationError
        errors = {}

        # Validate date range
        if self.end_date < self.start_date:
            errors['end_date'] = 'End date must be on or after start date'

        # Check for overlapping periods (excluding self for updates)
        overlapping = ContractorUnavailability.objects.filter(
            staff_user=self.staff_user,
            start_date__lte=self.end_date,
            end_date__gte=self.start_date
        )
        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)

        if overlapping.exists():
            errors['start_date'] = 'This period overlaps with an existing unavailability period'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @classmethod
    def is_user_available(cls, user, date):
        """Check if a user is available on a specific date"""
        return not cls.objects.filter(
            staff_user=user,
            start_date__lte=date,
            end_date__gte=date
        ).exists()

    @classmethod
    def get_unavailable_dates_in_range(cls, user, start_date, end_date):
        """Get all unavailable dates for a user in a date range"""
        from datetime import timedelta

        periods = cls.objects.filter(
            staff_user=user,
            start_date__lte=end_date,
            end_date__gte=start_date
        )

        unavailable_dates = set()
        for period in periods:
            current_date = max(period.start_date, start_date)
            end = min(period.end_date, end_date)
            while current_date <= end:
                unavailable_dates.add(current_date)
                current_date += timedelta(days=1)

        return sorted(unavailable_dates)


class BankHoliday(models.Model):
    """
    Bank holidays for a company. Permanent employees get paid for these.
    Admin can manage custom holidays or use UK defaults.
    """
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='bank_holidays',
        help_text="Company this holiday belongs to"
    )
    name = models.CharField(max_length=100, help_text="Holiday name (e.g., 'Christmas Day')")
    date = models.DateField(help_text="Date of the holiday")
    is_active = models.BooleanField(default=True, help_text="Whether this holiday is active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bank_holidays'
        ordering = ['date']
        verbose_name = 'Bank Holiday'
        verbose_name_plural = 'Bank Holidays'
        unique_together = [['company', 'date']]
        indexes = [
            models.Index(fields=['company', 'date', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.date})"

    @classmethod
    def populate_uk_defaults(cls, company, year=None):
        """
        Pre-populate UK bank holidays for a company.
        If year is None, populates for current year.
        """
        from datetime import date
        import calendar

        if year is None:
            year = date.today().year

        # Calculate UK bank holidays for the given year
        holidays = []

        # New Year's Day (Jan 1, or substitute if weekend)
        new_years = date(year, 1, 1)
        if new_years.weekday() == 5:  # Saturday
            new_years = date(year, 1, 3)
        elif new_years.weekday() == 6:  # Sunday
            new_years = date(year, 1, 2)
        holidays.append(('New Year\'s Day', new_years))

        # Good Friday (varies - need Easter calculation)
        # Using anonymous algorithm for Easter
        a = year % 19
        b = year // 100
        c = year % 100
        d = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1
        easter = date(year, month, day)
        good_friday = easter - timedelta(days=2)
        holidays.append(('Good Friday', good_friday))

        # Easter Monday
        easter_monday = easter + timedelta(days=1)
        holidays.append(('Easter Monday', easter_monday))

        # Early May Bank Holiday (first Monday of May)
        may_first = date(year, 5, 1)
        days_until_monday = (7 - may_first.weekday()) % 7
        early_may = may_first + timedelta(days=days_until_monday)
        holidays.append(('Early May Bank Holiday', early_may))

        # Spring Bank Holiday (last Monday of May)
        may_last = date(year, 5, 31)
        days_since_monday = may_last.weekday()
        if days_since_monday == 0:
            spring_bank = may_last
        else:
            spring_bank = may_last - timedelta(days=days_since_monday)
        holidays.append(('Spring Bank Holiday', spring_bank))

        # Summer Bank Holiday (last Monday of August)
        aug_last = date(year, 8, 31)
        days_since_monday = aug_last.weekday()
        if days_since_monday == 0:
            summer_bank = aug_last
        else:
            summer_bank = aug_last - timedelta(days=days_since_monday)
        holidays.append(('Summer Bank Holiday', summer_bank))

        # Christmas Day (Dec 25, or substitute if weekend)
        christmas = date(year, 12, 25)
        if christmas.weekday() == 5:  # Saturday
            christmas = date(year, 12, 27)
        elif christmas.weekday() == 6:  # Sunday
            christmas = date(year, 12, 27)
        holidays.append(('Christmas Day', christmas))

        # Boxing Day (Dec 26, or substitute if weekend)
        boxing_day = date(year, 12, 26)
        if boxing_day.weekday() == 5:  # Saturday
            boxing_day = date(year, 12, 28)
        elif boxing_day.weekday() == 6:  # Sunday
            boxing_day = date(year, 12, 28)
        holidays.append(('Boxing Day', boxing_day))

        created_holidays = []
        for name, holiday_date in holidays:
            holiday, created = cls.objects.get_or_create(
                company=company,
                date=holiday_date,
                defaults={'name': name, 'is_active': True}
            )
            if created:
                created_holidays.append(holiday)

        return created_holidays

    @classmethod
    def get_holidays_in_range(cls, company, start_date, end_date):
        """Get all active bank holidays for a company in a date range"""
        return cls.objects.filter(
            company=company,
            date__gte=start_date,
            date__lte=end_date,
            is_active=True
        )


class StaffLeaveDailyRate(models.Model):
    """
    Daily rate for calculating paid leave on invoices.
    Admin manually sets this per employee.
    """
    staff_user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='leave_daily_rate',
        help_text="Staff member this rate applies to"
    )
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='staff_leave_rates',
        help_text="Company this rate belongs to"
    )
    daily_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Daily rate for paid leave calculation"
    )
    effective_from = models.DateField(help_text="Date from which this rate is effective")
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_leave_rates',
        help_text="Admin who last updated this rate"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_leave_daily_rates'
        verbose_name = 'Staff Leave Daily Rate'
        verbose_name_plural = 'Staff Leave Daily Rates'
        indexes = [
            models.Index(fields=['company', 'staff_user']),
        ]

    def __str__(self):
        return f"{self.staff_user.username}: £{self.daily_rate}/day"


class RecruitmentApplication(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    
    LICENCE_TYPE_CHOICES = (
        ('door_supervisor', 'Door Supervisor'),
        ('security_guard', 'Security Guard'),
        ('cctv', 'CCTV'),
        ('close_protection', 'Close Protection'),
    )
    
    CERTIFICATION_CHOICES = (
        ('first_aid', 'First Aid'),
        ('fire_marshal', 'Fire Marshal'),
        ('conflict_management', 'Conflict Management'),
        ('customer_service', 'Customer Service Training'),
        ('other', 'Other'),
    )
    
    # Personal Details
    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField()
    # Email is db-indexed but NOT unique. Re-applications are allowed once a
    # previous application is closed (rejected, or converted to a user who's
    # since been deactivated). Outstanding-match enforcement lives on the
    # serializer's validate_email — see RecruitmentApplicationSerializer.
    email = models.EmailField(db_index=True)
    phone_number = models.CharField(max_length=20)
    home_address = models.TextField()
    postcode = models.CharField(max_length=20)
    
    # SIA Licence Details
    has_sia_licence = models.BooleanField(default=False)
    sia_licence_number = models.CharField(max_length=50, null=True, blank=True)
    licence_types = models.JSONField(default=list, help_text="List of licence types held")
    licence_expiry_date = models.DateField(null=True, blank=True)
    licence_suspended_revoked = models.BooleanField(default=False)
    licence_suspension_details = models.TextField(null=True, blank=True)
    
    # Employment Preferences
    employment_type = models.ForeignKey(EmploymentType, on_delete=models.CASCADE, related_name='applications')
    hours_per_week = models.IntegerField(validators=[MinValueValidator(0)])
    availability_days = models.BooleanField(default=False)
    availability_nights = models.BooleanField(default=False)
    availability_weekends = models.BooleanField(default=False)
    availability_holidays = models.BooleanField(default=False)
    willing_to_travel = models.BooleanField(default=False)
    has_transport = models.BooleanField(default=False)
    has_commitments = models.BooleanField(default=False)
    commitments_details = models.TextField(null=True, blank=True)
    
    # Experience and Skills
    has_security_experience = models.BooleanField(default=False)
    security_experience_details = models.TextField(null=True, blank=True)
    certifications = models.JSONField(default=list, help_text="List of certifications held")
    other_certification_details = models.TextField(null=True, blank=True)
    
    # Additional Information
    eligible_to_work_uk = models.BooleanField(default=False)
    has_criminal_convictions = models.BooleanField(default=False)
    criminal_convictions_details = models.TextField(null=True, blank=True)
    
    # Application Details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    digital_signature = models.TextField(help_text="base64 encoded signature")
    application_date = models.DateTimeField(auto_now_add=True)
    
    # Admin fields
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_applications')
    admin_notes = models.TextField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Conversion to user (if approved)
    converted_to_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recruitment_application')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruitment_applications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} - {self.get_status_display()}"
    
    def approve(self, admin_user, notes=None):
        """Approve the application and optionally convert to user"""
        self.status = 'approved'
        self.reviewed_by = admin_user
        self.reviewed_at = timezone.now()
        if notes:
            self.admin_notes = notes
        self.save()
    
    def reject(self, admin_user, notes=None):
        """Reject the application"""
        self.status = 'rejected'
        self.reviewed_by = admin_user
        self.reviewed_at = timezone.now()
        if notes:
            self.admin_notes = notes
        self.save()
    
    def convert_to_user(self, admin_user):
        """Convert approved application to a User and StaffProfile with proper multi-tenant relationships"""
        # Validation checks
        if self.status != 'approved':
            raise ValueError("Only approved applications can be converted to users")

        if self.converted_to_user:
            raise ValueError("Application has already been converted to a user")

        # Get company from employment type with validation
        if not self.employment_type:
            raise ValueError("Application has no employment type assigned")

        company = self.employment_type.company
        if not company or not company.is_active:
            raise ValueError("Employment type has no active company associated")

        # Generate unique username
        base_username = self.email.split('@')[0].lower()
        username = base_username
        counter = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        # Check for email conflicts
        if User.objects.filter(email=self.email).exists():
            raise ValueError(f"A user with email {self.email} already exists")

        try:
            with transaction.atomic():
                # Create user
                user = User.objects.create_user(
                    username=username,
                    email=self.email,
                    first_name=self.full_name.split()[0] if self.full_name else '',
                    last_name=' '.join(self.full_name.split()[1:]) if len(self.full_name.split()) > 1 else '',
                    role='staff'
                )

                # Create staff profile with employment type
                staff_profile = StaffProfile.objects.create(
                    user=user,
                    employment_type=self.employment_type,  # FIX: Added employment type
                    phone_number=self.phone_number,
                    date_of_birth=self.date_of_birth,
                    national_insurance_number=None,  # Will be filled during onboarding
                    street=self.home_address,
                    city='',  # Will need to be filled later
                    postal_code=self.postcode,
                    country='UK',
                    is_approved=True  # Pre-approved since application was approved
                )

                # FIX: Create UserCompanyMembership for multi-tenant access
                UserCompanyMembership.objects.create(
                    user=user,
                    company=company,
                    role='staff',
                    is_owner=False,
                    is_active=True,
                    invited_by=admin_user,
                    invitation_status='accepted',
                    joined_at=timezone.now()
                )

                # Create SIA License if applicable (with duplicate handling)
                if self.has_sia_licence and self.sia_licence_number:
                    licence_type_mapping = {
                        'door_supervisor': 'ds',
                        'security_guard': 'sg',
                        'cctv': 'cctv',
                        'close_protection': 'cp',
                        'dog_handler': 'k9',
                        'vehicle_security': 'vs',
                        'key_holding': 'key'
                    }

                    for licence_type in self.licence_types:
                        short_licence_type = licence_type_mapping.get(licence_type, licence_type)

                        # Check if a license with this number already exists
                        existing_license = SIALicense.objects.filter(
                            license_number=self.sia_licence_number
                        ).first()

                        if existing_license:
                            # Skip creating the license if it already exists (SIA licenses are government-issued and unique)
                            logger.info(
                                f"SIA license number {self.sia_licence_number} already exists. "
                                f"Skipping license creation for user {user.email} from recruitment application {self.id}"
                            )
                            continue  # Skip to next license type

                        try:
                            SIALicense.objects.create(
                                staff_profile=staff_profile,
                                license_number=self.sia_licence_number,
                                license_type=short_licence_type,
                                issue_date=timezone.now().date(),
                                expiry_date=self.licence_expiry_date,
                                status='valid',
                                document_url=''
                            )
                            logger.info(
                                f"Created SIA license {self.sia_licence_number} ({short_licence_type}) "
                                f"for user {user.email} from recruitment application {self.id}"
                            )
                        except Exception as license_error:
                            logger.error(
                                f"Failed to create SIA license for recruitment application {self.id}: "
                                f"{str(license_error)}. Skipping this license type: {short_licence_type}"
                            )
                            # Continue with other license types rather than failing the entire conversion

                # Create qualifications (existing logic)
                for cert in self.certifications:
                    if cert and cert != 'other':
                        SecurityQualification.objects.create(
                            staff_profile=staff_profile,
                            qualification_type=cert,
                            provider='Unknown',
                            certificate_number='',
                            issue_date=timezone.now().date(),
                            document_url=''
                        )

                # Link the converted user
                self.converted_to_user = user
                self.save()

                return user

        except Exception as e:
            # Transaction will automatically rollback
            logger.error(f"Failed to convert recruitment application {self.id} to user: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to convert application to user: {str(e)}")


class EnforcementVisit(models.Model):
    """Model to track enforcement visits during shifts"""
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='enforcement_visits')
    timestamp = models.DateTimeField(auto_now_add=True)
    officer_name = models.CharField(max_length=100, help_text="Name of the visiting officer")
    officer_badge = models.CharField(max_length=50, help_text="Badge/ID number of the officer")
    reason_for_visit = models.TextField(help_text="Reason for the enforcement visit")
    action_taken = models.TextField(help_text="Actions taken during the visit")
    outcome = models.TextField(help_text="Outcome of the visit")

    class Meta:
        db_table = 'enforcement_visits'
        ordering = ['-timestamp']

    def __str__(self):
        return f"Enforcement Visit - {self.officer_name} at {self.shift.venue.name} ({self.timestamp})"


# =============================================================================
# LEGAL COMPLIANCE AND WORKING HOURS REGULATION MODELS
# =============================================================================

class WorkingHoursRegulationManager(models.Manager):
    """Manager for WorkingHoursRegulation model with useful query methods"""

    def by_country(self, country_code):
        """Get regulation for specific country"""
        return self.get_queryset().filter(country_code__iexact=country_code).first()

    def active_regulations(self):
        """Get all active regulations"""
        return self.get_queryset().filter(is_active=True)

    def with_overtime_rules(self):
        """Get regulations that have overtime rules defined"""
        return self.get_queryset().filter(overtime_threshold_hours__isnull=False)


class WorkingHoursRegulation(models.Model):
    """
    Model defining country/region-specific labor regulations and working hours rules.
    This serves as the foundation for compliance checking across different jurisdictions.
    """

    # Country identification
    country_code = models.CharField(
        max_length=3,
        unique=True,
        help_text="ISO 3166-1 alpha-2 country code (e.g., 'GB', 'US', 'FR')"
    )
    country_name = models.CharField(
        max_length=100,
        help_text="Full country name for display purposes"
    )

    # Standard working hours
    standard_weekly_hours = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Standard weekly working hours (e.g., 40.0 for UK/US, 35.0 for France)"
    )
    standard_daily_hours = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=8.0,
        validators=[MinValueValidator(0), MaxValueValidator(24)],
        help_text="Standard daily working hours"
    )

    # Overtime rules
    overtime_threshold_hours = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Weekly hours threshold before overtime applies"
    )
    overtime_multiplier_1 = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=1.5,
        validators=[MinValueValidator(1.0), MaxValueValidator(5.0)],
        help_text="First overtime rate multiplier (e.g., 1.5 for time-and-a-half)"
    )
    overtime_threshold_2 = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Second overtime threshold for higher rates (optional)"
    )
    overtime_multiplier_2 = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(1.0), MaxValueValidator(5.0)],
        help_text="Second overtime rate multiplier (e.g., 2.0 for double time)"
    )

    # Maximum limits
    max_daily_hours = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        validators=[MinValueValidator(1), MaxValueValidator(24)],
        help_text="Maximum allowed daily working hours"
    )
    max_weekly_hours = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        validators=[MinValueValidator(1), MaxValueValidator(168)],
        help_text="Maximum allowed weekly working hours"
    )
    max_consecutive_days = models.PositiveIntegerField(
        default=6,
        validators=[MinValueValidator(1), MaxValueValidator(14)],
        help_text="Maximum consecutive working days allowed"
    )

    # Rest period requirements
    min_rest_between_shifts_hours = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=11.0,
        validators=[MinValueValidator(0), MaxValueValidator(24)],
        help_text="Minimum rest hours required between shifts"
    )
    min_weekly_rest_hours = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=24.0,
        validators=[MinValueValidator(0), MaxValueValidator(168)],
        help_text="Minimum weekly continuous rest period"
    )

    # Break requirements
    break_duration_minutes = models.PositiveIntegerField(
        default=30,
        validators=[MaxValueValidator(480)],
        help_text="Required break duration in minutes for standard shifts"
    )
    break_trigger_hours = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=6.0,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text="Shift length that triggers break requirement"
    )

    # Flexible rules
    special_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional country-specific rules as JSON (e.g., night shift premiums, holiday rules)"
    )

    # Security industry specific overrides
    security_sector_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="Security industry specific rules and requirements (SIA licensing, specialized training, etc.)"
    )

    # Break requirements by region and shift duration
    break_requirements = models.JSONField(
        default=dict,
        blank=True,
        help_text="Break requirements mapped by shift duration (e.g., {'6_hours': {'duration_minutes': 20, 'paid': True}})"
    )

    # Night shift specific rules
    night_shift_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Night work specific limitations and requirements (max hours, health assessments, etc.)"
    )

    # Opt-out provisions for UK/EU
    opt_out_provisions = models.JSONField(
        default=dict,
        blank=True,
        help_text="Working time directive opt-out rules and requirements (written agreements, notice periods, etc.)"
    )

    # US state-level overrides
    state_overrides = models.JSONField(
        default=dict,
        blank=True,
        help_text="US state-specific labor law overrides and additional requirements"
    )

    # Enhanced metadata
    last_regulatory_update = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp of last update to regulatory data"
    )
    regulatory_source = models.CharField(
        max_length=255,
        blank=True,
        help_text="Source of regulatory information (e.g., 'UK Health and Safety Executive', 'FLSA')"
    )
    industry_specific_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional industry-specific compliance rules beyond general labor law"
    )

    # Status and metadata
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this regulation is currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkingHoursRegulationManager()

    class Meta:
        db_table = 'working_hours_regulations'
        ordering = ['country_name']
        verbose_name = 'Working Hours Regulation'
        verbose_name_plural = 'Working Hours Regulations'

    def __str__(self):
        return f"{self.country_name} ({self.country_code}) - {self.standard_weekly_hours}h/week"

    def get_overtime_rate(self, weekly_hours):
        """Calculate overtime multiplier based on hours worked"""
        if not self.overtime_threshold_hours or weekly_hours <= self.overtime_threshold_hours:
            return 1.0

        if (self.overtime_threshold_2 and weekly_hours > self.overtime_threshold_2):
            return float(self.overtime_multiplier_2 or self.overtime_multiplier_1)

        return float(self.overtime_multiplier_1)

    def validate_daily_hours(self, hours):
        """Check if daily hours comply with regulations"""
        return hours <= self.max_daily_hours

    def validate_weekly_hours(self, hours):
        """Check if weekly hours comply with regulations"""
        return hours <= self.max_weekly_hours

    def get_effective_rules_for_security(self, venue_location=None):
        """
        Get effective rules considering security industry overrides.

        Args:
            venue_location (str, optional): Specific location for state-level overrides (US)

        Returns:
            dict: Combined rules with security industry considerations
        """
        base_rules = {
            'standard_weekly_hours': float(self.standard_weekly_hours),
            'standard_daily_hours': float(self.standard_daily_hours),
            'max_daily_hours': float(self.max_daily_hours),
            'max_weekly_hours': float(self.max_weekly_hours),
            'max_consecutive_days': self.max_consecutive_days,
            'min_rest_between_shifts_hours': float(self.min_rest_between_shifts_hours),
            'min_weekly_rest_hours': float(self.min_weekly_rest_hours),
            'break_duration_minutes': self.break_duration_minutes,
            'break_trigger_hours': float(self.break_trigger_hours),
        }

        # Apply security sector overrides
        if self.security_sector_overrides:
            base_rules.update(self.security_sector_overrides)

        # Apply US state-level overrides if venue location provided
        if venue_location and self.country_code == 'US' and self.state_overrides:
            state_rules = self.state_overrides.get(venue_location.upper(), {})
            base_rules.update(state_rules)

        # Apply industry-specific rules
        if self.industry_specific_rules:
            base_rules.update(self.industry_specific_rules)

        return base_rules

    def supports_opt_out(self):
        """
        Check if this regulation supports opt-out agreements.
        Primarily for UK/EU Working Time Directive opt-outs.

        Returns:
            bool: True if opt-out is supported
        """
        if not self.opt_out_provisions:
            return False

        return self.opt_out_provisions.get('allowed', False)

    def get_break_requirements(self, shift_hours):
        """
        Get break requirements for given shift duration.

        Args:
            shift_hours (float): Duration of shift in hours

        Returns:
            dict: Break requirements or None if no break required
        """
        if not self.break_requirements:
            # Fallback to default break rules
            if shift_hours >= float(self.break_trigger_hours):
                return {
                    'duration_minutes': self.break_duration_minutes,
                    'paid': True,
                    'mandatory': True
                }
            return None

        # Check configured break requirements - find the highest applicable threshold
        applicable_breaks = []
        for hours_key, break_rule in self.break_requirements.items():
            required_hours = float(hours_key.replace('_hours', ''))
            if shift_hours >= required_hours:
                applicable_breaks.append((required_hours, break_rule))

        if applicable_breaks:
            # Return the break rule for the highest threshold that applies
            applicable_breaks.sort(key=lambda x: x[0], reverse=True)
            return applicable_breaks[0][1]

        return None

    def get_night_work_limits(self):
        """
        Get night work hour limitations and requirements.

        Returns:
            dict: Night work rules and limitations
        """
        default_limits = {
            'max_consecutive_nights': 8,
            'max_night_hours_per_week': 40,
            'health_assessment_required': False,
            'night_start_time': '23:00',
            'night_end_time': '06:00'
        }

        if self.night_shift_rules:
            default_limits.update(self.night_shift_rules)

        return default_limits

    def get_opt_out_requirements(self):
        """
        Get opt-out agreement requirements if supported.

        Returns:
            dict: Opt-out requirements or None if not supported
        """
        if not self.supports_opt_out():
            return None

        return self.opt_out_provisions

    def validate_security_shift(self, shift_data):
        """
        Validate a security shift against all applicable rules.

        Args:
            shift_data (dict): Shift information including duration, type, etc.

        Returns:
            dict: Validation result with status and any violations
        """
        violations = []
        warnings = []

        shift_hours = shift_data.get('duration_hours', 0)
        is_night_shift = shift_data.get('is_night_shift', False)
        venue_location = shift_data.get('venue_location')

        # Get effective rules
        rules = self.get_effective_rules_for_security(venue_location)

        # Validate daily hours
        if shift_hours > rules['max_daily_hours']:
            violations.append(f"Shift exceeds maximum daily hours: {shift_hours}h > {rules['max_daily_hours']}h")

        # Validate night work limits if applicable
        if is_night_shift:
            night_limits = self.get_night_work_limits()
            max_night_hours = night_limits.get('max_night_hours_daily', rules['max_daily_hours'])
            if shift_hours > max_night_hours:
                violations.append(f"Night shift exceeds maximum: {shift_hours}h > {max_night_hours}h")

        # Check security-specific requirements
        if self.security_sector_overrides:
            sia_required = self.security_sector_overrides.get('sia_license_required', False)
            if sia_required and not shift_data.get('staff_has_sia_license', False):
                violations.append("SIA license required for security shifts")

        # Check break requirements
        break_req = self.get_break_requirements(shift_hours)
        if break_req and break_req.get('mandatory', False):
            if not shift_data.get('break_scheduled', False):
                warnings.append(f"Break required: {break_req['duration_minutes']} minutes for {shift_hours}h shift")

        return {
            'valid': len(violations) == 0,
            'violations': violations,
            'warnings': warnings,
            'effective_rules': rules
        }


class ComplianceProfileManager(models.Manager):
    """Manager for ComplianceProfile model"""

    def get_active_profile(self):
        """Get the currently active compliance profile"""
        return self.get_queryset().filter(is_active=True).first()

    def for_regulation(self, regulation):
        """Get profiles using specific regulation"""
        return self.get_queryset().filter(working_hours_regulation=regulation)


class ComplianceProfile(models.Model):
    """
    Organization-specific compliance settings and overrides.
    Allows customization of compliance rules while maintaining regulatory base requirements.
    """

    name = models.CharField(
        max_length=100,
        help_text="Profile name for identification (e.g., 'UK Security Operations')"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of this compliance profile and its intended use"
    )

    # Base regulation
    working_hours_regulation = models.ForeignKey(
        WorkingHoursRegulation,
        on_delete=models.PROTECT,
        related_name='compliance_profiles',
        help_text="Base working hours regulation for this profile"
    )

    # Custom overrides (optional stricter rules)
    override_max_daily_hours = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(24)],
        help_text="Override max daily hours (must be <= regulation max)"
    )
    override_max_weekly_hours = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(168)],
        help_text="Override max weekly hours (must be <= regulation max)"
    )
    override_max_consecutive_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(14)],
        help_text="Override max consecutive days (must be <= regulation max)"
    )

    # Warning thresholds (percentage of limits)
    daily_hours_warning_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=80.00,
        validators=[MinValueValidator(50), MaxValueValidator(99.99)],
        help_text="Percentage of daily limit that triggers warning (e.g., 80.00 for 80%)"
    )
    weekly_hours_warning_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=85.00,
        validators=[MinValueValidator(50), MaxValueValidator(99.99)],
        help_text="Percentage of weekly limit that triggers warning"
    )
    consecutive_days_warning_threshold = models.PositiveIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(13)],
        help_text="Number of consecutive days that triggers warning"
    )

    # Auto-approval settings
    auto_approve_overtime = models.BooleanField(
        default=False,
        help_text="Automatically approve overtime shifts within compliance limits"
    )
    auto_approve_extended_hours = models.BooleanField(
        default=False,
        help_text="Automatically approve extended daily hours within limits"
    )
    require_manager_approval = models.BooleanField(
        default=True,
        help_text="Require manager approval for shifts that may cause violations"
    )

    # Notification settings
    notify_on_warnings = models.BooleanField(
        default=True,
        help_text="Send notifications when warning thresholds are reached"
    )
    notify_on_violations = models.BooleanField(
        default=True,
        help_text="Send notifications when violations occur"
    )
    notification_recipients = models.JSONField(
        default=list,
        blank=True,
        help_text="List of email addresses to receive compliance notifications"
    )

    # Grace periods and flexibility
    grace_period_minutes = models.PositiveIntegerField(
        default=15,
        validators=[MaxValueValidator(120)],
        help_text="Grace period in minutes for minor timing violations"
    )
    allow_break_flexibility = models.BooleanField(
        default=True,
        help_text="Allow flexible break scheduling within shifts"
    )

    # Custom rules and exceptions
    custom_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom compliance rules specific to this organization"
    )
    exception_roles = models.JSONField(
        default=list,
        blank=True,
        help_text="User roles exempt from certain compliance checks"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this profile is currently active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ComplianceProfileManager()

    class Meta:
        db_table = 'compliance_profiles'
        ordering = ['-is_active', 'name']
        verbose_name = 'Compliance Profile'
        verbose_name_plural = 'Compliance Profiles'

    def __str__(self):
        status = "Active" if self.is_active else "Inactive"
        return f"{self.name} ({status}) - {self.working_hours_regulation.country_code}"

    def get_max_daily_hours(self):
        """Get effective max daily hours (override or regulation default)"""
        return self.override_max_daily_hours or self.working_hours_regulation.max_daily_hours

    def get_max_weekly_hours(self):
        """Get effective max weekly hours (override or regulation default)"""
        return self.override_max_weekly_hours or self.working_hours_regulation.max_weekly_hours

    def get_max_consecutive_days(self):
        """Get effective max consecutive days (override or regulation default)"""
        return self.override_max_consecutive_days or self.working_hours_regulation.max_consecutive_days

    def check_daily_hours_warning(self, hours):
        """Check if daily hours trigger warning threshold"""
        max_hours = self.get_max_daily_hours()
        warning_limit = max_hours * (self.daily_hours_warning_threshold / 100)
        return hours >= warning_limit

    def check_weekly_hours_warning(self, hours):
        """Check if weekly hours trigger warning threshold"""
        max_hours = self.get_max_weekly_hours()
        warning_limit = max_hours * (self.weekly_hours_warning_threshold / 100)
        return hours >= warning_limit


class ComplianceViolationManager(models.Manager):
    """Manager for ComplianceViolation model with useful query methods"""

    def active_violations(self):
        """Get all unresolved violations"""
        return self.get_queryset().filter(
            resolution_status__in=['open', 'investigating', 'pending_approval']
        )

    def by_user(self, user):
        """Get violations for specific user"""
        return self.get_queryset().filter(user=user)

    def by_severity(self, severity):
        """Get violations of specific severity"""
        return self.get_queryset().filter(severity=severity)

    def by_type(self, violation_type):
        """Get violations of specific type"""
        return self.get_queryset().filter(violation_type=violation_type)

    def in_date_range(self, start_date, end_date):
        """Get violations within date range"""
        return self.get_queryset().filter(
            period_start__lte=end_date,
            period_end__gte=start_date
        )

    def critical_violations(self):
        """Get critical severity violations"""
        return self.by_severity('critical')

    def recent_violations(self, days=30):
        """Get violations from the last N days"""
        cutoff_date = timezone.now() - timedelta(days=days)
        return self.get_queryset().filter(created_at__gte=cutoff_date)


class ComplianceViolation(models.Model):
    """
    Model to track and log all compliance violations with detailed information
    for audit trails and resolution tracking.
    """

    VIOLATION_TYPE_CHOICES = [
        ('daily_overtime', 'Daily Hours Exceeded'),
        ('weekly_overtime', 'Weekly Hours Exceeded'),
        ('consecutive_days', 'Too Many Consecutive Days'),
        ('insufficient_rest', 'Insufficient Rest Between Shifts'),
        ('missing_break', 'Required Break Not Taken'),
        ('late_checkin', 'Late Check-in'),
        ('early_checkout', 'Early Check-out'),
        ('location_violation', 'Location Compliance Violation'),
        ('unauthorized_overtime', 'Unauthorized Overtime'),
        ('shift_abandonment', 'Shift Abandonment'),
        ('documentation_missing', 'Missing Required Documentation'),
        ('custom', 'Custom Violation Type'),
    ]

    SEVERITY_CHOICES = [
        ('info', 'Informational'),
        ('warning', 'Warning'),
        ('minor', 'Minor Violation'),
        ('major', 'Major Violation'),
        ('critical', 'Critical Violation'),
    ]

    RESOLUTION_STATUS_CHOICES = [
        ('open', 'Open'),
        ('investigating', 'Under Investigation'),
        ('pending_approval', 'Pending Manager Approval'),
        ('approved_exception', 'Approved as Exception'),
        ('resolved', 'Resolved'),
        ('false_positive', 'False Positive'),
        ('dismissed', 'Dismissed'),
    ]

    # Basic violation information
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='compliance_violations',
        help_text="Staff member involved in the violation"
    )
    violation_type = models.CharField(
        max_length=30,
        choices=VIOLATION_TYPE_CHOICES,
        help_text="Type of compliance violation"
    )
    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
        default='warning',
        help_text="Severity level of the violation"
    )

    # Time period and scope
    period_start = models.DateTimeField(
        help_text="Start of the time period when violation occurred"
    )
    period_end = models.DateTimeField(
        help_text="End of the time period when violation occurred"
    )
    shift = models.ForeignKey(
        'Shift',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='compliance_violations',
        help_text="Specific shift related to violation (if applicable)"
    )

    # Violation details
    description = models.TextField(
        help_text="Detailed description of the violation"
    )
    calculated_values = models.JSONField(
        default=dict,
        help_text="Calculated values that triggered the violation (hours, limits, etc.)"
    )
    threshold_exceeded = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Amount by which threshold was exceeded"
    )

    # Context and evidence
    related_shifts = models.ManyToManyField(
        'Shift',
        blank=True,
        related_name='contributing_violations',
        help_text="Other shifts that contributed to this violation"
    )
    evidence_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Supporting evidence and data for the violation"
    )
    system_generated = models.BooleanField(
        default=True,
        help_text="Whether this violation was automatically detected by the system"
    )

    # Resolution tracking
    resolution_status = models.CharField(
        max_length=20,
        choices=RESOLUTION_STATUS_CHOICES,
        default='open',
        help_text="Current status of violation resolution"
    )
    resolution_notes = models.TextField(
        blank=True,
        help_text="Notes about the resolution or investigation"
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_violations',
        help_text="Manager who resolved the violation"
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the violation was resolved"
    )

    # Approval and exceptions
    exception_granted = models.BooleanField(
        default=False,
        help_text="Whether an exception was granted for this violation"
    )
    exception_reason = models.TextField(
        blank=True,
        help_text="Reason for granting exception"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_violations',
        help_text="Manager who approved the exception"
    )

    # Impact assessment
    financial_impact = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Financial impact of the violation (overtime costs, penalties, etc.)"
    )
    compliance_score_impact = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Impact on overall compliance score"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OptimizedComplianceViolationManager()

    class Meta:
        db_table = 'compliance_violations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['violation_type', '-created_at']),
            models.Index(fields=['severity', '-created_at']),
            models.Index(fields=['resolution_status']),
            models.Index(fields=['period_start', 'period_end']),
        ]
        verbose_name = 'Compliance Violation'
        verbose_name_plural = 'Compliance Violations'

    def __str__(self):
        return f"{self.get_violation_type_display()} - {self.user.username} ({self.get_severity_display()})"

    def is_resolved(self):
        """Check if violation is resolved"""
        return self.resolution_status in ['resolved', 'approved_exception', 'false_positive', 'dismissed']

    def duration_hours(self):
        """Calculate duration of violation period in hours"""
        if self.period_start and self.period_end:
            duration = self.period_end - self.period_start
            return duration.total_seconds() / 3600
        return 0

    def resolve(self, resolved_by, resolution_notes='', exception_granted=False, exception_reason=''):
        """Mark violation as resolved"""
        self.resolution_status = 'approved_exception' if exception_granted else 'resolved'
        self.resolved_by = resolved_by
        self.resolved_at = timezone.now()
        self.resolution_notes = resolution_notes
        self.exception_granted = exception_granted
        self.exception_reason = exception_reason
        if exception_granted:
            self.approved_by = resolved_by
        self.save()

    def dismiss(self, dismissed_by, reason=''):
        """Dismiss violation as false positive"""
        self.resolution_status = 'false_positive'
        self.resolved_by = dismissed_by
        self.resolved_at = timezone.now()
        self.resolution_notes = reason
        self.save()


class WorkingHoursMetricsManager(models.Manager):
    """Manager for WorkingHoursMetrics model"""

    def for_user(self, user):
        """Get metrics for specific user"""
        return self.get_queryset().filter(user=user)

    def for_period(self, start_date, end_date):
        """Get metrics for specific period"""
        return self.get_queryset().filter(
            period_start__lte=end_date,
            period_end__gte=start_date
        )

    def weekly_metrics(self):
        """Get weekly metrics only"""
        return self.get_queryset().filter(period_type='weekly')

    def monthly_metrics(self):
        """Get monthly metrics only"""
        return self.get_queryset().filter(period_type='monthly')

    def with_violations(self):
        """Get metrics with violations"""
        return self.get_queryset().filter(violation_count__gt=0)

    def high_overtime(self, threshold=10):
        """Get metrics with high overtime hours"""
        return self.get_queryset().filter(overtime_hours__gte=threshold)


class WorkingHoursMetrics(models.Model):
    """
    Pre-calculated aggregated working hours data for performance and reporting.
    This model stores computed metrics to avoid expensive real-time calculations.
    """

    PERIOD_TYPE_CHOICES = [
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
    ]

    # User and time period
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='working_hours_metrics',
        help_text="Staff member for these metrics"
    )
    period_type = models.CharField(
        max_length=10,
        choices=PERIOD_TYPE_CHOICES,
        help_text="Type of time period for aggregation"
    )
    period_start = models.DateField(
        help_text="Start date of the period"
    )
    period_end = models.DateField(
        help_text="End date of the period"
    )

    # Core working hours metrics
    total_hours_worked = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Total hours worked in the period"
    )
    regular_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Regular hours worked (within standard limits)"
    )
    overtime_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text="Overtime hours worked"
    )
    break_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Total break time taken"
    )

    # Shift patterns
    total_shifts = models.PositiveIntegerField(
        default=0,
        help_text="Total number of shifts worked"
    )
    completed_shifts = models.PositiveIntegerField(
        default=0,
        help_text="Number of completed shifts"
    )
    cancelled_shifts = models.PositiveIntegerField(
        default=0,
        help_text="Number of cancelled shifts"
    )
    average_shift_duration = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average duration of shifts in hours"
    )

    # Compliance metrics
    violation_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of compliance violations in this period"
    )
    warning_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of compliance warnings in this period"
    )
    compliance_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100.00,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Overall compliance score for the period (0-100)"
    )

    # Rest period compliance
    adequate_rest_periods = models.PositiveIntegerField(
        default=0,
        help_text="Number of shifts with adequate rest before"
    )
    insufficient_rest_periods = models.PositiveIntegerField(
        default=0,
        help_text="Number of shifts with insufficient rest before"
    )
    consecutive_working_days = models.PositiveIntegerField(
        default=0,
        help_text="Maximum consecutive working days in period"
    )

    # Financial metrics
    estimated_regular_pay = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated regular pay for the period"
    )
    estimated_overtime_pay = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated overtime pay for the period"
    )
    total_estimated_pay = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total estimated pay for the period"
    )

    # Performance indicators
    punctuality_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Punctuality score based on on-time arrivals (0-100)"
    )
    attendance_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Attendance rate for scheduled shifts (0-100)"
    )

    # Additional data
    venues_worked = models.PositiveIntegerField(
        default=0,
        help_text="Number of different venues worked at"
    )
    shift_types_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Breakdown of hours by shift type"
    )
    detailed_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional detailed metrics and breakdowns"
    )

    # Calculation metadata
    calculated_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    calculation_version = models.CharField(
        max_length=20,
        default='1.0',
        help_text="Version of calculation algorithm used"
    )
    needs_recalculation = models.BooleanField(
        default=False,
        help_text="Whether metrics need to be recalculated due to data changes"
    )

    objects = OptimizedWorkingHoursMetricsManager()

    class Meta:
        db_table = 'working_hours_metrics'
        ordering = ['-period_start', 'user']
        unique_together = ['user', 'period_type', 'period_start', 'period_end']
        indexes = [
            models.Index(fields=['user', '-period_start']),
            models.Index(fields=['period_type', '-period_start']),
            models.Index(fields=['compliance_score']),
            models.Index(fields=['violation_count']),
            models.Index(fields=['needs_recalculation']),
        ]
        verbose_name = 'Working Hours Metrics'
        verbose_name_plural = 'Working Hours Metrics'

    def __str__(self):
        return f"{self.user.username} - {self.get_period_type_display()} ({self.period_start} to {self.period_end})"

    def overtime_percentage(self):
        """Calculate overtime as percentage of total hours"""
        if self.total_hours_worked > 0:
            return (self.overtime_hours / self.total_hours_worked) * 100
        return 0

    def shift_completion_rate(self):
        """Calculate percentage of shifts completed"""
        if self.total_shifts > 0:
            return (self.completed_shifts / self.total_shifts) * 100
        return 0

    def has_violations(self):
        """Check if period has any violations"""
        return self.violation_count > 0

    def compliance_grade(self):
        """Get letter grade based on compliance score"""
        if self.compliance_score >= 95:
            return 'A+'
        elif self.compliance_score >= 90:
            return 'A'
        elif self.compliance_score >= 85:
            return 'B+'
        elif self.compliance_score >= 80:
            return 'B'
        elif self.compliance_score >= 75:
            return 'C+'
        elif self.compliance_score >= 70:
            return 'C'
        elif self.compliance_score >= 65:
            return 'D+'
        elif self.compliance_score >= 60:
            return 'D'
        else:
            return 'F'

    def mark_for_recalculation(self):
        """Mark metrics for recalculation"""
        self.needs_recalculation = True
        self.save(update_fields=['needs_recalculation'])


# =============================================================================
# REPORTING & EXPORT MODELS
# =============================================================================

class ReportTemplate(models.Model):
    """
    Template for generating reports with customizable parameters and SQL queries.
    Supports multiple report types for compliance, working hours, and violations.
    """

    TEMPLATE_TYPES = [
        ('compliance_summary', 'Compliance Summary'),
        ('violation_detail', 'Violation Detail Report'),
        ('working_hours', 'Working Hours Report'),
        ('venue_performance', 'Venue Performance'),
        ('staff_compliance', 'Staff Compliance'),
        ('trends_analysis', 'Trends Analysis'),
    ]

    name = models.CharField(
        max_length=200,
        help_text="Display name for the report template"
    )
    template_type = models.CharField(
        max_length=50,
        choices=TEMPLATE_TYPES,
        help_text="Type of report this template generates"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of what this report shows"
    )

    # Query and parameters
    sql_query = models.TextField(
        help_text="SQL query for generating report data (use parameterized queries)"
    )
    parameters = models.JSONField(
        default=dict,
        help_text="Parameter definitions for the report (e.g., date ranges, filters)"
    )

    # Permissions and access
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="User who created this template"
    )
    allowed_roles = models.JSONField(
        default=list,
        help_text="List of roles that can use this template (e.g., ['admin', 'manager'])"
    )
    allowed_venues = models.ManyToManyField(
        'Venue',
        blank=True,
        help_text="Specific venues this template applies to (empty = all venues)"
    )

    # Template configuration
    template_config = models.JSONField(
        default=dict,
        help_text="Additional configuration for report formatting and behavior"
    )

    # Status and timestamps
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this template is available for use"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'report_templates'
        indexes = [
            models.Index(fields=['template_type', 'is_active']),
            models.Index(fields=['created_by']),
            models.Index(fields=['-created_at']),
        ]
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.template_type})"

    def is_accessible_by_user(self, user):
        """Check if user has access to this template"""
        # Admin users can access all templates
        if user.role == 'admin':
            return True

        # Check role-based access
        if self.allowed_roles and user.role not in self.allowed_roles:
            return False

        # Check venue-based access for non-admin users
        if self.allowed_venues.exists():
            user_venues = user.profile.venues.all() if hasattr(user, 'profile') else []
            return self.allowed_venues.filter(id__in=user_venues).exists()

        return True


class ReportJob(models.Model):
    """
    Tracks report generation jobs, their status, and resulting files.
    Handles both synchronous and asynchronous report generation.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled')
    ]

    EXPORT_FORMATS = [
        ('csv', 'CSV'),
        ('excel', 'Excel'),
        ('json', 'JSON'),
        ('pdf', 'PDF'),
    ]

    # Job identification
    job_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        help_text="Unique identifier for this report job"
    )
    template = models.ForeignKey(
        ReportTemplate,
        on_delete=models.CASCADE,
        help_text="Template used for this report"
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="User who requested this report"
    )

    # Job status and format
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current status of the report generation"
    )
    export_format = models.CharField(
        max_length=10,
        choices=EXPORT_FORMATS,
        help_text="Format for the exported report"
    )

    # Parameters and filters
    date_range_start = models.DateTimeField(
        help_text="Start date for report data"
    )
    date_range_end = models.DateTimeField(
        help_text="End date for report data"
    )
    filters = models.JSONField(
        default=dict,
        help_text="Additional filters applied to the report"
    )

    # Execution tracking
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When report generation started"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When report generation completed"
    )

    # File information
    file_path = models.CharField(
        max_length=500,
        blank=True,
        help_text="Path to the generated report file"
    )
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Size of the generated file in bytes"
    )
    download_count = models.IntegerField(
        default=0,
        help_text="Number of times this report has been downloaded"
    )

    # Error handling
    error_message = models.TextField(
        blank=True,
        help_text="Error message if generation failed"
    )
    retry_count = models.IntegerField(
        default=0,
        help_text="Number of retry attempts"
    )

    # Progress tracking
    progress = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Report generation progress percentage (0-100)"
    )

    # Timestamps and retention
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="When this report file expires and should be deleted"
    )

    class Meta:
        db_table = 'report_jobs'
        indexes = [
            models.Index(fields=['requested_by', '-created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['job_id']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Report Job {self.job_id} - {self.template.name} ({self.status})"

    @property
    def duration(self):
        """Calculate duration of report generation"""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        elif self.started_at:
            return timezone.now() - self.started_at
        return None

    @property
    def file_size_mb(self):
        """Get file size in MB"""
        if self.file_size:
            return round(self.file_size / (1024 * 1024), 2)
        return None

    def is_expired(self):
        """Check if this report has expired"""
        return timezone.now() > self.expires_at

    def increment_download_count(self):
        """Increment download counter"""
        self.download_count += 1
        self.save(update_fields=['download_count'])

    def mark_as_failed(self, error_message):
        """Mark job as failed with error message"""
        self.status = 'failed'
        self.error_message = error_message
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'error_message', 'completed_at'])


class ScheduledReport(models.Model):
    """
    Automated report generation with configurable scheduling and distribution.
    Supports recurring reports with multiple delivery methods.
    """

    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annually', 'Annually')
    ]

    DELIVERY_METHODS = [
        ('email', 'Email'),
        ('webhook', 'Webhook'),
        ('storage', 'File Storage Only')
    ]

    # Basic information
    name = models.CharField(
        max_length=200,
        help_text="Name for this scheduled report"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of what this scheduled report does"
    )
    template = models.ForeignKey(
        ReportTemplate,
        on_delete=models.CASCADE,
        help_text="Template to use for generating reports"
    )

    # Scheduling configuration
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        help_text="How often this report should be generated"
    )
    next_run = models.DateTimeField(
        help_text="When this report should next be generated"
    )
    last_run = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this report was last generated"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this scheduled report is active"
    )

    # Distribution configuration
    recipients = models.JSONField(
        default=list,
        help_text="List of email addresses to send reports to"
    )
    delivery_methods = models.JSONField(
        default=list,
        help_text="List of delivery methods (email, webhook, storage)"
    )
    webhook_url = models.URLField(
        blank=True,
        help_text="Webhook URL for report delivery notifications"
    )

    # Report parameters
    parameters = models.JSONField(
        default=dict,
        help_text="Parameters to use when generating the report"
    )
    export_formats = models.JSONField(
        default=list,
        help_text="List of formats to generate (pdf, excel, csv, json)"
    )

    # Configuration options
    include_empty_reports = models.BooleanField(
        default=False,
        help_text="Whether to send reports even when no data is found"
    )
    retention_days = models.IntegerField(
        default=30,
        help_text="How long to keep generated report files (days)"
    )

    # Ownership and timestamps
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="User who created this scheduled report"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'scheduled_reports'
        indexes = [
            models.Index(fields=['next_run', 'is_active']),
            models.Index(fields=['created_by']),
            models.Index(fields=['frequency', 'is_active']),
        ]
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.frequency})"

    def calculate_next_run(self):
        """Calculate the next run time based on frequency"""
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta

        if not self.last_run:
            return self.next_run

        if self.frequency == 'daily':
            return self.last_run + timedelta(days=1)
        elif self.frequency == 'weekly':
            return self.last_run + timedelta(weeks=1)
        elif self.frequency == 'monthly':
            return self.last_run + relativedelta(months=1)
        elif self.frequency == 'quarterly':
            return self.last_run + relativedelta(months=3)
        elif self.frequency == 'annually':
            return self.last_run + relativedelta(years=1)

        return self.next_run

    def update_next_run(self):
        """Update next_run time and save"""
        self.next_run = self.calculate_next_run()
        self.last_run = timezone.now()
        self.save(update_fields=['next_run', 'last_run'])

    def is_due(self):
        """Check if this scheduled report is due to run"""
        return self.is_active and timezone.now() >= self.next_run


class ExportConfiguration(models.Model):
    """
    Configuration settings for different export formats including
    compression, formatting options, and file naming patterns.
    """

    COMPRESSION_CHOICES = [
        ('none', 'No Compression'),
        ('zip', 'ZIP'),
        ('gzip', 'GZIP')
    ]

    # Basic information
    name = models.CharField(
        max_length=200,
        help_text="Name for this export configuration"
    )
    description = models.TextField(
        blank=True,
        help_text="Description of this export configuration"
    )
    export_format = models.CharField(
        max_length=10,
        choices=ReportJob.EXPORT_FORMATS,
        help_text="Export format this configuration applies to"
    )

    # File naming and compression
    filename_pattern = models.CharField(
        max_length=200,
        default='{report_type}_{date_range}_{timestamp}',
        help_text="Pattern for naming exported files (supports variables)"
    )
    compression = models.CharField(
        max_length=10,
        choices=COMPRESSION_CHOICES,
        default='none',
        help_text="Compression method for exported files"
    )

    # Format-specific settings
    template_settings = models.JSONField(
        default=dict,
        help_text="General template settings for this export format"
    )
    pdf_settings = models.JSONField(
        default=dict,
        help_text="PDF-specific settings (DPI, page size, margins, etc.)"
    )
    excel_settings = models.JSONField(
        default=dict,
        help_text="Excel-specific settings (sheet names, formatting, charts, etc.)"
    )
    csv_settings = models.JSONField(
        default=dict,
        help_text="CSV-specific settings (delimiter, encoding, headers, etc.)"
    )

    # Quality and performance settings
    max_file_size_mb = models.IntegerField(
        default=100,
        help_text="Maximum file size in MB before compression/splitting"
    )
    enable_charts = models.BooleanField(
        default=True,
        help_text="Whether to include charts in exports (where supported)"
    )
    enable_formatting = models.BooleanField(
        default=True,
        help_text="Whether to apply advanced formatting"
    )

    # Access control
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default configuration for this format"
    )
    allowed_roles = models.JSONField(
        default=list,
        help_text="Roles that can use this configuration"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'export_configurations'
        indexes = [
            models.Index(fields=['export_format', 'is_default']),
            models.Index(fields=['is_default']),
        ]
        unique_together = [
            ('export_format', 'name'),  # Unique name per format
        ]
        ordering = ['export_format', 'name']

    def __str__(self):
        return f"{self.name} ({self.export_format})"

    def get_filename(self, report_data: dict = None) -> str:
        """Generate filename based on pattern and report data"""
        from datetime import datetime
        import re

        pattern = self.filename_pattern

        # Default substitutions
        substitutions = {
            'timestamp': datetime.now().strftime('%Y%m%d_%H%M%S'),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'format': self.export_format,
        }

        # Add report-specific substitutions if available
        if report_data:
            metadata = report_data.get('metadata', {})
            parameters = report_data.get('parameters', {})

            substitutions.update({
                'report_type': metadata.get('template_type', 'report'),
                'template_name': metadata.get('template_name', 'unknown'),
                'row_count': str(metadata.get('row_count', 0)),
            })

            # Add date range if available
            start_date = parameters.get('date_range_start')
            end_date = parameters.get('date_range_end')
            if start_date and end_date:
                substitutions['date_range'] = f"{start_date[:10]}_to_{end_date[:10]}"
            else:
                substitutions['date_range'] = datetime.now().strftime('%Y-%m')

        # Perform substitutions
        filename = pattern
        for key, value in substitutions.items():
            filename = filename.replace(f'{{{key}}}', str(value))

        # Clean up filename (remove invalid characters)
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)

        # Add file extension
        extensions = {
            'pdf': '.pdf',
            'excel': '.xlsx',
            'csv': '.csv',
            'json': '.json'
        }

        extension = extensions.get(self.export_format, '.txt')
        if not filename.endswith(extension):
            filename += extension

        return filename

    def get_export_config(self) -> dict:
        """Get merged configuration for export handlers"""
        config = self.template_settings.copy()

        # Add format-specific settings
        if self.export_format == 'pdf':
            config.update(self.pdf_settings)
        elif self.export_format == 'excel':
            config.update(self.excel_settings)
        elif self.export_format == 'csv':
            config.update(self.csv_settings)

        # Add general settings
        config.update({
            'compression': self.compression,
            'max_file_size_mb': self.max_file_size_mb,
            'include_charts': self.enable_charts,
            'include_formatting': self.enable_formatting,
        })

        return config

    @classmethod
    def get_default_config(cls, export_format: str):
        """Get default configuration for an export format"""
        try:
            return cls.objects.get(export_format=export_format, is_default=True)
        except cls.DoesNotExist:
            # Return a basic default configuration
            return cls(
                name=f"Default {export_format.title()}",
                export_format=export_format,
                is_default=True
            )


# =====================================================
# NOTIFICATION SYSTEM MODELS
# =====================================================

class SNSDeviceToken(models.Model):
    """
    Stores mobile device push notification tokens for AWS SNS integration.
    Each user can have multiple devices registered.
    """
    PLATFORM_CHOICES = [
        ('ios', 'iOS'),
        ('android', 'Android'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='device_tokens',
        help_text="User who owns this device"
    )
    token = models.CharField(
        max_length=500,
        unique=True,
        help_text="Expo push token for the device"
    )
    platform = models.CharField(
        max_length=10,
        choices=PLATFORM_CHOICES,
        help_text="Device platform (iOS or Android)"
    )
    device_id = models.CharField(
        max_length=255,
        help_text="Unique device identifier"
    )
    endpoint_arn = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="AWS SNS Platform Endpoint ARN (optional, for future SNS integration)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this device token is active and should receive notifications"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time a notification was sent to this device"
    )

    class Meta:
        db_table = 'sns_device_token'
        verbose_name = 'Device Push Token'
        verbose_name_plural = 'Device Push Tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['token']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.platform} ({self.device_id})"

    def save(self, *args, **kwargs):
        """Update last_used_at when token is saved"""
        if not self.pk:  # New token
            self.last_used_at = timezone.now()
        super().save(*args, **kwargs)

    def deactivate(self):
        """Deactivate this device token"""
        self.is_active = False
        self.save()

    def activate(self):
        """Activate this device token"""
        self.is_active = True
        self.last_used_at = timezone.now()
        self.save()

    def update_last_used(self):
        """Update the last_used_at timestamp for this token"""
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])


class NotificationPreferences(models.Model):
    """
    User notification preferences for controlling which notifications they receive
    and when they receive them.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
        help_text="User these preferences belong to"
    )
    
    # Shift reminder settings
    shift_reminders_enabled = models.BooleanField(
        default=True,
        help_text="Enable/disable shift reminder notifications"
    )
    advance_reminder_hours = models.IntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(24)],
        help_text="Hours before shift to send advance reminder (1-24)"
    )
    final_reminder_minutes = models.IntegerField(
        default=45,
        validators=[MinValueValidator(15), MaxValueValidator(180)],
        help_text="Minutes before shift to send final reminder (15-180)"
    )
    
    # Shift exchange settings
    exchange_notifications_enabled = models.BooleanField(
        default=True,
        help_text="Enable/disable shift exchange notifications"
    )
    exchange_request_received = models.BooleanField(
        default=True,
        help_text="Notify when someone requests to exchange shifts"
    )
    exchange_request_accepted = models.BooleanField(
        default=True,
        help_text="Notify when your exchange request is accepted"
    )
    exchange_request_approved = models.BooleanField(
        default=True,
        help_text="Notify when manager approves your exchange"
    )
    
    # Available shift settings
    available_shifts_notifications_enabled = models.BooleanField(
        default=True,
        help_text="Enable/disable available shift notifications"
    )
    new_available_shift = models.BooleanField(
        default=True,
        help_text="Notify when new shifts become available to claim"
    )
    
    # Incident and alert settings
    incident_alerts_enabled = models.BooleanField(
        default=True,
        help_text="Enable/disable critical incident alerts"
    )
    
    # Sync status settings
    sync_notifications_enabled = models.BooleanField(
        default=False,
        help_text="Enable/disable sync status notifications"
    )
    sync_errors_only = models.BooleanField(
        default=True,
        help_text="Only notify on sync errors, not successful syncs"
    )

    # Email notification settings
    email_notifications_enabled = models.BooleanField(
        default=True,
        help_text="Master toggle for all email notifications"
    )
    email_shift_assignments = models.BooleanField(
        default=True,
        help_text="Receive email when assigned to a shift"
    )
    email_shift_reminders = models.BooleanField(
        default=False,
        help_text="Receive email reminders before shifts (default off to reduce email volume)"
    )
    email_exchange_notifications = models.BooleanField(
        default=True,
        help_text="Receive email for shift exchange requests and status updates"
    )
    email_open_shift_notifications = models.BooleanField(
        default=True,
        help_text="Receive email when open shifts are available to claim"
    )
    email_approval_notifications = models.BooleanField(
        default=True,
        help_text="Receive email when shifts or claims are approved"
    )
    email_unsubscribe_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Token for one-click email unsubscribe links"
    )

    # Quiet hours
    quiet_hours_enabled = models.BooleanField(
        default=False,
        help_text="Enable quiet hours (no notifications during these times)"
    )
    quiet_hours_start = models.TimeField(
        null=True,
        blank=True,
        help_text="Start time for quiet hours (e.g., 22:00)"
    )
    quiet_hours_end = models.TimeField(
        null=True,
        blank=True,
        help_text="End time for quiet hours (e.g., 07:00)"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_preferences'
        verbose_name = 'Notification Preferences'
        verbose_name_plural = 'Notification Preferences'

    def __str__(self):
        return f"{self.user.username} - Notification Preferences"

    @classmethod
    def get_or_create_for_user(cls, user):
        """Get or create notification preferences for a user with defaults"""
        preferences, created = cls.objects.get_or_create(
            user=user,
            defaults={
                'shift_reminders_enabled': True,
                'advance_reminder_hours': 3,
                'final_reminder_minutes': 45,
                'exchange_notifications_enabled': True,
                'available_shifts_notifications_enabled': True,
                'incident_alerts_enabled': True,
                'sync_notifications_enabled': False,
                # Email notification defaults
                'email_notifications_enabled': True,
                'email_shift_assignments': True,
                'email_shift_reminders': False,  # Default off to reduce email volume
                'email_exchange_notifications': True,
                'email_open_shift_notifications': True,
                'email_approval_notifications': True,
            }
        )
        return preferences

    def is_in_quiet_hours(self):
        """Check if current time is within quiet hours"""
        if not self.quiet_hours_enabled or not self.quiet_hours_start or not self.quiet_hours_end:
            return False
        
        now = timezone.localtime().time()
        
        # Handle quiet hours that span midnight
        if self.quiet_hours_start > self.quiet_hours_end:
            return now >= self.quiet_hours_start or now <= self.quiet_hours_end
        else:
            return self.quiet_hours_start <= now <= self.quiet_hours_end

    def should_send_notification(self, notification_type: str) -> bool:
        """
        Check if a notification of the given type should be sent based on user preferences.
        
        Args:
            notification_type: Type of notification (e.g., 'shift_reminder', 'exchange_request')
        
        Returns:
            bool: True if notification should be sent, False otherwise
        """
        # Check quiet hours first
        if self.is_in_quiet_hours():
            # Only send critical incident alerts during quiet hours
            if notification_type != 'incident_alert':
                return False
        
        # Check specific notification type preferences
        if notification_type == 'shift_reminder':
            return self.shift_reminders_enabled
        elif notification_type in ['exchange_request', 'exchange_accepted', 'exchange_approved']:
            return self.exchange_notifications_enabled
        elif notification_type == 'available_shift':
            return self.available_shifts_notifications_enabled
        elif notification_type == 'incident_alert':
            return self.incident_alerts_enabled
        elif notification_type == 'sync_status':
            return self.sync_notifications_enabled
        
        # Default to True for unknown notification types
        return True

    def should_send_email_notification(self, notification_type: str) -> bool:
        """
        Check if an email notification of the given type should be sent based on user preferences.

        Args:
            notification_type: Type of notification (e.g., 'shift_assignment', 'exchange_request',
                             'available_shift', 'shift_approved', 'claim_approved')

        Returns:
            bool: True if email notification should be sent, False otherwise
        """
        # Check master email toggle first
        if not self.email_notifications_enabled:
            return False

        # Check quiet hours (same logic as push notifications)
        if self.is_in_quiet_hours():
            # Only send critical incident alerts during quiet hours
            if notification_type != 'incident_alert':
                return False

        # Check specific email notification type preferences
        if notification_type in ['shift_assignment', 'shift_assigned']:
            return self.email_shift_assignments
        elif notification_type in ['shift_reminder', 'advance_reminder', 'soon_reminder', 'imminent_reminder']:
            return self.email_shift_reminders
        elif notification_type in ['exchange_request', 'exchange_accepted', 'exchange_approved', 'exchange_rejected', 'exchange_cancelled']:
            return self.email_exchange_notifications
        elif notification_type in ['available_shift', 'open_shift', 'available_shifts_batch']:
            return self.email_open_shift_notifications
        elif notification_type in ['shift_approved', 'claim_approved', 'approval']:
            return self.email_approval_notifications

        # Default to True for unknown notification types
        return True


# =====================================================
# PASSWORD RESET MODELS
# =====================================================

class PasswordResetToken(models.Model):
    """
    Model to manage password reset tokens.
    Tokens are valid for 24 hours and can only be used once.
    """
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Unique token for password reset"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
        help_text="User requesting password reset"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the token was created"
    )
    expires_at = models.DateTimeField(
        help_text="When the token expires (24 hours from creation)"
    )
    is_used = models.BooleanField(
        default=False,
        help_text="Whether the token has been used"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the request for audit trail"
    )

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token', 'is_used', 'expires_at']),
            models.Index(fields=['user', 'created_at']),
        ]

    def save(self, *args, **kwargs):
        """Set expiry date to 24 hours from creation if not set"""
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    def is_valid(self):
        """Check if token is still valid (not used and not expired)"""
        return not self.is_used and timezone.now() < self.expires_at

    def mark_as_used(self):
        """Mark the token as used"""
        self.is_used = True
        self.save(update_fields=['is_used'])

    def __str__(self):
        return f"Password reset token for {self.user.username} - {'Valid' if self.is_valid() else 'Invalid'}"


# =====================================================
# AUDIT LOGGING
# =====================================================

class AuditLog(models.Model):
    """Tracks all significant operations for regulatory compliance and security auditing."""
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('login_failed', 'Login Failed'),
        ('role_change', 'Role Change'),
        ('status_change', 'Status Change'),
        ('export', 'Data Export'),
        ('approve', 'Approve'),
        ('reject', 'Reject'),
    ]

    user = models.ForeignKey('User', null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_logs')
    company = models.ForeignKey('SecurityCompany', null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=255, blank=True, default='')
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['company', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user} {self.action} {self.resource_type} {self.resource_id} at {self.timestamp}"

    @classmethod
    def log(cls, user=None, company=None, action='', resource_type='', resource_id='', details=None, request=None):
        """Convenience method to create audit log entries."""
        ip_address = None
        user_agent = ''
        if request:
            ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ip_address and ',' in ip_address:
                ip_address = ip_address.split(',')[0].strip()
            user_agent = request.META.get('HTTP_USER_AGENT', '')
        return cls.objects.create(
            user=user,
            company=company,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else '',
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )


# =====================================================
# IN-APP NOTIFICATION INBOX
# =====================================================

class Notification(models.Model):
    """In-app notification with read/unread tracking."""
    TYPE_CHOICES = [
        ('shift_assigned', 'Shift Assigned'),
        ('shift_removed', 'Shift Removed'),
        ('shift_updated', 'Shift Updated'),
        ('shift_approved', 'Shift Approved'),
        ('shift_rejected', 'Shift Rejected'),
        ('open_shift', 'Open Shift Available'),
        ('exchange_request', 'Exchange Request'),
        ('exchange_approved', 'Exchange Approved'),
        ('exchange_rejected', 'Exchange Rejected'),
        ('leave_approved', 'Leave Approved'),
        ('leave_rejected', 'Leave Rejected'),
        ('compliance_alert', 'Compliance Alert'),
        ('sia_expiry', 'SIA License Expiry'),
        ('invoice_ready', 'Invoice Ready'),
        ('invoice_paid', 'Invoice Paid'),
        ('general', 'General'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='notifications')
    company = models.ForeignKey('SecurityCompany', on_delete=models.CASCADE, null=True, blank=True)

    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='general')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    title = models.CharField(max_length=255)
    message = models.TextField()

    # Optional link to related object
    related_type = models.CharField(max_length=50, blank=True)  # e.g., 'shift', 'invoice', 'leave_request'
    related_id = models.CharField(max_length=255, blank=True)
    action_url = models.CharField(max_length=500, blank=True)  # Frontend route to navigate to

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
            models.Index(fields=['user', 'notification_type']),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} -> {self.user}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    @classmethod
    def send(cls, user, title, message, notification_type='general', priority='normal',
             related_type='', related_id='', action_url='', company=None):
        """Create a notification for a user."""
        return cls.objects.create(
            user=user,
            company=company,
            notification_type=notification_type,
            priority=priority,
            title=title,
            message=message,
            related_type=related_type,
            related_id=str(related_id) if related_id else '',
            action_url=action_url,
        )


# =====================================================
# CLIENT BILLING MODELS
# =====================================================

class ClientInvoice(models.Model):
    """Invoice sent to a client/venue for security services provided.

    This is distinct from the staff Invoice model which tracks pay stubs.
    ClientInvoice represents what the security company bills its clients
    for services rendered at their venues.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        SecurityCompany,
        on_delete=models.CASCADE,
        related_name='client_invoices',
        help_text="Security company issuing the invoice"
    )
    venue = models.ForeignKey(
        Venue,
        on_delete=models.CASCADE,
        related_name='client_invoices',
        help_text="Venue/client being billed"
    )
    invoice_number = models.CharField(max_length=50, unique=True)

    # Billing period
    start_date = models.DateField(help_text="Start of billing period")
    end_date = models.DateField(help_text="End of billing period")

    # Financials
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=20.00,
        help_text="Tax/VAT rate percentage (default 20% UK VAT)"
    )
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    issued_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)

    # Client details (denormalized for invoice permanence — snapshot at time of creation)
    client_name = models.CharField(max_length=255, help_text="Client/venue name at time of invoicing")
    client_address = models.TextField(blank=True)
    client_email = models.EmailField(blank=True)

    # Metadata
    notes = models.TextField(blank=True)
    reject_reason = models.TextField(blank=True, default='')
    superseded_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='supersedes',
        help_text=(
            "When set, this invoice has been replaced by another invoice. "
            "Many-to-one: a single replacement invoice can supersede multiple "
            "draft auto-invoices in the hybrid flow, or a single rejected "
            "invoice can be superseded by its reissue. Display as 'Resolved' "
            "instead of 'Rejected' so it falls out of the manager's open work "
            "queue."
        ),
    )
    created_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True,
        related_name='created_client_invoices'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_invoices'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['venue', 'start_date']),
            models.Index(fields=['invoice_number']),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.venue.name} ({self.status})"

    def calculate_totals(self):
        """Recalculate subtotal, tax, and total from line items."""
        from decimal import Decimal
        self.subtotal = sum(
            (item.total for item in self.line_items.all()),
            Decimal('0.00')
        )
        self.tax_amount = (self.subtotal * self.tax_rate / 100).quantize(
            Decimal('0.01')
        )
        self.total_amount = self.subtotal + self.tax_amount
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])

    @classmethod
    def generate_invoice_number(cls, company):
        """Generate sequential invoice number: INV-YYYY-NNNN"""
        year = timezone.now().year
        prefix = f'INV-{year}-'
        last = cls.objects.filter(
            company=company,
            invoice_number__startswith=prefix
        ).order_by('-invoice_number').first()
        if last:
            seq = int(last.invoice_number.split('-')[-1]) + 1
        else:
            seq = 1
        return f'{prefix}{seq:04d}'

    @classmethod
    def generate_for_venue_period(cls, venue, start_date, end_date, *,
                                  created_by=None, notes='', tax_rate=None):
        """Build a draft ClientInvoice for `venue` covering `start_date..end_date`.

        Pulls every approved shift at the venue with recorded actual hours
        in the period and turns each into a ClientInvoiceItem priced at the
        shift's effective hourly rate. Returns the new draft.

        Idempotent guard: if a draft already exists for the same
        (venue, start_date, end_date), it is returned instead of being
        recreated — the manager is expected to edit/issue that one rather
        than have multiple drafts pile up.
        """
        from decimal import Decimal

        existing = cls.objects.filter(
            venue=venue,
            start_date=start_date,
            end_date=end_date,
            status='draft',
        ).first()
        if existing:
            return existing

        company = venue.company
        shifts = list(
            Shift.objects.filter(
                venue=venue,
                start_time__date__gte=start_date,
                start_time__date__lte=end_date,
                status='approved',
                actual_hours_worked__isnull=False,
            ).order_by('start_time')
        )
        if not shifts:
            raise ValueError(
                f"No approved shifts at {venue.name} between {start_date} and {end_date}."
            )

        client_address_lines = []
        for attr in ('address', 'city', 'postal_code'):
            v = getattr(venue, attr, None)
            if v:
                client_address_lines.append(str(v))

        invoice = cls.objects.create(
            company=company,
            venue=venue,
            invoice_number=cls.generate_invoice_number(company),
            start_date=start_date,
            end_date=end_date,
            tax_rate=tax_rate if tax_rate is not None else Decimal('20.00'),
            client_name=venue.name,
            client_address='\n'.join(client_address_lines),
            client_email=getattr(venue, 'contact_email', '') or '',
            notes=notes or '',
            created_by=created_by,
            status='draft',
        )

        for shift in shifts:
            rate = shift.get_effective_hourly_rate() or Decimal('0')
            hours = Decimal(str(shift.actual_hours_worked or 0))
            staff_label = ''
            if shift.staff_user:
                staff_label = (
                    f"{shift.staff_user.first_name} {shift.staff_user.last_name}".strip()
                    or shift.staff_user.username
                )
            descr = (
                f"Security cover · "
                f"{shift.start_time.strftime('%a %d %b')} · "
                f"{staff_label}"
                if staff_label else
                f"Security cover · {shift.start_time.strftime('%a %d %b')}"
            )
            ClientInvoiceItem.objects.create(
                invoice=invoice,
                shift=shift,
                description=descr,
                date=shift.start_time.date(),
                hours=hours,
                rate=rate,
            )

        invoice.calculate_totals()
        return invoice


class ClientInvoiceItem(models.Model):
    """Line item on a client invoice, optionally linked to a shift."""
    invoice = models.ForeignKey(
        ClientInvoice, on_delete=models.CASCADE, related_name='line_items'
    )
    shift = models.ForeignKey(
        Shift, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='client_invoice_items',
        help_text="Source shift (if generated from shifts)"
    )

    description = models.CharField(max_length=500)
    date = models.DateField()
    hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    rate = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        help_text="Client billing rate per hour (distinct from staff pay rate)"
    )
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        db_table = 'client_invoice_items'
        ordering = ['date']

    def __str__(self):
        return f"{self.description} - {self.date} ({self.hours}h @ {self.rate})"

    def save(self, *args, **kwargs):
        from decimal import Decimal
        self.total = (self.hours * self.rate).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)


# =====================================================
# PAYROLL RUN, EXPORT TRACKING, STATEMENTS, FINANCE PROVIDERS
# (Backend alignment for Payroll & Invoices UI)
# =====================================================

class PayrollRun(models.Model):
    """A weekly payroll batch grouping per-officer staff Invoices for one period.

    The frontend Payroll page is a one-run-at-a-time view: one PayrollRun maps
    to the W17-2026-style header and aggregates its child Invoices into the
    KPIs (gross_total, prev_gross delta, hours_billed, etc.).
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        # 'approved' run: every child invoice is approved (or paid) but at
        # least one is not yet paid. This is the export-to-Xero state.
        ('approved', 'Approved'),
        ('paid', 'Paid'),
        ('rejected', 'Rejected'),
    )
    EXPORT_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )
    CYCLE_CHOICES = (
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        SecurityCompany, on_delete=models.CASCADE, related_name='payroll_runs'
    )
    cycle = models.CharField(
        max_length=10,
        choices=CYCLE_CHOICES,
        default='weekly',
        help_text="Pay cycle this run covers — controls which staff are included.",
    )
    run_code = models.CharField(
        max_length=20,
        help_text="Run code: W{week}-{year} for weekly, M{month}-{year} for monthly. Unique per (company, cycle).",
    )
    label = models.CharField(
        max_length=120,
        help_text="Human label, e.g. 'Week 17 · w/c Mon 20 Apr 2026' or 'April 2026'",
    )
    period_start = models.DateField(help_text="First day of the run period (inclusive)")
    period_end = models.DateField(help_text="Last day of the run period (inclusive)")
    process_date = models.DateField(help_text="Day the run is processed (Monday after for weekly, 1st of next month for monthly)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    export_status = models.CharField(
        max_length=20, choices=EXPORT_STATUS_CHOICES, null=True, blank=True
    )

    # Cached aggregates (recomputed by recompute_totals())
    invoice_count = models.IntegerField(default=0)
    line_item_count = models.IntegerField(default=0)
    hours_billed = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gross_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    prev_gross = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    time_adjustments = models.IntegerField(default=0)
    sia_blocks = models.IntegerField(default=0)

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payroll_runs_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payroll_runs'
        ordering = ['-period_start']
        indexes = [
            models.Index(fields=['company', '-period_start']),
            models.Index(fields=['run_code']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'cycle', 'period_start', 'period_end'],
                name='unique_payrollrun_per_company_period',
            ),
            models.UniqueConstraint(
                fields=['company', 'run_code'],
                name='unique_payrollrun_code_per_company',
            ),
        ]

    def __str__(self):
        return f"{self.run_code} ({self.company.name})"

    @classmethod
    def for_iso_week(cls, dt):
        """Return (run_code, label, period_start, period_end, process_date) for the
        ISO week containing dt. The run period is Mon-Sun; process_date is the
        following Monday.
        """
        from datetime import timedelta
        weekday = dt.weekday()  # Mon=0, Sun=6
        period_start = dt - timedelta(days=weekday)
        period_end = period_start + timedelta(days=6)
        process_date = period_end + timedelta(days=1)
        iso_year, iso_week, _ = period_start.isocalendar()
        run_code = f"W{iso_week:02d}-{iso_year}"
        label = f"Week {iso_week} · w/c {period_start.strftime('%a %d %b %Y')}"
        return {
            'run_code': run_code,
            'label': label,
            'cycle': 'weekly',
            'period_start': period_start,
            'period_end': period_end,
            'process_date': process_date,
        }

    @classmethod
    def for_calendar_month(cls, dt):
        """Return run_code/label/period for the calendar month containing dt.

        Period is the 1st through last day of the month; process_date is the
        1st of the following month (the day the monthly cron fires).
        """
        from datetime import date
        from calendar import monthrange
        period_start = date(dt.year, dt.month, 1)
        last_day = monthrange(dt.year, dt.month)[1]
        period_end = date(dt.year, dt.month, last_day)
        if dt.month == 12:
            process_date = date(dt.year + 1, 1, 1)
        else:
            process_date = date(dt.year, dt.month + 1, 1)
        run_code = f"M{dt.month:02d}-{dt.year}"
        label = period_start.strftime('%B %Y')
        return {
            'run_code': run_code,
            'label': label,
            'cycle': 'monthly',
            'period_start': period_start,
            'period_end': period_end,
            'process_date': process_date,
        }

    def recompute_totals(self):
        """Re-aggregate cached counters from this run's child invoices."""
        from decimal import Decimal
        from django.db.models import Sum, Count

        # Exclude superseded invoices: they remain linked to the run for audit
        # but don't count toward gross/hours/officer totals.
        invoices = self.staff_invoices.filter(superseded_by__isnull=True)
        agg = invoices.aggregate(
            inv_count=Count('id'),
            hours=Sum('total_hours'),
            gross=Sum('total_amount'),
        )
        self.invoice_count = agg['inv_count'] or 0
        self.hours_billed = agg['hours'] or Decimal('0')
        self.gross_total = agg['gross'] or Decimal('0')
        self.line_item_count = InvoiceItem.objects.filter(invoice__in=invoices).count()

        prev = (
            PayrollRun.objects
            .filter(company=self.company, period_end__lt=self.period_start)
            .order_by('-period_end')
            .first()
        )
        self.prev_gross = prev.gross_total if prev else Decimal('0')

        # Time adjustments touching shifts in this run's invoices
        shift_ids = InvoiceItem.objects.filter(
            invoice__in=invoices, shift__isnull=False
        ).values_list('shift_id', flat=True).distinct()
        try:
            self.time_adjustments = TimeAdjustment.objects.filter(
                shift_id__in=list(shift_ids)
            ).count()
        except NameError:
            self.time_adjustments = 0

        # SIA blocks: officers whose latest license is expired on process_date
        # SIALicense -> StaffProfile -> User
        from django.db.models import Max
        staff_ids = list(invoices.values_list('staff_user_id', flat=True))
        try:
            sia_qs = SIALicense.objects.filter(staff_profile__user_id__in=staff_ids)
            blocked = (
                sia_qs.values('staff_profile__user_id')
                .annotate(latest_expiry=Max('expiry_date'))
                .filter(latest_expiry__lt=self.process_date)
                .count()
            )
            self.sia_blocks = blocked
        except NameError:
            self.sia_blocks = 0

        self.save(update_fields=[
            'invoice_count', 'line_item_count', 'hours_billed',
            'gross_total', 'prev_gross', 'time_adjustments', 'sia_blocks',
            'updated_at',
        ])

    def update_status_from_invoices(self):
        """Derive run status from child invoices.

        Rules (in order):
          - any invoice still in pending/draft/sent -> 'pending' (work to do)
          - any invoice approved but not all paid -> 'approved' (ready for Xero)
          - all paid (and at least one exists) -> 'paid'
          - all terminal and at least one rejected -> 'rejected'
          - empty run -> 'pending'

        The "any pending" guard means the run pill stays warning-coloured
        until the manager has actioned every officer.
        """
        invoices = list(self.staff_invoices.values_list('status', flat=True))
        if not invoices:
            new_status = 'pending'
        elif any(s in ('pending', 'draft', 'sent') for s in invoices):
            new_status = 'pending'
        elif any(s == 'approved' for s in invoices):
            # All officers reviewed; some not yet paid out. This is the
            # export-to-Xero state.
            new_status = 'approved'
        elif all(s == 'paid' for s in invoices):
            new_status = 'paid'
        else:
            # All terminal, at least one is rejected (or cancelled).
            new_status = 'rejected'

        if new_status != self.status:
            self.status = new_status
            self.save(update_fields=['status', 'updated_at'])


class Statement(models.Model):
    """A periodic statement bundling multiple ClientInvoices for a single venue.

    Backed by the Invoices page's 'Send statement…' button. A statement is
    a *summary* document: it references the underlying ClientInvoices but does
    not recompute or re-tax anything. The `snapshot` JSON freezes balances at
    issue time so the document reads consistently regardless of later activity.
    """
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('sent', 'Sent'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        SecurityCompany, on_delete=models.CASCADE, related_name='statements'
    )
    venue = models.ForeignKey(
        Venue, on_delete=models.CASCADE, related_name='statements'
    )
    statement_number = models.CharField(max_length=50, unique=True)
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    issued_date = models.DateField(null=True, blank=True)
    sent_to_email = models.EmailField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    snapshot = models.JSONField(
        default=dict, blank=True,
        help_text="Frozen list of invoice rows: [{invoice_number, issued, due, total, paid_total, balance}, …]"
    )
    invoices = models.ManyToManyField(
        ClientInvoice, through='StatementInvoice', related_name='statements'
    )
    pdf_url = models.URLField(max_length=500, null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='statements_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'statements'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', '-created_at']),
            models.Index(fields=['venue', 'period_start']),
        ]

    def __str__(self):
        return f"{self.statement_number} - {self.venue.name} ({self.status})"

    @classmethod
    def generate_statement_number(cls, company):
        """Generate sequential STMT-YYYY-NNNN per company per year."""
        year = timezone.now().year
        prefix = f'STMT-{year}-'
        last = cls.objects.filter(
            company=company, statement_number__startswith=prefix
        ).order_by('-statement_number').first()
        if last:
            try:
                seq = int(last.statement_number.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f'{prefix}{seq:04d}'

    def freeze_snapshot(self):
        """Capture per-invoice balances at this moment for permanent record."""
        from decimal import Decimal
        rows = []
        for inv in self.invoices.all().order_by('issued_date'):
            paid = Decimal('0') if inv.status != 'paid' else inv.total_amount
            rows.append({
                'invoice_number': inv.invoice_number,
                'issued': inv.issued_date.isoformat() if inv.issued_date else None,
                'due': inv.due_date.isoformat() if inv.due_date else None,
                'total': float(inv.total_amount),
                'paid_total': float(paid),
                'balance': float(inv.total_amount - paid),
            })
        self.snapshot = {'rows': rows, 'frozen_at': timezone.now().isoformat()}
        self.save(update_fields=['snapshot', 'updated_at'])


class StatementInvoice(models.Model):
    """Through model for Statement <-> ClientInvoice with display ordering."""
    statement = models.ForeignKey(
        Statement, on_delete=models.CASCADE, related_name='statement_invoices'
    )
    invoice = models.ForeignKey(
        ClientInvoice, on_delete=models.CASCADE, related_name='statement_invoices'
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'statement_invoices'
        ordering = ['sort_order', 'invoice__issued_date']
        constraints = [
            models.UniqueConstraint(
                fields=['statement', 'invoice'],
                name='unique_statement_invoice',
            ),
        ]


# NOTE: Invoice/payroll export tracking is handled by `finance_integrations.InvoiceExport`
# (for staff Invoice), `finance_integrations.PayrollExport` (for runs/periods), and a sibling
# `finance_integrations.ClientInvoiceExport` (for ClientInvoice — added alongside this work).
# The accounting-provider registry and per-connection state live in
# `finance_integrations.AccountingProvider` and `finance_integrations.ProviderConnection`.
# The frontend FinanceProvider strip is rendered by joining those two.
