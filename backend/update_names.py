import os
import django

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

# Import the user model
from django.contrib.auth import get_user_model
User = get_user_model()

# Find all users with empty first_name and last_name fields
empty_name_users = User.objects.filter(first_name="", last_name="")
print(f"Found {empty_name_users.count()} users with empty names")

# Update each user
for user in empty_name_users:
    # Set first_name to capitalized username
    user.first_name = user.username.capitalize()
    # Set last_name to "User"
    user.last_name = "User"
    user.save()
    print(f"Updated {user.username} -> {user.first_name} {user.last_name}")

print("Name update complete!") 