from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import datetime, timedelta
from django.conf import settings
from model_utils import FieldTracker
import googlemaps
import math
import logging

logger = logging.getLogger(__name__)

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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f"Profile for {self.user.username}"

    def is_eligible_for_shifts(self):
        # Check for valid SIA license
        has_valid_sia = self.sia_licenses.filter(status='valid').exists()
        # Add more checks as needed (e.g., required fields)
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
    account_number = models.CharField(max_length=255)  # Will be encrypted
    sort_code = models.CharField(max_length=255)  # Will be encrypted
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
    document_url = models.URLField(max_length=500)
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
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    capacity = models.IntegerField()
    latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
    longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
    check_radius = models.IntegerField(default=50, help_text="Radius in meters for location verification")
    contact_name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=20)
    contact_email = models.EmailField()
    description = models.TextField(help_text="venue description")
    terms_and_conditions = models.TextField(help_text="venue terms and conditions")
    terms_version = models.CharField(max_length=50, null=True, blank=True, help_text="optional version identifier for terms")
    
    # Venue check requirements
    requires_fire_safety_checks = models.BooleanField(default=False, help_text="Whether this venue requires regular fire safety checks")
    requires_capacity_monitoring = models.BooleanField(default=False, help_text="Whether this venue requires capacity monitoring")
    requires_toilet_checks = models.BooleanField(default=False, help_text="Whether this venue requires regular toilet checks")
    
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
        return cls.objects.filter(
            staff_user=staff_user,
            venue=venue,
            terms_version=venue.terms_version
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
    status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='shift_status_changes')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shift_status_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"Shift {self.shift.id} status changed to {self.status} by {self.changed_by.username}"

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
                raise ValueError("You do not have the required security role for this shift")
            # Check for schedule conflicts
            conflicting_shifts = Shift.objects.filter(
                staff_user=self.claimed_by,
                start_time__lt=self.original_shift.end_time,
                end_time__gt=self.original_shift.start_time
            ).exclude(status__in=['cancelled', 'rejected'])
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
        """Staff member claims the open shift"""
        if self.status != 'open':
            raise ValueError("This shift is no longer available")
            
        if claiming_user == self.requesting_user:
            raise ValueError("Cannot claim your own released shift")
            
        self.claimed_by = claiming_user
        self.claim_time = timezone.now()
        self.status = 'claimed'
        self.save()

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
        # Get all open shift requests
        open_requests = cls.objects.filter(status='open')
        
        # Filter to shifts the staff member is qualified for
        qualified_shifts = []
        for request in open_requests:
            if staff_user.has_security_role(request.original_shift.required_security_role):
                # Check for schedule conflicts
                conflicts = Shift.objects.filter(
                    staff_user=staff_user,
                    start_time__lt=request.original_shift.end_time,
                    end_time__gt=request.original_shift.start_time
                ).exclude(status__in=['cancelled', 'rejected'])
                
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
        # Track original status to detect changes
        self._original_status = self.status

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

    def save(self, *args, **kwargs):
        # Calculate actual hours worked
        if self.check_in_time and self.check_out_time:
            duration = self.check_out_time - self.check_in_time
            hours_worked = duration.total_seconds() / 3600
            break_hours = self.break_duration / 60
            self.actual_hours_worked = round(hours_worked - break_hours, 2)

        # Auto-update status based on time and conditions
        now = timezone.now()
        if self.status == 'scheduled' and self.start_time <= now:
            self.status = 'active'
        elif self.status == 'active' and self.check_in_time:
            self.status = 'in_progress'
        elif self.status == 'in_progress' and self.check_out_time:
            self.status = 'pending_approval'
            
        # Auto-approve if conditions are met
        old_status = self._original_status
        if self.status == 'pending_approval' and self.end_signature and self.check_out_time:
            if self.venue.verify_location(
                self.check_out_location.get('latitude'),
                self.check_out_location.get('longitude')
            ):
                self.status = 'approved'
                self.manager_approved = True

        super().save(*args, **kwargs)
        
        # Auto-generate invoice when shift is approved
        if self.status == 'approved' and old_status != 'approved' and self.staff_user:
            self.auto_generate_invoice()

    def auto_generate_invoice(self):
        """Auto-generate invoice for staff when shift is approved"""
        try:
            # Get the shift date for invoice period
            shift_date = self.start_time.date()
            
            # Check if invoice already exists for this period
            existing_invoice = Invoice.objects.filter(
                staff_user=self.staff_user,
                start_date__lte=shift_date,
                end_date__gte=shift_date
            ).first()
            
            if not existing_invoice:
                # Generate invoice for the shift date
                Invoice.generate_for_staff_period(
                    staff_user=self.staff_user,
                    start_date=shift_date,
                    end_date=shift_date
                )
        except Exception as e:
            # Log error but don't fail the save operation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to auto-generate invoice for shift {self.id}: {str(e)}")

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
        shift_date = self.start_time.date()
        current_date = now.date()
        
        # Restriction 1: Must be the same date
        if shift_date != current_date:
            if shift_date > current_date:
                days_diff = (shift_date - current_date).days
                raise ValueError(f"Cannot check in {days_diff} day{'s' if days_diff > 1 else ''} early. You can only check in on the day of your shift ({shift_date.strftime('%B %d, %Y')}).")
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

    def calculate_payment(self):
        """Calculate the payment for this shift based on actual hours worked and hourly rate"""
        if not self.actual_hours_worked or not self.hourly_rate:
            return None
        
        from decimal import Decimal
        # Ensure both values are Decimal for proper calculation
        hours = Decimal(str(self.actual_hours_worked))
        rate = Decimal(str(self.hourly_rate))
        return hours * rate
    
    @property
    def calculated_payment(self):
        """Property to expose payment calculation through the API"""
        return self.calculate_payment()

    def get_effective_hourly_rate(self):
        """Get the effective hourly rate for this shift, falling back to system defaults if not set"""
        if self.hourly_rate:
            return self.hourly_rate
            
        # Fallback to system settings if no shift-specific rate is set
        try:
            from .models import SystemSettings
            settings = SystemSettings.objects.first()
            if settings:
                return settings.special_event_pay_rate if self.is_special_event else settings.default_hourly_rate
        except:
            pass
            
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
        except:
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
        except:
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

class ShiftCheck(models.Model):
    """Abstract base class for all types of checks during a shift"""
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    timestamp = models.DateTimeField()
    photo_evidence = models.URLField(max_length=500, null=True, blank=True)
    location = models.JSONField(null=True, blank=True, help_text="Latitude and longitude of check location")
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if not self.timestamp:
            self.timestamp = timezone.now()
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
        """Target user accepts the exchange request"""
        if self.status != 'pending':
            raise ValueError("Can only accept pending requests")
            
        self.status = 'accepted_by_target'
        self.target_response = response
        self.save()

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
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('rejected', 'Rejected'),
    )

    staff_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices')
    start_date = models.DateField()
    end_date = models.DateField()
    total_hours = models.DecimalField(max_digits=10, decimal_places=2)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    pdf_url = models.URLField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice for {self.staff_user.username} ({self.start_date} to {self.end_date})"
    
    @classmethod
    def generate_for_staff_period(cls, staff_user, start_date, end_date):
        """Generate an invoice for a staff member for a specific period using shift-specific payments"""
        from decimal import Decimal
        
        # Check if an invoice already exists for this staff member and period
        existing_invoice = cls.objects.filter(
            staff_user=staff_user,
            start_date=start_date,
            end_date=end_date
        ).first()
        
        if existing_invoice:
            print(f"Invoice already exists for {staff_user.username} for period {start_date} to {end_date}")
            return existing_invoice
        
        # Get all approved shifts for the staff member in the date range
        shifts = Shift.objects.filter(
            staff_user=staff_user,
            start_time__date__gte=start_date,
            start_time__date__lte=end_date,
            status='approved',
            actual_hours_worked__isnull=False
        ).order_by('start_time')
        
        if not shifts:
            raise ValueError(f"No approved shifts found for {staff_user.username} between {start_date} and {end_date}")
        
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
            status='pending'
        )
        
        # Create invoice items for each shift
        for shift in shifts:
            if shift.actual_hours_worked and shift.calculate_payment():
                InvoiceItem.objects.create(
                    invoice=invoice,
                    shift=shift,
                    date=shift.start_time.date(),
                    venue=shift.venue,
                    hours_worked=shift.actual_hours_worked,
                    rate=shift.get_effective_hourly_rate(),
                    amount=shift.calculate_payment()
                )
        
        return invoice
    
    @property
    def payment_breakdown(self):
        """Get detailed payment breakdown by rate type"""
        return self.get_payment_breakdown()
    
    def get_payment_breakdown(self):
        """Get detailed payment breakdown by rate type"""
        from decimal import Decimal
        
        regular_shifts = self.items.filter(shift__is_special_event=False)
        special_event_shifts = self.items.filter(shift__is_special_event=True)
        
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
        
        return {
            'regular_shifts': {
                'count': regular_shifts.count(),
                'hours': regular_hours,
                'amount': regular_amount,
                'average_rate': regular_amount / regular_hours if regular_hours > 0 else Decimal('0.00')
            },
            'special_event_shifts': {
                'count': special_event_shifts.count(),
                'hours': special_hours,
                'amount': special_amount,
                'average_rate': special_amount / special_hours if special_hours > 0 else Decimal('0.00')
            },
            'total': {
                'count': self.items.count(),
                'hours': self.total_hours,
                'amount': self.total_amount
            }
        }

class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='invoice_items')
    date = models.DateField()
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='invoice_items')
    hours_worked = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invoice_items'
        ordering = ['date']

    def __str__(self):
        return f"{self.date} - {self.venue.name} ({self.hours_worked} hours)"

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
    def get_settings(cls):
        """Get the system settings or create default if none exist"""
        # Ensure default value for the new field is set if creating the instance
        settings, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'special_event_pay_rate': 18.00 # Ensure this matches the field's default
            }
        )
        # If instance already existed but lacks the new field (e.g., old data), set it.
        if not created and settings.special_event_pay_rate is None:
             settings.special_event_pay_rate = 18.00
             settings.save()
             
        return settings


class EmploymentType(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="Employment type name (e.g., 'Contract Workers', 'Temporary Staff')")
    description = models.TextField(help_text="Description of this employment type")
    is_active = models.BooleanField(default=True, help_text="Whether this employment type is currently available")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employment_types'
        ordering = ['name']

    def __str__(self):
        return self.name


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
    email = models.EmailField(unique=True)
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
        """Convert approved application to a User and StaffProfile"""
        if self.status != 'approved':
            raise ValueError("Can only convert approved applications")
        
        if self.converted_to_user:
            raise ValueError("Application has already been converted")
        
        # Create user account
        username = self.email.split('@')[0]
        counter = 1
        original_username = username
        
        # Ensure unique username
        while User.objects.filter(username=username).exists():
            username = f"{original_username}{counter}"
            counter += 1
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=self.email,
            first_name=self.full_name.split()[0],
            last_name=' '.join(self.full_name.split()[1:]) if len(self.full_name.split()) > 1 else '',
            role='staff'
        )
        
        # Create staff profile
        staff_profile = StaffProfile.objects.create(
            user=user,
            phone_number=self.phone_number,
            date_of_birth=self.date_of_birth,
            national_insurance_number=None,  # Will be filled during onboarding
            street=self.home_address,
            city='',  # Will need to be filled later
            postal_code=self.postcode,
            country='UK',
            is_approved=True  # Pre-approved since application was approved
        )
        
        # Create SIA License if applicable
        if self.has_sia_licence and self.sia_licence_number:
            # Map recruitment form license types to SIA license types
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
                # Convert long format to short format
                short_licence_type = licence_type_mapping.get(licence_type, licence_type)
                
                SIALicense.objects.create(
                    staff_profile=staff_profile,
                    license_number=self.sia_licence_number,
                    license_type=short_licence_type,
                    issue_date=timezone.now().date(),  # Will need to be updated
                    expiry_date=self.licence_expiry_date,
                    status='valid',
                    document_url=''  # Will need to be uploaded later
                )
        
        # Create qualifications
        for cert in self.certifications:
            if cert != 'other':
                SecurityQualification.objects.create(
                    staff_profile=staff_profile,
                    qualification_type=cert,
                    provider='Unknown',  # Will need to be updated
                    certificate_number='',  # Will need to be updated
                    issue_date=timezone.now().date(),
                    document_url=''  # Will need to be uploaded later
                )
        
        # Link the converted user
        self.converted_to_user = user
        self.save()
        
        return user
