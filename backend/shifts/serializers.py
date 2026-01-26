from rest_framework import serializers
from django.utils import timezone
from api.models import Shift, Venue, User, ShiftExchange, OpenShiftRequest, ContractorUnavailability  # Import from api.models
from django.contrib.auth import get_user_model
from api.utils.shift_validators import check_shift_overlap, check_exact_duplicate


def check_staff_availability(staff_user, shift_date):
    """
    Check if staff member is available on a given date.
    Returns (is_available, error_details) tuple.

    error_details contains:
    - staff_name: Full name of the staff member
    - date: The date being checked
    - unavailability_start: Start of unavailability period
    - unavailability_end: End of unavailability period
    - reason: Reason for unavailability (if provided)
    - employment_type: 'contractor' or 'permanent'
    """
    # Get staff's employment category
    employment_category = None
    if hasattr(staff_user, 'profile') and staff_user.profile:
        employment_type = staff_user.profile.employment_type
        if employment_type:
            employment_category = getattr(employment_type, 'employment_category', None)

    staff_name = staff_user.get_full_name() or staff_user.username

    # Check contractor unavailability
    if employment_category in ('contractor', 'temporary', None):
        unavailability = ContractorUnavailability.objects.filter(
            staff_user=staff_user,
            start_date__lte=shift_date,
            end_date__gte=shift_date
        ).first()

        if unavailability:
            return False, {
                'staff_name': staff_name,
                'date': shift_date,
                'unavailability_start': unavailability.start_date,
                'unavailability_end': unavailability.end_date,
                'reason': unavailability.reason or None,
                'employment_type': 'contractor'
            }

    # Check permanent employee leave
    if employment_category == 'permanent':
        from leave_management.models import LeaveRequest as LeaveManagementRequest

        approved_leave = LeaveManagementRequest.objects.filter(
            staff_user=staff_user,
            status='approved',
            start_date__lte=shift_date,
            end_date__gte=shift_date
        ).first()

        if approved_leave:
            return False, {
                'staff_name': staff_name,
                'date': shift_date,
                'unavailability_start': approved_leave.start_date,
                'unavailability_end': approved_leave.end_date,
                'reason': f"Approved leave: {approved_leave.leave_type}" if hasattr(approved_leave, 'leave_type') else "Approved leave",
                'employment_type': 'permanent'
            }

    return True, None

# Simple serializer classes to avoid circular imports
class SimpleVenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = [
            'id', 'name', 'address', 'latitude', 'longitude',
            'requires_fire_safety_checks', 'requires_capacity_monitoring', 
            'requires_toilet_checks', 'capacity'
        ]

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
    calculated_payment = serializers.ReadOnlyField()
    # Transfer status fields for mobile app
    pending_exchange = serializers.SerializerMethodField()
    pending_release = serializers.SerializerMethodField()
    approved_transfer = serializers.SerializerMethodField()
    # Multi-staff shift: co-workers field
    coworkers = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = [
            'id', 'venue', 'venue_details', 'staff_user', 'staff_details',
            'start_time', 'end_time', 'status', 'required_security_role',
            'check_in_time', 'check_out_time',
            'check_in_location', 'check_out_location',
            'check_in_photo', 'check_out_photo',
            'start_signature', 'end_signature',
            'break_duration',
            'shift_group', 'hourly_rate', 'is_special_event', 'calculated_payment',
            'actual_hours_worked', 'manager_approved', 'created_at', 'updated_at',
            # Transfer status fields
            'pending_exchange', 'pending_release', 'approved_transfer',
            # Multi-staff shift fields
            'coworkers'
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

        # Get staff_user - either from data or from existing instance (for updates)
        staff_user = data.get('staff_user') or (self.instance.staff_user if self.instance else None)

        # Get time values - either from data or from existing instance (for updates)
        start_time = data.get('start_time') or (self.instance.start_time if self.instance else None)
        end_time = data.get('end_time') or (self.instance.end_time if self.instance else None)

        # Check staff availability (unavailability periods / approved leave)
        if staff_user and start_time:
            shift_date = start_time.date() if hasattr(start_time, 'date') else start_time
            is_available, unavailability_details = check_staff_availability(staff_user, shift_date)

            if not is_available:
                details = unavailability_details
                staff_name = details['staff_name']
                start_str = details['unavailability_start'].strftime('%d %b %Y')
                end_str = details['unavailability_end'].strftime('%d %b %Y')

                # Build user-friendly error message
                if details['unavailability_start'] == details['unavailability_end']:
                    period_str = f"on {start_str}"
                else:
                    period_str = f"from {start_str} to {end_str}"

                if details['employment_type'] == 'contractor':
                    base_msg = f"{staff_name} has marked themselves as unavailable {period_str}."
                else:
                    base_msg = f"{staff_name} has approved leave {period_str}."

                if details.get('reason'):
                    base_msg += f" Reason: {details['reason']}"

                # Add helpful suggestion
                suggestion = " Please select a different date or contact the staff member to update their availability."

                raise serializers.ValidationError({
                    'staff_unavailable': base_msg + suggestion,
                    'details': {
                        'staff_name': staff_name,
                        'shift_date': str(shift_date),
                        'unavailability_start': str(details['unavailability_start']),
                        'unavailability_end': str(details['unavailability_end']),
                        'reason': details.get('reason'),
                        'type': details['employment_type']
                    }
                })

        # Check for overlapping shifts (regardless of shift_group)
        if staff_user and start_time and end_time:
            exclude_shift_id = self.instance.id if self.instance else None
            has_overlap, overlapping_shifts = check_shift_overlap(
                staff_user, start_time, end_time, exclude_shift_id
            )

            if has_overlap:
                first_conflict = overlapping_shifts.first()
                venue_name = first_conflict.venue.name if first_conflict.venue else 'Unknown venue'
                raise serializers.ValidationError(
                    f"This staff member already has a shift during this time: "
                    f"{first_conflict.start_time.strftime('%Y-%m-%d %H:%M')} - "
                    f"{first_conflict.end_time.strftime('%H:%M')} at {venue_name}"
                )

        # Also check for shift_group duplicates (legacy check for multi-staff shifts)
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

    def get_pending_exchange(self, obj):
        """Get pending/in-progress exchange for this shift (if any)"""
        # Look for pending/accepted exchanges where this shift is the original_shift
        exchange = ShiftExchange.objects.filter(
            original_shift=obj,
            status__in=['pending', 'accepted_by_target']
        ).select_related('target_user').first()

        if exchange:
            result = {
                'id': exchange.id,
                'status': exchange.status,
                'created_at': exchange.created_at.isoformat() if exchange.created_at else None,
                'request_reason': exchange.request_reason,
            }
            # Add null check for target_user to prevent AttributeError
            if exchange.target_user:
                result['target_user'] = {
                    'id': exchange.target_user.id,
                    'first_name': exchange.target_user.first_name,
                    'last_name': exchange.target_user.last_name,
                }
            else:
                result['target_user'] = None
            return result
        return None

    def get_pending_release(self, obj):
        """Get pending open shift request for this shift (if any)"""
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
        from datetime import timedelta

        # Look for recently approved exchanges (within last 7 days)
        recent_cutoff = timezone.now() - timedelta(days=7)

        exchange = ShiftExchange.objects.filter(
            original_shift=obj,
            status='approved',
            updated_at__gte=recent_cutoff
        ).select_related('target_user').first()

        if exchange:
            result = {
                'id': exchange.id,
                'approved_at': exchange.updated_at.isoformat() if exchange.updated_at else None,
                'was_auto_approved': exchange.manager_user is None,
            }
            # Add null check for target_user to prevent AttributeError
            if exchange.target_user:
                result['target_user'] = {
                    'id': exchange.target_user.id,
                    'first_name': exchange.target_user.first_name,
                    'last_name': exchange.target_user.last_name,
                }
            else:
                result['target_user'] = None
            return result
        return None

    def get_coworkers(self, obj):
        """
        Get co-workers for multi-staff shifts.

        Returns a list of other staff members assigned to the same shift_group,
        including their check-in/out status for real-time visibility.
        """
        if not obj.shift_group:
            return []

        # Query shifts with same shift_group, excluding current user's shift
        # Note: Related name is 'profile' not 'staffprofile'
        coworker_shifts = Shift.objects.filter(
            shift_group=obj.shift_group
        ).exclude(id=obj.id).select_related('staff_user', 'staff_user__profile')

        coworkers = []
        for shift in coworker_shifts:
            if shift.staff_user:
                # Get profile image URL if available
                profile_photo = None
                if hasattr(shift.staff_user, 'profile') and shift.staff_user.profile:
                    # Field is profile_image_url (a URL string), not profile_photo
                    profile_photo = shift.staff_user.profile.profile_image_url or None

                coworkers.append({
                    'id': shift.staff_user.id,
                    'first_name': shift.staff_user.first_name,
                    'last_name': shift.staff_user.last_name,
                    'profile_photo': profile_photo,
                    'shift_id': shift.id,
                    'check_in_time': shift.check_in_time.isoformat() if shift.check_in_time else None,
                    'check_out_time': shift.check_out_time.isoformat() if shift.check_out_time else None,
                    'status': shift.status,
                })

        return coworkers


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

        # Get staff_user - either from data or from existing instance (for updates)
        staff_user = data.get('staff_user') or (self.instance.staff_user if self.instance else None)

        # Get time values - either from data or from existing instance (for updates)
        start_time = data.get('start_time') or (self.instance.start_time if self.instance else None)
        end_time = data.get('end_time') or (self.instance.end_time if self.instance else None)

        # Check staff availability (unavailability periods / approved leave)
        if staff_user and start_time:
            shift_date = start_time.date() if hasattr(start_time, 'date') else start_time
            is_available, unavailability_details = check_staff_availability(staff_user, shift_date)

            if not is_available:
                details = unavailability_details
                staff_name = details['staff_name']
                start_str = details['unavailability_start'].strftime('%d %b %Y')
                end_str = details['unavailability_end'].strftime('%d %b %Y')

                # Build user-friendly error message
                if details['unavailability_start'] == details['unavailability_end']:
                    period_str = f"on {start_str}"
                else:
                    period_str = f"from {start_str} to {end_str}"

                if details['employment_type'] == 'contractor':
                    base_msg = f"{staff_name} has marked themselves as unavailable {period_str}."
                else:
                    base_msg = f"{staff_name} has approved leave {period_str}."

                if details.get('reason'):
                    base_msg += f" Reason: {details['reason']}"

                # Add helpful suggestion
                suggestion = " Please select a different date or contact the staff member to update their availability."

                raise serializers.ValidationError({
                    'staffUnavailable': base_msg + suggestion,
                    'details': {
                        'staffName': staff_name,
                        'shiftDate': str(shift_date),
                        'unavailabilityStart': str(details['unavailability_start']),
                        'unavailabilityEnd': str(details['unavailability_end']),
                        'reason': details.get('reason'),
                        'type': details['employment_type']
                    }
                })

        # Check for overlapping shifts (regardless of shift_group)
        if staff_user and start_time and end_time:
            exclude_shift_id = self.instance.id if self.instance else None
            has_overlap, overlapping_shifts = check_shift_overlap(
                staff_user, start_time, end_time, exclude_shift_id
            )

            if has_overlap:
                first_conflict = overlapping_shifts.first()
                venue_name = first_conflict.venue.name if first_conflict.venue else 'Unknown venue'
                raise serializers.ValidationError(
                    f"This staff member already has a shift during this time: "
                    f"{first_conflict.start_time.strftime('%Y-%m-%d %H:%M')} - "
                    f"{first_conflict.end_time.strftime('%H:%M')} at {venue_name}"
                )

        # Also check for shift_group duplicates (legacy check for multi-staff shifts)
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

        # Check for overlapping shifts for each staff member
        start_time = data['start_time']
        end_time = data['end_time']
        shift_date = start_time.date() if hasattr(start_time, 'date') else start_time
        conflicts = []
        unavailable_staff = []

        for user in staff_users:
            # Check staff availability (unavailability periods / approved leave)
            is_available, unavailability_details = check_staff_availability(user, shift_date)
            if not is_available:
                details = unavailability_details
                staff_name = details['staff_name']
                start_str = details['unavailability_start'].strftime('%d %b')
                end_str = details['unavailability_end'].strftime('%d %b')

                if details['unavailability_start'] == details['unavailability_end']:
                    period_str = f"on {start_str}"
                else:
                    period_str = f"{start_str} - {end_str}"

                reason_str = f" ({details['reason']})" if details.get('reason') else ""
                unavailable_staff.append(f"{staff_name}: unavailable {period_str}{reason_str}")

            # Check for overlapping shifts
            has_overlap, overlapping_shifts = check_shift_overlap(
                user, start_time, end_time
            )
            if has_overlap:
                first_conflict = overlapping_shifts.first()
                venue_name = first_conflict.venue.name if first_conflict.venue else 'Unknown venue'
                conflicts.append(
                    f"{user.get_full_name() or user.username}: "
                    f"already has shift at {venue_name} "
                    f"({first_conflict.start_time.strftime('%H:%M')} - {first_conflict.end_time.strftime('%H:%M')})"
                )

        # Report unavailable staff first (more important)
        if unavailable_staff:
            raise serializers.ValidationError({
                'staff_unavailable': "The following staff members are unavailable: " + "; ".join(unavailable_staff),
                'unavailable_count': len(unavailable_staff)
            })

        if conflicts:
            raise serializers.ValidationError(
                "Some staff members have conflicting shifts: " + "; ".join(conflicts)
            )

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
            # Double-check for overlaps before creating (race condition protection)
            has_overlap, _ = check_shift_overlap(
                staff_user, validated_data['start_time'], validated_data['end_time']
            )
            if has_overlap:
                # Skip this user if they now have a conflict (race condition)
                continue

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