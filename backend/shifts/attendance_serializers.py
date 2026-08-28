"""
Attendance projection serializers.

These project Shift / Venue / User rows into the compact shapes the new
frontend Attendance page (Live / Exceptions / Timesheets tabs + drawer)
consumes — see frontend/src/features/attendance/data/mocks.ts for the
canonical TypeScript definitions.

The page is shape-driven; the goal here is to map our existing data into
the UI's vocabulary (e.g. hour-decimals like 14.5 for 14:30, signed
late_min, RIBBON-friendly status strings) without forcing the UI to
re-derive on the client.
"""

from __future__ import annotations

import math
import zoneinfo
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Iterable

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from api.models import (
    CapacityCheck,
    FireExitCheck,
    SIALicense,
    Shift,
    ToiletCheck,
    User,
    Venue,
)


def _shift_tz(shift: Shift):
    """Resolve the display timezone for a shift.

    Prefers the venue's company TZ (configured per-tenant), falls back to
    Django's TIME_ZONE setting (UTC by default). The settings TIME_ZONE is
    UTC for storage correctness; we localise only at the presentation
    boundary so timeline ribbons / "ACTUAL" panels show the times the
    operator typed in (e.g. 12:20 BST stays 12:20, not 11:20).
    """
    tz_name = None
    try:
        tz_name = shift.venue.company.timezone
    except Exception:
        pass
    if not tz_name:
        return timezone.get_current_timezone()
    try:
        return zoneinfo.ZoneInfo(tz_name)
    except Exception:
        return timezone.get_current_timezone()

# Mapping from DB license_type codes (lowercase) to UI badge codes (uppercase
# four-letter convention used in mocks: DS, SG, CCTV, CP).
SIA_CODE_MAP = {
    "ds": "DS",
    "sg": "SG",
    "cctv": "CCTV",
    "cp": "CP",
    # Fallbacks for k9/vs/key — bucket into closest UI code so badges still render.
    "k9": "SG",
    "vs": "SG",
    "key": "SG",
}


def hour_decimal(dt: datetime | None, tz=None) -> float | None:
    """Convert a datetime to hour-decimal (e.g. 14:30 → 14.5).

    Localises into `tz` (or Django default) before extracting hours so
    a 12:20 BST shift surfaces as 12.33 even though storage is UTC.
    """
    if dt is None:
        return None
    if tz is not None and timezone.is_aware(dt):
        local = dt.astimezone(tz)
    elif timezone.is_aware(dt):
        local = timezone.localtime(dt)
    else:
        local = dt
    return round(local.hour + local.minute / 60 + local.second / 3600, 4)


def _local_date(dt: datetime, tz=None):
    """The calendar date `dt` falls on, in the venue's timezone."""
    if tz is not None and timezone.is_aware(dt):
        return dt.astimezone(tz).date()
    if timezone.is_aware(dt):
        return timezone.localtime(dt).date()
    return dt.date()


def hour_decimal_from(dt: datetime | None, tz=None, anchor: datetime | None = None) -> float | None:
    """Hour-decimal projected into `anchor`'s day frame.

    hour_decimal() collapses a datetime to a time of day, so 03:00 the morning
    after an 18:00 start comes back as 3.0 — behind the start rather than nine
    hours ahead of it. The timeline ribbon and every duration derived from these
    numbers need a monotonic scale, so a datetime one day past the anchor is
    projected to 27.0 instead. This is the same convention `sch_end` already
    uses; it just has to hold for the actual times too.
    """
    if dt is None:
        return None
    hours = hour_decimal(dt, tz)
    if hours is None or anchor is None:
        return hours
    day_offset = (_local_date(dt, tz) - _local_date(anchor, tz)).days
    return round(hours + 24 * day_offset, 4)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres. Mirrors the fallback in Venue.verify_location."""
    r = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)))


def stable_hue(seed: str) -> int:
    """Deterministic 0–359 hue from a string id — used by the UI for avatar/venue tints."""
    h = 0
    for ch in seed:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h % 360


def derive_status(
    shift: Shift,
    now: datetime,
    effective_check_in: datetime | None,
    effective_check_out: datetime | None,
) -> str:
    """Map our internal Shift.status to the AttendanceShift status vocabulary.

    Uses *effective* check-in/out times (with TimeAdjustment overrides applied)
    so that a manager attesting presence flips a no-show into on_duty and the
    UI ribbons / "ACTUAL" panel update correctly.

    Shift.status values: open / scheduled / active / in_progress / pending_approval
    / approved / completed / cancelled / no_show.
    AttendanceShift wants: on_duty / completed / pending_approval / approved
    / no_show / late / early_out / missing_out / upcoming / geofence_fail.
    """
    s = shift.status

    if s == "cancelled":
        return "no_show"

    # Manager-locked states win over check-in derivation: once a shift is
    # approved or completed, the timeline ribbon should show as approved
    # regardless of whether check-out has been recorded.
    if s in ("approved", "completed") and effective_check_in is not None:
        return "approved"

    # If there's an effective check-in, the officer is on-duty / done — the
    # underlying status="no_show" can be overridden by a manager attestation.
    if effective_check_in is not None:
        if effective_check_out is not None:
            if (
                shift.end_time
                and effective_check_out < shift.end_time - timedelta(minutes=5)
            ):
                return "early_out"
            return "pending_approval"
        # Has check-in, no check-out yet
        if shift.end_time and shift.end_time < now:
            return "missing_out"
        return "on_duty"

    if s == "no_show":
        return "no_show"

    if s == "in_progress":
        # In-progress without an effective check-in is unusual; treat as on-duty.
        if shift.end_time and shift.end_time < now:
            return "missing_out"
        return "on_duty"

    if s == "pending_approval":
        return "pending_approval"

    if s in ("approved", "completed"):
        return "approved"

    if s in ("open", "scheduled", "active"):
        # Future shift → upcoming. Past start with no check-in → no_show.
        if shift.start_time and shift.start_time > now:
            return "upcoming"
        if shift.end_time and shift.end_time < now:
            return "no_show"
        return "upcoming"

    return s


def _patrol_counts(shift: Shift) -> tuple[int, int]:
    """(completed, expected) patrol checks for a shift.

    Completed = sum of FireExitCheck + CapacityCheck + ToiletCheck rows.
    Expected = rough heuristic per venue requirement flag × shift hours / 4
    (one round of each required check every 4 hours), min 1 if anything required.
    """
    fire = FireExitCheck.objects.filter(shift=shift).count()
    cap = CapacityCheck.objects.filter(shift=shift).count()
    toi = ToiletCheck.objects.filter(shift=shift).count()
    completed = fire + cap + toi

    venue = shift.venue
    required_kinds = sum(
        [
            bool(venue.requires_fire_safety_checks),
            bool(venue.requires_capacity_monitoring),
            bool(venue.requires_toilet_checks),
        ]
    )
    if required_kinds == 0:
        return (completed, completed)

    duration_h = 0
    if shift.start_time and shift.end_time:
        duration_h = max(0, (shift.end_time - shift.start_time).total_seconds() / 3600)
    expected = max(required_kinds, int(round(required_kinds * duration_h / 4)))
    return (completed, max(completed, expected))


def _gps_status(shift: Shift) -> tuple[bool | None, int | None]:
    """Compute (gps_ok, dist_m) at serialization time from check_in_location + venue radius.

    Returns (None, None) if check-in not happened yet or venue lacks coords.
    """
    loc = shift.check_in_location or {}
    if not loc:
        return (None, None)
    lat = loc.get("latitude") or loc.get("lat")
    lng = loc.get("longitude") or loc.get("lng")
    venue = shift.venue
    if lat is None or lng is None or venue.latitude is None or venue.longitude is None:
        return (None, None)
    dist = haversine_m(float(lat), float(lng), float(venue.latitude), float(venue.longitude))
    radius = venue.check_radius or 100
    return (dist <= radius, dist)


class AttendanceShiftSerializer(serializers.Serializer):
    """Project a Shift into AttendanceShift shape (mocks.ts line 36)."""

    def to_representation(self, shift: Shift) -> dict:
        now = self.context.get("now") or timezone.now()
        tz = _shift_tz(shift)

        sch_start = hour_decimal(shift.start_time, tz)
        sch_end = hour_decimal(shift.end_time, tz)
        # End hours past midnight wrap to small numbers — extend by 24 so the
        # timeline ribbon still spans correctly (mock uses 26 for 02:00 next-day).
        if sch_start is not None and sch_end is not None and sch_end < sch_start:
            sch_end += 24

        # Use effective times so manager TimeAdjustments flip the UI from
        # no-show → on-duty and the "ACTUAL" panel reflects the attestation.
        eff_check_in = shift.get_effective_check_in_time()
        eff_check_out = shift.get_effective_check_out_time()

        # Anchored to the shift's start day for the same reason sch_end is
        # extended: an officer who checks out at 03:00 after an 18:00 start is
        # nine hours in, not fifteen hours behind.
        act_start = hour_decimal_from(eff_check_in, tz, anchor=shift.start_time)
        act_end = hour_decimal_from(eff_check_out, tz, anchor=shift.start_time)

        late_min: int | None = None
        if eff_check_in and shift.start_time:
            late_min = int(round((eff_check_in - shift.start_time).total_seconds() / 60))

        early_min: int | None = None
        if eff_check_out and shift.end_time:
            diff = (shift.end_time - eff_check_out).total_seconds() / 60
            if diff > 0:
                early_min = int(round(diff))

        gps_ok, dist_m = _gps_status(shift)
        patrol = _patrol_counts(shift)

        breaks = 1 if (shift.break_duration or 0) > 0 else 0

        status_str = derive_status(shift, now, eff_check_in, eff_check_out)
        was_late = (late_min is not None and late_min >= 10)
        geofence_fail = gps_ok is False

        # If the GPS check failed and we're surfacing live/in-progress, prefer
        # the geofence_fail signal over plain on_duty so ribbon colour matches.
        if status_str == "on_duty" and geofence_fail:
            # We keep status="on_duty" but flag geofence_fail=true so
            # ribbonKey() in the UI elevates it. This matches the mock t12 row.
            pass

        # Auto-approval signal: when Shift.save() promotes pending_approval →
        # approved without a manager click, manager_user stays null. We surface
        # both so the drawer can render a synthetic audit-trail entry.
        auto_approved = (
            shift.status == "approved"
            and shift.manager_user_id is None
        )

        out = {
            "id": str(shift.id),
            "oid": str(shift.staff_user_id) if shift.staff_user_id else None,
            "vid": str(shift.venue_id),
            "sch_start": sch_start,
            "sch_end": sch_end,
            "act_start": act_start,
            "act_end": act_end,
            # Absolute timestamps alongside the decimal hours. Hours alone
            # carry no date, which left the Attendance editor stamping edits
            # onto whatever day the admin happened to be viewing.
            "sch_start_at": shift.start_time.isoformat() if shift.start_time else None,
            "sch_end_at": shift.end_time.isoformat() if shift.end_time else None,
            "status": status_str,
            "late_min": late_min,
            "photo": bool(shift.check_in_photo),
            "gps_ok": gps_ok,
            "dist_m": dist_m,
            "patrol": list(patrol),
            "breaks": breaks,
            "was_late": was_late,
            "geofence_fail": geofence_fail,
            "open": shift.staff_user_id is None,
            "note": shift.manager_notes or None,
            "auto_checkout": bool(shift.auto_checkout),
            "auto_approved": auto_approved,
            "checkout_at": (
                eff_check_out.isoformat() if eff_check_out else None
            ),
        }
        if early_min is not None:
            out["early_min"] = early_min
        return out


class AttendanceVenueSerializer(serializers.Serializer):
    """Project a Venue into AttendanceVenue shape."""

    def to_representation(self, venue: Venue) -> dict:
        # UK postcodes split into outward + inward (e.g. "BS1 6JJ" → "BS1");
        # the UI shows a compact area pill, mock uses just the outward part.
        area = (venue.postal_code or "").split(" ", 1)[0] or venue.city or ""
        return {
            "id": str(venue.id),
            "name": venue.name,
            "area": area,
            "hue": stable_hue(f"venue-{venue.id}"),
            "geofence": True,
            "radius": venue.check_radius or 100,
        }


class AttendanceOfficerSerializer(serializers.Serializer):
    """Project a User (+ StaffProfile + SIALicense) into AttendanceOfficer shape."""

    def to_representation(self, user: User) -> dict:
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username

        sia_code = "SG"  # default
        role_label = "Security Officer"
        phone = None
        try:
            profile = user.profile
        except Exception:
            profile = None

        if profile:
            phone = profile.phone_number or None
            primary_lic = (
                SIALicense.objects.filter(staff_profile=profile, status="valid")
                .order_by("-issue_date")
                .first()
            )
            if primary_lic:
                sia_code = SIA_CODE_MAP.get(primary_lic.license_type, "SG")
                role_label = primary_lic.get_license_type_display()

        return {
            "id": str(user.id),
            "name": full_name,
            "role": role_label,
            "sia": sia_code,
            "hue": stable_hue(f"officer-{user.id}"),
            "phone": phone,
            "email": user.email or None,
        }


# ─── Timesheet aggregation ─────────────────────────────────────────────────

CELL_STATUS_BY_SHIFT = {
    # Map derived AttendanceShift status → DayCellData status used by the
    # weekly timesheet grid (mocks.ts line 75).
    "approved": "approved",
    "completed": "approved",
    "pending_approval": "pending",
    "on_duty": "pending",
    "missing_out": "missing",
    "no_show": "noshow",
    "early_out": "early",
    "upcoming": "future",
}


def _cell_status_for_shift(shift: Shift, now: datetime, late_min: int | None) -> str:
    eff_in = shift.get_effective_check_in_time()
    eff_out = shift.get_effective_check_out_time()
    base = derive_status(shift, now, eff_in, eff_out)

    # Approved shifts always render as approved — the late/geofence flags are
    # still counted in the row's FLAGS column for the week summary, but the
    # day cell itself shouldn't keep raising a yellow alert after manager sign-off.
    if base == "approved":
        return "approved"

    if base == "on_duty" or base == "pending_approval":
        if late_min is not None and late_min >= 10:
            return "late"
    if shift.check_in_location:
        loc = shift.check_in_location
        lat = loc.get("latitude") or loc.get("lat")
        lng = loc.get("longitude") or loc.get("lng")
        if lat is not None and lng is not None and shift.venue.latitude and shift.venue.longitude:
            dist = haversine_m(
                float(lat), float(lng), float(shift.venue.latitude), float(shift.venue.longitude)
            )
            if dist > (shift.venue.check_radius or 100):
                return "geofence"
    return CELL_STATUS_BY_SHIFT.get(base, "pending")


def build_timesheet_rows(
    shifts: Iterable[Shift], week_start: date, now: datetime | None = None
) -> tuple[list[dict], list[dict]]:
    """Aggregate shifts into per-officer weekly TimesheetRow + WeekDay arrays.

    Mirrors the mock TIMESHEETS / WEEK_DAYS structure (mocks.ts line 95+).
    """
    now = now or timezone.now()
    today = timezone.localdate()

    days: list[dict] = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        days.append(
            {
                "d": i,
                "label": d.strftime("%a"),
                "date": str(d.day),
                "today": d == today,
            }
        )

    # Group shifts by officer
    by_user: dict[int, list[Shift]] = defaultdict(list)
    for s in shifts:
        if s.staff_user_id is None:
            continue
        by_user[s.staff_user_id].append(s)

    rows: list[dict] = []
    for user_id, user_shifts in by_user.items():
        scheduled_total = Decimal("0")
        actual_total = Decimal("0")
        flags = {"late": 0, "early": 0, "noshow": 0, "missing": 0, "geofence": 0}
        # Per-day buckets
        day_buckets: dict[int, dict] = {
            i: {"sch": Decimal("0"), "act": Decimal("0"), "status": "absent"} for i in range(7)
        }

        for shift in user_shifts:
            local_start = timezone.localtime(shift.start_time)
            day_index = (local_start.date() - week_start).days
            if not (0 <= day_index < 7):
                continue

            sch_hours = Decimal("0")
            if shift.start_time and shift.end_time:
                sch_hours = Decimal(
                    str(round((shift.end_time - shift.start_time).total_seconds() / 3600, 2))
                )

            eff_in = shift.get_effective_check_in_time()
            eff_out = shift.get_effective_check_out_time()

            act_hours = Decimal("0")
            eff_hours = shift.get_effective_actual_hours()
            if eff_hours is not None:
                act_hours = Decimal(str(eff_hours))
            elif eff_in and eff_out:
                act_hours = Decimal(
                    str(round((eff_out - eff_in).total_seconds() / 3600, 2))
                )

            late_min: int | None = None
            if eff_in and shift.start_time:
                late_min = int(round((eff_in - shift.start_time).total_seconds() / 60))
            cell_status = _cell_status_for_shift(shift, now, late_min)

            if cell_status == "late":
                flags["late"] += 1
            elif cell_status == "early":
                flags["early"] += 1
            elif cell_status == "noshow":
                flags["noshow"] += 1
            elif cell_status == "missing":
                flags["missing"] += 1
            elif cell_status == "geofence":
                flags["geofence"] += 1

            scheduled_total += sch_hours
            actual_total += act_hours

            bucket = day_buckets[day_index]
            bucket["sch"] += sch_hours
            bucket["act"] += act_hours
            # Worst-status wins (so a late cell isn't overwritten by an approved one)
            priority = {
                "noshow": 5,
                "missing": 4,
                "geofence": 3,
                "late": 2,
                "early": 2,
                "pending": 1,
                "approved": 0,
                "future": 0,
                "absent": -1,
                "ok": 0,
            }
            if priority.get(cell_status, 0) >= priority.get(bucket["status"], -1):
                bucket["status"] = cell_status

        # Future-dated cells with zero scheduled stay as "future" for cleaner UI
        for i in range(7):
            d = week_start + timedelta(days=i)
            b = day_buckets[i]
            if b["sch"] == 0 and b["act"] == 0:
                b["status"] = "future" if d >= today else "absent"

        # Row-level status — what action (if any) the manager can take this week.
        # blocked  = serious issues (noshow / missing checkout / geofence)
        # review   = soft flags (late / early) — needs eyeballing
        # ready    = at least one shift checked out cleanly and is awaiting
        #            the manager click (status='pending_approval'). Bulk-approve
        #            in the timesheet header only fires on these rows.
        # approved = nothing left to do for the week
        # in_progress shifts (officer still on duty) deliberately do NOT promote
        # the row to "ready" — payroll shouldn't lock until check-out.
        any_pending_approval = any(
            shift.status == "pending_approval" for shift in user_shifts
        )
        any_in_progress = any(
            shift.status == "in_progress" for shift in user_shifts
        )
        if flags["noshow"] or flags["missing"] or flags["geofence"]:
            row_status = "blocked"
        elif flags["late"] or flags["early"]:
            row_status = "review"
        elif any_pending_approval:
            row_status = "ready"
        elif any_in_progress:
            row_status = "review"
        elif all(shift.status == "approved" for shift in user_shifts):
            row_status = "approved"
        else:
            row_status = "review"

        rows.append(
            {
                "oid": str(user_id),
                "scheduled": float(scheduled_total),
                "actual": float(actual_total),
                "variance": float(actual_total - scheduled_total),
                "status": row_status,
                "flags": flags,
                "days": [
                    {
                        "sch": float(day_buckets[i]["sch"]),
                        "act": float(day_buckets[i]["act"]),
                        "status": day_buckets[i]["status"],
                    }
                    for i in range(7)
                ],
            }
        )

    rows.sort(key=lambda r: r["oid"])
    return rows, days


# ─── Top-level builders used by the viewset actions ──────────────────────


def build_live_payload(
    shifts_qs, now: datetime | None = None
) -> dict:
    """Compose the response for GET /shifts/attendance/live/.

    Returns { shifts, officers, venues, stats } matching what AttendancePage expects.
    """
    now = now or timezone.now()
    shifts = list(
        shifts_qs.select_related("staff_user", "staff_user__profile", "venue")
    )
    shift_ctx = {"now": now}
    serialized_shifts = [
        AttendanceShiftSerializer(context=shift_ctx).to_representation(s) for s in shifts
    ]

    venue_ids = {s.venue_id for s in shifts if s.venue_id}
    user_ids = {s.staff_user_id for s in shifts if s.staff_user_id}

    venues = Venue.objects.filter(id__in=venue_ids)
    users = User.objects.filter(id__in=user_ids).select_related("profile")

    serialized_venues = [AttendanceVenueSerializer().to_representation(v) for v in venues]
    serialized_officers = [AttendanceOfficerSerializer().to_representation(u) for u in users]

    # Stats — mirrors ATT_STATS in mocks.ts line 260
    on_duty = sum(1 for s in serialized_shifts if s["status"] == "on_duty")
    pending = sum(
        1 for s in serialized_shifts if s["status"] in ("pending_approval", "early_out")
    )
    no_show = sum(1 for s in serialized_shifts if s["status"] == "no_show")
    missing_out = sum(1 for s in serialized_shifts if s["status"] == "missing_out")
    geofence = sum(1 for s in serialized_shifts if s["geofence_fail"])
    early_out = sum(1 for s in serialized_shifts if s["status"] == "early_out")
    late_count = sum(
        1 for s in serialized_shifts if (s["late_min"] or 0) >= 10 or s.get("was_late")
    )
    exceptions = sum(
        1
        for s in serialized_shifts
        if s["status"] in ("no_show", "missing_out", "early_out")
        or s["geofence_fail"]
        or s.get("was_late")
        or (s["late_min"] or 0) >= 10
    )

    # "expected_so_far" = shifts whose start_time has elapsed today.
    # sch_start is in the venue's local TZ (computed by hour_decimal with the
    # venue tz applied), so compare against `now` localised to the same TZ.
    # Otherwise UTC-now (10:55) compared against BST sch_start (12:20) gives
    # a false negative and you end up with showed_up > expected_so_far.
    company_tz = None
    if shifts:
        company_tz = _shift_tz(shifts[0])
    now_local = timezone.localtime(now, company_tz) if company_tz else timezone.localtime(now)
    now_hour = now_local.hour + now_local.minute / 60
    expected_so_far = sum(
        1
        for s in serialized_shifts
        if s["sch_start"] is not None
        and s["sch_start"] <= now_hour
        and s["status"] != "upcoming"
    )
    showed_up = sum(
        1
        for s in serialized_shifts
        if s["act_start"] is not None
    )
    # Defensive cap: if attestation logic ever advances past expected, the
    # gauge should report 100%, not 200%+ — the rate is still useful as
    # "everyone who should be in is in".
    if showed_up > expected_so_far:
        expected_so_far = showed_up

    stats = {
        "on_duty": on_duty,
        "pending": pending,
        "exceptions": exceptions,
        "no_show": no_show,
        "missing_out": missing_out,
        "geofence": geofence,
        "late": late_count,
        "early_out": early_out,
        "expected_so_far": expected_so_far,
        "showed_up": showed_up,
    }

    return {
        "shifts": serialized_shifts,
        "officers": serialized_officers,
        "venues": serialized_venues,
        "stats": stats,
    }


def build_timesheets_payload(shifts_qs, week_start: date, now: datetime | None = None) -> dict:
    """Compose the response for GET /shifts/attendance/timesheets/.

    Returns { rows, days, officers, venues } so the timesheet grid can label
    cells without a second round-trip.
    """
    now = now or timezone.now()
    shifts = list(
        shifts_qs.select_related("staff_user", "staff_user__profile", "venue")
    )
    rows, days = build_timesheet_rows(shifts, week_start, now)

    user_ids = {s.staff_user_id for s in shifts if s.staff_user_id}
    venue_ids = {s.venue_id for s in shifts if s.venue_id}
    users = User.objects.filter(id__in=user_ids).select_related("profile")
    venues = Venue.objects.filter(id__in=venue_ids)

    return {
        "rows": rows,
        "days": days,
        "officers": [AttendanceOfficerSerializer().to_representation(u) for u in users],
        "venues": [AttendanceVenueSerializer().to_representation(v) for v in venues],
    }
