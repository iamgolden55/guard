# Leave Request `days_requested` Field Fix

**Date:** 2025-10-04
**Status:** ✅ FIXED AND TESTED
**Issue:** Leave request submissions failing with 400 Bad Request error

## Problem Summary

The frontend leave request form was calculating working days correctly but not sending the `days_requested` field to the backend, causing validation failures because the backend `LeaveRequest` model requires this field.

## Root Cause

1. **TypeScript Interface Missing Field**: `LeaveRequestFormData` didn't include `days_requested`
2. **Form Submission Missing Field**: `handleSubmit` wasn't including calculated working days
3. **Service Missing Field**: `createLeaveRequest()` and `updateLeaveRequest()` weren't appending `days_requested` to FormData

## Solution Implemented

### 1. Updated TypeScript Interface
**File:** `frontend/src/types/leave.ts:177`
```typescript
export interface LeaveRequestFormData {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;  // ✅ ADDED
  reason: string;
  supporting_documents?: File[];
}
```

### 2. Updated Form Submission
**File:** `frontend/src/components/LeaveRequestForm.tsx:196`
```typescript
const requestData: LeaveRequestFormData = {
  leave_type_id: values.leave_type_id,
  start_date: values.start_date,
  end_date: values.end_date,
  days_requested: workingDays,  // ✅ ADDED
  reason: values.reason,
  supporting_documents: files
};
```

### 3. Updated Service Methods
**File:** `frontend/src/services/leaveService.ts`

**createLeaveRequest (line 306):**
```typescript
formData.append('days_requested', requestData.days_requested.toString());  // ✅ ADDED
```

**updateLeaveRequest (line 387-389):**
```typescript
if (requestData.days_requested !== undefined) {  // ✅ ADDED
  formData.append('days_requested', requestData.days_requested.toString());
}
```

### 4. Additional Fixes

**Trailing Slash Fix** - Added trailing slashes to all API endpoints to prevent Django APPEND_SLASH errors:
```typescript
const LEAVE_ENDPOINTS = {
  LEAVE_REQUESTS: '/leave/requests/',  // ✅ Added trailing slash
  // ... other endpoints
}
```

**Working Days Calculation** - Implemented client-side calculation to avoid calling non-existent backend endpoint:
```typescript
// Calculates business days (Mon-Fri) between dates
const calculateWorkingDays = useCallback((startDate: string, endDate: string) => {
  // Count weekdays excluding Saturday and Sunday
  // ...
}, []);
```

## Test Results

### API Test (curl)
```bash
$ curl -X POST http://localhost:8000/api/v1/leave/requests/ \
  -F "leave_type_id=1" \
  -F "start_date=2025-10-15" \
  -F "end_date=2025-10-17" \
  -F "days_requested=3" \
  -F "reason=Test"

{
  "message": "Leave request submitted successfully",
  "leave_request": {
    "id": 51,
    "days_requested": "3.00",  ✅
    "start_date": "2025-10-15",
    "end_date": "2025-10-17",
    "status": "draft"
  }
}
```

### Database Verification
```python
>>> latest_request = LeaveRequest.objects.latest('created_at')
>>> latest_request.days_requested
Decimal('3.00')  ✅
```

### Frontend Integration
- ✅ Form displays working days: "Working Days: 23"
- ✅ Submission includes `days_requested` field
- ✅ No more 400 Bad Request errors for missing field
- ✅ TypeScript compilation successful with no type errors

## Known Issues (Unrelated)

1. **Submit Action Bug**: The `/submit/` endpoint has a backend implementation bug where `LeaveEntitlement.add_pending()` method is missing. This is unrelated to the `days_requested` fix and needs separate backend model updates.

2. **Validation Endpoint**: The `/validate/` and `/calculate-days/` endpoints referenced in the frontend are not implemented in the backend. These have been commented out and validation now happens server-side during submission.

## Files Modified

```
frontend/src/types/leave.ts
frontend/src/components/LeaveRequestForm.tsx
frontend/src/services/leaveService.ts
```

## Testing Checklist

- [x] TypeScript compilation passes
- [x] API accepts `days_requested` field
- [x] Database stores value correctly
- [x] Form calculates working days
- [x] Form submits without 400 error
- [x] Created request appears in database
- [x] Trailing slash issue resolved
- [x] No console errors for missing API endpoints

## Conclusion

The `days_requested` field is now properly integrated throughout the entire stack from frontend form → TypeScript interface → API service → Django backend → database. Leave requests can be successfully created and will include the calculated working days.
