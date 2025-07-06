# Shift Management Agent

The Shift Management Agent specializes in creating, scheduling, and managing shifts for staff members across different venues and time periods.

## 🔄 Overview

The Shift Management Agent handles complex scheduling operations, from simple single-shift creation to sophisticated recurring schedules. It can parse natural language requests and translate them into structured shift data, supporting both individual and bulk operations.

## 🎯 Capabilities

### Core Capabilities
- **Shift Creation**: Create individual and recurring shifts
- **Multi-Staff Scheduling**: Assign shifts to multiple staff simultaneously
- **Venue Management**: Schedule shifts across different venues
- **Recurring Patterns**: Daily, weekly, and custom frequency scheduling
- **Bulk Operations**: Handle large-scale shift creation
- **Schedule Validation**: Ensure no conflicts and proper coverage
- **Time Zone Handling**: Support for different time zones

### Supported Query Types
1. **Single Shift Creation**: Individual shift assignments
2. **Recurring Shifts**: Daily, weekly, or custom patterns
3. **Multi-Staff Shifts**: Same shift for multiple people
4. **Bulk Scheduling**: Complex scheduling scenarios
5. **Shift Modifications**: Updates and changes to existing shifts

## 🔍 Query Classification

### Intent Recognition
The Shift Management Agent identifies scheduling intents using pattern matching:

```python
# Shift creation patterns
create_shift_patterns = [
    r'give.*shifts',
    r'create.*shift',
    r'schedule.*shift',
    r'assign.*shift',
    r'from.*to.*everyday'
]

# Recurring patterns
recurring_patterns = [
    r'everyday',
    r'daily',
    r'weekly',
    r'from.*to.*every'
]
```

### Confidence Scoring
Confidence is based on:
- **Action Keywords**: give, create, schedule, assign
- **Time Indicators**: from/to, everyday, specific times
- **Staff References**: staff member names
- **Venue References**: location indicators

## 📝 Supported Queries

### Basic Shift Creation
**Query Examples**:
```
"Create a shift for John at Store1 from 9 AM to 5 PM tomorrow"
"Schedule Sarah for the evening shift at Cafe"
"Assign Mike to work at Venue1 on Friday from 2 PM to 10 PM"
```

**Response Format**:
```json
{
  "success": true,
  "shifts_created": 1,
  "staff_count": 1,
  "venue_names": ["Store1"],
  "created_shifts": [
    {
      "staff_name": "John Smith",
      "venue_name": "Store1", 
      "date": "2024-01-15",
      "time": "09:00 AM to 05:00 PM",
      "shift_id": 12345
    }
  ]
}
```

### Recurring Shift Creation
**Query Examples**:
```
"Give John shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm"
"Schedule Sarah for daily shifts at Store1 from 9 AM to 5 PM next week"
"Create weekly shifts for Mike at Venue1 every Tuesday from 2 PM to 10 PM"
```

**Processing Flow**:
1. **Parse Schedule Pattern**: Extract days, times, frequency
2. **Generate Date Range**: Calculate specific dates
3. **Create Multiple Shifts**: Generate individual shift records
4. **Validate Conflicts**: Check for scheduling conflicts

**Response Example**:
```
Successfully created 6 shifts!

👥 Staff: 1 member(s)
🏢 Venue(s): BIMM
📅 Dates: 2024-01-15 to 2024-01-20 (daily)
⏰ Time: 5:00 PM to 10:00 PM

📋 Created shifts:
• John Smith at BIMM on 2024-01-15
• John Smith at BIMM on 2024-01-16
• John Smith at BIMM on 2024-01-17
• John Smith at BIMM on 2024-01-18
• John Smith at BIMM on 2024-01-19
• John Smith at BIMM on 2024-01-20
```

### Multi-Staff Assignments
**Query Examples**:
```
"Schedule John and Sarah for shifts at Store1 from 9 AM to 5 PM tomorrow"
"Create shifts for the whole team at Venue1 this weekend"
"Assign Mike, Lisa, and Alex to work at Cafe from 2 PM to 8 PM daily"
```

## 🛠️ Implementation Details

### Agent Structure
```python
class ShiftManagementAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="shift_management_agent", 
            description="Handle shift creation, scheduling, and management queries",
            capabilities=[
                "Create shifts for staff members",
                "Schedule recurring shifts",
                "Assign shifts to multiple staff",
                "Copy existing shifts",
                "Delete and modify shifts",
                "Handle bulk shift operations",
                "Manage shift assignments at venues"
            ]
        )
        
        self.staff_tool = StaffTool()
        self.shift_tool = ShiftTool()
        self.query_parser = QueryParser()
        self.intent_parser = IntentParser()
```

### Query Processing Flow
1. **Intent Classification**: Identify shift management intent
2. **Entity Extraction**: Extract staff names, venues, times, dates
3. **Parameter Validation**: Ensure all required data is present
4. **Staff Resolution**: Find staff members in the system
5. **Venue Resolution**: Validate venue names
6. **Schedule Generation**: Create shift schedule based on pattern
7. **Shift Creation**: Execute shift creation via tools
8. **Response Formatting**: Format success/error response

### Advanced Parsing
The agent uses sophisticated parsing to handle complex scheduling requests:

```python
async def parse_shift_creation_intent(self, query: str):
    result = {
        'action': 'create_shift',
        'staff_names': await self.parse_staff_names(query),
        'venue_names': await self.parse_venue_names(query),
        'time_range': await self.parse_time_range(query),
        'date_range': await self.parse_date_range(query),
        'frequency': await self.parse_frequency(query)
    }
    
    # Add defaults for missing data
    if not result['date_range'] and result['frequency'] == 'daily':
        result['date_range'] = self._default_weekly_range()
    
    return result
```

## ⏰ Time and Date Parsing

### Time Range Extraction
```python
# Examples of supported time formats
time_formats = [
    "9 AM to 5 PM",
    "9:00 AM to 5:00 PM", 
    "09:00 to 17:00",
    "from 9 AM to 5 PM",
    "between 9:00 AM and 5:00 PM"
]
```

### Date Range Processing
```python
# Examples of supported date patterns
date_patterns = [
    "monday to saturday",
    "next week",
    "from January 15 to January 20",
    "tomorrow",
    "this weekend"
]
```

### Frequency Handling
```python
frequency_patterns = {
    'daily': ['everyday', 'daily', 'each day'],
    'weekly': ['weekly', 'every week'],
    'monthly': ['monthly', 'every month']
}
```

## 🏗️ Shift Creation Process

### Single Shift Creation
```python
async def create_single_shift(self, staff_id, venue_id, start_time, end_time):
    shift_data = {
        "staff_user": staff_id,
        "venue": venue_id,
        "start_time": start_time,
        "end_time": end_time,
        "status": "scheduled",
        "notes": "Created by AI agent"
    }
    
    result = await self.api_client.create_shift(shift_data)
    return result
```

### Recurring Shift Generation
```python
async def create_recurring_shifts(self, staff_list, venue_list, time_range, date_range, frequency):
    # Generate all shift dates
    shift_dates = self._generate_shift_dates(date_range, frequency)
    
    created_shifts = []
    for staff in staff_list:
        for venue in venue_list:
            for date in shift_dates:
                shift_data = self._create_shift_data(staff, venue, date, time_range)
                result = await self.api_client.create_shift(shift_data)
                created_shifts.append(result)
    
    return created_shifts
```

### Date Generation Logic
```python
def _generate_shift_dates(self, date_range, frequency):
    start_date = datetime.strptime(date_range['start_date'], '%Y-%m-%d')
    end_date = datetime.strptime(date_range['end_date'], '%Y-%m-%d')
    
    dates = []
    current_date = start_date
    
    if frequency == 'daily':
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(days=1)
    elif frequency == 'weekly':
        while current_date <= end_date:
            dates.append(current_date.strftime('%Y-%m-%d'))
            current_date += timedelta(weeks=1)
    
    return dates
```

## 🔧 Validation and Error Handling

### Input Validation
- **Staff Existence**: Verify staff members exist
- **Venue Validation**: Confirm venue names are valid
- **Time Validation**: Ensure logical time ranges
- **Date Validation**: Check date formats and ranges
- **Conflict Detection**: Identify scheduling conflicts

### Error Scenarios
```python
# Common error scenarios and responses
error_responses = {
    "staff_not_found": "I couldn't find a staff member named '{name}'. Please check the spelling.",
    "venue_not_found": "I couldn't find a venue named '{venue}'. Please verify the venue name.",
    "invalid_time": "The time format seems incorrect. Please use formats like '9 AM to 5 PM'.",
    "missing_parameters": "I need more information to create the shift. Please specify {missing}."
}
```

## 📊 Bulk Operations

### Multi-Staff Handling
```python
async def handle_multi_staff_shifts(self, staff_names, shift_params):
    results = []
    
    for staff_name in staff_names:
        try:
            # Find staff member
            staff_result = await self.staff_tool.find_staff_by_name(staff_name)
            
            if staff_result.get('found'):
                # Create shifts for this staff member
                shift_result = await self.create_shifts_for_staff(
                    staff_result['staff'], 
                    shift_params
                )
                results.append({
                    'staff_name': staff_name,
                    'success': True,
                    'shifts_created': shift_result['count']
                })
            else:
                results.append({
                    'staff_name': staff_name,
                    'success': False,
                    'error': 'Staff member not found'
                })
        
        except Exception as e:
            results.append({
                'staff_name': staff_name,
                'success': False,
                'error': str(e)
            })
    
    return results
```

### Batch Processing
- **Parallel Creation**: Create multiple shifts concurrently
- **Error Isolation**: Continue processing if individual shifts fail
- **Progress Tracking**: Report creation progress
- **Rollback Support**: Handle partial failures gracefully

## 🎨 Response Formatting

### Success Response
```python
def _format_shift_creation_response(self, result):
    shifts_created = result.get('shifts_created', 0)
    staff_count = result.get('staff_count', 0)
    
    message = f"Successfully created {shifts_created} shifts!\n\n"
    message += f"👥 Staff: {staff_count} member(s)\n"
    
    # Add venue information
    venues = result.get('venue_names', [])
    if venues:
        message += f"🏢 Venue(s): {', '.join(venues)}\n"
    
    # Add time and date details
    self._add_schedule_details(message, result)
    
    # Add shift summary
    self._add_shift_summary(message, result)
    
    return message
```

### Error Response
```python
def _format_error_response(self, error_type, details):
    error_messages = {
        'staff_not_found': f"I couldn't find staff member '{details['name']}'. Please check the spelling.",
        'venue_not_found': f"I couldn't find venue '{details['venue']}'. Please verify the venue name.",
        'invalid_time_format': "The time format seems incorrect. Please use formats like '9 AM to 5 PM' or '09:00 to 17:00'.",
        'missing_information': f"I need more information: {details['missing']}"
    }
    
    return error_messages.get(error_type, f"An error occurred: {details}")
```

## 🧪 Testing

### Unit Tests
```python
async def test_shift_creation():
    agent = ShiftManagementAgent()
    
    response = await agent.process_query(
        "Create a shift for John at Store1 from 9 AM to 5 PM tomorrow",
        "test_session"
    )
    
    assert response.success == True
    assert response.data['shifts_created'] == 1
```

### Integration Tests
- **End-to-End Scheduling**: Full scheduling workflow
- **Backend Integration**: API connectivity
- **Complex Scenarios**: Multi-staff, recurring patterns

## 📈 Use Case Examples

### Simple Scheduling
```
"Schedule John for tomorrow 9 AM to 5 PM at Store1"
"Create a shift for Sarah at Cafe this Friday evening"
"Assign Mike to work at Venue1 on Monday from 2 PM to 10 PM"
```

### Recurring Schedules
```
"Give John shifts at Store1 every weekday from 9 AM to 5 PM"
"Schedule Sarah for weekend shifts at Cafe from 10 AM to 6 PM"
"Create daily shifts for Mike at Venue1 from Monday to Friday"
```

### Complex Scenarios
```
"Schedule the entire team for holiday coverage next week"
"Create rotating shifts for John, Sarah, and Mike at all venues"
"Set up morning and evening shifts for the security team"
```

### Bulk Operations
```
"Create shifts for John, Sarah, Mike, and Lisa at Store1 this week"
"Schedule all part-time staff for weekend shifts"
"Assign the closing team to work at all venues this month"
```

The Shift Management Agent provides comprehensive scheduling capabilities, handling everything from simple shift creation to complex recurring patterns and bulk operations.