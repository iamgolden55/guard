from rest_framework import serializers
from django.utils import timezone
from api.models import Shift, Venue, User  # Import from api.models
from django.contrib.auth import get_user_model

# Simple serializer classes to avoid circular imports
class SimpleVenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = ['id', 'name', 'address', 'latitude', 'longitude']

class SimpleUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']

User = get_user_model()

class ShiftSerializer(serializers.ModelSerializer):
    venue_details = SimpleVenueSerializer(source='venue', read_only=True)
    staff_details = SimpleUserSerializer(source='staff_user', read_only=True)
    required_security_role = serializers.CharField(default='sg', required=False)
    shift_group = serializers.CharField(required=False, allow_null=True)
    
    class Meta:
        model = Shift
        fields = [
            'id', 'venue', 'venue_details', 'staff_user', 'staff_details', 
            'start_time', 'end_time', 'status', 'required_security_role', 'check_in_time', 
            'check_out_time', 'shift_group', 'hourly_rate', 'is_special_event', 'created_at', 'updated_at'
        ]
    
    def validate(self, data):
        # Ensure start time is before end time
        if 'start_time' in data and 'end_time' in data:
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("Start time must be before end time")
        
        # Ensure start time is in the future when creating shifts
        # Allow past dates for copying shifts functionality
        if (self.instance is None and 'start_time' in data and 
            not self.context.get('allow_past_dates', False)):
            if data['start_time'] <= timezone.now():
                raise serializers.ValidationError("Start time must be in the future")
        
        # Check for duplicate shifts when creating new shifts (staff can't be in same shift group twice)
        # Only validate this for multi-staff shifts that have a shift_group
        if (self.instance is None and 
            'shift_group' in data and 'staff_user' in data and 
            data.get('shift_group') and data.get('staff_user')):
            
            existing_shift = Shift.objects.filter(
                shift_group=data['shift_group'],
                staff_user=data['staff_user']
            ).first()
            
            if existing_shift:
                staff_name = data['staff_user'].get_full_name() if data['staff_user'] else 'Unassigned'
                raise serializers.ValidationError(
                    f"{staff_name} is already assigned to this shift group"
                )
        
        return data

class FrontendShiftSerializer(serializers.ModelSerializer):
    venueDetails = SimpleVenueSerializer(source='venue', read_only=True)
    staffDetails = SimpleUserSerializer(source='staff_user', read_only=True)
    required_security_role = serializers.CharField(default='sg', required=False)
    shift_group = serializers.CharField(required=False, allow_null=True)
    startTime = serializers.DateTimeField(source='start_time')
    endTime = serializers.DateTimeField(source='end_time')
    staffUser = serializers.PrimaryKeyRelatedField(source='staff_user', queryset=Shift.objects.all().values_list('staff_user', flat=True).distinct())
    checkInTime = serializers.DateTimeField(source='check_in_time', read_only=True)
    checkOutTime = serializers.DateTimeField(source='check_out_time', read_only=True)
    hourlyRate = serializers.DecimalField(source='hourly_rate', max_digits=10, decimal_places=2, required=False, allow_null=True)
    isSpecialEvent = serializers.BooleanField(source='is_special_event', default=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Shift
        fields = [
            'id', 'venue', 'venueDetails', 'staffUser', 'staffDetails', 
            'startTime', 'endTime', 'status', 'required_security_role', 'checkInTime', 
            'checkOutTime', 'shift_group', 'hourlyRate', 'isSpecialEvent', 'createdAt', 'updatedAt'
        ]
    
    def validate(self, data):
        # Ensure start time is before end time
        if 'start_time' in data and 'end_time' in data:
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("Start time must be before end time")
        
        # Ensure start time is in the future when creating shifts
        # Allow past dates for copying shifts functionality
        if (self.instance is None and 'start_time' in data and 
            not self.context.get('allow_past_dates', False)):
            if data['start_time'] <= timezone.now():
                raise serializers.ValidationError("Start time must be in the future")
        
        # Check for duplicate shifts when creating new shifts (staff can't be in same shift group twice)
        # Only validate this for multi-staff shifts that have a shift_group
        if (self.instance is None and 
            'shift_group' in data and 'staff_user' in data and 
            data.get('shift_group') and data.get('staff_user')):
            
            existing_shift = Shift.objects.filter(
                shift_group=data['shift_group'],
                staff_user=data['staff_user']
            ).first()
            
            if existing_shift:
                staff_name = data['staff_user'].get_full_name() if data['staff_user'] else 'Unassigned'
                raise serializers.ValidationError(
                    f"{staff_name} is already assigned to this shift group"
                )
        
        return data
        
    def to_internal_value(self, data):
        # Convert camelCase to snake_case for incoming data
        if 'startTime' in data:
            data['start_time'] = data.pop('startTime')
        if 'endTime' in data:
            data['end_time'] = data.pop('endTime')
        if 'staffUser' in data:
            data['staff_user'] = data.pop('staffUser')
        if 'hourlyRate' in data:
            data['hourly_rate'] = data.pop('hourlyRate')
        if 'isSpecialEvent' in data:
            data['is_special_event'] = data.pop('isSpecialEvent')
        return super().to_internal_value(data)

class ShiftDetailSerializer(ShiftSerializer):
    venue = SimpleVenueSerializer(read_only=True)
    staff_user = SimpleUserSerializer(read_only=True)

class FrontendShiftDetailSerializer(FrontendShiftSerializer):
    venue = serializers.SerializerMethodField()
    staffUser = serializers.SerializerMethodField()
    
    def get_venue(self, obj):
        if obj.venue:
            return SimpleVenueSerializer(obj.venue).data
        return None
    
    def get_staffUser(self, obj):
        if obj.staff_user:
            return SimpleUserSerializer(obj.staff_user).data
        return None

class MultiStaffShiftSerializer(serializers.Serializer):
    """Serializer for creating shifts with multiple staff members"""
    venue = serializers.IntegerField()
    staff_users = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="List of staff user IDs"
    )
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    status = serializers.CharField(default='scheduled')
    required_security_role = serializers.CharField(default='sg')
    notes = serializers.CharField(required=False, allow_blank=True)
    hourly_rate = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    is_special_event = serializers.BooleanField(default=False)
    
    def validate(self, data):
        # Ensure start time is before end time
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("Start time must be before end time")
        
        # Ensure start time is in the future
        # Allow past dates for copying shifts functionality
        if not self.context.get('allow_past_dates', False):
            if data['start_time'] <= timezone.now():
                raise serializers.ValidationError("Start time must be in the future")
        
        # Validate venue exists
        from api.models import Venue
        try:
            venue = Venue.objects.get(id=data['venue'])
            data['venue_obj'] = venue
        except Venue.DoesNotExist:
            raise serializers.ValidationError("Invalid venue ID")
        
        # Validate all staff users exist
        from api.models import User
        staff_users = []
        for user_id in data['staff_users']:
            try:
                user = User.objects.get(id=user_id)
                staff_users.append(user)
            except User.DoesNotExist:
                raise serializers.ValidationError(f"Invalid staff user ID: {user_id}")
        
        data['staff_user_objs'] = staff_users
        
        # Check for duplicates in the staff list
        if len(data['staff_users']) != len(set(data['staff_users'])):
            raise serializers.ValidationError("Duplicate staff members in the list")
        
        return data
    
    def create(self, validated_data):
        """Create multiple shift records for the same venue/time with different staff"""
        from api.models import Shift
        
        venue = validated_data['venue_obj']
        staff_users = validated_data['staff_user_objs']
        
        # Generate a unique shift group ID
        shift_group = Shift.generate_shift_group_id(venue.id, validated_data['start_time'])
        
        created_shifts = []
        for staff_user in staff_users:
            shift = Shift.objects.create(
                venue=venue,
                staff_user=staff_user,
                start_time=validated_data['start_time'],
                end_time=validated_data['end_time'],
                status=validated_data.get('status', 'scheduled'),
                required_security_role=validated_data.get('required_security_role', 'sg'),
                notes=validated_data.get('notes', ''),
                shift_group=shift_group,
                hourly_rate=validated_data.get('hourly_rate'),
                is_special_event=validated_data.get('is_special_event', False)
            )
            created_shifts.append(shift)
        
        return created_shifts