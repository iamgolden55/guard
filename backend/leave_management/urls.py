from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LeaveTypeViewSet,
    LeavePolicyViewSet,
    LeaveBalanceViewSet,
    LeaveRequestViewSet,
    LeaveCalendarViewSet,
    LeaveReportsViewSet,
    HolidayViewSet,
    TeamOverviewViewSet,
    LeaveSettingsViewSet,
    BlackoutPeriodsViewSet,
)

# Create router and register viewsets
router = DefaultRouter()

# Core leave management endpoints
router.register(r'types', LeaveTypeViewSet, basename='leave-types')
router.register(r'policies', LeavePolicyViewSet, basename='leave-policies')
router.register(r'balances', LeaveBalanceViewSet, basename='leave-balances')
router.register(r'requests', LeaveRequestViewSet, basename='leave-requests')

# Team management endpoints
router.register(r'team-overview', TeamOverviewViewSet, basename='team-overview')

# Reports and analytics
router.register(r'reports', LeaveReportsViewSet, basename='leave-reports')

# System settings and configuration
router.register(r'settings', LeaveSettingsViewSet, basename='leave-settings')
router.register(r'blackout-periods', BlackoutPeriodsViewSet, basename='blackout-periods')

# Additional endpoints
router.register(r'calendar', LeaveCalendarViewSet, basename='leave-calendar')
router.register(r'holidays', HolidayViewSet, basename='holidays')

# Custom URL patterns for specific endpoints
app_name = 'leave_management'

urlpatterns = [
    # Include all router URLs
    path('', include(router.urls)),

    # Additional custom endpoints can be added here
    # For example:
    # path('bulk-import/', BulkImportView.as_view(), name='bulk-import'),
    # path('export/<str:format>/', ExportView.as_view(), name='export-data'),
]

# Format suffix patterns are already handled by DefaultRouter

"""
API Endpoint Summary:

Core Endpoints (Fully Implemented):
===================================

Leave Types:
- GET    /api/v1/leave/types/              - List all leave types (filtered by user permissions)
- POST   /api/v1/leave/types/              - Create new leave type (Admin only)
- GET    /api/v1/leave/types/{id}/         - Retrieve specific leave type
- PUT    /api/v1/leave/types/{id}/         - Update leave type (Admin only)
- PATCH  /api/v1/leave/types/{id}/         - Partial update leave type (Admin only)
- DELETE /api/v1/leave/types/{id}/         - Delete leave type (Admin only)
- GET    /api/v1/leave/types/active/       - List only active leave types
- POST   /api/v1/leave/types/{id}/toggle_active/ - Toggle active status (Admin only)
- GET    /api/v1/leave/types/usage_statistics/ - Get usage statistics (Manager/Admin)

Leave Policies:
- GET    /api/v1/leave/policies/           - List all leave policies (filtered by user permissions)
- POST   /api/v1/leave/policies/          - Create new leave policy (Admin only)
- GET    /api/v1/leave/policies/{id}/      - Retrieve specific leave policy
- PUT    /api/v1/leave/policies/{id}/      - Update leave policy (Admin only)
- PATCH  /api/v1/leave/policies/{id}/      - Partial update leave policy (Admin only)
- DELETE /api/v1/leave/policies/{id}/      - Delete leave policy (Admin only)
- GET    /api/v1/leave/policies/for_user/  - Get policies applicable to current user
- POST   /api/v1/leave/policies/{id}/duplicate/ - Duplicate policy (Admin only)
- POST   /api/v1/leave/policies/{id}/toggle_active/ - Toggle active status (Admin only)
- GET    /api/v1/leave/policies/{id}/preview_impact/ - Preview policy impact (Manager/Admin)

Leave Balances:
- GET    /api/v1/leave/balances/           - List leave balances (filtered by user permissions)
- GET    /api/v1/leave/balances/{id}/      - Retrieve specific balance
- GET    /api/v1/leave/balances/summary/   - Get aggregated balance summary
- GET    /api/v1/leave/balances/my_balances/ - Get current user's balances
- POST   /api/v1/leave/balances/recalculate_all/ - Recalculate all balances (Admin only)
- GET    /api/v1/leave/balances/team_summary/ - Get team balance summary (Manager/Admin)

Leave Requests (Fully Implemented):
- GET    /api/v1/leave/requests/           - List leave requests (filtered by user permissions)
- POST   /api/v1/leave/requests/          - Submit new leave request
- GET    /api/v1/leave/requests/{id}/      - Retrieve specific leave request
- PUT    /api/v1/leave/requests/{id}/      - Update leave request
- PATCH  /api/v1/leave/requests/{id}/      - Partial update leave request
- DELETE /api/v1/leave/requests/{id}/      - Delete/cancel leave request
- POST   /api/v1/leave/requests/{id}/submit/ - Submit draft request for approval
- POST   /api/v1/leave/requests/{id}/approve/ - Approve leave request (Manager/Admin)
- POST   /api/v1/leave/requests/{id}/reject/ - Reject leave request (Manager/Admin)
- POST   /api/v1/leave/requests/{id}/cancel/ - Cancel leave request (User)
- GET    /api/v1/leave/requests/my_requests/ - Get current user's requests
- GET    /api/v1/leave/requests/pending_approvals/ - Get pending approvals (Manager/Admin)

Team Overview Endpoints (NEW - High Priority):
==============================================

Team Management:
- GET    /api/v1/leave/team-overview/      - Get team overview data (Manager/Admin)
- GET    /api/v1/leave/team-overview/team_balances/ - Get team leave balances
- GET    /api/v1/leave/team-overview/team_calendar/ - Get team calendar view
- GET    /api/v1/leave/team-overview/pending_requests/ - Get pending requests for approval
- GET    /api/v1/leave/team-overview/analytics_summary/ - Get team analytics summary

Leave Reports Endpoints (NEW - High Priority):
=============================================

Reports & Analytics:
- GET    /api/v1/leave/reports/            - List available reports with quick metrics
- GET    /api/v1/leave/reports/analytics/  - Get comprehensive leave analytics
- GET    /api/v1/leave/reports/usage_summary/ - Get detailed usage summary report
- GET    /api/v1/leave/reports/export/     - Export data in various formats (JSON/CSV/Excel)
- GET    /api/v1/leave/reports/balance_trends/ - Analyze leave balance trends
- GET    /api/v1/leave/reports/team_utilization/ - Team-level utilization analysis

Leave System Settings Endpoints (NEW - High Priority):
======================================================

System Configuration:
- GET    /api/v1/leave/settings/           - Get leave system settings overview (Admin)
- GET    /api/v1/leave/settings/system_config/ - Get system configuration (Admin)
- PUT    /api/v1/leave/settings/system_config/ - Update system configuration (Admin)

Blackout Periods Management:
- GET    /api/v1/leave/blackout-periods/   - List blackout periods (Admin)
- POST   /api/v1/leave/blackout-periods/  - Create blackout period (Admin)
- GET    /api/v1/leave/blackout-periods/{id}/ - Get specific blackout period
- PUT    /api/v1/leave/blackout-periods/{id}/ - Update blackout period (Admin)
- DELETE /api/v1/leave/blackout-periods/{id}/ - Delete blackout period (Admin)
- GET    /api/v1/leave/blackout-periods/current_restrictions/ - Get current active restrictions
- GET    /api/v1/leave/blackout-periods/upcoming_restrictions/ - Get upcoming restrictions
- POST   /api/v1/leave/blackout-periods/{id}/toggle_active/ - Toggle active status
- POST   /api/v1/leave/blackout-periods/bulk_create/ - Create multiple periods
- GET    /api/v1/leave/blackout-periods/check_conflicts/ - Check for conflicts

Additional Endpoints:
====================

Leave Calendar:
- GET    /api/v1/leave/calendar/           - Get calendar data (various formats)

Public Holidays:
- GET    /api/v1/leave/holidays/           - Get public holidays (with country/year params)

Query Parameters:
================

Common filters:
- ?active_only=true              - Filter to active items only
- ?effective_only=true           - Filter to currently effective policies
- ?year=2024                     - Filter by specific year
- ?user_id=123                   - Filter by specific user (Manager/Admin)
- ?employment_type=1             - Filter by employment type
- ?leave_type=1                  - Filter by leave type
- ?status=pending                - Filter by status (requests)
- ?start_date=2024-01-01        - Filter by date range
- ?end_date=2024-12-31          - Filter by date range
- ?search=term                   - Text search
- ?ordering=field                - Sort results
- ?page=1&page_size=20          - Pagination

Team Overview specific:
- ?start_date=2024-01-01        - Calendar date range
- ?end_date=2024-01-31          - Calendar date range

Reports specific:
- ?format=json|csv|excel        - Export format
- ?type=analytics|usage_summary - Report type
- ?days_ahead=30                - Future period analysis

Blackout Periods specific:
- ?current_and_future=true      - Only current and future periods
- ?days_ahead=30                - Upcoming restrictions period

Authentication & Permissions:
============================

All endpoints require authentication via JWT token.

Role-based permissions:
- Staff:
  * Read own leave data and requests
  * Submit leave requests
  * View applicable leave types and policies

- Manager:
  * All staff permissions
  * View team leave data and requests
  * Approve/reject team leave requests
  * Access team overview and analytics
  * View usage reports and statistics

- Admin:
  * All manager permissions
  * Full CRUD access to leave types and policies
  * System configuration management
  * Blackout periods management
  * Advanced reports and analytics
  * Bulk operations and system maintenance

HTTP Status Codes:
==================

- 200 OK: Successful GET, PUT, PATCH
- 201 Created: Successful POST
- 204 No Content: Successful DELETE
- 400 Bad Request: Invalid data, business rule violation
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource not found
- 409 Conflict: Conflicting blackout periods, overlapping requests
- 500 Internal Server Error: Server error

Content Types:
==============

- JSON (default): application/json
- CSV export: text/csv (for reports)
- Excel export: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (planned)
- iCal calendar: text/calendar (for calendar integration)

Business Rules Implemented:
===========================

Leave Request Validation:
- Balance availability checking
- Blackout period restrictions
- Overlapping request detection
- Minimum notice period enforcement
- Maximum consecutive days validation

Approval Workflow:
- Role-based approval permissions
- Automatic balance updates on approval/rejection
- Audit trail maintenance
- Notification triggers (placeholders for future implementation)

Balance Management:
- Real-time balance calculations
- Pending request tracking
- Accrual and usage recording
- Carryover processing
- Manual adjustment capabilities

System Integration:
==================

This API integrates with:
- Existing user management system (role-based permissions)
- Employment type classification system
- Venue management (for blackout periods)
- Notification system (placeholders for email/SMS)
- Public holiday API (Nager.Date proxy)
- Reporting and analytics engine

Performance Optimizations:
=========================

- Strategic database indexing on frequently queried fields
- QuerySet optimization with select_related/prefetch_related
- Caching for balance calculations and reports (5-minute cache)
- Bulk operations support
- Efficient aggregation queries
- Smart pagination for large datasets

Ready for Frontend Integration:
==============================

All endpoints are fully documented with:
- Clear request/response formats
- Comprehensive error handling
- Consistent API patterns
- Role-based permission validation
- Business rule enforcement
- Performance optimization
"""