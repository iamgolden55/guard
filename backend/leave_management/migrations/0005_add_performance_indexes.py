# Generated manually for performance optimization
# Migration created by django-orm-expert agent

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leave_management', '0004_blackoutperiod_leavebalance_leaverequest'),
        ('api', '0020_add_enforcement_visit_model'),
    ]

    operations = [
        # Composite indexes for Team Overview page optimization
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS leave_balance_team_overview_idx
            ON leave_balances (staff_user_id, year, leave_type_id)
            INCLUDE (current_balance, pending_balance);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS leave_balance_team_overview_idx;
            """,
        ),

        # Index for leave requests filtering by team members and status
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS leave_request_team_status_idx
            ON leave_requests (staff_user_id, status, start_date)
            INCLUDE (end_date, days_requested);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS leave_request_team_status_idx;
            """,
        ),

        # Aggregation optimization for Leave Reports page
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS leave_request_reports_idx
            ON leave_requests (leave_type_id, status, start_date)
            INCLUDE (days_requested, staff_user_id);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS leave_request_reports_idx;
            """,
        ),

        # Date range queries for calendar and reporting
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS leave_request_date_range_idx
            ON leave_requests (start_date, end_date, status)
            INCLUDE (staff_user_id, leave_type_id, days_requested);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS leave_request_date_range_idx;
            """,
        ),

        # Employment type filtering for policies (PostgreSQL partial index)
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS leave_policy_employment_type_idx
            ON leave_policies (is_active, effective_date, expiry_date)
            WHERE is_active = true;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS leave_policy_employment_type_idx;
            """,
        ),

        # Blackout period overlapping queries optimization
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS blackout_period_overlap_idx
            ON blackout_periods (start_date, end_date, is_active, venue_id)
            WHERE is_active = true;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS blackout_period_overlap_idx;
            """,
        ),

        # Leave balance calculations optimization
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS leave_balance_calculations_idx
            ON leave_balances (leave_type_id, year, last_updated)
            INCLUDE (opening_balance, accrued_balance, used_balance, pending_balance);
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS leave_balance_calculations_idx;
            """,
        ),

        # User profile optimization for leave eligibility checks
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS staff_profile_leave_eligibility_idx
            ON staff_profiles (employment_type_id, is_approved)
            WHERE is_approved = true;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS staff_profile_leave_eligibility_idx;
            """,
        ),
    ]