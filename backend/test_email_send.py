#!/usr/bin/env python
"""
Test email sending directly
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("=" * 80)
print("EMAIL CONFIGURATION TEST")
print("=" * 80)
print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
print(f"EMAIL_HOST_PASSWORD: {'*' * len(settings.EMAIL_HOST_PASSWORD) if settings.EMAIL_HOST_PASSWORD else 'NOT SET'}")
print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
print("=" * 80)

try:
    print("\nAttempting to send test email...")
    result = send_mail(
        subject='Test Email from Password Reset System',
        message='This is a test email to verify email sending is working.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=['eruwagolden55@gmail.com'],
        fail_silently=False,
    )
    print(f"✓ Email sent successfully! Result: {result}")
    print(f"  Check inbox at: eruwagolden55@gmail.com")
except Exception as e:
    print(f"✗ Failed to send email: {e}")
    print(f"  Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()

print("=" * 80)
