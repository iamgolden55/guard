# Report Metrics API Documentation

## Overview
The Report Metrics API endpoint provides comprehensive analytics and metrics about report generation jobs within the system. It was implemented to resolve the 404 errors from the frontend requesting `/api/v1/reports/metrics/?period=7d`.

## Endpoint
- **URL**: `/api/v1/reports/metrics/`
- **Methods**: GET
- **Authentication**: Required (JWT)
- **Permissions**: All authenticated users can access their own metrics; admins can see system-wide metrics

## Query Parameters

### period (optional)
Specifies the time period for metrics calculation.

**Format**: `{amount}{unit}`
- **amount**: Integer number
- **unit**:
  - `d` = days
  - `m` = months (approximated as 30 days)
  - `y` = years (approximated as 365 days)

**Examples**:
- `7d` = Last 7 days (default)
- `30d` = Last 30 days
- `90d` = Last 90 days
- `1m` = Last month
- `1y` = Last year

**Default**: `7d` if not specified

## Response Format

```json
{
    "status": "success",
    "period": "7d",
    "period_start": "2025-09-17T10:00:00Z",
    "period_end": "2025-09-24T10:00:00Z",
    "metrics": {
        "total_reports": 25,
        "status_breakdown": {
            "completed": 20,
            "failed": 2,
            "pending": 2,
            "processing": 1
        },
        "success_rate_percent": 80.0,
        "failure_rate_percent": 8.0,
        "avg_generation_time_seconds": 45.3,
        "popular_report_types": [
            {
                "template__name": "Compliance Summary",
                "template__template_type": "compliance_summary",
                "count": 12
            }
        ],
        "popular_export_formats": [
            {
                "format": "csv",
                "count": 15
            },
            {
                "format": "excel",
                "count": 10
            }
        ],
        "usage_by_hour": [
            {
                "hour": 9,
                "count": 5
            },
            {
                "hour": 14,
                "count": 8
            }
        ],
        "usage_trend": [
            {
                "date": "2025-09-17",
                "count": 3
            },
            {
                "date": "2025-09-18",
                "count": 5
            }
        ],
        "file_size_stats": {
            "avg_size_mb": 2.5,
            "min_size_mb": 0.1,
            "max_size_mb": 15.2,
            "total_size_mb": 50.0
        },
        "user_activity": [
            {
                "requested_by__username": "admin_user",
                "requested_by__first_name": "Admin",
                "requested_by__last_name": "User",
                "report_count": 8
            }
        ]
    }
}
```

## Metrics Explained

### Basic Metrics
- **total_reports**: Total number of report generation jobs in the period
- **status_breakdown**: Count of jobs by status (completed, failed, pending, processing)
- **success_rate_percent**: Percentage of completed jobs out of total
- **failure_rate_percent**: Percentage of failed jobs out of total

### Performance Metrics
- **avg_generation_time_seconds**: Average time taken to generate completed reports (in seconds)
- **file_size_stats**: Statistics about generated file sizes for completed reports

### Usage Analytics
- **popular_report_types**: Top 5 most requested report templates with their types and counts
- **popular_export_formats**: Export formats ranked by usage frequency
- **usage_by_hour**: Report generation activity by hour of day (0-23)
- **usage_trend**: Time series data showing daily or weekly usage trends

### Admin-Only Data
- **user_activity**: Most active users (top 10) - only visible to admin users

## Permission Levels

### Regular Users
- See metrics only for reports they have requested
- Cannot see user_activity data
- All other metrics are calculated based on their own report jobs

### Admin Users
- See system-wide metrics for all users
- Can view user_activity showing most active report generators
- All metrics calculated across all users' report jobs

## Usage Trend Granularity
- **Periods ≤ 30 days**: Daily granularity (one data point per day)
- **Periods > 30 days**: Weekly granularity (one data point per week)

## Error Responses

### Invalid Period Format
```json
{
    "error": "Invalid period format. Use format like '7d', '30d', '90d', or '1y'"
}
```
**Status Code**: 400 Bad Request

### Invalid Period Unit
```json
{
    "error": "Invalid period unit. Use 'd' (days), 'm' (months), or 'y' (years)"
}
```
**Status Code**: 400 Bad Request

### Authentication Required
```json
{
    "error": "Authentication required"
}
```
**Status Code**: 401 Unauthorized

## Implementation Details

### ViewSet
- **Class**: `ReportMetricsViewSet`
- **Base**: `viewsets.ViewSet`
- **Location**: `api/views.py`

### URL Registration
- **Router**: `reports/metrics`
- **Basename**: `report-metrics`
- **Full URL**: `/api/v1/reports/metrics/`

### Database Queries
The endpoint performs optimized queries using Django ORM aggregations:
- Uses `Count()`, `Avg()` aggregations for efficiency
- Filters by date ranges using `created_at__gte`
- Uses `values()` and `annotate()` for grouping operations
- Includes proper user permission filtering

### Performance Considerations
- All queries are optimized with proper aggregations
- Time range filtering reduces dataset size
- Uses database-level grouping and counting
- File size calculations done in Python for accuracy

## Frontend Integration
This endpoint resolves the 404 errors from frontend requests to `/api/v1/reports/metrics/?period=7d` and provides all the metrics data needed for dashboard reporting features.

## Testing
The endpoint has been tested with:
- Different period formats (7d, 30d, 90d)
- Both admin and regular user permissions
- Error handling for invalid periods
- Proper authentication requirements