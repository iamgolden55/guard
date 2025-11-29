# 🔒 Security Role Filtering Fix - Shift Transfer Feature

**Date**: 2025-10-26
**Issue**: HTTP 500 error when transferring shifts to staff without required security role
**Status**: ✅ Fixed and ready for testing

---

## 🐛 Problem Description

### Original Error
```
ERROR  createExchange error: [ApiError: HTTP 500: ]
ValueError: Target user does not have the required security role for this shift
```

### Root Cause
- Backend validation checks if target staff has the shift's `required_security_role`
- Frontend showed all approved staff regardless of security roles
- Users could select staff who weren't qualified, resulting in 500 error

### Example Scenario
- James44 has a shift requiring **Door Supervisor (DS)** role
- Jane Smith only has **Security Guard (SG)** role
- Jane appeared in transfer list but backend rejected the transfer
- User received confusing 500 error

---

## ✅ Solution Implemented

### Approach: Backend Filtering by Security Role

**Strategy**: Only show staff members who have the required security role for the specific shift being transferred.

**Benefits**:
- ✅ Prevents showing ineligible staff
- ✅ Better UX (no confusion or errors)
- ✅ Consistent with open shift claiming logic
- ✅ Backend validation as single source of truth

---

## 📝 Changes Made

### 1. Backend API Endpoint Update

**File**: `backend/api/views.py` (lines 382-454)

**Changes**:
- Added optional `shift_id` query parameter to `/api/v1/users/eligible-for-transfer/`
- When `shift_id` provided, fetches shift's `required_security_role`
- Filters staff using `has_security_role()` method
- Only returns staff with matching security role

**API Usage**:
```bash
# Without filtering (shows all approved staff)
GET /api/v1/users/eligible-for-transfer/

# With security role filtering (shows only qualified staff)
GET /api/v1/users/eligible-for-transfer/?shift_id=123
```

**Implementation Highlights**:
```python
# Get shift's required role
if shift_id:
    shift = Shift.objects.get(id=shift_id, staff_user=user)
    required_role = shift.required_security_role

# Filter by security role
for staff_user in eligible_users:
    if not (hasattr(staff_user, 'profile') and staff_user.profile.is_approved):
        continue

    # Check security role if shift_id provided
    if required_role and not staff_user.has_security_role(required_role):
        continue

    approved_staff.append(staff_user)
```

---

### 2. Backend Tests Added

**File**: `backend/api/tests/test_views.py` (lines 178-276)

**New Test Cases**:
1. ✅ `test_filters_by_security_role_when_shift_provided` - Verifies role filtering works
2. ✅ `test_returns_all_staff_when_no_shift_id` - Backwards compatibility check
3. ✅ `test_returns_404_for_non_existent_shift` - Error handling
4. ✅ `test_returns_404_for_shift_not_assigned_to_user` - Security check

**Test Scenario Example**:
```python
# John has ['ds', 'sg'] roles
# Mary has ['sg'] role only
# Shift requires 'ds' role

response = client.get(f'/api/v1/users/eligible-for-transfer/?shift_id={shift.id}')

# Result: John appears, Mary doesn't
assert john.id in [user['id'] for user in response.data]
assert mary.id not in [user['id'] for user in response.data]
```

---

### 3. Mobile Shift Type Update

**File**: `mobile/src/store/slices/shiftsSlice.ts` (line 21)

**Changes**: Added `required_security_role` field to Shift interface
```typescript
export interface Shift {
  id: number;
  venue: { /* ... */ };
  start_time: string;
  end_time: string;
  required_security_role: string;  // NEW FIELD
  // ... other fields
}
```

---

### 4. Mobile Transfer Modal Update

**File**: `mobile/src/components/modals/TransferShiftModal.tsx` (lines 61-77)

**Changes**: Pass `shift_id` query parameter when fetching eligible staff
```typescript
const fetchStaffMembers = async () => {
  try {
    setLoading(true);
    // Fetch eligible staff filtered by shift's required security role
    const response = await apiService.get<StaffMember[]>(
      `/api/v1/users/eligible-for-transfer/?shift_id=${shift!.id}`  // Added shift_id
    );

    setStaffMembers(Array.isArray(response) ? response : []);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    Alert.alert('Error', 'Failed to load staff members. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

---

## 🎯 Security Roles Reference

The system supports the following security roles:

| Code | Role Name | Description |
|------|-----------|-------------|
| `ds` | Door Supervisor | Licensed door security supervisor |
| `sg` | Security Guard | General security guard |
| `cctv` | CCTV Operator | CCTV monitoring specialist |
| `cp` | Close Protection Officer | Personal protection officer |
| `steward` | Steward/Marshal | Event steward or marshal |
| `k9` | Dog Handler | Security with trained dog |
| `retail` | Retail Security | Retail store security |
| `static` | Static Guard | Fixed position guard |

---

## 🧪 Testing Guide

### Backend Testing

#### Run Automated Tests
```bash
cd backend
python manage.py test api.tests.test_views.UserViewSetEligibleStaffTests
```

**Expected Output**:
```
test_filters_by_security_role_when_shift_provided ... ok
test_returns_all_staff_when_no_shift_id ... ok
test_returns_404_for_non_existent_shift ... ok
test_returns_404_for_shift_not_assigned_to_user ... ok
```

#### Test API Directly
```bash
# 1. Get authentication token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"James44","password":"Staff12345"}' \
  | grep -o '"access":"[^"]*' | cut -d'"' -f4)

# 2. Get James44's upcoming shift ID
python manage.py shell <<EOF
from api.models import User, Shift
from django.utils import timezone
james = User.objects.get(username='James44')
shift = james.shifts.filter(start_time__gt=timezone.now()).first()
print(f"Shift ID: {shift.id if shift else 'No upcoming shifts'}")
print(f"Required Role: {shift.required_security_role if shift else 'N/A'}")
EOF

# 3. Test endpoint with shift_id
curl -X GET "http://localhost:8000/api/v1/users/eligible-for-transfer/?shift_id=<SHIFT_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

---

### Check Staff Security Roles

```bash
python manage.py shell
```

```python
from api.models import User

# Check James44's shift requirements
james = User.objects.get(username='James44')
from django.utils import timezone
shift = james.shifts.filter(start_time__gt=timezone.now()).first()
print(f"James's shift requires: {shift.required_security_role}")

# Check staff security roles
jane = User.objects.get(first_name='JANE', last_name='SMITH')
print(f"Jane's roles: {jane.security_roles}")

dan = User.objects.get(first_name='Dan')
print(f"Dan's roles: {dan.security_roles}")

ninioritse = User.objects.get(first_name='Ninioritse')
print(f"Ninioritse's roles: {ninioritse.security_roles}")
```

---

### Mobile App Testing

#### Test Scenario 1: Transfer to Qualified Staff
**Steps**:
1. Log in as James44 (password: Staff12345)
2. Navigate to Shifts tab
3. Select an upcoming shift
4. Tap "Transfer Shift"
5. Observe staff list

**Expected Results**:
- ✅ Only staff with matching security role appear
- ✅ If Jane Smith lacks required role, she won't appear
- ✅ Search functionality still works
- ✅ Can select qualified staff
- ✅ Transfer succeeds without 500 error

---

#### Test Scenario 2: Empty State
**Setup**: Shift requires a rare role that no other staff has

**Steps**:
1. Open transfer shift modal for that shift
2. Observe empty state

**Expected Results**:
- ✅ Shows "No staff members available" message
- ✅ No crash or error
- ✅ Can close modal and try different shift

---

#### Test Scenario 3: Multiple Role Requirements
**Setup**: Different shifts require different roles

**Steps**:
1. Check shift A (requires DS role)
2. Note which staff appear
3. Close modal
4. Check shift B (requires SG role)
5. Note which staff appear

**Expected Results**:
- ✅ Different staff lists based on role requirements
- ✅ Staff with multiple roles appear for multiple shift types
- ✅ Consistent filtering across different shifts

---

## 📊 Before vs After

### Before Fix ❌

```
Transfer Shift Modal:
┌──────────────────────────────┐
│ Dan Mead ✓                   │  ← Has DS role (qualified)
│ JANE SMITH                   │  ← Missing DS role (NOT qualified)
│ Ninioritse                   │  ← Has DS role (qualified)
└──────────────────────────────┘

User selects Jane → 500 ERROR
```

### After Fix ✅

```
Transfer Shift Modal:
┌──────────────────────────────┐
│ Dan Mead ✓                   │  ← Has DS role (qualified)
│ Ninioritse                   │  ← Has DS role (qualified)
└──────────────────────────────┘

Only qualified staff shown → Transfer succeeds
```

---

## 🔧 Troubleshooting

### Issue: Staff list is empty

**Possible Causes**:
1. No other staff in company
2. No staff with required security role
3. All staff unapproved

**Debug Steps**:
```bash
python manage.py shell
```
```python
from api.models import User, SecurityCompany
james = User.objects.get(username='James44')
shift = james.shifts.filter(start_time__gt=timezone.now()).first()
required_role = shift.required_security_role

# Find all staff with required role
company = james.company_memberships.first().company
staff = User.objects.filter(
    company_memberships__company=company,
    role='staff',
    is_active=True,
    profile__is_approved=True
).exclude(id=james.id)

qualified = [s for s in staff if s.has_security_role(required_role)]
print(f"Qualified staff count: {len(qualified)}")
for s in qualified:
    print(f"  - {s.first_name} {s.last_name}: {s.security_roles}")
```

---

### Issue: Wrong staff filtered out

**Possible Causes**:
1. Staff security_roles not set correctly
2. Shift required_security_role incorrect

**Debug Steps**:
```bash
# Check staff roles
python manage.py shell
```
```python
from api.models import User
jane = User.objects.get(first_name='JANE', last_name='SMITH')
print(f"Jane's roles: {jane.security_roles}")
print(f"Type: {type(jane.security_roles)}")

# Update if needed
jane.security_roles = ['ds', 'sg']  # Add DS role
jane.save()
```

---

### Issue: 404 error "Shift not found"

**Possible Causes**:
1. Invalid shift ID
2. Shift belongs to another user
3. Shift doesn't exist

**Solution**: Verify shift ownership
```python
from api.models import Shift
shift = Shift.objects.get(id=SHIFT_ID)
print(f"Shift owner: {shift.staff_user.username}")
print(f"Required role: {shift.required_security_role}")
```

---

## ✅ Success Criteria Met

- [x] Backend endpoint accepts `shift_id` query parameter
- [x] Staff filtered by `required_security_role` when shift_id provided
- [x] Backend tests created and pass (4 new test cases)
- [x] Mobile Shift type includes `required_security_role` field
- [x] Mobile app passes `shift_id` when fetching eligible staff
- [x] Backwards compatible (works without shift_id parameter)
- [x] Error handling for invalid shift_id
- [x] Search functionality still works with filtered list

---

## 📚 Related Documentation

- **Original Transfer Feature**: `mobile/SHIFT_TRANSFER_TESTING_GUIDE.md`
- **Search Feature**: `mobile/SEARCH_FEATURE_SUMMARY.md`
- **Backend Validation**: `backend/api/models.py` (ShiftExchange.clean() method, line 2322)
- **Security Roles**: `backend/api/models.py` (SECURITY_ROLE_CHOICES, line 863)

---

## 🚀 Deployment Notes

### No Database Migrations Required
- No schema changes
- Only code logic updates
- Backwards compatible API

### Deployment Steps
1. Deploy backend changes (endpoint update)
2. Run tests to verify
3. Deploy mobile app update
4. Test end-to-end with James44 credentials

### Rollback Plan
If issues occur:
1. Remove `shift_id` parameter logic from backend endpoint
2. Revert mobile API call to not include `shift_id`
3. Falls back to showing all staff (original behavior)

---

## 🎉 Summary

**Problem**: Staff without required security roles appeared in transfer list, causing 500 errors

**Solution**: Filter staff list on backend by shift's required security role

**Result**:
- ✅ Only qualified staff appear in transfer list
- ✅ No more 500 errors
- ✅ Clear, intuitive UX
- ✅ Maintains security and compliance
- ✅ Consistent with open shift claiming

**Ready for Testing!** Open the mobile app, log in as James44, and try transferring a shift. You should only see staff members who have the required security role.
