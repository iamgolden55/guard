"""
Liveness and readiness.

Two questions, deliberately answered by two URLs (AUDIT-2026-09-17, Phase 2D):

- `/api/v1/health/` — *is the process up?* Render's health check. It must not
  depend on Postgres or Redis: if it did, a brief Redis blip would make Render
  restart a perfectly healthy web service, over and over.
- `/api/v1/health/ready/` — *can it do its job?* Checks Postgres and Redis and
  answers 503 when either is down. Point an external uptime monitor here; it is
  the check that would have told someone the platform was broken.

Neither needs authentication, and neither says more than ok / failed per
dependency: error text can carry hostnames and credentials.
"""
import logging

from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def liveness(request):
    return JsonResponse({'status': 'healthy', 'service': 'mead-security-api'})


def _check_database():
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()


def _check_redis():
    import redis

    client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
    try:
        client.ping()
    finally:
        client.close()


CHECKS = {
    'database': _check_database,
    'redis': _check_redis,
}


def readiness(request):
    results = {}
    for name, check in CHECKS.items():
        try:
            check()
            results[name] = 'ok'
        except Exception:  # noqa: BLE001 — any failure means not ready
            logger.exception('Readiness check failed: %s', name)
            results[name] = 'failed'
    ready = all(value == 'ok' for value in results.values())
    return JsonResponse(
        {'status': 'ready' if ready else 'not_ready', 'checks': results},
        status=200 if ready else 503,
    )
