from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    User, StaffProfile, EmergencyContact, BankDetails, SIALicense,
    StaffAvailability, Venue, VenueTermsAcceptance, PreferredVenue,
    Shift, FireExitCheck, CapacityCheck, ToiletCheck,
    ShiftExchange, Invoice, InvoiceItem, PayRate, DeputyConfig,
    DeputyEmployee, DeputyTimesheet, ShiftTemplate, SystemSettings
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
    
    def get_siaLicenses(self, obj):
        """Return SIA licenses in camelCase format for frontend compatibility"""
        return SIALicenseSerializer(obj.sia_licenses.all(), many=True).data

    class Meta:
        model = StaffProfile
        fields = (
            'id', 'user', 'phone_number', 'date_of_birth', 'national_insurance_number',
            'street', 'city', 'postal_code', 'country', 'profile_image_url', 'notes',
            'password_last_changed', 'is_approved', 'created_at', 'updated_at',
            'emergency_contacts', 'bank_details', 'sia_licenses', 'availability',
            'security_roles', 'securityRoles', 'siaLicenses', 'isApproved'
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
    class Meta:
        model = FireExitCheck
        fields = '__all__'
        read_only_fields = ('created_at',)

class CapacityCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapacityCheck
        fields = '__all__'
        read_only_fields = ('created_at',)

    def validate_count(self, value):
        # Ensure count is not negative
        if value < 0:
            raise serializers.ValidationError("Capacity count cannot be negative")
        return value

class ToiletCheckSerializer(serializers.ModelSerializer):
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)

    class Meta:
        model = ToiletCheck
        fields = '__all__'
        read_only_fields = ('created_at',)

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
    requesting_user_details = UserSerializer(source='requesting_user', read_only=True)
    target_user_details = UserSerializer(source='target_user', read_only=True)

    class Meta:
        model = ShiftExchange
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

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