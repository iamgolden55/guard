import os
import django
import sys
from datetime import datetime, timedelta, time

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Import models
from django.utils import timezone
from api.models import User, Venue, Shift, ShiftTemplate
from api.serializers import ShiftSerializer, ShiftTemplateSerializer
from django.db import transaction

# Test configuration
TEST_PREFIX = "[TEST]"  # Used to mark test data for easy cleanup later

# Helper function to print section headers
def print_header(title):
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80)

# Helper function to print test results
def print_result(name, success, message=""):
    if success:
        result = "✅ PASSED"
    else:
        result = "❌ FAILED"
    
    print(f"{result} | {name}")
    if message:
        print(f"      {message}")

# Get admin user for testing
def get_admin_user():
    try:
        # Try to get a user with 'admin' in their username
        admin = User.objects.filter(username__icontains='admin').first()
        if not admin:
            # Fallback to the first user who is a superuser if available
            admin = User.objects.filter(is_superuser=True).first()
        if not admin:
            # Last resort: just get the first user
            admin = User.objects.first()
        return admin
    except Exception as e:
        print(f"Error getting admin user: {e}")
        return None

# Get a staff user with valid SIA license and approved profile
def get_eligible_staff():
    try:
        # Filter for approved staff with valid SIA license
        eligible_staff = User.objects.filter(
            profile__is_approved=True,
            profile__sia_licenses__status='valid'
        ).distinct().first()
        
        if not eligible_staff:
            print("No eligible staff found (approved with valid SIA license)")
            # Try to find any user with a profile as fallback
            return User.objects.filter(profile__isnull=False).first()
        
        return eligible_staff
    except Exception as e:
        print(f"Error getting eligible staff: {e}")
        return None

# Get a venue for testing
def get_test_venue():
    try:
        return Venue.objects.first()
    except Exception as e:
        print(f"Error getting test venue: {e}")
        return None

# Test 1: Create a single shift
def test_single_shift_creation():
    print_header("TEST 1: Single Shift Creation")
    
    # Get test data
    venue = get_test_venue()
    staff = get_eligible_staff()
    
    if not venue:
        print_result("Single Shift Creation", False, "No venue available for testing")
        return False
    
    try:
        # Create a shift starting tomorrow
        start_time = timezone.now() + timedelta(days=1)
        end_time = start_time + timedelta(hours=6)
        
        shift = Shift.objects.create(
            venue=venue,
            start_time=start_time,
            end_time=end_time,
            required_security_role='ds',  # Door Supervisor
            status='open',
            notes=f"{TEST_PREFIX} Test shift created via script"
        )
        
        print(f"Created shift: ID={shift.id}, Venue={venue.name}, Start={start_time}, End={end_time}")
        
        # If we have an eligible staff, try assigning them
        if staff:
            try:
                # Test staff assignment
                shift.staff_user = staff
                shift.status = 'scheduled'
                shift.save()
                print(f"Assigned staff: {staff.first_name} {staff.last_name} (ID: {staff.id})")
                print_result("Staff Assignment", True)
            except Exception as e:
                print(f"Staff assignment failed: {e}")
                print_result("Staff Assignment", False, str(e))
        else:
            print("No eligible staff available for testing assignment")
        
        print_result("Single Shift Creation", True)
        return shift.id
        
    except Exception as e:
        print_result("Single Shift Creation", False, str(e))
        return False

# Test 2: Create a shift template
def test_template_creation():
    print_header("TEST 2: Shift Template Creation")
    
    venue = get_test_venue()
    if not venue:
        print_result("Template Creation", False, "No venue available for testing")
        return False
    
    try:
        template = ShiftTemplate.objects.create(
            name=f"{TEST_PREFIX} Weekend Security",
            venue=venue,
            days_of_week=[4, 5],  # Friday and Saturday
            start_time=time(hour=20, minute=0),  # 8:00 PM
            end_time=time(hour=2, minute=0),     # 2:00 AM (next day)
            required_security_role='ds',
            min_staff_required=2,
            notes=f"{TEST_PREFIX} Test template created via script"
        )
        
        print(f"Created template: ID={template.id}, Name={template.name}")
        print(f"Days: Fri, Sat | Hours: 8:00 PM - 2:00 AM | Venue: {venue.name}")
        
        print_result("Template Creation", True)
        return template.id
        
    except Exception as e:
        print_result("Template Creation", False, str(e))
        return False

# Test 3: Generate shifts from template
def test_template_application(template_id):
    print_header("TEST 3: Generate Shifts from Template")
    
    if not template_id:
        print_result("Template Application", False, "No template ID provided")
        return False
    
    try:
        template = ShiftTemplate.objects.get(id=template_id)
        
        # Generate shifts for the next 2 weeks
        start_date = timezone.now().date()
        end_date = start_date + timedelta(days=14)
        
        print(f"Applying template {template.name} from {start_date} to {end_date}")
        
        shifts = []
        current_date = start_date
        
        while current_date <= end_date:
            # Check if current day is in template's days_of_week
            if current_date.weekday() in template.days_of_week:
                # Create shift start and end times
                shift_start = datetime.combine(current_date, template.start_time)
                shift_end = datetime.combine(current_date, template.end_time)
                
                # Handle overnight shifts
                if template.end_time < template.start_time:
                    shift_end += timedelta(days=1)
                
                # Create the shift
                shift = Shift.objects.create(
                    venue=template.venue,
                    template=template,
                    start_time=shift_start,
                    end_time=shift_end,
                    required_security_role=template.required_security_role,
                    status='open',
                    notes=f"{TEST_PREFIX} Generated from template {template.name}"
                )
                shifts.append(shift)
                print(f"Created shift: ID={shift.id}, Date={current_date}, Hours={template.start_time}-{template.end_time}")
            
            current_date += timedelta(days=1)
        
        print(f"Generated {len(shifts)} shifts from template")
        print_result("Template Application", True)
        return [s.id for s in shifts]
        
    except Exception as e:
        print_result("Template Application", False, str(e))
        return False

# Test 4: Bulk shift creation
def test_bulk_shift_creation():
    print_header("TEST 4: Bulk Shift Creation")
    
    venue = get_test_venue()
    if not venue:
        print_result("Bulk Shift Creation", False, "No venue available for testing")
        return False
    
    try:
        # Create shifts for a special event week
        start_date = timezone.now().date() + timedelta(days=21)  # 3 weeks from now
        end_date = start_date + timedelta(days=6)  # One week duration
        
        print(f"Creating bulk shifts from {start_date} to {end_date}")
        
        shifts = []
        current_date = start_date
        
        # Create one shift per day for the entire week
        while current_date <= end_date:
            shift_start = datetime.combine(current_date, time(hour=18, minute=0))  # 6:00 PM
            shift_end = datetime.combine(current_date, time(hour=23, minute=0))    # 11:00 PM
            
            shift = Shift.objects.create(
                venue=venue,
                start_time=shift_start,
                end_time=shift_end,
                required_security_role='sg',  # Security Guard
                status='open',
                notes=f"{TEST_PREFIX} Bulk created shift for special event"
            )
            shifts.append(shift)
            print(f"Created shift: ID={shift.id}, Date={current_date}, Hours=6:00 PM-11:00 PM")
            
            current_date += timedelta(days=1)
        
        print(f"Created {len(shifts)} shifts in bulk")
        print_result("Bulk Shift Creation", True)
        return [s.id for s in shifts]
        
    except Exception as e:
        print_result("Bulk Shift Creation", False, str(e))
        return False

# Test 5: Shift completion and manager signature
def test_shift_completion(shift_id):
    print_header("TEST 5: Shift Completion and Manager Signature")
    
    if not shift_id:
        print_result("Shift Completion", False, "No shift ID provided")
        return False
    
    try:
        shift = Shift.objects.get(id=shift_id)
        admin = get_admin_user()
        
        # Simulate completing a shift
        shift.status = 'completed'
        shift.check_in_time = shift.start_time
        shift.check_out_time = shift.end_time
        shift.actual_hours_worked = (shift.end_time - shift.start_time).total_seconds() / 3600
        shift.save()
        
        print(f"Marked shift ID={shift.id} as completed")
        print(f"Hours worked: {shift.actual_hours_worked:.2f}")
        
        # Check if manager signature is required
        if shift._meta.get_field('manager_signature'):
            print("Manager signature field exists and may be required for approval")
            
            # Try to approve without signature
            shift.manager_approved = True
            shift.save()
            
            # Now set a signature and approve
            if admin:
                shift.manager_user = admin
                shift.manager_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...sample_signature..."
                shift.manager_notes = "Shift completed successfully"
                shift.status = 'approved'
                shift.save()
                
                print(f"Shift approved by admin: {admin.username}")
                print(f"Manager signature provided: {'Yes' if shift.manager_signature else 'No'}")
                print_result("Manager Approval", True)
            else:
                print("No admin user available for testing manager approval")
        else:
            print("Manager signature field does not exist in the model")
        
        print_result("Shift Completion", True)
        return True
        
    except Exception as e:
        print_result("Shift Completion", False, str(e))
        return False

# Run all tests
def run_all_tests():
    print("\n\n" + "*" * 100)
    print(" MEAD SECURITY SHIFT SYSTEM TEST SUITE ".center(100, "*"))
    print("*" * 100)
    
    # Test 1: Create a single shift
    shift_id = test_single_shift_creation()
    
    # Test 2: Create a template
    template_id = test_template_creation()
    
    # Test 3: Generate shifts from template
    if template_id:
        template_shifts = test_template_application(template_id)
    
    # Test 4: Bulk shift creation
    bulk_shifts = test_bulk_shift_creation()
    
    # Test 5: Test shift completion with the first shift we created
    if shift_id:
        test_shift_completion(shift_id)
    
    print("\n\n" + "*" * 100)
    print(" TEST SUMMARY ".center(100, "*"))
    print("*" * 100)
    print(f"Single Shift Created: {'Yes' if shift_id else 'No'}")
    print(f"Template Created: {'Yes' if template_id else 'No'}")
    print(f"Shifts Generated from Template: {len(template_shifts) if isinstance(template_shifts, list) else 0}")
    print(f"Bulk Shifts Created: {len(bulk_shifts) if isinstance(bulk_shifts, list) else 0}")
    print("*" * 100)

# Run the tests if this script is executed directly
if __name__ == "__main__":
    run_all_tests() 