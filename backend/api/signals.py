"""
Django signals for the API app.
Handles automatic setup and lifecycle events for models.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from .models import SecurityCompany
import logging

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=SecurityCompany)
def setup_trial_period(sender, instance, **kwargs):
    """
    Automatically set up 30-day trial for new companies.

    This signal ensures every new company starts with a 30-day trial period
    where they have access to all features regardless of their selected tier.
    After the trial expires, features are restricted to their subscription tier.

    Trial Setup:
    - is_trial = True
    - trial_end_date = created_at + 30 days
    - Full feature access during trial
    - After trial: Features restricted to subscription_tier
    """
    # Only run for new companies (no pk yet)
    if not instance.pk:
        # Set trial period for new companies
        if not instance.is_trial and not instance.trial_end_date:
            instance.is_trial = True
            instance.trial_end_date = timezone.now() + timedelta(days=30)

            logger.info(
                f"Auto-enabled 30-day trial for new company: {instance.name} "
                f"(expires: {instance.trial_end_date})"
            )


@receiver(post_save, sender=SecurityCompany)
def log_company_creation(sender, instance, created, **kwargs):
    """Log company creation for audit trail"""
    if created:
        logger.info(
            f"New company created: {instance.name} "
            f"(ID: {instance.id}, Trial: {instance.is_trial}, "
            f"Trial Ends: {instance.trial_end_date}, "
            f"Tier: {instance.subscription_tier})"
        )
