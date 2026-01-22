# Shift Time Adjustment System - Complete Implementation Summary

## Problem Statement

**Scenario:** Staff arrives at 8:00 AM (on time) but network issues prevent sign-in until 9:00 AM. The system calculates payment based on 8 hours (9 AM - 5 PM) when fair payment should be 9 hours (8 AM - 5 PM).

**Requirements:**
- Preserve original check-in/out times for audit trail
- Auto-update existing invoices when shift times are adjusted
- Provide adjustment UI in shift approval screen
- Require manager digital signature for all adjustments
- Show before/after payment calculations

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                              │
├─────────────────────────────────────────────────────────────────────┤
│  Approvals.tsx ──► AdjustTimeDialog.tsx ──► shiftService.ts         │
│       │                    │                      │                  │
│  "Adjust Times"      Dialog with:           API calls:              │
│     button          - Time inputs           - adjustTime()          │
│                     - Payment preview       - getTimeAdjustments()  │
│                     - Signature canvas                              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ POST /api/v1/shifts/{id}/adjust_time/
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Django)                              │
├─────────────────────────────────────────────────────────────────────┤
│  shifts/views.py ──► api/serializers.py ──► api/models.py           │
│       │                     │                    │                   │
│  adjust_time()      TimeAdjustment         TimeAdjustment           │
│  action             Serializer             Model                     │
│                     (validation)           (stores adjustment)       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ Django Signal (post_save)
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTOMATIC INVOICE UPDATE                         │
├─────────────────────────────────────────────────────────────────────┤
│  api/signals.py ──► Invoice.recalculate_from_shifts()               │
│       │                         │                                    │
│  Detects new            Updates InvoiceItem hours/amount            │
│  TimeAdjustment         Recalculates Invoice totals                 │
│                         Increments version number                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files Modified/Created

### Backend Files

#### 1. `/backend/api/models.py` (MODIFIED)

**Changes Made:**

**A. Added TimeAdjustment Model (after line ~2270)**
```python
class TimeAdjustment(models.Model):
    """Records manual time adjustments made by managers/admins"""

    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='time_adjustments')

    # Original times (copied from shift at creation)
    original_check_in_time = models.DateTimeField(null=True, blank=True)
    original_check_out_time = models.DateTimeField(null=True, blank=True)
    original_actual_hours = models.DecimalField(max_digits=5, decimal_places=2)

    # Adjusted times (corrected values)
    adjusted_check_in_time = models.DateTimeField(null=True, blank=True)
    adjusted_check_out_time = models.DateTimeField(null=True, blank=True)
    adjusted_actual_hours = models.DecimalField(max_digits=5, decimal_places=2)

    # Audit fields
    reason = models.TextField()
    adjusted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    manager_signature = models.TextField()  # Base64 encoded
    created_at = models.DateTimeField(auto_now_add=True)
```

**Logic:** This model stores adjustment records while preserving original times. The `related_name='time_adjustments'` allows `shift.time_adjustments.all()` queries. Ordering by `-created_at` ensures `.first()` returns the latest adjustment.

**Validation in `clean()` method:**
- Adjusted check-in cannot be >2 hours before scheduled start
- Adjusted check-out cannot be >4 hours after scheduled end
- Check-out must be after check-in
- Adjusted hours cannot exceed 24
- Hours must match calculated duration from times (±0.1 tolerance)

---

**B. Added Effective Time Methods to Shift Model (around line ~2060)**
```python
def get_latest_time_adjustment(self):
    """Get the most recent time adjustment for this shift"""
    return self.time_adjustments.first()  # Ordered by -created_at

def get_effective_check_in_time(self):
    """Return adjusted check-in time if exists, otherwise original"""
    adjustment = self.get_latest_time_adjustment()
    if adjustment and adjustment.adjusted_check_in_time:
        return adjustment.adjusted_check_in_time
    return self.check_in_time

def get_effective_check_out_time(self):
    """Return adjusted check-out time if exists, otherwise original"""
    adjustment = self.get_latest_time_adjustment()
    if adjustment and adjustment.adjusted_check_out_time:
        return adjustment.adjusted_check_out_time
    return self.check_out_time

def get_effective_actual_hours(self):
    """Return adjusted hours if exists, otherwise original"""
    adjustment = self.get_latest_time_adjustment()
    if adjustment and adjustment.adjusted_actual_hours:
        return adjustment.adjusted_actual_hours
    return self.actual_hours_worked
```

**Logic:** These methods provide a transparent way to get "effective" times. All code that needs times for payment/display should use these methods instead of raw fields. This ensures adjusted times are automatically used when available.

---

**C. Modified `calculate_payment()` Method (around line ~2085)**
```python
def calculate_payment(self):
    # Use adjusted hours if they exist
    effective_hours = self.get_effective_actual_hours()

    if not effective_hours:
        return None

    # ... existing rate calculation ...

    hours = Decimal(str(effective_hours))

    # Only cap hours if no time adjustment exists AND not auto-checkout
    if not self.get_latest_time_adjustment() and not self.auto_checkout:
        hours = min(hours, max_payable_hours)

    rate = Decimal(str(effective_rate))
    return hours * rate
```

**Logic:** Changed from using `self.actual_hours_worked` to `self.get_effective_actual_hours()`. When a TimeAdjustment exists, the adjusted hours bypass the cap logic (they're already validated).

---

**D. Added Invoice Fields and Methods (around line ~2640)**

New fields:
```python
version = models.IntegerField(default=1, help_text="Increments on each recalculation")
last_recalculated_at = models.DateTimeField(null=True, blank=True)
```

New method:
```python
def recalculate_from_shifts(self):
    """Recalculate invoice totals from all linked shifts"""
    total_hours = Decimal('0.00')
    total_amount = Decimal('0.00')

    for item in self.items.all():
        shift = item.shift
        item.hours_worked = shift.get_effective_actual_hours()
        item.amount = shift.calculate_payment()
        item.save()

        total_hours += item.hours_worked
        total_amount += item.amount

    self.total_hours = total_hours
    self.total_amount = total_amount
    self.hourly_rate = total_amount / total_hours if total_hours > 0 else Decimal('0.00')
    self.version = (self.version or 0) + 1
    self.last_recalculated_at = timezone.now()
    self.save()

    return self
```

**Logic:** When called, this method iterates all invoice items, recalculates each from its shift's effective hours, then updates invoice totals. The `version` field provides an audit trail of recalculations.

---

#### 2. `/backend/api/signals.py` (MODIFIED)

**Added signal handler at end of file:**
```python
@receiver(post_save, sender='api.TimeAdjustment')
def auto_update_invoice_on_time_adjustment(sender, instance, created, **kwargs):
    """Auto-update invoice when TimeAdjustment is created"""
    from .models import InvoiceItem

    if not created:
        return  # Only process new adjustments

    shift = instance.shift

    try:
        invoice_item = InvoiceItem.objects.select_related('invoice').get(shift=shift)
        invoice = invoice_item.invoice

        # Only update pending invoices
        if invoice.status != 'pending':
            logger.warning(f"Skipping - invoice {invoice.id} status is {invoice.status}")
            return

        # Recalculate this invoice item
        invoice_item.hours_worked = shift.get_effective_actual_hours()
        invoice_item.amount = shift.calculate_payment()
        invoice_item.save()

        # Recalculate invoice totals
        invoice.recalculate_from_shifts()

    except InvoiceItem.DoesNotExist:
        pass  # Shift not invoiced yet - no action needed
```

**Logic:** Django signals allow automatic reactions to model events. When a TimeAdjustment is saved, this signal:
1. Finds the InvoiceItem for this shift (if exists)
2. Checks if invoice is still pending (can't modify paid/rejected)
3. Updates the InvoiceItem with new hours/amount
4. Triggers full invoice recalculation

**Note:** Using string `'api.TimeAdjustment'` for sender avoids circular imports.

---

#### 3. `/backend/api/serializers.py` (MODIFIED)

**A. Added TimeAdjustment import (line ~7):**
```python
from .models import (
    # ... existing imports ...
    Shift, FireExitCheck, CapacityCheck, ToiletCheck, TimeAdjustment,
    # ...
)
```

**B. Added TimeAdjustmentSerializer (after ToiletCheckSerializer, around line ~394):**
```python
class TimeAdjustmentSerializer(serializers.ModelSerializer):
    adjusted_by_details = UserSerializer(source='adjusted_by', read_only=True)
    payment_impact = serializers.SerializerMethodField()

    class Meta:
        model = TimeAdjustment
        fields = '__all__'
        read_only_fields = ('created_at', 'adjusted_by')

    def validate(self, data):
        # All the same validation as model's clean() method
        # Plus: require reason and manager_signature

    def create(self, validated_data):
        shift = validated_data['shift']
        # Store original times from shift before creating
        validated_data['original_check_in_time'] = shift.check_in_time
        validated_data['original_check_out_time'] = shift.check_out_time
        validated_data['original_actual_hours'] = shift.actual_hours_worked
        return super().create(validated_data)

    def get_payment_impact(self, obj):
        # Calculate original vs adjusted payment for display
        return {
            'original_hours': float(original_hours),
            'adjusted_hours': float(adjusted_hours),
            'original_payment': float(original_payment),
            'adjusted_payment': float(adjusted_payment),
            'payment_difference': float(payment_difference),
        }
```

**Logic:** The serializer handles:
- Validation (duplicated from model for API-level error messages)
- Auto-populating original times on create (user only sends adjusted times)
- Computing payment impact for frontend display

**C. Added time_adjustments to ShiftSerializer (around line ~512):**
```python
class ShiftSerializer(serializers.ModelSerializer):
    # ... existing fields ...
    time_adjustments = TimeAdjustmentSerializer(many=True, read_only=True)
```

---

#### 4. `/backend/shifts/views.py` (MODIFIED)

**Added two actions to ShiftViewSet (around line ~1189):**

**A. adjust_time action:**
```python
@action(detail=True, methods=['post'], url_path='adjust_time')
def adjust_time(self, request, pk=None):
    """Create a time adjustment for a shift"""
    from api.models import TimeAdjustment, InvoiceItem
    from api.serializers import TimeAdjustmentSerializer

    # Check permissions
    if request.user.role not in ['manager', 'admin']:
        return Response({'detail': 'Only managers and admins can adjust shift times'},
                       status=403)

    shift = self.get_object()

    adjustment_data = {
        'shift': shift.id,
        'adjusted_check_in_time': request.data.get('adjusted_check_in_time'),
        'adjusted_check_out_time': request.data.get('adjusted_check_out_time'),
        'adjusted_actual_hours': request.data.get('adjusted_actual_hours'),
        'reason': request.data.get('reason'),
        'manager_signature': request.data.get('manager_signature'),
    }

    serializer = TimeAdjustmentSerializer(data=adjustment_data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    adjustment = serializer.save(adjusted_by=request.user)

    # Check if invoice was updated (for response info)
    invoice_updated = False
    invoice_id = None
    try:
        invoice_item = InvoiceItem.objects.get(shift=shift)
        invoice_updated = True
        invoice_id = invoice_item.invoice.id
    except InvoiceItem.DoesNotExist:
        pass

    return Response({
        'id': adjustment.id,
        'shift': shift.id,
        'original_hours': float(adjustment.original_actual_hours),
        'adjusted_hours': float(adjustment.adjusted_actual_hours),
        'payment_impact': serializer.data.get('payment_impact'),
        'invoice_updated': invoice_updated,
        'invoice_id': invoice_id,
        'created_at': adjustment.created_at.isoformat(),
    }, status=201)
```

**B. time_adjustments action:**
```python
@action(detail=True, methods=['get'], url_path='time_adjustments')
def time_adjustments(self, request, pk=None):
    """Get all time adjustments for a shift (audit history)"""
    from api.models import TimeAdjustment
    from api.serializers import TimeAdjustmentSerializer

    shift = self.get_object()
    adjustments = TimeAdjustment.objects.filter(shift=shift).order_by('-created_at')
    serializer = TimeAdjustmentSerializer(adjustments, many=True)
    return Response(serializer.data)
```

**API Endpoints Created:**
- `POST /api/v1/shifts/{id}/adjust_time/` - Create adjustment
- `GET /api/v1/shifts/{id}/time_adjustments/` - List adjustment history

---

#### 5. `/backend/api/migrations/0045_invoice_last_recalculated_at_invoice_version_and_more.py` (CREATED)

Auto-generated migration that:
- Adds `version` and `last_recalculated_at` fields to Invoice model
- Creates TimeAdjustment table with all fields
- Creates index on `(shift, -created_at)` for efficient queries

---

### Frontend Files

#### 1. `/frontend/src/types/invoice.ts` (MODIFIED)

**Added interfaces:**
```typescript
export interface TimeAdjustment {
  id: number;
  shift: number;
  original_check_in_time: string | null;
  original_check_out_time: string | null;
  original_actual_hours: number;
  adjusted_check_in_time: string | null;
  adjusted_check_out_time: string | null;
  adjusted_actual_hours: number;
  reason: string;
  adjusted_by: number;
  adjusted_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  manager_signature: string;
  created_at: string;
  payment_impact?: {
    original_hours: number;
    adjusted_hours: number;
    original_payment: number;
    adjusted_payment: number;
    payment_difference: number;
  };
}

export interface AdjustmentData {
  adjusted_check_in_time: string;
  adjusted_check_out_time: string;
  adjusted_actual_hours: number;
  reason: string;
  manager_signature: string;
}

export interface AdjustmentResponse {
  id: number;
  shift: number;
  original_hours: number;
  adjusted_hours: number;
  payment_impact: { ... };
  invoice_updated: boolean;
  invoice_id: number | null;
  created_at: string;
}
```

---

#### 2. `/frontend/src/services/shiftService.ts` (MODIFIED)

**Added methods (around line ~782):**
```typescript
// Time adjustment methods
async adjustTime(shiftId: number, adjustmentData: {
  adjusted_check_in_time?: string;
  adjusted_check_out_time?: string;
  adjusted_actual_hours: number;
  reason: string;
  manager_signature: string;
}): Promise<any> {
  const response = await shiftApi.post(`/api/v1/shifts/${shiftId}/adjust_time/`, adjustmentData);
  return response.data;
}

async getTimeAdjustments(shiftId: number): Promise<any[]> {
  const response = await shiftApi.get(`/api/v1/shifts/${shiftId}/time_adjustments/`);
  return response.data;
}
```

---

#### 3. `/frontend/src/components/AdjustTimeDialog.tsx` (CREATED)

**Full dialog component with:**

```typescript
interface AdjustTimeDialogProps {
  shift: Shift;
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}
```

**Features:**
- **Original Times Display:** Shows scheduled start/end and actual check-in/out
- **Adjusted Time Inputs:** datetime-local inputs for corrected times
- **Auto-Calculate Hours:** When times change, calculates adjusted hours
- **Payment Impact Preview:** Shows before/after payment comparison with difference
- **Reason Textarea:** Required explanation for the adjustment
- **Signature Canvas:**
  - HTML5 canvas element
  - Mouse event handlers (mousedown, mousemove, mouseup, mouseleave)
  - `hasSignature` state to track if user has drawn
  - Clear button to reset
  - Converts to base64 dataURL on submit
- **Validation:**
  - Both times required
  - Reason required
  - Signature required (button disabled until signed)
  - Check-out after check-in
- **Submit Logic:**
  - Calls `shiftService.adjustTime()`
  - On success: calls `onSuccess()` and `onDismiss()`
  - On error: displays error message

---

#### 4. `/frontend/src/pages/manager/Approvals.tsx` (MODIFIED)

**A. Added imports (line ~29):**
```typescript
import AdjustTimeDialog from '../../components/AdjustTimeDialog';
import type { Shift } from '../../types';
```

**B. Added state (around line ~83):**
```typescript
// Time Adjustment State
const [showAdjustTimeDialog, setShowAdjustTimeDialog] = useState(false);
const [selectedShiftForAdjustment, setSelectedShiftForAdjustment] = useState<Shift | null>(null);
```

**C. Added handlers (around line ~574):**
```typescript
const handleAdjustTimes = useCallback(async (incompleteShift: IncompleteShift) => {
  try {
    // Fetch full shift details (IncompleteShift is a subset)
    const fullShift = await shiftService.getShift(incompleteShift.id);
    setSelectedShiftForAdjustment(fullShift as Shift);
    setShowAdjustTimeDialog(true);
  } catch (error) {
    setError('Failed to load shift details. Please try again.');
  }
}, []);

const handleAdjustmentSuccess = useCallback(() => {
  loadIncompleteShifts();  // Refresh the list
}, [loadIncompleteShifts]);
```

**D. Modified incompleteColumns actions (around line ~448):**
```typescript
{
  key: 'actions',
  name: 'Actions',
  minWidth: 250,  // Increased from 200
  onRender: (item: IncompleteShift) => (
    <Stack horizontal tokens={{ childrenGap: 8 }}>
      {/* ... existing buttons ... */}

      {/* NEW: Adjust Times button - only shows if shift has check-in or check-out */}
      {(item.check_in_time || item.check_out_time) && (
        <Link onClick={() => handleAdjustTimes(item)} style={{ color: '#0078D4', fontWeight: 600 }}>
          Adjust Times
        </Link>
      )}
    </Stack>
  ),
}
```

**E. Added dialog component (around line ~917):**
```typescript
{/* Time Adjustment Dialog */}
{selectedShiftForAdjustment && (
  <AdjustTimeDialog
    shift={selectedShiftForAdjustment}
    isOpen={showAdjustTimeDialog}
    onDismiss={() => {
      setShowAdjustTimeDialog(false);
      setSelectedShiftForAdjustment(null);
    }}
    onSuccess={handleAdjustmentSuccess}
  />
)}
```

---

## Data Flow

### Creating an Adjustment

```
1. User clicks "Adjust Times" on Approvals page
   ↓
2. handleAdjustTimes() fetches full shift data via shiftService.getShift()
   ↓
3. AdjustTimeDialog opens with shift data
   ↓
4. User fills form: adjusted times, reason, signature
   ↓
5. handleSubmit() calls shiftService.adjustTime()
   ↓
6. POST /api/v1/shifts/{id}/adjust_time/
   ↓
7. ShiftViewSet.adjust_time() validates via TimeAdjustmentSerializer
   ↓
8. TimeAdjustment.save() runs validation and saves to DB
   ↓
9. Django signal auto_update_invoice_on_time_adjustment fires
   ↓
10. Signal finds InvoiceItem, updates hours/amount
   ↓
11. Invoice.recalculate_from_shifts() updates totals
   ↓
12. Response returns to frontend with payment_impact
   ↓
13. onSuccess() triggers loadIncompleteShifts() to refresh list
```

### Payment Calculation with Adjustments

```
1. Invoice.generate_for_staff_period() iterates shifts
   ↓
2. For each shift, calls shift.calculate_payment()
   ↓
3. calculate_payment() calls get_effective_actual_hours()
   ↓
4. get_effective_actual_hours() checks for TimeAdjustment
   ↓
5. If adjustment exists: returns adjusted_actual_hours
   If no adjustment: returns actual_hours_worked
   ↓
6. Payment = effective_hours × hourly_rate
```

---

## Key Design Decisions

1. **Original times preserved in TimeAdjustment, not modified on Shift**
   - Shift.check_in_time/check_out_time remain unchanged
   - TimeAdjustment stores both original and adjusted
   - Audit trail maintained

2. **Latest adjustment wins (only one active)**
   - TimeAdjustment ordered by `-created_at`
   - `get_latest_time_adjustment().first()` gets most recent
   - Multiple adjustments allowed (history preserved)

3. **Signal-based invoice updates**
   - Decoupled from adjustment creation
   - Automatic (no extra API call needed)
   - Only updates pending invoices

4. **Signature stored as base64**
   - Canvas.toDataURL() creates PNG data URL
   - Stored directly in TextField
   - No separate file storage needed

5. **Validation duplicated in serializer and model**
   - Model validation: database integrity
   - Serializer validation: better API error messages
   - Both use same rules

---

## Potential Issues to Watch For

### Backend

1. **Signal not firing:** Check that `api/apps.py` imports signals
2. **Circular imports:** TimeAdjustment uses string sender `'api.TimeAdjustment'`
3. **Decimal precision:** All hours use `Decimal` not `float`
4. **Timezone issues:** All times should be timezone-aware (Django settings)

### Frontend

1. **Shift type mismatch:** `IncompleteShift` vs `Shift` - we fetch full shift before opening dialog
2. **Canvas signature detection:** `hasSignature` state tracks drawing
3. **Date format:** Must use ISO format for API (`new Date().toISOString()`)
4. **Payment impact null:** Only calculates if `shift.hourly_rate` and `shift.actual_hours_worked` exist

### Integration

1. **Invoice not updating:** Check invoice status is `'pending'`, not `'paid'` or `'rejected'`
2. **InvoiceItem not found:** Shift must be invoiced before auto-update works
3. **Permission denied:** User must have role `'manager'` or `'admin'`

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| `backend/api/models.py` | Modified | Added TimeAdjustment model, Shift effective methods, Invoice recalculation |
| `backend/api/signals.py` | Modified | Added auto_update_invoice_on_time_adjustment signal |
| `backend/api/serializers.py` | Modified | Added TimeAdjustmentSerializer, updated ShiftSerializer |
| `backend/shifts/views.py` | Modified | Added adjust_time and time_adjustments actions |
| `backend/api/migrations/0045_*.py` | Created | Database migration |
| `frontend/src/types/invoice.ts` | Modified | Added TypeScript interfaces |
| `frontend/src/services/shiftService.ts` | Modified | Added adjustTime and getTimeAdjustments methods |
| `frontend/src/components/AdjustTimeDialog.tsx` | Created | Full dialog component |
| `frontend/src/pages/manager/Approvals.tsx` | Modified | Integrated dialog and button |

---

## Manual Testing Guide

### Quick Test Flow

1. **Start servers:**
   ```bash
   # Terminal 1 - Backend
   cd /Users/new/Projects/mead-security/remix2
   source venv/bin/activate && cd backend && python manage.py runserver

   # Terminal 2 - Frontend
   cd /Users/new/Projects/mead-security/remix2/frontend && npm run dev
   ```

2. **Create test shift with late check-in**
3. **Log in as Manager/Admin**
4. **Go to Manager → Approvals → Incomplete Shifts**
5. **Click "Adjust Times" on a shift**
6. **Fill form and submit**
7. **Verify invoice auto-updates (if exists)**

### API Testing

```bash
# Create adjustment
curl -X POST http://localhost:8000/api/v1/shifts/{id}/adjust_time/ \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "adjusted_check_in_time": "2025-01-15T08:00:00Z",
    "adjusted_check_out_time": "2025-01-15T17:00:00Z",
    "adjusted_actual_hours": 9.0,
    "reason": "Network issues",
    "manager_signature": "data:image/png;base64,..."
  }'

# Get adjustment history
curl http://localhost:8000/api/v1/shifts/{id}/time_adjustments/ \
  -H "Authorization: Bearer {token}"
```

---

This document provides complete context for debugging any issues that arise during testing.
