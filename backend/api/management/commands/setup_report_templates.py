"""
Management command to set up sample report templates
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.utils.report_generator import create_sample_templates

User = get_user_model()


class Command(BaseCommand):
    help = 'Set up sample report templates for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-user',
            type=str,
            help='Username of admin user to assign as template creator',
            default='admin'
        )

    def handle(self, *args, **options):
        admin_username = options['admin_user']

        # Try to find admin user
        try:
            admin_user = User.objects.get(username=admin_username)
            self.stdout.write(f"Found admin user: {admin_user.username}")
        except User.DoesNotExist:
            # Try to find any admin user
            admin_user = User.objects.filter(role='admin').first()
            if not admin_user:
                # Create a default admin user for templates
                admin_user = User.objects.create_user(
                    username='system_admin',
                    email='admin@system.local',
                    role='admin',
                    first_name='System',
                    last_name='Administrator'
                )
                self.stdout.write(f"Created system admin user: {admin_user.username}")
            else:
                self.stdout.write(f"Using existing admin user: {admin_user.username}")

        # Create sample templates
        try:
            templates = create_sample_templates(admin_user)

            # Set the created_by field for all templates
            for template in templates:
                if not template.created_by:
                    template.created_by = admin_user
                    template.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created {len(templates)} sample report templates'
                )
            )

            # List created templates
            for template in templates:
                self.stdout.write(f"  - {template.name} ({template.template_type})")

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating templates: {str(e)}')
            )
            raise