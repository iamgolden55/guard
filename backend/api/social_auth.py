"""
Social Authentication Views
Handles Apple Sign-In and Google Sign-In token exchange
"""

import jwt
import requests
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

logger = logging.getLogger(__name__)
User = get_user_model()


def get_tokens_for_user(user):
    """Generate JWT tokens for a user"""
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def get_apple_public_keys():
    """Fetch Apple's public keys for JWT verification"""
    response = requests.get('https://appleid.apple.com/auth/keys')
    return response.json()['keys']


def verify_apple_token(identity_token, nonce=None):
    """
    Verify Apple identity token and extract user info
    Returns decoded token data or None if invalid
    """
    try:
        # Get Apple's public keys
        apple_keys = get_apple_public_keys()

        # Decode the token header to get the key ID
        unverified_header = jwt.get_unverified_header(identity_token)
        key_id = unverified_header.get('kid')

        # Find the matching key
        apple_key = None
        for key in apple_keys:
            if key['kid'] == key_id:
                apple_key = key
                break

        if not apple_key:
            logger.error("Apple public key not found for kid: %s", key_id)
            return None

        # Convert JWK to PEM format
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(apple_key)

        # Verify and decode the token
        decoded = jwt.decode(
            identity_token,
            public_key,
            algorithms=['RS256'],
            audience=settings.APPLE_CLIENT_ID if hasattr(settings, 'APPLE_CLIENT_ID') else None,
            issuer='https://appleid.apple.com',
            options={
                'verify_aud': hasattr(settings, 'APPLE_CLIENT_ID'),
                'verify_iss': True,
            }
        )

        # Verify nonce if provided
        if nonce and decoded.get('nonce_supported'):
            import hashlib
            expected_nonce = hashlib.sha256(nonce.encode()).hexdigest()
            if decoded.get('nonce') != expected_nonce:
                logger.error("Apple token nonce mismatch")
                return None

        return decoded

    except jwt.ExpiredSignatureError:
        logger.error("Apple token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.error("Invalid Apple token: %s", str(e))
        return None
    except Exception as e:
        logger.error("Error verifying Apple token: %s", str(e))
        return None


def verify_google_token(id_token_str):
    """
    Verify Google ID token and extract user info
    Returns decoded token data or None if invalid
    """
    try:
        # Verify the token with Google
        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None)

        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            google_client_id
        )

        # Verify the issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.error("Invalid Google token issuer: %s", idinfo['iss'])
            return None

        return idinfo

    except ValueError as e:
        logger.error("Invalid Google token: %s", str(e))
        return None
    except Exception as e:
        logger.error("Error verifying Google token: %s", str(e))
        return None


def get_or_create_social_user(email, first_name=None, last_name=None, provider='social'):
    """
    Get existing user by email or create a new one for social auth
    """
    try:
        user = User.objects.get(email=email)
        return user, False
    except User.DoesNotExist:
        # Create new user
        username = email.split('@')[0]
        # Ensure username is unique
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name or '',
            last_name=last_name or '',
        )
        user.set_unusable_password()  # Social auth users don't have passwords
        user.save()

        logger.info("Created new user via %s: %s", provider, email)
        return user, True


@api_view(['POST'])
@permission_classes([AllowAny])
def apple_auth(request):
    """
    Authenticate user with Apple Sign-In

    Expected request body:
    {
        "identity_token": "...",
        "authorization_code": "...",  # Optional
        "user_id": "...",
        "email": "...",  # Only provided on first sign-in
        "first_name": "...",  # Optional
        "last_name": "...",  # Optional
        "nonce": "..."  # Optional, for verification
    }
    """
    identity_token = request.data.get('identity_token')
    email = request.data.get('email')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    nonce = request.data.get('nonce')

    if not identity_token:
        return Response(
            {'error': 'Identity token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify the Apple token
    decoded_token = verify_apple_token(identity_token, nonce)

    if not decoded_token:
        return Response(
            {'error': 'Invalid or expired Apple token'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Get email from token or request
    token_email = decoded_token.get('email')
    user_email = token_email or email

    if not user_email:
        return Response(
            {'error': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get or create user
    user, created = get_or_create_social_user(
        email=user_email,
        first_name=first_name,
        last_name=last_name,
        provider='apple'
    )

    # Generate tokens
    tokens = get_tokens_for_user(user)

    return Response({
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
        'created': created,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """
    Authenticate user with Google Sign-In

    Expected request body:
    {
        "id_token": "...",
        "access_token": "..."  # Optional
    }
    """
    id_token_str = request.data.get('id_token')

    if not id_token_str:
        return Response(
            {'error': 'ID token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify the Google token
    decoded_token = verify_google_token(id_token_str)

    if not decoded_token:
        return Response(
            {'error': 'Invalid or expired Google token'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Extract user info from token
    email = decoded_token.get('email')
    first_name = decoded_token.get('given_name', '')
    last_name = decoded_token.get('family_name', '')

    if not email:
        return Response(
            {'error': 'Email not found in token'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify email is verified
    if not decoded_token.get('email_verified', False):
        return Response(
            {'error': 'Email not verified with Google'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get or create user
    user, created = get_or_create_social_user(
        email=email,
        first_name=first_name,
        last_name=last_name,
        provider='google'
    )

    # Generate tokens
    tokens = get_tokens_for_user(user)

    return Response({
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
        'created': created,
    })
