#!/usr/bin/env python
"""
Test password reset email sending with template
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from api.models import User, PasswordResetToken

print("=" * 80)
print("PASSWORD RESET EMAIL TEST")
print("=" * 80)

# Get a user
user = User.objects.filter(email='eruwagolden334@gmail.com').first()
if not user:
    print("✗ User not found!")
    exit(1)

print(f"User: {user.username} ({user.email})")

# Create a token
token = PasswordResetToken.objects.create(
    user=user,
    ip_address='127.0.0.1'
)
print(f"Token created: {token.token}")

# Build reset URL
frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000'
reset_url = f"{frontend_url}/reset-password/confirm/{token.token}"
print(f"Reset URL: {reset_url}")

# Try to render the email template
try:
    context = {
        'user': user,
        'reset_url': reset_url,
        'expiry_hours': 24
    }

    print("\nAttempting to render HTML template...")
    html_message = render_to_string('password_reset_email.html', context)
    print("✓ HTML template rendered successfully")
    print(f"  Template length: {len(html_message)} characters")

    plain_message = strip_tags(html_message)
    print("✓ Plain text message created")

    print("\nAttempting to send email...")
    result = send_mail(
        subject='Password Reset Request',
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )

    print(f"✓ Password reset email sent successfully! Result: {result}")
    print(f"  Check inbox at: {user.email}")

    # Clean up test token
    token.delete()
    print("\n✓ Test token cleaned up")

except Exception as e:
    print(f"\n✗ Error: {e}")
    print(f"  Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()

    # Clean up test token
    try:
        token.delete()
    except:
        pass

print("=" * 80)
