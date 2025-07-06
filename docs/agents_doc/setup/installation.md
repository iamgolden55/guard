# Installation Guide

Complete step-by-step installation guide for the AI Agents System.

## 🎯 Prerequisites

### System Requirements
- **Python**: 3.8 or higher
- **Memory**: Minimum 2GB RAM, 4GB recommended
- **Storage**: 1GB free space
- **Network**: Internet access for LLM API calls

### Required Services
- **Redis**: For session management and caching
- **Backend API**: Existing shift management system
- **LLM Provider**: OpenAI or Anthropic API access

## 🚀 Quick Start (5 Minutes)

### 1. Clone and Setup
```bash
# Navigate to your project
cd /Users/new/Projects/mead-security/remix2

# The agents folder should already exist
cd agents

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate
```

### 2. Install Dependencies
```bash
# Install all required packages
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, redis, openai; print('Dependencies installed successfully')"
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit configuration (see Configuration section below)
nano .env  # or use your preferred editor
```

### 4. Start the System
```bash
# Start the API server
python server.py

# The server will start at http://localhost:8001
```

### 5. Test Installation
```bash
# Test system health
curl http://localhost:8001/

# Expected response:
# {"status": "healthy", "agents": [...], "version": "1.0.0"}
```

## 🔧 Detailed Installation

### Step 1: Environment Setup

#### Create Project Directory
```bash
# If starting fresh (skip if already exists)
mkdir -p /path/to/your/project/agents
cd /path/to/your/project/agents
```

#### Python Virtual Environment
```bash
# Create virtual environment
python3 -m venv agents_env

# Activate environment
source agents_env/bin/activate

# Upgrade pip
pip install --upgrade pip
```

#### Verify Python Version
```bash
python --version
# Should show Python 3.8 or higher
```

### Step 2: Install Dependencies

#### Core Dependencies
```bash
# Install from requirements.txt
pip install -r requirements.txt
```

#### Manual Installation (if requirements.txt is missing)
```bash
# Core framework
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0

# HTTP client and async support
pip install httpx==0.25.2
pip install aiohttp==3.9.1

# Data validation and settings
pip install pydantic==2.5.0
pip install pydantic-settings==2.1.0

# LLM providers
pip install openai==1.3.7
pip install anthropic==0.7.8

# Session management
pip install redis==5.0.1

# Data processing
pip install pandas==2.1.4
pip install numpy==1.24.4

# Development and testing
pip install pytest==7.4.3
pip install pytest-asyncio==0.21.1
```

#### Verify Installation
```bash
# Test import of major components
python -c "
import fastapi
import redis
import openai
import anthropic
import pandas
print('All dependencies installed successfully')
"
```

### Step 3: Redis Setup

#### Install Redis

**macOS (using Homebrew)**:
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows**:
```bash
# Use Docker
docker run -d -p 6379:6379 redis:latest

# Or download Windows binary from Redis website
```

#### Test Redis Connection
```bash
# Test Redis connectivity
redis-cli ping
# Expected response: PONG

# Or using Python
python -c "
import redis
r = redis.Redis(host='localhost', port=6379, db=0)
print('Redis ping:', r.ping())
"
```

### Step 4: Configuration

#### Environment Configuration
Create and edit `.env` file:

```bash
# Copy template
cp .env.example .env

# Edit with your settings
nano .env
```

#### Required Configuration
```bash
# LLM Provider Configuration
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LLM_PROVIDER=openai  # or anthropic

# Backend API Configuration
BACKEND_API_URL=http://localhost:8000
BACKEND_API_TOKEN=your_backend_api_token

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=agents:
REDIS_SESSION_TTL=3600

# Server Configuration
HOST=0.0.0.0
PORT=8001
LOG_LEVEL=INFO

# Optional: Advanced Settings
CONTEXT_CACHE_TTL=1800
MAX_CONTEXT_MESSAGES=50
AGENT_TIMEOUT=30
```

#### Configuration Validation
```bash
# Test configuration
python -c "
from config.settings import settings
print('Configuration loaded successfully')
print(f'LLM Provider: {settings.llm_provider}')
print(f'Backend URL: {settings.backend_api_url}')
print(f'Redis URL: {settings.redis_url}')
"
```

### Step 5: Backend Integration

#### Test Backend Connectivity
```bash
# Test backend API connection
python -c "
import asyncio
from api.client import ShiftManagementAPI

async def test_connection():
    client = ShiftManagementAPI()
    try:
        # Test a simple API call
        staff = await client.get_staff()
        print(f'Backend connection successful. Found {len(staff)} staff members.')
    except Exception as e:
        print(f'Backend connection failed: {e}')
    finally:
        await client.close()

asyncio.run(test_connection())
"
```

#### Backend API Requirements
Your backend API should provide these endpoints:
- `GET /api/v1/users/` - Staff members
- `GET /api/v1/venues/` - Venues
- `GET /api/shifts/` - Shifts data
- `GET /api/v1/invoices/` - Invoice data
- `GET /api/v1/pay-rates/` - Pay rates

### Step 6: LLM Provider Setup

#### OpenAI Setup
```bash
# Test OpenAI connection
python -c "
import openai
from config.settings import settings

openai.api_key = settings.openai_api_key
try:
    # Simple test (this may incur small cost)
    response = openai.chat.completions.create(
        model='gpt-3.5-turbo',
        messages=[{'role': 'user', 'content': 'Hello'}],
        max_tokens=10
    )
    print('OpenAI connection successful')
except Exception as e:
    print(f'OpenAI connection failed: {e}')
"
```

#### Anthropic Setup
```bash
# Test Anthropic connection
python -c "
import anthropic
from config.settings import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
try:
    # Simple test (this may incur small cost)
    response = client.messages.create(
        model='claude-3-haiku-20240307',
        max_tokens=10,
        messages=[{'role': 'user', 'content': 'Hello'}]
    )
    print('Anthropic connection successful')
except Exception as e:
    print(f'Anthropic connection failed: {e}')
"
```

### Step 7: Start the System

#### Development Mode
```bash
# Start with auto-reload
python server.py

# Or using uvicorn directly
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

#### Production Mode
```bash
# Start production server
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

#### Verify System Health
```bash
# Health check
curl http://localhost:8001/

# Test query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What can you do?"}'

# Check agent capabilities
curl http://localhost:8001/agents/capabilities
```

## 🧪 Testing Installation

### Run Test Suite
```bash
# Run basic tests
python test_agents.py

# Run with pytest (if available)
pytest tests/ -v

# Test specific agent
python -c "
import asyncio
from agents.analytics_agent import AnalyticsAgent

async def test_agent():
    agent = AnalyticsAgent()
    print(f'Agent: {agent.name}')
    print(f'Capabilities: {len(agent.capabilities)}')

asyncio.run(test_agent())
"
```

### Integration Tests
```bash
# Test full pipeline
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many staff do we have?",
    "session_id": "test_session"
  }'
```

## 🐳 Docker Installation (Alternative)

### Using Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  agents:
    build: .
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379
      - BACKEND_API_URL=http://backend:8000
    depends_on:
      - redis
    volumes:
      - ./.env:/app/.env

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Build and Run
```bash
# Build and start
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f agents
```

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 8001
lsof -i :8001

# Kill process
kill -9 <PID>

# Or use different port
uvicorn server:app --port 8002
```

#### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Restart Redis
brew services restart redis  # macOS
sudo systemctl restart redis-server  # Linux
```

#### Import Errors
```bash
# Reinstall dependencies
pip install --force-reinstall -r requirements.txt

# Check Python path
python -c "import sys; print(sys.path)"
```

#### LLM API Issues
```bash
# Verify API keys
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Test with curl
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Log Analysis
```bash
# Check server logs
tail -f logs/agents.log

# Enable debug logging
export LOG_LEVEL=DEBUG
python server.py
```

## 📁 Directory Structure
After installation, your directory should look like:
```
agents/
├── agents/               # Agent implementations
├── api/                  # Backend integration
├── config/               # Configuration
├── core/                 # Core components
├── parsers/              # NLP processing
├── tools/                # Tool implementations
├── .env                  # Environment configuration
├── requirements.txt      # Dependencies
├── server.py            # Main server
└── test_agents.py       # Test suite
```

## ✅ Verification Checklist

- [ ] Python 3.8+ installed
- [ ] Virtual environment created and activated
- [ ] All dependencies installed without errors
- [ ] Redis running and accessible
- [ ] Environment configuration complete
- [ ] Backend API connectivity confirmed
- [ ] LLM provider API working
- [ ] Server starts without errors
- [ ] Health check returns success
- [ ] Test query processes successfully
- [ ] All agents respond to capability requests

## 🎉 Next Steps

After successful installation:

1. **Read the [Configuration Guide](./configuration.md)** for advanced settings
2. **Review [Backend Integration](./backend-integration.md)** for API setup
3. **Explore [Use Case Examples](../examples/)** for query patterns
4. **Set up monitoring and logging** for production use
5. **Configure frontend integration** if needed

Your AI Agents System is now ready to process natural language queries!