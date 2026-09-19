"""
Tenancy ratchet — AUDIT-2026-09-17 ENG-010.

Tenancy here is enforced by hand in every ViewSet: there is no base model,
default manager or row-level security. The P0s in the audit were not one bug
but one missing invariant, broken in several places, and nothing objected when
a new ViewSet was written without it.

This test objects. It walks every router the API mounts, builds each
ViewSet's `list` queryset for an **admin with no company membership** — the
account the fail-open helpers used to treat as "no filter" — and requires the
result to be empty, a refusal, or restricted to that user's own rows.

Anything else is an offender. Known offenders are listed below with the reason
each is acceptable or the phase that will fix it. The test fails when:

- a ViewSet not on the list offends (a new unscoped queryset), or
- a listed ViewSet no longer offends (it was fixed — delete its entry, so the
  list only ever shrinks).
"""
from django.contrib.auth import get_user_model
from django.core.exceptions import EmptyResultSet
from django.db.models.query import QuerySet
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory, APITestCase

User = get_user_model()


# ViewSet class name -> why it may return rows to a membership-less admin.
# "global": platform reference data with no tenant owner — correct as is.
# "phase 2": a tenant leak the audit roadmap schedules for Phase 2.
KNOWN_UNSCOPED = {
    # Global reference data — no tenant owns these rows.
    "HolidayViewSet": "global: public holidays",
    "LeavePolicyViewSet": "global: policies hang off platform-wide LeaveTypes",
    "DeputyConfigViewSet": "global: IsAdminUser (platform staff); no company FK",
    "WorkingHoursRegulationViewSet": "global: per-country statutory rules; writes are platform staff only",
    "ComplianceProfileViewSet": "global: profile templates; each company chooses its own (set_active)",
    "ReportTemplateViewSet": "global: authored by platform staff; executing their SQL is staff-only",
    "LeaveTypeViewSet": "global: leave types are platform-wide (unique name) — audit, data integrity",
    "AccountingProviderViewSet": "global: the accounting provider registry",
    # No list to leak.
    "RecruitmentApplicationPublicViewSet": "POST-only public application form (http_method_names)",
    "LeaveReportsViewSet": "list() is overridden and reads scoped_leave_requests()",
    # Real, lower-severity gaps scheduled by the audit roadmap.
    "BlackoutPeriodsViewSet": (
        "platform staff only in practice: leave_management's AdminOnlyPermission reads "
        "`user.profile.role`, which StaffProfile doesn't have, so only is_staff/superuser "
        "pass. Must be scoped by venue__company before that permission is fixed."
    ),
}


def _routers():
    from api.urls import router as api_router
    from finance_integrations.urls import router as finance_router
    from leave_management.urls import router as leave_router
    from shifts.urls import router as shifts_router
    for router in (api_router, shifts_router, leave_router, finance_router):
        yield from router.registry


def _is_empty_or_own(queryset, user):
    """True when the queryset can only hold nothing, or the user's own rows."""
    try:
        sql, params = queryset.query.sql_with_params()
    except EmptyResultSet:
        return True
    # A filter on the requesting user's own id is a legitimate scope ("my shifts").
    return user.pk in params


class TenancyRatchetTests(APITestCase):
    def setUp(self):
        # role='admin' takes every role-branching get_queryset down its most
        # permissive path; no membership means no company resolves.
        self.outsider = User.objects.create_user(
            username="ratchet_outsider", email="ratchet@test.test",
            password="x", role="admin",
        )

    def _list_queryset(self, viewset_class):
        factory = APIRequestFactory()
        django_request = factory.get("/")
        django_request.user = self.outsider
        request = Request(django_request)
        request.user = self.outsider
        view = viewset_class()
        view.action = "list"
        view.request = request
        view.args = ()
        view.kwargs = {}
        view.format_kwarg = None
        return view.get_queryset()

    def test_no_viewset_returns_other_tenants_rows_to_an_account_without_a_company(self):
        offenders = {}
        for _prefix, viewset_class, _basename in _routers():
            name = viewset_class.__name__
            if not hasattr(viewset_class, "get_queryset"):
                continue  # plain ViewSet: no queryset to inspect
            try:
                queryset = self._list_queryset(viewset_class)
            except APIException:
                continue  # refused outright — fails closed
            except Exception as exc:  # noqa: BLE001 — surface, don't hide
                offenders[name] = f"get_queryset raised {type(exc).__name__}: {exc}"
                continue
            if not isinstance(queryset, QuerySet):
                continue
            if not _is_empty_or_own(queryset, self.outsider):
                offenders[name] = "unscoped"

        new = sorted(set(offenders) - set(KNOWN_UNSCOPED))
        fixed = sorted(set(KNOWN_UNSCOPED) - set(offenders))
        self.assertEqual(
            new, [],
            "These ViewSets return rows to an admin with no company. Scope them "
            "with resolve_request_company and return .none() when it is None — "
            f"or, if the data is genuinely global, add them to KNOWN_UNSCOPED with the reason: {new}",
        )
        self.assertEqual(
            fixed, [],
            f"These ViewSets are now scoped — delete them from KNOWN_UNSCOPED: {fixed}",
        )


def _list_route_names():
    """URL names of every router `list` route, resolvable with reverse()."""
    for _prefix, _viewset, basename in _routers():
        yield f"{basename}-list"


def _rows(payload):
    """The rows in a list response, or None when the shape is not a list."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "data"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return None


class TenancyRatchetOverHttpTests(APITestCase):
    """The same invariant, asserted through the API.

    `get_queryset` inspection cannot see plain ViewSets — the billing facade and
    payroll runs build their querysets in private helpers, which is exactly
    where the fail-open `if company:` lived. So: seed a real tenant, then GET
    every list route as an admin with no company. Every answer must be a
    refusal or empty.
    """

    #: List routes allowed to answer with rows, and why.
    GLOBAL_LISTS = {
        # Reference data readable by any signed-in account.
        "compliance-regulations-list", "compliance-profiles-list",
        "leave-types-list", "leave-policies-list", "holidays-list",
        "bank-holidays-list", "providers-list", "employment-types-list",
        "billing-finance-providers-list", "report-types-list",
    }

    def test_every_list_route_is_empty_for_an_account_without_a_company(self):
        from django.urls import NoReverseMatch, reverse

        from api.tests.test_p0_authz import Tenant

        Tenant("Seeded")  # rows that must not be visible
        outsider = User.objects.create_user(
            username="http_outsider", email="http@test.test", password="x", role="admin",
        )
        self.client.force_authenticate(user=outsider)

        leaks = {}
        for name in _list_route_names():
            if name in self.GLOBAL_LISTS:
                continue
            try:
                url = reverse(name)
            except NoReverseMatch:
                continue
            response = self.client.get(url)
            if response.status_code >= 400:
                continue  # refused or not applicable
            rows = _rows(getattr(response, "data", None))
            if not rows:
                continue
            # "Your own record" is a legitimate answer (e.g. /users/ returns you).
            if all(isinstance(r, dict) and r.get("id") == outsider.pk for r in rows):
                continue
            leaks[name] = f"{len(rows)} row(s) from {url}"

        self.assertEqual(leaks, {}, "List routes returned rows to an account with no company")


# ---------------------------------------------------------------------------
# Write routes an ordinary officer may reach (AUDIT-2026-09-17, Phase 2A)
# ---------------------------------------------------------------------------

_SELF = "self-service: queryset is the officer's own rows"

#: (ViewSet, default write action) an officer passes the permission check on,
#: and why that is acceptable. Anything else reachable is a failure: a new
#: ViewSet whose default writes are open to officers must be argued for here.
OFFICER_WRITABLE = {
    ("UserViewSet", "create"): "registration; closed by REGISTRATION_REQUIRES_INVITE in production",
    ("UserViewSet", "partial_update"): _SELF + "; role/is_active/security_roles read-only for staff",
    ("UserViewSet", "destroy"): _SELF + " (soft delete of own account)",
    ("StaffProfileViewSet", "create"): _SELF,
    ("StaffProfileViewSet", "partial_update"): _SELF + "; is_approved, pay_frequency, employment type locked",
    ("EmergencyContactViewSet", "create"): "OwnProfileRowsMixin: own profile only",
    ("EmergencyContactViewSet", "partial_update"): "OwnProfileRowsMixin: own profile only",
    ("EmergencyContactViewSet", "destroy"): _SELF,
    ("BankDetailsViewSet", "create"): _SELF,
    ("BankDetailsViewSet", "partial_update"): _SELF + "; staff_profile read-only",
    ("BankDetailsViewSet", "destroy"): _SELF,
    ("SIALicenseViewSet", "create"): "own profile forced; status server-derived as pending",
    ("StaffAvailabilityViewSet", "create"): "OwnProfileRowsMixin: own profile only",
    ("StaffAvailabilityViewSet", "partial_update"): "OwnProfileRowsMixin: own profile only",
    ("StaffAvailabilityViewSet", "destroy"): _SELF,
    ("VenueTermsAcceptanceViewSet", "create"): "staff_user forced to the caller",
    ("PreferredVenueViewSet", "create"): "OwnProfileRowsMixin: own profile, own company's venue",
    ("PreferredVenueViewSet", "partial_update"): "OwnProfileRowsMixin: own profile, own company's venue",
    ("PreferredVenueViewSet", "destroy"): _SELF,
    ("FireExitCheckViewSet", "create"): "officers record checks; shift ownership validated, fields server-stamped",
    ("CapacityCheckViewSet", "create"): "officers record checks; shift ownership validated, fields server-stamped",
    ("ToiletCheckViewSet", "create"): "officers record checks; shift ownership validated, fields server-stamped",
    ("CapacityLogbookSignoffViewSet", "create"): "shift-group members sign off; venue checked against the group",
    ("IncidentReportViewSet", "create"): "officers report; venue/shift checked against their company and shifts",
    ("ShiftExchangeViewSet", "create"): "own shift, same-company colleague; status forced pending",
    ("ShiftExchangeViewSet", "partial_update"): "update() raises 405",
    ("ShiftExchangeViewSet", "destroy"): "destroy() raises 405",
    ("OpenShiftRequestViewSet", "create"): "release_to_pool on the caller's own shift",
    ("OpenShiftRequestViewSet", "partial_update"): "update() raises 405",
    ("OpenShiftRequestViewSet", "destroy"): "destroy() raises 405",
    ("RecruitmentApplicationPublicViewSet", "create"): "public job application form",
    ("ReportJobViewSet", "create"): _SELF,
    ("ReportJobViewSet", "partial_update"): _SELF,
    ("ReportJobViewSet", "destroy"): _SELF,
    ("SNSDeviceTokenViewSet", "create"): "own push token",
    ("SNSDeviceTokenViewSet", "partial_update"): "own push token",
    ("SNSDeviceTokenViewSet", "destroy"): "own push token",
    ("NotificationPreferencesViewSet", "partial_update"): "own preferences object",
    ("ContractorUnavailabilityViewSet", "create"): _SELF,
    ("ContractorUnavailabilityViewSet", "partial_update"): "owner checked; staff_user pinned on update",
    ("ContractorUnavailabilityViewSet", "destroy"): "owner checked",
    ("LeaveRequestViewSet", "create"): "staff_user forced to the caller",
    ("LeaveRequestViewSet", "partial_update"): "own request, and only while draft/pending",
    ("LeaveRequestViewSet", "destroy"): "own request, and only while draft/pending",
    ("BankHolidayViewSet", "create"): "perform_* rejects non-admins",
    ("BankHolidayViewSet", "partial_update"): "perform_* rejects non-admins",
    ("BankHolidayViewSet", "destroy"): "perform_* rejects non-admins",
    ("StaffLeaveDailyRateViewSet", "create"): "queryset is empty for staff and perform_* rejects them",
    ("StaffLeaveDailyRateViewSet", "partial_update"): "queryset is empty for staff and perform_* rejects them",
    ("StaffLeaveDailyRateViewSet", "destroy"): "queryset is empty for staff and perform_* rejects them",
    ("ClientInvoiceViewSet", "create"): "get_queryset and perform_create raise for non-managers",
    ("ClientInvoiceViewSet", "partial_update"): "get_queryset raises for non-managers",
    ("ClientInvoiceViewSet", "destroy"): "get_queryset raises for non-managers",
}


class WriteRouteRatchetTests(APITestCase):
    """No default write route is open to an officer unless it is argued for above.

    The audit's pattern: a ViewSet gates its custom action (`approve`,
    `resolve`) and leaves the default PATCH/DELETE beside it open. This walks
    every router as a `role='staff'` user and lists the default writes whose
    permission checks pass. The list must match OFFICER_WRITABLE exactly — a
    new open write fails until it is gated or justified, and a fixed one fails
    until its entry is removed.
    """

    WRITES = (("create", "post"), ("partial_update", "patch"), ("destroy", "delete"))

    def test_officer_writable_routes_are_exactly_the_justified_ones(self):
        officer = User(username="ratchet_officer", role="staff")
        officer.pk = 10 ** 9
        factory = APIRequestFactory()
        found = set()
        for _prefix, viewset_class, _basename in _routers():
            allowed = [m.lower() for m in getattr(viewset_class, "http_method_names", [])]
            for action, verb in self.WRITES:
                if not hasattr(viewset_class, action) or verb not in allowed:
                    continue
                request = Request(getattr(factory, verb)("/"))
                request.user = officer
                request._request.user = officer
                view = viewset_class()
                view.action, view.request, view.args, view.kwargs = action, request, (), {}
                view.format_kwarg = None
                if all(p.has_permission(request, view) for p in view.get_permissions()):
                    found.add((viewset_class.__name__, action))

        self.assertEqual(
            sorted(found - set(OFFICER_WRITABLE)), [],
            "These default writes are open to an officer with no recorded reason. "
            "Gate them (ManagerOnlyWritesMixin) or justify them in OFFICER_WRITABLE.",
        )
        self.assertEqual(
            sorted(set(OFFICER_WRITABLE) - found), [],
            "These are no longer open to officers — delete their OFFICER_WRITABLE entries.",
        )
