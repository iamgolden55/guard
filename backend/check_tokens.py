#!/usr/bin/env python
"""Quick script to check device tokens"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import SNSDeviceToken

print("\n=== Active Device Tokens ===")
tokens = SNSDeviceToken.objects.filter(is_active=True).select_related('user')
if tokens.exists():
    for token in tokens:
        print(f"User {token.user_id} ({token.user.email}): {token.token[:30]}...")
        print(f"  Registered: {token.registered_at}")
        print(f"  Last used: {token.last_used_at}\n")
else:
    print("No active tokens found!\n")

print(f"Total active tokens: {tokens.count()}")
