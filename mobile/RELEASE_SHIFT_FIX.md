# Release Shift 400 Error Fix

## Issue
User reported HTTP 400 error when attempting to release a shift:
```
ERROR releaseShift error: [ApiError: HTTP 400: ]
```

## Root Cause
**Shift Already Started** - Backend validation prevents releasing shifts that have already begun.

### Backend Validation (Django)
```python
def release_to_pool(self, reason):
    """Release this shift to the open shift pool"""
    if self.start_time <= timezone.now():
        raise ValueError("Cannot release shifts that have already started")  # ← 400 Error

    if not self.staff_user:
        raise ValueError("This shift is already unassigned")
```

The backend's `perform_create` method in `OpenShiftRequestViewSet` doesn't catch `ValueError`, so it propagates up and Django REST Framework converts it to HTTP 400.

## Solution

### 1. Client-Side Validation (ReleaseShiftModal.tsx)
Added pre-submission validation to check if shift has started:

```typescript
const handleSubmit = async () => {
  if (!shift) return;

  // Client-side validation: Check if shift has already started
  const shiftStartTime = new Date(shift.start_time);
  const now = new Date();

  if (shiftStartTime <= now) {
    Alert.alert(
      'Cannot Release Shift',
      'This shift has already started and cannot be released to the pool.'
    );
    return;
  }

  // ... rest of submission logic
}
```

### 2. Improved Error Messages
Enhanced error handling to provide more specific messages based on HTTP status:

```typescript
catch (error: any) {
  let errorMessage = 'Failed to release shift. Please try again.';

  if (error.message) {
    errorMessage = error.message;
  } else if (error.response?.status === 400) {
    errorMessage = 'Unable to release this shift. It may have already started, been released, or you may not have permission.';
  } else if (error.response?.status === 404) {
    errorMessage = 'Shift not found or not assigned to you.';
  } else if (error.response?.status === 403) {
    errorMessage = 'You do not have permission to release this shift.';
  }

  Alert.alert('Error', errorMessage);
}
```

### 3. Disabled Buttons for Started Shifts (ShiftDetailsScreen.tsx)
Prevent users from even attempting to release/transfer shifts that have started:

```typescript
// Check if shift has already started
const hasShiftStarted = () => {
  const startTime = new Date(shift.start_time);
  const now = new Date();
  return startTime <= now;
};

// Apply to Transfer button
<TouchableOpacity
  style={[
    styles.secondaryActionButton,
    hasShiftStarted() && styles.secondaryActionButtonDisabled
  ]}
  onPress={() => {
    if (hasShiftStarted()) {
      Alert.alert(
        'Cannot Transfer',
        'This shift has already started and cannot be transferred.'
      );
      return;
    }
    setShowTransferModal(true);
  }}
  disabled={hasShiftStarted()}
>

// Apply to Release button
<TouchableOpacity
  style={[
    styles.secondaryActionButton,
    hasShiftStarted() && styles.secondaryActionButtonDisabled
  ]}
  onPress={() => {
    if (hasShiftStarted()) {
      Alert.alert(
        'Cannot Release',
        'This shift has already started and cannot be released to the pool.'
      );
      return;
    }
    setShowReleaseModal(true);
  }}
  disabled={hasShiftStarted()}
>
```

### 4. Visual Feedback for Disabled State
Added styles to show buttons are disabled:

```typescript
secondaryActionButtonDisabled: {
  opacity: 0.5,
  backgroundColor: colors.gray[100],
  borderColor: colors.gray[300],
},
secondaryActionTextDisabled: {
  color: colors.gray[400],
},
```

## Files Modified

### Backend
1. **`/backend/api/views.py`** (OpenShiftRequestViewSet)
   - Added `ValueError` exception handling to catch validation errors
   - Added validation for `request_reason` field
   - Now returns proper error messages instead of generic 400

### Mobile App
2. **`/mobile/src/services/api.ts`**
   - Enhanced `ApiError` class to parse response body and extract error messages
   - Updated GET, POST, PUT, PATCH methods to read error response JSON
   - Error messages now show actual Django validation errors

3. **`/mobile/src/components/modals/ReleaseShiftModal.tsx`**
   - Added client-side validation for shift start time
   - Simplified error handling (now uses Django error messages)

4. **`/mobile/src/screens/shifts/ShiftDetailsScreen.tsx`**
   - Added `hasShiftStarted()` helper function
   - Disabled Transfer and Release buttons for started shifts
   - Added alert messages when users try to interact with disabled buttons
   - Added visual styles for disabled state

## Prevention Flow

### Before Fix
1. User taps "Release" on a started shift
2. Modal opens
3. User enters reason and submits
4. Backend validates and returns 400
5. Generic error shown

### After Fix
1. User views shift details
2. **Transfer/Release buttons are grayed out if shift started**
3. If user taps: Alert shown immediately
4. If user somehow bypasses: Modal validates before submission
5. If still bypasses: Enhanced error message from backend

## Backend API

### Endpoint
```
POST /api/v1/open-shift-requests/
```

### Expected Payload
```json
{
  "shift_id": 123,
  "request_reason": "Personal emergency"
}
```

### Validation Rules
- ✅ Shift must not have started (`start_time > now`)
- ✅ Shift must be assigned to requesting user
- ✅ User must be authenticated
- ✅ Reason must be provided

### Error Responses
- **400**: Shift has started, already released, or validation failed
- **403**: User doesn't have permission
- **404**: Shift not found or not assigned to user

## Testing

### Test Scenarios
- [ ] View upcoming shift → Transfer/Release buttons enabled
- [ ] View started shift → Transfer/Release buttons disabled (grayed out)
- [ ] Tap disabled Release button → Alert shown immediately
- [ ] Try to release upcoming shift → Success
- [ ] Try to release started shift (if bypassed UI) → Validation catches it

### Expected Behavior
1. **Future shifts**: Buttons enabled, can transfer/release
2. **Started shifts**: Buttons disabled, alert on tap
3. **API validation**: Clear error messages if backend validation fails

## Impact
- ✅ Prevents user frustration from unclear 400 errors
- ✅ Provides immediate feedback via disabled buttons
- ✅ Validates on client before API call
- ✅ Better error messages if validation fails
- ✅ Consistent UX for Transfer and Release actions

---
**Fixed:** October 26, 2025
**Issue Type:** Missing client-side validation and unclear error handling
**Resolution:** Multi-layer validation with disabled UI states and enhanced error messages
