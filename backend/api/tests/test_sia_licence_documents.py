"""Licence cards: an admin attaches, views and replaces an officer's SIA scan.

Company admins could not put a licence card on an officer's record at all. The
dashboard had no upload; the only endpoint, `/upload/`, filed whatever it was
given under the *uploader's* directory, so an admin uploading for an officer
stored it as the admin's own; and on Render every file landed on a disk wiped
at the next deploy.

These tests pin the replacement: a card goes in with the licence (or onto it
later), is stored under the officer it belongs to, is served back only to that
officer or a manager of their company, and leaves storage when the licence
does. Storage is in-memory here, so nothing touches disk or R2.
"""
import io
from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    AuditLog, SIALicense, SecurityCompany, StaffProfile, UserCompanyMembership,
)
from api.utils import sia_documents

User = get_user_model()

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF_BYTES = b"%PDF-1.4\n" + b"\x00" * 64
NUMBER = "1234567890123456"

IN_MEMORY_STORAGE = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def png(name="card.png"):
    upload = io.BytesIO(PNG_BYTES)
    upload.name = name
    return upload


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class SIALicenceCardTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Card Co", registration_number="CARD001",
        )
        self.other_company = SecurityCompany.objects.create(
            name="Other Card Co", registration_number="CARD002",
        )
        self.manager = self._user("card_manager", "manager", self.company)
        self.officer = self._user("card_officer", "staff", self.company)
        self.colleague = self._user("card_colleague", "staff", self.company)
        self.outsider = self._user("card_outsider", "manager", self.other_company)
        self.profile = self._profile(self.officer)
        self.colleague_profile = self._profile(self.colleague)
        self.client = APIClient()

    def _user(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=company, is_active=True,
            role="staff" if role == "staff" else "manager",
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

    def _licence(self, profile=None, **overrides):
        defaults = dict(
            staff_profile=profile or self.profile,
            license_number=NUMBER,
            license_type="ds",
            issue_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=365),
            status="pending",
        )
        defaults.update(overrides)
        return SIALicense.objects.create(**defaults)

    def _create_with_card(self, upload, **overrides):
        payload = {
            "staff_profile": self.profile.id,
            "license_number": NUMBER,
            "license_type": "ds",
            "issue_date": str(date.today() - timedelta(days=30)),
            "expiry_date": str(date.today() + timedelta(days=365)),
            "file": upload,
        }
        payload.update(overrides)
        return self.client.post("/api/v1/sia-licenses/", payload, format="multipart")

    def _attach(self, licence, upload):
        return self.client.post(
            f"/api/v1/sia-licenses/{licence.id}/document/",
            {"file": upload}, format="multipart",
        )

    def _files_for(self, user):
        try:
            return default_storage.listdir(f"sia_licenses/{user.id}")[1]
        except FileNotFoundError:
            return []

    def _stored_key(self, licence):
        licence.refresh_from_db()
        return sia_documents.key_for_licence(licence)

    # ── Attaching ───────────────────────────────────────────────────────────

    def test_manager_creates_a_licence_with_its_card_filed_under_the_officer(self):
        self.client.force_authenticate(user=self.manager)

        response = self._create_with_card(png())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertTrue(response.data["has_document"])
        licence = SIALicense.objects.get(id=response.data["id"])
        key = self._stored_key(licence)
        self.assertTrue(key.startswith(f"sia_licenses/{self.officer.id}/"), key)
        self.assertNotIn(f"/{self.manager.id}/", key)
        self.assertTrue(default_storage.exists(key))

    def test_a_rejected_card_leaves_no_licence_and_no_file(self):
        self.client.force_authenticate(user=self.manager)
        bad = SimpleUploadedFile("card.png", b"GIF89a" + b"\x00" * 32, content_type="image/png")

        response = self._create_with_card(bad)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertFalse(SIALicense.objects.exists())
        self.assertEqual(self._files_for(self.officer), [])

    def test_manager_attaches_a_card_to_an_existing_licence(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)

        response = self._attach(licence, png())

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["has_document"])
        self.assertTrue(default_storage.exists(self._stored_key(licence)))
        audit = AuditLog.objects.get(resource_type="SIALicense", resource_id=str(licence.id))
        self.assertEqual(audit.action, "update")
        self.assertEqual(audit.details["field"], "document")
        self.assertFalse(audit.details["replaced"])

    def test_replacing_a_card_removes_the_old_file(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)
        self._attach(licence, png())
        old_key = self._stored_key(licence)

        with self.captureOnCommitCallbacks(execute=True):
            response = self._attach(licence, SimpleUploadedFile(
                "card.pdf", PDF_BYTES, content_type="application/pdf",
            ))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        new_key = self._stored_key(licence)
        self.assertNotEqual(old_key, new_key)
        self.assertFalse(default_storage.exists(old_key))
        self.assertTrue(default_storage.exists(new_key))

    def test_replacing_a_card_keeps_a_verified_licence_verified(self):
        licence = self._licence(status="valid")
        self.client.force_authenticate(user=self.manager)

        self._attach(licence, png())

        licence.refresh_from_db()
        self.assertEqual(licence.status, "valid")

    def test_an_officer_can_attach_a_card_to_their_own_pending_licence(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.officer)

        response = self._attach(licence, png())

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_an_officer_cannot_swap_the_card_on_a_verified_licence(self):
        licence = self._licence(status="valid")
        self.client.force_authenticate(user=self.officer)

        response = self._attach(licence, png())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        licence.refresh_from_db()
        self.assertEqual(licence.document_url, "")

    def test_an_officer_cannot_attach_a_card_to_someone_elses_licence(self):
        licence = self._licence(profile=self.colleague_profile)
        self.client.force_authenticate(user=self.officer)

        response = self._attach(licence, png())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_a_manager_at_another_company_cannot_attach_a_card(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.outsider)

        response = self._attach(licence, png())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_a_file_whose_bytes_are_not_an_image_or_pdf_is_refused(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)

        response = self._attach(licence, SimpleUploadedFile(
            "card.png", b"<svg onload=alert(1)>", content_type="image/png",
        ))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        licence.refresh_from_db()
        self.assertEqual(licence.document_url, "")

    def test_an_oversized_card_is_refused(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)

        with mock.patch("api.utils.sia_documents.MAX_BYTES", 16):
            response = self._attach(licence, png())

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_an_html_name_with_png_bytes_is_kept_and_served_as_a_png(self):
        """The stored extension and served type come from the bytes."""
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)
        evil = SimpleUploadedFile("evil.html", PNG_BYTES, content_type="image/png")

        self._attach(licence, evil)
        key = self._stored_key(licence)
        response = self.client.get(f"/api/v1/sia-licenses/{licence.id}/document/")

        self.assertTrue(key.endswith(".png"), key)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")

    def test_a_client_supplied_document_url_is_ignored(self):
        """Nobody can point their licence at another officer's file."""
        target = sia_documents.store(png(), self.colleague.id, ".png")
        self.client.force_authenticate(user=self.officer)

        response = self.client.post("/api/v1/sia-licenses/", {
            "staff_profile": self.profile.id,
            "license_number": NUMBER,
            "license_type": "ds",
            "issue_date": str(date.today() - timedelta(days=30)),
            "expiry_date": str(date.today() + timedelta(days=365)),
            "document_url": f"http://testserver/api/v1/sia-license-documents/{target.split('sia_licenses/', 1)[1]}",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(response.data["has_document"])
        document = self.client.get(f"/api/v1/sia-licenses/{response.data['id']}/document/")
        self.assertEqual(document.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(document.data["code"], "no_document")

    @override_settings(MEDIA_STORAGE_IS_DURABLE=False)
    def test_uploads_are_refused_when_storage_would_forget_them(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)

        attach = self._attach(licence, png())
        create = self._create_with_card(png(), license_number="6543210987654321")
        legacy = self.client.post("/api/v1/upload/", {"file": png()}, format="multipart")

        self.assertEqual(attach.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(create.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(legacy.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(SIALicense.objects.count(), 1)

    # ── Viewing ─────────────────────────────────────────────────────────────

    def test_the_officer_can_view_a_card_their_manager_uploaded(self):
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())
        licence_id = created.data["id"]
        self.client.force_authenticate(user=self.officer)

        response = self.client.get(f"/api/v1/sia-licenses/{licence_id}/document/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(response.streaming_content), PNG_BYTES)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_the_officer_can_also_reach_it_through_the_older_document_url(self):
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())
        relative = created.data["document_url"].split("/api/v1/sia-license-documents/", 1)[1]
        self.client.force_authenticate(user=self.officer)

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_their_manager_can_view_the_card(self):
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())

        response = self.client.get(f"/api/v1/sia-licenses/{created.data['id']}/document/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_manager_at_another_company_cannot_view_the_card(self):
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(f"/api/v1/sia-licenses/{created.data['id']}/document/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_a_colleague_cannot_view_the_card(self):
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())
        self.client.force_authenticate(user=self.colleague)

        response = self.client.get(f"/api/v1/sia-licenses/{created.data['id']}/document/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_a_licence_with_no_card_says_so(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)

        response = self.client.get(f"/api/v1/sia-licenses/{licence.id}/document/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["code"], "no_document")

    def test_a_card_whose_file_is_gone_asks_for_it_again(self):
        """What every card uploaded to Render's wiped disk now looks like."""
        licence = self._licence(
            document_url=f"http://testserver/api/v1/sia-license-documents/{self.officer.id}/gone.png",
        )
        self.client.force_authenticate(user=self.manager)

        response = self.client.get(f"/api/v1/sia-licenses/{licence.id}/document/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["code"], "document_missing")

    def test_a_document_url_outside_the_officers_directory_is_not_served(self):
        target = sia_documents.store(png(), self.colleague.id, ".png")
        relative = target.split("sia_licenses/", 1)[1]
        licence = self._licence(
            document_url=f"http://testserver/api/v1/sia-license-documents/{relative}",
        )
        self.client.force_authenticate(user=self.manager)

        response = self.client.get(f"/api/v1/sia-licenses/{licence.id}/document/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["code"], "document_missing")

    def test_has_document_is_in_the_licence_list_and_the_staff_profile(self):
        self.client.force_authenticate(user=self.manager)
        self._create_with_card(png())

        listing = self.client.get(f"/api/v1/sia-licenses/?staff_profile={self.profile.id}").json()
        rows = listing["results"] if isinstance(listing, dict) else listing
        profile = self.client.get(f"/api/v1/staff-profiles/{self.profile.id}/").json()

        self.assertTrue(rows[0]["has_document"])
        self.assertTrue(profile["sia_licenses"][0]["has_document"])

    # ── Removal ─────────────────────────────────────────────────────────────

    def test_deleting_a_licence_removes_its_card(self):
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())
        key = self._stored_key(SIALicense.objects.get(id=created.data["id"]))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/v1/sia-licenses/{created.data['id']}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(default_storage.exists(key))

    def test_erasing_an_officer_removes_their_cards(self):
        """The account hard-delete cascades through the staff profile."""
        self.client.force_authenticate(user=self.manager)
        created = self._create_with_card(png())
        key = self._stored_key(SIALicense.objects.get(id=created.data["id"]))

        with self.captureOnCommitCallbacks(execute=True):
            self.profile.delete()

        self.assertFalse(default_storage.exists(key))

    def test_deleting_a_licence_never_deletes_a_file_outside_its_officers_directory(self):
        target = sia_documents.store(png(), self.colleague.id, ".png")
        relative = target.split("sia_licenses/", 1)[1]
        licence = self._licence(
            document_url=f"http://testserver/api/v1/sia-license-documents/{relative}",
        )

        with self.captureOnCommitCallbacks(execute=True):
            licence.delete()

        self.assertTrue(default_storage.exists(target))
