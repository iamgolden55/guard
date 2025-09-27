"""
Utility functions for Leave Management System optimization
Created by django-orm-expert agent for performance and bulk operations
"""
from django.db import transaction, connection
from django.db.models import F, Sum, Count
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date, timedelta
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)
User = get_user_model()


class LeaveBalanceOptimizer:
    """Optimized operations for leave balance management"""

    @staticmethod
    @transaction.atomic
    def bulk_create_annual_balances(year: int, user_ids: Optional[List[int]] = None) -> int:
        """
        Efficiently create annual leave balances for all eligible users
        Uses bulk operations to minimize database calls
        """
        from .models import LeaveBalance, LeavePolicy, User

        if user_ids:
            users = User.objects.filter(
                id__in=user_ids,
                is_active=True,
                role='staff'
            ).select_related('profile')
        else:
            users = User.objects.filter(
                is_active=True,
                role='staff'
            ).select_related('profile')

        # Get all active policies
        active_policies = LeavePolicy.objects.filter(is_active=True).select_related('leave_type')

        balances_to_create = []
        policies_by_employment_type = {}

        # Group policies by employment type for efficiency
        for policy in active_policies:
            if policy.employment_types.exists():
                for emp_type in policy.employment_types.all():
                    if emp_type.id not in policies_by_employment_type:
                        policies_by_employment_type[emp_type.id] = []
                    policies_by_employment_type[emp_type.id].append(policy)
            else:
                # Policy applies to all employment types
                if 'all' not in policies_by_employment_type:
                    policies_by_employment_type['all'] = []
                policies_by_employment_type['all'].append(policy)

        for user in users:
            employment_type_id = user.profile.employment_type_id if user.profile else None

            # Get applicable policies for this user
            applicable_policies = policies_by_employment_type.get('all', [])
            if employment_type_id and employment_type_id in policies_by_employment_type:
                applicable_policies.extend(policies_by_employment_type[employment_type_id])

            for policy in applicable_policies:
                # Check if balance already exists
                existing_balance = LeaveBalance.objects.filter(
                    staff_user=user,
                    leave_type=policy.leave_type,
                    year=year
                ).first()

                if not existing_balance:
                    # Calculate initial balance
                    annual_entitlement = policy.calculate_annual_accrual(user, year)

                    balance = LeaveBalance(
                        staff_user=user,
                        leave_type=policy.leave_type,
                        year=year,
                        opening_balance=annual_entitlement,
                        accrued_balance=Decimal('0.00'),
                        used_balance=Decimal('0.00'),
                        pending_balance=Decimal('0.00'),
                        adjustment_balance=Decimal('0.00')
                    )
                    balances_to_create.append(balance)

        # Bulk create all balances
        created_balances = LeaveBalance.objects.bulk_create(
            balances_to_create,
            batch_size=500,
            ignore_conflicts=True
        )

        logger.info(f"Created {len(created_balances)} annual leave balances for year {year}")
        return len(created_balances)

    @staticmethod
    @transaction.atomic
    def process_monthly_accruals(year: int, month: int) -> Dict[str, int]:
        """
        Process monthly accruals for all eligible staff
        Uses bulk updates for performance
        """
        from .models import LeaveBalance, LeavePolicy

        current_date = date(year, month, 1)
        balances_updated = 0
        total_accrual_amount = Decimal('0.00')

        # Get all balances that need accrual processing
        balances = LeaveBalance.objects.filter(
            year=year,
            last_accrual_date__lt=current_date
        ).select_related('staff_user__profile', 'leave_type').iterator(chunk_size=100)

        accrual_updates = []

        for balance in balances:
            # Find applicable policy
            applicable_policies = LeavePolicy.objects.filter(
                leave_type=balance.leave_type,
                is_active=True,
                accrual_method='monthly',
                effective_date__lte=current_date
            )

            if balance.staff_user.profile and balance.staff_user.profile.employment_type:
                applicable_policies = applicable_policies.filter(
                    Q(employment_types__isnull=True) |
                    Q(employment_types=balance.staff_user.profile.employment_type)
                ).distinct()

            policy = applicable_policies.first()
            if policy:
                monthly_accrual = policy.calculate_monthly_accrual(balance.staff_user, current_date)
                if monthly_accrual > 0:
                    accrual_updates.append({
                        'id': balance.id,
                        'accrual_amount': monthly_accrual
                    })
                    total_accrual_amount += monthly_accrual

        # Bulk update accruals
        if accrual_updates:
            # Use raw SQL for efficient bulk update
            with connection.cursor() as cursor:
                update_sql = """
                    UPDATE leave_balances
                    SET
                        accrued_balance = accrued_balance + %s,
                        last_accrual_date = %s,
                        last_updated = %s
                    WHERE id = %s
                """

                update_params = [
                    (
                        update['accrual_amount'],
                        current_date,
                        timezone.now(),
                        update['id']
                    )
                    for update in accrual_updates
                ]

                cursor.executemany(update_sql, update_params)
                balances_updated = cursor.rowcount

        logger.info(
            f"Processed monthly accruals for {balances_updated} balances. "
            f"Total accrued: {total_accrual_amount} days"
        )

        return {
            'balances_updated': balances_updated,
            'total_accrual_days': float(total_accrual_amount)
        }

    @staticmethod
    @transaction.atomic
    def bulk_deduct_approved_requests(request_ids: List[int]) -> Dict[str, int]:
        """
        Efficiently deduct leave balances for approved requests
        Uses bulk operations and prevents double-deduction
        """
        from .models import LeaveRequest, LeaveBalance

        requests = LeaveRequest.objects.filter(
            id__in=request_ids,
            status='approved',
            balance_deducted=False
        ).select_related('staff_user', 'leave_type')

        deducted_count = 0
        total_deducted_days = Decimal('0.00')

        balance_updates = {}
        request_updates = []

        for request in requests:
            balance_key = (request.staff_user_id, request.leave_type_id, request.start_date.year)

            if balance_key not in balance_updates:
                balance_updates[balance_key] = {
                    'used_balance_addition': Decimal('0.00'),
                    'pending_balance_reduction': Decimal('0.00')
                }

            balance_updates[balance_key]['used_balance_addition'] += request.days_requested
            balance_updates[balance_key]['pending_balance_reduction'] += request.days_requested
            total_deducted_days += request.days_requested

            request_updates.append(request.id)

        # Bulk update balances
        for (user_id, leave_type_id, year), updates in balance_updates.items():
            try:
                LeaveBalance.objects.filter(
                    staff_user_id=user_id,
                    leave_type_id=leave_type_id,
                    year=year
                ).update(
                    used_balance=F('used_balance') + updates['used_balance_addition'],
                    pending_balance=F('pending_balance') - updates['pending_balance_reduction'],
                    last_updated=timezone.now()
                )
                deducted_count += 1
            except Exception as e:
                logger.error(f"Failed to update balance for user {user_id}: {e}")

        # Mark requests as balance_deducted
        if request_updates:
            LeaveRequest.objects.filter(id__in=request_updates).update(
                balance_deducted=True
            )

        logger.info(
            f"Bulk deducted {total_deducted_days} days from {deducted_count} balances "
            f"for {len(request_updates)} approved requests"
        )

        return {
            'balances_updated': deducted_count,
            'requests_processed': len(request_updates),
            'total_days_deducted': float(total_deducted_days)
        }


class LeaveReportGenerator:
    """Generate optimized reports for leave analytics"""

    @staticmethod
    def team_utilization_report(team_user_ids: List[int], year: int) -> Dict:
        """
        Generate comprehensive team utilization report
        Uses optimized aggregation queries
        """
        from .models import LeaveRequest, LeaveBalance

        # Team utilization statistics
        with connection.cursor() as cursor:
            cursor.execute("""
                WITH team_stats AS (
                    SELECT
                        u.id as user_id,
                        u.username,
                        u.first_name,
                        u.last_name,
                        lt.name as leave_type,
                        COALESCE(lb.opening_balance + lb.accrued_balance + lb.adjustment_balance, 0) as total_entitlement,
                        COALESCE(lb.used_balance, 0) as used_balance,
                        COALESCE(
                            (SELECT SUM(lr.days_requested)
                             FROM leave_requests lr
                             WHERE lr.staff_user_id = u.id
                                 AND lr.leave_type_id = lt.id
                                 AND lr.status = 'approved'
                                 AND EXTRACT(YEAR FROM lr.start_date) = %s),
                            0
                        ) as approved_requests_days,
                        COALESCE(
                            (SELECT COUNT(*)
                             FROM leave_requests lr
                             WHERE lr.staff_user_id = u.id
                                 AND lr.leave_type_id = lt.id
                                 AND lr.status = 'approved'
                                 AND EXTRACT(YEAR FROM lr.start_date) = %s),
                            0
                        ) as approved_requests_count
                    FROM users u
                    CROSS JOIN leave_types lt
                    LEFT JOIN leave_balances lb ON lb.staff_user_id = u.id
                        AND lb.leave_type_id = lt.id
                        AND lb.year = %s
                    WHERE u.id = ANY(%s) AND u.role = 'staff'
                )
                SELECT
                    user_id,
                    username,
                    first_name,
                    last_name,
                    leave_type,
                    total_entitlement,
                    used_balance,
                    approved_requests_days,
                    approved_requests_count,
                    CASE
                        WHEN total_entitlement > 0
                        THEN ROUND((used_balance / total_entitlement) * 100, 2)
                        ELSE 0
                    END as utilization_percentage
                FROM team_stats
                ORDER BY username, leave_type
            """, [year, year, year, team_user_ids])

            results = cursor.fetchall()

        # Structure the results
        team_data = {}
        for row in results:
            user_id = row[0]
            if user_id not in team_data:
                team_data[user_id] = {
                    'user_info': {
                        'id': user_id,
                        'username': row[1],
                        'first_name': row[2],
                        'last_name': row[3]
                    },
                    'leave_types': {},
                    'totals': {
                        'total_entitlement': Decimal('0.00'),
                        'total_used': Decimal('0.00'),
                        'total_requests': 0
                    }
                }

            team_data[user_id]['leave_types'][row[4]] = {
                'entitlement': Decimal(str(row[5] or 0)),
                'used': Decimal(str(row[6] or 0)),
                'approved_days': Decimal(str(row[7] or 0)),
                'request_count': row[8] or 0,
                'utilization_pct': row[9] or 0
            }

            # Update totals
            team_data[user_id]['totals']['total_entitlement'] += Decimal(str(row[5] or 0))
            team_data[user_id]['totals']['total_used'] += Decimal(str(row[6] or 0))
            team_data[user_id]['totals']['total_requests'] += row[8] or 0

        return {
            'year': year,
            'team_count': len(team_data),
            'team_data': list(team_data.values()),
            'generated_at': timezone.now().isoformat()
        }

    @staticmethod
    def monthly_trends_report(start_year: int, end_year: int) -> Dict:
        """
        Generate monthly trends report with efficient aggregation
        """
        from .models import LeaveRequest

        trends = LeaveRequest.objects.filter(
            start_date__year__gte=start_year,
            start_date__year__lte=end_year,
            status='approved'
        ).extra(
            select={
                'year': "EXTRACT(year FROM start_date)",
                'month': "EXTRACT(month FROM start_date)"
            }
        ).values(
            'year', 'month', 'leave_type__name'
        ).annotate(
            request_count=Count('id'),
            total_days=Sum('days_requested'),
            unique_staff=Count('staff_user', distinct=True),
            avg_request_length=F('total_days') / F('request_count')
        ).order_by('year', 'month', 'leave_type__name')

        return {
            'start_year': start_year,
            'end_year': end_year,
            'monthly_data': list(trends),
            'generated_at': timezone.now().isoformat()
        }


class QueryProfiler:
    """Profile and optimize database queries"""

    @staticmethod
    def analyze_slow_queries(log_slow_queries: bool = False) -> Dict:
        """
        Analyze database performance and identify slow queries
        """
        with connection.cursor() as cursor:
            # Get slow query statistics (PostgreSQL specific)
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    SELECT query, calls, total_time, mean_time, rows
                    FROM pg_stat_statements
                    WHERE query LIKE '%leave_%'
                    ORDER BY mean_time DESC
                    LIMIT 10
                """)

                slow_queries = cursor.fetchall()

                return {
                    'database': connection.vendor,
                    'slow_queries': [
                        {
                            'query': row[0][:200] + '...' if len(row[0]) > 200 else row[0],
                            'calls': row[1],
                            'total_time': row[2],
                            'mean_time': row[3],
                            'rows': row[4]
                        }
                        for row in slow_queries
                    ],
                    'analysis_time': timezone.now().isoformat()
                }

            return {
                'database': connection.vendor,
                'message': 'Query analysis not supported for this database',
                'analysis_time': timezone.now().isoformat()
            }

    @staticmethod
    def index_usage_analysis() -> Dict:
        """
        Analyze index usage for leave management tables
        """
        with connection.cursor() as cursor:
            if connection.vendor == 'postgresql':
                cursor.execute("""
                    SELECT
                        schemaname,
                        tablename,
                        indexname,
                        idx_scan,
                        idx_tup_read,
                        idx_tup_fetch
                    FROM pg_stat_user_indexes
                    WHERE tablename IN (
                        'leave_requests', 'leave_balances', 'leave_policies',
                        'leave_types', 'blackout_periods'
                    )
                    ORDER BY idx_scan DESC
                """)

                index_stats = cursor.fetchall()

                return {
                    'database': connection.vendor,
                    'index_usage': [
                        {
                            'schema': row[0],
                            'table': row[1],
                            'index': row[2],
                            'scans': row[3],
                            'tuples_read': row[4],
                            'tuples_fetched': row[5]
                        }
                        for row in index_stats
                    ],
                    'analysis_time': timezone.now().isoformat()
                }

            return {
                'database': connection.vendor,
                'message': 'Index analysis not supported for this database',
                'analysis_time': timezone.now().isoformat()
            }