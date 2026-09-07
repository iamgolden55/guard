"""
Who may move a geofence — P0-6.

`VenueViewSet.get_permissions` had a docstring saying "only admin users can
create, update or delete venues" over an `if`/`else` whose two branches were
identical — both `[IsAuthenticated]`. The docstring described an intent that
method did not implement.

The rule *was* being applied, though — by hand, inside `create`, `update` and
`destroy`, each of which returns 403 for `role != 'admin'`. So the exploit the
audit predicted was not live: a staff account already got 403, not a 404 from
an empty queryset. What was real is that the declarative gate enforced nothing
(a verb added to this ViewSet later would have started open) and that geofence
changes were not audited at all. These tests pin both, and they assert on the
403 rather than on an empty queryset so they keep holding if the queryset
widens.

`latitude`, `longitude` and `check_radius` are the geofence: move a venue to
someone's home address, or widen `check_radius` to 50 km, and every location
check in the system passes from anywhere thereafter — for every future shift
at that venue. That is why it is worth a declarative gate and an audit row
rather than three hand-written checks and silence.

Note the enforced rule is admin-only, not manager-or-admin. That is stricter
than the remediation plan proposed, and it is what the code already did, so it
is what these tests hold it to.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import AuditLog, SecurityCompany, UserCompanyMembership, Venue

User = get_user_model()


class VenueGeofenceAuthzTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Geofence Co", registration_number="GEO001",
        )
        self.admin = self._user("geo_admin", "admin", "admin")
        self.manager = self._user("geo_manager", "manager", "manager")
        # A staff account that *is* an owner-level member, so the tenant
        # helper resolves a company for them and an empty queryset is not what
        # stops the request. This is the case the permission has to catch.
        self.privileged_staff = self._user("geo_staff_owner", "staff", "owner")
        self.venue = Venue.objects.create(
            company=self.company, name="Geofence Venue", address="1 Test St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="Contact", contact_phone="07700900000",
            contact_email="geo@venue.test", terms_and_conditions="Terms",
            latitude=Decimal("51.454500"), longitude=Decimal("-2.587900"),
            check_radius=100,
        )
        self.client = APIClient()

    def _user(self, username, role, membership_role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role=membership_role,
        )
        return user

    def test_staff_cannot_move_a_venue(self):
        self.client.force_authenticate(user=self.privileged_staff)

        response = self.client.patch(f"/api/v1/venues/{self.venue.id}/", {
            "latitude": "51.900000",
            "longitude": "-1.000000",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.latitude, Decimal("51.454500"))

    def test_staff_cannot_widen_the_check_radius(self):
        self.client.force_authenticate(user=self.privileged_staff)

        response = self.client.patch(
            f"/api/v1/venues/{self.venue.id}/", {"check_radius": 50000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.check_radius, 100)

    def test_staff_cannot_create_or_delete_a_venue(self):
        self.client.force_authenticate(user=self.privileged_staff)

        created = self.client.post("/api/v1/venues/", {
            "company": str(self.company.id), "name": "Rogue Venue",
            "address": "2 Test St", "city": "Bristol", "postal_code": "BS1 1AA",
            "country": "UK", "capacity": 10, "contact_name": "X",
            "contact_phone": "07700900001", "contact_email": "x@venue.test",
            "terms_and_conditions": "Terms",
        }, format="json")
        deleted = self.client.delete(f"/api/v1/venues/{self.venue.id}/")

        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(deleted.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Venue.objects.filter(name="Rogue Venue").exists())
        self.assertTrue(Venue.objects.filter(id=self.venue.id).exists())

    def test_a_manager_cannot_move_a_venue_either(self):
        """Venue writes are admin-only; a manager is not an approver here."""
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            f"/api/v1/venues/{self.venue.id}/", {"check_radius": 50000},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.check_radius, 100)

    def test_admin_can_move_a_venue_and_the_change_is_audited(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(f"/api/v1/venues/{self.venue.id}/", {
            "latitude": "51.500000",
            "check_radius": 250,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.venue.refresh_from_db()
        self.assertEqual(self.venue.latitude, Decimal("51.500000"))
        self.assertEqual(self.venue.check_radius, 250)

        entry = AuditLog.objects.filter(
            action="geofence_change",
            resource_type="Venue",
            resource_id=str(self.venue.id),
        ).first()
        self.assertIsNotNone(entry, "geofence change was not audited")
        self.assertEqual(entry.details["changes"]["check_radius"]["old"], 100)
        self.assertEqual(entry.details["changes"]["check_radius"]["new"], 250)

    def test_an_edit_that_leaves_the_geofence_alone_is_not_logged_as_one(self):
        self.client.force_authenticate(user=self.admin)

        self.client.patch(
            f"/api/v1/venues/{self.venue.id}/", {"name": "Renamed Venue"},
            format="json",
        )

        self.assertFalse(
            AuditLog.objects.filter(action="geofence_change").exists()
        )

    def test_staff_can_still_read_venues(self):
        """Regression guard — the officer's shift detail screen needs this."""
        self.client.force_authenticate(user=self.privileged_staff)

        response = self.client.get(f"/api/v1/venues/{self.venue.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
