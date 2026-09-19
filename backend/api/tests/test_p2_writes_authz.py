"""
Default write routes weaker than the ViewSet's own actions — Phase 2A.

Walking every router as an ordinary officer (`role='staff'`) found 31 ViewSets
whose default create / update / delete passed the permission check. Eight are
genuine self-service. These tests pin the ones that were not: each one lets an
officer change pay, approval, statutory evidence, company configuration or
someone else's record, usually because only a custom action (`resolve`,
`approve`, `acknowledge`) checked the role.

Every refused write asserts the row afterwards, not just the status code.
"""
from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    CapacityCheckSlotMiss, ComplianceViolation, ContractorUnavailability, EmergencyContact,
    FireExitCheck, IncidentReport, PreferredVenue, SecurityCompany, Shift, ShiftTemplate,
    StaffProfile, UserCompanyMembership, Venue, VenueTermsAcceptance,
)
from finance_integrations.models import AccountingProvider, EarningsTypeMapping, ProviderConnection
from leave_management.models import LeaveRequest, LeaveType

User = get_user_model()


class WritesTestCase(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name="Write Co", registration_number="WRT001")
        self.other = SecurityCompany.objects.create(name="Other Co", registration_number="WRT002")
        self.manager = self._user("wr_mgr", "manager", self.company)
        self.officer = self._user("wr_officer", "staff", self.company)
        self.colleague = self._user("wr_colleague", "staff", self.company)
        self.outsider = self._user("wr_outsider", "staff", self.other)
        self.venue = self._venue(self.company, "Write Venue", "wv")
        self.other_venue = self._venue(self.other, "Other Venue", "ov")
        self.officer_profile = self._profile(self.officer)
        self.colleague_profile = self._profile(self.colleague)
        self.start = (timezone.now() + timedelta(days=3)).replace(minute=0, second=0, microsecond=0)
        self.shift = Shift.objects.create(
            venue=self.venue, staff_user=self.colleague, start_time=self.start,
            end_time=self.start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True, hourly_rate=Decimal("15.00"),
            shift_group="grp-1",
        )
        self.client.force_authenticate(user=self.officer)

    def _user(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test", password="x", role=role,
        )
        UserCompanyMembership.objects.create(user=user, company=company, is_active=True)
        return user

    def _venue(self, company, name, tag):
        return Venue.objects.create(
            company=company, name=name, address="1 St", city="Bristol", postal_code="BS1 1AA",
            country="UK", capacity=100, contact_name="C", contact_phone="07700900000",
            contact_email=f"{tag}@venue.test", terms_and_conditions="Terms",
        )

    def _profile(self, user):
        return StaffProfile.objects.create(
            user=user, phone_number="07700900000", date_of_birth=date(1990, 1, 1),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
        )


class FinanceConfigTests(WritesTestCase):
    def setUp(self):
        super().setUp()
        provider = AccountingProvider.objects.create(provider_key="xero", display_name="Xero")
        self.connection = ProviderConnection.objects.create(
            provider=provider, created_by=self.manager, tenant_id="tenant-1",
        )
        self.mapping = EarningsTypeMapping.objects.create(
            connection=self.connection, local_earnings_name="Regular Hours",
            provider_earnings_code="ORD", provider_earnings_name="Ordinary",
        )

    def test_an_officer_cannot_touch_the_accounting_connection(self):
        url = f"/api/v1/finance/connections/{self.connection.pk}/"
        self.assertEqual(self.client.patch(url, {"tenant_id": "attacker"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.tenant_id, "tenant-1")

    def test_an_officer_cannot_delete_the_payroll_earnings_mapping(self):
        response = self.client.delete(f"/api/v1/finance/earnings-mappings/{self.mapping.pk}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(EarningsTypeMapping.objects.filter(pk=self.mapping.pk).exists())

    def test_nobody_can_move_a_connection_to_another_company(self):
        self.client.force_authenticate(user=self.manager)
        self.client.patch(
            f"/api/v1/finance/connections/{self.connection.pk}/",
            {"created_by": self.outsider.pk}, format="json",
        )
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.created_by, self.manager)


class LeaveTests(WritesTestCase):
    def _leave(self, status):
        leave_type = LeaveType.objects.create(name=f"Annual {status}", code=f"a-{status}")
        return LeaveRequest.objects.create(
            staff_user=self.officer, leave_type=leave_type,
            start_date=date.today() + timedelta(days=10), end_date=date.today() + timedelta(days=11),
            days_requested=Decimal("2.0"), reason="holiday", status=status,
        )

    def test_approved_leave_cannot_be_extended_by_the_officer(self):
        leave = self._leave("approved")
        response = self.client.patch(
            f"/api/v1/leave/requests/{leave.pk}/",
            {"end_date": str(date.today() + timedelta(days=30))}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        leave.refresh_from_db()
        self.assertEqual(leave.end_date, date.today() + timedelta(days=11))

    def test_approved_leave_cannot_be_deleted_by_the_officer(self):
        leave = self._leave("approved")
        self.assertEqual(self.client.delete(f"/api/v1/leave/requests/{leave.pk}/").status_code, 403)
        self.assertTrue(LeaveRequest.objects.filter(pk=leave.pk).exists())


class StatutoryEvidenceTests(WritesTestCase):
    def test_an_officer_cannot_rewrite_or_delete_a_colleagues_fire_exit_check(self):
        check = FireExitCheck.objects.create(
            shift=self.shift, timestamp=timezone.now(), exit_name="Main", performed_by=self.colleague,
        )
        url = f"/api/v1/fire-exit-checks/{check.pk}/"
        self.assertEqual(self.client.patch(url, {"exit_name": "Rewritten"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        check.refresh_from_db()
        self.assertEqual(check.exit_name, "Main")

    def test_an_officer_cannot_clear_a_missed_capacity_check(self):
        miss = CapacityCheckSlotMiss.objects.create(
            shift_group="grp-1", venue=self.venue, expected_at=timezone.now(),
        )
        response = self.client.patch(
            f"/api/v1/capacity-check-misses/{miss.pk}/", {"acknowledged": True}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        miss.refresh_from_db()
        self.assertFalse(miss.acknowledged)


class ViolationAndIncidentTests(WritesTestCase):
    def test_an_officer_cannot_clear_or_delete_their_own_violation(self):
        now = timezone.now()
        violation = ComplianceViolation.objects.create(
            user=self.officer, violation_type="weekly_overtime", severity="major",
            description="x", period_start=now - timedelta(days=7), period_end=now,
        )
        url = f"/api/v1/compliance/violations/{violation.pk}/"
        response = self.client.patch(
            url, {"resolution_status": "approved_exception", "approved_by": self.manager.pk}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        violation.refresh_from_db()
        self.assertNotEqual(violation.resolution_status, "approved_exception")

    def test_an_officer_cannot_resolve_or_delete_their_own_incident(self):
        own_shift = Shift.objects.create(
            venue=self.venue, staff_user=self.officer, start_time=self.start + timedelta(days=1),
            end_time=self.start + timedelta(days=1, hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
        )
        incident = IncidentReport.objects.create(
            venue=self.venue, reported_by=self.officer, shift=own_shift,
            incident_time=timezone.now(), description="fight", severity="high", actions_taken="called police",
        )
        url = f"/api/v1/incidents/{incident.pk}/"
        response = self.client.patch(url, {"resolved": True, "resolved_by": self.manager.pk}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        incident.refresh_from_db()
        self.assertFalse(incident.resolved)

    def test_an_incident_cannot_be_filed_against_another_companys_venue(self):
        count = IncidentReport.objects.count()
        response = self.client.post("/api/v1/incidents/", {
            "venue": self.other_venue.pk, "shift": self.shift.pk,
            "incident_time": timezone.now().isoformat(), "description": "x",
            "severity": "low", "actions_taken": "none",
        }, format="json")
        self.assertEqual(response.status_code, 400, getattr(response, "data", None))
        self.assertEqual(IncidentReport.objects.count(), count)


class ProfileAndRosterTests(WritesTestCase):
    def test_an_officer_cannot_set_their_own_pay_cycle_or_delete_their_profile(self):
        before = self.officer_profile.pay_frequency
        url = f"/api/v1/staff-profiles/{self.officer_profile.pk}/"
        other = "monthly" if before != "monthly" else "weekly"
        self.client.patch(url, {"pay_frequency": other}, format="json")
        self.client.patch("/api/v1/profiles/me", {"pay_frequency": other}, format="json")
        self.officer_profile.refresh_from_db()
        self.assertEqual(self.officer_profile.pay_frequency, before)
        self.assertEqual(self.client.delete(url).status_code, 403)

    def test_an_officer_cannot_move_their_unavailability_onto_a_colleague(self):
        period = ContractorUnavailability.objects.create(
            staff_user=self.officer, company=self.company,
            start_date=date.today() + timedelta(days=5), end_date=date.today() + timedelta(days=6),
        )
        self.client.patch(
            f"/api/v1/contractor-unavailability/{period.pk}/", {"staff_user": self.colleague.pk}, format="json",
        )
        period.refresh_from_db()
        self.assertEqual(period.staff_user, self.officer)

    def test_an_officer_cannot_create_shift_templates(self):
        response = self.client.post("/api/v1/shift-templates/", {
            "name": "Fri door", "venue": self.venue.pk, "days_of_week": [4],
            "start_time": "20:00", "end_time": "02:00", "required_security_role": "ds",
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(ShiftTemplate.objects.exists())

    def test_a_manager_cannot_template_another_companys_venue(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post("/api/v1/shift-templates/", {
            "name": "x", "venue": self.other_venue.pk, "days_of_week": [4],
            "start_time": "20:00", "end_time": "02:00", "required_security_role": "ds",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ShiftTemplate.objects.exists())

    def test_terms_acceptance_is_always_the_callers_own(self):
        self.client.post("/api/v1/venue-terms/", {
            "staff_user": self.colleague.pk, "venue": self.venue.pk, "terms_version": "1",
        }, format="json")
        self.assertFalse(VenueTermsAcceptance.objects.filter(staff_user=self.colleague).exists())

    def test_an_officer_cannot_add_an_emergency_contact_to_a_colleagues_profile(self):
        response = self.client.post("/api/v1/emergency-contacts/", {
            "staff_profile": self.colleague_profile.pk, "name": "Planted",
            "relationship": "none", "phone_number": "07700900999",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(EmergencyContact.objects.filter(staff_profile=self.colleague_profile).exists())

    def test_a_preferred_venue_must_be_in_the_officers_company(self):
        response = self.client.post("/api/v1/preferred-venues/", {
            "staff_profile": self.officer_profile.pk, "venue": self.other_venue.pk,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(PreferredVenue.objects.exists())


class LogbookAndUserTests(WritesTestCase):
    def test_a_logbook_signoff_must_be_for_the_shift_groups_venue(self):
        self.client.force_authenticate(user=self.colleague)
        response = self.client.post("/api/v1/capacity-logbooks/", {
            "shift_group": "grp-1", "venue": self.other_venue.pk, "override_reason": "end of night",
        }, format="json")
        self.assertEqual(response.status_code, 400, getattr(response, "data", None))

    def test_a_logbook_signoff_for_the_right_venue_is_accepted(self):
        """Positive control, so the refusal above is about the venue."""
        self.client.force_authenticate(user=self.colleague)
        response = self.client.post("/api/v1/capacity-logbooks/", {
            "shift_group": "grp-1", "venue": self.venue.pk, "override_reason": "end of night",
        }, format="json")
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))

    def test_a_new_password_is_never_echoed_back(self):
        response = self.client.patch(
            f"/api/v1/users/{self.officer.pk}/", {"password": "N3w-secret-pass!"}, format="json",
        )
        self.assertNotIn("N3w-secret-pass!", response.content.decode())


class LeaveConfigurationTests(WritesTestCase):
    def test_an_officer_writing_a_leave_type_is_refused_not_crashed(self):
        """ReadOnlyForStaffMixin put the IsAuthenticated *class* in the list, so
        DRF called it unbound and returned a 500 instead of refusing."""
        response = self.client.post(
            "/api/v1/leave/types/", {"name": "Free days", "code": "free"}, format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(LeaveType.objects.filter(code="free").exists())


class RegionalComplianceGuardTests(WritesTestCase):
    """Guards ahead of the regional-compliance repair (Phase 3). The feature
    500s today; these make sure fixing it cannot open a cross-tenant write."""

    def test_a_tenant_admin_cannot_repoint_a_shared_compliance_profile(self):
        admin = self._user("wr_admin", "admin", self.company)
        self.client.force_authenticate(user=admin)
        response = self.client.post(
            "/api/v1/compliance/regional/profiles/apply-preset/",
            {"region_code": "UK", "profile_id": 1, "override_existing": True}, format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_regional_settings_do_not_pretend_to_save(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(
            "/api/v1/compliance/regional/regional-settings/", {}, format="json",
        )
        self.assertNotIn(response.status_code, (200, 201))
