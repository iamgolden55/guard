# AI Agents for Shift Management

A comprehensive AI agent system for handling natural language queries related to shift management, analytics, and payroll operations.

## Overview

This system provides intelligent agents that can understand and process natural language queries to perform various operations on shift management data. The agents use advanced NLP parsing and tool-based architecture to provide accurate responses and execute actions.

## Architecture

### Core Components

1. **Agents** - Specialized AI agents for different domains
2. **Tools** - Modular tools for data operations
3. **Parsers** - Natural language processing and intent classification
4. **API Client** - Communication with backend services
5. **Context Manager** - Conversation and session management

### Agents

#### Analytics Agent
Handles data analysis and reporting queries:
- Late start analysis
- Attendance statistics
- Performance trends
- Hours worked calculations

**Example queries:**
- "How many times did MR A start his shift late?"
- "What is the attendance rate for this week?"
- "Show me performance trends for punctuality"

#### Payroll Agent
Manages payment and invoice-related operations:
- Pay summary calculations
- Mark invoices as paid
- Payment status tracking
- Payroll reports

**Example queries:**
- "What is the total pay for MR C for last week?"
- "Mark MR A and MR B salary as paid"
- "Show me the invoice status"

#### Shift Management Agent
Handles shift creation and scheduling:
- Create shifts for staff
- Schedule recurring shifts
- Bulk shift operations
- Multi-staff assignments

**Example queries:**
- "Give MR A shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm"
- "Create shifts for MR B at LOCATION1 from 9 AM to 5 PM"
- "Schedule daily shifts for MR C next week"

## Setup

### Prerequisites

- Python 3.8+
- Redis (for session management)
- Access to shift management backend API

### Installation

1. Install dependencies:
```bash
cd agents
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Configure settings in `config/settings.py`

### Environment Variables

```bash
# LLM Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
LLM_PROVIDER=openai  # or anthropic

# Backend API
BACKEND_API_URL=http://localhost:8000
BACKEND_API_TOKEN=your_api_token

# Redis (for session management)
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=agents:

# Logging
LOG_LEVEL=INFO
```

## Usage

### Starting the Server

```bash
python server.py
```

The API will be available at `http://localhost:8001`

### API Endpoints

#### Process Query
```bash
POST /query
{
  "query": "How many times did MR A start his shift late?",
  "session_id": "optional_session_id",
  "user_id": "optional_user_id"
}
```

#### Agent-Specific Query
```bash
POST /agents/analytics/query
{
  "query": "Show me attendance stats for this week"
}
```

#### Get Agent Capabilities
```bash
GET /agents/capabilities
```

#### Health Check
```bash
GET /
```

### Testing

Run the test suite:
```bash
python test_agents.py
```

## Development

### Adding New Agents

1. Create agent class inheriting from `BaseAgent`
2. Implement required methods: `can_handle()` and `process_query()`
3. Add agent to server initialization
4. Create corresponding tools if needed

### Adding New Tools

1. Create tool class inheriting from `BaseTool`
2. Implement `execute()` method
3. Add tool to relevant agents

### Query Processing Flow

1. **Query Reception** - API receives natural language query
2. **Agent Selection** - System finds best agent based on confidence scores
3. **Query Parsing** - Extract entities, intent, and parameters
4. **Tool Execution** - Agent uses tools to fetch/process data
5. **Response Generation** - Format human-readable response
6. **Context Storage** - Save conversation history

## Configuration

### LLM Providers

The system supports multiple LLM providers:
- OpenAI (GPT-3.5, GPT-4)
- Anthropic (Claude)

Configure via `LLM_PROVIDER` environment variable.

### Backend Integration

The system integrates with your existing shift management backend via REST API. Configure endpoints in `api/client.py`.

### Caching

Redis is used for:
- Session management
- Conversation context
- Query result caching

## Query Examples

### Analytics Queries
```
- "How many times did John start late this month?"
- "What's the attendance rate for VENUE1?"
- "Show punctuality trends for last quarter"
- "Who worked the most hours last week?"
```

### Payroll Queries
```
- "Calculate total pay for Sarah last month"
- "Mark invoices as paid for John and Mary"
- "Show pending payments"
- "What's the average hourly rate?"
```

### Shift Management Queries
```
- "Create shifts for Mike at STORE1 every weekday 9-5"
- "Give Lisa shifts at CAFE from Tuesday to Saturday 2pm-8pm"
- "Schedule overnight shifts for security team"
- "Copy last week's shifts to next week"
```

## Error Handling

The system includes comprehensive error handling:
- Invalid queries return helpful suggestions
- API errors are gracefully handled
- Partial results are returned when possible
- Context is preserved across errors

## Monitoring

- Comprehensive logging at all levels
- Query performance metrics
- Agent success/failure rates
- Tool execution tracking

## Security

- API token authentication
- Input validation and sanitization
- No sensitive data logging
- Secure session management

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## License

[License information]