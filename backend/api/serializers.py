from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    User, StaffProfile, EmergencyContact, BankDetails, SIALicense,
    StaffAvailability, Venue, VenueTermsAcceptance, PreferredVenue,
    Shift, FireExitCheck, CapacityCheck, ToiletCheck,
    ShiftExchange, OpenShiftRequest, Invoice, InvoiceItem, PayRate, DeputyConfig,
    DeputyEmployee, DeputyTimesheet, ShiftTemplate, SystemSettings,
    EmploymentType, RecruitmentApplication, EnforcementVisit
)

User = get_user_model() # Ensure User model is fetched

class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class BankDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankDetails
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

    def to_representation(self, instance):
        # Hide sensitive data in responses
        representation = super().to_representation(instance)
        representation['account_number'] = '****' + str(representation['account_number'])[-4:]
        representation['sort_code'] = '****' + str(representation['sort_code'])[-2:]
        return representation

class SIALicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SIALicense
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

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
        read_only_fields = ('created_at', 'updated_at')
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
            role=validated_data.get('role', 'staff'),
            is_active=True,
            is_staff=True  # This is needed for API access
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

        for attr, value in validated_data.items():
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
    emergency_contacts = EmergencyContactSerializer(many=True, read_only=True)
    bank_details = BankDetailsSerializer(read_only=True)
    sia_licenses = SIALicenseSerializer(many=True, read_only=True)
    availability = StaffAvailabilitySerializer(many=True, read_only=True)
    
    # Add security roles from User model for frontend compatibility
    security_roles = serializers.ReadOnlyField(source='user.security_roles')
    
    # Add camelCase aliases for frontend compatibility
    securityRoles = serializers.ReadOnlyField(source='user.security_roles')
    siaLicenses = serializers.SerializerMethodField()
    isApproved = serializers.ReadOnlyField(source='is_approved')
    employmentType = serializers.IntegerField(source='employment_type_id', required=False, allow_null=True)
    
    def get_siaLicenses(self, obj):
        """Return SIA licenses in camelCase format for frontend compatibility"""
        return SIALicenseSerializer(obj.sia_licenses.all(), many=True).data
    
    def get_employment_type_details(self, obj):
        """Return employment type details"""
        if obj.employment_type:
            return {
                'id': obj.employment_type.id,
                'name': obj.employment_type.name,
                'description': obj.employment_type.description,
                'is_active': obj.employment_type.is_active
            }
        return None

    class Meta:
        model = StaffProfile
        fields = (
            'id', 'user', 'employment_type', 'employment_type_details', 'phone_number', 'date_of_birth', 'national_insurance_number',
            'street', 'city', 'postal_code', 'country', 'profile_image_url', 'notes',
            'password_last_changed', 'is_approved', 'created_at', 'updated_at',
            'emergency_contacts', 'bank_details', 'sia_licenses', 'availability',
            'security_roles', 'securityRoles', 'siaLicenses', 'isApproved', 'employmentType'
        )
        read_only_fields = ('created_at', 'updated_at', 'password_last_changed', 'security_roles', 'securityRoles', 'siaLicenses', 'isApproved')

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
    
    class Meta:
        model = FireExitCheck
        fields = '__all__'
        read_only_fields = ('created_at',)
    
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
    
    class Meta:
        model = CapacityCheck
        fields = '__all__'
        read_only_fields = ('created_at',)

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

    class Meta:
        model = ToiletCheck
        fields = '__all__'
        read_only_fields = ('created_at',)
    
    def to_representation(self, instance):
        # Include both snake_case and camelCase for compatibility
        representation = super().to_representation(instance)
        representation['location'] = instance.location_name
        representation['comments'] = instance.notes or ''
        return representation

class ShiftSerializer(serializers.ModelSerializer):
    fire_exit_checks = FireExitCheckSerializer(many=True, read_only=True)
    capacity_checks = CapacityCheckSerializer(many=True, read_only=True)
    toilet_checks = ToiletCheckSerializer(many=True, read_only=True)
    venue_details = VenueSerializer(source='venue', read_only=True)
    staff_user_details = UserSerializer(source='staff_user', read_only=True)
    calculated_payment = serializers.ReadOnlyField()
    is_invoiced = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'calculated_payment', 'is_invoiced', 'auto_checkout')

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
        
        # Validate staff eligibility if staff_user is set
        staff_user = data.get('staff_user')
        if staff_user:
            profile = getattr(staff_user, 'profile', None)
            if not profile or not profile.is_eligible_for_shifts():
                raise serializers.ValidationError({
                    "staff_user": "Staff must have a valid SIA license and be admin approved to be assigned shifts."
                })
        return data
    
    def get_is_invoiced(self, obj):
        """Check if shift has been invoiced"""
        return obj.invoice_items.exists()

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

class InvoiceItemSerializer(serializers.ModelSerializer):
    venue_details = VenueSerializer(source='venue', read_only=True)
    shift_details = ShiftSerializer(source='shift', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = '__all__'
        read_only_fields = ('created_at',)

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    staff_user_details = UserSerializer(source='staff_user', read_only=True)
    payment_breakdown = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'payment_breakdown')

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
        read_only_fields = ('created_at', 'updated_at')
    
    def get_application_count(self, obj):
        """Return count of applications for this employment type"""
        return obj.applications.count()
    
    def validate_name(self, value):
        """Validate employment type name is not empty and unique"""
        if not value.strip():
            raise serializers.ValidationError("Employment type name cannot be empty")
        
        # Check uniqueness during update
        if self.instance:
            existing = EmploymentType.objects.filter(name=value).exclude(pk=self.instance.pk)
        else:
            existing = EmploymentType.objects.filter(name=value)
        
        if existing.exists():
            raise serializers.ValidationError("Employment type with this name already exists")
        
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
