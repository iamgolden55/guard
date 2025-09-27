"""
Advanced Task Management System
===============================

This module provides sophisticated task management capabilities for the reporting system:
- Task prioritization and queue management
- Batch processing for multiple reports
- Intelligent retry strategies based on error types
- Resource monitoring and auto-scaling
- Task deduplication and rate limiting
"""

import time
import logging
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import threading
import psutil

from django.utils import timezone
from django.core.cache import cache
from django.db import models
from celery import current_task
from celery.exceptions import Retry
from redis import Redis
from redis.exceptions import RedisError

from ..models import ReportJob, User

logger = logging.getLogger(__name__)


class TaskPriority(Enum):
    """Task priority levels"""
    URGENT = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4
    BATCH = 5


class ErrorType(Enum):
    """Classification of error types for retry strategies"""
    NETWORK_ERROR = "network"
    DATABASE_ERROR = "database"
    MEMORY_ERROR = "memory"
    TIMEOUT_ERROR = "timeout"
    VALIDATION_ERROR = "validation"
    SYSTEM_ERROR = "system"
    USER_ERROR = "user"


@dataclass
class TaskMetadata:
    """Metadata for task management"""
    task_id: str
    priority: TaskPriority
    created_at: datetime
    estimated_duration: int = 0  # seconds
    memory_requirement: int = 0  # MB
    retry_count: int = 0
    last_error: Optional[str] = None
    error_type: Optional[ErrorType] = None
    dependencies: List[str] = field(default_factory=list)
    batch_id: Optional[str] = None
    user_id: Optional[int] = None
    resource_tags: Set[str] = field(default_factory=set)


@dataclass
class ResourceUsage:
    """Current system resource usage"""
    cpu_percent: float
    memory_percent: float
    active_tasks: int
    queue_size: int
    timestamp: datetime = field(default_factory=timezone.now)


class TaskDeduplicationManager:
    """Prevent duplicate task execution"""

    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis_client = redis_client or Redis.from_url('redis://localhost:6379')
        self.dedup_prefix = "task_dedup"
        self.default_ttl = 3600  # 1 hour

    def generate_task_signature(self, template_id: int, params: Dict[str, Any],
                               export_format: str, user_id: int) -> str:
        """Generate unique signature for task deduplication"""
        signature_data = {
            'template_id': template_id,
            'params': sorted(params.items()),
            'export_format': export_format,
            'user_id': user_id
        }
        signature_str = json.dumps(signature_data, sort_keys=True, default=str)
        return hashlib.sha256(signature_str.encode()).hexdigest()

    def is_duplicate_task(self, signature: str) -> Optional[str]:
        """Check if task with this signature is already running"""
        try:
            key = f"{self.dedup_prefix}:{signature}"
            existing_task_id = self.redis_client.get(key)
            return existing_task_id.decode() if existing_task_id else None
        except RedisError as e:
            logger.warning(f"Redis error in deduplication check: {e}")
            return None

    def register_task(self, signature: str, task_id: str, ttl: int = None) -> bool:
        """Register task to prevent duplicates"""
        try:
            key = f"{self.dedup_prefix}:{signature}"
            ttl = ttl or self.default_ttl
            return self.redis_client.setex(key, ttl, task_id)
        except RedisError as e:
            logger.warning(f"Redis error in task registration: {e}")
            return False

    def unregister_task(self, signature: str) -> bool:
        """Remove task from deduplication registry"""
        try:
            key = f"{self.dedup_prefix}:{signature}"
            return bool(self.redis_client.delete(key))
        except RedisError as e:
            logger.warning(f"Redis error in task unregistration: {e}")
            return False


class RateLimitManager:
    """Manage rate limits for different types of tasks"""

    def __init__(self, redis_client: Optional[Redis] = None):
        self.redis_client = redis_client or Redis.from_url('redis://localhost:6379')
        self.rate_limit_prefix = "rate_limit"

        # Default rate limits (requests per hour)
        self.default_limits = {
            'per_user': 100,
            'per_template': 50,
            'global': 1000
        }

    def check_rate_limit(self, limit_type: str, identifier: str,
                        limit: int = None) -> Tuple[bool, int]:
        """
        Check if rate limit is exceeded.
        Returns (allowed, remaining_count)
        """
        try:
            limit = limit or self.default_limits.get(limit_type, 100)
            key = f"{self.rate_limit_prefix}:{limit_type}:{identifier}"

            # Use sliding window with Redis
            now = time.time()
            hour_ago = now - 3600

            # Remove old entries
            self.redis_client.zremrangebyscore(key, 0, hour_ago)

            # Count current requests
            current_count = self.redis_client.zcard(key)

            if current_count >= limit:
                return False, 0

            # Add current request
            self.redis_client.zadd(key, {str(now): now})
            self.redis_client.expire(key, 3600)

            remaining = limit - current_count - 1
            return True, remaining

        except RedisError as e:
            logger.warning(f"Redis error in rate limit check: {e}")
            # Fail open - allow request if Redis is down
            return True, 0


class RetryStrategyManager:
    """Intelligent retry strategies based on error types"""

    # Retry configurations for different error types
    RETRY_CONFIGS = {
        ErrorType.NETWORK_ERROR: {
            'max_retries': 5,
            'delays': [2, 5, 10, 30, 60],  # exponential backoff
            'recoverable': True
        },
        ErrorType.DATABASE_ERROR: {
            'max_retries': 3,
            'delays': [5, 15, 30],
            'recoverable': True
        },
        ErrorType.MEMORY_ERROR: {
            'max_retries': 2,
            'delays': [30, 120],  # wait longer for memory to clear
            'recoverable': True
        },
        ErrorType.TIMEOUT_ERROR: {
            'max_retries': 3,
            'delays': [10, 30, 60],
            'recoverable': True
        },
        ErrorType.VALIDATION_ERROR: {
            'max_retries': 0,
            'delays': [],
            'recoverable': False
        },
        ErrorType.USER_ERROR: {
            'max_retries': 0,
            'delays': [],
            'recoverable': False
        },
        ErrorType.SYSTEM_ERROR: {
            'max_retries': 2,
            'delays': [60, 300],  # system issues need more time
            'recoverable': True
        }
    }

    @classmethod
    def classify_error(cls, error: Exception) -> ErrorType:
        """Classify error type for appropriate retry strategy"""
        error_str = str(error).lower()

        if any(keyword in error_str for keyword in ['connection', 'network', 'timeout']):
            return ErrorType.NETWORK_ERROR
        elif any(keyword in error_str for keyword in ['database', 'sql', 'cursor']):
            return ErrorType.DATABASE_ERROR
        elif any(keyword in error_str for keyword in ['memory', 'ram', 'out of memory']):
            return ErrorType.MEMORY_ERROR
        elif 'timeout' in error_str:
            return ErrorType.TIMEOUT_ERROR
        elif any(keyword in error_str for keyword in ['validation', 'invalid', 'bad request']):
            return ErrorType.VALIDATION_ERROR
        elif any(keyword in error_str for keyword in ['permission', 'unauthorized', 'forbidden']):
            return ErrorType.USER_ERROR
        else:
            return ErrorType.SYSTEM_ERROR

    @classmethod
    def should_retry(cls, error_type: ErrorType, retry_count: int) -> bool:
        """Determine if task should be retried"""
        config = cls.RETRY_CONFIGS.get(error_type)
        if not config or not config['recoverable']:
            return False
        return retry_count < config['max_retries']

    @classmethod
    def get_retry_delay(cls, error_type: ErrorType, retry_count: int) -> int:
        """Get delay before retry based on error type and attempt count"""
        config = cls.RETRY_CONFIGS.get(error_type)
        if not config or retry_count >= len(config['delays']):
            return 300  # 5 minutes default

        return config['delays'][retry_count]


class ResourceMonitor:
    """Monitor system resources for intelligent task scheduling"""

    def __init__(self):
        self.history = deque(maxlen=100)  # Keep last 100 measurements
        self._lock = threading.Lock()

    def get_current_usage(self) -> ResourceUsage:
        """Get current system resource usage"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory_percent = psutil.virtual_memory().percent

            # Get active task count (simplified - would need Celery integration)
            active_tasks = self._get_active_task_count()
            queue_size = self._get_queue_size()

            usage = ResourceUsage(
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                active_tasks=active_tasks,
                queue_size=queue_size
            )

            with self._lock:
                self.history.append(usage)

            return usage

        except Exception as e:
            logger.warning(f"Error getting resource usage: {e}")
            return ResourceUsage(0, 0, 0, 0)

    def _get_active_task_count(self) -> int:
        """Get number of active tasks (placeholder)"""
        # This would integrate with Celery's inspect API
        return 0

    def _get_queue_size(self) -> int:
        """Get current queue size (placeholder)"""
        # This would integrate with Celery's inspect API
        return 0

    def get_average_usage(self, minutes: int = 5) -> ResourceUsage:
        """Get average resource usage over specified time period"""
        if not self.history:
            return self.get_current_usage()

        cutoff_time = timezone.now() - timedelta(minutes=minutes)
        recent_usage = [u for u in self.history if u.timestamp >= cutoff_time]

        if not recent_usage:
            return self.history[-1] if self.history else self.get_current_usage()

        avg_cpu = sum(u.cpu_percent for u in recent_usage) / len(recent_usage)
        avg_memory = sum(u.memory_percent for u in recent_usage) / len(recent_usage)
        avg_tasks = sum(u.active_tasks for u in recent_usage) / len(recent_usage)
        avg_queue = sum(u.queue_size for u in recent_usage) / len(recent_usage)

        return ResourceUsage(avg_cpu, avg_memory, int(avg_tasks), int(avg_queue))

    def should_scale_up(self) -> bool:
        """Determine if system should scale up based on resource usage"""
        current = self.get_current_usage()
        average = self.get_average_usage(5)

        # Scale up if consistently high resource usage
        return (average.cpu_percent > 80 or
                average.memory_percent > 85 or
                average.queue_size > 50)

    def should_scale_down(self) -> bool:
        """Determine if system should scale down based on resource usage"""
        current = self.get_current_usage()
        average = self.get_average_usage(10)

        # Scale down if consistently low resource usage
        return (average.cpu_percent < 20 and
                average.memory_percent < 30 and
                average.queue_size < 5 and
                average.active_tasks < 2)


class BatchProcessor:
    """Process multiple reports in batches for efficiency"""

    def __init__(self, max_batch_size: int = 10, max_wait_time: int = 300):
        self.max_batch_size = max_batch_size
        self.max_wait_time = max_wait_time  # 5 minutes
        self.pending_batches = defaultdict(list)
        self._lock = threading.Lock()

    def add_to_batch(self, batch_key: str, task_metadata: TaskMetadata) -> bool:
        """Add task to batch, returns True if batch is ready to process"""
        with self._lock:
            batch = self.pending_batches[batch_key]
            batch.append(task_metadata)

            # Check if batch is ready
            if len(batch) >= self.max_batch_size:
                return True

            # Check if oldest task in batch has been waiting too long
            if batch:
                oldest_task = min(batch, key=lambda x: x.created_at)
                wait_time = (timezone.now() - oldest_task.created_at).total_seconds()
                return wait_time >= self.max_wait_time

            return False

    def get_batch(self, batch_key: str) -> List[TaskMetadata]:
        """Get and clear batch for processing"""
        with self._lock:
            batch = self.pending_batches[batch_key]
            self.pending_batches[batch_key] = []
            return batch

    def create_batch_key(self, template_id: int, export_format: str) -> str:
        """Create batch key for similar tasks"""
        return f"batch:{template_id}:{export_format}"


class AdvancedTaskManager:
    """Main task manager with all advanced features"""

    def __init__(self):
        self.deduplication_manager = TaskDeduplicationManager()
        self.rate_limit_manager = RateLimitManager()
        self.retry_strategy_manager = RetryStrategyManager()
        self.resource_monitor = ResourceMonitor()
        self.batch_processor = BatchProcessor()

        # Task priority queues
        self.priority_queues = {
            priority: deque() for priority in TaskPriority
        }
        self._queue_lock = threading.Lock()

    def can_execute_task(self, user_id: int, template_id: int,
                        task_signature: str = None) -> Tuple[bool, str]:
        """
        Check if task can be executed considering all constraints.
        Returns (allowed, reason)
        """
        # Check rate limits
        user_allowed, user_remaining = self.rate_limit_manager.check_rate_limit(
            'per_user', str(user_id)
        )
        if not user_allowed:
            return False, f"User rate limit exceeded"

        template_allowed, template_remaining = self.rate_limit_manager.check_rate_limit(
            'per_template', str(template_id)
        )
        if not template_allowed:
            return False, f"Template rate limit exceeded"

        global_allowed, global_remaining = self.rate_limit_manager.check_rate_limit(
            'global', 'system'
        )
        if not global_allowed:
            return False, f"System rate limit exceeded"

        # Check for duplicate tasks
        if task_signature:
            existing_task = self.deduplication_manager.is_duplicate_task(task_signature)
            if existing_task:
                return False, f"Duplicate task already running: {existing_task}"

        # Check system resources
        current_usage = self.resource_monitor.get_current_usage()
        if current_usage.cpu_percent > 95 or current_usage.memory_percent > 95:
            return False, "System resources at capacity"

        return True, "Task can be executed"

    def submit_task(self, template_id: int, export_format: str, user_id: int,
                   priority: TaskPriority = TaskPriority.NORMAL,
                   **task_params) -> Tuple[bool, str]:
        """
        Submit task for execution with all advanced features.
        Returns (success, task_id_or_error_message)
        """
        # Generate task signature for deduplication
        task_signature = self.deduplication_manager.generate_task_signature(
            template_id, task_params, export_format, user_id
        )

        # Check if task can be executed
        can_execute, reason = self.can_execute_task(user_id, template_id, task_signature)
        if not can_execute:
            return False, reason

        # Create task metadata
        task_metadata = TaskMetadata(
            task_id=f"task_{int(time.time() * 1000)}",
            priority=priority,
            created_at=timezone.now(),
            user_id=user_id,
            estimated_duration=self._estimate_task_duration(template_id, export_format),
            memory_requirement=self._estimate_memory_requirement(template_id)
        )

        # Check if task should be batched
        batch_key = self.batch_processor.create_batch_key(template_id, export_format)
        if priority == TaskPriority.BATCH:
            batch_ready = self.batch_processor.add_to_batch(batch_key, task_metadata)
            if not batch_ready:
                return True, f"Task added to batch: {task_metadata.task_id}"

        # Register task for deduplication
        self.deduplication_manager.register_task(task_signature, task_metadata.task_id)

        # Add to priority queue
        with self._queue_lock:
            self.priority_queues[priority].append(task_metadata)

        logger.info(f"Task {task_metadata.task_id} submitted with priority {priority.name}")
        return True, task_metadata.task_id

    def get_next_task(self) -> Optional[TaskMetadata]:
        """Get next task to execute based on priority and resources"""
        current_usage = self.resource_monitor.get_current_usage()

        # Don't schedule new tasks if system is overloaded
        if current_usage.cpu_percent > 90 or current_usage.memory_percent > 90:
            logger.warning("System overloaded, deferring task scheduling")
            return None

        with self._queue_lock:
            # Try each priority level
            for priority in TaskPriority:
                queue = self.priority_queues[priority]
                if queue:
                    task = queue.popleft()

                    # Check if we have resources for this task
                    if self._can_allocate_resources(task, current_usage):
                        return task
                    else:
                        # Put task back at front of queue
                        queue.appendleft(task)

        return None

    def handle_task_error(self, task_metadata: TaskMetadata, error: Exception) -> bool:
        """
        Handle task error with intelligent retry strategy.
        Returns True if task should be retried.
        """
        error_type = self.retry_strategy_manager.classify_error(error)
        task_metadata.error_type = error_type
        task_metadata.last_error = str(error)

        should_retry = self.retry_strategy_manager.should_retry(
            error_type, task_metadata.retry_count
        )

        if should_retry:
            retry_delay = self.retry_strategy_manager.get_retry_delay(
                error_type, task_metadata.retry_count
            )
            task_metadata.retry_count += 1

            logger.info(f"Task {task_metadata.task_id} will retry in {retry_delay}s "
                       f"(attempt {task_metadata.retry_count})")

            # Schedule retry (would integrate with Celery countdown)
            return True

        else:
            logger.error(f"Task {task_metadata.task_id} failed permanently: {error}")
            return False

    def complete_task(self, task_metadata: TaskMetadata, success: bool):
        """Mark task as completed and cleanup resources"""
        # Unregister from deduplication
        if hasattr(task_metadata, 'signature'):
            self.deduplication_manager.unregister_task(task_metadata.signature)

        # Log completion metrics
        duration = (timezone.now() - task_metadata.created_at).total_seconds()
        logger.info(f"Task {task_metadata.task_id} completed in {duration:.2f}s "
                   f"(success: {success}, retries: {task_metadata.retry_count})")

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get comprehensive system metrics"""
        current_usage = self.resource_monitor.get_current_usage()
        average_usage = self.resource_monitor.get_average_usage(10)

        queue_sizes = {}
        with self._queue_lock:
            for priority, queue in self.priority_queues.items():
                queue_sizes[priority.name] = len(queue)

        return {
            'timestamp': timezone.now().isoformat(),
            'current_usage': {
                'cpu_percent': current_usage.cpu_percent,
                'memory_percent': current_usage.memory_percent,
                'active_tasks': current_usage.active_tasks,
                'queue_size': current_usage.queue_size
            },
            'average_usage_10min': {
                'cpu_percent': average_usage.cpu_percent,
                'memory_percent': average_usage.memory_percent,
                'active_tasks': average_usage.active_tasks,
                'queue_size': average_usage.queue_size
            },
            'priority_queue_sizes': queue_sizes,
            'scaling_recommendations': {
                'should_scale_up': self.resource_monitor.should_scale_up(),
                'should_scale_down': self.resource_monitor.should_scale_down()
            }
        }

    def _estimate_task_duration(self, template_id: int, export_format: str) -> int:
        """Estimate task duration based on historical data"""
        # This would use historical data from completed tasks
        base_duration = 60  # 1 minute base

        format_multipliers = {
            'csv': 1.0,
            'json': 1.2,
            'excel': 2.0,
            'pdf': 3.0
        }

        return int(base_duration * format_multipliers.get(export_format, 1.5))

    def _estimate_memory_requirement(self, template_id: int) -> int:
        """Estimate memory requirement for task"""
        # This would analyze the template's query complexity
        return 128  # 128MB default

    def _can_allocate_resources(self, task: TaskMetadata,
                               current_usage: ResourceUsage) -> bool:
        """Check if system can allocate resources for task"""
        # Simple resource allocation logic
        estimated_memory_usage = current_usage.memory_percent + (task.memory_requirement / 1024 * 10)

        return (current_usage.cpu_percent < 80 and
                estimated_memory_usage < 85 and
                current_usage.active_tasks < 10)