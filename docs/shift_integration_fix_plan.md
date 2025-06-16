# Shift System Integration Fix Plan

## Executive Summary

Our analysis of the shift scheduling system has revealed several inconsistencies between the frontend and backend implementations. These inconsistencies create potential failures in the shift management workflow, particularly in the admin scheduling interfaces. This document outlines a plan to address these issues, ensuring seamless integration between the frontend React components and backend Django API.

## Key Issues Identified

1. **Naming convention inconsistencies**: Backend uses snake_case while frontend uses camelCase
2. **Field name mismatches**: Different field names used for the same concepts
3. **Status enum inconsistencies**: Different status values and transitions
4. **Missing API endpoints**: Frontend expects endpoints that aren't fully implemented
5. **Required field discrepancies**: Differences in which fields are required
6. **Template structure differences**: Different approaches to shift templates and recurring shifts
7. **Manager signature implementation**: Inconsistent signature requirements

## Detailed Issue Breakdown

### 1. Naming Convention Inconsistencies

| Backend (snake_case) | Frontend (camelCase) | 
|----------------------|----------------------|
| `required_security_role` | `requiredSecurityRole` |
| `check_in_time` | `checkInTime` |
| `manager_signature` | `managerSignature` |
| `staff_user` | `staffUser` / `staffId` |

### 2. Status Enum Inconsistencies

| Backend Status | Frontend ShiftStatus | Frontend ScheduledShiftStatus |
|----------------|----------------------|-------------------------------|
| 'open' | - | 'open' |
| 'scheduled' | - | 'scheduled' |
| 'active' | 'active' | - |
| 'in_progress' | - | - |
| 'completed' | 'completed' | 'completed' |
| 'pending_approval' | - | - |
| 'approved' | 'approved' | - |
| 'rejected' | 'rejected' | - |
| 'cancelled' | - | 'cancelled' |
| - | - | 'assigned' |
| - | - | 'checked_in' |

### 3. Missing API Endpoints

1. **Bulk Shift Creation Endpoint**
   - Frontend expects: `/api/shifts/bulk`
   - Backend implements: `ShiftViewSet.bulk` but with different parameters

2. **Shift Publishing Endpoint**
   - Frontend expects: `/shifts/publish`
   - Not implemented in backend

3. **Staff Assignment Endpoint**
   - Frontend expects: `/shifts/{id}/assign`
   - Not implemented in backend

4. **Shift Copy Between Months**
   - Frontend expects functionality to copy shifts between months
   - Not implemented in backend

### 4. Required Field Discrepancies

1. **Security Role Field**
   - Backend: `required_security_role` is mandatory
   - Frontend: Inconsistently included

2. **Payment Rate Handling**
   - Frontend: Uses `payRate` and `isSpecialEvent`
   - Backend: Has `pay_rate` but no `is_special_event`

3. **Template Fields**
   - Backend: `days_of_week` as JSON array
   - Frontend: `dayOfWeek` as single number or null

### 5. Manager Signature Implementation

- Frontend assumes signature is part of approval workflow
- Backend allows approval without signature (but includes fields for it)

## Action Plan

### Phase 1: API Alignment (Priority: High)

1. **Create API Serializer Classes for Frontend Compatibility**
   - Create new serializers with camelCase field names
   - Use Django REST Framework's `source` parameter to map to backend fields
   - Support both naming conventions during transition

2. **Implement Missing Endpoints**
   - Add `/shifts/publish` endpoint to ShiftViewSet
   - Update bulk creation endpoint to match frontend expectations
   - Add staff assignment endpoint
   - Implement shift copy functionality

### Phase 2: Data Model Updates (Priority: Medium)

1. **Add Missing Fields to Models**
   - Add `is_special_event` field to Shift model
   - Add requirements fields:
     - `requires_fire_safety_checks`
     - `requires_capacity_monitoring`
     - `requires_toilet_checks`

2. **Status Enum Standardization**
   - Update backend status choices to match frontend
   - Create migration for existing data

3. **Template Model Alignment**
   - Update ShiftTemplate model to support both day_of_week and days_of_week

### Phase 3: Manager Signature Requirements (Priority: Medium)

1. **Enforce Signature Requirements**
   - Update shift approval logic to require manager signature
   - Add validation for signature data

### Phase 4: Frontend Updates (Priority: Low)

1. **Update API Service**
   - Update frontend API services to match new endpoints
   - Add error handling for better diagnostics

2. **Update Type Definitions**
   - Align frontend type definitions with backend models

## Implementation Tasks

### Backend Tasks

1. **Create Frontend-Compatible Serializers**

```python
class FrontendShiftSerializer(serializers.ModelSerializer):
    staffId = serializers.IntegerField(source='staff_user_id', required=False, allow_null=True)
    venueId = serializers.IntegerField(source='venue_id')
    requiredSecurityRole = serializers.CharField(source='required_security_role')
    isSpecialEvent = serializers.BooleanField(source='is_special_event', required=False)
    # ... more fields
    
    class Meta:
        model = Shift
        fields = ('id', 'staffId', 'venueId', 'startTime', 'endTime', ...)
```

2. **Implement Publish Endpoint**

```python
@action(detail=False, methods=['post'])
def publish(self, request):
    """Publish multiple shifts"""
    shift_ids = request.data.get('shiftIds', [])
    shifts = Shift.objects.filter(id__in=shift_ids)
    
    # Update status for all shifts
    shifts.update(status='published')
    
    return Response({'success': True, 'count': len(shift_ids)})
```

3. **Implement Staff Assignment Endpoint**

```python
@action(detail=True, methods=['put'])
def assign(self, request, pk=None):
    """Assign staff to shift"""
    shift = self.get_object()
    staff_id = request.data.get('staffId')
    
    if not staff_id:
        return Response({'error': 'Staff ID is required'}, status=400)
    
    try:
        staff_user = User.objects.get(id=staff_id)
        
        # Verify staff eligibility
        if not hasattr(staff_user, 'profile') or not staff_user.profile.is_eligible_for_shifts():
            return Response({
                'error': 'Staff must have a valid SIA license and be admin approved'
            }, status=400)
        
        shift.staff_user = staff_user
        shift.status = 'scheduled'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({'error': 'Staff not found'}, status=404)
```

4. **Update Model with Missing Fields**

```python
class Shift(models.Model):
    # Existing fields...
    
    # Add new fields
    is_special_event = models.BooleanField(default=False)
    requires_fire_safety_checks = models.BooleanField(default=False)
    requires_capacity_monitoring = models.BooleanField(default=False)
    requires_toilet_checks = models.BooleanField(default=False)
```

### Frontend Tasks

1. **Update API Service for New Endpoints**

```typescript
// Update the bulkCreateShifts function
export const bulkCreateShifts = async (
  shifts: Array<{
    venueId: string;
    startTime: string;
    endTime: string;
    requiredSecurityRole: string;
  }>
): Promise<Shift[] | null> => {
  try {
    const response = await api.post('/shifts/bulk', { shifts });
    return response.data;
  } catch (error) {
    console.error('Error creating bulk shifts:', error);
    return null;
  }
};
```

## Testing Strategy

1. **Unit Tests for Backend Changes**
   - Test new serializers with both naming conventions
   - Test all new endpoints with valid and invalid data
   - Test status transitions

2. **Integration Tests**
   - Test end-to-end shift creation, publication, and assignment
   - Test bulk operations and template application

3. **Manual Testing**
   - Test manager signature workflow
   - Test shift copying between months
   - Test filters and calendar view

## Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| API Alignment | Create compatible serializers, implement missing endpoints | 3 days |
| Data Model Updates | Add missing fields, standardize status enums | 2 days |
| Manager Signature | Enforce signature requirements | 1 day |
| Frontend Updates | Update API services, align type definitions | 2 days |
| Testing | Unit, integration, and manual testing | 2 days |

## Implementation Checklist

This checklist should be used to track progress and ensure all tasks are properly implemented and verified before moving on to the next phase.

### Phase 1: API Alignment

#### Create Frontend-Compatible Serializers

- [ ] Create `FrontendShiftSerializer` with camelCase field mapping
  - [ ] Map `staff_user` → `staffId`/`staffUser`
  - [ ] Map `venue` → `venueId`
  - [ ] Map `required_security_role` → `requiredSecurityRole`
  - [ ] Map time fields with appropriate format conversion
  - [ ] Unit test serializer with sample shift data
- [ ] Create `FrontendShiftTemplateSerializer` with camelCase field mapping
  - [ ] Map `days_of_week` array to appropriate frontend format
  - [ ] Unit test serializer with sample template data
- [ ] Ensure all required fields are correctly mapped
  - [ ] Validate serialization and deserialization works correctly

**Verification**: _Run automated tests for serializers, inspecting the output format matches frontend expectations._

- [ ] Test with real frontend API call (mock integration)
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

#### Implement Missing Endpoints

- [ ] Implement `/shifts/publish` endpoint
  - [ ] Add ViewSet action for publishing multiple shifts
  - [ ] Ensure proper error handling for invalid IDs
  - [ ] Unit test with valid and invalid data
- [ ] Update bulk shift creation endpoint
  - [ ] Ensure it accepts frontend parameter format
  - [ ] Add parameter validation
  - [ ] Test with various combinations of parameters
- [ ] Implement staff assignment endpoint
  - [ ] Add ViewSet action for assigning staff to shift
  - [ ] Add staff eligibility validation
  - [ ] Test with eligible and ineligible staff
- [ ] Implement shift copy functionality
  - [ ] Add endpoint for copying shifts between months
  - [ ] Handle edge cases like month length differences
  - [ ] Test with various source/target month combinations

**Verification**: _Confirm all endpoints respond correctly to frontend-formatted requests._

- [ ] Test each endpoint with Postman/curl
- [ ] Ensure proper error responses for invalid inputs
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 1 Testing Milestone

- [ ] Automated tests pass for all new serializers and endpoints
- [ ] Manual API tests with sample frontend data succeed
- [ ] Integration test with modified frontend service calls succeed

**Gate Check**: _Do not proceed to Phase 2 until all Phase 1 tasks are verified and tests pass._

- [ ] Date passed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 2: Data Model Updates

#### Add Missing Fields to Models

- [ ] Add `is_special_event` field to Shift model
  - [ ] Create migration
  - [ ] Set appropriate default value
  - [ ] Update serializer to include field
- [ ] Add shift requirement fields
  - [ ] Add `requires_fire_safety_checks` field
  - [ ] Add `requires_capacity_monitoring` field
  - [ ] Add `requires_toilet_checks` field
  - [ ] Create migration with appropriate defaults
  - [ ] Update serializer to include fields
- [ ] Run and verify migrations
  - [ ] Test on development database
  - [ ] Create test fixtures with new fields

**Verification**: _Confirm model changes are applied correctly in database._

- [ ] Inspect database schema
- [ ] Create and retrieve shifts with new fields
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

#### Status Enum Standardization

- [ ] Update Shift model status choices
  - [ ] Align with frontend ScheduledShiftStatus enum
  - [ ] Create data migration to map old statuses to new ones
  - [ ] Update any status-dependent logic in views
- [ ] Update serializers to use new status values
  - [ ] Test serialization of all status values
  - [ ] Test status transitions

**Verification**: _Ensure existing data is properly migrated and new statuses work correctly._

- [ ] Test status transitions through API
- [ ] Verify existing records have correct statuses
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

#### Template Model Alignment

- [ ] Update ShiftTemplate model
  - [ ] Support both `day_of_week` single value and `days_of_week` array
  - [ ] Create migration
  - [ ] Update serializer to handle both cases
- [ ] Update template application logic
  - [ ] Ensure it works with both template formats
  - [ ] Test template application with various patterns

**Verification**: _Confirm template creation and application works with both formats._

- [ ] Create templates of both types via API
- [ ] Generate shifts from templates
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 2 Testing Milestone

- [ ] All model migrations run successfully
- [ ] CRUD operations work with new fields
- [ ] Status transitions behave as expected
- [ ] Template creation and application works correctly

**Gate Check**: _Do not proceed to Phase 3 until all Phase 2 tasks are verified and tests pass._

- [ ] Date passed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 3: Manager Signature Requirements

#### Enforce Signature Requirements

- [ ] Update shift approval logic
  - [ ] Add validation for manager signature
  - [ ] Add error handling for missing signatures
  - [ ] Add exception for admin override (if applicable)
- [ ] Add signature data validation
  - [ ] Validate base64 format
  - [ ] Check for minimum data requirements
  - [ ] Secure storage of signature data

**Verification**: _Confirm signature requirements are enforced correctly._

- [ ] Test approval with and without signatures
- [ ] Test with invalid signature data
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 3 Testing Milestone

- [ ] Signature validation works correctly
- [ ] Approval workflow enforces signature requirements
- [ ] Error messages are clear and helpful

**Gate Check**: _Do not proceed to Phase 4 until all Phase 3 tasks are verified and tests pass._

- [ ] Date passed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 4: Frontend Updates

#### Update API Service

- [ ] Update frontend API service calls
  - [ ] Modify API calls to use new endpoints
  - [ ] Update parameter formats to match backend expectations
  - [ ] Add error handling for API responses
- [ ] Test with backend integration
  - [ ] Test all API service methods
  - [ ] Verify error handling works correctly

**Verification**: _Confirm API service methods work with updated backend._

- [ ] Test each method with real API calls
- [ ] Verify error cases are handled properly
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

#### Update Type Definitions

- [ ] Align frontend type definitions with backend models
  - [ ] Update Shift interface
  - [ ] Update ShiftTemplate interface
  - [ ] Update status enums
- [ ] Update frontend components using these types
  - [ ] Ensure all references use the updated types
  - [ ] Fix any type errors that arise

**Verification**: _Ensure frontend components work with updated types._

- [ ] Compile frontend with updated types
- [ ] Test components with real data
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Phase 4 Testing Milestone

- [ ] All frontend API calls succeed
- [ ] Frontend components render correctly with real data
- [ ] Type checking passes without errors

**Gate Check**: _Do not proceed to final testing until all Phase 4 tasks are verified and tests pass._

- [ ] Date passed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Final Testing

#### Comprehensive Testing

- [ ] Unit Tests
  - [ ] Backend serializers
  - [ ] Backend views and endpoints
  - [ ] Frontend service methods
  - [ ] Frontend components
- [ ] Integration Tests
  - [ ] End-to-end shift creation
  - [ ] Shift publication workflow
  - [ ] Staff assignment process
  - [ ] Template creation and application
  - [ ] Bulk operations
- [ ] Manual Testing
  - [ ] Admin shift creation workflow
  - [ ] Calendar view and navigation
  - [ ] Shift filters and search
  - [ ] Manager approval workflow
  - [ ] Shift copying between months

**Final Verification**: _Comprehensive validation of entire system._

- [ ] All automated tests pass
- [ ] Manual test scenarios complete successfully
- [ ] No regressions in existing functionality
- [ ] Date completed: ____________ Verified by: ____________
- [ ] Notes: _________________________________________________________________

### Final Sign-Off

- [ ] All phases completed successfully
- [ ] All tests pass
- [ ] Documentation updated to reflect changes
- [ ] Migration scripts and instructions prepared for deployment

**Implementation Approved and Ready for Deployment**

- [ ] Date: ____________ 
- [ ] Approved by: ____________
- [ ] Notes: _________________________________________________________________

## Conclusion

By implementing this plan, we will resolve the inconsistencies between the frontend and backend shift systems. This will ensure administrators can effectively manage shift scheduling, staff assignment, and approvals without encountering errors or data inconsistencies.

The most critical tasks are the API alignment and creating frontend-compatible serializers, which will resolve the majority of integration issues. The remaining tasks will enhance functionality and improve data integrity. 

Follow the implementation checklist rigorously to ensure each phase is properly completed and tested before moving on to the next phase, minimizing the risk of integration issues during deployment. 