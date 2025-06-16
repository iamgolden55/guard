import os
import json
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from api.models import User, Venue
from api.serializers import ShiftSerializer

# Get the staff user without valid SIA license or approval
user = User.objects.get(first_name='Ninioritse')
venue = Venue.objects.first()

# Create shift data
start_time = timezone.now() + timezone.timedelta(days=1)
end_time = start_time + timezone.timedelta(hours=8)
shift_data = {
    'venue': venue.id,
    'staff_user': user.id,
    'start_time': start_time,
    'end_time': end_time,
    'status': 'scheduled',
    'pay_rate': 15.0
}

# Test validation
serializer = ShiftSerializer(data=shift_data)
valid = serializer.is_valid()
print(f'Is valid: {valid}')

if not valid:
    print(f'Validation errors:')
    for field, errors in serializer.errors.items():
        print(f"  {field}: {errors}") 