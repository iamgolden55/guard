"""
Context manager for handling conversation state and history.
"""
import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict

from config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class ConversationMessage:
    """Represents a single message in a conversation"""
    role: str  # 'user', 'assistant', 'system'
    content: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class ConversationContext:
    """Represents the context of a conversation"""
    session_id: str
    user_id: Optional[str] = None
    messages: List[ConversationMessage] = None
    preferences: Dict[str, Any] = None
    created_at: datetime = None
    updated_at: datetime = None
    
    def __post_init__(self):
        if self.messages is None:
            self.messages = []
        if self.preferences is None:
            self.preferences = {}
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.updated_at is None:
            self.updated_at = datetime.utcnow()


class ContextManager:
    """Manages conversation context and history"""
    
    def __init__(self, use_redis: bool = True):
        self.use_redis = use_redis and settings.enable_caching
        self.contexts: Dict[str, ConversationContext] = {}
        
        if self.use_redis:
            try:
                import redis
                self.redis_client = redis.from_url(settings.redis_url)
            except ImportError:
                logger.warning("Redis not available, using in-memory storage")
                self.use_redis = False
    
    async def get_context(self, session_id: str, user_id: Optional[str] = None) -> ConversationContext:
        """Get or create conversation context"""
        if self.use_redis:
            return await self._get_context_from_redis(session_id, user_id)
        else:
            return await self._get_context_from_memory(session_id, user_id)
    
    async def save_context(self, context: ConversationContext) -> None:
        """Save conversation context"""
        context.updated_at = datetime.utcnow()
        
        if self.use_redis:
            await self._save_context_to_redis(context)
        else:
            await self._save_context_to_memory(context)
    
    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> None:
        """Add a message to the conversation"""
        context = await self.get_context(session_id, user_id)
        
        message = ConversationMessage(
            role=role,
            content=content,
            timestamp=datetime.utcnow(),
            metadata=metadata
        )
        
        context.messages.append(message)
        
        # Limit conversation history
        if len(context.messages) > settings.max_conversation_history:
            # Keep system messages and trim user/assistant messages
            system_messages = [msg for msg in context.messages if msg.role == "system"]
            other_messages = [msg for msg in context.messages if msg.role != "system"]
            
            # Keep the most recent messages
            keep_count = settings.max_conversation_history - len(system_messages)
            other_messages = other_messages[-keep_count:]
            
            context.messages = system_messages + other_messages
        
        await self.save_context(context)
    
    async def get_conversation_history(
        self,
        session_id: str,
        limit: Optional[int] = None,
        user_id: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Get conversation history in LLM format"""
        context = await self.get_context(session_id, user_id)
        
        messages = context.messages
        if limit:
            messages = messages[-limit:]
        
        # Convert to LLM format
        llm_messages = []
        for msg in messages:
            llm_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        return llm_messages
    
    async def update_preferences(
        self,
        session_id: str,
        preferences: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> None:
        """Update user preferences"""
        context = await self.get_context(session_id, user_id)
        context.preferences.update(preferences)
        await self.save_context(context)
    
    async def clear_context(self, session_id: str) -> None:
        """Clear conversation context"""
        if self.use_redis:
            self.redis_client.delete(f"context:{session_id}")
        else:
            if session_id in self.contexts:
                del self.contexts[session_id]
    
    async def _get_context_from_redis(self, session_id: str, user_id: Optional[str] = None) -> ConversationContext:
        """Get context from Redis"""
        try:
            data = self.redis_client.get(f"context:{session_id}")
            if data:
                context_data = json.loads(data)
                
                # Reconstruct ConversationMessage objects
                messages = []
                for msg_data in context_data.get('messages', []):
                    msg_data['timestamp'] = datetime.fromisoformat(msg_data['timestamp'])
                    messages.append(ConversationMessage(**msg_data))
                
                context_data['messages'] = messages
                context_data['created_at'] = datetime.fromisoformat(context_data['created_at'])
                context_data['updated_at'] = datetime.fromisoformat(context_data['updated_at'])
                
                return ConversationContext(**context_data)
        except Exception as e:
            logger.error(f"Error loading context from Redis: {e}")
        
        # Create new context if not found or error
        return ConversationContext(session_id=session_id, user_id=user_id)
    
    async def _save_context_to_redis(self, context: ConversationContext) -> None:
        """Save context to Redis"""
        try:
            # Convert to serializable format
            context_data = asdict(context)
            
            # Convert datetime objects to ISO strings
            for msg in context_data['messages']:
                msg['timestamp'] = msg['timestamp'].isoformat()
            
            context_data['created_at'] = context_data['created_at'].isoformat()
            context_data['updated_at'] = context_data['updated_at'].isoformat()
            
            self.redis_client.setex(
                f"context:{context.session_id}",
                settings.cache_ttl,
                json.dumps(context_data)
            )
        except Exception as e:
            logger.error(f"Error saving context to Redis: {e}")
    
    async def _get_context_from_memory(self, session_id: str, user_id: Optional[str] = None) -> ConversationContext:
        """Get context from memory"""
        if session_id not in self.contexts:
            self.contexts[session_id] = ConversationContext(session_id=session_id, user_id=user_id)
        
        return self.contexts[session_id]
    
    async def _save_context_to_memory(self, context: ConversationContext) -> None:
        """Save context to memory"""
        self.contexts[context.session_id] = context