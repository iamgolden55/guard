# Incomplete Shifts Management System

## Overview

The Incomplete Shifts Management System provides managers with comprehensive tools to handle shifts that require manual intervention due to technical issues, staff emergencies, or other exceptional circumstances. This feature addresses real-world scenarios where staff members are present and working but unable to complete normal digital check-in/check-out procedures.

## Problem Statement

### Common Scenarios
- **Network Issues**: Staff cannot check in/out due to poor connectivity
- **Device Problems**: Mobile app crashes or device failures during shift
- **Staff Emergencies**: Unexpected situations requiring immediate response
- **System Maintenance**: Planned or unplanned system downtime
- **Training Issues**: New staff unfamiliar with check-in procedures

### Before This Feature
- Manual database edits required
- No audit trail for interventions
- Time-consuming resolution process
- Potential compliance issues
- Staff payment delays

## Solution Architecture

### Backend Implementation
**File**: `/backend/shifts/views.py`

#### New API Endpoints

1. **GET /api/shifts/incomplete/**
   - Returns shifts needing manager attention
   - Filters by check-in/check-out status and time overdue
   - Includes priority calculation and eligibility status

2. **POST /api/shifts/{id}/manual_checkin/**
   - Manager override for manual check-in
   - Requires manager signature and justification notes
   - Supports backdating for accurate time recording

3. **POST /api/shifts/{id}/manual_checkout/**
   - Manager override for manual check-out
   - Includes actual hours worked input
   - Maintains proper shift completion workflow

4. **POST /api/shifts/{id}/force_complete/**
   - Complete shift creation with custom parameters
   - Sets both check-in and check-out times
   - Requires actual hours worked for payroll accuracy

### Frontend Implementation
**File**: `/security-staff-portal/src/pages/manager/Approvals.tsx`

#### New "Incomplete Shifts" Tab
- Real-time monitoring dashboard
- Priority-based sorting and display
- Comprehensive manager action dialogs
- Search and filtering capabilities

## Data Structure

### Incomplete Shift Object
```typescript
interface IncompleteShift {
  id: number;
  type: 'no_checkin' | 'no_checkout';
  staff_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  venue_details: {
    id: number;
    name: string;
    address: string;
  };
  start_time: string;
  end_time: string;
  check_in_time?: string;
  hours_overdue: number;
  status: string;
  auto_checkout_eligible: boolean;
  force_timeout_eligible: boolean;
  priority: 'low' | 'medium' | 'high';
}
```

## Priority System

### Priority Levels
- **High Priority**: >2 hours overdue (Red badge)
- **Medium Priority**: 0.5-2 hours overdue (Yellow badge)
- **Low Priority**: <0.5 hours overdue (Green badge)

### Calculation Logic
```python
priority = 'high' if hours_overdue > 2 else 'medium' if hours_overdue > 0.5 else 'low'
```

## Manager Actions

### 1. Manual Check-in
**Use Case**: Staff worked but couldn't check in due to technical issues

**Required Fields**:
- Manager signature (digital signature)
- Manager notes (justification)
- Check-in time (allows backdating)

**Process**:
1. Manager clicks "Manual Check-in" button
2. Fills out intervention form
3. System updates shift status to "in_progress"
4. Logs action with manager details

### 2. Manual Check-out
**Use Case**: Staff completed shift but couldn't check out

**Required Fields**:
- Manager signature
- Manager notes
- Actual hours worked
- Check-out time (optional backdating)

**Process**:
1. Manager clicks "Manual Check-out" button
2. Enters actual hours worked
3. System updates shift status to "completed"
4. Prepares shift for payroll processing

### 3. Force Complete
**Use Case**: Complete shift creation for exceptional circumstances

**Required Fields**:
- Manager signature
- Manager notes
- Actual hours worked
- Check-in time
- Check-out time

**Process**:
1. Manager clicks "Force Complete" button
2. Enters all shift timing details
3. System creates complete shift record
4. Logs with WARNING level for audit attention

## Auto-Checkout Integration

### Eligibility Indicators
- **Auto-Checkout Eligible**: ✓ Eligible (Green)
- **Auto-Checkout Not Eligible**: ✗ Not Eligible (Red)
- **Force Timeout Ready**: ⚠ Ready (Red)
- **Force Timeout Pending**: ⏳ Pending (Gray)

### Interaction with Existing System
- Manual interventions take precedence over auto-checkout
- Auto-checkout continues to run for eligible shifts
- Force timeout (12-hour bypass) remains as ultimate fallback

## Audit Trail & Compliance

### Logging Requirements
All manager actions are logged with:
- Manager user ID and name
- Action type and timestamp
- Shift ID and staff member details
- Justification notes
- Before/after state changes

### Log Levels
- **INFO**: Normal manual check-in/check-out
- **WARNING**: Force complete actions (require extra attention)
- **ERROR**: Failed intervention attempts

### Database Changes
Manager notes are appended to shift records:
```
"Manual check-in by Admin2 User: Network issues during shift start"
"Force completed by Admin2 User: Staff completed full shift but network issues prevented normal checkout"
```

## Security Considerations

### Access Control
- Only users with 'manager' or 'admin' roles can access endpoints
- All actions require valid JWT authentication
- Manager signature required for all interventions

### Data Validation
- Signature cannot be empty
- Hours worked must be positive number
- Time fields validated as proper ISO format
- Manager notes limited to reasonable length

## User Interface

### Dashboard Features
- **Priority Indicators**: Visual priority badges (High/Medium/Low)
- **Issue Types**: Clear problem identification (No Check-in/No Check-out)
- **Hours Overdue**: Color-coded urgency display
- **Staff Information**: Name, venue, and contact details
- **Action Buttons**: Context-appropriate intervention options

### Manager Dialog
- **Dynamic Forms**: Fields adjust based on action type
- **Time Pickers**: HTML5 datetime-local for precise timing
- **Validation**: Real-time form validation
- **Confirmation**: Clear action confirmation before processing

## Error Handling

### Frontend Error Display
- API errors shown in MessageBar components
- Field validation errors highlighted
- Loading states during processing
- Success confirmations after actions

### Backend Error Responses
- Structured error messages with detail field
- Appropriate HTTP status codes
- Validation error details
- Authentication/authorization errors

## Performance Considerations

### Database Queries
- Optimized queries with select_related and prefetch_related
- Indexed fields for time-based filtering
- Efficient priority calculation

### Frontend Updates
- Real-time data refresh after actions
- Optimistic UI updates where appropriate
- Minimal re-renders through proper state management

## Testing Strategy

### Backend Testing
```bash
# Test incomplete shifts endpoint
curl -X GET http://localhost:8000/api/shifts/incomplete/ \
  -H "Authorization: Bearer <token>"

# Test manual check-in
curl -X POST http://localhost:8000/api/shifts/{id}/manual_checkin/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"manager_signature": "Manager Name", "manager_notes": "Network issues"}'
```

### Frontend Testing
1. Navigate to `/approvals` page
2. Click "Incomplete Shifts" tab
3. Verify data display and filtering
4. Test manual action dialogs
5. Confirm success/error handling

## Deployment Considerations

### Database Migrations
No new database migrations required - uses existing shift model fields

### Environment Variables
No additional environment variables needed

### Dependencies
No new dependencies added - uses existing Django/React stack

## Troubleshooting

### Common Issues

**Issue**: "Not found" error when accessing endpoints
**Solution**: Ensure Django server is restarted after code changes

**Issue**: Frontend showing HTML instead of JSON
**Solution**: Check API URL configuration in frontend code

**Issue**: 403 Forbidden errors
**Solution**: Verify user has manager/admin role permissions

### Debug Commands
```bash
# Check Django server logs
tail -f /tmp/django.log

# Test API endpoints directly
curl -X GET http://localhost:8000/api/shifts/incomplete/ \
  -H "Authorization: Bearer $(cat /tmp/token.txt)"

# Check frontend console for errors
# Open browser developer tools > Console tab
```

## Future Enhancements

### Potential Improvements
1. **Bulk Operations**: Handle multiple shifts simultaneously
2. **Email Notifications**: Alert managers of critical overdue shifts
3. **Mobile App**: Native mobile manager interface
4. **Reporting**: Analytics on manual intervention patterns
5. **Integration**: Connect with external HR systems

### Scalability Considerations
- Pagination for large datasets
- Background job processing for bulk operations
- Caching for frequently accessed data
- Database indexing optimization

## Conclusion

The Incomplete Shifts Management System provides a comprehensive solution for handling exceptional circumstances in shift management. By combining automated systems with manual override capabilities, it ensures operational continuity while maintaining proper audit trails and compliance requirements.

The system successfully addresses real-world scenarios where staff are present and working but unable to complete normal digital procedures, providing managers with the tools they need to resolve issues quickly and accurately.