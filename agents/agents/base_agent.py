"""
Base agent interface for all AI agents in the system.
"""
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

from core.llm_client import LLMClient, get_llm_client
from core.context_manager import ContextManager

logger = logging.getLogger(__name__)


@dataclass
class AgentResponse:
    """Response from an agent"""
    content: str
    actions_taken: List[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None
    confidence: float = 1.0
    needs_confirmation: bool = False
    
    def __post_init__(self):
        if self.actions_taken is None:
            self.actions_taken = []


@dataclass
class AgentCapability:
    """Represents a capability of an agent"""
    name: str
    description: str
    parameters: Dict[str, Any] = None
    examples: List[str] = None
    
    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}
        if self.examples is None:
            self.examples = []


class BaseAgent(ABC):
    """Abstract base class for all AI agents"""
    
    def __init__(
        self,
        name: str,
        description: str,
        llm_client: Optional[LLMClient] = None,
        context_manager: Optional[ContextManager] = None
    ):
        self.name = name
        self.description = description
        self.llm_client = llm_client or get_llm_client()
        self.context_manager = context_manager or ContextManager()
        self.tools = {}
        self.capabilities = []
        
        # Initialize agent-specific tools and capabilities
        self._initialize_capabilities()
        self._initialize_tools()
    
    @abstractmethod
    def _initialize_capabilities(self) -> None:
        """Initialize the agent's capabilities"""
        pass
    
    @abstractmethod
    def _initialize_tools(self) -> None:
        """Initialize the agent's tools"""
        pass
    
    @abstractmethod
    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """
        Determine if this agent can handle the given query
        Returns: (can_handle, confidence_score)
        """
        pass
    
    @abstractmethod
    async def process_query(
        self,
        query: str,
        session_id: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """Process a user query and return a response"""
        pass
    
    async def get_system_prompt(self) -> str:
        """Get the system prompt for this agent"""
        capabilities_text = "\n".join([
            f"- {cap.name}: {cap.description}"
            for cap in self.capabilities
        ])
        
        tools_text = "\n".join([
            f"- {tool_name}: {tool.description}"
            for tool_name, tool in self.tools.items()
        ])
        
        return f"""You are {self.name}, an AI agent specialized in {self.description}.

Your capabilities include:
{capabilities_text}

Available tools:
{tools_text}

Guidelines:
1. Always be helpful and accurate
2. If you're unsure about something, ask for clarification
3. Use tools when necessary to get accurate information
4. Provide clear explanations for any actions you take
5. If an action might have significant consequences, ask for confirmation first

Respond in a conversational and professional manner."""
    
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Generate a response using the LLM"""
        # Add system prompt
        system_prompt = await self.get_system_prompt()
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        # Convert tools to LLM format if provided
        llm_tools = None
        if tools:
            llm_tools = []
            for tool in tools:
                llm_tools.append({
                    "type": "function",
                    "function": tool
                })
        
        return await self.llm_client.generate_response(full_messages, tools=llm_tools)
    
    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool with given parameters"""
        if tool_name not in self.tools:
            raise ValueError(f"Tool '{tool_name}' not available for agent '{self.name}'")
        
        tool = self.tools[tool_name]
        return await tool.execute(parameters)
    
    def get_capabilities_summary(self) -> str:
        """Get a summary of this agent's capabilities"""
        return f"{self.name}: {self.description}\nCapabilities: {', '.join([cap.name for cap in self.capabilities])}"
    
    def add_capability(self, capability: AgentCapability) -> None:
        """Add a capability to this agent"""
        self.capabilities.append(capability)
    
    def add_tool(self, name: str, tool: Any) -> None:
        """Add a tool to this agent"""
        self.tools[name] = tool
    
    async def log_interaction(
        self,
        query: str,
        response: AgentResponse,
        session_id: str,
        user_id: Optional[str] = None
    ) -> None:
        """Log the interaction for audit and improvement purposes"""
        logger.info(
            f"Agent {self.name} interaction",
            extra={
                "agent": self.name,
                "session_id": session_id,
                "user_id": user_id,
                "query": query,
                "response_confidence": response.confidence,
                "actions_count": len(response.actions_taken),
                "needs_confirmation": response.needs_confirmation
            }
        )
        
        # Save to context manager
        await self.context_manager.add_message(
            session_id=session_id,
            role="user",
            content=query,
            user_id=user_id
        )
        
        await self.context_manager.add_message(
            session_id=session_id,
            role="assistant", 
            content=response.content,
            metadata={
                "agent": self.name,
                "actions": response.actions_taken,
                "confidence": response.confidence,
                "needs_confirmation": response.needs_confirmation
            },
            user_id=user_id
        )