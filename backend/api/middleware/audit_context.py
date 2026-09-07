"""
Who did it — request context for audit signals.

Model signals see *what* changed but not *who* changed it, so an audit trail
built from signals records a shift being cancelled with no actor against it.
This stashes the live request where a signal can find it.

`asgiref.local.Local` rather than `threading.local`: the API is served by
Daphne over ASGI, and a plain thread-local leaks between concurrent async
requests sharing a thread.

Reading `request.user` from here is deliberate. At middleware time it is
`AnonymousUser` on JWT traffic — DRF authenticates later — but the signals
that read this fire during the view, by which point DRF has populated it. The
request object is stored, not the user, so the read happens at the right
moment.
"""
from asgiref.local import Local

_state = Local()


class AuditContextMiddleware:
    """Make the current request available to model signals."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _state.request = request
        try:
            return self.get_response(request)
        finally:
            # Always clear: a worker thread that keeps a stale request would
            # attribute the next job's writes to the wrong person.
            _state.request = None


def get_current_request():
    """The request being served, or None outside a request (Celery, shell)."""
    return getattr(_state, 'request', None)


def get_current_actor():
    """The authenticated user behind the current request, or None.

    None is a legitimate answer — auto-checkout, a Celery beat job and a
    management command all write shifts with nobody behind them, and an audit
    row saying so is more honest than one guessing.
    """
    request = get_current_request()
    user = getattr(request, 'user', None) if request else None
    return user if user is not None and user.is_authenticated else None
