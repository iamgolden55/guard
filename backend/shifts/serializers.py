from rest_framework import serializers
from django.utils import timezone
from .models import Shift
from venues.models import Venue
from venues.serializers import VenueSerializer
from users.serializers import UserSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class ShiftSerializer(serializers.ModelSerializer):
    venue_details = VenueSerializer(source='venue', read_only=True)
    staff_details = UserSerializer(source='staff_user', read_only=True)
    
    class Meta:
        model = Shift
        fields = [
            'id', 'venue', 'venue_details', 'staff_user', 'staff_details', 
            'start_time', 'end_time', 'status', 'check_in_time', 
            'check_out_time', 'canceled_time', 'created_at', 'updated_at'
        ]
    
    def validate(self, data):
        # Ensure start time is before end time
        if 'start_time' in data and 'end_time' in data:
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("Start time must be before end time")
        
        # Ensure start time is in the future when creating shifts
        if self.instance is None and 'start_time' in data:
            if data['start_time'] <= timezone.now():
                raise serializers.ValidationError("Start time must be in the future")
        
        return data

class FrontendShiftSerializer(serializers.ModelSerializer):
    venueDetails = VenueSerializer(source='venue', read_only=True)
    staffDetails = UserSerializer(source='staff_user', read_only=True)
    startTime = serializers.DateTimeField(source='start_time')
    endTime = serializers.DateTimeField(source='end_time')
    staffUser = serializers.PrimaryKeyRelatedField(source='staff_user', queryset=Shift.objects.all().values_list('staff_user', flat=True).distinct())
    checkInTime = serializers.DateTimeField(source='check_in_time', read_only=True)
    checkOutTime = serializers.DateTimeField(source='check_out_time', read_only=True)
    canceledTime = serializers.DateTimeField(source='canceled_time', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Shift
        fields = [
            'id', 'venue', 'venueDetails', 'staffUser', 'staffDetails', 
            'startTime', 'endTime', 'status', 'checkInTime', 
            'checkOutTime', 'canceledTime', 'createdAt', 'updatedAt'
        ]
    
    def validate(self, data):
        # Ensure start time is before end time
        if 'start_time' in data and 'end_time' in data:
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("Start time must be before end time")
        
        # Ensure start time is in the future when creating shifts
        if self.instance is None and 'start_time' in data:
            if data['start_time'] <= timezone.now():
                raise serializers.ValidationError("Start time must be in the future")
        
        return data
        
    def to_internal_value(self, data):
        # Convert camelCase to snake_case for incoming data
        if 'startTime' in data:
            data['start_time'] = data.pop('startTime')
        if 'endTime' in data:
            data['end_time'] = data.pop('endTime')
        if 'staffUser' in data:
            data['staff_user'] = data.pop('staffUser')
        return super().to_internal_value(data)

class ShiftDetailSerializer(ShiftSerializer):
    venue = VenueSerializer(read_only=True)
    staff_user = UserSerializer(read_only=True)

class FrontendShiftDetailSerializer(FrontendShiftSerializer):
    venue = serializers.SerializerMethodField()
    staffUser = serializers.SerializerMethodField()
    
    def get_venue(self, obj):
        if obj.venue:
            return VenueSerializer(obj.venue).data
        return None
    
    def get_staffUser(self, obj):
        if obj.staff_user:
            return UserSerializer(obj.staff_user).data
        return None 