# Security HR System - Complete Entity Relationship Diagram

## Overview

This document contains the complete ERD for the Security HR System, including:
- **Built entities** (currently in production)
- **Planned entities** (designed but not yet implemented)
- **Missing entities** (identified gaps)

---

## 1. ACTORS (User Roles)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER ROLES                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │   STAFF      │    │   MANAGER    │    │    ADMIN     │                 │
│   │  (Employee)  │    │(Venue Admin) │    │ (Sec Admin)  │                 │
│   └──────────────┘    └──────────────┘    └──────────────┘                 │
│          │                   │                   │                          │
│          │                   │                   │                          │
│   - Work shifts       - Approve shifts    - Full system access             │
│   - Submit requests   - Manage staff      - Company settings               │
│   - View earnings     - View reports      - User management                │
│   - Update profile    - Handle incidents  - Integration config             │
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │ SUPER ADMIN  │    │    CLIENT    │    │  RECRUITER   │                 │
│   │   [PLANNED]  │    │   [MISSING]  │    │  [PARTIAL]   │                 │
│   └──────────────┘    └──────────────┘    └──────────────┘                 │
│          │                   │                   │                          │
│   - Multi-company     - View-only venue   - Application mgmt               │
│   - Platform admin    - Reports access    - Candidate tracking             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CORE ENTITY RELATIONSHIP DIAGRAM

### 2.1 User & Profile Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER & PROFILE DOMAIN                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │      USER       │                                 │
│                         │─────────────────│                                 │
│                         │ PK: id          │                                 │
│                         │ email           │                                 │
│                         │ role (enum)     │                                 │
│                         │ first_name      │                                 │
│                         │ last_name       │                                 │
│                         │ phone_number    │                                 │
│                         │ is_active       │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│            ┌─────────────────────┼─────────────────────┐                   │
│            │                     │                     │                    │
│            ▼                     ▼                     ▼                    │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐         │
│   │  STAFF_PROFILE  │   │ EMERGENCY_CONTACT│   │  BANK_DETAILS   │         │
│   │─────────────────│   │─────────────────│   │─────────────────│         │
│   │ PK: id          │   │ PK: id          │   │ PK: id          │         │
│   │ FK: user_id (1) │   │ FK: user_id (n) │   │ FK: user_id (1) │         │
│   │ date_of_birth   │   │ contact_name    │   │ account_holder  │         │
│   │ ni_number       │   │ relationship    │   │ sort_code       │         │
│   │ profile_image   │   │ phone_number    │   │ account_number  │         │
│   │ address_*       │   └─────────────────┘   └─────────────────┘         │
│   └─────────────────┘                                                      │
│            │                                                                │
│            │ 1:n                                                            │
│            ▼                                                                │
│   ┌─────────────────┐   ┌─────────────────┐                                │
│   │   SIA_LICENSE   │   │ SECURITY_QUAL   │                                │
│   │─────────────────│   │─────────────────│                                │
│   │ PK: id          │   │ PK: id          │                                │
│   │ FK: user_id     │   │ FK: user_id     │                                │
│   │ license_number  │   │ qualification   │                                │
│   │ license_type    │   │ issue_date      │                                │
│   │ expiry_date     │   │ expiry_date     │                                │
│   │ is_verified     │   │ certificate_url │                                │
│   └─────────────────┘   └─────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Company & Team Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPANY & TEAM DOMAIN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │ SECURITY_COMPANY│                                                       │
│   │─────────────────│                                                       │
│   │ PK: id          │                                                       │
│   │ name            │                                                       │
│   │ registration_no │                                                       │
│   │ address         │                                                       │
│   │ is_active       │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            │ 1:n                                                            │
│            ▼                                                                │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ USER_COMPANY_   │         │      TEAM       │  [MISSING]               │
│   │ MEMBERSHIP      │         │─────────────────│                          │
│   │─────────────────│         │ PK: id          │                          │
│   │ PK: id          │   ┌────▶│ FK: company_id  │                          │
│   │ FK: user_id     │   │     │ FK: manager_id  │                          │
│   │ FK: company_id  │───┘     │ name            │                          │
│   │ role            │         │ description     │                          │
│   │ is_primary      │         └────────┬────────┘                          │
│   └─────────────────┘                  │                                   │
│                                        │ 1:n                               │
│                                        ▼                                   │
│                               ┌─────────────────┐                          │
│                               │  TEAM_MEMBER    │  [MISSING]               │
│                               │─────────────────│                          │
│                               │ PK: id          │                          │
│                               │ FK: team_id     │                          │
│                               │ FK: user_id     │                          │
│                               │ joined_date     │                          │
│                               │ role            │                          │
│                               └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Venue Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VENUE DOMAIN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │      VENUE      │                                 │
│                         │─────────────────│                                 │
│                         │ PK: id          │                                 │
│                         │ FK: company_id  │                                 │
│                         │ name            │                                 │
│                         │ address         │                                 │
│                         │ latitude        │                                 │
│                         │ longitude       │                                 │
│                         │ capacity        │                                 │
│                         │ contact_*       │                                 │
│                         │ requires_*      │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                │
│         │                        │                        │                 │
│         ▼                        ▼                        ▼                 │
│ ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│ │ VENUE_TERMS_    │    │ PREFERRED_VENUE │    │   VENUE_ZONE    │         │
│ │ ACCEPTANCE      │    │─────────────────│    │─────────────────│         │
│ │─────────────────│    │ PK: id          │    │ PK: id          │[PLANNED]│
│ │ PK: id          │    │ FK: venue_id    │    │ FK: venue_id    │         │
│ │ FK: venue_id    │    │ FK: profile_id  │    │ name            │         │
│ │ FK: user_id     │    │ preference_rank │    │ capacity        │         │
│ │ version         │    └─────────────────┘    │ security_level  │         │
│ │ accepted_at     │                           └─────────────────┘         │
│ └─────────────────┘                                                        │
│         │                                                                   │
│         │                        ┌─────────────────┐                       │
│         │                        │ VENUE_HANDOVER  │                       │
│         │                        │─────────────────│                       │
│         │                        │ PK: id          │                       │
│         └───────────────────────▶│ FK: venue_id    │                       │
│                                  │ FK: from_user   │                       │
│                                  │ FK: to_user     │                       │
│                                  │ handover_time   │                       │
│                                  │ notes           │                       │
│                                  └─────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Shift Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SHIFT DOMAIN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                   ┌─────────────────┐                 │
│   │ SHIFT_TEMPLATE  │                   │      SHIFT      │                 │
│   │─────────────────│      creates      │─────────────────│                 │
│   │ PK: id          │──────────────────▶│ PK: id          │                 │
│   │ FK: venue_id    │                   │ FK: venue_id    │                 │
│   │ day_of_week     │                   │ FK: staff_id    │                 │
│   │ start_time      │                   │ FK: template_id │                 │
│   │ end_time        │                   │ date            │                 │
│   │ required_staff  │                   │ start_time      │                 │
│   │ security_role   │                   │ end_time        │                 │
│   └─────────────────┘                   │ status          │                 │
│                                         │ check_in_time   │                 │
│                                         │ check_out_time  │                 │
│                                         │ check_in_sig    │                 │
│                                         │ check_out_sig   │                 │
│                                         └────────┬────────┘                 │
│                                                  │                          │
│            ┌─────────────────┬──────────────────┼──────────────────┐       │
│            │                 │                  │                  │        │
│            ▼                 ▼                  ▼                  ▼        │
│   ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐ ┌─────────────┐  │
│   │  SHIFT_CHECK    │ │SHIFT_STATUS │ │  SHIFT_BREAK    │ │ SHIFT_      │  │
│   │  (Abstract)     │ │  _HISTORY   │ │─────────────────│ │ EXCHANGE    │  │
│   │─────────────────│ │─────────────│ │ PK: id          │ │─────────────│  │
│   │ PK: id          │ │ PK: id      │ │ FK: shift_id    │ │ PK: id      │  │
│   │ FK: shift_id    │ │ FK: shift_id│ │ start_time      │ │ FK: shift_id│  │
│   │ timestamp       │ │ old_status  │ │ end_time        │ │ FK: from_   │  │
│   │ photo_url       │ │ new_status  │ │ break_type      │ │ FK: to_user │  │
│   │ notes           │ │ changed_by  │ │ approved_by     │ │ status      │  │
│   │ latitude        │ │ changed_at  │ └─────────────────┘ └─────────────┘  │
│   │ longitude       │ └─────────────┘      [PLANNED]                       │
│   └────────┬────────┘                                                      │
│            │                                                                │
│   ┌────────┴────────┬─────────────────┬─────────────────┐                  │
│   │                 │                 │                 │                   │
│   ▼                 ▼                 ▼                 ▼                   │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐             │
│ │FIRE_EXIT  │ │ CAPACITY  │ │  TOILET   │ │ ENFORCEMENT_    │             │
│ │  _CHECK   │ │  _CHECK   │ │  _CHECK   │ │    VISIT        │             │
│ │───────────│ │───────────│ │───────────│ │─────────────────│             │
│ │exit_name  │ │current_ct │ │location   │ │ visit_type      │             │
│ │is_clear   │ │max_capacity│ │condition  │ │ findings        │             │
│ │is_marked  │ │over_cap   │ │supplies_ok│ │ action_taken    │             │
│ └───────────┘ └───────────┘ └───────────┘ └─────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Financial Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FINANCIAL DOMAIN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │    PAY_RATE     │         │     INVOICE     │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: user_id     │    ┌───▶│ FK: user_id     │                          │
│   │ FK: venue_id    │    │    │ invoice_number  │                          │
│   │ hourly_rate     │    │    │ period_start    │                          │
│   │ overtime_rate   │    │    │ period_end      │                          │
│   │ effective_from  │    │    │ total_amount    │                          │
│   └─────────────────┘    │    │ status          │                          │
│            │             │    │ paid_date       │                          │
│            │             │    └────────┬────────┘                          │
│            │             │             │                                    │
│            │             │             │ 1:n                                │
│            │             │             ▼                                    │
│            │             │    ┌─────────────────┐                          │
│            │             │    │  INVOICE_ITEM   │                          │
│            │             │    │─────────────────│                          │
│            └─────────────┼───▶│ PK: id          │                          │
│                          │    │ FK: invoice_id  │                          │
│                          │    │ FK: shift_id    │◀──── Links to SHIFT      │
│                          │    │ FK: pay_rate_id │                          │
│                          │    │ hours_worked    │                          │
│                          │    │ amount          │                          │
│                          │    │ description     │                          │
│                          │    └─────────────────┘                          │
│                          │                                                  │
│                          │    ┌─────────────────┐                          │
│                          │    │LATENESS_RECORD  │                          │
│                          │    │─────────────────│                          │
│                          └───▶│ PK: id          │                          │
│                               │ FK: user_id     │                          │
│                               │ FK: shift_id    │                          │
│                               │ minutes_late    │                          │
│                               │ deduction_amt   │                          │
│                               │ excused         │                          │
│                               └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Leave Management Domain [PLANNED]

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LEAVE MANAGEMENT DOMAIN [PLANNED]                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  LEAVE_POLICY   │                                                       │
│   │─────────────────│                                                       │
│   │ PK: id          │                                                       │
│   │ name            │                                                       │
│   │ leave_type      │                                                       │
│   │ accrual_rate    │                                                       │
│   │ max_annual_days │                                                       │
│   │ carryover_allow │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            │ 1:n                                                            │
│            ▼                                                                │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │  LEAVE_BALANCE  │         │  LEAVE_REQUEST  │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │◀───────▶│ PK: id          │                          │
│   │ FK: user_id     │         │ FK: user_id     │                          │
│   │ FK: policy_id   │         │ FK: policy_id   │                          │
│   │ current_balance │         │ start_date      │                          │
│   │ used_this_year  │         │ end_date        │                          │
│   │ year            │         │ total_days      │                          │
│   └─────────────────┘         │ status          │                          │
│                               │ approved_by     │                          │
│                               └────────┬────────┘                          │
│                                        │                                    │
│            ┌───────────────────────────┼───────────────────────┐           │
│            │                           │                       │            │
│            ▼                           ▼                       ▼            │
│   ┌─────────────────┐        ┌─────────────────┐    ┌─────────────────┐   │
│   │LEAVE_TRANSACTION│        │ BLACKOUT_PERIOD │    │  LEAVE_ACCRUAL  │   │
│   │─────────────────│        │─────────────────│    │─────────────────│   │
│   │ PK: id          │        │ PK: id          │    │ PK: id          │   │
│   │ FK: user_id     │        │ FK: venue_id    │    │ FK: user_id     │   │
│   │ transaction_type│        │ start_date      │    │ accrual_date    │   │
│   │ amount          │        │ end_date        │    │ days_accrued    │   │
│   │ balance_before  │        │ reason          │    │ basis           │   │
│   │ balance_after   │        │ max_staff       │    └─────────────────┘   │
│   └─────────────────┘        └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.7 Attendance & Identity Domain [PLANNED]

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ATTENDANCE & IDENTITY DOMAIN [PLANNED]                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ATTENDANCE_RECORD│         │ VIRTUAL_ID_CARD │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: user_id     │         │ FK: user_id (1) │                          │
│   │ FK: shift_id    │         │ card_number     │                          │
│   │ date            │         │ qr_code_data    │                          │
│   │ scheduled_start │         │ issue_date      │                          │
│   │ actual_start    │         │ expiry_date     │                          │
│   │ scheduled_end   │         │ is_active       │                          │
│   │ actual_end      │         │ access_level    │                          │
│   │ status          │         │ photo_url       │                          │
│   │ minutes_late    │         │ emergency_contact│                         │
│   └────────┬────────┘         └─────────────────┘                          │
│            │                                                                │
│            │ 1:n                                                            │
│            ▼                                                                │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ ATTENDANCE_     │         │ ATTENDANCE_     │                          │
│   │ EXCEPTION       │         │ PATTERN         │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: attendance  │         │ FK: user_id     │                          │
│   │ exception_type  │         │ period_start    │                          │
│   │ severity        │         │ period_end      │                          │
│   │ auto_detected   │         │ attendance_%    │                          │
│   │ resolved        │         │ punctuality     │                          │
│   │ resolved_by     │         │ trend_analysis  │                          │
│   └─────────────────┘         └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.8 Compliance Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPLIANCE DOMAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │WORKING_HOURS_   │         │ COMPLIANCE_     │                          │
│   │ REGULATION      │         │ PROFILE         │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: user_id     │         │ FK: user_id     │                          │
│   │ week_start      │         │ opt_out_48hr    │                          │
│   │ total_hours     │         │ opt_out_signed  │                          │
│   │ max_weekly      │         │ night_worker    │                          │
│   │ night_hours     │         │ young_worker    │                          │
│   │ rest_periods    │         │ last_review     │                          │
│   └─────────────────┘         └────────┬────────┘                          │
│                                        │                                    │
│                                        │ 1:n                                │
│                                        ▼                                    │
│                               ┌─────────────────┐                          │
│                               │ COMPLIANCE_     │                          │
│                               │ VIOLATION       │                          │
│                               │─────────────────│                          │
│                               │ PK: id          │                          │
│                               │ FK: profile_id  │                          │
│                               │ violation_type  │                          │
│                               │ detected_at     │                          │
│                               │ severity        │                          │
│                               │ resolved        │                          │
│                               │ action_taken    │                          │
│                               └─────────────────┘                          │
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ WORKING_HOURS_  │         │ QUALIFICATION_  │                          │
│   │ METRICS         │         │ REMINDER        │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: user_id     │         │ FK: user_id     │                          │
│   │ period          │         │ reminder_type   │                          │
│   │ avg_weekly_hrs  │         │ days_before     │                          │
│   │ overtime_hours  │         │ sent_at         │                          │
│   │ compliance_score│         │ acknowledged    │                          │
│   └─────────────────┘         └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.9 Communication Domain [MISSING]

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMMUNICATION DOMAIN [MISSING]                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │   CONVERSATION  │         │     MESSAGE     │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ type (1:1/group)│◀───────▶│ FK: convo_id    │                          │
│   │ created_at      │         │ FK: sender_id   │                          │
│   │ updated_at      │         │ content         │                          │
│   └────────┬────────┘         │ sent_at         │                          │
│            │                  │ read_at         │                          │
│            │ n:m              │ message_type    │                          │
│            ▼                  └─────────────────┘                          │
│   ┌─────────────────┐                                                       │
│   │ CONVERSATION_   │                                                       │
│   │ PARTICIPANT     │         ┌─────────────────┐                          │
│   │─────────────────│         │  ANNOUNCEMENT   │                          │
│   │ PK: id          │         │─────────────────│                          │
│   │ FK: convo_id    │         │ PK: id          │                          │
│   │ FK: user_id     │         │ FK: author_id   │                          │
│   │ joined_at       │         │ title           │                          │
│   │ last_read       │         │ content         │                          │
│   │ is_muted        │         │ target_roles    │                          │
│   └─────────────────┘         │ published_at    │                          │
│                               │ expires_at      │                          │
│                               └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.10 Notification Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION DOMAIN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ SNS_DEVICE_     │         │ NOTIFICATION_   │                          │
│   │ TOKEN           │         │ PREFERENCES     │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: user_id     │         │ FK: user_id     │                          │
│   │ device_token    │         │ push_enabled    │                          │
│   │ platform        │         │ email_enabled   │                          │
│   │ endpoint_arn    │         │ sms_enabled     │                          │
│   │ is_active       │         │ shift_reminders │                          │
│   └─────────────────┘         │ approval_alerts │                          │
│                               │ quiet_hours_*   │                          │
│                               └─────────────────┘                          │
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  ACTIVITY_LOG   │  [MISSING]                                           │
│   │─────────────────│                                                       │
│   │ PK: id          │                                                       │
│   │ FK: user_id     │                                                       │
│   │ action_type     │                                                       │
│   │ entity_type     │                                                       │
│   │ entity_id       │                                                       │
│   │ description     │                                                       │
│   │ metadata (JSON) │                                                       │
│   │ ip_address      │                                                       │
│   │ created_at      │                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.11 Incident & Reporting Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INCIDENT & REPORTING DOMAIN                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ INCIDENT_REPORT │         │  CAPACITY_FLOW  │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: shift_id    │         │ FK: shift_id    │                          │
│   │ FK: reported_by │         │ FK: venue_id    │                          │
│   │ FK: venue_id    │         │ timestamp       │                          │
│   │ incident_type   │         │ count_in        │                          │
│   │ description     │         │ count_out       │                          │
│   │ severity        │         │ current_total   │                          │
│   │ occurred_at     │         └─────────────────┘                          │
│   │ witnesses       │                                                       │
│   │ action_taken    │                                                       │
│   │ follow_up_req   │                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ REPORT_TEMPLATE │         │   REPORT_JOB    │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │◀───────▶│ PK: id          │                          │
│   │ name            │         │ FK: template_id │                          │
│   │ report_type     │         │ FK: created_by  │                          │
│   │ template_config │         │ parameters      │                          │
│   │ output_format   │         │ status          │                          │
│   └─────────────────┘         │ result_file     │                          │
│                               │ completed_at    │                          │
│                               └─────────────────┘                          │
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │SCHEDULED_REPORT │         │ EXPORT_CONFIG   │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │         │ PK: id          │                          │
│   │ FK: template_id │         │ FK: user_id     │                          │
│   │ schedule (cron) │         │ export_type     │                          │
│   │ recipients      │         │ field_mapping   │                          │
│   │ next_run        │         │ filters         │                          │
│   │ is_active       │         │ format          │                          │
│   └─────────────────┘         └─────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.12 Recruitment Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECRUITMENT DOMAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ EMPLOYMENT_TYPE │         │  RECRUITMENT_   │                          │
│   │─────────────────│         │  APPLICATION    │                          │
│   │ PK: id          │         │─────────────────│                          │
│   │ name            │◀───────▶│ PK: id          │                          │
│   │ description     │         │ FK: emp_type_id │                          │
│   │ benefits        │         │ first_name      │                          │
│   │ contract_type   │         │ last_name       │                          │
│   └─────────────────┘         │ email           │                          │
│                               │ phone           │                          │
│                               │ status          │                          │
│                               │ cv_url          │                          │
│                               │ interview_date  │                          │
│                               │ notes           │                          │
│                               └─────────────────┘                          │
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │ TRAINING_SESSION│  [PLANNED]                                           │
│   │─────────────────│                                                       │
│   │ PK: id          │                                                       │
│   │ FK: staff_id    │                                                       │
│   │ FK: instructor  │                                                       │
│   │ training_type   │                                                       │
│   │ scheduled_date  │                                                       │
│   │ completion_date │                                                       │
│   │ status          │                                                       │
│   │ score           │                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.13 Integration Domain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION DOMAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  DEPUTY_CONFIG  │                                                       │
│   │─────────────────│                                                       │
│   │ PK: id          │                                                       │
│   │ api_url         │                                                       │
│   │ access_token    │                                                       │
│   │ sync_enabled    │                                                       │
│   │ last_sync       │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            │ 1:n                                                            │
│            ▼                                                                │
│   ┌─────────────────┐         ┌─────────────────┐                          │
│   │ DEPUTY_EMPLOYEE │         │DEPUTY_TIMESHEET │                          │
│   │─────────────────│         │─────────────────│                          │
│   │ PK: id          │◀───────▶│ PK: id          │                          │
│   │ FK: user_id     │         │ FK: deputy_emp  │                          │
│   │ deputy_id       │         │ FK: shift_id    │                          │
│   │ employee_data   │         │ deputy_ts_id    │                          │
│   │ last_synced     │         │ sync_status     │                          │
│   └─────────────────┘         │ last_synced     │                          │
│                               └─────────────────┘                          │
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │COMPANY_INTEGR.  │                                                       │
│   │─────────────────│                                                       │
│   │ PK: id          │                                                       │
│   │ FK: company_id  │                                                       │
│   │ provider        │                                                       │
│   │ credentials     │                                                       │
│   │ settings        │                                                       │
│   │ is_active       │                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. COMPLETE RELATIONSHIP SUMMARY

### 3.1 All Relationships (Built + Planned + Missing)

| # | From Entity | Relationship | To Entity | Status |
|---|-------------|--------------|-----------|--------|
| 1 | User | 1:1 | StaffProfile | Built |
| 2 | User | 1:n | EmergencyContact | Built |
| 3 | User | 1:1 | BankDetails | Built |
| 4 | User | 1:n | SIALicense | Built |
| 5 | User | 1:n | SecurityQualification | Built |
| 6 | User | 1:n | Shift (as staff) | Built |
| 7 | User | 1:n | Invoice | Built |
| 8 | User | 1:n | IncidentReport | Built |
| 9 | User | 1:n | LeaveRequest | Planned |
| 10 | User | 1:n | LeaveBalance | Planned |
| 11 | User | 1:1 | VirtualIDCard | Planned |
| 12 | User | 1:n | AttendanceRecord | Planned |
| 13 | User | 1:1 | ComplianceProfile | Built |
| 14 | User | 1:n | Message (as sender) | Missing |
| 15 | User | 1:n | ActivityLog | Missing |
| 16 | SecurityCompany | 1:n | UserCompanyMembership | Built |
| 17 | SecurityCompany | 1:n | Venue | Built |
| 18 | SecurityCompany | 1:n | Team | Missing |
| 19 | Team | 1:n | TeamMember | Missing |
| 20 | Team | n:1 | User (manager) | Missing |
| 21 | Venue | 1:n | Shift | Built |
| 22 | Venue | 1:n | ShiftTemplate | Built |
| 23 | Venue | 1:n | VenueTermsAcceptance | Built |
| 24 | Venue | 1:n | VenueHandover | Built |
| 25 | Venue | 1:n | VenueZone | Planned |
| 26 | Venue | 1:n | BlackoutPeriod | Planned |
| 27 | Venue | n:m | StaffProfile (preferred) | Built |
| 28 | Shift | n:1 | Venue | Built |
| 29 | Shift | n:1 | User (staff) | Built |
| 30 | Shift | n:1 | ShiftTemplate | Built |
| 31 | Shift | 1:n | ShiftCheck (all types) | Built |
| 32 | Shift | 1:n | ShiftStatusHistory | Built |
| 33 | Shift | 1:n | ShiftExchange | Built |
| 34 | Shift | 1:n | OpenShiftRequest | Built |
| 35 | Shift | 1:n | ShiftBreak | Planned |
| 36 | Shift | 1:1 | AttendanceRecord | Planned |
| 37 | Shift | 1:n | InvoiceItem | Built |
| 38 | Invoice | 1:n | InvoiceItem | Built |
| 39 | Invoice | n:1 | User | Built |
| 40 | LeavePolicy | 1:n | LeaveRequest | Planned |
| 41 | LeavePolicy | 1:n | LeaveBalance | Planned |
| 42 | Conversation | 1:n | Message | Missing |
| 43 | Conversation | n:m | User (participants) | Missing |

---

## 4. ENTITY STATUS LEGEND

| Status | Meaning | Count |
|--------|---------|-------|
| **Built** | Currently in production | 42 |
| **Planned** | Designed, not implemented | 18 |
| **Missing** | Gap identified, needs design | 8 |

---

## 5. PRIORITY IMPLEMENTATION ORDER

### Immediate (Missing from whiteboard but critical)
1. **Team** & **TeamMember** - Core organizational structure
2. **ActivityLog** - Audit trail for compliance
3. **Message** & **Conversation** - Staff communication

### Phase 1 (Planned - High Priority)
4. **LeavePolicy**, **LeaveRequest**, **LeaveBalance** - Leave management
5. **VirtualIDCard** - Staff identity
6. **AttendanceRecord**, **AttendancePattern** - Attendance tracking

### Phase 2 (Planned - Medium Priority)
7. **ShiftBreak** - Break management
8. **VenueZone** - Zone management
9. **TrainingSession** - Training tracking

### Phase 3 (Enhancement)
10. **DigitalSignature** - Approval workflows
11. **SecurityCheckTemplate** - Customizable checks
12. **LeaveGamification** - Engagement features
