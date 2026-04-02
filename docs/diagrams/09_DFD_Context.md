# DFD Context Diagram - Security Staff Management System

## Overview

This Level 0 (Context) Data Flow Diagram shows the **Security Staff Management System** as a single process, surrounded by all external entities that interact with it. Data flows between the system boundary and each external actor are labeled with the types of data exchanged.

**Audience**: Business analysts, architects, and stakeholders needing a high-level view of system boundaries and external integrations.

---

## Context Diagram

```mermaid
flowchart LR
    %% External Entities (Actors)
    Staff([fa:fa-user <b>Staff Member</b><br/>Security Guards,<br/>Door Supervisors])
    Manager([fa:fa-user-tie <b>Manager</b><br/>Shift Supervisors,<br/>Team Leads])
    Admin([fa:fa-user-shield <b>Admin</b><br/>Company Owner,<br/>System Admin])
    Applicant([fa:fa-user-plus <b>Applicant</b><br/>Recruitment<br/>Candidates])

    %% External Systems
    Deputy[(<b>Deputy</b><br/>Workforce<br/>Management)]
    GoogleMaps[(<b>Google Maps</b><br/>Geocoding &<br/>Distance Matrix)]
    GoogleOAuth[(<b>Google OAuth</b><br/>Authentication<br/>Provider)]
    AppleAuth[(<b>Apple Sign-In</b><br/>Authentication<br/>Provider)]
    AWS[(<b>AWS S3</b><br/>File Storage)]
    Accounting[(<b>Xero / QuickBooks /<br/>Sage / FreeAgent</b><br/>Accounting Providers)]
    Brevo[(<b>Brevo</b><br/>Email & SMS<br/>Service)]
    ExpoPush[(<b>Expo Push / AWS SNS</b><br/>Push Notification<br/>Service)]

    %% Central System
    System{<b>Security Staff<br/>Management<br/>System</b>}

    %% Staff <-> System flows
    Staff -->|Check-in/out with GPS + Signature<br/>View shifts & earnings<br/>Claim open shifts<br/>Request shift exchange<br/>Submit leave requests<br/>Mark unavailability<br/>Complete venue checks<br/>Report incidents| System
    System -->|Shift schedules & assignments<br/>Pay stubs & invoices<br/>Leave balances & approvals<br/>Push notifications & reminders<br/>Qualification expiry alerts| Staff

    %% Manager <-> System flows
    Manager -->|Approve/reject shifts<br/>Approve leave requests<br/>Manage shift exchanges<br/>Time adjustments with signature<br/>Resolve compliance violations<br/>Review incident reports| System
    System -->|Pending approvals list<br/>Compliance warnings<br/>Attendance reports<br/>Staff lateness records<br/>Working hours metrics| Manager

    %% Admin <-> System flows
    Admin -->|Manage venues & companies<br/>Configure system settings<br/>Manage staff & pay rates<br/>Generate invoices<br/>Configure integrations<br/>Run reports & exports<br/>Manage employment types<br/>Configure compliance profiles| System
    System -->|Dashboards & analytics<br/>Scheduled reports<br/>Subscription status<br/>Integration health status<br/>Audit logs & sync logs| Admin

    %% Applicant <-> System flows
    Applicant -->|Submit recruitment application<br/>with SIA details + signature| System
    System -->|Application status| Applicant

    %% External System integrations
    System -->|Sync employee data<br/>Export timesheets| Deputy
    Deputy -->|Employee records<br/>Timesheet data| System

    System -->|Geocode venue addresses<br/>Verify check-in/out distance| GoogleMaps
    GoogleMaps -->|Coordinates<br/>Distance calculations| System

    System -->|OAuth token exchange| GoogleOAuth
    GoogleOAuth -->|User identity + tokens| System

    System -->|OAuth token exchange| AppleAuth
    AppleAuth -->|User identity + tokens| System

    System -->|Upload profile photos<br/>Upload invoice PDFs<br/>Upload documents| AWS
    AWS -->|Stored file URLs| System

    System -->|Export invoices<br/>Export payroll runs<br/>Sync contacts<br/>Map accounts & VAT codes| Accounting
    Accounting -->|Payment status<br/>Webhook events<br/>Account data| System

    System -->|Send transactional emails<br/>Send SMS notifications| Brevo

    System -->|Send push notifications<br/>Register device tokens<br/>Schedule shift reminders| ExpoPush

    %% Styling
    classDef actor fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20
    classDef external fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    classDef system fill:#FFF3E0,stroke:#E65100,stroke-width:3px,color:#BF360C

    class Staff,Manager,Admin,Applicant actor
    class Deputy,GoogleMaps,GoogleOAuth,AppleAuth,AWS,Accounting,Brevo,ExpoPush external
    class System system
```

---

## Data Flow Summary

### Human Actors

| Actor | Inbound Data (to System) | Outbound Data (from System) |
|-------|--------------------------|----------------------------|
| **Staff Member** | GPS coordinates, digital signatures, check-in/out photos, shift claims, exchange requests, leave requests, unavailability periods, venue check data, incident reports | Shift schedules, earnings estimates, invoices/pay stubs, leave balances, push notifications, qualification alerts |
| **Manager** | Shift approvals/rejections, leave approvals, time adjustments with digital signatures, exchange approvals, compliance violation resolutions, incident report reviews | Pending approval queues, compliance warnings/violations, attendance reports, working hours metrics, lateness summaries |
| **Admin** | Company configuration, venue management, staff management, pay rate configuration, system settings, integration setup, report parameters, employment types, compliance profiles, bank holidays | Dashboards, analytics, scheduled reports, subscription status, integration health, audit trails, sync logs |
| **Applicant** | Personal details, SIA license info, employment preferences, certifications, digital signature | Application status (pending/approved/rejected) |

### External Systems

| System | Data Sent | Data Received | Protocol |
|--------|-----------|---------------|----------|
| **Deputy** | Employee sync requests, timesheet queries | Employee records, timesheet data | REST API |
| **Google Maps** | Venue addresses (geocoding), staff GPS coordinates (distance matrix) | Latitude/longitude coordinates, walking distance in meters | REST API |
| **Google OAuth** | Authorization code, client credentials | Access tokens, user profile (email, name) | OAuth 2.0 |
| **Apple Sign-In** | Authorization code, client credentials | Identity token, user profile | OAuth 2.0 / JWT |
| **AWS S3** | Profile photos, invoice PDFs, license documents | Signed URLs for stored files | AWS SDK |
| **Xero / QuickBooks / Sage / FreeAgent** | Invoices, payroll runs, contact mappings, account mappings, VAT code mappings | Payment statuses, webhook events, account lists | OAuth 2.0 + REST API |
| **Brevo** | Transactional emails, SMS messages | Delivery status, bounce events | REST API |
| **Expo Push / AWS SNS** | Push notification payloads, device token registration, scheduled reminders | Delivery receipts, endpoint ARNs | REST API / AWS SDK |

---

## System Boundary

The **Security Staff Management System** boundary encompasses:

- **Django Backend** (REST API server)
- **React Frontend** (Web application)
- **React Native Mobile App** (iOS/Android)
- **PostgreSQL Database** (Primary data store)
- **Celery Workers** (Background task processing)
- **Redis** (Message broker for Celery)

Everything outside this boundary is an external entity shown in the diagram.

---

## Legend

| Shape | Meaning |
|-------|---------|
| Rounded rectangle `([...])` | External human actor |
| Cylinder `[(...)]` | External system / service |
| Diamond `{...}` | The system under analysis (process) |
| Arrow with label | Data flow with description |
| Green fill | Human actors |
| Blue fill | External systems |
| Orange fill | System boundary |

---

## Notes

- **Cross-reference**: See `10_DFD_Level1.md` for the decomposed Level 1 diagram showing internal processes and data stores.
- **Cross-reference**: See `02_Class_Diagram.md` for the data models that store and process these flows.
- **Cross-reference**: See `18_Integration_Map.md` for detailed integration specifications with each external system.
- **Cross-reference**: See `14_Security_Architecture.md` for authentication flows with Google OAuth and Apple Sign-In.
- All accounting provider integrations use encrypted OAuth tokens (`EncryptedJSONField`) stored in `ProviderConnection`.
- Push notifications are sent via both Expo Push (mobile) and AWS SNS (device token management).
- Google Maps is used for both venue geocoding (on venue save) and real-time location verification (on check-in/out).

---

## Source Files

| File | Integration Details Derived From |
|------|--------------------------------|
| `backend/api/models.py` | DeputyConfig, DeputyEmployee, DeputyTimesheet (Deputy), Venue.verify_location/update_coordinates (Google Maps), SNSDeviceToken (AWS SNS), CompanyIntegration (all integrations) |
| `backend/finance_integrations/models.py` | AccountingProvider, ProviderConnection, InvoiceExport, PayrollExport, WebhookEvent (Xero/QuickBooks/Sage/FreeAgent) |
| `backend/api/signals.py` | Push notification triggers on shift assignment/exchange/open shift |
| `backend/api/services/notification_service.py` | Push notification service (Expo Push, AWS SNS) |
| `backend/api/social_auth.py` | Google OAuth, Apple Sign-In authentication flows |
