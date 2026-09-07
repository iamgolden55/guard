"""
`fields = '__all__'` is a standing invitation — P3-2.

Two of the P0 findings were mass assignment through `__all__`: an officer could
rewrite their own invoice, and self-certify an SIA licence, because the
serialiser exposed every column the model had and nobody had revisited it when
new columns arrived. That is the failure mode — `__all__` does not exempt the
field you added last week, and nobody reviews a diff that does not mention it.

The audit found 28 of them. The dangerous ones are fixed; the rest were
inspected and each is attached to a ViewSet that gates writes some other way,
so rewriting all of them would be churn with real regression risk and no
proven exposure. What is worth having is a ratchet: this test pins the
existing set, so a *new* `__all__` fails CI and has to be argued for.

To add one deliberately, add it to `ALLOWED` with a note. To remove one,
delete its entry — the test will tell you if you missed a spot.
"""
import inspect
import re
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

SERIALIZER_MODULES = [
    'api/serializers.py',
    'api/serializers_billing.py',
    'api/serializers_frontend.py',
    'shifts/serializers.py',
    'leave_management/serializers.py',
    'finance_integrations/serializers.py',
]

#: Serialisers that still use `__all__`, each reviewed as of this audit.
#: Every one is attached to a ViewSet that gates writes by role, by queryset,
#: or in `perform_create` / `perform_update`. Shrinking this list is welcome;
#: growing it needs a reason.
ALLOWED = {
    'BankDetailsSerializer',
    'BankHolidaySerializer',
    'CapacityCheckSerializer',
    'CapacityCheckSlotMissSerializer',
    'CapacityLogbookSignoffSerializer',
    'ContractorUnavailabilitySerializer',
    'DeputyConfigSerializer',
    'DeputyEmployeeSerializer',
    'DeputyTimesheetSerializer',
    'EmergencyContactSerializer',
    'EmploymentTypeSerializer',
    'FireExitCheckSerializer',
    'InvoiceItemSerializer',
    'OpenShiftRequestSerializer',
    'PayRateSerializer',
    'PreferredVenueSerializer',
    'RecruitmentApplicationSerializer',
    'ShiftExchangeSerializer',
    'ShiftSerializer',
    'ShiftTemplateSerializer',
    'StaffAvailabilitySerializer',
    'StaffLeaveDailyRateSerializer',
    'SystemSettingsSerializer',
    'TimeAdjustmentSerializer',
    'ToiletCheckSerializer',
    'VenueTermsAcceptanceSerializer',
}

CLASS_BLOCK = re.compile(r'class (\w+)\([^)]*\):(.*?)(?=\nclass |\Z)', re.S)


def _serializers_using_all():
    found = set()
    for relative in SERIALIZER_MODULES:
        path = BACKEND_ROOT / relative
        if not path.exists():
            continue
        for name, body in CLASS_BLOCK.findall(path.read_text()):
            if "fields = '__all__'" in body or 'fields = "__all__"' in body:
                found.add(name)
    return found


class MassAssignmentRatchetTests(SimpleTestCase):
    def test_no_new_serialiser_uses_fields_all(self):
        new = _serializers_using_all() - ALLOWED
        self.assertEqual(
            new, set(),
            "New serialiser(s) using fields='__all__': "
            f"{sorted(new)}. Every model column, including the ones added "
            "after this serialiser was written, is now client-writable unless "
            "read_only_fields happens to name it. List the fields explicitly, "
            "or add it to ALLOWED in this file with a reason."
        )

    def test_the_allowlist_has_no_stale_entries(self):
        """A serialiser fixed elsewhere should not stay on the list."""
        stale = ALLOWED - _serializers_using_all()
        self.assertEqual(
            stale, set(),
            f"These no longer use __all__ and can be removed from ALLOWED: "
            f"{sorted(stale)}"
        )

    def test_the_serialisers_fixed_in_this_audit_stay_fixed(self):
        """Invoice and SIA licence are what the P0 findings turned on."""
        current = _serializers_using_all()
        for name in ('InvoiceSerializer', 'SIALicenseSerializer', 'UserSerializer'):
            self.assertNotIn(
                name, current,
                f"{name} is back on fields='__all__'; it was one of the P0 "
                "mass-assignment findings."
            )
