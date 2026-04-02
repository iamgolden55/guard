"""
Report Generation Utilities
Handles the generation of various report formats from SQL queries
"""
import csv
import json
import os
import tempfile
from datetime import datetime
from typing import Dict, List, Any, Optional
from django.db import connection
from django.conf import settings
import logging
import pandas as pd
from .export_handlers import get_export_handler, get_available_formats

logger = logging.getLogger(__name__)


class ReportGenerator:
    """Main report generation class"""

    def __init__(self, template, export_format, date_range_start=None, date_range_end=None, filters=None, user=None):
        self.template = template
        self.export_format = export_format
        self.date_range_start = date_range_start
        self.date_range_end = date_range_end
        self.filters = filters or {}
        self.user = user

    def generate(self) -> Dict[str, Any]:
        """Generate the report and return result information"""
        try:
            # Execute the SQL query
            data = self._execute_query()

            # Generate report data structure
            report_data = self._prepare_report_data(data)

            # Handle different export formats
            if self.export_format in ['csv', 'json']:
                # Use legacy methods for backward compatibility
                if self.export_format == 'csv':
                    return self._generate_csv(data)
                else:
                    return self._generate_json(data)
            elif self.export_format in ['pdf', 'excel', 'xlsx']:
                # Use new export handlers for advanced formats
                return self._generate_with_handler(report_data)
            else:
                raise ValueError(f"Unsupported export format: {self.export_format}")

        except Exception as e:
            logger.error(f"Report generation failed: {str(e)}")
            raise

    def _execute_query(self) -> List[Dict[str, Any]]:
        """Execute the SQL query and return results"""
        # Prepare query parameters
        params = self._prepare_query_parameters()

        # Basic SQL injection protection
        self._validate_query_safety()

        with connection.cursor() as cursor:
            try:
                cursor.execute(self.template.sql_query, params)

                # Get column names
                columns = [col[0] for col in cursor.description]

                # Fetch all results
                rows = cursor.fetchall()

                # Convert to list of dictionaries
                data = []
                for row in rows:
                    data.append(dict(zip(columns, row)))

                logger.info(f"Query executed successfully, returned {len(data)} rows")
                return data

            except Exception as e:
                logger.error(f"SQL execution error: {str(e)}")
                raise

    def _prepare_query_parameters(self) -> Dict[str, Any]:
        """Prepare parameters for the SQL query"""
        params = {}

        # Add date range parameters
        if self.date_range_start:
            params['date_start'] = self.date_range_start
        if self.date_range_end:
            params['date_end'] = self.date_range_end

        # Add filter parameters
        for key, value in self.filters.items():
            params[key] = value

        # Add template-defined parameters with defaults
        for param_name, param_config in self.template.parameters.items():
            if param_name not in params:
                # Use default value if provided
                if 'default' in param_config:
                    params[param_name] = param_config['default']

        return params

    def _validate_query_safety(self):
        """Validate that query is a safe, read-only SELECT statement.

        SECURITY: Uses an allowlist approach: the query MUST start with SELECT
        (after stripping comments and whitespace), blocks semicolons to prevent
        statement chaining, and blocks dangerous PostgreSQL functions, system
        catalog access, and data exfiltration patterns.
        """
        import re

        query = self.template.sql_query.strip()

        # Strip SQL comments (both -- and /* */ style)
        query_no_comments = re.sub(r'--[^\n]*', ' ', query)
        query_no_comments = re.sub(r'/\*.*?\*/', ' ', query_no_comments, flags=re.DOTALL)
        query_clean = query_no_comments.strip()

        # Must start with SELECT (allowlist approach)
        if not re.match(r'^\s*SELECT\b', query_clean, re.IGNORECASE):
            raise ValueError("Only SELECT queries are allowed")

        # Block semicolons — prevents statement chaining
        if ';' in query_clean:
            raise ValueError("Query must not contain semicolons")

        # Block dangerous keywords even within SELECT (subqueries, CTEs, etc.)
        dangerous_patterns = [
            # DDL/DML operations
            r'\bDROP\b', r'\bDELETE\b', r'\bTRUNCATE\b', r'\bALTER\b',
            r'\bCREATE\b', r'\bINSERT\b', r'\bUPDATE\b', r'\bEXEC\b',
            r'\bEXECUTE\b', r'\bGRANT\b', r'\bREVOKE\b', r'\bCOPY\b',
            # PostgreSQL file/system access functions
            r'\bpg_read_file\b', r'\bpg_write_file\b', r'\bpg_ls_dir\b',
            r'\bpg_read_binary_file\b', r'\bpg_stat_file\b',
            r'\blo_import\b', r'\blo_export\b', r'\blo_create\b',
            r'\blo_unlink\b', r'\bpg_largeobject\b',
            # PostgreSQL remote execution
            r'\bdblink\b', r'\bdblink_exec\b', r'\bdblink_connect\b',
            # MySQL-specific (defense in depth)
            r'\bINTO\s+OUTFILE\b', r'\bINTO\s+DUMPFILE\b', r'\bLOAD_FILE\b',
            # SELECT INTO (creates tables/variables)
            r'\bSELECT\b[^;]*\bINTO\b',
            # Session/role manipulation
            r'\bSET\s+ROLE\b', r'\bSET\s+SESSION\b', r'\bSET\s+LOCAL\b',
            r'\bRESET\s+ROLE\b',
            # System catalog access (cross-tenant data exposure)
            r'\binformation_schema\b', r'\bpg_catalog\b',
            r'\bpg_shadow\b', r'\bpg_authid\b', r'\bpg_roles\b',
            r'\bpg_user\b', r'\bpg_stat_activity\b',
            # Notification channels (side-channel data exfiltration)
            r'\bpg_notify\b', r'\bNOTIFY\b', r'\bLISTEN\b',
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, query_clean, re.IGNORECASE):
                raise ValueError("Query contains prohibited operation")

    def _generate_csv(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate CSV format report"""
        if not data:
            return {
                'status': 'success',
                'format': 'csv',
                'row_count': 0,
                'data': '',
                'message': 'No data found for the specified criteria'
            }

        # Create CSV content
        output = []

        # Get headers from first row
        headers = list(data[0].keys())

        # Convert to CSV format in memory
        import io
        csv_buffer = io.StringIO()
        writer = csv.DictWriter(csv_buffer, fieldnames=headers)

        writer.writeheader()
        for row in data:
            # Handle None values and convert to strings
            cleaned_row = {}
            for key, value in row.items():
                if value is None:
                    cleaned_row[key] = ''
                elif isinstance(value, datetime):
                    cleaned_row[key] = value.isoformat()
                else:
                    cleaned_row[key] = str(value)
            writer.writerow(cleaned_row)

        csv_content = csv_buffer.getvalue()
        csv_buffer.close()

        return {
            'status': 'success',
            'format': 'csv',
            'row_count': len(data),
            'data': csv_content,
            'headers': headers,
            'message': f'CSV report generated with {len(data)} rows'
        }

    def _generate_json(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate JSON format report"""
        # Handle datetime serialization
        def json_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        # Create JSON content
        json_content = json.dumps({
            'template': {
                'id': self.template.id,
                'name': self.template.name,
                'type': self.template.template_type
            },
            'parameters': {
                'date_range_start': self.date_range_start.isoformat() if self.date_range_start else None,
                'date_range_end': self.date_range_end.isoformat() if self.date_range_end else None,
                'filters': self.filters
            },
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'generated_by': self.user.get_full_name() if self.user else 'System',
                'row_count': len(data)
            },
            'data': data
        }, default=json_serializer, indent=2)

        return {
            'status': 'success',
            'format': 'json',
            'row_count': len(data),
            'data': json_content,
            'message': f'JSON report generated with {len(data)} rows'
        }

    def _prepare_report_data(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Prepare structured report data for advanced export handlers"""
        return {
            'data': data,
            'metadata': {
                'title': self.template.name,
                'template_name': self.template.name,
                'template_type': self.template.template_type,
                'description': self.template.description,
                'generated_at': datetime.now().isoformat(),
                'generated_by': self.user.get_full_name() if self.user else 'System',
                'row_count': len(data),
                'summary': self._generate_summary(data)
            },
            'parameters': {
                'date_range_start': self.date_range_start.isoformat() if self.date_range_start else None,
                'date_range_end': self.date_range_end.isoformat() if self.date_range_end else None,
                'filters': self.filters,
                'export_format': self.export_format
            },
            'generated_at': datetime.now().isoformat()
        }

    def _generate_summary(self, data: List[Dict[str, Any]]) -> str:
        """Generate an executive summary based on template type and data"""
        if not data:
            return "No data available for the specified criteria."

        summary_parts = [
            f"This report contains {len(data)} records"
        ]

        # Add template-specific summary information
        if self.template.template_type == 'compliance_summary':
            violations = [row for row in data if 'violation_type' in row]
            if violations:
                summary_parts.append(f"including {len(violations)} compliance violations")

        elif self.template.template_type == 'venue_performance':
            venues = set(row.get('venue_name', '') for row in data if row.get('venue_name'))
            if venues:
                summary_parts.append(f"across {len(venues)} venues")

        elif self.template.template_type == 'working_hours':
            completed_shifts = [row for row in data if row.get('status') == 'completed']
            if completed_shifts:
                summary_parts.append(f"with {len(completed_shifts)} completed shifts")

        # Add date range information
        if self.date_range_start and self.date_range_end:
            start_str = self.date_range_start.strftime('%B %d, %Y')
            end_str = self.date_range_end.strftime('%B %d, %Y')
            summary_parts.append(f"for the period from {start_str} to {end_str}")

        return " ".join(summary_parts) + "."

    def _generate_with_handler(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate report using appropriate export handler"""
        try:
            # Get the export handler for the format
            handler = get_export_handler(self.export_format)

            # Create temporary file for the export
            file_extension = 'pdf' if self.export_format == 'pdf' else 'xlsx'
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=f'.{file_extension}',
                prefix='report_'
            )
            temp_file.close()

            # Generate the file
            output_path = handler.export(report_data, temp_file.name)

            # Get file size
            file_size = os.path.getsize(output_path)

            return {
                'status': 'success',
                'format': self.export_format,
                'row_count': len(report_data['data']),
                'file_path': output_path,
                'file_size': file_size,
                'metadata': report_data['metadata'],
                'message': f'{self.export_format.upper()} report generated with {len(report_data["data"])} rows'
            }

        except Exception as e:
            logger.error(f"Export handler failed for {self.export_format}: {str(e)}")
            raise

    @classmethod
    def generate_preview(cls, template, parameters: Dict[str, Any], limit: int = 100) -> Dict[str, Any]:
        """Generate a limited preview of the report data"""
        # Create a temporary generator instance
        preview_generator = cls(
            template=template,
            export_format='json',  # Use JSON for preview
            date_range_start=parameters.get('date_range_start'),
            date_range_end=parameters.get('date_range_end'),
            filters=parameters.get('filters', {}),
            user=parameters.get('user')
        )

        # Modify SQL query to add LIMIT clause for preview
        original_query = template.sql_query
        preview_query = cls._add_limit_to_query(original_query, limit)

        # Temporarily modify the template query
        template.sql_query = preview_query

        try:
            # Execute the preview query
            data = preview_generator._execute_query()

            # Restore original query
            template.sql_query = original_query

            return {
                'status': 'success',
                'preview': True,
                'preview_limit': limit,
                'data': data,
                'row_count': len(data),
                'estimated_total_rows': len(data) if len(data) < limit else f"{len(data)}+",
                'metadata': {
                    'template_name': template.name,
                    'template_type': template.template_type,
                    'generated_at': datetime.now().isoformat()
                }
            }

        except Exception as e:
            # Restore original query on error
            template.sql_query = original_query
            raise

    @staticmethod
    def _add_limit_to_query(query: str, limit: int) -> str:
        """Add LIMIT clause to SQL query for preview"""
        query = query.strip()

        # Remove trailing semicolon if present
        if query.endswith(';'):
            query = query[:-1]

        # Add LIMIT clause
        return f"{query} LIMIT {limit}"

    @classmethod
    def validate_template(cls, template) -> Dict[str, Any]:
        """Validate template configuration and SQL query"""
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'estimated_performance': 'unknown'
        }

        try:
            # Basic SQL syntax validation
            cls._validate_sql_syntax(template.sql_query, validation_results)

            # Parameter validation
            cls._validate_parameters(template.parameters, validation_results)

            # Performance estimation
            cls._estimate_query_performance(template.sql_query, validation_results)

        except Exception as e:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Validation failed: {str(e)}")

        return validation_results

    @staticmethod
    def _validate_sql_syntax(query: str, results: Dict[str, Any]):
        """Validate SQL query syntax and security"""
        import re

        # More precise dangerous keyword detection using word boundaries
        dangerous_patterns = [
            r'\bDROP\b', r'\bDELETE\b', r'\bTRUNCATE\b', r'\bALTER\b',
            r'\bCREATE\s+(TABLE|INDEX|VIEW|DATABASE)\b',  # More specific CREATE detection
            r'\bINSERT\b', r'\bUPDATE\b', r'\bEXEC\b', r'\bEXECUTE\b'
        ]

        query_upper = query.upper()

        # Check for dangerous keywords with word boundaries
        for pattern in dangerous_patterns:
            if re.search(pattern, query_upper):
                keyword = pattern.replace(r'\b', '').replace(r'\s+.*', '')
                results['valid'] = False
                results['errors'].append(f"Query contains prohibited keyword: {keyword}")

        # Check for required SELECT statement
        if not query_upper.strip().startswith('SELECT'):
            results['valid'] = False
            results['errors'].append("Query must start with SELECT statement")

        # Check for parameter placeholders
        if '%(date_start)s' in query and '%(date_end)s' not in query:
            results['warnings'].append("Query uses date_start but not date_end parameter")

    @staticmethod
    def _validate_parameters(parameters: Dict[str, Any], results: Dict[str, Any]):
        """Validate template parameter configuration"""
        for param_name, param_config in parameters.items():
            if not isinstance(param_config, dict):
                results['errors'].append(f"Parameter '{param_name}' configuration must be a dictionary")
                continue

            # Check required fields
            if 'type' not in param_config:
                results['warnings'].append(f"Parameter '{param_name}' missing type specification")

            # Validate parameter types
            param_type = param_config.get('type')
            valid_types = ['string', 'date', 'datetime', 'integer', 'float', 'boolean']
            if param_type and param_type not in valid_types:
                results['warnings'].append(f"Parameter '{param_name}' has unknown type: {param_type}")

    @staticmethod
    def _estimate_query_performance(query: str, results: Dict[str, Any]):
        """Estimate query performance based on structure"""
        query_upper = query.upper()

        # Basic performance indicators
        if 'JOIN' in query_upper:
            join_count = query_upper.count('JOIN')
            if join_count > 3:
                results['warnings'].append(f"Query has {join_count} JOINs which may impact performance")
                results['estimated_performance'] = 'slow'
            else:
                results['estimated_performance'] = 'medium'
        else:
            results['estimated_performance'] = 'fast'

        # Check for potential performance issues
        if 'ORDER BY' not in query_upper and 'LIMIT' not in query_upper:
            results['warnings'].append("Query lacks ORDER BY and LIMIT clauses - may return unsorted large result sets")

        if query_upper.count('SELECT') > 1:
            results['warnings'].append("Query contains subqueries which may impact performance")


def generate_report_sync(template, export_format, date_range_start=None, date_range_end=None, filters=None, user=None):
    """
    Generate a report synchronously and return the result
    For quick CSV/JSON reports that can be generated immediately
    """
    generator = ReportGenerator(
        template=template,
        export_format=export_format,
        date_range_start=date_range_start,
        date_range_end=date_range_end,
        filters=filters,
        user=user
    )

    return generator.generate()


def create_sample_templates(created_by_user):
    """
    Create sample report templates for testing
    This would typically be called during initial setup
    """
    from ..models import ReportTemplate

    # Sample compliance summary template
    compliance_template = {
        'name': 'Compliance Summary Report',
        'template_type': 'compliance_summary',
        'description': 'Summary of compliance violations and metrics',
        'sql_query': """
            SELECT
                u.first_name || ' ' || u.last_name as staff_name,
                cv.violation_type,
                cv.severity,
                cv.created_at,
                cv.resolution_status
            FROM compliance_violations cv
            JOIN users u ON cv.user_id = u.id
            WHERE cv.created_at >= %(date_start)s
                AND cv.created_at <= %(date_end)s
            ORDER BY cv.created_at DESC
        """,
        'parameters': {
            'date_start': {
                'type': 'date',
                'required': True,
                'description': 'Start date for the report'
            },
            'date_end': {
                'type': 'date',
                'required': True,
                'description': 'End date for the report'
            }
        },
        'allowed_roles': ['admin', 'manager'],
        'template_config': {
            'estimated_execution_time': 30,
            'max_rows_warning': 10000
        }
    }

    # Sample working hours template
    hours_template = {
        'name': 'Working Hours Report',
        'template_type': 'working_hours',
        'description': 'Detailed working hours and overtime analysis',
        'sql_query': """
            SELECT
                u.first_name || ' ' || u.last_name as staff_name,
                s.start_time,
                s.end_time,
                s.hourly_rate,
                v.name as venue_name,
                s.status
            FROM shifts s
            JOIN users u ON s.staff_user_id = u.id
            JOIN venues v ON s.venue_id = v.id
            WHERE s.start_time >= %(date_start)s
                AND s.start_time <= %(date_end)s
                AND s.status = 'completed'
            ORDER BY s.start_time DESC
        """,
        'parameters': {
            'date_start': {
                'type': 'date',
                'required': True,
                'description': 'Start date for the report'
            },
            'date_end': {
                'type': 'date',
                'required': True,
                'description': 'End date for the report'
            }
        },
        'allowed_roles': ['admin', 'manager'],
        'template_config': {
            'estimated_execution_time': 45,
            'max_rows_warning': 15000
        }
    }

    # Sample venue performance template
    venue_template = {
        'name': 'Venue Performance Report',
        'template_type': 'venue_performance',
        'description': 'Performance metrics by venue',
        'sql_query': """
            SELECT
                v.name as venue_name,
                v.city,
                COUNT(s.id) as total_shifts,
                COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_shifts,
                COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_shifts,
                AVG(s.hourly_rate) as average_hourly_rate
            FROM venues v
            LEFT JOIN shifts s ON v.id = s.venue_id
                AND s.start_time >= %(date_start)s
                AND s.start_time <= %(date_end)s
            WHERE v.is_active = true
            GROUP BY v.id, v.name, v.city
            ORDER BY total_shifts DESC
        """,
        'parameters': {
            'date_start': {
                'type': 'date',
                'required': True,
                'description': 'Start date for the report'
            },
            'date_end': {
                'type': 'date',
                'required': True,
                'description': 'End date for the report'
            }
        },
        'allowed_roles': ['admin', 'manager'],
        'template_config': {
            'estimated_execution_time': 20,
            'max_rows_warning': 500
        }
    }

    templates = [compliance_template, hours_template, venue_template]
    created_templates = []

    for template_data in templates:
        template_data['created_by'] = created_by_user
        template, created = ReportTemplate.objects.get_or_create(
            name=template_data['name'],
            defaults=template_data
        )
        created_templates.append(template)
        if created:
            logger.info(f"Created sample template: {template.name}")
        else:
            logger.info(f"Template already exists: {template.name}")

    return created_templates