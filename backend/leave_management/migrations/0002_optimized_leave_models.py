"""
Migration for optimized leave management models with performance enhancements

This migration:
1. Creates optimized versions of leave management models
2. Adds strategic database indexes
3. Implements database-level constraints
4. Sets up PostgreSQL-specific optimizations

Author: Django ORM Expert Agent
Phase: 1 - Leave Management System Enhancement
Tasks: TASK-006, TASK-007, TASK-008, TASK-009
"""

from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from decimal import Decimal
from django.contrib.postgres.operations import BtreeGinExtension, TrigramExtension
from django.contrib.postgres.indexes import GinIndex, BrinIndex


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
        ('leave_management', '0001_initial'),
    ]

    operations = [
        # Enable PostgreSQL extensions
        TrigramExtension(),
        BtreeGinExtension(),

        # Create optimized LeaveType model
        migrations.CreateModel(
            name='OptimizedLeaveType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('name', models.CharField(db_index=True, help_text="Name of the leave type (e.g., 'Annual Leave', 'Sick Leave')", max_length=100, unique=True)),
                ('code', models.CharField(db_index=True, help_text="Short code for the leave type (e.g., 'AL', 'SL')", max_length=10, unique=True)),
                ('description', models.TextField(blank=True)),
                ('color_code', models.CharField(default='#007bff', help_text='HEX color code for UI display', max_length=7)),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Whether this leave type is currently available')),
                ('requires_approval', models.BooleanField(default=True, help_text='Whether requests for this leave type require manager approval')),
                ('min_notice_days', models.PositiveSmallIntegerField(default=0, help_text='Minimum notice required in days before leave start date')),
                ('max_consecutive_days', models.PositiveSmallIntegerField(blank=True, help_text='Maximum consecutive days allowed for this leave type', null=True)),
                ('display_order', models.PositiveSmallIntegerField(db_index=True, default=0, help_text='Order for displaying leave types in UI')),
            ],
            options={
                'verbose_name': 'Leave Type (Optimized)',
                'verbose_name_plural': 'Leave Types (Optimized)',
                'db_table': 'optimized_leave_types',
                'ordering': ['display_order', 'name'],
            },
        ),

        # Create optimized LeavePolicy model
        migrations.CreateModel(
            name='OptimizedLeavePolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('name', models.CharField(db_index=True, help_text='Descriptive name for this leave policy', max_length=200)),
                ('accrual_method', models.CharField(choices=[('monthly', 'Monthly Accrual'), ('annual', 'Annual Grant'), ('per_shift', 'Per Shift Worked'), ('length_of_service', 'Based on Length of Service'), ('none', 'No Automatic Accrual')], db_index=True, default='monthly', max_length=20)),
                ('accrual_rate', models.DecimalField(decimal_places=4, default=0, help_text='Accrual rate (days per period, based on accrual method)', max_digits=8, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('max_accrual_per_year', models.DecimalField(blank=True, decimal_places=2, help_text='Maximum days that can be accrued per year', max_digits=6, null=True, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('max_balance', models.DecimalField(blank=True, decimal_places=2, help_text='Maximum balance that can be accumulated', max_digits=6, null=True, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('service_brackets', models.JSONField(blank=True, default=list, help_text='Service brackets for length-of-service accrual')),
                ('carryover_method', models.CharField(choices=[('none', 'No Carryover'), ('full', 'Full Carryover'), ('partial', 'Partial Carryover'), ('use_or_lose', 'Use or Lose by Date')], db_index=True, default='partial', max_length=15)),
                ('carryover_limit', models.DecimalField(blank=True, decimal_places=2, help_text='Maximum days that can be carried over', max_digits=6, null=True, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('carryover_expiry_months', models.PositiveSmallIntegerField(default=3, help_text='Months after which carried over leave expires')),
                ('probation_months', models.PositiveSmallIntegerField(default=0, help_text='Months of employment before leave accrual begins')),
                ('min_employment_days', models.PositiveSmallIntegerField(default=0, help_text='Minimum days of employment before leave can be taken')),
                ('allow_negative_balance', models.BooleanField(default=False, help_text='Allow taking leave beyond current balance')),
                ('negative_balance_limit', models.DecimalField(decimal_places=2, default=0, help_text='Maximum negative balance allowed', max_digits=6, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Whether this policy is currently active')),
                ('effective_date', models.DateField(db_index=True, default=django.utils.timezone.now, help_text='Date when this policy becomes effective')),
                ('expiry_date', models.DateField(blank=True, db_index=True, help_text='Date when this policy expires', null=True)),
                ('leave_type', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='optimized_policies', to='leave_management.optimizedleavetype')),
            ],
            options={
                'verbose_name': 'Leave Policy (Optimized)',
                'verbose_name_plural': 'Leave Policies (Optimized)',
                'db_table': 'optimized_leave_policies',
                'ordering': ['leave_type__display_order', 'leave_type__name', 'name'],
            },
        ),

        # Create optimized LeaveEntitlement model
        migrations.CreateModel(
            name='OptimizedLeaveEntitlement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('year', models.PositiveSmallIntegerField(db_index=True, help_text='Calendar year this entitlement applies to')),
                ('annual_entitlement', models.DecimalField(decimal_places=2, default=0, help_text='Total days entitled for this year', max_digits=6)),
                ('carried_over', models.DecimalField(decimal_places=2, default=0, help_text='Days carried over from previous year', max_digits=6)),
                ('accrued_to_date', models.DecimalField(decimal_places=2, default=0, help_text='Days accrued so far this year', max_digits=6)),
                ('used_to_date', models.DecimalField(decimal_places=2, default=0, help_text='Days used so far this year', max_digits=6)),
                ('last_accrual_date', models.DateField(blank=True, db_index=True, help_text='Date of last accrual calculation', null=True)),
                ('carryover_expiry_date', models.DateField(blank=True, db_index=True, help_text='Date when carried over leave expires', null=True)),
                ('last_calculated', models.DateTimeField(auto_now=True, db_index=True, help_text='When balance was last calculated')),
                ('policy', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='optimized_entitlements', to='leave_management.optimizedleavepolicy')),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='optimized_leave_entitlements', to='api.user')),
            ],
            options={
                'verbose_name': 'Leave Entitlement (Optimized)',
                'verbose_name_plural': 'Leave Entitlements (Optimized)',
                'db_table': 'optimized_leave_entitlements',
                'ordering': ['-year', 'policy__leave_type__display_order', 'user__username'],
            },
        ),

        # Add many-to-many relationships
        migrations.AddField(
            model_name='optimizedleavetype',
            name='employment_types',
            field=models.ManyToManyField(blank=True, help_text='Employment types eligible for this leave type', related_name='optimized_leave_types', to='api.employmenttype'),
        ),
        migrations.AddField(
            model_name='optimizedleavepolicy',
            name='employment_types',
            field=models.ManyToManyField(blank=True, help_text='Employment types this policy applies to', related_name='optimized_leave_policies', to='api.employmenttype'),
        ),

        # Add database constraints
        migrations.AddConstraint(
            model_name='optimizedleavetype',
            constraint=models.CheckConstraint(check=models.Q(('min_notice_days__gte', 0)), name='min_notice_days_non_negative'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleavetype',
            constraint=models.CheckConstraint(check=models.Q(('max_consecutive_days__gte', 1)) | models.Q(('max_consecutive_days__isnull', True)), name='max_consecutive_days_positive_or_null'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleavepolicy',
            constraint=models.UniqueConstraint(fields=('name', 'leave_type'), name='unique_policy_name_per_leave_type'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleavepolicy',
            constraint=models.CheckConstraint(check=models.Q(('effective_date__lt', models.F('expiry_date'))) | models.Q(('expiry_date__isnull', True)), name='effective_before_expiry'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleavepolicy',
            constraint=models.CheckConstraint(check=models.Q(('accrual_rate__gte', 0)), name='accrual_rate_non_negative'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleaveentitlement',
            constraint=models.UniqueConstraint(fields=('user', 'policy', 'year'), name='unique_user_policy_year'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleaveentitlement',
            constraint=models.CheckConstraint(check=models.Q(('annual_entitlement__gte', 0)), name='annual_entitlement_non_negative'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleaveentitlement',
            constraint=models.CheckConstraint(check=models.Q(('carried_over__gte', 0)), name='carried_over_non_negative'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleaveentitlement',
            constraint=models.CheckConstraint(check=models.Q(('accrued_to_date__gte', 0)), name='accrued_to_date_non_negative'),
        ),
        migrations.AddConstraint(
            model_name='optimizedleaveentitlement',
            constraint=models.CheckConstraint(check=models.Q(('used_to_date__gte', 0)), name='used_to_date_non_negative'),
        ),

        # Add strategic indexes for OptimizedLeaveType
        migrations.AddIndex(
            model_name='optimizedleavetype',
            index=models.Index(fields=['is_active', 'display_order'], name='idx_opt_leave_types_active_order'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavetype',
            index=models.Index(fields=['is_active', 'name'], name='idx_opt_leave_types_active_name'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavetype',
            index=GinIndex(fields=['name', 'description'], name='gin_opt_leave_types_search', opclasses=['gin_trgm_ops', 'gin_trgm_ops']),
        ),

        # Add strategic indexes for OptimizedLeavePolicy
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=models.Index(fields=['leave_type', 'is_active'], name='idx_opt_policies_type_active'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=models.Index(fields=['is_active', 'effective_date'], name='idx_opt_policies_active_date'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=models.Index(fields=['is_active', 'effective_date', 'expiry_date'], name='idx_opt_policies_date_range'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=models.Index(fields=['accrual_method', 'is_active'], name='idx_opt_policies_accrual_active'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=BrinIndex(fields=['effective_date', 'expiry_date'], name='brin_opt_policies_dates'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=GinIndex(fields=['service_brackets'], name='gin_opt_policies_brackets'),
        ),
        migrations.AddIndex(
            model_name='optimizedleavepolicy',
            index=GinIndex(fields=['name'], name='gin_opt_policies_search', opclasses=['gin_trgm_ops']),
        ),

        # Add strategic indexes for OptimizedLeaveEntitlement
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['user', 'year'], name='idx_opt_entitlements_user_year'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['policy', 'year'], name='idx_opt_entitlements_policy_year'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['user', 'policy', 'year'], name='idx_opt_entitlements_user_policy_year'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['last_accrual_date', 'policy'], name='idx_opt_entitlements_accrual'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['carryover_expiry_date'], name='idx_opt_entitlements_expiry'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['year', 'policy'], name='idx_opt_entitlements_year_policy'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=models.Index(fields=['year', 'used_to_date'], name='idx_opt_entitlements_year_usage'),
        ),
        migrations.AddIndex(
            model_name='optimizedleaveentitlement',
            index=BrinIndex(fields=['last_accrual_date', 'carryover_expiry_date'], name='brin_opt_entitlements_dates'),
        ),

        # Raw SQL for additional optimizations
        migrations.RunSQL(
            sql=[
                # Create partial indexes for common filtered queries
                """
                CREATE INDEX idx_opt_entitlements_low_balance ON optimized_leave_entitlements (user_id, policy_id)
                WHERE (annual_entitlement + carried_over + accrued_to_date - used_to_date) <= 5;
                """,

                """
                CREATE INDEX idx_opt_entitlements_high_usage ON optimized_leave_entitlements (user_id, policy_id)
                WHERE used_to_date > (annual_entitlement * 0.8) AND annual_entitlement > 0;
                """,

                """
                CREATE INDEX idx_opt_policies_negative_balance ON optimized_leave_policies (leave_type_id)
                WHERE allow_negative_balance = true;
                """,

                # Create functional index for balance calculations
                """
                CREATE INDEX idx_opt_entitlements_current_balance
                ON optimized_leave_entitlements ((annual_entitlement + carried_over + accrued_to_date - used_to_date));
                """,

                # Create index for utilization rate calculations
                """
                CREATE INDEX idx_opt_entitlements_utilization
                ON optimized_leave_entitlements ((used_to_date / NULLIF(annual_entitlement, 0)))
                WHERE annual_entitlement > 0;
                """,

                # Update table statistics
                "ANALYZE optimized_leave_types;",
                "ANALYZE optimized_leave_policies;",
                "ANALYZE optimized_leave_entitlements;",
            ],
            reverse_sql=[
                "DROP INDEX IF EXISTS idx_opt_entitlements_low_balance;",
                "DROP INDEX IF EXISTS idx_opt_entitlements_high_usage;",
                "DROP INDEX IF EXISTS idx_opt_policies_negative_balance;",
                "DROP INDEX IF EXISTS idx_opt_entitlements_current_balance;",
                "DROP INDEX IF EXISTS idx_opt_entitlements_utilization;",
            ]
        ),
    ]