"""
Who can read an officer's licence scan — P1-8.

The upload endpoint is genuinely well built: magic-byte validation, a 10 MB
cap, a MIME allowlist, filename sanitisation. Serving was the gap. Files
landed in a shared `sia_licenses/` prefix under the sanitised *original*
filename — `John_Smith_SIA_Licence.pdf` — and the endpoint returned a bare
`MEDIA_URL` with no authentication and no ownership check. Anyone with the
link, or willing to guess a colleague's name, could read an identity document.

Two changes: unguessable stored names in a per-owner directory, and an
authenticated view that checks entitlement. The per-owner directory is what
the view authorises against, because a document is uploaded before the licence
record that would otherwise identify its owner exists.
"""
import io

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, UserCompanyMembership

User = get_user_model()

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


class SIALicenceDocumentAccessTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Doc Co", registration_number="DOC001",
        )
        self.other_company = SecurityCompany.objects.create(
            name="Other Doc Co", registration_number="DOC002",
        )
        self.owner = self._user("doc_owner", "staff", self.company)
        self.colleague = self._user("doc_colleague", "staff", self.company)
        self.manager = self._user("doc_manager", "manager", self.company)
        self.outsider_manager = self._user(
            "doc_outsider", "manager", self.other_company,
        )
        self.client = APIClient()
        self._written = []

    def tearDown(self):
        for path in self._written:
            if default_storage.exists(path):
                default_storage.delete(path)

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

    def _upload_as_owner(self):
        self.client.force_authenticate(user=self.owner)
        upload = io.BytesIO(PNG_BYTES)
        upload.name = "John Smith SIA Licence.png"
        response = self.client.post(
            "/api/v1/upload/",
            {"file": upload}, format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        url = response.data["url"]
        relative = url.split("/api/v1/sia-license-documents/", 1)[1]
        self._written.append(f"sia_licenses/{relative}")
        return url, relative

    def test_the_stored_name_does_not_contain_the_original_filename(self):
        _, relative = self._upload_as_owner()

        self.assertNotIn("John", relative)
        self.assertNotIn("Smith", relative)
        self.assertNotIn("Licence", relative)
        self.assertTrue(
            relative.startswith(f"{self.owner.id}/"),
            f"expected a per-owner directory, got {relative}",
        )

    def test_the_returned_url_is_not_a_bare_media_url(self):
        url, _ = self._upload_as_owner()

        self.assertIn("/api/v1/sia-license-documents/", url)
        self.assertNotIn("/media/sia_licenses/", url)

    def test_the_owner_can_read_their_own_document(self):
        _, relative = self._upload_as_owner()

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(response.streaming_content), PNG_BYTES)

    def test_a_colleague_cannot_read_it(self):
        _, relative = self._upload_as_owner()
        self.client.force_authenticate(user=self.colleague)

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_their_manager_can_read_it(self):
        _, relative = self._upload_as_owner()
        self.client.force_authenticate(user=self.manager)

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_a_manager_at_another_company_cannot(self):
        _, relative = self._upload_as_owner()
        self.client.force_authenticate(user=self.outsider_manager)

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_an_anonymous_request_is_rejected(self):
        _, relative = self._upload_as_owner()
        self.client.force_authenticate(user=None)

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_path_traversal_is_refused(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.get(
            "/api/v1/sia-license-documents/../../etc/passwd"
        )

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_a_legacy_flat_document_with_no_owner_is_refused(self):
        """Fails closed when nothing establishes who a document belongs to."""
        path = "sia_licenses/Legacy_Licence.png"
        default_storage.save(path, ContentFile(PNG_BYTES))
        self._written.append(path)
        self.client.force_authenticate(user=self.colleague)

        response = self.client.get(
            "/api/v1/sia-license-documents/Legacy_Licence.png"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_legacy_document_resolves_its_owner_through_the_licence_row(self):
        """Documents uploaded before this change still reach their owner."""
        from datetime import date, timedelta

        from api.models import SIALicense, StaffProfile

        path = default_storage.save(
            "sia_licenses/Old_Licence.png", ContentFile(PNG_BYTES),
        )
        self._written.append(path)
        relative = path.split("sia_licenses/", 1)[1]
        profile = StaffProfile.objects.create(
            user=self.owner, phone_number="07700900000",
            date_of_birth=date(1990, 1, 1), street="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK",
        )
        SIALicense.objects.create(
            staff_profile=profile, license_number="1234567890123456",
            license_type="ds", issue_date=date.today(),
            expiry_date=date.today() + timedelta(days=365),
            status="valid",
            document_url=f"http://testserver/api/v1/sia-license-documents/{relative}",
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(f"/api/v1/sia-license-documents/{relative}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
