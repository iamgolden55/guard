import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import StaffProfile, SIALicense

def list_staff_profiles():
    """List all staff profiles with their approval status and SIA license info"""
    print("\nStaff Profiles:")
    print("-" * 80)
    print(f"{'ID':<5} {'Username':<15} {'Name':<25} {'Email':<30} {'Approved':<10} {'SIA Licenses'}")
    print("-" * 80)
    
    for sp in StaffProfile.objects.all().select_related('user'):
        # Count SIA licenses for this profile
        license_count = SIALicense.objects.filter(staff_profile=sp).count()
        
        print(f"{sp.id:<5} {sp.user.username:<15} {sp.user.first_name + ' ' + sp.user.last_name:<25} "
              f"{sp.user.email:<30} {'Yes' if sp.is_approved else 'No':<10} {license_count}")
    
    print("-" * 80)

def approve_staff(staff_id):
    """Approve a staff profile by ID"""
    try:
        profile = StaffProfile.objects.get(id=staff_id)
        profile.is_approved = True
        profile.save()
        print(f"Staff {profile.user.first_name} {profile.user.last_name} has been approved.")
    except StaffProfile.DoesNotExist:
        print(f"No staff profile found with ID {staff_id}")

if __name__ == "__main__":
    list_staff_profiles()
    
    if len(sys.argv) > 1 and sys.argv[1] == 'approve':
        if len(sys.argv) > 2:
            staff_id = int(sys.argv[2])
            approve_staff(staff_id)
        else:
            print("Please provide a staff ID to approve. Example: python approve_staff.py approve 1")
    else:
        print("\nTo approve a staff member, run: python approve_staff.py approve <staff_id>") 