"""
Refuse mobile builds below a configured minimum (AUDIT-2026-09-17, Phase 2F).

Mobile builds can't be rolled back, so a build with a known defect keeps
running until the officer happens to update. The app sends `X-App-Platform`
and `X-App-Build` on every request (`mobile/src/utils/appVersion.ts`); below
`MIN_APP_BUILD[platform]` this answers 426 `app_update_required`, which the
app shows as a blocking "Update required" message.

A request without the headers passes: the web admin sends none, and neither do
builds from before this gate. Those older builds are the ones whose offline
queue loses a check-in that fails, so refusing them would make things worse;
they are retired by updating devices, not by the server.

With no minimum configured (the default) nothing is refused.
"""
import logging

from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)

#: Paths never refused: monitoring must work whatever build asks.
EXEMPT_PREFIXES = ('/api/v1/health/',)


class MinimumAppBuildMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        refusal = self._refusal(request)
        return refusal if refusal is not None else self.get_response(request)

    def _refusal(self, request):
        platform = request.headers.get('X-App-Platform', '').strip().lower()
        raw_build = request.headers.get('X-App-Build', '').strip()
        if not platform or not raw_build or request.path.startswith(EXEMPT_PREFIXES):
            return None
        minimum = (getattr(settings, 'MIN_APP_BUILD', None) or {}).get(platform) or 0
        try:
            build = int(raw_build)
        except ValueError:
            return None  # a dev build or a typo: not ours to judge
        if build >= minimum:
            return None
        logger.info("Refused %s build %s (minimum %s): %s", platform, build, minimum, request.path)
        return JsonResponse(
            {
                'error': 'app_update_required',
                'detail': 'This version of the app is no longer supported. '
                          'Install the latest version to continue.',
                'minimum_build': minimum,
            },
            status=426,
        )
