# Leave Management Backend Research Report

**Date:** October 2, 2025
**Project:** Security Staff Management System (Remix2)
**Research Focus:** Leave Management Models and Database Structure

---

## Executive Summary

This research reveals a **critical finding**: The frontend has a **complete, production-ready leave management system** with comprehensive UI components, type definitions, and service layer, but the **backend Django models, migrations, and API endpoints are completely missing**. This represents a significant frontend-backend disconnect.

### Key Findings

1. **Frontend Implementation Status: 100% Complete**
   - Comprehensive TypeScript type definitions
   - Full service layer with 40+ API methods
   - 15+ React components for leave management
   - Complete UI for staff, managers, and admins

2. **Backend Implementation Status: 0% Complete**
   - ❌ No leave-related models in `backend/api/models.py`
   - ❌ No leave-related migrations
   - ❌ No leave-related serializers
   - ❌ No leave-related API endpoints
   - ❌ No leave-related views or viewsets

3. **Current Backend Models:** 40 models exist (SecurityCompany, User, StaffProfile, Shift, Invoice, Compliance, etc.) but **zero leave management models**

---

## 1. Frontend Leave Management Implementation

### 1.1 Type Definitions (`frontend/src/types/leave.ts`)

The frontend defines **14 comprehensive interfaces** for a complete leave management system:

#### Core Entities
```typescript
- LeaveType: Leave category definitions (Annual, Sick, Personal, etc.)
- LeavePolicy: Accrual rules, carryover policies, eligibility
- LeaveEntitlement: User-specific leave balances per year
- LeaveRequest: Leave application with approval workflow
- LeaveBalanceSummary: Calculated balance information
```

#### Supporting Entities
```typescript
- BlackoutPeriod: Blocked leave periods
- LeaveSettings: System-wide configuration
- LeaveStatistics: Analytics and reporting data
- TeamOverviewData: Manager dashboard data
- PendingLeaveRequest: Approval queue items
```

**Total Lines:** 290 lines of TypeScript type definitions

### 1.2 Service Layer (`frontend/src/services/leaveService.ts`)

Comprehensive API service with **40+ methods** organized into:

#### API Endpoint Structure
```typescript
LEAVE_ENDPOINTS = {
  LEAVE_TYPES: '/leave/types',
  LEAVE_POLICIES: '/leave/policies',
  LEAVE_ENTITLEMENTS: '/leave/entitlements',
  LEAVE_REQUESTS: '/leave/requests',
  LEAVE_BALANCES: '/leave/balances',
  LEAVE_APPROVALS: '/leave/approvals',
  LEAVE_STATISTICS: '/leave/statistics',
  LEAVE_CALENDAR: '/leave/calendar',
  TEAM_OVERVIEW: '/leave/team/overview',
  TEAM_BALANCES: '/leave/team/balances',
  TEAM_CALENDAR: '/leave/team/calendar',
  LEAVE_ANALYTICS: '/leave/analytics',
  LEAVE_REPORTS: '/leave/reports',
  LEAVE_SETTINGS: '/leave/settings',
  BLACKOUT_PERIODS: '/leave/blackout-periods'
}
```

#### Service Methods Breakdown

**Leave Types (3 methods)**
- `getLeaveTypes()` - Get all available leave types
- `getLeaveType(id)` - Get specific leave type details

**Leave Policies (7 methods)**
- `getLeavePolicies()` - Get applicable policies
- `createLeavePolicy()` - Create new policy (admin)
- `updateLeavePolicy()` - Update existing policy (admin)
- `activateLeavePolicy()` - Activate policy (admin)
- `deactivateLeavePolicy()` - Deactivate policy (admin)
- `deleteLeavePolicy()` - Delete policy (admin)
- `getPoliciesByLeaveType()` - Filter by leave type

**Leave Entitlements (3 methods)**
- `getLeaveEntitlements(userId, year)` - Get user entitlements
- `getMyEntitlements(year)` - Get current user entitlements

**Leave Balances (4 methods)**
- `getLeaveBalances(userId)` - Get comprehensive balance info
- `getMyBalances()` - Get current user balances
- `getBalanceByLeaveType()` - Get balance for specific leave type

**Leave Requests (8 methods)**
- `createLeaveRequest()` - Submit new request with file uploads
- `getLeaveRequests()` - Get requests with filtering/pagination
- `getMyLeaveRequests()` - Get current user requests
- `getLeaveRequest(id)` - Get specific request details
- `updateLeaveRequest()` - Update pending request
- `cancelLeaveRequest()` - Cancel/withdraw request
- `deleteLeaveRequest()` - Delete pending request
- `validateLeaveRequest()` - Pre-validation without creation

**Manager/Admin Functions (4 methods)**
- `getPendingLeaveRequests()` - Get approval queue
- `processLeaveRequest()` - Approve/reject single request
- `bulkProcessLeaveRequests()` - Bulk approve/reject
- `approveLeaveRequest()` / `rejectLeaveRequest()` - Convenience methods

**Calendar & Statistics (5 methods)**
- `getLeaveCalendar()` - Get calendar events for date range
- `getLeaveCalendarEvents()` - Get events with filtering
- `getLeaveStatistics()` - Get statistical reports

**Team Management (3 methods)**
- `getTeamOverview()` - Comprehensive team data
- `getTeamBalances()` - Team member balances
- `getTeamCalendar()` - Team calendar events

**Reports & Analytics (6 methods)**
- `getLeaveAnalytics()` - Get analytics data
- `getLeaveReportSummary()` - Get report summary
- `getLeaveReportData()` - Get detailed report
- `exportLeaveReport()` - Export to CSV/PDF
- `getLeaveCapacityAnalysis()` - Capacity planning
- `getLeaveTrends()` - Trend analysis and predictions

**Settings Management (5 methods)**
- `getLeaveSettings()` - Get system settings
- `updateLeaveSettings()` - Update settings
- `getBlackoutPeriods()` - Get blackout periods
- `createBlackoutPeriod()` - Create blackout period
- `updateBlackoutPeriod()` / `deleteBlackoutPeriod()` - Manage periods

**Utility Methods (3 methods)**
- `calculateWorkingDays()` - Calculate business days
- `exportLeaveRequests()` - Export to CSV/Excel
- `downloadSupportingDocument()` - Download attachments

**Total Service Methods:** 42 comprehensive API integration methods

**Total Lines:** 842 lines of production-ready service code

### 1.3 React Components

#### Main Components (6 files in `/components/`)
```
1. LeaveRequestForm.tsx (18,245 bytes)
   - Submit new leave requests
   - Form validation and file uploads

2. LeaveApprovalDashboard.tsx (28,287 bytes)
   - Manager approval interface
   - Bulk approval functionality

3. LeaveBalanceDisplay.tsx (16,637 bytes)
   - Display user leave balances
   - Visual balance indicators

4. LeaveHistoryTable.tsx (29,249 bytes)
   - Complete request history
   - Filtering and sorting

5. LeaveCalendar.tsx (1,907 bytes)
   - Calendar view of leave requests

6. LeaveSidebar.tsx (9,854 bytes) [in /components/leave/]
   - Navigation sidebar for leave section
```

#### Advanced Components (16 files in `/components/leave/`)
```
1. LeaveAnalyticsDashboard.tsx (22,344 bytes)
   - Analytics and reporting dashboard

2. LeaveBalanceWidget.tsx (9,185 bytes)
   - Quick balance display widget

3. AccrualSettings.tsx (25,164 bytes)
   - Configure accrual rules

4. PolicyDetailsForm.tsx (24,400 bytes)
   - Create/edit leave policies

5. PolicyListTable.tsx (13,090 bytes)
   - Manage leave policies

6. BlackoutPeriodManager.tsx (21,182 bytes)
   - Manage blackout periods

7. TeamCalendarView.tsx (23,043 bytes)
   - Team-wide calendar view

8. TeamMemberCard.tsx (11,146 bytes)
   - Team member leave info

9. QuickApprovalWidget.tsx (15,080 bytes)
   - Quick approval interface

10. AppleCalendar.tsx (15,466 bytes)
    - iOS-style calendar component

11. AppleCalendarDay.tsx (5,997 bytes)
    - Calendar day cell component

12. AppleCalendarSidebar.tsx (16,263 bytes)
    - Calendar sidebar navigation

13. ReportFilters.tsx (14,264 bytes)
    - Report filtering interface

14. ExportReportButton.tsx (11,446 bytes)
    - Export reports to various formats
```

**Total Component Files:** 22 React components
**Total Component Code:** ~260 KB of production-ready React/TypeScript code

#### Page Components (5 files in `/pages/`)
```
1. /pages/leave/LeaveDashboard.tsx
   - Main leave management dashboard

2. /pages/leave/LeaveManagement.tsx
   - Leave management interface

3. /pages/admin/LeaveSettings.tsx
   - Admin settings page

4. /pages/admin/LeavePolicies.tsx
   - Policy management page

5. /pages/admin/LeaveReports.tsx
   - Reporting interface
```

---

## 2. Missing Backend Implementation

### 2.1 Required Django Models

Based on the frontend implementation, the following models need to be created:

#### LeaveType Model
```python
class LeaveType(models.Model):
    """
    Defines types of leave (Annual, Sick, Personal, etc.)
    """
    # Company relationship for multi-tenancy
    company = models.ForeignKey(SecurityCompany, on_delete=models.CASCADE)

    # Basic Information
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField()
    color_code = models.CharField(max_length=7)  # Hex color

    # Configuration
    is_active = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    min_notice_days = models.IntegerField(default=0)
    max_consecutive_days = models.IntegerField(null=True, blank=True)

    # Relationships
    employment_types = models.ManyToManyField(EmploymentType)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_types'
        ordering = ['name']
        unique_together = ['company', 'code']
```

#### LeavePolicy Model
```python
class LeavePolicy(models.Model):
    """
    Defines accrual rules and policies for leave types
    """
    ACCRUAL_METHOD_CHOICES = [
        ('monthly', 'Monthly Accrual'),
        ('annual', 'Annual Allocation'),
        ('per_shift', 'Per Shift Worked'),
        ('length_of_service', 'Based on Length of Service'),
        ('none', 'No Accrual'),
    ]

    CARRYOVER_METHOD_CHOICES = [
        ('none', 'No Carryover'),
        ('full', 'Full Carryover'),
        ('partial', 'Partial Carryover'),
        ('use_or_lose', 'Use or Lose'),
    ]

    # Company relationship
    company = models.ForeignKey(SecurityCompany, on_delete=models.CASCADE)

    # Basic Information
    name = models.CharField(max_length=100)
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE)
    employment_types = models.ManyToManyField(EmploymentType)

    # Accrual Settings
    accrual_method = models.CharField(max_length=20, choices=ACCRUAL_METHOD_CHOICES)
    accrual_rate = models.DecimalField(max_digits=5, decimal_places=2)
    max_accrual_per_year = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    max_balance = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    service_brackets = models.JSONField(default=list)  # [{months: 12, rate: 1.5}, ...]

    # Carryover Settings
    carryover_method = models.CharField(max_length=20, choices=CARRYOVER_METHOD_CHOICES)
    carryover_limit = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    carryover_expiry_months = models.IntegerField(default=0)

    # Eligibility
    probation_months = models.IntegerField(default=0)
    min_employment_days = models.IntegerField(default=0)

    # Advanced Settings
    allow_negative_balance = models.BooleanField(default=False)
    negative_balance_limit = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Status
    is_active = models.BooleanField(default=True)
    effective_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_policies'
        ordering = ['-is_active', 'name']
```

#### LeaveEntitlement Model
```python
class LeaveEntitlement(models.Model):
    """
    Tracks leave entitlements for each user per year
    """
    # Relationships
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_entitlements')
    policy = models.ForeignKey(LeavePolicy, on_delete=models.CASCADE)
    year = models.IntegerField()

    # Entitlement Amounts (in days)
    annual_entitlement = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    carried_over = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    accrued_to_date = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    used_to_date = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Tracking
    last_accrual_date = models.DateField(null=True, blank=True)
    carryover_expiry_date = models.DateField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_entitlements'
        unique_together = ['user', 'policy', 'year']
        ordering = ['-year', 'user']
        indexes = [
            models.Index(fields=['user', '-year']),
            models.Index(fields=['year', 'policy']),
        ]

    @property
    def current_balance(self):
        """Calculate current available balance"""
        return self.annual_entitlement + self.carried_over + self.accrued_to_date - self.used_to_date

    @property
    def total_entitlement(self):
        """Calculate total entitlement including carryover"""
        return self.annual_entitlement + self.carried_over + self.accrued_to_date
```

#### LeaveRequest Model
```python
class LeaveRequest(models.Model):
    """
    Leave request submissions with approval workflow
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
        ('WITHDRAWN', 'Withdrawn'),
    ]

    # Relationships
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE)

    # Request Details
    start_date = models.DateField()
    end_date = models.DateField()
    days_requested = models.DecimalField(max_digits=5, decimal_places=2)
    reason = models.TextField()

    # Status Tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    manager_comments = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_leave_requests')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Validation
    balance_after_request = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['leave_type', '-created_at']),
        ]

    def clean(self):
        """Validate leave request"""
        if self.start_date > self.end_date:
            raise ValidationError("Start date must be before end date")

        # Check for overlapping requests
        overlapping = LeaveRequest.objects.filter(
            user=self.user,
            status__in=['PENDING', 'APPROVED']
        ).filter(
            models.Q(start_date__lte=self.end_date) &
            models.Q(end_date__gte=self.start_date)
        ).exclude(id=self.id)

        if overlapping.exists():
            raise ValidationError("Leave request overlaps with existing request")
```

#### LeaveSupportingDocument Model
```python
class LeaveSupportingDocument(models.Model):
    """
    Supporting documents attached to leave requests
    """
    leave_request = models.ForeignKey(LeaveRequest, on_delete=models.CASCADE, related_name='supporting_documents')
    file = models.FileField(upload_to='leave_documents/%Y/%m/')
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField()  # in bytes
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'leave_supporting_documents'
        ordering = ['-uploaded_at']
```

#### LeaveAccrualTransaction Model
```python
class LeaveAccrualTransaction(models.Model):
    """
    Track leave accrual transactions for audit purposes
    """
    TRANSACTION_TYPE_CHOICES = [
        ('accrual', 'Accrual'),
        ('usage', 'Usage'),
        ('adjustment', 'Manual Adjustment'),
        ('carryover', 'Carryover'),
        ('expiry', 'Expiry'),
    ]

    entitlement = models.ForeignKey(LeaveEntitlement, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=5, decimal_places=2)
    balance_after = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField()
    leave_request = models.ForeignKey(LeaveRequest, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'leave_accrual_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entitlement', '-created_at']),
            models.Index(fields=['transaction_type', '-created_at']),
        ]
```

#### BlackoutPeriod Model
```python
class BlackoutPeriod(models.Model):
    """
    Define periods when leave cannot be taken
    """
    company = models.ForeignKey(SecurityCompany, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    leave_types = models.ManyToManyField(LeaveType)
    departments = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_blackout_periods'
        ordering = ['start_date']
```

#### LeaveSettings Model
```python
class LeaveSettings(models.Model):
    """
    System-wide leave management settings
    """
    company = models.OneToOneField(SecurityCompany, on_delete=models.CASCADE, related_name='leave_settings')

    # Organization Settings
    organization_name = models.CharField(max_length=200)
    default_working_days_per_week = models.IntegerField(default=5)
    weekend_days = models.JSONField(default=list)  # [6, 0] for Saturday, Sunday
    public_holidays_enabled = models.BooleanField(default=True)

    # Approval Settings
    auto_approval_threshold_days = models.IntegerField(null=True, blank=True)
    max_future_request_days = models.IntegerField(null=True, blank=True)
    manager_auto_approval = models.BooleanField(default=False)
    require_documentation_days = models.IntegerField(null=True, blank=True)

    # Notification Settings
    notifications_enabled = models.BooleanField(default=True)
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=False)

    # Accrual Settings
    default_accrual_method = models.CharField(max_length=20, default='monthly')
    fiscal_year_start_month = models.IntegerField(default=1)  # 1 = January

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leave_settings'
        verbose_name_plural = 'Leave Settings'
```

### 2.2 Required Database Migrations

Need to create migration: `0033_create_leave_management_models.py`

**Migration Operations:**
1. Create LeaveType table
2. Create LeavePolicy table
3. Create LeaveEntitlement table
4. Create LeaveRequest table
5. Create LeaveSupportingDocument table
6. Create LeaveAccrualTransaction table
7. Create BlackoutPeriod table
8. Create LeaveSettings table
9. Create all necessary indexes
10. Create foreign key relationships
11. Create many-to-many relationship tables

**Estimated Migration Size:** ~1000 lines

### 2.3 Required Serializers

Need to create in `backend/api/serializers.py`:

```python
# Serializers Required (9 classes)
1. LeaveTypeSerializer
2. LeavePolicySerializer
3. LeaveEntitlementSerializer
4. LeaveRequestSerializer
5. LeaveRequestCreateSerializer
6. LeaveSupportingDocumentSerializer
7. LeaveAccrualTransactionSerializer
8. BlackoutPeriodSerializer
9. LeaveSettingsSerializer

# Additional Response Serializers
10. LeaveBalanceSummarySerializer
11. LeaveCalendarEventSerializer
12. PendingLeaveRequestSerializer
13. LeaveStatisticsSerializer
```

**Estimated Serializer Code:** ~600-800 lines

### 2.4 Required ViewSets and API Endpoints

Need to create in `backend/api/views.py`:

```python
# ViewSets Required (8 classes)
1. LeaveTypeViewSet
   - GET /api/v1/leave/types/
   - GET /api/v1/leave/types/{id}/

2. LeavePolicyViewSet
   - GET /api/v1/leave/policies/
   - POST /api/v1/leave/policies/
   - GET /api/v1/leave/policies/{id}/
   - PATCH /api/v1/leave/policies/{id}/
   - DELETE /api/v1/leave/policies/{id}/
   - POST /api/v1/leave/policies/{id}/activate/
   - POST /api/v1/leave/policies/{id}/deactivate/

3. LeaveEntitlementViewSet
   - GET /api/v1/leave/entitlements/
   - GET /api/v1/leave/entitlements/{id}/

4. LeaveRequestViewSet
   - GET /api/v1/leave/requests/
   - POST /api/v1/leave/requests/
   - GET /api/v1/leave/requests/{id}/
   - PUT /api/v1/leave/requests/{id}/
   - DELETE /api/v1/leave/requests/{id}/
   - PATCH /api/v1/leave/requests/{id}/cancel/
   - POST /api/v1/leave/requests/validate/

5. LeaveBalanceViewSet
   - GET /api/v1/leave/balances/
   - GET /api/v1/leave/balances/by-type/{leave_type_id}/

6. LeaveApprovalViewSet
   - GET /api/v1/leave/approvals/pending/
   - POST /api/v1/leave/approvals/process/
   - POST /api/v1/leave/approvals/bulk-process/

7. LeaveCalendarViewSet
   - GET /api/v1/leave/calendar/
   - GET /api/v1/leave/calendar/events/

8. LeaveStatisticsViewSet
   - GET /api/v1/leave/statistics/

9. LeaveAnalyticsViewSet
   - POST /api/v1/leave/analytics/
   - GET /api/v1/leave/analytics/capacity/
   - GET /api/v1/leave/analytics/trends/

10. LeaveReportsViewSet
    - POST /api/v1/leave/reports/summary/
    - POST /api/v1/leave/reports/detailed/
    - POST /api/v1/leave/reports/export/

11. LeaveSettingsViewSet
    - GET /api/v1/leave/settings/
    - PATCH /api/v1/leave/settings/

12. BlackoutPeriodViewSet
    - GET /api/v1/leave/blackout-periods/
    - POST /api/v1/leave/blackout-periods/
    - PATCH /api/v1/leave/blackout-periods/{id}/
    - DELETE /api/v1/leave/blackout-periods/{id}/

13. TeamLeaveViewSet
    - GET /api/v1/leave/team/overview/
    - GET /api/v1/leave/team/balances/
    - GET /api/v1/leave/team/calendar/
```

**Total API Endpoints:** ~40 endpoints
**Estimated ViewSet Code:** ~1500-2000 lines

### 2.5 Required URL Routing

Need to add in `backend/api/urls.py`:

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LeaveTypeViewSet,
    LeavePolicyViewSet,
    LeaveEntitlementViewSet,
    LeaveRequestViewSet,
    LeaveBalanceViewSet,
    LeaveApprovalViewSet,
    LeaveCalendarViewSet,
    LeaveStatisticsViewSet,
    LeaveAnalyticsViewSet,
    LeaveReportsViewSet,
    LeaveSettingsViewSet,
    BlackoutPeriodViewSet,
    TeamLeaveViewSet,
)

router = DefaultRouter()
router.register(r'leave/types', LeaveTypeViewSet, basename='leave-types')
router.register(r'leave/policies', LeavePolicyViewSet, basename='leave-policies')
router.register(r'leave/entitlements', LeaveEntitlementViewSet, basename='leave-entitlements')
router.register(r'leave/requests', LeaveRequestViewSet, basename='leave-requests')
router.register(r'leave/balances', LeaveBalanceViewSet, basename='leave-balances')
router.register(r'leave/approvals', LeaveApprovalViewSet, basename='leave-approvals')
router.register(r'leave/calendar', LeaveCalendarViewSet, basename='leave-calendar')
router.register(r'leave/statistics', LeaveStatisticsViewSet, basename='leave-statistics')
router.register(r'leave/analytics', LeaveAnalyticsViewSet, basename='leave-analytics')
router.register(r'leave/reports', LeaveReportsViewSet, basename='leave-reports')
router.register(r'leave/settings', LeaveSettingsViewSet, basename='leave-settings')
router.register(r'leave/blackout-periods', BlackoutPeriodViewSet, basename='blackout-periods')
router.register(r'leave/team', TeamLeaveViewSet, basename='team-leave')
```

---

## 3. Current Backend Model Inventory

### 3.1 Existing Models (40 Total)

**Multi-Tenant & Onboarding (4 models):**
1. SecurityCompany - Multi-tenant company model
2. UserCompanyMembership - User-company relationships
3. CompanyOnboarding - Onboarding progress tracking
4. CompanyIntegration - Third-party integrations

**User & Staff Management (6 models):**
5. User - Extended AbstractUser
6. StaffProfile - Staff profile information
7. EmergencyContact - Emergency contact details
8. BankDetails - Banking information
9. SIALicense - Security licenses
10. SecurityQualification - Additional qualifications

**Availability & Preferences (2 models):**
11. StaffAvailability - Day-of-week availability
12. PreferredVenue - Venue preferences

**Venue Management (3 models):**
13. Venue - Location details
14. VenueTermsAcceptance - Terms acceptance tracking
15. EnforcementVisit - Enforcement visit records

**Shift Management (7 models):**
16. ShiftTemplate - Shift templates
17. ShiftStatusHistory - Status change tracking
18. OpenShiftRequest - Open shift claiming
19. Shift - Core shift model
20. ShiftCheck - Abstract base for checks
21. FireExitCheck, CapacityCheck, ToiletCheck - Specific checks
22. ShiftExchange - Shift exchange requests

**Financial Management (4 models):**
23. Invoice - Invoice generation
24. InvoiceItem - Invoice line items
25. PayRate - Pay rate configuration
26. EmploymentType - Employment type definitions

**Recruitment (1 model):**
27. RecruitmentApplication - Job applications

**Deputy Integration (3 models):**
28. DeputyConfig - Deputy API configuration
29. DeputyEmployee - Synced employee data
30. DeputyTimesheet - Synced timesheet data

**Incidents & Records (4 models):**
31. LatenessRecord - Lateness tracking
32. IncidentReport - Incident reporting
33. CapacityFlow - Capacity tracking
34. VenueHandover - Shift handover notes

**System Configuration (2 models):**
35. QualificationReminder - Reminder system
36. SystemSettings - Global settings

**Compliance Management (4 models):**
37. WorkingHoursRegulation - Regional regulations
38. ComplianceProfile - Compliance profiles
39. ComplianceViolation - Violation tracking
40. WorkingHoursMetrics - Metrics calculation

**Reporting System (3 models):**
41. ReportTemplate - Report definitions
42. ReportJob - Report execution
43. ScheduledReport - Scheduled reports
44. ExportConfiguration - Export settings

### 3.2 Models with Leave-Related Fields

Only **2 fields** in the entire backend reference leave/holidays:

1. **StaffAvailability.availability_holidays** (boolean)
   - File: `backend/api/models.py` (line unknown)
   - Part of RecruitmentApplication model
   - Simply indicates if staff is available during holidays
   - NOT a leave management field

2. **WorkingHoursRegulation.special_rules** (JSONField)
   - File: `backend/api/models.py` (line ~200)
   - Migration: `0021_workinghoursregulation_complianceprofile_and_more.py` (line 204)
   - Help text: "Additional country-specific rules as JSON (e.g., night shift premiums, holiday rules)"
   - Generic JSON field, NOT dedicated leave management

**Conclusion:** Zero dedicated leave management infrastructure in backend

---

## 4. Required Implementation Work

### 4.1 Backend Development Tasks

#### Phase 1: Model Creation (Priority: Critical)
- [ ] Create 9 leave management models
- [ ] Create migration file `0033_create_leave_management_models.py`
- [ ] Add model methods for balance calculations
- [ ] Add model validation logic
- [ ] Create model indexes for performance
- [ ] Add model signals for automatic accrual

**Estimated Effort:** 2-3 days

#### Phase 2: Serializer Development (Priority: Critical)
- [ ] Create 13 serializers for leave models
- [ ] Add custom validation logic
- [ ] Create nested serializers for complex responses
- [ ] Add permission checks in serializers
- [ ] Create create/update serializers with different fields

**Estimated Effort:** 2-3 days

#### Phase 3: ViewSet & API Development (Priority: Critical)
- [ ] Create 13 viewsets
- [ ] Implement ~40 API endpoints
- [ ] Add filtering, pagination, and search
- [ ] Implement permission classes
- [ ] Add custom actions for approval workflows
- [ ] Create file upload/download endpoints
- [ ] Add validation endpoints

**Estimated Effort:** 4-5 days

#### Phase 4: Business Logic (Priority: High)
- [ ] Implement automatic accrual calculation
- [ ] Create carryover processing logic
- [ ] Build balance calculation engine
- [ ] Add working days calculator
- [ ] Implement overlap detection
- [ ] Create approval workflow logic
- [ ] Add notification system

**Estimated Effort:** 3-4 days

#### Phase 5: Analytics & Reporting (Priority: Medium)
- [ ] Build analytics calculation engine
- [ ] Create report generation system
- [ ] Add export functionality (CSV, Excel, PDF)
- [ ] Implement trend analysis
- [ ] Create capacity analysis

**Estimated Effort:** 2-3 days

#### Phase 6: Testing (Priority: Critical)
- [ ] Write unit tests for models
- [ ] Write unit tests for serializers
- [ ] Write unit tests for views
- [ ] Create integration tests
- [ ] Test permission system
- [ ] Test file uploads
- [ ] Performance testing

**Estimated Effort:** 3-4 days

### 4.2 Total Implementation Estimate

**Total Backend Development Time:** 16-22 business days (3.2-4.4 weeks)

**Lines of Code Estimate:**
- Models: ~1000 lines
- Migrations: ~1000 lines
- Serializers: ~800 lines
- Views: ~1800 lines
- Tests: ~1500 lines
- Business Logic: ~800 lines
- **Total: ~7000 lines of Python code**

### 4.3 Integration Tasks

After backend implementation:
- [ ] Update frontend API base URL if needed
- [ ] Test frontend-backend integration
- [ ] Fix any API contract mismatches
- [ ] Add error handling for new endpoints
- [ ] Test file upload/download
- [ ] Verify authentication/permissions
- [ ] Test multi-tenancy isolation

**Estimated Integration Time:** 2-3 days

---

## 5. Technical Considerations

### 5.1 Multi-Tenancy

All leave models must include `company` foreign key to `SecurityCompany` for proper tenant isolation:

```python
company = models.ForeignKey(
    SecurityCompany,
    on_delete=models.CASCADE,
    related_name='leave_[model_name]s'
)
```

**Affected Models:** LeaveType, LeavePolicy, BlackoutPeriod, LeaveSettings

### 5.2 Permission System

Need to implement role-based permissions:

**Staff Permissions:**
- View own leave balances
- Create leave requests
- View own leave requests
- Cancel own pending requests

**Manager Permissions:**
- All staff permissions
- View team leave balances
- Approve/reject team leave requests
- View team calendar
- Access team analytics

**Admin Permissions:**
- All manager permissions
- Create/edit leave types
- Create/edit leave policies
- Configure leave settings
- Manage blackout periods
- Access all analytics/reports

### 5.3 Performance Optimization

**Required Indexes:**
```python
# LeaveRequest
models.Index(fields=['user', '-created_at'])
models.Index(fields=['status', '-created_at'])
models.Index(fields=['start_date', 'end_date'])
models.Index(fields=['leave_type', '-created_at'])

# LeaveEntitlement
models.Index(fields=['user', '-year'])
models.Index(fields=['year', 'policy'])

# LeaveAccrualTransaction
models.Index(fields=['entitlement', '-created_at'])
models.Index(fields=['transaction_type', '-created_at'])
```

**Caching Strategy:**
- Cache leave balances (5 minute TTL)
- Cache leave policies (1 hour TTL)
- Cache leave types (1 hour TTL)
- Cache analytics data (15 minute TTL)

### 5.4 File Storage

Supporting documents need file storage configuration:

```python
# settings.py
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

# For production, use S3 or similar:
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_STORAGE_BUCKET_NAME = 'your-bucket-name'
```

### 5.5 Background Tasks

Automatic accrual processing should run as scheduled tasks:

```python
# Use Celery or Django-Q for:
- Daily accrual calculation
- Monthly carryover processing
- Expiry processing
- Reminder notifications
- Analytics recalculation
```

### 5.6 Notification System

Integration with existing notification system for:
- Leave request submitted
- Leave request approved/rejected
- Balance low warnings
- Upcoming leave reminders
- Manager approval reminders

---

## 6. Risk Assessment

### 6.1 Critical Risks

**Risk 1: Frontend-Backend API Contract Mismatch**
- **Impact:** High
- **Probability:** Medium
- **Mitigation:** Thorough testing of all 40+ endpoints against frontend expectations

**Risk 2: Performance Issues with Balance Calculations**
- **Impact:** Medium
- **Probability:** Medium
- **Mitigation:** Implement caching, database indexing, and optimize queries

**Risk 3: Multi-Tenancy Data Leakage**
- **Impact:** Critical
- **Probability:** Low
- **Mitigation:** Comprehensive security testing, proper QuerySet filtering

### 6.2 Medium Risks

**Risk 4: Complex Accrual Logic**
- **Impact:** Medium
- **Probability:** High
- **Mitigation:** Extensive unit testing, clear documentation

**Risk 5: File Upload Security**
- **Impact:** Medium
- **Probability:** Medium
- **Mitigation:** File type validation, size limits, virus scanning

### 6.3 Low Risks

**Risk 6: Timezone Handling**
- **Impact:** Low
- **Probability:** Low
- **Mitigation:** Use UTC consistently, handle timezone conversion in frontend

---

## 7. Recommendations

### 7.1 Immediate Actions

1. **Create Database Models** (Week 1)
   - Start with core models: LeaveType, LeavePolicy, LeaveEntitlement, LeaveRequest
   - Create migration and test locally
   - Add basic validation

2. **Implement Core API Endpoints** (Week 2)
   - Focus on essential CRUD operations
   - Implement authentication/permissions
   - Basic serializers without complex logic

3. **Add Business Logic** (Week 3)
   - Balance calculation
   - Accrual processing
   - Approval workflows

4. **Complete Advanced Features** (Week 4)
   - Analytics and reporting
   - File uploads
   - Team management features

### 7.2 Development Approach

**Option A: Incremental Implementation (Recommended)**
- Implement models → serializers → views in phases
- Test each phase before moving forward
- Deploy incrementally
- Lower risk, easier debugging

**Option B: Complete Implementation**
- Build everything at once
- Deploy all together
- Higher risk, but faster if successful

**Recommendation:** Option A (Incremental) for lower risk

### 7.3 Testing Strategy

**Unit Tests:**
- Model validation
- Serializer validation
- Business logic calculations

**Integration Tests:**
- API endpoint responses
- Permission checks
- File uploads/downloads

**End-to-End Tests:**
- Frontend-backend integration
- Complete workflows (request → approval → balance update)

### 7.4 Documentation Requirements

Create documentation for:
- [ ] Model relationships diagram
- [ ] API endpoint documentation (Swagger/OpenAPI)
- [ ] Business logic documentation
- [ ] Admin user guide
- [ ] Deployment guide

---

## 8. Conclusion

### 8.1 Summary

The project has a **complete frontend leave management system** with production-ready components, but **zero backend implementation**. This is a significant architectural gap that requires immediate attention.

**Frontend Status:**
- ✅ 290 lines of TypeScript type definitions
- ✅ 842 lines of service layer code
- ✅ 22 React components (~260 KB)
- ✅ 5 page components
- ✅ 42 API integration methods
- ✅ 15+ API endpoint definitions

**Backend Status:**
- ❌ 0 leave management models
- ❌ 0 database migrations
- ❌ 0 serializers
- ❌ 0 API endpoints
- ❌ 0 business logic

### 8.2 Implementation Priority

**Priority 1 (Critical - Week 1-2):**
- Create core Django models
- Create database migration
- Implement basic CRUD serializers
- Create basic API endpoints

**Priority 2 (High - Week 3):**
- Implement business logic
- Add approval workflows
- Create balance calculations
- Add permissions

**Priority 3 (Medium - Week 4):**
- Analytics and reporting
- File upload support
- Team management features
- Advanced features

### 8.3 Success Criteria

The implementation will be considered successful when:
- [ ] All 9 models are created and migrated
- [ ] All 40+ API endpoints return expected responses
- [ ] Frontend can successfully make all API calls
- [ ] Permissions work correctly for all roles
- [ ] Balance calculations are accurate
- [ ] File uploads work properly
- [ ] Multi-tenancy is properly isolated
- [ ] All tests pass (>80% coverage)

### 8.4 Next Steps

1. **Review and approve this research document**
2. **Assign development resources**
3. **Create detailed implementation plan**
4. **Begin Phase 1: Model Creation**
5. **Set up continuous integration for testing**

---

## Appendix A: File Locations

### Frontend Files
```
/frontend/src/types/leave.ts (290 lines)
/frontend/src/services/leaveService.ts (842 lines)
/frontend/src/components/LeaveRequestForm.tsx
/frontend/src/components/LeaveApprovalDashboard.tsx
/frontend/src/components/LeaveBalanceDisplay.tsx
/frontend/src/components/LeaveHistoryTable.tsx
/frontend/src/components/LeaveCalendar.tsx
/frontend/src/components/leave/ (16 components)
/frontend/src/pages/leave/ (2 pages)
/frontend/src/pages/admin/LeaveSettings.tsx
/frontend/src/pages/admin/LeavePolicies.tsx
/frontend/src/pages/admin/LeaveReports.tsx
```

### Backend Files (To Be Created)
```
/backend/api/models.py (add leave models)
/backend/api/migrations/0033_create_leave_management_models.py
/backend/api/serializers.py (add leave serializers)
/backend/api/views.py (add leave viewsets)
/backend/api/urls.py (add leave routes)
/backend/api/permissions.py (add leave permissions)
/backend/api/tests/test_leave_models.py
/backend/api/tests/test_leave_views.py
/backend/api/tests/test_leave_serializers.py
```

---

## Appendix B: Database Schema Diagram

```
┌─────────────────────┐
│   SecurityCompany   │
└──────────┬──────────┘
           │
           ├─────────┐
           │         │
           ▼         ▼
    ┌───────────┐  ┌──────────────┐
    │ LeaveType │  │ LeaveSettings│
    └─────┬─────┘  └──────────────┘
          │
          │
          ▼
    ┌──────────────┐
    │ LeavePolicy  │
    └──────┬───────┘
           │
           │
    ┌──────▼────────────┐
    │ LeaveEntitlement  │
    └──────┬────────────┘
           │
           ├──────────────────┐
           │                  │
           ▼                  ▼
    ┌──────────────┐   ┌────────────────────┐
    │ LeaveRequest │   │LeaveAccrualTransaction│
    └──────┬───────┘   └────────────────────┘
           │
           ▼
    ┌────────────────────────┐
    │LeaveSupportingDocument │
    └────────────────────────┘

    ┌──────────────────┐
    │ BlackoutPeriod   │
    └──────────────────┘
```

---

**Document Version:** 1.0
**Author:** Claude Code Research Agent
**Date:** October 2, 2025
**Status:** Complete - Ready for Review
