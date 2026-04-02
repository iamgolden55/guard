# Sequence Diagrams

## Overview
These six sequence diagrams capture the key end-to-end workflows in the Mead Security system. Each diagram traces the exact request/response path through the codebase, including middleware, views, models, signals, Celery tasks, and external services. These are intended for developers, QA engineers, and system architects.

## 1. Shift Check-In Flow

The check-in process enforces time windows, GPS verification, and digital signature capture before recording the attendance event.

```mermaid
sequenceDiagram
    autonumber
    actor Staff
    participant Mobile as Mobile App
    participant API as ShiftViewSet<br/>(shifts/views.py)
    participant Model as Shift Model<br/>(api/models.py)
    participant GPS as GPS Verification<br/>(Google Maps)
    participant DB as PostgreSQL
    participant Signal as Django Signals<br/>(api/signals.py)
    participant Celery as Celery Worker
    participant Push as AWS SNS<br/>Push Notifications

    Staff->>Mobile: Tap "Check In"
    Mobile->>Mobile: Capture GPS coordinates
    Mobile->>Mobile: Capture digital signature
    Mobile->>Mobile: Capture selfie photo (optional)

    Mobile->>API: POST /api/v1/shifts/{id}/check_in/<br/>{latitude, longitude, signature, photo}
    API->>API: Verify staff_user == request.user
    API->>API: Validate shift not already checked in
    API->>API: Validate check-in time window<br/>(same day + max 15 min early)

    alt Time validation fails
        API-->>Mobile: 400 "Cannot check in X minutes early"
    end

    API->>API: Validate latitude & longitude present

    API->>Model: shift.check_in(lat, lng, signature, photo)
    Model->>GPS: Verify coordinates within<br/>venue.check_radius (100m default)

    alt GPS outside radius
        GPS-->>Model: Distance exceeds radius
        Model-->>API: raise ValueError
        API-->>Mobile: 400 "Too far from venue"
    end

    GPS-->>Model: Location verified
    Model->>DB: UPDATE shift SET<br/>check_in_time=now,<br/>check_in_latitude, check_in_longitude,<br/>check_in_signature, check_in_photo,<br/>status='active'
    DB-->>Model: Shift updated

    Model-->>API: Success
    API-->>Mobile: 200 {detail: "Successfully checked in", shift: {...}}
    Mobile-->>Staff: Show "Checked In" with timer

    Note over Signal: post_save signal fires
    Signal->>Signal: Detect status changed to 'active'
    Signal->>Celery: schedule_shift_reminders.delay(shift_id)<br/>(no-op if already active)
```

## 2. Leave Request & Approval Flow

Staff submit leave requests which are validated against balances and blackout periods, then routed to managers for approval.

```mermaid
sequenceDiagram
    autonumber
    actor Staff
    actor Manager
    participant FE as Frontend / Mobile
    participant ReqAPI as LeaveRequestViewSet<br/>(leave_management/views.py)
    participant BalSvc as LeaveBalanceService<br/>(leave_management/services.py)
    participant Entitle as LeaveEntitlement<br/>Model
    participant DB as PostgreSQL

    Staff->>FE: Fill leave request form<br/>(type, start_date, end_date, reason)
    FE->>ReqAPI: POST /api/v1/leave/requests/<br/>{leave_type, start_date, end_date, reason}

    ReqAPI->>ReqAPI: Validate dates & leave type
    ReqAPI->>DB: Check for overlapping requests
    ReqAPI->>DB: Check blackout periods

    alt Blackout period active
        ReqAPI-->>FE: 400 "Leave cannot be taken during blackout period"
    end

    ReqAPI->>Entitle: Check balance availability<br/>(days_requested <= available)

    alt Insufficient balance
        ReqAPI-->>FE: 400 "Insufficient leave balance"
    end

    ReqAPI->>DB: INSERT leave_request<br/>status='pending', submitted_at=now
    ReqAPI->>Entitle: entitlement.add_pending(days_requested)
    Entitle->>DB: UPDATE pending_days += days_requested
    ReqAPI-->>FE: 201 {message: "Submitted", next_steps: "Pending manager approval"}
    FE-->>Staff: Show confirmation

    Note over Manager: Manager checks pending approvals
    Manager->>FE: Navigate to Leave Approvals
    FE->>ReqAPI: GET /api/v1/leave/requests/pending_approvals/
    ReqAPI-->>FE: List of pending requests

    alt Manager Approves
        Manager->>FE: Click Approve
        FE->>ReqAPI: POST /api/v1/leave/requests/{id}/approve/<br/>{notes}
        ReqAPI->>ReqAPI: Validate status == 'pending'
        ReqAPI->>DB: leave_request.approve(manager, notes)<br/>status='approved', approved_by=manager
        ReqAPI->>Entitle: entitlement.remove_pending(days)
        ReqAPI->>Entitle: entitlement.use_leave(days)
        Entitle->>DB: UPDATE pending_days -= days,<br/>used_days += days
        ReqAPI-->>FE: 200 {message: "Leave request approved"}
    else Manager Rejects
        Manager->>FE: Click Reject (with reason)
        FE->>ReqAPI: POST /api/v1/leave/requests/{id}/reject/<br/>{notes: "reason required"}
        ReqAPI->>ReqAPI: Validate notes not empty
        ReqAPI->>DB: leave_request.reject(manager, notes)<br/>status='rejected'
        ReqAPI->>Entitle: entitlement.remove_pending(days)
        Entitle->>DB: UPDATE pending_days -= days
        ReqAPI-->>FE: 200 {message: "Leave request rejected"}
    end
```

## 3. Shift Exchange Flow

Staff A requests to swap a shift with Staff B. After B accepts, a manager must approve before shifts are actually swapped.

```mermaid
sequenceDiagram
    autonumber
    actor StaffA as Staff A<br/>(Requesting)
    actor StaffB as Staff B<br/>(Target)
    actor Manager
    participant FE as Frontend / Mobile
    participant ExAPI as ShiftExchangeViewSet<br/>(api/views.py)
    participant Model as ShiftExchange Model
    participant Signal as Django Signals
    participant Celery as Celery Worker
    participant Push as Push Notifications

    StaffA->>FE: Request shift exchange
    FE->>ExAPI: POST /api/v1/shift-exchanges/<br/>{original_shift, target_shift, target_user, request_reason}
    ExAPI->>ExAPI: Set requesting_user = request.user
    ExAPI->>Model: Create ShiftExchange(status='pending')
    Model-->>ExAPI: Exchange created

    Note over Signal: post_save signal fires (created=True, status='pending')
    Signal->>Celery: send_exchange_status_notification.delay<br/>(exchange_id, event='created')
    Celery->>Push: Notify Staff B<br/>"New shift exchange request"
    Push-->>StaffB: Push notification

    Signal->>Celery: send_exchange_email_task.delay<br/>(exchange_id, event='created')

    ExAPI-->>FE: 201 Exchange created
    FE-->>StaffA: "Exchange request sent"

    StaffB->>FE: View exchange request
    FE->>ExAPI: GET /api/v1/shift-exchanges/{id}/

    StaffB->>FE: Accept exchange
    FE->>ExAPI: POST /api/v1/shift-exchanges/{id}/accept/<br/>{response: "I can do that shift"}
    ExAPI->>ExAPI: Verify target_user == request.user
    ExAPI->>Model: exchange.accept_by_target(response)
    Model->>Model: Set status='accepted_by_target'

    Note over Signal: post_save fires (status changed to 'accepted_by_target')
    Signal->>Celery: send_exchange_status_notification.delay<br/>(exchange_id, event='accepted')
    Celery->>Push: Notify Staff A<br/>"Your exchange was accepted"

    ExAPI-->>FE: 200 {message: "Waiting for manager approval"}

    Manager->>FE: View pending exchanges
    Manager->>FE: Approve exchange
    FE->>ExAPI: POST /api/v1/shift-exchanges/{id}/approve/<br/>{notes}
    ExAPI->>ExAPI: Verify role in ['manager', 'admin']
    ExAPI->>Model: exchange.approve(manager, notes)
    Model->>Model: Swap staff_user on both shifts
    Model->>Model: Set status='approved'

    Note over Signal: post_save fires (status changed to 'approved')
    Signal->>Celery: send_exchange_status_notification.delay<br/>(exchange_id, event='approved')
    Celery->>Push: Notify Staff A & Staff B<br/>"Exchange approved"

    ExAPI-->>FE: 200 {message: "Exchange approved successfully"}
```

## 4. Invoice Generation Flow

Admins generate invoices by selecting a staff member and date range. The system aggregates approved shifts, calculates pay, and can generate a PDF.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant FE as Admin Dashboard
    participant InvAPI as InvoiceViewSet<br/>(api/views.py)
    participant Model as Invoice Model
    participant Shift as Shift Model
    participant PayRate as PayRate Model
    participant DB as PostgreSQL
    participant PDF as PDF Generator

    Admin->>FE: Select staff member & date range
    FE->>InvAPI: GET /api/v1/invoices/preview/<br/>?staff_user_id=X&start_date=Y&end_date=Z
    InvAPI->>DB: Query approved shifts<br/>for staff in date range
    InvAPI-->>FE: Preview: shifts list, hours, estimated total

    Admin->>FE: Click "Generate Invoice"
    FE->>InvAPI: POST /api/v1/invoices/generate/<br/>{staff_user_id, start_date, end_date}

    InvAPI->>InvAPI: Validate all required fields
    InvAPI->>InvAPI: Parse dates (YYYY-MM-DD)
    InvAPI->>DB: Check for existing invoice<br/>same staff + same period

    alt Duplicate exists
        InvAPI-->>FE: 400 "Invoice already exists (ID: X)"
    end

    InvAPI->>Model: Invoice.generate_for_staff_period<br/>(staff, start, end, source='admin')
    Model->>DB: SELECT approved shifts<br/>WHERE staff_user AND date range
    Model->>PayRate: Get applicable pay rates

    loop For each approved shift
        Model->>Model: Calculate hours worked<br/>(actual_hours or scheduled hours)
        Model->>Model: Calculate amount<br/>(hours x rate, overtime, etc.)
        Model->>DB: INSERT invoice_item<br/>{shift, hours, rate, amount}
    end

    Model->>DB: INSERT invoice<br/>{staff_user, start_date, end_date,<br/>total_amount, status='pending', source='admin'}
    Model-->>InvAPI: Invoice object

    InvAPI-->>FE: 201 {invoice data}
    FE-->>Admin: Show generated invoice

    Note over Admin: Optional: Generate PDF
    Admin->>FE: Click "Download PDF"
    FE->>InvAPI: POST /api/v1/invoices/{id}/generate-pdf/
    InvAPI->>PDF: Render invoice template
    PDF->>DB: Save PDF to media/invoices/
    InvAPI-->>FE: 200 {pdf_url}
    FE-->>Admin: Download PDF

    Note over Signal: If TimeAdjustment created later...
    Note over Signal: post_save signal auto-updates<br/>invoice item amounts
```

## 5. User Authentication Flow

Login uses JWT with httpOnly cookies for XSS protection. Includes rate limiting, account lockout, and cookie-based token refresh.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as Browser / Mobile App
    participant Login as LoginView<br/>(api/views.py)
    participant DB as PostgreSQL
    participant JWT as SimpleJWT
    participant Refresh as CookieTokenRefreshView
    participant Logout as LogoutView
    participant Blacklist as Token Blacklist

    User->>Client: Enter username/email + password
    Client->>Login: POST /api/v1/login/<br/>{username, password}

    Note over Login: Rate limiting: 20/min per IP,<br/>40/hour per username

    alt Rate limited
        Login-->>Client: 429 "Too many login attempts"
    end

    Login->>DB: SELECT user WHERE<br/>username=X OR email=X

    alt User not found
        Login-->>Client: 401 "Invalid username/email or password"
    end

    Login->>Login: Check account_locked_until > now

    alt Account locked
        Login-->>Client: 403 "Account locked for N minutes"
    end

    Login->>Login: user.check_password(password)

    alt Wrong password
        Login->>DB: INCREMENT failed_login_attempts
        alt 5+ failures
            Login->>DB: SET account_locked_until = now + 30min
            Login-->>Client: 403 "Account locked for 30 minutes"
        else Under 5 failures
            Login-->>Client: 401 "Incorrect password.<br/>N attempts remaining"
        end
    end

    Login->>Login: Verify user.is_active == True
    Login->>DB: RESET failed_login_attempts = 0
    Login->>JWT: RefreshToken.for_user(user)
    JWT-->>Login: access_token + refresh_token

    Login-->>Client: 200 {user, access, refresh}<br/>+ Set-Cookie: access_token (httpOnly)<br/>+ Set-Cookie: refresh_token (httpOnly)

    Note over Client: Subsequent API requests use<br/>Authorization header OR cookies

    Note over Client: When access token expires...
    Client->>Refresh: POST /api/v1/auth/refresh/<br/>(refresh token in cookie)
    Refresh->>Refresh: Read cookie: AUTH_COOKIE_REFRESH
    Refresh->>JWT: Validate refresh token
    JWT-->>Refresh: New access_token

    alt ROTATE_REFRESH_TOKENS enabled
        Refresh->>Blacklist: Blacklist old refresh token
        Refresh->>JWT: Generate new refresh token
    end

    Refresh-->>Client: 200 + Set-Cookie: new tokens

    Note over User: Logout
    User->>Client: Click Logout
    Client->>Logout: POST /api/v1/logout/
    Logout->>Logout: Read refresh token from cookie
    Logout->>Blacklist: token.blacklist()
    Logout-->>Client: 200 "Logout successful"<br/>+ Delete-Cookie: access_token<br/>+ Delete-Cookie: refresh_token
```

## 6. Open Shift Claim & Notification Flow

When a shift is created as "open" (no staff assigned), the system automatically creates an OpenShiftRequest, notifies qualified staff, and processes claims.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    actor Staff
    participant FE as Admin Dashboard
    participant ShiftAPI as ShiftViewSet<br/>(shifts/views.py)
    participant Signal as Django Signals<br/>(api/signals.py)
    participant OSR as OpenShiftRequest Model
    participant Celery as Celery Worker
    participant Push as AWS SNS
    participant ClaimAPI as OpenShiftRequestViewSet<br/>(api/views.py)
    participant DB as PostgreSQL

    Admin->>FE: Create shift with status='open'<br/>no staff assigned
    FE->>ShiftAPI: POST /api/v1/shifts/<br/>{venue, start_time, end_time, status:'open'}
    ShiftAPI->>DB: INSERT shift (status='open', staff_user=NULL)

    Note over Signal: post_save: auto_create_open_shift_request
    Signal->>Signal: Detect created=True,<br/>status='open', staff_user=NULL
    Signal->>DB: Find admin/manager in venue's company
    Signal->>OSR: CREATE OpenShiftRequest<br/>(original_shift, requesting_user=system_user,<br/>status='open')

    Note over Signal: post_save: notify_qualified_users_of_open_shift
    Signal->>Signal: Detect created=True, status='open'
    Signal->>Celery: send_open_shift_notifications.apply_async<br/>(open_shift_request_id, countdown=5s)

    Note over Celery: Batching delay allows grouping<br/>multiple open shifts together
    Celery->>DB: Query qualified staff<br/>(availability, SIA license, proximity)
    Celery->>Push: Batch notify qualified staff<br/>"New open shift available at Venue X"
    Push-->>Staff: Push notification

    Celery->>Celery: send_open_shift_email_batch<br/>(email notifications)

    ShiftAPI-->>FE: 201 Shift created
    FE-->>Admin: "Open shift published"

    Staff->>FE: View open shifts
    FE->>ClaimAPI: GET /api/v1/open-shift-requests/<br/>(filtered to status='open')

    Staff->>FE: Claim open shift
    FE->>ClaimAPI: POST /api/v1/open-shift-requests/{id}/claim/
    ClaimAPI->>OSR: Set claimed_by=staff,<br/>status='claimed', claimed_at=now
    ClaimAPI->>DB: UPDATE open_shift_request
    ClaimAPI-->>FE: 200 "Shift claimed, awaiting approval"

    Note over Admin: Manager/Admin reviews claim
    Admin->>FE: View claimed shifts
    FE->>ClaimAPI: GET /api/v1/open-shift-requests/?status=claimed

    Admin->>FE: Approve claim
    FE->>ClaimAPI: POST /api/v1/open-shift-requests/{id}/approve/
    ClaimAPI->>OSR: Set status='approved'
    ClaimAPI->>DB: UPDATE shift SET<br/>staff_user=claimed_by,<br/>status='scheduled'

    Note over Signal: post_save on OpenShiftRequest (status='approved')
    Signal->>Celery: send_approval_email_task.delay<br/>(claim approved)

    Note over Signal: post_save on Shift (staff_user assigned)
    Signal->>Celery: Push + email notification<br/>to assigned staff

    ClaimAPI-->>FE: 200 "Claim approved"
    FE-->>Admin: Updated shift shows assigned staff
```

## Legend

| Symbol | Meaning |
|--------|---------|
| Solid arrow (`->>`) | Synchronous request or direct call |
| Dashed arrow (`-->>`) | Response or return value |
| `alt` block | Conditional branch (if/else) |
| `loop` block | Iteration over collection |
| `Note over` | Explanatory annotation |
| `autonumber` | Steps numbered sequentially |

### Participant Types

| Participant | Description |
|-------------|-------------|
| Actor (stick figure) | Human user interacting with the system |
| API ViewSet | Django REST Framework view handling HTTP requests |
| Model | Django ORM model with business logic methods |
| Signal | Django signal handler triggered by model save/delete |
| Celery Worker | Async task processor for notifications and background jobs |
| AWS SNS | Amazon Simple Notification Service for push notifications |
| PostgreSQL | Primary database |
| JWT / SimpleJWT | Token generation and validation library |

## Notes

- All API endpoints require JWT authentication except Login, Password Reset, Recruitment Apply, and Health Check
- Signals use `pre_save` to capture previous state and `post_save` to detect state changes
- Celery tasks are queued to the `notifications` queue for push/email delivery
- Open shift notifications use a configurable batching delay (`OPEN_SHIFT_NOTIFICATION_DELAY`, default 5s) to group notifications
- The `CookieTokenRefreshView` reads refresh tokens from httpOnly cookies, not request body, for XSS protection
- Account lockout triggers after 5 failed login attempts, locking for 30 minutes
- See `05_Use_Case_Diagram.md` for actor capabilities overview
- See `08_Activity_Diagrams.md` for detailed decision flows within these processes
- See `14_Security_Architecture.md` for auth and RBAC details

## Source Files

- `backend/shifts/views.py` - ShiftViewSet: check_in (line 932), check_out (line 1051), cancel (line 1116), create_multi_staff (line 1248)
- `backend/api/views.py` - LoginView (line 196), LogoutView (line 350), CookieTokenRefreshView (line 424), ShiftExchangeViewSet (line 1491), OpenShiftRequestViewSet (line 1624), InvoiceViewSet (line 1825)
- `backend/leave_management/views.py` - LeaveRequestViewSet: submit (line 820), approve (line 858), reject (line 893)
- `backend/api/signals.py` - shift assignment notifications (line 80), auto-create OpenShiftRequest (line 288), exchange notifications (line 405), invoice auto-update (line 535), shift approval emails (line 601)
- `backend/api/tasks.py` - schedule_shift_reminders (line 616), send_open_shift_notifications (line 819), send_shift_assignment_email_task (line 1402), send_shift_removal_email_task (line 1462), send_open_shift_email_batch (line 1626)
- `backend/core/celery_app.py` - Beat schedule (line 68): cleanup-old-reports (daily), cleanup-expired-report-jobs (6h)
