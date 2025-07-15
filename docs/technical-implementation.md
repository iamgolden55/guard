# Technical Implementation: Incomplete Shifts Feature

## Architecture Overview

The Incomplete Shifts feature is built as an extension to the existing shift management system, providing managers with tools to handle exceptional circumstances that require manual intervention.

## Backend Implementation

### File Structure
```
backend/
├── shifts/
│   ├── views.py           # New API endpoints
│   ├── models.py          # Existing shift model (no changes)
│   ├── serializers.py     # Existing serializers (no changes)
│   └── urls.py            # Existing URL patterns (no changes)
└── api/
    └── models.py          # Shift model with existing fields
```

### New API Endpoints

#### 1. Incomplete Shifts List
```python
@action(detail=False, methods=['get'], url_path='incomplete')
def incomplete_shifts(self, request):
    """Get shifts that need manager attention (incomplete check-ins/check-outs)"""
```

**URL**: `GET /api/shifts/incomplete/`

**Response Format**:
```json
[
  {
    "id": 237,
    "type": "no_checkin",
    "staff_details": {
      "id": 20,
      "first_name": "Ninioritse",
      "last_name": "Great Eruwa",
      "email": "eruwagolden55@gmail.com"
    },
    "venue_details": {
      "id": 7,
      "name": "House",
      "address": "61 Duncombe Ln"
    },
    "start_time": "2025-07-11T11:00:00Z",
    "end_time": "2025-07-11T21:00:00Z",
    "hours_overdue": 79.0,
    "status": "scheduled",
    "auto_checkout_eligible": false,
    "force_timeout_eligible": false,
    "priority": "high"
  }
]
```

#### 2. Manual Check-in
```python
@action(detail=True, methods=['post'], url_path='manual_checkin')
def manual_checkin(self, request, pk=None):
    """Manager override: manually check in a staff member"""
```

**URL**: `POST /api/shifts/{id}/manual_checkin/`

**Request Body**:
```json
{
  "manager_signature": "Admin2 User",
  "manager_notes": "Network issues during shift start",
  "checkin_time": "2025-07-11T11:00:00Z"
}
```

#### 3. Manual Check-out
```python
@action(detail=True, methods=['post'], url_path='manual_checkout')
def manual_checkout(self, request, pk=None):
    """Manager override: manually check out a staff member"""
```

**URL**: `POST /api/shifts/{id}/manual_checkout/`

**Request Body**:
```json
{
  "manager_signature": "Admin2 User",
  "manager_notes": "Staff completed shift but app crashed",
  "checkout_time": "2025-07-11T21:00:00Z",
  "actual_hours": 10.0
}
```

#### 4. Force Complete
```python
@action(detail=True, methods=['post'], url_path='force_complete')
def force_complete(self, request, pk=None):
    """Manager override: force complete a shift with custom hours"""
```

**URL**: `POST /api/shifts/{id}/force_complete/`

**Request Body**:
```json
{
  "manager_signature": "Admin2 User",
  "manager_notes": "Complete shift creation due to technical issues",
  "actual_hours": 10.0,
  "checkin_time": "2025-07-11T11:00:00Z",
  "checkout_time": "2025-07-11T21:00:00Z"
}
```

### Database Schema

Uses existing Shift model fields:
```python
class Shift(models.Model):
    # ... existing fields ...
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    manager_notes = models.TextField(blank=True)
    check_in_signature = models.TextField(blank=True)
    check_out_signature = models.TextField(blank=True)
    actual_hours_worked = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
```

### Business Logic

#### Priority Calculation
```python
def calculate_priority(hours_overdue):
    if hours_overdue > 2:
        return 'high'
    elif hours_overdue > 0.5:
        return 'medium'
    else:
        return 'low'
```

#### Incomplete Shift Detection
```python
# No check-in shifts
no_checkin_shifts = Shift.objects.filter(
    start_time__lte=now,
    check_in_time__isnull=True,
    status='scheduled'
)

# No check-out shifts
no_checkout_shifts = Shift.objects.filter(
    end_time__lte=now,
    check_in_time__isnull=False,
    check_out_time__isnull=True,
    status='in_progress'
)
```

### Authorization & Security

#### Permission Checks
```python
if not (request.user.role in ['manager', 'admin'] or request.user.is_staff):
    return Response(
        {"detail": "Manager or admin permissions required"}, 
        status=status.HTTP_403_FORBIDDEN
    )
```

#### Input Validation
```python
if not manager_signature:
    return Response(
        {"detail": "Manager signature is required"}, 
        status=status.HTTP_400_BAD_REQUEST
    )
```

### Logging & Audit Trail

#### Log Levels
```python
# INFO: Normal manual interventions
logger.info(f"Manual check-in by {request.user.username} for shift {shift.id}")

# WARNING: Force complete actions
logger.warning(f"Force complete by {request.user.username} for shift {shift.id}")
```

#### Manager Notes Format
```python
new_note = f"Manual check-in by {request.user.get_full_name()}: {manager_notes}"
shift.manager_notes = f"{existing_notes}\n{new_note}" if existing_notes else new_note
```

## Frontend Implementation

### File Structure
```
security-staff-portal/src/
├── pages/
│   └── manager/
│       └── Approvals.tsx     # Enhanced with incomplete shifts tab
├── services/
│   └── shiftService.ts       # Existing service (no changes needed)
└── types/
    └── index.ts              # Existing types (no changes needed)
```

### Component Structure

#### New Interface
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

#### State Management
```typescript
// Incomplete Shifts State
const [incompleteShifts, setIncompleteShifts] = useState<IncompleteShift[]>([]);
const [filteredIncompleteShifts, setFilteredIncompleteShifts] = useState<IncompleteShift[]>([]);
const [showManualDialog, setShowManualDialog] = useState(false);
const [manualAction, setManualAction] = useState<'checkin' | 'checkout' | 'force_complete'>('checkin');
const [selectedShiftForManual, setSelectedShiftForManual] = useState<IncompleteShift | null>(null);
```

### API Integration

#### Data Fetching
```typescript
const loadIncompleteShifts = useCallback(async () => {
  try {
    const response = await fetch('http://localhost:8000/api/shifts/incomplete/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    setIncompleteShifts(data);
    setFilteredIncompleteShifts(data);
  } catch (error) {
    console.error('Failed to load incomplete shifts:', error);
  }
}, []);
```

#### Action Processing
```typescript
const processManualAction = useCallback(async () => {
  const endpoint = `http://localhost:8000/api/shifts/${selectedShiftForManual.id}/${manualAction}/`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  });
  
  // Handle response and reload data
}, [selectedShiftForManual, manualAction]);
```

### UI Components

#### Priority Indicator
```typescript
const PriorityPill: React.FC<{priority: 'low' | 'medium' | 'high'}> = ({ priority }) => {
  const backgroundColor = priority === 'high' ? '#EF4444' : 
                         priority === 'medium' ? '#F59E0B' : '#10B981';
  
  return (
    <div style={{ backgroundColor, /* ... */ }}>
      {priority.toUpperCase()}
    </div>
  );
};
```

#### Data Table Configuration
```typescript
const incompleteColumns: IColumn[] = [
  {
    key: 'priority',
    name: 'Priority',
    onRender: (item: IncompleteShift) => <PriorityPill priority={item.priority} />,
  },
  {
    key: 'type',
    name: 'Issue',
    onRender: (item: IncompleteShift) => (
      <div style={{ backgroundColor: item.type === 'no_checkin' ? '#EF4444' : '#F59E0B' }}>
        {item.type === 'no_checkin' ? 'No Check-in' : 'No Check-out'}
      </div>
    ),
  },
  // ... other columns
];
```

## Testing

### Backend Testing
```bash
# Test incomplete shifts endpoint
curl -X GET http://localhost:8000/api/shifts/incomplete/ \
  -H "Authorization: Bearer <token>"

# Test manual check-in
curl -X POST http://localhost:8000/api/shifts/237/manual_checkin/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "manager_signature": "Admin2 User",
    "manager_notes": "Network issues during shift start",
    "checkin_time": "2025-07-11T11:00:00Z"
  }'
```

### Frontend Testing
1. Navigate to `/approvals` page
2. Click "Incomplete Shifts" tab
3. Verify data loads correctly
4. Test manual action dialogs
5. Verify form validation
6. Test success/error handling

## Deployment

### No Database Changes Required
- Uses existing Shift model fields
- No migrations needed
- Backward compatible

### Configuration
- No new environment variables
- No additional dependencies
- Uses existing authentication system

### Restart Requirements
- Django server restart required after code deployment
- Frontend rebuild required for UI changes

## Performance Considerations

### Database Optimization
```python
# Optimized query with select_related
shifts = Shift.objects.filter(
    start_time__lte=now,
    check_in_time__isnull=True,
    status='scheduled'
).select_related('venue', 'staff_user')
```

### Frontend Optimization
- Debounced search functionality
- Efficient state updates
- Minimal re-renders through proper memoization

## Error Handling

### Backend Error Responses
```python
# Structured error format
return Response(
    {"detail": "Manager signature is required"}, 
    status=status.HTTP_400_BAD_REQUEST
)
```

### Frontend Error Display
```typescript
// Error state management
const [error, setError] = useState<string | null>(null);

// Error display component
{error && (
  <MessageBar messageBarType={MessageBarType.error}>
    {error}
  </MessageBar>
)}
```

## Security Considerations

### Authentication
- JWT token required for all endpoints
- Token validation on each request
- Automatic token refresh handling

### Authorization
- Role-based access control
- Manager/admin permissions required
- Per-shift access validation

### Data Validation
- Input sanitization
- Type checking
- Range validation for numeric fields

## Monitoring & Logging

### Application Logs
```python
# Django logging configuration
LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/django/incomplete_shifts.log',
        },
    },
    'loggers': {
        'shifts.views': {
            'handlers': ['file'],
            'level': 'INFO',
        },
    },
}
```

### Metrics to Track
- Number of manual interventions per day
- Most common issue types
- Average resolution time
- Manager action patterns

## Future Enhancements

### Planned Features
1. **Bulk Operations**: Handle multiple shifts at once
2. **Email Notifications**: Alert managers of critical issues
3. **Mobile Interface**: Native mobile app for managers
4. **Analytics Dashboard**: Trends and patterns analysis

### Technical Improvements
1. **WebSocket Integration**: Real-time updates
2. **Caching Layer**: Improved performance
3. **Background Jobs**: Asynchronous processing
4. **API Versioning**: Backward compatibility

---

**Note**: This implementation maintains backward compatibility and requires no database schema changes, making it safe for production deployment.