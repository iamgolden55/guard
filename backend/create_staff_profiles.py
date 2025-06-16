#!/usr/bin/env python
import os
import sys
import django
from datetime import date
from random import randint

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Now import the models
from api.models import User, StaffProfile

def create_missing_profiles():
    print("Creating staff profiles for users without profiles...")
    # Get all users that don't have a profile
    users_without_profiles = User.objects.filter(profile__isnull=True)
    
    created_profiles = []
    for user in users_without_profiles:
        # Generate random DOB between 18 and 65 years ago
        year = date.today().year - randint(18, 65)
        month = randint(1, 12)
        day = randint(1, 28)  # Using 28 to avoid month-end issues
        dob = date(year, month, day)
        
        # Generate a unique National Insurance number (for demo)
        ni_number = f"AB{randint(100000, 999999)}C"
        
        # Create the profile
        profile = StaffProfile.objects.create(
            user=user,
            phone_number=f"07{randint(700000000, 999999999)}",
            date_of_birth=dob,
            national_insurance_number=ni_number,
            street=f"{randint(1, 100)} Test Street",
            city="London",
            postal_code=f"SW{randint(1, 20)} {randint(1, 9)}AB",
            country="United Kingdom"
        )
        print(f"Created profile for {user.username}")
        created_profiles.append(profile.id)
    
    print(f"Created {len(created_profiles)} new profiles")
    return created_profiles

if __name__ == "__main__":
    created = create_missing_profiles()
    print(f"Created profiles with IDs: {created}") 