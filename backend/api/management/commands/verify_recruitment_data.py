from django.core.management.base import BaseCommand
from api.models import RecruitmentApplication, UserCompanyMembership, StaffProfile, User


class Command(BaseCommand):
    help = 'Verify recruitment application conversion data integrity and check for multi-tenant issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detailed',
            action='store_true',
            help='Show detailed information about problematic records',
        )

    def handle(self, *args, **options):
        """Check for any data inconsistencies from the recruitment conversion bug"""

        self.stdout.write(
            self.style.SUCCESS('Starting recruitment data verification...\n')
        )

        detailed = options.get('detailed', False)
        total_issues_found = 0

        # 1. Check for converted applications without company memberships (orphaned conversions)
        self.stdout.write('Checking for orphaned conversions...')
        orphaned_conversions = RecruitmentApplication.objects.filter(
            converted_to_user__isnull=False
        ).exclude(
            converted_to_user__company_memberships__isnull=False
        ).select_related('converted_to_user', 'employment_type__company')

        if orphaned_conversions.exists():
            count = orphaned_conversions.count()
            total_issues_found += count
            self.stdout.write(
                self.style.WARNING(
                    f'Found {count} converted applications without company memberships:'
                )
            )

            if detailed:
                for app in orphaned_conversions:
                    user = app.converted_to_user
                    company = app.employment_type.company if app.employment_type else None
                    self.stdout.write(
                        f'  - Application ID: {app.id}'
                    )
                    self.stdout.write(
                        f'    User: {user.email} (ID: {user.id})'
                    )
                    self.stdout.write(
                        f'    Expected Company: {company.name if company else "None"}'
                    )
                    self.stdout.write('')
            else:
                for app in orphaned_conversions:
                    self.stdout.write(f'  - Application {app.id}: {app.converted_to_user.email}')
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ No orphaned conversions found')
            )

        self.stdout.write('')

        # 2. Check for staff users without employment types
        self.stdout.write('Checking for staff users without employment types...')
        users_without_employment = User.objects.filter(
            role='staff',
            profile__employment_type__isnull=True
        ).select_related('profile')

        if users_without_employment.exists():
            count = users_without_employment.count()
            total_issues_found += count
            self.stdout.write(
                self.style.WARNING(
                    f'Found {count} staff users without employment types:'
                )
            )

            if detailed:
                for user in users_without_employment:
                    profile = getattr(user, 'profile', None)
                    self.stdout.write(
                        f'  - User ID: {user.id}'
                    )
                    self.stdout.write(
                        f'    Email: {user.email}'
                    )
                    self.stdout.write(
                        f'    Profile exists: {"Yes" if profile else "No"}'
                    )
                    if profile:
                        self.stdout.write(
                            f'    Profile approved: {profile.is_approved}'
                        )
                    self.stdout.write('')
            else:
                for user in users_without_employment:
                    self.stdout.write(f'  - User {user.id}: {user.email}')
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ All staff users have employment types')
            )

        self.stdout.write('')

        # 3. Check for inconsistent company relationships
        self.stdout.write('Checking for inconsistent company relationships...')

        # Find staff profiles with employment types that don't match their company memberships
        inconsistent_relationships = []

        staff_with_profiles = User.objects.filter(
            role='staff',
            profile__isnull=False,
            profile__employment_type__isnull=False
        ).select_related('profile__employment_type__company').prefetch_related('company_memberships__company')

        for user in staff_with_profiles:
            profile_company = user.profile.employment_type.company
            membership_companies = set(
                membership.company for membership in user.company_memberships.filter(is_active=True)
            )

            if profile_company not in membership_companies:
                inconsistent_relationships.append({
                    'user': user,
                    'profile_company': profile_company,
                    'membership_companies': membership_companies
                })

        if inconsistent_relationships:
            count = len(inconsistent_relationships)
            total_issues_found += count
            self.stdout.write(
                self.style.WARNING(
                    f'Found {count} users with inconsistent company relationships:'
                )
            )

            if detailed:
                for item in inconsistent_relationships:
                    user = item['user']
                    profile_company = item['profile_company']
                    membership_companies = item['membership_companies']

                    self.stdout.write(
                        f'  - User ID: {user.id}'
                    )
                    self.stdout.write(
                        f'    Email: {user.email}'
                    )
                    self.stdout.write(
                        f'    Profile Company: {profile_company.name if profile_company else "None"}'
                    )
                    self.stdout.write(
                        f'    Membership Companies: {", ".join([c.name for c in membership_companies]) if membership_companies else "None"}'
                    )
                    self.stdout.write('')
            else:
                for item in inconsistent_relationships:
                    user = item['user']
                    self.stdout.write(f'  - User {user.id}: {user.email}')
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ All company relationships are consistent')
            )

        self.stdout.write('')

        # 4. Check for staff profiles without users (data integrity check)
        self.stdout.write('Checking for orphaned staff profiles...')
        orphaned_profiles = StaffProfile.objects.filter(user__isnull=True)

        if orphaned_profiles.exists():
            count = orphaned_profiles.count()
            total_issues_found += count
            self.stdout.write(
                self.style.WARNING(
                    f'Found {count} staff profiles without users:'
                )
            )

            if detailed:
                for profile in orphaned_profiles:
                    self.stdout.write(
                        f'  - Profile ID: {profile.id}'
                    )
                    self.stdout.write(
                        f'    Phone: {profile.phone_number}'
                    )
                    self.stdout.write(
                        f'    Employment Type: {profile.employment_type.name if profile.employment_type else "None"}'
                    )
                    self.stdout.write('')
            else:
                for profile in orphaned_profiles:
                    self.stdout.write(f'  - Profile {profile.id}: {profile.phone_number}')
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ No orphaned staff profiles found')
            )

        self.stdout.write('')

        # 5. Check for recruitment applications pointing to non-existent users
        self.stdout.write('Checking for applications with invalid user references...')
        invalid_user_refs = RecruitmentApplication.objects.filter(
            converted_to_user__isnull=False
        ).exclude(
            converted_to_user__in=User.objects.all()
        )

        if invalid_user_refs.exists():
            count = invalid_user_refs.count()
            total_issues_found += count
            self.stdout.write(
                self.style.ERROR(
                    f'Found {count} applications with invalid user references:'
                )
            )

            for app in invalid_user_refs:
                self.stdout.write(f'  - Application {app.id}: points to non-existent user')
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ All user references are valid')
            )

        # Summary statistics
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('SUMMARY STATISTICS:')

        total_recruitment_apps = RecruitmentApplication.objects.count()
        converted_apps = RecruitmentApplication.objects.filter(converted_to_user__isnull=False).count()
        total_staff_users = User.objects.filter(role='staff').count()
        staff_with_memberships = User.objects.filter(
            role='staff',
            company_memberships__is_active=True
        ).distinct().count()

        self.stdout.write(f'• Total recruitment applications: {total_recruitment_apps}')
        self.stdout.write(f'• Converted applications: {converted_apps}')
        self.stdout.write(f'• Total staff users: {total_staff_users}')
        self.stdout.write(f'• Staff with active company memberships: {staff_with_memberships}')
        self.stdout.write('')

        if total_issues_found == 0:
            self.stdout.write(
                self.style.SUCCESS('✓ Data verification complete - No issues found!')
            )
            self.stdout.write(
                self.style.SUCCESS('All recruitment conversion data appears to be healthy.')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'⚠ Data verification complete - {total_issues_found} issues found')
            )
            self.stdout.write('')
            self.stdout.write('Recommendations:')
            self.stdout.write('1. Review the issues listed above')
            self.stdout.write('2. For orphaned conversions: Create UserCompanyMembership records')
            self.stdout.write('3. For missing employment types: Assign appropriate employment types')
            self.stdout.write('4. For inconsistent relationships: Align company memberships with employment types')
            self.stdout.write('5. Run this command again with --detailed for more information')

        self.stdout.write('')
        self.stdout.write('For detailed troubleshooting, run:')
        self.stdout.write(self.style.SUCCESS('python manage.py verify_recruitment_data --detailed'))