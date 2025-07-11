"""
FastAPI server for AI agents system.
"""
import logging
import uvicorn
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from datetime import datetime

from agents.analytics_agent import AnalyticsAgent
from agents.payroll_agent import PayrollAgent
from agents.shift_management_agent import ShiftManagementAgent
from agents.conversational_agent import ConversationalAgent
from agents.orchestrator_agent import OrchestratorAgent
from agents.base_agent import AgentResponse
from core.context_manager import ContextManager
from config.settings import settings
from auth.auto_auth import ensure_ai_authentication
from vector.staff_resolver import init_vector_staff_resolver
from vector.venue_resolver import init_vector_venue_resolver
from vector.auto_updater import init_auto_updater, get_auto_updater

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Agents API",
    description="API for AI agents handling shift management, analytics, and payroll queries",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class QueryResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    agent_used: Optional[str] = None
    session_id: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    agents: List[str]
    version: str

class AgentCapabilitiesResponse(BaseModel):
    agents: Dict[str, Dict[str, Any]]

# Global variables
agents = {}
context_manager = None
vector_resolver = None

@app.on_event("startup")
async def startup_event():
    """Initialize agents, authentication, and vector database on startup"""
    global agents, context_manager, vector_resolver
    
    try:
        logger.info("🚀 Starting AI agents system...")
        
        # Step 1: Ensure AI authentication
        logger.info("🔐 Setting up AI authentication...")
        try:
            token = await ensure_ai_authentication()
            logger.info(f"✅ AI authentication successful (token: {token[:20]}...)")
        except Exception as e:
            logger.warning(f"⚠️ AI authentication failed: {e}")
            logger.info("🔄 Continuing with existing configuration...")
        
        # Step 2: Initialize vector databases for fast resolution
        logger.info("🧠 Initializing vector resolvers...")
        try:
            vector_staff_resolver = await init_vector_staff_resolver()
            staff_count = vector_staff_resolver.get_staff_count() if vector_staff_resolver else 0
        except Exception as e:
            logger.warning(f"⚠️ Staff vector database setup failed: {e}")
            vector_staff_resolver = None
            staff_count = 0
            
        try:
            vector_venue_resolver = await init_vector_venue_resolver()
            venue_count = vector_venue_resolver.get_venue_count() if vector_venue_resolver else 0
        except Exception as e:
            logger.warning(f"⚠️ Venue vector database setup failed: {e}")
            vector_venue_resolver = None
            venue_count = 0
            
        logger.info(f"✅ Vector databases ready: {staff_count} staff, {venue_count} venues indexed")
        
        # Step 3: Initialize context manager
        context_manager = ContextManager()
        
        # Step 4: Initialize specialized agents
        specialized_agents = {
            "conversational": ConversationalAgent(),
            "analytics": AnalyticsAgent(),
            "payroll": PayrollAgent(), 
            "shift_management": ShiftManagementAgent(),
        }
        
        # Step 5: Initialize orchestrator with access to all specialized agents
        orchestrator = OrchestratorAgent(specialized_agents)
        
        # Step 6: Main agents dict with orchestrator as primary
        agents = {
            "orchestrator": orchestrator,
            **specialized_agents
        }
        
        # Step 7: Inject vector resolvers into shift management agent
        if "shift_management" in agents:
            if vector_staff_resolver:
                agents["shift_management"].vector_staff_resolver = vector_staff_resolver
                logger.info("✅ Enhanced shift management agent with staff vector resolution")
            if vector_venue_resolver:
                agents["shift_management"].vector_venue_resolver = vector_venue_resolver
                logger.info("✅ Enhanced shift management agent with venue vector resolution")
        
        # Step 8: Initialize auto-updater for vector databases
        try:
            await init_auto_updater(vector_staff_resolver, vector_venue_resolver)
            logger.info("✅ Vector auto-updater started")
        except Exception as e:
            logger.warning(f"⚠️ Auto-updater initialization failed: {e}")
        
        logger.info(f"🎉 Initialized {len(agents)} agents: {list(agents.keys())}")
        logger.info("🚀 AI agents system ready!")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down AI agents system...")
    
    # Close any open connections
    for agent in agents.values():
        if hasattr(agent, 'close'):
            await agent.close()

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        agents=list(agents.keys()),
        version="1.0.0"
    )

@app.get("/agents/capabilities", response_model=AgentCapabilitiesResponse)
async def get_agent_capabilities():
    """Get capabilities of all agents"""
    capabilities = {}
    
    for agent_name, agent in agents.items():
        capabilities[agent_name] = {
            "name": agent.name,
            "description": agent.description,
            "capabilities": agent.capabilities
        }
    
    return AgentCapabilitiesResponse(agents=capabilities)

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    """Process a natural language query"""
    try:
        # Generate session ID if not provided
        session_id = request.session_id or f"session_{int(asyncio.get_event_loop().time())}"
        
        logger.info(f"Processing query: {request.query[:100]}...")
        
        # Find the best agent to handle the query
        best_agent = None
        best_score = 0.0
        
        all_scores = {}
        for agent_name, agent in agents.items():
            can_handle, score = await agent.can_handle(request.query, request.context)
            all_scores[agent_name] = (can_handle, score)
            
            logger.info(f"Agent {agent_name} can handle: {can_handle}, score: {score}")
            
            if can_handle and score > best_score:
                best_agent = agent
                best_score = score
        
        logger.info(f"All agent scores: {all_scores}")
        logger.info(f"Selected agent: {best_agent.name if best_agent else None} with score: {best_score}")
        
        if not best_agent:
            return QueryResponse(
                success=False,
                message="I'm not sure how to help with that query. Please try rephrasing or ask about shift management, analytics, or payroll.",
                session_id=session_id
            )
        
        # Process the query with the best agent
        response = await best_agent.process_query(
            request.query,
            session_id,
            request.user_id
        )
        
        return QueryResponse(
            success='error' not in response.content.lower(),
            message=response.content,
            data=response.data,
            agent_used=best_agent.name,
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        return QueryResponse(
            success=False,
            message=f"An error occurred while processing your query: {str(e)}",
            session_id=request.session_id
        )

@app.post("/admin/vectors/refresh")
async def refresh_vectors():
    """Manually refresh all vector databases (admin endpoint)"""
    try:
        updater = get_auto_updater()
        if not updater:
            return {"error": "Auto-updater not initialized"}
        
        results = await updater.force_update_all()
        
        return {
            "success": True,
            "message": "Vector databases refreshed",
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error refreshing vectors: {e}")
        return {"error": f"Failed to refresh vectors: {str(e)}"}

@app.get("/admin/vectors/status")
async def get_vector_status():
    """Get status of vector databases and auto-updater"""
    try:
        updater = get_auto_updater()
        if not updater:
            return {"error": "Auto-updater not initialized"}
        
        return {
            "success": True,
            "status": updater.get_status(),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting vector status: {e}")
        return {"error": f"Failed to get status: {str(e)}"}

@app.post("/agents/{agent_name}/query", response_model=QueryResponse)
async def process_agent_query(agent_name: str, request: QueryRequest):
    """Process a query with a specific agent"""
    try:
        if agent_name not in agents:
            raise HTTPException(
                status_code=404,
                detail=f"Agent '{agent_name}' not found. Available agents: {list(agents.keys())}"
            )
        
        agent = agents[agent_name]
        session_id = request.session_id or f"session_{int(asyncio.get_event_loop().time())}"
        
        logger.info(f"Processing query with {agent_name} agent: {request.query[:100]}...")
        
        # Check if agent can handle the query
        can_handle, score = await agent.can_handle(request.query, request.context)
        
        if not can_handle:
            return QueryResponse(
                success=False,
                message=f"The {agent_name} agent cannot handle this type of query. Try using the general /query endpoint.",
                agent_used=agent_name,
                session_id=session_id
            )
        
        # Process the query
        response = await agent.process_query(
            request.query,
            session_id,
            request.user_id
        )
        
        return QueryResponse(
            success='error' not in response.content.lower(),
            message=response.content,
            data=response.data,
            agent_used=agent_name,
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query with {agent_name} agent: {e}")
        return QueryResponse(
            success=False,
            message=f"An error occurred while processing your query: {str(e)}",
            agent_used=agent_name,
            session_id=request.session_id
        )

@app.get("/agents/{agent_name}/capabilities")
async def get_agent_capabilities_specific(agent_name: str):
    """Get capabilities of a specific agent"""
    if agent_name not in agents:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' not found. Available agents: {list(agents.keys())}"
        )
    
    agent = agents[agent_name]
    return {
        "name": agent.name,
        "description": agent.description,
        "capabilities": agent.capabilities
    }

@app.get("/session/{session_id}/context")
async def get_session_context(session_id: str):
    """Get context for a session"""
    try:
        if not context_manager:
            raise HTTPException(status_code=503, detail="Context manager not initialized")
        
        context = await context_manager.get_context(session_id)
        
        if not context:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "session_id": context.session_id,
            "user_id": context.user_id,
            "message_count": len(context.messages) if context.messages else 0,
            "preferences": context.preferences
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session context: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Example queries endpoint for testing
@app.get("/examples")
async def get_example_queries():
    """Get example queries for testing"""
    return {
        "analytics": [
            "How many times did MR A start his shift late?",
            "What is the attendance rate for this week?",
            "Show me performance trends for punctuality",
            "How many hours did MR B work last month?"
        ],
        "payroll": [
            "What is the total pay for MR C for last week?",
            "Mark MR A and MR B salary as paid",
            "Show me the invoice status",
            "Calculate pay summary for MR D this month"
        ],
        "shift_management": [
            "Give MR A shifts at BIMM from monday to saturday everyday at 5:00 pm to 10:00pm",
            "Create shifts for MR B at LOCATION1 from 9 AM to 5 PM",
            "Schedule daily shifts for MR C next week"
        ]
    }

if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )