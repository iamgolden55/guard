"""Profile photos: uploaded, then actually visible.

An officer uploaded a photo from the staff app and nothing appeared. The upload
itself worked; what came back could never load. `MEDIA_URL` was `'media/'` with
no leading slash, so the view built
`https://mead-security-api.onrender.commedia/profile_photos/<name>` — not a
hostname that exists — and production serves no `/media/` path in any case,
because Django only does that with DEBUG on. For an admin it failed twice over:
`/profiles/me` returned `profileImageUrl: None` regardless of what was stored.

Rows now hold the storage key and readers hand out a signed, expiring link that
an `<img>` can load without an Authorization header. Storage is in-memory here,
so nothing touches disk or R2.
"""
import io
from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, StaffProfile, UserCompanyMembership
from api.utils import profile_photos

User = get_user_model()

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

IN_MEMORY_STORAGE = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def png(name="selfie.png"):
    upload = io.BytesIO(PNG_BYTES)
    upload.name = name
    return upload


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class ProfilePhotoTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Photo Co", registration_number="PHOTO001",
        )
        self.officer = self._user("photo_officer", "staff")
        self.admin = self._user("photo_admin", "admin")
        self.profile = self._profile(self.officer)
        self.client = APIClient()

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "admin",
        )
        return user

    def _profile(self, user):
        profile, _ = StaffProfile.objects.get_or_create(
            user=user,
            defaults=dict(
                phone_number="07700900000", date_of_birth=date(1990, 1, 1),
                street="1 Test St", city="Bristol", postal_code="BS1 1AA",
                country="UK",
            ),
        )
        return profile

    def _upload(self, upload=None):
        return self.client.post(
            "/api/v1/staff/profile/upload-photo/",
            {"photo": upload or png()}, format="multipart",
        )

    # ── Uploading ───────────────────────────────────────────────────────────

    def test_an_officer_uploads_a_photo_and_gets_back_a_link_that_resolves(self):
        self.client.force_authenticate(user=self.officer)

        response = self._upload()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        url = response.data["url"]
        self.assertTrue(url.startswith("http"), url)
        # The bug this replaces: host and 'media' glued together.
        self.assertNotIn("commedia", url)
        self.profile.refresh_from_db()
        self.assertTrue(default_storage.exists(self.profile.profile_image_url))

    def test_the_row_holds_the_storage_key_not_a_url(self):
        self.client.force_authenticate(user=self.officer)

        self._upload()

        self.profile.refresh_from_db()
        self.assertTrue(
            self.profile.profile_image_url.startswith("profile_photos/"),
            self.profile.profile_image_url,
        )
        self.assertNotIn("http", self.profile.profile_image_url)

    def test_replacing_a_photo_deletes_the_old_file(self):
        self.client.force_authenticate(user=self.officer)
        self._upload()
        self.profile.refresh_from_db()
        old_key = self.profile.profile_image_url

        self._upload(png("newer.png"))

        self.profile.refresh_from_db()
        self.assertNotEqual(old_key, self.profile.profile_image_url)
        self.assertFalse(default_storage.exists(old_key))
        self.assertTrue(default_storage.exists(self.profile.profile_image_url))

    def test_a_file_that_is_not_an_image_is_refused(self):
        self.client.force_authenticate(user=self.officer)

        response = self._upload(SimpleUploadedFile(
            "evil.png", b"<html>nope</html>", content_type="image/png",
        ))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.profile_image_url)

    # ── Reading it back ─────────────────────────────────────────────────────

    def test_the_officers_own_profile_carries_a_loadable_link(self):
        self.client.force_authenticate(user=self.officer)
        self._upload()

        response = self.client.get("/api/v1/profiles/me")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for field in ("profile_image_url", "profileImageUrl"):
            url = response.data.get(field)
            self.assertTrue(url and url.startswith("http"), f"{field}: {url!r}")
            self.assertNotIn("commedia", url)

    def test_an_admins_photo_reaches_their_profile_too(self):
        """The admin branch of /profiles/me returned None whatever was stored."""
        self._profile(self.admin)
        self.client.force_authenticate(user=self.admin)
        upload = self._upload()
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED, upload.data)

        response = self.client.get("/api/v1/profiles/me")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        url = response.data.get("profileImageUrl")
        self.assertTrue(url and url.startswith("http"), f"got {url!r}")

    def test_a_profile_with_no_photo_reports_none(self):
        self.client.force_authenticate(user=self.officer)

        response = self.client.get("/api/v1/profiles/me")

        self.assertIsNone(response.data.get("profile_image_url"))

    # ── What must never be signed ───────────────────────────────────────────

    def test_a_client_cannot_point_their_avatar_at_another_file(self):
        """`profile_image_url` is read-only; a licence scan is not an avatar."""
        self.client.force_authenticate(user=self.officer)

        response = self.client.patch(
            "/api/v1/profiles/me",
            {"profile_image_url": "sia_licenses/999/secret.png"}, format="json",
        )

        self.assertIn(
            response.status_code,
            (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST),
        )
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.profile_image_url)

    def test_a_key_outside_the_photo_prefix_is_never_signed(self):
        for value in (
            "sia_licenses/21/card.png",
            "profile_photos/../sia_licenses/21/card.png",
            "https://example.test/avatars/someone.png",
            "",
            None,
        ):
            self.assertIsNone(profile_photos.storage_key(value), value)
            self.assertIsNone(profile_photos.signed_url(value), value)

    def test_erasing_an_officer_removes_their_photo(self):
        """Account erasure must not leave the photo in the bucket."""
        self.client.force_authenticate(user=self.officer)
        self._upload()
        self.profile.refresh_from_db()
        key = self.profile.profile_image_url

        with self.captureOnCommitCallbacks(execute=True):
            self.profile.delete()

        self.assertFalse(default_storage.exists(key))

    # ── Photos stored before the fix ────────────────────────────────────────

    def test_a_legacy_row_still_resolves_to_its_file(self):
        key = profile_photos.store(png(), self.officer.id, ".png")
        name = key.split("profile_photos/", 1)[1]
        # Exactly the shape the old view wrote, missing slash and all.
        self.profile.profile_image_url = (
            f"https://mead-security-api.onrender.commedia/profile_photos/{name}"
        )
        self.profile.save(update_fields=["profile_image_url"])

        self.assertEqual(profile_photos.storage_key(self.profile.profile_image_url), key)
        self.client.force_authenticate(user=self.officer)
        response = self.client.get("/api/v1/profiles/me")

        url = response.data.get("profile_image_url")
        self.assertTrue(url and url.startswith("http"), f"got {url!r}")
        self.assertNotIn("commedia", url)
