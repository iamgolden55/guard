# Context Summary: Manual Checkout and Adjust Time Bug Fixes

## Date: January 21, 2026
## Branch: main-bethel

---

## Overview

Fixed two bugs in the Approvals page related to shift management:
1. **Adjust Time Error**: Frontend calling non-existent function
2. **Manual Check-out 500 Error**: Backend using wrong model field names + missing validation

---

## Bug 1: Adjust Time Error

### Symptom
Clicking "Adjust Time" button on incomplete shifts threw error: `shiftService.getShift is not a function`

### Root Cause
The `Approvals.tsx` component was calling `shiftService.getShift()` which doesn't exist. The correct function is `getShiftById()`.

### File Modified
**`frontend/src/pages/manager/Approvals.tsx`** - Line 598

### Change
```javascript
// Before
const fullShift = await shiftService.getShift(incompleteShift.id);

// After
const fullShift = await shiftService.getShiftById(incompleteShift.id);
```

### Related Context
- `shiftService` is defined in `frontend/src/services/shiftService.ts`
- `getShiftById(shiftId: number)` is at line 437 of shiftService.ts
- The `handleAdjustTimes` callback is defined around line 595-605 in Approvals.tsx

---

## Bug 2: Manual Check-out 500 Error

### Symptom
Manual check-out failed with 500 error: "Check-out time must be after check-in time"

### Root Causes
1. **Wrong field names**: Backend code used non-existent model fields (`check_in_signature`, `check_out_signature`)
2. **Missing validation**: No check if shift was checked-in before allowing checkout

### File Modified
**`backend/shifts/views.py`**

### Shift Model Signature Fields (Important Reference)
The Shift model in `backend/api/models.py` uses these field names:
```python
start_signature = models.TextField()    # For check-in signature
end_signature = models.TextField()      # For check-out signature
manager_signature = models.TextField()  # For manager approval
```

**NOT** `check_in_signature` or `check_out_signature` - these don't exist!

### Changes Made

#### 1. `manual_checkin` action (~line 621)
```python
# Before
shift.check_in_signature = manager_signature

# After
shift.start_signature = manager_signature
```

#### 2. `manual_checkout` action (~line 686)
```python
# Before
shift.check_out_signature = manager_signature

# After
shift.end_signature = manager_signature
```

#### 3. `force_complete` action (~lines 773-774)
```python
# Before
shift.check_in_signature = manager_signature
shift.check_out_signature = manager_signature

# After
shift.start_signature = manager_signature
shift.end_signature = manager_signature
```

#### 4. Added validation in `manual_checkout` (lines 672-677)
```python
# Ensure shift has been checked in before allowing checkout
if not shift.check_in_time:
    return Response(
        {"detail": "Shift must be checked in before manual check-out"},
        status=status.HTTP_400_BAD_REQUEST
    )
```

---

## Key Files Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `frontend/src/pages/manager/Approvals.tsx` | Manager approvals page with incomplete shifts handling | ~595-605: handleAdjustTimes callback |
| `frontend/src/services/shiftService.ts` | Shift API service layer | 437: getShiftById function |
| `backend/shifts/views.py` | Shift ViewSet with manual actions | ~600-640: manual_checkin, ~650-710: manual_checkout, ~740-790: force_complete |
| `backend/api/models.py` | Shift model definition | Contains start_signature, end_signature, manager_signature fields |

---

## ShiftViewSet Actions in `backend/shifts/views.py`

The ShiftViewSet has these custom actions for manager interventions:

1. **`manual_checkin`** (~line 580-639)
   - Allows managers to check-in a shift on behalf of staff
   - Requires: manager_signature, optional checkin_time
   - Sets: check_in_time, status='in_progress', start_signature

2. **`manual_checkout`** (~line 641-715)
   - Allows managers to check-out a shift on behalf of staff
   - Requires: manager_signature, shift must already be checked-in
   - Optional: checkout_time, actual_hours
   - Sets: check_out_time, status='completed', end_signature

3. **`force_complete`** (~line 717-795)
   - Force completes a shift regardless of current state
   - Requires: manager_signature, actual_hours
   - Optional: checkin_time, checkout_time
   - Sets both start_signature and end_signature

---

## Approvals.tsx Component Structure

Key state and handlers related to shift management:

```typescript
// State for time adjustment dialog
const [showAdjustTimeDialog, setShowAdjustTimeDialog] = useState(false);
const [selectedShiftForAdjustment, setSelectedShiftForAdjustment] = useState<Shift | null>(null);

// Handler that was fixed
const handleAdjustTimes = useCallback(async (incompleteShift: IncompleteShift) => {
  const fullShift = await shiftService.getShiftById(incompleteShift.id);
  setSelectedShiftForAdjustment(fullShift as Shift);
  setShowAdjustTimeDialog(true);
}, []);
```

---

## Potential Similar Issues to Watch For

1. **Other signature field references**: Search for `check_in_signature` or `check_out_signature` in backend code - these are wrong field names
2. **Other shiftService function calls**: Verify function names match what's exported from shiftService.ts
3. **Missing validation**: Other manual actions might need similar pre-condition checks

---

## Testing Verification

1. **Adjust Time**: Click "Adjust Time" button → Should open dialog without error
2. **Manual Check-out (with check-in)**: Should succeed and complete the shift
3. **Manual Check-out (without check-in)**: Should return 400 with "Shift must be checked in before manual check-out"

---

## Commands for Future Debugging

```bash
# Find signature field usage in backend
grep -rn "signature" backend/shifts/views.py

# Find all shiftService function calls in frontend
grep -rn "shiftService\." frontend/src/

# Check Shift model fields
grep -n "signature" backend/api/models.py
```
