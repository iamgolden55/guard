from django.contrib import admin
from .models import (
    User, StaffProfile, EmergencyContact, BankDetails, SIALicense,
    SecurityQualification, StaffAvailability, Venue, VenueTermsAcceptance,
    PreferredVenue, ShiftStatusHistory, ShiftTemplate, OpenShiftRequest, 
    Shift, FireExitCheck, CapacityCheck, ToiletCheck, ShiftExchange,
    Invoice, InvoiceItem, PayRate, DeputyConfig, DeputyEmployee,
    DeputyTimesheet, LatenessRecord, IncidentReport, CapacityFlow,
    VenueHandover, QualificationReminder
)

# Register your models here.
admin.site.register(User)
admin.site.register(StaffProfile)
admin.site.register(EmergencyContact)
admin.site.register(BankDetails)
admin.site.register(SIALicense)
admin.site.register(SecurityQualification)
admin.site.register(StaffAvailability)
admin.site.register(Venue)
admin.site.register(VenueTermsAcceptance)
admin.site.register(PreferredVenue)
admin.site.register(ShiftStatusHistory)
admin.site.register(ShiftTemplate)
admin.site.register(OpenShiftRequest)
@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['id', 'staff_user', 'venue', 'start_time', 'status', 'auto_checkout', 'actual_hours_worked']
    list_filter = ['status', 'auto_checkout', 'venue', 'start_time']
    search_fields = ['staff_user__username', 'venue__name']
    readonly_fields = ['auto_checkout', 'created_at', 'updated_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('staff_user', 'venue')
admin.site.register(FireExitCheck)
admin.site.register(CapacityCheck)
admin.site.register(ToiletCheck)
admin.site.register(ShiftExchange)
admin.site.register(Invoice)
admin.site.register(InvoiceItem)
admin.site.register(PayRate)
admin.site.register(DeputyConfig)
admin.site.register(DeputyEmployee)
admin.site.register(DeputyTimesheet)
admin.site.register(LatenessRecord)
admin.site.register(IncidentReport)
admin.site.register(CapacityFlow)
admin.site.register(VenueHandover)
admin.site.register(QualificationReminder)
