"""
Management command to migrate existing users to multi-tenant system.
Handles the conversion from single-tenant to multi-tenant architecture.

Usage:
    python manage.py migrate_existing_users [--dry-run] [--company-name="Company Name"]
"""
import uuid
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from api.models import SecurityCompany, UserCompanyMembership, CompanyOnboarding

User = get_user_model()


class Command(BaseCommand):
    help = 'Migrate existing users to multi-tenant system by creating company memberships'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--company-name',
            type=str,
            default='Legacy Security Company',
            help='Name for the default company (default: "Legacy Security Company")',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Skip users who already have company memberships',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        company_name = options['company_name']
        skip_existing = options['skip_existing']

        self.stdout.write(
            self.style.SUCCESS(
                f"{'[DRY RUN] ' if dry_run else ''}Starting multi-tenant user migration..."
            )
        )

        # Find users without company memberships
        if skip_existing:
            orphaned_users = User.objects.filter(
                company_memberships__isnull=True
            ).distinct().order_by('date_joined')
        else:
            orphaned_users = User.objects.all().order_by('date_joined')

        if not orphaned_users.exists():
            self.stdout.write(
                self.style.WARNING("No users found that need migration.")
            )
            return

        self.stdout.write(
            f"Found {orphaned_users.count()} users to migrate:"
        )

        # Display users to be migrated
        for user in orphaned_users[:10]:  # Show first 10
            role = self._determine_user_role(user)
            self.stdout.write(f"  - {user.username} ({user.email}) -> {role}")

        if orphaned_users.count() > 10:
            self.stdout.write(f"  ... and {orphaned_users.count() - 10} more users")

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN - No changes made. Run without --dry-run to execute migration."
                )
            )
            return

        # Confirm with user
        if not options.get('verbosity', 1) == 0:  # Skip confirmation in non-interactive mode
            confirm = input(f"\nProceed with migration? (y/N): ")
            if confirm.lower() != 'y':
                self.stdout.write(self.style.ERROR("Migration cancelled."))
                return

        try:
            with transaction.atomic():
                # Create or get default company
                default_company = self._create_default_company(
                    company_name, orphaned_users
                )

                # Migrate users
                migrated_count = self._migrate_users(orphaned_users, default_company)

                # Migrate existing data to company
                self._migrate_existing_data(default_company)

                # Complete onboarding for the company
                self._complete_company_onboarding(default_company)

                # Validate migration was successful
                self._validate_migration(default_company)

                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ Successfully migrated {migrated_count} users to company: {default_company.name}"
                    )
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Migration failed: {str(e)}")
            )
            raise CommandError(f"Migration failed: {str(e)}")

    def _determine_user_role(self, user):
        """Determine the appropriate role for a user in the new system"""
        if user.is_superuser:
            return 'owner'
        elif user.is_staff or getattr(user, 'role', '') == 'admin':
            return 'admin'
        elif getattr(user, 'role', '') == 'manager':
            return 'manager'
        else:
            return 'staff'

    def _create_default_company(self, company_name, users):
        """Create or get the default company for migration"""
        # Try to find existing company with similar name
        existing_company = SecurityCompany.objects.filter(
            name__icontains='legacy'
        ).first()

        if existing_company:
            self.stdout.write(f"Using existing company: {existing_company.name}")
            return existing_company

        # Find the first superuser or staff user to be the creator
        creator = users.filter(is_superuser=True).first()
        if not creator:
            creator = users.filter(is_staff=True).first()
        if not creator:
            creator = users.first()

        self.stdout.write(f"Creating default company: {company_name}")

        # Create company with minimal required fields
        default_company = SecurityCompany.objects.create(
            name=company_name,
            trading_name=company_name,
            registration_number=f"LEGACY{str(uuid.uuid4())[:8].upper()}",
            tax_id=f"TAX{str(uuid.uuid4())[:8].upper()}",
            country_code='GBR',  # Default to UK
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='Legacy Address',
            billing_email=creator.email if creator else 'admin@example.com',
            primary_contact_name=creator.get_full_name() if creator else 'System Admin',
            primary_contact_email=creator.email if creator else 'admin@example.com',
            primary_contact_phone='+44 20 1234 5678',
            industry_type='security',
            company_size='medium',
            subscription_tier='professional',
            staff_capacity=100,
            venue_capacity=50,
            subscription_start_date=timezone.now().date(),
            subscription_end_date=timezone.now().date().replace(year=timezone.now().year + 1),
            timezone='Europe/London',
            currency='GBP',
            created_by=creator,
            is_active=True
        )

        return default_company

    def _migrate_users(self, users, company):
        """Create company memberships for users"""
        migrated_count = 0

        for user in users:
            # Skip if user already has membership to this company
            if UserCompanyMembership.objects.filter(
                user=user,
                company=company
            ).exists():
                continue

            role = self._determine_user_role(user)
            is_owner = role == 'owner'

            membership = UserCompanyMembership.objects.create(
                user=user,
                company=company,
                role=role,
                is_owner=is_owner,
                is_active=True,
                invitation_status='accepted',
                joined_at=timezone.now(),
                invited_by=None,  # Auto-migration, no inviter
                permissions={},
                access_restrictions={}
            )

            self.stdout.write(f"✓ Migrated {user.username} as {role}")
            migrated_count += 1

        return migrated_count

    def _migrate_existing_data(self, company):
        """Link existing venues, shifts, and other data to the company"""
        self.stdout.write("Migrating existing data to company...")

        try:
            # Import here to avoid circular imports
            from api.models import Venue, Shift, Invoice

            # Migrate venues
            venues_updated = Venue.objects.filter(company__isnull=True).update(company=company)
            if venues_updated:
                self.stdout.write(f"✓ Linked {venues_updated} venues to company")

            # Migrate shifts (if they have a company field)
            shifts_updated = 0
            if hasattr(Shift, 'company'):
                shifts_updated = Shift.objects.filter(company__isnull=True).update(company=company)
                if shifts_updated:
                    self.stdout.write(f"✓ Linked {shifts_updated} shifts to company")

            # Migrate invoices (if they have a company field)
            invoices_updated = 0
            if hasattr(Invoice, 'company'):
                invoices_updated = Invoice.objects.filter(company__isnull=True).update(company=company)
                if invoices_updated:
                    self.stdout.write(f"✓ Linked {invoices_updated} invoices to company")

            # Update company with existing data counts
            company.refresh_from_db()

        except Exception as e:
            self.stdout.write(
                self.style.WARNING(
                    f"Warning: Could not migrate some existing data: {str(e)}"
                )
            )

    def _complete_company_onboarding(self, company):
        """Mark onboarding as completed for the migrated company"""
        self.stdout.write("Completing company onboarding...")

        # Get or create the onboarding record
        onboarding, created = CompanyOnboarding.objects.get_or_create(
            company=company,
            defaults={
                'current_step': 5,  # Final step
                'total_steps': 5,
                'company_info_completed': True,
                'regional_setup_completed': True,
                'staff_setup_completed': True,
                'integrations_completed': True,
                'finalization_completed': True,
                'step_data': {
                    'migrated_from_legacy': True,
                    'migration_date': timezone.now().isoformat(),
                    'migration_reason': 'Automatic migration from single-tenant to multi-tenant system'
                },
                'validation_errors': {},
                'completed_at': timezone.now(),
                'completed_by': company.created_by,
                'time_spent_minutes': 0,  # No actual time spent since automated
                'estimated_time_remaining': 0
            }
        )

        if not created:
            # Update existing onboarding to mark as completed
            onboarding.current_step = 5
            onboarding.company_info_completed = True
            onboarding.regional_setup_completed = True
            onboarding.staff_setup_completed = True
            onboarding.integrations_completed = True
            onboarding.finalization_completed = True
            onboarding.completed_at = timezone.now()
            onboarding.completed_by = company.created_by
            onboarding.step_data.update({
                'migrated_from_legacy': True,
                'migration_date': timezone.now().isoformat(),
                'migration_reason': 'Automatic migration from single-tenant to multi-tenant system'
            })
            onboarding.save()
            self.stdout.write("✓ Updated existing onboarding record to completed")
        else:
            self.stdout.write("✓ Created completed onboarding record")

    def _validate_migration(self, company):
        """Validate that the migration was successful"""
        total_memberships = UserCompanyMembership.objects.filter(
            company=company,
            is_active=True
        ).count()

        owners = UserCompanyMembership.objects.filter(
            company=company,
            is_owner=True,
            is_active=True
        ).count()

        # Check onboarding completion
        try:
            onboarding = CompanyOnboarding.objects.get(company=company)
            onboarding_complete = onboarding.completed_at is not None
        except CompanyOnboarding.DoesNotExist:
            onboarding_complete = False

        self.stdout.write(f"Migration validation:")
        self.stdout.write(f"  - Total memberships: {total_memberships}")
        self.stdout.write(f"  - Company owners: {owners}")
        self.stdout.write(f"  - Company active: {company.is_active}")
        self.stdout.write(f"  - Onboarding completed: {onboarding_complete}")

        if owners == 0:
            self.stdout.write(
                self.style.WARNING("⚠️  No company owners found - this may cause issues")
            )

        if not company.is_active:
            self.stdout.write(
                self.style.WARNING("⚠️  Company is not active - users may not be able to access")
            )

        if not onboarding_complete:
            self.stdout.write(
                self.style.WARNING("⚠️  Onboarding not completed - users will be redirected to onboarding")
            )