"""
Email Notification Service for sending shift-related email notifications.

This service handles all email notifications related to shifts, exchanges,
and approvals. It respects user notification preferences and quiet hours.
"""

import logging
from typing import Optional, Dict, Any, List

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


class EmailNotificationService:
    """Service for sending email notifications related to shifts."""

    def __init__(self):
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')
        self.frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        self.company_name = getattr(settings, 'COMPANY_NAME', 'Mead Security')

    def _get_user_preferences(self, user_id: int):
        """Get notification preferences for a user."""
        from ..models import NotificationPreferences
        try:
            return NotificationPreferences.objects.get(user_id=user_id)
        except NotificationPreferences.DoesNotExist:
            return None

    def _get_user(self, user_id: int):
        """Get user by ID."""
        from ..models import User
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    def _get_company_name(self, user_id: int) -> str:
        """Get company name for a user."""
        from ..models import User
        try:
            user = User.objects.select_related(
                'company_memberships__company'
            ).get(pk=user_id)
            membership = user.company_memberships.filter(is_active=True).first()
            if membership and membership.company:
                return membership.company.name
        except Exception:
            pass
        return self.company_name

    def _build_unsubscribe_url(self, user_id: int) -> str:
        """Build one-click unsubscribe URL."""
        prefs = self._get_user_preferences(user_id)
        if prefs:
            return f"{self.frontend_url}/email/unsubscribe/{prefs.email_unsubscribe_token}"
        return f"{self.frontend_url}/settings/notifications"

    def _build_preferences_url(self) -> str:
        """Build URL to notification preferences page."""
        return f"{self.frontend_url}/settings/notifications"

    def send_email(
        self,
        user_id: int,
        subject: str,
        template_name: str,
        context: Dict[str, Any],
        notification_type: str
    ) -> bool:
        """
        Send an email notification to a user.

        Args:
            user_id: ID of the user to send email to
            subject: Email subject line
            template_name: Template name (without 'emails/' prefix)
            context: Context dictionary for template rendering
            notification_type: Type of notification for preference checking

        Returns:
            bool: True if email was sent successfully
        """
        # Get user
        user = self._get_user(user_id)
        if not user:
            logger.warning(f"Cannot send email: User {user_id} not found")
            return False

        if not user.email:
            logger.warning(f"Cannot send email: User {user_id} has no email address")
            return False

        # Check user preferences
        prefs = self._get_user_preferences(user_id)
        if prefs and not prefs.should_send_email_notification(notification_type):
            logger.info(
                f"Email blocked by user preferences: user={user_id}, type={notification_type}"
            )
            return False

        # Get company name for the user
        company_name = self._get_company_name(user_id)

        # Build common context
        base_context = {
            'user': user,
            'company_name': company_name,
            'unsubscribe_url': self._build_unsubscribe_url(user_id),
            'preferences_url': self._build_preferences_url(),
            'frontend_url': self.frontend_url,
        }
        full_context = {**base_context, **context}

        try:
            # Render email
            html_content = render_to_string(f'emails/{template_name}.html', full_context)
            text_content = strip_tags(html_content)

            # Create email
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=self.from_email,
                to=[user.email],
                headers={
                    'List-Unsubscribe': f"<{self._build_unsubscribe_url(user_id)}>",
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                }
            )
            email.attach_alternative(html_content, "text/html")

            # Send email
            email.send(fail_silently=False)

            logger.info(f"Email sent: user={user_id}, type={notification_type}, subject='{subject}'")
            return True

        except Exception as e:
            logger.exception(f"Failed to send email to user {user_id}: {e}")
            return False

    def send_shift_assignment_email(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        venue_address: Optional[str],
        start_time: str,
        end_time: str,
        formatted_date: str,
        hourly_rate: Optional[str] = None
    ) -> bool:
        """
        Send email notification when a shift is assigned to a user.

        Args:
            user_id: ID of the user to notify
            shift_id: ID of the assigned shift
            venue_name: Name of the venue
            venue_address: Address of the venue (optional)
            start_time: Formatted start time
            end_time: Formatted end time
            formatted_date: Formatted date string
            hourly_rate: Pay rate per hour (optional)

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'venue_name': venue_name,
            'venue_address': venue_address,
            'start_time': start_time,
            'end_time': end_time,
            'formatted_date': formatted_date,
            'hourly_rate': hourly_rate,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"New Shift Assigned at {venue_name} - {company_name}",
            template_name='shift_assignment',
            context=context,
            notification_type='shift_assignment'
        )

    def send_shift_schedule_email(
        self,
        user_id: int,
        shifts: List[Dict[str, Any]],
        *,
        period_label: str = ""
    ) -> bool:
        """
        Send a digest email listing multiple newly scheduled shifts for a user.

        Args:
            user_id: ID of the user to notify
            shifts: List of shift dicts. Required keys: venue_name, start_time.
                Optional keys: venue_address, end_time, role, hourly_rate.
            period_label: Optional human-readable period (e.g. "next week")

        Returns:
            bool: True if email was sent successfully
        """
        if not shifts:
            return False

        user = self._get_user(user_id)
        if not user:
            logger.warning(f"Cannot send schedule email: User {user_id} not found")
            return False

        if not user.email:
            logger.warning(f"Cannot send schedule email: User {user_id} has no email address")
            return False

        sorted_shifts = sorted(shifts, key=lambda s: s['start_time'])

        formatted_shifts = []
        for s in sorted_shifts:
            start = s['start_time']
            end = s.get('end_time')
            formatted_shifts.append({
                'venue_name': s.get('venue_name', 'TBD'),
                'venue_address': s.get('venue_address'),
                'formatted_date': start.strftime('%a, %d %b %Y'),
                'start_str': start.strftime('%H:%M'),
                'end_str': end.strftime('%H:%M') if end else '',
                'role': s.get('role'),
                'hourly_rate': s.get('hourly_rate'),
            })

        count = len(formatted_shifts)
        if period_label:
            subject = f"Your schedule for {period_label}"
        else:
            subject = f"Your shift schedule — {count} new shift{'s' if count != 1 else ''}"

        context = {
            'first_name': user.first_name or user.username,
            'shifts': formatted_shifts,
            'count': count,
            'period_label': period_label,
            'app_url': self.frontend_url,
        }

        try:
            return self.send_email(
                user_id=user_id,
                subject=subject,
                template_name='shift_schedule',
                context=context,
                notification_type='shift_assignment',
            )
        except Exception as e:
            logger.exception(f"Failed to send shift schedule email to user {user_id}: {e}")
            return False

    def send_shift_removal_email(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        shift_date: str,
        shift_time: str,
        reason: Optional[str] = None
    ) -> bool:
        """
        Send email notification when a user is removed from a shift.

        Args:
            user_id: ID of the user to notify
            shift_id: ID of the shift
            venue_name: Name of the venue
            shift_date: Formatted date string
            shift_time: Formatted time string
            reason: Optional reason for removal

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'venue_name': venue_name,
            'shift_date': shift_date,
            'shift_time': shift_time,
            'reason': reason,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"Shift Removed - {venue_name} - {company_name}",
            template_name='shift_removal',
            context=context,
            notification_type='shift_assignment'  # Uses same preference as assignments
        )

    def send_exchange_request_email(
        self,
        user_id: int,
        requester_name: str,
        shift_venue: str,
        shift_date: str,
        shift_time: str,
        exchange_id: int
    ) -> bool:
        """
        Send email notification when a shift exchange request is received.

        Args:
            user_id: ID of the target user to notify
            requester_name: Name of the user requesting the exchange
            shift_venue: Name of the venue
            shift_date: Formatted date string
            shift_time: Formatted time string
            exchange_id: ID of the shift exchange

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'requester_name': requester_name,
            'shift_venue': shift_venue,
            'shift_date': shift_date,
            'shift_time': shift_time,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"Shift Transfer Request from {requester_name} - {company_name}",
            template_name='exchange_request',
            context=context,
            notification_type='exchange_request'
        )

    def send_exchange_accepted_email(
        self,
        user_id: int,
        target_name: str,
        shift_venue: str,
        shift_date: str,
        exchange_id: int
    ) -> bool:
        """
        Send email notification when an exchange request is accepted.

        Args:
            user_id: ID of the requesting user to notify
            target_name: Name of the user who accepted
            shift_venue: Name of the venue
            shift_date: Formatted date string
            exchange_id: ID of the shift exchange

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'target_name': target_name,
            'shift_venue': shift_venue,
            'shift_date': shift_date,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"Transfer Request Accepted by {target_name} - {company_name}",
            template_name='exchange_accepted',
            context=context,
            notification_type='exchange_accepted'
        )

    def send_exchange_approved_email(
        self,
        user_id: int,
        shift_venue: str,
        shift_date: str,
        shift_time: str,
        exchange_id: int,
        is_receiving: bool,
        shift_id: int
    ) -> bool:
        """
        Send email notification when an exchange is approved.

        Args:
            user_id: ID of the user to notify
            shift_venue: Name of the venue
            shift_date: Formatted date string
            shift_time: Formatted time string
            exchange_id: ID of the shift exchange
            is_receiving: True if user is receiving the shift
            shift_id: ID of the shift

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'shift_venue': shift_venue,
            'shift_date': shift_date,
            'shift_time': shift_time,
            'is_receiving': is_receiving,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"Shift Transfer Approved - {company_name}",
            template_name='exchange_approved',
            context=context,
            notification_type='exchange_approved'
        )

    def send_open_shift_notification_email(
        self,
        user_id: int,
        shifts: List[Dict[str, Any]],
        batch: bool = False
    ) -> bool:
        """
        Send email notification about open shifts.

        Args:
            user_id: ID of the user to notify
            shifts: List of shift data dictionaries with keys:
                - shift_id, venue_name, date, time, url, required_role
            batch: If True, send batch notification for multiple shifts

        Returns:
            bool: True if email was sent successfully
        """
        if not shifts:
            return False

        company_name = self._get_company_name(user_id)

        if batch and len(shifts) > 1:
            # Batch notification for multiple shifts
            shift_count = len(shifts)
            # Prepare shifts for template (limit to 5 for display)
            display_shifts = shifts[:5]

            context = {
                'shifts': display_shifts,
                'shift_count': shift_count,
                'remaining_count': shift_count - len(display_shifts),
            }

            return self.send_email(
                user_id=user_id,
                subject=f"{shift_count} New Shifts Available - {company_name}",
                template_name='open_shifts_batch',
                context=context,
                notification_type='available_shift'
            )
        else:
            # Single shift notification
            shift = shifts[0]
            context = {
                'venue_name': shift.get('venue_name', 'Unknown Venue'),
                'shift_date': shift.get('date', ''),
                'shift_time': shift.get('time', ''),
                'required_role': shift.get('required_role'),
            }

            return self.send_email(
                user_id=user_id,
                subject=f"New Shift Available at {shift.get('venue_name', 'Unknown Venue')} - {company_name}",
                template_name='open_shift_single',
                context=context,
                notification_type='available_shift'
            )

    def send_shift_approved_email(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        shift_date: str,
        shift_time: str,
        hours_worked: Optional[str] = None
    ) -> bool:
        """
        Send email notification when a completed shift is approved.

        Args:
            user_id: ID of the user to notify
            shift_id: ID of the shift
            venue_name: Name of the venue
            shift_date: Formatted date string
            shift_time: Formatted time string
            hours_worked: Formatted hours worked (optional)

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'venue_name': venue_name,
            'shift_date': shift_date,
            'shift_time': shift_time,
            'hours_worked': hours_worked,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"Shift Approved - {venue_name} - {company_name}",
            template_name='shift_approved',
            context=context,
            notification_type='shift_approved'
        )

    def send_claim_approved_email(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        venue_address: Optional[str],
        shift_date: str,
        shift_time: str
    ) -> bool:
        """
        Send email notification when an open shift claim is approved.

        Args:
            user_id: ID of the user to notify
            shift_id: ID of the shift
            venue_name: Name of the venue
            venue_address: Address of the venue (optional)
            shift_date: Formatted date string
            shift_time: Formatted time string

        Returns:
            bool: True if email was sent successfully
        """
        company_name = self._get_company_name(user_id)
        context = {
            'venue_name': venue_name,
            'venue_address': venue_address,
            'shift_date': shift_date,
            'shift_time': shift_time,
        }

        return self.send_email(
            user_id=user_id,
            subject=f"Shift Claim Approved - {venue_name} - {company_name}",
            template_name='claim_approved',
            context=context,
            notification_type='claim_approved'
        )


# Singleton instance
email_notification_service = EmailNotificationService()
