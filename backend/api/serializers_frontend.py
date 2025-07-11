from rest_framework import serializers
from .models import Shift, ShiftTemplate, Venue, User
from django.utils import timezone

class FrontendVenueSerializer(serializers.ModelSerializer):
    """Frontend-compatible venue serializer with camelCase fields"""
    venueId = serializers.IntegerField(source='id', read_only=True)
    venueName = serializers.CharField(source='name')
    isActive = serializers.BooleanField(source='is_active', read_only=True)
    requiresFireSafetyChecks = serializers.BooleanField(source='requires_fire_safety_checks', read_only=True)
    requiresCapacityMonitoring = serializers.BooleanField(source='requires_capacity_monitoring', read_only=True)
    requiresToiletChecks = serializers.BooleanField(source='requires_toilet_checks', read_only=True)
    
    class Meta:
        model = Venue
        fields = ('venueId', 'venueName', 'address', 'isActive', 'requiresFireSafetyChecks', 'requiresCapacityMonitoring', 'requiresToiletChecks')

class FrontendUserSerializer(serializers.ModelSerializer):
    """Frontend-compatible user serializer with camelCase fields"""
    userId = serializers.IntegerField(source='id', read_only=True)
    firstName = serializers.CharField(source='first_name')
    lastName = serializers.CharField(source='last_name')
    
    class Meta:
        model = User
        fields = ('userId', 'firstName', 'lastName', 'username', 'email')

class FrontendShiftSerializer(serializers.ModelSerializer):
    """Frontend-compatible shift serializer with camelCase fields"""
    # Basic ID mappings
    shiftId = serializers.IntegerField(source='id', read_only=True)
    staffId = serializers.IntegerField(source='staff_user.id', required=False, allow_null=True)
    venueId = serializers.IntegerField(source='venue.id')
    staffName = serializers.SerializerMethodField()
    venueName = serializers.SerializerMethodField()
    
    # Field name mappings
    requiredSecurityRole = serializers.CharField(source='required_security_role')
    startTime = serializers.DateTimeField(source='start_time')
    endTime = serializers.DateTimeField(source='end_time', required=False, allow_null=True)
    checkInTime = serializers.DateTimeField(source='check_in_time', required=False, allow_null=True)
    checkOutTime = serializers.DateTimeField(source='check_out_time', required=False, allow_null=True)
    startSignature = serializers.CharField(source='start_signature', required=False, allow_null=True)
    endSignature = serializers.CharField(source='end_signature', required=False, allow_null=True)
    managerApproved = serializers.BooleanField(source='manager_approved', required=False)
    managerSignature = serializers.CharField(source='manager_signature', required=False, allow_null=True)
    managerNotes = serializers.CharField(source='manager_notes', required=False, allow_null=True)
    managerId = serializers.IntegerField(source='manager_user.id', required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    # New fields
    isSpecialEvent = serializers.BooleanField(required=False, default=False)
    requiresFireSafetyChecks = serializers.SerializerMethodField()
    requiresCapacityMonitoring = serializers.SerializerMethodField()
    requiresToiletChecks = serializers.SerializerMethodField()
    payRate = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    
    # Nested objects (read-only)
    venueDetails = FrontendVenueSerializer(source='venue', read_only=True)
    staffUserDetails = FrontendUserSerializer(source='staff_user', read_only=True)
    
    class Meta:
        model = Shift
        fields = (
            'shiftId', 'staffId', 'venueId', 'staffName', 'venueName',
            'requiredSecurityRole', 'startTime', 'endTime', 'status',
            'checkInTime', 'checkOutTime', 'startSignature', 'endSignature',
            'managerApproved', 'managerSignature', 'managerNotes', 'managerId',
            'createdAt', 'updatedAt', 'isSpecialEvent', 'requiresFireSafetyChecks',
            'requiresCapacityMonitoring', 'requiresToiletChecks', 'payRate',
            'venueDetails', 'staffUserDetails'
        )
    
    def get_staffName(self, obj):
        if obj.staff_user:
            return f"{obj.staff_user.first_name} {obj.staff_user.last_name}"
        return None
    
    def get_venueName(self, obj):
        if obj.venue:
            return obj.venue.name
        return None
    
    def get_requiresFireSafetyChecks(self, obj):
        if obj.venue:
            return obj.venue.requires_fire_safety_checks
        return False
    
    def get_requiresCapacityMonitoring(self, obj):
        if obj.venue:
            return obj.venue.requires_capacity_monitoring
        return False
    
    def get_requiresToiletChecks(self, obj):
        if obj.venue:
            return obj.venue.requires_toilet_checks
        return False
    
    def validate(self, data):
        # Validate end time is after start time
        if 'end_time' in data and 'start_time' in data:
            if data['end_time'] and data['start_time'] and data['end_time'] <= data['start_time']:
                raise serializers.ValidationError({
                    "endTime": "End time must be after start time"
                })
                
        # If staff_user is being set, validate eligibility
        if 'staff_user' in data and data.get('staff_user'):
            staff_user = data['staff_user']
            if not hasattr(staff_user, 'profile') or not staff_user.profile.is_eligible_for_shifts():
                raise serializers.ValidationError({
                    "staffId": "Staff must have a valid SIA license and be admin approved to be assigned shifts."
                })
        
        return data
    
    def create(self, validated_data):
        # Handle nested fields
        staff_user_data = validated_data.pop('staff_user', {})
        staff_user_id = staff_user_data.get('id') if staff_user_data else None
        
        venue_data = validated_data.pop('venue', {})
        venue_id = venue_data.get('id')
        
        manager_user_data = validated_data.pop('manager_user', {})
        manager_user_id = manager_user_data.get('id') if manager_user_data else None
        
        # Get staff user, venue and manager user instances
        staff_user = User.objects.get(id=staff_user_id) if staff_user_id else None
        venue = Venue.objects.get(id=venue_id)
        manager_user = User.objects.get(id=manager_user_id) if manager_user_id else None
        
        # Create shift
        shift = Shift(
            staff_user=staff_user,
            venue=venue,
            manager_user=manager_user,
            **validated_data
        )
        shift.save()
        
        return shift
    
    def update(self, instance, validated_data):
        # Handle nested fields
        staff_user_data = validated_data.pop('staff_user', {})
        staff_user_id = staff_user_data.get('id') if staff_user_data else None
        
        venue_data = validated_data.pop('venue', {})
        venue_id = venue_data.get('id') if venue_data else None
        
        manager_user_data = validated_data.pop('manager_user', {})
        manager_user_id = manager_user_data.get('id') if manager_user_data else None
        
        # Update staff, venue and manager if provided
        if staff_user_id:
            instance.staff_user = User.objects.get(id=staff_user_id)
        
        if venue_id:
            instance.venue = Venue.objects.get(id=venue_id)
            
        if manager_user_id:
            instance.manager_user = User.objects.get(id=manager_user_id)
        
        # Update all other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Set updated_at timestamp
        instance.updated_at = timezone.now()
        
        instance.save()
        return instance

class FrontendShiftTemplateSerializer(serializers.ModelSerializer):
    """Frontend-compatible shift template serializer with camelCase fields"""
    templateId = serializers.IntegerField(source='id', read_only=True)
    venueId = serializers.IntegerField(source='venue.id')
    venueName = serializers.SerializerMethodField()
    daysOfWeek = serializers.JSONField(source='days_of_week')
    # Support single day for frontend compatibility
    dayOfWeek = serializers.SerializerMethodField()
    startTime = serializers.TimeField(source='start_time')
    endTime = serializers.TimeField(source='end_time')
    requiredSecurityRole = serializers.CharField(source='required_security_role')
    minStaffRequired = serializers.IntegerField(source='min_staff_required')
    isActive = serializers.BooleanField(source='is_active')
    colorCode = serializers.CharField(source='color_code', required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    # New fields
    requiresFireSafetyChecks = serializers.SerializerMethodField()
    requiresCapacityMonitoring = serializers.SerializerMethodField()
    requiresToiletChecks = serializers.SerializerMethodField()
    
    class Meta:
        model = ShiftTemplate
        fields = (
            'templateId', 'name', 'venueId', 'venueName', 'daysOfWeek', 'dayOfWeek',
            'startTime', 'endTime', 'requiredSecurityRole', 'minStaffRequired',
            'isActive', 'colorCode', 'notes', 'createdAt', 'updatedAt',
            'requiresFireSafetyChecks', 'requiresCapacityMonitoring', 'requiresToiletChecks'
        )
    
    def get_venueName(self, obj):
        if obj.venue:
            return obj.venue.name
        return None
    
    def get_dayOfWeek(self, obj):
        """Convert days_of_week array to single day if only one day present"""
        if len(obj.days_of_week) == 1:
            return obj.days_of_week[0]
        return None
    
    def get_requiresFireSafetyChecks(self, obj):
        if obj.venue:
            return obj.venue.requires_fire_safety_checks
        return False
    
    def get_requiresCapacityMonitoring(self, obj):
        if obj.venue:
            return obj.venue.requires_capacity_monitoring
        return False
    
    def get_requiresToiletChecks(self, obj):
        if obj.venue:
            return obj.venue.requires_toilet_checks
        return False
    
    def validate(self, data):
        # Validate end time is not equal to start time
        if 'end_time' in data and 'start_time' in data:
            if data['end_time'] == data['start_time']:
                raise serializers.ValidationError({
                    "endTime": "End time must not be equal to start time"
                })
        
        # Validate days_of_week
        days_of_week = data.get('days_of_week', [])
        if not isinstance(days_of_week, list):
            raise serializers.ValidationError({
                "daysOfWeek": "Days of week must be a list of integers (0-6)"
            })
        
        # Ensure all values are valid (0-6)
        for day in days_of_week:
            if not isinstance(day, int) or day < 0 or day > 6:
                raise serializers.ValidationError({
                    "daysOfWeek": f"Invalid day {day}. Days must be integers from 0 to 6."
                })
        
        return data 