import os
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import SIALicense, StaffProfile

def check_sia_licenses():
    """List all SIA licenses in the database with detailed information"""
    print("\nSIA Licenses in Database:")
    print("-" * 120)
    print(f"{'ID':<5} {'Staff Profile ID':<15} {'Staff Name':<30} {'License Number':<20} {'License Type':<15} {'Status':<10}")
    print("-" * 120)
    
    sia_licenses = SIALicense.objects.all().select_related('staff_profile__user')
    
    if not sia_licenses:
        print("No SIA licenses found in the database.")
    
    for license in sia_licenses:
        staff_name = f"{license.staff_profile.user.first_name} {license.staff_profile.user.last_name}"
        print(f"{license.id:<5} {license.staff_profile.id:<15} {staff_name:<30} "
              f"{license.license_number:<20} {license.license_type:<15} {license.status:<10}")
    
    print("-" * 120)

def check_staff_profiles_with_licenses():
    """List all staff profiles and whether they have SIA licenses"""
    print("\nStaff Profiles and Their SIA Licenses:")
    print("-" * 120)
    print(f"{'ID':<5} {'Staff Name':<30} {'Email':<30} {'Approved':<10} {'License Count':<15} {'Has Valid License'}")
    print("-" * 120)
    
    staff_profiles = StaffProfile.objects.all().select_related('user')
    
    for profile in staff_profiles:
        licenses = SIALicense.objects.filter(staff_profile=profile)
        license_count = licenses.count()
        
        # Check if staff has any valid licenses with actual data
        has_valid_license = licenses.filter(
            license_number__isnull=False,
            license_type__isnull=False
        ).exists()
        
        staff_name = f"{profile.user.first_name} {profile.user.last_name}"
        print(f"{profile.id:<5} {staff_name:<30} {profile.user.email:<30} "
              f"{'Yes' if profile.is_approved else 'No':<10} {license_count:<15} {'Yes' if has_valid_license else 'No'}")
    
    print("-" * 120)

if __name__ == "__main__":
    check_sia_licenses()
    check_staff_profiles_with_licenses() 