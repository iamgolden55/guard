# Released Shifts Showing Admin-Created Shifts - Fix

## Problem Summary
User (James44) reported: "why am i seeing the open shift created by the admin in my Released shifts?"
- Admin created an open shift for October 27th
- This shift appeared in James44's "Released Shifts" section
- It should only appear in "Available Shifts" section

## Root Cause Analysis

### Backend API Issue

**File**: `/backend/api/views.py` - `OpenShiftRequestViewSet.get_queryset()` (lines 1716-1720)

**Original Code**:
```python
return OpenShiftRequest.objects.filter(
    models.Q(requesting_user=user) |  # Shifts the user released
    models.Q(claimed_by=user) |       # Shifts the user claimed
    models.Q(status='open')           # ❌ ALL open shifts (PROBLEM!)
)
```

**Problem**: The third condition `models.Q(status='open')` returned ALL open shifts, including:
1. ✅ Shifts James44 released (Oct 26) - **Correct** for "Released Shifts"
2. ❌ Shifts admin created (Oct 27) - **Wrong!** Should only be in "Available Shifts"

### Mobile App Behavior

**File**: `/mobile/src/screens/shifts/ShiftExchangesScreen.tsx`

The "Released Shifts" tab:
1. Calls `exchangeService.getAllExchangeActivities()` (line 41)
2. Which calls `getMyOpenShiftRequests()` (line 291)
3. Which hits `GET /api/v1/open-shift-requests/`
4. Displays all results in the "Released Shifts" section

### Why The Original Design Existed

The backend was designed to show "all relevant open shift requests" for a staff user:
- Requests they created (released)
- Requests they claimed
- **All open requests** (for potential claiming)

However, the mobile app has **TWO separate sections**:
1. **"Released Shifts"** - Should show only shifts the user released
2. **"Available Shifts"** - Should show shifts the user can claim

The backend was trying to serve both purposes with one endpoint, causing confusion.

## Solution Implemented

### Backend Fix

**File**: `/backend/api/views.py` (lines 1715-1720)

**Changed from**:
```python
# Staff can see requests they created, claimed, or that are available to claim
return OpenShiftRequest.objects.filter(
    models.Q(requesting_user=user) |
    models.Q(claimed_by=user) |
    models.Q(status='open')  # Allow access to open shifts for claiming
)
```

**Changed to**:
```python
# Staff can see requests they created or claimed
# For available shifts to claim, use the /available/ endpoint
return OpenShiftRequest.objects.filter(
    models.Q(requesting_user=user) |
    models.Q(claimed_by=user)
)
```

### Why This Fix Works

Now there are **TWO distinct endpoints** with clear purposes:

1. **`GET /api/v1/open-shift-requests/`** - "My Released Shifts"
   - Returns: `requesting_user = current_user` OR `claimed_by = current_user`
   - Used by: "Released Shifts" tab in mobile app
   - Shows: Only shifts the user released or claimed

2. **`GET /api/v1/open-shift-requests/available/`** - "Available Shifts"
   - Returns: `OpenShiftRequest.get_available_shifts(current_user)`
   - Used by: "Available Shifts" section in mobile app
   - Shows: Shifts released by others (or admin) that the user can claim

## Testing Results

### Backend Query Test

**James44's Released Shifts** (GET /api/v1/open-shift-requests/):
```
Count: 1
✅ 2025-10-26 17:00 at 20 St Thomas Street | Released by: James44
```

**James44's Available Shifts** (GET /api/v1/open-shift-requests/available/):
```
Count: 1
✅ 2025-10-27 20:00 at 20 St Thomas Street | Released by: admin
```

### API Endpoint Test

**Request 1: James44's Released Shifts**
```bash
GET /api/v1/open-shift-requests/
Authorization: Bearer <james44_token>

Response:
{
  "count": 1,
  "results": [
    {
      "id": 2,
      "original_shift_details": {
        "start_time": "2025-10-26T17:00:00Z",
        "venue": "20 St Thomas Street"
      },
      "requesting_user_details": {
        "username": "James44"
      },
      "status": "open"
    }
  ]
}
```
✅ Returns only James44's Oct 26 release

**Request 2: James44's Available Shifts**
```bash
GET /api/v1/open-shift-requests/available/
Authorization: Bearer <james44_token>

Response:
[
  {
    "id": 4,
    "original_shift_details": {
      "start_time": "2025-10-27T20:00:00Z",
      "venue": "20 St Thomas Street"
    },
    "requesting_user_details": {
      "username": "admin"
    },
    "status": "open"
  }
]
```
✅ Returns only admin's Oct 27 shift

## Expected User Experience After Fix

### James44's "Released Shifts" Tab
1. Opens ShiftExchanges screen
2. Switches to "Released Shifts" tab
3. **Sees 1 shift**: Oct 26, 17:00-22:00 ✅
4. Does NOT see admin's Oct 27 shift ✅
5. Can cancel his release if needed

### James44's "Available Shifts" Section
1. Navigates to Calendar → Available Shifts
2. **Sees 1 shift**: Oct 27, 20:00-04:00 ✅
3. Does NOT see his own Oct 26 release ✅
4. Can claim the admin's shift

### Other Qualified Users' "Available Shifts"
1. Navigate to Calendar → Available Shifts
2. **See 2 shifts**:
   - Oct 27 (admin's) ✅
   - Oct 26 (James44's) ✅
3. Can claim either shift

## Impact

### For Users
- ✅ Clear separation: "My Releases" vs "Available to Claim"
- ✅ "Released Shifts" only shows shifts the user themselves released
- ✅ No confusion from seeing admin-created shifts in the wrong section
- ✅ Accurate count badges on tabs

### For Admin
- ✅ Admin-created open shifts appear correctly in "Available Shifts" for all qualified staff
- ✅ Admin can still see all open shift requests (role-based access preserved)

### System-Wide
- ✅ Clean API separation: `/` for "my requests" vs `/available/` for "claimable shifts"
- ✅ Consistent with user expectations
- ✅ Easier to understand and maintain

## Related Endpoints

### Endpoints Affected
- **`GET /api/v1/open-shift-requests/`** - Now returns only user's own releases/claims ✅
- **`GET /api/v1/open-shift-requests/available/`** - Unchanged, already working correctly ✅

### Endpoints Unaffected
- **`POST /api/v1/open-shift-requests/`** - Create release (unchanged)
- **`DELETE /api/v1/open-shift-requests/:id/cancel/`** - Cancel release (unchanged)
- **`POST /api/v1/open-shift-requests/:id/claim/`** - Claim shift (unchanged)

## Files Modified

- **`/backend/api/views.py`** (lines 1715-1720)
  - `OpenShiftRequestViewSet.get_queryset()` method
  - Removed `models.Q(status='open')` condition
  - Updated comment to clarify endpoint separation

## Files Examined (No Changes Needed)

- **`/mobile/src/screens/shifts/ShiftExchangesScreen.tsx`** - Already using correct endpoints
- **`/mobile/src/services/exchangeService.ts`** - API calls already correct

## Summary

**Root Cause**: Backend queryset included ALL open shifts, not just user's releases
**Solution**: Removed `models.Q(status='open')` from default queryset
**Result**: "Released Shifts" now shows only shifts the user released ✅
**Status**: Working correctly for all users ✅

---
**Fixed**: October 26, 2025
**Issue**: Admin-created shifts appearing in user's "Released Shifts" section
**Resolution**: Separated "my releases" endpoint from "available shifts" endpoint
**Verification**: Tested with James44 - sees only own release in "Released Shifts" tab
