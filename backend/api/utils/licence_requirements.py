"""
Which SIA licence a shift role needs, and what to say when an officer lacks it.

One definition for every place that asks: the scheduling preview
(`validate_shift_warnings`), shift create/update responses, the assignment
audit trail, and the check-in alert. Before this, the only mapping lived
inline in one validator, and its warning was surfaced nowhere
(AUDIT-2026-09-17 P0-C).

Policy for this phase is **warn and record, never block** (decision D-B).

What is asserted here is deliberately narrow: each role maps to the licence of
the same name, plus one cross-cover — a door supervisor licence also covers
security guarding. That is the SIA's published position, and it is what the
existing check-in guard (`shifts/test_checkin_window.py`, a DS holder on an SG
shift raises no alert) already encodes; leaving it out would flag a common,
lawful assignment on every roster. Which licence the steward / retail /
static / mobile / event roles require is a business decision awaiting
confirmation; until it is made, those roles produce an `unverifiable_role`
warning rather than being passed silently.
"""
from __future__ import annotations

#: Shift role → licence types that satisfy it.
ROLE_LICENCE_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    'ds': ('ds',),
    # A door supervisor licence also covers security guarding (SIA).
    'sg': ('sg', 'ds'),
    'cctv': ('cctv',),
    'cp': ('cp',),
    'k9': ('k9',),
}

#: Warning types that mean "this assignment needs a human to look at it".
RECORDED_WARNING_TYPES = ('missing_qualification', 'unverifiable_role', 'no_profile')


def _licence_label(licence_type):
    from api.models import SIALicense
    return dict(SIALicense.LICENSE_TYPE_CHOICES).get(licence_type, licence_type)


def licence_warnings(staff_user, required_role, on_date):
    """Warnings for assigning `staff_user` to a `required_role` shift on `on_date`.

    Returns a list of `{type, message, severity}` dicts — the shape
    `validate_shift_warnings` already returns — and never raises: a warning
    must not be the reason an assignment or a check-in fails.
    """
    if staff_user is None or not required_role:
        return []
    try:
        from api.models import SIALicense, StaffProfile

        required = ROLE_LICENCE_REQUIREMENTS.get(required_role)
        if required is None:
            return [{
                'type': 'unverifiable_role',
                'message': (
                    f"No SIA licence is mapped to the '{required_role}' role, so this "
                    "assignment could not be checked. Confirm the officer is licensed "
                    "for this work."
                ),
                'severity': 'warning',
            }]

        profile = StaffProfile.objects.filter(user=staff_user).first()
        if profile is None:
            return [{
                'type': 'no_profile',
                'message': "Officer has no staff profile, so their SIA licence cannot be checked.",
                'severity': 'warning',
            }]

        covered = SIALicense.objects.filter(
            staff_profile=profile,
            license_type__in=required,
            status='valid',
            expiry_date__gte=on_date,
        ).exists()
        if covered:
            return []
        needed = ' or '.join(_licence_label(t) for t in required)
        return [{
            'type': 'missing_qualification',
            'message': f"Officer has no valid {needed} licence for this shift's date.",
            'severity': 'warning',
        }]
    except Exception:  # noqa: BLE001 — see docstring
        import logging
        logging.getLogger(__name__).exception(
            "Could not evaluate licence for user %s role %s", getattr(staff_user, 'pk', None), required_role,
        )
        return []


def licence_warnings_for_shift(shift):
    """`licence_warnings` for a saved or unsaved Shift."""
    if not shift.staff_user_id or not shift.start_time:
        return []
    return licence_warnings(shift.staff_user, shift.required_security_role, shift.start_time.date())
