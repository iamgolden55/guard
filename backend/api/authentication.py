"""
Sprint 3: Custom JWT Authentication that reads from httpOnly cookies
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from django.conf import settings


class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication class that reads tokens from httpOnly cookies.

    This class extends the default JWTAuthentication to support reading
    JWT tokens from httpOnly cookies instead of the Authorization header.
    This provides better XSS protection.

    Sprint 3: Token Storage Security Enhancement
    """

    def authenticate(self, request):
        """
        Try to authenticate using JWT token from cookie.
        Falls back to Authorization header if cookie is not present (for API compatibility).
        """
        # First, try to get token from cookie (Sprint 3 primary method)
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token is None:
            # Fallback to Authorization header for backward compatibility
            # This allows API clients that can't use cookies to still work
            header = self.get_header(request)
            if header is None:
                return None

            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        # Validate the token and return user
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
