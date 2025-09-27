"""
WebSocket Authentication Middleware for JWT tokens.

Provides JWT-based authentication for WebSocket connections using
the same tokens as the REST API.
"""

import logging
from urllib.parse import parse_qs
from typing import Optional

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.conf import settings
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken, TokenError
from rest_framework_simplejwt.authentication import JWTAuthentication

User = get_user_model()
logger = logging.getLogger(__name__)


class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT authentication middleware for WebSocket connections.

    Authenticates WebSocket connections using JWT tokens passed as query parameters.
    Supports both 'token' and 'access_token' parameter names.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        """
        Authenticate WebSocket connection and add user to scope.

        Args:
            scope: ASGI scope dictionary
            receive: ASGI receive callable
            send: ASGI send callable
        """
        # Only process WebSocket connections
        if scope['type'] != 'websocket':
            return await self.inner(scope, receive, send)

        # Extract token from query string
        token = self._extract_token_from_scope(scope)

        if token:
            user = await self._authenticate_token(token)
            scope['user'] = user
            logger.info(f'WebSocket authenticated user: {user.username if user.is_authenticated else "Anonymous"}')
        else:
            scope['user'] = AnonymousUser()
            logger.warning('WebSocket connection without authentication token')

        return await self.inner(scope, receive, send)

    def _extract_token_from_scope(self, scope) -> Optional[str]:
        """Extract JWT token from WebSocket query parameters."""
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)

        # Check for token in multiple parameter names
        for param_name in ['token', 'access_token', 'jwt']:
            if param_name in query_params:
                return query_params[param_name][0]

        # Check for token in Authorization header format
        headers = dict(scope.get('headers', []))
        auth_header = headers.get(b'authorization', b'').decode('utf-8')

        if auth_header.startswith('Bearer '):
            return auth_header.replace('Bearer ', '', 1)

        return None

    @database_sync_to_async
    def _authenticate_token(self, token: str) -> User:
        """
        Authenticate JWT token and return user.

        Args:
            token: JWT access token string

        Returns:
            User instance if token is valid, AnonymousUser otherwise
        """
        try:
            # Validate token
            access_token = AccessToken(token)

            # Get user ID from token
            user_id = access_token.get('user_id')
            if not user_id:
                logger.warning('JWT token missing user_id claim')
                return AnonymousUser()

            # Get user from database
            user = User.objects.get(id=user_id)

            # Check if user is active
            if not user.is_active:
                logger.warning(f'Inactive user attempted WebSocket connection: {user.username}')
                return AnonymousUser()

            return user

        except TokenError as e:
            logger.warning(f'Invalid JWT token for WebSocket: {str(e)}')
            return AnonymousUser()
        except User.DoesNotExist:
            logger.warning(f'User not found for JWT token: {user_id}')
            return AnonymousUser()
        except Exception as e:
            logger.error(f'Error authenticating WebSocket token: {str(e)}')
            return AnonymousUser()


class JWTQueryAuthMiddleware:
    """
    Alternative JWT middleware that specifically looks for token in query parameters.
    Lighter weight version for cases where header parsing isn't needed.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'websocket':
            return await self.inner(scope, receive, send)

        # Parse query string for token
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)

        token = query_params.get('token', [None])[0]

        if token:
            user = await self._get_user_from_token(token)
            scope['user'] = user
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user_from_token(self, token: str) -> User:
        """Get user from JWT token."""
        try:
            access_token = AccessToken(token)
            user_id = access_token.get('user_id')
            user = User.objects.get(id=user_id, is_active=True)
            return user
        except (TokenError, User.DoesNotExist, Exception):
            return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    """
    WebSocket middleware stack with JWT authentication.

    Usage in routing:
        from api.middleware.websocket_auth import JWTAuthMiddlewareStack

        application = ProtocolTypeRouter({
            'websocket': JWTAuthMiddlewareStack(
                URLRouter([
                    # your websocket routes
                ])
            ),
        })
    """
    return JWTAuthMiddleware(inner)