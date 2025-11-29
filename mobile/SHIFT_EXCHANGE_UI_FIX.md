# 🔧 Shift Exchange UI Fix - Accept/Decline Button Display

**Date**: 2025-10-26
**Issue**: Requesting user (James44) sees Accept/Decline buttons instead of Cancel button
**Status**: 🚧 In Progress

---

## 🐛 Problem Description

### Current Incorrect Behavior
When James44 transfers a shift to Dan Mead:
- ❌ **James44 sees**: "Direct Exchange with Dan Mead" + Accept/Decline buttons
- ❌ **Dan Mead sees**: Same view (not tested yet, but likely incorrect)

### Expected Correct Behavior
When James44 transfers a shift to Dan Mead:
- ✅ **James44 (requesting_user) should see**:
  - Title: "Direct Exchange"
  - Subtitle: "With Dan Mead"
  - Status: "Pending"
  - Action: **Cancel** button (to cancel own request)

- ✅ **Dan Mead (target_user) should see**:
  - Title: "Direct Exchange"
  - Subtitle: "From James Smith" (or "From James44")
  - Status: "Pending"
  - Actions: **Accept** and **Decline** buttons (to respond to incoming request)

### Root Cause
The `renderExchangeCard` function in `ShiftExchangesScreen.tsx` (lines 227-246) shows Accept/Decline buttons for ALL pending exchanges without checking if the current user is the `requesting_user` or `target_user`.

**Current code** (lines 227-246):
```typescript
{isPending && (
  <View style={styles.actions}>
    <Button
      title="Accept"
      variant="primary"
      size="small"
      onPress={() => handleAcceptExchange(exchange)}
      style={styles.actionButton}
      disabled={isActioning}
    />
    <Button
      title="Decline"
      variant="secondary"
      size="small"
      onPress={() => handleCancelExchange(exchange)}
      style={styles.actionButton}
      disabled={isActioning}
    />
  </View>
)}
```

---

## ✅ Solution Implementation

### Changes Required

**File**: `/Users/new/Projects/mead-security/remix2/mobile/src/screens/shifts/ShiftExchangesScreen.tsx`

#### 1. Import useAuth Hook
```typescript
import { useAuth } from '../../hooks/useAuth';
```

#### 2. Get Current User ID
Add at the top of the component function:
```typescript
const { user } = useAuth();
const currentUserId = user?.id;
```

#### 3. Update renderExchangeCard Logic

**Determine user role in exchange:**
```typescript
const isTargetUser = currentUserId === exchange.target_user;
const isRequestingUser = currentUserId === exchange.requesting_user;
```

**Update card subtitle (line 199-201):**
```typescript
<Text style={styles.cardSubtitle}>
  {isRequestingUser
    ? `With ${exchange.target_user_details.first_name} ${exchange.target_user_details.last_name}`
    : `From ${exchange.requesting_user_details.first_name} ${exchange.requesting_user_details.last_name}`
  }
</Text>
```

**Update action buttons (lines 227-246):**
```typescript
{/* Actions - Different for target vs requesting user */}
{isPending && isTargetUser && (
  <View style={styles.actions}>
    <Button
      title="Accept"
      variant="primary"
      size="small"
      onPress={() => handleAcceptExchange(exchange)}
      style={styles.actionButton}
      disabled={isActioning}
    />
    <Button
      title="Decline"
      variant="secondary"
      size="small"
      onPress={() => handleCancelExchange(exchange)}
      style={styles.actionButton}
      disabled={isActioning}
    />
  </View>
)}

{isPending && isRequestingUser && (
  <Button
    title={isActioning ? 'Cancelling...' : 'Cancel Request'}
    variant="secondary"
    size="small"
    onPress={() => handleCancelExchange(exchange)}
    disabled={isActioning}
    style={{ marginTop: spacing.sm }}
  />
)}
```

---

## 🔍 Key Data Structures

### ShiftExchange Interface
```typescript
export interface ShiftExchange {
  id: number;
  requesting_user: number;           // ID of user who initiated exchange
  requesting_user_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  target_user: number;               // ID of user who should respond
  target_user_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  status: 'pending' | 'accepted_by_target' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  // ... other fields
}
```

### User Interface (from authSlice)
```typescript
export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'staff' | 'manager' | 'admin';
  // ... other fields
}
```

---

## 🧪 Testing Guide

### Test Scenario 1: Outgoing Request (Requesting User View)
**Setup**: James44 creates transfer request to Dan Mead

**Steps**:
1. Log in as James44
2. Navigate to Shifts → Shift Exchanges
3. View the exchange card

**Expected Results**:
- ✅ Subtitle shows: "With Dan Mead"
- ✅ Status badge: "Pending"
- ✅ Shows single "Cancel Request" button
- ✅ No Accept/Decline buttons visible

---

### Test Scenario 2: Incoming Request (Target User View)
**Setup**: James44 has already created transfer request to Dan Mead

**Steps**:
1. Log in as Dan Mead (dan / Staff12345)
2. Navigate to Shifts → Shift Exchanges
3. View the exchange card

**Expected Results**:
- ✅ Subtitle shows: "From James Smith" (or "From James44")
- ✅ Status badge: "Pending"
- ✅ Shows "Accept" and "Decline" buttons
- ✅ No Cancel button visible

---

### Test Scenario 3: After Acceptance
**Setup**: Dan accepts the exchange

**Steps**:
1. Dan clicks "Accept" button
2. Confirms acceptance
3. Both users check their exchange screens

**Expected Results**:
- ✅ Status changes to "Accepted By Target"
- ✅ No action buttons shown (waiting for manager approval)
- ✅ Info message: "Waiting for manager approval"

---

## 📊 Before vs After

### Before Fix ❌

```
James44's View:
┌────────────────────────────────────┐
│ Direct Exchange                    │
│ With Dan Mead              [Pending]│
│                                    │
│ [Accept]  [Decline]  ← WRONG!      │
└────────────────────────────────────┘
```

### After Fix ✅

```
James44's View (Requesting User):
┌────────────────────────────────────┐
│ Direct Exchange                    │
│ With Dan Mead              [Pending]│
│                                    │
│ [Cancel Request]  ← CORRECT!       │
└────────────────────────────────────┘

Dan's View (Target User):
┌────────────────────────────────────┐
│ Direct Exchange                    │
│ From James Smith           [Pending]│
│                                    │
│ [Accept]  [Decline]  ← CORRECT!    │
└────────────────────────────────────┘
```

---

## 🔗 Related Files

- **Main Screen**: `/Users/new/Projects/mead-security/remix2/mobile/src/screens/shifts/ShiftExchangesScreen.tsx`
- **Exchange Service**: `/Users/new/Projects/mead-security/remix2/mobile/src/services/exchangeService.ts`
- **Auth Hook**: `/Users/new/Projects/mead-security/remix2/mobile/src/hooks/useAuth.ts`
- **Auth Slice**: `/Users/new/Projects/mead-security/remix2/mobile/src/store/slices/authSlice.ts`

---

## 🚀 Deployment Notes

### No Backend Changes Required
- ✅ Backend API is already correct
- ✅ Only frontend UI logic needs updating
- ✅ No database migrations needed

### Deployment Steps
1. Apply changes to ShiftExchangesScreen.tsx
2. Test both user perspectives (requesting vs target)
3. Verify all exchange statuses render correctly
4. Deploy mobile app update

---

## 🎉 Summary

**Problem**: Both requesting user and target user saw Accept/Decline buttons, causing confusion about who should respond.

**Solution**: Check `currentUserId` against `exchange.requesting_user` and `exchange.target_user` to show appropriate buttons and labels.

**Result**:
- ✅ Requesting users see Cancel button for their own requests
- ✅ Target users see Accept/Decline buttons for incoming requests
- ✅ Card subtitles clearly indicate direction ("With" vs "From")
- ✅ Clear UX that matches user expectations
