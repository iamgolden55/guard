"""
Diagnostic command to check user account status in multi-tenant system.

Usage:
    python manage.py diagnose_user admin2
    python manage.py diagnose_user --all
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import SecurityCompany, UserCompanyMembership

User = get_user_model()


class Command(BaseCommand):
    help = 'Diagnose user account status in multi-tenant system'

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            nargs='?',
            type=str,
            help='Username to diagnose',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Diagnose all users without company memberships',
        )

    def handle(self, *args, **options):
        username = options.get('username')
        check_all = options.get('all')

        if check_all:
            self._diagnose_all_users()
        elif username:
            self._diagnose_user(username)
        else:
            self.stdout.write(
                self.style.ERROR("Please provide a username or use --all")
            )

    def _diagnose_user(self, username):
        """Diagnose a specific user"""
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"User '{username}' not found")
            )
            return

        self.stdout.write(f"\n🔍 DIAGNOSING USER: {username}")
        self.stdout.write("=" * 50)

        # Basic user info
        self.stdout.write(f"📧 Email: {user.email}")
        self.stdout.write(f"👤 Full name: {user.get_full_name()}")
        self.stdout.write(f"📅 Joined: {user.date_joined}")
        self.stdout.write(f"🔐 Is staff: {user.is_staff}")
        self.stdout.write(f"🔐 Is superuser: {user.is_superuser}")
        self.stdout.write(f"✅ Is active: {user.is_active}")

        if hasattr(user, 'role'):
            self.stdout.write(f"👔 Role: {user.role}")

        # Company memberships
        memberships = UserCompanyMembership.objects.filter(user=user).select_related('company')

        self.stdout.write(f"\n🏢 COMPANY MEMBERSHIPS: {memberships.count()}")
        if memberships.exists():
            for membership in memberships:
                status = "✅ Active" if membership.is_active else "❌ Inactive"
                owner_flag = " (OWNER)" if membership.is_owner else ""
                self.stdout.write(
                    f"  • {membership.company.name} - {membership.role}{owner_flag} - {status}"
                )
                self.stdout.write(f"    Company ID: {membership.company.id}")
                self.stdout.write(f"    Company Active: {membership.company.is_active}")
                self.stdout.write(f"    Joined: {membership.joined_at}")
                self.stdout.write(f"    Invitation: {membership.invitation_status}")
        else:
            self.stdout.write("  ❌ NO COMPANY MEMBERSHIPS FOUND")

        # Authentication simulation
        self.stdout.write(f"\n🔐 AUTHENTICATION SIMULATION:")
        self._simulate_auth_flow(user)

        # Onboarding check
        self.stdout.write(f"\n🎯 ONBOARDING STATUS:")
        self._check_onboarding_status(user)

    def _diagnose_all_users(self):
        """Diagnose all users without company memberships"""
        orphaned_users = User.objects.filter(
            company_memberships__isnull=True
        ).distinct().order_by('date_joined')

        total_users = User.objects.count()
        users_with_companies = User.objects.filter(
            company_memberships__isnull=False
        ).distinct().count()

        self.stdout.write(f"\n📊 MULTI-TENANT STATUS OVERVIEW")
        self.stdout.write("=" * 50)
        self.stdout.write(f"👥 Total users: {total_users}")
        self.stdout.write(f"🏢 Users with companies: {users_with_companies}")
        self.stdout.write(f"🚫 Users without companies: {orphaned_users.count()}")

        # Show companies
        companies = SecurityCompany.objects.all()
        self.stdout.write(f"\n🏢 COMPANIES: {companies.count()}")
        for company in companies:
            member_count = UserCompanyMembership.objects.filter(
                company=company, is_active=True
            ).count()
            status = "✅ Active" if company.is_active else "❌ Inactive"
            self.stdout.write(f"  • {company.name} - {member_count} members - {status}")

        # Show orphaned users
        if orphaned_users.exists():
            self.stdout.write(f"\n🚫 USERS WITHOUT COMPANIES:")
            for user in orphaned_users[:10]:  # Show first 10
                role = "superuser" if user.is_superuser else "staff" if user.is_staff else "regular"
                self.stdout.write(f"  • {user.username} ({user.email}) - {role}")
            if orphaned_users.count() > 10:
                self.stdout.write(f"  ... and {orphaned_users.count() - 10} more")

        # Recommendations
        self.stdout.write(f"\n💡 RECOMMENDATIONS:")
        if orphaned_users.exists():
            self.stdout.write("  🔧 Run: python manage.py migrate_existing_users --dry-run")
            self.stdout.write("  🔧 Then: python manage.py migrate_existing_users")
        else:
            self.stdout.write("  ✅ All users have company memberships")

    def _simulate_auth_flow(self, user):
        """Simulate what happens during authentication"""
        # Simulate TenantMiddleware behavior
        owned_companies = UserCompanyMembership.objects.filter(
            user=user,
            is_owner=True,
            is_active=True,
            company__is_active=True
        ).select_related('company')

        any_companies = UserCompanyMembership.objects.filter(
            user=user,
            is_active=True,
            company__is_active=True
        ).select_related('company').order_by('-joined_at')

        if owned_companies.exists():
            primary_company = owned_companies.first().company
            self.stdout.write(f"  ✅ Primary company (owned): {primary_company.name}")
        elif any_companies.exists():
            primary_company = any_companies.first().company
            self.stdout.write(f"  ✅ Primary company (member): {primary_company.name}")
        else:
            self.stdout.write("  ❌ NO PRIMARY COMPANY - TenantMiddleware will set current_company = None")

        # Check onboarding endpoint access
        owner_admin_companies = UserCompanyMembership.objects.filter(
            user=user,
            is_active=True,
            role__in=['owner', 'admin']
        ).select_related('company')

        if owner_admin_companies.exists():
            self.stdout.write("  ✅ Can access onboarding endpoints (owner/admin role)")
        else:
            self.stdout.write("  ❌ CANNOT ACCESS ONBOARDING ENDPOINTS (no owner/admin role)")

    def _check_onboarding_status(self, user):
        """Check onboarding requirements"""
        memberships = UserCompanyMembership.objects.filter(
            user=user,
            is_active=True
        ).select_related('company')

        if not memberships.exists():
            self.stdout.write("  🎯 REQUIRES ONBOARDING (no company membership)")
            self.stdout.write("  ❌ BUT ONBOARDING WILL FAIL (no company to operate on)")
            return

        for membership in memberships:
            company = membership.company
            try:
                onboarding = company.onboarding
                if onboarding.is_completed:
                    self.stdout.write(f"  ✅ {company.name}: Onboarding completed")
                else:
                    self.stdout.write(f"  🔄 {company.name}: Onboarding in progress")
                    self.stdout.write(f"     Current step: {onboarding.current_step}")
            except:
                self.stdout.write(f"  🎯 {company.name}: Onboarding not started")