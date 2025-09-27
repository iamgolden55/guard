# Architectural Decision Records (ADRs)
## Legal Compliance Reporting System

This document captures the key architectural decisions made during the design and implementation of the Legal Compliance Reporting System. Each decision includes context, alternatives considered, and the rationale for the chosen approach.

## Table of Contents

1. [ADR-001: Database Schema Design for Compliance Tracking](#adr-001-database-schema-design-for-compliance-tracking)
2. [ADR-002: REST API Design Patterns](#adr-002-rest-api-design-patterns)
3. [ADR-003: Real-time Compliance Checking Architecture](#adr-003-real-time-compliance-checking-architecture)
4. [ADR-004: Caching Strategy for Performance](#adr-004-caching-strategy-for-performance)
5. [ADR-005: Authentication and Authorization Model](#adr-005-authentication-and-authorization-model)
6. [ADR-006: Violation Detection and Processing](#adr-006-violation-detection-and-processing)
7. [ADR-007: Data Retention and Archival Strategy](#adr-007-data-retention-and-archival-strategy)
8. [ADR-008: Scalability and Performance Optimization](#adr-008-scalability-and-performance-optimization)
9. [ADR-009: Error Handling and Logging Strategy](#adr-009-error-handling-and-logging-strategy)
10. [ADR-010: Integration with External Systems](#adr-010-integration-with-external-systems)

---

## ADR-001: Database Schema Design for Compliance Tracking

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: django-backend-expert, django-orm-expert

### Context

The compliance system needs to track working hours violations, maintain regulatory rules by country, store user compliance profiles, and generate comprehensive reports. The system must handle complex relationships between users, shifts, regulations, and violations while maintaining performance for real-time queries.

### Decision

We have chosen a **normalized relational database schema** with the following core models:

#### Core Models Structure:
```python
# Primary Models
- WorkingHoursRegulation: Country-specific regulatory rules
- ComplianceProfile: Organizational compliance settings
- ComplianceViolation: Individual violation records
- WorkingHoursMetrics: Aggregated compliance metrics

# Relationships
- ComplianceProfile → WorkingHoursRegulation (ForeignKey)
- ComplianceViolation → User, Shift, ComplianceProfile (ForeignKey)
- WorkingHoursMetrics → User (ForeignKey)
```

#### Key Design Principles:
1. **Separation of Concerns**: Regulations, profiles, and violations are distinct entities
2. **Flexibility**: JSON fields for custom rules and evidence data
3. **Performance**: Denormalized fields for frequently accessed data
4. **Auditability**: Complete timestamp and user tracking
5. **Scalability**: Indexed fields for common query patterns

### Alternatives Considered

#### Option 1: Single Monolithic Compliance Table
- **Pros**: Simple structure, easy queries
- **Cons**: Data duplication, poor maintainability, limited flexibility

#### Option 2: Document Database (MongoDB)
- **Pros**: Flexible schema, good for JSON data
- **Cons**: Complex relationships, limited transaction support, team expertise

#### Option 3: Event Sourcing Pattern
- **Pros**: Complete audit trail, temporal queries
- **Cons**: Complex implementation, steep learning curve, over-engineering

### Rationale

The chosen normalized relational approach provides:

1. **Data Integrity**: Foreign key constraints ensure referential integrity
2. **Query Performance**: Proper indexing supports real-time compliance checks
3. **Maintainability**: Clear separation of concerns and well-defined relationships
4. **Flexibility**: JSON fields for custom rules while maintaining structure
5. **Team Familiarity**: Leverages existing Django ORM expertise

### Performance Considerations

```sql
-- Key indexes for performance
CREATE INDEX idx_compliance_violation_user_period ON compliance_violation(user_id, period_start, period_end);
CREATE INDEX idx_compliance_violation_severity_status ON compliance_violation(severity, resolution_status);
CREATE INDEX idx_working_hours_metrics_user_period ON working_hours_metrics(user_id, period_type, period_start);

-- Composite indexes for common queries
CREATE INDEX idx_violation_lookup ON compliance_violation(user_id, resolution_status, severity);
CREATE INDEX idx_metrics_reporting ON working_hours_metrics(period_start, period_type, created_at);
```

### Consequences

**Positive**:
- Fast compliance checking queries (< 50ms target)
- Clear data model for frontend integration
- Supports complex reporting requirements
- Maintains data consistency

**Negative**:
- Requires careful migration planning
- Complex joins for some reporting queries
- Storage overhead from denormalized fields

---

## ADR-002: REST API Design Patterns

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: django-api-developer, api-architect

### Context

The compliance system needs consistent, intuitive APIs for frontend integration while supporting complex filtering, real-time operations, and bulk actions. The API must be scalable and maintainable for future enhancements.

### Decision

We have adopted **RESTful API design** with Django REST Framework using the following patterns:

#### URL Structure:
```
/api/v1/compliance/regulations/       # Working hours regulations
/api/v1/compliance/profiles/          # Compliance profiles
/api/v1/compliance/violations/        # Violation management
/api/v1/compliance/reports/           # Reporting endpoints
/api/v1/compliance/metrics/           # Performance metrics
/api/v1/compliance/check/             # Real-time compliance
/api/v1/compliance/alerts/            # System alerts
```

#### Consistent Response Format:
```json
{
  "status": "success|error",
  "data": {...},
  "message": "Optional message",
  "cached": false,
  "count": 0,
  "pagination": {...}
}
```

#### Design Principles:
1. **Resource-Based URLs**: Clear noun-based endpoints
2. **HTTP Method Semantics**: Proper use of GET/POST/PUT/PATCH/DELETE
3. **Consistent Filtering**: Standardized query parameters
4. **Pagination**: Cursor-based for performance, offset for simplicity
5. **Error Handling**: Structured error responses with field-level details

### Alternatives Considered

#### Option 1: GraphQL API
- **Pros**: Flexible queries, single endpoint, strong typing
- **Cons**: Complexity overhead, caching challenges, team learning curve

#### Option 2: RPC-Style API
- **Pros**: Action-oriented, simple implementation
- **Cons**: Poor cacheability, non-standard, limited tooling

#### Option 3: Custom API Format
- **Pros**: Tailored to specific needs
- **Cons**: Non-standard, poor tooling support, maintenance overhead

### Rationale

RESTful design was chosen because:

1. **Industry Standard**: Well-understood patterns and tooling
2. **Caching**: Excellent HTTP caching support
3. **Frontend Integration**: Works naturally with modern frontend frameworks
4. **Documentation**: OpenAPI/Swagger compatibility
5. **Testing**: Standard testing tools and practices

### Implementation Details

#### Permission-Based Filtering:
```python
# Automatic filtering based on user role
class ComplianceViolationViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if self.request.user.role == 'staff':
            return ComplianceViolation.objects.filter(user=self.request.user)
        elif self.request.user.role == 'manager':
            return ComplianceViolation.objects.filter(
                user__in=self.request.user.managed_users()
            )
        else:  # admin
            return ComplianceViolation.objects.all()
```

#### Optimized Pagination:
```python
# Cursor-based pagination for large datasets
class CursorPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'limit'
    max_page_size = 100

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'properties': {
                'next': {'type': 'string', 'nullable': True},
                'previous': {'type': 'string', 'nullable': True},
                'results': schema,
            },
        }
```

### Consequences

**Positive**:
- Intuitive API for frontend developers
- Excellent caching and performance characteristics
- Standard tooling and documentation support
- Scalable URL structure for future features

**Negative**:
- Multiple round trips for complex data requirements
- Potential over-fetching for simple use cases
- Complex nested resource handling

---

## ADR-003: Real-time Compliance Checking Architecture

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: django-backend-expert, performance-optimizer

### Context

The system must perform real-time compliance checks during shift scheduling to prevent violations before they occur. These checks must complete within 50ms to maintain user experience while accessing complex historical data and multiple regulatory rules.

### Decision

We have implemented a **hybrid caching architecture** with the following components:

#### Architecture Components:
1. **In-Memory Cache Layer**: Redis for hot data
2. **Database Query Optimization**: Specialized indexes and queries
3. **Pre-computed Aggregates**: Background calculation of metrics
4. **Intelligent Cache Warming**: Proactive data loading

#### Implementation Strategy:
```python
class RealTimeComplianceEngine:
    def __init__(self):
        self.cache = ComplianceCache()
        self.regulations = RegulationCache()

    async def check_compliance(self, user_id, shift_start, shift_end, venue_id=None):
        # 1. Load cached user context (< 5ms)
        user_context = await self.cache.get_user_context(user_id)

        # 2. Get active regulations (< 2ms)
        regulations = await self.regulations.get_active_rules()

        # 3. Calculate compliance (< 20ms)
        result = await self._calculate_compliance(
            user_context, regulations, shift_start, shift_end, venue_id
        )

        # 4. Cache result for similar queries (< 2ms)
        await self.cache.set_result(cache_key, result, ttl=300)

        return result
```

#### Caching Strategy:
```python
# User context cache (30-minute TTL)
user_context = {
    'current_week_hours': 32.5,
    'consecutive_days': 4,
    'last_shift_end': '2025-01-15T18:00:00Z',
    'recent_violations': [...],
    'compliance_profile_id': 1
}

# Regulation cache (24-hour TTL)
regulations_cache = {
    'max_daily_hours': 12.0,
    'max_weekly_hours': 48.0,
    'min_rest_hours': 11.0,
    'overtime_threshold': 40.0
}
```

### Alternatives Considered

#### Option 1: Synchronous Database Queries
- **Pros**: Simple implementation, no caching complexity
- **Cons**: Poor performance (200-500ms), database load

#### Option 2: Pre-computed Compliance Matrix
- **Pros**: Ultra-fast lookups (< 10ms)
- **Cons**: Storage overhead, complex updates, limited flexibility

#### Option 3: Event-Driven Async Processing
- **Pros**: Highly scalable, decoupled architecture
- **Cons**: Complex implementation, eventual consistency issues

### Rationale

The hybrid caching approach was selected because:

1. **Performance**: Meets 50ms target consistently
2. **Accuracy**: Real-time data for critical decisions
3. **Scalability**: Handles increasing user load
4. **Maintainability**: Balances complexity and performance
5. **Reliability**: Graceful degradation when cache unavailable

### Performance Metrics

```python
# Target performance benchmarks
COMPLIANCE_CHECK_TARGETS = {
    'cache_hit_latency': '< 20ms',
    'cache_miss_latency': '< 50ms',
    'cache_hit_ratio': '> 85%',
    'database_query_time': '< 25ms',
    'memory_usage': '< 100MB per worker'
}

# Monitoring and alerting
class CompliancePerformanceMonitor:
    def track_compliance_check(self, duration_ms, cache_hit):
        metrics.histogram('compliance_check_duration', duration_ms)
        metrics.increment('compliance_check_total')
        if cache_hit:
            metrics.increment('compliance_check_cache_hit')
        else:
            metrics.increment('compliance_check_cache_miss')
```

### Consequences

**Positive**:
- Meets performance requirements consistently
- Scales with user growth
- Maintains data accuracy for critical decisions
- Provides monitoring and optimization capabilities

**Negative**:
- Increased system complexity
- Cache invalidation challenges
- Memory usage overhead
- Dependency on Redis infrastructure

---

## ADR-004: Caching Strategy for Performance

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: performance-optimizer, django-backend-expert

### Context

The compliance system serves multiple types of data with different access patterns and freshness requirements. Dashboard queries, user metrics, and regulatory data need optimized caching to support hundreds of concurrent users while maintaining data consistency.

### Decision

We have implemented a **multi-tier caching strategy** with different TTL values based on data volatility:

#### Cache Layers:
1. **Application Cache (Redis)**: Hot data and computed results
2. **Database Query Cache**: ORM-level query caching
3. **HTTP Response Cache**: API response caching
4. **Browser Cache**: Static compliance rules and reference data

#### Cache Configuration:
```python
COMPLIANCE_CACHE_CONFIG = {
    # Hot data - frequent access
    'user_compliance_status': {'ttl': 300, 'tier': 'redis'},      # 5 minutes
    'active_violations': {'ttl': 180, 'tier': 'redis'},          # 3 minutes
    'compliance_alerts': {'ttl': 60, 'tier': 'redis'},           # 1 minute

    # Warm data - moderate access
    'compliance_metrics': {'ttl': 1800, 'tier': 'redis'},        # 30 minutes
    'dashboard_summary': {'ttl': 900, 'tier': 'redis'},          # 15 minutes
    'user_working_hours': {'ttl': 600, 'tier': 'redis'},         # 10 minutes

    # Cold data - infrequent changes
    'working_hours_regulations': {'ttl': 86400, 'tier': 'redis'}, # 24 hours
    'compliance_profiles': {'ttl': 3600, 'tier': 'redis'},        # 1 hour
    'country_regulations': {'ttl': 43200, 'tier': 'redis'},       # 12 hours
}
```

#### Implementation:
```python
class ComplianceCache:
    def __init__(self):
        self.redis_client = redis.Redis(connection_pool=redis_pool)
        self.local_cache = {}  # In-process cache for ultra-hot data

    async def get_user_compliance_status(self, user_id):
        cache_key = f"compliance:user:{user_id}:status"

        # L1: In-process cache (microseconds)
        if cache_key in self.local_cache:
            data, expires = self.local_cache[cache_key]
            if time.time() < expires:
                return data

        # L2: Redis cache (milliseconds)
        cached_data = await self.redis_client.get(cache_key)
        if cached_data:
            data = json.loads(cached_data)
            # Store in L1 cache for 30 seconds
            self.local_cache[cache_key] = (data, time.time() + 30)
            return data

        # L3: Database fallback (tens of milliseconds)
        data = await self._compute_user_compliance_status(user_id)

        # Cache in both layers
        await self.redis_client.setex(
            cache_key,
            COMPLIANCE_CACHE_CONFIG['user_compliance_status']['ttl'],
            json.dumps(data, cls=DjangoJSONEncoder)
        )
        self.local_cache[cache_key] = (data, time.time() + 30)

        return data
```

### Cache Invalidation Strategy:

```python
class ComplianceCacheInvalidator:
    def __init__(self):
        self.cache = ComplianceCache()

    def invalidate_user_data(self, user_id):
        """Invalidate all cache entries for a specific user"""
        patterns = [
            f"compliance:user:{user_id}:*",
            f"metrics:user:{user_id}:*",
            f"violations:user:{user_id}:*"
        ]

        for pattern in patterns:
            keys = self.cache.redis_client.keys(pattern)
            if keys:
                self.cache.redis_client.delete(*keys)

    def invalidate_dashboard_cache(self):
        """Invalidate dashboard-related cache entries"""
        patterns = [
            "compliance:dashboard:*",
            "compliance:summary:*",
            "compliance:trends:*"
        ]

        for pattern in patterns:
            keys = self.cache.redis_client.keys(pattern)
            if keys:
                self.cache.redis_client.delete(*keys)

    # Signal handlers for automatic invalidation
    @receiver(post_save, sender=ComplianceViolation)
    def violation_updated(self, instance, **kwargs):
        self.invalidate_user_data(instance.user_id)
        self.invalidate_dashboard_cache()

    @receiver(post_save, sender=WorkingHoursMetrics)
    def metrics_updated(self, instance, **kwargs):
        self.invalidate_user_data(instance.user_id)
```

### Alternatives Considered

#### Option 1: Database-Only Caching
- **Pros**: Simple, consistent, no additional infrastructure
- **Cons**: Limited performance, database load, slow complex queries

#### Option 2: Application-Level Caching Only
- **Pros**: Fast access, simple implementation
- **Cons**: Memory limitations, process restarts clear cache, no sharing

#### Option 3: CDN + API Gateway Caching
- **Pros**: Geographic distribution, reduced server load
- **Cons**: Complex invalidation, over-caching dynamic data

### Rationale

The multi-tier approach provides:

1. **Performance Optimization**: Different cache layers for different access patterns
2. **Scalability**: Redis handles concurrent access better than database
3. **Flexibility**: Different TTL values for different data types
4. **Reliability**: Fallback to database when cache unavailable
5. **Cost Efficiency**: Reduces database load and server resources

### Cache Monitoring and Metrics:

```python
class CacheMetricsCollector:
    def track_cache_operation(self, operation, key, hit=None, duration=None):
        base_tags = {
            'operation': operation,
            'cache_tier': self._get_cache_tier(key)
        }

        if hit is not None:
            metrics.increment(f'cache.{operation}', tags={
                **base_tags,
                'result': 'hit' if hit else 'miss'
            })

        if duration is not None:
            metrics.histogram(f'cache.{operation}.duration',
                            duration, tags=base_tags)

    def get_cache_health_metrics(self):
        return {
            'hit_ratio': self._calculate_hit_ratio(),
            'avg_response_time': self._calculate_avg_response_time(),
            'memory_usage': self._get_memory_usage(),
            'connection_pool_status': self._get_connection_status()
        }
```

### Consequences

**Positive**:
- Significant performance improvement (5-10x faster for cached data)
- Reduced database load and costs
- Better user experience with faster page loads
- Scalable architecture supporting growth

**Negative**:
- Increased system complexity
- Additional infrastructure dependencies (Redis)
- Cache consistency challenges
- Memory usage overhead

---

## ADR-005: Authentication and Authorization Model

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: django-api-developer, security-reviewer

### Context

The compliance system requires secure authentication and fine-grained authorization to protect sensitive employment data. Different user roles (Staff, Manager, Admin) need different levels of access to compliance information, with audit trails for all data access.

### Decision

We have implemented **JWT-based authentication** with **role-based access control (RBAC)**:

#### Authentication Flow:
```python
# JWT Token Configuration
JWT_AUTH = {
    'JWT_SECRET_KEY': settings.SECRET_KEY,
    'JWT_ALGORITHM': 'HS256',
    'JWT_EXPIRATION_DELTA': timedelta(hours=1),
    'JWT_REFRESH_EXPIRATION_DELTA': timedelta(days=7),
    'JWT_AUTH_HEADER_PREFIX': 'Bearer',
    'JWT_ALLOW_REFRESH': True,
}

# Token Structure
{
    'user_id': 123,
    'username': 'john_doe',
    'role': 'manager',
    'permissions': ['view_team_compliance', 'resolve_violations'],
    'iat': 1642089600,
    'exp': 1642093200,
    'jti': 'unique-token-id'
}
```

#### Authorization Matrix:
```python
COMPLIANCE_PERMISSIONS = {
    'staff': {
        'compliance_violations': ['view_own'],
        'compliance_metrics': ['view_own'],
        'compliance_reports': ['view_own'],
        'working_hours_regulations': ['view'],
        'compliance_profiles': ['view_active'],
    },
    'manager': {
        'compliance_violations': ['view_team', 'resolve'],
        'compliance_metrics': ['view_team'],
        'compliance_reports': ['view_team', 'export'],
        'working_hours_regulations': ['view'],
        'compliance_profiles': ['view_active'],
        'compliance_alerts': ['view_team'],
    },
    'admin': {
        'compliance_violations': ['view_all', 'resolve', 'bulk_resolve'],
        'compliance_metrics': ['view_all', 'recalculate'],
        'compliance_reports': ['view_all', 'export_all'],
        'working_hours_regulations': ['view', 'create', 'update'],
        'compliance_profiles': ['view_all', 'create', 'update', 'set_active'],
        'compliance_alerts': ['view_all', 'manage'],
    }
}
```

#### Permission Enforcement:
```python
class CompliancePermissions:
    def has_permission(self, request, view):
        """Check if user has basic access to the endpoint"""
        if not request.user.is_authenticated:
            return False

        # Check role-based permissions
        user_role = request.user.role
        required_permissions = self.get_required_permissions(view.action)
        user_permissions = COMPLIANCE_PERMISSIONS.get(user_role, {})

        return self._check_permissions(required_permissions, user_permissions)

    def has_object_permission(self, request, view, obj):
        """Check if user can access specific object"""
        user_role = request.user.role

        if user_role == 'staff':
            # Staff can only see their own data
            return obj.user_id == request.user.id
        elif user_role == 'manager':
            # Managers can see their team's data
            return obj.user_id in request.user.get_team_member_ids()
        else:  # admin
            # Admins can see everything
            return True
```

#### Audit Logging:
```python
class ComplianceAuditLogger:
    def log_data_access(self, user, model, instance_id, action):
        """Log all compliance data access for audit purposes"""
        ComplianceAuditLog.objects.create(
            user=user,
            model_name=model.__name__,
            instance_id=instance_id,
            action=action,
            ip_address=self.get_client_ip(),
            user_agent=self.get_user_agent(),
            timestamp=timezone.now()
        )

    def log_violation_access(self, user, violation, action):
        """Specific logging for violation access"""
        self.log_data_access(user, ComplianceViolation, violation.id, action)

        # Additional metadata for compliance violations
        ComplianceViolationAccessLog.objects.create(
            violation=violation,
            accessed_by=user,
            access_type=action,
            violation_user=violation.user,
            severity=violation.severity,
            timestamp=timezone.now()
        )
```

### Alternatives Considered

#### Option 1: Session-Based Authentication
- **Pros**: Server-side session control, familiar pattern
- **Cons**: Poor scalability, stateful servers, CSRF concerns

#### Option 2: OAuth 2.0 with External Provider
- **Pros**: Standardized protocol, external security responsibility
- **Cons**: External dependency, complex setup, user management overhead

#### Option 3: API Key Authentication
- **Pros**: Simple implementation, no token expiration
- **Cons**: No user context, poor security, no fine-grained permissions

### Rationale

JWT with RBAC was chosen because:

1. **Stateless**: Scales horizontally without session storage
2. **Secure**: Industry-standard tokens with expiration
3. **Flexible**: Fine-grained role-based permissions
4. **Auditable**: Complete access logging and tracking
5. **Mobile-Friendly**: Works well with mobile applications

### Security Implementation:

```python
# Token Security Measures
class JWTSecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.blacklisted_tokens = set()

    def __call__(self, request):
        # Validate token signature and expiration
        token = self.extract_token(request)
        if token:
            if self.is_blacklisted(token):
                return JsonResponse({'error': 'Token revoked'}, status=401)

            if not self.validate_token_security(token):
                return JsonResponse({'error': 'Token security check failed'}, status=401)

        return self.get_response(request)

    def validate_token_security(self, token):
        """Additional security validations"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])

            # Check token age
            issued_at = payload.get('iat', 0)
            if time.time() - issued_at > settings.JWT_MAX_AGE:
                return False

            # Check for suspicious patterns
            if self.detect_token_anomaly(payload):
                return False

            return True
        except jwt.InvalidTokenError:
            return False

    def blacklist_token(self, token):
        """Blacklist a specific token (for logout/security)"""
        self.blacklisted_tokens.add(token)

        # Store in Redis for distributed blacklisting
        redis_client.sadd('blacklisted_tokens', token)
        redis_client.expire('blacklisted_tokens', 86400 * 7)  # 7 days
```

### Consequences

**Positive**:
- Secure, scalable authentication system
- Fine-grained access control for compliance data
- Complete audit trail for regulatory compliance
- Flexible permission system for future roles

**Negative**:
- Token management complexity
- Additional security considerations (token storage, expiration)
- Increased request processing time for permission checks
- Potential for authorization logic complexity

---

## ADR-006: Violation Detection and Processing

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: django-backend-expert, business-analyst

### Context

The system must automatically detect compliance violations in real-time as shifts are created, updated, or completed. Detection must be reliable, performant, and handle complex regulatory rules while providing clear violation descriptions and evidence.

### Decision

We have implemented an **event-driven violation detection system** with multiple detection triggers:

#### Detection Architecture:
```python
class ViolationDetectionEngine:
    def __init__(self):
        self.detectors = [
            DailyHoursViolationDetector(),
            WeeklyHoursViolationDetector(),
            ConsecutiveDaysViolationDetector(),
            RestPeriodViolationDetector(),
            BreakViolationDetector(),
            LocationViolationDetector(),
        ]

    async def detect_violations(self, shift, trigger_event='shift_completed'):
        """Main violation detection entry point"""
        violations = []

        for detector in self.detectors:
            try:
                detected = await detector.check_violation(shift, trigger_event)
                if detected:
                    violations.extend(detected)
            except Exception as e:
                logger.error(f"Violation detector {detector.__class__.__name__} failed: {e}")
                # Continue with other detectors

        # Process and save violations
        for violation_data in violations:
            await self._create_violation(violation_data)

        return violations
```

#### Detection Triggers:
1. **Real-time Triggers**: During shift scheduling and updates
2. **Completion Triggers**: When shifts are marked as completed
3. **Batch Triggers**: Nightly processing for missed violations
4. **Manual Triggers**: Admin-initiated violation scans

#### Specific Detectors:
```python
class DailyHoursViolationDetector(BaseViolationDetector):
    violation_type = 'daily_overtime'

    async def check_violation(self, shift, trigger_event):
        user = shift.user
        shift_date = shift.start_time.date()

        # Get all shifts for the same day
        daily_shifts = await Shift.objects.filter(
            user=user,
            start_time__date=shift_date,
            status__in=['completed', 'in_progress']
        ).select_related('venue')

        total_hours = sum(s.duration_hours for s in daily_shifts)
        max_daily_hours = await self._get_max_daily_hours(user)

        if total_hours > max_daily_hours:
            return await self._create_violation_data(
                user=user,
                violation_type=self.violation_type,
                severity=self._calculate_severity(total_hours, max_daily_hours),
                period_start=shift_date,
                period_end=shift_date,
                shifts=daily_shifts,
                calculated_values={
                    'total_hours': total_hours,
                    'limit': max_daily_hours,
                    'exceeded_by': total_hours - max_daily_hours
                },
                evidence_data={
                    'shifts': [s.id for s in daily_shifts],
                    'breakdown': [
                        {
                            'shift_id': s.id,
                            'venue': s.venue.name,
                            'start': s.start_time,
                            'end': s.end_time,
                            'hours': s.duration_hours
                        } for s in daily_shifts
                    ]
                }
            )

        return None

class WeeklyHoursViolationDetector(BaseViolationDetector):
    violation_type = 'weekly_overtime'

    async def check_violation(self, shift, trigger_event):
        user = shift.user
        week_start, week_end = self._get_week_boundaries(shift.start_time)

        # Get weekly shifts with optimized query
        weekly_shifts = await Shift.objects.filter(
            user=user,
            start_time__gte=week_start,
            start_time__lt=week_end,
            status__in=['completed', 'in_progress']
        ).select_related('venue').order_by('start_time')

        total_hours = sum(s.duration_hours for s in weekly_shifts)
        max_weekly_hours = await self._get_max_weekly_hours(user)

        if total_hours > max_weekly_hours:
            return await self._create_violation_data(
                user=user,
                violation_type=self.violation_type,
                severity=self._calculate_severity(total_hours, max_weekly_hours),
                period_start=week_start,
                period_end=week_end,
                shifts=weekly_shifts,
                calculated_values={
                    'total_hours': total_hours,
                    'limit': max_weekly_hours,
                    'exceeded_by': total_hours - max_weekly_hours,
                    'days_worked': len(set(s.start_time.date() for s in weekly_shifts))
                }
            )

        return None
```

#### Violation Severity Calculation:
```python
class SeverityCalculator:
    def calculate_violation_severity(self, violation_type, exceeded_by, limit):
        """Calculate severity based on violation type and amount exceeded"""

        if violation_type in ['daily_overtime', 'weekly_overtime']:
            percentage_exceeded = (exceeded_by / limit) * 100

            if percentage_exceeded >= 25:  # 25%+ over limit
                return 'critical'
            elif percentage_exceeded >= 15:  # 15-24% over limit
                return 'major'
            elif percentage_exceeded >= 5:   # 5-14% over limit
                return 'minor'
            else:                           # <5% over limit
                return 'warning'

        elif violation_type == 'insufficient_rest':
            hours_short = limit - exceeded_by  # exceeded_by is actual rest in this case

            if hours_short >= 6:    # 6+ hours short of required rest
                return 'critical'
            elif hours_short >= 3:  # 3-5 hours short
                return 'major'
            elif hours_short >= 1:  # 1-2 hours short
                return 'minor'
            else:                   # <1 hour short
                return 'warning'

        elif violation_type == 'consecutive_days':
            days_over = exceeded_by - limit

            if days_over >= 3:      # 3+ days over limit
                return 'critical'
            elif days_over >= 2:    # 2 days over
                return 'major'
            elif days_over >= 1:    # 1 day over
                return 'minor'
            else:
                return 'warning'

        return 'minor'  # Default for unknown types
```

### Alternatives Considered

#### Option 1: Scheduled Batch Processing
- **Pros**: Simple implementation, predictable load
- **Cons**: Delayed detection, no real-time prevention

#### Option 2: Database Triggers
- **Pros**: Immediate detection, database-level consistency
- **Cons**: Database-specific, limited business logic, harder testing

#### Option 3: External Rules Engine
- **Pros**: Powerful rule definition, visual configuration
- **Cons**: Additional complexity, external dependency, cost

### Rationale

Event-driven detection was chosen because:

1. **Real-time Prevention**: Catches violations during scheduling
2. **Flexibility**: Easy to add new violation types and rules
3. **Reliability**: Multiple detection triggers ensure nothing is missed
4. **Performance**: Efficient queries and caching for fast detection
5. **Auditability**: Complete evidence trail for each violation

### Processing Workflow:

```python
# Signal-based triggers
@receiver(post_save, sender=Shift)
def shift_saved_handler(sender, instance, created, **kwargs):
    if created or instance.has_significant_changes():
        # Trigger violation detection asynchronously
        detect_violations_task.delay(instance.id, 'shift_updated')

@receiver(post_save, sender=Shift)
def shift_completed_handler(sender, instance, **kwargs):
    if instance.status == 'completed' and instance.previous_status != 'completed':
        # Trigger comprehensive violation check
        detect_violations_task.delay(instance.id, 'shift_completed')

# Celery task for async processing
@shared_task(bind=True, max_retries=3)
def detect_violations_task(self, shift_id, trigger_event):
    try:
        shift = Shift.objects.select_related('user', 'venue').get(id=shift_id)
        engine = ViolationDetectionEngine()
        violations = await engine.detect_violations(shift, trigger_event)

        # Send notifications for critical violations
        for violation in violations:
            if violation.severity == 'critical':
                send_critical_violation_alert.delay(violation.id)

    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

### Consequences

**Positive**:
- Proactive violation prevention during scheduling
- Comprehensive detection of all violation types
- Complete audit trail and evidence collection
- Scalable architecture for additional rules

**Negative**:
- Increased system complexity
- Performance impact during peak scheduling times
- Potential for false positives requiring manual review
- Dependency on background task processing

---

## ADR-007: Data Retention and Archival Strategy

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: compliance-officer, django-backend-expert

### Context

Compliance data must be retained for legal and regulatory purposes, with different retention periods for different types of data. The system must balance storage costs, query performance, and regulatory compliance while maintaining data accessibility for historical reporting.

### Decision

We have implemented a **tiered data retention strategy** with automatic archival and purging:

#### Retention Policy:
```python
COMPLIANCE_RETENTION_POLICY = {
    # Active data - fast access required
    'active': {
        'compliance_violations': 730,      # 2 years
        'working_hours_metrics': 1095,    # 3 years
        'compliance_audit_logs': 2555,    # 7 years
        'violation_evidence': 2555,       # 7 years
    },

    # Archived data - slower access acceptable
    'archived': {
        'compliance_violations': 3650,     # 10 years total (8 archived)
        'working_hours_metrics': 3650,     # 10 years total (7 archived)
        'compliance_audit_logs': 10950,    # 30 years total (23 archived)
    },

    # Permanent retention
    'permanent': {
        'working_hours_regulations': None,  # Regulatory history
        'compliance_profiles': None,        # Configuration history
        'critical_violations': None,        # Legal evidence
    }
}
```

#### Archival Architecture:
```python
class ComplianceDataArchiver:
    def __init__(self):
        self.active_db = 'default'
        self.archive_db = 'archive'
        self.cold_storage = ColdStorageService()

    def archive_violations(self, cutoff_date):
        """Move old violations to archive database"""
        violations_to_archive = ComplianceViolation.objects.filter(
            created_at__lt=cutoff_date,
            is_archived=False
        ).prefetch_related('evidence_files')

        batch_size = 1000
        archived_count = 0

        for batch in self._batch_queryset(violations_to_archive, batch_size):
            # Copy to archive database
            archive_records = []
            evidence_files = []

            for violation in batch:
                # Create archived violation record
                archived_violation = ArchivedComplianceViolation(
                    original_id=violation.id,
                    user_id=violation.user_id,
                    violation_type=violation.violation_type,
                    severity=violation.severity,
                    period_start=violation.period_start,
                    period_end=violation.period_end,
                    description=violation.description,
                    calculated_values=violation.calculated_values,
                    evidence_data=violation.evidence_data,
                    resolution_status=violation.resolution_status,
                    resolution_notes=violation.resolution_notes,
                    created_at=violation.created_at,
                    archived_at=timezone.now()
                )
                archive_records.append(archived_violation)

                # Collect evidence files for cold storage
                if violation.evidence_files.exists():
                    evidence_files.extend(violation.evidence_files.all())

            # Batch insert to archive database
            ArchivedComplianceViolation.objects.using(self.archive_db).bulk_create(
                archive_records
            )

            # Move evidence files to cold storage
            for evidence_file in evidence_files:
                cold_path = self.cold_storage.store_file(evidence_file)
                evidence_file.cold_storage_path = cold_path
                evidence_file.save()

            # Mark original records as archived
            violation_ids = [v.id for v in batch]
            ComplianceViolation.objects.filter(id__in=violation_ids).update(
                is_archived=True,
                archived_at=timezone.now()
            )

            archived_count += len(batch)
            logger.info(f"Archived {archived_count} compliance violations")

        return archived_count
```

#### Cold Storage Integration:
```python
class ColdStorageService:
    """Integration with AWS S3 Glacier for long-term storage"""

    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.glacier_vault = 'compliance-archive'

    def store_violation_evidence(self, violation, evidence_data):
        """Store violation evidence in cold storage"""

        # Create archive package
        archive_data = {
            'violation_id': violation.id,
            'user_id': violation.user_id,
            'evidence_data': evidence_data,
            'metadata': {
                'violation_type': violation.violation_type,
                'severity': violation.severity,
                'created_at': violation.created_at.isoformat(),
                'archived_at': timezone.now().isoformat()
            }
        }

        # Compress and encrypt
        compressed_data = self._compress_data(archive_data)
        encrypted_data = self._encrypt_data(compressed_data)

        # Store in S3 Glacier
        key = f"compliance/{violation.created_at.year}/{violation.id}.archive"

        response = self.s3_client.put_object(
            Bucket=self.glacier_vault,
            Key=key,
            Body=encrypted_data,
            StorageClass='GLACIER',
            Metadata={
                'violation-id': str(violation.id),
                'user-id': str(violation.user_id),
                'archive-date': timezone.now().isoformat()
            }
        )

        return {
            'storage_location': key,
            'archive_id': response.get('ETag'),
            'storage_class': 'GLACIER'
        }

    def retrieve_archived_data(self, storage_location):
        """Retrieve data from cold storage (may take hours)"""

        # Initiate retrieval job
        response = self.s3_client.restore_object(
            Bucket=self.glacier_vault,
            Key=storage_location,
            RestoreRequest={
                'Days': 7,  # Keep retrieved data available for 7 days
                'GlacierJobParameters': {
                    'Tier': 'Standard'  # 3-5 hours retrieval time
                }
            }
        )

        return {
            'retrieval_id': response.get('RestoreOutputPath'),
            'estimated_completion': timezone.now() + timedelta(hours=5)
        }
```

### Automated Archival Schedule:

```python
# Celery periodic tasks
@periodic_task(run_every=crontab(hour=2, minute=0))  # Daily at 2 AM
def daily_archival_task():
    """Daily archival of eligible records"""
    archiver = ComplianceDataArchiver()

    # Archive violations older than 2 years
    cutoff_date = timezone.now() - timedelta(days=730)
    archived_violations = archiver.archive_violations(cutoff_date)

    # Archive metrics older than 3 years
    cutoff_date = timezone.now() - timedelta(days=1095)
    archived_metrics = archiver.archive_metrics(cutoff_date)

    # Archive audit logs older than 7 years
    cutoff_date = timezone.now() - timedelta(days=2555)
    archived_logs = archiver.archive_audit_logs(cutoff_date)

    logger.info(f"Daily archival completed: {archived_violations} violations, "
                f"{archived_metrics} metrics, {archived_logs} audit logs")

@periodic_task(run_every=crontab(hour=1, minute=0, day_of_week=0))  # Weekly
def weekly_purge_task():
    """Weekly purge of expired archived data"""
    archiver = ComplianceDataArchiver()

    # Purge archived violations older than 10 years
    cutoff_date = timezone.now() - timedelta(days=3650)
    purged_violations = archiver.purge_archived_violations(cutoff_date)

    logger.info(f"Weekly purge completed: {purged_violations} archived records purged")
```

### Alternatives Considered

#### Option 1: Keep All Data in Primary Database
- **Pros**: Simple queries, fast access to all data
- **Cons**: Database growth, performance degradation, high storage costs

#### Option 2: External Data Warehouse
- **Pros**: Specialized for analytics, separate from operational system
- **Cons**: Complex ETL processes, additional infrastructure, sync challenges

#### Option 3: File-Based Archival
- **Pros**: Low cost, simple implementation
- **Cons**: Poor queryability, no relational integrity, manual processes

### Rationale

Tiered retention strategy was chosen because:

1. **Cost Optimization**: Reduces primary database size and storage costs
2. **Performance**: Maintains fast queries on active data
3. **Compliance**: Meets regulatory retention requirements
4. **Accessibility**: Archived data remains queryable when needed
5. **Automation**: Reduces manual intervention and human error

### Data Recovery Procedures:

```python
class ComplianceDataRecovery:
    """Tools for recovering archived compliance data"""

    def search_archived_violations(self, user_id=None, date_range=None, violation_type=None):
        """Search archived violations with limited criteria"""
        query = ArchivedComplianceViolation.objects.using('archive')

        if user_id:
            query = query.filter(user_id=user_id)
        if date_range:
            query = query.filter(created_at__range=date_range)
        if violation_type:
            query = query.filter(violation_type=violation_type)

        return query.order_by('-created_at')

    def restore_violation_to_active(self, archived_violation_id):
        """Restore archived violation to active database for analysis"""
        archived_violation = ArchivedComplianceViolation.objects.using('archive').get(
            id=archived_violation_id
        )

        # Create temporary active record
        temp_violation = ComplianceViolation(
            user_id=archived_violation.user_id,
            violation_type=archived_violation.violation_type,
            severity=archived_violation.severity,
            period_start=archived_violation.period_start,
            period_end=archived_violation.period_end,
            description=archived_violation.description,
            calculated_values=archived_violation.calculated_values,
            evidence_data=archived_violation.evidence_data,
            resolution_status=archived_violation.resolution_status,
            resolution_notes=archived_violation.resolution_notes,
            created_at=archived_violation.created_at,
            is_temporary_restore=True,
            restore_expiry=timezone.now() + timedelta(days=30)
        )

        temp_violation.save()
        return temp_violation
```

### Consequences

**Positive**:
- Significantly reduced primary database size and improved performance
- Cost-effective long-term data retention
- Meets all regulatory compliance requirements
- Automated processes reduce maintenance overhead

**Negative**:
- Complex data architecture with multiple storage tiers
- Archived data queries are slower and more complex
- Cold storage retrieval can take hours
- Risk of data loss during archival processes

---

## ADR-008: Scalability and Performance Optimization

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: performance-optimizer, django-orm-expert

### Context

The compliance system must support hundreds of concurrent users with thousands of daily compliance checks while maintaining sub-200ms response times for dashboard queries and sub-50ms for real-time compliance checks. The system needs to scale horizontally and handle peak loads during shift scheduling periods.

### Decision

We have implemented a **comprehensive performance optimization strategy** with multiple layers:

#### Database Optimization:
```sql
-- High-performance indexes for compliance queries
CREATE INDEX CONCURRENTLY idx_compliance_violation_user_period
    ON compliance_violation(user_id, period_start, period_end)
    WHERE resolution_status = 'open';

CREATE INDEX CONCURRENTLY idx_compliance_violation_severity_created
    ON compliance_violation(severity, created_at DESC)
    WHERE resolution_status IN ('open', 'investigating');

CREATE INDEX CONCURRENTLY idx_working_hours_metrics_performance
    ON working_hours_metrics(user_id, period_type, period_start, created_at);

-- Partial indexes for hot queries
CREATE INDEX CONCURRENTLY idx_active_violations
    ON compliance_violation(user_id, created_at DESC)
    WHERE resolution_status = 'open' AND severity IN ('critical', 'major');

CREATE INDEX CONCURRENTLY idx_recent_metrics
    ON working_hours_metrics(user_id, compliance_score, created_at)
    WHERE created_at > CURRENT_DATE - INTERVAL '90 days';

-- Covering indexes to avoid table lookups
CREATE INDEX CONCURRENTLY idx_violation_dashboard_covering
    ON compliance_violation(severity, resolution_status, created_at DESC)
    INCLUDE (user_id, violation_type, description);
```

#### Query Optimization:
```python
class OptimizedComplianceQueries:
    """High-performance queries for compliance system"""

    def get_user_compliance_summary(self, user_id, days=30):
        """Optimized user compliance summary with minimal DB hits"""
        cutoff_date = timezone.now() - timedelta(days=days)

        # Single query with aggregation
        summary = ComplianceViolation.objects.filter(
            user_id=user_id,
            created_at__gte=cutoff_date
        ).aggregate(
            total_violations=Count('id'),
            critical_count=Count('id', filter=Q(severity='critical')),
            major_count=Count('id', filter=Q(severity='major')),
            minor_count=Count('id', filter=Q(severity='minor')),
            open_violations=Count('id', filter=Q(resolution_status='open')),
            avg_resolution_days=Avg(
                Extract(
                    Cast(F('resolved_at') - F('created_at'), DurationField()),
                    'days'
                ),
                filter=Q(resolution_status='resolved')
            )
        )

        # Get latest metrics in separate optimized query
        latest_metrics = WorkingHoursMetrics.objects.filter(
            user_id=user_id
        ).select_related('user').order_by('-created_at').first()

        return {
            'violations': summary,
            'metrics': latest_metrics,
            'compliance_score': float(latest_metrics.compliance_score) if latest_metrics else 0.0
        }

    def get_dashboard_metrics(self, days=7, user_role='admin', user_id=None):
        """Ultra-fast dashboard metrics with aggressive optimization"""

        # Use raw SQL for complex aggregations
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    COUNT(*) as total_violations,
                    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
                    COUNT(*) FILTER (WHERE severity = 'major') as major_count,
                    COUNT(*) FILTER (WHERE severity = 'minor') as minor_count,
                    COUNT(*) FILTER (WHERE resolution_status = 'open') as open_count,
                    ROUND(AVG(CASE
                        WHEN resolution_status = 'resolved'
                        THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/86400
                    END), 1) as avg_resolution_days,
                    ROUND(
                        COUNT(*) FILTER (WHERE resolution_status = 'resolved')::numeric /
                        NULLIF(COUNT(*), 0) * 100,
                        1
                    ) as resolution_rate
                FROM compliance_violation
                WHERE created_at >= %s
                {user_filter}
            """.format(
                user_filter="AND user_id = %s" if user_role == 'staff' else ""
            ), [
                timezone.now() - timedelta(days=days)
            ] + ([user_id] if user_role == 'staff' else []))

            row = cursor.fetchone()
            columns = [col[0] for col in cursor.description]
            return dict(zip(columns, row))

    def get_real_time_user_context(self, user_id):
        """Ultra-fast user context for real-time compliance checks"""

        # Optimized query with specific indexes
        current_week_start = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(days=timezone.now().weekday())

        context = {}

        # Get current week hours with single query
        weekly_hours = Shift.objects.filter(
            user_id=user_id,
            start_time__gte=current_week_start,
            status__in=['completed', 'in_progress']
        ).aggregate(
            total_hours=Coalesce(Sum('duration_hours'), 0.0),
            shift_count=Count('id'),
            consecutive_days=Count('start_time__date', distinct=True)
        )

        # Get last shift end time
        last_shift = Shift.objects.filter(
            user_id=user_id,
            status='completed'
        ).order_by('-end_time').values('end_time').first()

        # Get recent violations count
        violation_count = ComplianceViolation.objects.filter(
            user_id=user_id,
            created_at__gte=timezone.now() - timedelta(days=30),
            resolution_status='open'
        ).count()

        return {
            'current_week_hours': weekly_hours['total_hours'],
            'shifts_this_week': weekly_hours['shift_count'],
            'consecutive_days_worked': weekly_hours['consecutive_days'],
            'last_shift_end': last_shift['end_time'] if last_shift else None,
            'recent_violations': violation_count,
            'cache_timestamp': timezone.now()
        }
```

#### Connection Pooling and Database Configuration:
```python
# Optimized database settings
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'compliance_db',
        'USER': 'compliance_user',
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': '5432',
        'OPTIONS': {
            'MAX_CONNS': 50,
            'MIN_CONNS': 10,
            'SERVER_SIDE_BINDING': True,
        },
        'CONN_MAX_AGE': 600,  # 10 minutes
        'CONN_HEALTH_CHECKS': True,
    }
}

# PostgreSQL-specific optimizations
DATABASES['default']['OPTIONS'].update({
    'options': '-c statement_timeout=30000'  # 30 second timeout
})

# Connection pooling with pgbouncer
DATABASE_POOL_CONFIG = {
    'pool_size': 20,
    'max_overflow': 30,
    'pool_timeout': 30,
    'pool_recycle': 3600,
    'pool_pre_ping': True
}
```

#### Application-Level Optimization:
```python
class PerformanceOptimizedViewMixin:
    """Mixin for high-performance compliance views"""

    def get_queryset(self):
        """Optimized queryset with select_related and prefetch_related"""
        queryset = super().get_queryset()

        # Optimize based on view type
        if hasattr(self, 'performance_optimization'):
            opts = self.performance_optimization

            if 'select_related' in opts:
                queryset = queryset.select_related(*opts['select_related'])

            if 'prefetch_related' in opts:
                queryset = queryset.prefetch_related(*opts['prefetch_related'])

            if 'only' in opts:
                queryset = queryset.only(*opts['only'])

        return queryset

    def dispatch(self, request, *args, **kwargs):
        """Add performance monitoring to all requests"""
        start_time = time.time()
        response = super().dispatch(request, *args, **kwargs)

        # Track response time
        duration_ms = (time.time() - start_time) * 1000

        # Log slow queries
        if duration_ms > 200:  # 200ms threshold
            logger.warning(f"Slow compliance API request: {request.path} took {duration_ms:.1f}ms")

        # Add performance headers
        response['X-Response-Time'] = f"{duration_ms:.1f}ms"
        response['X-DB-Queries'] = str(len(connection.queries))

        return response

# Optimized violation viewset
class ComplianceViolationViewSet(PerformanceOptimizedViewMixin, viewsets.ModelViewSet):
    performance_optimization = {
        'select_related': ['user', 'shift', 'shift__venue'],
        'prefetch_related': ['user__staff_profile'],
        'only': [
            'id', 'user_id', 'violation_type', 'severity',
            'period_start', 'period_end', 'description',
            'resolution_status', 'created_at'
        ]
    }

    def get_queryset(self):
        """High-performance queryset with role-based filtering"""
        queryset = super().get_queryset()

        # Apply role-based filtering efficiently
        if self.request.user.role == 'staff':
            queryset = queryset.filter(user=self.request.user)
        elif self.request.user.role == 'manager':
            # Use EXISTS subquery for team filtering
            team_subquery = self.request.user.managed_users.values('id')
            queryset = queryset.filter(user_id__in=Subquery(team_subquery))

        return queryset.order_by('-created_at')
```

#### Caching Layer Enhancement:
```python
class HighPerformanceComplianceCache:
    """Advanced caching with warming and intelligent eviction"""

    def __init__(self):
        self.redis = redis.Redis(connection_pool=get_redis_pool())
        self.local_cache = {}
        self.cache_stats = defaultdict(int)

    async def get_with_warming(self, key, compute_func, ttl=300, warm_ahead=0.1):
        """Cache with proactive warming before expiration"""

        # Check local cache first (L1)
        if key in self.local_cache:
            data, expires_at = self.local_cache[key]

            # Warm cache if near expiration
            if time.time() > expires_at - (ttl * warm_ahead):
                asyncio.create_task(self._warm_cache(key, compute_func, ttl))

            if time.time() < expires_at:
                self.cache_stats['l1_hit'] += 1
                return data

        # Check Redis cache (L2)
        cached_data = await self.redis.get(key)
        if cached_data:
            data = json.loads(cached_data)

            # Store in L1 cache
            self.local_cache[key] = (data, time.time() + min(ttl, 60))

            # Check if we need to warm the cache
            ttl_remaining = await self.redis.ttl(key)
            if ttl_remaining < (ttl * warm_ahead):
                asyncio.create_task(self._warm_cache(key, compute_func, ttl))

            self.cache_stats['l2_hit'] += 1
            return data

        # Cache miss - compute and store
        self.cache_stats['miss'] += 1
        data = await compute_func()

        # Store in both caches
        await self.redis.setex(key, ttl, json.dumps(data, cls=DjangoJSONEncoder))
        self.local_cache[key] = (data, time.time() + min(ttl, 60))

        return data

    async def _warm_cache(self, key, compute_func, ttl):
        """Background cache warming"""
        try:
            fresh_data = await compute_func()
            await self.redis.setex(key, ttl, json.dumps(fresh_data, cls=DjangoJSONEncoder))
            self.local_cache[key] = (fresh_data, time.time() + min(ttl, 60))
        except Exception as e:
            logger.error(f"Cache warming failed for {key}: {e}")

    def get_performance_stats(self):
        """Cache performance statistics"""
        total_requests = sum(self.cache_stats.values())
        if total_requests == 0:
            return {'hit_ratio': 0, 'l1_ratio': 0, 'l2_ratio': 0}

        return {
            'hit_ratio': (self.cache_stats['l1_hit'] + self.cache_stats['l2_hit']) / total_requests,
            'l1_ratio': self.cache_stats['l1_hit'] / total_requests,
            'l2_ratio': self.cache_stats['l2_hit'] / total_requests,
            'total_requests': total_requests
        }
```

### Performance Monitoring:
```python
class CompliancePerformanceMonitor:
    """Real-time performance monitoring and alerting"""

    def __init__(self):
        self.metrics_client = statsd.StatsClient()
        self.alert_thresholds = {
            'api_response_time': 200,  # ms
            'compliance_check_time': 50,  # ms
            'database_query_time': 100,  # ms
            'cache_hit_ratio': 0.85  # 85%
        }

    def track_api_performance(self, view_name, response_time_ms, db_queries):
        """Track API endpoint performance"""
        self.metrics_client.histogram(f'compliance.api.{view_name}.response_time', response_time_ms)
        self.metrics_client.histogram(f'compliance.api.{view_name}.db_queries', db_queries)

        # Alert on slow responses
        if response_time_ms > self.alert_thresholds['api_response_time']:
            self.send_performance_alert(
                f"Slow API response: {view_name} took {response_time_ms}ms"
            )

    def track_compliance_check_performance(self, check_time_ms, cache_hit):
        """Track real-time compliance check performance"""
        self.metrics_client.histogram('compliance.check.response_time', check_time_ms)
        self.metrics_client.increment(f'compliance.check.cache.{"hit" if cache_hit else "miss"}')

        if check_time_ms > self.alert_thresholds['compliance_check_time']:
            self.send_performance_alert(
                f"Slow compliance check: {check_time_ms}ms (target: {self.alert_thresholds['compliance_check_time']}ms)"
            )

    def generate_performance_report(self):
        """Generate comprehensive performance report"""
        return {
            'api_performance': self._get_api_metrics(),
            'database_performance': self._get_db_metrics(),
            'cache_performance': self._get_cache_metrics(),
            'compliance_check_performance': self._get_compliance_check_metrics(),
            'recommendations': self._generate_optimization_recommendations()
        }
```

### Alternatives Considered

#### Option 1: Microservices Architecture
- **Pros**: Independent scaling, technology diversity
- **Cons**: Complexity overhead, distributed system challenges, data consistency

#### Option 2: Database Sharding
- **Pros**: Horizontal database scaling
- **Cons**: Complex implementation, cross-shard queries, maintenance overhead

#### Option 3: Read Replicas Only
- **Pros**: Simple implementation, read scaling
- **Cons**: Limited write scaling, replication lag, eventual consistency

### Rationale

Comprehensive optimization approach was chosen because:

1. **Measurable Results**: Achieves target performance benchmarks
2. **Cost Effective**: Optimizes existing infrastructure before scaling
3. **Maintainable**: Keeps system complexity manageable
4. **Monitoring**: Provides visibility into performance bottlenecks
5. **Future-Proof**: Foundation for horizontal scaling when needed

### Consequences

**Positive**:
- Consistent sub-200ms dashboard response times
- Sub-50ms real-time compliance checks
- 85%+ cache hit ratio reducing database load
- Clear performance monitoring and alerting

**Negative**:
- Increased code complexity with optimization layers
- More cache invalidation complexity
- Higher memory usage from multi-level caching
- Potential for over-optimization in some areas

---

## ADR-009: Error Handling and Logging Strategy

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: django-api-developer, compliance-officer

### Context

The compliance system handles sensitive employment data and must maintain detailed audit logs for regulatory compliance. Error handling must be robust to prevent data loss while providing clear feedback to users and administrators. All system actions must be traceable for legal and operational purposes.

### Decision

We have implemented a **comprehensive error handling and structured logging strategy**:

#### Error Handling Architecture:
```python
class ComplianceErrorHandler:
    """Centralized error handling for compliance operations"""

    def __init__(self):
        self.logger = ComplianceLogger()
        self.error_tracker = ErrorTracker()
        self.notification_service = NotificationService()

    def handle_violation_error(self, error, context):
        """Handle errors in violation detection/processing"""
        error_id = self._generate_error_id()

        # Classify error severity
        severity = self._classify_error_severity(error)

        # Log structured error details
        self.logger.log_compliance_error(
            error_id=error_id,
            error_type=type(error).__name__,
            error_message=str(error),
            severity=severity,
            context=context,
            stack_trace=traceback.format_exc(),
            user_id=context.get('user_id'),
            shift_id=context.get('shift_id'),
            timestamp=timezone.now()
        )

        # Track for monitoring
        self.error_tracker.increment_error_count(
            error_type=type(error).__name__,
            severity=severity,
            component='violation_processing'
        )

        # Handle based on severity
        if severity == 'critical':
            self._handle_critical_error(error, error_id, context)
        elif severity == 'high':
            self._handle_high_priority_error(error, error_id, context)
        else:
            self._handle_standard_error(error, error_id, context)

        return error_id

    def _classify_error_severity(self, error):
        """Classify error severity based on type and impact"""

        # Critical errors - system integrity or compliance violations
        critical_errors = [
            'DatabaseIntegrityError',
            'ComplianceViolationMissed',
            'DataCorruptionError',
            'SecurityViolationError'
        ]

        # High priority errors - feature functionality impacted
        high_priority_errors = [
            'ValidationError',
            'PermissionDenied',
            'ComplianceCheckFailure',
            'NotificationDeliveryError'
        ]

        error_name = type(error).__name__

        if error_name in critical_errors:
            return 'critical'
        elif error_name in high_priority_errors:
            return 'high'
        elif isinstance(error, (TimeoutError, ConnectionError)):
            return 'medium'
        else:
            return 'low'

    def _handle_critical_error(self, error, error_id, context):
        """Handle critical errors with immediate escalation"""

        # Immediate notification to administrators
        self.notification_service.send_critical_alert(
            error_id=error_id,
            error_message=str(error),
            context=context,
            escalation_level='immediate'
        )

        # Create incident ticket
        self._create_incident_ticket(error, error_id, 'critical')

        # Trigger failsafe procedures if needed
        if isinstance(error, ComplianceViolationMissed):
            self._trigger_manual_compliance_review(context.get('user_id'))
```

#### Structured Logging Implementation:
```python
class ComplianceLogger:
    """Structured logging for compliance system"""

    def __init__(self):
        self.logger = structlog.get_logger('compliance')
        self.audit_logger = structlog.get_logger('compliance.audit')
        self.security_logger = structlog.get_logger('compliance.security')

    def log_compliance_event(self, event_type, user_id, details, **kwargs):
        """Log compliance-related events with full context"""

        log_entry = {
            'event_type': event_type,
            'user_id': user_id,
            'details': details,
            'timestamp': timezone.now().isoformat(),
            'request_id': self._get_request_id(),
            'session_id': self._get_session_id(),
            **kwargs
        }

        # Add user context if available
        if hasattr(self, 'current_user'):
            log_entry.update({
                'actor_user_id': self.current_user.id,
                'actor_role': self.current_user.role,
                'actor_ip': self._get_client_ip()
            })

        self.logger.info('compliance_event', **log_entry)

        # Also write to audit log for regulatory compliance
        if event_type in self.AUDIT_REQUIRED_EVENTS:
            self.audit_logger.info('audit_event', **log_entry)

    def log_violation_detected(self, violation, detection_context):
        """Specific logging for violation detection"""

        self.log_compliance_event(
            event_type='violation_detected',
            user_id=violation.user_id,
            details={
                'violation_id': violation.id,
                'violation_type': violation.violation_type,
                'severity': violation.severity,
                'description': violation.description,
                'calculated_values': violation.calculated_values,
                'detection_trigger': detection_context.get('trigger'),
                'shift_id': violation.shift_id if violation.shift else None
            },
            compliance_impact=violation.compliance_score_impact,
            system_generated=violation.system_generated
        )

    def log_violation_resolved(self, violation, resolver_user, resolution_notes):
        """Log violation resolution with full audit trail"""

        self.log_compliance_event(
            event_type='violation_resolved',
            user_id=violation.user_id,
            details={
                'violation_id': violation.id,
                'violation_type': violation.violation_type,
                'severity': violation.severity,
                'resolution_notes': resolution_notes,
                'exception_granted': violation.exception_granted,
                'exception_reason': violation.exception_reason
            },
            resolver_user_id=resolver_user.id,
            resolver_role=resolver_user.role,
            resolution_time_hours=self._calculate_resolution_time(violation)
        )

    def log_data_access(self, user, accessed_model, instance_id, action):
        """Log data access for audit compliance"""

        self.audit_logger.info(
            'data_access',
            accessor_user_id=user.id,
            accessor_role=user.role,
            accessed_model=accessed_model.__name__,
            instance_id=instance_id,
            action=action,
            ip_address=self._get_client_ip(),
            user_agent=self._get_user_agent(),
            timestamp=timezone.now().isoformat()
        )

    def log_security_event(self, event_type, user_id, details, risk_level='medium'):
        """Log security-related events"""

        self.security_logger.warning(
            'security_event',
            event_type=event_type,
            user_id=user_id,
            details=details,
            risk_level=risk_level,
            ip_address=self._get_client_ip(),
            timestamp=timezone.now().isoformat()
        )

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
```

#### API Error Response Standardization:
```python
class ComplianceAPIErrorHandler:
    """Standardized error responses for compliance APIs"""

    def handle_validation_error(self, validation_error):
        """Handle form/serializer validation errors"""

        error_response = {
            'status': 'error',
            'error_type': 'validation_error',
            'message': 'Validation failed',
            'errors': {},
            'error_id': self._generate_error_id()
        }

        if hasattr(validation_error, 'error_dict'):
            # Django form errors
            for field, errors in validation_error.error_dict.items():
                error_response['errors'][field] = [str(error) for error in errors]
        elif hasattr(validation_error, 'detail'):
            # DRF serializer errors
            error_response['errors'] = validation_error.detail

        return Response(error_response, status=400)

    def handle_permission_error(self, permission_error, user, requested_action):
        """Handle permission denied errors with audit logging"""

        # Log security event
        ComplianceLogger().log_security_event(
            event_type='permission_denied',
            user_id=user.id if user.is_authenticated else None,
            details={
                'requested_action': requested_action,
                'user_role': user.role if user.is_authenticated else 'anonymous',
                'error_message': str(permission_error)
            },
            risk_level='medium'
        )

        return Response({
            'status': 'error',
            'error_type': 'permission_denied',
            'message': 'You do not have permission to perform this action',
            'error_id': self._generate_error_id()
        }, status=403)

    def handle_compliance_check_error(self, check_error, check_context):
        """Handle real-time compliance check failures"""

        error_id = ComplianceErrorHandler().handle_violation_error(check_error, check_context)

        return Response({
            'status': 'error',
            'error_type': 'compliance_check_failed',
            'message': 'Unable to perform compliance check at this time',
            'error_id': error_id,
            'fallback_message': 'Please contact your manager for manual approval',
            'retry_after': 30  # seconds
        }, status=503)

# Global exception handler
@api_view(['GET', 'POST'])
def compliance_exception_handler(request, exception):
    """Global exception handler for compliance APIs"""

    handler = ComplianceAPIErrorHandler()

    if isinstance(exception, ValidationError):
        return handler.handle_validation_error(exception)
    elif isinstance(exception, PermissionDenied):
        return handler.handle_permission_error(exception, request.user, request.path)
    elif isinstance(exception, ComplianceCheckError):
        return handler.handle_compliance_check_error(exception, {'user_id': request.user.id})
    else:
        # Generic error handling with logging
        error_id = ComplianceErrorHandler().handle_violation_error(exception, {
            'user_id': request.user.id if request.user.is_authenticated else None,
            'request_path': request.path,
            'request_method': request.method
        })

        return Response({
            'status': 'error',
            'error_type': 'internal_error',
            'message': 'An unexpected error occurred',
            'error_id': error_id
        }, status=500)
```

#### Audit Trail Implementation:
```python
class ComplianceAuditTrail:
    """Complete audit trail for regulatory compliance"""

    def __init__(self):
        self.logger = ComplianceLogger()

    def track_violation_lifecycle(self, violation):
        """Track complete violation lifecycle for audit purposes"""

        # Initial detection
        self.logger.log_compliance_event(
            event_type='violation_lifecycle_start',
            user_id=violation.user_id,
            details={
                'violation_id': violation.id,
                'detection_method': 'automatic' if violation.system_generated else 'manual',
                'detection_timestamp': violation.created_at.isoformat(),
                'initial_severity': violation.severity,
                'regulatory_context': self._get_regulatory_context(violation)
            }
        )

    def track_compliance_setting_changes(self, old_profile, new_profile, changed_by):
        """Track changes to compliance settings"""

        changes = self._compare_compliance_profiles(old_profile, new_profile)

        self.logger.log_compliance_event(
            event_type='compliance_settings_changed',
            user_id=changed_by.id,
            details={
                'profile_id': new_profile.id,
                'profile_name': new_profile.name,
                'changes': changes,
                'effective_date': new_profile.updated_at.isoformat(),
                'business_justification': getattr(new_profile, 'change_reason', 'Not specified')
            },
            change_impact=self._assess_change_impact(changes),
            requires_staff_notification=self._requires_notification(changes)
        )

    def track_bulk_operations(self, operation_type, affected_items, performed_by):
        """Track bulk operations for audit compliance"""

        self.logger.log_compliance_event(
            event_type='bulk_operation_performed',
            user_id=performed_by.id,
            details={
                'operation_type': operation_type,
                'affected_count': len(affected_items),
                'affected_items': affected_items[:100],  # Limit to prevent log overflow
                'execution_time': timezone.now().isoformat()
            },
            operation_risk_level=self._assess_operation_risk(operation_type, len(affected_items))
        )

# Signal handlers for automatic audit tracking
@receiver(post_save, sender=ComplianceViolation)
def track_violation_changes(sender, instance, created, **kwargs):
    audit_trail = ComplianceAuditTrail()

    if created:
        audit_trail.track_violation_lifecycle(instance)
    else:
        # Track status changes
        if instance.tracker.has_changed('resolution_status'):
            audit_trail.logger.log_compliance_event(
                event_type='violation_status_changed',
                user_id=instance.user_id,
                details={
                    'violation_id': instance.id,
                    'old_status': instance.tracker.previous('resolution_status'),
                    'new_status': instance.resolution_status,
                    'change_timestamp': timezone.now().isoformat()
                }
            )

@receiver(post_save, sender=ComplianceProfile)
def track_profile_changes(sender, instance, created, **kwargs):
    if not created and hasattr(instance, '_old_values'):
        audit_trail = ComplianceAuditTrail()
        # Assuming we store old values before save
        old_profile = instance._old_values
        audit_trail.track_compliance_setting_changes(old_profile, instance, instance.updated_by)
```

### Log Aggregation and Monitoring:
```python
class ComplianceLogAggregator:
    """Aggregate and analyze compliance logs for insights"""

    def __init__(self):
        self.elasticsearch = Elasticsearch(['localhost:9200'])

    def aggregate_error_trends(self, time_period='7d'):
        """Aggregate error trends for monitoring"""

        query = {
            'size': 0,
            'query': {
                'bool': {
                    'must': [
                        {'term': {'logger_name': 'compliance'}},
                        {'range': {'timestamp': {'gte': f'now-{time_period}'}}}
                    ]
                }
            },
            'aggs': {
                'error_types': {
                    'terms': {'field': 'error_type.keyword'},
                    'aggs': {
                        'severity_breakdown': {
                            'terms': {'field': 'severity.keyword'}
                        },
                        'hourly_trend': {
                            'date_histogram': {
                                'field': 'timestamp',
                                'interval': 'hour'
                            }
                        }
                    }
                }
            }
        }

        result = self.elasticsearch.search(index='compliance-logs-*', body=query)
        return self._process_error_aggregation(result)

    def generate_compliance_report(self, user_id, report_period='30d'):
        """Generate comprehensive compliance audit report"""

        report_data = {
            'user_id': user_id,
            'period': report_period,
            'generated_at': timezone.now().isoformat(),
            'sections': {}
        }

        # Violation summary
        report_data['sections']['violations'] = self._get_violation_summary(user_id, report_period)

        # Data access audit
        report_data['sections']['data_access'] = self._get_access_audit(user_id, report_period)

        # Setting changes impact
        report_data['sections']['settings_impact'] = self._get_settings_impact(user_id, report_period)

        return report_data
```

### Alternatives Considered

#### Option 1: Simple Logging to Files
- **Pros**: Simple implementation, no external dependencies
- **Cons**: Limited searchability, no structured data, scaling issues

#### Option 2: Third-party Error Tracking (Sentry)
- **Pros**: Advanced error tracking, user-friendly interface
- **Cons**: External dependency, potential data privacy concerns, cost

#### Option 3: Minimal Error Handling
- **Pros**: Reduced complexity, faster development
- **Cons**: Poor debugging capability, regulatory compliance issues

### Rationale

Comprehensive error handling and logging was chosen because:

1. **Regulatory Compliance**: Complete audit trails required by law
2. **Operational Excellence**: Detailed error tracking improves system reliability
3. **Security**: Security event logging for threat detection
4. **Debugging**: Structured logs enable faster issue resolution
5. **Analytics**: Error trends help identify system improvements

### Consequences

**Positive**:
- Complete regulatory compliance audit trails
- Fast error diagnosis and resolution
- Proactive monitoring of system health
- Security event tracking and analysis
- Historical compliance reporting capability

**Negative**:
- Increased storage requirements for logs
- Additional processing overhead for logging
- Complex log aggregation and analysis infrastructure
- Potential performance impact during high-error scenarios

---

## ADR-010: Integration with External Systems

**Status**: Accepted
**Date**: 2025-01-16
**Decision Makers**: integration-architect, django-api-developer

### Context

The compliance system must integrate with existing workforce management systems (Deputy), notification services (email, SMS), and potentially future systems (HR systems, payroll providers). Integration must be reliable, secure, and maintainable while handling service outages gracefully.

### Decision

We have implemented a **plugin-based integration architecture** with standardized interfaces:

#### Integration Architecture:
```python
class BaseExternalIntegration:
    """Base class for all external system integrations"""

    def __init__(self, config):
        self.config = config
        self.logger = ComplianceLogger()
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60,
            expected_exception=IntegrationError
        )

    @abstractmethod
    async def test_connection(self):
        """Test connection to external system"""
        pass

    @abstractmethod
    async def send_compliance_notification(self, notification_data):
        """Send compliance-related notification"""
        pass

    @abstractmethod
    async def sync_user_data(self, user_id):
        """Synchronize user data with external system"""
        pass

    def with_retry(self, max_attempts=3, backoff_factor=2):
        """Decorator for retry logic"""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                for attempt in range(max_attempts):
                    try:
                        return await func(*args, **kwargs)
                    except IntegrationError as e:
                        if attempt == max_attempts - 1:
                            raise
                        wait_time = backoff_factor ** attempt
                        await asyncio.sleep(wait_time)
            return wrapper
        return decorator

class DeputyIntegration(BaseExternalIntegration):
    """Integration with Deputy workforce management system"""

    def __init__(self, config):
        super().__init__(config)
        self.api_client = DeputyAPIClient(
            base_url=config.get('base_url'),
            api_key=config.get('api_key'),
            timeout=config.get('timeout', 30)
        )

    async def test_connection(self):
        """Test Deputy API connection"""
        try:
            response = await self.api_client.get('/me')
            return response.status_code == 200
        except Exception as e:
            self.logger.log_integration_error('deputy', 'connection_test_failed', str(e))
            return False

    @circuit_breaker
    @with_retry(max_attempts=3)
    async def send_compliance_notification(self, notification_data):
        """Send compliance notification through Deputy"""

        deputy_notification = {
            'user_id': notification_data['user_id'],
            'message': notification_data['message'],
            'type': 'compliance_alert',
            'priority': self._map_severity_to_priority(notification_data['severity']),
            'metadata': {
                'violation_id': notification_data.get('violation_id'),
                'compliance_score_impact': notification_data.get('score_impact')
            }
        }

        try:
            response = await self.api_client.post('/notifications', deputy_notification)

            self.logger.log_integration_event(
                integration='deputy',
                event_type='notification_sent',
                details={
                    'user_id': notification_data['user_id'],
                    'notification_type': deputy_notification['type'],
                    'deputy_response_status': response.status_code
                }
            )

            return response.status_code in [200, 201]

        except IntegrationError as e:
            self.logger.log_integration_error(
                'deputy',
                'notification_send_failed',
                str(e),
                context=notification_data
            )
            raise

    async def sync_user_compliance_data(self, user_id):
        """Sync compliance data with Deputy user profile"""

        try:
            # Get compliance summary
            compliance_summary = await self._get_user_compliance_summary(user_id)

            # Format for Deputy API
            deputy_update = {
                'custom_fields': {
                    'compliance_score': compliance_summary['compliance_score'],
                    'open_violations': compliance_summary['open_violations'],
                    'last_violation_date': compliance_summary['last_violation_date'],
                    'compliance_status': compliance_summary['status']
                },
                'updated_at': timezone.now().isoformat()
            }

            response = await self.api_client.put(f'/users/{user_id}/compliance', deputy_update)

            self.logger.log_integration_event(
                integration='deputy',
                event_type='user_data_synced',
                details={
                    'user_id': user_id,
                    'sync_status': 'success' if response.status_code == 200 else 'failed',
                    'deputy_response': response.status_code
                }
            )

            return response.status_code == 200

        except Exception as e:
            self.logger.log_integration_error(
                'deputy',
                'user_sync_failed',
                str(e),
                context={'user_id': user_id}
            )
            return False

class NotificationIntegration(BaseExternalIntegration):
    """Integration with notification services (email, SMS)"""

    def __init__(self, config):
        super().__init__(config)
        self.email_service = EmailService(config.get('email'))
        self.sms_service = SMSService(config.get('sms'))

    async def send_compliance_notification(self, notification_data):
        """Send multi-channel compliance notification"""

        user_preferences = await self._get_user_notification_preferences(
            notification_data['user_id']
        )

        results = {}

        # Email notification
        if 'email' in user_preferences.get('channels', []):
            try:
                email_sent = await self._send_email_notification(notification_data)
                results['email'] = email_sent
            except Exception as e:
                results['email'] = False
                self.logger.log_integration_error(
                    'email',
                    'notification_send_failed',
                    str(e),
                    context=notification_data
                )

        # SMS notification for critical violations
        if (notification_data.get('severity') == 'critical' and
            'sms' in user_preferences.get('channels', [])):
            try:
                sms_sent = await self._send_sms_notification(notification_data)
                results['sms'] = sms_sent
            except Exception as e:
                results['sms'] = False
                self.logger.log_integration_error(
                    'sms',
                    'notification_send_failed',
                    str(e),
                    context=notification_data
                )

        # Log notification results
        self.logger.log_integration_event(
            integration='notification',
            event_type='multi_channel_notification_sent',
            details={
                'user_id': notification_data['user_id'],
                'channels_attempted': list(results.keys()),
                'channels_successful': [k for k, v in results.items() if v],
                'notification_type': notification_data.get('type')
            }
        )

        return any(results.values())  # Success if any channel succeeded

    async def _send_email_notification(self, notification_data):
        """Send email notification with compliance template"""

        template_name = self._get_email_template(notification_data['type'])

        email_data = {
            'to': notification_data['user_email'],
            'subject': self._generate_email_subject(notification_data),
            'template': template_name,
            'context': {
                'user_name': notification_data['user_name'],
                'violation_details': notification_data.get('violation_details'),
                'compliance_score': notification_data.get('compliance_score'),
                'action_required': notification_data.get('action_required'),
                'due_date': notification_data.get('due_date'),
                'support_contact': self.config.get('support_contact')
            }
        }

        return await self.email_service.send_templated_email(email_data)
```

#### Integration Registry and Configuration:
```python
class IntegrationRegistry:
    """Central registry for managing external integrations"""

    def __init__(self):
        self.integrations = {}
        self.config = ComplianceIntegrationConfig()

    def register_integration(self, name, integration_class, config):
        """Register a new integration"""
        self.integrations[name] = {
            'class': integration_class,
            'config': config,
            'instance': None,
            'status': 'inactive'
        }

    async def initialize_integrations(self):
        """Initialize all registered integrations"""
        for name, integration_info in self.integrations.items():
            try:
                instance = integration_info['class'](integration_info['config'])

                # Test connection
                if await instance.test_connection():
                    integration_info['instance'] = instance
                    integration_info['status'] = 'active'
                    logger.info(f"Integration {name} initialized successfully")
                else:
                    integration_info['status'] = 'connection_failed'
                    logger.error(f"Integration {name} connection test failed")

            except Exception as e:
                integration_info['status'] = 'initialization_failed'
                logger.error(f"Integration {name} initialization failed: {e}")

    def get_integration(self, name):
        """Get active integration instance"""
        integration = self.integrations.get(name)
        if integration and integration['status'] == 'active':
            return integration['instance']
        return None

    async def send_notification_via_all(self, notification_data):
        """Send notification through all available channels"""
        results = {}

        for name, integration_info in self.integrations.items():
            if (integration_info['status'] == 'active' and
                hasattr(integration_info['instance'], 'send_compliance_notification')):

                try:
                    result = await integration_info['instance'].send_compliance_notification(
                        notification_data
                    )
                    results[name] = result
                except Exception as e:
                    results[name] = False
                    logger.error(f"Notification failed for {name}: {e}")

        return results

# Global integration registry instance
integration_registry = IntegrationRegistry()

# Register integrations
integration_registry.register_integration(
    'deputy',
    DeputyIntegration,
    {
        'base_url': settings.DEPUTY_API_URL,
        'api_key': settings.DEPUTY_API_KEY,
        'timeout': 30
    }
)

integration_registry.register_integration(
    'notifications',
    NotificationIntegration,
    {
        'email': {
            'service': 'sendgrid',
            'api_key': settings.SENDGRID_API_KEY
        },
        'sms': {
            'service': 'twilio',
            'account_sid': settings.TWILIO_SID,
            'auth_token': settings.TWILIO_TOKEN
        }
    }
)
```

#### Webhook Integration for Real-time Updates:
```python
class IntegrationWebhookHandler:
    """Handle incoming webhooks from external systems"""

    def __init__(self):
        self.logger = ComplianceLogger()
        self.processors = {
            'deputy.shift_updated': self._process_deputy_shift_update,
            'deputy.user_updated': self._process_deputy_user_update,
            'notification.delivery_status': self._process_notification_status
        }

    async def process_webhook(self, source, event_type, payload, headers):
        """Process incoming webhook with validation and routing"""

        # Verify webhook authenticity
        if not await self._verify_webhook_signature(source, payload, headers):
            self.logger.log_security_event(
                event_type='webhook_signature_invalid',
                user_id=None,
                details={
                    'source': source,
                    'event_type': event_type,
                    'ip_address': headers.get('x-forwarded-for')
                },
                risk_level='high'
            )
            return {'status': 'error', 'message': 'Invalid signature'}

        # Route to appropriate processor
        processor_key = f"{source}.{event_type}"
        processor = self.processors.get(processor_key)

        if not processor:
            self.logger.log_integration_event(
                integration=source,
                event_type='webhook_processor_not_found',
                details={
                    'event_type': event_type,
                    'available_processors': list(self.processors.keys())
                }
            )
            return {'status': 'error', 'message': f'No processor for {processor_key}'}

        try:
            result = await processor(payload)

            self.logger.log_integration_event(
                integration=source,
                event_type='webhook_processed',
                details={
                    'webhook_event_type': event_type,
                    'processing_result': result,
                    'payload_size': len(str(payload))
                }
            )

            return {'status': 'success', 'result': result}

        except Exception as e:
            self.logger.log_integration_error(
                source,
                'webhook_processing_failed',
                str(e),
                context={'event_type': event_type, 'payload': payload}
            )
            return {'status': 'error', 'message': 'Processing failed'}

    async def _process_deputy_shift_update(self, payload):
        """Process shift update webhook from Deputy"""

        shift_id = payload.get('shift_id')
        deputy_shift_data = payload.get('shift_data')

        # Find corresponding local shift
        try:
            shift = Shift.objects.get(deputy_shift_id=shift_id)

            # Update local shift data
            shift.start_time = parse_datetime(deputy_shift_data['start_time'])
            shift.end_time = parse_datetime(deputy_shift_data['end_time'])
            shift.status = deputy_shift_data['status']
            shift.save()

            # Trigger compliance check if shift completed
            if shift.status == 'completed':
                from .tasks import detect_violations_task
                detect_violations_task.delay(shift.id, 'deputy_webhook_update')

            return {'shift_updated': shift.id, 'compliance_check_triggered': shift.status == 'completed'}

        except Shift.DoesNotExist:
            return {'error': f'Shift not found: {shift_id}'}

# Webhook endpoint views
@csrf_exempt
@require_http_methods(['POST'])
async def webhook_endpoint(request, source):
    """Generic webhook endpoint for external integrations"""

    try:
        payload = json.loads(request.body)
        headers = dict(request.headers)
        event_type = headers.get('x-event-type', payload.get('event_type', 'unknown'))

        handler = IntegrationWebhookHandler()
        result = await handler.process_webhook(source, event_type, payload, headers)

        return JsonResponse(result, status=200 if result['status'] == 'success' else 400)

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        return JsonResponse({'status': 'error', 'message': 'Processing failed'}, status=500)
```

#### Integration Monitoring and Health Checks:
```python
class IntegrationHealthMonitor:
    """Monitor health and performance of external integrations"""

    def __init__(self):
        self.health_checks = {}
        self.performance_metrics = defaultdict(list)

    async def check_all_integrations(self):
        """Check health of all active integrations"""
        health_report = {
            'timestamp': timezone.now().isoformat(),
            'overall_status': 'healthy',
            'integrations': {}
        }

        for name, integration_info in integration_registry.integrations.items():
            if integration_info['status'] == 'active':
                health_status = await self._check_integration_health(
                    name,
                    integration_info['instance']
                )
                health_report['integrations'][name] = health_status

                if health_status['status'] != 'healthy':
                    health_report['overall_status'] = 'degraded'

        # Store health report
        self.health_checks[timezone.now()] = health_report

        # Alert on critical issues
        if health_report['overall_status'] == 'degraded':
            await self._send_health_alert(health_report)

        return health_report

    async def _check_integration_health(self, name, integration):
        """Check health of specific integration"""
        start_time = time.time()

        try:
            # Test basic connectivity
            connection_ok = await integration.test_connection()
            response_time = (time.time() - start_time) * 1000  # ms

            self.performance_metrics[name].append({
                'timestamp': timezone.now(),
                'response_time': response_time,
                'success': connection_ok
            })

            # Keep only last 100 measurements
            if len(self.performance_metrics[name]) > 100:
                self.performance_metrics[name] = self.performance_metrics[name][-100:]

            # Calculate health metrics
            recent_metrics = self.performance_metrics[name][-10:]  # Last 10 checks
            success_rate = sum(1 for m in recent_metrics if m['success']) / len(recent_metrics)
            avg_response_time = sum(m['response_time'] for m in recent_metrics) / len(recent_metrics)

            # Determine health status
            if not connection_ok:
                status = 'unhealthy'
            elif success_rate < 0.8:  # Less than 80% success rate
                status = 'degraded'
            elif avg_response_time > 5000:  # Over 5 second response time
                status = 'slow'
            else:
                status = 'healthy'

            return {
                'status': status,
                'response_time_ms': response_time,
                'success_rate': success_rate,
                'avg_response_time_ms': avg_response_time,
                'last_check': timezone.now().isoformat()
            }

        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                'last_check': timezone.now().isoformat()
            }

# Periodic health check task
@periodic_task(run_every=crontab(minute='*/5'))  # Every 5 minutes
async def integration_health_check():
    """Periodic health check for all integrations"""
    monitor = IntegrationHealthMonitor()
    health_report = await monitor.check_all_integrations()

    # Log health status
    logger.info(f"Integration health check completed: {health_report['overall_status']}")

    # Store metrics for trending
    IntegrationHealthMetric.objects.create(
        timestamp=timezone.now(),
        overall_status=health_report['overall_status'],
        details=health_report['integrations']
    )
```

### Alternatives Considered

#### Option 1: Direct API Calls Throughout Application
- **Pros**: Simple implementation, direct control
- **Cons**: Tight coupling, difficult error handling, no consistency

#### Option 2: Message Queue Integration (RabbitMQ/Kafka)
- **Pros**: Decoupled, reliable delivery, scalable
- **Cons**: Additional infrastructure, complexity, eventual consistency

#### Option 3: Third-party Integration Platform (Zapier/Integromat)
- **Pros**: Visual configuration, many pre-built connectors
- **Cons**: External dependency, cost, limited customization

### Rationale

Plugin-based integration architecture was chosen because:

1. **Consistency**: Standardized interface for all integrations
2. **Reliability**: Circuit breakers and retry logic prevent cascading failures
3. **Maintainability**: Centralized configuration and monitoring
4. **Extensibility**: Easy to add new integrations
5. **Observability**: Comprehensive logging and monitoring of integration health

### Consequences

**Positive**:
- Consistent and reliable integration with external systems
- Graceful handling of service outages and failures
- Comprehensive monitoring and health checking
- Easy addition of new integrations in the future
- Clear audit trail of all external system interactions

**Negative**:
- Increased architectural complexity
- Additional infrastructure for monitoring and health checks
- Potential single point of failure in integration registry
- More complex testing scenarios with multiple external dependencies

---

## Summary

These Architectural Decision Records document the key design decisions for the Legal Compliance Reporting System. Each decision was made considering multiple alternatives and focuses on achieving the system's goals of regulatory compliance, performance, scalability, and maintainability.

The decisions work together to create a comprehensive system that:

- **Ensures Compliance**: Complete audit trails and regulatory adherence
- **Performs at Scale**: Sub-50ms compliance checks and sub-200ms dashboard responses
- **Maintains Data Integrity**: Robust error handling and data validation
- **Integrates Seamlessly**: Standardized external system integration patterns
- **Supports Growth**: Scalable architecture for future requirements

These ADRs should be reviewed and updated as the system evolves and new requirements emerge.

---

**Document Version**: 1.0
**Last Updated**: 2025-01-16
**Next Review**: 2025-07-16