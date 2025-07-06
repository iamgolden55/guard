# Architecture Overview

The AI Agents System is built with a modular, scalable architecture designed to handle complex natural language queries and execute operations on shift management data.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│                   (Web Interface)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────┐
│                   FastAPI Server                           │
│                 (Agent Orchestrator)                       │
├─────────────────────┬───────────────────────────────────────┤
│     Agent Router    │        Session Manager               │
└─────────────────────┼───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼───┐ ┌───────▼───┐ ┌───────▼───┐
│Analytics  │ │ Payroll   │ │Shift Mgmt │
│  Agent    │ │  Agent    │ │  Agent    │
└───────┬───┘ └───────┬───┘ └───────┬───┘
        │             │             │
┌───────▼─────────────▼─────────────▼───────┐
│              Tool Layer                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │Analytics│ │ Payroll │ │  Shift  │     │
│  │  Tool   │ │  Tool   │ │  Tool   │     │
│  └─────────┘ └─────────┘ └─────────┘     │
└───────────────────┬───────────────────────┘
                    │
┌───────────────────▼───────────────────────┐
│            NLP Processing                 │
│  ┌─────────────┐ ┌─────────────────────┐  │
│  │Query Parser │ │   Intent Parser     │  │
│  └─────────────┘ └─────────────────────┘  │
└───────────────────┬───────────────────────┘
                    │
┌───────────────────▼───────────────────────┐
│          Backend Integration              │
│  ┌─────────────┐ ┌─────────────────────┐  │
│  │ API Client  │ │   Context Manager   │  │
│  └─────────────┘ └─────────────────────┘  │
└───────────────────┬───────────────────────┘
                    │
┌───────────────────▼───────────────────────┐
│            External Services              │
│ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│ │Backend  │ │  Redis  │ │ LLM Provider│   │
│ │   API   │ │ (Cache) │ │(OpenAI/etc.)│   │
│ └─────────┘ └─────────┘ └─────────────┘   │
└───────────────────────────────────────────┘
```

## 🧩 Core Components

### 1. FastAPI Server (`server.py`)
**Role**: Central orchestrator and HTTP interface
- Routes incoming queries to appropriate agents
- Manages HTTP requests/responses
- Handles authentication and CORS
- Provides health checks and monitoring endpoints

**Key Features**:
- Automatic agent selection based on confidence scores
- Session management integration
- Error handling and logging
- API documentation generation

### 2. Agent Layer

#### Base Agent (`agents/base_agent.py`)
**Role**: Abstract foundation for all agents
- Defines common interface and capabilities
- Provides standardized response format
- Manages agent metadata and configuration

#### Specialized Agents
- **Analytics Agent**: Data analysis and reporting
- **Payroll Agent**: Payment and invoice management  
- **Shift Management Agent**: Shift creation and scheduling

### 3. Tool Layer (`tools/`)
**Role**: Modular, reusable operations
- **Base Tool**: Common interface for all tools
- **Analytics Tool**: Data aggregation and analysis
- **Payroll Tool**: Payment calculations and operations
- **Shift Tool**: Shift creation and management
- **Staff Tool**: Staff lookup and validation

### 4. Natural Language Processing (`parsers/`)

#### Query Parser (`parsers/query_parser.py`)
**Role**: High-level query classification
- Determines query type (analytics, payroll, shifts)
- Extracts primary intent
- Calculates confidence scores
- Identifies entities (staff names, venues, dates)

#### Intent Parser (`parsers/intent_parser.py`)
**Role**: Detailed parameter extraction
- Parses time ranges and date ranges
- Handles complex scheduling patterns
- Extracts frequency information (daily, weekly)
- Manages multi-staff scenarios

### 5. Backend Integration (`api/`)

#### API Client (`api/client.py`)
**Role**: Communication with existing systems
- HTTP client for backend API calls
- Authentication management
- Error handling and retries
- Data transformation and mapping

#### Context Manager (`core/context_manager.py`)
**Role**: Session and conversation management
- Redis-based session storage
- Conversation history tracking
- User preferences and state
- Cross-query context preservation

## 🔄 Data Flow

### 1. Query Processing Flow
```
User Query → FastAPI Server → Agent Selection → Query Parsing → Tool Execution → Response Generation
```

#### Detailed Steps:
1. **Query Reception**: FastAPI receives natural language query
2. **Agent Evaluation**: Each agent evaluates if it can handle the query
3. **Agent Selection**: Highest confidence agent is selected
4. **Query Parsing**: Selected agent parses query for entities and intent
5. **Tool Execution**: Agent uses appropriate tools to fetch/process data
6. **Response Generation**: Agent formats human-readable response
7. **Context Storage**: Conversation state is saved for future queries

### 2. Agent Decision Process
```python
async def select_best_agent(query: str) -> Agent:
    best_agent = None
    best_score = 0.0
    
    for agent in agents:
        can_handle, score = await agent.can_handle(query)
        if can_handle and score > best_score:
            best_agent = agent
            best_score = score
    
    return best_agent
```

### 3. Tool Execution Pattern
```python
async def execute_query(self, query: str) -> AgentResponse:
    # Parse query
    parsed = await self.parser.parse(query)
    
    # Execute tools
    result = await self.tool.execute(parsed.parameters)
    
    # Format response
    return self.format_response(result)
```

## 🛠️ Technology Stack

### Core Technologies
- **Python 3.8+**: Primary programming language
- **FastAPI**: Modern, fast web framework for APIs
- **Pydantic**: Data validation and settings management
- **asyncio**: Asynchronous programming for performance

### External Services
- **Redis**: Session management and caching
- **OpenAI/Anthropic**: LLM providers for advanced NLP
- **Backend API**: Existing shift management system

### Development Tools
- **uvicorn**: ASGI server for FastAPI
- **httpx**: Modern HTTP client
- **pytest**: Testing framework
- **logging**: Comprehensive logging system

## 🔧 Configuration Management

### Settings Hierarchy
1. **Environment Variables**: Production configuration
2. **Configuration Files**: Development defaults
3. **Runtime Parameters**: Dynamic adjustments

### Key Configuration Areas
- **LLM Providers**: API keys and model selection
- **Backend Integration**: API URLs and authentication
- **Redis Configuration**: Cache settings and connection
- **Agent Settings**: Capability definitions and thresholds

## 🚀 Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: Agents don't maintain internal state
- **Session Externalization**: Redis for shared session storage
- **Load Balancing**: Multiple FastAPI instances

### Performance Optimization
- **Async Operations**: Non-blocking I/O throughout
- **Connection Pooling**: Efficient HTTP client management
- **Caching Strategy**: Redis for frequently accessed data
- **Query Optimization**: Efficient database queries

### Monitoring & Observability
- **Structured Logging**: JSON-formatted logs for analysis
- **Metrics Collection**: Performance and usage statistics
- **Health Checks**: System status monitoring
- **Error Tracking**: Comprehensive error reporting

## 🔒 Security Architecture

### Authentication & Authorization
- **API Tokens**: Secure backend communication
- **Session Management**: Secure session handling
- **Input Validation**: Comprehensive data validation

### Data Protection
- **No Sensitive Logging**: Secure data handling
- **Encrypted Communication**: HTTPS for all external calls
- **Principle of Least Privilege**: Minimal required permissions

## 🔄 Integration Patterns

### Backend Integration
- **RESTful APIs**: Standard HTTP-based communication
- **Error Handling**: Graceful degradation on failures
- **Data Mapping**: Consistent data transformation
- **Versioning**: API version management

### Frontend Integration
- **REST API**: Standard HTTP endpoints
- **CORS Support**: Cross-origin request handling
- **WebSocket**: Real-time communication (future)
- **Authentication**: Token-based security

This architecture provides a robust, scalable foundation for natural language processing and automated operations in shift management systems.