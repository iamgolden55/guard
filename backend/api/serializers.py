from rest_framework import serializers
from django.contrib.auth import get_user_model
from .utils.shift_validators import check_shift_overlap
from .models import (
    User, StaffProfile, EmergencyContact, BankDetails, SIALicense,
    StaffAvailability, Venue, VenueTermsAcceptance, PreferredVenue,
    Shift, FireExitCheck, CapacityCheck, ToiletCheck, TimeAdjustment,
    ShiftExchange, OpenShiftRequest, Invoice, InvoiceItem, PayRate, DeputyConfig,
    DeputyEmployee, DeputyTimesheet, ShiftTemplate, SystemSettings,
    EmploymentType, RecruitmentApplication, EnforcementVisit,
    WorkingHoursRegulation, ComplianceProfile, ComplianceViolation, WorkingHoursMetrics,
    ReportTemplate, ReportJob,
    # Onboarding models
    SecurityCompany, CompanyOnboarding, CompanyIntegration, UserCompanyMembership,
    # Notification models
    SNSDeviceToken, NotificationPreferences,
    # Password reset models
    PasswordResetToken,
    # Leave/Availability models
    ContractorUnavailability, BankHoliday, StaffLeaveDailyRate,
    EMPLOYMENT_CATEGORY_CHOICES
)

User = get_user_model() # Ensure User model is fetched

class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class BankDetailsSerializer(serializers.ModelSerializer):
    # Add camelCase aliases for frontend compatibility
    accountName = serializers.CharField(source='account_name', required=False, allow_blank=True)
    accountNumber = serializers.CharField(source='account_number', required=False, allow_blank=True)
    sortCode = serializers.CharField(source='sort_code', required=False, allow_blank=True)
    bankName = serializers.CharField(source='bank_name', required=False, allow_blank=True)

    class Meta:
        model = BankDetails
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'staff_profile')

    def to_internal_value(self, data):
        return super().to_internal_value(data)

    def to_representation(self, instance):
        # Hide sensitive data in responses
        representation = super().to_representation(instance)
        # Mask sensitive fields
        if 'account_number' in representation and representation['account_number']:
            representation['account_number'] = '****' + str(representation['account_number'])[-4:]
            representation['accountNumber'] = '****' + str(instance.account_number)[-4:]
        if 'sort_code' in representation and representation['sort_code']:
            representation['sort_code'] = '****' + str(representation['sort_code'])[-2:]
            representation['sortCode'] = '****' + str(instance.sort_code)[-2:]
        # Add camelCase versions
        representation['accountName'] = instance.account_name
        representation['bankName'] = instance.bank_name
        return representation

class SIALicenseSerializer(serializers.ModelSerializer):
    # Add camelCase aliases for frontend compatibility
    licenseNumber = serializers.CharField(source='license_number', read_only=True)
    licenseType = serializers.CharField(source='license_type', read_only=True)
    issueDate = serializers.DateField(source='issue_date', read_only=True)
    expiryDate = serializers.DateField(source='expiry_date', read_only=True)
    documentUrl = serializers.URLField(source='document_url', read_only=True)

    class Meta:
        model = SIALicense
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def to_representation(self, instance):
        """Add camelCase versions of all fields"""
        representation = super().to_representation(instance)
        # Ensure camelCase fields are always present
        representation['licenseNumber'] = instance.license_number
        representation['licenseType'] = instance.license_type
        representation['issueDate'] = instance.issue_date.isoformat() if instance.issue_date else None
        representation['expiryDate'] = instance.expiry_date.isoformat() if instance.expiry_date else None
        representation['documentUrl'] = instance.document_url if instance.document_url else None
        return representation

    def validate(self, data):
        # Ensure expiry date is after issue date
        if data.get('expiry_date') and data.get('issue_date'):
            if data['expiry_date'] <= data['issue_date']:
                raise serializers.ValidationError({
                    "expiry_date": "Expiry date must be after issue date"
                })
        return data

class StaffAvailabilitySerializer(serializers.ModelSerializer):
    day_of_week_display = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = StaffAvailability
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name',
                 'role', 'is_active', 'password', 'security_roles', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at', 'role', 'is_active')
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate_email(self, value):
        # Check for uniqueness, excluding self during updates
        query = User.objects.filter(email=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    # Override create to hash password
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role='staff',
            is_active=True,
            is_staff=False,
        )
        return user

    # Optional: Override update if you want password changes via PUT/PATCH
    def update(self, instance, validated_data):
        # Handle password update separately
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password) # Hashes the password

        # Update other fields as usual
        # Note: This assumes 'profile' is read-only and handled elsewhere if needed.
        profile_data = validated_data.pop('profile', None) # Exclude profile from direct update

        # SECURITY: Never allow these fields to be set via API updates
        PROTECTED_FIELDS = {'role', 'is_active', 'is_staff', 'is_superuser'}
        for attr, value in validated_data.items():
            if attr not in PROTECTED_FIELDS:
                setattr(instance, attr, value)

        instance.save()

        # If you need to update the profile, handle it here separately
        # if profile_data:
        #    profile_serializer = StaffProfileSerializer(instance.profile, data=profile_data, partial=True)
        #    if profile_serializer.is_valid():
        #        profile_serializer.save()
        #    else:
        #        # Handle profile validation errors if necessary
        #        pass

        return instance

class StaffProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    employment_type_details = serializers.SerializerMethodField()
    employment_type = serializers.SerializerMethodField()  # Full object for mobile compatibility
    emergency_contacts = EmergencyContactSerializer(many=True, read_only=True)
    bank_details = BankDetailsSerializer(required=False, allow_null=True)  # FIXED: Allow updates
    sia_licenses = SIALicenseSerializer(many=True, read_only=True)
    availability = StaffAvailabilitySerializer(many=True, read_only=True)

    # Add security roles from User model for frontend compatibility
    security_roles = serializers.ReadOnlyField(source='user.security_roles')

    # Add camelCase aliases for frontend compatibility
    securityRoles = serializers.ReadOnlyField(source='user.security_roles')
    siaLicenses = serializers.SerializerMethodField()
    bankDetails = serializers.SerializerMethodField()
    isApproved = serializers.ReadOnlyField(source='is_approved')
    employmentType = serializers.IntegerField(source='employment_type_id', required=False, allow_null=True)
    passwordLastChanged = serializers.DateTimeField(source='user.password_last_changed', read_only=True)

    # Add direct access to user fields for frontend compatibility
    firstName = serializers.CharField(source='user.first_name', read_only=True)
    lastName = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)

    def get_siaLicenses(self, obj):
        """Return SIA licenses in camelCase format for frontend compatibility"""
        return SIALicenseSerializer(obj.sia_licenses.all(), many=True).data

    def get_bankDetails(self, obj):
        """Return bank details in camelCase format for frontend compatibility"""
        from api.models import BankDetails
        try:
            bank_details = BankDetails.objects.filter(staff_profile=obj).first()
            if bank_details:
                return BankDetailsSerializer(bank_details).data
        except Exception:
            pass
        return None

    def get_employment_type_details(self, obj):
        """Return employment type details including employment_category for mobile navigation"""
        if obj.employment_type:
            return {
                'id': obj.employment_type.id,
                'name': obj.employment_type.name,
                'description': obj.employment_type.description,
                'employment_category': obj.employment_type.employment_category,
                'is_active': obj.employment_type.is_active
            }
        return None

    def get_employment_type(self, obj):
        """Return employment type object for mobile compatibility (same as employment_type_details)"""
        return self.get_employment_type_details(obj)

    def update(self, instance, validated_data):
        """Handle nested bank_details updates with atomic transaction"""
        from api.models import BankDetails
        from django.db import transaction
        import logging
        logger = logging.getLogger(__name__)

        # Extract bank_details from validated_data
        bank_details_data = validated_data.pop('bank_details', None)

        logger.info(f"=" * 80)
        logger.info(f"StaffProfileSerializer.update() called for profile {instance.id}")
        logger.info(f"Validated data keys: {list(validated_data.keys())}")
        logger.info(f"Bank details data: {bank_details_data}")
        logger.info(f"=" * 80)

        try:
            # Use atomic transaction to ensure data integrity
            with transaction.atomic():
                # Update regular StaffProfile fields
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()

                # Handle bank_details update/create
                if bank_details_data is not None:
                    logger.info(f"Processing bank details for profile {instance.id}")

                    # Get or create bank_details for this profile
                    bank_details, created = BankDetails.objects.get_or_create(
                        staff_profile=instance
                    )

                    # Update all bank details fields
                    for field in ['account_name', 'account_number', 'sort_code', 'bank_name']:
                        if field in bank_details_data:
                            setattr(bank_details, field, bank_details_data[field])

                    bank_details.save()

                    logger.info(f"Bank details {'created' if created else 'updated'} successfully for profile {instance.id}")

        except Exception as e:
            logger.error(f"Failed to update profile {instance.id}: {str(e)}", exc_info=True)
            raise  # Re-raise to let DRF handle the error response

        return instance

    def to_internal_value(self, data):
        """Map camelCase bankDetails to snake_case bank_details"""
        # If bankDetails is provided, map it to bank_details
        if 'bankDetails' in data:
            data['bank_details'] = data.pop('bankDetails')
        return super().to_internal_value(data)

    class Meta:
        model = StaffProfile
        fields = (
            'id', 'user', 'employment_type', 'employment_type_details', 'phone_number', 'date_of_birth', 'national_insurance_number',
            'street', 'city', 'postal_code', 'country', 'profile_image_url', 'notes',
            'password_last_changed', 'is_approved', 'created_at', 'updated_at',
            'emergency_contacts', 'bank_details', 'sia_licenses', 'availability',
            'security_roles', 'securityRoles', 'siaLicenses', 'bankDetails', 'isApproved', 'employmentType', 'passwordLastChanged',
            'firstName', 'lastName', 'email', 'username', 'role'
        )
        read_only_fields = ('created_at', 'updated_at', 'password_last_changed', 'passwordLastChanged', 'security_roles', 'securityRoles', 'siaLicenses', 'bankDetails', 'isApproved', 'firstName', 'lastName', 'email', 'username', 'role')

class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = (
            'id', 'name', 'address', 'city', 'postal_code', 'country',
            'is_active', 'capacity', 'latitude', 'longitude', 'check_radius',
            'contact_name', 'contact_phone', 'contact_email', 'description',
            'terms_and_conditions', 'terms_version', 'requires_fire_safety_checks',
            'requires_capacity_monitoring', 'requires_toilet_checks',
            'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at')

    def validate_capacity(self, value):
        """
        Validate that capacity is a positive integer.
        """
        if value <= 0:
            raise serializers.ValidationError("Capacity must be greater than zero")
        return value

    def validate_latitude(self, value):
        """
        Round latitude to 15 decimal places to match model constraints.
        Google Maps can return more precision than needed.
        """
        if value is not None:
            from decimal import Decimal, ROUND_HALF_UP
            return Decimal(str(value)).quantize(Decimal('0.000000000000001'), rounding=ROUND_HALF_UP)
        return value

    def validate_longitude(self, value):
        """
        Round longitude to 15 decimal places to match model constraints.
        Google Maps can return more precision than needed.
        """
        if value is not None:
            from decimal import Decimal, ROUND_HALF_UP
            return Decimal(str(value)).quantize(Decimal('0.000000000000001'), rounding=ROUND_HALF_UP)
        return value

    def create(self, validated_data):
        """
        Override create to ensure company is set.
        The company should be passed in via save(company=company) from the viewset.
        """
        if 'company' not in validated_data or validated_data['company'] is None:
            raise serializers.ValidationError({
                'company': 'Company is required when creating a venue. Please contact support if this issue persists.'
            })
        return super().create(validated_data)

class VenueTermsAcceptanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueTermsAcceptance
        fields = '__all__'
        read_only_fields = ('created_at',)

class PreferredVenueSerializer(serializers.ModelSerializer):
    venue_details = VenueSerializer(source='venue', read_only=True)

    class Meta:
        model = PreferredVenue
        fields = '__all__'
        read_only_fields = ('created_at',)

class FireExitCheckSerializer(serializers.ModelSerializer):
    # Add camelCase fields for frontend compatibility
    isPassed = serializers.BooleanField(source='is_clear', read_only=True)
    exitName = serializers.CharField(source='exit_name', read_only=True)
    comments = serializers.CharField(source='notes', read_only=True)
    # Multi-staff shift: performed_by details
    performed_by_details = serializers.SerializerMethodField()

    class Meta:
        model = FireExitCheck
        fields = '__all__'
        read_only_fields = ('created_at', 'shift_group', 'performed_by')

    def get_performed_by_details(self, obj):
        """Return details of the staff member who performed this check"""
        if obj.performed_by:
            return {
                'id': obj.performed_by.id,
                'first_name': obj.performed_by.first_name,
                'last_name': obj.performed_by.last_name,
            }
        return None

    def to_representation(self, instance):
        # Include both snake_case and camelCase for compatibility
        representation = super().to_representation(instance)
        representation['isPassed'] = instance.is_clear
        representation['exitName'] = instance.exit_name
        representation['comments'] = instance.notes or ''
        return representation

class CapacityCheckSerializer(serializers.ModelSerializer):
    # Add camelCase fields for frontend compatibility
    count = serializers.IntegerField(source='current_count', read_only=True)
    comments = serializers.CharField(source='notes', read_only=True)
    # Multi-staff shift: performed_by details
    performed_by_details = serializers.SerializerMethodField()

    class Meta:
        model = CapacityCheck
        fields = '__all__'
        read_only_fields = ('created_at', 'shift_group', 'performed_by')

    def get_performed_by_details(self, obj):
        """Return details of the staff member who performed this check"""
        if obj.performed_by:
            return {
                'id': obj.performed_by.id,
                'first_name': obj.performed_by.first_name,
                'last_name': obj.performed_by.last_name,
            }
        return None

    def validate_current_count(self, value):
        # Ensure count is not negative
        if value < 0:
            raise serializers.ValidationError("Capacity count cannot be negative")
        return value

    def to_representation(self, instance):
        # Include both snake_case and camelCase for compatibility
        representation = super().to_representation(instance)
        representation['count'] = instance.current_count
        representation['comments'] = instance.notes or ''
        return representation

class ToiletCheckSerializer(serializers.ModelSerializer):
    # Add camelCase fields for frontend compatibility
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    location = serializers.CharField(source='location_name', read_only=True)
    comments = serializers.CharField(source='notes', read_only=True)
    # Multi-staff shift: performed_by details
    performed_by_details = serializers.SerializerMethodField()

    class Meta:
        model = ToiletCheck
        fields = '__all__'
        read_only_fields = ('created_at', 'shift_group', 'performed_by')

    def get_performed_by_details(self, obj):
        """Return details of the staff member who performed this check"""
        if obj.performed_by:
            return {
                'id': obj.performed_by.id,
                'first_name': obj.performed_by.first_name,
                'last_name': obj.performed_by.last_name,
            }
        return None

    def to_representation(self, instance):
        # Include both snake_case and camelCase for compatibility
        representation = super().to_representation(instance)
        representation['location'] = instance.location_name
        representation['comments'] = instance.notes or ''
        return representation


class TimeAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer for time adjustments made to shifts

    Validates that adjustments are within reasonable bounds and calculates
    the payment impact of the adjustment.
    """
    adjusted_by_details = UserSerializer(source='adjusted_by', read_only=True)
    payment_impact = serializers.SerializerMethodField()

    class Meta:
        model = TimeAdjustment
        fields = '__all__'
        read_only_fields = (
            'created_at',
            'adjusted_by',
            'original_check_in_time',
            'original_check_out_time',
            'original_actual_hours',
        )

    def validate(self, data):
        """Validate time adjustment constraints"""
        from datetime import timedelta
        from decimal import Decimal

        shift = data.get('shift')
        adjusted_check_in = data.get('adjusted_check_in_time')
        adjusted_check_out = data.get('adjusted_check_out_time')
        adjusted_hours = data.get('adjusted_actual_hours')

        # Validate check-in time adjustment
        if adjusted_check_in:
            # Cannot be more than 2 hours before scheduled start
            max_early_checkin = shift.start_time - timedelta(hours=2)
            if adjusted_check_in < max_early_checkin:
                raise serializers.ValidationError({
                    'adjusted_check_in_time': f"Adjusted check-in cannot be more than 2 hours before scheduled start time ({shift.start_time})"
                })

        # Validate check-out time adjustment
        if adjusted_check_out:
            # Cannot be more than 4 hours after scheduled end
            max_late_checkout = shift.end_time + timedelta(hours=4)
            if adjusted_check_out > max_late_checkout:
                raise serializers.ValidationError({
                    'adjusted_check_out_time': f"Adjusted check-out cannot be more than 4 hours after scheduled end time ({shift.end_time})"
                })

        # Check-out must be after check-in
        if adjusted_check_in and adjusted_check_out:
            if adjusted_check_out <= adjusted_check_in:
                raise serializers.ValidationError({
                    'adjusted_check_out_time': "Check-out time must be after check-in time"
                })

        # Adjusted hours cannot exceed 24
        if adjusted_hours and adjusted_hours > 24:
            raise serializers.ValidationError({
                'adjusted_actual_hours': "Adjusted hours cannot exceed 24 hours"
            })

        # Validate adjusted hours match calculated hours from times
        if adjusted_check_in and adjusted_check_out and adjusted_hours:
            duration = adjusted_check_out - adjusted_check_in
            calculated_hours = Decimal(str(duration.total_seconds() / 3600))
            # Allow small rounding differences
            if abs(calculated_hours - adjusted_hours) > Decimal('0.1'):
                raise serializers.ValidationError({
                    'adjusted_actual_hours': f"Adjusted hours ({adjusted_hours}) don't match calculated hours from times ({calculated_hours:.2f})"
                })

        # Require reason and signature
        if not data.get('reason'):
            raise serializers.ValidationError({
                'reason': "Reason for adjustment is required"
            })

        if not data.get('manager_signature'):
            raise serializers.ValidationError({
                'manager_signature': "Manager signature is required"
            })

        return data

    def create(self, validated_data):
        """Create time adjustment and store original shift times"""
        from decimal import Decimal

        shift = validated_data['shift']

        # Store original times from shift (use 0 if no hours worked yet)
        validated_data['original_check_in_time'] = shift.check_in_time
        validated_data['original_check_out_time'] = shift.check_out_time
        validated_data['original_actual_hours'] = shift.actual_hours_worked or Decimal('0.00')

        return super().create(validated_data)

    def get_payment_impact(self, obj):
        """Calculate the payment difference caused by this adjustment"""
        from decimal import Decimal

        shift = obj.shift

        # Calculate original payment
        original_hours = obj.original_actual_hours or Decimal('0.00')
        original_payment = original_hours * Decimal(str(shift.get_effective_hourly_rate() or 0))

        # Calculate adjusted payment
        adjusted_hours = obj.adjusted_actual_hours or Decimal('0.00')
        adjusted_payment = adjusted_hours * Decimal(str(shift.get_effective_hourly_rate() or 0))

        payment_difference = adjusted_payment - original_payment

        return {
            'original_hours': float(original_hours),
            'adjusted_hours': float(adjusted_hours),
            'original_payment': float(original_payment),
            'adjusted_payment': float(adjusted_payment),
            'payment_difference': float(payment_difference),
        }


class ShiftSerializer(serializers.ModelSerializer):
    fire_exit_checks = FireExitCheckSerializer(many=True, read_only=True)
    capacity_checks = CapacityCheckSerializer(many=True, read_only=True)
    toilet_checks = ToiletCheckSerializer(many=True, read_only=True)
    time_adjustments = TimeAdjustmentSerializer(many=True, read_only=True)
    venue_details = VenueSerializer(source='venue', read_only=True)
    staff_user_details = UserSerializer(source='staff_user', read_only=True)
    calculated_payment = serializers.ReadOnlyField()
    is_invoiced = serializers.SerializerMethodField()
    pending_exchange = serializers.SerializerMethodField()
    pending_release = serializers.SerializerMethodField()
    approved_transfer = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'calculated_payment', 'is_invoiced', 'auto_checkout', 'pending_exchange', 'pending_release', 'approved_transfer')

    def validate(self, data):
        # Validate end time is after start time
        if data.get('end_time') and data.get('start_time'):
            if data['end_time'] <= data['start_time']:
                raise serializers.ValidationError({
                    "end_time": "End time must be after start time"
                })

        # Validate hourly_rate is positive if provided
        if data.get('hourly_rate') is not None and data['hourly_rate'] <= 0:
            raise serializers.ValidationError({
                "hourly_rate": "Hourly rate must be positive"
            })

        # Get staff_user - either from data or from existing instance (for updates)
        staff_user = data.get('staff_user') or (self.instance.staff_user if self.instance else None)

        # Validate staff eligibility if staff_user is set
        if staff_user:
            profile = getattr(staff_user, 'profile', None)
            if not profile or not profile.is_eligible_for_shifts():
                raise serializers.ValidationError({
                    "staff_user": "Staff must have a valid SIA license and be admin approved to be assigned shifts."
                })

        # Get time values - either from data or from existing instance (for updates)
        start_time = data.get('start_time') or (self.instance.start_time if self.instance else None)
        end_time = data.get('end_time') or (self.instance.end_time if self.instance else None)

        # Check for overlapping shifts (regardless of shift_group)
        if staff_user and start_time and end_time:
            exclude_shift_id = self.instance.id if self.instance else None
            has_overlap, overlapping_shifts = check_shift_overlap(
                staff_user, start_time, end_time, exclude_shift_id
            )

            if has_overlap:
                first_conflict = overlapping_shifts.first()
                venue_name = first_conflict.venue.name if first_conflict.venue else 'Unknown venue'
                raise serializers.ValidationError({
                    "staff_user": f"This staff member already has a shift during this time: "
                    f"{first_conflict.start_time.strftime('%Y-%m-%d %H:%M')} - "
                    f"{first_conflict.end_time.strftime('%H:%M')} at {venue_name}"
                })

        # Check if staff is on approved leave
        if staff_user and start_time:
            from leave_management.models import LeaveRequest
            shift_date = start_time.date() if hasattr(start_time, 'date') else start_time
            shift_end_date = end_time.date() if end_time and hasattr(end_time, 'date') else shift_date
            if shift_date:
                on_leave = LeaveRequest.objects.filter(
                    staff_user=staff_user,
                    status='approved',
                    start_date__lte=shift_end_date,
                    end_date__gte=shift_date,
                ).exists()
                if on_leave:
                    raise serializers.ValidationError(
                        "This staff member has approved leave during this shift period."
                    )

        return data

    def get_is_invoiced(self, obj):
        """Check if shift has been invoiced"""
        return obj.invoice_items.exists()

    def get_pending_exchange(self, obj):
        """Get pending/in-progress exchange for this shift (if any)"""
        from .models import ShiftExchange

        # Look for pending/accepted exchanges where this shift is the original_shift
        exchange = ShiftExchange.objects.filter(
            original_shift=obj,
            status__in=['pending', 'accepted_by_target']
        ).select_related('target_user').first()

        if exchange:
            return {
                'id': exchange.id,
                'status': exchange.status,
                'target_user': {
                    'id': exchange.target_user.id,
                    'first_name': exchange.target_user.first_name,
                    'last_name': exchange.target_user.last_name,
                },
                'created_at': exchange.created_at.isoformat() if exchange.created_at else None,
                'request_reason': exchange.request_reason,
            }
        return None

    def get_pending_release(self, obj):
        """Get pending open shift request for this shift (if any)"""
        from .models import OpenShiftRequest

        release = OpenShiftRequest.objects.filter(
            original_shift=obj,
            status__in=['open', 'claimed']
        ).select_related('claimed_by').first()

        if release:
            result = {
                'id': release.id,
                'status': release.status,
                'created_at': release.created_at.isoformat() if release.created_at else None,
                'request_reason': release.request_reason,
            }
            if release.claimed_by:
                result['claimed_by'] = {
                    'id': release.claimed_by.id,
                    'first_name': release.claimed_by.first_name,
                    'last_name': release.claimed_by.last_name,
                }
            return result
        return None

    def get_approved_transfer(self, obj):
        """Get recently approved transfer for this shift (last 7 days)"""
        from .models import ShiftExchange
        from django.utils import timezone
        from datetime import timedelta

        # Look for recently approved exchanges (within last 7 days)
        recent_cutoff = timezone.now() - timedelta(days=7)

        exchange = ShiftExchange.objects.filter(
            original_shift=obj,
            status='approved',
            updated_at__gte=recent_cutoff
        ).select_related('target_user').first()

        if exchange:
            return {
                'id': exchange.id,
                'target_user': {
                    'id': exchange.target_user.id,
                    'first_name': exchange.target_user.first_name,
                    'last_name': exchange.target_user.last_name,
                },
                'approved_at': exchange.updated_at.isoformat() if exchange.updated_at else None,
                'was_auto_approved': exchange.manager_user is None,
            }
        return None

class ShiftTemplateSerializer(serializers.ModelSerializer):
    venue_details = VenueSerializer(source='venue', read_only=True)
    
    class Meta:
        model = ShiftTemplate
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')
    
    def validate(self, data):
        # Validate days of week
        if 'days_of_week' in data and not isinstance(data['days_of_week'], list):
            raise serializers.ValidationError({
                "days_of_week": "Days of week must be a list of integers (0-6)"
            })
        
        # Validate end time is after start time
        if data.get('end_time') and data.get('start_time'):
            # Overnight shifts are okay (end_time < start_time)
            # But we need to ensure they're not equal
            if data['end_time'] == data['start_time']:
                raise serializers.ValidationError({
                    "end_time": "End time must not be equal to start time"
                })
        return data

class ShiftExchangeSerializer(serializers.ModelSerializer):
    original_shift_details = ShiftSerializer(source='original_shift', read_only=True)
    target_shift_details = ShiftSerializer(source='target_shift', read_only=True)
    requesting_user_details = UserSerializer(source='requesting_user', read_only=True)
    target_user_details = UserSerializer(source='target_user', read_only=True)

    class Meta:
        model = ShiftExchange
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'requesting_user')

class OpenShiftRequestSerializer(serializers.ModelSerializer):
    original_shift_details = ShiftSerializer(source='original_shift', read_only=True)
    requesting_user_details = UserSerializer(source='requesting_user', read_only=True)
    claimed_by_details = UserSerializer(source='claimed_by', read_only=True)
    manager_user_details = UserSerializer(source='manager_user', read_only=True)

    class Meta:
        model = OpenShiftRequest
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'claim_time')

class BankHolidaySerializer(serializers.ModelSerializer):
    """Serializer for BankHoliday model"""
    class Meta:
        model = BankHoliday
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'company')


class InvoiceItemSerializer(serializers.ModelSerializer):
    venue_details = VenueSerializer(source='venue', read_only=True)
    shift_details = ShiftSerializer(source='shift', read_only=True)
    bank_holiday_details = BankHolidaySerializer(source='bank_holiday', read_only=True)
    item_type_display = serializers.CharField(source='get_item_type_display', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = '__all__'
        read_only_fields = ('created_at',)

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    staff_user_details = UserSerializer(source='staff_user', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    payment_breakdown = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'payment_breakdown', 'source', 'created_by')

    def validate(self, data):
        # Validate date range
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] <= data['start_date']:
                raise serializers.ValidationError({
                    "end_date": "End date must be after start date"
                })
        return data

class PayRateSerializer(serializers.ModelSerializer):
    venue_details = VenueSerializer(source='venue', read_only=True)
    staff_user_details = UserSerializer(source='staff_user', read_only=True)

    class Meta:
        model = PayRate
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def validate_hourly_rate(self, value):
        # Ensure hourly rate is positive
        if value <= 0:
            raise serializers.ValidationError("Hourly rate must be positive")
        return value

class DeputyConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeputyConfig
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def to_representation(self, instance):
        # Hide API key in responses
        representation = super().to_representation(instance)
        representation['api_key'] = '****' if representation.get('api_key') else None
        return representation

class DeputyEmployeeSerializer(serializers.ModelSerializer):
    mapped_to_user_details = UserSerializer(source='mapped_to_user', read_only=True)

    class Meta:
        model = DeputyEmployee
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class DeputyTimesheetSerializer(serializers.ModelSerializer):
    employee_details = DeputyEmployeeSerializer(source='employee', read_only=True)
    mapped_to_shift_details = ShiftSerializer(source='mapped_to_shift', read_only=True)

    class Meta:
        model = DeputyTimesheet
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def validate(self, data):
        # Validate timesheet times
        if data.get('end_time') and data.get('start_time'):
            if data['end_time'] <= data['start_time']:
                raise serializers.ValidationError({
                    "end_time": "End time must be after start time"
                })
        
        # Validate break length
        if data.get('break_length', 0) < 0:
            raise serializers.ValidationError({
                "break_length": "Break length cannot be negative"
            })
        return data

class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')


class EmploymentTypeSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()

    class Meta:
        model = EmploymentType
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'company')

    def get_application_count(self, obj):
        """Return count of applications for this employment type"""
        return obj.applications.count()

    def validate_name(self, value):
        """Validate employment type name is not empty and unique per company"""
        if not value.strip():
            raise serializers.ValidationError("Employment type name cannot be empty")

        # Get company from context (set by viewset)
        company = self.context.get('company')

        # Check uniqueness per company during update
        if self.instance:
            existing = EmploymentType.objects.filter(
                company=company,
                name=value
            ).exclude(pk=self.instance.pk)
        else:
            # For creation, check if name exists for this company
            if company:
                existing = EmploymentType.objects.filter(company=company, name=value)
            else:
                # If no company context, check globally (fallback)
                existing = EmploymentType.objects.filter(name=value)

        if existing.exists():
            raise serializers.ValidationError("Employment type with this name already exists for your company")

        return value.strip()


class RecruitmentApplicationSerializer(serializers.ModelSerializer):
    employment_type_details = EmploymentTypeSerializer(source='employment_type', read_only=True)
    reviewed_by_details = UserSerializer(source='reviewed_by', read_only=True)
    converted_user_details = UserSerializer(source='converted_to_user', read_only=True)
    
    class Meta:
        model = RecruitmentApplication
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'reviewed_by', 'reviewed_at', 'converted_to_user')
    
    def validate_email(self, value):
        """Validate email is unique"""
        if self.instance:
            existing = RecruitmentApplication.objects.filter(email=value).exclude(pk=self.instance.pk)
        else:
            existing = RecruitmentApplication.objects.filter(email=value)
        
        if existing.exists():
            raise serializers.ValidationError("An application with this email already exists")
        
        return value
    
    def validate_date_of_birth(self, value):
        """Validate applicant is at least 18 years old"""
        from datetime import date
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        
        if age < 18:
            raise serializers.ValidationError("Applicant must be at least 18 years old")
        
        return value
    
    def validate_hours_per_week(self, value):
        """Validate hours per week is reasonable"""
        if value < 0:
            raise serializers.ValidationError("Hours per week cannot be negative")
        if value > 168:  # 7 days * 24 hours
            raise serializers.ValidationError("Hours per week cannot exceed 168")
        
        return value
    
    def validate(self, data):
        """Custom validation for the entire application"""
        # If they have SIA licence, licence number and types are required
        if data.get('has_sia_licence', False):
            if not data.get('sia_licence_number'):
                raise serializers.ValidationError({
                    "sia_licence_number": "SIA licence number is required when you have a licence"
                })
            if not data.get('licence_types'):
                raise serializers.ValidationError({
                    "licence_types": "At least one licence type must be selected"
                })
            if not data.get('licence_expiry_date'):
                raise serializers.ValidationError({
                    "licence_expiry_date": "Licence expiry date is required"
                })
        
        # If licence is suspended/revoked, details are required
        if data.get('licence_suspended_revoked', False):
            if not data.get('licence_suspension_details'):
                raise serializers.ValidationError({
                    "licence_suspension_details": "Please provide details about licence suspension/revocation"
                })
        
        # If they have commitments, details are required
        if data.get('has_commitments', False):
            if not data.get('commitments_details'):
                raise serializers.ValidationError({
                    "commitments_details": "Please provide details about your current commitments"
                })
        
        # If they have security experience, details are required
        if data.get('has_security_experience', False):
            if not data.get('security_experience_details'):
                raise serializers.ValidationError({
                    "security_experience_details": "Please provide details about your security experience"
                })
        
        # If they have criminal convictions, details are required
        if data.get('has_criminal_convictions', False):
            if not data.get('criminal_convictions_details'):
                raise serializers.ValidationError({
                    "criminal_convictions_details": "Please provide details about your criminal convictions"
                })
        
        # If they have 'other' certifications, details are required
        if 'other' in data.get('certifications', []):
            if not data.get('other_certification_details'):
                raise serializers.ValidationError({
                    "other_certification_details": "Please provide details about your other certifications"
                })
        
        return data


class RecruitmentApplicationPublicSerializer(serializers.ModelSerializer):
    """Serializer for public recruitment application submission (no admin fields)"""
    
    class Meta:
        model = RecruitmentApplication
        fields = (
            'full_name', 'date_of_birth', 'email', 'phone_number', 'home_address', 'postcode',
            'has_sia_licence', 'sia_licence_number', 'licence_types', 'licence_expiry_date',
            'licence_suspended_revoked', 'licence_suspension_details', 'employment_type',
            'hours_per_week', 'availability_days', 'availability_nights', 'availability_weekends',
            'availability_holidays', 'willing_to_travel', 'has_transport', 'has_commitments',
            'commitments_details', 'has_security_experience', 'security_experience_details',
            'certifications', 'other_certification_details', 'eligible_to_work_uk',
            'has_criminal_convictions', 'criminal_convictions_details', 'digital_signature'
        )
    
    def validate_email(self, value):
        """Validate email is unique"""
        if RecruitmentApplication.objects.filter(email=value).exists():
            raise serializers.ValidationError("An application with this email already exists")
        return value
    
    def validate_date_of_birth(self, value):
        """Validate applicant is at least 18 years old"""
        from datetime import date
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        
        if age < 18:
            raise serializers.ValidationError("Applicant must be at least 18 years old")
        
        return value
    
    def validate(self, data):
        """Same validation as main serializer"""
        # If they have SIA licence, licence number and types are required
        if data.get('has_sia_licence', False):
            if not data.get('sia_licence_number'):
                raise serializers.ValidationError({
                    "sia_licence_number": "SIA licence number is required when you have a licence"
                })
            if not data.get('licence_types'):
                raise serializers.ValidationError({
                    "licence_types": "At least one licence type must be selected"
                })
            if not data.get('licence_expiry_date'):
                raise serializers.ValidationError({
                    "licence_expiry_date": "Licence expiry date is required"
                })
        
        # If licence is suspended/revoked, details are required
        if data.get('licence_suspended_revoked', False):
            if not data.get('licence_suspension_details'):
                raise serializers.ValidationError({
                    "licence_suspension_details": "Please provide details about licence suspension/revocation"
                })
        
        # If they have commitments, details are required
        if data.get('has_commitments', False):
            if not data.get('commitments_details'):
                raise serializers.ValidationError({
                    "commitments_details": "Please provide details about your current commitments"
                })
        
        # If they have security experience, details are required
        if data.get('has_security_experience', False):
            if not data.get('security_experience_details'):
                raise serializers.ValidationError({
                    "security_experience_details": "Please provide details about your security experience"
                })
        
        # If they have criminal convictions, details are required
        if data.get('has_criminal_convictions', False):
            if not data.get('criminal_convictions_details'):
                raise serializers.ValidationError({
                    "criminal_convictions_details": "Please provide details about your criminal convictions"
                })
        
        # If they have 'other' certifications, details are required
        if 'other' in data.get('certifications', []):
            if not data.get('other_certification_details'):
                raise serializers.ValidationError({
                    "other_certification_details": "Please provide details about your other certifications"
                })
        
        return data 


class EnforcementVisitSerializer(serializers.ModelSerializer):
    """Serializer for EnforcementVisit model"""
    
    class Meta:
        model = EnforcementVisit
        fields = [
            'id', 'shift', 'timestamp', 'officer_name', 
            'officer_badge', 'reason_for_visit', 'action_taken', 'outcome'
        ]
        read_only_fields = ['id', 'timestamp']
        
    def validate(self, data):
        """Validate enforcement visit data"""
        # Ensure all required fields are provided
        required_fields = ['officer_name', 'officer_badge', 'reason_for_visit', 'action_taken', 'outcome']
        for field in required_fields:
            if not data.get(field):
                raise serializers.ValidationError({field: f"{field.replace('_', ' ').title()} is required"})

        return data


# =============================================================================
# COMPLIANCE SYSTEM SERIALIZERS
# =============================================================================

class WorkingHoursRegulationSerializer(serializers.ModelSerializer):
    """Serializer for WorkingHoursRegulation model"""

    country_name_display = serializers.CharField(source='__str__', read_only=True)

    class Meta:
        model = WorkingHoursRegulation
        fields = [
            'id', 'country_code', 'country_name', 'country_name_display',
            'standard_weekly_hours', 'standard_daily_hours',
            'overtime_threshold_hours', 'overtime_multiplier_1',
            'overtime_threshold_2', 'overtime_multiplier_2',
            'max_daily_hours', 'max_weekly_hours', 'max_consecutive_days',
            'min_rest_between_shifts_hours', 'min_weekly_rest_hours',
            'break_duration_minutes', 'break_trigger_hours',
            'special_rules', 'security_sector_overrides', 'break_requirements',
            'night_shift_rules', 'opt_out_provisions', 'state_overrides',
            'industry_specific_rules', 'last_regulatory_update', 'regulatory_source',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'country_name_display', 'last_regulatory_update']

    def validate_country_code(self, value):
        """Validate country code format"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Country code must be at least 2 characters")
        return value.upper().strip()

    def validate(self, data):
        """Validate regulation data consistency"""
        errors = {}

        # Standard hours validation
        if data.get('standard_daily_hours', 0) > data.get('max_daily_hours', 24):
            errors['standard_daily_hours'] = "Standard daily hours cannot exceed maximum daily hours"

        if data.get('standard_weekly_hours', 0) > data.get('max_weekly_hours', 168):
            errors['standard_weekly_hours'] = "Standard weekly hours cannot exceed maximum weekly hours"

        # Overtime threshold validation
        overtime_1 = data.get('overtime_threshold_hours')
        overtime_2 = data.get('overtime_threshold_2')
        if overtime_1 and overtime_2 and overtime_2 <= overtime_1:
            errors['overtime_threshold_2'] = "Second overtime threshold must be higher than first"

        # Break validation
        if data.get('break_trigger_hours', 0) > data.get('max_daily_hours', 24):
            errors['break_trigger_hours'] = "Break trigger hours cannot exceed maximum daily hours"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class ComplianceProfileSerializer(serializers.ModelSerializer):
    """Serializer for ComplianceProfile model"""

    working_hours_regulation_data = WorkingHoursRegulationSerializer(
        source='working_hours_regulation', read_only=True
    )
    effective_max_daily_hours = serializers.DecimalField(
        max_digits=3, decimal_places=1, read_only=True, source='get_max_daily_hours'
    )
    effective_max_weekly_hours = serializers.DecimalField(
        max_digits=4, decimal_places=1, read_only=True, source='get_max_weekly_hours'
    )
    effective_max_consecutive_days = serializers.IntegerField(
        read_only=True, source='get_max_consecutive_days'
    )

    class Meta:
        model = ComplianceProfile
        fields = [
            'id', 'name', 'description', 'working_hours_regulation',
            'working_hours_regulation_data', 'override_max_daily_hours',
            'override_max_weekly_hours', 'override_max_consecutive_days',
            'daily_hours_warning_threshold', 'weekly_hours_warning_threshold',
            'consecutive_days_warning_threshold', 'auto_approve_overtime',
            'auto_approve_extended_hours', 'require_manager_approval',
            'notify_on_warnings', 'notify_on_violations', 'notification_recipients',
            'grace_period_minutes', 'allow_break_flexibility', 'custom_rules',
            'exception_roles', 'is_active', 'effective_max_daily_hours',
            'effective_max_weekly_hours', 'effective_max_consecutive_days',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'working_hours_regulation_data',
            'effective_max_daily_hours', 'effective_max_weekly_hours',
            'effective_max_consecutive_days'
        ]

    def validate(self, data):
        """Validate compliance profile settings"""
        errors = {}

        # Validate overrides don't exceed regulation maximums
        regulation = data.get('working_hours_regulation')
        if regulation:
            if data.get('override_max_daily_hours'):
                if data['override_max_daily_hours'] > regulation.max_daily_hours:
                    errors['override_max_daily_hours'] = f"Cannot exceed regulation maximum of {regulation.max_daily_hours} hours"

            if data.get('override_max_weekly_hours'):
                if data['override_max_weekly_hours'] > regulation.max_weekly_hours:
                    errors['override_max_weekly_hours'] = f"Cannot exceed regulation maximum of {regulation.max_weekly_hours} hours"

            if data.get('override_max_consecutive_days'):
                if data['override_max_consecutive_days'] > regulation.max_consecutive_days:
                    errors['override_max_consecutive_days'] = f"Cannot exceed regulation maximum of {regulation.max_consecutive_days} days"

        # Validate warning thresholds
        daily_threshold = data.get('daily_hours_warning_threshold', 80)
        if daily_threshold < 50 or daily_threshold >= 100:
            errors['daily_hours_warning_threshold'] = "Warning threshold must be between 50% and 99%"

        weekly_threshold = data.get('weekly_hours_warning_threshold', 85)
        if weekly_threshold < 50 or weekly_threshold >= 100:
            errors['weekly_hours_warning_threshold'] = "Warning threshold must be between 50% and 99%"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class ComplianceViolationSerializer(serializers.ModelSerializer):
    """Serializer for ComplianceViolation model"""

    user_data = serializers.SerializerMethodField()
    shift_data = serializers.SerializerMethodField()
    violation_type_display = serializers.CharField(source='get_violation_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    resolution_status_display = serializers.CharField(source='get_resolution_status_display', read_only=True)
    duration_hours = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True, source='duration_hours')
    is_resolved = serializers.BooleanField(read_only=True, source='is_resolved')
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model = ComplianceViolation
        fields = [
            'id', 'user', 'user_data', 'violation_type', 'violation_type_display',
            'severity', 'severity_display', 'period_start', 'period_end',
            'shift', 'shift_data', 'description', 'calculated_values',
            'threshold_exceeded', 'evidence_data', 'system_generated',
            'resolution_status', 'resolution_status_display', 'resolution_notes',
            'resolved_by', 'resolved_by_name', 'resolved_at', 'exception_granted',
            'exception_reason', 'approved_by', 'approved_by_name', 'financial_impact',
            'compliance_score_impact', 'duration_hours', 'is_resolved',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user_data', 'shift_data', 'violation_type_display',
            'severity_display', 'resolution_status_display', 'duration_hours',
            'is_resolved', 'resolved_by_name', 'approved_by_name', 'created_at',
            'updated_at'
        ]

    def get_user_data(self, obj):
        """Get basic user information"""
        if obj.user:
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'full_name': obj.user.get_full_name(),
                'email': obj.user.email
            }
        return None

    def get_shift_data(self, obj):
        """Get basic shift information if available"""
        if obj.shift:
            return {
                'id': obj.shift.id,
                'venue_name': obj.shift.venue.name if obj.shift.venue else None,
                'start_time': obj.shift.start_time,
                'end_time': obj.shift.end_time,
                'status': obj.shift.status
            }
        return None

    def validate(self, data):
        """Validate violation data"""
        errors = {}

        # Validate period dates
        period_start = data.get('period_start')
        period_end = data.get('period_end')
        if period_start and period_end and period_start >= period_end:
            errors['period_end'] = "End time must be after start time"

        # Validate threshold exceeded is provided for appropriate violation types
        violation_type = data.get('violation_type')
        threshold_types = ['daily_overtime', 'weekly_overtime', 'consecutive_days']
        if violation_type in threshold_types and not data.get('threshold_exceeded'):
            errors['threshold_exceeded'] = f"Threshold exceeded value required for {violation_type} violations"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class ComplianceViolationResolveSerializer(serializers.Serializer):
    """Serializer for resolving compliance violations"""

    resolution_notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    exception_granted = serializers.BooleanField(default=False)
    exception_reason = serializers.CharField(
        max_length=500, required=False, allow_blank=True,
        help_text="Required if exception_granted is True"
    )

    def validate(self, data):
        """Validate resolution data"""
        if data.get('exception_granted') and not data.get('exception_reason'):
            raise serializers.ValidationError({
                'exception_reason': 'Exception reason is required when granting an exception'
            })
        return data


class WorkingHoursMetricsSerializer(serializers.ModelSerializer):
    """Serializer for WorkingHoursMetrics model"""

    user_data = serializers.SerializerMethodField()
    period_type_display = serializers.CharField(source='get_period_type_display', read_only=True)
    overtime_percentage = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()

    class Meta:
        model = WorkingHoursMetrics
        fields = [
            'id', 'user', 'user_data', 'period_type', 'period_type_display',
            'period_start', 'period_end', 'total_hours_worked', 'regular_hours',
            'overtime_hours', 'break_hours', 'total_shifts', 'completed_shifts',
            'cancelled_shifts', 'no_show_shifts', 'late_arrivals', 'early_departures',
            'average_shift_length', 'longest_shift_hours', 'shortest_shift_hours',
            'violation_count', 'warning_count', 'compliance_score',
            'overtime_cost', 'penalty_cost', 'overtime_percentage', 'completion_rate',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'user_data', 'period_type_display', 'overtime_percentage',
            'completion_rate', 'created_at', 'updated_at'
        ]

    def get_user_data(self, obj):
        """Get basic user information"""
        if obj.user:
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'full_name': obj.user.get_full_name()
            }
        return None

    def get_overtime_percentage(self, obj):
        """Calculate overtime as percentage of total hours"""
        if obj.total_hours_worked > 0:
            return round((float(obj.overtime_hours) / float(obj.total_hours_worked)) * 100, 2)
        return 0

    def get_completion_rate(self, obj):
        """Calculate shift completion rate"""
        if obj.total_shifts > 0:
            return round((obj.completed_shifts / obj.total_shifts) * 100, 2)
        return 0


class ComplianceCheckSerializer(serializers.Serializer):
    """Serializer for real-time compliance checking"""

    user_id = serializers.IntegerField()
    shift_start = serializers.DateTimeField()
    shift_end = serializers.DateTimeField()
    venue_id = serializers.IntegerField(required=False)

    def validate(self, data):
        """Validate compliance check data"""
        errors = {}

        # Validate time period
        if data['shift_start'] >= data['shift_end']:
            errors['shift_end'] = "Shift end must be after shift start"

        # Validate user exists
        try:
            User.objects.get(id=data['user_id'])
        except User.DoesNotExist:
            errors['user_id'] = "User not found"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class BulkViolationResolveSerializer(serializers.Serializer):
    """Serializer for bulk violation resolution"""

    violation_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="List of violation IDs to resolve"
    )
    resolution_notes = serializers.CharField(
        max_length=1000, required=False, allow_blank=True,
        help_text="Notes applied to all violations"
    )
    exception_granted = serializers.BooleanField(default=False)
    exception_reason = serializers.CharField(
        max_length=500, required=False, allow_blank=True,
        help_text="Reason for exception (required if exception_granted is True)"
    )

    def validate(self, data):
        """Validate bulk resolution data"""
        errors = {}

        # Check if exception reason is provided when needed
        if data.get('exception_granted') and not data.get('exception_reason'):
            errors['exception_reason'] = 'Exception reason is required when granting exceptions'

        # Validate all violation IDs exist and are not already resolved
        violation_ids = data['violation_ids']
        existing_violations = ComplianceViolation.objects.filter(
            id__in=violation_ids
        ).values_list('id', flat=True)

        missing_ids = set(violation_ids) - set(existing_violations)
        if missing_ids:
            errors['violation_ids'] = f"Violations not found: {list(missing_ids)}"

        if errors:
            raise serializers.ValidationError(errors)

        return data


# =============================================================================
# REGIONAL COMPLIANCE API SERIALIZERS
# =============================================================================

class RegionDetectionSerializer(serializers.Serializer):
    """Serializer for region detection request"""

    venue_id = serializers.IntegerField(required=False, help_text="Venue ID for location-based detection")
    lat = serializers.DecimalField(
        max_digits=18, decimal_places=15, required=False,
        help_text="Latitude for coordinates-based detection"
    )
    lng = serializers.DecimalField(
        max_digits=18, decimal_places=15, required=False,
        help_text="Longitude for coordinates-based detection"
    )
    ip_address = serializers.CharField(
        required=False, max_length=15, help_text="IP address for IP-based detection"
    )

    def validate(self, data):
        """Ensure at least one detection method is provided"""
        if not any([data.get('venue_id'),
                   all([data.get('lat'), data.get('lng')]),
                   data.get('ip_address')]):
            raise serializers.ValidationError(
                "Must provide venue_id, coordinates (lat+lng), or ip_address"
            )
        return data


class RegionDetectionResponseSerializer(serializers.Serializer):
    """Serializer for region detection response"""

    region_code = serializers.CharField(help_text="Detected region code (e.g., 'UK', 'US-CA', 'EU-FR')")
    country_code = serializers.CharField(help_text="ISO country code")
    confidence_score = serializers.FloatField(help_text="Detection confidence (0.0-1.0)")
    detection_method = serializers.ChoiceField(
        choices=[
            ('venue', 'Venue Location'),
            ('coordinates', 'GPS Coordinates'),
            ('ip_geolocation', 'IP Geolocation'),
            ('fallback', 'Default Region')
        ]
    )
    regulation_id = serializers.IntegerField(help_text="Working hours regulation ID")
    notes = serializers.CharField(required=False, help_text="Additional detection notes")


class PresetApplicationSerializer(serializers.Serializer):
    """Serializer for applying regional presets"""

    region_code = serializers.CharField(help_text="Region code to apply (e.g., 'UK', 'US-CA', 'EU-FR')")
    profile_id = serializers.IntegerField(help_text="Compliance profile ID to update")
    override_existing = serializers.BooleanField(
        default=False, help_text="Whether to override existing custom settings"
    )

    def validate_region_code(self, value):
        """Validate region code format"""
        if not value or len(value.strip()) < 2:
            raise serializers.ValidationError("Invalid region code format")
        return value.upper().strip()


class PresetApplicationResponseSerializer(serializers.Serializer):
    """Serializer for preset application response"""

    success = serializers.BooleanField()
    profile_id = serializers.IntegerField()
    region_code = serializers.CharField()
    applied_settings = serializers.JSONField(help_text="Summary of applied settings")
    warnings = serializers.ListField(
        child=serializers.CharField(), required=False,
        help_text="Non-critical warnings during application"
    )


class RegulationComparisonSerializer(serializers.Serializer):
    """Serializer for multi-region regulation comparison"""

    regions = serializers.ListField(
        child=serializers.CharField(),
        min_length=2, max_length=10,
        help_text="List of region codes to compare"
    )
    include_sia_requirements = serializers.BooleanField(
        default=True, help_text="Include SIA licensing requirements in comparison"
    )
    include_break_rules = serializers.BooleanField(
        default=True, help_text="Include break and rest requirements"
    )
    include_overtime = serializers.BooleanField(
        default=True, help_text="Include overtime calculations"
    )

    def validate_regions(self, value):
        """Validate all region codes"""
        validated_regions = []
        for region in value:
            if not region or len(region.strip()) < 2:
                raise serializers.ValidationError(f"Invalid region code: {region}")
            validated_regions.append(region.upper().strip())
        return validated_regions


class RegulationComparisonResponseSerializer(serializers.Serializer):
    """Serializer for regulation comparison response"""

    comparison_matrix = serializers.JSONField(help_text="Matrix of regulation differences")
    key_differences = serializers.ListField(
        child=serializers.CharField(),
        help_text="Summary of major differences"
    )
    sia_requirements = serializers.JSONField(required=False, help_text="SIA licensing comparison")
    opt_out_provisions = serializers.JSONField(required=False, help_text="Working time opt-out rules")
    generated_at = serializers.DateTimeField(help_text="Comparison generation timestamp")


class ScheduleValidationSerializer(serializers.Serializer):
    """Serializer for schedule validation request"""

    user_id = serializers.IntegerField(help_text="Staff member ID")
    shifts = serializers.ListField(
        child=serializers.JSONField(),
        help_text="List of shift objects to validate"
    )
    venue_id = serializers.IntegerField(required=False, help_text="Venue for location-based rules")
    validation_date = serializers.DateField(required=False, help_text="Date to validate against")

    def validate_shifts(self, value):
        """Validate shift data structure"""
        required_fields = ['start', 'end', 'role']
        for i, shift in enumerate(value):
            for field in required_fields:
                if field not in shift:
                    raise serializers.ValidationError(
                        f"Shift {i+1} missing required field: {field}"
                    )
        return value


class ScheduleValidationResponseSerializer(serializers.Serializer):
    """Serializer for schedule validation response"""

    is_compliant = serializers.BooleanField(help_text="Overall compliance status")
    violations = serializers.ListField(
        child=serializers.JSONField(),
        help_text="List of compliance violations found"
    )
    warnings = serializers.ListField(
        child=serializers.CharField(),
        help_text="Non-critical warnings"
    )
    total_hours = serializers.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Total scheduled hours"
    )
    overtime_hours = serializers.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Overtime hours calculated"
    )
    regulation_applied = serializers.CharField(help_text="Regulation used for validation")


class RegionalSettingsSerializer(serializers.Serializer):
    """Serializer for regional settings management"""

    venue_id = serializers.IntegerField(required=False, help_text="Venue ID for venue-level settings")
    staff_id = serializers.IntegerField(required=False, help_text="Staff ID for individual overrides")
    region_code = serializers.CharField(help_text="Region code for settings")
    max_daily_hours_override = serializers.DecimalField(
        max_digits=3, decimal_places=1, required=False,
        help_text="Override maximum daily hours"
    )
    max_weekly_hours_override = serializers.DecimalField(
        max_digits=4, decimal_places=1, required=False,
        help_text="Override maximum weekly hours"
    )
    break_requirements_override = serializers.JSONField(
        required=False, help_text="Custom break requirements"
    )
    security_clearance_required = serializers.BooleanField(
        default=False, help_text="Whether security clearance is required"
    )
    sia_license_required = serializers.BooleanField(
        default=True, help_text="Whether SIA license is required"
    )
    custom_rules = serializers.JSONField(
        default=dict, help_text="Additional custom compliance rules"
    )


class RegionalSettingsResponseSerializer(serializers.Serializer):
    """Serializer for regional settings response"""

    id = serializers.IntegerField()
    venue_id = serializers.IntegerField(required=False)
    staff_id = serializers.IntegerField(required=False)
    region_code = serializers.CharField()
    effective_settings = serializers.JSONField(help_text="Resolved effective settings")
    inheritance_chain = serializers.ListField(
        child=serializers.CharField(),
        help_text="Settings inheritance order (Global → Regional → Venue → Staff)"
    )
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class EnhancedWorkingHoursRegulationSerializer(WorkingHoursRegulationSerializer):
    """Enhanced serializer with regional compliance features"""

    supports_opt_out = serializers.SerializerMethodField()
    requires_sia_license = serializers.SerializerMethodField()
    has_state_variations = serializers.SerializerMethodField()
    compliance_complexity = serializers.SerializerMethodField()

    class Meta(WorkingHoursRegulationSerializer.Meta):
        fields = WorkingHoursRegulationSerializer.Meta.fields + [
            'supports_opt_out', 'requires_sia_license',
            'has_state_variations', 'compliance_complexity'
        ]

    def get_supports_opt_out(self, obj):
        """Check if regulation supports working time opt-out"""
        return bool(obj.opt_out_provisions and obj.opt_out_provisions.get('enabled', False))

    def get_requires_sia_license(self, obj):
        """Check if regulation requires SIA license for security work"""
        return bool(obj.security_sector_overrides and
                   obj.security_sector_overrides.get('sia_license_required', False))

    def get_has_state_variations(self, obj):
        """Check if regulation has state/province level variations"""
        return bool(obj.state_overrides)

    def get_compliance_complexity(self, obj):
        """Calculate compliance complexity score"""
        complexity = 0

        # Base complexity factors
        if obj.overtime_threshold_2:
            complexity += 1  # Multiple overtime tiers
        if obj.night_shift_rules:
            complexity += 1  # Night shift rules
        if obj.break_requirements:
            complexity += len(obj.break_requirements)  # Break complexity
        if obj.opt_out_provisions:
            complexity += 2  # Opt-out provisions
        if obj.state_overrides:
            complexity += len(obj.state_overrides)  # State variations
        if obj.security_sector_overrides:
            complexity += 1  # Security-specific rules

        return min(complexity, 10)  # Cap at 10 for readability


# =============================================================================
# REPORTING SYSTEM SERIALIZERS
# =============================================================================

class ReportTemplateSerializer(serializers.ModelSerializer):
    """Serializer for ReportTemplate model"""

    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    allowed_venues_data = serializers.SerializerMethodField()
    template_type_display = serializers.CharField(source='get_template_type_display', read_only=True)

    class Meta:
        model = ReportTemplate
        fields = [
            'id', 'name', 'template_type', 'template_type_display', 'description',
            'sql_query', 'parameters', 'allowed_roles', 'template_config',
            'is_active', 'created_by', 'created_by_name', 'allowed_venues',
            'allowed_venues_data', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'created_by_name', 'template_type_display',
            'allowed_venues_data', 'created_at', 'updated_at'
        ]

    def get_allowed_venues_data(self, obj):
        """Get basic venue information for allowed venues"""
        return [
            {
                'id': venue.id,
                'name': venue.name,
                'city': venue.city
            }
            for venue in obj.allowed_venues.all()
        ]

    def validate_sql_query(self, value):
        """Basic validation for SQL queries"""
        if not value.strip():
            raise serializers.ValidationError("SQL query cannot be empty")

        # Check for dangerous SQL keywords (basic security)
        dangerous_keywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE']
        query_upper = value.upper()
        for keyword in dangerous_keywords:
            if keyword in query_upper:
                raise serializers.ValidationError(f"SQL query cannot contain '{keyword}' statements")

        return value.strip()

    def validate_parameters(self, value):
        """Validate parameters JSON structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Parameters must be a valid JSON object")
        return value

    def validate_allowed_roles(self, value):
        """Validate allowed roles list"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Allowed roles must be a list")

        valid_roles = ['staff', 'manager', 'admin']
        for role in value:
            if role not in valid_roles:
                raise serializers.ValidationError(f"Invalid role: {role}")

        return value


class ReportJobSerializer(serializers.ModelSerializer):
    """Serializer for ReportJob model"""

    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    template_data = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    export_format_display = serializers.CharField(source='get_export_format_display', read_only=True)
    duration_seconds = serializers.SerializerMethodField()
    file_size_mb = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = ReportJob
        fields = [
            'id', 'job_id', 'template', 'template_data', 'status', 'status_display',
            'export_format', 'export_format_display', 'date_range_start', 'date_range_end',
            'filters', 'started_at', 'completed_at', 'file_path', 'file_size',
            'file_size_mb', 'download_count', 'error_message', 'retry_count',
            'requested_by', 'requested_by_name', 'duration_seconds', 'is_expired',
            'created_at', 'expires_at'
        ]
        read_only_fields = [
            'id', 'job_id', 'template_data', 'status_display', 'export_format_display',
            'started_at', 'completed_at', 'file_path', 'file_size', 'file_size_mb',
            'download_count', 'error_message', 'retry_count', 'requested_by',
            'requested_by_name', 'duration_seconds', 'is_expired', 'created_at'
        ]

    def get_template_data(self, obj):
        """Get basic template information"""
        if obj.template:
            return {
                'id': obj.template.id,
                'name': obj.template.name,
                'template_type': obj.template.template_type,
                'template_type_display': obj.template.get_template_type_display()
            }
        return None

    def get_duration_seconds(self, obj):
        """Calculate job duration in seconds"""
        if obj.started_at and obj.completed_at:
            return int((obj.completed_at - obj.started_at).total_seconds())
        return None

    def get_file_size_mb(self, obj):
        """Convert file size to MB"""
        if obj.file_size:
            return round(obj.file_size / (1024 * 1024), 2)
        return None

    def get_is_expired(self, obj):
        """Check if report has expired"""
        from django.utils import timezone
        return timezone.now() > obj.expires_at

    def validate(self, data):
        """Validate report job data"""
        errors = {}

        # Validate date range
        if data.get('date_range_end') and data.get('date_range_start'):
            if data['date_range_end'] <= data['date_range_start']:
                errors['date_range_end'] = "End date must be after start date"

        # Validate filters
        if data.get('filters') and not isinstance(data['filters'], dict):
            errors['filters'] = "Filters must be a valid JSON object"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class ReportJobCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new report jobs"""

    class Meta:
        model = ReportJob
        fields = [
            'template', 'export_format', 'date_range_start', 'date_range_end',
            'filters', 'expires_at'
        ]

    def validate_template(self, value):
        """Validate template exists and is active"""
        if not value.is_active:
            raise serializers.ValidationError("Template is not active")
        return value

    def validate(self, data):
        """Validate report job creation data"""
        errors = {}

        # Validate date range
        if data.get('date_range_end') and data.get('date_range_start'):
            if data['date_range_end'] <= data['date_range_start']:
                errors['date_range_end'] = "End date must be after start date"

        # Validate filters against template parameters
        template = data.get('template')
        filters = data.get('filters', {})

        if template and template.parameters:
            # Check if all required parameters are provided
            for param_name, param_config in template.parameters.items():
                if param_config.get('required', False) and param_name not in filters:
                    errors['filters'] = f"Required parameter '{param_name}' is missing"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class ReportJobStatusSerializer(serializers.ModelSerializer):
    """Lightweight serializer for checking report job status"""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = ReportJob
        fields = [
            'id', 'job_id', 'status', 'status_display', 'started_at',
            'completed_at', 'error_message', 'progress_percentage'
        ]
        read_only_fields = ['id', 'job_id', 'status', 'status_display', 'started_at', 'completed_at', 'error_message', 'progress_percentage']

    def get_progress_percentage(self, obj):
        """Calculate progress percentage (simplified)"""
        if obj.status == 'completed':
            return 100
        elif obj.status == 'processing':
            # Simple time-based estimation (could be enhanced with actual progress tracking)
            if obj.started_at:
                from django.utils import timezone
                elapsed = (timezone.now() - obj.started_at).total_seconds()
                # Estimate 60 seconds for completion, cap at 95%
                return min(int((elapsed / 60) * 100), 95)
            return 10
        elif obj.status == 'failed':
            return 0
        else:  # pending
            return 0


# =====================================================
# ONBOARDING SYSTEM SERIALIZERS
# =====================================================

class SecurityCompanySerializer(serializers.ModelSerializer):
    """
    Serializer for SecurityCompany model with complete company information.
    Used for company management and onboarding processes.
    """
    current_staff_count = serializers.SerializerMethodField()
    current_venue_count = serializers.SerializerMethodField()
    can_add_staff = serializers.SerializerMethodField()
    can_add_venue = serializers.SerializerMethodField()
    subscription_status = serializers.SerializerMethodField()
    
    class Meta:
        model = SecurityCompany
        fields = [
            'id', 'name', 'slug', 'trading_name', 'registration_number', 'tax_id',
            'country_code', 'state_province', 'city', 'postal_code',
            'address_line_1', 'address_line_2', 'industry_type', 'company_size',
            'staff_capacity', 'venue_capacity', 'subscription_tier',
            'subscription_start_date', 'subscription_end_date', 'billing_email',
            'primary_contact_name', 'primary_contact_email', 'primary_contact_phone',
            'timezone', 'currency', 'date_format', 'features_enabled',
            'custom_settings', 'is_active', 'is_trial', 'trial_end_date',
            'created_at', 'updated_at',
            # Computed fields
            'current_staff_count', 'current_venue_count', 'can_add_staff',
            'can_add_venue', 'subscription_status'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'current_staff_count',
            'current_venue_count', 'can_add_staff', 'can_add_venue',
            'subscription_status'
        ]

    def get_current_staff_count(self, obj):
        return obj.get_current_staff_count()

    def get_current_venue_count(self, obj):
        return obj.get_current_venue_count()

    def get_can_add_staff(self, obj):
        return obj.can_add_staff()

    def get_can_add_venue(self, obj):
        return obj.can_add_venue()

    def get_subscription_status(self, obj):
        return obj.get_subscription_status()

    def validate(self, data):
        """Validate company data"""
        errors = {}

        # Validate registration number format
        registration_number = data.get('registration_number')
        if registration_number and len(registration_number) < 6:
            errors['registration_number'] = "Registration number must be at least 6 characters"

        # Validate contact email
        primary_contact_email = data.get('primary_contact_email')
        billing_email = data.get('billing_email')
        if primary_contact_email and billing_email and primary_contact_email == billing_email:
            # This is allowed, just noting they're the same
            pass

        # Validate capacity limits
        staff_capacity = data.get('staff_capacity')
        if staff_capacity and staff_capacity < 1:
            errors['staff_capacity'] = "Staff capacity must be at least 1"

        venue_capacity = data.get('venue_capacity')
        if venue_capacity and venue_capacity < 1:
            errors['venue_capacity'] = "Venue capacity must be at least 1"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class UserCompanyMembershipSerializer(serializers.ModelSerializer):
    """
    Serializer for user company memberships with role management.
    """
    company_name = serializers.CharField(source='company.name', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    invitation_valid = serializers.SerializerMethodField()

    class Meta:
        model = UserCompanyMembership
        fields = [
            'id', 'user', 'company', 'role', 'is_owner', 'is_active',
            'invitation_status', 'invited_by', 'invitation_sent_at',
            'invitation_expires_at', 'permissions', 'access_restrictions',
            'joined_at', 'last_accessed_at',
            # Computed fields
            'company_name', 'user_name', 'invitation_valid'
        ]
        read_only_fields = [
            'id', 'joined_at', 'company_name', 'user_name', 'invitation_valid'
        ]

    def get_invitation_valid(self, obj):
        return obj.is_invitation_valid()


class CompanyOnboardingSerializer(serializers.ModelSerializer):
    """
    Serializer for company onboarding progress tracking.
    Provides detailed progress information and step management.
    """
    is_completed = serializers.BooleanField(read_only=True)
    progress_percentage = serializers.IntegerField(read_only=True)
    next_step = serializers.SerializerMethodField()
    company_name = serializers.CharField(source='company.name', read_only=True)
    time_spent_display = serializers.SerializerMethodField()

    class Meta:
        model = CompanyOnboarding
        fields = [
            'id', 'company', 'current_step', 'total_steps',
            'company_info_completed', 'regional_setup_completed',
            'staff_setup_completed', 'integrations_completed',
            'finalization_completed', 'step_data', 'validation_errors',
            'session_id', 'last_step_accessed', 'completed_at', 'completed_by',
            'time_spent_minutes', 'estimated_time_remaining',
            'created_at', 'updated_at',
            # Computed fields
            'is_completed', 'progress_percentage', 'next_step',
            'company_name', 'time_spent_display'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'is_completed',
            'progress_percentage', 'next_step', 'company_name',
            'time_spent_display'
        ]

    def get_next_step(self, obj):
        return obj.get_next_step()

    def get_time_spent_display(self, obj):
        """Convert minutes to human-readable format"""
        if not obj.time_spent_minutes:
            return "0 minutes"
        
        hours = obj.time_spent_minutes // 60
        minutes = obj.time_spent_minutes % 60
        
        if hours > 0:
            return f"{hours}h {minutes}m" if minutes > 0 else f"{hours}h"
        return f"{minutes}m"


class CompanyInfoSerializer(serializers.Serializer):
    """
    Serializer for company information step in onboarding.
    Validates and processes company details.
    """
    # Basic Company Information
    name = serializers.CharField(max_length=255)
    trading_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    registration_number = serializers.CharField(max_length=100)
    tax_id = serializers.CharField(max_length=50, required=False, allow_blank=True)

    # Location and Compliance
    country_code = serializers.CharField(max_length=3)
    state_province = serializers.CharField(max_length=100, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100)
    postal_code = serializers.CharField(max_length=20)
    address_line_1 = serializers.CharField(max_length=255)
    address_line_2 = serializers.CharField(max_length=255, required=False, allow_blank=True)

    # Business Details
    industry_type = serializers.ChoiceField(choices=SecurityCompany.INDUSTRY_TYPE_CHOICES)
    company_size = serializers.ChoiceField(choices=SecurityCompany.COMPANY_SIZE_CHOICES)

    # Contact Information
    primary_contact_name = serializers.CharField(max_length=255)
    primary_contact_email = serializers.EmailField()
    primary_contact_phone = serializers.CharField(max_length=20)
    billing_email = serializers.EmailField()

    # Company Preferences
    timezone = serializers.CharField(max_length=50, default='UTC')
    currency = serializers.CharField(max_length=3, default='USD')
    date_format = serializers.ChoiceField(
        choices=[
            ('DD/MM/YYYY', 'DD/MM/YYYY'),
            ('MM/DD/YYYY', 'MM/DD/YYYY'),
            ('YYYY-MM-DD', 'YYYY-MM-DD'),
        ],
        default='DD/MM/YYYY'
    )

    def validate(self, data):
        """Validate company information"""
        errors = {}

        # Validate registration number format
        registration_number = data.get('registration_number')
        if registration_number and len(registration_number) < 6:
            errors['registration_number'] = "Registration number must be at least 6 characters"

        # Validate country code
        country_code = data.get('country_code')
        if country_code and len(country_code) != 3:
            errors['country_code'] = "Country code must be 3 characters (ISO 3166-1 alpha-3)"

        # Validate phone number format (basic validation)
        phone = data.get('primary_contact_phone')
        if phone and len(phone) < 10:
            errors['primary_contact_phone'] = "Phone number must be at least 10 digits"

        # Check if registration number is unique (if this is a new company)
        if hasattr(self, 'context') and self.context.get('request'):
            request = self.context['request']
            if hasattr(request.user, 'company_memberships'):
                existing_companies = SecurityCompany.objects.filter(
                    registration_number=registration_number
                ).exclude(
                    id__in=[m.company.id for m in request.user.company_memberships.all()]
                )
                if existing_companies.exists():
                    errors['registration_number'] = "A company with this registration number already exists"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class RegionalSetupSerializer(serializers.Serializer):
    """
    Serializer for regional compliance setup step.
    Handles regulatory and compliance configuration.
    """
    # Regional Settings
    operating_regions = serializers.ListField(
        child=serializers.CharField(max_length=100),
        help_text="List of regions where company operates"
    )
    primary_jurisdiction = serializers.CharField(
        max_length=100,
        help_text="Primary legal jurisdiction"
    )
    
    # Compliance Requirements
    regulatory_requirements = serializers.JSONField(
        default=dict,
        help_text="Regulatory requirements for each region"
    )
    compliance_certifications = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list,
        help_text="List of compliance certifications held"
    )
    
    # Working Hours Configuration
    standard_working_hours = serializers.JSONField(
        default=dict,
        help_text="Standard working hours configuration"
    )
    overtime_policies = serializers.JSONField(
        default=dict,
        help_text="Overtime policies and rates"
    )
    break_requirements = serializers.JSONField(
        default=dict,
        help_text="Required break periods"
    )
    
    # Holiday and Leave Configuration
    public_holidays = serializers.ListField(
        child=serializers.DateField(),
        required=False,
        default=list,
        help_text="List of public holidays"
    )
    minimum_leave_entitlement = serializers.IntegerField(
        default=28,
        help_text="Minimum annual leave entitlement in days"
    )

    def validate(self, data):
        """Validate regional setup configuration"""
        errors = {}

        # Validate operating regions
        operating_regions = data.get('operating_regions', [])
        if not operating_regions:
            errors['operating_regions'] = "At least one operating region must be specified"

        # Validate primary jurisdiction
        primary_jurisdiction = data.get('primary_jurisdiction')
        if primary_jurisdiction not in operating_regions:
            errors['primary_jurisdiction'] = "Primary jurisdiction must be one of the operating regions"

        # Validate leave entitlement
        leave_entitlement = data.get('minimum_leave_entitlement')
        if leave_entitlement and leave_entitlement < 0:
            errors['minimum_leave_entitlement'] = "Leave entitlement cannot be negative"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class StaffConfigSerializer(serializers.Serializer):
    """
    Serializer for staff operations configuration step.
    Handles staff management and operational settings.
    """
    # Staff Capacity and Organization
    expected_staff_count = serializers.IntegerField(
        min_value=1,
        help_text="Expected number of staff members"
    )
    staff_categories = serializers.ListField(
        child=serializers.CharField(max_length=50),
        help_text="Types of staff roles in the organization"
    )
    
    # Shift Management
    shift_patterns = serializers.JSONField(
        default=dict,
        help_text="Standard shift patterns and schedules"
    )
    shift_approval_required = serializers.BooleanField(
        default=True,
        help_text="Whether shifts require manager approval"
    )
    allow_shift_swapping = serializers.BooleanField(
        default=True,
        help_text="Whether staff can swap shifts"
    )
    
    # Location and Venue Management
    venue_types = serializers.ListField(
        child=serializers.CharField(max_length=50),
        help_text="Types of venues serviced"
    )
    gps_tracking_required = serializers.BooleanField(
        default=True,
        help_text="Whether GPS tracking is required for shifts"
    )
    
    # Payment Configuration
    default_pay_rates = serializers.JSONField(
        default=dict,
        help_text="Default pay rates for different roles"
    )
    payment_frequency = serializers.ChoiceField(
        choices=[
            ('weekly', 'Weekly'),
            ('fortnightly', 'Fortnightly'),
            ('monthly', 'Monthly'),
        ],
        default='weekly'
    )
    
    # Qualification Requirements
    required_licenses = serializers.ListField(
        child=serializers.CharField(max_length=50),
        help_text="Required licenses for staff (e.g., SIA licenses)"
    )
    required_certifications = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list,
        help_text="Additional required certifications"
    )

    def validate(self, data):
        """Validate staff configuration"""
        errors = {}

        # Validate staff count
        expected_count = data.get('expected_staff_count')
        if expected_count and expected_count > 10000:
            errors['expected_staff_count'] = "Expected staff count seems unreasonably high"

        # Validate staff categories
        staff_categories = data.get('staff_categories', [])
        if not staff_categories:
            errors['staff_categories'] = "At least one staff category must be specified"

        # Validate venue types
        venue_types = data.get('venue_types', [])
        if not venue_types:
            errors['venue_types'] = "At least one venue type must be specified"

        # Validate pay rates structure
        pay_rates = data.get('default_pay_rates', {})
        if pay_rates:
            for role, rate in pay_rates.items():
                try:
                    float_rate = float(rate)
                    if float_rate < 0:
                        errors['default_pay_rates'] = f"Pay rate for {role} cannot be negative"
                except (ValueError, TypeError):
                    errors['default_pay_rates'] = f"Invalid pay rate for {role}"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class IntegrationsSerializer(serializers.Serializer):
    """
    Serializer for third-party integrations configuration step.
    Handles external service integrations.
    """
    # Deputy Integration
    deputy_enabled = serializers.BooleanField(default=False)
    deputy_api_key = serializers.CharField(
        required=False,
        allow_blank=True,
        style={'input_type': 'password'},
        help_text="Deputy API key for workforce management integration"
    )
    deputy_endpoint = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="Deputy API endpoint URL"
    )
    
    # Payroll Integration
    payroll_system = serializers.ChoiceField(
        choices=[
            ('none', 'No Integration'),
            ('xero', 'Xero'),
            ('quickbooks', 'QuickBooks'),
            ('sage', 'Sage'),
            ('custom', 'Custom System'),
        ],
        default='none'
    )
    payroll_credentials = serializers.JSONField(
        default=dict,
        style={'base_template': 'textarea.html'},
        help_text="Payroll system credentials (encrypted)"
    )
    
    # Accounting Integration
    accounting_system = serializers.ChoiceField(
        choices=[
            ('none', 'No Integration'),
            ('xero', 'Xero'),
            ('quickbooks', 'QuickBooks'),
            ('sage', 'Sage'),
            ('custom', 'Custom System'),
        ],
        default='none'
    )
    accounting_credentials = serializers.JSONField(
        default=dict,
        style={'base_template': 'textarea.html'},
        help_text="Accounting system credentials (encrypted)"
    )
    
    # Communication Integration
    communication_platform = serializers.ChoiceField(
        choices=[
            ('none', 'No Integration'),
            ('slack', 'Slack'),
            ('teams', 'Microsoft Teams'),
            ('whatsapp', 'WhatsApp Business'),
            ('custom', 'Custom System'),
        ],
        default='none'
    )
    communication_credentials = serializers.JSONField(
        default=dict,
        help_text="Communication platform credentials"
    )
    
    # Notification Settings
    email_notifications_enabled = serializers.BooleanField(default=True)
    sms_notifications_enabled = serializers.BooleanField(default=False)
    push_notifications_enabled = serializers.BooleanField(default=True)

    def validate(self, data):
        """Validate integrations configuration"""
        errors = {}

        # Validate Deputy integration
        if data.get('deputy_enabled'):
            if not data.get('deputy_api_key'):
                errors['deputy_api_key'] = "API key is required when Deputy integration is enabled"
            if not data.get('deputy_endpoint'):
                errors['deputy_endpoint'] = "Endpoint URL is required when Deputy integration is enabled"

        # Validate payroll integration
        payroll_system = data.get('payroll_system')
        if payroll_system and payroll_system != 'none':
            payroll_creds = data.get('payroll_credentials', {})
            if not payroll_creds:
                errors['payroll_credentials'] = "Credentials are required for payroll system integration"

        # Validate accounting integration
        accounting_system = data.get('accounting_system')
        if accounting_system and accounting_system != 'none':
            accounting_creds = data.get('accounting_credentials', {})
            if not accounting_creds:
                errors['accounting_credentials'] = "Credentials are required for accounting system integration"

        if errors:
            raise serializers.ValidationError(errors)

        return data


class CompanyIntegrationSerializer(serializers.ModelSerializer):
    """
    Serializer for individual company integrations.
    Manages specific third-party service configurations.
    """
    integration_type_display = serializers.CharField(source='get_integration_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    health_status_display = serializers.CharField(source='get_health_status_display', read_only=True)
    last_sync_display = serializers.SerializerMethodField()

    class Meta:
        model = CompanyIntegration
        fields = [
            'id', 'company', 'integration_type', 'name', 'description',
            'configuration', 'status', 'is_enabled', 'last_sync_at',
            'last_health_check', 'health_status', 'last_error', 'error_count',
            'sync_frequency', 'auto_sync_enabled', 'created_at', 'updated_at',
            'configured_by',
            # Display fields
            'integration_type_display', 'status_display', 'health_status_display',
            'last_sync_display'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'last_sync_at', 'last_health_check',
            'health_status', 'last_error', 'error_count', 'integration_type_display',
            'status_display', 'health_status_display', 'last_sync_display'
        ]

    def get_last_sync_display(self, obj):
        """Human-readable last sync time"""
        if not obj.last_sync_at:
            return "Never"
        
        from django.utils import timezone
        from django.utils.timesince import timesince
        
        return f"{timesince(obj.last_sync_at, timezone.now())} ago"

    def validate(self, data):
        """Validate integration configuration"""
        errors = {}

        # Validate configuration based on integration type
        integration_type = data.get('integration_type')
        configuration = data.get('configuration', {})

        if integration_type == 'deputy' and not configuration.get('api_key'):
            errors['configuration'] = "API key is required for Deputy integration"

        if errors:
            raise serializers.ValidationError(errors)

        return data


# =====================================================
# NOTIFICATION SERIALIZERS
# =====================================================

class SNSDeviceTokenSerializer(serializers.ModelSerializer):
    """Serializer for device push notification tokens"""

    class Meta:
        model = SNSDeviceToken
        fields = [
            'id', 'user', 'token', 'platform', 'device_id',
            'endpoint_arn', 'is_active', 'created_at', 'updated_at', 'last_used_at'
        ]
        read_only_fields = ['id', 'user', 'endpoint_arn', 'created_at', 'updated_at', 'last_used_at']
        # Remove auto-generated UniqueValidator for token field
        # We handle uniqueness manually in create() to support token reassignment
        extra_kwargs = {
            'token': {'validators': []}
        }
    
    def create(self, validated_data):
        """Create or update device token for the user"""
        user = self.context['request'].user
        token = validated_data['token']

        # Check if token already exists (for any user)
        # A device can only be registered to one user at a time
        existing_token = SNSDeviceToken.objects.filter(token=token).first()

        if existing_token:
            # Update existing token - reassign to current user if different
            # This handles the case where a device was previously used by another user
            if existing_token.user != user:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"Reassigning device token from user {existing_token.user_id} to user {user.id}"
                )
            existing_token.user = user
            existing_token.is_active = True
            existing_token.platform = validated_data.get('platform', existing_token.platform)
            existing_token.device_id = validated_data.get('device_id', existing_token.device_id)
            existing_token.activate()
            return existing_token

        # Create new token
        validated_data['user'] = user
        return super().create(validated_data)


class NotificationPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for user notification preferences"""

    class Meta:
        model = NotificationPreferences
        fields = [
            'id', 'user', 'shift_reminders_enabled', 'advance_reminder_hours',
            'final_reminder_minutes', 'exchange_notifications_enabled',
            'exchange_request_received', 'exchange_request_accepted',
            'exchange_request_approved', 'available_shifts_notifications_enabled',
            'new_available_shift', 'incident_alerts_enabled',
            'sync_notifications_enabled', 'sync_errors_only',
            'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end',
            # Email notification settings
            'email_notifications_enabled', 'email_shift_assignments',
            'email_shift_reminders', 'email_exchange_notifications',
            'email_open_shift_notifications', 'email_approval_notifications',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def validate(self, data):
        """Validate notification preferences"""
        # Validate quiet hours
        if data.get('quiet_hours_enabled'):
            if not data.get('quiet_hours_start') or not data.get('quiet_hours_end'):
                raise serializers.ValidationError(
                    "Quiet hours start and end times are required when quiet hours are enabled"
                )
        
        # Validate reminder times
        if 'advance_reminder_hours' in data:
            if not (1 <= data['advance_reminder_hours'] <= 24):
                raise serializers.ValidationError(
                    "Advance reminder hours must be between 1 and 24"
                )
        
        if 'final_reminder_minutes' in data:
            if not (15 <= data['final_reminder_minutes'] <= 180):
                raise serializers.ValidationError(
                    "Final reminder minutes must be between 15 and 180"
                )

        return data


# =====================================================
# PASSWORD RESET SERIALIZERS
# =====================================================

class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting password reset"""
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        """Validate email format"""
        return value.lower().strip()


class PasswordResetValidateSerializer(serializers.Serializer):
    """Serializer for validating password reset token"""
    token = serializers.UUIDField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming password reset with new password"""
    token = serializers.UUIDField(required=True)
    new_password = serializers.CharField(
        required=True,
        min_length=8,
        max_length=128,
        write_only=True
    )
    confirm_password = serializers.CharField(
        required=True,
        write_only=True
    )

    def validate(self, data):
        """Validate password match and strength"""
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match'
            })

        # Password strength validation
        password = data['new_password']

        # Check for at least one uppercase letter
        if not any(char.isupper() for char in password):
            raise serializers.ValidationError({
                'new_password': 'Password must contain at least one uppercase letter'
            })

        # Check for at least one lowercase letter
        if not any(char.islower() for char in password):
            raise serializers.ValidationError({
                'new_password': 'Password must contain at least one lowercase letter'
            })

        # Check for at least one digit
        if not any(char.isdigit() for char in password):
            raise serializers.ValidationError({
                'new_password': 'Password must contain at least one number'
            })

        # Check for at least one special character
        special_characters = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(char in special_characters for char in password):
            raise serializers.ValidationError({
                'new_password': 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'
            })

        return data


# =============================================================================
# CONTRACTOR UNAVAILABILITY & LEAVE RATE SERIALIZERS
# =============================================================================

class ContractorUnavailabilitySerializer(serializers.ModelSerializer):
    """Serializer for ContractorUnavailability model"""
    staff_user_details = UserSerializer(source='staff_user', read_only=True)

    class Meta:
        model = ContractorUnavailability
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'company')

    def validate(self, data):
        """Validate unavailability period"""
        start_date = data.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = data.get('end_date', getattr(self.instance, 'end_date', None))

        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError({
                'end_date': 'End date must be on or after start date'
            })

        return data


class ContractorUnavailabilityCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ContractorUnavailability - staff can create their own"""
    class Meta:
        model = ContractorUnavailability
        fields = ['start_date', 'end_date', 'reason']

    def validate(self, data):
        """Validate unavailability period"""
        if data['end_date'] < data['start_date']:
            raise serializers.ValidationError({
                'end_date': 'End date must be on or after start date'
            })
        return data


class StaffLeaveDailyRateSerializer(serializers.ModelSerializer):
    """Serializer for StaffLeaveDailyRate model"""
    staff_user_details = UserSerializer(source='staff_user', read_only=True)
    updated_by_details = UserSerializer(source='updated_by', read_only=True)

    class Meta:
        model = StaffLeaveDailyRate
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'company', 'updated_by')

    def validate_daily_rate(self, value):
        """Validate daily rate is positive"""
        if value <= 0:
            raise serializers.ValidationError("Daily rate must be positive")
        return value


class StaffLeaveDailyRateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating StaffLeaveDailyRate - admin only"""
    class Meta:
        model = StaffLeaveDailyRate
        fields = ['daily_rate', 'effective_from']

    def validate_daily_rate(self, value):
        """Validate daily rate is positive"""
        if value <= 0:
            raise serializers.ValidationError("Daily rate must be positive")
        return value


class AvailabilityCheckSerializer(serializers.Serializer):
    """Serializer for checking staff availability on specific dates"""
    date = serializers.DateField()
    is_available = serializers.BooleanField(read_only=True)
    reason = serializers.CharField(read_only=True, allow_blank=True)
