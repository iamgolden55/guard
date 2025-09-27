"""
Database Indexing Strategy for Leave Management System
=====================================================

This module defines comprehensive indexing strategies for optimal query performance
in the leave management system. Includes both standard and PostgreSQL-specific indexes.

Author: Django ORM Expert Agent
Phase: 1 - Leave Management System Enhancement
Task: TASK-008 - Set up database indexing strategy
"""

from django.db import models
from django.contrib.postgres.indexes import GinIndex, BrinIndex, HashIndex
from django.contrib.postgres.operations import BtreeGinExtension, BtreeGistExtension


class LeaveManagementIndexingStrategy:
    """
    Comprehensive indexing strategy for leave management performance optimization
    """

    # Core indexes for primary access patterns
    CORE_INDEXES = [
        # User-based lookups (most common)
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_user_year',
            'fields': ['user_id', 'year'],
            'description': 'Primary user lookup pattern for current year balances'
        },
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_user_policy_year',
            'fields': ['user_id', 'policy_id', 'year'],
            'description': 'Unique entitlement lookup'
        },

        # Policy-based lookups
        {
            'model': 'leave_policies',
            'name': 'idx_policies_leave_type_active',
            'fields': ['leave_type_id', 'is_active'],
            'description': 'Active policies by leave type'
        },
        {
            'model': 'leave_policies',
            'name': 'idx_policies_active_dates',
            'fields': ['is_active', 'effective_date', 'expiry_date'],
            'description': 'Active policies within date ranges'
        },

        # Leave type lookups
        {
            'model': 'leave_types',
            'name': 'idx_leave_types_active_order',
            'fields': ['is_active', 'display_order'],
            'description': 'Active leave types in display order'
        }
    ]

    # Time-series indexes for date-based queries
    TIME_SERIES_INDEXES = [
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_accrual_date',
            'fields': ['last_accrual_date'],
            'type': 'btree',
            'description': 'Accrual processing by date'
        },
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_carryover_expiry',
            'fields': ['carryover_expiry_date'],
            'type': 'btree',
            'description': 'Carryover expiry processing'
        },
        {
            'model': 'leave_entitlements',
            'name': 'brin_entitlements_dates',
            'fields': ['last_accrual_date', 'carryover_expiry_date'],
            'type': 'brin',
            'description': 'BRIN index for time-series data (PostgreSQL)'
        }
    ]

    # Reporting and analytics indexes
    ANALYTICS_INDEXES = [
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_year_policy',
            'fields': ['year', 'policy_id'],
            'description': 'Year-based reporting by policy'
        },
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_balance_calc',
            'fields': ['year', 'used_to_date', 'annual_entitlement'],
            'description': 'Balance calculation optimization'
        }
    ]

    # Partial indexes for specific conditions
    PARTIAL_INDEXES = [
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_low_balance',
            'fields': ['user_id', 'policy_id'],
            'condition': '(annual_entitlement + carried_over + accrued_to_date - used_to_date) <= 5',
            'description': 'Employees with low leave balance'
        },
        {
            'model': 'leave_entitlements',
            'name': 'idx_entitlements_high_usage',
            'fields': ['user_id', 'policy_id'],
            'condition': 'used_to_date > (annual_entitlement * 0.8)',
            'description': 'High usage employees (80%+ utilization)'
        },
        {
            'model': 'leave_policies',
            'name': 'idx_policies_negative_balance_allowed',
            'fields': ['leave_type_id'],
            'condition': 'allow_negative_balance = true',
            'description': 'Policies allowing negative balance'
        }
    ]

    # JSON field indexes (PostgreSQL)
    JSON_INDEXES = [
        {
            'model': 'leave_policies',
            'name': 'gin_policies_service_brackets',
            'fields': ['service_brackets'],
            'type': 'gin',
            'description': 'GIN index for service brackets JSON queries'
        }
    ]

    # Full-text search indexes
    FULLTEXT_INDEXES = [
        {
            'model': 'leave_types',
            'name': 'gin_leave_types_search',
            'fields': ['name', 'description'],
            'type': 'gin',
            'ops_classes': ['gin_trgm_ops', 'gin_trgm_ops'],
            'description': 'Full-text search on leave type name and description'
        },
        {
            'model': 'leave_policies',
            'name': 'gin_policies_search',
            'fields': ['name'],
            'type': 'gin',
            'ops_classes': ['gin_trgm_ops'],
            'description': 'Full-text search on policy names'
        }
    ]

    @classmethod
    def get_all_indexes(cls):
        """Get all indexes organized by category"""
        return {
            'core': cls.CORE_INDEXES,
            'time_series': cls.TIME_SERIES_INDEXES,
            'analytics': cls.ANALYTICS_INDEXES,
            'partial': cls.PARTIAL_INDEXES,
            'json': cls.JSON_INDEXES,
            'fulltext': cls.FULLTEXT_INDEXES
        }

    @classmethod
    def generate_migration_sql(cls, database='postgresql'):
        """Generate SQL statements for creating indexes"""
        sql_statements = []

        if database == 'postgresql':
            # Enable required extensions
            sql_statements.extend([
                "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
                "CREATE EXTENSION IF NOT EXISTS btree_gin;",
                ""
            ])

        # Core indexes
        for index in cls.CORE_INDEXES:
            fields_str = ', '.join(index['fields'])
            sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} ({fields_str});"
            sql_statements.append(f"-- {index['description']}")
            sql_statements.append(sql)
            sql_statements.append("")

        # Time-series indexes
        for index in cls.TIME_SERIES_INDEXES:
            fields_str = ', '.join(index['fields'])
            if index.get('type') == 'brin' and database == 'postgresql':
                sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} USING BRIN ({fields_str});"
            else:
                sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} ({fields_str});"

            sql_statements.append(f"-- {index['description']}")
            sql_statements.append(sql)
            sql_statements.append("")

        # Analytics indexes
        for index in cls.ANALYTICS_INDEXES:
            fields_str = ', '.join(index['fields'])
            sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} ({fields_str});"
            sql_statements.append(f"-- {index['description']}")
            sql_statements.append(sql)
            sql_statements.append("")

        # Partial indexes (PostgreSQL only)
        if database == 'postgresql':
            for index in cls.PARTIAL_INDEXES:
                fields_str = ', '.join(index['fields'])
                condition = index['condition']
                sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} ({fields_str}) WHERE {condition};"
                sql_statements.append(f"-- {index['description']}")
                sql_statements.append(sql)
                sql_statements.append("")

            # JSON indexes
            for index in cls.JSON_INDEXES:
                fields_str = ', '.join(index['fields'])
                sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} USING GIN ({fields_str});"
                sql_statements.append(f"-- {index['description']}")
                sql_statements.append(sql)
                sql_statements.append("")

            # Full-text search indexes
            for index in cls.FULLTEXT_INDEXES:
                fields_str = ', '.join(index['fields'])
                if 'ops_classes' in index:
                    ops_str = ', '.join(index['ops_classes'])
                    fields_with_ops = ', '.join([
                        f"{field} {ops}" for field, ops in zip(index['fields'], index['ops_classes'])
                    ])
                    sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} USING GIN ({fields_with_ops});"
                else:
                    sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['model']} USING GIN ({fields_str});"

                sql_statements.append(f"-- {index['description']}")
                sql_statements.append(sql)
                sql_statements.append("")

        return sql_statements


class IndexMaintenanceStrategy:
    """
    Strategies for maintaining indexes and monitoring performance
    """

    @staticmethod
    def generate_index_monitoring_queries():
        """Generate queries for monitoring index usage and performance"""
        return {
            'index_usage': """
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    idx_tup_read,
                    idx_tup_fetch,
                    idx_scan,
                    idx_tup_read::float / NULLIF(idx_scan, 0) as avg_tuples_per_scan
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public'
                    AND (tablename LIKE '%leave%' OR tablename LIKE '%entitlement%')
                ORDER BY idx_scan DESC;
            """,

            'unused_indexes': """
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
                FROM pg_stat_user_indexes
                WHERE idx_scan = 0
                    AND schemaname = 'public'
                    AND (tablename LIKE '%leave%' OR tablename LIKE '%entitlement%')
                ORDER BY pg_relation_size(indexrelid) DESC;
            """,

            'index_bloat': """
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                    ROUND(100 * (pg_relation_size(indexrelid) - pg_relation_size(indexrelid, 'main'))::numeric /
                          NULLIF(pg_relation_size(indexrelid), 0), 2) as bloat_percentage
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public'
                    AND (tablename LIKE '%leave%' OR tablename LIKE '%entitlement%')
                    AND pg_relation_size(indexrelid) > 1000000  -- Only indexes > 1MB
                ORDER BY bloat_percentage DESC;
            """,

            'slow_queries': """
                SELECT
                    query,
                    calls,
                    total_time,
                    mean_time,
                    min_time,
                    max_time
                FROM pg_stat_statements
                WHERE query ILIKE '%leave%' OR query ILIKE '%entitlement%'
                ORDER BY mean_time DESC
                LIMIT 10;
            """
        }

    @staticmethod
    def generate_reindex_strategy():
        """Generate strategy for periodic index maintenance"""
        return {
            'monthly_maintenance': [
                'REINDEX INDEX CONCURRENTLY idx_entitlements_user_year;',
                'REINDEX INDEX CONCURRENTLY idx_entitlements_accrual_date;',
                'ANALYZE leave_entitlements;'
            ],

            'quarterly_maintenance': [
                'REINDEX TABLE CONCURRENTLY leave_entitlements;',
                'REINDEX TABLE CONCURRENTLY leave_policies;',
                'VACUUM ANALYZE leave_entitlements;',
                'VACUUM ANALYZE leave_policies;'
            ],

            'annual_maintenance': [
                'REINDEX DATABASE CONCURRENTLY;',
                'VACUUM FULL ANALYZE;'
            ]
        }


class PerformanceBenchmarks:
    """
    Performance benchmarks and testing strategies
    """

    TARGET_PERFORMANCE_METRICS = {
        # Query performance targets (in milliseconds)
        'user_balance_lookup': 50,      # Single user balance lookup
        'bulk_balance_calculation': 500, # 100 users balance calculation
        'leave_summary_report': 200,    # Leave summary by type
        'accrual_processing_batch': 1000, # Process 1000 accruals
        'analytics_queries': 2000,      # Complex analytics queries

        # Index effectiveness targets
        'index_hit_ratio': 99,          # Minimum index hit ratio (%)
        'table_scan_ratio': 1,          # Maximum table scan ratio (%)

        # Database metrics
        'buffer_hit_ratio': 99,         # Buffer cache hit ratio (%)
        'checkpoint_completion': 90,    # Checkpoint completion target (%)
    }

    @staticmethod
    def generate_performance_test_queries():
        """Generate queries for performance testing"""
        return {
            'single_user_balance': """
                -- Test: Single user balance lookup (Target: <50ms)
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT
                    le.*,
                    (le.annual_entitlement + le.carried_over + le.accrued_to_date - le.used_to_date) as current_balance
                FROM leave_entitlements le
                JOIN leave_policies lp ON le.policy_id = lp.id
                JOIN leave_types lt ON lp.leave_type_id = lt.id
                WHERE le.user_id = %s AND le.year = %s;
            """,

            'bulk_balance_calculation': """
                -- Test: Bulk balance calculation (Target: <500ms for 100 users)
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT
                    le.user_id,
                    lt.name as leave_type,
                    le.annual_entitlement,
                    le.used_to_date,
                    (le.annual_entitlement + le.carried_over + le.accrued_to_date - le.used_to_date) as current_balance
                FROM leave_entitlements le
                JOIN leave_policies lp ON le.policy_id = lp.id
                JOIN leave_types lt ON lp.leave_type_id = lt.id
                WHERE le.user_id = ANY(%s) AND le.year = %s
                ORDER BY le.user_id, lt.display_order;
            """,

            'leave_summary_report': """
                -- Test: Leave summary report (Target: <200ms)
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT
                    lt.name,
                    COUNT(DISTINCT le.user_id) as employee_count,
                    SUM(le.annual_entitlement) as total_entitlement,
                    SUM(le.used_to_date) as total_used,
                    ROUND(AVG(le.used_to_date::numeric / NULLIF(le.annual_entitlement, 0) * 100), 2) as avg_utilization
                FROM leave_entitlements le
                JOIN leave_policies lp ON le.policy_id = lp.id
                JOIN leave_types lt ON lp.leave_type_id = lt.id
                WHERE le.year = %s
                GROUP BY lt.id, lt.name, lt.display_order
                ORDER BY lt.display_order;
            """
        }

    @staticmethod
    def get_performance_monitoring_setup():
        """Get setup for continuous performance monitoring"""
        return {
            'pg_stat_statements_config': {
                'shared_preload_libraries': 'pg_stat_statements',
                'pg_stat_statements.max': '10000',
                'pg_stat_statements.track': 'all'
            },

            'monitoring_queries': {
                'slow_query_detection': """
                    SELECT
                        query,
                        calls,
                        total_time,
                        mean_time,
                        rows / calls as avg_rows
                    FROM pg_stat_statements
                    WHERE mean_time > 100  -- Queries slower than 100ms
                        AND query ILIKE '%leave%'
                    ORDER BY mean_time DESC;
                """,

                'index_effectiveness': """
                    SELECT
                        schemaname,
                        tablename,
                        ROUND(100 * idx_scan::numeric / (seq_scan + idx_scan), 2) as index_usage_pct,
                        n_tup_ins + n_tup_upd + n_tup_del as write_activity,
                        seq_scan,
                        idx_scan
                    FROM pg_stat_user_tables
                    WHERE schemaname = 'public'
                        AND (tablename LIKE '%leave%' OR tablename LIKE '%entitlement%')
                    ORDER BY index_usage_pct;
                """
            },

            'alerting_thresholds': {
                'slow_query_threshold_ms': 100,
                'index_usage_min_pct': 95,
                'buffer_hit_ratio_min_pct': 99
            }
        }