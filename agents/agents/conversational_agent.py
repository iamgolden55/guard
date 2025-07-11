"""
Conversational AI Agent using OpenAI for natural language interactions.
Handles general questions, system explanations, and provides a friendly interface.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResponse, AgentCapability
from core.llm_client import get_llm_client

logger = logging.getLogger(__name__)


class ConversationalAgent(BaseAgent):
    """Conversational AI agent for natural language interactions"""
    
    def __init__(self):
        super().__init__(
            name="conversational_agent",
            description="Handle general conversations, system questions, and provide friendly AI interactions"
        )
        
        # Get OpenAI client
        self.llm_client = get_llm_client()
        
        # Conversation contexts for each session
        self.conversation_histories = {}  # session_id -> messages
        
        # System prompt for the conversational agent
        self.system_prompt = """You are a helpful AI assistant for the Mead Security Shift Management System. 

You help users with:
- General questions about the system
- Explaining what you can do
- Friendly conversation
- Answering questions about shift management, analytics, and payroll features
- Providing guidance on how to use the system

IMPORTANT: You have access to specialized agents that can:
1. **Shift Management**: Create, modify, delete shifts for staff members
2. **Analytics**: Generate reports on staff performance, revenue, costs
3. **Payroll**: Calculate wages, overtime, track hours worked

For specific tasks like "create shifts" or "show me analytics", you should explain that you can help with those tasks and ask for more details.

Keep responses concise, friendly, and helpful. Use emojis when appropriate to make conversations more engaging.

Examples of what you can help with:
- "What can you do?" → Explain your capabilities
- "How do I create shifts?" → Guide them through the process
- "Tell me about the system" → Explain the Mead Security platform
- "Hello" → Friendly greeting
- General conversation and questions

You are intelligent, conversational, and can discuss a wide range of topics while being most helpful with system-related questions."""

    def _initialize_capabilities(self) -> None:
        """Initialize the conversational agent's capabilities"""
        capabilities = [
            AgentCapability(
                name="general_conversation",
                description="Handle friendly conversations and general questions",
                examples=["Hello", "How are you?", "What's your name?", "Tell me a joke"]
            ),
            AgentCapability(
                name="system_explanation",
                description="Explain system features and capabilities",
                examples=["What can you do?", "How does this system work?", "What features are available?"]
            ),
            AgentCapability(
                name="help_and_guidance",
                description="Provide help and guidance on using the system",
                examples=["How do I create shifts?", "How do I run analytics?", "What's the best way to...?"]
            ),
            AgentCapability(
                name="feature_overview",
                description="Provide overviews of shift management, analytics, and payroll features",
                examples=["Tell me about shift management", "What analytics are available?", "How does payroll work?"]
            )
        ]
        
        for capability in capabilities:
            self.add_capability(capability)
    
    def _initialize_tools(self) -> None:
        """Initialize tools for the conversational agent"""
        # Conversational agent doesn't need specific tools
        # It uses the LLM client for natural language processing
        pass

    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """Check if this agent can handle the query"""
        try:
            query_lower = query.lower().strip()
            
            # FIRST: Don't handle ANY commands with "create" - let specialized agents handle them
            if 'create' in query_lower:
                return False, 0.0
            
            # High priority for general conversational queries
            conversational_patterns = [
                'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
                'what can you do', 'what do you do', 'help', 'how are you', 'who are you',
                'what is this', 'what is the system', 'tell me about', 'explain',
                'how do i', 'how can i', 'what features', 'what capabilities',
                'thanks', 'thank you', 'bye', 'goodbye'
            ]
            
            # Check for conversational patterns
            for pattern in conversational_patterns:
                if pattern in query_lower:
                    return True, 0.9
            
            # Check if it's a question about the system
            question_words = ['what', 'how', 'why', 'when', 'where', 'who', 'can you', 'do you']
            if any(word in query_lower for word in question_words):
                return True, 0.7
            
            # Check if it's asking about specific features but not a direct command
            feature_words = ['shift', 'analytics', 'payroll', 'system', 'platform', 'features']
            command_words = ['create', 'delete', 'generate', 'calculate', 'show me data', 'give', 'assign']
            
            has_feature_words = any(word in query_lower for word in feature_words)
            has_command_words = any(word in query_lower for word in command_words)
            
            # Don't handle direct shift management commands - let specialized agents handle those
            shift_command_patterns = ['give shift', 'assign shift', 'delete shift', 'modify shift', 'update shift']
            if any(pattern in query_lower for pattern in shift_command_patterns):
                return False, 0.0
            
            if has_command_words and 'shift' in query_lower:
                return False, 0.0
            
            if has_feature_words and not has_command_words:
                return True, 0.6
            
            # Fallback for general conversation
            if len(query.split()) <= 5 and not has_command_words:
                return True, 0.5
                
            return False, 0.0
            
        except Exception as e:
            logger.error(f"Error checking if conversational agent can handle query: {e}")
            return False, 0.0

    def _get_conversation_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get conversation history for a session"""
        if session_id not in self.conversation_histories:
            self.conversation_histories[session_id] = []
        return self.conversation_histories[session_id]

    def _add_to_conversation_history(self, session_id: str, role: str, content: str):
        """Add a message to conversation history"""
        if session_id not in self.conversation_histories:
            self.conversation_histories[session_id] = []
        
        self.conversation_histories[session_id].append({
            "role": role,
            "content": content
        })
        
        # Keep only last 20 messages to avoid token limits
        if len(self.conversation_histories[session_id]) > 20:
            self.conversation_histories[session_id] = self.conversation_histories[session_id][-20:]

    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process a conversational query using OpenAI"""
        try:
            logger.info(f"Processing conversational query: {query[:100]}...")
            
            # Get conversation history
            conversation_history = self._get_conversation_history(session_id)
            
            # Build messages for OpenAI
            messages = [{"role": "system", "content": self.system_prompt}]
            
            # Add conversation history
            messages.extend(conversation_history)
            
            # Add current user message
            messages.append({"role": "user", "content": query})
            
            # Get response from OpenAI
            response = await self.llm_client.generate_response(
                messages=messages,
                max_tokens=500,
                temperature=0.7
            )
            
            ai_response = response.get('content', 'I apologize, but I encountered an error. Please try again.')
            
            # Add to conversation history
            self._add_to_conversation_history(session_id, "user", query)
            self._add_to_conversation_history(session_id, "assistant", ai_response)
            
            return AgentResponse(
                content=ai_response,
                data={
                    "conversation_turn": len(conversation_history) // 2 + 1,
                    "agent_type": "conversational"
                }
            )
            
        except Exception as e:
            logger.error(f"Error processing conversational query: {e}")
            
            # Fallback response
            fallback_responses = {
                "hello": "👋 Hello! I'm your AI assistant for the Mead Security Shift Management System. I can help you with shift management, analytics, payroll, and answer any questions you have about the system. What would you like to know?",
                "what can you do": """🤖 I'm your AI assistant for shift management! Here's what I can help you with:

📋 **Shift Management:**
• Create shifts for staff members
• Modify existing shifts
• Delete shifts
• Schedule recurring shifts

📊 **Analytics:**
• Generate performance reports
• View revenue analytics
• Track staff productivity

💰 **Payroll:**
• Calculate wages and overtime
• Track hours worked
• Generate payroll reports

💬 **General Help:**
• Answer questions about the system
• Provide guidance on features
• Have friendly conversations

Try asking me something like:
• "How do I create shifts?"
• "Tell me about analytics"
• "Create shifts for John tomorrow"

What would you like to help you with? 😊""",
                "help": "🆘 I'm here to help! You can ask me about shift management, analytics, payroll, or general questions about the system. What specific help do you need?",
                "default": f"I understand you're asking about: '{query}'. I'm your AI assistant for the Mead Security system. I can help with shift management, analytics, payroll, and general questions. Could you be more specific about what you'd like to know?"
            }
            
            query_lower = query.lower().strip()
            
            if any(word in query_lower for word in ["hello", "hi", "hey"]):
                response_text = fallback_responses["hello"]
            elif any(word in query_lower for word in ["what can you do", "what do you do", "capabilities"]):
                response_text = fallback_responses["what can you do"]
            elif "help" in query_lower:
                response_text = fallback_responses["help"]
            else:
                response_text = fallback_responses["default"]
            
            return AgentResponse(
                content=response_text,
                data={"error": str(e), "fallback": True}
            )