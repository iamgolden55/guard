"""
Project-wide DRF exception handler.

One addition to DRF's default: a `ProtectedError` — a delete refused because
pay history depends on the row (AUDIT-2026-09-17, Phase 2C) — becomes a 409
that says what is in the way and what to do instead, rather than a 500.
"""
from collections import Counter

from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler, set_rollback

#: What to do instead of deleting, keyed by the model being deleted.
ALTERNATIVES = {
    'venue': 'Deactivate the venue instead; its history is kept.',
    'shift': 'Cancel the shift instead.',
    'user': 'Remove them from the team instead; their history is kept.',
}


def _model_being_deleted(context):
    view = context.get('view')
    try:
        return view.get_queryset().model._meta
    except Exception:  # noqa: BLE001 — only used to word the message
        return None


def protected_error_response(exc, context):
    counts = Counter(obj._meta for obj in exc.protected_objects)
    in_the_way = ', '.join(
        f"{n} {meta.verbose_name if n == 1 else meta.verbose_name_plural}"
        for meta, n in counts.items()
    )
    meta = _model_being_deleted(context)
    subject = f"This {meta.verbose_name}" if meta else "This record"
    detail = f"{subject} can't be deleted: {in_the_way} depend{'s' if sum(counts.values()) == 1 else ''} on it."
    alternative = ALTERNATIVES.get(meta.model_name) if meta else None
    if alternative:
        detail = f"{detail} {alternative}"
    set_rollback()
    return Response(
        {
            'error': 'in_use',
            'detail': detail,
            'blocking': {meta.model_name: n for meta, n in counts.items()},
        },
        status=status.HTTP_409_CONFLICT,
    )


def exception_handler(exc, context):
    if isinstance(exc, ProtectedError):
        return protected_error_response(exc, context)
    return drf_exception_handler(exc, context)
