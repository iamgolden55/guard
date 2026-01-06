#!/usr/bin/env python
"""
Create test users for authentication and authorization testing.
Run with: python manage.py shell < create_test_users.py
"""

from django.contrib.auth import get_user_model
from api.models import SecurityCompany, UserCompanyMembership, StaffProfile
from datetime import date

User = get_user_model()

# Create test company
company, created = SecurityCompany.objects.get_or_create(
    name="Test Security Co",
    defaults={
        "registration_number": "TEST123456",
        "address_line_1": "123 Test Street",
        "city": "London",
        "postal_code": "SW1A 1AA",
        "country_code": "GBR",
        "primary_contact_phone": "+442012345678",
        "primary_contact_email": "admin@testsecurity.com",
        "primary_contact_name": "Test Administrator",
        "billing_email": "billing@testsecurity.com",
        "subscription_tier": "professional",
        "company_size": "medium",
        "industry_type": "mixed"
    }
)
print(f"{'Created' if created else 'Using existing'} company: {company.name}")

# Test users configuration
test_users = [
    {
        "username": "admin_test",
        "email": "admin_test@testsecurity.com",
        "password": "AdminPass123!",
        "first_name": "Admin",
        "last_name": "Test",
        "role": "admin",
        "is_active": True,
        "is_staff": True,
        "is_superuser": True,
        "membership_role": "admin"
    },
    {
        "username": "manager_test",
        "email": "manager_test@testsecurity.com",
        "password": "ManagerPass123!",
        "first_name": "Manager",
        "last_name": "Test",
        "role": "manager",
        "is_active": True,
        "is_staff": True,
        "is_superuser": False,
        "membership_role": "manager"
    },
    {
        "username": "staff_test",
        "email": "staff_test@testsecurity.com",
        "password": "StaffPass123!",
        "first_name": "Staff",
        "last_name": "Test",
        "role": "staff",
        "is_active": True,
        "is_staff": False,
        "is_superuser": False,
        "membership_role": "staff"
    },
    {
        "username": "inactive_test",
        "email": "inactive_test@testsecurity.com",
        "password": "InactivePass123!",
        "first_name": "Inactive",
        "last_name": "Test",
        "role": "staff",
        "is_active": False,
        "is_staff": False,
        "is_superuser": False,
        "membership_role": "staff"
    }
]

# Create or update test users
for user_data in test_users:
    username = user_data.pop("username")
    password = user_data.pop("password")
    user_role = user_data.pop("role")
    membership_role = user_data.pop("membership_role")

    user, created = User.objects.update_or_create(
        username=username,
        defaults={**user_data, "role": user_role}
    )

    # Always set password to ensure it's correct
    user.set_password(password)
    user.save()

    # Create or update company membership
    membership, membership_created = UserCompanyMembership.objects.update_or_create(
        user=user,
        company=company,
        defaults={
            "role": membership_role,
            "is_owner": (membership_role == "admin"),
            "is_active": user.is_active,
            "invitation_status": "accepted"
        }
    )

    # Create StaffProfile for all users (required by the system)
    if not hasattr(user, 'profile'):
        profile = StaffProfile.objects.create(
            user=user,
            phone_number="+442087654321",
            date_of_birth=date(1990, 1, 1),
            street="123 Test Street",
            city="London",
            postal_code="SW1A 1AA",
            country="United Kingdom",
            is_approved=True,
            notes="Test user for authentication testing"
        )
        print(f"Created profile for {username}")
    else:
        profile = user.profile
        profile.is_approved = True
        profile.save()
        print(f"Updated profile for {username}")

    print(f"{'Created' if created else 'Updated'} user: {username} (role: {user_role}, active: {user.is_active})")

print("\n✅ Test users created successfully!")
print("\nTest Users:")
print("=" * 70)
print(f"{'Username':<20} {'Password':<20} {'Role':<10} {'Active':<8}")
print("=" * 70)

# Display credentials
credentials = [
    ("admin_test", "AdminPass123!", "admin", "Yes"),
    ("manager_test", "ManagerPass123!", "manager", "Yes"),
    ("staff_test", "StaffPass123!", "staff", "Yes"),
    ("inactive_test", "InactivePass123!", "staff", "No")
]

for username, password, role, active in credentials:
    print(f"{username:<20} {password:<20} {role:<10} {active:<8}")
print("=" * 70)