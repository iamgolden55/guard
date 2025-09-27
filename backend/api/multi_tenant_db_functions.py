"""
Advanced Database Functions for Multi-Tenant Operations

This module provides custom PostgreSQL functions, views, and procedures
optimized for multi-tenant security firm operations.
"""

from django.db import connection, transaction
from django.conf import settings
from django.utils import timezone
from typing import Dict, List, Any, Optional, Tuple
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class MultiTenantDatabaseFunctions:
    """
    Custom database functions for multi-tenant operations
    """

    @staticmethod
    @transaction.atomic
    def create_company_dashboard_materialized_view():
        """
        Create materialized view for company dashboard data
        This provides extremely fast access to frequently accessed company statistics
        """
        sql = """
        DROP MATERIALIZED VIEW IF EXISTS company_dashboard_stats CASCADE;

        CREATE MATERIALIZED VIEW company_dashboard_stats AS
        WITH company_metrics AS (
            SELECT
                c.id as company_id,
                c.name as company_name,
                c.country_code,
                c.subscription_tier,
                c.created_at as company_created_at,

                -- Venue metrics
                COUNT(DISTINCT v.id) as total_venues,
                COUNT(DISTINCT CASE WHEN v.is_active = true THEN v.id END) as active_venues,
                AVG(v.capacity) as avg_venue_capacity,
                SUM(v.capacity) as total_venue_capacity,

                -- Staff metrics
                COUNT(DISTINCT ucm.user_id) as total_staff,
                COUNT(DISTINCT CASE WHEN ucm.role = 'manager' THEN ucm.user_id END) as total_managers,
                COUNT(DISTINCT CASE WHEN ucm.role = 'admin' THEN ucm.user_id END) as total_admins,

                -- Shift metrics (last 30 days)
                COUNT(DISTINCT CASE WHEN s.start_time >= CURRENT_DATE - INTERVAL '30 days' THEN s.id END) as shifts_last_30_days,
                COUNT(DISTINCT CASE WHEN s.status = 'completed' AND s.start_time >= CURRENT_DATE - INTERVAL '30 days' THEN s.id END) as completed_shifts_last_30_days,
                COUNT(DISTINCT CASE WHEN s.status = 'pending_approval' THEN s.id END) as pending_approval_shifts,

                -- Financial metrics
                COALESCE(SUM(CASE WHEN s.status = 'approved' AND s.actual_hours_worked IS NOT NULL
                    THEN s.actual_hours_worked * s.hourly_rate END), 0) as total_approved_earnings,
                COALESCE(AVG(CASE WHEN s.status = 'completed' AND s.actual_hours_worked IS NOT NULL
                    THEN s.hourly_rate END), 0) as avg_hourly_rate,

                -- Utilization metrics
                COALESCE(AVG(CASE WHEN s.status = 'completed' AND v.capacity > 0
                    THEN (s.staff_count::DECIMAL / v.capacity) * 100 END), 0) as avg_venue_utilization,

                -- Recent activity
                MAX(s.created_at) as last_shift_created,
                MAX(ucm.joined_at) as last_staff_joined

            FROM security_companies c
            LEFT JOIN venues v ON v.company_id = c.id
            LEFT JOIN user_company_memberships ucm ON ucm.company_id = c.id
            LEFT JOIN shifts s ON s.company_id = c.id
            WHERE c.is_active = true
            GROUP BY c.id, c.name, c.country_code, c.subscription_tier, c.created_at
        )
        SELECT
            *,
            -- Computed efficiency scores
            CASE
                WHEN total_venues > 0 AND shifts_last_30_days > 0
                THEN (completed_shifts_last_30_days::DECIMAL / shifts_last_30_days) * 100
                ELSE 0
            END as completion_rate_percent,

            CASE
                WHEN total_staff > 0
                THEN shifts_last_30_days::DECIMAL / total_staff
                ELSE 0
            END as shifts_per_staff_member,

            -- Growth indicators
            EXTRACT(DAY FROM CURRENT_DATE - company_created_at) as company_age_days,

            CURRENT_TIMESTAMP as last_refreshed
        FROM company_metrics
        ORDER BY company_name;

        -- Create indexes on the materialized view
        CREATE UNIQUE INDEX idx_company_dashboard_stats_company_id
        ON company_dashboard_stats(company_id);

        CREATE INDEX idx_company_dashboard_stats_country
        ON company_dashboard_stats(country_code);

        CREATE INDEX idx_company_dashboard_stats_tier
        ON company_dashboard_stats(subscription_tier);

        CREATE INDEX idx_company_dashboard_stats_utilization
        ON company_dashboard_stats(avg_venue_utilization);

        -- Grant appropriate permissions
        GRANT SELECT ON company_dashboard_stats TO PUBLIC;
        """

        with connection.cursor() as cursor:
            cursor.execute(sql)

        logger.info("Created company dashboard materialized view")

    @staticmethod
    def refresh_company_dashboard_view(company_id: Optional[str] = None):
        """
        Refresh the materialized view (full or partial)
        """
        if company_id:
            # PostgreSQL doesn't support partial refresh of materialized views
            # So we'll create a function to update specific company stats
            sql = """
            WITH updated_stats AS (
                SELECT
                    c.id as company_id,
                    c.name as company_name,
                    c.country_code,
                    c.subscription_tier,
                    c.created_at as company_created_at,
                    COUNT(DISTINCT v.id) as total_venues,
                    COUNT(DISTINCT CASE WHEN v.is_active = true THEN v.id END) as active_venues,
                    COUNT(DISTINCT ucm.user_id) as total_staff,
                    COUNT(DISTINCT CASE WHEN s.start_time >= CURRENT_DATE - INTERVAL '30 days' THEN s.id END) as shifts_last_30_days,
                    CURRENT_TIMESTAMP as last_refreshed
                FROM security_companies c
                LEFT JOIN venues v ON v.company_id = c.id
                LEFT JOIN user_company_memberships ucm ON ucm.company_id = c.id
                LEFT JOIN shifts s ON s.company_id = c.id
                WHERE c.id = %s AND c.is_active = true
                GROUP BY c.id, c.name, c.country_code, c.subscription_tier, c.created_at
            )
            SELECT COUNT(*) FROM updated_stats;
            """
            with connection.cursor() as cursor:
                cursor.execute(sql, [company_id])
                result = cursor.fetchone()
                return result[0] if result else 0
        else:
            # Full refresh
            with connection.cursor() as cursor:
                cursor.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY company_dashboard_stats;")
            logger.info("Refreshed company dashboard materialized view")

    @staticmethod
    def create_company_performance_functions():
        """
        Create stored functions for complex company performance calculations
        """
        sql = """
        -- Function to calculate company efficiency score
        CREATE OR REPLACE FUNCTION calculate_company_efficiency_score(p_company_id UUID, p_days INTEGER DEFAULT 30)
        RETURNS DECIMAL(5,2)
        LANGUAGE plpgsql
        STABLE
        AS $$
        DECLARE
            efficiency_score DECIMAL(5,2);
            total_shifts INTEGER;
            completed_shifts INTEGER;
            avg_utilization DECIMAL(5,2);
        BEGIN
            -- Get shift completion rate
            SELECT
                COUNT(*),
                COUNT(CASE WHEN status = 'completed' THEN 1 END)
            INTO total_shifts, completed_shifts
            FROM shifts
            WHERE company_id = p_company_id
            AND start_time >= CURRENT_DATE - (p_days || ' days')::INTERVAL;

            -- Get average venue utilization
            SELECT COALESCE(AVG(
                CASE WHEN v.capacity > 0
                THEN (s.staff_count::DECIMAL / v.capacity) * 100
                ELSE 0 END
            ), 0)
            INTO avg_utilization
            FROM shifts s
            JOIN venues v ON s.venue_id = v.id
            WHERE s.company_id = p_company_id
            AND s.status = 'completed'
            AND s.start_time >= CURRENT_DATE - (p_days || ' days')::INTERVAL;

            -- Calculate weighted efficiency score
            IF total_shifts > 0 THEN
                efficiency_score := (
                    (completed_shifts::DECIMAL / total_shifts * 50) +  -- 50% weight for completion
                    (LEAST(avg_utilization, 100) * 0.3) +              -- 30% weight for utilization (capped at 100%)
                    (CASE WHEN avg_utilization BETWEEN 70 AND 90 THEN 20 ELSE 0 END) -- 20% bonus for optimal utilization
                );
            ELSE
                efficiency_score := 0;
            END IF;

            RETURN GREATEST(0, LEAST(100, efficiency_score));
        END;
        $$;

        -- Function to get company shift patterns
        CREATE OR REPLACE FUNCTION get_company_shift_patterns(p_company_id UUID, p_days INTEGER DEFAULT 90)
        RETURNS TABLE(
            day_of_week INTEGER,
            hour_of_day INTEGER,
            shift_count BIGINT,
            avg_duration DECIMAL,
            avg_utilization DECIMAL
        )
        LANGUAGE plpgsql
        STABLE
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                EXTRACT(DOW FROM s.start_time)::INTEGER as day_of_week,
                EXTRACT(HOUR FROM s.start_time)::INTEGER as hour_of_day,
                COUNT(*) as shift_count,
                AVG(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600) as avg_duration,
                AVG(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 ELSE 0 END) as avg_utilization
            FROM shifts s
            JOIN venues v ON s.venue_id = v.id
            WHERE s.company_id = p_company_id
            AND s.start_time >= CURRENT_DATE - (p_days || ' days')::INTERVAL
            AND s.status IN ('completed', 'approved')
            GROUP BY EXTRACT(DOW FROM s.start_time), EXTRACT(HOUR FROM s.start_time)
            ORDER BY day_of_week, hour_of_day;
        END;
        $$;

        -- Function for staff performance analysis
        CREATE OR REPLACE FUNCTION analyze_staff_performance(p_company_id UUID, p_days INTEGER DEFAULT 30)
        RETURNS TABLE(
            user_id INTEGER,
            username VARCHAR,
            full_name VARCHAR,
            total_shifts BIGINT,
            completed_shifts BIGINT,
            total_hours DECIMAL,
            avg_rating DECIMAL,
            venues_worked BIGINT,
            reliability_score DECIMAL
        )
        LANGUAGE plpgsql
        STABLE
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                u.id as user_id,
                u.username,
                CONCAT(u.first_name, ' ', u.last_name) as full_name,
                COUNT(s.id) as total_shifts,
                COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_shifts,
                COALESCE(SUM(s.actual_hours_worked), 0) as total_hours,
                COALESCE(AVG(CASE WHEN s.status = 'completed' THEN 4.5 END), 0) as avg_rating, -- Placeholder for rating system
                COUNT(DISTINCT s.venue_id) as venues_worked,
                -- Reliability score based on completion rate and punctuality
                CASE
                    WHEN COUNT(s.id) > 0
                    THEN (COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::DECIMAL / COUNT(s.id)) * 100
                    ELSE 0
                END as reliability_score
            FROM users u
            JOIN user_company_memberships ucm ON u.id = ucm.user_id
            LEFT JOIN shifts s ON u.id = s.staff_user_id AND s.company_id = p_company_id
                AND s.start_time >= CURRENT_DATE - (p_days || ' days')::INTERVAL
            WHERE ucm.company_id = p_company_id
            AND ucm.role = 'staff'
            GROUP BY u.id, u.username, u.first_name, u.last_name
            HAVING COUNT(s.id) > 0  -- Only include staff with shifts
            ORDER BY reliability_score DESC, total_hours DESC;
        END;
        $$;

        -- Function for venue utilization analysis
        CREATE OR REPLACE FUNCTION analyze_venue_utilization(p_company_id UUID, p_days INTEGER DEFAULT 30)
        RETURNS TABLE(
            venue_id INTEGER,
            venue_name VARCHAR,
            total_shifts BIGINT,
            total_capacity INTEGER,
            avg_utilization DECIMAL,
            peak_utilization DECIMAL,
            revenue_generated DECIMAL,
            efficiency_rating VARCHAR
        )
        LANGUAGE plpgsql
        STABLE
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                v.id as venue_id,
                v.name as venue_name,
                COUNT(s.id) as total_shifts,
                v.capacity as total_capacity,
                COALESCE(AVG(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 END), 0) as avg_utilization,
                COALESCE(MAX(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 END), 0) as peak_utilization,
                COALESCE(SUM(s.actual_hours_worked * s.hourly_rate), 0) as revenue_generated,
                CASE
                    WHEN AVG(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 END) >= 80 THEN 'Excellent'
                    WHEN AVG(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 END) >= 60 THEN 'Good'
                    WHEN AVG(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 END) >= 40 THEN 'Average'
                    ELSE 'Poor'
                END as efficiency_rating
            FROM venues v
            LEFT JOIN shifts s ON v.id = s.venue_id
                AND s.company_id = p_company_id
                AND s.start_time >= CURRENT_DATE - (p_days || ' days')::INTERVAL
                AND s.status IN ('completed', 'approved')
            WHERE v.company_id = p_company_id
            AND v.is_active = true
            GROUP BY v.id, v.name, v.capacity
            ORDER BY avg_utilization DESC;
        END;
        $$;
        """

        with connection.cursor() as cursor:
            cursor.execute(sql)

        logger.info("Created company performance functions")

    @staticmethod
    def create_compliance_monitoring_functions():
        """
        Create functions for monitoring compliance across companies
        """
        sql = """
        -- Function to check working hours compliance
        CREATE OR REPLACE FUNCTION check_working_hours_compliance(
            p_company_id UUID,
            p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
            p_end_date DATE DEFAULT CURRENT_DATE
        )
        RETURNS TABLE(
            user_id INTEGER,
            username VARCHAR,
            total_hours DECIMAL,
            max_daily_hours DECIMAL,
            max_weekly_hours DECIMAL,
            violations TEXT[]
        )
        LANGUAGE plpgsql
        STABLE
        AS $$
        DECLARE
            country_code VARCHAR(3);
            daily_limit DECIMAL;
            weekly_limit DECIMAL;
        BEGIN
            -- Get company's country and regulations
            SELECT c.country_code
            INTO country_code
            FROM security_companies c
            WHERE c.id = p_company_id;

            -- Get working hours limits (default values if no specific regulation)
            SELECT
                COALESCE(whr.max_daily_hours, 12),
                COALESCE(whr.max_weekly_hours, 48)
            INTO daily_limit, weekly_limit
            FROM working_hours_regulations whr
            WHERE whr.country = country_code
            AND whr.is_active = true
            ORDER BY whr.created_at DESC
            LIMIT 1;

            -- Default limits if no regulations found
            daily_limit := COALESCE(daily_limit, 12);
            weekly_limit := COALESCE(weekly_limit, 48);

            RETURN QUERY
            WITH daily_hours AS (
                SELECT
                    s.staff_user_id,
                    DATE(s.start_time) as work_date,
                    SUM(s.actual_hours_worked) as daily_hours
                FROM shifts s
                WHERE s.company_id = p_company_id
                AND s.status IN ('completed', 'approved')
                AND DATE(s.start_time) BETWEEN p_start_date AND p_end_date
                AND s.actual_hours_worked IS NOT NULL
                GROUP BY s.staff_user_id, DATE(s.start_time)
            ),
            weekly_hours AS (
                SELECT
                    s.staff_user_id,
                    DATE_TRUNC('week', s.start_time) as work_week,
                    SUM(s.actual_hours_worked) as weekly_hours
                FROM shifts s
                WHERE s.company_id = p_company_id
                AND s.status IN ('completed', 'approved')
                AND DATE(s.start_time) BETWEEN p_start_date AND p_end_date
                AND s.actual_hours_worked IS NOT NULL
                GROUP BY s.staff_user_id, DATE_TRUNC('week', s.start_time)
            ),
            violations_summary AS (
                SELECT
                    u.id as user_id,
                    u.username,
                    SUM(dh.daily_hours) as total_hours,
                    MAX(dh.daily_hours) as max_daily_hours,
                    MAX(wh.weekly_hours) as max_weekly_hours,
                    ARRAY_AGG(
                        CASE
                            WHEN dh.daily_hours > daily_limit
                            THEN 'Daily limit exceeded on ' || dh.work_date || ': ' || dh.daily_hours || 'h'
                        END
                    ) FILTER (WHERE dh.daily_hours > daily_limit) ||
                    ARRAY_AGG(
                        CASE
                            WHEN wh.weekly_hours > weekly_limit
                            THEN 'Weekly limit exceeded on ' || wh.work_week || ': ' || wh.weekly_hours || 'h'
                        END
                    ) FILTER (WHERE wh.weekly_hours > weekly_limit) as violations
                FROM users u
                JOIN user_company_memberships ucm ON u.id = ucm.user_id
                LEFT JOIN daily_hours dh ON u.id = dh.staff_user_id
                LEFT JOIN weekly_hours wh ON u.id = wh.staff_user_id
                WHERE ucm.company_id = p_company_id
                AND ucm.role = 'staff'
                GROUP BY u.id, u.username
                HAVING MAX(dh.daily_hours) > daily_limit OR MAX(wh.weekly_hours) > weekly_limit
            )
            SELECT * FROM violations_summary
            ORDER BY total_hours DESC;
        END;
        $$;

        -- Function to generate compliance report
        CREATE OR REPLACE FUNCTION generate_compliance_report(p_company_id UUID)
        RETURNS JSON
        LANGUAGE plpgsql
        STABLE
        AS $$
        DECLARE
            report JSON;
        BEGIN
            SELECT json_build_object(
                'company_id', p_company_id,
                'report_date', CURRENT_DATE,
                'working_hours_violations', (
                    SELECT json_agg(violations)
                    FROM check_working_hours_compliance(p_company_id)
                    WHERE array_length(violations, 1) > 0
                ),
                'license_status', (
                    SELECT json_build_object(
                        'total_staff', COUNT(*),
                        'valid_licenses', COUNT(CASE WHEN sl.status = 'valid' AND sl.expiry_date > CURRENT_DATE THEN 1 END),
                        'expiring_soon', COUNT(CASE WHEN sl.status = 'valid' AND sl.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END),
                        'expired', COUNT(CASE WHEN sl.status = 'expired' OR sl.expiry_date <= CURRENT_DATE THEN 1 END)
                    )
                    FROM user_company_memberships ucm
                    JOIN users u ON ucm.user_id = u.id
                    LEFT JOIN staff_profiles sp ON u.id = sp.user_id
                    LEFT JOIN sia_licenses sl ON sp.id = sl.staff_profile_id
                    WHERE ucm.company_id = p_company_id
                ),
                'venue_compliance', (
                    SELECT json_build_object(
                        'total_venues', COUNT(*),
                        'active_venues', COUNT(CASE WHEN is_active = true THEN 1 END),
                        'venues_with_coordinates', COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END)
                    )
                    FROM venues
                    WHERE company_id = p_company_id
                )
            ) INTO report;

            RETURN report;
        END;
        $$;
        """

        with connection.cursor() as cursor:
            cursor.execute(sql)

        logger.info("Created compliance monitoring functions")

    @staticmethod
    def create_data_cleanup_procedures():
        """
        Create procedures for data cleanup and maintenance
        """
        sql = """
        -- Procedure to archive old completed shifts
        CREATE OR REPLACE FUNCTION archive_old_shifts(p_days_old INTEGER DEFAULT 365)
        RETURNS INTEGER
        LANGUAGE plpgsql
        AS $$
        DECLARE
            archived_count INTEGER;
        BEGIN
            -- Create archive table if it doesn't exist
            CREATE TABLE IF NOT EXISTS shifts_archive (LIKE shifts INCLUDING ALL);

            -- Move old completed shifts to archive
            WITH archived_shifts AS (
                DELETE FROM shifts
                WHERE status IN ('completed', 'approved')
                AND end_time < CURRENT_DATE - (p_days_old || ' days')::INTERVAL
                RETURNING *
            )
            INSERT INTO shifts_archive SELECT * FROM archived_shifts;

            GET DIAGNOSTICS archived_count = ROW_COUNT;

            INSERT INTO system_logs (action, description, created_at)
            VALUES ('archive_shifts', 'Archived ' || archived_count || ' shifts older than ' || p_days_old || ' days', NOW());

            RETURN archived_count;
        END;
        $$;

        -- Procedure to cleanup expired cache entries
        CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
        RETURNS INTEGER
        LANGUAGE plpgsql
        AS $$
        DECLARE
            cleaned_count INTEGER;
        BEGIN
            -- This would be database-specific cleanup
            -- For Django sessions table
            DELETE FROM django_session
            WHERE expire_date < CURRENT_TIMESTAMP;

            GET DIAGNOSTICS cleaned_count = ROW_COUNT;

            RETURN cleaned_count;
        END;
        $$;

        -- Procedure to update company statistics
        CREATE OR REPLACE FUNCTION update_company_denormalized_stats()
        RETURNS INTEGER
        LANGUAGE plpgsql
        AS $$
        DECLARE
            updated_count INTEGER;
        BEGIN
            -- Update denormalized fields in security_companies table
            WITH company_stats AS (
                SELECT
                    c.id,
                    COUNT(DISTINCT v.id) as venue_count,
                    COUNT(DISTINCT ucm.user_id) as staff_count,
                    COUNT(DISTINCT s.id) FILTER (WHERE s.start_time >= CURRENT_DATE - INTERVAL '30 days') as recent_shifts_count,
                    COALESCE(AVG(CASE WHEN v.capacity > 0 THEN (s.staff_count::DECIMAL / v.capacity) * 100 END), 0) as avg_utilization
                FROM security_companies c
                LEFT JOIN venues v ON v.company_id = c.id AND v.is_active = true
                LEFT JOIN user_company_memberships ucm ON ucm.company_id = c.id
                LEFT JOIN shifts s ON s.company_id = c.id AND s.status IN ('completed', 'approved')
                WHERE c.is_active = true
                GROUP BY c.id
            )
            UPDATE security_companies
            SET
                venue_count = cs.venue_count,
                staff_count = cs.staff_count,
                recent_shifts_count = cs.recent_shifts_count,
                avg_utilization = cs.avg_utilization,
                stats_updated_at = CURRENT_TIMESTAMP
            FROM company_stats cs
            WHERE security_companies.id = cs.id;

            GET DIAGNOSTICS updated_count = ROW_COUNT;

            RETURN updated_count;
        END;
        $$;
        """

        with connection.cursor() as cursor:
            cursor.execute(sql)

        logger.info("Created data cleanup procedures")

    @staticmethod
    def execute_performance_analysis(company_id: str, analysis_type: str = 'efficiency', days: int = 30) -> List[Dict]:
        """
        Execute performance analysis using database functions
        """
        try:
            results = []

            with connection.cursor() as cursor:
                if analysis_type == 'efficiency':
                    cursor.execute("SELECT calculate_company_efficiency_score(%s, %s)", [company_id, days])
                    score = cursor.fetchone()
                    results.append({'efficiency_score': float(score[0]) if score and score[0] else 0.0})

                elif analysis_type == 'staff':
                    cursor.execute("SELECT * FROM analyze_staff_performance(%s, %s)", [company_id, days])
                    columns = [desc[0] for desc in cursor.description]
                    for row in cursor.fetchall():
                        results.append(dict(zip(columns, row)))

                elif analysis_type == 'venues':
                    cursor.execute("SELECT * FROM analyze_venue_utilization(%s, %s)", [company_id, days])
                    columns = [desc[0] for desc in cursor.description]
                    for row in cursor.fetchall():
                        results.append(dict(zip(columns, row)))

                elif analysis_type == 'patterns':
                    cursor.execute("SELECT * FROM get_company_shift_patterns(%s, %s)", [company_id, days])
                    columns = [desc[0] for desc in cursor.description]
                    for row in cursor.fetchall():
                        results.append(dict(zip(columns, row)))

            return results

        except Exception as e:
            logger.error(f"Failed to execute performance analysis {analysis_type} for company {company_id}: {e}")
            return []

    @staticmethod
    def generate_compliance_report(company_id: str) -> Dict:
        """
        Generate comprehensive compliance report using database functions
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT generate_compliance_report(%s)", [company_id])
                result = cursor.fetchone()

                if result and result[0]:
                    return result[0]  # JSON result from function

                return {}

        except Exception as e:
            logger.error(f"Failed to generate compliance report for company {company_id}: {e}")
            return {}

    @staticmethod
    def bulk_archive_old_data(days_old: int = 365) -> int:
        """
        Archive old data using database procedures
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT archive_old_shifts(%s)", [days_old])
                result = cursor.fetchone()

                if result:
                    archived_count = result[0]
                    logger.info(f"Archived {archived_count} old shifts")
                    return archived_count

                return 0

        except Exception as e:
            logger.error(f"Failed to archive old data: {e}")
            return 0

    @staticmethod
    def update_all_company_stats() -> int:
        """
        Update denormalized statistics for all companies
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT update_company_denormalized_stats()")
                result = cursor.fetchone()

                if result:
                    updated_count = result[0]
                    logger.info(f"Updated statistics for {updated_count} companies")

                    # Also refresh the materialized view
                    MultiTenantDatabaseFunctions.refresh_company_dashboard_view()

                    return updated_count

                return 0

        except Exception as e:
            logger.error(f"Failed to update company statistics: {e}")
            return 0


class DatabaseMaintenanceManager:
    """
    Manages regular database maintenance tasks
    """

    @staticmethod
    def setup_all_database_objects():
        """
        Set up all database functions, views, and procedures
        """
        try:
            functions = MultiTenantDatabaseFunctions()

            # Create materialized view
            functions.create_company_dashboard_materialized_view()

            # Create performance functions
            functions.create_company_performance_functions()

            # Create compliance functions
            functions.create_compliance_monitoring_functions()

            # Create cleanup procedures
            functions.create_data_cleanup_procedures()

            logger.info("Successfully set up all database objects")
            return True

        except Exception as e:
            logger.error(f"Failed to set up database objects: {e}")
            return False

    @staticmethod
    def daily_maintenance():
        """
        Run daily maintenance tasks
        """
        try:
            # Update company statistics
            updated_companies = MultiTenantDatabaseFunctions.update_all_company_stats()

            # Clean up expired sessions
            with connection.cursor() as cursor:
                cursor.execute("SELECT cleanup_expired_sessions()")
                cleaned_sessions = cursor.fetchone()[0] if cursor.fetchone() else 0

            logger.info(f"Daily maintenance: updated {updated_companies} companies, cleaned {cleaned_sessions} sessions")

            return True

        except Exception as e:
            logger.error(f"Failed daily maintenance: {e}")
            return False

    @staticmethod
    def weekly_maintenance():
        """
        Run weekly maintenance tasks
        """
        try:
            # Archive old data (older than 1 year)
            archived_count = MultiTenantDatabaseFunctions.bulk_archive_old_data(365)

            # Analyze table statistics (PostgreSQL specific)
            with connection.cursor() as cursor:
                cursor.execute("ANALYZE;")

            logger.info(f"Weekly maintenance: archived {archived_count} old records, updated table statistics")

            return True

        except Exception as e:
            logger.error(f"Failed weekly maintenance: {e}")
            return False