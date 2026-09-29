import logging
import sys

from django.apps import AppConfig
from django.conf import settings


def is_celery_beat(argv):
    return 'celery' in (argv[0] if argv else '') and 'beat' in argv


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        """Import signals when app is ready"""
        import api.signals  # noqa: F401
        import api.checks  # noqa: F401  (registers the production settings checks)

        # Logged here rather than in settings, where logging isn't configured yet.
        # Not from celery beat: it only queues scheduled tasks and never touches
        # a file, so it has no R2 settings and logged this on every deploy.
        if not settings.MEDIA_STORAGE_IS_DURABLE and not is_celery_beat(sys.argv):
            logging.getLogger('api').error(
                'Document storage is not durable: this host wipes local disk and '
                'R2 is not configured (set R2_BUCKET_NAME, R2_ENDPOINT_URL, '
                'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). SIA licence uploads '
                'will be refused.'
            )
