# Security Staff Portal - API Endpoints Documentation

This document outlines the API endpoints for the Security Staff Portal backend implemented using Django REST Framework. The API follows RESTful principles and uses JWT for authentication.

## Base URL

All API endpoints are prefixed with: `/api/v1`

## Authentication

Most endpoints require authentication using JWT (JSON Web Tokens).

### Authentication Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| POST | `/accounts/login/` | Login and get access tokens | `{username, password}` | `{access, refresh, user}` |
| POST | `/accounts/register/` | Register a new user | `{username, email, password, firstName, lastName}` | User object |
| POST | `/accounts/refresh/` | Refresh the access token | `{refresh}` | `{access}` |
| POST | `/accounts/logout/` | Logout (invalidate tokens) | None | `{success}` |
| POST | `/accounts/change-password/` | Change user password | `{current_password, new_password}` | `{success}` |
| GET | `/accounts/user/` | Get current user details | None | User object |

## User Management

### Staff Profiles

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/profiles/me/` | Get current user's profile | None | Staff profile object |
| PATCH | `/profiles/me/` | Update current user's profile | Profile fields to update | Updated profile object |
| GET | `/profiles/{id}/` | Get specific staff profile (admin/manager only) | None | Staff profile object |
| PATCH | `/profiles/{id}/` | Update specific staff profile (admin only) | Profile fields to update | Updated profile object |
| DELETE | `/profiles/{id}/` | Deactivate staff profile (admin only) | None | `{success}` |
| GET | `/profiles/` | List all staff profiles (admin/manager only) | None | Array of profiles |

### SIA Licenses

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/profiles/me/sia-licenses/` | Get current user's SIA licenses | None | Array of licenses |
| POST | `/profiles/me/sia-licenses/` | Add a new SIA license | License details + file | Created license object |
| PATCH | `/profiles/me/sia-licenses/{id}/` | Update a specific license | License fields to update | Updated license object |
| DELETE | `/profiles/me/sia-licenses/{id}/` | Delete a specific license | None | `{success}` |

### Bank Details

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/profiles/me/bank-details/` | Get current user's bank details | None | Bank details object |
| POST | `/profiles/me/bank-details/` | Create or update bank details | Bank details | Bank details object |

### Emergency Contacts

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/profiles/me/emergency-contacts/` | Get current user's emergency contacts | None | Array of contacts |
| POST | `/profiles/me/emergency-contacts/` | Add a new emergency contact | Contact details | Created contact object |
| PATCH | `/profiles/me/emergency-contacts/{id}/` | Update a specific contact | Contact fields to update | Updated contact object |
| DELETE | `/profiles/me/emergency-contacts/{id}/` | Delete a specific contact | None | `{success}` |

## Venue Management

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/venues/` | List all venues | None | Array of venues |
| POST | `/venues/` | Create a new venue (admin only) | Venue details | Created venue object |
| GET | `/venues/{id}/` | Get specific venue details | None | Venue object |
| PATCH | `/venues/{id}/` | Update a venue (admin only) | Venue fields to update | Updated venue object |
| DELETE | `/venues/{id}/` | Deactivate a venue (admin only) | None | `{success}` |

## Shift Management

### Shifts

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/shifts/` | List shifts (filtered by permissions) | Query params for filtering | Array of shifts |
| POST | `/shifts/start/` | Start a new shift | `{venueId, startSignature}` | Created shift object |
| GET | `/shifts/{id}/` | Get specific shift details | None | Shift object |
| POST | `/shifts/{id}/end/` | End a shift | `{endSignature}` | Updated shift object |
| GET | `/shifts/active/` | Get current user's active shift | None | Active shift object or null |
| GET | `/shifts/{id}/checks/` | Get all checks for a shift | None | Object with all check types |

### Shift Approvals (Manager)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/manager/pending-approvals/` | List shifts pending approval | Query params for filtering | Array of shifts |
| POST | `/manager/approve/{id}/` | Approve/reject a shift | `{approved, managerSignature, managerNotes}` | Updated shift object |

### Shift Checks

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/shifts/{id}/fire-exit-checks/` | List fire exit checks | None | Array of checks |
| POST | `/shifts/{id}/fire-exit-checks/` | Add a fire exit check | Check details | Created check object |
| GET | `/shifts/{id}/capacity-checks/` | List capacity checks | None | Array of checks |
| POST | `/shifts/{id}/capacity-checks/` | Add a capacity check | Check details | Created check object |
| GET | `/shifts/{id}/toilet-checks/` | List toilet checks | None | Array of checks |
| POST | `/shifts/{id}/toilet-checks/` | Add a toilet check | Check details | Created check object |
| GET | `/shifts/{id}/enforcement-visits/` | List enforcement visits | None | Array of visits |
| POST | `/shifts/{id}/enforcement-visits/` | Add an enforcement visit | Visit details | Created visit object |

### Shift Exchanges

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/shift-exchanges/` | List shift exchanges (filtered by user) | Query params for filtering | Array of exchanges |
| POST | `/shift-exchanges/` | Request a shift exchange | `{shiftId, reason}` | Created exchange object |
| PATCH | `/shift-exchanges/{id}/accept/` | Accept a shift exchange | None | Updated exchange object |
| PATCH | `/shift-exchanges/{id}/reject/` | Reject a shift exchange | None | Updated exchange object |
| PATCH | `/shift-exchanges/{id}/cancel/` | Cancel a shift exchange request | None | Updated exchange object |
| GET | `/shift-exchanges/available/` | List available exchanges | None | Array of available exchanges |

## Invoice Management

### Invoices

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/invoices/` | List invoices (filtered by permissions) | Query params for filtering | Array of invoices |
| POST | `/invoices/generate/` | Generate a new invoice (admin only) | `{staffUserId, startDate, endDate}` | Created invoice object |
| GET | `/invoices/{id}/` | Get specific invoice details | None | Invoice object |
| PATCH | `/invoices/{id}/` | Update invoice status (admin only) | `{status}` | Updated invoice object |
| GET | `/invoices/{id}/items/` | Get invoice line items | None | Array of invoice items |
| POST | `/invoices/{id}/generate-pdf/` | Generate PDF for invoice | None | `{pdf_url}` |

### Pay Rates

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/payrates/` | List pay rates (filtered by permissions) | Query params for filtering | Array of pay rates |
| POST | `/payrates/` | Create a new pay rate (admin only) | Pay rate details | Created pay rate object |
| PATCH | `/payrates/{id}/` | Update a pay rate (admin only) | Pay rate fields to update | Updated pay rate object |
| DELETE | `/payrates/{id}/` | Delete a pay rate (admin only) | None | `{success}` |

## Deputy Integration (Admin Only)

### Configuration

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/deputy/config/` | Get Deputy integration config | None | Config object |
| PUT | `/deputy/config/` | Update Deputy integration config | Config details | Updated config object |
| GET | `/deputy/status/` | Check Deputy integration status | None | Status object |

### Sync Operations

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| POST | `/deputy/sync-employees/` | Sync employees from Deputy | None | Sync log object |
| POST | `/deputy/sync-timesheets/` | Sync timesheets from Deputy | None | Sync log object |
| GET | `/deputy/sync-logs/` | Get sync operation logs | None | Array of sync logs |

### Deputy Data

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/deputy/employees/` | List Deputy employees | None | Array of employees |
| POST | `/deputy/employees/{id}/map/` | Map Deputy employee to user | `{user_id}` | Updated mapping object |
| GET | `/deputy/timesheets/` | List Deputy timesheets | Query params for filtering | Array of timesheets |
| POST | `/deputy/timesheets/{id}/import/` | Import Deputy timesheet as shift | None | Updated timesheet/shift object |

### Field Mappings

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| GET | `/deputy/field-mappings/` | List field mappings | None | Array of mappings |
| POST | `/deputy/field-mappings/` | Create a new field mapping | Mapping details | Created mapping object |
| PATCH | `/deputy/field-mappings/{id}/` | Update a field mapping | Mapping fields to update | Updated mapping object |
| DELETE | `/deputy/field-mappings/{id}/` | Delete a field mapping | None | `{success}` |

## Query Parameters for Filtering

Many endpoints support common query parameters for filtering:

1. **Pagination**: `?page=1&page_size=20`
2. **Ordering**: `?ordering=created_at` (use `-created_at` for descending)
3. **Filtering by date range**: `?start_date=2023-01-01&end_date=2023-01-31`
4. **Filtering by status**: `?status=active`
5. **Search**: `?search=term`

## Error Responses

The API returns standardized error responses:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {} // Additional error details when available
  }
}
```

## Authentication Headers

For authenticated endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Rate Limiting

The API implements rate limiting to prevent abuse. Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1609459200
```

## Versioning

The API is versioned using URL path versioning (`/api/v1/`). The current version is v1.
