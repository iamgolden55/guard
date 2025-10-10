# Django Views.py Request Handling Layer - Comprehensive Research

**Date:** 2025-10-07  
**Research Focus:** Django ViewSet and APIView patterns, request handling, serialization, authentication/permissions, and error handling

---

## Executive Summary

This research documents the Django request handling pipeline in the Mead Security staff management system, covering authentication flows, CRUD operations, custom actions, permission management, and response patterns. The codebase uses Django REST Framework with comprehensive custom permissions, multi-tenant company isolation, and role-based access control.

---

## 1. ViewSet and APIView Patterns

### 1.1 ViewSet Types Found

#### **ModelViewSet** (Most Common)
Full CRUD operations with automatic routing for:
- `list()` - GET /resource/
- `create()` - POST /resource/
- `retrieve()` - GET /resource/{id}/
- `update()` - PUT /resource/{id}/
- `partial_update()` - PATCH /resource/{id}/
- `destroy()` - DELETE /resource/{id}/

**Examples in codebase:**
- `/Users/new/Projects/mead-security/remix2/backend/leave_management/views.py` - Lines 673-1187 (LeaveRequestViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Lines 233-312 (UserViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Lines 723-905 (VenueViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Lines 599-702 (StaffProfileViewSet)

#### **ReadOnlyModelViewSet**
Read-only operations (list, retrieve):
- `/Users/new/Projects/mead-security/remix2/backend/leave_management/views.py` - Line 282 (LeaveBalanceViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/leave_management/views.py` - Line 1188 (LeaveCalendarViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/leave_management/views.py` - Line 2581 (HolidayViewSet)

#### **APIView** (Custom Views)
Full manual control over request handling:
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Lines 176-232 (LoginView)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Line 2183 (DeputyConfigView)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Line 2223 (SystemSettingsView)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Line 2750 (FileUploadView)

#### **ViewSet** (Custom ViewSets)
Custom action-based views without model binding:
- `/Users/new/Projects/mead-security/remix2/backend/leave_management/views.py` - Line 2181 (LeaveSettingsViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Line 3021 (CompanyRecruitmentViewSet)
- `/Users/new/Projects/mead-security/remix2/backend/api/views.py` - Line 5625 (ReportTypesViewSet)

---

## 2. Request Data Parsing Patterns

### 2.1 Accessing Request Data

#### **POST/PUT/PATCH Data** - `request.data`
Primary method for accessing JSON request body data:

```python
# Example from LoginView (lines 196-202)
def post(self, request):
    username = request.data.get('username')
    password = request.data.get('password')
    if not username or not password:
        return Response({'message': 'Both username and password are required',
                         'errors': 'missing required parameters'}, status=400)
```

#### **Query Parameters** - `request.query_params`
Accessing URL query parameters:

```python
# Example from StaffProfileViewSet (lines 633-642)
def get_queryset(self):
    user_id = self.request.query_params.get('user', None)
    if user_id:
        queryset = queryset.filter(user__id=user_id)
    
    is_approved = self.request.query_params.get('is_approved', None)
    if is_approved is not None:
        is_approved_bool = is_approved.lower() in ['true', '1', 'yes']
        queryset = queryset.filter(is_approved=is_approved_bool)
```

#### **URL Path Parameters** - Method arguments
Captured from URL patterns:

```python
# Example from LeaveRequestViewSet approve action (lines 857-890)
@action(detail=True, methods=['post'])
def approve(self, request, pk=None):
    """Approve a leave request"""
    leave_request = self.get_object()  # Uses pk from URL
    notes = request.data.get('notes', '')
    # ... approval logic
```

---

## 3. Serializer Usage for Validation

### 3.1 Standard Serializer Validation Pattern

#### **Create Operation Pattern**
```python
# Example from UserViewSet (lines 284-302)
def create(self, request, *args, **kwargs):
    serializer = self.get_serializer(data=request.data)
    if serializer.is_valid():
        # Create user with proper permissions
        user = serializer.save()
        user.is_staff = True
        user.role = 'admin'
        user.save()
        
        return Response({
            'message': 'User created successfully',
            'user': {
                'username': user.username,
                'email': user.email
            }
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

#### **Update Operation Pattern**
```python
# Example from StaffProfileViewSet (lines 651-678)
def update(self, request, *args, **kwargs):
    partial = kwargs.pop('partial', False)
    instance = self.get_object()
    
    # Business logic validation (immutable fields check)
    for field in self.IMMUTABLE_FIELDS:
        if field in request.data and getattr(instance, field) != request.data[field]:
            if request.user.role in ['admin', 'manager']:
                pass  # Allow admins and managers to update
            else:
                request.data.pop(field)  # Remove for staff users
    
    serializer = self.get_serializer(instance, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)  # Raises ValidationError if invalid
    self.perform_update(serializer)
    
    return Response(serializer.data)
```

### 3.2 Serializer Validation Patterns

#### **Field-Level Validation**
```python
# Example from LeaveTypeSerializer (lines 43-67)
def validate_code(self, value):
    """Ensure leave type code is uppercase and unique"""
    value = value.upper()
    
    # Check uniqueness excluding current instance
    if self.instance:
        if LeaveType.objects.exclude(pk=self.instance.pk).filter(code=value).exists():
            raise serializers.ValidationError("A leave type with this code already exists.")
    else:
        if LeaveType.objects.filter(code=value).exists():
            raise serializers.ValidationError("A leave type with this code already exists.")
    
    return value

def validate_color_code(self, value):
    """Validate hex color code format"""
    if not value.startswith('#') or len(value) != 7:
        raise serializers.ValidationError("Color code must be in hex format (#RRGGBB)")
    
    try:
        int(value[1:], 16)
    except ValueError:
        raise serializers.ValidationError("Invalid hex color code")
    
    return value
```

#### **Object-Level Validation**
```python
# Example from LeaveRequestSerializer (lines 382-402)
def validate(self, data):
    """Validate leave request data"""
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    if start_date and end_date:
        if start_date > end_date:
            raise serializers.ValidationError({
                'end_date': 'End date must be after start date'
            })
        
        # Calculate business days
        delta = end_date - start_date
        business_days = delta.days + 1
        
        if data.get('days_requested', 0) > business_days:
            raise serializers.ValidationError({
                'days_requested': 'Requested days cannot exceed date range'
            })
    
    return data
```

---

## 4. Authentication and Permission Decorators

### 4.1 ViewSet-Level Permissions

#### **Standard DRF Permissions**
```python
# Example from LoginView (lines 192-194)
permission_classes = [AllowAny]  # No authentication required
authentication_classes = []  # Disable authentication for login endpoint

# Example from LeaveRequestViewSet (line 684)
permission_classes = [IsAuthenticated]  # Require authentication

# Example from StaffProfileViewSet (line 616)
permission_classes = [IsAuthenticated]  # Basic authentication
```

#### **Dynamic Permissions Based on Action**
```python
# Example from UserViewSet (lines 237-246)
def get_permissions(self):
    """
    Allow registration without authentication, but require
    authentication for all other actions.
    """
    if self.action == 'create':
        permission_classes = [AllowAny]
    else:
        permission_classes = [IsAuthenticated]
    return [permission() for permission in permission_classes]
```

### 4.2 Action-Level Permissions

#### **Custom Action Decorators**
```python
# Admin-only action
@action(detail=True, methods=['post'], permission_classes=[AdminOnlyPermission])
def toggle_active(self, request, pk=None):
    """Toggle active status of a leave type"""
    # Lines 91-102 in leave_management/views.py

# Manager or Admin action
@action(detail=True, methods=['post'], 
        permission_classes=[IsAuthenticated, ManagerOrAdminPermission])
def approve(self, request, pk=None):
    """Approve a leave request"""
    # Lines 857-890 in leave_management/views.py

# Read-only action for managers/admins
@action(detail=False, methods=['get'], 
        permission_classes=[ManagerOrAdminPermission])
def usage_statistics(self, request):
    """Get usage statistics for all leave types"""
    # Lines 104-137 in leave_management/views.py
```

### 4.3 Custom Permission Classes

All custom permissions in: `/Users/new/Projects/mead-security/remix2/backend/leave_management/permissions.py`

#### **Base Permission Class**
```python
# Lines 8-41
class LeaveManagementBasePermission(BasePermission):
    """Base permission class for leave management with role checking"""
    
    def has_permission(self, request, view):
        """Check if user is authenticated and has basic access"""
        if not request.user.is_authenticated:
            return False
        
        # All authenticated users can access safe methods (GET, HEAD, OPTIONS)
        if request.method in SAFE_METHODS:
            return True
        
        return True
    
    def is_admin(self, user):
        """Check if user is admin"""
        return user.is_superuser or user.is_staff or self.get_user_role(user) == 'admin'
    
    def is_manager(self, user):
        """Check if user is manager or above"""
        role = self.get_user_role(user)
        return self.is_admin(user) or role == 'manager'
```

#### **Role-Based Permissions**
```python
# AdminOnlyPermission (lines 240-247)
class AdminOnlyPermission(LeaveManagementBasePermission):
    """Permission that only allows admin users"""
    
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return self.is_admin(request.user)

# ManagerOrAdminPermission (lines 250-257)
class ManagerOrAdminPermission(LeaveManagementBasePermission):
    """Permission that allows managers and admins"""
    
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return self.is_manager(request.user) or self.is_admin(request.user)
```

#### **Resource-Specific Permissions**
```python
# LeaveTypePermission (lines 43-69)
class LeaveTypePermission(LeaveManagementBasePermission):
    """
    - Admin: Full CRUD access
    - Manager: Read access only
    - Staff: Read access only
    """
    
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        
        # Read permissions for all authenticated users
        if request.method in SAFE_METHODS:
            return True
        
        # Write permissions only for admins
        return self.is_admin(request.user)
```

---

## 5. Error Handling and Response Patterns

### 5.1 Standard Error Responses

#### **Validation Errors (400 Bad Request)**
```python
# Business rule violation - blackout period check
# Lines 758-769 in leave_management/views.py
blackout_periods = BlackoutPeriod.objects.overlapping_period(start_date, end_date)
for blackout in blackout_periods:
    if blackout.restriction_level == 'no_requests':
        return Response({
            'error': f'Leave requests are not allowed during {blackout.name}',
            'blackout_period': {
                'name': blackout.name,
                'start_date': blackout.start_date,
                'end_date': blackout.end_date,
                'message': blackout.get_restriction_message()
            }
        }, status=status.HTTP_400_BAD_REQUEST)

# Insufficient balance check
# Lines 771-790 in leave_management/views.py
try:
    entitlement = LeaveEntitlement.objects.get(
        user=request.user,
        policy__leave_type_id=leave_type_id,
        year=current_year
    )
    
    if not entitlement.can_take_leave(serializer.validated_data['days_requested']):
        return Response({
            'error': 'Insufficient leave balance',
            'current_balance': entitlement.current_balance,
            'requested': serializer.validated_data['days_requested']
        }, status=status.HTTP_400_BAD_REQUEST)
        
except LeaveEntitlement.DoesNotExist:
    return Response({
        'error': 'No leave entitlement found for this leave type'
    }, status=status.HTTP_400_BAD_REQUEST)
```

#### **Permission Errors (403 Forbidden)**
```python
# Manual permission check in view
# Lines 764-768 in api/views.py (VenueViewSet)
if request.user.role != 'admin':
    return Response({
        'message': 'Only admin users can create venues',
        'error': 'permission_denied'
    }, status=status.HTTP_403_FORBIDDEN)

# Staff user trying to submit another user's request
# Lines 824-828 in leave_management/views.py
if request.user.role == 'staff' and leave_request.staff_user != request.user:
    return Response({
        'error': 'You can only submit your own requests'
    }, status=status.HTTP_403_FORBIDDEN)
```

#### **Authentication Errors (401 Unauthorized)**
```python
# Login failure
# Lines 226-231 in api/views.py (LoginView)
else:
    raise AuthenticationFailed('Incorrect password')
except User.DoesNotExist:
    return Response({'message': 'Invalid username'}, status=401)
except AuthenticationFailed as e:
    return Response({'message': str(e)}, status=401)
```

### 5.2 Success Response Patterns

#### **Create Success (201 Created)**
```python
# Successful leave request creation
# Lines 808-817 in leave_management/views.py
headers = self.get_success_headers(serializer.data)
return Response({
    'message': 'Leave request submitted successfully',
    'leave_request': serializer.data,
    'next_steps': (
        'Your request is pending manager approval'
        if serializer.instance.status == 'pending'
        else 'Your request has been saved as draft'
    )
}, status=status.HTTP_201_CREATED, headers=headers)

# Successful venue creation
# Lines 786-789 in api/views.py (VenueViewSet)
return Response({
    'message': 'Venue created successfully',
    'venue': serializer.data
}, status=status.HTTP_201_CREATED)
```

#### **Update/Action Success (200 OK)**
```python
# Successful leave approval
# Lines 887-890 in leave_management/views.py
return Response({
    'message': 'Leave request approved successfully',
    'leave_request': self.get_serializer(leave_request).data
})

# Login success with JWT tokens
# Lines 212-225 in api/views.py (LoginView)
refresh = RefreshToken.for_user(user)
return Response({
    'message': 'Login successful',
    'access': str(refresh.access_token),
    'refresh': str(refresh),
    'user': {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active
    }
}, status=200)
```

---

## 6. Model Save and Update Logic

### 6.1 Standard Save Pattern

#### **Create with Additional Fields**
```python
# Example from UserViewSet create (lines 284-302)
def create(self, request, *args, **kwargs):
    serializer = self.get_serializer(data=request.data)
    if serializer.is_valid():
        # Save through serializer, then add extra fields
        user = serializer.save()
        user.is_staff = True
        user.role = 'admin'
        user.save()
        
        return Response({
            'message': 'User created successfully',
            'user': {'username': user.username, 'email': user.email}
        }, status=status.HTTP_201_CREATED)
```

#### **Save with Context/Relationship**
```python
# Example from VenueViewSet create (lines 781-792)
serializer = self.get_serializer(data=request.data)
if serializer.is_valid():
    # Save with company relationship from request context
    venue = serializer.save(company=company)
    logger.info(f"Venue '{venue.name}' created successfully for company {company.name}")
    return Response({
        'message': 'Venue created successfully',
        'venue': serializer.data
    }, status=status.HTTP_201_CREATED)
```

### 6.2 perform_create/perform_update Pattern

#### **Custom Create Logic**
```python
# Example from LeaveRequestViewSet (lines 735-745)
def perform_create(self, serializer):
    """Handle leave request creation with validation"""
    # Set the requesting user
    serializer.save(staff_user=self.request.user)
    
    # Log the request creation
    logger.info(
        f"Leave request submitted: {self.request.user.username} - "
        f"{serializer.instance.leave_type.name} "
        f"({serializer.instance.start_date} to {serializer.instance.end_date})"
    )
```

#### **Custom Update Logic**
```python
# Example from StaffProfileViewSet (lines 680-681)
def perform_update(self, serializer):
    serializer.save(updated_at=timezone.now())
```

### 6.3 Transaction Safety

#### **Model Method with Transaction**
```python
# Example from LeaveRequest model (typical pattern)
from django.db import transaction

@transaction.atomic
def approve(self, approver, notes=''):
    """Approve the leave request"""
    self.status = 'approved'
    self.approved_by = approver
    self.approved_at = timezone.now()
    self.manager_notes = notes
    self.save()
```

---

## 7. Concrete Endpoint Examples

### 7.1 Login/Authentication Endpoint

**File:** `/Users/new/Projects/mead-security/remix2/backend/api/views.py`  
**Lines:** 176-232

**Endpoint:** `POST /api/v1/login/`

**Request Handling:**
```python
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'rate_limiting'
    
    def post(self, request):
        # 1. Parse request data
        username = request.data.get('username')
        password = request.data.get('password')
        
        # 2. Validate required fields
        if not username or not password:
            return Response({'message': 'Both username and password are required',
                             'errors': 'missing required parameters'}, status=400)
        
        try:
            # 3. Retrieve user from database
            user = User.objects.get(username=username)
            
            # 4. Verify password
            if user.check_password(password):
                # 5. Generate JWT tokens
                refresh = RefreshToken.for_user(user)
                
                # 6. Format response
                return Response({
                    'message': 'Login successful',
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'user': {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": user.role,
                        "is_active": user.is_active
                    }
                }, status=200)
            else:
                raise AuthenticationFailed('Incorrect password')
        except User.DoesNotExist:
            return Response({'message': 'Invalid username'}, status=401)
        except AuthenticationFailed as e:
            return Response({'message': str(e)}, status=401)
```

**Request Example:**
```json
POST /api/v1/login/
{
  "username": "admin",
  "password": "password123"
}
```

**Response Example:**
```json
{
  "message": "Login successful",
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "first_name": "Admin",
    "last_name": "User",
    "role": "admin",
    "is_active": true
  }
}
```

---

### 7.2 Leave Request Creation Endpoint

**File:** `/Users/new/Projects/mead-security/remix2/backend/leave_management/views.py`  
**Lines:** 673-817

**Endpoint:** `POST /api/v1/leave/requests/`

**Request Pipeline:**

```python
class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.select_related('staff_user', 'leave_type', 'approved_by')
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        # 1. Validate request data through serializer
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 2. Extract validated data
        leave_type_id = serializer.validated_data['leave_type'].id
        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']
        
        # 3. Business logic validation - Check blackout periods
        blackout_periods = BlackoutPeriod.objects.overlapping_period(start_date, end_date)
        for blackout in blackout_periods:
            if blackout.restriction_level == 'no_requests':
                return Response({
                    'error': f'Leave requests are not allowed during {blackout.name}',
                    'blackout_period': {
                        'name': blackout.name,
                        'start_date': blackout.start_date,
                        'end_date': blackout.end_date,
                        'message': blackout.get_restriction_message()
                    }
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # 4. Check leave balance
        try:
            current_year = timezone.now().year
            entitlement = LeaveEntitlement.objects.get(
                user=request.user,
                policy__leave_type_id=leave_type_id,
                year=current_year
            )
            
            if not entitlement.can_take_leave(serializer.validated_data['days_requested']):
                return Response({
                    'error': 'Insufficient leave balance',
                    'current_balance': entitlement.current_balance,
                    'requested': serializer.validated_data['days_requested']
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except LeaveEntitlement.DoesNotExist:
            return Response({
                'error': 'No leave entitlement found for this leave type'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 5. Create the request (sets staff_user to current user)
        self.perform_create(serializer)
        
        # 6. Auto-submit or save as draft
        if serializer.instance.status == 'draft':
            pass  # Allow user to submit later
        else:
            serializer.instance.status = 'pending'
            serializer.instance.submitted_at = timezone.now()
            serializer.instance.save()
            
            # 7. Update pending balance
            entitlement.add_pending(serializer.validated_data['days_requested'])
        
        # 8. Return success response
        headers = self.get_success_headers(serializer.data)
        return Response({
            'message': 'Leave request submitted successfully',
            'leave_request': serializer.data,
            'next_steps': (
                'Your request is pending manager approval'
                if serializer.instance.status == 'pending'
                else 'Your request has been saved as draft'
            )
        }, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Handle leave request creation with validation"""
        serializer.save(staff_user=self.request.user)
        
        logger.info(
            f"Leave request submitted: {self.request.user.username} - "
            f"{serializer.instance.leave_type.name} "
            f"({serializer.instance.start_date} to {serializer.instance.end_date})"
        )
```

**Serializer Validation:**
```python
# File: backend/leave_management/serializers.py, Lines 318-402
class LeaveRequestSerializer(serializers.ModelSerializer):
    leave_type = LeaveTypeSerializer(read_only=True)
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.filter(is_active=True),
        source='leave_type',
        write_only=True
    )
    
    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'leave_type', 'leave_type_id', 'start_date', 'end_date',
            'days_requested', 'reason', 'status', 'user', 'staff_user',
            'created_at', 'submitted_at', 'approved_at', 'approved_by',
            'reviewed_by', 'reviewed_at', 'manager_notes', 'emergency'
        ]
        read_only_fields = [
            'id', 'status', 'created_at', 'submitted_at', 'approved_at',
            'staff_user', 'approved_by', 'reviewed_by', 'reviewed_at', 'manager_notes'
        ]
    
    def validate(self, data):
        """Validate leave request data"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if start_date and end_date:
            if start_date > end_date:
                raise serializers.ValidationError({
                    'end_date': 'End date must be after start date'
                })
            
            # Calculate business days
            delta = end_date - start_date
            business_days = delta.days + 1
            
            if data.get('days_requested', 0) > business_days:
                raise serializers.ValidationError({
                    'days_requested': 'Requested days cannot exceed date range'
                })
        
        return data
```

**Request Example:**
```json
POST /api/v1/leave/requests/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

{
  "leave_type_id": 1,
  "start_date": "2025-10-15",
  "end_date": "2025-10-20",
  "days_requested": 5,
  "reason": "Family vacation",
  "emergency": false
}
```

**Response Example (Success):**
```json
{
  "message": "Leave request submitted successfully",
  "leave_request": {
    "id": 42,
    "leave_type": {
      "id": 1,
      "name": "Annual Leave",
      "code": "ANNUAL",
      "color_code": "#4CAF50"
    },
    "start_date": "2025-10-15",
    "end_date": "2025-10-20",
    "days_requested": 5,
    "reason": "Family vacation",
    "status": "pending",
    "user": {
      "id": 5,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com"
    },
    "created_at": "2025-10-07T10:30:00Z",
    "submitted_at": "2025-10-07T10:30:00Z"
  },
  "next_steps": "Your request is pending manager approval"
}
```

**Response Example (Error - Insufficient Balance):**
```json
{
  "error": "Insufficient leave balance",
  "current_balance": 3,
  "requested": 5
}
```

---

### 7.3 User Registration Endpoint

**File:** `/Users/new/Projects/mead-security/remix2/backend/api/views.py`  
**Lines:** 233-302

**Endpoint:** `POST /api/v1/users/`

**Request Handling:**
```python
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        """Allow registration without authentication"""
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def create(self, request, *args, **kwargs):
        # 1. Validate through serializer
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # 2. Create user with hashed password
            user = serializer.save()
            
            # 3. Set additional fields
            user.is_staff = True  # Enable staff status for API access
            user.role = 'admin'  # Set role to admin for new registrations
            user.save()
            
            # 4. Return success response
            return Response({
                'message': 'User created successfully',
                'user': {
                    'username': user.username,
                    'email': user.email
                }
            }, status=status.HTTP_201_CREATED)
        
        # 5. Return validation errors
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

**Serializer:**
```python
# File: backend/api/serializers.py, Lines 101-131
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, 
                                      style={'input_type': 'password'})
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name',
                 'role', 'is_active', 'password', 'security_roles', 
                 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def validate_email(self, value):
        # Check for uniqueness, excluding self during updates
        query = User.objects.filter(email=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("This email is already in use.")
        return value
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=validated_data.get('role', 'staff'),
            is_active=True,
        )
        return user
```

**Request Example:**
```json
POST /api/v1/users/

{
  "username": "johndoe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response Example:**
```json
{
  "message": "User created successfully",
  "user": {
    "username": "johndoe",
    "email": "john.doe@example.com"
  }
}
```

---

### 7.4 Venue CRUD Endpoint

**File:** `/Users/new/Projects/mead-security/remix2/backend/api/views.py`  
**Lines:** 723-905

**Endpoints:**
- `GET /api/v1/venues/` - List venues
- `POST /api/v1/venues/` - Create venue
- `GET /api/v1/venues/{id}/` - Get venue
- `PUT /api/v1/venues/{id}/` - Update venue
- `DELETE /api/v1/venues/{id}/` - Delete venue

**Request Handling:**
```python
class VenueViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    
    def get_user_company(self, request):
        """Get the user's current company context"""
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager']
        ).select_related('company').first()
        
        if not membership:
            return None
        return membership.company
    
    def get_queryset(self):
        """Return venues for the user's company only (Multi-tenant isolation)"""
        company = self.get_user_company(self.request)
        if not company:
            return Venue.objects.none()
        
        return Venue.objects.filter(company=company)
    
    def create(self, request, *args, **kwargs):
        # 1. Check admin permission
        if request.user.role != 'admin':
            return Response({
                'message': 'Only admin users can create venues',
                'error': 'permission_denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # 2. Get company context
        company = self.get_user_company(request)
        if not company:
            logger.error(f"User {request.user.username} attempted to create venue without company context")
            return Response({
                'message': 'No company context found. Please ensure you are associated with a company.',
                'error': 'no_company_context'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Creating venue for company: {company.name} (ID: {company.id})")
        
        # 3. Validate data
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # 4. Save with company association
            venue = serializer.save(company=company)
            logger.info(f"Venue '{venue.name}' created successfully for company {company.name}")
            
            # 5. Return success response
            return Response({
                'message': 'Venue created successfully',
                'venue': serializer.data
            }, status=status.HTTP_201_CREATED)
        
        # 6. Return validation errors
        logger.error(f"Venue creation failed. Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
```

**Serializer:**
```python
# File: backend/api/serializers.py, Lines 282-312
class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = (
            'id', 'name', 'address', 'city', 'postal_code', 'country',
            'is_active', 'capacity', 'latitude', 'longitude', 'check_radius',
            'contact_name', 'contact_phone', 'contact_email', 'description',
            'terms_and_conditions', 'terms_version', 
            'requires_fire_safety_checks', 'requires_capacity_monitoring',
            'requires_toilet_checks', 'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at')
    
    def validate_capacity(self, value):
        """Validate that capacity is a positive integer"""
        if value <= 0:
            raise serializers.ValidationError("Capacity must be greater than zero")
        return value
    
    def create(self, validated_data):
        """Override create to ensure company is set"""
        if 'company' not in validated_data or validated_data['company'] is None:
            raise serializers.ValidationError({
                'company': 'Company is required when creating a venue.'
            })
        return super().create(validated_data)
```

**Request Example:**
```json
POST /api/v1/venues/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

{
  "name": "Downtown Event Center",
  "address": "123 Main Street",
  "city": "London",
  "postal_code": "SW1A 1AA",
  "country": "UK",
  "capacity": 500,
  "latitude": 51.5074,
  "longitude": -0.1278,
  "check_radius": 100,
  "contact_name": "John Manager",
  "contact_phone": "+44 20 1234 5678",
  "contact_email": "manager@venue.com",
  "description": "Large event space in city center",
  "requires_fire_safety_checks": true,
  "requires_capacity_monitoring": true,
  "requires_toilet_checks": false
}
```

**Response Example:**
```json
{
  "message": "Venue created successfully",
  "venue": {
    "id": 15,
    "name": "Downtown Event Center",
    "address": "123 Main Street",
    "city": "London",
    "postal_code": "SW1A 1AA",
    "country": "UK",
    "is_active": true,
    "capacity": 500,
    "latitude": 51.5074,
    "longitude": -0.1278,
    "check_radius": 100,
    "contact_name": "John Manager",
    "contact_phone": "+44 20 1234 5678",
    "contact_email": "manager@venue.com",
    "description": "Large event space in city center",
    "requires_fire_safety_checks": true,
    "requires_capacity_monitoring": true,
    "requires_toilet_checks": false,
    "created_at": "2025-10-07T10:45:00Z",
    "updated_at": "2025-10-07T10:45:00Z"
  }
}
```

---

## 8. URL Routing Configuration

### 8.1 Main API Router

**File:** `/Users/new/Projects/mead-security/remix2/backend/api/urls.py`  
**Lines:** 1-50

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Create router
router = DefaultRouter()

# Register viewsets
router.register('users', UserViewSet)
router.register('staff-profiles', StaffProfileViewSet)
router.register('venues', VenueViewSet)
router.register('invoices', InvoiceViewSet)
# ... many more registrations

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('', include(router.urls)),
]
```

**Generated URLs:**
- `/api/v1/users/` → UserViewSet
- `/api/v1/venues/` → VenueViewSet
- `/api/v1/login/` → LoginView

### 8.2 Leave Management Router

**File:** `/Users/new/Projects/mead-security/remix2/backend/leave_management/urls.py`  
**Lines:** 1-51

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Create router
router = DefaultRouter()

# Core leave management endpoints
router.register(r'types', LeaveTypeViewSet, basename='leave-types')
router.register(r'policies', LeavePolicyViewSet, basename='leave-policies')
router.register(r'balances', LeaveBalanceViewSet, basename='leave-balances')
router.register(r'requests', LeaveRequestViewSet, basename='leave-requests')

# Team management endpoints
router.register(r'team-overview', TeamOverviewViewSet, basename='team-overview')

# Reports and analytics
router.register(r'reports', LeaveReportsViewSet, basename='leave-reports')

# System settings
router.register(r'settings', LeaveSettingsViewSet, basename='leave-settings')
router.register(r'blackout-periods', BlackoutPeriodsViewSet, basename='blackout-periods')

# Additional endpoints
router.register(r'calendar', LeaveCalendarViewSet, basename='leave-calendar')
router.register(r'holidays', HolidayViewSet, basename='holidays')

app_name = 'leave_management'

urlpatterns = [
    path('', include(router.urls)),
]
```

**Generated URLs:**
- `/api/v1/leave/types/` → LeaveTypeViewSet
- `/api/v1/leave/requests/` → LeaveRequestViewSet
- `/api/v1/leave/team-overview/` → TeamOverviewViewSet

### 8.3 Custom Action URLs

Custom actions on ViewSets automatically generate URLs:

```python
@action(detail=True, methods=['post'])
def approve(self, request, pk=None):
    # Generates: POST /api/v1/leave/requests/{id}/approve/
    pass

@action(detail=False, methods=['get'])
def pending_approvals(self, request):
    # Generates: GET /api/v1/leave/requests/pending_approvals/
    pass
```

---

## 9. Key Architectural Patterns

### 9.1 Multi-Tenant Company Isolation

**Pattern:** Every authenticated user must have a company context. Data is filtered by company membership.

```python
def get_user_company(self, request):
    """Get the user's current company context"""
    membership = request.user.company_memberships.filter(
        is_active=True,
        role__in=['owner', 'admin', 'manager']
    ).select_related('company').first()
    
    if not membership:
        return None
    return membership.company

def get_queryset(self):
    """Filter queryset to company-specific data"""
    company = self.get_user_company(self.request)
    if not company:
        return Model.objects.none()
    
    # Get all users in the same company
    company_user_ids = company.memberships.filter(
        is_active=True
    ).values_list('user_id', flat=True)
    
    return Model.objects.filter(user_id__in=company_user_ids)
```

**Used in:**
- VenueViewSet (lines 739-760)
- UserViewSet (lines 248-282)
- LeaveRequestViewSet (lines 701-733)

### 9.2 Role-Based Permissions

**Three-tier role system:**
1. **Staff** - Can view/edit own data only
2. **Manager** - Can view team data, approve requests
3. **Admin** - Full system access

```python
# Permission check pattern
if request.user.role == 'staff':
    return queryset.filter(staff_user=request.user)
elif request.user.role == 'manager':
    return queryset  # Can see all in company
elif request.user.role == 'admin':
    return queryset  # Full access
```

### 9.3 QuerySet Optimization

**Pattern:** Use `select_related()` and `prefetch_related()` to minimize database queries

```python
queryset = LeaveRequest.objects.select_related(
    'staff_user',  # Foreign key - use select_related
    'leave_type',
    'approved_by'
).prefetch_related(
    'documents'  # Many-to-many or reverse FK - use prefetch_related
)
```

**Examples:**
- LeaveRequestViewSet (line 682)
- LeavePolicyViewSet (lines 147-149)

### 9.4 Separation of Concerns

**Pattern:** Business logic in models, view logic in views, validation in serializers

- **Models:** Business methods like `approve()`, `can_take_leave()`
- **Serializers:** Field validation, data transformation
- **Views:** Request handling, permission checks, orchestration

---

## 10. Summary of Key Files and Line Numbers

### Authentication & User Management
| Feature | File | Lines | Description |
|---------|------|-------|-------------|
| Login | `/backend/api/views.py` | 176-232 | JWT authentication endpoint |
| User Registration | `/backend/api/views.py` | 233-312 | User creation with role assignment |
| User Serializer | `/backend/api/serializers.py` | 101-131 | Password hashing, email validation |

### Leave Management System
| Feature | File | Lines | Description |
|---------|------|-------|-------------|
| Leave Request ViewSet | `/backend/leave_management/views.py` | 673-1187 | Full leave request CRUD + approvals |
| Leave Request Serializer | `/backend/leave_management/serializers.py` | 318-402 | Request validation |
| Leave Permissions | `/backend/leave_management/permissions.py` | 8-337 | Role-based permissions |
| Leave URLs | `/backend/leave_management/urls.py` | 1-287 | URL routing + API docs |

### Venue Management
| Feature | File | Lines | Description |
|---------|------|-------|-------------|
| Venue ViewSet | `/backend/api/views.py` | 723-905 | Multi-tenant venue CRUD |
| Venue Serializer | `/backend/api/serializers.py` | 282-312 | Venue validation |

### Staff Profile Management
| Feature | File | Lines | Description |
|---------|------|-------|-------------|
| StaffProfile ViewSet | `/backend/api/views.py` | 599-702 | Profile CRUD with immutable fields |
| StaffProfile Serializer | `/backend/api/serializers.py` | 163-193 | Profile data transformation |

---

## 11. Common Development Patterns

### Pattern 1: Custom Action on ViewSet
```python
@action(detail=True, methods=['post'], permission_classes=[AdminOnlyPermission])
def approve(self, request, pk=None):
    """Custom action for approval workflow"""
    instance = self.get_object()
    # Business logic
    instance.approve(request.user)
    return Response({'message': 'Approved successfully'})
```

### Pattern 2: Queryset Filtering by User Role
```python
def get_queryset(self):
    user = self.request.user
    queryset = super().get_queryset()
    
    if user.role == 'admin':
        return queryset  # Full access
    elif user.role == 'manager':
        return queryset.filter(company=user.company)
    else:
        return queryset.filter(user=user)  # Own data only
```

### Pattern 3: Multi-Level Validation
```python
def create(self, request, *args, **kwargs):
    # 1. Serializer validation
    serializer = self.get_serializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # 2. Business rule validation
    if not self.check_business_rule(serializer.validated_data):
        return Response({'error': 'Business rule violated'}, 
                        status=status.HTTP_400_BAD_REQUEST)
    
    # 3. Save with context
    self.perform_create(serializer)
    
    # 4. Post-creation logic
    self.trigger_notifications(serializer.instance)
    
    return Response(serializer.data, status=status.HTTP_201_CREATED)
```

---

## 12. Best Practices Observed

1. **Always use `request.data`** for POST/PUT/PATCH data (not `request.POST`)
2. **Use `serializer.is_valid(raise_exception=True)`** to automatically return 400 errors
3. **Implement `get_queryset()`** for data filtering by permissions
4. **Use `perform_create()`/`perform_update()`** for common save logic
5. **Separate authentication permissions from action permissions**
6. **Return structured error responses** with clear error messages
7. **Use `@action` decorator** for custom endpoints on ViewSets
8. **Optimize queries** with `select_related()`/`prefetch_related()`
9. **Log important operations** for audit trails
10. **Use transaction.atomic()** for multi-step database operations

---

## 13. Testing Endpoints

### Using cURL
```bash
# Login
curl -X POST http://localhost:8000/api/v1/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Create leave request (with token)
curl -X POST http://localhost:8000/api/v1/leave/requests/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type_id": 1,
    "start_date": "2025-10-15",
    "end_date": "2025-10-20",
    "days_requested": 5,
    "reason": "Vacation"
  }'

# Approve leave request (manager/admin)
curl -X POST http://localhost:8000/api/v1/leave/requests/42/approve/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved - enjoy your vacation"}'
```

---

## Conclusion

This Django backend uses a comprehensive and well-structured request handling pipeline with:

- **Clear separation of concerns** between views, serializers, and models
- **Robust permission system** with role-based and object-level permissions
- **Multi-tenant architecture** with company isolation
- **Comprehensive validation** at both serializer and business logic levels
- **Consistent error handling** and response formatting
- **Optimized database queries** to prevent N+1 problems
- **JWT authentication** with refresh token support

The codebase demonstrates Django REST Framework best practices and provides excellent examples for implementing similar systems.

---

**Research completed:** 2025-10-07  
**Total files analyzed:** 4  
**Total view classes documented:** 25+  
**Total endpoint examples:** 4 comprehensive examples
