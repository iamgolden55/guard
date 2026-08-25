"""
Multi-tenant scoping for finance integrations.

Lives in its own module because both views.py and serializers.py need it, and
views.py already imports serializers.py.
"""
from api.middleware.tenant_middleware import resolve_request_company

from .models import ProviderConnection


def company_connections(request):
    """
    Connections belonging to the single company in scope for this request.

    Returns an EMPTY queryset when no company can be resolved. That is
    deliberate: the previous behaviour fell back to "every company this user
    belongs to", and finally to "connections I created", which meant an admin
    of companies A and B could reach B's connection while acting for A -- and
    push A's invoice into B's accounting org.
    """
    company = resolve_request_company(request)
    if not company:
        return ProviderConnection.objects.none()

    return ProviderConnection.objects.filter(
        created_by__company_memberships__company=company,
        created_by__company_memberships__is_active=True
    ).distinct()
