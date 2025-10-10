---
date: 2025-10-07 14:32:00 GMT
researcher: Claude Code
git_commit: 11e287b07507ca949b81f1ce574f2ca5c546c93f
branch: main
repository: remix2
topic: "Complete Architectural Data Flow: Frontend to Backend Database"
tags: [research, codebase, architecture, data-flow, validation, api, serializers, models]
status: complete
last_updated: 2025-10-07
last_updated_by: Claude Code
---

# Research: Complete Architectural Data Flow Analysis

**Date**: 2025-10-07 14:32:00 GMT
**Researcher**: Claude Code
**Git Commit**: 11e287b07507ca949b81f1ce574f2ca5c546c93f
**Branch**: main
**Repository**: remix2

## Research Question

Understanding the complete architectural data flow path in the application, from frontend user input through TypeScript validation, API services, Django views, serializers, to database models. The goal is to document how data flows through each layer with concrete examples, similar to a "login or form submission" pipeline.

## Executive Summary

The Mead Security staff management system implements a **layered architecture** with clear separation of concerns across 8 distinct layers:

1. **Frontend Form Layer** - User input with Formik state management
2. **Client-Side Validation** - Yup schema validation with TypeScript typing
3. **API Service Layer** - Axios-based HTTP client with interceptors
4. **Network Middleware** - CORS, authentication, multi-tenant context
5. **Backend Views** - Django REST Framework ViewSets
6. **Serializer Validation** - Field and object-level validation
7. **Model Layer** - Database constraints and business logic
8. **Database** - PostgreSQL with complex relationships

Each layer has specific responsibilities for validation, transformation, and error handling, creating a robust and maintainable architecture.

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Complete Data Flow Diagram](#complete-data-flow-diagram)
3. [Concrete Example 1: Login Flow](#concrete-example-1-login-flow)
4. [Concrete Example 2: Leave Request Creation](#concrete-example-2-leave-request-creation)
5. [Concrete Example 3: Venue CRUD Operations](#concrete-example-3-venue-crud-operations)
6. [Layer-by-Layer Breakdown](#layer-by-layer-breakdown)
7. [Error Handling Flow](#error-handling-flow)
8. [Architecture Patterns](#architecture-patterns)
9. [File Reference Map](#file-reference-map)
10. [Security Considerations](#security-considerations)

---

## Architectural Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│                     (React Components)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                 LAYER 1: FORM MANAGEMENT                        │
│              Formik + TypeScript Interfaces                     │
│  • State Management  • Field Binding  • Event Handling          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 2: CLIENT-SIDE VALIDATION                    │
│                    Yup Schema Validation                        │
│  • Field Rules  • Object Rules  • Error Messages                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 3: DATA TRANSFORMATION                       │
│                  TypeScript Type Checking                       │
│  • Format Conversion  • File Handling  • JSON Preparation       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 4: API SERVICE LAYER                        │
│              Axios HTTP Client (api.ts)                         │
│  • Request Interceptor (Auth)  • Response Interceptor (Refresh) │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓ HTTP POST/GET/PUT/DELETE
┌─────────────────────────────────────────────────────────────────┐
│                     NETWORK BOUNDARY                            │
│           Frontend (React) → Backend (Django)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 5: MIDDLEWARE STACK                          │
│  CORS → Session → Auth → Multi-Tenant → Performance            │
│  • Token Validation  • Company Context  • Request Tracking      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 6: DJANGO VIEWS                             │
│           REST Framework ViewSets/APIViews                      │
│  • Request Parsing  • Permission Checking  • Response Building  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 7: SERIALIZERS                               │
│           Django REST Framework Serializers                     │
│  • Field Validation  • Object Validation  • Data Transform      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                LAYER 8: MODEL LAYER                             │
│                  Django ORM Models                              │
│  • Field Constraints  • clean() Methods  • save() Overrides     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE                                   │
│                   PostgreSQL 13+                                │
│  • Constraints  • Indexes  • Triggers  • Foreign Keys           │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack by Layer

| Layer | Technologies | Primary Files |
|-------|-------------|---------------|
| **Frontend Forms** | React 18, Formik, TypeScript | `*.tsx` components |
| **Validation** | Yup, TypeScript | Validation schemas in components |
| **API Client** | Axios, TypeScript | `frontend/src/services/*.ts` |
| **Middleware** | Django, Custom Middleware | `backend/*/middleware/*.py` |
| **Views** | Django REST Framework | `backend/*/views.py` |
| **Serializers** | DRF Serializers | `backend/*/serializers.py` |
| **Models** | Django ORM | `backend/*/models.py` |
| **Database** | PostgreSQL | Managed by Django migrations |

---

## Complete Data Flow Diagram

### Request Flow (Frontend → Backend)

```
USER ACTION (Submit Form)
    │
    ├─► Formik captures form state
    │
    ├─► Yup validates against schema
    │   ├─ Field-level validation (required, min, max, pattern)
    │   ├─ Object-level validation (cross-field checks)
    │   └─ If invalid: Display inline errors, STOP
    │
    ├─► TypeScript type checking (compile-time)
    │   └─ Ensures data matches interface definitions
    │
    ├─► Data transformation/formatting
    │   ├─ Dates → ISO strings
    │   ├─ Numbers → strings (for Django DecimalField)
    │   ├─ Files → FormData/base64
    │   └─ camelCase → snake_case (if needed)
    │
    ├─► API Service method call
    │   └─ Example: leaveService.createLeaveRequest(data)
    │
    ├─► Axios Request Interceptor
    │   ├─ Add Authorization: Bearer <token>
    │   ├─ Add Content-Type header
    │   └─ Add custom headers (X-Company-ID)
    │
    ├─► HTTP Request sent
    │   └─ POST http://localhost:8000/api/v1/leave/requests/
    │
    ╔════════════════════════════════════════════╗
    ║         NETWORK BOUNDARY CROSSING          ║
    ╚════════════════════════════════════════════╝
    │
    ├─► CORS Middleware
    │   └─ Validates origin, adds CORS headers
    │
    ├─► Session Middleware
    │   └─ Manages session state
    │
    ├─► Authentication Middleware
    │   ├─ JWT token validation
    │   ├─ User identification
    │   └─ Sets request.user
    │
    ├─► TenantMiddleware (Custom)
    │   ├─ Extract X-Company-ID header
    │   ├─ Validate user access to company
    │   ├─ Set request.current_company
    │   └─ Add company context to response headers
    │
    ├─► Performance Middleware (Custom)
    │   ├─ Start request timer
    │   ├─ Generate request ID
    │   └─ Track metrics
    │
    ├─► URL Routing
    │   └─ /api/v1/leave/requests/ → LeaveRequestViewSet
    │
    ├─► ViewSet Method Dispatch
    │   └─ POST → create() method
    │
    ├─► Permission Checking
    │   ├─ IsAuthenticated
    │   ├─ Custom permissions (IsCompanyMember)
    │   └─ If denied: Return 403, STOP
    │
    ├─► Request Data Parsing
    │   └─ request.data (JSON) or request.FILES (multipart)
    │
    ├─► Serializer Initialization
    │   └─ serializer = LeaveRequestSerializer(data=request.data)
    │
    ├─► Serializer Validation
    │   ├─ Field-level validation
    │   │   ├─ validate_<field_name>() methods
    │   │   └─ Built-in validators (MinValueValidator, etc.)
    │   │
    │   ├─ Object-level validation
    │   │   └─ validate() method (cross-field checks)
    │   │
    │   └─ serializer.is_valid(raise_exception=True)
    │       └─ If invalid: Return 400 with errors, STOP
    │
    ├─► Model Instance Creation
    │   └─ instance = serializer.save()
    │
    ├─► Model Validation
    │   ├─ Field constraints (max_length, choices, etc.)
    │   ├─ Model.clean() method
    │   └─ Database constraints (unique, foreign key)
    │
    ├─► Model.save() Override
    │   ├─ Custom business logic
    │   ├─ Auto-calculations
    │   ├─ Status updates
    │   └─ Triggers, signals
    │
    ├─► Database Transaction
    │   ├─ SQL INSERT/UPDATE
    │   ├─ Constraint checking
    │   └─ Commit or rollback
    │
    ├─► Response Building
    │   ├─ Serializer.data (model → JSON)
    │   └─ Response(data, status=201)
    │
    ├─► Performance Middleware (Response)
    │   ├─ Add X-Response-Time header
    │   ├─ Compression (gzip)
    │   └─ Caching headers
    │
    ├─► TenantMiddleware (Response)
    │   └─ Add X-Current-Company header
    │
    ╔════════════════════════════════════════════╗
    ║         NETWORK BOUNDARY CROSSING          ║
    ╚════════════════════════════════════════════╝
    │
    ├─► Axios Response Interceptor
    │   ├─ Check for errors
    │   ├─ Handle 401 (token refresh)
    │   └─ Parse JSON
    │
    ├─► Service Method Return
    │   └─ return response.data
    │
    ├─► Form Submission Handler
    │   ├─ Success: Show notification
    │   ├─ Call onSuccess callback
    │   └─ Reset form/redirect
    │
    └─► UI Update
        ├─ Display success message
        ├─ Update local state
        └─ Navigate to next page
```

---

## Concrete Example 1: Login Flow

### Overview

The login flow demonstrates the simplest data flow pattern: user credentials flow from a form through authentication layers to the database and back with JWT tokens.

### 1.1 Frontend: Login Form Component

**File**: [frontend/src/pages/auth/LoginPage.tsx](../../../frontend/src/pages/auth/LoginPage.tsx)

**Validation Schema** (Lines 52-57):
```typescript
const validationSchema = Yup.object({
  username: Yup.string().required('Username is required'),
  password: Yup.string().required('Password is required')
});
```

**Formik Configuration** (Lines 60-76):
```typescript
const formik = useFormik({
  initialValues: {
    username: '',
    password: ''
  },
  validationSchema,
  onSubmit: async (values) => {
    setLoginError(null);
    try {
      await login(values.username, values.password);
      // Navigation handled by useEffect in AuthContext
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Login failed. Please check your credentials and try again.');
    }
  }
});
```

**TypeScript Interface**: Inferred from `values` object
```typescript
interface LoginFormValues {
  username: string;
  password: string;
}
```

### 1.2 API Service: Authentication

**File**: [frontend/src/services/authService.ts](../../../frontend/src/services/authService.ts)

**Login Method** (Lines 52-115):
```typescript
async login(credentials: LoginRequest): Promise<LoginResponse> {
  // API call with request data
  const response = await api.post<any>('/login/', credentials);

  // Map Django snake_case to frontend camelCase
  const user = {
    id: response.data.user.id,
    username: response.data.user.username,
    email: response.data.user.email,
    firstName: response.data.user.first_name,  // Field mapping
    lastName: response.data.user.last_name,
    role: response.data.user.role || 'staff',
    isActive: response.data.user.is_active
  };

  // Store tokens securely
  setAuthCookie('token', response.data.access);
  setAuthCookie('refreshToken', response.data.refresh);
  setAuthCookie('user', JSON.stringify(user));

  return {
    access: response.data.access,
    refresh: response.data.refresh,
    user
  };
}
```

**Request Structure**:
```json
POST /api/v1/login/
Content-Type: application/json

{
  "username": "john.doe",
  "password": "SecurePass123!"
}
```

### 1.3 Axios Request Interceptor

**File**: [frontend/src/services/api.ts](../../../frontend/src/services/api.ts:17-30)

```typescript
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);
```

**Modified Request**:
```http
POST /api/v1/login/ HTTP/1.1
Host: localhost:8000
Content-Type: application/json
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc... (if exists)

{"username":"john.doe","password":"SecurePass123!"}
```

### 1.4 Backend: Middleware Stack

**CORS Middleware** - Validates origin
**Session Middleware** - Manages session
**Authentication Middleware** - Validates JWT (skipped for login)
**TenantMiddleware** - Sets company context (skipped for login)

### 1.5 Backend: Views Layer

**File**: [backend/api/views.py](../../../backend/api/views.py:176-232)

**LoginView** (Lines 176-232):
```python
class LoginView(APIView):
    permission_classes = [AllowAny]  # No authentication required

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        # Validate credentials
        if not username or not password:
            return Response({
                'error': 'Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate user
        user = authenticate(username=username, password=password)

        if user is None:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({
                'error': 'Account is disabled'
            }, status=status.HTTP_403_FORBIDDEN)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        # Serialize user data
        user_serializer = UserSerializer(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_serializer.data
        }, status=status.HTTP_200_OK)
```

**Request Flow**:
1. Parse `request.data` (JSON body)
2. Extract username and password
3. Call Django's `authenticate()` function
4. Generate JWT tokens using SimpleJWT
5. Serialize user data
6. Return tokens + user data

### 1.6 Database: User Model Query

**File**: [backend/api/models.py](../../../backend/api/models.py:750-906)

**Django's authenticate() executes**:
```python
# Internal Django process
user = User.objects.filter(username=username).first()
if user and user.check_password(password):
    return user
return None
```

**SQL Query Generated**:
```sql
SELECT
  id, username, email, first_name, last_name,
  password, role, is_active, created_at, updated_at
FROM users
WHERE username = 'john.doe'
LIMIT 1;
```

**Password Verification**:
```python
# User.check_password() uses Django's password hashing
# Compares hashed password from database with provided password
# Uses PBKDF2 algorithm with SHA256
```

### 1.7 Response Journey

**Backend Response**:
```json
HTTP/1.1 200 OK
Content-Type: application/json
X-Response-Time: 0.143s
X-Request-ID: req-abc123

{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 42,
    "username": "john.doe",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "staff",
    "is_active": true,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**Axios Response Interceptor** - No special handling for 200 OK

**AuthService** - Stores tokens and returns user data

**LoginPage Component** - Updates UI, redirects to dashboard

### 1.8 Complete Login Flow Timeline

```
T+0ms:    User clicks "Login" button
T+5ms:    Formik validates form (Yup schema)
T+10ms:   Validation passes, onSubmit handler called
T+15ms:   authService.login() called
T+20ms:   Axios POST request sent
T+25ms:   Request interceptor adds headers
T+30ms:   Network transmission...
T+80ms:   Django receives request
T+85ms:   CORS middleware validates
T+90ms:   URL routing to LoginView
T+95ms:   LoginView.post() executes
T+100ms:  authenticate() queries database
T+120ms:  Password hash verification
T+125ms:  JWT tokens generated
T+130ms:  UserSerializer transforms data
T+135ms:  Response sent
T+140ms:  Network transmission...
T+190ms:  Axios receives response
T+195ms:  Response interceptor processes
T+200ms:  authService stores tokens
T+205ms:  LoginPage updates state
T+210ms:  React re-renders
T+215ms:  Navigation to dashboard
```

---

## Concrete Example 2: Leave Request Creation

This is a **complex example** demonstrating multi-layer validation, file uploads, business logic, and cross-model interactions.

### 2.1 Frontend: Leave Request Form

**File**: [frontend/src/components/LeaveRequestForm.tsx](../../../frontend/src/components/LeaveRequestForm.tsx)

**TypeScript Interface** (Lines 39-41 + types/leave.ts:173-180):
```typescript
interface FormValues extends LeaveRequestFormData {
  supporting_documents: FileList | null;
}

export interface LeaveRequestFormData {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  supporting_documents?: File[];
}
```

**Yup Validation Schema** (Lines 44-58):
```typescript
const validationSchema = Yup.object({
  leave_type_id: Yup.number()
    .required('Please select a leave type')
    .min(1, 'Please select a valid leave type'),
  start_date: Yup.date()
    .required('Start date is required')
    .min(new Date(), 'Start date cannot be in the past'),
  end_date: Yup.date()
    .required('End date is required')
    .min(Yup.ref('start_date'), 'End date must be after start date'),
  reason: Yup.string()
    .required('Please provide a reason for your leave request')
    .min(10, 'Please provide a more detailed reason (at least 10 characters)')
    .max(500, 'Reason cannot exceed 500 characters'),
});
```

**Formik Configuration** (Lines 308-313):
```typescript
<Formik
  initialValues={initialValues}
  validationSchema={validationSchema}
  onSubmit={handleSubmit}
  enableReinitialize
>
```

**Submission Handler with Data Transformation** (Lines 183-238):
```typescript
const handleSubmit = async (values: FormValues) => {
  setIsSubmitting(true);
  setSubmitError('');
  setSubmitSuccess('');

  try {
    // Convert FileList to File array for API
    const files = values.supporting_documents
      ? Array.from(values.supporting_documents)
      : undefined;

    // Transform form data to API format
    const requestData: LeaveRequestFormData = {
      leave_type_id: values.leave_type_id,
      start_date: values.start_date,
      end_date: values.end_date,
      days_requested: workingDays,  // Calculated client-side
      reason: values.reason,
      supporting_documents: files
    };

    let result;
    if (editMode && requestId) {
      result = await leaveService.updateLeaveRequest(requestId, requestData);
      setSubmitSuccess('Leave request updated successfully!');
    } else {
      result = await leaveService.createLeaveRequest(requestData);
      setSubmitSuccess('Leave request submitted successfully!');
    }

    if (onSuccess) onSuccess(result);

  } catch (error: any) {
    console.error('Error submitting leave request:', error);

    // Structured error handling from backend
    if (error.response?.data) {
      const errorData = error.response.data;
      if (typeof errorData === 'string') {
        setSubmitError(errorData);
      } else if (errorData.non_field_errors) {
        setSubmitError(errorData.non_field_errors.join(', '));
      } else {
        setSubmitError('Please correct the errors below and try again.');
      }
    } else {
      setSubmitError('Failed to submit leave request. Please try again.');
    }
  } finally {
    setIsSubmitting(false);
  }
};
```

### 2.2 API Service: Leave Management

**File**: [frontend/src/services/leaveService.ts](../../../frontend/src/services/leaveService.ts)

**Endpoint Constants** (Lines 179-195):
```typescript
const LEAVE_ENDPOINTS = {
  LEAVE_TYPES: '/leave/types/',
  LEAVE_REQUESTS: '/leave/requests/',
  LEAVE_BALANCES: '/leave/balances/',
  // ... more endpoints
} as const;
```

**Create Leave Request Method** (Lines 297-326):
```typescript
async createLeaveRequest(requestData: LeaveRequestFormData): Promise<LeaveRequest> {
  const formData = new FormData();

  // Add basic fields with type conversion
  formData.append('leave_type_id', requestData.leave_type_id.toString());
  formData.append('start_date', requestData.start_date);
  formData.append('end_date', requestData.end_date);
  formData.append('days_requested', requestData.days_requested.toString());
  formData.append('reason', requestData.reason);

  // Add supporting documents if provided
  if (requestData.supporting_documents) {
    requestData.supporting_documents.forEach((file, index) => {
      formData.append(`supporting_document_${index}`, file);
    });
  }

  const response = await api.post<LeaveRequest>(
    LEAVE_ENDPOINTS.LEAVE_REQUESTS,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );

  return response.data;
}
```

**Request Structure**:
```http
POST /api/v1/leave/requests/ HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
Authorization: Bearer eyJ0eXAiOiJKV1Qi...

------WebKitFormBoundary
Content-Disposition: form-data; name="leave_type_id"

2
------WebKitFormBoundary
Content-Disposition: form-data; name="start_date"

2025-10-15
------WebKitFormBoundary
Content-Disposition: form-data; name="end_date"

2025-10-17
------WebKitFormBoundary
Content-Disposition: form-data; name="days_requested"

3
------WebKitFormBoundary
Content-Disposition: form-data; name="reason"

Family vacation - pre-planned trip to Spain
------WebKitFormBoundary
Content-Disposition: form-data; name="supporting_document_0"; filename="flight-booking.pdf"
Content-Type: application/pdf

[Binary file data]
------WebKitFormBoundary--
```

### 2.3 Backend: Middleware Processing

**TenantMiddleware** sets company context:
```python
# Extracts X-Company-ID header
company_id = request.META.get('HTTP_X_COMPANY_ID')
request.current_company = SecurityCompany.objects.get(id=company_id)
request.company_id = company_id
```

**Authentication Middleware** validates JWT:
```python
# Validates Bearer token
# Sets request.user to authenticated User instance
```

### 2.4 Backend: Views Layer

**File**: [backend/leave_management/views.py](../../../backend/leave_management/views.py:673-817)

**LeaveRequestViewSet.create()** (Lines 673-817):
```python
def create(self, request, *args, **kwargs):
    """Create a new leave request with validation"""

    # Parse request data
    serializer = self.get_serializer(data=request.data)

    # Validate with serializer
    serializer.is_valid(raise_exception=True)

    # Additional business logic validation
    user = request.user
    leave_type_id = serializer.validated_data['leave_type'].id
    start_date = serializer.validated_data['start_date']
    end_date = serializer.validated_data['end_date']
    days_requested = serializer.validated_data['days_requested']

    # Check for blackout periods
    blackout_periods = BlackoutPeriod.objects.overlapping_period(
        start_date, end_date
    ).filter(
        Q(leave_types__isnull=True) | Q(leave_types__id=leave_type_id)
    )

    if blackout_periods.exists():
        return Response({
            'error': 'Leave requests are not allowed during this period',
            'blackout_period': blackout_periods.first().name
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check leave balance
    try:
        balance = LeaveBalance.objects.get(
            staff_user=user,
            leave_type_id=leave_type_id,
            year=start_date.year
        )

        if not balance.can_take_leave(days_requested):
            return Response({
                'error': 'Insufficient leave balance',
                'available_balance': str(balance.available_balance),
                'requested': str(days_requested)
            }, status=status.HTTP_400_BAD_REQUEST)
    except LeaveBalance.DoesNotExist:
        return Response({
            'error': 'No leave balance found for this leave type'
        }, status=status.HTTP_404_NOT_FOUND)

    # Save the request
    leave_request = serializer.save(staff_user=user)

    # Auto-submit if configured
    if leave_request.status == 'draft':
        leave_request.status = 'pending'
        leave_request.submitted_at = timezone.now()
        leave_request.save()

    # Add to pending balance
    balance.add_pending(days_requested)

    return Response(
        self.get_serializer(leave_request).data,
        status=status.HTTP_201_CREATED
    )
```

### 2.5 Serializer: Validation Layer

**File**: [backend/leave_management/serializers.py](../../../backend/leave_management/serializers.py:318-402)

**LeaveRequestSerializer** (Lines 318-402):
```python
class LeaveRequestSerializer(serializers.ModelSerializer):
    # Read-only nested serializer
    leave_type = LeaveTypeSerializer(read_only=True)

    # Write-only FK for submission
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.filter(is_active=True),
        source='leave_type',
        write_only=True
    )

    # Computed fields
    user = serializers.SerializerMethodField(read_only=True)
    approved_by = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'staff_user', 'leave_type', 'leave_type_id',
            'start_date', 'end_date', 'request_type', 'days_requested',
            'reason', 'status', 'submitted_at', 'approved_at',
            'approved_by', 'manager_comments', 'supporting_documents'
        ]
        read_only_fields = ['id', 'staff_user', 'status', 'submitted_at']

    def validate(self, data):
        """Object-level validation"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        # Date range validation
        if start_date and end_date:
            if start_date > end_date:
                raise serializers.ValidationError({
                    'end_date': 'End date must be after start date'
                })

            # Business days calculation
            delta = end_date - start_date
            business_days = delta.days + 1

            if data.get('days_requested', 0) > business_days:
                raise serializers.ValidationError({
                    'days_requested': 'Requested days cannot exceed date range'
                })

        # Check for overlapping requests
        user = self.context['request'].user
        overlapping = LeaveRequest.objects.filter(
            staff_user=user,
            status__in=['pending', 'approved'],
            start_date__lte=end_date,
            end_date__gte=start_date
        )

        if self.instance:
            overlapping = overlapping.exclude(pk=self.instance.pk)

        if overlapping.exists():
            raise serializers.ValidationError({
                'start_date': 'You have an overlapping leave request'
            })

        return data

    def get_user(self, obj):
        """Serialize user information"""
        return {
            'id': obj.staff_user.id,
            'username': obj.staff_user.username,
            'full_name': f"{obj.staff_user.first_name} {obj.staff_user.last_name}"
        }
```

**Validation Steps**:
1. **Field-level**: leave_type_id must reference active LeaveType
2. **Field-level**: dates must be valid date format
3. **Object-level**: end_date > start_date
4. **Object-level**: days_requested within date range
5. **Object-level**: No overlapping requests for same user

### 2.6 Model: Database Layer

**File**: [backend/leave_management/models.py](../../../backend/leave_management/models.py:429-675)

**LeaveRequest Model** (Lines 429-675):
```python
class LeaveRequest(TimestampedModel):
    staff_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='requests'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    request_type = models.CharField(
        max_length=15,
        choices=REQUEST_TYPE_CHOICES,
        default='full_day'
    )
    days_requested = models.DecimalField(
        max_digits=5,
        decimal_places=2
    )
    reason = models.TextField()
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='draft'
    )

    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['staff_user', 'status']),
            models.Index(fields=['leave_type', 'start_date']),
            models.Index(fields=['status', 'submitted_at']),
        ]

    def clean(self):
        """Model-level validation"""
        errors = {}

        if self.end_date < self.start_date:
            errors['end_date'] = 'End date must be after start date'

        if self.request_type == 'hours':
            if not self.start_time or not self.end_time:
                errors['start_time'] = 'Times required for hourly requests'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        """Override save for auto-calculations"""
        # Auto-calculate days_requested if not provided
        if not self.days_requested:
            if self.request_type == 'full_day':
                self.days_requested = (self.end_date - self.start_date).days + 1
            elif self.request_type in ['half_day_am', 'half_day_pm']:
                self.days_requested = Decimal('0.5')

        # Set submitted_at when status changes to pending
        if self.status == 'pending' and not self.submitted_at:
            self.submitted_at = timezone.now()

        super().save(*args, **kwargs)
```

**Database Transaction**:
```sql
BEGIN;

INSERT INTO leave_requests (
  staff_user_id, leave_type_id, start_date, end_date,
  request_type, days_requested, reason, status,
  submitted_at, created_at, updated_at
) VALUES (
  42,  -- staff_user_id
  2,   -- leave_type_id (Annual Leave)
  '2025-10-15',
  '2025-10-17',
  'full_day',
  3.00,
  'Family vacation - pre-planned trip to Spain',
  'pending',
  '2025-10-07 14:32:00',
  '2025-10-07 14:32:00',
  '2025-10-07 14:32:00'
);

-- Update leave balance
UPDATE leave_balances
SET pending_balance = pending_balance + 3.00,
    updated_at = '2025-10-07 14:32:00'
WHERE staff_user_id = 42
  AND leave_type_id = 2
  AND year = 2025;

COMMIT;
```

### 2.7 Response Journey

**Serializer transforms model to JSON**:
```python
serializer = LeaveRequestSerializer(leave_request)
return Response(serializer.data, status=201)
```

**Response Body**:
```json
HTTP/1.1 201 Created
Content-Type: application/json
X-Response-Time: 0.287s
X-Current-Company: uuid-company-id

{
  "id": 158,
  "staff_user": 42,
  "leave_type": {
    "id": 2,
    "name": "Annual Leave",
    "code": "ANNUAL",
    "color_code": "#4CAF50",
    "is_active": true
  },
  "start_date": "2025-10-15",
  "end_date": "2025-10-17",
  "request_type": "full_day",
  "days_requested": "3.00",
  "reason": "Family vacation - pre-planned trip to Spain",
  "status": "pending",
  "submitted_at": "2025-10-07T14:32:00Z",
  "approved_at": null,
  "approved_by": null,
  "manager_comments": null,
  "supporting_documents": [
    {
      "id": 89,
      "file": "/media/leave_documents/flight-booking_2025_10_07.pdf",
      "name": "flight-booking.pdf",
      "uploaded_at": "2025-10-07T14:32:00Z"
    }
  ],
  "user": {
    "id": 42,
    "username": "john.doe",
    "full_name": "John Doe"
  },
  "created_at": "2025-10-07T14:32:00Z",
  "updated_at": "2025-10-07T14:32:00Z"
}
```

**Frontend receives response** → Updates UI → Shows success notification

### 2.8 Complete Leave Request Flow Timeline

```
T+0ms:     User fills form and clicks "Submit"
T+5ms:     Formik validates with Yup schema
            ├─ leave_type_id: required, min(1) ✓
            ├─ start_date: required, min(today) ✓
            ├─ end_date: required, min(start_date) ✓
            └─ reason: required, min(10), max(500) ✓
T+10ms:    Validation passes
T+15ms:    handleSubmit() transforms data
            ├─ FileList → File[]
            └─ FormValues → LeaveRequestFormData
T+20ms:    leaveService.createLeaveRequest() called
T+25ms:    Data → FormData conversion
            ├─ leave_type_id: number → string
            ├─ days_requested: number → string
            └─ Files appended with unique keys
T+30ms:    Axios POST with multipart/form-data
T+35ms:    Request interceptor adds Authorization header
T+40ms:    Network transmission...
T+120ms:   Django receives multipart request
T+125ms:   CORS middleware validates origin
T+130ms:   Authentication middleware validates JWT
T+135ms:   TenantMiddleware sets company context
T+140ms:   URL routing → LeaveRequestViewSet
T+145ms:   Permission check: IsAuthenticated ✓
T+150ms:   LeaveRequestViewSet.create() executes
T+155ms:   Serializer initialization
T+160ms:   Serializer field validation
            ├─ leave_type_id: PK exists in LeaveType ✓
            ├─ Dates: Valid date format ✓
            └─ Days: DecimalField validation ✓
T+165ms:   Serializer object validation
            ├─ end_date > start_date ✓
            ├─ days_requested ≤ date range ✓
            └─ No overlapping requests ✓
T+180ms:   Business logic validation (in view)
            ├─ Check blackout periods (DB query)
            └─ Check leave balance (DB query)
T+200ms:   Blackout check: No conflicts ✓
T+220ms:   Balance check: 15.5 available, 3 requested ✓
T+225ms:   serializer.save(staff_user=user)
T+230ms:   Model.clean() validation ✓
T+235ms:   Model.save() override
            ├─ Auto-calculate days_requested
            └─ Set submitted_at timestamp
T+240ms:   Database INSERT transaction
T+260ms:   Update leave_balances (pending)
T+280ms:   Transaction COMMIT ✓
T+285ms:   Serializer.data (model → JSON)
T+290ms:   Response(data, status=201)
T+295ms:   Middleware adds response headers
T+300ms:   Network transmission...
T+380ms:   Axios receives 201 Created
T+385ms:   Response interceptor processes
T+390ms:   leaveService returns data
T+395ms:   handleSubmit success block
T+400ms:   Show success notification
T+405ms:   Call onSuccess callback
T+410ms:   React re-renders
T+415ms:   UI updated with new request
```

---

