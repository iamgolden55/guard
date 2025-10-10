from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Sum, Q
from decimal import Decimal
from .models import LeaveType, LeavePolicy, LeaveEntitlement, BlackoutPeriod, LeaveRequest
from api.models import EmploymentType, StaffProfile, Venue

User = get_user_model()


class EmploymentTypeSerializer(serializers.ModelSerializer):
    """Serializer for employment types used in leave management"""

    class Meta:
        model = EmploymentType
        fields = ['id', 'name', 'description']
        read_only_fields = ['id']


class LeaveTypeSerializer(serializers.ModelSerializer):
    """Serializer for leave types with comprehensive validation"""

    employment_types = EmploymentTypeSerializer(many=True, read_only=True)
    employment_type_ids = serializers.PrimaryKeyRelatedField(
        queryset=EmploymentType.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='employment_types'
    )

    class Meta:
        model = LeaveType
        fields = [
            'id', 'name', 'code', 'description', 'color_code',
            'is_active', 'requires_approval', 'min_notice_days',
            'max_consecutive_days', 'employment_types', 'employment_type_ids',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_code(self, value):
        """Ensure leave type code is uppercase and unique"""
        value = value.upper()

        # Check uniqueness excluding current instance
        if self.instance:
            if LeaveType.objects.exclude(pk=self.instance.pk).filter(code=value).exists():
                raise serializers.ValidationError("A leave type with this code already exists.")
        else:
            if LeaveType.objects.filter(code=value).exists():
                raise serializers.ValidationError("A leave type with this code already exists.")

        return value

    def validate_color_code(self, value):
        """Validate hex color code format"""
        if not value.startswith('#') or len(value) != 7:
            raise serializers.ValidationError("Color code must be in hex format (#RRGGBB)")

        try:
            int(value[1:], 16)
        except ValueError:
            raise serializers.ValidationError("Invalid hex color code")

        return value

    def validate(self, data):
        """Cross-field validation"""
        if data.get('max_consecutive_days') is not None:
            if data.get('max_consecutive_days') <= 0:
                raise serializers.ValidationError({
                    'max_consecutive_days': 'Must be greater than 0 if specified'
                })

        return data


class LeavePolicyListSerializer(serializers.ModelSerializer):
    """Simplified serializer for leave policy list views"""

    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    employment_type_count = serializers.SerializerMethodField()

    class Meta:
        model = LeavePolicy
        fields = [
            'id', 'name', 'leave_type_name', 'leave_type_code',
            'accrual_method', 'accrual_rate', 'max_balance',
            'is_active', 'effective_date', 'expiry_date',
            'employment_type_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_employment_type_count(self, obj):
        """Get count of employment types this policy applies to"""
        return obj.employment_types.count()


class LeavePolicySerializer(serializers.ModelSerializer):
    """Comprehensive serializer for leave policy CRUD operations"""

    leave_type = LeaveTypeSerializer(read_only=True)
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.filter(is_active=True),
        write_only=True,
        source='leave_type'
    )
    employment_types = EmploymentTypeSerializer(many=True, read_only=True)
    employment_type_ids = serializers.PrimaryKeyRelatedField(
        queryset=EmploymentType.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='employment_types'
    )

    # Service brackets validation
    service_brackets_display = serializers.SerializerMethodField()

    class Meta:
        model = LeavePolicy
        fields = [
            'id', 'name', 'leave_type', 'leave_type_id',
            'employment_types', 'employment_type_ids',
            'accrual_method', 'accrual_rate', 'max_accrual_per_year',
            'max_balance', 'service_brackets', 'service_brackets_display',
            'carryover_method', 'carryover_limit', 'carryover_expiry_months',
            'probation_months', 'min_employment_days',
            'allow_negative_balance', 'negative_balance_limit',
            'is_active', 'effective_date', 'expiry_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_service_brackets_display(self, obj):
        """Format service brackets for display"""
        if not obj.service_brackets:
            return []

        return [
            {
                'years': round(bracket.get('months', 0) / 12, 1),
                'months': bracket.get('months', 0),
                'rate': bracket.get('rate', 0),
                'description': f"{round(bracket.get('months', 0) / 12, 1)} years: {bracket.get('rate', 0)} days/year"
            }
            for bracket in obj.service_brackets
        ]

    def validate_service_brackets(self, value):
        """Validate service brackets structure"""
        if not value:
            return value

        if not isinstance(value, list):
            raise serializers.ValidationError("Service brackets must be a list")

        for i, bracket in enumerate(value):
            if not isinstance(bracket, dict):
                raise serializers.ValidationError(f"Bracket {i+1} must be an object")

            if 'months' not in bracket or 'rate' not in bracket:
                raise serializers.ValidationError(
                    f"Bracket {i+1} must contain 'months' and 'rate' fields"
                )

            try:
                months = int(bracket['months'])
                rate = float(bracket['rate'])
                if months < 0 or rate < 0:
                    raise ValueError()
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    f"Bracket {i+1} must have valid positive numeric values"
                )

        # Sort brackets by months for consistency
        return sorted(value, key=lambda x: x['months'])

    def validate(self, data):
        """Cross-field validation for leave policies"""
        errors = {}

        # Validate accrual method specific fields
        accrual_method = data.get('accrual_method')
        if accrual_method == 'length_of_service':
            if not data.get('service_brackets'):
                errors['service_brackets'] = 'Service brackets are required for length-of-service accrual'

        # Validate carryover settings
        carryover_method = data.get('carryover_method')
        if carryover_method == 'partial':
            if not data.get('carryover_limit'):
                errors['carryover_limit'] = 'Carryover limit is required for partial carryover'

        # Validate negative balance settings
        if not data.get('allow_negative_balance', False):
            if data.get('negative_balance_limit', 0) > 0:
                errors['negative_balance_limit'] = 'Negative balance limit should be 0 if negative balance not allowed'

        # Validate dates
        effective_date = data.get('effective_date')
        expiry_date = data.get('expiry_date')
        if effective_date and expiry_date and effective_date >= expiry_date:
            errors['expiry_date'] = 'Expiry date must be after effective date'

        # Validate policy uniqueness per leave type
        name = data.get('name')
        leave_type = data.get('leave_type')
        if name and leave_type:
            existing_query = LeavePolicy.objects.filter(name=name, leave_type=leave_type)
            if self.instance:
                existing_query = existing_query.exclude(pk=self.instance.pk)
            if existing_query.exists():
                errors['name'] = 'A policy with this name already exists for this leave type'

        if errors:
            raise serializers.ValidationError(errors)

        return data


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user information for leave entitlements"""

    full_name = serializers.SerializerMethodField()
    employment_type = serializers.CharField(
        source='profile.employment_type.name',
        read_only=True
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'email', 'employment_type']
        read_only_fields = fields

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class LeaveEntitlementSerializer(serializers.ModelSerializer):
    """Serializer for leave entitlements with balance calculations"""

    user = UserBasicSerializer(read_only=True)
    policy = LeavePolicyListSerializer(read_only=True)
    current_balance = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    total_entitlement = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    # Additional calculated fields
    projected_balance = serializers.SerializerMethodField()
    accrual_to_date_percentage = serializers.SerializerMethodField()
    usage_percentage = serializers.SerializerMethodField()

    class Meta:
        model = LeaveEntitlement
        fields = [
            'id', 'user', 'policy', 'year',
            'annual_entitlement', 'carried_over', 'accrued_to_date',
            'used_to_date', 'current_balance', 'total_entitlement',
            'projected_balance', 'accrual_to_date_percentage', 'usage_percentage',
            'last_accrual_date', 'carryover_expiry_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'current_balance', 'total_entitlement',
            'created_at', 'updated_at'
        ]

    def get_projected_balance(self, obj):
        """Calculate projected balance at year end"""
        if obj.policy.accrual_method == 'monthly':
            current_date = timezone.now().date()
            months_remaining = 12 - current_date.month
            monthly_accrual = obj.policy.calculate_monthly_accrual(obj.user, current_date)
            projected_accrual = monthly_accrual * months_remaining
            return obj.current_balance + projected_accrual
        elif obj.policy.accrual_method == 'annual':
            return obj.annual_entitlement + obj.carried_over - obj.used_to_date

        return obj.current_balance

    def get_accrual_to_date_percentage(self, obj):
        """Calculate what percentage of annual entitlement has been accrued"""
        if obj.annual_entitlement > 0:
            return round((obj.accrued_to_date / obj.annual_entitlement) * 100, 1)
        return 0

    def get_usage_percentage(self, obj):
        """Calculate what percentage of current balance has been used"""
        total_available = obj.total_entitlement
        if total_available > 0:
            return round((obj.used_to_date / total_available) * 100, 1)
        return 0


class LeaveBalanceSerializer(serializers.Serializer):
    """Serializer for aggregated leave balance information"""

    leave_type = LeaveTypeSerializer(read_only=True)
    current_year_balance = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    total_entitlement = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    used_to_date = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    carried_over = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)
    projected_year_end = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    # Policy information
    policy_allows_negative = serializers.BooleanField(read_only=True)
    negative_balance_limit = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    # Detailed breakdown
    entitlements = LeaveEntitlementSerializer(many=True, read_only=True)


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Serializer for leave request submission and retrieval"""

    # For reading: include full leave_type object
    leave_type = LeaveTypeSerializer(read_only=True)

    # For writing: accept leave_type_id
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.filter(is_active=True),
        source='leave_type',
        write_only=True
    )

    # User information (read-only)
    user = serializers.SerializerMethodField(read_only=True)

    # Approval information
    approved_by = serializers.SerializerMethodField(read_only=True)
    reviewed_by = serializers.SerializerMethodField(read_only=True)
    reviewed_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'leave_type', 'leave_type_id', 'start_date', 'end_date',
            'days_requested', 'reason', 'status', 'user', 'staff_user',
            'created_at', 'submitted_at', 'approved_at', 'approved_by',
            'reviewed_by', 'reviewed_at', 'manager_notes', 'emergency'
        ]
        read_only_fields = [
            'id', 'status', 'created_at', 'submitted_at', 'approved_at',
            'staff_user', 'approved_by', 'reviewed_by', 'reviewed_at', 'manager_notes'
        ]

    def get_user(self, obj):
        """Return user information"""
        if obj.staff_user:
            return {
                'id': obj.staff_user.id,
                'first_name': obj.staff_user.first_name,
                'last_name': obj.staff_user.last_name,
                'email': obj.staff_user.email
            }
        return None

    def get_approved_by(self, obj):
        """Return approver information"""
        if obj.approved_by:
            return {
                'id': obj.approved_by.id,
                'name': f"{obj.approved_by.first_name} {obj.approved_by.last_name}",
                'first_name': obj.approved_by.first_name,
                'last_name': obj.approved_by.last_name
            }
        return None

    def get_reviewed_by(self, obj):
        """Return reviewer information (same as approved_by for compatibility)"""
        return self.get_approved_by(obj)

    def get_reviewed_at(self, obj):
        """Return review timestamp (same as approved_at for compatibility)"""
        return obj.approved_at.isoformat() if obj.approved_at else None

    def validate(self, data):
        """Validate leave request data"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if start_date and end_date:
            if start_date > end_date:
                raise serializers.ValidationError({
                    'end_date': 'End date must be after start date'
                })

            # Calculate business days
            delta = end_date - start_date
            business_days = delta.days + 1

            if data.get('days_requested', 0) > business_days:
                raise serializers.ValidationError({
                    'days_requested': 'Requested days cannot exceed date range'
                })

        return data


# Admin-specific serializers
class LeavePolicyAdminSerializer(LeavePolicySerializer):
    """Extended serializer for admin users with additional fields"""

    entitlement_count = serializers.SerializerMethodField()
    total_balance_issued = serializers.SerializerMethodField()

    class Meta(LeavePolicySerializer.Meta):
        fields = LeavePolicySerializer.Meta.fields + [
            'entitlement_count', 'total_balance_issued'
        ]

    def get_entitlement_count(self, obj):
        """Count of users with entitlements for this policy"""
        current_year = timezone.now().year
        return obj.entitlements.filter(year=current_year).count()

    def get_total_balance_issued(self, obj):
        """Total balance issued across all users"""
        current_year = timezone.now().year
        return obj.entitlements.filter(
            year=current_year
        ).aggregate(
            total=Sum('annual_entitlement')
        )['total'] or Decimal('0')


class LeaveTypeUsageSerializer(serializers.Serializer):
    """Statistics serializer for leave type usage"""

    leave_type = LeaveTypeSerializer(read_only=True)
    total_users = serializers.IntegerField(read_only=True)
    total_entitlement = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_used = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_remaining = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    usage_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)


class BlackoutPeriodSerializer(serializers.ModelSerializer):
    """Serializer for blackout periods management"""

    leave_types = LeaveTypeSerializer(many=True, read_only=True)
    leave_type_ids = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='leave_types'
    )
    venue_name = serializers.CharField(source='venue.name', read_only=True)

    class Meta:
        model = BlackoutPeriod
        fields = [
            'id', 'name', 'description', 'start_date', 'end_date',
            'venue', 'venue_name', 'leave_types', 'leave_type_ids',
            'restriction_level', 'max_staff_percentage',
            'allow_manager_override', 'override_reason_required',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        """Cross-field validation for blackout periods"""
        if data['end_date'] < data['start_date']:
            raise serializers.ValidationError({
                'end_date': 'End date must be after start date'
            })

        if data.get('restriction_level') == 'limit_percentage' and not data.get('max_staff_percentage'):
            raise serializers.ValidationError({
                'max_staff_percentage': 'Max staff percentage is required for limit_percentage restriction'
            })

        return data




class TeamOverviewSerializer(serializers.Serializer):
    """Serializer for team overview data"""

    # Directly serialize user fields instead of nesting
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)

    leave_balances = serializers.SerializerMethodField()
    pending_requests_count = serializers.SerializerMethodField()
    upcoming_leave = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()

    def get_leave_balances(self, obj):
        """Get current year leave balances for the user"""
        current_year = timezone.now().year
        entitlements = LeaveEntitlement.objects.filter(
            user=obj,
            year=current_year
        ).select_related('policy__leave_type')

        balances = []
        for entitlement in entitlements:
            balances.append({
                'leave_type': entitlement.policy.leave_type.name,
                'leave_type_code': entitlement.policy.leave_type.code,
                'current_balance': entitlement.current_balance,
                'total_entitlement': entitlement.total_entitlement,
                'used_to_date': entitlement.used_to_date,
                'color_code': entitlement.policy.leave_type.color_code
            })

        return balances

    def get_pending_requests_count(self, obj):
        """Count of pending leave requests"""
        from .models import LeaveRequest
        return LeaveRequest.objects.filter(
            staff_user=obj,
            status='pending'
        ).count()

    def get_upcoming_leave(self, obj):
        """Get approved leave in next 30 days"""
        from .models import LeaveRequest
        from datetime import date, timedelta

        today = date.today()
        next_30_days = today + timedelta(days=30)

        upcoming = LeaveRequest.objects.filter(
            staff_user=obj,
            status='approved',
            start_date__gte=today,
            start_date__lte=next_30_days
        ).select_related('leave_type').order_by('start_date')[:5]

        return [{
            'id': req.id,
            'leave_type': req.leave_type.name,
            'start_date': req.start_date,
            'end_date': req.end_date,
            'days_requested': req.days_requested
        } for req in upcoming]

    def get_recent_activity(self, obj):
        """Get recent leave activity (last 10 requests/approvals)"""
        from .models import LeaveRequest

        recent = LeaveRequest.objects.filter(
            staff_user=obj
        ).select_related('leave_type', 'approved_by').order_by('-created_at')[:5]

        return [{
            'id': req.id,
            'leave_type': req.leave_type.name,
            'start_date': req.start_date,
            'end_date': req.end_date,
            'status': req.status,
            'created_at': req.created_at,
            'approved_by': req.approved_by.username if req.approved_by else None
        } for req in recent]


class TeamCalendarSerializer(serializers.Serializer):
    """Serializer for team calendar view"""

    date = serializers.DateField()
    events = serializers.SerializerMethodField()

    def get_events(self, obj):
        """Get all leave events for this date"""
        from .models import LeaveRequest

        events = LeaveRequest.objects.filter(
            status='approved',
            start_date__lte=obj['date'],
            end_date__gte=obj['date']
        ).select_related('staff_user', 'leave_type')

        return [{
            'id': event.id,
            'user': event.staff_user.username,
            'user_full_name': f"{event.staff_user.first_name} {event.staff_user.last_name}".strip(),
            'leave_type': event.leave_type.name,
            'leave_type_color': event.leave_type.color_code,
            'request_type': event.request_type,
            'is_full_day': event.request_type == 'full_day'
        } for event in events]


class LeaveAnalyticsSerializer(serializers.Serializer):
    """Serializer for leave analytics and reports"""

    period = serializers.CharField()
    total_requests = serializers.IntegerField()
    approved_requests = serializers.IntegerField()
    pending_requests = serializers.IntegerField()
    rejected_requests = serializers.IntegerField()
    total_days_taken = serializers.DecimalField(max_digits=10, decimal_places=2)
    average_days_per_request = serializers.DecimalField(max_digits=6, decimal_places=2)
    most_popular_leave_type = serializers.CharField()
    busiest_month = serializers.CharField()
    leave_types_breakdown = serializers.ListField()
    monthly_trends = serializers.ListField()