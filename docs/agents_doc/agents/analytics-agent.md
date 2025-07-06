# Analytics Agent

The Analytics Agent specializes in data analysis and reporting queries related to shift management, attendance, and performance metrics.

## 📊 Overview

The Analytics Agent processes queries that require data aggregation, statistical analysis, and trend identification. It can handle complex analytical questions about staff performance, attendance patterns, and operational metrics.

## 🎯 Capabilities

### Core Capabilities
- **Late Start Analysis**: Track and analyze staff punctuality
- **Attendance Statistics**: Calculate attendance rates and patterns
- **Performance Trends**: Identify trends in reliability and punctuality
- **Hours Analysis**: Analyze working hours and overtime patterns
- **Venue Analytics**: Compare performance across different venues
- **Time-based Analysis**: Analyze data across different time periods

### Supported Query Types
1. **Punctuality Queries**: Late starts, on-time performance
2. **Attendance Queries**: Attendance rates, no-shows, cancellations
3. **Performance Queries**: Reliability scores, trend analysis
4. **Hours Queries**: Total hours, overtime analysis
5. **Comparative Queries**: Cross-venue, cross-staff comparisons

## 🔍 Query Classification

### Intent Recognition
The Analytics Agent uses sophisticated pattern matching to identify analytical intents:

```python
# Example patterns for late start analysis
late_start_patterns = [
    r'how many times.*late',
    r'late start.*count',
    r'started.*shift.*late',
    r'punctuality.*issues'
]

# Example patterns for attendance stats
attendance_patterns = [
    r'attendance.*statistics',
    r'how many.*shifts',
    r'attendance.*rate',
    r'show.*attendance'
]
```

### Confidence Scoring
The agent calculates confidence scores based on:
- **Keyword Matches**: Presence of analytics-specific terms
- **Pattern Strength**: Complexity and specificity of patterns
- **Entity Recognition**: Staff names, venues, time periods

## 📝 Supported Queries

### Late Start Analysis
**Query Examples**:
```
"How many times did John start his shift late this month?"
"Show me late start counts for all staff at Venue1"
"What's the average late arrival time for Maria?"
"Which staff members are consistently late?"
```

**Response Format**:
```json
{
  "staff_id": 123,
  "period": {"start": "2024-01-01", "end": "2024-01-31"},
  "total_shifts": 20,
  "late_starts": 3,
  "late_percentage": 15.0,
  "average_late_minutes": 12.5,
  "late_shift_details": [
    {
      "date": "2024-01-05",
      "venue": "Store1",
      "scheduled_time": "09:00",
      "actual_time": "09:15",
      "late_minutes": 15
    }
  ]
}
```

### Attendance Statistics
**Query Examples**:
```
"What's the attendance rate for this week?"
"Show me attendance statistics for Store1"
"How many shifts were cancelled last month?"
"What's the no-show rate for the evening shifts?"
```

**Response Format**:
```json
{
  "period": {"start": "2024-01-01", "end": "2024-01-07"},
  "total_shifts": 150,
  "completed_shifts": 140,
  "cancelled_shifts": 8,
  "no_show_shifts": 2,
  "attendance_rate": 93.3,
  "punctuality_rate": 85.7,
  "cancellation_rate": 5.3
}
```

### Performance Trends
**Query Examples**:
```
"Show me punctuality trends for the last quarter"
"What are the reliability trends for our team?"
"Analyze overtime patterns for Store1"
"Show performance improvement over time"
```

**Response Format**:
```json
{
  "metric": "punctuality",
  "time_range": "last_quarter",
  "top_performers": [
    {
      "staff_id": 123,
      "punctuality_score": 95.5,
      "total_shifts": 60,
      "on_time": 57,
      "late": 3
    }
  ],
  "average_punctuality": 87.3,
  "trend_direction": "improving"
}
```

## 🛠️ Implementation Details

### Agent Structure
```python
class AnalyticsAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="analytics_agent",
            description="Handle data analysis and reporting queries",
            capabilities=[
                "Analyze staff punctuality and late starts",
                "Calculate attendance rates and statistics", 
                "Generate performance trend reports",
                "Analyze working hours and overtime patterns",
                "Compare performance across venues and time periods"
            ]
        )
        
        self.analytics_tool = AnalyticsTool()
        self.staff_tool = StaffTool()
        self.query_parser = QueryParser()
```

### Query Processing Flow
1. **Intent Classification**: Determine specific analytics intent
2. **Entity Extraction**: Extract staff names, venues, time periods
3. **Parameter Validation**: Ensure required parameters are present
4. **Data Retrieval**: Use analytics tools to fetch and process data
5. **Statistical Analysis**: Perform calculations and aggregations
6. **Response Formatting**: Create human-readable response

### Tool Integration
The Analytics Agent primarily uses the `AnalyticsTool` for data operations:

```python
async def _handle_late_starts(self, parsed_query, session_id: str):
    # Find staff member
    staff_result = await self.staff_tool.find_staff_by_name(staff_name)
    
    # Analyze late starts
    result = await self.analytics_tool.execute({
        'action': 'late_starts',
        'staff_id': staff_id,
        'start_date': start_date,
        'end_date': end_date
    })
    
    # Format response
    return self._format_late_start_response(result)
```

## 📊 Data Analysis Capabilities

### Statistical Functions
- **Count Operations**: Count occurrences of events
- **Percentage Calculations**: Calculate rates and percentages
- **Average Calculations**: Mean values for continuous metrics
- **Trend Analysis**: Identify patterns over time
- **Comparison Analysis**: Compare across different dimensions

### Time Period Support
- **Relative Periods**: "last week", "this month", "last quarter"
- **Specific Dates**: "from 2024-01-01 to 2024-01-31"
- **Flexible Ranges**: "last 30 days", "past 3 months"

### Grouping and Filtering
- **By Staff**: Individual or group analysis
- **By Venue**: Location-specific metrics
- **By Time**: Daily, weekly, monthly aggregations
- **By Shift Type**: Different shift categories

## 🎨 Response Formatting

### Human-Readable Format
The Analytics Agent formats responses in a conversational, easy-to-understand format:

```python
def _format_late_start_response(self, staff_name: str, result: Dict):
    message = f"Late Start Analysis for {staff_name}:\n\n"
    message += f"📊 Total Shifts: {result['total_shifts']}\n"
    message += f"⏰ Late Starts: {result['late_starts']} ({result['late_percentage']}%)\n"
    message += f"⏱️ Average Late: {result['average_late_minutes']} minutes\n"
    
    if result['late_shift_details']:
        message += f"\n📋 Recent Late Shifts:\n"
        for shift in result['late_shift_details'][:3]:
            message += f"• {shift['date']} at {shift['venue']}: {shift['late_minutes']} min late\n"
    
    return message
```

### Data Structure
All responses include both human-readable messages and structured data:
- **Message**: Formatted text for display
- **Data**: Structured JSON for programmatic use
- **Success**: Boolean indicating operation status

## 🔧 Configuration

### Analytics Settings
```python
class AnalyticsConfig:
    # Late threshold (minutes after scheduled start)
    LATE_THRESHOLD_MINUTES = 15
    
    # Default time periods
    DEFAULT_ANALYSIS_PERIOD = 90  # days
    
    # Performance thresholds
    GOOD_ATTENDANCE_RATE = 95.0
    GOOD_PUNCTUALITY_RATE = 90.0
    
    # Trend analysis settings
    TREND_MINIMUM_PERIODS = 4
    TREND_SIGNIFICANCE_THRESHOLD = 5.0  # percentage
```

## 🚀 Performance Optimization

### Caching Strategy
- **Query Results**: Cache common analytics queries
- **Staff Lookups**: Cache staff information
- **Time Period Calculations**: Cache period boundaries

### Efficient Data Retrieval
- **Batch Operations**: Minimize API calls
- **Selective Fields**: Only fetch required data
- **Pagination**: Handle large datasets efficiently

## 🧪 Testing

### Unit Tests
```python
async def test_late_start_analysis():
    agent = AnalyticsAgent()
    
    # Test late start query
    response = await agent.process_query(
        "How many times did John start late this month?",
        "test_session"
    )
    
    assert response.success == True
    assert "Late Start Analysis" in response.message
    assert response.data is not None
```

### Integration Tests
- **End-to-End Query Processing**: Full query lifecycle
- **Backend Integration**: API connectivity and data flow
- **Error Handling**: Various failure scenarios

## 📈 Use Case Examples

### Operational Monitoring
```
"Show me today's attendance rate"
"Which venues have the highest no-show rates?"
"What's the punctuality trend for this week?"
```

### Performance Management
```
"Who are our most reliable staff members?"
"Show me performance improvements over the last quarter"
"Which staff need punctuality coaching?"
```

### Business Intelligence
```
"Compare attendance rates across all venues"
"Show me overtime trends for the past 6 months"
"What are the busiest hours based on shift data?"
```

The Analytics Agent provides powerful data analysis capabilities that help managers make informed decisions about staffing, operations, and performance management.