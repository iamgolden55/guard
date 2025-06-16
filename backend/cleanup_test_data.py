import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import Shift, ShiftTemplate
from django.db.models import Q

# The prefix used for test data
TEST_PREFIX = "[TEST]"

def cleanup_test_data():
    print("\n" + "=" * 80)
    print(" CLEANING UP TEST DATA ".center(80, "="))
    print("=" * 80)
    
    # Delete test shifts
    shifts = Shift.objects.filter(notes__startswith=TEST_PREFIX)
    shift_count = shifts.count()
    shifts.delete()
    print(f"Deleted {shift_count} test shifts")
    
    # Delete test templates
    templates = ShiftTemplate.objects.filter(
        Q(name__startswith=TEST_PREFIX) | Q(notes__startswith=TEST_PREFIX)
    )
    template_count = templates.count()
    templates.delete()
    print(f"Deleted {template_count} test templates")
    
    print("Cleanup complete!")

if __name__ == "__main__":
    cleanup_test_data() 