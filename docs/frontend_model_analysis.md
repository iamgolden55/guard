# Frontend Analysis and Model Enhancement Requirements

## Overview
After analyzing the frontend implementation, several areas have been identified where the current models could be enhanced to better support the UI functionality and user experience. This document outlines the suggested additions and modifications to the existing models.

## 1. Staff Management Enhancements

### Training and Certification Tracking
**Frontend Reference**: `ProfilePage.tsx` (Lines 30-40)
```typescript
import {
  type StaffProfile,
  type SIALicense,
  SIALicenseType,
  Address,
  BankDetails,
  EmergencyContact,
  ProfileUpdateRequest
} from '../../types';
```
Current Implementation:
- Basic SIA license tracking
- Security qualifications

The profile page shows license management but lacks comprehensive training tracking.

Suggested Additions:
```python
class TrainingSession(models.Model):
    staff_user = models.ForeignKey(User, on_delete=models.CASCADE)
    training_type = models.CharField(max_length=100)
    instructor = models.ForeignKey(User, related_name='instructed_sessions')
    scheduled_date = models.DateTimeField()
    completion_date = models.DateTimeField(null=True)
    status = models.CharField(max_length=20)  # scheduled, completed, failed
    assessment_score = models.IntegerField(null=True)
    feedback = models.TextField(null=True)
```

### Performance Metrics
**Frontend Reference**: `AdminDashboard.tsx` (Lines 40-60)
```typescript
const [stats, setStats] = useState({
  activeShifts: 0,
  pendingApprovals: 0,
  totalStaff: 0,
  pendingInvoices: 0,
  venueCount: 0
});
```
The dashboard shows basic stats but lacks detailed performance metrics.

```python
class StaffPerformanceMetric(models.Model):
    staff_user = models.ForeignKey(User, on_delete=models.CASCADE)
    period_start = models.DateField()
    period_end = models.DateField()
    shifts_completed = models.IntegerField()
    on_time_percentage = models.DecimalField()
    client_feedback_score = models.DecimalField()
    incident_reports_filed = models.IntegerField()
    response_time_avg = models.IntegerField()  # in minutes
```

## 2. Venue Management Additions

### Equipment and Resource Tracking
**Frontend Reference**: `VenueManagement.tsx` (Lines 37-52)
```typescript
interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  capacity: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  hasFireSafetyRequirements: boolean;
  requiresCapacityMonitoring: boolean;
  requiresToiletChecks: boolean;
}
```
The venue interface shows requirements but lacks equipment management.

```python
class VenueEquipment(models.Model):
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    equipment_type = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100)
    status = models.CharField(max_length=20)
    last_maintenance = models.DateField()
    next_maintenance = models.DateField()
    assigned_to = models.ForeignKey(User, null=True)
```

### Zone Management
**Frontend Reference**: `ShiftChecks.tsx` (Lines 29-35)
```typescript
enum CheckType {
  FIRE_EXIT = 'fire-exit',
  CAPACITY = 'capacity',
  TOILET = 'toilet',
  ENFORCEMENT = 'enforcement'
}
```
The checks system implies different zones but lacks proper zone management.

```python
class VenueZone(models.Model):
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    capacity = models.IntegerField()
    requires_special_access = models.BooleanField()
    security_level = models.CharField(max_length=20)
    description = models.TextField()
```

## 3. Shift Management Enhancements

### Break Management
**Frontend Reference**: `ShiftExchange.tsx` (Lines 38-47)
```typescript
interface MyShift {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  venueName: string;
  venueId: number;
  status: string;
}
```
The shift interface lacks break tracking functionality.

```python
class ShiftBreak(models.Model):
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True)
    break_type = models.CharField(max_length=20)  # lunch, rest, emergency
    approved_by = models.ForeignKey(User, null=True)
    status = models.CharField(max_length=20)
```

### Incident Reporting
**Frontend Reference**: `ShiftChecks.tsx` (Lines 50-100)
```typescript
const fireExitForm = useFormik({
  initialValues: {
    exitName: '',
    isPassed: true,
    comments: ''
  },
  validationSchema: fireExitSchema,
  onSubmit: async (values, { resetForm }) => {
    // ...
  }
});
```
The checks system has basic reporting but lacks comprehensive incident tracking.

## 4. Communication and Notifications

### Announcement System
**Frontend Reference**: `AdminDashboard.tsx` (Lines 90-100)
```typescript
<PivotItem headerText="Quick Actions">
  <div className="p-4">
    <Stack tokens={{ childrenGap: 16 }}>
      <Text variant="large">Common Tasks</Text>
      // ... but lacks announcement functionality
    </Stack>
  </div>
</PivotItem>
```

### Staff Communications
**Frontend Reference**: `ShiftExchange.tsx` (Lines 53-67)
```typescript
interface SwapRequest {
  id: number;
  requestedByName: string;
  requestedById: number;
  requestedShiftId: number;
  requestedShiftDate: Date;
  requestedShiftVenue: string;
  requestedShiftTime: string;
  status: string;
}
```
Shows need for staff communication but lacks proper messaging system.

## 5. Reporting and Analytics

### Custom Report Templates
**Frontend Reference**: `AdminDashboard.tsx` (Lines 40-60)
```typescript
const [stats, setStats] = useState({
  activeShifts: 0,
  pendingApprovals: 0,
  totalStaff: 0,
  pendingInvoices: 0,
  venueCount: 0
});
```
Basic stats exist but lack customizable reporting.

### Analytics Tracking
**Frontend Reference**: `ProfilePage.tsx` (Lines 156-174)
```typescript
const getLicenseStatus = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(now.getMonth() + 3);
  // ... but lacks comprehensive analytics
};
```

## 6. Client/Customer Management

### Client Feedback System
**Frontend Reference**: `VenueManagement.tsx` (Lines 37-52)
```typescript
interface Venue {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // ... but lacks feedback system
}
```

## 7. Document Management

### Document Storage and Versioning
**Frontend Reference**: `ProfilePage.tsx` (Lines 30-40)
```typescript
import {
  type StaffProfile,
  type SIALicense,
  // ... but lacks document management
} from '../../types';
```

## 8. Task Management

### Task Assignment and Tracking
**Frontend Reference**: `ShiftChecks.tsx` (Lines 29-35)
```typescript
enum CheckType {
  FIRE_EXIT = 'fire-exit',
  CAPACITY = 'capacity',
  TOILET = 'toilet',
  ENFORCEMENT = 'enforcement'
  // ... but lacks comprehensive task management
}
```

## 9. Digital Signatures and Approvals

### Digital Signature Management
**Frontend Reference**: `SignatureCanvas.tsx` (Lines 1-30)
```typescript
interface SignatureCanvasProps {
  onSave: (signatureDataUrl: string) => void;
  width?: number;
  height?: number;
  label?: string;
  required?: boolean;
  errorMessage?: string;
}
```
The frontend has signature capture functionality but lacks a model to store and manage signatures.

```python
class DigitalSignature(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    signature_data = models.TextField()  # Base64 encoded signature image
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    last_used = models.DateTimeField(null=True)
    signature_type = models.CharField(max_length=50)  # e.g., 'shift_approval', 'document_signing'
    metadata = models.JSONField(null=True)  # Additional signature context
```

### Approval Workflow Tracking
**Frontend Reference**: `manager/Approvals.tsx` (Lines 43-58)
```typescript
interface Shift {
  id: number;
  staff: Staff;
  venue: {
    id: number;
    name: string;
  };
  startTime: string;
  endTime: string;
  duration: number;
  status: ShiftStatus;
  managerApproved: boolean;
  firesExitChecksCompleted: boolean;
  capacityChecksCompleted: boolean;
  toiletChecksCompleted: boolean;
  enforcementVisitsLogged: boolean;
}
```
The approval interface shows need for comprehensive approval tracking.

```python
class ApprovalWorkflow(models.Model):
    related_object_type = models.CharField(max_length=50)  # e.g., 'shift', 'timesheet'
    related_object_id = models.IntegerField()
    status = models.CharField(max_length=20)  # pending, approved, rejected
    submitted_by = models.ForeignKey(User, related_name='submitted_approvals')
    submitted_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User, null=True, related_name='approved_items')
    approved_at = models.DateTimeField(null=True)
    rejection_reason = models.TextField(null=True)
    signature = models.ForeignKey(DigitalSignature, null=True)
    required_checks = models.JSONField()  # List of required checks
    completed_checks = models.JSONField()  # List of completed checks
```

## 10. Compliance and Check Management

### Security Check Tracking
**Frontend Reference**: `manager/Approvals.tsx` (Lines 50-54)
```typescript
interface Shift {
  firesExitChecksCompleted: boolean;
  capacityChecksCompleted: boolean;
  toiletChecksCompleted: boolean;
  enforcementVisitsLogged: boolean;
}
```
The interface shows various security checks but needs better tracking.

```python
class SecurityCheckTemplate(models.Model):
    name = models.CharField(max_length=100)
    check_type = models.CharField(max_length=50)  # fire_exit, capacity, toilet, enforcement
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    frequency = models.CharField(max_length=20)  # hourly, daily, per_shift
    required_photos = models.BooleanField(default=False)
    required_signature = models.BooleanField(default=False)
    instructions = models.TextField()
    active = models.BooleanField(default=True)

class SecurityCheckLog(models.Model):
    template = models.ForeignKey(SecurityCheckTemplate, on_delete=models.CASCADE)
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE)
    performed_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20)  # passed, failed, needs_attention
    notes = models.TextField(null=True)
    photos = models.JSONField(null=True)
    signature = models.ForeignKey(DigitalSignature, null=True)
    location_data = models.JSONField(null=True)  # GPS coordinates if required
```

## 11. Enforcement Visit Management

### Enforcement Tracking
**Frontend Reference**: `manager/Approvals.tsx` (Line 54)
```typescript
interface Shift {
  enforcementVisitsLogged: boolean;
}
```
The interface indicates enforcement visit tracking but needs comprehensive management.

```python
class EnforcementVisit(models.Model):
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE)
    visit_time = models.DateTimeField()
    location = models.CharField(max_length=100)
    visit_type = models.CharField(max_length=50)  # routine, incident_response, scheduled
    findings = models.TextField()
    action_taken = models.TextField()
    requires_follow_up = models.BooleanField(default=False)
    follow_up_notes = models.TextField(null=True)
    photos = models.JSONField(null=True)
    signature = models.ForeignKey(DigitalSignature, null=True)
```

## Implementation Priority Updates

1. **Highest Priority**
   - Digital Signature Management
     **Reference**: Required for multiple approval workflows
   - Security Check Tracking
     **Reference**: Critical for compliance and safety

2. **High Priority**
   - Approval Workflow Tracking
     **Reference**: Essential for operational efficiency
   - Enforcement Visit Management
     **Reference**: Required for regulatory compliance

## Implementation Recommendations

1. **Priority Order**
   - Incident Reporting (High Priority)
     **Reference**: `ShiftChecks.tsx` shows immediate need
   - Break Management (High Priority)
     **Reference**: Missing in current shift management UI
   - Client Feedback System (Medium Priority)
     **Reference**: `VenueManagement.tsx` contact system
   - Task Management (Medium Priority)
     **Reference**: Multiple components show need
   - Analytics Tracking (Lower Priority)
     **Reference**: `AdminDashboard.tsx` basic stats

2. **Migration Strategy**
   - Create migrations in small, manageable batches
   - Start with core functionality enhancements
   - Add analytics and reporting features later

3. **Frontend Integration**
   - Update API endpoints to support new models
   - Add new components for incident reporting
   - Enhance dashboard with analytics
   - Add task management interface

4. **Security Considerations**
   - Implement role-based access for new features
   - Add audit logging for sensitive operations
   - Ensure proper data encryption for sensitive information

## Conclusion

These enhancements will significantly improve the system's functionality and better align with the frontend requirements. The additions focus on:

- Better tracking and accountability
- Enhanced communication features
- Improved reporting capabilities
- More comprehensive venue management
- Better staff performance monitoring

The implementation should be phased to minimize disruption to the existing system while providing immediate value through critical features like incident reporting and break management. 