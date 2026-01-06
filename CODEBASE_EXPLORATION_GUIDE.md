# Complete Codebase Exploration Guide
## Guard Security Staff Management System

*A comprehensive guide for new developers to understand the entire system architecture, data flows, and implementation patterns.*

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Technology Stack Deep Dive](#2-technology-stack-deep-dive)
3. [Project Structure & Architecture](#3-project-structure--architecture)
4. [Data Models & Relationships](#4-data-models--relationships)
5. [Complete User Journey: Shift Check-In](#5-complete-user-journey-shift-check-in)
6. [Authentication & Security](#6-authentication--security)
7. [Configuration & Integrations](#7-configuration--integrations)
8. [API Structure & Patterns](#8-api-structure--patterns)
9. [Development Patterns & Recent Changes](#9-development-patterns--recent-changes)

---

## 1. System Overview

### What is Guard?

Guard is a **multi-tenant SaaS platform** for managing security staff across multiple companies and venues. It handles:

- **Staff Management**: SIA license tracking, qualifications, bank details
- **Shift Management**: GPS-verified check-in/out, digital signatures, photo capture
- **Venue Operations**: Location-based verification, capacity tracking
- **Financial Processing**: Automated invoice generation, pay rate management
- **Compliance**: Audit trails, security checks, incident reporting
- **Integration**: Deputy workforce management, accounting systems (Xero, QuickBooks, Sage)

### Key Features

```
┌─────────────────────────────────────────────────────────────┐
│                    GUARD SYSTEM FEATURES                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 Mobile App (iOS/Android)                                 │
│     • Offline-first architecture                            │
│     • GPS-based shift check-in                              │
│     • Digital signature capture                             │
│     • Photo documentation                                   │
│     • Push notifications                                    │
│                                                              │
│  💻 Web Portal (React)                                       │
│     • Role-based dashboards (Staff/Manager/Admin)           │
│     • Shift scheduling & approval                           │
│     • Invoice generation                                    │
│     • Reporting & analytics                                 │
│     • Deputy integration                                    │
│                                                              │
│  🔧 Backend API (Django)                                     │
│     • RESTful API with DRF                                  │
│     • JWT authentication                                    │
│     • Multi-tenant data isolation                           │
│     • Background task processing (Celery)                   │
│     • Real-time updates (WebSocket)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Overview

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  Mobile App  │◄───────►│  Django API  │◄───────►│  PostgreSQL  │
│  (React      │  HTTPS  │  (REST/WS)   │   ORM   │  Database    │
│   Native)    │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
                                │
                                │
                         ┌──────┴──────┐
                         │             │
                    ┌────▼────┐   ┌────▼────┐
                    │ Redis   │   │ Celery  │
                    │ Cache   │   │ Workers │
                    └─────────┘   └─────────┘
                         │
                         │
                    ┌────▼────┐
                    │ Deputy  │
                    │ Xero    │
                    │ APIs    │
                    └─────────┘
```

---

## 2. Technology Stack Deep Dive

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11+ | Core language |
| **Django** | 5.2 | Web framework |
| **Django REST Framework** | 3.15.2 | RESTful API |
| **PostgreSQL** | 14+ | Primary database |
| **Redis** | Latest | Caching + Celery broker |
| **Celery** | 5.4.0 | Background tasks |
| **Django Channels** | 4.2.0 | WebSocket support |
| **SimpleJWT** | 5.3.1 | JWT authentication |

**Key Backend Dependencies:**
```python
# requirements.txt highlights
django==5.2
djangorestframework==3.15.2
djangorestframework-simplejwt==5.3.1
celery==5.4.0
redis==5.0.8
channels==4.2.0
psycopg2-binary==2.9.9  # PostgreSQL adapter
pillow==11.0.0  # Image processing
requests==2.32.3  # HTTP client
python-dotenv==1.0.1  # Environment variables
```

### Frontend Technologies (Web)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.7.2 | Type safety |
| **Vite** | 6.0.11 | Build tool |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS |
| **Fluent UI** | 9.58.4 | Microsoft design system |
| **React Router** | 7.1.3 | Client-side routing |
| **TanStack Query** | 5.62.12 | Server state management |
| **Axios** | 1.7.9 | HTTP client |

**Key Frontend Dependencies:**
```json
{
  "react": "18.3.1",
  "@fluentui/react-components": "9.58.4",
  "@tanstack/react-query": "5.62.12",
  "react-router-dom": "7.1.3",
  "axios": "1.7.9",
  "formik": "2.4.6",
  "yup": "1.6.1",
  "date-fns": "4.1.0"
}
```

### Mobile Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.5 | Mobile framework |
| **Expo** | ~54.0.30 | Development platform |
| **Redux Toolkit** | 2.9.0 | State management |
| **Redux Persist** | 6.0.0 | Offline persistence |
| **Expo Camera** | ~17.0.8 | Photo capture |
| **Expo Location** | ~19.0.7 | GPS tracking |
| **React Native Maps** | 1.20.1 | Map integration |

**Key Mobile Dependencies:**
```json
{
  "expo": "~54.0.30",
  "react-native": "0.81.5",
  "@reduxjs/toolkit": "2.9.0",
  "redux-persist": "6.0.0",
  "expo-camera": "~17.0.8",
  "expo-location": "~19.0.7",
  "react-native-signature-canvas": "5.0.1"
}
```

---

## 3. Project Structure & Architecture

### Repository Layout

```
mead-security/remix2/
│
├── backend/                      # Django API server
│   ├── api/                      # Core API app
│   │   ├── models.py            # 5188 lines, 53 models! 🔥
│   │   ├── views.py             # API views & authentication
│   │   ├── serializers.py       # DRF serializers
│   │   ├── urls.py              # URL routing
│   │   ├── tasks.py             # Celery tasks
│   │   ├── signals.py           # Django signals
│   │   ├── authentication.py    # Custom JWT auth (Sprint 3)
│   │   └── migrations/          # Database migrations
│   │
│   ├── shifts/                   # Shift management app
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   │
│   ├── leave_management/         # Leave & attendance
│   ├── finance_integrations/     # Xero, QuickBooks, Sage
│   │
│   ├── core/                     # Django project settings
│   │   ├── settings.py          # Configuration
│   │   ├── celery_app.py        # Celery config
│   │   ├── urls.py              # Root URL routing
│   │   └── wsgi.py / asgi.py    # WSGI/ASGI servers
│   │
│   ├── media/                    # User uploads
│   ├── staticfiles/              # Collected static files
│   ├── requirements.txt          # Python dependencies
│   └── manage.py                 # Django CLI
│
├── frontend/                     # React web app
│   ├── src/
│   │   ├── pages/               # Page components
│   │   │   ├── admin/           # Admin-only pages
│   │   │   ├── manager/         # Manager-only pages
│   │   │   ├── staff/           # Staff-only pages
│   │   │   ├── auth/            # Login, password reset
│   │   │   └── public/          # Public recruitment
│   │   │
│   │   ├── components/          # Reusable UI components
│   │   ├── contexts/            # React Context providers
│   │   │   └── AuthContext.tsx  # Authentication state
│   │   │
│   │   ├── services/            # API service layer
│   │   │   ├── api.ts           # Axios instance
│   │   │   ├── authService.ts
│   │   │   ├── shiftService.ts
│   │   │   └── ...
│   │   │
│   │   ├── types/               # TypeScript types
│   │   ├── utils/               # Utility functions
│   │   ├── Router.tsx           # Route configuration
│   │   └── main.tsx             # Entry point
│   │
│   ├── public/                  # Static assets
│   ├── dist/                    # Build output
│   ├── package.json
│   ├── vite.config.ts           # Vite configuration
│   └── tsconfig.json            # TypeScript config
│
├── mobile/                      # React Native app
│   ├── src/
│   │   ├── screens/            # Screen components
│   │   │   ├── auth/           # Login screens
│   │   │   ├── shifts/         # Shift management
│   │   │   │   ├── ShiftDetailsScreen.tsx  # 🔥 Check-in flow
│   │   │   │   └── CheckInFlowScreen.tsx
│   │   │   ├── checks/         # Security checks
│   │   │   └── profile/        # User profile
│   │   │
│   │   ├── navigation/         # React Navigation setup
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API & offline services
│   │   │   ├── api.ts
│   │   │   ├── database.ts     # SQLite for offline
│   │   │   └── syncService.ts  # Offline sync
│   │   │
│   │   ├── store/              # Redux store
│   │   └── utils/              # Utilities
│   │
│   ├── app.json                # Expo config
│   ├── eas.json                # EAS Build config
│   └── package.json
│
├── docs/                        # Documentation
│   ├── models_documentation.md
│   ├── api_endpoints_documentation.md
│   └── frontend_model_analysis.md
│
└── CLAUDE.md                    # AI assistant instructions
```

### Multi-Tenant Architecture

Every database query is filtered by `SecurityCompany` to ensure data isolation:

```python
# In every ViewSet
def get_queryset(self):
    if self.request.user.role in ['manager', 'admin']:
        membership = UserCompanyMembership.objects.filter(
            user=self.request.user,
            is_active=True
        ).first()
        if membership:
            return self.model.objects.filter(company=membership.company)
    return self.model.objects.filter(created_by=self.request.user)
```

---

## 4. Data Models & Relationships

### Core Model Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                   MULTI-TENANT ROOT                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │         SecurityCompany (Tenant Root)              │     │
│  │  • id: UUID                                        │     │
│  │  • name, email, phone                              │     │
│  │  • subscription_tier: free/basic/premium/enterprise│     │
│  │  • staff_capacity, venue_capacity                  │     │
│  │  • features_enabled: JSONField                     │     │
│  └─────────────────┬──────────────────────────────────┘     │
│                    │                                         │
│         ┌──────────┴──────────┬──────────────┐             │
│         │                     │              │             │
│    ┌────▼────┐         ┌──────▼──────┐  ┌───▼───┐          │
│    │ Venue   │         │    User     │  │Company│          │
│    │         │         │  (Django)   │  │Invoice│          │
│    │ • name  │         │             │  └───────┘          │
│    │ • GPS   │         │  • role     │                     │
│    │ • checks│         │  • security │                     │
│    └────┬────┘         │    _roles   │                     │
│         │              └──────┬──────┘                     │
│         │                     │                             │
│         │              ┌──────▼────────────────┐           │
│         │              │ UserCompanyMembership │           │
│         │              │  (Many-to-Many Link)  │           │
│         │              │  • company FK         │           │
│         │              │  • user FK            │           │
│         │              │  • is_active          │           │
│         │              │  • role_in_company    │           │
│         │              └──────┬────────────────┘           │
│         │                     │                             │
│         │              ┌──────▼──────┐                     │
│         │              │StaffProfile │                     │
│         │              │  • SIA      │                     │
│         │              │  • quals    │                     │
│         │              │  • bank     │                     │
│         │              └──────┬──────┘                     │
│         │                     │                             │
│         └─────────────────────┘                             │
│                     │                                       │
│              ┌──────▼──────┐                               │
│              │    SHIFT    │  🔥 CORE BUSINESS ENTITY      │
│              │             │                               │
│              │ • staff_user ──────► User                   │
│              │ • venue ──────────► Venue                   │
│              │ • company ────────► SecurityCompany         │
│              │                                             │
│              │ Status Lifecycle:                           │
│              │  open → scheduled → active →                │
│              │  in_progress → completed →                  │
│              │  pending_approval → approved                │
│              │                                             │
│              │ GPS Verification:                           │
│              │  • check_in_location: JSONField             │
│              │  • check_out_location: JSONField            │
│              │                                             │
│              │ Digital Evidence:                           │
│              │  • start_signature: base64                  │
│              │  • end_signature: base64                    │
│              │  • check_in_photo: base64                   │
│              │  • check_out_photo: base64                  │
│              │                                             │
│              │ Financial:                                  │
│              │  • hourly_rate: Decimal                     │
│              │  • actual_hours_worked: Decimal             │
│              │  • invoice FK ────────► Invoice             │
│              └─────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Critical Models Explained

#### **Shift Model** (api/models.py:712-1043)

The heart of the system. Tracks every security shift from creation to payment.

```python
class Shift(models.Model):
    # Foreign Keys (Multi-tenant)
    staff_user = models.ForeignKey(User, related_name='shifts')
    venue = models.ForeignKey(Venue, related_name='shifts')
    company = models.ForeignKey(SecurityCompany, related_name='shifts')

    # Scheduling
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_overnight = models.BooleanField(default=False)

    # Status Management
    STATUS_CHOICES = (
        ('open', 'Open'),                    # Available for claiming
        ('scheduled', 'Scheduled'),          # Assigned to staff
        ('active', 'Active'),                # Within check-in window
        ('in_progress', 'In Progress'),      # Staff checked in
        ('completed', 'Completed'),          # Staff checked out
        ('pending_approval', 'Pending Approval'),  # Awaiting manager
        ('approved', 'Approved'),            # Manager approved
        ('rejected', 'Rejected'),            # Manager rejected
        ('cancelled', 'Cancelled'),          # Cancelled
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    # GPS Verification (Haversine formula, 100m radius)
    check_in_location = models.JSONField(null=True, blank=True)
    # {"latitude": 51.5074, "longitude": -0.1278, "accuracy": 10.5}
    check_out_location = models.JSONField(null=True, blank=True)

    # Digital Evidence
    start_signature = models.TextField(blank=True, null=True)  # base64
    end_signature = models.TextField(blank=True, null=True)
    check_in_photo = models.TextField(blank=True, null=True)   # base64
    check_out_photo = models.TextField(blank=True, null=True)

    # Time Tracking
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    actual_hours_worked = models.DecimalField(max_digits=5, decimal_places=2)

    # Financial
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)
    total_pay = models.DecimalField(max_digits=10, decimal_places=2)
    invoice = models.ForeignKey('Invoice', null=True, related_name='shifts')

    # Audit Trail
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_by = models.ForeignKey(User, null=True, related_name='approved_shifts')
    approved_at = models.DateTimeField(null=True, blank=True)

    def check_in(self, latitude, longitude, signature=None, photo=None):
        """
        GPS-verified check-in with signature and photo capture.

        Validates:
        1. Location within 100m of venue
        2. Check-in window (15 min early allowed)
        3. Same calendar date as scheduled start
        4. Shift not already checked in
        """
        # Location verification
        if not self.venue.verify_location(latitude, longitude):
            raise ValueError("You must be within 100m of the venue to check in")

        # Time window validation
        now = timezone.now()
        if now < self.start_time - timedelta(minutes=15):
            raise ValueError("Too early to check in")

        if now.date() != self.start_time.date():
            raise ValueError("Cannot check in on different date")

        # Set check-in data
        self.check_in_time = now
        self.check_in_location = {'latitude': latitude, 'longitude': longitude}
        self.start_signature = signature
        self.check_in_photo = photo
        self.status = 'in_progress'
        self.save()

    def check_out(self, latitude, longitude, signature=None, photo=None):
        """Similar validation for check-out."""
        # Similar GPS + time validation
        self.check_out_time = timezone.now()
        self.check_out_location = {'latitude': latitude, 'longitude': longitude}
        self.end_signature = signature
        self.check_out_photo = photo

        # Calculate hours worked
        duration = self.check_out_time - self.check_in_time
        self.actual_hours_worked = Decimal(duration.total_seconds() / 3600)
        self.total_pay = self.hourly_rate * self.actual_hours_worked

        self.status = 'completed'
        self.save()
```

#### **User Model** (api/models.py:132-289)

Extended Django User with security staff features.

```python
class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('staff', 'Staff'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='staff')

    # Multi-tenant membership
    companies = models.ManyToManyField(
        'SecurityCompany',
        through='UserCompanyMembership',
        related_name='users'
    )

    # Security roles (e.g., "Door Supervisor", "CCTV Operator")
    security_roles = models.JSONField(default=list)

    # Sprint 3: Account security
    failed_login_attempts = models.IntegerField(default=0)
    account_locked_until = models.DateTimeField(null=True, blank=True)
    password_reset_token = models.CharField(max_length=255, blank=True, null=True)
    password_reset_token_created_at = models.DateTimeField(null=True, blank=True)
```

#### **Venue Model** (api/models.py:1044-1185)

Physical locations where security staff work.

```python
class Venue(models.Model):
    company = models.ForeignKey(SecurityCompany, related_name='venues')
    name = models.CharField(max_length=255)

    # GPS Coordinates
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_radius = models.IntegerField(default=100)  # meters

    # Required checks configuration
    requires_incident_reports = models.BooleanField(default=True)
    requires_equipment_checks = models.BooleanField(default=False)

    def verify_location(self, lat, lon):
        """
        Haversine formula to verify staff is within radius.

        Returns True if within self.location_radius meters.
        """
        from math import radians, sin, cos, sqrt, atan2

        R = 6371000  # Earth radius in meters

        lat1 = radians(float(self.latitude))
        lat2 = radians(float(lat))
        delta_lat = radians(float(lat) - float(self.latitude))
        delta_lon = radians(float(lon) - float(self.longitude))

        a = sin(delta_lat/2)**2 + cos(lat1) * cos(lat2) * sin(delta_lon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c

        return distance <= self.location_radius
```

### Complete Model List (53 Total)

```
Core Business Models (14):
├── SecurityCompany          # Multi-tenant root
├── User                     # Extended Django user
├── UserCompanyMembership    # Many-to-many link
├── StaffProfile             # Extended user profile
├── Venue                    # Physical locations
├── Shift                    # Core business entity
├── ShiftGroup               # Multi-staff coordination
├── ShiftExchange            # Shift trading
├── ShiftRequest             # Open shift claiming
├── Invoice                  # Payment processing
├── InvoiceItem              # Line items
├── ComplianceProfile        # Compliance rules
├── ComplianceHistory        # Audit trail
└── AuditLog                 # System-wide audit

Qualifications & Licenses (4):
├── SIALicense               # UK security license
├── Qualification            # Certifications
├── EmergencyContact         # Staff emergency contacts
└── EmploymentType           # Contract types

Shift Operations (6):
├── ShiftCheck               # Security checks
├── ShiftCheckTemplate       # Check definitions
├── IncidentReport           # Incident logging
├── IncidentReportMobile     # Mobile offline reports
├── ShiftPattern             # Recurring patterns
└── RecurringShiftDefinition # Recurring shift rules

Leave Management (8):
├── LeavePolicy              # Leave rules
├── LeaveBalance             # Staff balances
├── LeaveRequest             # Leave applications
├── LeaveTransaction         # Balance changes
├── LeaveAccrual             # Auto-accrual tracking
├── BlackoutPeriod           # Leave blackout dates
├── AttendanceRecord         # Daily attendance
└── AttendancePattern        # Pattern analysis

Digital Systems (5):
├── DigitalSignature         # Signature storage
├── VirtualIDCard            # Digital staff IDs
├── ApprovalWorkflow         # Approval tracking
├── Notification             # Push notifications
└── NotificationPreference   # User preferences

Deputy Integration (4):
├── DeputyEmployee           # Deputy sync
├── DeputyTimesheet          # Timesheet sync
├── DeputyLocation           # Location sync
└── DeputyIntegrationLog     # Sync logging

Financial Integrations (6):
├── FinanceIntegration       # OAuth credentials
├── XeroInvoice              # Xero sync
├── QuickBooksInvoice        # QuickBooks sync
├── SageInvoice              # Sage sync
├── PaymentRecord            # Payment tracking
└── TaxConfiguration         # Tax settings

Recruitment (3):
├── RecruitmentApplication   # Job applications
├── ApplicationNote          # Recruiter notes
└── CompanySettings          # Company config

Advanced Features (3):
├── LeaveGamification        # Engagement system
├── AttendanceReward         # Attendance bonuses
└── BiometricData            # Biometric integration
```

---

## 5. Complete User Journey: Shift Check-In

### The Check-In Flow (Mobile → API → Database)

Let's trace a complete shift check-in from start to finish:

```
┌─────────────────────────────────────────────────────────────┐
│                  SHIFT CHECK-IN JOURNEY                      │
│                                                              │
│  MOBILE APP                API                  DATABASE    │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  1. Staff opens shift                                        │
│     ShiftDetailsScreen                                       │
│          │                                                   │
│          ├─► GPS location fetch                             │
│          │   (expo-location)                                │
│          │                                                   │
│          ├─► Distance calculation                           │
│          │   (Haversine formula)                            │
│          │                                                   │
│          ├─► Validate: < 100m ✓                             │
│          │                                                   │
│          └─► Enable "Check In" button                       │
│                                                              │
│  2. Staff taps "Check In"                                   │
│     handleCheckIn()                                          │
│          │                                                   │
│          └─► Show Camera Modal                              │
│                                                              │
│  3. Staff takes photo                                       │
│     CameraModal                                              │
│          │                                                   │
│          ├─► expo-camera.takePictureAsync()                 │
│          │                                                   │
│          └─► Convert to base64                              │
│              setVenuePhoto(base64)                           │
│                                                              │
│  4. Staff signs                                             │
│     SignatureCanvas                                          │
│          │                                                   │
│          └─► Capture signature path                         │
│              setSignature(svgPath)                           │
│                                                              │
│  5. Staff confirms check-in                                 │
│     confirmCheckIn()                                         │
│          │                                                   │
│          ├─► Build request payload                          │
│          │   {                                              │
│          │     status: 'in_progress',                       │
│          │     check_in_time: '2025-01-05T14:30:00Z',      │
│          │     check_in_location: {                        │
│          │       latitude: 51.5074,                        │
│          │       longitude: -0.1278                        │
│          │     },                                           │
│          │     check_in_photo: 'data:image/png;base64...', │
│          │     start_signature: '<svg>...</svg>'           │
│          │   }                                              │
│          │                                                   │
│          └─► PATCH /api/v1/shifts/123/ ──────►             │
│                                                 │            │
│                                            ShiftViewSet      │
│                                                 │            │
│                                            partial_update()  │
│                                                 │            │
│                                                 ├─► Deserialize
│                                                 │   ShiftSerializer
│                                                 │            │
│                                                 ├─► Validate │
│                                                 │   • GPS    │
│                                                 │   • Time   │
│                                                 │   • Status │
│                                                 │            │
│                                                 └─► Save ──►│
│                                                           Shift.save()
│                                                              │
│                                                              ├─► check_in_time
│                                                              ├─► check_in_location
│                                                              ├─► start_signature
│                                                              ├─► check_in_photo
│                                                              └─► status = 'in_progress'
│                                                              │
│          ◄─────────────────────────────────────────────────┘
│          │   Response: 200 OK                               │
│          │   { shift: {...updated...} }                     │
│          │                                                   │
│          └─► Update Redux store                             │
│              dispatch(checkInShift())                        │
│                                                              │
│  6. UI Updates                                              │
│     • Status badge: "In Progress"                           │
│     • Show "Check Out" button                               │
│     • Disable "Check In" button                             │
│     • Update shift timer                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Code: ShiftDetailsScreen.tsx (mobile/src/screens/shifts/ShiftDetailsScreen.tsx:245-389)

```typescript
const ShiftDetailsScreen = ({ route }: ShiftDetailsScreenProps) => {
  const { shiftId } = route.params;
  const shift = useAppSelector((state) =>
    state.shifts.shifts.find(s => s.id === shiftId)
  );

  // GPS tracking
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distanceToVenue, setDistanceToVenue] = useState<number | null>(null);

  // Check-in states
  const [venuePhoto, setVenuePhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // Calculate distance to venue using Haversine
  useEffect(() => {
    if (location && shift?.venue) {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        shift.venue.latitude,
        shift.venue.longitude
      );
      setDistanceToVenue(Math.round(distance));
    }
  }, [location, shift]);

  const handleCheckIn = () => {
    // Validation: Must be within 100m
    if (distanceToVenue && distanceToVenue > 100) {
      Alert.alert(
        'Too Far From Venue',
        `You are ${distanceToVenue}m away from the venue. ` +
        `You must be within 100m to check in.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Step 1: Take photo
    setShowCameraModal(true);
  };

  const handlePhotoTaken = (photoUri: string) => {
    setVenuePhoto(photoUri);
    setShowCameraModal(false);

    // Step 2: Capture signature
    setShowSignatureModal(true);
  };

  const handleSignatureDone = (signatureSvg: string) => {
    setSignature(signatureSvg);
    setShowSignatureModal(false);

    // Step 3: Confirm check-in
    confirmCheckIn();
  };

  const confirmCheckIn = async () => {
    if (!location || !venuePhoto || !signature) {
      Alert.alert('Error', 'Missing required data for check-in');
      return;
    }

    try {
      const checkInData = {
        status: 'in_progress',
        check_in_time: new Date().toISOString(),
        check_in_location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy
        },
        check_in_photo: venuePhoto,  // base64
        start_signature: signature    // SVG string
      };

      // API call
      const response = await apiService.patch(
        `/api/v1/shifts/${shiftId}/`,
        checkInData
      );

      // Update Redux store
      dispatch(checkInShift({
        shiftId,
        location: checkInData.check_in_location,
        photo: venuePhoto,
        signature: signature,
        syncStatus: 'synced'
      }));

      Alert.alert('Success', 'Checked in successfully!');

    } catch (error) {
      // Offline handling
      if (!isOnline) {
        // Queue for later sync
        dispatch(addToSyncQueue({
          action: 'check_in',
          shiftId,
          data: checkInData,
          timestamp: Date.now()
        }));
        Alert.alert('Queued', 'Check-in will sync when online');
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Shift Details */}
      <Text style={styles.venueName}>{shift?.venue.name}</Text>
      <Text style={styles.time}>
        {format(shift?.start_time, 'HH:mm')} - {format(shift?.end_time, 'HH:mm')}
      </Text>

      {/* Distance indicator */}
      {distanceToVenue !== null && (
        <View style={[
          styles.distanceBadge,
          distanceToVenue <= 100 ? styles.distanceGood : styles.distanceFar
        ]}>
          <Text>{distanceToVenue}m from venue</Text>
        </View>
      )}

      {/* Check In Button */}
      {shift?.status === 'scheduled' && (
        <Button
          title="Check In"
          onPress={handleCheckIn}
          disabled={!distanceToVenue || distanceToVenue > 100}
        />
      )}

      {/* Modals */}
      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onPhotoTaken={handlePhotoTaken}
      />

      <SignatureModal
        visible={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSignatureDone={handleSignatureDone}
      />
    </View>
  );
};
```

### API Code: ShiftViewSet (shifts/views.py:45-178)

```python
class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all().order_by('-start_time')
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Multi-tenant filtering"""
        user = self.request.user

        if user.role in ['manager', 'admin']:
            # Managers see all shifts in their company
            membership = UserCompanyMembership.objects.filter(
                user=user,
                is_active=True
            ).first()

            if membership:
                return Shift.objects.filter(
                    venue__company=membership.company
                ).select_related('staff_user', 'venue', 'company')

        # Staff see only their shifts
        return Shift.objects.filter(
            staff_user=user
        ).select_related('venue', 'company')

    def partial_update(self, request, *args, **kwargs):
        """
        Handle PATCH requests for shift updates.
        Used for check-in and check-out.
        """
        shift = self.get_object()

        # Check-in validation
        if 'status' in request.data and request.data['status'] == 'in_progress':
            # Validate GPS location
            check_in_location = request.data.get('check_in_location')
            if not check_in_location:
                return Response(
                    {'error': 'check_in_location required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            latitude = check_in_location.get('latitude')
            longitude = check_in_location.get('longitude')

            # GPS verification
            if not shift.venue.verify_location(latitude, longitude):
                return Response(
                    {'error': 'You must be within 100m of the venue'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Time window validation
            now = timezone.now()
            if now < shift.start_time - timedelta(minutes=15):
                return Response(
                    {'error': 'Too early to check in'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Date validation
            if now.date() != shift.start_time.date():
                return Response(
                    {'error': 'Cannot check in on different date'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Use serializer for validation and save
        serializer = self.get_serializer(
            shift,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)
```

### Database Save: Shift Model (api/models.py:823-912)

```python
class Shift(models.Model):
    # ... fields defined earlier ...

    def save(self, *args, **kwargs):
        """
        Custom save logic for automatic status transitions
        and business rule enforcement.
        """
        # Calculate total pay on check-out
        if self.status == 'completed' and self.check_in_time and self.check_out_time:
            duration = self.check_out_time - self.check_in_time
            hours = Decimal(duration.total_seconds() / 3600)
            self.actual_hours_worked = hours
            self.total_pay = self.hourly_rate * hours

        # Automatic status transition: scheduled → active
        if self.status == 'scheduled':
            now = timezone.now()
            # Within 2 hours of start time
            if now >= self.start_time - timedelta(hours=2):
                self.status = 'active'

        # Validation: Can't check in if SIA expired
        if self.status == 'in_progress':
            if not self.staff_user.staffprofile.has_valid_sia():
                raise ValidationError(
                    'Cannot check in: SIA license expired'
                )

        super().save(*args, **kwargs)

        # Create audit log
        AuditLog.objects.create(
            user=self.staff_user,
            action='shift_updated',
            model_name='Shift',
            object_id=self.id,
            changes={
                'status': self.status,
                'check_in_time': str(self.check_in_time) if self.check_in_time else None,
            }
        )
```

---

## 6. Authentication & Security

### Sprint 3: Cookie-Based JWT Authentication

The system migrated from localStorage tokens to httpOnly cookies for enhanced XSS protection.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                AUTHENTICATION ARCHITECTURE                    │
│                                                               │
│  ┌─────────────┐           ┌─────────────┐                   │
│  │  Web App    │           │  Mobile App │                   │
│  │  (React)    │           │  (React N.) │                   │
│  └──────┬──────┘           └──────┬──────┘                   │
│         │                         │                           │
│         │ POST /api/v1/auth/login/│                          │
│         │ { username, password }  │                           │
│         │                         │                           │
│         └─────────────┬───────────┘                           │
│                       │                                       │
│                       ▼                                       │
│              ┌─────────────────┐                             │
│              │   LoginView     │                             │
│              │   (Django)      │                             │
│              └────────┬────────┘                             │
│                       │                                       │
│          ┌────────────┴────────────┐                         │
│          │                         │                         │
│    Rate Limit?            Account Locked?                    │
│    (20/min)               (failed attempts)                  │
│          │                         │                         │
│          ▼                         ▼                         │
│    ┌──────────┐              ┌──────────┐                    │
│    │ Validate │──────────────►│ Generate │                   │
│    │ Password │   ✓           │   JWT    │                   │
│    └──────────┘               └─────┬────┘                   │
│                                     │                         │
│                    ┌────────────────┴──────────────┐         │
│                    │                               │         │
│              Web Response                   Mobile Response  │
│                    │                               │         │
│         ┌──────────▼──────────┐         ┌─────────▼────────┐│
│         │ Set-Cookie:         │         │ Response Body:   ││
│         │  access_token=...   │         │  {              ││
│         │  HttpOnly           │         │   access: "...", ││
│         │  Secure             │         │   refresh: "..." ││
│         │  SameSite=Lax       │         │  }              ││
│         └─────────────────────┘         └──────────────────┘│
│                                                               │
│  ┌────────────────── SUBSEQUENT REQUESTS ──────────────────┐ │
│  │                                                          │ │
│  │  Web:   Cookie: access_token=... (automatic)            │ │
│  │  Mobile: Authorization: Bearer <token> (manual)         │ │
│  │                                                          │ │
│  │  ┌─────────────────────────────────────────────┐       │ │
│  │  │    CookieJWTAuthentication (Custom)         │       │ │
│  │  │                                              │       │ │
│  │  │  1. Try cookie first (web)                  │       │ │
│  │  │  2. Fallback to Authorization header (mobile)│       │ │
│  │  │  3. Validate JWT                            │       │ │
│  │  │  4. Return user                             │       │ │
│  │  └─────────────────────────────────────────────┘       │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Custom Authentication: CookieJWTAuthentication

**File:** api/authentication.py

```python
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    """
    Dual strategy JWT authentication:
    1. Primary: Read from httpOnly cookie (web apps)
    2. Fallback: Read from Authorization header (mobile apps)

    Sprint 3: Enhanced XSS protection for web applications.
    """

    def authenticate(self, request):
        """
        Try to authenticate using JWT token from cookie.
        Falls back to Authorization header if cookie not present.
        """
        # Strategy 1: Cookie-based (web app - Sprint 3)
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token is None:
            # Strategy 2: Header-based (mobile app compatibility)
            header = self.get_header(request)
            if header is None:
                return None

            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        # Validate token (same for both strategies)
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
```

### Login Implementation: LoginView

**File:** api/views.py:89-267

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from django.utils import timezone
from datetime import timedelta

class LoginView(APIView):
    """
    Sprint 3: Enhanced login with:
    - Rate limiting (20 attempts/minute per IP)
    - Account lockout (5 failed attempts = 30 min lockout)
    - Cookie-based JWT for web
    - JSON JWT for mobile
    """

    permission_classes = []  # Public endpoint

    @method_decorator(ratelimit(key='ip', rate='20/m', method='POST', block=True))
    def post(self, request):
        username_or_email = request.data.get('username')
        password = request.data.get('password')

        if not username_or_email or not password:
            return Response(
                {'message': 'Username and password required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find user by username or email
        try:
            user = User.objects.get(
                Q(username=username_or_email) | Q(email=username_or_email)
            )
        except User.DoesNotExist:
            return Response(
                {'message': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if account is locked
        now = timezone.now()
        if user.account_locked_until and user.account_locked_until > now:
            remaining = (user.account_locked_until - now).total_seconds() / 60
            return Response(
                {
                    'message': f'Account locked. Try again in {int(remaining)} minutes',
                    'locked_until': user.account_locked_until.isoformat()
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Verify password
        if user.check_password(password):
            # Reset failed attempts
            user.failed_login_attempts = 0
            user.account_locked_until = None
            user.save(update_fields=['failed_login_attempts', 'account_locked_until'])

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            # Get user company membership
            membership = UserCompanyMembership.objects.filter(
                user=user,
                is_active=True
            ).first()

            # Build response data
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'role': user.role,
                'securityRoles': user.security_roles,
                'companyId': str(membership.company.id) if membership else None,
            }

            response = Response({
                'message': 'Login successful',
                'user': user_data,
                'access': access_token,    # For mobile apps
                'refresh': refresh_token,  # For mobile apps
            }, status=status.HTTP_200_OK)

            # Sprint 3: Set httpOnly cookies for web apps
            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,  # XSS protection
                secure=not settings.DEBUG,  # HTTPS only in production
                samesite='Lax',  # CSRF protection
                max_age=3600,  # 1 hour
            )

            response.set_cookie(
                key='refresh_token',
                value=refresh_token,
                httponly=True,
                secure=not settings.DEBUG,
                samesite='Lax',
                max_age=604800,  # 7 days
            )

            return response

        else:
            # Failed login attempt
            user.failed_login_attempts += 1

            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.account_locked_until = now + timedelta(minutes=30)
                user.save(update_fields=['failed_login_attempts', 'account_locked_until'])

                return Response(
                    {'message': 'Too many failed attempts. Account locked for 30 minutes'},
                    status=status.HTTP_403_FORBIDDEN
                )

            user.save(update_fields=['failed_login_attempts'])

            remaining_attempts = 5 - user.failed_login_attempts
            return Response(
                {
                    'message': 'Invalid credentials',
                    'remaining_attempts': remaining_attempts
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
```

### Frontend: AuthContext (Sprint 3)

**File:** frontend/src/contexts/AuthContext.tsx:23-189

```typescript
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  // Sprint 3: Tokens removed - stored in httpOnly cookies
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

export const AuthContext = createContext<AuthContextType>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Sprint 3: No token check - cookies sent automatically
      const user = await authService.getCurrentUser();
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // Sprint 3: Tokens set in cookies by backend
      const response = await authService.login(username, password);

      setAuthState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });

      return response.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();

      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      // Force logout even if API call fails
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### Mobile: Token Storage

**File:** mobile/src/hooks/useAuth.ts:45-178

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector(state => state.auth);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiService.post('/api/v1/auth/login/', {
        username,
        password,
      });

      const { access, refresh, user } = response.data;

      // Store tokens in secure storage
      await AsyncStorage.setItem('access_token', access);
      await AsyncStorage.setItem('refresh_token', refresh);

      // Update Redux state
      dispatch(setUser(user));
      dispatch(setAuthenticated(true));

      return user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    // Clear tokens
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');

    // Clear Redux state
    dispatch(setUser(null));
    dispatch(setAuthenticated(false));
  };

  const refreshToken = async () => {
    try {
      const refresh = await AsyncStorage.getItem('refresh_token');
      if (!refresh) throw new Error('No refresh token');

      const response = await apiService.post('/api/v1/auth/refresh/', {
        refresh,
      });

      const { access } = response.data;
      await AsyncStorage.setItem('access_token', access);

      return access;
    } catch (error) {
      await logout();
      throw error;
    }
  };

  // Token expiry check
  const isTokenExpired = (token: string): boolean => {
    try {
      const decoded: any = jwtDecode(token);
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  return { user, isAuthenticated, login, logout, refreshToken };
};
```

### Role-Based Access Control

**Permissions:** api/permissions.py (not shown in exploration, but inferred from usage)

```python
# Frontend route protection
<Route path="/admin/*" element={
  <ProtectedRoute requiredRole="admin">
    <AdminLayout />
  </ProtectedRoute>
} />

# Backend permission classes
class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'admin'

class IsManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['manager', 'admin']

# ViewSet usage
class VenueViewSet(viewsets.ModelViewSet):
    permission_classes = [IsManagerOrAdmin]
```

---

## 7. Configuration & Integrations

### Environment Variables

**Backend:** .env in backend/

```bash
# Django Core
DJANGO_SECRET_KEY=your-secret-key-here-change-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000

# Database
DB_NAME=guard_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# JWT Settings
JWT_SECRET_KEY=your-jwt-secret-change-in-production
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# External APIs
GOOGLE_MAPS_API_KEY=AIzaSy...
DEPUTY_API_KEY=your-deputy-api-key
DEPUTY_DOMAIN=your-company.deputy.com

# Finance Integrations (OAuth)
XERO_CLIENT_ID=your-xero-client-id
XERO_CLIENT_SECRET=your-xero-client-secret
QUICKBOOKS_CLIENT_ID=your-qb-client-id
QUICKBOOKS_CLIENT_SECRET=your-qb-client-secret
SAGE_CLIENT_ID=your-sage-client-id
SAGE_CLIENT_SECRET=your-sage-client-secret

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Sentry (Error tracking)
SENTRY_DSN=https://...@sentry.io/...
```

### Django Settings

**File:** core/settings.py (selected sections)

```python
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Security
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', '').split(',')

# Apps
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',  # WebSocket
    'django_celery_beat',  # Scheduled tasks
    'django_ratelimit',

    # Project apps
    'api',
    'shifts',
    'leave_management',
    'finance_integrations',
]

# Middleware
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # MUST be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
        'CONN_MAX_AGE': 600,  # Connection pooling
    }
}

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.authentication.CookieJWTAuthentication',  # Custom Sprint 3
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

# Simple JWT Configuration (Sprint 3)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,

    # Sprint 3: Cookie settings
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SECURE': not DEBUG,  # HTTPS in production
    'AUTH_COOKIE_SAMESITE': 'Lax',
    'AUTH_COOKIE_PATH': '/',

    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('JWT_SECRET_KEY', SECRET_KEY),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Settings
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True  # Required for cookies

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Channels (WebSocket)
ASGI_APPLICATION = 'core.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(os.getenv('REDIS_HOST', 'localhost'), 6379)],
        },
    },
}

# Email
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.getenv('EMAIL_HOST_USER')

# External APIs
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
DEPUTY_API_KEY = os.getenv('DEPUTY_API_KEY')
DEPUTY_DOMAIN = os.getenv('DEPUTY_DOMAIN')

# User model
AUTH_USER_MODEL = 'api.User'
```

### Celery Configuration

**File:** core/celery_app.py

```python
from celery import Celery
from celery.schedules import crontab
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('guard')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Task routing
app.conf.update(
    task_routes={
        'api.tasks.generate_report_async': {'queue': 'reports'},
        'api.tasks.send_notification': {'queue': 'notifications'},
        'api.tasks.sync_deputy_timesheets': {'queue': 'integrations'},
        'finance_integrations.tasks.sync_invoices': {'queue': 'finance'},
    },
)

# Periodic tasks (Celery Beat)
app.conf.beat_schedule = {
    'check-shift-reminders': {
        'task': 'api.tasks.check_shift_reminders',
        'schedule': 60.0,  # Every minute
    },
    'check-sia-expiry': {
        'task': 'api.tasks.check_sia_license_expiry',
        'schedule': crontab(hour=9, minute=0),  # Daily at 9 AM
    },
    'auto-approve-shifts': {
        'task': 'api.tasks.auto_approve_completed_shifts',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1 AM
    },
    'sync-deputy-employees': {
        'task': 'api.tasks.sync_deputy_employees',
        'schedule': crontab(hour='*/6', minute=0),  # Every 6 hours
    },
    'calculate-leave-accruals': {
        'task': 'leave_management.tasks.calculate_monthly_accruals',
        'schedule': crontab(day_of_month=1, hour=0, minute=0),  # Monthly
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
```

### Frontend Configuration

**File:** frontend/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },

  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:8000'
    ),
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'fluent-ui': ['@fluentui/react-components'],
          'utils': ['axios', 'date-fns', 'formik', 'yup'],
        },
      },
    },
  },
});
```

---

## 8. API Structure & Patterns

### Complete API Hierarchy

```
/api/v1/
├── auth/
│   ├── login/                      POST   # Login with username/password
│   ├── logout/                     POST   # Logout (clear session)
│   ├── refresh/                    POST   # Refresh JWT token
│   ├── password-reset/             POST   # Request password reset
│   ├── password-reset-confirm/     POST   # Confirm reset with token
│   └── me/                         GET    # Get current user
│
├── users/
│   ├── /                           GET    # List users (filtered by company)
│   ├── /                           POST   # Create user
│   ├── /{id}/                      GET    # User detail
│   ├── /{id}/                      PUT    # Update user
│   ├── /{id}/                      DELETE # Delete user
│   └── /{id}/profile/              GET    # Get staff profile
│
├── staff-profiles/
│   ├── /                           GET    # List staff profiles
│   ├── /                           POST   # Create profile
│   ├── /{id}/                      GET    # Profile detail
│   ├── /{id}/                      PATCH  # Update profile
│   └── /{id}/sia-licenses/         GET    # Get SIA licenses
│
├── venues/
│   ├── /                           GET    # List venues
│   ├── /                           POST   # Create venue
│   ├── /{id}/                      GET    # Venue detail
│   ├── /{id}/                      PUT    # Update venue
│   ├── /{id}/                      DELETE # Delete venue
│   ├── /{id}/shifts/               GET    # Venue shifts
│   └── /{id}/verify-location/      POST   # Verify GPS coordinates
│
├── shifts/
│   ├── /                           GET    # List shifts (filtered by role)
│   ├── /                           POST   # Create shift
│   ├── /{id}/                      GET    # Shift detail
│   ├── /{id}/                      PATCH  # Update (check-in/out)
│   ├── /{id}/                      DELETE # Cancel shift
│   ├── /{id}/claim/                POST   # Claim open shift
│   ├── /{id}/approve/              POST   # Manager approve
│   ├── /{id}/reject/               POST   # Manager reject
│   ├── /{id}/checks/               GET    # Security checks
│   ├── /{id}/incidents/            GET    # Incident reports
│   ├── /open/                      GET    # Available shifts
│   ├── /my-shifts/                 GET    # Current user shifts
│   └── /calendar/                  GET    # Calendar view
│
├── shift-exchanges/
│   ├── /                           GET    # List exchanges
│   ├── /                           POST   # Request exchange
│   ├── /{id}/approve/              POST   # Approve exchange
│   └── /{id}/reject/               POST   # Reject exchange
│
├── recurring-shifts/
│   ├── /                           GET    # List recurring patterns
│   ├── /                           POST   # Create pattern
│   ├── /{id}/                      GET    # Pattern detail
│   ├── /{id}/                      PUT    # Update pattern
│   ├── /{id}/                      DELETE # Delete pattern
│   └── /{id}/generate/             POST   # Generate shifts
│
├── invoices/
│   ├── /                           GET    # List invoices
│   ├── /                           POST   # Generate invoice
│   ├── /{id}/                      GET    # Invoice detail
│   ├── /{id}/pdf/                  GET    # Download PDF
│   ├── /{id}/email/                POST   # Email invoice
│   └── /bulk-generate/             POST   # Bulk generation
│
├── leave/
│   ├── policies/                   GET    # Leave policies
│   ├── balances/                   GET    # Staff balances
│   ├── requests/                   GET    # Leave requests
│   ├── requests/                   POST   # Submit request
│   ├── requests/{id}/              GET    # Request detail
│   ├── requests/{id}/approve/      POST   # Approve request
│   ├── requests/{id}/reject/       POST   # Reject request
│   └── calendar/                   GET    # Leave calendar
│
├── attendance/
│   ├── records/                    GET    # Attendance records
│   ├── patterns/                   GET    # Pattern analysis
│   └── exceptions/                 GET    # Attendance issues
│
├── reports/
│   ├── shifts/                     GET    # Shift reports
│   ├── staff-hours/                GET    # Staff hours report
│   ├── venue-utilization/          GET    # Venue usage
│   ├── compliance/                 GET    # Compliance report
│   └── financial/                  GET    # Financial summary
│
├── deputy/
│   ├── sync-employees/             POST   # Sync Deputy employees
│   ├── sync-timesheets/            POST   # Sync timesheets
│   ├── sync-locations/             POST   # Sync locations
│   └── webhook/                    POST   # Deputy webhooks
│
├── finance-integrations/
│   ├── xero/
│   │   ├── authorize/              GET    # OAuth redirect
│   │   ├── callback/               GET    # OAuth callback
│   │   ├── sync-invoices/          POST   # Sync invoices
│   │   └── disconnect/             POST   # Disconnect
│   ├── quickbooks/
│   │   └── ...                            # Similar endpoints
│   └── sage/
│       └── ...                            # Similar endpoints
│
├── notifications/
│   ├── /                           GET    # List notifications
│   ├── /{id}/read/                 POST   # Mark as read
│   ├── /read-all/                  POST   # Mark all read
│   └── preferences/                GET    # User preferences
│
└── recruitment/
    ├── applications/               GET    # List applications
    ├── applications/               POST   # Submit application
    ├── applications/{id}/          GET    # Application detail
    ├── applications/{id}/approve/  POST   # Approve application
    └── applications/{id}/reject/   POST   # Reject application
```

### Django REST Framework Patterns

#### **ViewSet Pattern**

```python
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

class ShiftViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD + custom actions pattern
    """
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'venue', 'staff_user']
    ordering_fields = ['start_time', 'created_at']
    search_fields = ['venue__name', 'staff_user__username']

    def get_queryset(self):
        """Multi-tenant filtering"""
        # Implementation shown earlier
        pass

    def get_serializer_class(self):
        """Different serializers for different actions"""
        if self.action == 'list':
            return ShiftListSerializer  # Minimal fields
        if self.action == 'create':
            return ShiftCreateSerializer  # Validation
        return ShiftDetailSerializer  # Full fields

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """
        Custom action: POST /api/v1/shifts/{id}/claim/
        """
        shift = self.get_object()

        if shift.status != 'open':
            return Response(
                {'error': 'Shift not available'},
                status=status.HTTP_400_BAD_REQUEST
            )

        shift.staff_user = request.user
        shift.status = 'scheduled'
        shift.save()

        return Response(
            ShiftSerializer(shift).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], permission_classes=[IsManagerOrAdmin])
    def approve(self, request, pk=None):
        """
        Manager-only action: POST /api/v1/shifts/{id}/approve/
        """
        shift = self.get_object()

        if shift.status != 'pending_approval':
            return Response(
                {'error': 'Shift not pending approval'},
                status=status.HTTP_400_BAD_REQUEST
            )

        shift.status = 'approved'
        shift.approved_by = request.user
        shift.approved_at = timezone.now()
        shift.save()

        # Generate invoice
        from api.tasks import generate_invoice_for_shift
        generate_invoice_for_shift.delay(shift.id)

        return Response(
            {'message': 'Shift approved'},
            status=status.HTTP_200_OK
        )
```

#### **Serializer Pattern**

```python
from rest_framework import serializers

class ShiftSerializer(serializers.ModelSerializer):
    """
    Dual naming: snake_case (DB) ↔ camelCase (Frontend)
    """
    # Read-only computed fields
    venue_name = serializers.CharField(source='venue.name', read_only=True)
    staff_name = serializers.SerializerMethodField()
    duration_hours = serializers.SerializerMethodField()

    # Nested serializers
    venue = VenueSerializer(read_only=True)
    staff_user = UserSerializer(read_only=True)

    # Write-only fields
    venue_id = serializers.UUIDField(write_only=True)
    staff_user_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Shift
        fields = [
            'id', 'status', 'start_time', 'end_time',
            'venue', 'venue_id', 'venue_name',
            'staff_user', 'staff_user_id', 'staff_name',
            'check_in_time', 'check_out_time',
            'check_in_location', 'check_out_location',
            'start_signature', 'end_signature',
            'hourly_rate', 'actual_hours_worked', 'total_pay',
            'duration_hours', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'total_pay']

    def get_staff_name(self, obj):
        if obj.staff_user:
            return f"{obj.staff_user.first_name} {obj.staff_user.last_name}"
        return None

    def get_duration_hours(self, obj):
        if obj.check_in_time and obj.check_out_time:
            duration = obj.check_out_time - obj.check_in_time
            return round(duration.total_seconds() / 3600, 2)
        return None

    def validate_check_in_location(self, value):
        """GPS validation"""
        if not value:
            return value

        if 'latitude' not in value or 'longitude' not in value:
            raise serializers.ValidationError(
                'Location must include latitude and longitude'
            )

        # Get venue from context or instance
        venue = self.instance.venue if self.instance else None
        if venue and not venue.verify_location(
            value['latitude'],
            value['longitude']
        ):
            raise serializers.ValidationError(
                'Location too far from venue (must be within 100m)'
            )

        return value

    def create(self, validated_data):
        # Custom creation logic
        venue_id = validated_data.pop('venue_id')
        validated_data['venue'] = Venue.objects.get(id=venue_id)

        # Set company from venue
        validated_data['company'] = validated_data['venue'].company

        return super().create(validated_data)
```

### WebSocket Pattern (Django Channels)

**File:** api/consumers.py (inferred from Channels setup)

```python
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ShiftUpdatesConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket: ws://localhost:8000/ws/shifts/

    Real-time shift updates for dashboard
    """

    async def connect(self):
        # Authenticate
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close()
            return

        # Join company-specific group
        self.company_id = str(user.companies.first().id)
        await self.channel_layer.group_add(
            f'company_{self.company_id}_shifts',
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            f'company_{self.company_id}_shifts',
            self.channel_name
        )

    async def receive_json(self, content):
        """Handle incoming messages"""
        action = content.get('action')

        if action == 'subscribe_shift':
            shift_id = content.get('shift_id')
            # Subscribe to specific shift updates
            await self.channel_layer.group_add(
                f'shift_{shift_id}',
                self.channel_name
            )

    async def shift_updated(self, event):
        """Send shift update to WebSocket"""
        await self.send_json({
            'type': 'shift_update',
            'shift': event['shift_data'],
        })
```

---

## 9. Development Patterns & Recent Changes

### Code Organization Insights

#### **Monolithic api/models.py**

The `api/models.py` file is **5188 lines** with 53 models. This is unusually large for Django best practices.

**Pros:**
- All models in one place for reference
- Easy to see relationships
- No circular import issues

**Cons:**
- Difficult to navigate
- Slow file loading in IDEs
- Harder to maintain
- Merge conflicts more likely

**Recommendation:** Refactor into Django app structure:
```
api/
├── models/
│   ├── __init__.py           # Import all models
│   ├── company.py            # SecurityCompany, ComplianceProfile
│   ├── user.py               # User, StaffProfile, SIALicense
│   ├── venue.py              # Venue
│   ├── shift.py              # Shift, ShiftGroup, ShiftCheck
│   ├── leave.py              # Leave models
│   ├── financial.py          # Invoice, InvoiceItem
│   ├── integration.py        # Deputy, Finance integrations
│   └── misc.py               # Notifications, AuditLog
```

#### **Dual Serializer Pattern**

Django uses `snake_case`, JavaScript uses `camelCase`. The codebase handles this inconsistently:

```python
# Backend serializer (api/serializers.py)
class ShiftSerializer(serializers.ModelSerializer):
    # Django field: check_in_time
    check_in_time = serializers.DateTimeField()

    # Frontend expects: checkInTime
    # Solution 1: Field alias (not used here)
    # Solution 2: Manual mapping in frontend (current approach)
```

```typescript
// Frontend service (frontend/src/services/shiftService.ts)
const transformShiftFromApi = (shift: any) => ({
  id: shift.id,
  status: shift.status,
  checkInTime: shift.check_in_time,  // Manual mapping
  checkOutTime: shift.check_out_time,
  venueId: shift.venue_id,
  // ... more mappings
});
```

**Better approach:** Use DRF CamelCase Renderer:
```python
# pip install djangorestframework-camel-case
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'djangorestframework_camel_case.render.CamelCaseJSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'djangorestframework_camel_case.parser.CamelCaseJSONParser',
    ],
}
```

### Recent Feature Additions

#### **Sprint 3: Cookie-Based Authentication**

```
Commit: "feat: Implement httpOnly cookie JWT authentication"
Files changed:
- api/authentication.py (new file)
- api/views.py (LoginView updated)
- frontend/src/contexts/AuthContext.tsx (removed token state)
- core/settings.py (SIMPLE_JWT config)
```

**Impact:**
- Enhanced XSS protection
- Automatic CSRF protection
- Mobile app still uses Authorization header

#### **Leave Management System**

```
Commit: "Comprehensive leave management system and multi-tenant improvements"
Files changed:
- api/models.py (+8 models: LeavePolicy, LeaveBalance, etc.)
- leave_management/ (new app)
- frontend/src/pages/staff/LeaveRequests.tsx
```

**Features:**
- Auto-accrual calculations
- Blackout periods
- Manager approval workflow
- Attendance tracking

#### **Mobile App Addition**

```
Commit: "Add React Native mobile app with Wise-inspired UI design"
Files added:
- mobile/ (entire new directory)
- 50+ screens and components
```

**Features:**
- Offline-first with Redux Persist
- GPS-based check-in
- Digital signatures
- Camera integration

#### **Financial Integrations**

```
Commit: "Add Xero, QuickBooks, Sage OAuth integrations"
Files changed:
- finance_integrations/ (new app)
- api/models.py (+6 finance models)
```

**Features:**
- OAuth 2.0 authentication
- Automatic invoice sync
- Multi-currency support
- Tax configuration

### Testing Patterns

The codebase has test files scattered:

```
backend/
├── test_api_auth.py
├── test_password_reset.py
├── test_recurring_shift.py
├── test_mobile_incident_sync.py
└── ... (12+ test files in root)
```

**Better approach:** Organize tests:
```
backend/
├── api/
│   └── tests/
│       ├── __init__.py
│       ├── test_models.py
│       ├── test_views.py
│       └── test_serializers.py
├── shifts/
│   └── tests/
│       └── test_shift_operations.py
└── pytest.ini
```

### Performance Considerations

#### **N+1 Query Problems**

```python
# Bad: N+1 queries
shifts = Shift.objects.all()  # 1 query
for shift in shifts:
    print(shift.venue.name)    # N queries!
    print(shift.staff_user.username)  # N queries!

# Good: Prefetch related
shifts = Shift.objects.all() \
    .select_related('venue', 'staff_user', 'company') \
    .prefetch_related('checks', 'incidents')  # 1 query + prefetches
```

**Found in codebase:**
```python
# shifts/views.py:52
def get_queryset(self):
    return Shift.objects.filter(...) \
        .select_related('staff_user', 'venue', 'company')  # ✓ Good!
```

#### **Celery for Heavy Tasks**

```python
# api/tasks.py
@shared_task
def generate_report_async(report_type, start_date, end_date, user_id):
    """
    Generate heavy reports in background.
    Email PDF when complete.
    """
    # ... expensive database queries ...
    # ... PDF generation ...
    # ... email sending ...
    return report_path

# Usage in view
@action(detail=False, methods=['post'])
def generate_report(self, request):
    task = generate_report_async.delay(
        report_type=request.data['type'],
        start_date=request.data['start_date'],
        end_date=request.data['end_date'],
        user_id=request.user.id,
    )

    return Response({
        'message': 'Report generation started',
        'task_id': task.id,
    })
```

### Development Workflow

#### **Backend Development**

```bash
# Start all services
cd backend

# Terminal 1: Django
python manage.py runserver

# Terminal 2: Celery worker
celery -A core worker -l info

# Terminal 3: Celery beat (scheduled tasks)
celery -A core beat -l info

# Terminal 4: Redis
redis-server

# Database migrations
python manage.py makemigrations
python manage.py migrate

# Create test data
python manage.py shell
>>> from api.models import SecurityCompany, Venue
>>> # ... create test data ...
```

#### **Frontend Development**

```bash
cd security-staff-portal
npm run dev  # Vite dev server on port 3000
```

#### **Mobile Development**

```bash
cd mobile

# Start Metro bundler
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on physical device
expo start --tunnel  # Use ngrok tunnel
```

---

## Conclusion

This guide provides a complete understanding of the Guard security staff management system from multiple perspectives:

1. **System Overview**: Multi-tenant SaaS for security staff management
2. **Technology Stack**: Modern web + mobile stack (Django, React, React Native)
3. **Architecture**: Clean separation of concerns with multi-tenant isolation
4. **Data Models**: Complex relational schema with 53 models
5. **User Journeys**: Complete flow from mobile app to database
6. **Security**: JWT authentication with dual strategy (cookies + headers)
7. **Integrations**: Deputy, Xero, QuickBooks, Sage, Google Maps
8. **API Patterns**: RESTful with DRF ViewSets and custom actions
9. **Development**: Celery background tasks, WebSocket real-time updates

### Next Steps for New Developers

1. **Set up local environment**:
   - Install PostgreSQL, Redis
   - Create `.env` files
   - Run migrations
   - Start all services

2. **Understand core flows**:
   - Trace shift check-in flow end-to-end
   - Test GPS verification
   - Try different user roles

3. **Read key files**:
   - api/models.py (all data models)
   - shifts/views.py (core business logic)
   - mobile/src/screens/shifts/ShiftDetailsScreen.tsx (mobile UX)

4. **Contribute**:
   - Fix bugs in GitHub issues
   - Add tests for uncovered code
   - Improve documentation
   - Refactor monolithic models.py

### Resources

- **Repository**: Internal GitLab/GitHub
- **Documentation**: /docs/ directory
- **API Docs**: http://localhost:8000/swagger/
- **Design System**: Fluent UI (https://react.fluentui.dev/)
- **Django Docs**: https://docs.djangoproject.com/
- **DRF Docs**: https://www.django-rest-framework.org/
- **React Native**: https://reactnative.dev/

---

*Generated: 2025-01-05*
*Last Updated: After complete 9-step codebase exploration*