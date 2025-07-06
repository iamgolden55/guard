"""
Analytics agent for handling data analysis and reporting queries.
"""
import re
import logging
from typing import Any, Dict, List, Optional, Tuple

from agents.base_agent import BaseAgent, AgentResponse, AgentCapability
from tools.analytics_tool import AnalyticsTool
from tools.staff_tool import StaffTool
from parsers.query_parser import QueryParser

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    """Agent specialized in data analysis and reporting"""
    
    def __init__(self, **kwargs):
        super().__init__(
            name="Analytics Agent",
            description="data analysis, reporting, and business intelligence",
            **kwargs
        )
    
    def _initialize_capabilities(self) -> None:
        """Initialize analytics capabilities"""
        self.capabilities = [
            AgentCapability(
                name="attendance_analysis",
                description="Analyze attendance patterns, late arrivals, and punctuality",
                examples=[
                    "How many times did Mr B start his shift late?",
                    "Show attendance statistics for all staff this month",
                    "Who has the best punctuality record?"
                ]
            ),
            AgentCapability(
                name="performance_metrics",
                description="Calculate and analyze performance metrics",
                examples=[
                    "What is the average overtime hours per staff member?",
                    "Show me all staff who worked more than 40 hours last week",
                    "Who are the most reliable staff members?"
                ]
            ),
            AgentCapability(
                name="trend_analysis",
                description="Identify trends and patterns in data",
                examples=[
                    "Show overtime trends for the last quarter",
                    "Which venue has the highest no-show rate?",
                    "Analyze seasonal patterns in shift assignments"
                ]
            ),
            AgentCapability(
                name="comparative_reports",
                description="Generate comparative reports and rankings",
                examples=[
                    "Compare venue utilization across all locations",
                    "Rank staff by total hours worked this month",
                    "Show performance differences between venues"
                ]
            ),
            AgentCapability(
                name="behavioral_patterns",
                description="Analyze behavioral patterns and insights",
                examples=[
                    "Identify staff who might need additional training",
                    "Find patterns in shift preferences",
                    "Analyze check-in/check-out compliance"
                ]
            )
        ]
    
    def _initialize_tools(self) -> None:
        """Initialize analytics tools"""
        self.add_tool("analytics", AnalyticsTool())
        self.add_tool("staff", StaffTool())
        self.query_parser = QueryParser()
    
    async def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> Tuple[bool, float]:
        """Determine if this agent can handle the query"""
        # Keywords that indicate analytics queries
        analytics_keywords = [
            "how many", "what is", "show me", "analyze", "statistics", 
            "report", "trend", "pattern", "compare", "rank", "total",
            "average", "count", "percentage", "rate", "performance",
            "attendance", "late", "overtime", "hours", "worked"
        ]
        
        query_lower = query.lower()
        keyword_matches = sum(1 for keyword in analytics_keywords if keyword in query_lower)
        
        # Check for specific analytics patterns
        patterns = [
            r"how many times.*late",
            r"what is.*total.*pay",
            r"show.*statistics",
            r"who.*most.*reliable",
            r"which.*highest.*rate",
            r"analyze.*pattern",
            r"compare.*venue"
        ]
        
        pattern_matches = sum(1 for pattern in patterns if re.search(pattern, query_lower))
        
        # Calculate confidence score
        if pattern_matches > 0:
            confidence = 0.9
        elif keyword_matches >= 2:
            confidence = 0.8
        elif keyword_matches >= 1:
            confidence = 0.6
        else:
            confidence = 0.1
        
        can_handle = confidence > 0.5
        return can_handle, confidence
    
    async def process_query(
        self,
        query: str,
        session_id: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """Process an analytics query"""
        try:
            # Parse the query to extract entities and intent
            await self.query_parser.parse_analytics_query(query)
            
            # Get conversation history for context
            conversation_history = await self.context_manager.get_conversation_history(
                session_id, limit=5, user_id=user_id
            )
            
            # Prepare messages for LLM
            messages = conversation_history + [{"role": "user", "content": query}]
            
            # Define available tools for the LLM
            tools = [
                {
                    "name": "analyze_late_starts",
                    "description": "Count how many times a staff member started their shift late",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "staff_name": {"type": "string", "description": "Name of the staff member"},
                            "start_date": {"type": "string", "description": "Start date for analysis (YYYY-MM-DD)"},
                            "end_date": {"type": "string", "description": "End date for analysis (YYYY-MM-DD)"}
                        },
                        "required": ["staff_name"]
                    }
                },
                {
                    "name": "calculate_total_pay",
                    "description": "Calculate total pay for a staff member over a period",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "staff_name": {"type": "string", "description": "Name of the staff member"},
                            "start_date": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                            "end_date": {"type": "string", "description": "End date (YYYY-MM-DD)"}
                        },
                        "required": ["staff_name", "start_date", "end_date"]
                    }
                },
                {
                    "name": "get_attendance_stats",
                    "description": "Get attendance statistics for staff members",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "staff_filter": {"type": "string", "description": "Filter by staff name (optional)"},
                            "venue_filter": {"type": "string", "description": "Filter by venue name (optional)"},
                            "start_date": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                            "end_date": {"type": "string", "description": "End date (YYYY-MM-DD)"}
                        }
                    }
                },
                {
                    "name": "analyze_performance_metrics",
                    "description": "Analyze performance metrics for staff or venues",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "metric_type": {"type": "string", "enum": ["reliability", "punctuality", "overtime", "hours_worked"]},
                            "time_period": {"type": "string", "description": "Time period for analysis"},
                            "group_by": {"type": "string", "enum": ["staff", "venue", "month"]}
                        },
                        "required": ["metric_type"]
                    }
                }
            ]
            
            # Generate response using LLM
            llm_response = await self.generate_response(messages, tools)
            
            actions_taken = []
            data = {}
            
            # Handle tool calls if any
            if llm_response.get("tool_calls"):
                for tool_call in llm_response["tool_calls"]:
                    function_name = tool_call.function.name
                    parameters = tool_call.function.arguments
                    
                    # Execute the appropriate tool
                    if function_name == "analyze_late_starts":
                        result = await self._analyze_late_starts(parameters)
                    elif function_name == "calculate_total_pay":
                        result = await self._calculate_total_pay(parameters)
                    elif function_name == "get_attendance_stats":
                        result = await self._get_attendance_stats(parameters)
                    elif function_name == "analyze_performance_metrics":
                        result = await self._analyze_performance_metrics(parameters)
                    else:
                        result = {"error": f"Unknown function: {function_name}"}
                    
                    actions_taken.append({
                        "action": function_name,
                        "parameters": parameters,
                        "result": result
                    })
                    
                    # Store data for potential follow-up queries
                    data[function_name] = result
                
                # Generate final response with tool results
                result_summary = self._format_results(actions_taken)
                final_messages = messages + [
                    {"role": "assistant", "content": f"Tool results: {result_summary}"},
                    {"role": "user", "content": "Please provide a human-readable summary of these results."}
                ]
                
                final_response = await self.generate_response(final_messages)
                response_content = final_response.get("content", "Analysis completed.")
            else:
                response_content = llm_response.get("content", "I can help you analyze your data. What would you like to know?")
            
            # Create agent response
            agent_response = AgentResponse(
                content=response_content,
                actions_taken=actions_taken,
                data=data,
                confidence=0.9 if actions_taken else 0.7
            )
            
            # Log the interaction
            await self.log_interaction(query, agent_response, session_id, user_id)
            
            return agent_response
            
        except Exception as e:
            logger.error(f"Error processing analytics query: {e}")
            return AgentResponse(
                content=f"I encountered an error while analyzing your request: {str(e)}",
                confidence=0.1
            )
    
    async def _analyze_late_starts(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze late starts for a staff member"""
        staff_name = parameters.get("staff_name")
        start_date = parameters.get("start_date")
        end_date = parameters.get("end_date")
        
        # Find staff member
        staff_tool = self.tools["staff"]
        staff_result = await staff_tool.find_staff_by_name(staff_name)
        
        if not staff_result.get("found"):
            return {"error": f"Staff member '{staff_name}' not found"}
        
        staff_id = staff_result["staff"]["id"]
        
        # Analyze late starts
        analytics_tool = self.tools["analytics"]
        result = await analytics_tool.get_late_start_count(
            staff_id=staff_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return result
    
    async def _calculate_total_pay(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate total pay for a staff member"""
        staff_name = parameters.get("staff_name")
        start_date = parameters.get("start_date") 
        end_date = parameters.get("end_date")
        
        # Find staff member
        staff_tool = self.tools["staff"]
        staff_result = await staff_tool.find_staff_by_name(staff_name)
        
        if not staff_result.get("found"):
            return {"error": f"Staff member '{staff_name}' not found"}
        
        staff_id = staff_result["staff"]["id"]
        
        # Calculate pay
        analytics_tool = self.tools["analytics"]
        result = await analytics_tool.calculate_pay_summary(
            staff_id=staff_id,
            period_start=start_date,
            period_end=end_date
        )
        
        return result
    
    async def _get_attendance_stats(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Get attendance statistics"""
        analytics_tool = self.tools["analytics"]
        result = await analytics_tool.get_attendance_stats(parameters)
        return result
    
    async def _analyze_performance_metrics(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze performance metrics"""
        analytics_tool = self.tools["analytics"]
        result = await analytics_tool.analyze_performance_trends(
            metric=parameters.get("metric_type"),
            time_range=parameters.get("time_period", "last_month")
        )
        return result
    
    def _format_results(self, actions_taken: List[Dict[str, Any]]) -> str:
        """Format tool results for LLM processing"""
        formatted = []
        for action in actions_taken:
            result = action["result"]
            if "error" in result:
                formatted.append(f"Error in {action['action']}: {result['error']}")
            else:
                formatted.append(f"{action['action']}: {result}")
        
        return "; ".join(formatted)