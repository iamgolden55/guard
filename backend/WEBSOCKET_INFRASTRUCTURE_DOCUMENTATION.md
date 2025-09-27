# Django Channels WebSocket Infrastructure Documentation

## Overview

This document describes the complete WebSocket infrastructure implementation for the Security Staff Management System's reports feature. The implementation provides real-time communication for report generation progress tracking, job status updates, and system notifications.

## Architecture Components

### 1. Core Infrastructure

#### Django Channels Setup
- **Channels Version**: 4.1.0
- **Backend**: Redis channel layer for production scalability
- **ASGI Application**: Configured to handle both HTTP and WebSocket protocols
- **Authentication**: JWT-based authentication middleware for WebSocket connections

#### Key Files
```
backend/
├── core/
│   ├── asgi.py                 # ASGI configuration with protocol routing
│   └── settings.py             # Channels and WebSocket configuration
├── api/
│   ├── consumers.py            # WebSocket consumer classes
│   ├── routing.py              # WebSocket URL routing
│   ├── middleware/
│   │   └── websocket_auth.py   # JWT authentication middleware
│   └── tasks.py                # Updated Celery tasks with WebSocket support
└── requirements.txt            # Updated with Channels dependencies
```

### 2. WebSocket Consumers

#### ReportsConsumer (`/ws/reports/`)
Real-time communication for report generation:

**Supported Message Types (Client → Server):**
- `ping` - Heartbeat/connectivity test
- `subscribe_job` - Subscribe to specific job updates
- `unsubscribe_job` - Unsubscribe from job updates
- `cancel_job` - Request job cancellation
- `get_job_status` - Get current job status

**Message Types (Server → Client):**
- `connection_established` - Connection confirmation
- `pong` - Response to ping
- `heartbeat` - Automatic keep-alive messages
- `report_progress` - Job progress updates
- `report_complete` - Job completion notification
- `report_failed` - Job failure notification
- `report_cancelled` - Job cancellation confirmation
- `job_subscribed` - Job subscription confirmation
- `job_unsubscribed` - Job unsubscription confirmation
- `error` - Error messages

#### NotificationConsumer (`/ws/notifications/`)
General system notifications:

**Message Types:**
- `notification` - General notifications
- `system_alert` - System-wide alerts

### 3. Authentication

#### JWT WebSocket Authentication
```python
# Connection with token in query parameter
ws://localhost:8000/ws/reports/?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Alternative: Authorization header (if supported by client)
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

#### Authentication Flow
1. Client obtains JWT access token from REST API
2. Client includes token in WebSocket connection
3. Middleware validates token and sets `user` in scope
4. Consumer checks user permissions
5. Connection accepted/rejected based on authentication

#### Security Features
- Token validation using same JWT library as REST API
- User activation status checking
- Permission-based access control
- Automatic connection rejection for invalid tokens

### 4. Integration with Celery

#### Enhanced Task Progress Tracking
```python
class TaskProgressTracker:
    def __init__(self, task_id: str, report_job_id: str, user_id: int, total_steps: int = 100):
        # Initialized with WebSocket channel layer

    def update_progress(self, step: int, message: str = ""):
        # Updates Celery task state
        # Updates ReportJob.progress field in database
        # Sends WebSocket notification to connected clients
```

#### WebSocket Notifications in Tasks
- **Progress Updates**: Real-time progress percentages during report generation
- **Completion**: Success notification with download URL and file info
- **Failures**: Error messages with retry information
- **Cancellation**: Confirmation when jobs are cancelled

#### Channel Groups
- `reports_user_{user_id}` - User-specific notifications
- `report_job_{job_id}` - Job-specific subscribers

## Configuration

### Django Settings

```python
# Channel Layer (Redis backend)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
            'symmetric_encryption_keys': [SECRET_KEY],
        },
    },
}

# WebSocket Configuration
WEBSOCKET_URL = 'ws://localhost:8000/ws/'
WEBSOCKET_AUTH_TIMEOUT = 30
WEBSOCKET_HEARTBEAT_INTERVAL = 30
WEBSOCKET_MAX_CONNECTIONS_PER_USER = 5
WEBSOCKET_MAX_MESSAGE_SIZE = 1024 * 1024  # 1MB
```

### ASGI Configuration
```python
application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
```

## Client Usage Examples

### Frontend JavaScript Connection
```javascript
// Obtain JWT token from your auth system
const token = localStorage.getItem('accessToken');

// Connect to reports WebSocket
const ws = new WebSocket(`ws://localhost:8000/ws/reports/?token=${token}`);

ws.onopen = () => {
    console.log('WebSocket connected');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch(data.type) {
        case 'report_progress':
            updateProgressBar(data.job_id, data.progress);
            break;
        case 'report_complete':
            showCompletionNotification(data.job_id, data.download_url);
            break;
        case 'report_failed':
            showErrorNotification(data.job_id, data.error_message);
            break;
        case 'heartbeat':
            // Keep connection alive
            break;
    }
};

// Subscribe to specific job
ws.send(JSON.stringify({
    type: 'subscribe_job',
    job_id: 'your-job-id-here'
}));
```

### React Hook Example
```typescript
const useReportWebSocket = (token: string) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [progress, setProgress] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!token) return;

        const ws = new WebSocket(`ws://localhost:3001/ws/reports/?token=${token}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'report_progress') {
                setProgress(prev => ({
                    ...prev,
                    [data.job_id]: data.progress
                }));
            }
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, [token]);

    return { socket, progress };
};
```

## Message Protocol

### Standard Message Format
```json
{
    "type": "message_type",
    "timestamp": "2024-01-15T10:30:00.000Z",
    ...additional_fields
}
```

### Progress Update Message
```json
{
    "type": "report_progress",
    "job_id": "uuid-here",
    "progress": 45,
    "current": 45,
    "total": 100,
    "message": "Processing data...",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Completion Message
```json
{
    "type": "report_complete",
    "job_id": "uuid-here",
    "file_path": "/media/reports/report_uuid_20240115.pdf",
    "file_size": 2048576,
    "record_count": 1500,
    "generation_time": 45.2,
    "download_url": "/api/v1/reports/jobs/uuid/download/",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Message
```json
{
    "type": "error",
    "message": "Job not found or access denied",
    "job_id": "uuid-here",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing

### Running Tests
```bash
# Install WebSocket dependencies
pip install -r requirements.txt

# Run WebSocket infrastructure tests
python test_websocket_setup.py

# Run specific Django tests
python manage.py test api.tests.test_websockets
```

### Test Coverage
- JWT authentication flow
- Connection establishment and teardown
- Message handling (all types)
- Error handling and edge cases
- Channel layer functionality
- Integration with Celery tasks

## Deployment

### Development
```bash
# Start Redis (required for channel layer)
redis-server

# Start Django with ASGI
daphne -b 0.0.0.0 -p 8000 core.asgi:application

# Or use uvicorn
uvicorn core.asgi:application --host 0.0.0.0 --port 8000
```

### Production Considerations

#### Scalability
- Redis channel layer supports horizontal scaling
- Multiple worker processes can share the same channel layer
- Consider Redis clustering for high availability

#### Security
- Use WSS (WebSocket Secure) in production
- Implement rate limiting for WebSocket connections
- Monitor for abuse/DoS attacks
- Keep JWT tokens with appropriate expiration times

#### Monitoring
- Monitor WebSocket connection counts
- Track message throughput
- Monitor Redis memory usage
- Log authentication failures

#### Load Balancing
- Use sticky sessions or shared storage for WebSocket connections
- Consider WebSocket-aware load balancers
- Implement connection health checks

## Troubleshooting

### Common Issues

#### "Channel layer not configured"
- Ensure Redis is running
- Check CHANNEL_LAYERS configuration
- Verify Redis connection URL

#### "Authentication failed"
- Check JWT token validity
- Verify token is included in connection
- Ensure user is active

#### "Connection refused"
- Check ASGI server is running
- Verify port and host configuration
- Check firewall settings

#### "Messages not received"
- Check channel group membership
- Verify message format
- Check consumer message handlers

### Debugging
```python
# Enable WebSocket logging
LOGGING = {
    'loggers': {
        'api.consumers': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
        'channels': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    }
}
```

## Performance Optimization

### Connection Management
- Implement connection pooling
- Set appropriate heartbeat intervals
- Clean up inactive connections
- Limit concurrent connections per user

### Message Optimization
- Keep messages small and focused
- Use compression for large payloads
- Batch related updates when possible
- Implement message queuing for high throughput

### Resource Usage
- Monitor Redis memory usage
- Set appropriate TTL for channel data
- Clean up expired channel groups
- Monitor WebSocket memory consumption

## Future Enhancements

### Planned Features
- Message persistence for offline clients
- WebSocket connection monitoring dashboard
- Advanced notification routing
- Multi-tenant channel isolation
- Compression support for large messages

### Integration Possibilities
- Push notifications for mobile apps
- Email fallback for offline users
- Slack/Teams integration for system alerts
- WebRTC integration for real-time collaboration

## Support and Maintenance

### Version Compatibility
- Django 5.2+
- Channels 4.1.0+
- Redis 5.0+
- Python 3.11+

### Update Procedures
1. Update dependencies in requirements.txt
2. Run database migrations if needed
3. Test WebSocket functionality
4. Update client-side code if protocol changes
5. Deploy with zero-downtime strategy

This WebSocket infrastructure provides a solid foundation for real-time communication in the Security Staff Management System, with room for future expansion and enhancement as needed.