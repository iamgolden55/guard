# API Gateway Configuration Guide
## Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

### Overview

This document provides comprehensive configuration guidelines for implementing an API Gateway layer for the Legal Compliance Reporting System. The API Gateway serves as a central entry point for all API requests, providing essential cross-cutting concerns including rate limiting, authentication, request validation, response caching, and monitoring.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Applications                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  React Web  │  │ Mobile PWA  │  │  External Systems   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                     API Gateway Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Rate Limiter│  │ Auth Guard  │  │  Request Validator   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Caching   │  │  Monitoring │  │   Load Balancer     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                   Django Backend Services                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Compliance  │  │   Reports   │  │    Violations       │ │
│  │   Service   │  │   Service   │  │     Service         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack Recommendations

#### Option 1: NGINX with Lua (Lightweight)
- **Pros**: High performance, low resource usage, simple configuration
- **Cons**: Limited advanced features, requires Lua scripting knowledge
- **Best for**: Simple deployments, basic rate limiting and caching

#### Option 2: Kong (Feature-Rich Open Source)
- **Pros**: Rich plugin ecosystem, extensive features, good documentation
- **Cons**: Higher resource usage, complex configuration
- **Best for**: Production deployments requiring advanced features

#### Option 3: Django Middleware (Simple Integration)
- **Pros**: Direct integration, Python-based, simple deployment
- **Cons**: Limited scalability, single point of failure
- **Best for**: Development and small-scale deployments

### Recommended Configuration: Kong API Gateway

#### 1. Installation and Basic Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  kong-database:
    image: postgres:13
    environment:
      POSTGRES_DB: kong
      POSTGRES_USER: kong
      POSTGRES_PASSWORD: kong
    volumes:
      - kong_data:/var/lib/postgresql/data
    networks:
      - kong-net

  kong-migrations:
    image: kong:latest
    command: kong migrations bootstrap
    depends_on:
      - kong-database
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_PASSWORD: kong
    networks:
      - kong-net

  kong:
    image: kong:latest
    depends_on:
      - kong-database
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_PASSWORD: kong
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
      KONG_ADMIN_GUI_URL: http://localhost:8002
    ports:
      - "8000:8000"  # Proxy
      - "8001:8001"  # Admin API
      - "8002:8002"  # Admin GUI
    networks:
      - kong-net

volumes:
  kong_data:

networks:
  kong-net:
    driver: bridge
```

#### 2. Service and Route Configuration

```bash
# Create Django backend service
curl -X POST http://localhost:8001/services \
  --data name=compliance-api \
  --data url='http://django-backend:8000'

# Create routes for compliance endpoints
curl -X POST http://localhost:8001/services/compliance-api/routes \
  --data 'paths[]=/api/v1/compliance' \
  --data name=compliance-routes

curl -X POST http://localhost:8001/services/compliance-api/routes \
  --data 'paths[]=/api/v1/reports/compliance' \
  --data name=reports-routes

curl -X POST http://localhost:8001/services/compliance-api/routes \
  --data 'paths[]=/api/v1/violations' \
  --data name=violations-routes

curl -X POST http://localhost:8001/services/compliance-api/routes \
  --data 'paths[]=/api/v1/metrics' \
  --data name=metrics-routes
```

### Rate Limiting Configuration

#### 1. Global Rate Limiting
```bash
# Apply rate limiting globally
curl -X POST http://localhost:8001/plugins \
  --data name=rate-limiting \
  --data config.minute=1000 \
  --data config.hour=10000 \
  --data config.policy=redis \
  --data config.redis_host=redis \
  --data config.redis_port=6379
```

#### 2. Per-Route Rate Limiting
```bash
# Compliance reports (resource-intensive)
curl -X POST http://localhost:8001/routes/reports-routes/plugins \
  --data name=rate-limiting \
  --data config.minute=60 \
  --data config.hour=500 \
  --data config.policy=redis

# Real-time violations (high frequency)
curl -X POST http://localhost:8001/routes/violations-routes/plugins \
  --data name=rate-limiting \
  --data config.minute=200 \
  --data config.hour=2000 \
  --data config.policy=redis

# Compliance settings (low frequency)
curl -X POST http://localhost:8001/routes/compliance-routes/plugins \
  --data name=rate-limiting \
  --data config.minute=100 \
  --data config.hour=1000 \
  --data config.policy=redis
```

#### 3. Role-Based Rate Limiting
```bash
# Admin users - higher limits
curl -X POST http://localhost:8001/plugins \
  --data name=rate-limiting-advanced \
  --data config.limit[0]=2000 \
  --data config.window_size[0]=60 \
  --data config.identifier=header \
  --data config.header_name=X-User-Role \
  --data config.header_value=admin

# Staff users - standard limits
curl -X POST http://localhost:8001/plugins \
  --data name=rate-limiting-advanced \
  --data config.limit[0]=500 \
  --data config.window_size[0]=60 \
  --data config.identifier=header \
  --data config.header_name=X-User-Role \
  --data config.header_value=staff
```

### Authentication Configuration

#### 1. JWT Authentication
```bash
# Enable JWT plugin
curl -X POST http://localhost:8001/plugins \
  --data name=jwt \
  --data config.secret_is_base64=false \
  --data config.key_claim_name=iss \
  --data config.anonymous=""

# Create JWT consumer for the application
curl -X POST http://localhost:8001/consumers \
  --data username=compliance-app

# Add JWT credentials
curl -X POST http://localhost:8001/consumers/compliance-app/jwt \
  --data key=compliance-issuer \
  --data secret="your-jwt-secret-key"
```

#### 2. Request Validation
```bash
# Validate compliance report requests
curl -X POST http://localhost:8001/routes/reports-routes/plugins \
  --data name=request-validator \
  --data config.version=draft4 \
  --data config.body_schema='{
    "type": "object",
    "properties": {
      "start_date": {"type": "string", "format": "date"},
      "end_date": {"type": "string", "format": "date"},
      "venue_ids": {"type": "array", "items": {"type": "integer"}},
      "violation_types": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["start_date", "end_date"]
  }'

# Validate violation creation requests
curl -X POST http://localhost:8001/routes/violations-routes/plugins \
  --data name=request-validator \
  --data config.version=draft4 \
  --data config.body_schema='{
    "type": "object",
    "properties": {
      "violation_type": {"type": "string", "enum": ["working_time", "break_time", "overtime", "rest_period"]},
      "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
      "shift_id": {"type": "integer"},
      "description": {"type": "string", "maxLength": 1000}
    },
    "required": ["violation_type", "severity", "shift_id"]
  }'
```

### Response Caching Configuration

#### 1. Proxy Caching
```bash
# Cache compliance reports (expensive queries)
curl -X POST http://localhost:8001/routes/reports-routes/plugins \
  --data name=proxy-cache \
  --data config.response_code=200 \
  --data config.request_method=GET \
  --data config.content_type="application/json" \
  --data config.cache_ttl=300 \
  --data config.strategy=memory

# Cache metrics data
curl -X POST http://localhost:8001/routes/metrics-routes/plugins \
  --data name=proxy-cache \
  --data config.response_code=200 \
  --data config.request_method=GET \
  --data config.content_type="application/json" \
  --data config.cache_ttl=60 \
  --data config.strategy=redis
```

#### 2. Advanced Caching with Redis
```bash
# Configure Redis-based caching
curl -X POST http://localhost:8001/plugins \
  --data name=proxy-cache-advanced \
  --data config.strategy=redis \
  --data config.redis.host=redis \
  --data config.redis.port=6379 \
  --data config.redis.database=1 \
  --data config.cache_control=true \
  --data config.vary_headers[]=Authorization \
  --data config.vary_headers[]=X-User-Role
```

### Monitoring and Analytics

#### 1. Request Logging
```bash
# Enable comprehensive logging
curl -X POST http://localhost:8001/plugins \
  --data name=file-log \
  --data config.path=/var/log/kong/access.log \
  --data config.reopen=true

# Enable Prometheus metrics
curl -X POST http://localhost:8001/plugins \
  --data name=prometheus \
  --data config.per_consumer=true \
  --data config.status_code_metrics=true \
  --data config.latency_metrics=true \
  --data config.bandwidth_metrics=true
```

#### 2. Custom Analytics
```bash
# StatsD integration for custom metrics
curl -X POST http://localhost:8001/plugins \
  --data name=statsd \
  --data config.host=statsd \
  --data config.port=8125 \
  --data config.metrics[]=request_count \
  --data config.metrics[]=latency \
  --data config.metrics[]=response_size \
  --data config.metrics[]=upstream_latency
```

### Security Configuration

#### 1. CORS Configuration
```bash
# Configure CORS for web applications
curl -X POST http://localhost:8001/plugins \
  --data name=cors \
  --data config.origins="http://localhost:3000,https://compliance.meadgroupltd.co.uk" \
  --data config.methods="GET,POST,PUT,DELETE,PATCH,OPTIONS" \
  --data config.headers="Accept,Accept-Version,Authorization,Content-Length,Content-MD5,Content-Type,Date,X-Auth-Token,X-User-Role" \
  --data config.exposed_headers="X-Auth-Token" \
  --data config.credentials=true \
  --data config.max_age=3600
```

#### 2. IP Restriction
```bash
# Restrict admin endpoints to specific IPs
curl -X POST http://localhost:8001/routes/admin-routes/plugins \
  --data name=ip-restriction \
  --data config.whitelist="10.0.0.0/8,192.168.0.0/16,172.16.0.0/12"
```

#### 3. Request Size Limiting
```bash
# Limit request body size
curl -X POST http://localhost:8001/plugins \
  --data name=request-size-limiting \
  --data config.allowed_payload_size=10
```

### Load Balancing Configuration

#### 1. Multiple Backend Instances
```bash
# Create upstream for load balancing
curl -X POST http://localhost:8001/upstreams \
  --data name=compliance-backend

# Add backend targets
curl -X POST http://localhost:8001/upstreams/compliance-backend/targets \
  --data target=django-backend-1:8000 \
  --data weight=100

curl -X POST http://localhost:8001/upstreams/compliance-backend/targets \
  --data target=django-backend-2:8000 \
  --data weight=100

# Update service to use upstream
curl -X PATCH http://localhost:8001/services/compliance-api \
  --data url='http://compliance-backend'
```

#### 2. Health Checks
```bash
# Configure active health checks
curl -X POST http://localhost:8001/upstreams/compliance-backend \
  --data healthchecks.active.http_path="/health/" \
  --data healthchecks.active.healthy.interval=10 \
  --data healthchecks.active.healthy.successes=3 \
  --data healthchecks.active.unhealthy.interval=5 \
  --data healthchecks.active.unhealthy.tcp_failures=3 \
  --data healthchecks.active.unhealthy.http_failures=3
```

### Alternative: Django Middleware Approach

For simpler deployments, implement API Gateway functionality using Django middleware:

#### 1. Rate Limiting Middleware
```python
# middleware/rate_limiting.py
import time
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings

class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self.is_rate_limited(request):
            return JsonResponse({
                'error': 'Rate limit exceeded',
                'retry_after': 60
            }, status=429)

        return self.get_response(request)

    def is_rate_limited(self, request):
        user_id = getattr(request.user, 'id', None)
        if not user_id:
            return False

        cache_key = f"rate_limit:{user_id}:{int(time.time() // 60)}"
        current_requests = cache.get(cache_key, 0)

        # Role-based limits
        role = getattr(request.user, 'role', 'staff')
        limits = {
            'admin': 2000,
            'manager': 1000,
            'staff': 500
        }

        if current_requests >= limits.get(role, 500):
            return True

        cache.set(cache_key, current_requests + 1, 60)
        return False
```

#### 2. Request Validation Middleware
```python
# middleware/request_validation.py
import json
from jsonschema import validate, ValidationError
from django.http import JsonResponse
from django.conf import settings

VALIDATION_SCHEMAS = {
    'compliance-report': {
        'type': 'object',
        'properties': {
            'start_date': {'type': 'string', 'format': 'date'},
            'end_date': {'type': 'string', 'format': 'date'},
            'venue_ids': {'type': 'array', 'items': {'type': 'integer'}},
            'violation_types': {'type': 'array', 'items': {'type': 'string'}}
        },
        'required': ['start_date', 'end_date']
    }
}

class RequestValidationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ['POST', 'PUT', 'PATCH']:
            validation_error = self.validate_request(request)
            if validation_error:
                return validation_error

        return self.get_response(request)

    def validate_request(self, request):
        schema_key = self.get_schema_key(request.path)
        if not schema_key:
            return None

        try:
            data = json.loads(request.body)
            validate(data, VALIDATION_SCHEMAS[schema_key])
        except (json.JSONDecodeError, ValidationError) as e:
            return JsonResponse({
                'error': 'Invalid request data',
                'details': str(e)
            }, status=400)

        return None

    def get_schema_key(self, path):
        if '/reports/compliance' in path:
            return 'compliance-report'
        return None
```

#### 3. Caching Middleware
```python
# middleware/response_caching.py
import hashlib
from django.core.cache import cache
from django.http import JsonResponse
from django.utils.cache import get_cache_key

class ResponseCachingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method != 'GET':
            return self.get_response(request)

        cache_key = self.generate_cache_key(request)
        cached_response = cache.get(cache_key)

        if cached_response:
            response = JsonResponse(cached_response['data'])
            response['X-Cache'] = 'HIT'
            return response

        response = self.get_response(request)

        if response.status_code == 200:
            ttl = self.get_cache_ttl(request.path)
            if ttl > 0:
                cache.set(cache_key, {
                    'data': response.content,
                    'headers': dict(response.items())
                }, ttl)
                response['X-Cache'] = 'MISS'

        return response

    def generate_cache_key(self, request):
        key_data = f"{request.path}:{request.GET.urlencode()}:{request.user.id}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def get_cache_ttl(self, path):
        cache_config = {
            '/api/v1/reports/compliance': 300,  # 5 minutes
            '/api/v1/metrics': 60,              # 1 minute
            '/api/v1/compliance/settings': 600  # 10 minutes
        }

        for pattern, ttl in cache_config.items():
            if pattern in path:
                return ttl
        return 0
```

### Performance Optimization

#### 1. Connection Pooling
```yaml
# Kong configuration
upstream_keepalive_pool_size: 60
upstream_keepalive_max_requests: 100
upstream_keepalive_idle_timeout: 60s
```

#### 2. Compression
```bash
# Enable gzip compression
curl -X POST http://localhost:8001/plugins \
  --data name=response-transformer \
  --data config.add.headers="Content-Encoding:gzip"
```

#### 3. HTTP/2 Support
```nginx
# NGINX configuration for HTTP/2
server {
    listen 443 ssl http2;
    server_name api.compliance.meadgroupltd.co.uk;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://kong:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Monitoring and Alerting

#### 1. Key Metrics to Monitor
- **Request Rate**: Requests per second across all endpoints
- **Response Time**: P95 and P99 latency percentiles
- **Error Rate**: 4xx and 5xx response percentages
- **Cache Hit Rate**: Percentage of requests served from cache
- **Backend Health**: Upstream service availability

#### 2. Alerting Configuration
```yaml
# Prometheus alerting rules
groups:
- name: api_gateway_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(kong_http_status{code=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: HighLatency
    expr: histogram_quantile(0.95, rate(kong_latency_bucket[5m])) > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High latency detected"
      description: "95th percentile latency is {{ $value }}ms"
```

### Deployment Considerations

#### 1. High Availability Setup
- Deploy Kong in cluster mode with shared database
- Use load balancer in front of Kong instances
- Implement database failover with PostgreSQL clustering

#### 2. Security Hardening
- Disable Kong Admin API in production
- Use environment variables for sensitive configuration
- Implement network segmentation
- Regular security updates and patches

#### 3. Capacity Planning
- **Expected Load**: 1000 concurrent users, 10,000 requests/minute
- **Resource Requirements**:
  - Kong: 2 CPU cores, 4GB RAM per instance
  - PostgreSQL: 4 CPU cores, 8GB RAM
  - Redis: 2 CPU cores, 4GB RAM

### Integration with Existing System

#### 1. Gradual Migration Strategy
```python
# Django URL routing for gradual migration
from django.urls import path, include

urlpatterns = [
    # Legacy direct access (deprecated)
    path('api/v1/compliance/', include('compliance.urls')),

    # New gateway-routed access
    path('gateway/api/v1/', include('compliance.gateway_urls')),
]
```

#### 2. Feature Flags for Gateway Features
```python
# Feature flag implementation
GATEWAY_FEATURES = {
    'RATE_LIMITING': True,
    'REQUEST_VALIDATION': True,
    'RESPONSE_CACHING': True,
    'ADVANCED_MONITORING': False
}

def is_gateway_feature_enabled(feature_name):
    return GATEWAY_FEATURES.get(feature_name, False)
```

### Testing and Validation

#### 1. Load Testing Scripts
```bash
# Apache Bench testing
ab -n 10000 -c 100 -H "Authorization: Bearer <token>" \
   http://localhost:8000/api/v1/compliance/reports/

# Artillery.js testing
artillery run gateway-load-test.yml
```

#### 2. Integration Testing
```python
# pytest test for gateway functionality
import pytest
import requests

def test_rate_limiting():
    """Test that rate limiting is enforced"""
    responses = []
    for _ in range(600):  # Exceed staff limit of 500/minute
        response = requests.get(
            'http://localhost:8000/api/v1/compliance/',
            headers={'Authorization': 'Bearer <staff-token>'}
        )
        responses.append(response.status_code)

    assert 429 in responses  # Rate limit exceeded

def test_caching():
    """Test response caching"""
    # First request - cache miss
    response1 = requests.get('http://localhost:8000/api/v1/metrics/')
    assert response1.headers.get('X-Cache') == 'MISS'

    # Second request - cache hit
    response2 = requests.get('http://localhost:8000/api/v1/metrics/')
    assert response2.headers.get('X-Cache') == 'HIT'
```

### Conclusion

This API Gateway configuration provides a comprehensive solution for managing the Legal Compliance Reporting System's API traffic. The recommended Kong-based approach offers enterprise-grade features while maintaining flexibility for future requirements.

Key benefits of this configuration:
- **Scalability**: Supports horizontal scaling and load distribution
- **Security**: Multi-layered authentication and authorization
- **Performance**: Intelligent caching and request optimization
- **Monitoring**: Comprehensive observability and alerting
- **Reliability**: Health checks and failover capabilities

The configuration is designed to handle the expected load of hundreds of concurrent users while maintaining sub-200ms response times for most operations and ensuring 99.9% uptime through proper redundancy and monitoring.