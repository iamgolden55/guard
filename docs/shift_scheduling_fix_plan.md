# Shift Scheduling Integration Fix Plan

## 1. Summary of Issues

### Single Shift Creation
- **Field naming mismatches**: Frontend uses camelCase (`venueId`, `staffId`, `startTime`) while backend expects snake_case (`venue`, `staff_user`, `start_time`)
- **Missing fields**: Frontend doesn't send `required_security_role` which backend requires
- **Extra fields**: Frontend sends fields like `payRate`, `requirementsFire` that aren't in the base Shift model
- **Status value mismatch**: Frontend defaults to 'draft', backend expects 'open' or 'scheduled'

### Bulk Shift Creation
- **Data structure mismatch**: 
  - Frontend sends an array of individual shifts via `/api/shifts/bulk`
  - Main backend endpoint at `/shifts/bulk/` expects a pattern-based approach (date range + days of week)
- **Secondary endpoint issue**: The `/api/shifts/bulk` route does exist but has field naming inconsistencies
- **Field format issues**: Frontend sends some IDs as strings when backend might expect integers

## 2. Proposed Solutions

### 2.1. Single Shift Creation Fixes

#### Option A: Update Frontend to Match Backend (Recommended)
- Modify frontend code to use field names matching backend expectations
- Add missing required fields
- Adjust status values to match backend expectations
- Remove or handle extra fields appropriately

```javascript
// Before
const shiftData = {
  venueId: newShiftVenue,
  staffId: newShiftStaff || null,
  startTime: startDateTime,
  endTime: endDateTime,
  status: 'draft'
};

// After
const shiftData = {
  venue: newShiftVenue,
  staff_user: newShiftStaff || null,
  start_time: startDateTime,
  end_time: endDateTime,
  required_security_role: 'Security Officer', // Required field
  status: newShiftStaff ? 'scheduled' : 'open' // Appropriate status
};
```

#### Option B: Create API Middleware Adapter
- Create an adapter service that transforms frontend data to backend format
- Keep frontend code unchanged but route through adapter

### 2.2. Bulk Shift Creation Fixes

#### Option A: Continue Using Simplified Endpoint with Fixes
- Maintain current approach of sending array of individual shifts
- Correct field naming and format issues
- Ensure all required fields are included in each shift

```javascript
// Before
const shiftsToCreate = [
  {
    venueId: venueId.toString(),
    startTime: dateTimeString1,
    endTime: dateTimeString2
  }
];

// After
const shiftsToCreate = [
  {
    venue_id: parseInt(venueId),
    start_time: dateTimeString1,
    end_time: dateTimeString2,
    required_security_role: 'Security Officer'
  }
];
```

#### Option B: Switch to Pattern-Based Endpoint (More Powerful)
- Modify frontend to use the more powerful bulk creation endpoint
- Send date range, days of week, and time patterns instead of individual shifts
- Take advantage of backend's ability to generate shifts based on patterns

```javascript
// Before (array of shifts)
const shifts = [...]; // Array of many individual shifts

// After (pattern-based approach)
const bulkShiftRequest = {
  venue_id: venueId,
  start_date: startDate.toISOString(),
  end_date: endDate.toISOString(),
  start_time: "20:00",
  end_time: "04:00",
  days_of_week: [5, 6], // Friday and Saturday
  staff_ids: selectedStaff,
  notes: shiftNotes
};
```

## 3. Implementation Strategy

### Phase 1: API Analysis & Documentation
- Create detailed API mapping documentation
- Document all field transformations needed
- Identify all affected components in frontend

### Phase 2: Single Shift Creation Fix
- Update `createShift` function in frontend to match backend expectations
- Implement field mapping transformations
- Add appropriate error handling and validation
- Create unit tests to verify correct data formatting

### Phase 3: Bulk Shift Creation Fix
- Choose between maintaining current approach with fixes or switching to pattern-based endpoint
- Implement necessary changes to `handleCreateBulkShifts` function
- Update bulk shift modal component
- Add validation to ensure correct data format

### Phase 4: UI Enhancement
- Add missing fields to shift creation forms
- Update validation messages to match backend expectations
- Improve error handling to show specific field issues

### Phase 5: Testing
- Create comprehensive test suite covering all shift creation scenarios
- Test with various input combinations
- Verify backend properly receives and processes the data

## 4. Specific Code Changes

### 4.1. Single Shift Creation Updates

#### File: src/pages/admin/ShiftScheduling.tsx
```javascript
// Update createShift function
const createShift = async (shiftData: Partial<ShiftData>): Promise<boolean> => {
  try {
    // Transform data to match backend expectations
    const backendShiftData = {
      venue: shiftData.venueId,
      staff_user: shiftData.staffId || null,
      start_time: shiftData.startTime,
      end_time: shiftData.endTime,
      notes: shiftData.notes || "",
      required_security_role: "Security Officer", // Add required field
      status: shiftData.staffId ? "scheduled" : "open", // Set appropriate status
    };
    
    const response = await fetch('/api/shifts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendShiftData),
    });
    
    // Rest of function unchanged
  }
};

// Update handleNewShiftSubmit to include required fields
```

### 4.2. Bulk Shift Creation Updates

#### File: src/pages/admin/ShiftScheduling.tsx
```javascript
// Option A: Fix current approach
const handleCreateBulkShifts = async (shifts: Array<{
  venueId: string;
  startTime: string;
  endTime: string;
}>): Promise<void> => {
  // Transform shifts to match backend expectations
  const backendShifts = shifts.map(shift => ({
    venue_id: parseInt(shift.venueId),
    start_time: shift.startTime,
    end_time: shift.endTime,
    required_security_role: "Security Officer"
  }));
  
  // Rest of function using transformed data
};

// Option B: Switch to pattern-based endpoint
const handleCreateBulkShifts = async (bulkShiftDetails: BulkShiftDetails): Promise<void> => {
  const bulkRequest = {
    venue_id: bulkShiftDetails.venueId,
    start_date: bulkShiftDetails.startDate.toISOString(),
    end_date: bulkShiftDetails.endDate.toISOString(),
    start_time: bulkShiftDetails.startTime,
    end_time: bulkShiftDetails.endTime,
    days_of_week: bulkShiftDetails.daysOfWeek,
    staff_ids: bulkShiftDetails.selectedStaff,
    notes: ''
  };
  
  const response = await fetch('/api/scheduled-shifts/bulk/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bulkRequest)
  });
  
  // Handle response
};
```

### 4.3. Two-Tier Pay Rate System (Standing & Special Event Rates)

#### Overview
- The system must support two pay rates:
  - **Standing Pay Rate**: Default for regular shifts.
  - **Special Event Pay Rate**: Default for event shifts (can be overridden per shift).
- Admins can set both rates in the system settings.
- When creating a shift, the admin can select which rate applies (or override with a custom rate).
- Backend logic must ensure the correct rate is used for each shift.

#### UI Changes
- **Settings Page**: Add fields for both standing and special event pay rates.
- **Shift Creation (Single & Bulk)**:
  - Show both rates and allow selection.
  - If "Special Event" is selected, use the special event rate (default or custom).
  - Otherwise, use the standing rate.

#### Backend Changes
- Ensure the shift model supports a per-shift pay rate.
- If not provided, use the appropriate default from settings based on shift type (regular/event).
- Audit trail should record which rate was used and if it was overridden.

#### Example (Frontend to Backend)
```javascript
// In shift creation form
{
  ...,
  pay_rate: selectedPayRate, // Either standing, special event, or custom
  is_special_event: true/false // Indicates if special event rate applies
}
```

// Backend logic
if (shift.is_special_event) {
  shift.pay_rate = shift.pay_rate || settings.special_event_pay_rate;
} else {
  shift.pay_rate = shift.pay_rate || settings.standing_pay_rate;
}
```

## 5. Testing Strategy

### Unit Tests
- Create tests for field transformation functions
- Verify correct handling of edge cases (null staff, overnight shifts)

### Integration Tests
- Test end-to-end flow from UI to backend
- Verify shifts are created correctly
- Test both single and bulk creation

### Manual Testing Checklist
- [ ] Create single shift with staff assigned
- [ ] Create single shift without staff (open shift)
- [ ] Create overnight shift (crossing midnight)
- [ ] Create bulk shifts for specific days
- [ ] Create bulk shifts with staff assigned
- [ ] Verify all created shifts have correct fields and values

## 6. Rollout Plan

### Phase 1: Development (1 week)
- Implement changes in development environment
- Create unit tests
- Document API changes

### Phase 2: Testing (3-5 days)
- Deploy to test environment
- Conduct integration testing
- Fix any discovered issues

### Phase 3: Deployment (1-2 days)
- Deploy to production
- Monitor for errors
- Have rollback plan ready

### Phase 4: Verification (1 day)
- Verify production functionality
- Check logs for errors
- Confirm with admin users that shift creation works correctly

## 7. Risks and Mitigation

### Risks
- Breaking existing shift data
- Disrupting admin workflows
- Integration issues with other components

### Mitigation Strategies
- Comprehensive testing before deployment
- Maintain backward compatibility where possible
- Create data migration script if needed
- Schedule deployment during off-peak hours
- Provide clear documentation for admins 