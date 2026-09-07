"""
Self-certification of qualifications — P0-4 and P0-5.

These two are one attack, not two. `SIALicenseViewSet` was a `ModelViewSet`
with `permission_classes = [IsAuthenticated]` and a `fields = '__all__'`
serialiser, so `status` and `expiry_date` were client-writable: an officer with
no licence could POST one as `status='valid'` and pass
`StaffProfile.is_eligible_for_shifts()`. `UserSerializer` correctly froze
`role` and `is_active` but left `security_roles` writable, so the same officer
could PATCH themselves qualified for every security role
`Shift.required_security_role` gates on.

Together that removes the qualification model entirely: a self-issued licence
plus self-granted competencies, and the officer is deployed to a client site
with Mead Security believing the system verified them. Under the Private
Security Industry Act the exposure sits with the company, which is why this
outranks the financial findings.

The staff submission journey is preserved — an officer still enters their
licence details and uploads a document; the record simply lands `pending` and
only an approver moves it to `valid`.
"""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    AuditLog, SIALicense, SecurityCompany, StaffProfile, UserCompanyMembership,
)

User = get_user_model()

VALID_SIA_NUMBER = "1234567890123456"


class SIALicenceAuthzTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="SIA Co", registration_number="SIA001",
        )
        self.manager = self._user("sia_manager", "manager")
        self.staff = self._user("sia_staff", "staff")
        self.profile = self._profile(self.staff)
        self.client = APIClient()

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def _profile(self, user):
        profile, _ = StaffProfile.objects.get_or_create(
            user=user,
            defaults=dict(
                phone_number="07700900000",
                date_of_birth=date(1990, 1, 1),
                street="1 Test St", city="Bristol",
                postal_code="BS1 1AA", country="UK",
            ),
        )
        profile.is_approved = True
        profile.save()
        return profile

    def _licence(self, **overrides):
        defaults = dict(
            staff_profile=self.profile,
            license_number=VALID_SIA_NUMBER,
            license_type="ds",
            issue_date=date.today() - timedelta(days=365),
            expiry_date=date.today() + timedelta(days=365),
            status="valid",
        )
        defaults.update(overrides)
        return SIALicense.objects.create(**defaults)

    # ── P0-4 ────────────────────────────────────────────────────────────────

    def test_staff_cannot_self_issue_a_valid_licence(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post("/api/v1/sia-licenses/", {
            "staff_profile": self.profile.id,
            "license_number": VALID_SIA_NUMBER,
            "license_type": "ds",
            "issue_date": str(date.today()),
            "expiry_date": str(date.today() + timedelta(days=365)),
            "status": "valid",
        }, format="json")

        # The submission journey is preserved, so a 201 is fine — what must not
        # happen is the record landing valid and conferring eligibility.
        if response.status_code == status.HTTP_201_CREATED:
            licence = SIALicense.objects.get(id=response.data["id"])
            self.assertEqual(licence.status, "pending")
        else:
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.assertFalse(SIALicense.objects.filter(
            staff_profile=self.profile, status="valid",
        ).exists())
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.is_eligible_for_shifts())

    def test_staff_cannot_extend_their_own_expired_licence(self):
        licence = self._licence(
            status="expired", expiry_date=date.today() - timedelta(days=1),
        )
        self.client.force_authenticate(user=self.staff)

        response = self.client.patch(f"/api/v1/sia-licenses/{licence.id}/", {
            "expiry_date": str(date.today() + timedelta(days=365)),
            "status": "valid",
        }, format="json")

        licence.refresh_from_db()
        self.assertEqual(licence.expiry_date, date.today() - timedelta(days=1))
        self.assertEqual(licence.status, "expired")
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_staff_cannot_delete_a_licence(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.staff)

        response = self.client.delete(f"/api/v1/sia-licenses/{licence.id}/")

        self.assertTrue(SIALicense.objects.filter(id=licence.id).exists())
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_a_licence_number_must_be_sixteen_digits(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.post("/api/v1/sia-licenses/", {
            "staff_profile": self.profile.id,
            "license_number": "NOT-A-LICENCE",
            "license_type": "ds",
            "issue_date": str(date.today()),
            "expiry_date": str(date.today() + timedelta(days=365)),
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_number", response.data)

    def test_approval_flips_eligibility(self):
        """Regression guard — the approver path must still work end to end."""
        self.client.force_authenticate(user=self.staff)
        created = self.client.post("/api/v1/sia-licenses/", {
            "staff_profile": self.profile.id,
            "license_number": VALID_SIA_NUMBER,
            "license_type": "ds",
            "issue_date": str(date.today()),
            "expiry_date": str(date.today() + timedelta(days=365)),
        }, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        licence_id = created.data["id"]
        self.assertFalse(self.profile.is_eligible_for_shifts())

        self.client.force_authenticate(user=self.manager)
        approved = self.client.post(f"/api/v1/sia-licenses/{licence_id}/approve/")

        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)
        licence = SIALicense.objects.get(id=licence_id)
        self.assertEqual(licence.status, "valid")
        self.assertEqual(licence.verified_by, self.manager)
        self.assertIsNotNone(licence.verified_at)
        self.assertTrue(self.profile.is_eligible_for_shifts())

    def test_an_expired_licence_confers_no_eligibility(self):
        """Regression guard on the gate itself."""
        self._licence(status="valid", expiry_date=date.today() - timedelta(days=1))
        self.assertFalse(self.profile.is_eligible_for_shifts())

    def test_approving_an_already_expired_licence_does_not_make_it_valid(self):
        licence = self._licence(
            status="pending", expiry_date=date.today() - timedelta(days=1),
        )
        self.client.force_authenticate(user=self.manager)

        self.client.post(f"/api/v1/sia-licenses/{licence.id}/approve/")

        licence.refresh_from_db()
        self.assertEqual(licence.status, "expired")
        self.assertFalse(self.profile.is_eligible_for_shifts())

    def test_manager_can_still_correct_licence_dates(self):
        """Regression guard — this is what the admin staff drawer PATCHes."""
        licence = self._licence()
        self.client.force_authenticate(user=self.manager)
        new_expiry = date.today() + timedelta(days=730)

        response = self.client.patch(f"/api/v1/sia-licenses/{licence.id}/", {
            "issue_date": str(date.today()),
            "expiry_date": str(new_expiry),
            "license_type": "sg",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        licence.refresh_from_db()
        self.assertEqual(licence.expiry_date, new_expiry)
        self.assertEqual(licence.license_type, "sg")

    def test_staff_can_still_read_their_own_licences(self):
        licence = self._licence()
        self.client.force_authenticate(user=self.staff)

        response = self.client.get("/api/v1/sia-licenses/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertIn(licence.id, [row["id"] for row in rows])


class SecurityRolesAuthzTests(APITestCase):
    """P0-5 — `security_roles` gates shift claiming; it is not self-service."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Roles Co", registration_number="ROLE001",
        )
        self.manager = User.objects.create_user(
            username="roles_manager", email="roles_manager@test.test",
            password="testpass123", role="manager",
        )
        self.staff = User.objects.create_user(
            username="roles_staff", email="roles_staff@test.test",
            password="testpass123", role="staff", security_roles=["sg"],
        )
        for user, role in ((self.manager, "manager"), (self.staff, "staff")):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True, role=role,
            )
        self.client = APIClient()

    def test_staff_cannot_grant_themselves_security_roles(self):
        self.client.force_authenticate(user=self.staff)

        self.client.patch(f"/api/v1/users/{self.staff.id}/", {
            "security_roles": ["ds", "cctv", "cp", "k9"],
        }, format="json")

        self.staff.refresh_from_db()
        self.assertEqual(self.staff.security_roles, ["sg"])
        self.assertFalse(self.staff.has_security_role("cp"))

    def test_manager_change_is_recorded_in_the_audit_log(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(f"/api/v1/users/{self.staff.id}/", {
            "security_roles": ["sg", "cctv"],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.security_roles, ["sg", "cctv"])
        self.assertTrue(
            AuditLog.objects.filter(
                action="security_roles_change",
                resource_type="User",
                resource_id=str(self.staff.id),
            ).exists(),
            "security_roles change was not audited",
        )
