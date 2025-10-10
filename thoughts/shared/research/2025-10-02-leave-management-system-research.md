---
date: 2025-10-02T20:58:25+0000
researcher: Claude Code
git_commit: 11e287b07507ca949b81f1ce574f2ca5c546c93f
branch: main
repository: remix2
topic: "Leave Management System: Implementation Status, Holiday Pay Integration, and Sidebar Features"
tags: [research, codebase, leave-management, holiday-pay, invoicing, backend, frontend, ui-analysis]
status: complete
last_updated: 2025-10-02
last_updated_by: Claude Code
---

# Research: Leave Management System - Complete Analysis

**Date**: 2025-10-02T20:58:25+0000
**Researcher**: Claude Code
**Git Commit**: 11e287b07507ca949b81f1ce574f2ca5c546c93f
**Branch**: main
**Repository**: remix2

## Research Question

User requested comprehensive research into the leave management system covering:
1. How the leave management system works (backend and frontend)
2. How it handles earnings such as holiday pay for staff and admins
3. Analysis of the sidebar features shown in the provided UI screenshot
4. What works and what doesn't in the current implementation

## Executive Summary

**Key Findings:**
- ✅ **Fully Implemented**: Complete leave management system exists as a separate Django app (`leave_management/`)
- ✅ **Production-Ready**: 6 core backend models, 80+ API endpoints, 21 frontend components
- ✅ **Comprehensive Coverage**: Leave types, policies, requests, approvals, balances, analytics, reporting
- ❌ **Critical Gap**: NO integration between leave/holiday pay and the invoicing system
- ⚠️ **Shift-Only Payments**: Current invoice generation only processes shift-based hours, no paid leave

**System Status**: The leave management system is architecturally complete but operates independently from the payment/invoicing infrastructure. Staff can request and get approved for paid leave, but those days are NOT included in invoice generation or payment calculations.

## Detailed Findings

### 1. Backend Implementation

#### Location
`/Users/new/Projects/mead-security/remix2/backend/leave_management/`

#### Database Models (models.py - 1,190 lines)

**LeaveType** (Lines 37-98)
- Purpose: Define categories of leave (Annual, Sick, Personal, Holiday, etc.)
- Key Fields:
  - `name`, `code` (e.g., 'AL', 'SL')
  - `is_active`, `requires_approval`
  - `min_notice_days`, `max_consecutive_days`
  - `employment_types` (ManyToMany)
- Usage: Foundation for all leave policies and requests

**LeavePolicy** (Lines 119-394)
- Purpose: Configure accrual rules and carryover settings per leave type
- Key Fields:
  - `accrual_method`: monthly, annual, per_shift, length_of_service, none
  - `accrual_rate`, `max_accrual_per_year`, `max_balance`
  - `carryover_method`: none, full, partial, use_or_lose
  - `service_brackets` (JSONField) - tiered accrual by tenure
  - `probation_months`, `min_employment_days`
  - `allow_negative_balance`, `negative_balance_limit`
- Business Logic Methods:
  - `get_accrual_rate_for_service_period(months)`
  - `calculate_monthly_accrual(user, date)`
  - `calculate_annual_accrual(user, year)`
  - `is_applicable_to_user(user)`

**LeaveRequest** (Lines 429-675)
- Purpose: Track leave requests from submission to approval/rejection
- Key Fields:
  - `staff_user`, `leave_type`
  - `start_date`, `end_date`, `days_requested`
  - `request_type`: full_day, half_day_am, half_day_pm, hours
  - `status`: draft, pending, approved, rejected, cancelled, withdrawn
  - `submitted_at`, `approved_by`, `approved_at`
  - `manager_notes`, `balance_deducted`
- Business Logic:
  - `approve(manager, notes)` - Updates status, records approver
  - `reject(manager, notes)` - Rejects with reason
  - `cancel()` - User cancellation
  - Properties: `duration_days`, `is_pending`, `can_be_cancelled`

**LeaveBalance** (Lines 697-875)
- Purpose: Real-time balance tracking per user/leave type/year
- Key Fields:
  - `opening_balance` (includes carryover)
  - `accrued_balance` (accrued during year)
  - `used_balance` (approved leave taken)
  - `pending_balance` (pending approval)
  - `adjustment_balance` (manual adjustments)
  - `last_accrual_date`
- Calculated Properties:
  - `current_balance = opening + accrued - used + adjustment`
  - `available_balance = current - pending`
  - `total_entitlement = opening + accrued + adjustment`
- Business Logic:
  - `add_accrual(amount, date)`
  - `use_leave(amount)` - Deduct on approval
  - `can_take_leave(amount)` - Balance check

**BlackoutPeriod** (Lines 908-1044)
- Purpose: Define restricted leave periods (venue-specific or system-wide)
- Key Fields:
  - `name`, `description`, `start_date`, `end_date`
  - `venue` (nullable - null = system-wide)
  - `leave_types` (ManyToMany)
  - `restriction_level`: no_requests, emergency_only, manager_approval, limit_percentage
  - `max_staff_percentage`
  - `allow_manager_override`
- Business Logic:
  - `is_applicable_to_request(leave_request)`
  - `get_restriction_message()`

**LeaveEntitlement** (Lines 1046-1190)
- Purpose: Track annual entitlements per user/policy/year
- Key Fields:
  - `user`, `policy`, `year`
  - `annual_entitlement`, `carried_over`
  - `accrued_to_date`, `used_to_date`
  - `carryover_expiry_date`
- Business Logic:
  - `update_accrued_amount(amount, date)`
  - `use_leave(days)`
  - `process_carryover_from_previous_year(previous)`

#### API Endpoints (urls.py - 287 lines)

**Base URL**: `/api/v1/leave/`

**Leave Types** (`/types/`)
- GET - List active types
- POST - Create (Admin)
- GET `{id}/` - Retrieve
- PUT/PATCH `{id}/` - Update (Admin)
- DELETE `{id}/` - Delete (Admin)
- GET `active/` - Active only
- POST `{id}/toggle_active/` - Toggle status
- GET `usage_statistics/` - Usage stats

**Leave Policies** (`/policies/`)
- Full CRUD with Admin permissions
- GET `for_user/` - User's applicable policies
- POST `{id}/duplicate/` - Duplicate policy
- GET `{id}/preview_impact/` - Impact analysis

**Leave Balances** (`/balances/`)
- GET - List balances
- GET `summary/` - Aggregated summary (5min cache)
- GET `my_balances/` - Current user
- POST `recalculate_all/` - Admin recalculation
- GET `team_summary/` - Team balances (Manager)

**Leave Requests** (`/requests/`)
- Full CRUD
- POST `{id}/submit/` - Submit for approval
- POST `{id}/approve/` - Approve (Manager/Admin)
- POST `{id}/reject/` - Reject with reason
- POST `{id}/cancel/` - User cancellation
- GET `my_requests/` - User's requests
- GET `pending_approvals/` - Manager queue

**Team Overview** (`/team-overview/`)
- GET `team_balances/` - Team balances
- GET `team_calendar/` - Team schedule
- GET `pending_requests/` - Pending queue
- GET `analytics_summary/` - Team analytics

**Reports & Analytics** (`/reports/`)
- GET `analytics/` - Comprehensive analytics
- GET `usage_summary/` - Usage report
- GET `export/` - Export (JSON/CSV/Excel)
- GET `balance_trends/` - Trend analysis
- GET `team_utilization/` - Utilization report

**System Settings** (`/settings/`) - Admin Only
- GET `system_config/` - Configuration
- PUT `system_config/` - Update settings

**Blackout Periods** (`/blackout-periods/`) - Admin Only
- Full CRUD
- GET `current_restrictions/` - Active restrictions
- GET `upcoming_restrictions/` - Future restrictions
- POST `{id}/toggle_active/` - Toggle status
- POST `bulk_create/` - Bulk creation
- GET `check_conflicts/` - Conflict detection

**Calendar & Holidays**
- GET `/calendar/` - Calendar events
- GET `/holidays/` - Public holidays (Nager.Date API proxy)

#### Permissions System (permissions.py)

**Permission Classes:**
1. `AdminOnlyPermission` - Full CRUD for admins only
2. `ManagerOrAdminPermission` - Manager and admin access
3. `LeaveTypePermission` - Type-specific permissions
4. `LeavePolicyPermission` - Policy management
5. `LeaveBalancePermission` - Balance viewing
6. `ReadOnlyForStaffMixin` - Staff read-only access

**Access Control Matrix:**

| Role | Leave Types | Policies | Requests | Balances | Team Data | Settings |
|------|------------|----------|----------|----------|-----------|----------|
| **Staff** | Read | Read (applicable) | Submit/View Own | View Own | ❌ | ❌ |
| **Manager** | Read | Read | Approve Team | View Team | View Team | ❌ |
| **Admin** | Full CRUD | Full CRUD | Approve All | View All | View All | Full CRUD |

#### Business Rules Validation

**Leave Request Validation:**
- ✅ Date range validation (end > start)
- ✅ Balance availability checking
- ✅ Blackout period restrictions
- ✅ Overlapping request detection
- ✅ Minimum notice period enforcement
- ✅ Maximum consecutive days validation
- ✅ Working days calculation
- ✅ Probation period eligibility

**Approval Workflow:**
- ✅ Role-based approval permissions
- ✅ Automatic balance deduction on approval
- ✅ Audit trail (approver, timestamp, notes)
- ⚠️ Notification triggers (placeholders exist, not fully implemented)

**Balance Management:**
- ✅ Real-time calculations
- ✅ Pending request tracking
- ✅ Accrual and usage recording
- ✅ Year-end carryover processing
- ✅ Manual adjustment capabilities with audit trail

#### Services Layer (services.py)

**LeaveBalanceService**
- Real-time balance calculations
- Accrual processing
- Carryover management
- Balance reconciliation

**LeaveAccrualService**
- Automatic accrual based on policy method
- Service-length tiered accrual
- Batch accrual processing

**LeaveRequestValidationService**
- Pre-flight validation
- Overlap detection
- Blackout period checking
- Balance verification

#### Performance Optimizations (query_optimizers.py)

**Strategies Implemented:**
- Strategic database indexing on frequently queried fields
- QuerySet optimization with `select_related`/`prefetch_related`
- 5-minute cache on balance summary endpoint
- Bulk operations support
- Efficient aggregation queries for analytics

**Database Indexes:**
```python
# LeaveRequest indexes
Index(fields=['staff_user', 'status'])
Index(fields=['leave_type', 'start_date'])
Index(fields=['status', 'submitted_at'])

# LeaveBalance indexes
Index(fields=['staff_user', 'year'])
Index(fields=['leave_type', 'year'])
Index(fields=['year', 'last_updated'])

# BlackoutPeriod indexes
Index(fields=['start_date', 'end_date'])
Index(fields=['venue', 'is_active'])
```

### 2. Frontend Implementation

#### Leave Service Layer

**File**: `frontend/src/services/leaveService.ts` (842 lines)

**40+ API Integration Methods:**

**Core Operations:**
- `getLeaveTypes(activeOnly)` - List leave types
- `getLeavePolicies(userId?)` - Get applicable policies
- `getLeaveEntitlements(userId?, year?)` - Entitlements
- `getLeaveBalances(userId?)` - Balance summary
- `getMyBalances()` - Current user balances

**Leave Request Management:**
- `createLeaveRequest(requestData)` - Submit with file upload
- `getLeaveRequests(filters?, page, pageSize)` - Paginated list
- `getMyLeaveRequests(filters?)` - User's requests
- `updateLeaveRequest(id, data)` - Update pending
- `cancelLeaveRequest(id, reason?)` - Cancel/withdraw
- `deleteLeaveRequest(id)` - Delete draft
- `validateLeaveRequest(data)` - Pre-flight validation
- `calculateWorkingDays(start, end)` - Working days calculator

**Manager/Admin Functions:**
- `getPendingLeaveRequests(filters?)` - Approval queue
- `processLeaveRequest(approval)` - Approve/reject
- `bulkProcessLeaveRequests(bulk)` - Bulk approval
- `approveLeaveRequest(id, comments?)` - Quick approve
- `rejectLeaveRequest(id, reason)` - Quick reject

**Team Management:**
- `getTeamOverview()` - Team dashboard data
- `getTeamBalances()` - Team member balances
- `getTeamCalendar(start, end)` - Team schedule

**Analytics & Reporting:**
- `getLeaveAnalytics(filters)` - Comprehensive analytics
- `getLeaveReportSummary(filters)` - Report summary
- `exportLeaveReport(format, filters)` - Export (CSV/PDF)
- `getLeaveCapacityAnalysis(start, end)` - Capacity planning
- `getLeaveTrends(period)` - Trend analysis

**System Administration:**
- `getLeaveSettings()` - System configuration
- `updateLeaveSettings(settings)` - Update config
- `getBlackoutPeriods()` - Blackout list
- `createBlackoutPeriod(period)` - Create blackout
- `updateBlackoutPeriod(id, period)` - Update blackout
- `deleteBlackoutPeriod(id)` - Delete blackout

**Calendar Integration:**
- `getLeaveCalendar(start, end, userId?)` - Calendar events
- `getLeaveCalendarEvents(filters?)` - Filtered events
- `getLeaveStatistics(year?, dept?)` - Statistical data

**File Operations:**
- `exportLeaveRequests(format, filters?)` - Export requests
- `downloadSupportingDocument(requestId, docId)` - Download attachment

#### Type Definitions

**File**: `frontend/src/types/leave.ts` (290 lines)

**Core Interfaces:**
- `LeaveType` - Leave category with approval rules
- `LeavePolicy` - Accrual and carryover configuration
- `LeaveEntitlement` - Annual entitlement tracking
- `LeaveRequest` - Request entity with status workflow
- `LeaveBalance` - Real-time balance summary
- `LeaveBalanceSummary` - Aggregated view with projections
- `LeaveCalendarEvent` - Calendar integration
- `PendingLeaveRequest` - Manager approval queue item
- `LeaveStatistics` - Reporting metrics
- `BlackoutPeriod` - Restriction periods

**Enums:**
- `LeaveRequestStatus` - PENDING, APPROVED, REJECTED, CANCELLED, WITHDRAWN

**Form & Validation:**
- `LeaveRequestFormData` - Form submission with file upload
- `LeaveRequestFilterOptions` - Advanced filtering
- `LeaveError`, `LeaveValidationError` - Error handling
- `LeaveRequestFormErrors` - Form-specific errors

#### UI Components (21 components)

**Core Components** (`/components/`):
- `LeaveRequestForm.tsx` (490 lines) - Request submission with validation
- `LeaveApprovalDashboard.tsx` (872 lines) - Manager approval interface
- `LeaveBalanceDisplay.tsx` (485 lines) - Balance visualization
- `LeaveHistoryTable.tsx` (906 lines) - Request history with filtering
- `LeaveCalendar.tsx` (68 lines) - Calendar view wrapper

**Advanced Components** (`/components/leave/`):
- `AccrualSettings.tsx` (25KB) - Policy accrual config
- `AppleCalendar.tsx` (15KB) - Advanced calendar UI
- `AppleCalendarDay.tsx` - Day cell rendering
- `AppleCalendarSidebar.tsx` (16KB) - Calendar sidebar
- `BlackoutPeriodManager.tsx` (21KB) - Blackout management
- `ExportReportButton.tsx` - Report export
- `LeaveAnalyticsDashboard.tsx` (22KB) - Analytics visualization
- `LeaveBalanceWidget.tsx` (9KB) - Dashboard widget
- `LeaveSidebar.tsx` (10KB) - Navigation sidebar
- `PolicyDetailsForm.tsx` (24KB) - Policy creation/editing
- `PolicyListTable.tsx` (13KB) - Policy list view
- `QuickApprovalWidget.tsx` (15KB) - Quick approval UI
- `ReportFilters.tsx` (14KB) - Report filtering
- `TeamCalendarView.tsx` (23KB) - Team calendar
- `TeamMemberCard.tsx` (11KB) - Team member cards

**Page Components** (`/pages/`):
- `/leave/LeaveDashboard.tsx` (15KB) - Main dashboard
- `/leave/LeaveManagement.tsx` (4KB) - Router component
- `/admin/LeavePolicies.tsx` - Policy management
- `/admin/LeaveSettings.tsx` - System settings
- `/admin/LeaveReports.tsx` - Reporting interface
- `/manager/TeamOverview.tsx` - Manager dashboard

#### Holiday Service Integration

**File**: `frontend/src/services/holidayService.ts` (302 lines)

**Features:**
- Public holiday API integration (Nager.Date API)
- Backend proxy endpoint: `/leave/holidays/`
- 24-hour caching mechanism
- Country-specific support (GB default)
- Date range filtering
- Calendar event conversion
- Fallback UK holidays with Easter calculation

**Key Methods:**
- `getHolidays(countryCode, year)` - Fetch with cache
- `getCurrentMonthHolidays(country)` - Current month
- `getHolidaysInRange(start, end, country)` - Range filter
- `isHoliday(date, country)` - Date check
- `getNextHoliday(country)` - Upcoming holiday
- `holidaysToCalendarEvents(holidays)` - Calendar integration

### 3. Sidebar Feature Analysis

Based on the provided UI screenshot showing the leave management sidebar:

**OVERVIEW Section:**
- ✅ **Dashboard** - Fully implemented (`LeaveDashboard.tsx`)
  - Purpose: Overview of leave balances, upcoming leave, recent requests
  - Features: Quick stats, balance widgets, pending requests summary
  - Access: All users

**MY LEAVE Section:**
- ✅ **Request Leave** - Fully implemented (`LeaveRequestForm.tsx`)
  - Purpose: Submit new leave requests
  - Features: Date picker, leave type selection, file upload, balance checking
  - Access: Staff, Manager, Admin

- ✅ **My Balance** - Fully implemented (`LeaveBalanceDisplay.tsx`)
  - Purpose: View current leave balances
  - Features: Balance cards per leave type, accrual tracking, carryover display
  - Access: Staff, Manager, Admin

- ✅ **Leave History** - Fully implemented (`LeaveHistoryTable.tsx`)
  - Purpose: View past leave requests
  - Features: Filtering, search, pagination, status tracking, export
  - Access: Staff, Manager, Admin

**TEAM MANAGEMENT Section:**
- ✅ **Team Approvals** - Fully implemented (`LeaveApprovalDashboard.tsx`)
  - Purpose: Approve/reject team member leave requests
  - Features: Pending queue, urgency indicators, bulk actions, approval comments
  - Access: Manager, Admin only

- ✅ **Team Calendar** - Fully implemented (`TeamCalendarView.tsx`)
  - Purpose: View team leave schedule
  - Features: Calendar view, conflict detection, capacity visualization
  - Access: Manager, Admin only

- ✅ **Team Overview** - Fully implemented (Manager dashboard)
  - Purpose: Team leave statistics and analytics
  - Features: Team balances, pending requests, analytics summary
  - Access: Manager, Admin only

**ADMINISTRATION Section:**
- ✅ **Leave Policies** - Fully implemented (`LeavePolicies.tsx`)
  - Purpose: Manage leave types, policies, accrual rules
  - Features: CRUD operations, policy configuration, employment type assignments
  - Access: Admin only

- ✅ **Leave Reports** - Fully implemented (`LeaveReports.tsx`)
  - Purpose: Generate leave analytics and reports
  - Features: Usage reports, trends, export functionality
  - Access: Admin only

- ✅ **System Settings** - Fully implemented (`LeaveSettings.tsx`)
  - Purpose: Configure leave system settings
  - Features: Accrual settings, blackout periods, notifications, integrations
  - Access: Admin only

**Implementation Status Summary:**
- ✅ All 10 sidebar features are fully implemented
- ✅ Role-based access control properly enforced
- ✅ Comprehensive functionality in each section
- ✅ Modern, responsive UI with Apple Calendar-inspired design

### 4. Holiday Pay & Invoice Integration Analysis

#### Current Invoice System

**Location**: `backend/api/models.py`

**Shift Model** (Lines 1493-2110)
- Payment calculation: `calculate_payment()`
- Effective hourly rate resolution: `get_effective_hourly_rate()`
- Priority order:
  1. Shift-specific `hourly_rate`
  2. Venue-specific `PayRate`
  3. Default `PayRate` for staff
  4. System `default_hourly_rate`

**PayRate Model** (Lines 2464-2479)
```python
class PayRate(models.Model):
    staff_user = ForeignKey(User)
    venue = ForeignKey(Venue, null=True)  # null = default rate
    hourly_rate = DecimalField(max_digits=10, decimal_places=2)
    is_default = BooleanField(default=False)
```

**Invoice Model** (Lines 2298-2445)
- Purpose: Aggregate approved shifts for payment period
- Generation: `generate_for_staff_period(user, start_date, end_date)`
- Current Implementation: **ONLY processes Shift objects**

**InvoiceItem Model** (Lines 2447-2462)
```python
class InvoiceItem(models.Model):
    invoice = ForeignKey(Invoice)
    shift = ForeignKey(Shift)  # REQUIRED - no leave linkage
    date = DateField()
    venue = ForeignKey(Venue)
    hours_worked = DecimalField()
    rate = DecimalField()
    amount = DecimalField()
```

**Critical Finding**: InvoiceItem ONLY links to Shift - no provision for leave-based payments.

#### Gap Analysis: What's Missing

**Backend Models:**
❌ No `LeaveRequest.payment_amount` field
❌ No `LeaveRequest.is_paid` tracking
❌ No leave payment calculation method
❌ No leave type multiplier for holiday pay

**Invoice Integration:**
❌ `InvoiceItem.shift` is required (not optional)
❌ No `InvoiceItem.leave_request` foreign key
❌ No `item_type` discriminator field
❌ `Invoice.generate_for_staff_period()` doesn't query LeaveRequest

**Payment Calculation:**
❌ No average earnings calculation for leave pay
❌ No holiday pay premium (1.5x) integration
❌ No paid leave days in total hours calculation

**System Configuration:**
❌ No `SystemSettings.paid_leave_rate` field
❌ No `SystemSettings.holiday_pay_multiplier` field
❌ No leave-specific payment configuration

#### Holiday Pay Configuration

**Compliance System** (`backend/api/management/commands/load_compliance_data.py`)

Lines 149-150:
```python
'public_holiday_premium': 1.5,
'bank_holiday_premium': 2.0,
```

**Status**: Premium rates defined in compliance data but **NOT integrated** with shift payment calculations.

**Missing Integration:**
- No `Shift.is_public_holiday` field
- No holiday premium application in `get_effective_hourly_rate()`
- No public holiday detection logic

#### Company Onboarding Configuration

**Location**: `backend/api/serializers.py` (Lines 1900-1929)

```python
# Holiday and Leave Configuration
public_holidays = serializers.ListField(
    child=serializers.DateField(),
    required=False,
    help_text="List of public holidays"
)
minimum_leave_entitlement = serializers.IntegerField(
    required=False,
    help_text="Minimum annual leave entitlement in days"
)
```

**Status**: Onboarding captures leave configuration but no enforcement or tracking.

#### User Earnings Methods

**File**: `backend/api/models.py`

**Pending Earnings** (Lines 808-839)
```python
def get_pending_earnings(self):
    """Calculate total pending earnings from approved shifts not yet invoiced"""
    # Returns: total_pending, pending_shifts, shift_count
    # ONLY processes Shift objects
```

**Weekly Earnings** (Lines 841-906)
```python
def get_estimated_weekly_earnings(self):
    """Calculate estimated earnings for current week"""
    # Returns: approved_earnings, estimated_earnings, total_estimated
    # ONLY processes Shift objects
```

**Critical Gap**: No methods for calculating leave-based earnings.

### 5. What Works & What Doesn't

#### ✅ What Works (Fully Functional)

**Leave Management System:**
1. ✅ Complete CRUD operations for leave types, policies, requests
2. ✅ Real-time balance calculations with pending tracking
3. ✅ Approval workflow with manager queue and bulk actions
4. ✅ Blackout period restrictions with conflict detection
5. ✅ Team overview and calendar visualization
6. ✅ Analytics and reporting with export functionality
7. ✅ Role-based permissions (Staff/Manager/Admin)
8. ✅ Advanced validation (overlap, balance, notice period, consecutive days)
9. ✅ Carryover processing with expiry tracking
10. ✅ Service-length tiered accrual
11. ✅ File upload for supporting documents
12. ✅ Public holiday integration via Nager.Date API
13. ✅ Performance optimizations (caching, indexing, query optimization)
14. ✅ Comprehensive UI with 21 components
15. ✅ Mobile-responsive design

**Shift-Based Payment System:**
1. ✅ Shift payment calculation with actual hours worked
2. ✅ Multi-tiered hourly rate resolution (shift > venue > default > system)
3. ✅ Invoice generation for approved shifts
4. ✅ Invoice items with detailed breakdown
5. ✅ Pending earnings calculation
6. ✅ Special event pay rates
7. ✅ Break duration deduction
8. ✅ Auto-checkout prevention of overtime exploitation
9. ✅ PayRate model for custom staff/venue rates

#### ❌ What Doesn't Work (Critical Gaps)

**Leave Payment Integration:**
1. ❌ Approved paid leave **NOT included** in invoice generation
2. ❌ No leave payment calculation methods
3. ❌ No integration between LeaveRequest and InvoiceItem
4. ❌ Staff can get approved for paid leave but receive **ZERO payment**
5. ❌ `InvoiceItem` model only links to `Shift`, not `LeaveRequest`
6. ❌ `Invoice.generate_for_staff_period()` ignores approved leave requests
7. ❌ No average earnings calculation for leave pay
8. ❌ No leave type payment multiplier (e.g., holiday pay at 1.5x)
9. ❌ No paid vs unpaid leave tracking in LeaveRequest model
10. ❌ Pending earnings calculation excludes approved leave

**Holiday Pay Premium:**
1. ❌ Shift model lacks `is_public_holiday` field
2. ❌ Holiday premium rates (1.5x, 2.0x) not applied to shift payments
3. ❌ No automatic public holiday detection
4. ❌ Compliance holiday premiums not integrated with payment calculation

**System Configuration:**
1. ❌ No leave-specific payment settings in SystemSettings
2. ❌ No configuration for hours per leave day (default 8)
3. ❌ No leave pay calculation method selection (average vs fixed)

**User Experience Issues:**
1. ❌ Staff request and get approved for paid annual leave
2. ❌ Invoice generated for the period shows only shift hours
3. ❌ Leave days appear in calendar but NOT in payment
4. ❌ No visibility that leave is unpaid in current system
5. ❌ Confusing for staff expecting holiday pay

#### ⚠️ Partial Implementation

**Notification System:**
- ⚠️ Placeholder triggers exist in code
- ⚠️ `notification_sent` field on LeaveRequest
- ⚠️ No actual email/SMS/push notification implementation

**Advanced Analytics:**
- ⚠️ Trend analysis and capacity planning methods exist
- ⚠️ Requires historical data to be meaningful
- ⚠️ AI-powered suggestions mentioned in docs but not implemented

**Integration Settings:**
- ⚠️ Leave settings page has "Integration" tab
- ⚠️ Placeholder for external system integration
- ⚠️ No actual integrations implemented

## Code References

### Backend Models
- Leave management models: `backend/leave_management/models.py:1-1190`
- Invoice models: `backend/api/models.py:2298-2479`
- Shift payment: `backend/api/models.py:1900-1972`
- User earnings: `backend/api/models.py:808-906`

### Backend API
- Leave URLs: `backend/leave_management/urls.py:1-287`
- Leave views: `backend/leave_management/views.py:1-1700+`
- Leave serializers: `backend/leave_management/serializers.py:1-550+`
- Permissions: `backend/leave_management/permissions.py`

### Frontend Services
- Leave service: `frontend/src/services/leaveService.ts:1-842`
- Holiday service: `frontend/src/services/holidayService.ts:1-302`
- Leave types: `frontend/src/types/leave.ts:1-290`

### Frontend Components
- Request form: `frontend/src/components/LeaveRequestForm.tsx:1-490`
- Approval dashboard: `frontend/src/components/LeaveApprovalDashboard.tsx:1-872`
- Balance display: `frontend/src/components/LeaveBalanceDisplay.tsx:1-485`
- History table: `frontend/src/components/LeaveHistoryTable.tsx:1-906`

### Frontend Pages
- Leave dashboard: `frontend/src/pages/leave/LeaveDashboard.tsx`
- Leave policies: `frontend/src/pages/admin/LeavePolicies.tsx`
- Leave reports: `frontend/src/pages/admin/LeaveReports.tsx`
- Leave settings: `frontend/src/pages/admin/LeaveSettings.tsx`

## Architecture Insights

### Design Patterns

**Backend:**
- Django app architecture: Separate `leave_management` app
- Service layer pattern: Business logic in services.py
- Repository pattern: Custom managers for complex queries
- DRY principle: Reusable validators and permissions

**Frontend:**
- Component composition: Atomic design principles
- Service layer abstraction: API calls in service files
- Type-safe development: Comprehensive TypeScript definitions
- Hook-based state: React hooks for local state
- Presentational/Container: Separation of concerns

### Data Flow

**Leave Request Lifecycle:**
1. Staff submits via `LeaveRequestForm.tsx`
2. Frontend validates using `validateLeaveRequest()`
3. POST to `/api/v1/leave/requests/`
4. Backend validates (balance, blackout, overlap)
5. Creates LeaveRequest with status='pending'
6. Manager views in `LeaveApprovalDashboard.tsx`
7. Approval POST to `/api/v1/leave/requests/{id}/approve/`
8. Backend updates status, deducts balance
9. **GAP**: No invoice item created for paid leave

**Current Invoice Flow:**
1. Admin selects staff and date range in `InvoiceGeneration.tsx`
2. POST to `/api/v1/invoices/generate/`
3. Backend queries approved Shifts in date range
4. Calculates hours and payments per shift
5. Creates Invoice with InvoiceItems
6. **MISSING**: Leave requests not queried or included

### Integration Points

**Existing Integrations:**
- ✅ Authentication: Uses main User model
- ✅ Employment types: Links to EmploymentType model
- ✅ Venues: BlackoutPeriod links to Venue
- ✅ Compliance: Uses compliance profiles for leave rules

**Missing Integrations:**
- ❌ Invoice: No linkage between LeaveRequest and InvoiceItem
- ❌ Payment: No leave payment in Invoice.generate_for_staff_period()
- ❌ Earnings: User.get_pending_earnings() excludes leave
- ❌ Holiday premium: Shift.get_effective_hourly_rate() no holiday multiplier

### Performance Considerations

**Optimizations Applied:**
- Database indexing on frequently queried fields
- QuerySet optimization (select_related, prefetch_related)
- 5-minute cache on balance summaries
- Pagination on all list endpoints
- Efficient aggregation for analytics

**Potential Bottlenecks:**
- Real-time balance calculations on every request (cached)
- Working days calculation for large date ranges
- Team calendar queries for large teams
- Analytics report generation for large datasets

## Recommendations for Holiday Pay Integration

### Phase 1: Extend Models (Week 1-2)

**1. Add Leave Payment Fields to LeaveRequest**
```python
class LeaveRequest(models.Model):
    # ... existing fields ...

    # Payment tracking
    is_paid = models.BooleanField(default=True)
    payment_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def calculate_leave_payment(self):
        """Calculate payment based on average earnings from recent shifts"""
        # Implementation details in research document
```

**2. Add Payment Multiplier to LeaveType**
```python
class LeaveType(models.Model):
    # ... existing fields ...
    pay_rate_multiplier = models.DecimalField(
        max_digits=5, decimal_places=2, default=1.00,
        help_text="Multiplier for hourly rate (e.g., 1.5 for holiday pay)"
    )
```

**3. Extend InvoiceItem Model**
```python
class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE)

    # Make shift optional
    shift = models.ForeignKey(Shift, null=True, blank=True)

    # Add leave linkage
    leave_request = models.ForeignKey('leave_management.LeaveRequest',
                                     null=True, blank=True)

    # Item type discriminator
    item_type = models.CharField(
        max_length=20,
        choices=[
            ('shift', 'Shift Hours'),
            ('annual_leave', 'Annual Leave'),
            ('sick_leave', 'Sick Leave'),
            ('holiday_pay', 'Holiday Pay'),
        ],
        default='shift'
    )

    # ... existing fields ...
    description = models.CharField(max_length=255, blank=True)
```

**4. Add Holiday Flag to Shift**
```python
class Shift(models.Model):
    # ... existing fields ...
    is_public_holiday = models.BooleanField(default=False)

    def get_effective_hourly_rate(self):
        base_rate = super().get_effective_hourly_rate()

        if self.is_public_holiday:
            # Apply 1.5x premium from compliance profile
            holiday_premium = 1.5  # or from compliance.additional_rules
            base_rate = Decimal(str(base_rate)) * Decimal(str(holiday_premium))

        return base_rate
```

### Phase 2: Update Invoice Generation (Week 3-4)

**Modify `Invoice.generate_for_staff_period()`**
```python
@classmethod
def generate_for_staff_period(cls, staff_user, start_date, end_date):
    # ... existing shift logic ...

    # NEW: Get approved paid leave requests
    leave_requests = LeaveRequest.objects.filter(
        user=staff_user,
        start_date__gte=start_date,
        start_date__lte=end_date,
        status='approved',
        leave_type__is_paid=True
    )

    # Process leave payments
    for leave in leave_requests:
        leave_payment = leave.calculate_leave_payment()
        leave_hours = leave.days_requested * Decimal('8.00')

        InvoiceItem.objects.create(
            invoice=invoice,
            leave_request=leave,
            item_type=leave.leave_type.code,
            date=leave.start_date,
            hours_worked=leave_hours,
            rate=leave_payment / leave_hours,
            amount=leave_payment,
            description=f"{leave.leave_type.name}: {leave.start_date} to {leave.end_date}"
        )
```

### Phase 3: Frontend Updates (Week 5-6)

**Update Invoice Display Components**
- Add item type badges (Shift, Annual Leave, Holiday Pay)
- Show description for leave items
- Differentiate leave items visually

**Update Invoice Generation Form**
- Add checkboxes for "Include Shifts" and "Include Leave"
- Add multi-select for leave types to include
- Preview breakdown before generation

### Phase 4: Testing & Documentation (Week 7-8)

**Unit Tests:**
- Leave payment calculation accuracy
- Holiday premium application
- Invoice generation with mixed items
- Balance updates on approval
- Edge cases (partial days, negative balance)

**Integration Tests:**
- End-to-end leave request → approval → payment flow
- Invoice generation with shifts and leave
- Export functionality with leave items

**Documentation:**
- API endpoint updates
- User guide for leave payment
- Admin configuration guide

## Open Questions

1. **Leave Payment Calculation Method**: Should leave be paid at average earnings (last 12 weeks) or fixed rate?
2. **Holiday Premium Scope**: Should public holiday premium apply to shifts, leave, or both?
3. **Partial Days**: How should half-day leave be paid? Pro-rata hourly?
4. **Sick Leave Pay**: Should sick leave have different pay rules (e.g., statutory sick pay)?
5. **Carryover Payment**: Should expired carried-over leave be paid out?
6. **Negative Balance**: If staff take leave in advance and leave employment, how to handle repayment?
7. **Accrual Timing**: Should accrual happen at month start, month end, or pro-rata daily?
8. **Working Days Standard**: Is 8 hours per day the correct standard for all employment types?

## Historical Context (from thoughts/)

**Related Documentation:**
- `docs/frontend_model_analysis.md` - Phase 1 priority for leave management
- `docs/CLAUDE.md` - Agent workflow for leave implementation (Lines 173-414)
- `backend/leave_management/API_IMPLEMENTATION_SUMMARY.md` - API completion status
- `agent_memory/orchestrator/phase_tracker.json` - Project phase tracking

**Implementation Timeline:**
- Phase 1 (Core Leave System): Completed
- Backend models and APIs: Fully implemented
- Frontend components: Fully implemented
- **Phase 2-4 (Advanced features)**: Invoice integration remains incomplete

## Related Research

None yet - this is the first comprehensive research document for the leave management system.

## Conclusion

The leave management system is architecturally sound and feature-complete for leave request workflows, but has a **critical gap** in payment integration. The system allows staff to:
1. ✅ Request paid annual leave
2. ✅ Get manager approval
3. ✅ See approved leave in calendar
4. ❌ **NOT receive payment** in invoices

This gap creates a broken user experience where approved paid leave doesn't translate to actual payment. The recommended integration approach extends existing models and invoice generation to include approved leave requests alongside shift-based hours.

**Priority Level**: **CRITICAL** - Staff are likely expecting payment for approved leave, creating potential labor law compliance issues and payroll discrepancies.

**Estimated Implementation**: 6-8 weeks with proper testing and migration strategy.

**Risk Level**: **LOW** - Changes are additive (not breaking) and leverage existing payment infrastructure.
