# 🚀 Quick AI System Testing Setup

## Step 1: Basic Environment Setup

```bash
# Navigate to agents directory
cd /Users/new/Projects/mead-security/remix2/agents

# Create environment file (you only need ONE API key)
cp .env.example .env

# Edit .env file with your API key
nano .env
```

## Step 2: Minimal .env Configuration

**Option A: Using OpenAI (Recommended for testing)**
```bash
# In .env file, add:
OPENAI_API_KEY=sk-your-actual-openai-key-here
LLM_PROVIDER=openai

# Backend API (can be mock for testing)
BACKEND_API_URL=http://localhost:8000
BACKEND_API_TOKEN=mock_token_for_testing

# Optional settings
AGENT_DEBUG=true
AGENT_LOG_LEVEL=INFO
```

**Option B: Using Anthropic**
```bash
# In .env file, add:
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key-here
LLM_PROVIDER=anthropic

# Backend API (can be mock for testing)
BACKEND_API_URL=http://localhost:8000
BACKEND_API_TOKEN=mock_token_for_testing
```

## Step 3: Install Dependencies

```bash
# Create virtual environment (if not already done)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Step 4: Run AI System Tests

```bash
# Run comprehensive test suite
python test_ai_system.py

# This will test:
# ✅ System dependencies
# ✅ Agent initialization
# ✅ Query classification
# ✅ Natural language processing
# ✅ Error handling
# ✅ Performance
```

## Step 5: Start the AI Server (if tests pass)

```bash
# Start the AI agents server
python server.py

# Server will start at: http://localhost:8001
```

## Step 6: Test AI Queries

```bash
# Test system health
curl http://localhost:8001/

# Test a simple query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What can you help me with?"}'

# Test analytics query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "How many times did John start late this month?"}'

# Test shift creation query
curl -X POST "http://localhost:8001/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "Create shifts for Sarah at Store1 from 9 AM to 5 PM tomorrow"}'
```

## What You Need to Get Started

### ✅ Required
- Python 3.8+
- One API key (OpenAI OR Anthropic)
- Virtual environment

### ⚠️ Optional (but recommended)
- Redis (for session management)
- Your Django backend running
- Proper API authentication

### 🚫 NOT Required for Initial Testing
- Full backend API connection
- Database access
- Redis
- Production configuration

## Expected Test Results

When you run `python test_ai_system.py`, you should see:

```
🚀 Starting AI Agents System Test Suite
========================================

📋 Testing System Setup...
  fastapi: ✅ OK
  openai: ✅ OK
  configuration: ✅ OK
  openai_key: ✅ Configured
  redis: ⚠️  Not available (optional)

🤖 Testing Agent Initialization...
  analytics: ✅ OK
  payroll: ✅ OK
  shift_management: ✅ OK

🔍 Testing Query Classification...
  Classification Accuracy: 90.0% (9/10)

🧠 Testing NLP Capabilities...
  ✅ staff_extraction: How many times did MR John Smith start late?
  ✅ multi_staff_extraction: Schedule Sarah and Mike for tomorrow
  ✅ venue_extraction: Create shifts at BIMM for the team

💬 Testing Real Query Processing...
  Testing: 'What can you help me with?'
  → Selected: analytics_agent (score: 0.75)
  ✅ Response: I can help you with analytics queries...

📊 OVERALL ASSESSMENT:
✅ System is ready for use!
✅ Core components are functional
✅ All agents initialized successfully
✅ Query classification is working well
```

## Troubleshooting

### "Module not found" errors
```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

### "No API key" errors
```bash
# Check your .env file
cat .env | grep API_KEY

# Make sure you have either OPENAI_API_KEY or ANTHROPIC_API_KEY set
```

### "Redis connection" warnings
```bash
# Redis is optional for testing - you can ignore these warnings
# Or install Redis:
brew install redis  # macOS
sudo apt install redis-server  # Ubuntu
```

## Next Steps After Testing

1. **If tests pass**: Your AI system is working! 🎉
2. **Connect to real backend**: Update BACKEND_API_URL and BACKEND_API_TOKEN
3. **Test with real data**: Try queries with actual staff names and venues
4. **Deploy**: Follow deployment guide for production use

The AI system is designed to work gracefully even without full backend connectivity, so you can test the core AI functionality immediately!