"""
Production configuration checks (AUDIT-2026-09-17, Phase 2D).

Django system checks, so they print on every `manage.py` command — including
the `migrate` in `build.sh`, which is where a Render deploy would show them.
An Error there fails `migrate`, which fails the build, and the previous release
keeps serving: reserved for settings that make the running service unsafe.
Everything that is a judgement call is a Warning: visible in the build log,
never a reason a deploy stops.

Only evaluated on Render (`RENDER=true`); local Docker and tests are exempt.
"""
from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register(Tags.security, deploy=False)
def production_settings(app_configs, **kwargs):
    if not getattr(settings, 'ON_RENDER', False):
        return []

    problems = []
    if settings.DEBUG:
        problems.append(Error(
            'DEBUG is on in production.',
            hint='Unset DJANGO_DEBUG on Render. DEBUG serves stack traces, settings and '
                 'the Swagger schema to anyone.',
            id='mead.E001',
        ))
    if not getattr(settings, 'REGISTRATION_REQUIRES_INVITE', False):
        problems.append(Warning(
            'Self-serve registration is open: anyone can create an account and a company.',
            hint='Set REGISTRATION_REQUIRES_INVITE=True until self-serve signup is meant '
                 'to be open (AUDIT-2026-09-17 action 0.2).',
            id='mead.W001',
        ))
    if not getattr(settings, 'SENTRY_DSN', ''):
        problems.append(Warning(
            'SENTRY_DSN is not set: server errors are reported nowhere.',
            id='mead.W002',
        ))
    if not getattr(settings, 'MEDIA_STORAGE_IS_DURABLE', True):
        problems.append(Warning(
            'Document storage is not durable: R2 is not configured, so SIA licence '
            'uploads are refused.',
            hint='Set R2_BUCKET_NAME, R2_ENDPOINT_URL, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
            id='mead.W003',
        ))
    return problems
