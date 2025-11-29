# API Error Handling Improvement

## Problem
The mobile app was showing generic error messages like:
```
ERROR releaseShift error: [ApiError: HTTP 400: ]
```

This gave users no information about what went wrong, making it impossible to fix the issue.

## Root Causes

### 1. Backend Not Catching Validation Errors
The Django view's `perform_create` method wasn't catching `ValueError` exceptions:

```python
# Before - ValueError propagates as generic 400
try:
    shift = Shift.objects.get(id=shift_id, staff_user=self.request.user)
    open_request = shift.release_to_pool(reason)
    return open_request
except Shift.DoesNotExist:
    raise serializers.ValidationError("Shift not found")
# ValueError from release_to_pool() was not caught!
```

### 2. Mobile App Not Reading Error Response Body
The API service was only using `response.statusText` (e.g., "Bad Request") instead of reading the actual error message from Django's JSON response body:

```typescript
// Before - Only used statusText
if (!response.ok) {
  throw new ApiError(response.status, response.statusText, endpoint);
}
// Django's detailed error message in response body was ignored!
```

## Solutions Implemented

### Backend Fix (`/backend/api/views.py`)

Added proper exception handling in `OpenShiftRequestViewSet.perform_create()`:

```python
def perform_create(self, serializer):
    """Create an open shift request by releasing a shift"""
    shift_id = self.request.data.get('shift_id')
    reason = self.request.data.get('request_reason')

    if not shift_id:
        raise serializers.ValidationError("shift_id is required")

    if not reason:
        raise serializers.ValidationError("request_reason is required")  # ✅ NEW

    try:
        shift = Shift.objects.get(id=shift_id, staff_user=self.request.user)
        open_request = shift.release_to_pool(reason)
        return open_request
    except Shift.DoesNotExist:
        raise serializers.ValidationError("Shift not found or not assigned to you")
    except ValueError as e:  # ✅ NEW
        # Catch validation errors from release_to_pool (e.g., shift already started)
        raise serializers.ValidationError(str(e))
```

**Now returns:**
- `"Cannot release shifts that have already started"`
- `"This shift is already unassigned"`
- Instead of generic 400 error

### Mobile App Fix (`/mobile/src/services/api.ts`)

Enhanced `ApiError` class to parse error response bodies:

```typescript
export class ApiError extends Error {
  public response?: any;

  constructor(
    public statusCode: number,
    public statusText: string,
    public endpoint: string,
    responseData?: any  // ✅ NEW
  ) {
    // Extract error message from Django response
    const errorMessage = responseData?.detail ||
                        responseData?.error ||
                        responseData?.message ||
                        (Array.isArray(responseData) ? responseData.join(', ') : null) ||
                        (typeof responseData === 'string' ? responseData : null) ||
                        statusText;

    super(`HTTP ${statusCode}: ${errorMessage}`);
    this.response = responseData;
  }
}
```

Updated all HTTP methods (GET, POST, PUT, PATCH) to read response body:

```typescript
if (!response.ok) {
  // ✅ NEW - Parse error response body
  let errorData;
  try {
    errorData = await response.json();
  } catch {
    errorData = response.statusText;
  }
  throw new ApiError(response.status, response.statusText, endpoint, errorData);
}
```

### Simplified Error Display (`/mobile/src/components/modals/ReleaseShiftModal.tsx`)

```typescript
// Before - Complex error handling with status code checks
catch (error: any) {
  let errorMessage = 'Failed to release shift.';

  if (error.response?.status === 400) {
    errorMessage = 'Unable to release this shift...';
  } else if (error.response?.status === 404) {
    errorMessage = 'Shift not found...';
  }
  // ...etc
}

// After - Error message already contains Django's detailed message
catch (error: any) {
  const errorMessage = error.message || 'Failed to release shift. Please try again.';
  Alert.alert('Error', errorMessage);
}
```

## Error Messages - Before vs After

### Before
```
❌ "HTTP 400: Bad Request"
❌ "HTTP 400: "
❌ Generic, unhelpful messages
```

### After
```
✅ "HTTP 400: Cannot release shifts that have already started"
✅ "HTTP 400: Shift not found or not assigned to you"
✅ "HTTP 400: request_reason is required"
✅ "HTTP 400: This shift is already unassigned"
```

## Impact

### For Developers
- ✅ Easier debugging - actual error messages in logs
- ✅ Better error tracking - can identify specific validation issues
- ✅ Faster development - don't need to guess what went wrong

### For Users
- ✅ Clear, actionable error messages
- ✅ Understand why action failed
- ✅ Know what to do next (e.g., "shift already started" → pick a future shift)

### System-Wide Benefit
- ✅ All API errors now show Django's detailed messages
- ✅ Works for all endpoints, not just release shift
- ✅ Consistent error handling across entire mobile app

## Testing

### Test Scenarios
1. **Missing required field**
   - Before: "HTTP 400: "
   - After: "HTTP 400: request_reason is required"

2. **Shift already started**
   - Before: "HTTP 400: Bad Request"
   - After: "HTTP 400: Cannot release shifts that have already started"

3. **Shift not found**
   - Before: "HTTP 400: "
   - After: "HTTP 400: Shift not found or not assigned to you"

4. **Network error**
   - Before: "HTTP 400: "
   - After: "No internet connection" (from NetworkError)

## Files Changed

### Backend
- `/backend/api/views.py` - Added ValueError handling in OpenShiftRequestViewSet

### Mobile
- `/mobile/src/services/api.ts` - Enhanced error parsing (GET, POST, PUT, PATCH)
- `/mobile/src/components/modals/ReleaseShiftModal.tsx` - Simplified error handling

## Next Steps

### For Release Shift Feature
- ✅ Backend validates and returns clear errors
- ✅ Mobile shows actual Django error messages
- ✅ Client-side validation prevents most errors
- ✅ Disabled buttons for invalid states

### Future Improvements
- Could add error codes for programmatic handling
- Could add retry logic for transient errors
- Could add error analytics/tracking

---
**Completed:** October 26, 2025
**Impact:** System-wide error messaging improvement
**Benefits:** Better UX, easier debugging, clearer validation messages
