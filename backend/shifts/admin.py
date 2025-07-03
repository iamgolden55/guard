from django.contrib import admin
from django.forms import ModelForm
from django.urls import reverse
from django.utils.html import format_html
from .models import Shift

class ShiftAdminForm(ModelForm):
    """Form that supports both snake_case and camelCase field names"""
    
    class Meta:
        model = Shift
        fields = '__all__'
    
    def clean(self):
        cleaned_data = super().clean()
        
        # Map camelCase fields to snake_case if they exist
        camel_to_snake_mapping = {
            'startTime': 'start_time',
            'endTime': 'end_time',
            'checkInTime': 'check_in_time',
            'checkOutTime': 'check_out_time',
            'staffUser': 'staff_user',
            'venueId': 'venue',
            'requiredSecurityRole': 'required_security_role',
            'managerSignature': 'manager_signature'
        }
        
        # Transfer data from camelCase to snake_case fields if present
        for camel_case, snake_case in camel_to_snake_mapping.items():
            if camel_case in self.data and not cleaned_data.get(snake_case):
                cleaned_data[snake_case] = self.data.get(camel_case)
        
        return cleaned_data

class ShiftAdmin(admin.ModelAdmin):
    form = ShiftAdminForm
    list_display = ('id', 'venue', 'staff_link', 'formatted_start_time', 'formatted_end_time', 'status', 'is_checked_in', 'is_checked_out')
    list_filter = ('venue', 'status', 'required_security_role')
    search_fields = ('staff_user__first_name', 'staff_user__last_name', 'venue__name', 'notes')
    readonly_fields = ('check_in_time', 'check_out_time', 'created_at', 'updated_at')
    fieldsets = (
        ('Shift Information', {
            'fields': ('venue', 'staff_user', 'start_time', 'end_time', 'status', 'required_security_role')
        }),
        ('Check-In/Out', {
            'fields': ('check_in_time', 'check_out_time', 'manager_signature')
        }),
        ('Notes & Metadata', {
            'fields': ('notes', 'created_at', 'updated_at')
        }),
    )
    
    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        queryset = queryset.select_related('staff_user', 'venue')
        return queryset

    def is_checked_in(self, obj):
        return obj.check_in_time is not None
    is_checked_in.boolean = True
    is_checked_in.short_description = 'Checked In'
    
    def is_checked_out(self, obj):
        return obj.check_out_time is not None
    is_checked_out.boolean = True
    is_checked_out.short_description = 'Checked Out'
    
    def staff_link(self, obj):
        if obj.staff_user:
            url = reverse("admin:auth_user_change", args=[obj.staff_user.id])
            return format_html('<a href="{}">{} {}</a>', url, obj.staff_user.first_name, obj.staff_user.last_name)
        return "Unassigned"
    staff_link.short_description = 'Staff'
    
    def formatted_start_time(self, obj):
        if obj.start_time:
            return obj.start_time.strftime("%Y-%m-%d %H:%M")
        return "-"
    formatted_start_time.short_description = 'Start Time'
    
    def formatted_end_time(self, obj):
        if obj.end_time:
            return obj.end_time.strftime("%Y-%m-%d %H:%M")
        return "-"
    formatted_end_time.short_description = 'End Time'

# Shift model is already registered in api/admin.py
# admin.site.register(Shift, ShiftAdmin) 