from django import template
from django.conf import settings

register = template.Library()


@register.simple_tag
def asset_url(path: str) -> str:
    """Prefix a frontend-hosted asset path with FRONTEND_URL.

    Used in email templates so the same template renders correctly in
    both local dev (http://localhost:3000) and production (Vercel).
    """
    base = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    return f"{base}/{path.lstrip('/')}"
