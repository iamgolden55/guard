# API Endpoints Documentation

## Base URLs
- **Main API**: `/api/v1/` (users, venues, profiles, etc.)
- **Shifts API**: `/api/shifts/` (shift management)

## Available Endpoints

### Authentication & Users
- `POST /api/v1/login/` - User login
- `POST /api/v1/token/` - Get JWT token
- `POST /api/v1/token/refresh/` - Refresh JWT token
- `GET /api/v1/users/` - List users (staff profiles)
- `GET /api/v1/users/{id}/` - Get specific user
- `POST /api/v1/users/` - Create user (registration)

### Venues
- `GET /api/v1/venues/` - List all venues
- `GET /api/v1/venues/{id}/` - Get specific venue
- `POST /api/v1/venues/` - Create venue (admin only)
- `PATCH /api/v1/venues/{id}/` - Update venue

### Shifts (Main API)
- `GET /api/shifts/` - List shifts (with filtering)
- `POST /api/shifts/` - Create shift
- `GET /api/shifts/{id}/` - Get specific shift
- `PATCH /api/shifts/{id}/` - Update shift
- `DELETE /api/shifts/{id}/` - Delete shift

#### Shift Actions
- `POST /api/shifts/{id}/check_in/` - Check in to shift
- `POST /api/shifts/{id}/check_out/` - Check out from shift
- `POST /api/shifts/{id}/cancel/` - Cancel shift
- `GET /api/shifts/upcoming/` - Get upcoming shifts
- `GET /api/shifts/my_shifts/` - Get current user's shifts

### Frontend-Friendly Shifts (camelCase)
- `GET /api/shifts/frontend/` - List shifts (camelCase response)
- `POST /api/shifts/frontend/` - Create shift (accepts camelCase)
- `POST /api/shifts/frontend/{id}/checkIn/` - Check in (camelCase)
- `POST /api/shifts/frontend/{id}/checkOut/` - Check out (camelCase)

### Settings
- `GET /api/v1/settings/` - Get system settings (pay rates, etc.)

## Query Parameters

### Shift Filtering
- `venue` or `venueId` - Filter by venue ID
- `staff` or `staffId` - Filter by staff user ID  
- `status` - Filter by shift status
- `start_after` / `startAfter` - Filter shifts starting after date
- `start_before` / `startBefore` - Filter shifts starting before date
- `date` - Filter by specific date

### Example Requests

#### Get all shifts for a venue
```
GET /api/shifts/?venue=1
```

#### Get current user's upcoming shifts
```
GET /api/shifts/my_shifts/?start_after=2025-01-01T00:00:00Z
```

#### Create a new shift
```
POST /api/shifts/
{
  "venue": 1,
  "staff_user": 2,
  "start_time": "2025-01-15T20:00:00Z",
  "end_time": "2025-01-16T04:00:00Z",
  "status": "scheduled"
}
```

#### Frontend-friendly shift creation (camelCase)
```
POST /api/shifts/frontend/
{
  "venue": 1,
  "staffUser": 2,
  "startTime": "2025-01-15T20:00:00Z",
  "endTime": "2025-01-16T04:00:00Z",
  "status": "scheduled"
}
```

## Response Formats

### Standard Shift Response (snake_case)
```json
{
  "id": 1,
  "venue": 1,
  "venue_details": {
    "id": 1,
    "name": "Mall Security",
    "address": "123 Main St"
  },
  "staff_user": 2,
  "staff_details": {
    "id": 2,
    "username": "john_doe",
    "first_name": "John",
    "last_name": "Doe"
  },
  "start_time": "2025-01-15T20:00:00Z",
  "end_time": "2025-01-16T04:00:00Z",
  "status": "scheduled",
  "check_in_time": null,
  "check_out_time": null
}
```

### Frontend Shift Response (camelCase)
```json
{
  "id": 1,
  "venue": 1,
  "venueDetails": {
    "id": 1,
    "name": "Mall Security",
    "address": "123 Main St"
  },
  "staffUser": 2,
  "staffDetails": {
    "id": 2,
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe"
  },
  "startTime": "2025-01-15T20:00:00Z",
  "endTime": "2025-01-16T04:00:00Z",
  "status": "scheduled",
  "checkInTime": null,
  "checkOutTime": null
}
```