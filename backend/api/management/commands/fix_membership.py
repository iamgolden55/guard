"""
Fix missing company membership for users who completed onboarding.

This command diagnoses and fixes the issue where a user has completed
onboarding but their UserCompanyMembership record is missing.

Usage:
    python manage.py fix_membership                    # Fix all users with missing memberships
    python manage.py fix_membership --user=1          # Fix specific user by ID
    python manage.py fix_membership --email=admin@example.com  # Fix by email
    python manage.py fix_membership --dry-run         # Show what would be done without making changes
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify
import uuid

from api.models import SecurityCompany, UserCompanyMembership, CompanyOnboarding

User = get_user_model()


class Command(BaseCommand):
    help = 'Fix missing company membership for users who completed onboarding'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=int,
            help='User ID to fix',
        )
        parser.add_argument(
            '--email',
            type=str,
            help='User email to fix',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--company-name',
            type=str,
            help='Company name to use when creating a new company',
        )

    def handle(self, *args, **options):
        user_id = options.get('user')
        email = options.get('email')
        dry_run = options.get('dry_run')
        company_name = options.get('company_name')

        self.stdout.write(self.style.NOTICE('\n' + '=' * 60))
        self.stdout.write(self.style.NOTICE('  FIX MEMBERSHIP COMMAND'))
        self.stdout.write(self.style.NOTICE('=' * 60 + '\n'))

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made\n'))

        # Find target users
        if user_id:
            users = User.objects.filter(id=user_id)
        elif email:
            users = User.objects.filter(email=email)
        else:
            # Find all users without memberships who are not staff role
            users = User.objects.filter(
                company_memberships__isnull=True
            ).exclude(role='staff')

        if not users.exists():
            self.stdout.write(self.style.SUCCESS('No users found that need fixing.'))
            return

        for user in users:
            self._fix_user(user, dry_run, company_name)

    def _fix_user(self, user, dry_run, company_name=None):
        """Fix membership for a single user"""
        self.stdout.write(self.style.NOTICE(f'\n--- Processing User ---'))
        self.stdout.write(f'  ID: {user.id}')
        self.stdout.write(f'  Email: {user.email}')
        self.stdout.write(f'  Username: {user.username}')
        self.stdout.write(f'  Role: {user.role}')
        self.stdout.write(f'  First Name: {user.first_name}')
        self.stdout.write(f'  Last Name: {user.last_name}')

        # Check existing memberships
        memberships = UserCompanyMembership.objects.filter(user=user)
        if memberships.exists():
            self.stdout.write(self.style.SUCCESS(f'  ✓ User already has {memberships.count()} membership(s)'))
            for m in memberships:
                self.stdout.write(f'    - {m.company.name} ({m.role})')
            return

        self.stdout.write(self.style.WARNING('  ✗ No company membership found'))

        # Check for existing companies
        companies = SecurityCompany.objects.all()
        self.stdout.write(f'\n  Existing Companies: {companies.count()}')
        for c in companies[:5]:  # Show first 5
            self.stdout.write(f'    - {c.name} (ID: {c.id})')

        # Determine which company to use
        company = None
        created_company = False

        if companies.exists():
            # Use the first company (or one owned by user if exists)
            company = companies.first()
            self.stdout.write(f'\n  Will use existing company: {company.name}')
        else:
            # Need to create a company
            self.stdout.write(self.style.WARNING('\n  No companies exist - need to create one'))

            # Determine company name
            if company_name:
                new_company_name = company_name
            elif user.first_name or user.last_name:
                new_company_name = f"{user.first_name} {user.last_name} Security".strip()
            else:
                new_company_name = f"{user.email.split('@')[0]} Security"

            self.stdout.write(f'  Company name: {new_company_name}')

            if not dry_run:
                with transaction.atomic():
                    company = SecurityCompany.objects.create(
                        name=new_company_name,
                        slug=slugify(new_company_name)[:100],
                        registration_number=f"AUTO-{uuid.uuid4().hex[:8].upper()}",
                        country_code='GBR',
                        city='London',
                        postal_code='N/A',
                        address_line_1='To be updated',
                        is_active=True,
                    )
                    created_company = True
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Created company: {company.name}'))

                    # Create onboarding record
                    CompanyOnboarding.objects.create(
                        company=company,
                        current_step=5,
                        company_info_completed=True,
                        regional_setup_completed=True,
                        staff_setup_completed=True,
                        integrations_completed=True,
                        finalization_completed=True,
                    )
                    self.stdout.write(self.style.SUCCESS('  ✓ Created onboarding record (marked complete)'))
            else:
                self.stdout.write(self.style.WARNING(f'  [DRY RUN] Would create company: {new_company_name}'))

        # Create membership
        if company and not dry_run:
            with transaction.atomic():
                # Determine role based on user's role field
                membership_role = 'owner' if user.role in ['admin', 'owner'] else user.role
                if membership_role not in ['owner', 'admin', 'manager', 'staff', 'viewer']:
                    membership_role = 'owner'

                membership = UserCompanyMembership.objects.create(
                    user=user,
                    company=company,
                    role=membership_role,
                    is_active=True,
                    invitation_status='accepted',
                )
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created membership: {membership.role} at {company.name}'))
        elif dry_run:
            self.stdout.write(self.style.WARNING(f'  [DRY RUN] Would create membership for user'))

        # Summary
        self.stdout.write(self.style.SUCCESS(f'\n  === User {user.email} fixed ==='))
        if created_company:
            self.stdout.write(self.style.NOTICE('  Note: Company details should be updated via admin panel'))
