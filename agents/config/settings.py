"""
Configuration settings for the AI Agents system.
"""
import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Main settings for the AI Agents system"""
    
    # LLM Configuration
    openai_api_key: Optional[str] = Field(None, env="OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = Field(None, env="ANTHROPIC_API_KEY")
    llm_provider: str = Field("openai", env="LLM_PROVIDER")
    llm_model: str = Field("gpt-4", env="LLM_MODEL")
    
    # Backend API Configuration
    backend_api_url: str = Field("http://localhost:8000", env="BACKEND_API_URL")
    backend_api_token: Optional[str] = Field(None, env="BACKEND_API_TOKEN")
    
    # Database Configuration
    database_url: Optional[str] = Field(None, env="DATABASE_URL")
    
    # Redis Configuration
    redis_url: str = Field("redis://localhost:6379/0", env="REDIS_URL")
    
    # Agent Configuration
    agent_debug: bool = Field(False, env="AGENT_DEBUG")
    agent_log_level: str = Field("INFO", env="AGENT_LOG_LEVEL")
    max_conversation_history: int = Field(50, env="MAX_CONVERSATION_HISTORY")
    enable_caching: bool = Field(True, env="ENABLE_CACHING")
    cache_ttl: int = Field(3600, env="CACHE_TTL")
    
    # Server Configuration
    agent_server_host: str = Field("0.0.0.0", env="AGENT_SERVER_HOST")
    agent_server_port: int = Field(8001, env="AGENT_SERVER_PORT")
    cors_origins: List[str] = Field(
        ["http://localhost:3000", "http://localhost:5173"],
        env="CORS_ORIGINS"
    )
    
    # Analytics Configuration
    max_query_results: int = Field(1000, env="MAX_QUERY_RESULTS")
    enable_advanced_analytics: bool = Field(True, env="ENABLE_ADVANCED_ANALYTICS")
    default_time_zone: str = Field("Europe/London", env="DEFAULT_TIME_ZONE")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


class AgentConfig:
    """Configuration for different agent types"""
    
    SHIFT_AGENT_CONFIG = {
        "name": "shift_management",
        "description": "Manages shift creation, updates, and assignments",
        "capabilities": [
            "create_shifts",
            "update_shifts", 
            "delete_shifts",
            "assign_staff",
            "bulk_operations"
        ],
        "tools": ["shift_tool", "staff_tool", "venue_tool", "validation_tool"]
    }
    
    ANALYTICS_AGENT_CONFIG = {
        "name": "analytics",
        "description": "Performs data analysis and generates insights",
        "capabilities": [
            "attendance_analysis",
            "performance_metrics",
            "trend_analysis", 
            "comparative_reports",
            "behavioral_patterns"
        ],
        "tools": ["analytics_tool", "reporting_tool", "staff_tool"]
    }
    
    PAYROLL_AGENT_CONFIG = {
        "name": "payroll",
        "description": "Manages payroll, invoices, and payments",
        "capabilities": [
            "invoice_generation",
            "payment_processing",
            "rate_management",
            "overtime_calculation",
            "tax_calculations"
        ],
        "tools": ["payroll_tool", "analytics_tool", "staff_tool"]
    }
    
    PERFORMANCE_AGENT_CONFIG = {
        "name": "performance",
        "description": "Analyzes performance metrics and trends",
        "capabilities": [
            "reliability_scoring",
            "venue_analytics",
            "efficiency_metrics",
            "trend_prediction",
            "benchmarking"
        ],
        "tools": ["analytics_tool", "reporting_tool", "performance_tool"]
    }


# Global settings instance
settings = Settings()