"""
Base tool interface for all agent tools.
"""
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class BaseTool(ABC):
    """Abstract base class for all agent tools"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    @abstractmethod
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool with given parameters"""
        pass
    
    async def validate_parameters(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate tool parameters (override in subclasses if needed)"""
        return parameters
    
    def log_execution(self, parameters: Dict[str, Any], result: Dict[str, Any]) -> None:
        """Log tool execution for debugging and audit"""
        logger.info(
            f"Tool {self.name} executed",
            extra={
                "tool": self.name,
                "parameters": parameters,
                "success": "error" not in result,
                "result_keys": list(result.keys()) if isinstance(result, dict) else "non-dict-result"
            }
        )