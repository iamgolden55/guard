# Generated manually on 2025-12-31
# Fix for users who completed onboarding but don't have company memberships
# This resolves the infinite loading spinner bug

from django.db import migrations
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


def fix_users_without_memberships(apps, schema_editor):
    """
    Find users with completed onboarding but no active company membership.
    Create appropriate memberships for them.

    This fixes the bug where users see an infinite loading spinner on login
    because the DashboardRouter expects a company membership that doesn't exist.
    """
    User = apps.get_model('api', 'User')
    CompanyOnboarding = apps.get_model('api', 'CompanyOnboarding')
    UserCompanyMembership = apps.get_model('api', 'UserCompanyMembership')
    SecurityCompany = apps.get_model('api', 'SecurityCompany')

    # Find all completed onboardings
    # Note: is_completed is a property, not a field. Use completed_at to check completion.
    completed_onboardings = CompanyOnboarding.objects.filter(
        completed_at__isnull=False
    ).select_related('company')

    fixed_count = 0
    skipped_count = 0
    reactivated_count = 0

    logger.info(f"Migration 0038: Starting to fix users without memberships")
    logger.info(f"Found {completed_onboardings.count()} completed onboardings to check")

    for onboarding in completed_onboardings:
        company = onboarding.company

        if not company:
            logger.warning(f"Onboarding {onboarding.id} has no company, skipping")
            skipped_count += 1
            continue

        # Find users who might be missing memberships
        # Check if onboarding.completed_by exists and has no active membership
        if onboarding.completed_by:
            user = onboarding.completed_by

            # Check if user has active membership for this company
            has_active_membership = UserCompanyMembership.objects.filter(
                user=user,
                company=company,
                is_active=True
            ).exists()

            if not has_active_membership:
                # Check if inactive membership exists
                inactive_membership = UserCompanyMembership.objects.filter(
                    user=user,
                    company=company,
                    is_active=False
                ).first()

                if inactive_membership:
                    # Reactivate existing membership
                    inactive_membership.is_active = True
                    inactive_membership.save()
                    logger.info(
                        f"Migration 0038: Reactivated membership for user {user.id} "
                        f"({user.username}) in company {company.id} ({company.name})"
                    )
                    reactivated_count += 1
                else:
                    # Create new membership
                    # Use completed_at if available, otherwise use current time
                    join_date = onboarding.completed_at if hasattr(onboarding, 'completed_at') and onboarding.completed_at else timezone.now()

                    UserCompanyMembership.objects.create(
                        user=user,
                        company=company,
                        role='owner',  # Assume owner since they completed onboarding
                        is_active=True,
                        is_owner=True,
                        date_joined=join_date
                    )
                    logger.info(
                        f"Migration 0038: Created membership for user {user.id} "
                        f"({user.username}) in company {company.id} ({company.name})"
                    )
                    fixed_count += 1
            else:
                # User already has active membership, skip
                skipped_count += 1
        else:
            logger.warning(
                f"Onboarding {onboarding.id} for company {company.id} ({company.name}) "
                f"has no completed_by user, skipping"
            )
            skipped_count += 1

    logger.info(
        f"Migration 0038 complete: "
        f"Created {fixed_count} memberships, "
        f"Reactivated {reactivated_count} memberships, "
        f"Skipped {skipped_count} records"
    )
    print(
        f"Migration 0038 complete: "
        f"Created {fixed_count} memberships, "
        f"Reactivated {reactivated_count} memberships, "
        f"Skipped {skipped_count} records"
    )


def reverse_fix(apps, schema_editor):
    """
    Reverse migration - don't do anything.
    We don't want to delete memberships that we created, as they may be legitimate now.
    """
    logger.info("Migration 0038 reverse: Not deleting created memberships (safe rollback)")
    print("Migration 0038 reverse: Not deleting created memberships (safe rollback)")
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0037_add_password_reset_token'),
    ]

    operations = [
        migrations.RunPython(fix_users_without_memberships, reverse_fix),
    ]
