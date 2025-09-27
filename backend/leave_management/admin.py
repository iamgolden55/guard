from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count, Sum
from .models import LeaveType, LeavePolicy, LeaveEntitlement, LeaveRequest, LeaveBalance, BlackoutPeriod


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'code', 'color_display', 'requires_approval',
        'min_notice_days', 'max_consecutive_days', 'is_active',
        'policy_count'
    ]
    list_filter = ['is_active', 'requires_approval', 'created_at']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        (None, {
            'fields': ('name', 'code', 'description', 'color_code', 'is_active')
        }),
        ('Approval & Restrictions', {
            'fields': ('requires_approval', 'min_notice_days', 'max_consecutive_days')
        }),
        ('Employment Type Restrictions', {
            'fields': ('employment_types',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    filter_horizontal = ['employment_types']

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            policies_count=Count('policies')
        )

    def policy_count(self, obj):
        count = obj.policies_count
        if count > 0:
            url = reverse('admin:leave_management_leavepolicy_changelist')
            return format_html(
                '<a href="{}?leave_type__id__exact={}">{} policies</a>',
                url, obj.id, count
            )
        return '0 policies'
    policy_count.short_description = 'Policies'
    policy_count.admin_order_field = 'policies_count'

    def color_display(self, obj):
        return format_html(
            '<span style="background-color: {}; padding: 2px 8px; color: white; border-radius: 3px;">{}</span>',
            obj.color_code, obj.code
        )
    color_display.short_description = 'Color'


@admin.register(LeavePolicy)
class LeavePolicyAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'leave_type', 'accrual_method', 'accrual_rate_display',
        'carryover_method', 'is_active', 'effective_date', 'entitlement_count'
    ]
    list_filter = [
        'is_active', 'accrual_method', 'carryover_method',
        'leave_type', 'effective_date', 'employment_types'
    ]
    search_fields = ['name', 'leave_type__name']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'effective_date'

    fieldsets = (
        (None, {
            'fields': ('name', 'leave_type', 'is_active')
        }),
        ('Accrual Settings', {
            'fields': (
                'accrual_method', 'accrual_rate', 'max_accrual_per_year',
                'max_balance', 'service_brackets'
            )
        }),
        ('Carryover Settings', {
            'fields': (
                'carryover_method', 'carryover_limit', 'carryover_expiry_months'
            )
        }),
        ('Eligibility & Restrictions', {
            'fields': (
                'probation_months', 'min_employment_days',
                'allow_negative_balance', 'negative_balance_limit'
            )
        }),
        ('Employment Type Restrictions', {
            'fields': ('employment_types',),
            'classes': ('collapse',)
        }),
        ('Policy Duration', {
            'fields': ('effective_date', 'expiry_date')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    filter_horizontal = ['employment_types']

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            entitlements_count=Count('entitlements')
        ).select_related('leave_type')

    def accrual_rate_display(self, obj):
        if obj.accrual_method == 'monthly':
            annual_rate = obj.accrual_rate * 12
            return f"{obj.accrual_rate}/month ({annual_rate}/year)"
        elif obj.accrual_method == 'annual':
            return f"{obj.accrual_rate}/year"
        elif obj.accrual_method == 'per_shift':
            return f"{obj.accrual_rate}/shift"
        else:
            return f"{obj.accrual_rate}"
    accrual_rate_display.short_description = 'Accrual Rate'

    def entitlement_count(self, obj):
        count = obj.entitlements_count
        if count > 0:
            url = reverse('admin:leave_management_leaveentitlement_changelist')
            return format_html(
                '<a href="{}?policy__id__exact={}">{} entitlements</a>',
                url, obj.id, count
            )
        return '0 entitlements'
    entitlement_count.short_description = 'Entitlements'
    entitlement_count.admin_order_field = 'entitlements_count'

    def save_model(self, request, obj, form, change):
        """Override save to run model validation"""
        obj.full_clean()
        super().save_model(request, obj, form, change)


@admin.register(LeaveEntitlement)
class LeaveEntitlementAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'leave_type_name', 'policy', 'year',
        'annual_entitlement', 'carried_over', 'accrued_to_date',
        'used_to_date', 'current_balance_display', 'last_accrual_date'
    ]
    list_filter = [
        'year', 'policy__leave_type', 'policy',
        'last_accrual_date', 'user__role'
    ]
    search_fields = [
        'user__username', 'user__first_name', 'user__last_name',
        'policy__name', 'policy__leave_type__name'
    ]
    readonly_fields = ['created_at', 'updated_at', 'current_balance_property']
    date_hierarchy = 'last_accrual_date'

    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'policy', 'year')
        }),
        ('Entitlement Details', {
            'fields': (
                'annual_entitlement', 'carried_over', 'accrued_to_date',
                'used_to_date', 'current_balance_property'
            )
        }),
        ('Tracking', {
            'fields': ('last_accrual_date', 'carryover_expiry_date')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'user', 'policy', 'policy__leave_type'
        )

    def leave_type_name(self, obj):
        return obj.policy.leave_type.name
    leave_type_name.short_description = 'Leave Type'
    leave_type_name.admin_order_field = 'policy__leave_type__name'

    def current_balance_display(self, obj):
        balance = obj.current_balance
        if balance < 0:
            return format_html(
                '<span style="color: red; font-weight: bold;">{}</span>',
                balance
            )
        elif balance == 0:
            return format_html(
                '<span style="color: orange;">{}</span>',
                balance
            )
        else:
            return format_html(
                '<span style="color: green;">{}</span>',
                balance
            )
    current_balance_display.short_description = 'Current Balance'

    def current_balance_property(self, obj):
        return obj.current_balance
    current_balance_property.short_description = 'Current Balance (Calculated)'

    actions = ['recalculate_balances']

    def recalculate_balances(self, request, queryset):
        """Admin action to recalculate balances for selected entitlements"""
        updated_count = 0
        for entitlement in queryset:
            # Force recalculation by saving the model
            entitlement.save()
            updated_count += 1

        self.message_user(
            request,
            f'Successfully recalculated balances for {updated_count} entitlements.'
        )
    recalculate_balances.short_description = 'Recalculate selected balances'


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = [
        'staff_user', 'leave_type', 'request_type', 'start_date', 'end_date',
        'days_requested', 'status_display', 'submitted_at', 'approved_by'
    ]
    list_filter = [
        'status', 'request_type', 'leave_type', 'emergency',
        'submitted_at', 'approved_at', 'staff_user__role'
    ]
    search_fields = [
        'staff_user__username', 'staff_user__first_name', 'staff_user__last_name',
        'leave_type__name', 'reason', 'manager_notes'
    ]
    readonly_fields = [
        'created_at', 'updated_at', 'duration_days_property',
        'submitted_at', 'approved_at', 'balance_deducted', 'notification_sent'
    ]
    date_hierarchy = 'start_date'

    fieldsets = (
        ('Request Details', {
            'fields': (
                'staff_user', 'leave_type', 'start_date', 'end_date',
                'request_type', 'start_time', 'end_time', 'days_requested',
                'duration_days_property'
            )
        }),
        ('Request Information', {
            'fields': ('reason', 'emergency')
        }),
        ('Approval Workflow', {
            'fields': (
                'status', 'submitted_at', 'approved_by',
                'approved_at', 'manager_notes'
            )
        }),
        ('System Tracking', {
            'fields': ('balance_deducted', 'notification_sent'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'staff_user', 'leave_type', 'approved_by'
        )

    def status_display(self, obj):
        colors = {
            'draft': 'gray',
            'pending': 'orange',
            'approved': 'green',
            'rejected': 'red',
            'cancelled': 'gray',
            'withdrawn': 'gray',
        }
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            colors.get(obj.status, 'black'),
            obj.get_status_display()
        )
    status_display.short_description = 'Status'
    status_display.admin_order_field = 'status'

    def duration_days_property(self, obj):
        return f"{obj.duration_days} days"
    duration_days_property.short_description = 'Duration'

    actions = ['approve_requests', 'reject_requests']

    def approve_requests(self, request, queryset):
        """Admin action to approve selected requests"""
        approved_count = 0
        for leave_request in queryset.filter(status='pending'):
            leave_request.approve(request.user, 'Approved via admin action')
            approved_count += 1

        self.message_user(
            request,
            f'Successfully approved {approved_count} leave requests.'
        )
    approve_requests.short_description = 'Approve selected requests'

    def reject_requests(self, request, queryset):
        """Admin action to reject selected requests"""
        rejected_count = 0
        for leave_request in queryset.filter(status='pending'):
            leave_request.reject(request.user, 'Rejected via admin action')
            rejected_count += 1

        self.message_user(
            request,
            f'Successfully rejected {rejected_count} leave requests.'
        )
    reject_requests.short_description = 'Reject selected requests'


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = [
        'staff_user', 'leave_type', 'year', 'opening_balance',
        'accrued_balance', 'used_balance', 'pending_balance',
        'current_balance_display', 'available_balance_display',
        'last_updated'
    ]
    list_filter = [
        'year', 'leave_type', 'last_updated', 'staff_user__role'
    ]
    search_fields = [
        'staff_user__username', 'staff_user__first_name',
        'staff_user__last_name', 'leave_type__name'
    ]
    readonly_fields = [
        'created_at', 'updated_at', 'last_updated',
        'current_balance_property', 'available_balance_property',
        'total_entitlement_property'
    ]
    date_hierarchy = 'last_updated'

    fieldsets = (
        ('Basic Information', {
            'fields': ('staff_user', 'leave_type', 'year')
        }),
        ('Balance Components', {
            'fields': (
                'opening_balance', 'accrued_balance', 'used_balance',
                'pending_balance', 'adjustment_balance'
            )
        }),
        ('Calculated Balances', {
            'fields': (
                'current_balance_property', 'available_balance_property',
                'total_entitlement_property'
            )
        }),
        ('Tracking Information', {
            'fields': ('last_accrual_date', 'last_updated')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'staff_user', 'leave_type'
        )

    def current_balance_display(self, obj):
        balance = obj.current_balance
        if balance < 0:
            return format_html(
                '<span style="color: red; font-weight: bold;">{}</span>',
                balance
            )
        elif balance == 0:
            return format_html(
                '<span style="color: orange;">{}</span>',
                balance
            )
        else:
            return format_html(
                '<span style="color: green;">{}</span>',
                balance
            )
    current_balance_display.short_description = 'Current Balance'

    def available_balance_display(self, obj):
        balance = obj.available_balance
        if balance < 0:
            return format_html(
                '<span style="color: red; font-weight: bold;">{}</span>',
                balance
            )
        else:
            return format_html(
                '<span style="color: blue;">{}</span>',
                balance
            )
    available_balance_display.short_description = 'Available Balance'

    def current_balance_property(self, obj):
        return obj.current_balance
    current_balance_property.short_description = 'Current Balance (Calculated)'

    def available_balance_property(self, obj):
        return obj.available_balance
    available_balance_property.short_description = 'Available Balance (Calculated)'

    def total_entitlement_property(self, obj):
        return obj.total_entitlement
    total_entitlement_property.short_description = 'Total Entitlement'

    actions = ['refresh_from_entitlements']

    def refresh_from_entitlements(self, request, queryset):
        """Admin action to refresh balances from entitlements"""
        updated_count = 0
        for balance in queryset:
            balance.refresh_from_entitlements()
            updated_count += 1

        self.message_user(
            request,
            f'Successfully refreshed {updated_count} balances from entitlements.'
        )
    refresh_from_entitlements.short_description = 'Refresh from entitlements'


@admin.register(BlackoutPeriod)
class BlackoutPeriodAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'start_date', 'end_date', 'venue_display',
        'restriction_level', 'max_staff_percentage',
        'allow_manager_override', 'is_active'
    ]
    list_filter = [
        'restriction_level', 'is_active', 'allow_manager_override',
        'start_date', 'venue', 'leave_types'
    ]
    search_fields = ['name', 'description', 'venue__name']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'start_date'

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Period', {
            'fields': ('start_date', 'end_date')
        }),
        ('Scope', {
            'fields': ('venue', 'leave_types')
        }),
        ('Restriction Settings', {
            'fields': (
                'restriction_level', 'max_staff_percentage'
            )
        }),
        ('Override Settings', {
            'fields': ('allow_manager_override', 'override_reason_required')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    filter_horizontal = ['leave_types']

    def venue_display(self, obj):
        if obj.venue:
            return obj.venue.name
        return 'System-wide'
    venue_display.short_description = 'Scope'
    venue_display.admin_order_field = 'venue__name'

    def save_model(self, request, obj, form, change):
        """Override save to run model validation"""
        obj.full_clean()
        super().save_model(request, obj, form, change)


# Custom admin site configuration
admin.site.site_header = 'Security Staff Management - Leave Management'
admin.site.site_title = 'Leave Management Admin'
admin.site.index_title = 'Leave Management Administration'
