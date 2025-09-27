"""
Django management command to optimize leave management database
Created by django-orm-expert agent
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone
from leave_management.utils import LeaveBalanceOptimizer, QueryProfiler
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Optimize leave management database with indexes and bulk operations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--analyze-only',
            action='store_true',
            help='Only analyze performance, do not make changes',
        )
        parser.add_argument(
            '--create-balances',
            type=int,
            help='Create annual balances for specified year',
        )
        parser.add_argument(
            '--process-accruals',
            nargs=2,
            type=int,
            metavar=('YEAR', 'MONTH'),
            help='Process monthly accruals for specified year and month',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force operations without confirmation',
        )

    def handle(self, *args, **options):
        """Handle the optimization command"""
        self.stdout.write(
            self.style.SUCCESS(
                'Starting Leave Management Database Optimization'
            )
        )

        if options['analyze_only']:
            self.analyze_performance()
            return

        if options['create_balances']:
            self.create_annual_balances(options['create_balances'], options['force'])

        if options['process_accruals']:
            year, month = options['process_accruals']
            self.process_monthly_accruals(year, month, options['force'])

        # Run index analysis
        self.analyze_indexes()

        self.stdout.write(
            self.style.SUCCESS('Database optimization completed successfully')
        )

    def analyze_performance(self):
        """Analyze database performance"""
        self.stdout.write('Analyzing database performance...')

        profiler = QueryProfiler()

        # Analyze slow queries
        slow_query_analysis = profiler.analyze_slow_queries()
        if slow_query_analysis.get('slow_queries'):
            self.stdout.write(
                self.style.WARNING(
                    f"Found {len(slow_query_analysis['slow_queries'])} slow queries"
                )
            )
            for query_info in slow_query_analysis['slow_queries'][:5]:
                self.stdout.write(
                    f"  - Mean time: {query_info['mean_time']:.2f}ms, "
                    f"Calls: {query_info['calls']}"
                )
                self.stdout.write(f"    Query: {query_info['query']}")
        else:
            self.stdout.write(
                self.style.SUCCESS('No slow queries detected or analysis not supported')
            )

        # Analyze index usage
        index_analysis = profiler.index_usage_analysis()
        if index_analysis.get('index_usage'):
            self.stdout.write('\nIndex usage analysis:')
            for index_info in index_analysis['index_usage']:
                usage_score = index_info['scans']
                if usage_score == 0:
                    style = self.style.ERROR
                    message = 'UNUSED'
                elif usage_score < 100:
                    style = self.style.WARNING
                    message = 'LOW USAGE'
                else:
                    style = self.style.SUCCESS
                    message = 'WELL USED'

                self.stdout.write(
                    style(f"  {index_info['table']}.{index_info['index']}: {usage_score} scans ({message})")
                )

    def create_annual_balances(self, year: int, force: bool):
        """Create annual leave balances for all eligible users"""
        self.stdout.write(f'Creating annual leave balances for year {year}...')

        if not force:
            confirm = input(
                f"This will create leave balances for year {year} for all eligible staff. "
                f"Continue? (y/N): "
            )
            if confirm.lower() != 'y':
                self.stdout.write('Operation cancelled.')
                return

        try:
            optimizer = LeaveBalanceOptimizer()
            created_count = optimizer.bulk_create_annual_balances(year)

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created {created_count} leave balances for year {year}'
                )
            )
        except Exception as e:
            raise CommandError(f'Failed to create annual balances: {e}')

    def process_monthly_accruals(self, year: int, month: int, force: bool):
        """Process monthly accruals for specified period"""
        self.stdout.write(f'Processing monthly accruals for {year}-{month:02d}...')

        if not force:
            confirm = input(
                f"This will process monthly accruals for {year}-{month:02d}. "
                f"Continue? (y/N): "
            )
            if confirm.lower() != 'y':
                self.stdout.write('Operation cancelled.')
                return

        try:
            optimizer = LeaveBalanceOptimizer()
            result = optimizer.process_monthly_accruals(year, month)

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully processed accruals: '
                    f'{result["balances_updated"]} balances updated, '
                    f'{result["total_accrual_days"]:.2f} days accrued'
                )
            )
        except Exception as e:
            raise CommandError(f'Failed to process monthly accruals: {e}')

    def analyze_indexes(self):
        """Analyze database indexes"""
        self.stdout.write('Analyzing database indexes...')

        with connection.cursor() as cursor:
            if connection.vendor == 'postgresql':
                # Check if our performance indexes exist
                cursor.execute("""
                    SELECT indexname
                    FROM pg_indexes
                    WHERE tablename IN (
                        'leave_requests', 'leave_balances',
                        'leave_policies', 'blackout_periods'
                    )
                    AND indexname LIKE '%_idx'
                    ORDER BY tablename, indexname
                """)

                indexes = cursor.fetchall()
                self.stdout.write(f'Found {len(indexes)} custom indexes:')
                for index in indexes:
                    self.stdout.write(f'  - {index[0]}')

                # Check index sizes
                cursor.execute("""
                    SELECT
                        schemaname,
                        tablename,
                        indexname,
                        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
                    FROM pg_stat_user_indexes
                    WHERE tablename IN (
                        'leave_requests', 'leave_balances',
                        'leave_policies', 'blackout_periods'
                    )
                    ORDER BY pg_relation_size(indexrelid) DESC
                """)

                index_sizes = cursor.fetchall()
                self.stdout.write('\nIndex sizes:')
                for size_info in index_sizes:
                    self.stdout.write(
                        f'  {size_info[1]}.{size_info[2]}: {size_info[3]}'
                    )

            else:
                self.stdout.write('Index analysis only available for PostgreSQL')

        self.stdout.write(
            self.style.SUCCESS('Index analysis completed')
        )