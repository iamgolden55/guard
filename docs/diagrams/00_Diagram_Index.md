# Security HR System - Complete Diagram Suite

## Overview

This document outlines all the diagrams needed for comprehensive system documentation. Each diagram serves a specific purpose and audience.

---

## 1. STRUCTURAL DIAGRAMS

### 1.1 Entity Relationship Diagram (ERD)
**File**: `01_ERD_Complete.md`
**Purpose**: Shows all data entities and their relationships
**Audience**: Developers, Database Admins, Architects
**Status**: Created
**Tools**: dbdiagram.io, draw.io, Lucidchart, Mermaid

### 1.2 Class Diagram
**File**: `02_Class_Diagram.md`
**Purpose**: Shows classes, attributes, methods, and inheritance
**Audience**: Backend Developers
**Status**: Created
**Contents**:
- Model classes with fields and methods
- Abstract base classes (ShiftCheck)
- Manager classes
- Inheritance hierarchies

### 1.3 Component Diagram
**File**: `03_Component_Diagram.md`
**Purpose**: Shows system components and their dependencies
**Audience**: Architects, DevOps
**Status**: Created
**Contents**:
```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SECURITY HR SYSTEM                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   MOBILE APP    │    │   WEB PORTAL    │    │  ADMIN PANEL    │     │
│  │  (React Native) │    │    (React)      │    │    (React)      │     │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘     │
│           │                      │                      │               │
│           └──────────────────────┼──────────────────────┘               │
│                                  │                                      │
│                                  ▼                                      │
│                    ┌─────────────────────────┐                         │
│                    │       API GATEWAY       │                         │
│                    │    (Django REST API)    │                         │
│                    └────────────┬────────────┘                         │
│                                 │                                       │
│         ┌───────────────────────┼───────────────────────┐              │
│         │                       │                       │               │
│         ▼                       ▼                       ▼               │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │  AUTH       │      │  BUSINESS       │      │  INTEGRATION    │    │
│  │  SERVICE    │      │  LOGIC          │      │  SERVICE        │    │
│  │ (JWT/OAuth) │      │  (Django)       │      │  (Deputy, etc)  │    │
│  └──────┬──────┘      └────────┬────────┘      └────────┬────────┘    │
│         │                      │                        │              │
│         └──────────────────────┼────────────────────────┘              │
│                                │                                       │
│                                ▼                                       │
│                    ┌─────────────────────────┐                         │
│                    │      DATABASE           │                         │
│                    │     (PostgreSQL)        │                         │
│                    └─────────────────────────┘                         │
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                  │
│  │    REDIS    │   │   AWS SNS   │   │   CELERY    │                  │
│  │   (Cache)   │   │   (Push)    │   │  (Tasks)    │                  │
│  └─────────────┘   └─────────────┘   └─────────────┘                  │
│                                                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Deployment Diagram
**File**: `04_Deployment_Diagram.md`
**Purpose**: Shows physical deployment architecture
**Audience**: DevOps, Infrastructure Team
**Status**: Created
**Contents**:
- Server environments (Dev, Staging, Production)
- Load balancers
- Database clusters
- CDN configuration
- SSL/TLS setup

---

## 2. BEHAVIORAL DIAGRAMS

### 2.1 Use Case Diagram
**File**: `05_Use_Case_Diagram.md`
**Purpose**: Shows actors and their interactions with the system
**Audience**: Business Analysts, Stakeholders, QA
**Status**: Created
**Contents**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│                         USE CASE DIAGRAM                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────┐                                           ┌─────────┐        │
│  │  STAFF  │                                           │ MANAGER │        │
│  └────┬────┘                                           └────┬────┘        │
│       │                                                     │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         View My Schedule              │       │             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         Check In/Out Shift            │       │             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         Submit Leave Request          │◀──────┤             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         Request Shift Exchange        │       │             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         Complete Shift Checks         │       │             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         Report Incident               │◀──────┤             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       ├───▶│         View Earnings/Invoices        │       │             │
│       │    └───────────────────────────────────────┘       │             │
│       │    ┌───────────────────────────────────────┐       │             │
│       └───▶│         Update Profile                │       │             │
│            └───────────────────────────────────────┘       │             │
│                                                            │             │
│            ┌───────────────────────────────────────┐       │             │
│            │         Approve Shifts                │◀──────┤             │
│            └───────────────────────────────────────┘       │             │
│            ┌───────────────────────────────────────┐       │             │
│            │         Manage Staff Schedules        │◀──────┤             │
│            └───────────────────────────────────────┘       │             │
│            ┌───────────────────────────────────────┐       │             │
│            │         Review Leave Requests         │◀──────┤             │
│            └───────────────────────────────────────┘       │             │
│            ┌───────────────────────────────────────┐       │             │
│            │         Generate Reports              │◀──────┤             │
│            └───────────────────────────────────────┘       │             │
│                                                            │             │
│  ┌─────────┐                                               │             │
│  │  ADMIN  │───────────────────────────────────────────────┘             │
│  └────┬────┘                                                             │
│       │    ┌───────────────────────────────────────┐                     │
│       ├───▶│         Manage Users                  │                     │
│       │    └───────────────────────────────────────┘                     │
│       │    ┌───────────────────────────────────────┐                     │
│       ├───▶│         Manage Venues                 │                     │
│       │    └───────────────────────────────────────┘                     │
│       │    ┌───────────────────────────────────────┐                     │
│       ├───▶│         Configure Integrations        │                     │
│       │    └───────────────────────────────────────┘                     │
│       │    ┌───────────────────────────────────────┐                     │
│       ├───▶│         Process Invoices              │                     │
│       │    └───────────────────────────────────────┘                     │
│       │    ┌───────────────────────────────────────┐                     │
│       └───▶│         System Settings               │                     │
│            └───────────────────────────────────────┘                     │
│                                                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Sequence Diagrams
**File**: `06_Sequence_Diagrams.md`
**Purpose**: Shows time-ordered interactions between components
**Audience**: Developers, QA
**Status**: Created

**Key Sequences to Document**:

1. **Shift Check-In Flow**
```
┌──────┐      ┌──────────┐      ┌─────────┐      ┌──────────┐      ┌────────┐
│Staff │      │Mobile App│      │   API   │      │  Venue   │      │Database│
└──┬───┘      └────┬─────┘      └────┬────┘      └────┬─────┘      └───┬────┘
   │               │                 │                │                │
   │  Tap Check-In │                 │                │                │
   │──────────────▶│                 │                │                │
   │               │  Get Location   │                │                │
   │               │────────────────▶│                │                │
   │               │                 │  Verify GPS    │                │
   │               │                 │───────────────▶│                │
   │               │                 │  Location OK   │                │
   │               │                 │◀───────────────│                │
   │               │  Capture Sign   │                │                │
   │               │────────────────▶│                │                │
   │               │                 │  Save Check-In │                │
   │               │                 │───────────────────────────────▶│
   │               │                 │  Confirmed     │                │
   │               │                 │◀───────────────────────────────│
   │               │  Success        │                │                │
   │               │◀────────────────│                │                │
   │  Confirmed    │                 │                │                │
   │◀──────────────│                 │                │                │
```

2. **Leave Request Approval Flow**
3. **Shift Exchange Flow**
4. **Invoice Generation Flow**
5. **User Authentication Flow**
6. **Incident Reporting Flow**

### 2.3 State Diagrams
**File**: `07_State_Diagrams.md`
**Purpose**: Shows entity lifecycle and state transitions
**Audience**: Developers, Business Analysts
**Status**: Created

**Key State Machines**:

1. **Shift States**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SHIFT STATE DIAGRAM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                          ┌──────────┐                                   │
│                          │  DRAFT   │                                   │
│                          └────┬─────┘                                   │
│                               │ publish                                 │
│                               ▼                                         │
│                          ┌──────────┐                                   │
│                    ┌────▶│  OPEN    │◀────┐                            │
│                    │     └────┬─────┘     │                             │
│              release│          │ assign   │ release                     │
│                    │          ▼           │                             │
│               ┌────┴─────┐  ┌──────────┐  │                            │
│               │          │  │ ASSIGNED │──┘                            │
│               │          │  └────┬─────┘                                │
│               │          │       │ check_in                             │
│               │          │       ▼                                      │
│               │          │  ┌──────────┐                                │
│               │          │  │IN_PROGRESS│                               │
│               │          │  └────┬─────┘                                │
│               │          │       │ check_out                            │
│               │          │       ▼                                      │
│               │          │  ┌──────────┐                                │
│               │          │  │COMPLETED │                                │
│               │          │  └────┬─────┘                                │
│               │          │       │ approve                              │
│               │          │       ▼                                      │
│               │          │  ┌──────────┐      ┌──────────┐             │
│               │          │  │ APPROVED │─────▶│ INVOICED │             │
│               │          │  └──────────┘      └──────────┘             │
│               │          │                                              │
│               │          │  ┌──────────┐                                │
│               └──────────┴─▶│CANCELLED │                                │
│                             └──────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

2. **Leave Request States**
```
                         ┌──────────┐
                         │ PENDING  │
                         └────┬─────┘
                   ┌──────────┼──────────┐
                   │          │          │
                   ▼          ▼          ▼
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            │ APPROVED │ │ REJECTED │ │CANCELLED │
            └────┬─────┘ └──────────┘ └──────────┘
                 │
                 ▼
            ┌──────────┐
            │IN_PROGRESS│
            └────┬─────┘
                 │
                 ▼
            ┌──────────┐
            │COMPLETED │
            └──────────┘
```

3. **Invoice States**
4. **Shift Exchange States**
5. **Recruitment Application States**

### 2.4 Activity Diagrams
**File**: `08_Activity_Diagrams.md`
**Purpose**: Shows business process workflows
**Audience**: Business Analysts, Product Managers
**Status**: Created

**Key Processes**:
1. Staff Onboarding Process
2. Shift Scheduling Process
3. Leave Approval Process
4. Invoice Generation Process
5. Incident Response Process

---

## 3. DATA FLOW DIAGRAMS

### 3.1 Level 0 (Context Diagram)
**File**: `09_DFD_Context.md`
**Purpose**: Shows system boundaries and external entities
**Audience**: Stakeholders, Business Analysts
**Status**: Created
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT DIAGRAM (DFD Level 0)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────┐                                         ┌─────────────┐  │
│   │  STAFF  │                                         │   CLIENTS   │  │
│   │ MEMBER  │                                         │  (Venues)   │  │
│   └────┬────┘                                         └──────┬──────┘  │
│        │                                                     │         │
│        │ shifts, requests,                    reports, alerts│         │
│        │ attendance, profile                                 │         │
│        │                                                     │         │
│        ▼                                                     ▼         │
│   ┌─────────────────────────────────────────────────────────────────┐ │
│   │                                                                 │  │
│   │                    SECURITY HR SYSTEM                          │  │
│   │                                                                 │  │
│   └───────────────────────────┬─────────────────────────────────────┘ │
│        ▲                      │                      ▲                │
│        │                      │                      │                │
│        │ management,          │                      │ timesheets,    │
│        │ approvals            │                      │ employees      │
│        │                      │                      │                │
│   ┌────┴────┐                 ▼                 ┌────┴────────┐      │
│   │ MANAGER │           ┌──────────┐            │   DEPUTY    │      │
│   │ / ADMIN │           │ PAYMENT  │            │  WORKFORCE  │      │
│   └─────────┘           │ SYSTEM   │            │   SYSTEM    │      │
│                         └──────────┘            └─────────────┘      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Level 1 (System Overview)
**File**: `10_DFD_Level1.md`
**Purpose**: Shows major system processes and data stores
**Audience**: Architects, Senior Developers
**Status**: Created

### 3.3 Level 2 (Process Details)
**File**: `11_DFD_Level2.md`
**Purpose**: Detailed breakdown of each major process
**Audience**: Developers
**Status**: Created

---

## 4. ARCHITECTURE DIAGRAMS

### 4.1 System Architecture
**File**: `12_System_Architecture.md`
**Purpose**: High-level system overview
**Audience**: All technical stakeholders
**Status**: Created
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SYSTEM ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PRESENTATION LAYER                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ Mobile App   │  │  Web Portal  │  │ Admin Panel  │               │   │
│  │  │(React Native)│  │   (React)    │  │   (React)    │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API LAYER                                    │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │              Django REST Framework API                        │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │   │
│  │  │  │   Auth   │ │  Shifts  │ │  Staff   │ │ Venues   │        │   │   │
│  │  │  │ Endpoints│ │ Endpoints│ │ Endpoints│ │ Endpoints│        │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       BUSINESS LAYER                                 │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │   Shift    │ │   Leave    │ │  Invoice   │ │ Compliance │       │   │
│  │  │  Service   │ │  Service   │ │  Service   │ │  Service   │       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                   │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │   │
│  │  │   PostgreSQL   │  │     Redis      │  │   File Store   │        │   │
│  │  │   (Primary)    │  │    (Cache)     │  │    (AWS S3)    │        │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      INTEGRATION LAYER                               │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │   Deputy   │ │  AWS SNS   │ │Google Maps │ │  Wise API  │       │   │
│  │  │    API     │ │   (Push)   │ │    API     │ │ (Payments) │       │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 API Architecture
**File**: `13_API_Architecture.md`
**Purpose**: REST API structure and endpoints
**Audience**: Frontend & Backend Developers
**Status**: Created

### 4.3 Security Architecture
**File**: `14_Security_Architecture.md`
**Purpose**: Authentication, authorization, data protection
**Audience**: Security Team, Architects
**Status**: Created
**Contents**:
- JWT authentication flow
- Role-based access control matrix
- Data encryption points
- API security measures

---

## 5. UI/UX DIAGRAMS

### 5.1 Information Architecture
**File**: `15_Information_Architecture.md`
**Purpose**: Navigation structure and content hierarchy
**Audience**: UX Designers, Product Managers
**Status**: Created

### 5.2 User Flow Diagrams
**File**: `16_User_Flows.md`
**Purpose**: User journeys through the application
**Audience**: UX Designers, Developers
**Status**: Created

**Key Flows**:
1. Staff onboarding journey
2. Daily shift workflow
3. Leave request journey
4. Manager approval workflow

### 5.3 Wireframes
**File**: `17_Wireframes/` (directory)
**Purpose**: UI layout mockups
**Audience**: Designers, Developers
**Status**: Created

---

## 6. INTEGRATION DIAGRAMS

### 6.1 Third-Party Integration Map
**File**: `18_Integration_Map.md`
**Purpose**: Shows all external system connections
**Audience**: Integration Team, Architects
**Status**: Created
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      INTEGRATION MAP                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ┌─────────────────────────┐                         │
│                    │   SECURITY HR SYSTEM    │                         │
│                    └───────────┬─────────────┘                         │
│                                │                                        │
│    ┌───────────────────────────┼───────────────────────────┐           │
│    │                           │                           │            │
│    ▼                           ▼                           ▼            │
│ ┌──────────┐            ┌──────────────┐            ┌──────────┐       │
│ │  DEPUTY  │            │  GOOGLE      │            │  AWS     │       │
│ │WORKFORCE │            │  SERVICES    │            │ SERVICES │       │
│ │──────────│            │──────────────│            │──────────│       │
│ │- Employees│           │- Maps API    │            │- SNS     │       │
│ │- Timesheets│          │- OAuth       │            │- S3      │       │
│ │- Schedules│           │- Calendar    │            │- SES     │       │
│ └──────────┘            └──────────────┘            └──────────┘       │
│                                                                         │
│    ┌───────────────────────────┬───────────────────────────┐           │
│    │                           │                           │            │
│    ▼                           ▼                           ▼            │
│ ┌──────────┐            ┌──────────────┐            ┌──────────┐       │
│ │  WISE    │            │   APPLE      │            │ SENDGRID │       │
│ │ PAYMENTS │            │   SERVICES   │            │  EMAIL   │       │
│ │──────────│            │──────────────│            │──────────│       │
│ │- Payouts │            │- Sign In     │            │- Trans.  │       │
│ │- Balances│            │- Push        │            │- Marketing│      │
│ └──────────┘            └──────────────┘            └──────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 API Contract Diagrams
**File**: `19_API_Contracts.md`
**Purpose**: External API request/response formats
**Audience**: Integration Developers
**Status**: Created

---

## 7. SUMMARY: COMPLETE DIAGRAM CHECKLIST

| # | Diagram Type | File | Status | Priority |
|---|--------------|------|--------|----------|
| 1 | ERD | 01_ERD_Complete.md | Done | High |
| 2 | Class Diagram | 02_Class_Diagram.md | Done | Medium |
| 3 | Component Diagram | 03_Component_Diagram.md | Done | High |
| 4 | Deployment Diagram | 04_Deployment_Diagram.md | Done | Medium |
| 5 | Use Case Diagram | 05_Use_Case_Diagram.md | Done | High |
| 6 | Sequence Diagrams | 06_Sequence_Diagrams.md | Done | High |
| 7 | State Diagrams | 07_State_Diagrams.md | Done | High |
| 8 | Activity Diagrams | 08_Activity_Diagrams.md | Done | Medium |
| 9 | DFD Context | 09_DFD_Context.md | Done | Medium |
| 10 | DFD Level 1 | 10_DFD_Level1.md | Done | Low |
| 11 | DFD Level 2 | 11_DFD_Level2.md | Done | Low |
| 12 | System Architecture | 12_System_Architecture.md | Done | High |
| 13 | API Architecture | 13_API_Architecture.md | Done | High |
| 14 | Security Architecture | 14_Security_Architecture.md | Done | High |
| 15 | Information Architecture | 15_Information_Architecture.md | Done | Medium |
| 16 | User Flows | 16_User_Flows.md | Done | Medium |
| 17 | Wireframes | 17_Wireframes/ | Done | Medium |
| 18 | Integration Map | 18_Integration_Map.md | Done | High |
| 19 | API Contracts | 19_API_Contracts.md | Done | Medium |

---

## 8. RECOMMENDED TOOLS

| Diagram Type | Recommended Tools |
|--------------|-------------------|
| ERD | dbdiagram.io, Lucidchart, draw.io |
| UML (Class, Sequence, State) | PlantUML, Mermaid, draw.io |
| Architecture | draw.io, Lucidchart, Excalidraw |
| Wireframes | Figma, Sketch, Balsamiq |
| Data Flow | draw.io, Lucidchart |
| Flowcharts | Miro, Mermaid, draw.io |

---

## 9. MAINTENANCE SCHEDULE

- **ERD**: Update with every model change
- **Architecture Diagrams**: Update quarterly or with major changes
- **Sequence Diagrams**: Update when workflows change
- **User Flows**: Update with UI changes
- **Integration Map**: Update when adding/removing integrations
