# Creating New Agents

Comprehensive guide for developers to create custom agents for the AI Agents System, extending functionality for specific business needs.

## 🎯 Overview

Creating a new agent involves implementing the `BaseAgent` interface and integrating with the existing tool ecosystem. This guide walks through the complete process from concept to deployment.

## 🏗️ Agent Development Process

### 1. Planning Your Agent

Before coding, define your agent's scope:

#### Agent Specification Template
```markdown
# Agent Name: [YourAgent]Agent

## Purpose
What specific domain or business function will this agent handle?

## Capabilities
- List specific capabilities your agent will provide
- What queries should it handle?
- What operations should it perform?

## Example Queries
- "Example query 1"
- "Example query 2" 
- "Example query 3"

## Required Tools
- What existing tools will you use?
- What new tools need to be created?

## Data Sources
- What APIs or databases will you access?
- What data format do you expect?

## Success Metrics
- How will you measure if the agent works correctly?
- What are the performance requirements?
```

### 2. Implementing the Base Agent

#### Step 1: Create Agent File
```python
# agents/your_agent.py
"""
Your custom agent for handling [specific domain] queries.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResponse
from tools.your_tool import YourTool
from tools.staff_tool import StaffTool
from parsers.query_parser import QueryParser, QueryIntent

logger = logging.getLogger(__name__)


class YourAgent(BaseAgent):
    """Agent for handling [specific domain] queries"""
    
    def __init__(self):
        super().__init__(
            name="your_agent",
            description="Handle [specific domain] queries and operations",
            capabilities=[
                "Capability 1: Describe what it does",
                "Capability 2: Another capability",
                "Capability 3: Third capability"
            ]
        )
        
        # Initialize tools
        self.your_tool = YourTool()
        self.staff_tool = StaffTool()
        self.query_parser = QueryParser()
    
    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """Check if this agent can handle the query"""
        try:
            # Parse query to understand intent
            parsed_query = await self.query_parser.parse_query(query)
            
            # Define intents this agent handles
            handled_intents = [
                QueryIntent.YOUR_CUSTOM_INTENT_1,
                QueryIntent.YOUR_CUSTOM_INTENT_2,
                # Add more intents as needed
            ]
            
            if parsed_query.intent in handled_intents:
                return True, parsed_query.confidence
            
            # Check for domain-specific keywords
            domain_keywords = [
                'keyword1', 'keyword2', 'keyword3'
            ]
            
            query_lower = query.lower()
            keyword_matches = sum(1 for keyword in domain_keywords if keyword in query_lower)
            
            if keyword_matches >= 2:
                confidence = min(0.8, 0.4 + (keyword_matches * 0.1))
                return True, confidence
            
            return False, 0.0
            
        except Exception as e:
            logger.error(f"Error checking if agent can handle query: {e}")
            return False, 0.0
    
    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process a query specific to this agent's domain"""
        try:
            # Parse the query
            parsed_query = await self.query_parser.parse_query(query)
            
            # Route to specific handlers based on intent
            if parsed_query.intent == QueryIntent.YOUR_CUSTOM_INTENT_1:
                return await self._handle_intent_1(parsed_query, session_id)
            elif parsed_query.intent == QueryIntent.YOUR_CUSTOM_INTENT_2:
                return await self._handle_intent_2(parsed_query, session_id)
            else:
                return await self._handle_general_query(parsed_query, session_id)
                
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return AgentResponse(
                success=False,
                message=f"I encountered an error processing your query: {str(e)}",
                data={"error": str(e)}
            )
    
    async def _handle_intent_1(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle specific intent 1"""
        try:
            # Validate required parameters
            if not parsed_query.staff_names:
                return AgentResponse(
                    success=False,
                    message="I need a staff member's name to process this request."
                )
            
            # Use tools to get data
            result = await self.your_tool.execute({
                'action': 'specific_action',
                'staff_names': parsed_query.staff_names,
                'parameters': parsed_query.parameters
            })
            
            if 'error' in result:
                return AgentResponse(
                    success=False,
                    message=f"I couldn't process the request: {result['error']}"
                )
            
            # Format response
            message = self._format_response(result)
            
            return AgentResponse(
                success=True,
                message=message,
                data=result
            )
            
        except Exception as e:
            logger.error(f"Error handling intent 1: {e}")
            return AgentResponse(
                success=False,
                message=f"I encountered an error: {str(e)}"
            )
    
    async def _handle_general_query(self, parsed_query, session_id: str) -> AgentResponse:
        """Handle general queries that don't fit specific intents"""
        try:
            message = "I can help you with [your domain] queries. Here are some things I can do:\n\n"
            for capability in self.capabilities:
                message += f"• {capability}\n"
            
            message += "\nFor example, you can ask:\n"
            message += "• 'Example query 1'\n"
            message += "• 'Example query 2'\n"
            message += "• 'Example query 3'"
            
            return AgentResponse(
                success=True,
                message=message,
                data={'capabilities': self.capabilities}
            )
            
        except Exception as e:
            logger.error(f"Error handling general query: {e}")
            return AgentResponse(
                success=False,
                message=f"I encountered an error: {str(e)}"
            )
    
    def _format_response(self, result: Dict[str, Any]) -> str:
        """Format tool results into human-readable response"""
        try:
            # Customize this based on your result structure
            message = f"Results for your query:\n\n"
            
            if 'summary' in result:
                message += f"📊 Summary: {result['summary']}\n"
            
            if 'details' in result:
                message += f"📋 Details:\n"
                for detail in result['details']:
                    message += f"• {detail}\n"
            
            return message
            
        except Exception as e:
            logger.error(f"Error formatting response: {e}")
            return f"I have the results but encountered an error formatting them: {str(e)}"
```

#### Step 2: Add Custom Query Intents
```python
# In parsers/query_parser.py - add new intents to QueryIntent enum
class QueryIntent(Enum):
    # ... existing intents ...
    
    # Your custom intents
    YOUR_CUSTOM_INTENT_1 = "your_custom_intent_1"
    YOUR_CUSTOM_INTENT_2 = "your_custom_intent_2"
    YOUR_DOMAIN_ACTION = "your_domain_action"
```

#### Step 3: Add Classification Patterns
```python
# In parsers/query_parser.py - add patterns to classification_rules
self.classification_rules = {
    # ... existing rules ...
    
    # Your custom query type
    QueryType.YOUR_DOMAIN: {
        QueryIntent.YOUR_CUSTOM_INTENT_1: [
            r'your.*pattern.*here',
            r'another.*pattern',
            r'specific.*keywords'
        ],
        QueryIntent.YOUR_CUSTOM_INTENT_2: [
            r'different.*pattern',
            r'query.*format',
            r'action.*keyword'
        ]
    }
}
```

### 3. Creating Supporting Tools

#### Step 1: Create Tool File
```python
# tools/your_tool.py
"""
Tool for handling [specific domain] operations.
"""
import logging
from typing import Any, Dict, List, Optional

from tools.base_tool import BaseTool
from api.client import ShiftManagementAPI  # Or your custom API client

logger = logging.getLogger(__name__)


class YourTool(BaseTool):
    """Tool for [specific domain] operations"""
    
    def __init__(self):
        super().__init__(
            name="your_tool",
            description="Handle [specific domain] operations and data processing"
        )
        self.api_client = ShiftManagementAPI()
    
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool operations"""
        action = parameters.get("action", "default_action")
        
        if action == "specific_action":
            return await self.specific_action(
                parameters.get("staff_names", []),
                parameters.get("parameters", {})
            )
        elif action == "another_action":
            return await self.another_action(parameters)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def specific_action(self, staff_names: List[str], params: Dict[str, Any]) -> Dict[str, Any]:
        """Perform specific action with validation and error handling"""
        try:
            # Validate inputs
            if not staff_names:
                return {"error": "No staff names provided"}
            
            # Process each staff member
            results = []
            for staff_name in staff_names:
                # Get staff data
                staff_data = await self.api_client.get_staff(search_query=staff_name)
                
                if not staff_data:
                    results.append({
                        'staff_name': staff_name,
                        'error': 'Staff member not found'
                    })
                    continue
                
                # Perform your custom processing
                processed_data = await self._process_staff_data(staff_data[0], params)
                results.append({
                    'staff_name': staff_name,
                    'data': processed_data
                })
            
            return {
                'success': True,
                'results': results,
                'summary': f"Processed {len(results)} staff members"
            }
            
        except Exception as e:
            logger.error(f"Error in specific_action: {e}")
            return {"error": f"Failed to execute action: {str(e)}"}
    
    async def _process_staff_data(self, staff: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
        """Process individual staff member data"""
        # Implement your custom logic here
        return {
            'staff_id': staff['id'],
            'processed': True,
            'custom_metric': 'calculated_value'
        }
```

### 4. Integration and Testing

#### Step 1: Register Agent in Server
```python
# In server.py - add your agent to the agents dictionary
@app.on_event("startup")
async def startup_event():
    global agents, context_manager
    
    try:
        # ... existing code ...
        
        # Add your custom agent
        from agents.your_agent import YourAgent
        
        agents = {
            "analytics": AnalyticsAgent(),
            "payroll": PayrollAgent(),
            "shift_management": ShiftManagementAgent(),
            "your_domain": YourAgent(),  # Add your agent here
        }
        
        logger.info(f"Initialized {len(agents)} agents: {list(agents.keys())}")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
```

#### Step 2: Update Exports
```python
# In agents/__init__.py
from .your_agent import YourAgent

__all__ = [
    'BaseAgent', 
    'AgentResponse', 
    'AgentCapability', 
    'AnalyticsAgent',
    'PayrollAgent',
    'ShiftManagementAgent',
    'YourAgent'  # Add your agent
]

# In tools/__init__.py  
from .your_tool import YourTool

__all__ = [
    'BaseTool',
    'AnalyticsTool', 
    'StaffTool',
    'PayrollTool',
    'ShiftTool',
    'YourTool'  # Add your tool
]
```

#### Step 3: Create Tests
```python
# tests/test_your_agent.py
import pytest
from unittest.mock import AsyncMock, Mock

from agents.your_agent import YourAgent
from agents.base_agent import AgentResponse


class TestYourAgent:
    """Test suite for YourAgent"""
    
    @pytest.fixture
    def agent(self):
        agent = YourAgent()
        # Mock dependencies
        agent.your_tool = AsyncMock()
        agent.staff_tool = AsyncMock()
        return agent
    
    @pytest.mark.asyncio
    async def test_can_handle_domain_query(self, agent):
        """Test agent can identify relevant queries"""
        query = "Your domain specific query here"
        
        can_handle, confidence = await agent.can_handle(query)
        
        assert can_handle == True
        assert confidence > 0.6
    
    @pytest.mark.asyncio
    async def test_cannot_handle_irrelevant_query(self, agent):
        """Test agent rejects irrelevant queries"""
        query = "Completely unrelated query"
        
        can_handle, confidence = await agent.can_handle(query)
        
        assert can_handle == False
        assert confidence == 0.0
    
    @pytest.mark.asyncio
    async def test_process_valid_query(self, agent):
        """Test processing of valid query"""
        # Mock tool response
        agent.your_tool.execute.return_value = {
            'success': True,
            'results': [{'staff_name': 'John', 'data': {'processed': True}}],
            'summary': 'Processed 1 staff member'
        }
        
        query = "Process data for John"
        response = await agent.process_query(query, "test_session")
        
        assert response.success == True
        assert "John" in response.message
        assert response.data is not None
    
    @pytest.mark.asyncio
    async def test_handle_tool_error(self, agent):
        """Test error handling when tool fails"""
        # Mock tool error
        agent.your_tool.execute.return_value = {
            'error': 'Tool execution failed'
        }
        
        query = "Process data for John"
        response = await agent.process_query(query, "test_session")
        
        assert response.success == False
        assert "couldn't process" in response.message.lower()
```

## 🎨 Advanced Agent Patterns

### 1. Multi-Tool Agent
```python
class ComplexAgent(BaseAgent):
    """Agent that uses multiple tools for complex operations"""
    
    def __init__(self):
        super().__init__(
            name="complex_agent",
            description="Handle complex multi-step operations",
            capabilities=["Complex analysis", "Multi-source data", "Predictive insights"]
        )
        
        # Multiple specialized tools
        self.analytics_tool = AnalyticsTool()
        self.payroll_tool = PayrollTool()
        self.forecast_tool = ForecastTool()
        self.notification_tool = NotificationTool()
    
    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process query using multiple tools in sequence"""
        try:
            # Step 1: Get analytics data
            analytics_result = await self.analytics_tool.execute({
                'action': 'performance_summary',
                'period': 'last_month'
            })
            
            # Step 2: Get payroll data
            payroll_result = await self.payroll_tool.execute({
                'action': 'cost_analysis',
                'period': 'last_month'
            })
            
            # Step 3: Generate forecast
            forecast_result = await self.forecast_tool.execute({
                'action': 'predict_trends',
                'analytics_data': analytics_result,
                'payroll_data': payroll_result
            })
            
            # Step 4: Combine results and send notifications if needed
            combined_result = self._combine_results(analytics_result, payroll_result, forecast_result)
            
            if combined_result.get('requires_attention'):
                await self.notification_tool.execute({
                    'action': 'send_alert',
                    'message': combined_result['alert_message'],
                    'recipients': ['manager@company.com']
                })
            
            return AgentResponse(
                success=True,
                message=self._format_complex_response(combined_result),
                data=combined_result
            )
            
        except Exception as e:
            logger.error(f"Error in complex processing: {e}")
            return AgentResponse(
                success=False,
                message=f"Complex analysis failed: {str(e)}"
            )
```

### 2. Stateful Agent with Context
```python
class StatefulAgent(BaseAgent):
    """Agent that maintains conversation context"""
    
    def __init__(self):
        super().__init__(
            name="stateful_agent",
            description="Maintain conversation context for follow-up queries",
            capabilities=["Context awareness", "Follow-up questions", "Conversation memory"]
        )
        
        self.context_manager = ContextManager()
    
    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process query with context awareness"""
        try:
            # Get conversation context
            context = await self.context_manager.get_context(session_id)
            
            # Determine if this is a follow-up question
            is_followup = self._is_followup_question(query, context)
            
            if is_followup and context and context.last_query_result:
                # Handle follow-up based on previous context
                return await self._handle_followup(query, context)
            else:
                # Handle new query
                result = await self._handle_new_query(query, session_id)
                
                # Store context for future follow-ups
                await self.context_manager.store_query_result(session_id, {
                    'query': query,
                    'result': result.data,
                    'timestamp': datetime.now().isoformat()
                })
                
                return result
                
        except Exception as e:
            logger.error(f"Error in stateful processing: {e}")
            return AgentResponse(
                success=False,
                message=f"Context-aware processing failed: {str(e)}"
            )
    
    def _is_followup_question(self, query: str, context) -> bool:
        """Determine if query is a follow-up to previous conversation"""
        followup_indicators = [
            'what about', 'how about', 'and', 'also', 'more details',
            'show me more', 'expand on', 'tell me about'
        ]
        
        query_lower = query.lower()
        return any(indicator in query_lower for indicator in followup_indicators)
```

## 🔧 Agent Configuration

### Environment Configuration
```python
# In config/settings.py - add agent-specific settings
class AgentSettings:
    """Configuration for custom agents"""
    
    # Your agent settings
    YOUR_AGENT_ENABLED: bool = Field(True, env="YOUR_AGENT_ENABLED")
    YOUR_AGENT_TIMEOUT: int = Field(30, env="YOUR_AGENT_TIMEOUT")
    YOUR_AGENT_MAX_RESULTS: int = Field(100, env="YOUR_AGENT_MAX_RESULTS")
    
    # Tool settings
    YOUR_TOOL_CACHE_TTL: int = Field(300, env="YOUR_TOOL_CACHE_TTL")
    YOUR_TOOL_BATCH_SIZE: int = Field(50, env="YOUR_TOOL_BATCH_SIZE")
```

### Runtime Configuration
```python
class ConfigurableAgent(BaseAgent):
    """Agent with runtime configuration support"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(
            name="configurable_agent",
            description="Agent with configurable behavior",
            capabilities=["Configurable processing", "Adaptive behavior"]
        )
        
        self.config = config or {}
        self.timeout = self.config.get('timeout', 30)
        self.max_results = self.config.get('max_results', 100)
        self.enable_caching = self.config.get('enable_caching', True)
    
    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process query with configuration-driven behavior"""
        # Use configuration to modify behavior
        if self.enable_caching:
            cached_result = await self._check_cache(query)
            if cached_result:
                return cached_result
        
        # Process with timeout
        try:
            result = await asyncio.wait_for(
                self._internal_process(query, session_id),
                timeout=self.timeout
            )
            return result
        except asyncio.TimeoutError:
            return AgentResponse(
                success=False,
                message=f"Query processing timed out after {self.timeout} seconds"
            )
```

## 📊 Best Practices

### 1. Error Handling
```python
# Always wrap agent operations in try-catch
try:
    result = await self.tool.execute(parameters)
    if 'error' in result:
        return AgentResponse(success=False, message=f"Operation failed: {result['error']}")
    return AgentResponse(success=True, message="Success", data=result)
except Exception as e:
    logger.error(f"Agent error: {e}")
    return AgentResponse(success=False, message=f"Unexpected error: {str(e)}")
```

### 2. Input Validation
```python
# Validate all inputs before processing
async def _validate_inputs(self, parsed_query) -> Optional[str]:
    """Validate query inputs and return error message if invalid"""
    if not parsed_query.staff_names and self._requires_staff():
        return "This operation requires a staff member name"
    
    if not parsed_query.venue_names and self._requires_venue():
        return "This operation requires a venue name"
    
    if not parsed_query.date_references and self._requires_date():
        return "This operation requires a date or time period"
    
    return None  # All valid
```

### 3. Logging and Monitoring
```python
# Add comprehensive logging
logger.info(f"Agent {self.name} processing query", extra={
    'agent': self.name,
    'query_length': len(query),
    'session_id': session_id,
    'user_id': user_id
})

# Log execution time
start_time = time.time()
result = await self.process_internal(query)
execution_time = time.time() - start_time

logger.info(f"Agent {self.name} completed", extra={
    'execution_time': execution_time,
    'success': result.success,
    'data_size': len(str(result.data)) if result.data else 0
})
```

### 4. Performance Optimization
```python
# Use parallel processing when possible
async def process_multiple_staff(self, staff_names: List[str]) -> List[Dict]:
    """Process multiple staff members in parallel"""
    tasks = [self.process_single_staff(name) for name in staff_names]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle any exceptions
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            processed_results.append({'staff': staff_names[i], 'error': str(result)})
        else:
            processed_results.append(result)
    
    return processed_results
```

## 🚀 Deployment and Testing

### Integration Testing
```bash
# Test your agent with the full system
python -c "
import asyncio
from agents.your_agent import YourAgent

async def test_integration():
    agent = YourAgent()
    
    # Test can_handle
    queries = [
        'Your test query 1',
        'Your test query 2',
        'Unrelated query'
    ]
    
    for query in queries:
        can_handle, confidence = await agent.can_handle(query)
        print(f'Query: {query}')
        print(f'Can handle: {can_handle}, Confidence: {confidence}')
        print()

asyncio.run(test_integration())
"
```

### Production Deployment
```bash
# Add your agent to the production server
# Update server.py to include your agent
# Deploy with your agent enabled

# Monitor agent performance
curl http://localhost:8001/agents/capabilities
curl -X POST http://localhost:8001/agents/your_domain/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test query for your agent"}'
```

This comprehensive guide provides everything needed to create, test, and deploy custom agents that integrate seamlessly with the existing AI Agents System.