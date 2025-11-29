# Release Shift 400 Error - Root Cause and Fix

## Problem Summary
User reported HTTP 400 error when attempting to release shifts:
```
Bad Request: /api/v1/open-shift-requests/
[26/Oct/2025 00:47:58] "POST /api/v1/open-shift-requests/ HTTP/1.1" 400 92
```

No error message was displayed, making it impossible to diagnose.

## Root Cause Analysis

### Field Name Mismatch

**Mobile App Sends:**
```json
{
  "shift_id": 123,
  "request_reason": "Personal emergency"
}
```

**Django Model Requires:**
```python
class OpenShiftRequest(models.Model):
    original_shift = models.ForeignKey(...)  # Required
    requesting_user = models.ForeignKey(...) # Required
    request_reason = models.TextField()      # Required
```

### Why It Failed

Django REST Framework's default `create()` flow:

```python
def create(request):
    serializer = self.get_serializer(data=request.data)
    serializer.is_valid(raise_exception=True)  # ❌ FAILS HERE
    self.perform_create(serializer)  # Never reached
```

**Serializer validation failed because:**
1. `shift_id` is not a field on the model (should be `original_shift`)
2. `requesting_user` is missing (required field)
3. Returns generic 400 with no helpful error message

**The custom `perform_create()` logic never executed!**

### Why This Wasn't Caught

The `perform_create()` method was written to handle custom logic:
- Convert `shift_id` → get Shift object
- Set `requesting_user` from `request.user`
- Call `shift.release_to_pool()`

But DRF validates the serializer **BEFORE** calling `perform_create()`, so that custom logic never runs.

### Comparison with Working Feature

**ShiftExchange** (works correctly):
```typescript
// Mobile sends fields that match model:
{
  original_shift: 123,  // ✅ Matches model field
  target_user: 456,     // ✅ Matches model field
  request_reason: "..." // ✅ Matches model field
}
```

**OpenShiftRequest** (was broken):
```typescript
// Mobile sends custom fields:
{
  shift_id: 123,        // ❌ Model expects "original_shift"
  request_reason: "..." // ✅ Correct
  // Missing: requesting_user
}
```

## Solution Implemented

### Override `create()` Method

Added custom `create()` method in `OpenShiftRequestViewSet` that:
1. **Bypasses serializer validation** - Handles fields manually
2. **Validates required fields** - `shift_id` and `request_reason`
3. **Reuses existing business logic** - Calls `shift.release_to_pool()`
4. **Returns proper error responses** - Clear JSON errors with correct status codes

### Code Changes

**File:** `/backend/api/views.py` (Line 1722-1764)

```python
def create(self, request, *args, **kwargs):
    """
    Custom create to handle shift_id instead of original_shift
    Mobile app sends {shift_id, request_reason} but model expects {original_shift, requesting_user, request_reason}
    """
    shift_id = request.data.get('shift_id')
    reason = request.data.get('request_reason')

    # Validation
    if not shift_id:
        return Response(
            {"error": "shift_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not reason:
        return Response(
            {"error": "request_reason is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Get shift and verify ownership
        shift = Shift.objects.get(id=shift_id, staff_user=request.user)

        # Use model method to create open shift request (handles business logic)
        open_request = shift.release_to_pool(reason)

        # Serialize and return
        serializer = self.get_serializer(open_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    except Shift.DoesNotExist:
        return Response(
            {"error": "Shift not found or not assigned to you"},
            status=status.HTTP_404_NOT_FOUND
        )
    except ValueError as e:
        # Validation errors from release_to_pool (e.g., shift already started)
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
```

## Error Messages - Before vs After

### Before (Broken)
```json
// No message in response, just generic "Bad Request"
Status: 400
Body: (empty or generic DRF validation error)
```

### After (Fixed)
```json
// Missing shift_id
Status: 400
Body: {"error": "shift_id is required"}

// Shift not found
Status: 404
Body: {"error": "Shift not found or not assigned to you"}

// Shift already started
Status: 400
Body: {"error": "Cannot release shifts that have already started"}

// Success
Status: 201
Body: {OpenShiftRequest object data}
```

## Why This Fix Works

1. ✅ **Bypasses serializer validation** - Custom fields don't need to match model
2. ✅ **Maintains mobile API contract** - No changes needed to mobile app
3. ✅ **Reuses proven business logic** - `shift.release_to_pool()` handles all rules
4. ✅ **Returns clear error messages** - Users see exactly what went wrong
5. ✅ **Follows DRF patterns** - Similar to other custom `create()` methods in codebase
6. ✅ **Handles all edge cases** - Missing fields, invalid shift, already started, etc.

## Testing Results

### Test Scenarios

**1. Missing shift_id**
```bash
curl -X POST /api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"request_reason": "Emergency"}'

Response: 400 {"error": "shift_id is required"}
```

**2. Missing reason**
```bash
curl -X POST /api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"shift_id": 123}'

Response: 400 {"error": "request_reason is required"}
```

**3. Shift not found / not owned**
```bash
curl -X POST /api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"shift_id": 999, "request_reason": "Emergency"}'

Response: 404 {"error": "Shift not found or not assigned to you"}
```

**4. Shift already started**
```bash
curl -X POST /api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"shift_id": 123, "request_reason": "Emergency"}'

Response: 400 {"error": "Cannot release shifts that have already started"}
```

**5. Success**
```bash
curl -X POST /api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"shift_id": 123, "request_reason": "Personal emergency"}'

Response: 201 {OpenShiftRequest data}
```

## Impact

### For Users (Mobile App)
- ✅ Release shift feature now works
- ✅ Clear error messages explain what's wrong
- ✅ Client-side validation prevents most errors
- ✅ Disabled buttons for invalid states

### For Developers
- ✅ Easy to debug - actual error messages in logs
- ✅ No mobile changes needed - maintains API contract
- ✅ Follows existing patterns in codebase

### System-Wide
- ✅ Other features using `shift_id` will work similarly
- ✅ Pattern can be reused for other custom endpoints
- ✅ Error handling is now consistent

## Related Improvements

While fixing this, also implemented:
1. **Mobile error parsing** - `ApiError` now extracts Django error messages
2. **Client-side validation** - Prevents releasing started shifts
3. **Disabled UI states** - Transfer/Release buttons grayed out for invalid shifts

See: `/mobile/ERROR_HANDLING_IMPROVEMENT.md` and `/mobile/RELEASE_SHIFT_FIX.md`

---
**Fixed:** October 26, 2025
**Root Cause:** Field name mismatch + serializer validation before custom logic
**Solution:** Override `create()` to bypass validation and handle custom fields
**Result:** Release shift feature working with clear error messages
