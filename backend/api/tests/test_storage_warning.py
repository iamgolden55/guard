"""
The "document storage is not durable" error was logged by celery beat on every
deploy (PYTHON-DJANGO-19). Beat never handles files and has no R2 settings, so
the alert fired while uploads on the API were fine.
"""
from unittest import mock

from django.apps import apps
from django.test import SimpleTestCase, override_settings

from api.apps import is_celery_beat

BEAT = ['/opt/render/project/src/.venv/bin/celery', '-A', 'core.celery_app', 'beat', '-l', 'info']
WORKER = ['/opt/render/project/src/.venv/bin/celery', '-A', 'core.celery_app', 'worker', '-l', 'info']
API = ['/opt/render/project/src/.venv/bin/daphne', '-b', '0.0.0.0', '-p', '10000', 'core.asgi:application']


class StorageWarningTests(SimpleTestCase):
    def test_detects_beat_only(self):
        self.assertTrue(is_celery_beat(BEAT))
        self.assertFalse(is_celery_beat(WORKER))
        self.assertFalse(is_celery_beat(API))
        self.assertFalse(is_celery_beat([]))

    def _logged(self, argv):
        with mock.patch('api.apps.sys.argv', argv), mock.patch('api.apps.logging.getLogger') as get_logger:
            apps.get_app_config('api').ready()
        return get_logger.return_value.error.called

    @override_settings(MEDIA_STORAGE_IS_DURABLE=False)
    def test_api_and_worker_still_warn(self):
        self.assertTrue(self._logged(API))
        self.assertTrue(self._logged(WORKER))

    @override_settings(MEDIA_STORAGE_IS_DURABLE=False)
    def test_beat_does_not_warn(self):
        self.assertFalse(self._logged(BEAT))

    @override_settings(MEDIA_STORAGE_IS_DURABLE=True)
    def test_durable_storage_does_not_warn(self):
        self.assertFalse(self._logged(API))
