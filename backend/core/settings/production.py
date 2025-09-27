# Production settings for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025
# Performance-optimized configuration for production deployment

import os
from .base import *

# Debug and Security
DEBUG = False
ALLOWED_HOSTS = ['*']  # Configure with actual domain names

# Database Performance Optimization
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'compliance_prod'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'OPTIONS': {
            'MAX_CONNS': 20,  # Connection pool size
            'sslmode': 'require',
        },
        # Connection pooling optimization
        'CONN_MAX_AGE': 600,  # 10 minutes connection reuse
        'CONN_HEALTH_CHECKS': True,  # Health check connections
    }
}

# Redis Cache Configuration for High Performance
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            },
            'COMPRESSOR': 'django_redis.compressors.zlib.ZlibCompressor',
            'SERIALIZER': 'django_redis.serializers.json.JSONSerializer',
        },
        'TIMEOUT': 300,  # 5 minutes default timeout
    }
}

# Cache configuration for compliance system
COMPLIANCE_CACHE_SETTINGS = {
    'DASHBOARD_METRICS_TTL': 300,     # 5 minutes
    'VIOLATION_SUMMARY_TTL': 120,     # 2 minutes
    'TRENDS_DATA_TTL': 1800,          # 30 minutes
    'USER_SPECIFIC_TTL': 60,          # 1 minute
    'REALTIME_CHECK_TTL': 30,         # 30 seconds
}

# Session Configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
SESSION_COOKIE_AGE = 3600  # 1 hour

# Static Files and CDN Optimization
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
STATIC_ROOT = '/app/staticfiles'
STATIC_URL = '/static/'

# Media files - Configure with CDN in production
MEDIA_ROOT = '/app/media'
MEDIA_URL = '/media/'

# If using AWS S3/CloudFront CDN:
if os.environ.get('USE_S3_CDN', '').lower() == 'true':
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN')
    AWS_DEFAULT_ACL = None
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',  # 1 day cache
    }

    # Static files via S3
    STATICFILES_STORAGE = 'storages.backends.s3boto3.StaticS3Boto3Storage'
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.MediaS3Boto3Storage'

    STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/static/'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'

# Performance Middleware Configuration
MIDDLEWARE = [
    'django.middleware.cache.UpdateCacheMiddleware',  # Cache entire page
    'django.middleware.gzip.GZipMiddleware',          # Response compression
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',     # Static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django.middleware.cache.FetchFromCacheMiddleware',  # Cache entire page
]

# Cache entire site (be careful with user-specific content)
CACHE_MIDDLEWARE_ALIAS = 'default'
CACHE_MIDDLEWARE_SECONDS = 300  # 5 minutes
CACHE_MIDDLEWARE_KEY_PREFIX = 'compliance'

# Compression Configuration
GZIP_MIN_LENGTH = 1024
GZIP_COMPRESSION = True

# Security Settings for Production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Logging Configuration for Performance Monitoring
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'performance': {
            'format': '{asctime} - {name} - {levelname} - {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/app/logs/compliance.log',
            'formatter': 'verbose',
        },
        'performance': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/app/logs/performance.log',
            'formatter': 'performance',
        },
        'console': {
            'level': 'ERROR',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
        },
        'compliance': {
            'handlers': ['file', 'performance'],
            'level': 'INFO',
            'propagate': False,
        },
        'api': {
            'handlers': ['file', 'performance'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# API Performance Configuration
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,  # Optimized page size
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.AnonRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '1000/hour',      # Higher limit for authenticated users
        'anon': '100/hour',       # Limited for anonymous users
        'compliance_check': '60/min',  # Real-time compliance checks
    },
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

# Django Extensions for Performance Analysis
if 'django_extensions' in INSTALLED_APPS:
    INSTALLED_APPS.append('django_prometheus')

# WebSocket Configuration (for django-channels)
ASGI_APPLICATION = 'core.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.environ.get('REDIS_URL', 'redis://localhost:6379/2')],
            'capacity': 1000,  # Channel capacity
            'expiry': 60,      # Message expiry time
        },
    },
}

# Email Configuration for Production
if os.environ.get('EMAIL_BACKEND'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

# Celery Configuration for Background Tasks
if os.environ.get('USE_CELERY', '').lower() == 'true':
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/3')
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/3')

    CELERY_ACCEPT_CONTENT = ['json']
    CELERY_TASK_SERIALIZER = 'json'
    CELERY_RESULT_SERIALIZER = 'json'
    CELERY_TIMEZONE = TIME_ZONE

    # Performance optimization for Celery
    CELERY_TASK_ROUTES = {
        'api.tasks.calculate_compliance_metrics': {'queue': 'compliance_metrics'},
        'api.tasks.process_violation_detection': {'queue': 'violation_processing'},
        'api.tasks.send_compliance_notifications': {'queue': 'notifications'},
    }

    CELERY_WORKER_CONCURRENCY = 4
    CELERY_WORKER_PREFETCH_MULTIPLIER = 1

    # Task priorities
    CELERY_TASK_DEFAULT_PRIORITY = 5
    CELERY_WORKER_HIJACK_ROOT_LOGGER = False

# Performance Monitoring
PERFORMANCE_MONITORING = {
    'ENABLE_QUERY_PROFILING': os.environ.get('ENABLE_QUERY_PROFILING', 'false').lower() == 'true',
    'SLOW_QUERY_THRESHOLD': 0.1,  # Log queries > 100ms
    'ENABLE_REQUEST_PROFILING': os.environ.get('ENABLE_REQUEST_PROFILING', 'false').lower() == 'true',
    'REQUEST_PROFILING_THRESHOLD': 1.0,  # Log requests > 1 second
}

# Custom Performance Settings for Compliance System
COMPLIANCE_PERFORMANCE_CONFIG = {
    'MAX_VIOLATION_BATCH_SIZE': 1000,
    'DASHBOARD_REFRESH_INTERVAL': 30,      # 30 seconds
    'REALTIME_CHECK_TIMEOUT': 0.05,       # 50ms timeout
    'BULK_CALCULATION_BATCH_SIZE': 500,   # Users per batch
    'WEBSOCKET_HEARTBEAT_INTERVAL': 30,   # 30 seconds
    'CACHE_WARMING_ENABLED': True,
    'PRELOAD_DASHBOARD_DATA': True,
}

# Prometheus Metrics Configuration
if 'django_prometheus' in INSTALLED_APPS:
    PROMETHEUS_METRICS_EXPORT_PORT = int(os.environ.get('PROMETHEUS_PORT', '9090'))
    PROMETHEUS_METRICS_EXPORT_ADDRESS = '0.0.0.0'

# Health Check Configuration
HEALTH_CHECKS = {
    'DATABASE': True,
    'CACHE': True,
    'REDIS': True,
    'WEBSOCKET': True,
}