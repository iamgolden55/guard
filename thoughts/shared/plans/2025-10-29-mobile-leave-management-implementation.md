---
date: 2025-10-29T23:00:00Z
created_by: Claude Code
repository: remix2
issue: "Add Leave Management to Mobile App"
tags: [implementation, plan, mobile, leave-management, react-native, profile]
status: in_progress
priority: high
---

# Implementation Plan: Mobile Leave Management

**Date**: 2025-10-29T23:00:00Z
**Created By**: Claude Code
**Repository**: remix2

## Overview

Add comprehensive leave management functionality to the mobile app, enabling staff to request leave, view balances, and manage their leave history directly from their mobile devices.

## Current State

### ✅ What Exists

**Backend**:
- Complete leave management API at `/api/v1/leave/`
- Full CRUD operations for leave requests
- Leave balance calculations and tracking
- Leave type and policy management
- Approval workflow system

**Web Frontend**:
- Comprehensive leave management with 35+ components
- Leave request forms, balance display, history tables
- Calendar views and analytics
- Full integration with backend APIs

**Mobile App**:
- Profile page with Wise-inspired design
- Action item pattern established
- Modal navigation for sub-features
- Existing API service structure

### ❌ What's Missing

**Mobile App**:
- Leave request functionality
- Leave balance display
- Leave history viewing
- Leave status tracking
- Integration with profile page

## Implementation Strategy

### Phase 1: Foundation (Services & State) ✓

#### 1.1 Create Leave Service (`mobile/src/services/leaveService.ts`)

API methods needed:
```typescript
// Leave Types
getLeaveTypes(): Promise<LeaveType[]>

// Leave Balances
getMyBalances(): Promise<LeaveBalance[]>

// Leave Requests
createLeaveRequest(data: LeaveRequestFormData): Promise<LeaveRequest>
getMyLeaveRequests(filters?: FilterOptions): Promise<LeaveRequest[]>
cancelLeaveRequest(id: number): Promise<void>

// Calendar
getLeaveCalendar(month: string): Promise<LeaveCalendarEvent[]>
```

**Backend API Endpoints to Use**:
- `GET /api/v1/leave/types/` - Get leave types
- `GET /api/v1/leave/balances/my_balances/` - Get user balances
- `POST /api/v1/leave/requests/` - Create leave request
- `GET /api/v1/leave/requests/my_requests/` - Get user requests
- `DELETE /api/v1/leave/requests/{id}/cancel/` - Cancel request
- `GET /api/v1/leave/calendar/` - Get calendar events

#### 1.2 Create Redux Slice (`mobile/src/store/slices/leaveSlice.ts`)

State structure:
```typescript
interface LeaveState {
  // Leave Types
  leaveTypes: LeaveType[];
  leaveTypesLoading: boolean;

  // Balances
  balances: LeaveBalance[];
  balancesLoading: boolean;

  // Requests
  requests: LeaveRequest[];
  requestsLoading: boolean;

  // Calendar
  calendarEvents: LeaveCalendarEvent[];
  selectedMonth: string;

  // UI State
  error: string | null;
  successMessage: string | null;
}
```

Actions needed:
- `fetchLeaveTypes()`
- `fetchBalances()`
- `fetchRequests()`
- `createRequest()`
- `cancelRequest()`
- `fetchCalendar()`

#### 1.3 TypeScript Types (`mobile/src/types/leave.types.ts`)

```typescript
interface LeaveType {
  id: number;
  name: string;
  code: string;
  color_code: string;
  requires_documentation: boolean;
}

interface LeaveBalance {
  id: number;
  leave_type: LeaveType;
  available_balance: number;
  used_balance: number;
  total_entitlement: number;
  pending_balance: number;
}

interface LeaveRequest {
  id: number;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  supporting_document?: string;
  created_at: string;
}

interface LeaveRequestFormData {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  supporting_document?: string;
}
```

### Phase 2: UI Components ✓

#### 2.1 LeaveBalanceScreen (`mobile/src/screens/leave/LeaveBalanceScreen.tsx`)

**Design**: Wise-inspired card-based layout

```
[Header: "Leave Balance"]
  └─ [Close button]

[Scroll View]
  ├─ [Balance Card - Annual Leave]
  │   ├─ Icon Circle (blue)
  │   ├─ Leave Type Name
  │   ├─ Available: X days
  │   ├─ Progress Bar (used vs total)
  │   └─ Details: Used X / Total Y
  │
  ├─ [Balance Card - Sick Leave]
  │   └─ Same structure
  │
  └─ [Balance Card - Other Types]
      └─ Same structure

[Footer]
  └─ [Request Leave Button]
```

**Features**:
- Color-coded cards per leave type
- Visual progress bars
- Pending requests indication
- Pull-to-refresh
- Loading states

#### 2.2 LeaveRequestScreen (`mobile/src/screens/leave/LeaveRequestScreen.tsx`)

**Design**: Multi-step form

```
[Header: "Request Leave"]
  └─ [Cancel button]

[Form Scroll View]
  ├─ [Leave Type Selector]
  │   └─ Dropdown with color indicators
  │
  ├─ [Date Range Selector]
  │   ├─ Start Date Picker
  │   └─ End Date Picker
  │
  ├─ [Days Calculation Display]
  │   └─ "X working days"
  │
  ├─ [Balance Check Display]
  │   └─ Available: Y days
  │
  ├─ [Reason Text Input]
  │   └─ Multi-line (150 char max)
  │
  └─ [Document Upload] (if required)
       └─ Photo picker

[Footer]
  ├─ [Cancel Button]
  └─ [Submit Button]
```

**Features**:
- Real-time balance validation
- Working days calculation
- Document upload for specific types
- Form validation
- Success/error feedback
- Offline queue support

#### 2.3 LeaveHistoryScreen (`mobile/src/screens/leave/LeaveHistoryScreen.tsx`)

**Design**: List with filters

```
[Header: "Leave History"]
  └─ [Close button]

[Filter Bar]
  ├─ [Status Filter: All/Pending/Approved/Denied]
  └─ [Year Selector]

[List View]
  ├─ [Request Card]
  │   ├─ Header: Leave Type + Status Badge
  │   ├─ Date Range
  │   ├─ Days: X days
  │   ├─ Reason (truncated)
  │   └─ Actions: [View Details] [Cancel]
  │
  └─ [More Request Cards...]

[Empty State]
  └─ "No leave requests yet"
```

**Features**:
- Status filtering
- Expandable request details
- Cancel pending requests
- Status badges (color-coded)
- Pull-to-refresh
- Pagination/infinite scroll

#### 2.4 LeaveRequestDetailScreen (`mobile/src/screens/leave/LeaveRequestDetailScreen.tsx`)

**Design**: Full request details

```
[Header: Leave Type Name]
  └─ [Close button]

[Status Badge]
  └─ PENDING/APPROVED/DENIED

[Details Scroll View]
  ├─ [Info Section]
  │   ├─ Dates: Start - End
  │   ├─ Duration: X days
  │   └─ Submitted: Date
  │
  ├─ [Reason Section]
  │   └─ Full reason text
  │
  ├─ [Document Section] (if exists)
  │   └─ Supporting document image/file
  │
  └─ [Approval Info] (if processed)
      ├─ Approved/Denied by: Manager name
      ├─ Date processed
      └─ Manager notes (if any)

[Footer Actions]
  └─ [Cancel Request] (if pending)
```

### Phase 3: Profile Integration ✓

#### 3.1 Add Leave Actions to ProfileScreen

Add new action items in the "Quick Actions" section:

```typescript
{
  title: 'Leave Balance',
  description: 'View available leave days',
  icon: 'calendar',
  color: colors.primary,
  onPress: () => navigation.navigate('LeaveBalance'),
},
{
  title: 'Request Leave',
  description: 'Submit a leave request',
  icon: 'add-circle',
  color: colors.success,
  onPress: () => navigation.navigate('LeaveRequest'),
},
{
  title: 'Leave History',
  description: 'View past and pending requests',
  icon: 'time',
  color: colors.warning,
  onPress: () => navigation.navigate('LeaveHistory'),
}
```

**Position**: After "Virtual ID Card", before account section

#### 3.2 Leave Summary Widget (Optional Enhancement)

Add a compact leave balance widget at the top of profile:

```
[Leave Balance Widget]
  ├─ Annual: 12 days
  ├─ Sick: 5 days
  └─ [View All →]
```

### Phase 4: Navigation Setup ✓

#### 4.1 Update Navigation Types (`mobile/src/types/navigation.ts`)

Add to `MainStackParamList`:
```typescript
LeaveBalance: undefined;
LeaveRequest: undefined;
LeaveHistory: undefined;
LeaveRequestDetail: { requestId: number };
```

#### 4.2 Update MainNavigator (`mobile/src/navigation/MainNavigator.tsx`)

Add screen definitions:
```typescript
<Stack.Screen
  name="LeaveBalance"
  component={LeaveBalanceScreen}
  options={{
    presentation: 'modal',
    headerTitle: 'Leave Balance'
  }}
/>
<Stack.Screen
  name="LeaveRequest"
  component={LeaveRequestScreen}
  options={{
    presentation: 'modal',
    headerTitle: 'Request Leave'
  }}
/>
// ... similar for other screens
```

### Phase 5: Offline Support ✓

#### 5.1 Queue Leave Requests Offline

Similar to shift check-in, queue leave requests when offline:

```typescript
// In leaveService.ts
async createLeaveRequest(data: LeaveRequestFormData) {
  try {
    const response = await apiService.post('/api/v1/leave/requests/', data);
    return response;
  } catch (error) {
    if (error instanceof NetworkError) {
      // Queue for later sync
      await queueService.addToQueue({
        type: 'CREATE_LEAVE_REQUEST',
        data,
        endpoint: '/api/v1/leave/requests/',
        method: 'POST'
      });
      // Return optimistic response
      return { status: 'PENDING_SYNC', ...data };
    }
    throw error;
  }
}
```

#### 5.2 Sync Queue Integration

- Add leave request actions to sync queue types
- Display pending sync status in leave history
- Show sync status indicator in list items

### Phase 6: Notifications (Future Enhancement)

#### 6.1 Leave Request Status Notifications

- Push notification when request approved/denied
- Deep link to LeaveRequestDetail screen
- Badge count for pending actions

#### 6.2 Leave Balance Alerts

- Low balance warnings
- Expiring leave notifications

## Design System Consistency

### Colors

Match existing Wise-inspired mobile theme:
- Primary actions: `colors.primary` (#0061FF)
- Success/Approved: `colors.success` (#22C55E)
- Warning/Pending: `colors.warning` (#F59E0B)
- Error/Denied: `colors.error` (#EF4444)
- Cancelled: `colors.gray[500]`

### Typography

- Screen headings: 32px, weight 900
- Section titles: 13px, weight 700, uppercase
- Action titles: 17px, weight 600
- Body text: 15px, secondary color

### Spacing

Use consistent 8-point grid:
- Card padding: `spacing.lg` (20px)
- Section margins: `spacing.xl` (24px)
- Item gaps: `spacing.base` (16px)

### Components

- Action items: Icon circle (48x48) + content + chevron
- Cards: Rounded 12-16px, subtle shadow
- Status badges: Pill-shaped, color + icon
- Buttons: Primary (blue) and secondary (gray) variants

## Backend API Mapping

### Endpoints Used

| Feature | Method | Endpoint | Purpose |
|---------|--------|----------|---------|
| Leave Types | GET | `/api/v1/leave/types/` | Get available leave types |
| My Balances | GET | `/api/v1/leave/balances/my_balances/` | Get user's leave balances |
| Create Request | POST | `/api/v1/leave/requests/` | Submit new leave request |
| My Requests | GET | `/api/v1/leave/requests/my_requests/` | Get user's requests |
| Request Detail | GET | `/api/v1/leave/requests/{id}/` | Get single request |
| Cancel Request | POST | `/api/v1/leave/requests/{id}/cancel/` | Cancel pending request |
| Leave Calendar | GET | `/api/v1/leave/calendar/` | Get calendar events |

### Request/Response Examples

**Create Leave Request**:
```json
POST /api/v1/leave/requests/
{
  "leave_type_id": 1,
  "start_date": "2025-11-01",
  "end_date": "2025-11-05",
  "reason": "Family vacation",
  "supporting_document": "base64_encoded_file" // optional
}

Response: {
  "id": 123,
  "leave_type": { "id": 1, "name": "Annual Leave" },
  "start_date": "2025-11-01",
  "end_date": "2025-11-05",
  "total_days": 5,
  "status": "PENDING",
  "reason": "Family vacation",
  "created_at": "2025-10-29T23:00:00Z"
}
```

**Get My Balances**:
```json
GET /api/v1/leave/balances/my_balances/

Response: [
  {
    "id": 1,
    "leave_type": {
      "id": 1,
      "name": "Annual Leave",
      "code": "ANNUAL",
      "color_code": "#0066FF"
    },
    "available_balance": 12.0,
    "used_balance": 8.0,
    "total_entitlement": 20.0,
    "pending_balance": 3.0
  }
]
```

## Testing Strategy

### Manual Testing Scenarios

1. **Leave Request Flow**
   - Open leave balance from profile
   - Navigate to request form
   - Select leave type
   - Choose dates
   - Enter reason
   - Submit request
   - Verify appears in history

2. **Balance Display**
   - View all leave balances
   - Verify calculations
   - Check progress bars
   - Test pull-to-refresh

3. **Request Management**
   - View request details
   - Cancel pending request
   - Filter by status
   - View approved/denied requests

4. **Offline Behavior**
   - Submit request offline
   - Verify queued status
   - Check sync after reconnection

5. **Error Handling**
   - Invalid date range
   - Insufficient balance
   - Network errors
   - Validation errors

### Automated Tests (Future)

- Redux action tests
- Service layer tests
- Component rendering tests
- Navigation flow tests

## Implementation Order

1. ✓ **Phase 1**: Services & State (Day 1)
   - [ ] Create leaveService.ts
   - [ ] Create leaveSlice.ts
   - [ ] Add leave.types.ts
   - [ ] Test API integration

2. ✓ **Phase 2**: Core Screens (Day 2-3)
   - [ ] LeaveBalanceScreen
   - [ ] LeaveRequestScreen
   - [ ] LeaveHistoryScreen
   - [ ] LeaveRequestDetailScreen

3. ✓ **Phase 3**: Profile Integration (Day 3)
   - [ ] Add action items to ProfileScreen
   - [ ] Update navigation types
   - [ ] Configure routes

4. ✓ **Phase 4**: Polish & Testing (Day 4)
   - [ ] Offline support
   - [ ] Error handling
   - [ ] Loading states
   - [ ] Pull-to-refresh
   - [ ] Success feedback

5. ⏳ **Future Enhancements**
   - [ ] Leave balance widget
   - [ ] Push notifications
   - [ ] Calendar view
   - [ ] Manager approval (mobile)

## Success Criteria

- [ ] Staff can view leave balances from profile
- [ ] Staff can submit leave requests with all required data
- [ ] Staff can view leave request history with status
- [ ] Staff can cancel pending leave requests
- [ ] Requests work offline and sync when online
- [ ] UI matches existing Wise-inspired design
- [ ] All backend APIs integrate correctly
- [ ] Error messages are clear and helpful
- [ ] Loading states provide good UX

## File Structure

```
mobile/src/
├── services/
│   └── leaveService.ts              [NEW]
├── store/slices/
│   └── leaveSlice.ts                [NEW]
├── types/
│   └── leave.types.ts               [NEW]
│   └── navigation.ts                [MODIFY]
├── screens/
│   ├── leave/                       [NEW DIRECTORY]
│   │   ├── LeaveBalanceScreen.tsx
│   │   ├── LeaveRequestScreen.tsx
│   │   ├── LeaveHistoryScreen.tsx
│   │   └── LeaveRequestDetailScreen.tsx
│   └── profile/
│       └── ProfileScreen.tsx        [MODIFY]
└── navigation/
    └── MainNavigator.tsx            [MODIFY]
```

## Dependencies

- ✅ Existing: `@react-navigation/native`
- ✅ Existing: `@reduxjs/toolkit`
- ✅ Existing: `react-native-datepicker` (for date selection)
- ✅ Existing: `expo-document-picker` (for document upload)
- ✅ Existing: API service layer
- ✅ Existing: Offline queue system

No new dependencies required!

## Notes

- Design must match existing Wise-inspired minimalist style
- Reuse existing components (Container, Button, etc.)
- Follow established patterns (action items, modal screens)
- Integrate with existing offline queue system
- Maintain consistency with shift management UX
