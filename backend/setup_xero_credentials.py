#!/usr/bin/env python
"""
Script to set up Xero OAuth credentials in the database.

Usage:
    python setup_xero_credentials.py

This will prompt you to enter your Xero Client ID and Client Secret.
"""

import os
import sys
import django

# Set up Django environment
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from finance_integrations.models import AccountingProvider

def setup_xero_credentials():
    """Interactive setup for Xero OAuth credentials"""

    print("\n" + "="*60)
    print("XERO OAUTH CREDENTIALS SETUP")
    print("="*60)
    print("\nThis script will configure your Xero OAuth credentials.")
    print("\nBefore proceeding, make sure you have:")
    print("  1. Created a Xero app at https://developer.xero.com/")
    print("  2. Copied your Client ID and Client Secret")
    print("  3. Set redirect URI to: http://localhost:3000/admin/finance-integrations/oauth-callback")
    print("\n")

    # Get credentials from user
    client_id = input("Enter your Xero Client ID: ").strip()
    if not client_id:
        print("❌ Client ID cannot be empty!")
        return False

    client_secret = input("Enter your Xero Client Secret: ").strip()
    if not client_secret:
        print("❌ Client Secret cannot be empty!")
        return False

    # Confirm
    print(f"\n📋 You entered:")
    print(f"   Client ID: {client_id[:20]}...")
    print(f"   Client Secret: {client_secret[:10]}...")
    confirm = input("\n✓ Is this correct? (yes/no): ").strip().lower()

    if confirm not in ['yes', 'y']:
        print("❌ Cancelled. Please run again with correct credentials.")
        return False

    # Update database
    try:
        xero_provider = AccountingProvider.objects.get(provider_key='xero')

        # Update credentials
        xero_provider.oauth_client_id = client_id
        xero_provider.oauth_client_secret = client_secret

        # Set default scopes if not already set
        if not xero_provider.oauth_scopes:
            xero_provider.oauth_scopes = (
                "offline_access "
                "accounting.transactions "
                "accounting.contacts "
                "accounting.settings.read "
                "payroll.employees "
                "payroll.payruns "
                "payroll.timesheets"
            )

        xero_provider.is_active = True
        xero_provider.save()

        print("\n" + "="*60)
        print("✅ SUCCESS! Xero credentials configured!")
        print("="*60)
        print(f"\nProvider: {xero_provider.display_name}")
        print(f"Status: {'Active' if xero_provider.is_active else 'Inactive'}")
        print(f"Client ID: {xero_provider.oauth_client_id[:20]}...")
        print(f"Scopes: {xero_provider.oauth_scopes}")
        print("\n🎉 You can now connect to Xero from the Finance Integrations page!")
        print("\n")
        return True

    except AccountingProvider.DoesNotExist:
        print("\n❌ ERROR: Xero provider not found in database!")
        print("   Please run migrations first: python manage.py migrate")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: Failed to save credentials: {e}")
        return False

if __name__ == '__main__':
    success = setup_xero_credentials()
    sys.exit(0 if success else 1)
