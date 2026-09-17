import logging

from django.apps import AppConfig
from django.conf import settings


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        """Import signals when app is ready"""
        import api.signals  # noqa: F401

        # Logged here rather than in settings, where logging isn't configured yet.
        if not settings.MEDIA_STORAGE_IS_DURABLE:
            logging.getLogger('api').error(
                'Document storage is not durable: this host wipes local disk and '
                'R2 is not configured (set R2_BUCKET_NAME, R2_ENDPOINT_URL, '
                'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). SIA licence uploads '
                'will be refused.'
            )
