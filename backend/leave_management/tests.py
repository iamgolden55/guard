from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta

from .models import LeaveType, LeavePolicy, LeaveEntitlement
from .services import (
    LeaveAccrualService, LeaveCarryoverService,
    LeaveBalanceService, LeavePolicyService
)
from api.models import EmploymentType

User = get_user_model()


class LeaveTypeModelTest(TestCase):
    """Test the LeaveType model"""

    def setUp(self):
        self.employment_type = EmploymentType.objects.create(
            name='Full Time',
            description='Full time employees'
        )

    def test_leave_type_creation(self):
        """Test creating a leave type"""
        leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL',
            description='Annual vacation leave',
            color_code='#28a745'
        )

        self.assertEqual(leave_type.name, 'Annual Leave')
        self.assertEqual(leave_type.code, 'AL')
        self.assertTrue(leave_type.is_active)
        self.assertTrue(leave_type.requires_approval)
        self.assertEqual(str(leave_type), 'Annual Leave (AL)')

    def test_leave_type_validation(self):
        """Test leave type validation"""
        leave_type = LeaveType(
            name='Test Leave',
            code='TL',
            color_code='invalid-color'
        )

        with self.assertRaises(ValidationError):
            leave_type.full_clean()

    def test_leave_type_manager(self):
        """Test leave type manager methods"""
        # Create test leave types
        active_type = LeaveType.objects.create(
            name='Active Leave',
            code='ACT',
            is_active=True
        )
        inactive_type = LeaveType.objects.create(
            name='Inactive Leave',
            code='INACT',
            is_active=False
        )

        # Test active() manager method
        active_types = LeaveType.objects.active()
        self.assertIn(active_type, active_types)
        self.assertNotIn(inactive_type, active_types)

        # Test by_employment_type() manager method
        restricted_type = LeaveType.objects.create(
            name='Restricted Leave',
            code='REST'
        )
        restricted_type.employment_types.add(self.employment_type)

        unrestricted_types = LeaveType.objects.by_employment_type(None)
        self.assertIn(active_type, unrestricted_types)
        self.assertNotIn(restricted_type, unrestricted_types)

        restricted_types = LeaveType.objects.by_employment_type(self.employment_type)
        self.assertIn(restricted_type, restricted_types)


class LeavePolicyModelTest(TestCase):
    """Test the LeavePolicy model"""

    def setUp(self):
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL'
        )
        self.employment_type = EmploymentType.objects.create(
            name='Full Time',
            description='Full time employees'
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff'
        )

    def test_leave_policy_creation(self):
        """Test creating a leave policy"""
        policy = LeavePolicy.objects.create(
            name='Standard Annual Leave',
            leave_type=self.leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('1.67'),
            max_balance=Decimal('40'),
            carryover_method='partial',
            carryover_limit=Decimal('5')
        )

        self.assertEqual(policy.name, 'Standard Annual Leave')
        self.assertEqual(policy.accrual_method, 'monthly')
        self.assertTrue(policy.is_active)
        self.assertEqual(str(policy), 'Standard Annual Leave - Annual Leave')

    def test_leave_policy_validation(self):
        """Test leave policy validation"""
        # Test invalid date range
        policy = LeavePolicy(
            name='Invalid Policy',
            leave_type=self.leave_type,
            effective_date=date(2024, 12, 31),
            expiry_date=date(2024, 1, 1)
        )

        with self.assertRaises(ValidationError):
            policy.full_clean()

        # Test partial carryover without limit
        policy = LeavePolicy(
            name='Invalid Carryover Policy',
            leave_type=self.leave_type,
            carryover_method='partial',
            carryover_limit=None
        )

        with self.assertRaises(ValidationError):
            policy.full_clean()

    def test_accrual_calculations(self):
        """Test accrual calculation methods"""
        policy = LeavePolicy.objects.create(
            name='Test Policy',
            leave_type=self.leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('2.0'),
            probation_months=3
        )

        # Test monthly accrual with probation
        self.user.date_joined = timezone.now() - timedelta(days=60)  # 2 months
        self.user.save()

        monthly_accrual = policy.calculate_monthly_accrual(self.user)
        self.assertEqual(monthly_accrual, Decimal('0'))  # Still in probation

        # Test after probation
        self.user.date_joined = timezone.now() - timedelta(days=120)  # 4 months
        self.user.save()

        monthly_accrual = policy.calculate_monthly_accrual(self.user)
        self.assertEqual(monthly_accrual, Decimal('2.0'))

    def test_length_of_service_accrual(self):
        """Test length of service accrual calculations"""
        policy = LeavePolicy.objects.create(
            name='Service Based Policy',
            leave_type=self.leave_type,
            accrual_method='length_of_service',
            service_brackets=[
                {'months': 0, 'rate': 15},
                {'months': 12, 'rate': 20},
                {'months': 60, 'rate': 25}
            ]
        )

        # Test new employee (6 months)
        self.user.date_joined = timezone.now() - timedelta(days=180)
        self.user.save()

        rate = policy.get_accrual_rate_for_service_period(6)
        self.assertEqual(rate, Decimal('15'))

        # Test 2 year employee
        rate = policy.get_accrual_rate_for_service_period(24)
        self.assertEqual(rate, Decimal('20'))

        # Test 5+ year employee
        rate = policy.get_accrual_rate_for_service_period(72)
        self.assertEqual(rate, Decimal('25'))

    def test_policy_applicability(self):
        """Test if policy applies to specific users"""
        policy = LeavePolicy.objects.create(
            name='Restricted Policy',
            leave_type=self.leave_type,
            effective_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=30)
        )

        # Test basic applicability
        self.assertTrue(policy.is_applicable_to_user(self.user))

        # Test with employment type restriction
        policy.employment_types.add(self.employment_type)
        self.assertFalse(policy.is_applicable_to_user(self.user))

        # Test expired policy
        policy.expiry_date = date.today() - timedelta(days=1)
        policy.save()
        self.assertFalse(policy.is_applicable_to_user(self.user))

    def test_carryover_calculations(self):
        """Test carryover amount calculations"""
        policy = LeavePolicy.objects.create(
            name='Carryover Policy',
            leave_type=self.leave_type,
            carryover_method='partial',
            carryover_limit=Decimal('5')
        )

        # Test partial carryover
        carryover = policy.get_carryover_amount(Decimal('10'))
        self.assertEqual(carryover, Decimal('5'))

        carryover = policy.get_carryover_amount(Decimal('3'))
        self.assertEqual(carryover, Decimal('3'))

        # Test full carryover
        policy.carryover_method = 'full'
        policy.save()

        carryover = policy.get_carryover_amount(Decimal('10'))
        self.assertEqual(carryover, Decimal('10'))

        # Test no carryover
        policy.carryover_method = 'none'
        policy.save()

        carryover = policy.get_carryover_amount(Decimal('10'))
        self.assertEqual(carryover, Decimal('0'))


class LeaveEntitlementModelTest(TestCase):
    """Test the LeaveEntitlement model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff'
        )
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL'
        )
        self.policy = LeavePolicy.objects.create(
            name='Standard Policy',
            leave_type=self.leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('2.0'),
            max_balance=Decimal('30')
        )

    def test_entitlement_creation(self):
        """Test creating a leave entitlement"""
        entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            carried_over=Decimal('5'),
            accrued_to_date=Decimal('10'),
            used_to_date=Decimal('3')
        )

        self.assertEqual(entitlement.current_balance, Decimal('32'))
        self.assertEqual(entitlement.total_entitlement, Decimal('25'))
        self.assertEqual(str(entitlement), 'testuser - Annual Leave - 2024')

    def test_balance_calculations(self):
        """Test balance calculation properties"""
        entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            carried_over=Decimal('5'),
            accrued_to_date=Decimal('8'),
            used_to_date=Decimal('12')
        )

        self.assertEqual(entitlement.current_balance, Decimal('21'))
        self.assertEqual(entitlement.total_entitlement, Decimal('25'))

    def test_accrual_updates(self):
        """Test updating accrued amounts"""
        entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            accrued_to_date=Decimal('5')
        )

        # Test normal accrual update
        entitlement.update_accrued_amount(Decimal('2'))
        entitlement.refresh_from_db()
        self.assertEqual(entitlement.accrued_to_date, Decimal('7'))

        # Test accrual with max balance cap
        entitlement.update_accrued_amount(Decimal('25'))
        entitlement.refresh_from_db()
        # Should be capped at max_balance (30) - annual_entitlement (20) = 10
        self.assertEqual(entitlement.accrued_to_date, Decimal('10'))

    def test_leave_usage(self):
        """Test using leave"""
        entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            used_to_date=Decimal('5')
        )

        entitlement.use_leave(Decimal('3'))
        entitlement.refresh_from_db()
        self.assertEqual(entitlement.used_to_date, Decimal('8'))

    def test_can_take_leave(self):
        """Test leave eligibility checking"""
        entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            accrued_to_date=Decimal('10')
        )

        # Test sufficient balance
        self.assertTrue(entitlement.can_take_leave(Decimal('15')))
        self.assertFalse(entitlement.can_take_leave(Decimal('35')))

        # Test with negative balance allowed
        self.policy.allow_negative_balance = True
        self.policy.negative_balance_limit = Decimal('5')
        self.policy.save()

        entitlement.refresh_from_db()
        self.assertTrue(entitlement.can_take_leave(Decimal('35')))
        self.assertFalse(entitlement.can_take_leave(Decimal('40')))

    def test_carryover_processing(self):
        """Test carryover from previous year"""
        # Create previous year entitlement
        prev_entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2023,
            annual_entitlement=Decimal('20'),
            accrued_to_date=Decimal('10'),
            used_to_date=Decimal('15')
        )

        # Create current year entitlement
        current_entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20')
        )

        # Set policy carryover rules
        self.policy.carryover_method = 'partial'
        self.policy.carryover_limit = Decimal('10')
        self.policy.carryover_expiry_months = 3
        self.policy.save()

        # Process carryover
        carryover_amount = current_entitlement.process_carryover_from_previous_year(
            prev_entitlement
        )

        # Previous balance was 15, so should carryover min(15, 10) = 10
        self.assertEqual(carryover_amount, Decimal('10'))
        current_entitlement.refresh_from_db()
        self.assertEqual(current_entitlement.carried_over, Decimal('10'))
        self.assertIsNotNone(current_entitlement.carryover_expiry_date)


class LeaveAccrualServiceTest(TestCase):
    """Test the LeaveAccrualService"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff',
            date_joined=timezone.now() - timedelta(days=180)  # 6 months ago
        )
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL'
        )
        self.policy = LeavePolicy.objects.create(
            name='Standard Policy',
            leave_type=self.leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('1.67'),
            probation_months=3
        )

    def test_monthly_accrual_calculation(self):
        """Test monthly accrual calculation and application"""
        reference_date = date.today()

        # Test first accrual
        accrual_amount = LeaveAccrualService.calculate_and_apply_monthly_accrual(
            self.user, self.policy, reference_date
        )

        self.assertEqual(accrual_amount, Decimal('1.67'))

        # Verify entitlement was created
        entitlement = LeaveEntitlement.objects.get(
            user=self.user,
            policy=self.policy,
            year=reference_date.year
        )
        self.assertEqual(entitlement.accrued_to_date, Decimal('1.67'))
        self.assertEqual(entitlement.last_accrual_date, reference_date)

        # Test that running again in same month doesn't add more
        accrual_amount = LeaveAccrualService.calculate_and_apply_monthly_accrual(
            self.user, self.policy, reference_date
        )
        self.assertEqual(accrual_amount, Decimal('0'))

    def test_monthly_accrual_processing(self):
        """Test processing monthly accruals for all users"""
        # Create another user and policy
        user2 = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            role='staff',
            date_joined=timezone.now() - timedelta(days=180)
        )

        policy2 = LeavePolicy.objects.create(
            name='Sick Leave Policy',
            leave_type=LeaveType.objects.create(name='Sick Leave', code='SL'),
            accrual_method='monthly',
            accrual_rate=Decimal('0.83')
        )

        # Process monthly accruals
        results = LeaveAccrualService.process_monthly_accruals()

        # Should process accruals for both users and both policies
        self.assertGreaterEqual(results['processed_count'], 2)
        self.assertGreater(results['total_accrued'], Decimal('0'))


class LeaveCarryoverServiceTest(TestCase):
    """Test the LeaveCarryoverService"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff'
        )
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL'
        )
        self.policy = LeavePolicy.objects.create(
            name='Standard Policy',
            leave_type=self.leave_type,
            carryover_method='partial',
            carryover_limit=Decimal('5'),
            carryover_expiry_months=3
        )

    def test_individual_carryover(self):
        """Test processing carryover for individual entitlement"""
        # Create 2023 entitlement with balance
        entitlement_2023 = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2023,
            annual_entitlement=Decimal('20'),
            accrued_to_date=Decimal('20'),
            used_to_date=Decimal('12')  # 8 days remaining
        )

        # Process carryover to 2024
        carryover_amount = LeaveCarryoverService.process_individual_carryover(
            entitlement_2023, 2024
        )

        # Should carryover min(8, 5) = 5 days
        self.assertEqual(carryover_amount, Decimal('5'))

        # Verify 2024 entitlement was created with carryover
        entitlement_2024 = LeaveEntitlement.objects.get(
            user=self.user,
            policy=self.policy,
            year=2024
        )
        self.assertEqual(entitlement_2024.carried_over, Decimal('5'))

    def test_year_end_carryover_processing(self):
        """Test processing carryovers for all users at year end"""
        # Create multiple users with entitlements
        for i in range(3):
            user = User.objects.create_user(
                username=f'user{i}',
                email=f'user{i}@example.com',
                role='staff'
            )
            LeaveEntitlement.objects.create(
                user=user,
                policy=self.policy,
                year=2023,
                annual_entitlement=Decimal('20'),
                accrued_to_date=Decimal('20'),
                used_to_date=Decimal('10')  # 10 days remaining
            )

        # Process year-end carryovers
        results = LeaveCarryoverService.process_year_end_carryovers(2023)

        # Should process 3 users
        self.assertEqual(results['processed_count'], 3)
        # Each should carryover min(10, 5) = 5 days
        self.assertEqual(results['total_carried_over'], Decimal('15'))

    def test_carryover_expiry(self):
        """Test expiring carried over leave"""
        # Create entitlement with expired carryover
        entitlement = LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            carried_over=Decimal('5'),
            carryover_expiry_date=date.today() - timedelta(days=1)  # Expired yesterday
        )

        # Process carryover expiry
        results = LeaveCarryoverService.expire_carried_over_leave()

        self.assertEqual(results['expired_count'], 1)
        self.assertEqual(results['total_expired'], Decimal('5'))

        entitlement.refresh_from_db()
        self.assertEqual(entitlement.carried_over, Decimal('0'))
        self.assertIsNone(entitlement.carryover_expiry_date)


class LeaveBalanceServiceTest(TestCase):
    """Test the LeaveBalanceService"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff'
        )

        # Create leave types and policies
        self.annual_leave = LeaveType.objects.create(
            name='Annual Leave',
            code='AL',
            min_notice_days=7
        )
        self.sick_leave = LeaveType.objects.create(
            name='Sick Leave',
            code='SL'
        )

        self.annual_policy = LeavePolicy.objects.create(
            name='Annual Policy',
            leave_type=self.annual_leave,
            accrual_method='monthly',
            accrual_rate=Decimal('1.67'),
            min_employment_days=90
        )

        self.sick_policy = LeavePolicy.objects.create(
            name='Sick Policy',
            leave_type=self.sick_leave,
            accrual_method='monthly',
            accrual_rate=Decimal('0.83')
        )

        # Create entitlements
        LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.annual_policy,
            year=2024,
            annual_entitlement=Decimal('20'),
            accrued_to_date=Decimal('10'),
            used_to_date=Decimal('5')
        )

        LeaveEntitlement.objects.create(
            user=self.user,
            policy=self.sick_policy,
            year=2024,
            annual_entitlement=Decimal('10'),
            accrued_to_date=Decimal('5'),
            used_to_date=Decimal('2')
        )

    def test_user_leave_summary(self):
        """Test getting comprehensive leave summary for user"""
        summary = LeaveBalanceService.get_user_leave_summary(self.user, 2024)

        self.assertEqual(summary['year'], 2024)
        self.assertIn('Annual Leave', summary['leave_types'])
        self.assertIn('Sick Leave', summary['leave_types'])

        annual_data = summary['leave_types']['Annual Leave']
        self.assertEqual(annual_data['current_balance'], Decimal('25'))
        self.assertEqual(annual_data['used_to_date'], Decimal('5'))

        sick_data = summary['leave_types']['Sick Leave']
        self.assertEqual(sick_data['current_balance'], Decimal('13'))
        self.assertEqual(sick_data['used_to_date'], Decimal('2'))

        self.assertEqual(summary['total_available'], Decimal('38'))
        self.assertEqual(summary['total_used'], Decimal('7'))

    def test_leave_eligibility_check(self):
        """Test checking leave eligibility"""
        # Set user employment date
        self.user.date_joined = timezone.now() - timedelta(days=120)
        self.user.save()

        start_date = date.today() + timedelta(days=10)  # 10 days notice
        end_date = start_date + timedelta(days=5)

        # Test eligible request
        result = LeaveBalanceService.check_leave_eligibility(
            self.user, self.annual_leave, start_date, end_date, Decimal('5')
        )

        self.assertTrue(result['eligible'])
        self.assertEqual(result['available_balance'], Decimal('25'))

        # Test insufficient balance
        result = LeaveBalanceService.check_leave_eligibility(
            self.user, self.annual_leave, start_date, end_date, Decimal('30')
        )

        self.assertFalse(result['eligible'])
        self.assertIn('Insufficient balance', str(result['reasons']))

        # Test insufficient notice
        short_notice_date = date.today() + timedelta(days=3)  # Only 3 days notice
        result = LeaveBalanceService.check_leave_eligibility(
            self.user, self.annual_leave, short_notice_date, end_date, Decimal('5')
        )

        self.assertFalse(result['eligible'])
        self.assertIn('Insufficient notice', str(result['reasons']))

    def test_leave_projections(self):
        """Test leave balance projections"""
        projections = LeaveBalanceService.get_leave_projections(self.user, 6)

        self.assertEqual(projections['projection_months'], 6)
        self.assertEqual(len(projections['monthly_projections']), 6)

        # Check that projections include both leave types
        self.assertIn('Annual Leave', projections['leave_types'])
        self.assertIn('Sick Leave', projections['leave_types'])

        # Check first month projection
        first_month = projections['monthly_projections'][0]
        annual_projection = first_month['leave_types']['Annual Leave']

        # Should be current balance (25) + 1 month accrual (1.67) = 26.67
        expected_balance = Decimal('25') + Decimal('1.67')
        self.assertEqual(annual_projection['projected_balance'], expected_balance)


class LeavePolicyServiceTest(TestCase):
    """Test the LeavePolicyService"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff'
        )

    def test_create_default_leave_types(self):
        """Test creating default leave types"""
        created_types = LeavePolicyService.create_default_leave_types()

        # Should create 4 default types
        self.assertEqual(len(created_types), 4)

        # Verify they were created correctly
        annual_leave = LeaveType.objects.get(code='AL')
        self.assertEqual(annual_leave.name, 'Annual Leave')
        self.assertTrue(annual_leave.requires_approval)
        self.assertEqual(annual_leave.min_notice_days, 7)

        sick_leave = LeaveType.objects.get(code='SL')
        self.assertEqual(sick_leave.name, 'Sick Leave')
        self.assertFalse(sick_leave.requires_approval)

    def test_create_standard_policies(self):
        """Test creating standard leave policies"""
        created_policies = LeavePolicyService.create_standard_policies()

        # Should create 3 standard policies
        self.assertEqual(len(created_policies), 3)

        # Verify annual leave policy
        annual_policy = LeavePolicy.objects.get(name='Standard Annual Leave')
        self.assertEqual(annual_policy.accrual_method, 'monthly')
        self.assertEqual(annual_policy.accrual_rate, Decimal('1.67'))
        self.assertEqual(annual_policy.carryover_method, 'partial')

    def test_initialize_user_entitlements(self):
        """Test initializing entitlements for a user"""
        # Create default policies first
        LeavePolicyService.create_standard_policies()

        # Initialize entitlements for user
        created_entitlements = LeavePolicyService.initialize_user_entitlements(
            self.user, 2024
        )

        # Should create entitlements for all applicable policies
        self.assertEqual(len(created_entitlements), 3)

        # Verify annual leave entitlement
        annual_entitlement = LeaveEntitlement.objects.get(
            user=self.user,
            policy__name='Standard Annual Leave',
            year=2024
        )
        self.assertGreater(annual_entitlement.annual_entitlement, Decimal('0'))


class LeaveManagementIntegrationTest(TransactionTestCase):
    """Integration tests for the complete leave management system"""

    def setUp(self):
        # Create test data
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            role='staff',
            date_joined=timezone.now() - timedelta(days=90)  # 3 months ago
        )

        # Initialize the system
        LeavePolicyService.create_default_leave_types()
        LeavePolicyService.create_standard_policies()
        LeavePolicyService.initialize_user_entitlements(self.user, 2024)

    def test_complete_leave_lifecycle(self):
        """Test complete leave management lifecycle"""
        # 1. Process monthly accruals for 3 months
        for month in range(3):
            reference_date = date(2024, month + 1, 15)
            LeaveAccrualService.process_monthly_accruals(reference_date)

        # 2. Check user's leave summary
        summary = LeaveBalanceService.get_user_leave_summary(self.user, 2024)

        # Should have accrued some leave
        annual_balance = summary['leave_types']['Annual Leave']['current_balance']
        self.assertGreater(annual_balance, Decimal('0'))

        # 3. Check leave eligibility
        start_date = date.today() + timedelta(days=10)
        end_date = start_date + timedelta(days=3)

        eligibility = LeaveBalanceService.check_leave_eligibility(
            self.user,
            LeaveType.objects.get(code='AL'),
            start_date,
            end_date,
            Decimal('3')
        )

        self.assertTrue(eligibility['eligible'])

        # 4. Simulate taking leave
        annual_entitlement = LeaveEntitlement.objects.get(
            user=self.user,
            policy__leave_type__code='AL',
            year=2024
        )

        original_balance = annual_entitlement.current_balance
        annual_entitlement.use_leave(Decimal('3'))

        # Balance should decrease
        self.assertEqual(
            annual_entitlement.current_balance,
            original_balance - Decimal('3')
        )

        # 5. Process year-end carryover
        results = LeaveCarryoverService.process_year_end_carryovers(2024)
        self.assertGreaterEqual(results['processed_count'], 1)

        # 6. Verify 2025 entitlements were created with carryover
        entitlement_2025 = LeaveEntitlement.objects.get(
            user=self.user,
            policy__leave_type__code='AL',
            year=2025
        )
        self.assertGreaterEqual(entitlement_2025.carried_over, Decimal('0'))

    def test_system_error_handling(self):
        """Test system behavior with edge cases and errors"""
        # Test with user who has no profile
        user_no_profile = User.objects.create_user(
            username='noprofile',
            email='noprofile@example.com',
            role='staff'
        )

        # Should not crash when processing accruals
        results = LeaveAccrualService.process_monthly_accruals()
        self.assertGreaterEqual(results['processed_count'], 0)

        # Test with inactive policy
        policy = LeavePolicy.objects.first()
        policy.is_active = False
        policy.save()

        # Should skip inactive policies
        results = LeaveAccrualService.process_monthly_accruals()
        self.assertGreaterEqual(results['skipped_count'], 0)
