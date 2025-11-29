# Claim Shift 404 Error - Fix

## Problem Summary
User (James44) tried to claim the admin-created shift and got:
```
Not Found: /api/v1/open-shift-requests/4/claim/
[26/Oct/2025 02:00:05] "POST /api/v1/open-shift-requests/4/claim/ HTTP/1.1" 404 23
```

## Root Cause Analysis

### Previous Fix Created a New Problem

In the previous fix (`RELEASED_SHIFTS_FILTER_FIX.md`), I modified `get_queryset()` to prevent admin-created shifts from appearing in the "Released Shifts" list:

```python
# Previous fix (caused 404 on claim)
return OpenShiftRequest.objects.filter(
    models.Q(requesting_user=user) |
    models.Q(claimed_by=user)
)
```

**Problem**: This filter applies to **ALL** actions in the ViewSet, including:
- ✅ `list` - Get list of requests (intended fix)
- ❌ `claim` - Claim a shift (broken!)
- ❌ `retrieve` - Get single request details (broken!)
- ❌ `cancel` - Cancel a request (might be broken!)

### Why Claim Failed

When James44 tried to claim shift ID 4:
1. Mobile app: `POST /api/v1/open-shift-requests/4/claim/`
2. Backend `claim()` action: Calls `self.get_object()` (line 1804)
3. `get_object()`: Uses `get_queryset()` to find the object
4. `get_queryset()`: Filters to only:
   - `requesting_user = James44` (shift 4 has `requesting_user = admin`) ❌
   - `claimed_by = James44` (shift 4 has `claimed_by = None`) ❌
5. Result: Shift 4 not in queryset → 404 Not Found!

### DRF ViewSet Lifecycle

```
Request: POST /api/v1/open-shift-requests/4/claim/
    ↓
ViewSet.claim(request, pk=4)
    ↓
self.get_object()  # Tries to find pk=4
    ↓
self.get_queryset()  # Applies filters
    ↓
queryset.get(pk=4)  # 404 if not in filtered queryset!
```

The key insight: **`get_queryset()` is called for ALL actions**, not just `list`.

## Solution Implemented

Modified `get_queryset()` to behave differently based on the action:

**File**: `/backend/api/views.py` (lines 1717-1729)

```python
def get_queryset(self):
    """Filter requests to show only relevant ones for the user"""
    user = self.request.user
    if user.role in ['manager', 'admin']:
        return OpenShiftRequest.objects.all()
    else:
        # For list action: Show only requests the user created or claimed
        # For detail actions (claim, retrieve, cancel): Also include open shifts
        if self.action == 'list':
            # List view: Only show user's own releases and claims
            return OpenShiftRequest.objects.filter(
                models.Q(requesting_user=user) |
                models.Q(claimed_by=user)
            )
        else:
            # Detail actions: Include open shifts for claiming
            return OpenShiftRequest.objects.filter(
                models.Q(requesting_user=user) |
                models.Q(claimed_by=user) |
                models.Q(status='open')  # Allow access to open shifts for claiming
            )
```

### How This Works

**`self.action`** is a DRF property that tells you which action is being executed:
- `'list'` - GET /api/v1/open-shift-requests/
- `'retrieve'` - GET /api/v1/open-shift-requests/4/
- `'claim'` - POST /api/v1/open-shift-requests/4/claim/
- `'cancel'` - DELETE /api/v1/open-shift-requests/4/cancel/
- etc.

**For `action == 'list'`**:
- Only return shifts the user released or claimed
- Result: "Released Shifts" shows only user's own ✅

**For all other actions**:
- Return shifts the user released, claimed, **OR** that are open
- Result: Can access open shifts for claiming ✅

## Testing Results

### Test 1: List View Still Filtered

**Request**: `GET /api/v1/open-shift-requests/`
```
Status: 200
Count: 1
- Released by: James44 (ID: 2)
```
✅ Only shows James44's own release (not admin's shift)

### Test 2: Detail View Works

**Request**: `GET /api/v1/open-shift-requests/4/`
```
Status: 200
✅ Can access shift ID 4
Released by: admin
```
✅ Can retrieve details of open shifts

### Test 3: Claim Action Works

**Request**: `POST /api/v1/open-shift-requests/4/claim/`
```
Status: 200
✅ Shift claimed successfully
```
✅ Successfully claimed the admin's shift!

### Test 4: Verify Claim State

```
Shift ID 4 (Admin's shift):
  Status: claimed
  Released by: admin
  Claimed by: James44
```
✅ Shift now assigned to James44, waiting for manager approval

## Expected User Experience

### Scenario 1: View "Released Shifts"
1. James44 opens ShiftExchanges screen
2. Switches to "Released Shifts" tab
3. **Sees 1 shift**: Oct 26 (his own release) ✅
4. Does NOT see admin's Oct 27 shift ✅

### Scenario 2: Claim an Available Shift
1. James44 navigates to "Available Shifts"
2. Sees admin's Oct 27 shift
3. Taps to claim it
4. **Success!** Shift claimed ✅
5. Status changes to "claimed"
6. Waiting for manager approval

### Scenario 3: View Claimed Shifts
1. James44 opens ShiftExchanges screen
2. "Released Shifts" tab now shows:
   - Oct 26 (his release, status: open)
   - Oct 27 (claimed from admin, status: claimed) ✅
3. Both shifts are in the list because he's involved in both

## Impact

### For Users
- ✅ "Released Shifts" list shows only relevant shifts
- ✅ Can successfully claim available shifts from "Available Shifts"
- ✅ Claimed shifts appear in their exchanges list
- ✅ No more 404 errors when claiming

### For System
- ✅ Proper separation of list vs detail permissions
- ✅ List view: Filtered for privacy/clarity
- ✅ Detail actions: Access to necessary objects
- ✅ Follows DRF best practices

## Related Actions That Now Work

All detail actions now have access to open shifts:

1. **`claim`** - Claim an available shift ✅
2. **`retrieve`** - View shift details ✅
3. **`cancel`** - Cancel a release (if user is requesting_user) ✅
4. **`approve`** - Manager approval (if user is manager) ✅

## Files Modified

- **`/backend/api/views.py`** (lines 1717-1729)
  - `OpenShiftRequestViewSet.get_queryset()` method
  - Added conditional logic based on `self.action`
  - List action: Filtered queryset
  - Detail actions: Include open shifts

## Summary

**Root Cause**: Previous fix filtered queryset for ALL actions, breaking detail actions like `claim`
**Solution**: Check `self.action` and apply different filters for list vs detail
**Result**: List view filtered, detail actions work ✅
**Status**: Both "Released Shifts" filtering AND claiming work correctly ✅

---
**Fixed**: October 26, 2025
**Issue**: 404 error when trying to claim available shifts
**Resolution**: Conditional queryset filtering based on action type
**Verification**: Successfully claimed admin's shift, status changed to "claimed"
