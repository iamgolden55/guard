"""
Shift validation utilities for preventing duplicate and overlapping shifts.

This module provides functions to detect and prevent:
1. Duplicate shifts (same staff, venue, start_time, end_time)
2. Overlapping shifts (same staff, overlapping time windows)
"""

from django.db.models import Q
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


def check_shift_overlap(staff_user, start_time, end_time, exclude_shift_id=None, venue=None):
    """
    Check if a staff member has any overlapping shifts during the proposed time window.

    Two shifts overlap if:
    - They share the same staff member
    - Their time windows intersect (one starts before the other ends)

    Args:
        staff_user: User object or user ID for the staff member
        start_time: Proposed shift start time (datetime)
        end_time: Proposed shift end time (datetime)
        exclude_shift_id: Shift ID to exclude from check (for updates)
        venue: Optional venue to check (for more specific duplicate detection)

    Returns:
        tuple: (has_overlap: bool, overlapping_shifts: QuerySet)
    """
    from api.models import Shift

    if not staff_user:
        # Open shifts (no staff assigned) can't have overlaps
        return False, Shift.objects.none()

    # Get user ID if a User object was passed
    user_id = staff_user.id if hasattr(staff_user, 'id') else staff_user

    # Build the overlap query
    # Two time ranges [A_start, A_end] and [B_start, B_end] overlap if:
    # A_start < B_end AND A_end > B_start
    overlap_query = Q(
        staff_user_id=user_id,
        start_time__lt=end_time,  # Existing shift starts before proposed ends
        end_time__gt=start_time,  # Existing shift ends after proposed starts
    )

    # Exclude cancelled shifts from overlap check
    overlap_query &= ~Q(status='cancelled')

    queryset = Shift.objects.filter(overlap_query)

    # Exclude the current shift if updating
    if exclude_shift_id:
        queryset = queryset.exclude(id=exclude_shift_id)

    has_overlap = queryset.exists()

    if has_overlap:
        logger.warning(
            f"Overlap detected for user {user_id}: "
            f"Proposed {start_time} - {end_time}, "
            f"Conflicts with {queryset.count()} existing shift(s)"
        )

    return has_overlap, queryset


def check_exact_duplicate(staff_user, venue, start_time, end_time, exclude_shift_id=None):
    """
    Check if an exact duplicate shift exists (same staff, venue, start, end times).

    Args:
        staff_user: User object or user ID for the staff member
        venue: Venue object or venue ID
        start_time: Shift start time (datetime)
        end_time: Shift end time (datetime)
        exclude_shift_id: Shift ID to exclude from check (for updates)

    Returns:
        tuple: (has_duplicate: bool, duplicate_shift: Shift or None)
    """
    from api.models import Shift

    if not staff_user:
        return False, None

    user_id = staff_user.id if hasattr(staff_user, 'id') else staff_user
    venue_id = venue.id if hasattr(venue, 'id') else venue

    queryset = Shift.objects.filter(
        staff_user_id=user_id,
        venue_id=venue_id,
        start_time=start_time,
        end_time=end_time,
    ).exclude(status='cancelled')

    if exclude_shift_id:
        queryset = queryset.exclude(id=exclude_shift_id)

    duplicate = queryset.first()

    if duplicate:
        logger.warning(
            f"Exact duplicate detected for user {user_id} at venue {venue_id}: "
            f"{start_time} - {end_time}, existing shift ID: {duplicate.id}"
        )

    return duplicate is not None, duplicate


def validate_shift_no_overlap(staff_user, start_time, end_time, exclude_shift_id=None):
    """
    Validate that a shift doesn't overlap with existing shifts.
    Raises a validation error if overlap is detected.

    Args:
        staff_user: User object or user ID
        start_time: Proposed shift start time
        end_time: Proposed shift end time
        exclude_shift_id: Shift ID to exclude (for updates)

    Raises:
        ValueError: If an overlapping shift is found

    Returns:
        None if no overlap
    """
    has_overlap, overlapping_shifts = check_shift_overlap(
        staff_user, start_time, end_time, exclude_shift_id
    )

    if has_overlap:
        first_conflict = overlapping_shifts.first()
        venue_name = first_conflict.venue.name if first_conflict.venue else 'Unknown'

        raise ValueError(
            f"This staff member already has a shift during this time: "
            f"{first_conflict.start_time.strftime('%Y-%m-%d %H:%M')} - "
            f"{first_conflict.end_time.strftime('%H:%M')} at {venue_name}"
        )


def get_staff_schedule_conflicts(staff_user, proposed_shifts):
    """
    Check multiple proposed shifts for conflicts with existing schedule.
    Useful for bulk operations like template generation.

    Args:
        staff_user: User object or user ID
        proposed_shifts: List of dicts with 'start_time' and 'end_time' keys

    Returns:
        dict: {
            'conflicts': List of (proposed_shift_index, conflicting_shift) tuples,
            'valid_shifts': List of indices that have no conflicts
        }
    """
    from api.models import Shift

    if not staff_user or not proposed_shifts:
        return {'conflicts': [], 'valid_shifts': list(range(len(proposed_shifts)))}

    user_id = staff_user.id if hasattr(staff_user, 'id') else staff_user

    # Get all existing shifts for this user
    existing_shifts = Shift.objects.filter(
        staff_user_id=user_id
    ).exclude(
        status='cancelled'
    ).values('id', 'start_time', 'end_time', 'venue__name')

    conflicts = []
    valid_shifts = []

    for idx, proposed in enumerate(proposed_shifts):
        start = proposed['start_time']
        end = proposed['end_time']

        has_conflict = False
        for existing in existing_shifts:
            # Check for overlap
            if start < existing['end_time'] and end > existing['start_time']:
                conflicts.append((idx, existing))
                has_conflict = True
                break

        if not has_conflict:
            valid_shifts.append(idx)

    return {'conflicts': conflicts, 'valid_shifts': valid_shifts}


def validate_shift_warnings(staff_user, start_time, end_time, venue=None, required_role=None, exclude_shift_id=None):
    """
    Pre-flight validation that returns soft warnings (not errors) for a proposed shift.
    Used by the scheduler validate endpoint to show warnings before committing.

    Returns:
        dict: {
            'valid': bool (False only if hard errors exist),
            'errors': [{'type': str, 'message': str}],
            'warnings': [{'type': str, 'message': str, 'severity': 'warning'|'info'}]
        }
    """
    from api.models import Shift, WorkingHoursRegulation, ContractorUnavailability, SIALicense
    from django.db.models import Sum, Q
    from datetime import timedelta
    import decimal

    errors = []
    warnings = []

    if not staff_user:
        return {'valid': True, 'errors': [], 'warnings': []}

    user_id = staff_user.id if hasattr(staff_user, 'id') else staff_user

    # Ensure datetimes are timezone-aware
    if timezone.is_naive(start_time):
        start_time = timezone.make_aware(start_time)
    if timezone.is_naive(end_time):
        end_time = timezone.make_aware(end_time)

    # --- Hard errors ---

    # 1. Overlap check
    has_overlap, overlapping = check_shift_overlap(staff_user, start_time, end_time, exclude_shift_id)
    if has_overlap:
        first = overlapping.select_related('venue').first()
        venue_name = first.venue.name if first and first.venue else 'Unknown'
        errors.append({
            'type': 'overlap',
            'message': f"Overlaps with existing shift at {venue_name}: "
                       f"{first.start_time.strftime('%H:%M')}-{first.end_time.strftime('%H:%M')}"
        })

    # --- Soft warnings ---

    # Get regulation (default to GB if not found)
    regulation = WorkingHoursRegulation.objects.filter(is_active=True).first()

    if regulation:
        # 2. Weekly hours / overtime check
        week_start = start_time - timedelta(days=start_time.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        if timezone.is_naive(week_start):
            week_start = timezone.make_aware(week_start)
        week_end = week_start + timedelta(days=7)

        weekly_shifts = Shift.objects.filter(
            staff_user_id=user_id,
            start_time__gte=week_start,
            start_time__lt=week_end,
        ).exclude(status='cancelled')
        if exclude_shift_id:
            weekly_shifts = weekly_shifts.exclude(id=exclude_shift_id)

        existing_weekly_hours = decimal.Decimal('0')
        for s in weekly_shifts:
            if s.end_time:
                duration = (s.end_time - s.start_time).total_seconds() / 3600
                existing_weekly_hours += decimal.Decimal(str(round(duration, 2)))

        proposed_duration = decimal.Decimal(str(round((end_time - start_time).total_seconds() / 3600, 2)))
        total_weekly = existing_weekly_hours + proposed_duration

        if total_weekly > regulation.max_weekly_hours:
            errors.append({
                'type': 'max_weekly_hours',
                'message': f"Would exceed maximum weekly hours: {total_weekly}h / {regulation.max_weekly_hours}h max"
            })
        elif regulation.overtime_threshold_hours and total_weekly > regulation.overtime_threshold_hours:
            warnings.append({
                'type': 'overtime',
                'message': f"Overtime: {total_weekly}h this week (threshold: {regulation.overtime_threshold_hours}h)",
                'severity': 'warning'
            })

        # 3. Rest period check
        prev_shift = Shift.objects.filter(
            staff_user_id=user_id,
            end_time__lt=start_time,
        ).exclude(status='cancelled')
        if exclude_shift_id:
            prev_shift = prev_shift.exclude(id=exclude_shift_id)
        prev_shift = prev_shift.order_by('-end_time').first()

        if prev_shift and prev_shift.end_time:
            rest_hours = (start_time - prev_shift.end_time).total_seconds() / 3600
            if rest_hours < float(regulation.min_rest_between_shifts_hours):
                warnings.append({
                    'type': 'short_rest',
                    'message': f"Only {rest_hours:.1f}h rest since last shift (min {regulation.min_rest_between_shifts_hours}h required)",
                    'severity': 'warning'
                })

        # Also check rest after this shift
        next_shift = Shift.objects.filter(
            staff_user_id=user_id,
            start_time__gt=end_time,
        ).exclude(status='cancelled')
        if exclude_shift_id:
            next_shift = next_shift.exclude(id=exclude_shift_id)
        next_shift = next_shift.order_by('start_time').first()

        if next_shift:
            rest_hours = (next_shift.start_time - end_time).total_seconds() / 3600
            if rest_hours < float(regulation.min_rest_between_shifts_hours):
                warnings.append({
                    'type': 'short_rest_after',
                    'message': f"Only {rest_hours:.1f}h rest before next shift (min {regulation.min_rest_between_shifts_hours}h required)",
                    'severity': 'warning'
                })

        # 4. Consecutive days check
        shift_date = start_time.date()
        consecutive = 0
        check_date = shift_date - timedelta(days=1)
        while consecutive < regulation.max_consecutive_days + 1:
            has_shift = Shift.objects.filter(
                staff_user_id=user_id,
                start_time__date=check_date,
            ).exclude(status='cancelled')
            if exclude_shift_id:
                has_shift = has_shift.exclude(id=exclude_shift_id)
            if has_shift.exists():
                consecutive += 1
                check_date -= timedelta(days=1)
            else:
                break

        if consecutive >= regulation.max_consecutive_days:
            warnings.append({
                'type': 'consecutive_days',
                'message': f"Would be {consecutive + 1} consecutive days (max {regulation.max_consecutive_days})",
                'severity': 'warning'
            })

    # 5. Availability check
    shift_date = start_time.date()
    unavailability = ContractorUnavailability.objects.filter(
        staff_user_id=user_id,
        start_date__lte=shift_date,
        end_date__gte=shift_date,
    ).first()
    if unavailability:
        warnings.append({
            'type': 'unavailable',
            'message': f"Staff marked unavailable {unavailability.start_date} - {unavailability.end_date}"
                       + (f" ({unavailability.reason})" if unavailability.reason else ""),
            'severity': 'warning'
        })

    # Check leave requests
    try:
        from leave_management.models import LeaveRequest as LeaveManagementRequest
        leave = LeaveManagementRequest.objects.filter(
            staff_user_id=user_id,
            status='approved',
            start_date__lte=shift_date,
            end_date__gte=shift_date,
        ).first()
        if leave:
            warnings.append({
                'type': 'on_leave',
                'message': f"Staff has approved leave on this date",
                'severity': 'warning'
            })
    except ImportError:
        pass

    # 6. Qualification check
    if required_role:
        # Map shift role to SIA license type
        role_to_license = {
            'ds': 'ds', 'sg': 'sg', 'cctv': 'cctv', 'cp': 'cp', 'k9': 'k9',
        }
        license_type = role_to_license.get(required_role)
        if license_type:
            from api.models import StaffProfile
            try:
                profile = StaffProfile.objects.get(user_id=user_id)
                valid_license = SIALicense.objects.filter(
                    staff_profile=profile,
                    license_type=license_type,
                    status='valid',
                    expiry_date__gte=shift_date,
                ).exists()
                if not valid_license:
                    warnings.append({
                        'type': 'missing_qualification',
                        'message': f"Staff lacks valid {dict(SIALicense.LICENSE_TYPE_CHOICES).get(license_type, license_type)} license",
                        'severity': 'warning'
                    })
            except StaffProfile.DoesNotExist:
                warnings.append({
                    'type': 'no_profile',
                    'message': "Staff has no profile — cannot verify qualifications",
                    'severity': 'info'
                })

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
    }


def clean_duplicate_shifts(dry_run=True):
    """
    Find and optionally remove duplicate shifts from the database.

    This function identifies shifts where the same staff member is assigned
    to the same venue at the same time multiple times.

    Args:
        dry_run: If True, only report duplicates without deleting.
                 If False, delete duplicates keeping the oldest shift.

    Returns:
        dict: Summary of duplicates found/removed
    """
    from api.models import Shift
    from django.db.models import Count, Min

    # Find duplicate combinations
    duplicates = Shift.objects.values(
        'staff_user', 'venue', 'start_time', 'end_time'
    ).annotate(
        count=Count('id'),
        min_id=Min('id')  # Keep the oldest (lowest ID)
    ).filter(
        count__gt=1,
        staff_user__isnull=False  # Only assigned shifts
    )

    total_duplicates = 0
    shifts_to_delete = []

    for dup in duplicates:
        # Get all shifts for this combination except the oldest
        duplicate_shifts = Shift.objects.filter(
            staff_user_id=dup['staff_user'],
            venue_id=dup['venue'],
            start_time=dup['start_time'],
            end_time=dup['end_time']
        ).exclude(id=dup['min_id'])

        for shift in duplicate_shifts:
            total_duplicates += 1
            shifts_to_delete.append({
                'id': shift.id,
                'staff_user': shift.staff_user.username if shift.staff_user else None,
                'venue': shift.venue.name if shift.venue else None,
                'start_time': shift.start_time,
                'end_time': shift.end_time,
                'status': shift.status,
                'keeping_id': dup['min_id']
            })

    if not dry_run and shifts_to_delete:
        ids_to_delete = [s['id'] for s in shifts_to_delete]
        deleted_count, _ = Shift.objects.filter(id__in=ids_to_delete).delete()
        logger.info(f"Deleted {deleted_count} duplicate shifts")

    return {
        'dry_run': dry_run,
        'total_duplicates_found': total_duplicates,
        'duplicates': shifts_to_delete
    }
