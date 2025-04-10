# Deputy Integration Flow

This document outlines the integration flow between the Deputy workforce management system and the Security Staff Portal database, specifically implemented with Django.

## 1. Overview

Deputy is a workforce management platform that handles scheduling, timesheets, and attendance. The Security Staff Portal needs to integrate with Deputy to:

1. Import employee data from Deputy to map to internal staff users
2. Import timesheet data from Deputy to create/verify shifts
3. Optionally push approved shifts back to Deputy
4. Keep both systems in sync through scheduled processes

## 2. System Architecture

```
┌───────────────────────────┐                ┌───────────────────────────┐
│                           │                │                           │
│    Deputy System          │                │  Security Staff Portal    │
│                           │                │                           │
│  ┌─────────────────────┐  │                │  ┌─────────────────────┐  │
│  │                     │  │   REST API     │  │                     │  │
│  │  Employee Data      │◄─┼───────────────┼─►│  Users/Staff         │  │
│  │                     │  │                │  │                     │  │
│  └─────────────────────┘  │                │  └─────────────────────┘  │
│                           │                │                           │
│  ┌─────────────────────┐  │                │  ┌─────────────────────┐  │
│  │                     │  │   REST API     │  │                     │  │
│  │  Timesheets         │◄─┼───────────────┼─►│  Shifts              │  │
│  │                     │  │                │  │                     │  │
│  └─────────────────────┘  │                │  └─────────────────────┘  │
│                           │                │                           │
│  ┌─────────────────────┐  │                │  ┌─────────────────────┐  │
│  │                     │  │   Webhooks     │  │                     │  │
│  │  Events/Updates     │──┼───────────────►│  │  Integration        │  │
│  │                     │  │                │  │                     │  │
│  └─────────────────────┘  │                │  └─────────────────────┘  │
│                           │                │                           │
└───────────────────────────┘                └───────────────────────────┘
```

## 3. Data Models and Database Tables

The Django models required for the integration include:

```python
# models.py
from django.db import models
from django.utils import timezone
from django.conf import settings
from encrypted_fields import fields as encrypted_fields

class DeputyConfig(models.Model):
    """Configuration for Deputy integration"""
    api_endpoint = models.URLField()
    api_key = encrypted_fields.EncryptedCharField(max_length=255)
    is_active = models.BooleanField(default=True)
    last_sync_date = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Deputy Config ({self.api_endpoint})"

class DeputyEmployee(models.Model):
    """Deputy employee record"""
    deputy_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField()
    phone = models.CharField(max_length=20, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    mapped_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deputy_employee'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.deputy_id})"

class DeputyTimesheet(models.Model):
    """Deputy timesheet record"""
    deputy_id = models.CharField(max_length=50, unique=True)
    employee_id = models.CharField(max_length=50)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration = models.DecimalField(max_digits=10, decimal_places=2)
    shift_notes = models.TextField(null=True, blank=True)
    location = models.CharField(max_length=100)
    imported = models.BooleanField(default=False)
    mapped_to_shift = models.ForeignKey(
        'shifts.Shift',  # Reference to Shift model in shifts app
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deputy_timesheet'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Timesheet {self.deputy_id} ({self.employee_id})"

class FieldMapping(models.Model):
    """Mapping between Deputy field names and internal field names"""
    source_field = models.CharField(max_length=100)
    target_field = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.source_field} → {self.target_field}"

class SyncLog(models.Model):
    """Log of synchronization operations"""
    ENTITY_CHOICES = [
        ('employee', 'Employee'),
        ('timesheet', 'Timesheet'),
    ]
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    entity_type = models.CharField(max_length=20, choices=ENTITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    message = models.TextField(null=True, blank=True)
    records_processed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.entity_type} sync - {self.status}"
```

## 4. Integration Flow Details

### 4.1. Initial Setup and Configuration

1. **Admin creates Deputy API credentials**:
   - Log into Deputy admin portal
   - Generate an API key with appropriate permissions
   - Enter credentials in Security Staff Portal admin

```python
# views.py
class DeputyConfigView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        config = DeputyConfig.objects.first()
        return Response(DeputyConfigSerializer(config).data)

    def put(self, request):
        config = DeputyConfig.objects.first()
        if not config:
            config = DeputyConfig()

        serializer = DeputyConfigSerializer(config, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
```

2. **Field mapping configuration**:
   - Set up mappings between Deputy fields and internal fields
   - Default mappings are created during initial setup

```python
# services.py
def create_default_field_mappings():
    default_mappings = [
        {'source_field': 'Id', 'target_field': 'deputy_id'},
        {'source_field': 'FirstName', 'target_field': 'first_name'},
        {'source_field': 'LastName', 'target_field': 'last_name'},
        {'source_field': 'Email', 'target_field': 'email'},
        {'source_field': 'Mobile', 'target_field': 'phone'},
        # Timesheet mappings
        {'source_field': 'Employee', 'target_field': 'employee_id'},
        {'source_field': 'StartTime', 'target_field': 'start_time'},
        {'source_field': 'EndTime', 'target_field': 'end_time'},
        {'source_field': 'Comment', 'target_field': 'shift_notes'},
        {'source_field': 'Location', 'target_field': 'location'},
    ]

    for mapping in default_mappings:
        FieldMapping.objects.get_or_create(
            source_field=mapping['source_field'],
            defaults={'target_field': mapping['target_field']}
        )
```

### 4.2. Employee Synchronization

1. **Fetch employees from Deputy**:
   - Make API request to Deputy's employee endpoint
   - Transform data according to field mappings
   - Create/update DeputyEmployee records

```python
# services.py
def sync_deputy_employees():
    config = DeputyConfig.objects.first()
    if not config or not config.is_active:
        raise Exception("Deputy integration not configured or not active")

    # Initialize Deputy API client
    deputy_client = DeputyClient(config.api_endpoint, config.api_key)

    try:
        # Fetch employees from Deputy
        employees = deputy_client.get_employees()

        # Get field mappings
        field_mappings = {m.source_field: m.target_field for m in FieldMapping.objects.filter(is_active=True)}

        # Process employees
        processed_count = 0
        for employee_data in employees:
            # Map fields
            mapped_data = {}
            for source_field, target_field in field_mappings.items():
                if source_field in employee_data:
                    mapped_data[target_field] = employee_data[source_field]

            # Create or update DeputyEmployee
            deputy_id = mapped_data.get('deputy_id')
            if deputy_id:
                employee, created = DeputyEmployee.objects.update_or_create(
                    deputy_id=deputy_id,
                    defaults=mapped_data
                )
                processed_count += 1

        # Update last sync date
        config.last_sync_date = timezone.now()
        config.save()

        # Create sync log
        SyncLog.objects.create(
            entity_type='employee',
            status='success',
            records_processed=processed_count,
            message=f"Successfully synced {processed_count} employees"
        )

        return processed_count

    except Exception as e:
        # Log error
        SyncLog.objects.create(
            entity_type='employee',
            status='failed',
            message=str(e)
        )
        raise
```

2. **Map Deputy employees to internal users**:
   - Admin UI to map employees to existing users
   - Optional: Auto-map based on email address

```python
# services.py
def auto_map_deputy_employees():
    # Find unmapped Deputy employees
    unmapped_employees = DeputyEmployee.objects.filter(mapped_to_user__isnull=True)

    mapped_count = 0
    for employee in unmapped_employees:
        # Try to find user with matching email
        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            user = User.objects.get(email__iexact=employee.email)
            # Map employee to user
            employee.mapped_to_user = user
            employee.save()
            mapped_count += 1
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            # Skip if no unique match found
            continue

    return mapped_count
```

### 4.3. Timesheet Synchronization

1. **Fetch timesheets from Deputy**:
   - API request to Deputy's timesheet endpoint
   - Filter by date range or status
   - Create DeputyTimesheet records

```python
# services.py
def sync_deputy_timesheets(start_date=None, end_date=None):
    config = DeputyConfig.objects.first()
    if not config or not config.is_active:
        raise Exception("Deputy integration not configured or not active")

    # Initialize Deputy API client
    deputy_client = DeputyClient(config.api_endpoint, config.api_key)

    # Set date range
    if not start_date:
        # Default to last 7 days if not specified
        start_date = timezone.now() - timezone.timedelta(days=7)
    if not end_date:
        end_date = timezone.now()

    try:
        # Fetch timesheets from Deputy
        params = {
            'start': start_date.isoformat(),
            'end': end_date.isoformat()
        }
        timesheets = deputy_client.get_timesheets(params)

        # Get field mappings
        field_mappings = {m.source_field: m.target_field for m in FieldMapping.objects.filter(is_active=True)}

        # Process timesheets
        processed_count = 0
        for timesheet_data in timesheets:
            # Map fields
            mapped_data = {}
            for source_field, target_field in field_mappings.items():
                if source_field in timesheet_data:
                    mapped_data[target_field] = timesheet_data[source_field]

            # Create or update DeputyTimesheet
            deputy_id = mapped_data.get('deputy_id')
            if deputy_id:
                # Parse datetime fields
                for field in ['start_time', 'end_time']:
                    if field in mapped_data:
                        mapped_data[field] = parse_deputy_datetime(mapped_data[field])

                # Calculate duration if not provided
                if 'start_time' in mapped_data and 'end_time' in mapped_data and 'duration' not in mapped_data:
                    start = mapped_data['start_time']
                    end = mapped_data['end_time']
                    duration_hours = (end - start).total_seconds() / 3600
                    mapped_data['duration'] = round(duration_hours, 2)

                timesheet, created = DeputyTimesheet.objects.update_or_create(
                    deputy_id=deputy_id,
                    defaults=mapped_data
                )
                processed_count += 1

        # Update last sync date
        config.last_sync_date = timezone.now()
        config.save()

        # Create sync log
        SyncLog.objects.create(
            entity_type='timesheet',
            status='success',
            records_processed=processed_count,
            message=f"Successfully synced {processed_count} timesheets"
        )

        return processed_count

    except Exception as e:
        # Log error
        SyncLog.objects.create(
            entity_type='timesheet',
            status='failed',
            message=str(e)
        )
        raise
```

2. **Import timesheets as shifts**:
   - Create corresponding Shift records for timesheets
   - Map venues based on Deputy location names

```python
# services.py
def import_timesheet_as_shift(timesheet_id):
    try:
        timesheet = DeputyTimesheet.objects.get(id=timesheet_id)

        # Skip if already imported
        if timesheet.imported and timesheet.mapped_to_shift:
            return timesheet.mapped_to_shift

        # Find the mapped user for the employee
        employee = DeputyEmployee.objects.filter(deputy_id=timesheet.employee_id).first()
        if not employee or not employee.mapped_to_user:
            raise Exception(f"No mapped user found for Deputy employee {timesheet.employee_id}")

        # Find or create venue based on location
        venue = Venue.objects.filter(name__iexact=timesheet.location).first()
        if not venue:
            # Default venue if no match
            venue = Venue.objects.filter(is_active=True).first()
            if not venue:
                raise Exception("No active venue found")

        # Create a new shift
        from shifts.models import Shift, ShiftStatus

        # Check if this shift already exists based on user, venue, and time
        existing_shift = Shift.objects.filter(
            staff_user=employee.mapped_to_user,
            venue=venue,
            start_time=timesheet.start_time
        ).first()

        if existing_shift:
            # Update existing shift
            existing_shift.end_time = timesheet.end_time
            existing_shift.status = ShiftStatus.COMPLETED
            existing_shift.save()
            shift = existing_shift
        else:
            # Create new shift
            shift = Shift.objects.create(
                staff_user=employee.mapped_to_user,
                venue=venue,
                start_time=timesheet.start_time,
                end_time=timesheet.end_time,
                status=ShiftStatus.COMPLETED,
                # Use placeholder for signature - will need manual approval
                start_signature="Imported from Deputy",
                end_signature="Imported from Deputy"
            )

        # Update the timesheet record
        timesheet.imported = True
        timesheet.mapped_to_shift = shift
        timesheet.save()

        return shift

    except DeputyTimesheet.DoesNotExist:
        raise Exception(f"Timesheet with ID {timesheet_id} not found")
    except Exception as e:
        raise Exception(f"Error importing timesheet as shift: {str(e)}")
```

### 4.4. Automated Synchronization

1. **Scheduled tasks with Celery**:
   - Set up periodic tasks for syncing
   - Handle errors and logging

```python
# tasks.py
from celery import shared_task
from datetime import timedelta
from django.utils import timezone
from .services import sync_deputy_employees, sync_deputy_timesheets

@shared_task
def scheduled_deputy_employee_sync():
    try:
        count = sync_deputy_employees()
        return f"Successfully synced {count} employees from Deputy"
    except Exception as e:
        return f"Error syncing employees from Deputy: {str(e)}"

@shared_task
def scheduled_deputy_timesheet_sync():
    try:
        # Sync timesheets for the last 7 days
        start_date = timezone.now() - timedelta(days=7)
        count = sync_deputy_timesheets(start_date=start_date)
        return f"Successfully synced {count} timesheets from Deputy"
    except Exception as e:
        return f"Error syncing timesheets from Deputy: {str(e)}"
```

2. **Celery beat schedule**:
   - Configure regular execution of sync tasks

```python
# settings.py
CELERY_BEAT_SCHEDULE = {
    'sync-deputy-employees-daily': {
        'task': 'deputy.tasks.scheduled_deputy_employee_sync',
        'schedule': crontab(hour=1, minute=0),  # Run at 1:00 AM every day
    },
    'sync-deputy-timesheets-hourly': {
        'task': 'deputy.tasks.scheduled_deputy_timesheet_sync',
        'schedule': crontab(minute=15),  # Run at 15 minutes past every hour
    },
}
```

### 4.5. Deputy Webhooks for Real-Time Updates

1. **Configure webhooks in Deputy**:
   - Set up endpoints in Deputy admin
   - Define events to trigger webhooks

2. **Webhook endpoint implementation**:
   - Secure handling of incoming webhook requests
   - Process events and update data

```python
# views.py
import hmac
import hashlib

class DeputyWebhookView(APIView):
    permission_classes = []  # Public endpoint

    def post(self, request, *args, **kwargs):
        # Verify webhook signature
        signature = request.META.get('HTTP_X_DEPUTY_SIGNATURE')
        if not signature:
            return Response({'error': 'Missing signature'}, status=400)

        # Get webhook secret from config
        config = DeputyConfig.objects.first()
        if not config or not config.is_active:
            return Response({'error': 'Deputy integration not configured'}, status=400)

        # Calculate expected signature (implementation depends on Deputy's webhook security)
        expected_signature = hmac.new(
            config.webhook_secret.encode(),
            request.body,
            hashlib.sha256
        ).hexdigest()

        # Verify signature
        if not hmac.compare_digest(expected_signature, signature):
            return Response({'error': 'Invalid signature'}, status=403)

        # Process webhook data
        event_type = request.data.get('event')
        resource_type = request.data.get('resource_type')

        if event_type == 'created' or event_type == 'updated':
            if resource_type == 'Employee':
                # Trigger employee sync
                sync_deputy_employees.delay()
            elif resource_type == 'Timesheet':
                # Trigger timesheet sync
                sync_deputy_timesheets.delay()

        return Response({'status': 'success'})
```

### 4.6. Admin Interface

1. **Django Admin customization**:
   - View and manage integration settings
   - Monitor sync logs

```python
# admin.py
from django.contrib import admin
from .models import DeputyConfig, DeputyEmployee, DeputyTimesheet, FieldMapping, SyncLog

@admin.register(DeputyConfig)
class DeputyConfigAdmin(admin.ModelAdmin):
    list_display = ('api_endpoint', 'is_active', 'last_sync_date')
    readonly_fields = ('created_at', 'updated_at', 'last_sync_date')

    def has_add_permission(self, request):
        # Only allow one config record
        return not DeputyConfig.objects.exists()

@admin.register(DeputyEmployee)
class DeputyEmployeeAdmin(admin.ModelAdmin):
    list_display = ('deputy_id', 'first_name', 'last_name', 'email', 'is_active', 'mapped_to_user')
    list_filter = ('is_active',)
    search_fields = ('deputy_id', 'first_name', 'last_name', 'email')
    readonly_fields = ('deputy_id', 'created_at', 'updated_at')

@admin.register(DeputyTimesheet)
class DeputyTimesheetAdmin(admin.ModelAdmin):
    list_display = ('deputy_id', 'employee_id', 'start_time', 'end_time', 'duration', 'imported')
    list_filter = ('imported',)
    search_fields = ('deputy_id', 'employee_id')
    readonly_fields = ('deputy_id', 'created_at', 'updated_at')

@admin.register(FieldMapping)
class FieldMappingAdmin(admin.ModelAdmin):
    list_display = ('source_field', 'target_field', 'is_active')
    list_filter = ('is_active',)

@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ('entity_type', 'status', 'records_processed', 'created_at')
    list_filter = ('entity_type', 'status')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
```

2. **Custom admin actions**:
   - Buttons to trigger manual sync
   - Tools to resolve mapping issues

```python
# admin.py
class DeputyConfigAdmin(admin.ModelAdmin):
    # ... other configuration ...

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('sync-employees/', self.admin_site.admin_view(self.sync_employees_view), name='sync-deputy-employees'),
            path('sync-timesheets/', self.admin_site.admin_view(self.sync_timesheets_view), name='sync-deputy-timesheets'),
        ]
        return custom_urls + urls

    def sync_employees_view(self, request):
        if request.method == 'POST':
            try:
                from .services import sync_deputy_employees
                count = sync_deputy_employees()
                messages.success(request, f"Successfully synced {count} employees from Deputy")
            except Exception as e:
                messages.error(request, f"Error syncing employees: {str(e)}")

        return redirect('admin:deputy_deputyconfig_changelist')

    def sync_timesheets_view(self, request):
        if request.method == 'POST':
            try:
                from .services import sync_deputy_timesheets
                count = sync_deputy_timesheets()
                messages.success(request, f"Successfully synced {count} timesheets from Deputy")
            except Exception as e:
                messages.error(request, f"Error syncing timesheets: {str(e)}")

        return redirect('admin:deputy_deputyconfig_changelist')
```

## 5. Error Handling and Validation

1. **Input data validation**:
   - Validate data from Deputy API
   - Handle edge cases (missing fields, format issues)

```python
# utils.py
def validate_deputy_employee(data):
    """Validate employee data from Deputy"""
    required_fields = ['Id', 'FirstName', 'LastName', 'Email']
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")

    # Validate email format
    email = data.get('Email')
    if email and not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise ValidationError(f"Invalid email format: {email}")

    return data

def validate_deputy_timesheet(data):
    """Validate timesheet data from Deputy"""
    required_fields = ['Id', 'Employee', 'StartTime', 'EndTime']
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")

    # Validate timestamp formats
    for field in ['StartTime', 'EndTime']:
        try:
            if field in data:
                parse_deputy_datetime(data[field])
        except ValueError:
            raise ValidationError(f"Invalid datetime format for {field}: {data[field]}")

    # Validate time logic
    start = parse_deputy_datetime(data['StartTime'])
    end = parse_deputy_datetime(data['EndTime'])

    if start >= end:
        raise ValidationError(f"End time must be after start time: {start} >= {end}")

    return data
```

2. **Exception handling**:
   - Robust error handling in sync processes
   - Detailed error logging

```python
# services.py
def safe_sync_deputy_employees():
    """Safe wrapper for employee sync"""
    try:
        return sync_deputy_employees()
    except Exception as e:
        # Log the error
        logger.error(f"Deputy employee sync failed: {str(e)}", exc_info=True)
        # Create sync log entry
        SyncLog.objects.create(
            entity_type='employee',
            status='failed',
            message=str(e)
        )
        # Notify admins
        send_admin_notification('Deputy Employee Sync Failed', str(e))
        # Return 0 to indicate no records were processed
        return 0
```

## 6. Security Considerations

1. **API key storage**:
   - Store Deputy API key encrypted

2. **Webhook verification**:
   - Validate webhook signatures
   - Protect webhook endpoints from unauthorized access

3. **Data protection**:
   - Handle employee and timesheet data securely
   - Implement proper access controls

## 7. Implementation Steps

1. **Phase 1: Initial Setup**
   - Create Django models for the integration
   - Implement configuration views and APIs
   - Set up field mappings

2. **Phase 2: Employee Integration**
   - Implement employee sync from Deputy
   - Develop UI for user-employee mapping
   - Test and validate employee data

3. **Phase 3: Timesheet Integration**
   - Implement timesheet sync from Deputy
   - Create timesheet-to-shift importation
   - Test and validate timesheet data

4. **Phase 4: Automation**
   - Set up Celery tasks for background processing
   - Configure scheduled syncs
   - Implement webhook handlers

5. **Phase 5: Admin Interface**
   - Enhance Django admin for integration management
   - Add manual sync triggers
   - Implement reporting and monitoring

## 8. Integration Testing Checklist

- [ ] Configuration successfully saves and encrypts API key
- [ ] Employee sync retrieves and stores employee data
- [ ] Employee mapping to users works correctly
- [ ] Timesheet sync retrieves and stores timesheet data
- [ ] Timesheet import creates valid shift records
- [ ] Scheduled tasks execute on time
- [ ] Webhooks correctly receive and process events
- [ ] Error handling properly manages exceptions
- [ ] Admin interface shows correct data
- [ ] Manual sync triggers work as expected

## 9. Maintenance and Monitoring

1. **Regular monitoring**:
   - Monitor sync logs for errors
   - Check for failed synchronizations

2. **Performance optimization**:
   - Batch processing for large datasets
   - Optimize database queries

3. **Update processes**:
   - Handle Deputy API updates
   - Maintain field mappings as needed
