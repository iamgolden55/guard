# Common Issues & Solutions

Comprehensive troubleshooting guide for the AI Agents System, covering frequently encountered issues and their solutions.

## 🚨 Quick Diagnostic Checklist

Before diving into specific issues, run this quick diagnostic:

```bash
# 1. Check system health
curl http://localhost:8001/

# 2. Verify dependencies
python -c "import fastapi, redis, openai; print('Dependencies OK')"

# 3. Test Redis connection
redis-cli ping

# 4. Check configuration
python -c "from config.settings import settings; print('Config OK')"

# 5. Test backend API
curl $BACKEND_API_URL/api/v1/users/
```

## 🔧 Installation and Setup Issues

### 1. Python Version Compatibility

#### Problem
```
SyntaxError: invalid syntax
ModuleNotFoundError: No module named 'asyncio'
```

#### Solution
```bash
# Check Python version
python --version
# Should be 3.8 or higher

# If using older version, install newer Python
# macOS
brew install python@3.11

# Ubuntu
sudo apt update
sudo apt install python3.11

# Update virtual environment
deactivate
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Dependency Installation Failures

#### Problem
```
ERROR: Could not install packages due to an environment error
pip install failed for package X
```

#### Solution
```bash
# Clear pip cache
pip cache purge

# Upgrade pip and setuptools
pip install --upgrade pip setuptools wheel

# Install with verbose output to debug
pip install -v -r requirements.txt

# For specific packages that fail
pip install --no-cache-dir package_name

# Alternative: Use conda instead of pip
conda create -n agents_env python=3.11
conda activate agents_env
conda install fastapi uvicorn redis-py openai
```

### 3. Redis Connection Issues

#### Problem
```
redis.exceptions.ConnectionError: Error connecting to Redis
ConnectionRefusedError: [Errno 61] Connection refused
```

#### Solution
```bash
# Check if Redis is running
redis-cli ping
# Expected: PONG

# Start Redis service
# macOS (Homebrew)
brew services start redis

# Linux
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Windows (Docker)
docker run -d -p 6379:6379 redis:latest

# Check Redis configuration
redis-cli config get "*"

# Test connection with Python
python -c "
import redis
r = redis.Redis(host='localhost', port=6379, db=0)
print('Redis connection:', r.ping())
"
```

#### Configuration Fix
```bash
# Update .env file
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=agents:

# For Redis with password
REDIS_URL=redis://:password@localhost:6379

# For Redis Cluster
REDIS_URL=redis://localhost:7000,localhost:7001,localhost:7002
```

## 🌐 API and Network Issues

### 4. Port Already in Use

#### Problem
```
OSError: [Errno 48] Address already in use
uvicorn.error: Can't bind to 0.0.0.0:8001
```

#### Solution
```bash
# Find process using port 8001
lsof -i :8001
# or
netstat -tulpn | grep :8001

# Kill the process
kill -9 <PID>

# Use different port
uvicorn server:app --port 8002

# Or update configuration
# In .env file
PORT=8002
```

### 5. Backend API Connection Issues

#### Problem
```
httpx.ConnectError: Connection refused
Backend connection failed: 500 Internal Server Error
```

#### Solution
```bash
# Verify backend API is running
curl $BACKEND_API_URL/api/v1/users/

# Check API token
echo $BACKEND_API_TOKEN

# Test with correct headers
curl -H "Authorization: Bearer $BACKEND_API_TOKEN" \
     $BACKEND_API_URL/api/v1/users/

# Update .env configuration
BACKEND_API_URL=http://localhost:8000
BACKEND_API_TOKEN=your_actual_token
```

#### Common Backend Integration Fixes
```python
# In api/client.py - add debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Test API client separately
python -c "
import asyncio
from api.client import ShiftManagementAPI

async def test():
    client = ShiftManagementAPI()
    try:
        result = await client.get_staff()
        print(f'Success: {len(result)} staff members')
    except Exception as e:
        print(f'Error: {e}')
    finally:
        await client.close()

asyncio.run(test())
"
```

### 6. LLM Provider API Issues

#### Problem
```
openai.error.AuthenticationError: Incorrect API key
anthropic.APIError: Invalid API key
```

#### Solution
```bash
# Verify API keys are set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Test OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Anthropic key (requires POST request)
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# Update configuration
# In .env file
OPENAI_API_KEY=sk-your-actual-openai-key
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key
LLM_PROVIDER=openai  # or anthropic
```

## 🤖 Agent-Specific Issues

### 7. Agent Not Responding

#### Problem
```
Agent selection failed: No agent can handle this query
Agent timeout: Operation took too long
```

#### Solution
```bash
# Test individual agents
python -c "
import asyncio
from agents.analytics_agent import AnalyticsAgent

async def test():
    agent = AnalyticsAgent()
    can_handle, score = await agent.can_handle('test query')
    print(f'Can handle: {can_handle}, Score: {score}')

asyncio.run(test())
"

# Check agent capabilities
curl http://localhost:8001/agents/capabilities

# Test with specific agent
curl -X POST "http://localhost:8001/agents/analytics/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "How many staff do we have?"}'
```

#### Debug Agent Selection
```python
# Add debug logging to server.py
for agent_name, agent in agents.items():
    can_handle, score = await agent.can_handle(request.query)
    print(f"Agent {agent_name}: can_handle={can_handle}, score={score}")
```

### 8. Query Parsing Issues

#### Problem
```
Query could not be parsed
No entities extracted from query
Intent classification failed
```

#### Solution
```bash
# Test query parser directly
python -c "
import asyncio
from parsers.query_parser import QueryParser

async def test():
    parser = QueryParser()
    result = await parser.parse_query('How many times did John start late?')
    print(f'Query type: {result.query_type}')
    print(f'Intent: {result.intent}')
    print(f'Staff names: {result.staff_names}')

asyncio.run(test())
"
```

#### Improve Query Recognition
```python
# In parsers/query_parser.py - add debug patterns
def debug_pattern_matching(self, query: str):
    """Debug which patterns match"""
    for pattern_type, patterns in self.classification_rules.items():
        for intent, pattern_list in patterns.items():
            for pattern in pattern_list:
                if re.search(pattern, query.lower()):
                    print(f"Matched: {pattern_type}.{intent} - {pattern}")
```

## 📊 Data and Tool Issues

### 9. Database Connection Problems

#### Problem
```
Database connection timeout
SQL connection pool exhausted
Data retrieval failed
```

#### Solution
```bash
# Check database connectivity
python -c "
import asyncio
from api.client import ShiftManagementAPI

async def test_db():
    client = ShiftManagementAPI()
    try:
        # Test basic queries
        staff = await client.get_staff()
        shifts = await client.get_shifts({'limit': 5})
        venues = await client.get_venues()
        
        print(f'Staff: {len(staff)}')
        print(f'Shifts: {len(shifts)}')
        print(f'Venues: {len(venues)}')
        
    except Exception as e:
        print(f'Database test failed: {e}')
    finally:
        await client.close()

asyncio.run(test_db())
"

# Check API endpoints individually
curl $BACKEND_API_URL/api/v1/users/
curl $BACKEND_API_URL/api/shifts/
curl $BACKEND_API_URL/api/v1/venues/
```

### 10. Tool Execution Failures

#### Problem
```
Tool execution timeout
Analytics calculation failed
Shift creation failed
```

#### Solution
```bash
# Test tools individually
python -c "
import asyncio
from tools.analytics_tool import AnalyticsTool

async def test_tool():
    tool = AnalyticsTool()
    result = await tool.execute({
        'action': 'attendance_stats',
        'start_date': '2024-01-01',
        'end_date': '2024-01-07'
    })
    print(f'Tool result: {result}')

asyncio.run(test_tool())
"

# Check tool configuration
python -c "
from tools.staff_tool import StaffTool
tool = StaffTool()
print(f'Tool: {tool.name}')
print(f'Description: {tool.description}')
"
```

## 🔐 Security and Authentication Issues

### 11. Authentication Failures

#### Problem
```
401 Unauthorized
403 Forbidden
JWT token invalid
```

#### Solution
```bash
# Check token format
echo $BACKEND_API_TOKEN | base64 -d  # If JWT

# Test authentication manually
curl -H "Authorization: Bearer $BACKEND_API_TOKEN" \
     -H "Content-Type: application/json" \
     $BACKEND_API_URL/api/v1/users/

# Update API client with correct auth
# In api/client.py
def _get_headers(self) -> Dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    if self.auth_token:
        headers["Authorization"] = f"Bearer {self.auth_token}"
    
    return headers
```

### 12. CORS Issues

#### Problem
```
Access to fetch blocked by CORS policy
CORS error in browser console
```

#### Solution
```python
# In server.py - update CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],  # Specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# For development only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 📈 Performance Issues

### 13. Slow Response Times

#### Problem
```
Request timeout after 30 seconds
Query processing very slow
High memory usage
```

#### Solution
```bash
# Enable performance logging
export LOG_LEVEL=DEBUG
python server.py

# Monitor resource usage
top -p $(pgrep -f "python server.py")

# Profile specific queries
python -c "
import time
import asyncio
from agents.analytics_agent import AnalyticsAgent

async def profile_query():
    agent = AnalyticsAgent()
    
    start = time.time()
    result = await agent.process_query(
        'How many shifts last week?',
        'test_session'
    )
    end = time.time()
    
    print(f'Query took {end - start:.2f} seconds')
    print(f'Success: {result.success}')

asyncio.run(profile_query())
"
```

#### Optimization Strategies
```python
# Add caching to frequently used operations
from functools import lru_cache
import asyncio

class CachedOperations:
    def __init__(self):
        self._cache = {}
    
    async def get_staff_with_cache(self, search_query: str):
        if search_query in self._cache:
            return self._cache[search_query]
        
        result = await self.api_client.get_staff(search_query)
        self._cache[search_query] = result
        return result

# Implement connection pooling
httpx_client = httpx.AsyncClient(
    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
)
```

### 14. Memory Leaks

#### Problem
```
Memory usage constantly increasing
Out of memory errors
Python process killed by OS
```

#### Solution
```bash
# Monitor memory usage
import psutil
import os

def log_memory_usage():
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    print(f"Memory usage: {memory_info.rss / 1024 / 1024:.2f} MB")

# Check for unclosed connections
python -c "
import gc
import asyncio

# Force garbage collection
gc.collect()

# Check for unclosed resources
import httpx
clients = [obj for obj in gc.get_objects() if isinstance(obj, httpx.AsyncClient)]
print(f'Unclosed HTTP clients: {len(clients)}')
"
```

#### Memory Management Fixes
```python
# Ensure proper cleanup
class AgentManager:
    def __init__(self):
        self.agents = {}
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Cleanup all agents
        for agent in self.agents.values():
            if hasattr(agent, 'close'):
                await agent.close()

# Use context managers for API clients
async def safe_api_call():
    async with httpx.AsyncClient() as client:
        response = await client.get("...")
        return response.json()
```

## 🔍 Debugging Tools and Techniques

### Debug Mode Configuration
```bash
# Enable debug mode
export LOG_LEVEL=DEBUG
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Run with debug output
python -m pdb server.py

# Or use uvicorn with debug
uvicorn server:app --reload --log-level debug
```

### Logging Configuration
```python
# Enhanced logging configuration
import logging
import sys

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('agents.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Agent-specific logging
agent_logger = logging.getLogger('agents')
agent_logger.setLevel(logging.DEBUG)

# Tool-specific logging
tool_logger = logging.getLogger('tools')
tool_logger.setLevel(logging.DEBUG)
```

### Health Check Script
```python
#!/usr/bin/env python3
"""Comprehensive health check script"""
import asyncio
import sys
from typing import Dict, Any

async def health_check() -> Dict[str, Any]:
    """Run comprehensive health check"""
    results = {}
    
    # Test 1: Import dependencies
    try:
        import fastapi, redis, openai, anthropic
        results['dependencies'] = 'OK'
    except ImportError as e:
        results['dependencies'] = f'FAIL: {e}'
    
    # Test 2: Redis connection
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        results['redis'] = 'OK'
    except Exception as e:
        results['redis'] = f'FAIL: {e}'
    
    # Test 3: Configuration
    try:
        from config.settings import settings
        assert settings.backend_api_url
        results['configuration'] = 'OK'
    except Exception as e:
        results['configuration'] = f'FAIL: {e}'
    
    # Test 4: Backend API
    try:
        from api.client import ShiftManagementAPI
        client = ShiftManagementAPI()
        staff = await client.get_staff()
        await client.close()
        results['backend_api'] = f'OK ({len(staff)} staff)'
    except Exception as e:
        results['backend_api'] = f'FAIL: {e}'
    
    # Test 5: Agents
    try:
        from agents.analytics_agent import AnalyticsAgent
        agent = AnalyticsAgent()
        can_handle, score = await agent.can_handle('test query')
        results['agents'] = 'OK'
    except Exception as e:
        results['agents'] = f'FAIL: {e}'
    
    return results

if __name__ == "__main__":
    results = asyncio.run(health_check())
    
    print("Health Check Results:")
    print("=" * 40)
    
    all_ok = True
    for component, status in results.items():
        status_indicator = "✅" if status.startswith('OK') else "❌"
        print(f"{status_indicator} {component}: {status}")
        if not status.startswith('OK'):
            all_ok = False
    
    if all_ok:
        print("\n🎉 All systems operational!")
        sys.exit(0)
    else:
        print("\n⚠️  Some components have issues")
        sys.exit(1)
```

## 📞 Getting Help

If you continue to experience issues:

1. **Check the logs**: Enable debug logging and examine output
2. **Run health check**: Use the health check script above
3. **Review configuration**: Verify all environment variables
4. **Test components individually**: Isolate the failing component
5. **Check system resources**: Ensure adequate memory and disk space
6. **Update dependencies**: Ensure all packages are up to date

For additional support, include the following information:
- Operating system and Python version
- Complete error messages and stack traces
- Configuration file (with sensitive data removed)
- Health check results
- Steps to reproduce the issue