# Frequently Asked Questions (FAQ)

Common questions and answers about the AI Agents System, covering setup, usage, troubleshooting, and development.

## 🚀 Getting Started

### Q: What do I need to get started with the AI Agents System?
**A:** You need:
- Python 3.8 or higher
- An API key from OpenAI or Anthropic (just one is enough)
- Redis (for session management, optional for basic functionality)
- Access to your backend API (or you can start with mock data)

The minimal setup requires only a Python environment and an LLM API key.

### Q: Can I use this system without Redis?
**A:** Yes! While Redis enhances functionality with session management and caching, the system works without it. Sessions will be memory-based instead of persistent.

### Q: Do I need both OpenAI and Anthropic API keys?
**A:** No, you only need one. Choose either:
- **OpenAI**: Generally easier to get started, widely supported
- **Anthropic**: Often better for complex reasoning tasks

Set the `LLM_PROVIDER` environment variable to match your chosen provider.

### Q: Can I run this without my backend API?
**A:** Yes, for testing and demonstration purposes. The agents will:
- Still classify queries correctly
- Provide helpful responses about capabilities
- Return mock data for some operations
- Gracefully handle missing data connections

## 🔧 Configuration and Setup

### Q: Where do I put my API keys?
**A:** Create a `.env` file in the `agents` directory:
```bash
# Copy the template
cp .env.example .env

# Edit with your keys
OPENAI_API_KEY=sk-your-key-here
# OR
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Set the provider
LLM_PROVIDER=openai  # or anthropic
```

### Q: What if I get "Module not found" errors?
**A:** This usually means:
1. **Virtual environment not activated**:
   ```bash
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   ```

2. **Dependencies not installed**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Python path issues**:
   ```bash
   export PYTHONPATH=$PYTHONPATH:$(pwd)
   ```

### Q: How do I change the port the server runs on?
**A:** Set the `PORT` environment variable:
```bash
# In .env file
PORT=8002

# Or when starting
PORT=8002 python server.py

# Or with uvicorn directly
uvicorn server:app --port 8002
```

## 🤖 Agent Behavior

### Q: Why isn't my query being understood?
**A:** The query parser might not recognize your pattern. Try:

1. **Use more specific language**:
   - Instead of: "Show me data"
   - Try: "How many times did John start late this month?"

2. **Include key entities**:
   - Staff names: "John Smith", "MR A", "Sarah"
   - Venues: "Store1", "BIMM", "at Cafe"
   - Time periods: "last week", "this month", "yesterday"

3. **Check supported patterns** in the documentation

### Q: Which agent handles my query?
**A:** Agents are selected automatically based on confidence scores. You can check:
```bash
# See which agent would handle a query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "your query here"}'

# The response includes "agent_used" field
```

### Q: Can I force a specific agent to handle my query?
**A:** Yes, use agent-specific endpoints:
```bash
# Force analytics agent
curl -X POST "http://localhost:8001/agents/analytics/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "your query"}'

# Force payroll agent
curl -X POST "http://localhost:8001/agents/payroll/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "your query"}'
```

### Q: How do I see what capabilities each agent has?
**A:** Use the capabilities endpoint:
```bash
# All agents
curl http://localhost:8001/agents/capabilities

# Specific agent
curl http://localhost:8001/agents/analytics/capabilities
```

## 💾 Data and Integration

### Q: How do I connect to my existing database/API?
**A:** Update the API client configuration:

1. **Set your backend URL**:
   ```bash
   # In .env
   BACKEND_API_URL=http://your-backend.com:8000
   BACKEND_API_TOKEN=your-auth-token
   ```

2. **Modify API endpoints** in `api/client.py` if needed:
   ```python
   # Update endpoints to match your API
   response = await self.client.get("/your/api/endpoint/")
   ```

### Q: What data format does the system expect?
**A:** The system expects REST API endpoints returning JSON with these general formats:

**Staff Data**:
```json
[
  {
    "id": 1,
    "first_name": "John",
    "last_name": "Smith",
    "username": "jsmith"
  }
]
```

**Shift Data**:
```json
[
  {
    "id": 1,
    "staff_user": 1,
    "venue": 1,
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T17:00:00Z",
    "check_in_time": "2024-01-15T09:05:00Z",
    "status": "completed"
  }
]
```

### Q: Can I use this with a different backend framework?
**A:** Yes! The system works with any REST API. You may need to:
1. Update endpoint URLs in `api/client.py`
2. Adjust data mapping if your field names differ
3. Update authentication headers if needed

### Q: How do I add custom data sources?
**A:** Create a new tool or modify existing ones:

1. **Create custom tool**:
   ```python
   # tools/custom_tool.py
   class CustomTool(BaseTool):
       async def execute(self, parameters):
           # Your custom data access logic
           pass
   ```

2. **Use in agents**:
   ```python
   # In your agent
   self.custom_tool = CustomTool()
   result = await self.custom_tool.execute(params)
   ```

## 🎯 Usage and Queries

### Q: What types of questions can I ask?
**A:** The system handles three main categories:

**Analytics**:
- "How many times did John start late this month?"
- "What's the attendance rate for Store1?"
- "Show me performance trends for the team"

**Payroll**:
- "What is the total pay for Sarah last week?"
- "Mark Mike and Lisa's invoices as paid"
- "Show me pending payments"

**Shift Management**:
- "Create shifts for John at Store1 from 9 AM to 5 PM"
- "Give Sarah shifts at BIMM from Monday to Friday"
- "Schedule the team for weekend coverage"

### Q: How do I ask about multiple people?
**A:** Use natural language with "and":
- "How much did John and Sarah earn last week?"
- "Mark Mike, Lisa, and Alex as paid"
- "Create shifts for the whole team"

### Q: Can I ask follow-up questions?
**A:** Yes, if you use the same session ID:
```bash
# First query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me Johns performance", "session_id": "my_session"}'

# Follow-up query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What about Sarah?", "session_id": "my_session"}'
```

## 🔧 Customization and Development

### Q: How do I add a new type of query?
**A:** Follow these steps:

1. **Add new intent** to `parsers/query_parser.py`
2. **Add classification patterns** for your query type
3. **Create or modify tools** to handle the data operations
4. **Update agents** to handle the new intent
5. **Test with example queries**

See the [Creating New Agents](../development/new-agents.md) guide for details.

### Q: Can I modify the response format?
**A:** Yes, modify the agent's response formatting methods:

```python
def _format_response(self, result: Dict[str, Any]) -> str:
    # Customize the response format here
    message = f"Custom format: {result['data']}"
    return message
```

### Q: How do I add new data fields or calculations?
**A:** Modify the relevant tools:

```python
# In tools/analytics_tool.py
async def custom_calculation(self, parameters):
    # Add your custom calculation logic
    result = {
        'custom_metric': calculated_value,
        'additional_data': more_data
    }
    return result
```

### Q: Can I integrate with other LLM providers?
**A:** Yes, by extending the LLM client:

```python
# In core/llm_client.py
class CustomLLMClient(LLMClient):
    async def generate_response(self, messages, tools=None):
        # Implement your custom LLM integration
        pass
```

## 🚨 Troubleshooting

### Q: The server starts but queries fail. What's wrong?
**A:** Check these common issues:

1. **API connectivity**:
   ```bash
   curl $BACKEND_API_URL/api/v1/users/
   ```

2. **LLM API key**:
   ```bash
   echo $OPENAI_API_KEY
   # Should show your key
   ```

3. **Redis connection** (if using):
   ```bash
   redis-cli ping
   # Should return PONG
   ```

### Q: Queries are very slow. How do I optimize?
**A:** Try these optimizations:

1. **Enable caching**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

2. **Reduce data fetch size**:
   ```python
   # In API calls, add limits
   params = {"page_size": 100}
   ```

3. **Use parallel processing** for multiple operations

### Q: I get authentication errors with my backend API. What should I check?
**A:** Verify:

1. **Token format**:
   ```bash
   echo $BACKEND_API_TOKEN
   # Should be your actual token
   ```

2. **Token in headers**:
   ```bash
   curl -H "Authorization: Bearer $BACKEND_API_TOKEN" \
        $BACKEND_API_URL/api/v1/users/
   ```

3. **Token permissions** - ensure it has access to required endpoints

### Q: Memory usage keeps growing. Is there a memory leak?
**A:** Check for:

1. **Unclosed HTTP connections**:
   ```python
   # Always close clients
   async with httpx.AsyncClient() as client:
       # Use client here
   ```

2. **Large response caching** - clear caches periodically

3. **Context accumulation** - limit session context size

## 📊 Performance and Scaling

### Q: How many concurrent requests can the system handle?
**A:** This depends on your setup:
- **Single instance**: 100-500 concurrent requests
- **Multiple workers**: Scale with `--workers 4`
- **Load balancer**: Scale horizontally with multiple instances

### Q: How do I monitor system performance?
**A:** Use these approaches:

1. **Built-in health check**:
   ```bash
   curl http://localhost:8001/
   ```

2. **Enable debug logging**:
   ```bash
   LOG_LEVEL=DEBUG python server.py
   ```

3. **Monitor resource usage**:
   ```bash
   top -p $(pgrep -f "python server.py")
   ```

### Q: Can I use this in production?
**A:** Yes, with proper configuration:

1. **Use environment variables** for all secrets
2. **Set up proper logging** and monitoring
3. **Use Redis** for session management
4. **Deploy with multiple workers**:
   ```bash
   uvicorn server:app --workers 4 --host 0.0.0.0 --port 8001
   ```
5. **Set up reverse proxy** (nginx, etc.)

## 🔐 Security

### Q: How secure is the system?
**A:** Security features include:
- **API token authentication** for backend access
- **Input validation** on all queries
- **No sensitive data logging**
- **Secure session management**
- **CORS protection**

### Q: What data is stored or logged?
**A:** The system stores:
- **Session context** (in Redis, if configured)
- **Query logs** (without sensitive data)
- **Performance metrics**

It does NOT store:
- API keys or passwords
- Personal information in logs
- Raw query responses (unless debugging)

### Q: How do I secure the API endpoints?
**A:** Add authentication middleware:

```python
# In server.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def verify_token(token: str = Depends(security)):
    # Implement your token verification
    if not is_valid_token(token.credentials):
        raise HTTPException(status_code=401, detail="Invalid token")
    return token

# Apply to endpoints
@app.post("/query", dependencies=[Depends(verify_token)])
async def process_query(request: QueryRequest):
    # Your protected endpoint
```

## 💡 Best Practices

### Q: What are the best practices for query writing?
**A:** Follow these guidelines:

1. **Be specific**: Include names, dates, and locations
2. **Use natural language**: Write as you would speak
3. **Include context**: Specify time periods and scope
4. **Use examples**: Follow the patterns in documentation

### Q: How should I structure my data for best results?
**A:** Ensure your API provides:
- **Consistent field names** across endpoints
- **Complete timestamp data** for time-based queries
- **Proper relationships** between staff, venues, and shifts
- **Status fields** for tracking state

### Q: What's the recommended deployment architecture?
**A:** For production:

```
[Load Balancer] → [Multiple App Instances] → [Redis Cluster] → [Backend API]
                                          ↘ [Database]
```

- Use container orchestration (Docker/Kubernetes)
- Implement health checks and auto-scaling
- Set up monitoring and alerting
- Use secrets management for API keys

Have more questions? Check the [Common Issues](./common-issues.md) guide or review the specific component documentation for detailed technical information.