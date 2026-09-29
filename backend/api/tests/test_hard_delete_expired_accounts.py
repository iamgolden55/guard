"""The nightly erasure of accounts whose 30-day deletion period has passed.

`hard_delete_expired_accounts` crashed every night from April to 2026-09-25
(`NameError: name 'result' is not defined`, Sentry PYTHON-DJANGO-3 / -2), so no
account was ever erased. The crash is gone, and these tests pin what the task
has to do now that it runs:

- erase only inactive accounts scheduled more than 30 days ago;
- take every stored file of theirs, including licence scans that no licence
  points at any more (legacy `/upload/` cards, old cards whose delete failed)
  and superseded profile photos, while leaving everyone else's alone;
- drop their push and password-reset tokens;
- be safe to run twice, and not let one failing account stop the rest.

Storage is in-memory, so nothing touches disk or R2.
"""
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase, override_settings
from django.utils import timezone

from api.models import (
    BankDetails, PasswordResetToken, SIALicense, SNSDeviceToken, StaffProfile,
)
from api.tasks import hard_delete_expired_accounts

User = get_user_model()

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

IN_MEMORY_STORAGE = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class HardDeleteExpiredAccountsTests(TestCase):
    def setUp(self):
        self.expired = self._officer("expired_officer", days_ago=31)
        self.recent = self._officer("recent_officer", days_ago=29)
        self.active = self._officer("active_officer", days_ago=None)

    # -- fixtures -----------------------------------------------------------

    def _officer(self, username, days_ago):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role="staff",
            first_name="Real", last_name="Name",
        )
        StaffProfile.objects.create(
            user=user, phone_number="07700900000", date_of_birth=date(1990, 1, 1),
            street="1 Test St", city="Bristol", postal_code="BS1 1AA", country="UK",
        )
        if days_ago is not None:
            User.objects.filter(pk=user.pk).update(
                is_active=False,
                deletion_scheduled_at=timezone.now() - timedelta(days=days_ago),
            )
            user.refresh_from_db()
        return user

    def _save(self, key):
        return default_storage.save(key, ContentFile(PNG_BYTES))

    def _attached_scan(self, user, number):
        key = self._save(f"sia_licenses/{user.id}/attached{number}.png")
        SIALicense.objects.create(
            staff_profile=user.profile,
            license_number=f"{number:016d}",
            license_type="ds",
            issue_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=365),
            status="pending",
            document_url=f"https://api.test/api/v1/sia-license-documents/{key.split('sia_licenses/', 1)[1]}",
        )
        return key

    def _photo(self, user, suffix):
        key = self._save(f"profile_photos/user_{user.id}_{suffix}.jpg")
        return key

    def _run(self):
        with self.captureOnCommitCallbacks(execute=True):
            return hard_delete_expired_accounts()

    # -- which accounts -----------------------------------------------------

    def test_it_erases_only_inactive_accounts_past_the_30_days(self):
        result = self._run()

        self.assertEqual(result, {"anonymized": 1, "failed": 0})
        self.expired.refresh_from_db()
        self.assertEqual(self.expired.username, f"deleted_user_{self.expired.id}")
        self.assertEqual(self.expired.email, f"deleted_{self.expired.id}@removed.local")
        self.assertEqual((self.expired.first_name, self.expired.last_name), ("Deleted", "User"))
        self.assertFalse(self.expired.has_usable_password())
        self.assertIsNone(self.expired.deletion_scheduled_at)
        self.assertFalse(StaffProfile.objects.filter(user=self.expired).exists())

        for untouched in (self.recent, self.active):
            untouched.refresh_from_db()
            self.assertEqual(untouched.first_name, "Real")
            self.assertTrue(StaffProfile.objects.filter(user=untouched).exists())

    def test_a_reactivated_account_is_not_erased(self):
        # Scheduled, then an admin let them back in without clearing the date.
        User.objects.filter(pk=self.recent.pk).update(
            is_active=True, deletion_scheduled_at=timezone.now() - timedelta(days=90),
        )
        self._run()
        self.recent.refresh_from_db()
        self.assertEqual(self.recent.first_name, "Real")

    # -- stored files -------------------------------------------------------

    def test_every_licence_scan_in_the_officers_directory_goes(self):
        attached = self._attached_scan(self.expired, 1)
        # Uploaded through the legacy `/upload/` view, which can't attach it.
        stray = self._save(f"sia_licenses/{self.expired.id}/legacy-upload.pdf")
        neighbour = self._attached_scan(self.recent, 2)

        self._run()

        self.assertFalse(default_storage.exists(attached))
        self.assertFalse(default_storage.exists(stray))
        self.assertTrue(default_storage.exists(neighbour))

    def test_every_profile_photo_saved_for_them_goes(self):
        current = self._photo(self.expired, "aaaa1111")
        superseded = self._photo(self.expired, "bbbb2222")
        StaffProfile.objects.filter(user=self.expired).update(profile_image_url=current)
        # `user_1_` must not match `user_12_`: build a neighbour whose id
        # starts with the erased officer's.
        neighbour = self._save(f"profile_photos/user_{self.expired.id}0_cccc3333.jpg")
        recent_photo = self._photo(self.recent, "dddd4444")

        self._run()

        self.assertFalse(default_storage.exists(current))
        self.assertFalse(default_storage.exists(superseded))
        self.assertTrue(default_storage.exists(neighbour))
        self.assertTrue(default_storage.exists(recent_photo))

    def test_banking_and_tokens_go(self):
        BankDetails.objects.create(
            staff_profile=self.expired.profile, account_name="Real Name",
            account_number="12345678", sort_code="112233", bank_name="Test Bank",
        )
        SNSDeviceToken.objects.create(
            user=self.expired, token="ExponentPushToken[erase-me]",
            platform="ios", device_id="device-1",
        )
        PasswordResetToken.objects.create(
            user=self.expired, expires_at=timezone.now() + timedelta(hours=24),
        )
        SNSDeviceToken.objects.create(
            user=self.recent, token="ExponentPushToken[keep-me]",
            platform="ios", device_id="device-2",
        )

        self._run()

        self.assertFalse(BankDetails.objects.filter(account_name="Real Name").exists())
        self.assertFalse(SNSDeviceToken.objects.filter(user=self.expired).exists())
        self.assertFalse(PasswordResetToken.objects.filter(user=self.expired).exists())
        self.assertTrue(SNSDeviceToken.objects.filter(user=self.recent).exists())

    # -- runs ---------------------------------------------------------------

    def test_a_second_run_finds_nothing_to_do(self):
        self._attached_scan(self.expired, 1)
        self.assertEqual(self._run(), {"anonymized": 1, "failed": 0})
        self.assertEqual(self._run(), {"anonymized": 0, "failed": 0})

    def test_one_failing_account_does_not_stop_the_rest(self):
        second = self._officer("second_expired", days_ago=40)
        second_scan = self._save(f"sia_licenses/{second.id}/card.png")
        first_scan = self._save(f"sia_licenses/{self.expired.id}/card.png")

        real_delete = StaffProfile.delete

        def delete(profile, *args, **kwargs):
            if profile.user_id == self.expired.id:
                raise RuntimeError("storage exploded")
            return real_delete(profile, *args, **kwargs)

        with mock.patch.object(StaffProfile, "delete", delete):
            result = self._run()

        self.assertEqual(result, {"anonymized": 1, "failed": 1})
        second.refresh_from_db()
        self.assertEqual(second.first_name, "Deleted")
        self.assertFalse(default_storage.exists(second_scan))

        # The failed one is rolled back whole and stays due for tomorrow's run,
        # with its files still there to be erased then.
        self.expired.refresh_from_db()
        self.assertEqual(self.expired.first_name, "Real")
        self.assertIsNotNone(self.expired.deletion_scheduled_at)
        self.assertTrue(default_storage.exists(first_scan))
        self.assertEqual(self._run(), {"anonymized": 1, "failed": 0})
        self.assertFalse(default_storage.exists(first_scan))
