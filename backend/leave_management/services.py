"""
Business logic services for leave management system.
Provides high-level operations for leave accrual, carryover, and policy management.
"""

from django.db import transaction, models
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
import logging
from typing import List, Dict, Optional, Tuple

from .models import LeavePolicy, LeaveType, LeaveEntitlement

User = get_user_model()
logger = logging.getLogger(__name__)


class LeaveAccrualService:
    """Service for handling leave accruals and calculations"""

    @staticmethod
    def process_monthly_accruals(reference_date: Optional[date] = None) -> Dict:
        """
        Process monthly accruals for all active users and policies.

        Args:
            reference_date: Date to process accruals for (defaults to current date)

        Returns:
            Dictionary with processing results
        """
        if reference_date is None:
            reference_date = timezone.now().date()

        results = {
            'processed_count': 0,
            'skipped_count': 0,
            'error_count': 0,
            'total_accrued': Decimal('0'),
            'errors': []
        }

        # Get all active policies that use monthly accrual
        active_policies = LeavePolicy.objects.filter(
            is_active=True,
            accrual_method__in=['monthly', 'length_of_service']
        )

        # Get all active staff users
        active_users = User.objects.filter(
            is_active=True,
            role='staff'
        ).select_related('profile')

        for policy in active_policies:
            for user in active_users:
                if policy.is_applicable_to_user(user):
                    try:
                        accrual_amount = LeaveAccrualService.calculate_and_apply_monthly_accrual(
                            user, policy, reference_date
                        )

                        if accrual_amount > 0:
                            results['processed_count'] += 1
                            results['total_accrued'] += accrual_amount
                        else:
                            results['skipped_count'] += 1

                    except Exception as e:
                        results['error_count'] += 1
                        results['errors'].append({
                            'user': user.username,
                            'policy': str(policy),
                            'error': str(e)
                        })
                        logger.error(
                            f"Error processing monthly accrual for {user.username} "
                            f"on policy {policy}: {str(e)}"
                        )

        logger.info(
            f"Monthly accrual processing completed: "
            f"{results['processed_count']} processed, "
            f"{results['skipped_count']} skipped, "
            f"{results['error_count']} errors"
        )

        return results

    @staticmethod
    @transaction.atomic
    def calculate_and_apply_monthly_accrual(
        user: User,
        policy: LeavePolicy,
        reference_date: date
    ) -> Decimal:
        """
        Calculate and apply monthly accrual for a specific user and policy.

        Args:
            user: User to process accrual for
            policy: Leave policy to apply
            reference_date: Date to calculate accrual for

        Returns:
            Amount of leave accrued
        """
        year = reference_date.year

        # Get or create entitlement for this year
        entitlement, created = LeaveEntitlement.objects.get_or_create(
            user=user,
            policy=policy,
            year=year,
            defaults={
                'annual_entitlement': policy.calculate_annual_accrual(user, year),
            }
        )

        # Check if accrual was already processed for this month
        if entitlement.last_accrual_date:
            last_accrual_month = entitlement.last_accrual_date.replace(day=1)
            current_month = reference_date.replace(day=1)

            if last_accrual_month >= current_month:
                return Decimal('0')  # Already processed this month

        # Calculate monthly accrual amount
        monthly_accrual = policy.calculate_monthly_accrual(user, reference_date)

        if monthly_accrual > 0:
            # Apply the accrual
            entitlement.update_accrued_amount(monthly_accrual, reference_date)

            logger.debug(
                f"Applied monthly accrual: {monthly_accrual} days of "
                f"{policy.leave_type.name} for {user.username}"
            )

        return monthly_accrual

    @staticmethod
    def process_shift_based_accruals(shift, user: User) -> Dict:
        """
        Process accruals based on worked shifts for policies using 'per_shift' method.

        Args:
            shift: Shift object that was worked
            user: User who worked the shift

        Returns:
            Dictionary with accrual results
        """
        results = {
            'accruals_processed': 0,
            'total_accrued': Decimal('0'),
            'policies_applied': []
        }

        # Only process for completed shifts
        if shift.status != 'completed':
            return results

        # Get policies that use per_shift accrual
        applicable_policies = LeavePolicy.objects.filter(
            accrual_method='per_shift',
            is_active=True
        )

        shift_date = shift.start_time.date()
        year = shift_date.year

        for policy in applicable_policies:
            if policy.is_applicable_to_user(user):
                try:
                    # Get or create entitlement
                    entitlement, created = LeaveEntitlement.objects.get_or_create(
                        user=user,
                        policy=policy,
                        year=year,
                        defaults={
                            'annual_entitlement': policy.calculate_annual_accrual(user, year),
                        }
                    )

                    # Apply per-shift accrual
                    accrual_amount = policy.accrual_rate
                    if accrual_amount > 0:
                        entitlement.update_accrued_amount(accrual_amount, shift_date)
                        results['accruals_processed'] += 1
                        results['total_accrued'] += accrual_amount
                        results['policies_applied'].append(policy.name)

                except Exception as e:
                    logger.error(
                        f"Error processing shift-based accrual for {user.username} "
                        f"on policy {policy}: {str(e)}"
                    )

        return results


class LeaveCarryoverService:
    """Service for handling leave carryovers between years"""

    @staticmethod
    @transaction.atomic
    def process_year_end_carryovers(year: int) -> Dict:
        """
        Process carryovers for all users from the specified year to the next year.

        Args:
            year: Year to process carryovers from

        Returns:
            Dictionary with processing results
        """
        results = {
            'processed_count': 0,
            'total_carried_over': Decimal('0'),
            'total_expired': Decimal('0'),
            'errors': []
        }

        next_year = year + 1

        # Get all entitlements from the specified year
        current_year_entitlements = LeaveEntitlement.objects.filter(
            year=year
        ).select_related('user', 'policy', 'policy__leave_type')

        for entitlement in current_year_entitlements:
            try:
                carryover_amount = LeaveCarryoverService.process_individual_carryover(
                    entitlement, next_year
                )

                if carryover_amount > 0:
                    results['total_carried_over'] += carryover_amount

                results['processed_count'] += 1

            except Exception as e:
                results['errors'].append({
                    'user': entitlement.user.username,
                    'policy': str(entitlement.policy),
                    'error': str(e)
                })
                logger.error(
                    f"Error processing carryover for {entitlement.user.username} "
                    f"on policy {entitlement.policy}: {str(e)}"
                )

        logger.info(
            f"Year-end carryover processing completed for {year}: "
            f"{results['processed_count']} processed, "
            f"{results['total_carried_over']} days carried over"
        )

        return results

    @staticmethod
    def process_individual_carryover(
        current_entitlement: LeaveEntitlement,
        next_year: int
    ) -> Decimal:
        """
        Process carryover for an individual user's entitlement.

        Args:
            current_entitlement: Entitlement from current year
            next_year: Year to carry over to

        Returns:
            Amount carried over
        """
        # Calculate carryover amount based on policy
        carryover_amount = current_entitlement.policy.get_carryover_amount(
            current_entitlement.current_balance
        )

        if carryover_amount <= 0:
            return Decimal('0')

        # Get or create next year's entitlement
        next_entitlement, created = LeaveEntitlement.objects.get_or_create(
            user=current_entitlement.user,
            policy=current_entitlement.policy,
            year=next_year,
            defaults={
                'annual_entitlement': current_entitlement.policy.calculate_annual_accrual(
                    current_entitlement.user, next_year
                ),
            }
        )

        # Process the carryover
        return next_entitlement.process_carryover_from_previous_year(current_entitlement)

    @staticmethod
    def expire_carried_over_leave() -> Dict:
        """
        Expire carried over leave that has reached its expiry date.

        Returns:
            Dictionary with expiration results
        """
        current_date = timezone.now().date()
        results = {
            'expired_count': 0,
            'total_expired': Decimal('0')
        }

        # Find entitlements with expired carryover
        expired_entitlements = LeaveEntitlement.objects.filter(
            carryover_expiry_date__lte=current_date,
            carried_over__gt=0
        )

        for entitlement in expired_entitlements:
            expired_amount = entitlement.carried_over
            entitlement.carried_over = Decimal('0')
            entitlement.carryover_expiry_date = None
            entitlement.save()

            results['expired_count'] += 1
            results['total_expired'] += expired_amount

            logger.info(
                f"Expired {expired_amount} days of carried over "
                f"{entitlement.policy.leave_type.name} for {entitlement.user.username}"
            )

        return results


class LeaveBalanceService:
    """Service for calculating and managing leave balances"""

    @staticmethod
    def get_user_leave_summary(user: User, year: Optional[int] = None) -> Dict:
        """
        Get comprehensive leave summary for a user.

        Args:
            user: User to get summary for
            year: Year to get summary for (defaults to current year)

        Returns:
            Dictionary with leave summary information
        """
        if year is None:
            year = timezone.now().year

        summary = {
            'year': year,
            'leave_types': {},
            'total_available': Decimal('0'),
            'total_used': Decimal('0'),
            'total_accrued': Decimal('0')
        }

        # Get all entitlements for the user in the specified year
        entitlements = LeaveEntitlement.objects.filter(
            user=user,
            year=year
        ).select_related('policy', 'policy__leave_type')

        for entitlement in entitlements:
            leave_type_name = entitlement.policy.leave_type.name

            if leave_type_name not in summary['leave_types']:
                summary['leave_types'][leave_type_name] = {
                    'total_entitlement': Decimal('0'),
                    'carried_over': Decimal('0'),
                    'accrued_to_date': Decimal('0'),
                    'used_to_date': Decimal('0'),
                    'current_balance': Decimal('0'),
                    'policies': []
                }

            # Aggregate data for this leave type
            leave_type_data = summary['leave_types'][leave_type_name]
            leave_type_data['total_entitlement'] += entitlement.annual_entitlement
            leave_type_data['carried_over'] += entitlement.carried_over
            leave_type_data['accrued_to_date'] += entitlement.accrued_to_date
            leave_type_data['used_to_date'] += entitlement.used_to_date
            leave_type_data['current_balance'] += entitlement.current_balance
            leave_type_data['policies'].append({
                'name': entitlement.policy.name,
                'balance': entitlement.current_balance,
                'entitlement': entitlement.annual_entitlement,
                'accrued': entitlement.accrued_to_date,
                'used': entitlement.used_to_date
            })

            # Update totals
            summary['total_available'] += entitlement.current_balance
            summary['total_used'] += entitlement.used_to_date
            summary['total_accrued'] += entitlement.accrued_to_date

        return summary

    @staticmethod
    def get_user_balances(user: User, year: Optional[int] = None) -> Dict:
        """
        Get user leave balances in the format expected by the frontend.

        Args:
            user: User to get balances for
            year: Year to get balances for (defaults to current year)

        Returns:
            Dictionary matching LeaveBalanceResponse interface
        """
        if year is None:
            year = timezone.now().year

        # For now, return a placeholder structure that matches the expected frontend interface
        # This will be fully implemented in TASK-013
        from api.serializers import UserSerializer

        response = {
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_manager': getattr(user, 'is_manager', False),
                'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            },
            'balances': [],  # Empty array for now - will be populated in TASK-013
            'total_days_available': '0',
            'total_days_used': '0',
            'total_days_pending': '0'
        }

        return response

    @staticmethod
    def check_leave_eligibility(
        user: User,
        leave_type: LeaveType,
        start_date: date,
        end_date: date,
        days_requested: Decimal
    ) -> Dict:
        """
        Check if a user is eligible to take specific leave.

        Args:
            user: User requesting leave
            leave_type: Type of leave being requested
            start_date: Start date of leave
            end_date: End date of leave
            days_requested: Number of days being requested

        Returns:
            Dictionary with eligibility information
        """
        result = {
            'eligible': True,
            'reasons': [],
            'available_balance': Decimal('0'),
            'policies_checked': []
        }

        year = start_date.year

        # Get applicable policies for this leave type and user
        applicable_policies = LeavePolicy.objects.filter(
            leave_type=leave_type,
            is_active=True
        )

        user_policies = []
        for policy in applicable_policies:
            if policy.is_applicable_to_user(user):
                user_policies.append(policy)

        if not user_policies:
            result['eligible'] = False
            result['reasons'].append(f"No applicable {leave_type.name} policy found")
            return result

        # Check each applicable policy
        total_available_balance = Decimal('0')

        for policy in user_policies:
            policy_check = {
                'policy_name': policy.name,
                'eligible': True,
                'reasons': [],
                'balance': Decimal('0')
            }

            # Get entitlement for this policy
            try:
                entitlement = LeaveEntitlement.objects.get(
                    user=user,
                    policy=policy,
                    year=year
                )
                policy_check['balance'] = entitlement.current_balance
                total_available_balance += entitlement.current_balance

                # Check if sufficient balance
                if not entitlement.can_take_leave(days_requested):
                    policy_check['eligible'] = False
                    policy_check['reasons'].append(
                        f"Insufficient balance: {entitlement.current_balance} days available"
                    )

            except LeaveEntitlement.DoesNotExist:
                policy_check['eligible'] = False
                policy_check['reasons'].append("No entitlement record found")

            # Check minimum employment period
            if hasattr(user, 'profile') and user.profile:
                employment_start = user.date_joined.date()
                days_employed = (start_date - employment_start).days

                if days_employed < policy.min_employment_days:
                    policy_check['eligible'] = False
                    policy_check['reasons'].append(
                        f"Minimum employment period not met: "
                        f"{days_employed} days employed, {policy.min_employment_days} required"
                    )

            # Check minimum notice period
            notice_days = (start_date - timezone.now().date()).days
            if notice_days < leave_type.min_notice_days:
                policy_check['eligible'] = False
                policy_check['reasons'].append(
                    f"Insufficient notice: {notice_days} days notice given, "
                    f"{leave_type.min_notice_days} days required"
                )

            # Check maximum consecutive days
            if leave_type.max_consecutive_days:
                if days_requested > leave_type.max_consecutive_days:
                    policy_check['eligible'] = False
                    policy_check['reasons'].append(
                        f"Exceeds maximum consecutive days: "
                        f"{days_requested} days requested, "
                        f"{leave_type.max_consecutive_days} days maximum"
                    )

            result['policies_checked'].append(policy_check)

            # If any policy allows the leave, consider it eligible
            if not policy_check['eligible']:
                result['eligible'] = False
                result['reasons'].extend(policy_check['reasons'])

        result['available_balance'] = total_available_balance

        return result

    @staticmethod
    def get_leave_projections(user: User, months_ahead: int = 12) -> Dict:
        """
        Project leave balances for the specified number of months ahead.

        Args:
            user: User to project for
            months_ahead: Number of months to project

        Returns:
            Dictionary with projected balances
        """
        current_date = timezone.now().date()
        projections = {
            'start_date': current_date,
            'projection_months': months_ahead,
            'monthly_projections': [],
            'leave_types': {}
        }

        # Get current entitlements
        current_entitlements = LeaveEntitlement.objects.filter(
            user=user,
            year=current_date.year
        ).select_related('policy', 'policy__leave_type')

        # Initialize leave type tracking
        for entitlement in current_entitlements:
            leave_type_name = entitlement.policy.leave_type.name
            if leave_type_name not in projections['leave_types']:
                projections['leave_types'][leave_type_name] = {
                    'current_balance': entitlement.current_balance,
                    'monthly_accrual': entitlement.policy.calculate_monthly_accrual(user),
                    'projected_balance': entitlement.current_balance
                }

        # Project forward month by month
        for month in range(months_ahead):
            projection_date = current_date + relativedelta(months=month + 1)
            month_projection = {
                'date': projection_date,
                'leave_types': {}
            }

            for leave_type_name, data in projections['leave_types'].items():
                # Add monthly accrual
                projected_balance = data['current_balance'] + (
                    data['monthly_accrual'] * (month + 1)
                )

                month_projection['leave_types'][leave_type_name] = {
                    'projected_balance': projected_balance,
                    'monthly_accrual': data['monthly_accrual']
                }

            projections['monthly_projections'].append(month_projection)

        return projections


class LeavePolicyService:
    """Service for managing leave policies and types"""

    @staticmethod
    def create_default_leave_types() -> List[LeaveType]:
        """
        Create default leave types for the system.

        Returns:
            List of created leave types
        """
        default_types = [
            {
                'name': 'Annual Leave',
                'code': 'AL',
                'description': 'Annual vacation leave',
                'color_code': '#28a745',
                'requires_approval': True,
                'min_notice_days': 7,
                'max_consecutive_days': 20
            },
            {
                'name': 'Sick Leave',
                'code': 'SL',
                'description': 'Medical/sick leave',
                'color_code': '#dc3545',
                'requires_approval': False,
                'min_notice_days': 0,
                'max_consecutive_days': None
            },
            {
                'name': 'Personal Leave',
                'code': 'PL',
                'description': 'Personal/emergency leave',
                'color_code': '#ffc107',
                'requires_approval': True,
                'min_notice_days': 1,
                'max_consecutive_days': 5
            },
            {
                'name': 'Compassionate Leave',
                'code': 'CL',
                'description': 'Bereavement/compassionate leave',
                'color_code': '#6c757d',
                'requires_approval': True,
                'min_notice_days': 0,
                'max_consecutive_days': 5
            }
        ]

        created_types = []
        for type_data in default_types:
            leave_type, created = LeaveType.objects.get_or_create(
                code=type_data['code'],
                defaults=type_data
            )
            if created:
                created_types.append(leave_type)
                logger.info(f"Created default leave type: {leave_type.name}")

        return created_types

    @staticmethod
    def create_standard_policies() -> List[LeavePolicy]:
        """
        Create standard leave policies for common scenarios.

        Returns:
            List of created leave policies
        """
        # Ensure default leave types exist
        LeavePolicyService.create_default_leave_types()

        annual_leave_type = LeaveType.objects.get(code='AL')
        sick_leave_type = LeaveType.objects.get(code='SL')
        personal_leave_type = LeaveType.objects.get(code='PL')

        standard_policies = [
            {
                'name': 'Standard Annual Leave',
                'leave_type': annual_leave_type,
                'accrual_method': 'monthly',
                'accrual_rate': Decimal('1.67'),  # 20 days per year / 12 months
                'max_accrual_per_year': Decimal('20'),
                'max_balance': Decimal('40'),
                'carryover_method': 'partial',
                'carryover_limit': Decimal('5'),
                'carryover_expiry_months': 3,
                'probation_months': 3,
                'min_employment_days': 90
            },
            {
                'name': 'Standard Sick Leave',
                'leave_type': sick_leave_type,
                'accrual_method': 'monthly',
                'accrual_rate': Decimal('0.83'),  # 10 days per year / 12 months
                'max_accrual_per_year': Decimal('10'),
                'max_balance': Decimal('20'),
                'carryover_method': 'full',
                'probation_months': 0,
                'min_employment_days': 0
            },
            {
                'name': 'Standard Personal Leave',
                'leave_type': personal_leave_type,
                'accrual_method': 'annual',
                'accrual_rate': Decimal('3'),  # 3 days per year
                'max_accrual_per_year': Decimal('3'),
                'max_balance': Decimal('6'),
                'carryover_method': 'partial',
                'carryover_limit': Decimal('2'),
                'probation_months': 6,
                'min_employment_days': 180
            }
        ]

        created_policies = []
        for policy_data in standard_policies:
            policy, created = LeavePolicy.objects.get_or_create(
                name=policy_data['name'],
                leave_type=policy_data['leave_type'],
                defaults=policy_data
            )
            if created:
                created_policies.append(policy)
                logger.info(f"Created standard policy: {policy.name}")

        return created_policies

    @staticmethod
    def initialize_user_entitlements(user: User, year: Optional[int] = None) -> List[LeaveEntitlement]:
        """
        Initialize entitlements for a user based on applicable policies.

        Args:
            user: User to initialize entitlements for
            year: Year to initialize for (defaults to current year)

        Returns:
            List of created entitlements
        """
        if year is None:
            year = timezone.now().year

        # Get all policies applicable to the user
        applicable_policies = LeavePolicy.objects.filter(is_active=True)
        user_policies = [p for p in applicable_policies if p.is_applicable_to_user(user)]

        created_entitlements = []
        for policy in user_policies:
            entitlement, created = LeaveEntitlement.objects.get_or_create(
                user=user,
                policy=policy,
                year=year,
                defaults={
                    'annual_entitlement': policy.calculate_annual_accrual(user, year),
                }
            )
            if created:
                created_entitlements.append(entitlement)
                logger.info(
                    f"Created entitlement for {user.username}: "
                    f"{entitlement.annual_entitlement} days of {policy.leave_type.name}"
                )

        return created_entitlements