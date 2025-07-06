# AI Agents System Documentation

Welcome to the comprehensive documentation for the AI Agents System. This system provides intelligent natural language processing capabilities for shift management, analytics, and payroll operations.

## 📚 Documentation Structure

### [Architecture Overview](./architecture.md)
- System design and components
- Data flow and interactions
- Technology stack

### [Agent Types](./agents/)
- [Analytics Agent](./agents/analytics-agent.md) - Data analysis and reporting
- [Payroll Agent](./agents/payroll-agent.md) - Payment and invoice management
- [Shift Management Agent](./agents/shift-management-agent.md) - Shift creation and scheduling

### [Tools & Components](./tools/)
- [Tool Architecture](./tools/tool-architecture.md) - How tools work
- [Analytics Tools](./tools/analytics-tools.md) - Data analysis capabilities
- [Payroll Tools](./tools/payroll-tools.md) - Payment operations
- [Shift Tools](./tools/shift-tools.md) - Shift management operations
- [Staff Tools](./tools/staff-tools.md) - Staff lookup and management

### [Natural Language Processing](./nlp/)
- [Query Parser](./nlp/query-parser.md) - Intent classification and entity extraction
- [Intent Parser](./nlp/intent-parser.md) - Advanced parsing capabilities
- [Supported Query Types](./nlp/query-types.md) - Complete query reference

### [API Reference](./api/)
- [REST API Endpoints](./api/endpoints.md) - Complete API documentation
- [Request/Response Formats](./api/formats.md) - Data structures
- [Authentication](./api/authentication.md) - Security and access control
- [Error Handling](./api/errors.md) - Error codes and troubleshooting

### [Setup & Configuration](./setup/)
- [Installation Guide](./setup/installation.md) - Step-by-step setup
- [Environment Configuration](./setup/configuration.md) - Settings and variables
- [Backend Integration](./setup/backend-integration.md) - Connecting to existing systems
- [Deployment Guide](./setup/deployment.md) - Production deployment

### [Use Cases & Examples](./examples/)
- [Analytics Use Cases](./examples/analytics-examples.md) - Real-world analytics scenarios
- [Payroll Use Cases](./examples/payroll-examples.md) - Payment management examples
- [Shift Management Use Cases](./examples/shift-examples.md) - Scheduling scenarios
- [Complex Queries](./examples/complex-queries.md) - Advanced query patterns

### [Development Guide](./development/)
- [Adding New Agents](./development/new-agents.md) - Creating custom agents
- [Creating Tools](./development/new-tools.md) - Building new capabilities
- [Extending Parsers](./development/extending-parsers.md) - NLP enhancements
- [Testing Guide](./development/testing.md) - Testing strategies and tools

### [Troubleshooting](./troubleshooting/)
- [Common Issues](./troubleshooting/common-issues.md) - Frequent problems and solutions
- [Performance Optimization](./troubleshooting/performance.md) - Tuning and optimization
- [Debugging Guide](./troubleshooting/debugging.md) - Debug tools and techniques
- [FAQ](./troubleshooting/faq.md) - Frequently asked questions

## 🚀 Quick Start

### Basic Query Examples

**Analytics**
```
"How many times did John start his shift late this month?"
"What's the attendance rate for our main venue?"
"Show me punctuality trends for the last quarter"
```

**Payroll**
```
"What is the total pay for Sarah last week?"
"Mark Mike and Lisa's invoices as paid"
"Show me all pending payments"
```

**Shift Management**
```
"Create shifts for Alex at Store1 every weekday from 9 AM to 5 PM"
"Give Maria shifts at Cafe from Tuesday to Saturday 2pm to 8pm"
"Schedule overnight shifts for the security team next week"
```

## 🎯 Key Features

- **Natural Language Understanding** - Process complex queries in plain English
- **Multi-Agent Architecture** - Specialized agents for different domains
- **Tool-Based Operations** - Modular, reusable tools for data operations
- **Backend Integration** - Seamless connection to existing APIs
- **Session Management** - Contextual conversations with memory
- **Flexible Deployment** - Docker, cloud, or on-premise options

## 📋 System Requirements

- Python 3.8+
- Redis (for session management)
- Access to shift management backend API
- OpenAI or Anthropic API key (for LLM capabilities)

## 🔗 Quick Links

- [Installation Guide](./setup/installation.md) - Get started in 5 minutes
- [API Reference](./api/endpoints.md) - Complete API documentation
- [Example Queries](./examples/) - Ready-to-use query examples
- [Troubleshooting](./troubleshooting/common-issues.md) - Common issues and solutions

---

*For additional support or questions, please refer to the specific documentation sections or contact the development team.*