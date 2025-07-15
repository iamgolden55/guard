from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    LoginView,
    UserViewSet, StaffProfileViewSet, EmergencyContactViewSet,
    BankDetailsViewSet, SIALicenseViewSet, StaffAvailabilityViewSet,
    VenueViewSet, VenueTermsAcceptanceViewSet, PreferredVenueViewSet,
    FireExitCheckViewSet, CapacityCheckViewSet, ToiletCheckViewSet,
    ShiftExchangeViewSet, OpenShiftRequestViewSet, InvoiceViewSet, InvoiceItemViewSet, PayRateViewSet,
    DeputyConfigViewSet, DeputyEmployeeViewSet, DeputyTimesheetViewSet,
    ShiftTemplateViewSet, DeputyConfigView, SystemSettingsView,
    my_profile, update_my_user,
    FileUploadView, payroll_preview, payroll_generate,
    EmploymentTypeViewSet, RecruitmentApplicationViewSet, RecruitmentApplicationPublicViewSet
)

router = DefaultRouter()
# Register your viewsets here
router.register('users', UserViewSet)
router.register('staff-profiles', StaffProfileViewSet)
router.register('emergency-contacts', EmergencyContactViewSet)
router.register('bank-details', BankDetailsViewSet)
router.register('sia-licenses', SIALicenseViewSet)
router.register('staff-availability', StaffAvailabilityViewSet)
router.register('venues', VenueViewSet)
router.register('venue-terms', VenueTermsAcceptanceViewSet)
router.register('preferred-venues', PreferredVenueViewSet)
# Shifts moved to separate app - see /api/shifts/ endpoints
router.register('fire-exit-checks', FireExitCheckViewSet)
router.register('capacity-checks', CapacityCheckViewSet)
router.register('toilet-checks', ToiletCheckViewSet)
router.register('shift-exchanges', ShiftExchangeViewSet)
router.register('open-shift-requests', OpenShiftRequestViewSet)
router.register('invoices', InvoiceViewSet)
router.register('invoice-items', InvoiceItemViewSet)
router.register('pay-rates', PayRateViewSet)
router.register('deputy-config', DeputyConfigViewSet)
router.register('deputy-employees', DeputyEmployeeViewSet)
router.register('deputy-timesheets', DeputyTimesheetViewSet)
router.register('shift-templates', ShiftTemplateViewSet)
router.register('employment-types', EmploymentTypeViewSet)
router.register('recruitment-applications', RecruitmentApplicationViewSet)
router.register('recruitment-apply', RecruitmentApplicationPublicViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/', include('rest_framework.urls')),
    path('login/', LoginView.as_view(), name='login'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('deputy/config/', DeputyConfigView.as_view(), name='deputy-config'),
    path('settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('profiles/me', my_profile, name='my-profile'),
    path('users/me', update_my_user, name='update-my-user'),
    path('upload/', FileUploadView.as_view(), name='file-upload'),
    path('admin/payroll/preview/', payroll_preview, name='payroll-preview'),
    path('admin/payroll/generate/', payroll_generate, name='payroll-generate'),
] 