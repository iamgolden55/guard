---
date: 2025-10-25T23:37:05+0000
researcher: Claude
git_commit: b4f9a3723f4b417d3c33d8018b313eb869f06ce9
branch: main
repository: remix2
topic: "Mobile App: Shift Transfer Functionality and Shift Reminder Notifications"
tags: [research, mobile, shift-transfer, notifications, shift-exchange, push-notifications, staff-filtering, company-isolation]
status: complete
last_updated: 2025-10-26T14:34:22+0000
last_updated_by: Claude
last_updated_note: "Added follow-up research for staff list filtering issue in transfer shift page"
---

# Research: Mobile App Shift Transfer and Notification System

**Date**: 2025-10-25T23:37:05+0000
**Researcher**: Claude
**Git Commit**: b4f9a3723f4b417d3c33d8018b313eb869f06ce9
**Branch**: main
**Repository**: remix2

## Research Question

The user identified two missing features in the mobile app:
1. **Shift transfer functionality** - Ability to transfer shifts to other staff members (exists on web, missing on mobile)
2. **Shift reminder notifications** - Push notifications when a shift is approaching (completely missing)

## Summary

### Shift Transfer: Backend ✅ | Web ✅ | Mobile ❌

The shift transfer functionality is **fully implemented** in both backend and web frontend, but **completely missing** from the mobile app. The backend provides two shift transfer mechanisms:

1. **ShiftExchange** - Direct bilateral exchanges or one-way transfers between specific staff members
2. **OpenShiftRequest** - Release shifts to an open pool for any qualified staff to claim

The mobile app currently only supports check-in/check-out functionality in `ShiftDetailsScreen.tsx` with no UI or service calls for shift transfers.

### Notifications: Configuration ⚠️ | Implementation ❌

The notification system has basic configuration (expo-notifications installed, channels defined) but **zero implementation**. No service layer, no push token registration, no listeners, and no local scheduling exist. The backend has email notifications but lacks push notification endpoints.

## Detailed Findings

### 1. Shift Transfer - Backend Implementation

**Location**: `backend/api/models.py`

#### ShiftExchange Model (Lines 2282-2400)
Handles bilateral exchanges or simple transfers between staff:

```python
class ShiftExchange:
    original_shift: ForeignKey  # Shift being offered
    target_shift: ForeignKey    # Shift offered in return (nullable for simple transfer)
    requesting_user: ForeignKey  # User initiating exchange
    target_user: ForeignKey      # User receiving request
    status: CharField            # pending, accepted_by_target, approved, rejected, cancelled
    request_reason: TextField
    target_response: TextField
    manager_notes: TextField
    manager_user: ForeignKey
```

**Key Methods**:
- `clean()` (Lines 2310-2333) - Validates no self-exchange, no started shifts, has required role, no conflicts
- `accept_by_target(response)` (Lines 2339-2346) - Target user accepts request
- `approve(manager_user, notes)` (Lines 2348-2379) - Manager approves, executes swap/transfer
- `reject(manager_user, notes)` (Lines 2381-2389) - Manager rejects
- `cancel(cancelled_by_user)` (Lines 2391-2400) - Either party cancels

#### OpenShiftRequest Model (Lines 1474-1595)
Handles releasing shifts to open pool:

```python
class OpenShiftRequest:
    original_shift: ForeignKey
    requesting_user: ForeignKey
    claimed_by: ForeignKey      # User who claimed (nullable)
    status: CharField           # open, claimed, approved, rejected, cancelled
    request_reason: TextField
    claim_time: DateTimeField
    manager_user: ForeignKey
    manager_notes: TextField
```

**Key Methods**:
- `clean()` (Lines 1503-1523) - Validates no started shifts, claiming user qualified, no conflicts
- `claim_shift(claiming_user)` (Lines 1529-1540) - Staff claims open shift
- `approve_claim(manager_user, notes)` (Lines 1542-1555) - Manager approves claim
- `reject_claim(manager_user, notes)` (Lines 1557-1565) - Manager rejects
- `cancel()` (Lines 1567-1573) - Requester cancels release
- `get_available_shifts(staff_user)` (Lines 1576-1595) - Class method returns claimable shifts

#### API Endpoints

**Location**: `backend/api/views.py`

**ShiftExchangeViewSet** (Lines 1580-1702)
- `GET /api/v1/shift-exchanges/` - List exchanges (filtered by role)
- `POST /api/v1/shift-exchanges/` - Create exchange request
- `POST /api/v1/shift-exchanges/{id}/accept/` - Target accepts (Lines 1600-1625)
- `POST /api/v1/shift-exchanges/{id}/approve/` - Manager approves (Lines 1627-1650)
- `POST /api/v1/shift-exchanges/{id}/reject/` - Manager rejects (Lines 1652-1681)
- `DELETE /api/v1/shift-exchanges/{id}/cancel/` - Cancel request (Lines 1683-1701)

**OpenShiftRequestViewSet** (Lines 1704-1838)
- `GET /api/v1/open-shift-requests/` - List requests (filtered by role)
- `POST /api/v1/open-shift-requests/` - Create release request
- `GET /api/v1/open-shift-requests/available/` - Get claimable shifts (Lines 1738-1749)
- `POST /api/v1/open-shift-requests/{id}/claim/` - Claim shift (Lines 1751-1767)
- `POST /api/v1/open-shift-requests/{id}/approve/` - Manager approves (Lines 1769-1795)
- `POST /api/v1/open-shift-requests/{id}/reject/` - Manager rejects (Lines 1796-1823)
- `DELETE /api/v1/open-shift-requests/{id}/cancel/` - Cancel release (Lines 1825-1838)

**Permissions**: Staff see only their own requests, managers/admins see all. All approvals require manager/admin role.

### 2. Shift Transfer - Web Frontend Implementation

**Location**: `security-staff-portal/src/pages/staff/ShiftExchange.tsx`

Fully functional shift exchange interface with 4 tabs:

1. **My Shifts** - User's assigned shifts with "Release" and "Request Exchange" buttons
2. **Available Shifts** - Open shifts from pool with "Claim Shift" button
3. **Direct Exchanges** - Exchange requests involving the user
4. **My Requests** - History of user's exchange/release requests

**Key UI Elements**:
- Release dialog (Lines 788-824) - Collects reason, calls `exchangeService.releaseShift()`
- Exchange request dialog (Lines 826-871) - Select target staff, reason, calls `exchangeService.createExchange()`
- Claim button handler (Line 430) - Calls `exchangeService.claimShift(requestId)`
- Cancel handlers for both exchange types

**Service Layer**: `security-staff-portal/src/services/exchangeService.ts`

Complete API integration:
```typescript
// Shift Exchanges
createExchange(data: CreateExchangeRequest)
acceptExchange(exchangeId: number, response: string)
approveExchange(exchangeId: number, notes: string)
rejectExchange(exchangeId: number, notes: string)
cancelExchange(exchangeId: number)

// Open Shift Requests
releaseShift(shiftId: number, reason: string)
claimShift(requestId: number)
approveOpenRequest(requestId: number, notes: string)
rejectOpenRequest(requestId: number, notes: string)
getAvailableShifts()
```

**Manager Approval**: `security-staff-portal/src/pages/manager/Approvals.tsx`

Dedicated "Exchange Approvals" pivot tab showing:
- Direct exchanges awaiting approval (status: accepted_by_target)
- Open shift claims awaiting approval (status: claimed)
- Approve/reject actions with notes

### 3. Shift Transfer - Mobile App Gap Analysis

**Current Mobile Implementation**: `mobile/src/screens/shifts/ShiftDetailsScreen.tsx`

The shift details screen currently only supports:
- ✅ Check-in flow (GPS, photo, signature)
- ✅ Check-out flow (GPS, photo, signature)
- ❌ Cancel shift
- ❌ Transfer/exchange shift
- ❌ Release to open pool
- ❌ View available shifts to claim

**Current UI Structure**:
```tsx
// ShiftDetailsScreen.tsx only shows:
<StatusBadge /> {/* scheduled | in_progress | completed */}
<VenueMap /> {/* Static map with distance */}
<ShiftDetails /> {/* Date, time, duration */}
<RequiredChecks /> {/* Venue checks list */}

{/* Action buttons */}
{status === 'scheduled' && <CheckInButton />}
{status === 'in_progress' && <EndShiftButton />}
{status === 'completed' && <CloseButton />}
```

**Missing Service Layer**: No shift exchange service exists

The `mobile/src/services/shiftsService.ts` only implements:
- `fetchShifts()` - Get shifts list
- `fetchShiftById()` - Get single shift
- `checkInShift()` - Check in
- `checkOutShift()` - Check out
- `cancelShift()` - Cancel (API call exists but no UI)

**Missing**: exchangeService.ts with methods for:
- Creating exchange requests
- Accepting/rejecting exchanges
- Releasing shifts to pool
- Claiming available shifts
- Viewing available shifts

### 4. Notification System - Current State

**Configuration Status**: ⚠️ Partially configured

**Package**: `mobile/package.json:39`
```json
"expo-notifications": "~0.32.12"
```

**App Config**: `mobile/app.config.js:42,63`
```javascript
plugins: [
  "expo-notifications"  // Android permissions configured
]
```

**Constants**: `mobile/src/utils/constants.ts:101-111`
```typescript
NOTIFICATION_CONFIG: {
  CHECK_REMINDER_MINUTES: 45,
  CHANNELS: {
    SHIFT_REMINDERS: 'shift-reminders',
    INCIDENT_ALERTS: 'incident-alerts',
    SYNC_STATUS: 'sync-status'
  }
}
```

**Feature Flag**: `mobile/src/utils/constants.ts:257-258`
```typescript
PUSH_NOTIFICATIONS: true
```

**Implementation Status**: ❌ Not implemented

**Missing Components**:
1. ❌ `mobile/src/services/notificationService.ts` - Doesn't exist
2. ❌ Push token registration with backend
3. ❌ Notification permission handling
4. ❌ Foreground notification listeners
5. ❌ Background notification handlers
6. ❌ Local notification scheduling for shift reminders
7. ❌ `mobile/src/hooks/useNotifications.ts` - Doesn't exist
8. ❌ Redux state for notifications (`notificationsSlice.ts` missing)

**Backend Gap**: No push notification infrastructure

**Email Notifications Exist**: `backend/api/tasks.py:351-407`
- Celery task `send_report_notification` sends emails
- WebSocket notifications for reports (Lines 615-669)
- No push token storage or FCM/APNS integration

**Missing Backend Endpoints**:
- `POST /api/v1/notifications/register-device/` - Register push token
- `GET /api/v1/notifications/preferences/` - Get notification settings
- `PUT /api/v1/notifications/preferences/` - Update settings
- `GET /api/v1/notifications/` - Notification history

## Code References

### Backend
- `backend/api/models.py:2282-2400` - ShiftExchange model
- `backend/api/models.py:1474-1595` - OpenShiftRequest model
- `backend/api/views.py:1580-1702` - ShiftExchangeViewSet
- `backend/api/views.py:1704-1838` - OpenShiftRequestViewSet
- `backend/api/serializers.py:455-464` - ShiftExchangeSerializer
- `backend/api/serializers.py:466-475` - OpenShiftRequestSerializer
- `backend/api/urls.py:47-48` - Router registration
- `backend/api/tasks.py:351-407` - Email notification task

### Web Frontend
- `security-staff-portal/src/pages/staff/ShiftExchange.tsx` - Full UI implementation
- `security-staff-portal/src/services/exchangeService.ts` - API service layer
- `security-staff-portal/src/pages/manager/Approvals.tsx` - Manager approval interface
- `security-staff-portal/src/Router.tsx:90` - Route definition

### Mobile App
- `mobile/src/screens/shifts/ShiftDetailsScreen.tsx` - Current shift details screen
- `mobile/src/services/shiftsService.ts` - Shift API service (no exchange methods)
- `mobile/src/utils/constants.ts:101-111` - Notification config
- `mobile/package.json:39` - expo-notifications dependency
- `mobile/app.config.js:42,63` - Notification plugin config

## Architecture Insights

### Shift Transfer Workflows

#### 1. Direct Bilateral Exchange
```
Staff A → Create ShiftExchange (original_shift, target_shift, target_user)
       ↓
Staff B → Accept exchange via /accept/ endpoint
       ↓
Manager → Approve via /approve/ endpoint
       ↓
System  → Swaps staff_user on both shifts atomically
```

#### 2. Simple Transfer (One Direction)
```
Staff A → Create ShiftExchange (original_shift, target_user, no target_shift)
       ↓
Staff B → Accept transfer
       ↓
Manager → Approve
       ↓
System  → Assigns original_shift to target_user
```

#### 3. Open Shift Pool
```
Staff A → Release shift via shift.release_to_pool(reason)
       ↓
System  → Creates OpenShiftRequest with status='open'
       ↓
Staff B → Views /available/ endpoint, claims via /claim/
       ↓
Manager → Approves via /approve/
       ↓
System  → Transfers shift to claiming user
```

### Permission Model

**Role-Based Access**:
- **Staff**: Create exchanges/releases, view own requests, accept incoming, claim available
- **Manager/Admin**: View all, approve/reject any exchange or claim

**Validation Rules** (enforced in model clean() methods):
- ❌ No self-exchanges
- ❌ No exchanging started shifts
- ✅ Target must have required security role
- ✅ No schedule conflicts
- ✅ Valid SIA license and admin approval required

### Notification Architecture (Proposed)

Based on configuration constants, the intended architecture:

**Channels**:
1. **shift-reminders** - Shift start approaching, shift tomorrow, etc.
2. **incident-alerts** - Critical incident notifications
3. **sync-status** - Offline sync completion, errors

**Timing**:
- `CHECK_REMINDER_MINUTES: 45` - Final reminder 45 minutes before shift
- `ADVANCE_REMINDER_HOURS: 3` - Advance reminder 3 hours before shift

**Notification Flow**:
```
App Launch → Request notification permissions
          ↓
User Allows → Register SNS device token with backend
          ↓
Shift Scheduled → Schedule TWO local notifications:
          ↓       1. 3 hours before shift (advance notice)
          ↓       2. 45 minutes before shift (immediate action)
          ↓
Backend → Sends matching SNS push notifications at same times
          ↓
Notification Fires → User taps → Navigate to ShiftDetailsScreen
```

## Implementation Plan

### Additional Requirements Based on Decisions

#### Backend Requirements

**1. Exchange Expiration System**
- New Celery scheduled task to check for expiring exchanges every 15 minutes
- Auto-cancel exchanges where `original_shift.start_time - 30 minutes < now()`
- Send notification to requesting user when exchange expires
- Update exchange status to 'expired' (new status value)

**2. AWS SNS Integration**
- Add `SNSDeviceToken` model (platform, endpoint_arn, user)
- API endpoint: `POST /api/v1/notifications/register-sns-token/`
- Celery task to send SNS notifications for shift reminders (3h, 45min before)
- SNS message format includes deep link to ShiftDetailsScreen

**3. Notification Preferences**
- Add `NotificationPreferences` model per user
- Fields: `shift_reminders_enabled`, `advance_reminder_hours`, `final_reminder_minutes`
- Default: 3 hours + 45 minutes
- API endpoints for preferences CRUD

#### Mobile Requirements

**1. Offline Queue System**
- AsyncStorage queue for pending exchange requests
- Sync service monitors connectivity and auto-syncs queue
- Visual indicator in UI for "Pending Sync" requests
- Retry logic with exponential backoff

**2. Dual Notification System**
- Local notification scheduling (works offline)
- SNS token registration on app launch
- Two notifications per shift: 3 hours before + 45 minutes before
- Deep link handling to navigate to ShiftDetailsScreen

**3. Constants Update**
```typescript
// mobile/src/utils/constants.ts
NOTIFICATION_CONFIG: {
  ADVANCE_REMINDER_HOURS: 3,      // New
  FINAL_REMINDER_MINUTES: 45,     // Updated from CHECK_REMINDER_MINUTES
  EXCHANGE_EXPIRY_MINUTES: 30,    // New
  CHANNELS: {
    SHIFT_REMINDERS: 'shift-reminders',
    INCIDENT_ALERTS: 'incident-alerts',
    SYNC_STATUS: 'sync-status'
  }
}
```

### Phase 1: Mobile Shift Transfer (Highest Priority)

#### 1.1 Create Exchange Service
**File**: `mobile/src/services/exchangeService.ts` (new)

Implement all API methods matching web version:
```typescript
export const exchangeService = {
  // Shift Exchanges
  createExchange(originalShiftId: number, targetUserId: number, targetShiftId?: number, reason: string)
  acceptExchange(exchangeId: number, response: string)
  cancelExchange(exchangeId: number)

  // Open Shift Requests
  releaseShift(shiftId: number, reason: string)
  claimShift(requestId: number)
  getAvailableShifts()

  // Fetch user's exchanges
  getMyExchanges()
  getMyRequests()
}
```

#### 1.2 Add UI to ShiftDetailsScreen
**File**: `mobile/src/screens/shifts/ShiftDetailsScreen.tsx`

Add action menu/buttons for scheduled shifts:
```tsx
{status === 'scheduled' && (
  <>
    <Button onPress={handleCheckIn}>Check In</Button>
    <Button variant="outline" onPress={handleTransfer}>Transfer Shift</Button>
    <Button variant="outline" onPress={handleRelease}>Release to Pool</Button>
    <Button variant="destructive" onPress={handleCancel}>Cancel</Button>
  </>
)}
```

Create modals:
- `TransferShiftModal.tsx` - Select target staff, optional bilateral exchange
- `ReleaseShiftModal.tsx` - Enter reason for release
- `CancelShiftModal.tsx` - Confirm cancellation with reason

#### 1.3 Create Available Shifts Screen
**File**: `mobile/src/screens/shifts/AvailableShiftsScreen.tsx` (new)

List all open shifts from pool:
- Filter by qualifications
- Show venue, time, requirements
- "Claim Shift" button
- Status indicator (open, claimed by you, claimed by other)

Add navigation route and tab/menu item.

#### 1.4 Create Shift Exchanges Screen
**File**: `mobile/src/screens/shifts/ShiftExchangesScreen.tsx` (new)

Show user's exchange history:
- Tabs: "Pending", "Accepted", "Completed"
- Accept/reject incoming exchanges
- Cancel pending exchanges
- Status tracking

### Phase 2: Notification System (High Priority)

#### 2.1 Create Notification Service
**File**: `mobile/src/services/notificationService.ts` (new)

```typescript
export const notificationService = {
  // Setup
  requestPermissions(): Promise<boolean>
  registerPushToken(): Promise<void>

  // Channels
  createNotificationChannels(): Promise<void>

  // Local scheduling
  scheduleShiftReminder(shift: Shift): Promise<string>
  cancelShiftReminder(notificationId: string): Promise<void>

  // Listeners
  setupNotificationListeners(): void
  handleNotificationReceived(notification: Notification): void
  handleNotificationTapped(response: NotificationResponse): void
}
```

#### 2.2 Backend Push Token Endpoints
**Files**:
- `backend/api/models.py` - Add `DevicePushToken` model
- `backend/api/views.py` - Add `DevicePushTokenViewSet`
- `backend/api/serializers.py` - Add `DevicePushTokenSerializer`

```python
class DevicePushToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(choices=[('ios', 'iOS'), ('android', 'Android')])
    device_id = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
```

#### 2.3 Integrate Notification Scheduling
**File**: `mobile/src/services/shiftsService.ts`

After fetching shifts, schedule notifications:
```typescript
const fetchShifts = async () => {
  const shifts = await api.get('/shifts/')

  // Schedule notifications for upcoming shifts
  for (const shift of shifts.filter(s => s.status === 'scheduled')) {
    await notificationService.scheduleShiftReminder(shift)
  }

  return shifts
}
```

#### 2.4 App Initialization
**File**: `mobile/App.tsx`

On app launch:
```typescript
useEffect(() => {
  const initNotifications = async () => {
    const hasPermission = await notificationService.requestPermissions()
    if (hasPermission) {
      await notificationService.createNotificationChannels()
      await notificationService.registerPushToken()
      notificationService.setupNotificationListeners()
    }
  }
  initNotifications()
}, [])
```

## Implementation Decisions ✅

1. **Manager Approval in Mobile**: ✅ **Web-only**
   - Mobile app will NOT include manager approval screens
   - Managers can use web dashboard for approvals
   - Mobile is staff-focused: request, accept, claim only

2. **Exchange Expiration**: ✅ **30 minutes before shift start**
   - Exchange requests automatically expire/cancelled if not accepted 30 minutes before original shift start time
   - Prevents last-minute shift changes
   - Backend will need scheduled task to check and cancel expired requests

3. **Push Notification Service**: ✅ **Dual approach - AWS SNS + Local Notifications**
   - AWS SNS for remote push notifications (when app is closed/background)
   - Local notifications for offline support (scheduled even without internet)
   - Ensures staff gets reminders regardless of connectivity

4. **Notification Frequency**: ✅ **3 hours before + 45 minutes before**
   - First reminder: 3 hours before shift start (advance notice)
   - Final reminder: 45 minutes before shift start (immediate action required)
   - Both notifications scheduled as local + push

5. **Offline Behavior**: ✅ **Queue for sync when back online**
   - Exchange requests created offline are queued in local storage
   - Synced automatically when app regains connectivity
   - Other staff won't see request until creator is online and syncs
   - UI shows "Pending Sync" status for queued requests

## Related Research

- `docs/frontend_model_analysis.md` - Original feature requirements analysis
- `docs/models_documentation.md` - Database schema documentation
- `database_schema/api_endpoints_documentation.md` - Complete API documentation
- `CLAUDE.md` - Agent workflow and implementation phases

## Next Steps

1. ✅ Research complete - All findings documented
2. ⏭️ Review with user for feedback and prioritization
3. ⏭️ Begin Phase 1.1 - Create mobile exchange service
4. ⏭️ Implement shift transfer UI in mobile app
5. ⏭️ Begin Phase 2.1 - Create notification service
6. ⏭️ Implement backend push token endpoints
7. ⏭️ Integrate notification scheduling throughout app

---

## Follow-up Research: Staff List Not Showing in Transfer Shift Page [2025-10-26T14:34:22+0000]

### Issue Description

User James44 (logged in under Mead Security company) reported that when attempting to transfer a shift, the transfer shift page does not display any staff members from the same company to transfer to. This prevents the shift transfer functionality from working for staff users.

### Investigation Summary

Conducted comprehensive research across mobile app, backend API, and web frontend implementations to identify why eligible staff members are not appearing in the transfer shift staff selection.

### Root Cause Analysis

#### Critical Finding: Staff Role Permission Restriction

**Backend Permission Logic** (`backend/api/views.py:267-289`)

The `UserViewSet.get_queryset()` method implements role-based filtering that **explicitly prevents staff from seeing other staff members**:

```python
def get_queryset(self):
    user = self.request.user
    
    if user.role in ['admin', 'manager']:
        # Get user's company context
        company = self.get_user_company(self.request)
        if not company:
            return User.objects.filter(id=user.id)
        
        # Filter to users who are members of same company
        company_user_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)
        
        return User.objects.filter(id__in=company_user_ids)
    
    # ISSUE: Staff can only see their own user record
    return User.objects.filter(id=user.id)  # Line 287-289
```

**The Problem:**
- Lines 287-289: When `user.role == 'staff'`, the queryset returns **only the current user's record**
- This means staff users can **never** see other staff members
- The mobile app correctly calls `/api/v1/users/` endpoint, but backend filters out all other users
- Same issue exists in `StaffProfileViewSet.get_queryset()` at line 656: `return queryset.filter(user=user)`

#### Mobile App Implementation (Correct, but backend blocks it)

**TransferShiftModal.tsx** (`mobile/src/components/modals/TransferShiftModal.tsx:64`)

```typescript
const response = await api.get<{results: StaffMember[]}>('/api/v1/users/');
```

The mobile app correctly:
1. Fetches from `/api/v1/users/` endpoint
2. Should receive company-filtered staff members
3. Displays them in a scrollable list for selection

**But the backend blocks this** by returning only the current user for staff role.

#### Web Frontend Implementation (Same Issue)

**shiftService.ts** (`security-staff-portal/src/services/shiftService.ts:676`)

```typescript
const response = await api.get<any>('/staff-profiles/');
```

The web frontend:
1. Fetches from `/api/v1/staff-profiles/` endpoint
2. Should receive staff profiles filtered by company
3. **Has TODO comment at line 64** acknowledging this might need a dedicated endpoint

**StaffProfileViewSet has the same restriction** at line 656:
```python
# Staff can only see their own profile
return queryset.filter(user=user)
```

### Why This Design Choice Was Made

The current implementation follows a **strict data isolation principle**:
- Staff users should only access their own data
- Prevents staff from seeing personal information of other staff members
- Protects privacy and enforces role-based access control

**However**, this conflicts with the shift transfer feature requirement where staff need to see and select other staff members to transfer shifts to.

### Data Isolation Architecture

#### Multi-Tenant Company Structure

Users belong to companies via `UserCompanyMembership` model:
- Users can have memberships in multiple companies
- Each membership has a role: owner, admin, manager, staff, viewer
- Memberships have `is_active` flag

#### Company Context Resolution

**Middleware** (`backend/api/middleware/tenant_middleware.py:35-71`):
1. Sets `request.current_company` from headers, URL params, or user's primary membership
2. Adds response headers: `X-Current-Company`, `X-Company-Name`

**ViewSet Filtering** (`backend/api/views.py:255-265`):
```python
def get_user_company(self, request):
    """Get the user's current company context"""
    membership = request.user.company_memberships.filter(
        is_active=True,
        role__in=['owner', 'admin', 'manager']  # NOTE: Only these roles
    ).select_related('company').first()
    
    if not membership:
        return None
    return membership.company
```

**Critical Issue**: `get_user_company()` only looks for owner/admin/manager memberships, **excluding staff role**. This means staff users never have a company context established, even if they have active company memberships.

### Additional Backend Issues Discovered

#### 1. Staff Dropdown Endpoint - No Company Filtering

**UserViewSet.staff_users()** (`backend/api/views.py:351-380`)

The dedicated staff dropdown endpoint has **no company filtering**:

```python
@action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
def staff(self, request):
    """Get all staff users for dropdowns/selection"""
    if request.user.role not in ['admin', 'manager']:
        return Response({'error': 'Permission denied'}, status=403)
    
    # ISSUE: No company filtering - returns ALL staff across ALL companies
    staff_users = User.objects.filter(role='staff').select_related('profile')
    # ...
```

This endpoint returns **all staff across all companies**, breaking multi-tenant isolation for managers/admins.

#### 2. Shift Transfer Models - No Company Validation

**ShiftExchange Model** (`backend/api/models.py:2310-2334`)

Validation checks:
- ✅ Not the same user
- ✅ Shift hasn't started
- ✅ Target has required security role
- ✅ No scheduling conflicts
- ❌ **No company membership validation**

**OpenShiftRequest Model** (`backend/api/models.py:1576-1595`)

The `get_available_shifts()` method:
- ✅ Filters by security role
- ✅ Checks scheduling conflicts
- ✅ Validates staff profile approval
- ❌ **No company filtering** - shows shifts from all companies

**Implication**: Staff can transfer shifts across company boundaries if they have the security role.

### Comparison: Mobile vs Web

| Aspect | Mobile App | Web Frontend |
|--------|-----------|--------------|
| **Endpoint Used** | `/api/v1/users/` | `/api/v1/staff-profiles/` |
| **Backend ViewSet** | UserViewSet | StaffProfileViewSet |
| **Staff Role Filter** | Returns only current user (line 287-289) | Returns only current profile (line 656) |
| **Company Filtering** | Would work if staff had access | Would work if staff had access |
| **Result** | ❌ No staff shown | ❌ No staff shown |

Both implementations suffer from the same backend permission restriction.

### Proposed Solutions

#### Option 1: Create Dedicated Eligible Staff Endpoint (Recommended)

Create a new endpoint specifically for shift transfer staff selection:

**backend/api/views.py** - Add to UserViewSet:
```python
@action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
def eligible_for_transfer(self, request):
    """Get staff members eligible for shift transfers from user's company"""
    user = request.user
    
    # Get user's company (include staff role this time)
    membership = user.company_memberships.filter(
        is_active=True
    ).select_related('company').first()
    
    if not membership:
        return Response({'error': 'No company membership found'}, status=404)
    
    company = membership.company
    
    # Get all active staff from same company
    company_user_ids = company.memberships.filter(
        is_active=True,
        role='staff'  # Only staff members
    ).values_list('user_id', flat=True)
    
    # Exclude current user
    eligible_staff = User.objects.filter(
        id__in=company_user_ids
    ).exclude(id=user.id).select_related('profile')
    
    # Filter for approved profiles only
    eligible_staff = [
        user for user in eligible_staff 
        if hasattr(user, 'profile') and user.profile.is_approved
    ]
    
    serializer = self.get_serializer(eligible_staff, many=True)
    return Response(serializer.data)
```

**Endpoint**: `GET /api/v1/users/eligible_for_transfer/`

**Mobile Update** - TransferShiftModal.tsx line 64:
```typescript
const response = await api.get<{results: StaffMember[]}>('/api/v1/users/eligible_for_transfer/');
```

#### Option 2: Modify UserViewSet Permission Logic

Update `get_queryset()` to allow staff to see other staff in their company:

```python
def get_queryset(self):
    user = self.request.user
    
    # Get user's company (now includes staff role)
    membership = user.company_memberships.filter(
        is_active=True
    ).select_related('company').first()
    
    if not membership:
        return User.objects.filter(id=user.id)
    
    company = membership.company
    
    if user.role in ['admin', 'manager']:
        # Admins/managers see all company users
        company_user_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)
        return User.objects.filter(id__in=company_user_ids)
    
    elif user.role == 'staff':
        # Staff see other staff in their company (for shift transfers)
        company_user_ids = company.memberships.filter(
            is_active=True,
            role='staff'  # Only staff members
        ).values_list('user_id', flat=True)
        return User.objects.filter(id__in=company_user_ids)
    
    # Default: only see own user
    return User.objects.filter(id=user.id)
```

**Pros**: No new endpoint needed, works with existing mobile/web code
**Cons**: Exposes more user data to staff role, may have privacy implications

#### Option 3: Add Query Parameter for Eligible Staff

Keep strict filtering but add optional query parameter:

```python
def get_queryset(self):
    user = self.request.user
    
    # Check for eligible_for_transfer query parameter
    if self.request.query_params.get('eligible_for_transfer') == 'true':
        return self.get_eligible_staff_queryset(user)
    
    # Existing logic...
    if user.role in ['admin', 'manager']:
        # ...
    
    return User.objects.filter(id=user.id)

def get_eligible_staff_queryset(self, user):
    """Get staff eligible for shift transfers"""
    membership = user.company_memberships.filter(
        is_active=True
    ).select_related('company').first()
    
    if not membership:
        return User.objects.filter(id=user.id)
    
    company = membership.company
    company_user_ids = company.memberships.filter(
        is_active=True,
        role='staff'
    ).values_list('user_id', flat=True)
    
    return User.objects.filter(id__in=company_user_ids).exclude(id=user.id)
```

**Mobile Update** - TransferShiftModal.tsx line 64:
```typescript
const response = await api.get<{results: StaffMember[]}>('/api/v1/users/?eligible_for_transfer=true');
```

### Additional Fixes Required

#### 1. Fix Staff Dropdown Endpoint - Add Company Filtering

**backend/api/views.py:351-380** - Update staff_users() action:

```python
@action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
def staff(self, request):
    """Get all staff users for dropdowns/selection"""
    if request.user.role not in ['admin', 'manager']:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Get user's company
    company = self.get_user_company(request)
    if not company:
        return Response({'error': 'No company context'}, status=400)
    
    # Filter staff by company membership
    company_user_ids = company.memberships.filter(
        is_active=True,
        role='staff'
    ).values_list('user_id', flat=True)
    
    staff_users = User.objects.filter(
        id__in=company_user_ids
    ).select_related('profile')
    
    # Rest of existing logic...
```

#### 2. Add Company Validation to Shift Transfer Models

**backend/api/models.py** - Update ShiftExchange.clean():

```python
def clean(self):
    # Existing validations...
    
    # NEW: Validate same company membership
    original_company = self.original_shift.venue.company
    
    target_membership = self.target_user.company_memberships.filter(
        company=original_company,
        is_active=True
    ).exists()
    
    if not target_membership:
        raise ValueError(
            f"Target user must be a member of {original_company.name} to receive this shift"
        )
```

**backend/api/models.py** - Update OpenShiftRequest.get_available_shifts():

```python
@classmethod
def get_available_shifts(cls, staff_user):
    """Get all open shifts that a staff member is qualified for IN THEIR COMPANY"""
    # Get user's companies
    user_companies = staff_user.company_memberships.filter(
        is_active=True
    ).values_list('company_id', flat=True)
    
    # Get open requests for shifts at venues in user's companies
    open_requests = cls.objects.filter(
        status='open',
        original_shift__venue__company_id__in=user_companies
    ).exclude(requesting_user=staff_user)
    
    # Rest of existing logic...
```

### Testing Recommendations

#### Test Case 1: Staff User Sees Company Staff
- **Setup**: James44 (staff) logged into Mead Security
- **Action**: Open transfer shift modal
- **Expected**: See list of other Mead Security staff members
- **Current**: Empty list (❌)
- **After Fix**: List of 5+ staff members (✅)

#### Test Case 2: Staff Cannot See Other Company Staff
- **Setup**: James44 (staff) in Company A, John (staff) in Company B
- **Action**: James44 opens transfer shift modal
- **Expected**: John should NOT appear in list
- **Verification**: Company-based filtering working

#### Test Case 3: Shift Transfer Cross-Company Prevention
- **Setup**: Shift belongs to Company A, target user in Company B
- **Action**: Attempt to create exchange
- **Expected**: Validation error "Target user must be a member of Company A"
- **Verification**: Company validation working

#### Test Case 4: Available Shifts Company Filtering
- **Setup**: Open shifts in Company A and Company B
- **Action**: James44 (Company A staff) views available shifts
- **Expected**: Only Company A shifts visible
- **Verification**: Available shifts properly filtered

### Impact Assessment

#### Affected Components

**Mobile App:**
- ✅ TransferShiftModal.tsx - Already implemented correctly, just needs backend fix
- ✅ ReleaseShiftModal.tsx - Works (no staff selection needed)
- ✅ AvailableShiftsScreen.tsx - Needs company filtering in backend
- ✅ ShiftExchangesScreen.tsx - Works (shows user's own exchanges)

**Backend API:**
- ❌ UserViewSet.get_queryset() - **Needs fix** for staff role
- ❌ UserViewSet.staff_users() - **Needs fix** for company filtering
- ❌ OpenShiftRequest.get_available_shifts() - **Needs fix** for company filtering
- ❌ ShiftExchange.clean() - **Needs enhancement** for company validation
- ❌ OpenShiftRequest.clean() - **Needs enhancement** for company validation

**Web Frontend:**
- ❌ shiftService.ts - Same issue as mobile
- ❌ ShiftExchange.tsx - Same issue as mobile

### Implementation Priority

**Phase 1 (Critical - Unblocks Feature):**
1. Create `/api/v1/users/eligible_for_transfer/` endpoint (Option 1)
2. Update mobile TransferShiftModal.tsx to use new endpoint
3. Update web shiftService.ts to use new endpoint

**Phase 2 (Important - Data Isolation):**
1. Fix UserViewSet.staff_users() company filtering
2. Add company validation to ShiftExchange.clean()
3. Add company validation to OpenShiftRequest.clean()
4. Update OpenShiftRequest.get_available_shifts() with company filtering

**Phase 3 (Enhancement - Testing):**
1. Add comprehensive test suite for company isolation
2. Add test suite for shift transfer validation
3. Add integration tests for mobile app transfer flows

### Recommended Solution

**Use Option 1: Create Dedicated Endpoint**

This is the recommended approach because:
1. **Least Breaking**: Doesn't change existing API behavior
2. **Most Secure**: Purpose-built for shift transfers with explicit permissions
3. **Most Flexible**: Can add additional filtering logic (qualifications, availability) later
4. **Clear Intent**: Endpoint name clearly indicates its purpose
5. **Easy Testing**: Dedicated endpoint is easier to test in isolation

### File References

**Backend:**
- `backend/api/views.py:267-289` - UserViewSet.get_queryset() staff restriction
- `backend/api/views.py:351-380` - UserViewSet.staff_users() no company filtering
- `backend/api/views.py:630-656` - StaffProfileViewSet.get_queryset() staff restriction
- `backend/api/views.py:255-265` - get_user_company() helper method
- `backend/api/models.py:407-528` - UserCompanyMembership model
- `backend/api/models.py:2310-2334` - ShiftExchange.clean() validation
- `backend/api/models.py:1576-1595` - OpenShiftRequest.get_available_shifts()

**Mobile:**
- `mobile/src/components/modals/TransferShiftModal.tsx:64` - Staff fetch endpoint
- `mobile/src/screens/shifts/AvailableShiftsScreen.tsx` - Available shifts screen
- `mobile/src/services/exchangeService.ts` - Exchange service implementation

**Web:**
- `security-staff-portal/src/services/shiftService.ts:676` - Staff profiles fetch
- `security-staff-portal/src/pages/staff/ShiftExchange.tsx` - Exchange UI

### Conclusion

The root cause is a backend permission design that prevents staff users from viewing other staff members for privacy and security reasons. However, this design conflicts with the shift transfer feature requirement. 

The recommended solution is to create a dedicated `/api/v1/users/eligible_for_transfer/` endpoint that provides controlled access to company staff specifically for shift transfer purposes, maintaining security while enabling the required functionality.

This fix will unblock both the mobile and web shift transfer features while maintaining proper multi-tenant data isolation.
