"""
Tenancy and authorisation P0s from AUDIT-2026-09-17.md.

Every test here reproduces an attack the audit executed against a running
stack. The attackers are the two accounts the audit used:

- a **membership-less** account — what anyone gets from the open signup, and
  what every fail-open `if company:` helper treats as "no filter";
- an ordinary **officer** (`role='staff'`) who is a member of company A.

Assertions on refused writes check the row afterwards, not just the status
code: a 4xx that still wrote is the bug this file exists to catch.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    ClientInvoice,
    ComplianceViolation,
    Invoice,
    PayrollRun,
    ReportJob,
    SecurityCompany,
    Shift,
    StaffProfile,
    Statement,
    UserCompanyMembership,
    Venue,
    WorkingHoursMetrics,
)

User = get_user_model()

TODAY = date.today()


class Tenant:
    """A company with an admin, a manager, two officers and one of everything billable."""

    def __init__(self, tag):
        self.tag = tag
        self.company = SecurityCompany.objects.create(
            name=f"{tag} Security", registration_number=f"REG-{tag}",
        )
        self.admin = self.user("admin")
        self.manager = self.user("manager")
        self.officer = self.user("staff", suffix="officer")
        self.colleague = self.user("staff", suffix="colleague")
        self.venue = Venue.objects.create(
            company=self.company, name=f"{tag} Venue", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email=f"{tag.lower()}@venue.test", terms_and_conditions="Terms",
        )
        self.officer_invoice = self.staff_invoice(self.officer, "1")
        self.colleague_invoice = self.staff_invoice(self.colleague, "2")
        self.client_invoice = ClientInvoice.objects.create(
            company=self.company, venue=self.venue,
            invoice_number=f"CI-{tag}-1", start_date=TODAY - timedelta(days=7),
            end_date=TODAY, client_name=self.venue.name, status="sent",
            total_amount=Decimal("500.00"),
        )
        self.run = PayrollRun.objects.create(
            company=self.company, run_code=f"W1-{tag}", label=f"{tag} run",
            period_start=TODAY - timedelta(days=7), period_end=TODAY,
            process_date=TODAY, status="pending",
        )
        self.statement = Statement.objects.create(
            company=self.company, venue=self.venue,
            statement_number=f"ST-{tag}-1",
            period_start=TODAY - timedelta(days=30), period_end=TODAY,
        )

    def user(self, role, suffix=None):
        username = f"{self.tag.lower()}_{suffix or role}"
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else role,
        )
        return user

    def staff_invoice(self, staff_user, n):
        return Invoice.objects.create(
            staff_user=staff_user, invoice_number=f"PAY-{self.tag}-{n}",
            start_date=TODAY - timedelta(days=7), end_date=TODAY,
            total_hours=Decimal("8.00"), hourly_rate=Decimal("15.00"),
            total_amount=Decimal("120.00"), status="pending",
        )


def snapshot(instance):
    """Every concrete column of a row, freshly read — for 'nothing changed' asserts."""
    fresh = type(instance).objects.get(pk=instance.pk)
    return {f.attname: getattr(fresh, f.attname) for f in fresh._meta.concrete_fields}


class AuthzTestCase(APITestCase):
    def setUp(self):
        self.a = Tenant("A")
        self.b = Tenant("B")
        # What open self-registration hands anyone: an account with no membership.
        self.outsider = User.objects.create_user(
            username="outsider", email="outsider@test.test", password="testpass123",
        )

    def as_user(self, user):
        self.client.force_authenticate(user=user)


# ---------------------------------------------------------------------------
# P0-A / ENG-002 — the billing helpers must fail closed
# ---------------------------------------------------------------------------

class BillingFailClosedTests(AuthzTestCase):
    """A membership-less account read every tenant's payroll (audit: 127 rows)."""

    def test_outsider_lists_no_staff_invoices(self):
        self.as_user(self.outsider)
        response = self.client.get("/api/v1/billing/invoices/?kind=staff")
        self.assertIn(response.status_code, (200, 403))
        if response.status_code == 200:
            self.assertEqual(response.data, [])

    def test_outsider_lists_no_client_invoices(self):
        self.as_user(self.outsider)
        response = self.client.get("/api/v1/billing/invoices/?kind=client")
        self.assertIn(response.status_code, (200, 403))
        if response.status_code == 200:
            self.assertEqual(response.data, [])

    def test_outsider_cannot_mark_another_tenants_invoice_paid(self):
        """Audit S-2: returned 200, emailed the officer, recomputed B's run."""
        before = snapshot(self.b.officer_invoice)
        self.as_user(self.outsider)
        response = self.client.post(
            f"/api/v1/billing/invoices/{self.b.officer_invoice.invoice_number}/mark-paid/", {},
        )
        self.assertIn(response.status_code, (403, 404))
        self.assertEqual(snapshot(self.b.officer_invoice), before)

    def test_outsider_sees_no_payroll_runs(self):
        self.as_user(self.outsider)
        response = self.client.get("/api/v1/payroll/runs/")
        self.assertIn(response.status_code, (200, 403))
        if response.status_code == 200:
            self.assertEqual(response.data, [])
        response = self.client.get(f"/api/v1/payroll/runs/{self.b.run.run_code}/")
        self.assertIn(response.status_code, (403, 404))

    def test_outsider_sees_no_statements(self):
        self.as_user(self.outsider)
        response = self.client.get("/api/v1/billing/statements/")
        self.assertIn(response.status_code, (200, 403))
        if response.status_code == 200:
            rows = response.data.get("results", response.data)
            self.assertEqual(len(rows), 0)

    def test_manager_still_sees_own_company_only(self):
        """The fix must not blind the people who use this screen."""
        self.as_user(self.a.manager)
        response = self.client.get("/api/v1/billing/invoices/?kind=staff")
        self.assertEqual(response.status_code, 200)
        ids = {row["id"] for row in response.data}
        self.assertEqual(ids, {"PAY-A-1", "PAY-A-2"})

        response = self.client.get("/api/v1/billing/invoices/?kind=client")
        self.assertEqual({row["id"] for row in response.data}, {"CI-A-1"})

        response = self.client.get(
            f"/api/v1/billing/invoices/{self.b.officer_invoice.invoice_number}/"
        )
        self.assertEqual(response.status_code, 404)

    def test_an_invoice_number_resolves_only_to_that_invoice(self):
        """`PAY-B-1` used to fall back to "any invoice whose pk is 1" — here, A's
        own PAY-A-1 — so mark-paid on one number could settle a different invoice."""
        self.as_user(self.a.manager)
        bogus = f"PAY-B-{self.a.officer_invoice.pk}"
        response = self.client.get(f"/api/v1/billing/invoices/{bogus}/")
        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# P0-F / ENG-004 — officers must not read or move colleagues' pay
# ---------------------------------------------------------------------------

class BillingRoleGateTests(AuthzTestCase):
    """A role='staff' officer read all 127 invoices and could mutate them."""

    MUTATIONS = [
        ("post", "mark-paid", {}),
        ("post", "reject", {"reason": "x"}),
        ("post", "void", {}),
        ("post", "issue", {}),
        ("post", "recalculate", {}),
        ("post", "edit_shift_rate", {"shift_id": 1, "hourly_rate": "99"}),
        ("patch", "update_note", {"note": "x"}),
        ("post", "remind", {}),
        ("post", "duplicate", {}),
        ("post", "resolve", {}),
        ("post", "email-payslip", {}),
    ]

    def test_officer_cannot_list_colleagues_invoices(self):
        self.as_user(self.a.officer)
        response = self.client.get("/api/v1/billing/invoices/?kind=staff")
        self.assertEqual(response.status_code, 403)

    def test_officer_cannot_read_a_colleagues_invoice(self):
        self.as_user(self.a.officer)
        response = self.client.get(
            f"/api/v1/billing/invoices/{self.a.colleague_invoice.invoice_number}/"
        )
        self.assertEqual(response.status_code, 403)

    def test_officer_cannot_mutate_any_invoice(self):
        self.as_user(self.a.officer)
        for target in (self.a.officer_invoice, self.a.colleague_invoice):
            before = snapshot(target)
            invoice_count = Invoice.objects.count()
            for verb, action, body in self.MUTATIONS:
                with self.subTest(invoice=target.invoice_number, action=action):
                    response = getattr(self.client, verb)(
                        f"/api/v1/billing/invoices/{target.invoice_number}/{action}/",
                        body, format="json",
                    )
                    self.assertEqual(response.status_code, 403)
            self.assertEqual(snapshot(target), before)
            self.assertEqual(Invoice.objects.count(), invoice_count)

    def test_officer_cannot_create_a_client_invoice(self):
        self.as_user(self.a.officer)
        count = ClientInvoice.objects.count()
        response = self.client.post(
            "/api/v1/billing/invoices/from-shifts/",
            {"venueId": self.a.venue.pk, "periodStart": str(TODAY), "periodEnd": str(TODAY)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(ClientInvoice.objects.count(), count)

    def test_officer_cannot_touch_payroll_runs(self):
        self.as_user(self.a.officer)
        self.assertEqual(self.client.get("/api/v1/payroll/runs/").status_code, 403)
        before = snapshot(self.a.run)
        response = self.client.post(f"/api/v1/payroll/runs/{self.a.run.run_code}/regenerate/", {})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(snapshot(self.a.run), before)

    def test_officer_cannot_read_or_create_statements(self):
        self.as_user(self.a.officer)
        self.assertEqual(self.client.get("/api/v1/billing/statements/").status_code, 403)

    def test_manager_can_still_mark_paid(self):
        self.a.officer_invoice.status = "approved"
        self.a.officer_invoice.save(update_fields=["status"])
        self.as_user(self.a.manager)
        response = self.client.post(
            f"/api/v1/billing/invoices/{self.a.officer_invoice.invoice_number}/mark-paid/", {},
        )
        self.assertEqual(response.status_code, 200)
        self.a.officer_invoice.refresh_from_db()
        self.assertEqual(self.a.officer_invoice.status, "paid")


class StatementVenueTenancyTests(AuthzTestCase):
    def test_manager_cannot_attach_another_tenants_venue(self):
        self.as_user(self.a.manager)
        count = Statement.objects.count()
        response = self.client.post(
            "/api/v1/billing/statements/",
            {"venueId": str(self.b.venue.pk), "periodStart": str(TODAY - timedelta(days=30)),
             "periodEnd": str(TODAY)},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Statement.objects.count(), count)


# ---------------------------------------------------------------------------
# S-22 / ENG-005 — create_multi_staff
# ---------------------------------------------------------------------------

class CreateMultiStaffTests(AuthzTestCase):
    URL = "/api/v1/shifts/create_multi_staff/"

    def payload(self, venue, staff, **extra):
        start = timezone.now() + timedelta(days=3)
        body = {
            "venue": venue.pk,
            "staff_users": [u.pk for u in staff],
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=8)).isoformat(),
        }
        body.update(extra)
        return body

    def test_outsider_cannot_create_approved_priced_shifts_in_another_tenant(self):
        """Audit: 201, status approved, £999/h, at company B's venue."""
        self.as_user(self.outsider)
        response = self.client.post(
            self.URL,
            self.payload(self.b.venue, [self.b.officer], status="approved", hourly_rate="999.00"),
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Shift.objects.filter(venue=self.b.venue).exists())

    def test_officer_cannot_create_shifts(self):
        self.as_user(self.a.officer)
        response = self.client.post(self.URL, self.payload(self.a.venue, [self.a.officer]), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Shift.objects.exists())

    def test_manager_cannot_use_another_tenants_venue(self):
        self.as_user(self.a.manager)
        response = self.client.post(self.URL, self.payload(self.b.venue, [self.a.officer]), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Shift.objects.exists())

    def test_manager_cannot_assign_another_tenants_staff(self):
        self.as_user(self.a.manager)
        response = self.client.post(self.URL, self.payload(self.a.venue, [self.b.officer]), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Shift.objects.exists())

    def test_manager_cannot_create_a_shift_already_approved(self):
        self.as_user(self.a.manager)
        response = self.client.post(
            self.URL, self.payload(self.a.venue, [self.a.officer], status="approved"), format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Shift.objects.exists())

    def test_manager_can_still_create_multi_staff_shifts(self):
        self.as_user(self.a.manager)
        response = self.client.post(
            self.URL,
            self.payload(self.a.venue, [self.a.officer, self.a.colleague],
                         status="scheduled", hourly_rate="15.50"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        shifts = Shift.objects.filter(venue=self.a.venue)
        self.assertEqual(shifts.count(), 2)
        self.assertEqual({s.status for s in shifts}, {"scheduled"})
        self.assertEqual({s.hourly_rate for s in shifts}, {Decimal("15.50")})


# ---------------------------------------------------------------------------
# ENG-006 — the two self-grant paths
# ---------------------------------------------------------------------------

class SelfGrantTests(AuthzTestCase):
    def test_officer_cannot_grant_themselves_security_roles(self):
        self.a.officer.security_roles = ["sg"]
        self.a.officer.save(update_fields=["security_roles"])
        self.as_user(self.a.officer)
        self.client.patch("/api/v1/users/me", {"security_roles": ["ds", "cctv", "cp", "k9"]}, format="json")
        self.a.officer.refresh_from_db()
        self.assertEqual(self.a.officer.security_roles, ["sg"])

    def test_officer_cannot_approve_their_own_vetting(self):
        profile = StaffProfile.objects.create(
            user=self.a.officer, phone_number="07700900000", date_of_birth=date(1990, 1, 1),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
            is_approved=False,
        )
        self.as_user(self.a.officer)
        self.client.patch(f"/api/v1/staff-profiles/{profile.pk}/", {"is_approved": True}, format="json")
        profile.refresh_from_db()
        self.assertFalse(profile.is_approved)


# ---------------------------------------------------------------------------
# P0-G — an officer must not be able to create a tenant company
# ---------------------------------------------------------------------------

class OnboardingTenantCreationTests(AuthzTestCase):
    URL = "/api/v1/onboarding/initiate/"
    COMPANY = {
        "company": {
            "name": "Officer Holdings", "registration_number": "REG-NEW",
            "country_code": "GB", "city": "Bristol", "postal_code": "BS1 1AA",
            "address_line_1": "1 St", "billing_email": "x@test.test",
            "primary_contact_name": "X", "primary_contact_email": "x@test.test",
            "primary_contact_phone": "07700900000",
        }
    }

    def test_officer_of_an_existing_company_cannot_create_a_tenant(self):
        self.as_user(self.a.officer)
        count = SecurityCompany.objects.count()
        response = self.client.post(self.URL, self.COMPANY, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(SecurityCompany.objects.count(), count)
        self.a.officer.refresh_from_db()
        self.assertEqual(self.a.officer.role, "staff")

    def test_a_brand_new_signup_can_still_create_their_company(self):
        """The self-serve path the comment on get_permissions was protecting."""
        self.as_user(self.outsider)
        response = self.client.post(self.URL, self.COMPANY, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            UserCompanyMembership.objects.filter(user=self.outsider, is_owner=True).exists()
        )


# ---------------------------------------------------------------------------
# P0-E / ENG-009 — compliance records are per tenant
# ---------------------------------------------------------------------------

class ComplianceTenancyTests(AuthzTestCase):
    def setUp(self):
        super().setUp()
        self.violation_b = self.violation(self.b.officer, "B's officer worked too long")
        self.metrics_b = WorkingHoursMetrics.objects.create(
            user=self.b.officer, period_type="weekly",
            period_start=TODAY - timedelta(days=7), period_end=TODAY,
        )

    def violation(self, user, description):
        now = timezone.now()
        return ComplianceViolation.objects.create(
            user=user, violation_type="weekly_overtime", severity="major",
            description=description,
            period_start=now - timedelta(days=7), period_end=now,
        )

    def test_manager_does_not_see_another_tenants_violations(self):
        self.as_user(self.a.manager)
        response = self.client.get("/api/v1/compliance/violations/")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data)
        ids = {str(r["id"]) for r in rows}
        self.assertNotIn(str(self.violation_b.pk), ids)
        response = self.client.get(f"/api/v1/compliance/violations/{self.violation_b.pk}/")
        self.assertEqual(response.status_code, 404)

    def test_manager_cannot_resolve_another_tenants_violation(self):
        before = snapshot(self.violation_b)
        self.as_user(self.a.manager)
        response = self.client.post(
            f"/api/v1/compliance/violations/{self.violation_b.pk}/resolve/",
            {"resolution_notes": "x"}, format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(snapshot(self.violation_b), before)

    def test_manager_does_not_see_another_tenants_working_hours(self):
        self.as_user(self.a.manager)
        response = self.client.get("/api/v1/compliance/metrics/")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data)
        self.assertNotIn(str(self.metrics_b.pk), {str(r["id"]) for r in rows})

    def test_own_tenants_violations_stay_visible(self):
        violation_a = self.violation(self.a.officer, "A's officer")
        self.as_user(self.a.manager)
        rows = self.client.get("/api/v1/compliance/violations/").data
        rows = rows.get("results", rows)
        self.assertIn(str(violation_a.pk), {str(r["id"]) for r in rows})


    def _profiles(self):
        from api.models import ComplianceProfile, WorkingHoursRegulation
        regulation = WorkingHoursRegulation.objects.create(
            country_code="GB", country_name="United Kingdom",
            standard_weekly_hours=Decimal("40.0"), standard_daily_hours=Decimal("8.0"),
            overtime_threshold_hours=Decimal("40.0"), overtime_multiplier_1=Decimal("1.5"),
            max_daily_hours=Decimal("12.0"), max_weekly_hours=Decimal("48.0"),
        )
        live = ComplianceProfile.objects.create(
            name="Live", working_hours_regulation=regulation, is_active=True,
        )
        other = ComplianceProfile.objects.create(
            name="Other", working_hours_regulation=regulation, is_active=False,
        )
        return live, other

    def test_set_active_is_local_to_the_admins_company(self):
        """`set_active` ran `ComplianceProfile.objects.all().update(is_active=False)`.
        Its action-level IsAdminUser was silently discarded by the ViewSet's own
        get_permissions(), so any authenticated account switched every tenant's
        profile. Now it chooses the profile for the admin's own company."""
        live, other = self._profiles()
        self.as_user(self.a.admin)
        response = self.client.post(f"/api/v1/compliance/profiles/{other.pk}/set_active/", {})
        self.assertEqual(response.status_code, 200)

        self.a.company.refresh_from_db()
        self.b.company.refresh_from_db()
        live.refresh_from_db()
        self.assertEqual(self.a.company.compliance_profile_id, other.pk)
        self.assertIsNone(self.b.company.compliance_profile_id)
        self.assertTrue(live.is_active, "the platform default must not move")

        # Each tenant is told its own answer.
        response = self.client.get("/api/v1/compliance/profiles/active/")
        self.assertEqual(response.data["data"]["id"], other.pk)
        self.as_user(self.b.admin)
        response = self.client.get("/api/v1/compliance/profiles/active/")
        self.assertEqual(response.data["data"]["id"], live.pk)

    def test_officers_and_managers_cannot_set_the_active_profile(self):
        live, other = self._profiles()
        for user in (self.a.officer, self.a.manager, self.outsider):
            with self.subTest(user=user.username):
                self.as_user(user)
                response = self.client.post(
                    f"/api/v1/compliance/profiles/{other.pk}/set_active/", {},
                )
                self.assertIn(response.status_code, (403, 404))
        live.refresh_from_db()
        other.refresh_from_db()
        self.a.company.refresh_from_db()
        self.assertTrue(live.is_active)
        self.assertFalse(other.is_active)
        self.assertIsNone(self.a.company.compliance_profile_id)


    def test_tenant_users_cannot_switch_off_a_countrys_regulation(self):
        """Regulations are platform reference data the OT engine reads. The
        `activate`/`deactivate` actions declared IsAdminUser, but the ViewSet's
        get_permissions() discarded it — any account could switch off GB."""
        live, _ = self._profiles()
        regulation = live.working_hours_regulation
        for user in (self.a.officer, self.a.admin):
            with self.subTest(user=user.username):
                self.as_user(user)
                response = self.client.post(
                    f"/api/v1/compliance/regulations/{regulation.pk}/deactivate/", {},
                )
                self.assertEqual(response.status_code, 403)
                regulation.refresh_from_db()
                self.assertTrue(regulation.is_active)


# ---------------------------------------------------------------------------
# S-15 — preview interpolated `limit` into SQL from client input
# ---------------------------------------------------------------------------

class ReportTemplateTests(AuthzTestCase):
    def setUp(self):
        super().setUp()
        from api.models import ReportTemplate
        self.template = ReportTemplate.objects.create(
            name="Hours", template_type="working_hours",
            sql_query="SELECT id, username FROM users",
            created_by=self.a.admin, allowed_roles=["admin", "manager", "staff"],
        )

    def test_tenant_users_cannot_execute_stored_sql(self):
        """The template's SQL has no company predicate; executing it reads every tenant."""
        for user in (self.a.officer, self.a.manager, self.a.admin):
            with self.subTest(role=user.role):
                self.as_user(user)
                response = self.client.post(
                    f"/api/v1/reports/templates/{self.template.pk}/preview/", {}, format="json",
                )
                self.assertEqual(response.status_code, 403)

    def test_limit_is_refused_before_any_sql_runs(self):
        """`limit` was interpolated into the SQL. The injected text executed and
        only then failed a Python type comparison, so the attacker got a 400 and
        a timing side-channel rather than rows — weaker than the audit's framing,
        but still attacker-controlled SQL. It must be refused before execution."""
        from unittest.mock import patch
        platform = User.objects.create_user(
            username="platform", email="p@test.test", password="x", role="admin", is_staff=True,
        )
        self.as_user(platform)
        with patch("api.utils.report_generator.ReportGenerator._execute_query") as execute:
            execute.return_value = []
            response = self.client.post(
                f"/api/v1/reports/templates/{self.template.pk}/preview/",
                {"limit": "(SELECT CASE WHEN (SELECT count(*) FROM users) > 0 THEN 1 ELSE 0 END)"},
                format="json",
            )
        self.assertEqual(response.status_code, 400)
        execute.assert_not_called()


class ReportJobTenancyTests(AuthzTestCase):
    def test_admin_does_not_see_another_tenants_report_jobs(self):
        from api.models import ReportTemplate
        template = ReportTemplate.objects.create(
            name="Hours", template_type="working_hours", sql_query="SELECT 1",
            created_by=self.b.admin, allowed_roles=["admin"],
        )
        now = timezone.now()
        job_b = ReportJob.objects.create(
            template=template, requested_by=self.b.admin, export_format="pdf",
            date_range_start=now - timedelta(days=7), date_range_end=now,
            expires_at=now + timedelta(days=7),
        )
        self.as_user(self.a.admin)
        response = self.client.get("/api/v1/reports/jobs/")
        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data)
        self.assertNotIn(str(job_b.pk), {str(r.get("id", r.get("job_id"))) for r in rows})
        response = self.client.get(f"/api/v1/reports/jobs/{job_b.pk}/")
        self.assertEqual(response.status_code, 404)
