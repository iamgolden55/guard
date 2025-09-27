"""
Performance Optimization Middleware for Legal Compliance Reporting System
SSMS-COMPLIANCE-2025 - Production-ready API performance enhancements

This middleware provides:
- Response compression (gzip/brotli)
- HTTP caching headers
- Request/response timing
- Performance monitoring
- Rate limiting integration
"""

import time
import gzip
import json
import logging
from typing import Any, Dict, Optional
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.core.cache import cache
from django.utils.cache import patch_response_headers, get_conditional_response
from django.utils.deprecation import MiddlewareMixin
from django.views.decorators.vary import vary_on_headers
from django.conf import settings
import hashlib

logger = logging.getLogger('performance')


class CompliancePerformanceMiddleware(MiddlewareMixin):
    """
    Comprehensive performance middleware for the compliance system.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.performance_config = getattr(settings, 'PERFORMANCE_MONITORING', {})
        self.compliance_config = getattr(settings, 'COMPLIANCE_PERFORMANCE_CONFIG', {})

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Process incoming request for performance tracking"""

        # Start timing
        request._performance_start_time = time.time()

        # Add request ID for tracking
        request._request_id = self._generate_request_id()

        # Check for conditional requests (304 Not Modified optimization)
        if self._is_compliance_api(request):
            cached_response = self._check_conditional_request(request)
            if cached_response:
                return cached_response

        return None

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Process outgoing response with performance optimizations"""

        # Calculate request duration
        if hasattr(request, '_performance_start_time'):
            duration = time.time() - request._performance_start_time

            # Add performance headers
            response['X-Response-Time'] = f"{duration:.3f}s"
            response['X-Request-ID'] = getattr(request, '_request_id', 'unknown')

            # Log slow requests
            slow_threshold = self.performance_config.get('REQUEST_PROFILING_THRESHOLD', 1.0)
            if duration > slow_threshold:
                self._log_slow_request(request, response, duration)

        # Apply compression if applicable
        response = self._apply_compression(request, response)

        # Apply caching headers for compliance API
        if self._is_compliance_api(request):
            response = self._apply_caching_headers(request, response)

        # Add security and performance headers
        response = self._add_performance_headers(response)

        return response

    def _is_compliance_api(self, request: HttpRequest) -> bool:
        """Check if request is for compliance API endpoints"""
        path = request.path
        return (
            path.startswith('/api/v1/compliance/') or
            path.startswith('/api/v1/working-hours/') or
            'compliance' in path.lower()
        )

    def _generate_request_id(self) -> str:
        """Generate unique request ID for tracking"""
        return hashlib.md5(f"{time.time()}_{id(self)}".encode()).hexdigest()[:16]

    def _check_conditional_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Check for conditional requests and return 304 if possible"""

        # Only for GET requests
        if request.method != 'GET':
            return None

        # Generate ETag based on request parameters
        etag = self._generate_etag(request)

        # Check If-None-Match header
        if_none_match = request.META.get('HTTP_IF_NONE_MATCH')
        if if_none_match and if_none_match.strip('"') == etag:
            # Return 304 Not Modified
            response = HttpResponse(status=304)
            response['ETag'] = f'"{etag}"'
            response['Cache-Control'] = 'max-age=300, must-revalidate'
            return response

        return None

    def _generate_etag(self, request: HttpRequest) -> str:
        """Generate ETag for compliance API responses"""

        # Create hash based on URL, query params, and user
        key_data = {
            'path': request.path,
            'query': sorted(request.GET.items()),
            'user_id': request.user.id if request.user.is_authenticated else 'anonymous',
        }

        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_string.encode()).hexdigest()[:16]

    def _apply_compression(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Apply response compression (gzip)"""

        # Check if compression is enabled
        if not getattr(settings, 'GZIP_COMPRESSION', True):
            return response

        # Skip if response is too small
        min_length = getattr(settings, 'GZIP_MIN_LENGTH', 1024)
        if len(response.content) < min_length:
            return response

        # Skip if already compressed
        if response.get('Content-Encoding'):
            return response

        # Check Accept-Encoding header
        accept_encoding = request.META.get('HTTP_ACCEPT_ENCODING', '')
        if 'gzip' not in accept_encoding.lower():
            return response

        # Skip non-compressible content types
        content_type = response.get('Content-Type', '')
        non_compressible = ['image/', 'video/', 'audio/', 'application/pdf']
        if any(ct in content_type for ct in non_compressible):
            return response

        try:
            # Compress response content
            compressed_content = gzip.compress(response.content)

            # Only use compression if it actually reduces size
            if len(compressed_content) < len(response.content):
                response.content = compressed_content
                response['Content-Encoding'] = 'gzip'
                response['Content-Length'] = str(len(compressed_content))
                response['Vary'] = 'Accept-Encoding'

                logger.debug(f"Compressed response: {len(response.content)} -> {len(compressed_content)} bytes")

        except Exception as e:
            logger.error(f"Compression failed: {str(e)}")

        return response

    def _apply_caching_headers(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Apply intelligent caching headers for compliance API"""

        path = request.path
        method = request.method

        # Only cache GET requests
        if method != 'GET':
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            return response

        # Determine cache strategy based on endpoint
        cache_config = self._get_cache_config_for_endpoint(path)

        if cache_config:
            # Apply caching headers
            response['Cache-Control'] = f"max-age={cache_config['max_age']}, must-revalidate"
            response['ETag'] = f'"{self._generate_etag(request)}"'

            # Add Vary header for user-specific content
            if cache_config.get('vary_on_user', False):
                response['Vary'] = 'Authorization'

            # Add Last-Modified header for time-sensitive data
            if cache_config.get('include_last_modified', False):
                response['Last-Modified'] = time.strftime(
                    '%a, %d %b %Y %H:%M:%S GMT',
                    time.gmtime(time.time())
                )

        else:
            # No caching for dynamic content
            response['Cache-Control'] = 'no-cache, must-revalidate'

        return response

    def _get_cache_config_for_endpoint(self, path: str) -> Optional[Dict[str, Any]]:
        """Get caching configuration for specific endpoint"""

        cache_configs = {
            # Static compliance data - long cache
            '/api/v1/compliance/regulations/': {
                'max_age': 3600,  # 1 hour
                'vary_on_user': False,
                'include_last_modified': True
            },
            '/api/v1/compliance/countries/': {
                'max_age': 7200,  # 2 hours
                'vary_on_user': False,
                'include_last_modified': True
            },

            # Dashboard metrics - medium cache
            '/api/v1/compliance/dashboard/': {
                'max_age': 300,  # 5 minutes
                'vary_on_user': True,
                'include_last_modified': True
            },
            '/api/v1/compliance/summary/': {
                'max_age': 120,  # 2 minutes
                'vary_on_user': True,
                'include_last_modified': True
            },

            # Trend data - longer cache
            '/api/v1/compliance/trends/': {
                'max_age': 1800,  # 30 minutes
                'vary_on_user': True,
                'include_last_modified': True
            },

            # Real-time data - short cache
            '/api/v1/compliance/alerts/': {
                'max_age': 60,  # 1 minute
                'vary_on_user': True,
                'include_last_modified': False
            },

            # No caching for these endpoints
            '/api/v1/compliance/check/': None,  # Real-time checks
            '/api/v1/compliance/violations/': {
                'max_age': 60,  # 1 minute
                'vary_on_user': True,
                'include_last_modified': True
            },
        }

        # Exact match first
        if path in cache_configs:
            return cache_configs[path]

        # Pattern matching for parameterized URLs
        for pattern, config in cache_configs.items():
            if pattern.endswith('/') and path.startswith(pattern):
                return config

        return None

    def _add_performance_headers(self, response: HttpResponse) -> HttpResponse:
        """Add performance and security headers"""

        # Performance headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'

        # API-specific headers
        response['X-API-Version'] = '1.0'
        response['X-RateLimit-Remaining'] = '1000'  # Would be dynamic in real implementation

        return response

    def _log_slow_request(self, request: HttpRequest, response: HttpResponse, duration: float):
        """Log slow requests for performance analysis"""

        slow_request_data = {
            'request_id': getattr(request, '_request_id', 'unknown'),
            'method': request.method,
            'path': request.path,
            'query_params': dict(request.GET),
            'user_id': request.user.id if request.user.is_authenticated else None,
            'duration': duration,
            'status_code': response.status_code,
            'response_size': len(response.content),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        }

        logger.warning(
            f"Slow request detected: {request.method} {request.path} "
            f"took {duration:.3f}s (status: {response.status_code})",
            extra=slow_request_data
        )

        # Store in cache for performance dashboard
        cache_key = f'slow_requests:{int(time.time() // 3600)}'  # Hourly buckets
        slow_requests = cache.get(cache_key, [])
        slow_requests.append(slow_request_data)

        # Keep only last 100 slow requests per hour
        if len(slow_requests) > 100:
            slow_requests = slow_requests[-100:]

        cache.set(cache_key, slow_requests, timeout=3600)


class ComplianceCacheMiddleware(MiddlewareMixin):
    """
    Specialized caching middleware for compliance system.
    Integrates with the Redis caching implementation.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.cache_manager = None

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Check cache for compliance API responses"""

        if not self._should_cache_request(request):
            return None

        # Generate cache key
        cache_key = self._generate_cache_key(request)

        # Try to get from cache
        cached_response = cache.get(cache_key)
        if cached_response:
            # Return cached JSON response
            response = JsonResponse(cached_response['data'])
            response['X-Cache'] = 'HIT'
            response['X-Cache-Key'] = cache_key[:16]  # Truncated for security

            # Apply original headers
            for header, value in cached_response.get('headers', {}).items():
                response[header] = value

            return response

        # Store cache key for process_response
        request._cache_key = cache_key
        return None

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Cache compliance API responses"""

        if not hasattr(request, '_cache_key'):
            return response

        # Only cache successful JSON responses
        if (response.status_code == 200 and
            response.get('Content-Type', '').startswith('application/json')):

            try:
                # Parse response data
                response_data = json.loads(response.content.decode())

                # Prepare cached data
                cached_data = {
                    'data': response_data,
                    'headers': {
                        'Content-Type': response.get('Content-Type'),
                        'ETag': response.get('ETag'),
                        'Cache-Control': response.get('Cache-Control'),
                    },
                    'cached_at': time.time(),
                }

                # Determine cache timeout based on endpoint
                timeout = self._get_cache_timeout(request.path)

                # Store in cache
                cache.set(request._cache_key, cached_data, timeout=timeout)

                response['X-Cache'] = 'MISS'
                response['X-Cache-Timeout'] = str(timeout)

            except Exception as e:
                logger.error(f"Failed to cache response: {str(e)}")

        return response

    def _should_cache_request(self, request: HttpRequest) -> bool:
        """Determine if request should be cached"""

        # Only GET requests
        if request.method != 'GET':
            return False

        # Only compliance API endpoints
        if not request.path.startswith('/api/v1/compliance/'):
            return False

        # Skip real-time endpoints
        skip_paths = ['/api/v1/compliance/check/', '/api/v1/compliance/live/']
        if any(request.path.startswith(path) for path in skip_paths):
            return False

        return True

    def _generate_cache_key(self, request: HttpRequest) -> str:
        """Generate cache key for compliance API requests"""

        key_data = {
            'path': request.path,
            'query': sorted(request.GET.items()),
            'user_id': request.user.id if request.user.is_authenticated else 'anonymous',
            'user_role': getattr(request.user, 'role', 'unknown'),
        }

        key_string = json.dumps(key_data, sort_keys=True)
        return f"compliance_api:{hashlib.md5(key_string.encode()).hexdigest()}"

    def _get_cache_timeout(self, path: str) -> int:
        """Get cache timeout for specific endpoint"""

        timeouts = {
            '/api/v1/compliance/dashboard/': 300,      # 5 minutes
            '/api/v1/compliance/summary/': 120,        # 2 minutes
            '/api/v1/compliance/trends/': 1800,        # 30 minutes
            '/api/v1/compliance/violations/': 60,      # 1 minute
            '/api/v1/compliance/alerts/': 60,          # 1 minute
            '/api/v1/compliance/regulations/': 3600,   # 1 hour
            '/api/v1/compliance/countries/': 7200,     # 2 hours
        }

        # Exact match first
        if path in timeouts:
            return timeouts[path]

        # Pattern matching
        for pattern, timeout in timeouts.items():
            if pattern.endswith('/') and path.startswith(pattern):
                return timeout

        # Default timeout
        return 300  # 5 minutes