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

class StaffProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=20)
    date_of_birth = models.DateField()
    national_insurance_number = models.CharField(max_length=20, unique=True)
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
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
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
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    required_security_role = models.CharField(max_length=20)
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    check_in_location = models.JSONField(null=True, blank=True, help_text="Latitude and longitude of check-in location")
    check_out_location = models.JSONField(null=True, blank=True, help_text="Latitude and longitude of check-out location")
    start_signature = models.TextField(help_text="base64", null=True, blank=True)
    end_signature = models.TextField(null=True, blank=True, help_text="base64")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    manager_approved = models.BooleanField(default=False)
    manager_signature = models.TextField(null=True, blank=True, help_text="base64")
    manager_notes = models.TextField(null=True, blank=True)
    manager_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_shifts')
    terms_accepted = models.BooleanField(default=False, help_text="whether venue terms were accepted for this shift")
    actual_hours_worked = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    break_duration = models.IntegerField(default=0, help_text="Break duration in minutes")
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

    def __str__(self):
        staff_name = self.staff_user.username if self.staff_user else "Unassigned"
        return f"{staff_name} at {self.venue.name} ({self.start_time})"

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
        if self.status == 'pending_approval' and self.end_signature and self.check_out_time:
            if self.venue.verify_location(
                self.check_out_location.get('latitude'),
                self.check_out_location.get('longitude')
            ):
                self.status = 'approved'
                self.manager_approved = True

        super().save(*args, **kwargs)

    def can_start_shift(self):
        """Check if staff can start this shift"""
        if not self.staff_user:
            return False, "No staff assigned to shift"
            
        # Check if staff has accepted venue terms
        if not VenueTermsAcceptance.has_accepted_terms(self.staff_user, self.venue):
            return False, "Must accept venue terms before starting shift"
            
        return True, "OK"

    def check_in(self, latitude, longitude, signature=None):
        """Staff checks in for their shift with location verification"""
        # First verify they can start the shift
        can_start, message = self.can_start_shift()
        if not can_start:
            raise ValueError(message)
            
        if self.status != 'active':
            raise ValueError("Shift must be active to check in")
        
        if not self.venue.verify_location(latitude, longitude):
            raise ValueError("Location verification failed")
        
        self.check_in_time = timezone.now()
        self.check_in_location = {'latitude': latitude, 'longitude': longitude}
        if signature:
            self.start_signature = signature
        self.status = 'in_progress'
        self.save()

    def check_out(self, latitude, longitude, signature=None):
        """Staff checks out from their shift with location verification"""
        if self.status != 'in_progress':
            raise ValueError("Shift must be in progress to check out")
        
        if not self.venue.verify_location(latitude, longitude):
            raise ValueError("Location verification failed")
        
        self.check_out_time = timezone.now()
        self.check_out_location = {'latitude': latitude, 'longitude': longitude}
        if signature:
            self.end_signature = signature
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
        if self.requesting_user == self.target_user:
            raise ValueError("Cannot exchange shift with yourself")
            
        if self.original_shift.start_time <= timezone.now():
            raise ValueError("Cannot exchange shifts that have already started")
            
        if not self.target_user.has_security_role(self.original_shift.required_security_role):
            raise ValueError("Target user does not have the required security role for this shift")
            
        # Check if target user already has a shift at this time
        conflicting_shifts = Shift.objects.filter(
            staff_user=self.target_user,
            start_time__lt=self.original_shift.end_time,
            end_time__gt=self.original_shift.start_time
        ).exclude(status__in=['cancelled', 'rejected'])
        
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
            
        # Create a new shift for the target user
        new_shift = self.original_shift
        new_shift.staff_user = self.target_user
        new_shift.status = 'scheduled'
        new_shift.save()
        
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
