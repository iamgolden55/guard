# Export & Reporting Architecture
## Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

### Overview

This document outlines the comprehensive export and reporting architecture for the Legal Compliance Reporting System. The architecture supports multiple export formats, scheduled reporting, real-time data streaming, and compliance audit requirements while maintaining high performance and scalability.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Report Builder │  │  Export Manager │  │  Dashboard Widgets   │ │
│  │     UI          │  │      UI         │  │        UI           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────────┐
│                       API Gateway                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Rate Limiting  │  │    Caching      │  │   Authentication    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────────┐
│                    Reporting Services Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Report Engine   │  │ Export Service  │  │  Schedule Manager   │ │
│  │   (Django)      │  │   (Celery)      │  │     (Celery)        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Template Engine │  │  Format Handlers│  │   Notification      │ │
│  │    (Jinja2)     │  │  (PDF/Excel/CSV)│  │     Service         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────────┐
│                      Data & Storage Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   PostgreSQL    │  │      Redis      │  │    File Storage     │ │
│  │   (Core Data)   │  │    (Caching)    │  │  (Reports/Exports)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Report Engine
Handles report generation logic, data aggregation, and business rule application.

#### 2. Export Service
Manages file format conversion, asynchronous processing, and delivery mechanisms.

#### 3. Template Engine
Provides customizable report templates with dynamic content generation.

#### 4. Schedule Manager
Handles automated report generation, distribution, and retention policies.

### Data Models

#### Report Template Model
```python
# models/reporting.py
from django.db import models
from django.contrib.auth.models import User
import json

class ReportTemplate(models.Model):
    TEMPLATE_TYPES = [
        ('compliance_summary', 'Compliance Summary'),
        ('violation_detail', 'Violation Detail Report'),
        ('venue_performance', 'Venue Performance'),
        ('staff_compliance', 'Staff Compliance'),
        ('audit_trail', 'Audit Trail'),
        ('executive_dashboard', 'Executive Dashboard')
    ]

    name = models.CharField(max_length=200)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES)
    description = models.TextField(blank=True)
    template_config = models.JSONField(default=dict)
    sql_query = models.TextField()
    parameters = models.JSONField(default=dict)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    # Permissions
    allowed_roles = models.JSONField(default=list)  # ['admin', 'manager']
    allowed_venues = models.ManyToManyField('api.Venue', blank=True)

    class Meta:
        db_table = 'reporting_templates'
        indexes = [
            models.Index(fields=['template_type', 'is_active']),
            models.Index(fields=['created_by']),
        ]

class ReportJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled')
    ]

    EXPORT_FORMATS = [
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
        ('json', 'JSON'),
        ('html', 'HTML')
    ]

    job_id = models.UUIDField(default=uuid.uuid4, unique=True)
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE)
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    export_format = models.CharField(max_length=10, choices=EXPORT_FORMATS)

    # Parameters
    date_range_start = models.DateTimeField()
    date_range_end = models.DateTimeField()
    filters = models.JSONField(default=dict)

    # Execution tracking
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    file_path = models.CharField(max_length=500, blank=True)
    file_size = models.BigIntegerField(null=True)

    # Error handling
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()  # File retention policy

    class Meta:
        db_table = 'reporting_jobs'
        indexes = [
            models.Index(fields=['requested_by', '-created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['expires_at']),
        ]

class ScheduledReport(models.Model):
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annually', 'Annually')
    ]

    name = models.CharField(max_length=200)
    template = models.ForeignKey(ReportTemplate, on_delete=models.CASCADE)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    next_run = models.DateTimeField()
    last_run = models.DateTimeField(null=True, blank=True)

    # Distribution
    recipients = models.JSONField(default=list)  # Email addresses
    delivery_methods = models.JSONField(default=list)  # ['email', 'webhook']

    # Configuration
    parameters = models.JSONField(default=dict)
    export_formats = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'scheduled_reports'
```

#### Export Configuration Model
```python
class ExportConfiguration(models.Model):
    COMPRESSION_CHOICES = [
        ('none', 'No Compression'),
        ('zip', 'ZIP'),
        ('gzip', 'GZIP')
    ]

    name = models.CharField(max_length=200)
    export_format = models.CharField(max_length=10, choices=ReportJob.EXPORT_FORMATS)
    template_settings = models.JSONField(default=dict)
    compression = models.CharField(max_length=10, choices=COMPRESSION_CHOICES, default='none')

    # File naming patterns
    filename_pattern = models.CharField(max_length=200,
                                       default='{report_type}_{date_range}_{timestamp}')

    # Quality settings
    pdf_settings = models.JSONField(default=dict)  # DPI, page size, etc.
    excel_settings = models.JSONField(default=dict)  # Sheet names, formatting, etc.

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'export_configurations'
```

### API Endpoints

#### 1. Report Templates API
```python
# views/reporting_views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

class ReportTemplateViewSet(viewsets.ModelViewSet):
    queryset = ReportTemplate.objects.filter(is_active=True)
    serializer_class = ReportTemplateSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['template_type', 'created_by']
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Role-based filtering
        if user.role == 'staff':
            queryset = queryset.filter(
                allowed_roles__contains=[user.role],
                allowed_venues__in=user.staffprofile.venues.all()
            )
        elif user.role == 'manager':
            queryset = queryset.filter(
                allowed_roles__contains=[user.role]
            )
        # Admins see all templates

        return queryset

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """Generate a preview of the report with sample data"""
        template = self.get_object()
        try:
            preview_data = ReportEngine.generate_preview(
                template,
                request.data.get('parameters', {})
            )
            return Response({
                'status': 'success',
                'preview': preview_data,
                'estimated_rows': preview_data.get('row_count', 0)
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Validate template configuration and SQL query"""
        template = self.get_object()
        validation_results = ReportEngine.validate_template(template)
        return Response(validation_results)
```

#### 2. Report Generation API
```python
class ReportJobViewSet(viewsets.ModelViewSet):
    queryset = ReportJob.objects.all()
    serializer_class = ReportJobSerializer
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        return super().get_queryset().filter(requested_by=self.request.user)

    def create(self, request):
        """Create a new report generation job"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            job = serializer.save(requested_by=request.user)

            # Queue the report generation task
            from .tasks import generate_report_task
            generate_report_task.delay(job.job_id)

            return Response({
                'status': 'accepted',
                'job_id': job.job_id,
                'message': 'Report generation started'
            }, status=status.HTTP_202_ACCEPTED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_generate(self, request):
        """Generate multiple reports with different formats"""
        jobs = []
        for job_config in request.data.get('jobs', []):
            job = ReportJob.objects.create(
                template_id=job_config['template_id'],
                requested_by=request.user,
                export_format=job_config['format'],
                **job_config.get('parameters', {})
            )
            jobs.append(job)

            # Queue each job
            from .tasks import generate_report_task
            generate_report_task.delay(job.job_id)

        return Response({
            'status': 'accepted',
            'jobs': [{'job_id': job.job_id, 'format': job.export_format}
                    for job in jobs]
        }, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download completed report file"""
        job = self.get_object()

        if job.status != 'completed':
            return Response({
                'error': 'Report not ready for download',
                'status': job.status
            }, status=status.HTTP_400_BAD_REQUEST)

        # Security check - ensure user owns the report
        if job.requested_by != request.user:
            return Response({
                'error': 'Access denied'
            }, status=status.HTTP_403_FORBIDDEN)

        # Generate secure download URL
        download_url = ReportStorage.generate_download_url(job.file_path)

        return Response({
            'download_url': download_url,
            'filename': os.path.basename(job.file_path),
            'file_size': job.file_size,
            'expires_at': job.expires_at
        })
```

#### 3. Export Management API
```python
class ExportViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticatedUser]

    @action(detail=False, methods=['post'])
    def compliance_summary(self, request):
        """Export compliance summary data"""
        try:
            filters = request.data.get('filters', {})
            format_type = request.data.get('format', 'excel')

            # Validate date range
            start_date = parse_datetime(filters.get('start_date'))
            end_date = parse_datetime(filters.get('end_date'))

            if not start_date or not end_date:
                return Response({
                    'error': 'Valid start_date and end_date required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create export job
            job = ReportJob.objects.create(
                template=ReportTemplate.objects.get(template_type='compliance_summary'),
                requested_by=request.user,
                export_format=format_type,
                date_range_start=start_date,
                date_range_end=end_date,
                filters=filters
            )

            # Queue processing
            from .tasks import generate_report_task
            generate_report_task.delay(job.job_id)

            return Response({
                'job_id': job.job_id,
                'status': 'processing',
                'estimated_completion': timezone.now() + timedelta(minutes=5)
            })

        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def formats(self, request):
        """Get available export formats and their capabilities"""
        return Response({
            'formats': {
                'pdf': {
                    'name': 'PDF Document',
                    'mime_type': 'application/pdf',
                    'supports_charts': True,
                    'supports_formatting': True,
                    'max_size_mb': 50
                },
                'excel': {
                    'name': 'Excel Workbook',
                    'mime_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'supports_charts': True,
                    'supports_multiple_sheets': True,
                    'max_size_mb': 100
                },
                'csv': {
                    'name': 'CSV Data',
                    'mime_type': 'text/csv',
                    'supports_charts': False,
                    'supports_formatting': False,
                    'max_size_mb': 200
                },
                'json': {
                    'name': 'JSON Data',
                    'mime_type': 'application/json',
                    'supports_nested_data': True,
                    'max_size_mb': 100
                }
            }
        })
```

### Report Engine Implementation

#### Core Report Engine
```python
# services/report_engine.py
import pandas as pd
from django.db import connection
from typing import Dict, Any, List
import logging

class ReportEngine:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    @classmethod
    def generate_report(cls, template: ReportTemplate, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generate report data based on template and parameters"""
        engine = cls()

        try:
            # Validate parameters
            validated_params = engine._validate_parameters(template, parameters)

            # Execute SQL query with parameters
            query = engine._build_query(template.sql_query, validated_params)
            data = engine._execute_query(query, validated_params)

            # Apply business rules and calculations
            processed_data = engine._apply_business_rules(template, data, validated_params)

            # Generate metadata
            metadata = engine._generate_metadata(template, processed_data, validated_params)

            return {
                'data': processed_data,
                'metadata': metadata,
                'parameters': validated_params,
                'generated_at': timezone.now().isoformat()
            }

        except Exception as e:
            engine.logger.error(f"Report generation failed: {str(e)}")
            raise ReportGenerationError(f"Failed to generate report: {str(e)}")

    def _validate_parameters(self, template: ReportTemplate, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize report parameters"""
        template_params = template.parameters or {}
        validated = {}

        for param_name, param_config in template_params.items():
            value = parameters.get(param_name)
            param_type = param_config.get('type', 'string')
            required = param_config.get('required', False)

            if required and value is None:
                raise ValueError(f"Required parameter '{param_name}' is missing")

            if value is not None:
                validated[param_name] = self._cast_parameter(value, param_type, param_config)

        return validated

    def _execute_query(self, query: str, parameters: Dict[str, Any]) -> pd.DataFrame:
        """Execute SQL query and return results as DataFrame"""
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            columns = [col[0] for col in cursor.description]
            data = cursor.fetchall()

        return pd.DataFrame(data, columns=columns)

    def _apply_business_rules(self, template: ReportTemplate, data: pd.DataFrame, parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Apply template-specific business rules and calculations"""

        # Common calculations
        if template.template_type == 'compliance_summary':
            data = self._calculate_compliance_metrics(data)
        elif template.template_type == 'violation_detail':
            data = self._enrich_violation_data(data)
        elif template.template_type == 'venue_performance':
            data = self._calculate_venue_metrics(data)

        return data.to_dict('records')

    def _calculate_compliance_metrics(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate compliance-specific metrics"""
        if 'total_shifts' in data.columns and 'compliant_shifts' in data.columns:
            data['compliance_rate'] = (data['compliant_shifts'] / data['total_shifts'] * 100).round(2)

        if 'violation_count' in data.columns and 'total_hours' in data.columns:
            data['violations_per_hour'] = (data['violation_count'] / data['total_hours']).round(3)

        return data

    @classmethod
    def generate_preview(cls, template: ReportTemplate, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a limited preview of the report"""
        # Add LIMIT clause to SQL query for preview
        limited_query = cls._add_limit_to_query(template.sql_query, 100)

        preview_template = ReportTemplate(
            sql_query=limited_query,
            template_type=template.template_type,
            parameters=template.parameters
        )

        result = cls.generate_report(preview_template, parameters)
        result['is_preview'] = True
        result['preview_limit'] = 100

        return result
```

### Export Format Handlers

#### PDF Export Handler
```python
# services/export_handlers.py
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io

class PDFExportHandler:
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.page_size = A4 if self.config.get('page_size') == 'A4' else letter

    def export(self, report_data: Dict[str, Any], output_path: str) -> str:
        """Export report data to PDF format"""

        doc = SimpleDocTemplate(
            output_path,
            pagesize=self.page_size,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=1*inch,
            bottomMargin=0.5*inch
        )

        story = []
        styles = getSampleStyleSheet()

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.darkblue,
            spaceAfter=0.3*inch
        )

        title = Paragraph(report_data['metadata']['title'], title_style)
        story.append(title)

        # Metadata section
        metadata_text = f"""
        <b>Generated:</b> {report_data['generated_at']}<br/>
        <b>Date Range:</b> {report_data['parameters'].get('start_date', '')} to {report_data['parameters'].get('end_date', '')}<br/>
        <b>Total Records:</b> {len(report_data['data'])}
        """

        metadata_para = Paragraph(metadata_text, styles['Normal'])
        story.append(metadata_para)
        story.append(Spacer(1, 0.3*inch))

        # Data table
        if report_data['data']:
            table_data = self._prepare_table_data(report_data['data'])
            table = Table(table_data, repeatRows=1)

            # Apply table styling
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))

            story.append(table)

        # Build PDF
        doc.build(story)
        return output_path

    def _prepare_table_data(self, data: List[Dict[str, Any]]) -> List[List[str]]:
        """Convert report data to table format"""
        if not data:
            return []

        # Headers
        headers = list(data[0].keys())
        table_data = [headers]

        # Data rows
        for row in data:
            table_row = []
            for header in headers:
                value = row.get(header, '')
                # Format values based on type
                if isinstance(value, float):
                    value = f"{value:.2f}"
                elif value is None:
                    value = ''
                table_row.append(str(value))
            table_data.append(table_row)

        return table_data
```

#### Excel Export Handler
```python
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.chart import LineChart, Reference
from openpyxl.utils.dataframe import dataframe_to_rows

class ExcelExportHandler:
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    def export(self, report_data: Dict[str, Any], output_path: str) -> str:
        """Export report data to Excel format"""

        wb = Workbook()

        # Remove default sheet
        wb.remove(wb.active)

        # Create data sheet
        data_sheet = wb.create_sheet("Report Data")
        self._populate_data_sheet(data_sheet, report_data)

        # Create summary sheet if applicable
        if self._should_create_summary(report_data):
            summary_sheet = wb.create_sheet("Summary")
            self._populate_summary_sheet(summary_sheet, report_data)

        # Create charts if configured
        if self.config.get('include_charts', True):
            self._add_charts(wb, report_data)

        # Save workbook
        wb.save(output_path)
        return output_path

    def _populate_data_sheet(self, sheet, report_data: Dict[str, Any]):
        """Populate data sheet with report data"""

        # Add title and metadata
        sheet['A1'] = report_data['metadata']['title']
        sheet['A1'].font = Font(size=16, bold=True)

        sheet['A3'] = f"Generated: {report_data['generated_at']}"
        sheet['A4'] = f"Records: {len(report_data['data'])}"

        # Convert data to DataFrame
        df = pd.DataFrame(report_data['data'])

        # Add data starting from row 6
        for r in dataframe_to_rows(df, index=False, header=True):
            sheet.append(r)

        # Format headers
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)

        for cell in sheet[6]:  # Header row
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        # Auto-adjust column widths
        for column in sheet.columns:
            max_length = 0
            column_letter = column[0].column_letter

            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass

            adjusted_width = min(max_length + 2, 50)
            sheet.column_dimensions[column_letter].width = adjusted_width

    def _add_charts(self, workbook, report_data: Dict[str, Any]):
        """Add charts based on report data"""

        data_sheet = workbook["Report Data"]
        chart_sheet = workbook.create_sheet("Charts")

        # Example: Compliance rate chart
        if self._has_numeric_column(report_data['data'], 'compliance_rate'):
            chart = LineChart()
            chart.title = "Compliance Rate Trend"
            chart.y_axis.title = 'Compliance Rate (%)'
            chart.x_axis.title = 'Period'

            # Determine data range
            data_range = Reference(data_sheet, min_col=2, min_row=7,
                                 max_row=6 + len(report_data['data']))
            chart.add_data(data_range, titles_from_data=True)

            chart_sheet.add_chart(chart, "A1")
```

### Asynchronous Processing with Celery

#### Report Generation Tasks
```python
# tasks.py
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def generate_report_task(self, job_id: str):
    """Asynchronous report generation task"""

    try:
        # Get job from database
        job = ReportJob.objects.get(job_id=job_id)
        job.status = 'processing'
        job.started_at = timezone.now()
        job.save()

        # Generate report data
        report_data = ReportEngine.generate_report(
            job.template,
            job.filters
        )

        # Create export file
        file_path = ExportService.create_export_file(
            report_data,
            job.export_format,
            job.template.template_type
        )

        # Update job with results
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.file_path = file_path
        job.file_size = os.path.getsize(file_path)
        job.save()

        # Send notification
        notify_report_completion.delay(job.job_id)

        logger.info(f"Report generation completed for job {job_id}")

    except Exception as e:
        logger.error(f"Report generation failed for job {job_id}: {str(e)}")

        # Update job status
        job = ReportJob.objects.get(job_id=job_id)
        job.status = 'failed'
        job.error_message = str(e)
        job.save()

        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            retry_delay = 2 ** self.request.retries * 60  # 1, 2, 4 minutes
            raise self.retry(countdown=retry_delay)

        # Send error notification
        notify_report_error.delay(job.job_id, str(e))

@shared_task
def notify_report_completion(job_id: str):
    """Send notification when report is ready"""

    job = ReportJob.objects.get(job_id=job_id)

    # Generate download URL
    download_url = f"{settings.FRONTEND_URL}/reports/download/{job.job_id}"

    # Send email notification
    send_mail(
        subject=f'Report Ready: {job.template.name}',
        message=f'''
        Your report "{job.template.name}" is ready for download.

        Download Link: {download_url}
        Format: {job.export_format.upper()}
        File Size: {job.file_size / (1024*1024):.1f} MB

        This link will expire on {job.expires_at.strftime('%Y-%m-%d %H:%M')}.
        ''',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[job.requested_by.email],
        fail_silently=False,
    )

@shared_task
def cleanup_expired_reports():
    """Clean up expired report files"""

    expired_jobs = ReportJob.objects.filter(
        expires_at__lt=timezone.now(),
        status='completed'
    )

    deleted_count = 0
    for job in expired_jobs:
        if job.file_path and os.path.exists(job.file_path):
            os.remove(job.file_path)
            deleted_count += 1
        job.delete()

    logger.info(f"Cleaned up {deleted_count} expired report files")

@shared_task
def generate_scheduled_reports():
    """Generate scheduled reports"""

    due_reports = ScheduledReport.objects.filter(
        next_run__lte=timezone.now(),
        is_active=True
    )

    for scheduled_report in due_reports:
        # Create report jobs for each format
        for export_format in scheduled_report.export_formats:
            job = ReportJob.objects.create(
                template=scheduled_report.template,
                requested_by=scheduled_report.created_by,
                export_format=export_format,
                date_range_start=timezone.now() - timedelta(days=30),  # Default range
                date_range_end=timezone.now(),
                filters=scheduled_report.parameters
            )

            # Queue generation
            generate_report_task.delay(job.job_id)

        # Update next run time
        if scheduled_report.frequency == 'daily':
            scheduled_report.next_run += timedelta(days=1)
        elif scheduled_report.frequency == 'weekly':
            scheduled_report.next_run += timedelta(weeks=1)
        elif scheduled_report.frequency == 'monthly':
            scheduled_report.next_run += timedelta(days=30)

        scheduled_report.last_run = timezone.now()
        scheduled_report.save()
```

### Frontend Integration

#### React Components for Report Management
```typescript
// components/reports/ReportBuilder.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import {
  Button,
  Select,
  DatePicker,
  Form,
  Progress,
  notification
} from '@fluentui/react-components';

interface ReportBuilderProps {
  onReportGenerated: (jobId: string) => void;
}

interface ReportTemplate {
  id: number;
  name: string;
  template_type: string;
  description: string;
  parameters: Record<string, any>;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({ onReportGenerated }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [exportFormat, setExportFormat] = useState('excel');

  // Fetch available templates
  const { data: templates, isLoading } = useQuery(
    'report-templates',
    () => api.reports.getTemplates(),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Generate report mutation
  const generateReportMutation = useMutation(
    (reportConfig: any) => api.reports.generateReport(reportConfig),
    {
      onSuccess: (data) => {
        notification.notify({
          title: 'Report Generation Started',
          body: 'Your report is being generated. You will be notified when it\'s ready.',
          intent: 'success'
        });
        onReportGenerated(data.job_id);
      },
      onError: (error: any) => {
        notification.notify({
          title: 'Report Generation Failed',
          body: error.message || 'An error occurred while generating the report.',
          intent: 'error'
        });
      }
    }
  );

  const handleGenerateReport = () => {
    if (!selectedTemplate) return;

    generateReportMutation.mutate({
      template_id: selectedTemplate.id,
      export_format: exportFormat,
      parameters: {
        ...parameters,
        start_date: parameters.dateRange?.[0]?.toISOString(),
        end_date: parameters.dateRange?.[1]?.toISOString(),
      }
    });
  };

  const renderParameterInput = (paramName: string, paramConfig: any) => {
    switch (paramConfig.type) {
      case 'date_range':
        return (
          <DatePicker
            placeholder="Select date range"
            value={parameters[paramName]}
            onSelectDate={(date) => setParameters(prev => ({
              ...prev,
              [paramName]: date
            }))}
          />
        );

      case 'select':
        return (
          <Select
            value={parameters[paramName] || ''}
            onChange={(_, data) => setParameters(prev => ({
              ...prev,
              [paramName]: data.value
            }))}
          >
            {paramConfig.options?.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      default:
        return (
          <input
            type="text"
            value={parameters[paramName] || ''}
            onChange={(e) => setParameters(prev => ({
              ...prev,
              [paramName]: e.target.value
            }))}
            placeholder={paramConfig.description}
          />
        );
    }
  };

  return (
    <div className="report-builder">
      <h2>Generate Report</h2>

      <Form>
        <div className="form-group">
          <label>Report Template</label>
          <Select
            value={selectedTemplate?.id?.toString() || ''}
            onChange={(_, data) => {
              const template = templates?.find(t => t.id.toString() === data.value);
              setSelectedTemplate(template || null);
              setParameters({}); // Reset parameters when template changes
            }}
            disabled={isLoading}
          >
            <option value="">Select a template...</option>
            {templates?.map((template: ReportTemplate) => (
              <option key={template.id} value={template.id.toString()}>
                {template.name}
              </option>
            ))}
          </Select>
        </div>

        {selectedTemplate && (
          <>
            <div className="form-group">
              <label>Export Format</label>
              <Select
                value={exportFormat}
                onChange={(_, data) => setExportFormat(data.value || 'excel')}
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF (.pdf)</option>
                <option value="csv">CSV (.csv)</option>
                <option value="json">JSON (.json)</option>
              </Select>
            </div>

            {/* Dynamic parameter inputs */}
            {Object.entries(selectedTemplate.parameters || {}).map(([paramName, paramConfig]) => (
              <div key={paramName} className="form-group">
                <label>{paramConfig.label || paramName}</label>
                {renderParameterInput(paramName, paramConfig)}
              </div>
            ))}

            <Button
              appearance="primary"
              onClick={handleGenerateReport}
              disabled={generateReportMutation.isLoading}
            >
              {generateReportMutation.isLoading ? (
                <>
                  <Progress /> Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </Button>
          </>
        )}
      </Form>
    </div>
  );
};
```

#### Report Status Tracking Component
```typescript
// components/reports/ReportStatus.tsx
import React, { useEffect } from 'react';
import { useQuery } from 'react-query';
import { Progress, Button, Badge } from '@fluentui/react-components';
import { Download24Regular, Error24Regular, Clock24Regular } from '@fluentui/react-icons';

interface ReportStatusProps {
  jobId: string;
  onDownload: (downloadUrl: string) => void;
}

export const ReportStatus: React.FC<ReportStatusProps> = ({ jobId, onDownload }) => {
  const { data: job, refetch } = useQuery(
    ['report-job', jobId],
    () => api.reports.getJobStatus(jobId),
    {
      refetchInterval: (data) => {
        // Poll every 5 seconds if still processing
        return data?.status === 'processing' ? 5000 : false;
      },
      refetchOnWindowFocus: false,
    }
  );

  const getStatusBadge = () => {
    switch (job?.status) {
      case 'pending':
        return <Badge appearance="ghost" icon={<Clock24Regular />}>Pending</Badge>;
      case 'processing':
        return <Badge appearance="outline" icon={<Clock24Regular />}>Processing</Badge>;
      case 'completed':
        return <Badge appearance="filled" color="success">Completed</Badge>;
      case 'failed':
        return <Badge appearance="filled" color="danger" icon={<Error24Regular />}>Failed</Badge>;
      default:
        return <Badge appearance="ghost">Unknown</Badge>;
    }
  };

  const handleDownload = async () => {
    if (job?.status === 'completed') {
      const downloadData = await api.reports.getDownloadUrl(jobId);
      onDownload(downloadData.download_url);
    }
  };

  return (
    <div className="report-status">
      <div className="status-header">
        <h4>{job?.template_name}</h4>
        {getStatusBadge()}
      </div>

      {job?.status === 'processing' && (
        <div className="progress-section">
          <Progress />
          <p>Generating your report... This may take a few minutes.</p>
        </div>
      )}

      {job?.status === 'completed' && (
        <div className="download-section">
          <p>Your report is ready!</p>
          <div className="file-info">
            <span>Format: {job.export_format?.toUpperCase()}</span>
            <span>Size: {(job.file_size / (1024 * 1024)).toFixed(1)} MB</span>
          </div>
          <Button
            appearance="primary"
            icon={<Download24Regular />}
            onClick={handleDownload}
          >
            Download Report
          </Button>
          <p className="expiry-info">
            Link expires: {new Date(job.expires_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {job?.status === 'failed' && (
        <div className="error-section">
          <p>Report generation failed.</p>
          {job.error_message && (
            <p className="error-message">{job.error_message}</p>
          )}
          <Button
            appearance="secondary"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
```

### Performance Optimization

#### Database Query Optimization
```sql
-- Index optimization for report queries
CREATE INDEX CONCURRENTLY idx_shifts_compliance_reporting
ON shifts (venue_id, start_time, status)
WHERE status IN ('completed', 'approved');

CREATE INDEX CONCURRENTLY idx_violations_reporting
ON compliance_violations (created_at, severity, violation_type, venue_id);

CREATE INDEX CONCURRENTLY idx_report_jobs_user_status
ON reporting_jobs (requested_by_id, status, created_at);

-- Materialized view for compliance metrics
CREATE MATERIALIZED VIEW compliance_metrics_daily AS
SELECT
    DATE(s.start_time) as report_date,
    s.venue_id,
    COUNT(*) as total_shifts,
    COUNT(CASE WHEN cv.id IS NULL THEN 1 END) as compliant_shifts,
    COUNT(cv.id) as violation_count,
    AVG(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600) as avg_hours_per_shift
FROM shifts s
LEFT JOIN compliance_violations cv ON s.id = cv.shift_id
WHERE s.status = 'completed'
GROUP BY DATE(s.start_time), s.venue_id;

-- Refresh materialized view daily
CREATE OR REPLACE FUNCTION refresh_compliance_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_metrics_daily;
END;
$$ LANGUAGE plpgsql;
```

#### Caching Strategy
```python
# services/report_cache.py
from django.core.cache import cache
from django.conf import settings
import hashlib
import json

class ReportCacheManager:
    CACHE_TIMEOUT = {
        'compliance_summary': 300,    # 5 minutes
        'violation_detail': 180,      # 3 minutes
        'venue_performance': 600,     # 10 minutes
        'staff_compliance': 300,      # 5 minutes
    }

    @classmethod
    def get_cache_key(cls, template_type: str, parameters: Dict[str, Any]) -> str:
        """Generate cache key for report data"""
        param_string = json.dumps(parameters, sort_keys=True)
        hash_input = f"{template_type}:{param_string}"
        return f"report_data:{hashlib.md5(hash_input.encode()).hexdigest()}"

    @classmethod
    def get_cached_report(cls, template_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Get cached report data if available"""
        cache_key = cls.get_cache_key(template_type, parameters)
        return cache.get(cache_key)

    @classmethod
    def cache_report(cls, template_type: str, parameters: Dict[str, Any], report_data: Dict[str, Any]):
        """Cache report data"""
        cache_key = cls.get_cache_key(template_type, parameters)
        timeout = cls.CACHE_TIMEOUT.get(template_type, 300)
        cache.set(cache_key, report_data, timeout)

    @classmethod
    def invalidate_cache(cls, template_type: str = None):
        """Invalidate cache for specific template type or all reports"""
        if template_type:
            pattern = f"report_data:*{template_type}*"
        else:
            pattern = "report_data:*"

        # Note: This requires Redis with pattern support
        cache.delete_pattern(pattern)
```

### Security and Compliance

#### Access Control
```python
# permissions/report_permissions.py
from rest_framework import permissions

class ReportAccessPermission(permissions.BasePermission):
    """Custom permission for report access based on role and venue access"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Admin users have full access
        if request.user.role == 'admin':
            return True

        # Manager users can access most reports
        if request.user.role == 'manager':
            return view.action in ['list', 'retrieve', 'create', 'download']

        # Staff users have limited access
        if request.user.role == 'staff':
            return view.action in ['list', 'retrieve', 'download']

        return False

    def has_object_permission(self, request, view, obj):
        # Users can only access their own report jobs
        if hasattr(obj, 'requested_by'):
            return obj.requested_by == request.user

        # For templates, check venue access
        if hasattr(obj, 'allowed_venues'):
            user_venues = request.user.staffprofile.venues.all()
            return obj.allowed_venues.filter(id__in=user_venues).exists()

        return True

class ReportDataAccessMixin:
    """Mixin to filter report data based on user permissions"""

    def filter_report_data(self, report_data: Dict[str, Any], user) -> Dict[str, Any]:
        """Filter report data based on user's venue access"""

        if user.role == 'admin':
            return report_data  # No filtering for admin

        # Get user's accessible venues
        accessible_venues = user.staffprofile.venues.values_list('id', flat=True)

        # Filter data rows
        filtered_data = []
        for row in report_data['data']:
            if 'venue_id' in row and row['venue_id'] in accessible_venues:
                filtered_data.append(row)
            elif 'venue_id' not in row:  # Include aggregate data without venue
                filtered_data.append(row)

        report_data['data'] = filtered_data
        return report_data
```

#### Data Privacy and Retention
```python
# services/data_privacy.py
class DataPrivacyManager:

    @classmethod
    def anonymize_personal_data(cls, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove or anonymize personal data from reports"""

        anonymized_data = report_data.copy()

        for row in anonymized_data['data']:
            # Remove personal identifiers
            if 'staff_email' in row:
                row['staff_email'] = cls._hash_email(row['staff_email'])

            if 'staff_phone' in row:
                row['staff_phone'] = cls._mask_phone(row['staff_phone'])

            # Keep only first name for staff identification
            if 'staff_full_name' in row:
                row['staff_name'] = row['staff_full_name'].split()[0] + ' ***'
                del row['staff_full_name']

        return anonymized_data

    @classmethod
    def apply_retention_policy(cls):
        """Apply data retention policy to report files"""

        # Delete report files older than retention period
        retention_days = getattr(settings, 'REPORT_RETENTION_DAYS', 90)
        cutoff_date = timezone.now() - timedelta(days=retention_days)

        expired_jobs = ReportJob.objects.filter(
            created_at__lt=cutoff_date,
            status='completed'
        )

        for job in expired_jobs:
            if job.file_path and os.path.exists(job.file_path):
                os.remove(job.file_path)
            job.delete()

        logger.info(f"Deleted {expired_jobs.count()} expired report files")
```

### Monitoring and Analytics

#### Report Usage Analytics
```python
# services/report_analytics.py
class ReportAnalytics:

    @classmethod
    def track_report_generation(cls, template_id: int, user_id: int, export_format: str):
        """Track report generation for analytics"""

        analytics_data = {
            'event': 'report_generated',
            'template_id': template_id,
            'user_id': user_id,
            'export_format': export_format,
            'timestamp': timezone.now().isoformat()
        }

        # Store in analytics database or send to analytics service
        cache.lpush('report_analytics', json.dumps(analytics_data))

    @classmethod
    def get_popular_templates(cls, days: int = 30) -> List[Dict[str, Any]]:
        """Get most popular report templates"""

        cutoff_date = timezone.now() - timedelta(days=days)

        popular_templates = ReportJob.objects.filter(
            created_at__gte=cutoff_date
        ).values('template__id', 'template__name').annotate(
            usage_count=models.Count('id'),
            avg_file_size=models.Avg('file_size'),
            success_rate=models.Count(
                models.Case(
                    models.When(status='completed', then=1),
                    output_field=models.FloatField()
                )
            ) * 100.0 / models.Count('id')
        ).order_by('-usage_count')[:10]

        return list(popular_templates)

    @classmethod
    def get_performance_metrics(cls) -> Dict[str, Any]:
        """Get report generation performance metrics"""

        recent_jobs = ReportJob.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        )

        # Calculate average generation time
        completed_jobs = recent_jobs.filter(status='completed')
        avg_generation_time = completed_jobs.aggregate(
            avg_time=models.Avg(
                models.ExpressionWrapper(
                    models.F('completed_at') - models.F('started_at'),
                    output_field=models.DurationField()
                )
            )
        )['avg_time']

        # Success rate
        total_jobs = recent_jobs.count()
        successful_jobs = completed_jobs.count()
        success_rate = (successful_jobs / total_jobs * 100) if total_jobs > 0 else 0

        return {
            'total_reports_generated': total_jobs,
            'success_rate': round(success_rate, 2),
            'average_generation_time_seconds': avg_generation_time.total_seconds() if avg_generation_time else 0,
            'peak_usage_hour': cls._get_peak_usage_hour(),
            'popular_formats': cls._get_popular_formats()
        }
```

### Conclusion

This Export & Reporting Architecture provides a comprehensive solution for the Legal Compliance Reporting System's data export and reporting requirements. The architecture supports:

**Key Features:**
- **Multiple Export Formats**: PDF, Excel, CSV, JSON with customizable formatting
- **Asynchronous Processing**: Background generation with real-time status updates
- **Template-Based Reports**: Flexible, reusable report templates with parameters
- **Scheduled Reports**: Automated report generation and distribution
- **Role-Based Access**: Secure access control based on user roles and venue permissions
- **Performance Optimization**: Caching, query optimization, and efficient data processing
- **Scalable Architecture**: Designed to handle high-volume report generation

**Performance Targets:**
- Support 500+ concurrent report generation jobs
- Generate standard reports within 30 seconds
- Support file sizes up to 100MB for Excel, 200MB for CSV
- Maintain 99% success rate for report generation
- Provide real-time status updates with <2 second latency

The system is designed to scale with the organization's growth while maintaining security, performance, and compliance with data privacy regulations.