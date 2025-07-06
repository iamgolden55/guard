"""
LLM client for integrating with different language models.
"""
import json
import logging
from typing import Any, Dict, List, Optional, Union
from abc import ABC, abstractmethod

from config.settings import settings

logger = logging.getLogger(__name__)


class LLMClient(ABC):
    """Abstract base class for LLM clients"""
    
    @abstractmethod
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate a response from the LLM"""
        pass
    
    @abstractmethod
    async def function_call(
        self,
        messages: List[Dict[str, str]],
        functions: List[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, Any]:
        """Make a function call using the LLM"""
        pass


class OpenAIClient(LLMClient):
    """OpenAI GPT client"""
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        try:
            import openai
            self.client = openai.AsyncOpenAI(api_key=api_key)
            self.model = model
        except ImportError:
            raise ImportError("OpenAI package not installed. Run: pip install openai")
    
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate response using OpenAI GPT"""
        try:
            request_params = {
                "model": self.model,
                "messages": messages,
            }
            
            # Use correct parameters based on model
            if self.model.startswith('o1') or 'o4' in self.model:
                # o1 and o4 models have restricted parameters
                request_params["max_completion_tokens"] = kwargs.get("max_tokens", 1000)
                # Don't set temperature for these models
            else:
                request_params["max_tokens"] = kwargs.get("max_tokens", 1000)
                request_params["temperature"] = kwargs.get("temperature", 0.1)
            
            if tools:
                request_params["tools"] = tools
                request_params["tool_choice"] = "auto"
            
            response = await self.client.chat.completions.create(**request_params)
            
            return {
                "choices": [{"message": {"content": response.choices[0].message.content}}],
                "content": response.choices[0].message.content,
                "tool_calls": getattr(response.choices[0].message, 'tool_calls', None),
                "usage": response.usage.dict() if response.usage else None,
                "model": response.model
            }
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise
    
    async def function_call(
        self,
        messages: List[Dict[str, str]],
        functions: List[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, Any]:
        """Make function call using OpenAI"""
        tools = [{"type": "function", "function": func} for func in functions]
        return await self.generate_response(messages, tools=tools, **kwargs)


class AnthropicClient(LLMClient):
    """Anthropic Claude client"""
    
    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        try:
            import anthropic
            self.client = anthropic.AsyncAnthropic(api_key=api_key)
            self.model = model
        except ImportError:
            raise ImportError("Anthropic package not installed. Run: pip install anthropic")
    
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate response using Anthropic Claude"""
        try:
            # Convert OpenAI format to Anthropic format
            system_message = ""
            user_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message += msg["content"] + "\n"
                else:
                    user_messages.append(msg)
            
            request_params = {
                "model": self.model,
                "messages": user_messages,
                "max_tokens": kwargs.get("max_tokens", 1000),
                "temperature": kwargs.get("temperature", 0.1)
            }
            
            if system_message:
                request_params["system"] = system_message.strip()
            
            if tools:
                request_params["tools"] = tools
            
            response = await self.client.messages.create(**request_params)
            
            return {
                "content": response.content[0].text if response.content else "",
                "tool_calls": getattr(response, 'tool_calls', None),
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens
                },
                "model": response.model
            }
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise
    
    async def function_call(
        self,
        messages: List[Dict[str, str]],
        functions: List[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, Any]:
        """Make function call using Anthropic"""
        # Anthropic uses a different tool format
        tools = functions  # Anthropic expects the function definitions directly
        return await self.generate_response(messages, tools=tools, **kwargs)


class LLMClientFactory:
    """Factory for creating LLM clients"""
    
    @staticmethod
    def create_client(provider: str = None, model: str = None) -> LLMClient:
        """Create an LLM client based on configuration"""
        provider = provider or settings.llm_provider
        model = model or settings.llm_model
        
        if provider.lower() == "openai":
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            return OpenAIClient(settings.openai_api_key, model)
        
        elif provider.lower() == "anthropic":
            if not settings.anthropic_api_key:
                raise ValueError("Anthropic API key not configured")
            return AnthropicClient(settings.anthropic_api_key, model)
        
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")


# Default client instance
def get_llm_client() -> LLMClient:
    """Get the default LLM client"""
    return LLMClientFactory.create_client()