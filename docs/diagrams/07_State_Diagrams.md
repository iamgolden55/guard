# State Diagrams - Security Staff Management System

## Overview

This document contains Mermaid `stateDiagram-v2` diagrams for the 6 key state machines in the system. Each diagram shows all valid states, transitions, triggers, and guard conditions derived from the actual Django model code.

**Audience**: Developers implementing state transitions, QA engineers writing test cases, and business analysts validating workflow correctness.

---

## 1. Shift Lifecycle

The Shift model has the most complex state machine with 10 states. Transitions are driven by staff actions (check-in/out), time-based auto-transitions, and manager approvals.

```mermaid
stateDiagram-v2
    [*] --> open : Created without staff_user
    [*] --> scheduled : Created with staff_user assigned

    open --> scheduled : Admin assigns staff_user
    open --> cancelled : Admin cancels shift

    scheduled --> active : start_time reached (auto)
    scheduled --> open : staff_user removed
    scheduled --> cancelled : Admin/manager cancels

    active --> in_progress : Staff calls check_in()<br/>with valid GPS + signature
    active --> cancelled : Admin cancels before check-in
    active --> no_show : Auto-detected: no check-in<br/>after grace period

    in_progress --> pending_approval : Staff calls check_out()<br/>with valid GPS + signature
    in_progress --> pending_approval : Auto-checkout triggered<br/>(grace period expired +<br/>venue checks complete)

    pending_approval --> approved : Manager approves<br/>OR auto-approve (location + signature valid)
    pending_approval --> rejected : Manager rejects

    approved --> [*]
    rejected --> [*]
    cancelled --> [*]
    no_show --> [*]

    note right of open
        Unassigned shifts auto-create
        OpenShiftRequest records
    end note

    note right of in_progress
        Auto-checkout conditions:
        1. Past end_time + grace_period
        2. Venue checks completed OR force_timeout (12h)
        3. System sets check_out_time = end_time
    end note

    note right of approved
        On approval:
        - Auto-generates Invoice
        - Triggers payment calculation
    end note

    note left of active
        Auto-transition from scheduled
        when start_time <= now
    end note
```

### Shift Status Choices (from code)

| Status | Display | Description |
|--------|---------|-------------|
| `open` | Open | Unassigned shift, available for claiming |
| `scheduled` | Scheduled | Staff assigned, awaiting start time |
| `active` | Active | Start time reached, awaiting check-in |
| `in_progress` | In Progress | Staff checked in, working |
| `completed` | Completed | Legacy status (not actively used in transitions) |
| `pending_approval` | Pending Approval | Staff checked out, awaiting manager review |
| `approved` | Approved | Manager approved, triggers invoicing |
| `rejected` | Rejected | Manager rejected the shift |
| `cancelled` | Cancelled | Shift cancelled by admin/manager |
| `no_show` | No Show | Staff failed to check in |

---

## 2. Leave Request Lifecycle

Leave requests flow through a standard approval workflow with draft, submission, and manager review stages.

```mermaid
stateDiagram-v2
    [*] --> draft : Staff creates request

    draft --> pending : Staff submits for approval<br/>(sets submitted_at)
    draft --> cancelled : Staff cancels draft

    pending --> approved : Manager calls approve()<br/>(sets approved_by, approved_at)
    pending --> rejected : Manager calls reject()<br/>(sets approved_by, approved_at)
    pending --> cancelled : Staff cancels pending request
    pending --> withdrawn : Staff withdraws request

    approved --> [*]
    rejected --> [*]
    cancelled --> [*]
    withdrawn --> [*]

    note right of draft
        Auto-calculates days_requested
        based on request_type:
        - full_day: end - start + 1
        - half_day: 0.5
        - hours: calculated from times
    end note

    note right of pending
        Validates:
        - No overlapping requests
        - Blackout period restrictions
        - Min notice days
        - Leave balance available
    end note

    note right of approved
        Triggers:
        - Balance deduction
        - Notification to staff
        - Blocks shift assignment
          for permanent employees
    end note
```

### Leave Request Status Choices

| Status | Display | Can Cancel? |
|--------|---------|-------------|
| `draft` | Draft | Yes |
| `pending` | Pending Approval | Yes |
| `approved` | Approved | No |
| `rejected` | Rejected | No |
| `cancelled` | Cancelled | N/A (terminal) |
| `withdrawn` | Withdrawn | N/A (terminal) |

---

## 3. Invoice Lifecycle

Invoices have a simple 3-state lifecycle, with recalculation possible while pending.

```mermaid
stateDiagram-v2
    [*] --> pending : Auto-generated from approved shift<br/>OR admin-generated for period

    pending --> paid : Admin marks as paid
    pending --> rejected : Admin rejects invoice
    pending --> pending : Recalculated from<br/>TimeAdjustment changes<br/>(version incremented)

    paid --> [*]
    rejected --> [*]

    note right of pending
        Auto-generation:
        - Triggered when Shift.status -> approved
        - Creates InvoiceItems for each shift
        - Includes bank holiday + annual leave
          items for permanent employees

        Recalculation:
        - Triggered by TimeAdjustment creation
        - Updates hours, amounts, version
        - Preserves leave items unchanged
    end note

    note left of pending
        Source types:
        - system: Auto from shift approval
        - admin: Manually created
    end note
```

### Invoice Status Choices

| Status | Display | Description |
|--------|---------|-------------|
| `pending` | Pending | Awaiting payment processing |
| `paid` | Paid | Payment completed |
| `rejected` | Rejected | Invoice rejected |

---

## 4. Shift Exchange Lifecycle

Shift exchanges involve a 3-party workflow: requesting staff, target staff, and manager. Supports optional auto-approval.

```mermaid
stateDiagram-v2
    [*] --> pending : Staff A requests exchange<br/>with Staff B

    pending --> accepted_by_target : Staff B accepts<br/>(conflicts detected OR<br/>auto-approve disabled)
    pending --> approved : Staff B accepts +<br/>auto-approve enabled +<br/>no conflicts detected
    pending --> rejected : Manager rejects
    pending --> cancelled : Staff A or B cancels

    accepted_by_target --> approved : Manager approves<br/>(swaps staff assignments)
    accepted_by_target --> rejected : Manager rejects
    accepted_by_target --> cancelled : Staff A or B cancels

    approved --> [*]
    rejected --> [*]
    cancelled --> [*]

    note right of pending
        Validates:
        - Different users
        - Shift not started
        - Target has required security role
        - No schedule conflicts
    end note

    note right of approved
        On approval:
        - Bilateral: swap staff on both shifts
        - Simple transfer: target gets original shift
        - Both shifts set to 'scheduled'
    end note

    note left of accepted_by_target
        Auto-approval check:
        1. SystemSettings.auto_approve_shift_exchanges
        2. Re-validate no conflicts
        3. If both pass -> auto approved
    end note
```

### Shift Exchange Status Choices

| Status | Display |
|--------|---------|
| `pending` | Pending |
| `accepted_by_target` | Accepted by Target User |
| `approved` | Approved |
| `rejected` | Rejected |
| `cancelled` | Cancelled |

---

## 5. Open Shift Request Lifecycle

Open shift requests manage the flow of releasing and claiming unassigned shifts.

```mermaid
stateDiagram-v2
    [*] --> open : Staff releases shift to pool<br/>OR system creates for unassigned shift

    open --> claimed : Another staff member claims<br/>(claim_shift called,<br/>sets claimed_by + claim_time)
    open --> cancelled : Original requester cancels<br/>OR admin assigns staff directly

    claimed --> approved : Manager approves claim<br/>(reassigns shift.staff_user,<br/>sets shift.status = scheduled)
    claimed --> rejected : Manager rejects claim
    claimed --> cancelled : Requester or claimer cancels

    approved --> [*]
    rejected --> [*]
    cancelled --> [*]

    note right of open
        Validates on claim:
        - Status is still 'open'
        - Claimer != requesting_user
        - Claimer has required security role
        - No schedule conflicts
        - Staff profile approved + valid SIA
    end note

    note right of cancelled
        Auto-cancelled when:
        - Admin directly assigns staff to shift
        - Shift status changes from 'open'
    end note
```

### Open Shift Request Status Choices

| Status | Display |
|--------|---------|
| `open` | Open |
| `claimed` | Claimed |
| `approved` | Approved |
| `rejected` | Rejected |
| `cancelled` | Cancelled |

---

## 6. Compliance Violation Resolution Lifecycle

Compliance violations track the investigation and resolution of regulatory breaches.

```mermaid
stateDiagram-v2
    [*] --> open : System detects violation<br/>(auto-generated) OR<br/>manager reports manually

    open --> investigating : Manager begins investigation
    open --> false_positive : Dismissed as false positive
    open --> dismissed : Manager dismisses

    investigating --> pending_approval : Investigation complete,<br/>needs approval for exception
    investigating --> resolved : Investigation resolved<br/>(no exception needed)
    investigating --> false_positive : Found to be false positive

    pending_approval --> approved_exception : Senior manager approves<br/>exception (sets exception_granted,<br/>approved_by, exception_reason)
    pending_approval --> resolved : Exception denied,<br/>resolved normally

    resolved --> [*]
    approved_exception --> [*]
    false_positive --> [*]
    dismissed --> [*]

    note right of open
        Violation types:
        - daily_overtime, weekly_overtime
        - consecutive_days
        - insufficient_rest
        - missing_break
        - location_violation
        - unauthorized_overtime
        - shift_abandonment
        - documentation_missing
    end note

    note right of open
        Severity levels:
        info < warning < minor < major < critical
    end note

    note left of investigating
        Tracks:
        - financial_impact (overtime costs)
        - compliance_score_impact
        - evidence_data (JSON)
        - related_shifts (M2M)
    end note
```

### Compliance Violation Resolution Status Choices

| Status | Display | Is Resolved? |
|--------|---------|-------------|
| `open` | Open | No |
| `investigating` | Under Investigation | No |
| `pending_approval` | Pending Manager Approval | No |
| `approved_exception` | Approved as Exception | Yes |
| `resolved` | Resolved | Yes |
| `false_positive` | False Positive | Yes |
| `dismissed` | Dismissed | Yes |

---

## Supplementary: Recruitment Application States

```mermaid
stateDiagram-v2
    [*] --> pending : Applicant submits form<br/>with digital signature

    pending --> approved : Admin approves<br/>(sets reviewed_by, reviewed_at)
    pending --> rejected : Admin rejects<br/>(sets reviewed_by, reviewed_at)

    approved --> converted : Admin calls convert_to_user()<br/>Creates User + StaffProfile +<br/>UserCompanyMembership + SIALicense

    converted --> [*]
    rejected --> [*]

    note right of approved
        Conversion creates:
        1. User (role=staff)
        2. StaffProfile (is_approved=True)
        3. UserCompanyMembership
        4. SIALicense(s) from application
        5. SecurityQualification(s)
    end note
```

---

## Supplementary: Provider Connection States

```mermaid
stateDiagram-v2
    [*] --> pending : Connection created

    pending --> connected : OAuth flow completed<br/>(tokens stored)
    pending --> error : OAuth flow failed

    connected --> expired : Token expires<br/>(token_expires_at < now)
    connected --> error : API error occurs
    connected --> disabled : Admin disables connection

    expired --> connected : Token refreshed successfully
    expired --> error : Token refresh fails

    error --> connected : Issue resolved,<br/>reconnected successfully
    error --> disabled : Admin disables

    disabled --> pending : Admin re-enables

    note right of connected
        Active connection enables:
        - Invoice export
        - Payroll export
        - Webhook processing
        - Contact sync
    end note
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `[*]` | Initial or final state |
| Solid arrow | Valid state transition |
| Text on arrow | Trigger / guard condition |
| Note blocks | Additional context, validation rules, side effects |
| `<br/>` | Line break within label |

### Transition Triggers Summary

| Trigger Type | Examples |
|-------------|----------|
| **User Action** | check_in(), check_out(), approve(), reject(), cancel() |
| **Time-Based** | Auto-transition when start_time reached, auto-checkout after grace period |
| **System Auto** | Auto-approve on location + signature match, auto-generate invoice on approval |
| **Manager Action** | Approve/reject shifts, leave requests, exchanges, violations |

---

## Notes

- **Cross-reference**: See `02_Class_Diagram.md` for full model field details and relationships.
- **Cross-reference**: See `06_Sequence_Diagrams.md` for the complete interaction flows that drive these state transitions.
- **Cross-reference**: See `08_Activity_Diagrams.md` for business process flows incorporating these states.
- The Shift state machine is the most complex, with auto-transitions driven by `Shift.save()` method logic.
- Auto-checkout is controlled by `SystemSettings.auto_checkout_enabled` and `auto_checkout_grace_period`.
- Shift exchange auto-approval is controlled by `SystemSettings.auto_approve_shift_exchanges`.
- The `completed` status exists in Shift STATUS_CHOICES but is not actively used in current transition logic.

---

## Source Files

| File | State Machines Derived From |
|------|---------------------------|
| `backend/api/models.py` | Shift (lines 1610-2349), ShiftExchange (lines 2526-2695), OpenShiftRequest (lines 1480-1608), Invoice (lines 2697-2948), RecruitmentApplication (lines 3812-4051), ComplianceViolation (lines 4683-4900) |
| `backend/leave_management/models.py` | LeaveRequest (lines 430-676) |
| `backend/finance_integrations/models.py` | ProviderConnection (lines 76-122) |
