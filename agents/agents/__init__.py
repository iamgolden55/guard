"""
Agent modules for AI-powered query processing.
"""
from .base_agent import BaseAgent, AgentResponse, AgentCapability
from .analytics_agent import AnalyticsAgent
from .payroll_agent import PayrollAgent
from .shift_management_agent import ShiftManagementAgent

__all__ = [
    'BaseAgent', 
    'AgentResponse', 
    'AgentCapability', 
    'AnalyticsAgent',
    'PayrollAgent',
    'ShiftManagementAgent'
]