# API Endpoints Reference

Complete documentation for all REST API endpoints provided by the AI Agents System.

## 🌐 Base Information

- **Base URL**: `http://localhost:8001` (default development)
- **Content-Type**: `application/json`
- **Authentication**: Bearer token (when configured)

## 📡 Core Endpoints

### Health Check

#### GET `/`
Check system health and agent availability.

**Response**:
```json
{
  "status": "healthy",
  "agents": ["analytics", "payroll", "shift_management"],
  "version": "1.0.0"
}
```

**Status Codes**:
- `200`: System is healthy
- `503`: System unavailable

---

### Process Query

#### POST `/query`
Process a natural language query with automatic agent selection.

**Request Body**:
```json
{
  "query": "How many times did John start his shift late this month?",
  "session_id": "optional_session_id", 
  "user_id": "optional_user_id",
  "context": {
    "additional": "context_data"
  }
}
```

**Parameters**:
- `query` (string, required): Natural language query
- `session_id` (string, optional): Session identifier for context
- `user_id` (string, optional): User identifier
- `context` (object, optional): Additional context data

**Response**:
```json
{
  "success": true,
  "message": "Late Start Analysis for John Smith:\n\n📊 Total Shifts: 20\n⏰ Late Starts: 3 (15.0%)\n⏱️ Average Late: 12.5 minutes",
  "data": {
    "staff_id": 123,
    "total_shifts": 20,
    "late_starts": 3,
    "late_percentage": 15.0,
    "average_late_minutes": 12.5
  },
  "agent_used": "analytics",
  "session_id": "session_12345"
}
```

**Status Codes**:
- `200`: Query processed successfully
- `400`: Invalid request format
- `500`: Internal server error

---

### Agent-Specific Query

#### POST `/agents/{agent_name}/query`
Process a query with a specific agent.

**Path Parameters**:
- `agent_name`: One of `analytics`, `payroll`, `shift_management`

**Request Body**:
```json
{
  "query": "Calculate total pay for Sarah last week",
  "session_id": "optional_session_id"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pay Summary for Sarah Johnson...",
  "data": {
    "total_pay": 480.00,
    "total_hours": 40.0
  },
  "agent_used": "payroll",
  "session_id": "session_12345"
}
```

**Status Codes**:
- `200`: Query processed successfully
- `404`: Agent not found
- `400`: Agent cannot handle query
- `500`: Internal server error

---

### Agent Capabilities

#### GET `/agents/capabilities`
Get capabilities of all available agents.

**Response**:
```json
{
  "agents": {
    "analytics": {
      "name": "analytics_agent",
      "description": "Handle data analysis and reporting queries",
      "capabilities": [
        "Analyze staff punctuality and late starts",
        "Calculate attendance rates and statistics",
        "Generate performance trend reports"
      ]
    },
    "payroll": {
      "name": "payroll_agent", 
      "description": "Handle payroll, payments, and invoice queries",
      "capabilities": [
        "Calculate staff payment summaries",
        "Mark invoices as paid",
        "Check payment status"
      ]
    },
    "shift_management": {
      "name": "shift_management_agent",
      "description": "Handle shift creation, scheduling, and management queries", 
      "capabilities": [
        "Create shifts for staff members",
        "Schedule recurring shifts",
        "Assign shifts to multiple staff"
      ]
    }
  }
}
```

**Status Codes**:
- `200`: Capabilities retrieved successfully

---

### Specific Agent Capabilities

#### GET `/agents/{agent_name}/capabilities`
Get capabilities of a specific agent.

**Path Parameters**:
- `agent_name`: Agent identifier

**Response**:
```json
{
  "name": "analytics_agent",
  "description": "Handle data analysis and reporting queries",
  "capabilities": [
    "Analyze staff punctuality and late starts",
    "Calculate attendance rates and statistics", 
    "Generate performance trend reports",
    "Analyze working hours and overtime patterns",
    "Compare performance across venues and time periods"
  ]
}
```

**Status Codes**:
- `200`: Agent capabilities retrieved
- `404`: Agent not found

---

### Session Context

#### GET `/session/{session_id}/context`
Get context information for a session.

**Path Parameters**:
- `session_id`: Session identifier

**Response**:
```json
{
  "session_id": "session_12345",
  "user_id": "user_456",
  "message_count": 5,
  "preferences": {
    "preferred_timezone": "UTC",
    "default_venue": "Store1"
  }
}
```

**Status Codes**:
- `200`: Context retrieved successfully
- `404`: Session not found
- `503`: Context manager unavailable

---

### Example Queries

#### GET `/examples`
Get example queries for testing and documentation.

**Response**:
```json
{
  "analytics": [
    "How many times did MR A start his shift late?",
    "What is the attendance rate for this week?",
    "Show me performance trends for punctuality",
    "How many hours did MR B work last month?"
  ],
  "payroll": [
    "What is the total pay for MR C for last week?",
    "Mark MR A and MR B salary as paid",
    "Show me the invoice status",
    "Calculate pay summary for MR D this month"
  ],
  "shift_management": [
    "Give MR A shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm",
    "Create shifts for MR B at LOCATION1 from 9 AM to 5 PM",
    "Schedule daily shifts for MR C next week"
  ]
}
```

**Status Codes**:
- `200`: Examples retrieved successfully

## 📋 Request/Response Formats

### Standard Query Request
```json
{
  "query": "string (required)",
  "session_id": "string (optional)",
  "user_id": "string (optional)", 
  "context": "object (optional)"
}
```

### Standard Query Response
```json
{
  "success": "boolean",
  "message": "string",
  "data": "object (optional)",
  "agent_used": "string (optional)",
  "session_id": "string (optional)"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_TYPE",
  "details": {
    "additional": "error_information"
  }
}
```

## 🔐 Authentication

### Bearer Token Authentication
When authentication is enabled, include the token in the Authorization header:

```http
Authorization: Bearer your_api_token_here
```

### API Key Authentication
Alternatively, include the API key in headers:

```http
X-API-Key: your_api_key_here
```

## 📊 Response Data Structures

### Analytics Response Data
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

### Payroll Response Data
```json
{
  "staff_id": 123,
  "period": {"start": "2024-01-01", "end": "2024-01-07"},
  "total_pay": 480.00,
  "total_hours": 40.0,
  "regular_hours": 40.0,
  "overtime_hours": 0.0,
  "shifts_worked": 5,
  "venues": ["Store1", "Store2"],
  "average_hourly_rate": 12.00
}
```

### Shift Management Response Data
```json
{
  "success": true,
  "shifts_created": 6,
  "staff_count": 1,
  "venue_names": ["BIMM"],
  "date_range": {
    "start_date": "2024-01-15",
    "end_date": "2024-01-20",
    "frequency": "daily"
  },
  "time_range": {
    "start_time": "17:00",
    "end_time": "22:00"
  },
  "created_shifts": [
    {
      "staff_name": "John Smith",
      "venue_name": "BIMM",
      "date": "2024-01-15",
      "time": "5:00 PM to 10:00 PM",
      "shift_id": 12345
    }
  ]
}
```

## 🚀 Usage Examples

### cURL Examples

#### Basic Query
```bash
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many times did John start late this month?",
    "session_id": "my_session"
  }'
```

#### Agent-Specific Query
```bash
curl -X POST "http://localhost:8001/agents/payroll/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Calculate total pay for Sarah last week"
  }'
```

#### Get Agent Capabilities
```bash
curl -X GET "http://localhost:8001/agents/capabilities"
```

### JavaScript Examples

#### Basic Query with Fetch
```javascript
const response = await fetch('http://localhost:8001/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'Show me attendance stats for this week',
    session_id: 'user_session_123'
  })
});

const result = await response.json();
console.log(result.message);
```

#### Agent-Specific Query
```javascript
const payrollQuery = async (query) => {
  const response = await fetch('http://localhost:8001/agents/payroll/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });
  
  return await response.json();
};

const result = await payrollQuery('Mark John and Sarah as paid');
```

### Python Examples

#### Using requests library
```python
import requests

def query_agents(query, session_id=None):
    url = "http://localhost:8001/query"
    payload = {"query": query}
    
    if session_id:
        payload["session_id"] = session_id
    
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
result = query_agents("How many hours did Mike work last week?")
print(result["message"])
```

#### Async example with aiohttp
```python
import aiohttp
import asyncio

async def async_query(query):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'http://localhost:8001/query',
            json={'query': query}
        ) as response:
            return await response.json()

# Example usage
result = await async_query("Create shifts for John at Store1 this week")
```

## 🔧 Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Rate Limit**: 100 requests per minute per IP
- **Headers**: Rate limit information in response headers
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in window
  - `X-RateLimit-Reset`: Time when window resets

## 📈 Monitoring

### Health Monitoring
Regular health checks should be performed:

```bash
# Health check
curl -X GET "http://localhost:8001/"

# Expected response
{"status": "healthy", "agents": [...], "version": "1.0.0"}
```

### Performance Metrics
The API provides performance metrics at `/metrics` (when enabled):

- Request count and duration
- Agent selection performance
- Tool execution times
- Error rates by endpoint

This comprehensive API reference provides all the information needed to integrate with and use the AI Agents System effectively.