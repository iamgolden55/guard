"""
Orchestrator Agent - Coordinates between multiple specialized agents
Handles multi-agent workflows and task delegation
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResponse, AgentCapability

logger = logging.getLogger(__name__)


class OrchestratorAgent(BaseAgent):
    """Orchestrator agent that coordinates between multiple specialized agents"""
    
    def __init__(self, agents: Dict[str, BaseAgent]):
        super().__init__(
            name="orchestrator_agent",
            description="Coordinate between multiple agents to handle complex tasks"
        )
        
        self.specialized_agents = agents
        self.conversation_contexts = {}  # session_id -> context
        
    def _initialize_capabilities(self) -> None:
        """Initialize orchestrator capabilities"""
        capabilities = [
            AgentCapability(
                name="task_delegation",
                description="Delegate tasks to appropriate specialized agents",
                examples=["Create shifts", "Generate reports", "Calculate payroll"]
            ),
            AgentCapability(
                name="multi_step_workflows",
                description="Handle complex workflows requiring multiple agents",
                examples=["Create shifts and generate summary", "Analyze data and create report"]
            ),
            AgentCapability(
                name="agent_coordination",
                description="Coordinate responses from multiple agents",
                examples=["Get data from analytics then create shifts"]
            )
        ]
        
        for capability in capabilities:
            self.add_capability(capability)
    
    def _initialize_tools(self) -> None:
        """Initialize tools for orchestrator"""
        # Orchestrator uses other agents as tools
        pass

    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """Orchestrator can handle any query by delegating to appropriate agents"""
        # Always return high confidence - orchestrator can delegate anything
        return True, 1.0

    async def _find_best_agent_for_task(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[BaseAgent, float]:
        """Find the best specialized agent for a specific task"""
        best_agent = None
        best_score = 0.0
        
        for agent_name, agent in self.specialized_agents.items():
            # Skip orchestrator to avoid recursion
            if agent_name == "orchestrator":
                continue
                
            can_handle, score = await agent.can_handle(query, context)
            logger.info(f"Agent {agent_name} can handle '{query[:50]}...': {can_handle}, score: {score}")
            
            if can_handle and score > best_score:
                best_agent = agent
                best_score = score
        
        return best_agent, best_score

    async def process_query(self, query: str, session_id: str, user_id: Optional[str] = None) -> AgentResponse:
        """Process query by orchestrating appropriate agents"""
        try:
            logger.info(f"Orchestrator processing: {query[:100]}...")
            
            # Find the best agent for this task
            best_agent, score = await self._find_best_agent_for_task(query, {"session_id": session_id})
            
            if not best_agent:
                return AgentResponse(
                    content="I'm not sure how to help with that request. Could you please rephrase or provide more details?",
                    data={"error": "No suitable agent found"}
                )
            
            logger.info(f"Orchestrator delegating to {best_agent.name} (score: {score})")
            
            # Delegate to the specialized agent
            response = await best_agent.process_query(query, session_id, user_id)
            
            # Enhanced response with orchestrator metadata
            response.data = response.data or {}
            response.data.update({
                "orchestrated_by": "orchestrator_agent",
                "delegated_to": best_agent.name,
                "delegation_score": score
            })
            
            return response
            
        except Exception as e:
            logger.error(f"Error in orchestrator: {e}")
            return AgentResponse(
                content="I encountered an error while processing your request. Please try again.",
                data={"error": str(e), "orchestrator_error": True}
            )