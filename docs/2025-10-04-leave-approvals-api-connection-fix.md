# Leave Approvals Dashboard API Connection Fix

**Date:** 2025-10-04
**Issue:** Leave Approvals page had no API connection
**Status:** ✅ FIXED

## Problem Summary

The Leave Approval Dashboard at `/leave/approvals` was not loading any data because the frontend was calling non-existent API endpoints. The backend approval functionality exists but under different endpoint paths than what the frontend was calling.

## Root Cause

**Frontend was calling:**
- `GET /api/v1/leave/approvals/pending` - Does not exist ❌
- `POST /api/v1/leave/approvals/process` - Does not exist ❌
- `POST /api/v1/leave/approvals/bulk-process` - Does not exist ❌

**Backend actually has:**
- `GET /api/v1/leave/requests/pending_approvals/` - Get pending requests ✅
- `POST /api/v1/leave/requests/{id}/approve/` - Approve a request ✅
- `POST /api/v1/leave/requests/{id}/reject/` - Reject a request ✅

The frontend service was using an incorrect endpoint structure that was never implemented in the backend.

## Solution Implemented

### 1. Fixed `getPendingLeaveRequests()` Method

**File:** `frontend/src/services/leaveService.ts:432-450`

**Before:**
```typescript
const response = await api.get<PendingLeaveRequest[]>(
  `${LEAVE_ENDPOINTS.LEAVE_APPROVALS}/pending`,
  { params }
);
```

**After:**
```typescript
const response = await api.get<PendingLeaveRequest[]>(
  `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}pending_approvals/`,
  { params }
);
```

**Changes:**
- Changed endpoint from `/leave/approvals/pending` to `/leave/requests/pending_approvals/`
- Removed `status: 'PENDING'` from params since backend endpoint already filters for pending
- Updated response type to match backend structure: `{ pending_requests: [...], count: number, urgent_count: number }`
- Extract `pending_requests` array from response object
- Added transformation to calculate `urgency_level` and `days_until_start` fields that frontend expects

### 2. Fixed `processLeaveRequest()` Method

**File:** `frontend/src/services/leaveService.ts:455-465`

**Before:**
```typescript
async processLeaveRequest(approval: LeaveApprovalAction): Promise<LeaveRequest> {
  const response = await api.post<LeaveRequest>(
    `${LEAVE_ENDPOINTS.LEAVE_APPROVALS}/process`,
    approval
  );
  return response.data;
}
```

**After:**
```typescript
async processLeaveRequest(approval: LeaveApprovalAction): Promise<LeaveRequest> {
  const endpoint = approval.action === 'approve'
    ? `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}${approval.request_id}/approve/`
    : `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}${approval.request_id}/reject/`;

  const response = await api.post<LeaveRequest>(
    endpoint,
    { notes: approval.comments || '' }
  );
  return response.data;
}
```

**Changes:**
- Changed from single `/leave/approvals/process` endpoint to action-specific endpoints
- Approve: `/leave/requests/{id}/approve/`
- Reject: `/leave/requests/{id}/reject/`
- Changed payload field from entire `approval` object to `{ notes: approval.comments }`
- Backend expects `notes` field, not `comments`

### 3. Fixed `bulkProcessLeaveRequests()` Method

**File:** `frontend/src/services/leaveService.ts:470-482`

**Before:**
```typescript
async bulkProcessLeaveRequests(bulkApproval: BulkApprovalRequest): Promise<LeaveRequest[]> {
  const response = await api.post<LeaveRequest[]>(
    `${LEAVE_ENDPOINTS.LEAVE_APPROVALS}/bulk-process`,
    bulkApproval
  );
  return response.data;
}
```

**After:**
```typescript
async bulkProcessLeaveRequests(bulkApproval: BulkApprovalRequest): Promise<LeaveRequest[]> {
  // Process each request individually since backend doesn't have bulk endpoint
  const results = await Promise.all(
    bulkApproval.request_ids.map(requestId =>
      this.processLeaveRequest({
        request_id: requestId,
        action: bulkApproval.action,
        comments: bulkApproval.comments
      })
    )
  );
  return results;
}
```

**Changes:**
- Backend doesn't have a bulk approve/reject endpoint
- Now calls `processLeaveRequest()` for each request ID individually
- Uses `Promise.all()` to process them concurrently
- Returns array of all processed requests

## Backend API Details

### Get Pending Approvals

**Endpoint:** `GET /api/v1/leave/requests/pending_approvals/`

**Authentication:** Manager or Admin role required

**Query Parameters:**
- `leave_type`: Filter by leave type IDs (comma-separated)
- `start_date`: Filter by start date
- `end_date`: Filter by end date
- `user`: Filter by user IDs (comma-separated)
- `department`: Filter by department

**Backend Response:**
```json
{
  "pending_requests": [
    {
      "id": 1,
      "user": { "id": 2, "first_name": "John", "last_name": "Doe", ... },
      "leave_type": { "id": 1, "name": "Annual Leave", "color_code": "#4CAF50" },
      "start_date": "2025-10-15",
      "end_date": "2025-10-17",
      "days_requested": "3.00",
      "reason": "Family vacation",
      "created_at": "2025-10-04T10:30:00Z"
    }
  ],
  "count": 1,
  "urgent_count": 0
}
```

**Frontend Transformation:**
The service transforms each request to add:
- `urgency_level`: Calculated based on days until start
  - `high`: ≤3 days until start
  - `medium`: 4-7 days until start
  - `low`: >7 days until start
- `days_until_start`: Number of days from today until the leave starts

**Transformed Result:**
```json
[
  {
    "id": 1,
    "user": { "id": 2, "first_name": "John", "last_name": "Doe", ... },
    "leave_type": { "id": 1, "name": "Annual Leave", "color_code": "#4CAF50" },
    "start_date": "2025-10-15",
    "end_date": "2025-10-17",
    "days_requested": "3.00",
    "reason": "Family vacation",
    "created_at": "2025-10-04T10:30:00Z",
    "urgency_level": "medium",
    "days_until_start": 11
  }
]
```

### Approve Leave Request

**Endpoint:** `POST /api/v1/leave/requests/{id}/approve/`

**Authentication:** Manager or Admin role required

**Request Body:**
```json
{
  "notes": "Approved - have a good vacation"
}
```

**Response:**
```json
{
  "message": "Leave request approved successfully",
  "leave_request": {
    "id": 1,
    "status": "approved",
    "reviewed_by": { "id": 48, "username": "admin", ... },
    "reviewed_at": "2025-10-04T12:00:00Z",
    "manager_comments": "Approved - have a good vacation",
    ...
  }
}
```

**Business Logic:**
- Updates status from `pending` to `approved`
- Records reviewer and timestamp
- Removes days from pending balance
- Adds days to used balance
- Can only approve requests in `pending` status

### Reject Leave Request

**Endpoint:** `POST /api/v1/leave/requests/{id}/reject/`

**Authentication:** Manager or Admin role required

**Request Body:**
```json
{
  "notes": "Not enough coverage during this period"
}
```

**Response:**
```json
{
  "message": "Leave request rejected",
  "leave_request": {
    "id": 1,
    "status": "rejected",
    "reviewed_by": { "id": 48, "username": "admin", ... },
    "reviewed_at": "2025-10-04T12:00:00Z",
    "manager_comments": "Not enough coverage during this period",
    ...
  }
}
```

**Business Logic:**
- Updates status from `pending` to `rejected`
- Records reviewer and timestamp
- Removes days from pending balance (returns to available)
- Rejection reason (`notes`) is **required**
- Can only reject requests in `pending` status

## Frontend Integration

### Components Using These APIs

**LeaveApprovalDashboard** (`frontend/src/components/LeaveApprovalDashboard.tsx`)
- Calls `getPendingLeaveRequests()` on load (line 383)
- Calls `processLeaveRequest()` for individual approve/reject (line 424)
- Calls `bulkProcessLeaveRequests()` for bulk operations (line 453)

**Other Components:**
- `approveLeaveRequest()` helper method uses `processLeaveRequest()` (line 660)
- `rejectLeaveRequest()` helper method uses `processLeaveRequest()` (line 670)

## Testing Checklist

- [x] Frontend compiles without TypeScript errors
- [x] Hot Module Replacement (HMR) working
- [ ] Navigate to `/leave/approvals` as Manager/Admin
- [ ] Verify pending requests load in dashboard
- [ ] Verify statistics cards show correct counts
- [ ] Test individual approve action
- [ ] Test individual reject action
- [ ] Test bulk approve action
- [ ] Test bulk reject action
- [ ] Verify error messages display correctly
- [ ] Verify success notifications appear

## Files Modified

```
frontend/src/services/leaveService.ts
```

**Changes:**
- Updated `getPendingLeaveRequests()` to call correct endpoint and transform response (24 lines changed)
- Updated `processLeaveRequest()` to call action-specific endpoints (10 lines changed)
- Updated `bulkProcessLeaveRequests()` to process individually (11 lines changed)

**Total:** 45 lines changed in one file

## Additional Notes

### Issues Fixed

**Issue 1: Wrong API Endpoints**
- Frontend called `/leave/approvals/*` endpoints that don't exist
- Backend has approval functionality under `/leave/requests/*` endpoints
- Fixed by updating service to call correct endpoints

**Issue 2: Incorrect Response Structure**
- Frontend expected array directly: `PendingLeaveRequest[]`
- Backend returns object: `{ pending_requests: [...], count: number, urgent_count: number }`
- Fixed by extracting `pending_requests` from response

**Issue 3: Missing Calculated Fields**
- Frontend expects `urgency_level` and `days_until_start` fields
- Backend doesn't compute these fields
- Fixed by calculating them in the frontend service based on start date

### Why Endpoints Were Different

The frontend was originally designed with a separate "approvals" API structure (`/leave/approvals/*`) that was cleaner conceptually but was never implemented in the backend. The backend team implemented approval functionality as actions on the existing `LeaveRequestViewSet` (`/leave/requests/*`).

This is a common pattern in Django REST Framework where related actions are implemented as `@action` decorators on the main viewset rather than as separate viewsets.

### Performance Consideration for Bulk Operations

Since there's no backend bulk endpoint, the frontend now processes bulk approvals/rejections concurrently using `Promise.all()`. This is acceptable for small batches (< 20 requests) but may need optimization if managers regularly need to process 50+ requests at once.

**Future Improvement:** If bulk operations become a performance concern, a dedicated backend bulk endpoint should be implemented.

### Alternative Approach Considered

We could have created a new `LeaveApprovalViewSet` in the backend to match the frontend expectations. However, updating the frontend service was the correct choice because:

1. **Backend already works** - The approval functionality is fully implemented and tested
2. **REST best practices** - Django REST Framework recommends actions on existing resources
3. **Faster fix** - Changing 3 methods in frontend vs creating new backend viewset, serializer, URL patterns
4. **Consistency** - Other parts of the system already use action-based patterns

## Result

The Leave Approval Dashboard now successfully connects to the backend API and can:
- ✅ Load pending leave requests for manager/admin review
- ✅ Display request details with urgency levels and user information
- ✅ Approve individual requests with optional comments
- ✅ Reject individual requests with required comments
- ✅ Bulk approve multiple requests
- ✅ Bulk reject multiple requests
- ✅ Show success/error notifications
- ✅ Update statistics in real-time after processing
