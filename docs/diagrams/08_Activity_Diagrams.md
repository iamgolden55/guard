# Activity Diagrams

## Overview
These five activity diagrams model the decision flows and branching logic within the key business processes of the Mead Security system. Each diagram is derived from the actual view logic, model methods, and signal handlers in the codebase. They are intended for developers, product managers, and QA engineers to understand the exact conditions that govern each process.

## 1. Company Onboarding Process

The multi-step onboarding wizard that creates a new company, sets up configuration, and activates a 14-day trial.

```mermaid
flowchart TD
    Start([User clicks "Get Started"])

    Start --> CheckExisting{User has existing<br/>company membership?}

    CheckExisting -->|Yes, incomplete| ResumeOnboarding[Resume existing<br/>onboarding session]
    CheckExisting -->|Yes, completed| RedirectDash[Redirect to Dashboard<br/>400 Error]
    CheckExisting -->|No| InitiateStep

    subgraph Step1 ["Step 1: Company Info"]
        InitiateStep[POST /onboarding/initiate/<br/>Submit company name & data]
        InitiateStep --> ValidateCompany{Company data valid?}
        ValidateCompany -->|No| ShowErrors1[Show validation errors]
        ShowErrors1 --> InitiateStep
        ValidateCompany -->|Yes| CreateCompany[Create SecurityCompany]
        CreateCompany --> TrialSignal["Signal: setup_trial_period<br/>is_trial=True<br/>trial_end_date = now + 14 days"]
        TrialSignal --> CreateMembership[Create UserCompanyMembership<br/>role='owner', is_owner=True]
        CreateMembership --> CreateOnboarding[Create CompanyOnboarding record<br/>Mark step 1 complete]
    end

    ResumeOnboarding --> CheckStep{Which step<br/>was last completed?}
    CheckStep -->|Step 1| Step2Start
    CheckStep -->|Step 2| Step3Start
    CheckStep -->|Step 3| Step4Start

    CreateOnboarding --> Step2Start

    subgraph Step2 ["Step 2: Regional Setup"]
        Step2Start[PUT /onboarding/regional-setup/<br/>Country, timezone, currency]
        Step2Start --> ValidateRegion{Regional data valid?}
        ValidateRegion -->|No| ShowErrors2[Show validation errors]
        ShowErrors2 --> Step2Start
        ValidateRegion -->|Yes| SaveRegion[Update company regional settings<br/>Mark step 2 complete]
    end

    SaveRegion --> Step3Start

    subgraph Step3 ["Step 3: Staff Configuration"]
        Step3Start[PUT /onboarding/staff-config/<br/>Employment types, roles, SIA requirements]
        Step3Start --> ValidateStaff{Config valid?}
        ValidateStaff -->|No| ShowErrors3[Show validation errors]
        ShowErrors3 --> Step3Start
        ValidateStaff -->|Yes| SaveStaff[Save staff configuration<br/>Create employment types<br/>Mark step 3 complete]
    end

    SaveStaff --> Step4Start

    subgraph Step4 ["Step 4: Integrations"]
        Step4Start[PUT /onboarding/integrations/<br/>Deputy, Xero, notifications]
        Step4Start --> SaveIntegrations[Save integration preferences<br/>Mark step 4 complete]
    end

    SaveIntegrations --> Complete

    subgraph Completion ["Complete Onboarding"]
        Complete[POST /onboarding/complete/]
        Complete --> ValidateAllSteps{All 4 steps<br/>completed?}
        ValidateAllSteps -->|No| Error400[400: Complete previous steps first]
        ValidateAllSteps -->|Yes| MarkComplete[Set is_completed=True<br/>completed_at=now]
        MarkComplete --> RedirectDashboard[Redirect to Company Dashboard]
    end

    RedirectDash --> End([End])
    RedirectDashboard --> End
```

## 2. Shift Lifecycle & Scheduling

The full lifecycle of a shift from creation through scheduling, check-in/out, approval, and invoicing.

```mermaid
flowchart TD
    Start([Admin/Manager creates shift])

    Start --> ShiftType{Shift type?}

    ShiftType -->|Assigned| CreateAssigned["Create shift<br/>status='scheduled'<br/>staff_user=selected"]
    ShiftType -->|Open| CreateOpen["Create shift<br/>status='open'<br/>staff_user=NULL"]
    ShiftType -->|Multi-staff| CreateMulti["POST /shifts/create_multi_staff/<br/>Create grouped shifts"]

    CreateAssigned --> SignalAssign["Signal: notify_shift_assignment<br/>Push + Email to staff"]
    SignalAssign --> ScheduleReminders["Celery: schedule_shift_reminders<br/>24h + 1h before"]

    CreateOpen --> SignalOpen["Signal: auto_create_open_shift_request<br/>Create OpenShiftRequest"]
    SignalOpen --> NotifyQualified["Celery: send_open_shift_notifications<br/>Batch notify qualified staff<br/>(5s delay for batching)"]
    NotifyQualified --> WaitClaim[Wait for staff to claim]
    WaitClaim --> StaffClaims["Staff claims shift<br/>status='claimed'"]
    StaffClaims --> ManagerReview{Manager reviews claim}
    ManagerReview -->|Approve| AssignClaimed["Assign staff_user<br/>status='scheduled'"]
    ManagerReview -->|Reject| RejectClaim["status='rejected'<br/>Re-open shift"]
    RejectClaim --> WaitClaim
    AssignClaimed --> SignalAssign

    CreateMulti --> SignalAssign

    ScheduleReminders --> WaitStart[Shift day arrives]

    WaitStart --> StaffCheckIn{"Staff taps Check In<br/>POST /shifts/{id}/check_in/"}

    StaffCheckIn --> ValidateUser{staff_user ==<br/>request.user?}
    ValidateUser -->|No| Forbidden403[403 Forbidden]
    ValidateUser -->|Yes| AlreadyIn{Already<br/>checked in?}
    AlreadyIn -->|Yes| Error400a[400 Already checked in]
    AlreadyIn -->|No| ValidateTime{Within check-in window?<br/>Same day + max 15 min early}
    ValidateTime -->|Too early| Error400b["400 'Cannot check in<br/>X minutes early'"]
    ValidateTime -->|Wrong day| Error400c["400 'Cannot check in<br/>for different date'"]
    ValidateTime -->|Valid| ValidateGPS{GPS coords within<br/>venue.check_radius?}
    ValidateGPS -->|No| Error400d["400 'Too far from venue'"]
    ValidateGPS -->|Yes| RecordCheckIn["Record check-in<br/>status='active'<br/>Save GPS, signature, photo"]

    RecordCheckIn --> DuringShift[Staff works shift<br/>Completes venue checks]

    DuringShift --> StaffCheckOut{"Staff taps Check Out<br/>POST /shifts/{id}/check_out/"}
    StaffCheckOut --> ValidateOut{Validate:<br/>assigned user,<br/>is checked in,<br/>not already out}
    ValidateOut -->|Fail| ErrorOut[400 Error message]
    ValidateOut -->|Pass| ValidateGPSOut{GPS within radius?}
    ValidateGPSOut -->|No| ErrorGPS[400 Too far from venue]
    ValidateGPSOut -->|Yes| RecordCheckOut["Record check-out<br/>status='completed'<br/>Calculate actual_hours_worked"]

    RecordCheckOut --> ManagerApproval{Manager reviews shift}
    ManagerApproval -->|Approve| ApproveShift["POST /shifts/{id}/approve/<br/>manager_approved=True<br/>status='approved'"]
    ManagerApproval -->|Reject| RejectShift[Request corrections]

    ApproveShift --> SignalApproval["Signal: notify_shift_approval<br/>Email staff about approval"]
    SignalApproval --> ReadyForInvoice[Shift ready for invoicing]

    Forbidden403 --> End([End])
    Error400a --> End
    Error400b --> End
    Error400c --> End
    Error400d --> End
    ErrorOut --> End
    ErrorGPS --> End
    ReadyForInvoice --> End
```

## 3. Leave Approval Process

Detailed decision flow from leave request submission through balance checks, blackout validation, and manager approval.

```mermaid
flowchart TD
    Start([Staff submits leave request])

    Start --> CreateRequest["POST /api/v1/leave/requests/<br/>{leave_type, start_date, end_date, reason}"]

    CreateRequest --> ValidateDates{Dates valid?<br/>end >= start?}
    ValidateDates -->|No| Error1[400 Invalid dates]

    ValidateDates -->|Yes| CheckOverlap{Overlapping requests<br/>for this user?}
    CheckOverlap -->|Yes| Error2[400 Overlapping request exists]

    CheckOverlap -->|No| CheckBlackout{Dates fall within<br/>active blackout period?}
    CheckBlackout -->|Yes| Error3[400 Blackout period restriction]

    CheckBlackout -->|No| CheckBalance{Sufficient<br/>leave balance?<br/>days_requested <= available}
    CheckBalance -->|No| Error4[400 Insufficient balance]

    CheckBalance -->|Yes| SaveRequest["Save leave request<br/>status='pending'<br/>submitted_at=now"]
    SaveRequest --> UpdatePending["Update entitlement<br/>pending_days += days_requested"]
    UpdatePending --> NotifyManager["Response: 201<br/>'Pending manager approval'"]

    NotifyManager --> ManagerView["Manager views<br/>GET /leave/requests/pending_approvals/"]

    ManagerView --> ManagerDecision{Manager decision}

    ManagerDecision -->|Approve| ApproveCheck{Status == 'pending'?}
    ApproveCheck -->|No| Error5[400 Only pending<br/>requests can be approved]
    ApproveCheck -->|Yes| ApproveRequest["POST /leave/requests/{id}/approve/<br/>leave_request.approve(manager, notes)"]
    ApproveRequest --> UpdateBalanceApprove["Update entitlement:<br/>1. remove_pending(days)<br/>2. use_leave(days)<br/>pending -= days, used += days"]
    UpdateBalanceApprove --> ResponseApprove["200 'Leave request approved'"]

    ManagerDecision -->|Reject| RejectCheck{Status == 'pending'?}
    RejectCheck -->|No| Error6[400 Only pending<br/>requests can be rejected]
    RejectCheck -->|Yes| NotesCheck{Rejection notes<br/>provided?}
    NotesCheck -->|No| Error7[400 Rejection reason required]
    NotesCheck -->|Yes| RejectRequest["POST /leave/requests/{id}/reject/<br/>leave_request.reject(manager, notes)"]
    RejectRequest --> UpdateBalanceReject["Update entitlement:<br/>remove_pending(days)<br/>pending -= days"]
    UpdateBalanceReject --> ResponseReject["200 'Leave request rejected'"]

    ManagerDecision -->|Staff cancels| CancelCheck{Can be cancelled?<br/>status in draft/pending}
    CancelCheck -->|No| Error8[400 Cannot cancel]
    CancelCheck -->|Yes| CancelRequest["POST /leave/requests/{id}/cancel/<br/>status='cancelled'"]
    CancelRequest --> UpdateBalanceCancel["Remove from pending<br/>pending -= days"]
    UpdateBalanceCancel --> ResponseCancel["200 'Leave request cancelled'"]

    Error1 --> End([End])
    Error2 --> End
    Error3 --> End
    Error4 --> End
    Error5 --> End
    Error6 --> End
    Error7 --> End
    Error8 --> End
    ResponseApprove --> End
    ResponseReject --> End
    ResponseCancel --> End
```

## 4. Invoice Generation Process

The process of generating invoices from approved shifts, including pay rate calculations, PDF generation, and auto-update on time adjustments.

```mermaid
flowchart TD
    Start([Admin initiates invoice generation])

    Start --> Preview["GET /invoices/preview/<br/>?staff_user_id & start_date & end_date"]
    Preview --> QueryShifts["Query approved shifts<br/>for staff in date range"]
    QueryShifts --> PreviewResult["Display: shifts list,<br/>total hours, estimated amount"]

    PreviewResult --> AdminConfirm{Admin confirms<br/>generation?}
    AdminConfirm -->|No| End1([Cancel])
    AdminConfirm -->|Yes| Generate["POST /invoices/generate/<br/>{staff_user_id, start_date, end_date}"]

    Generate --> ValidateFields{All required<br/>fields present?}
    ValidateFields -->|No| Error1[400 Missing fields]

    ValidateFields -->|Yes| ParseDates{Dates parse<br/>as YYYY-MM-DD?}
    ParseDates -->|No| Error2[400 Invalid date format]

    ParseDates -->|Yes| FindUser{Staff user<br/>exists?}
    FindUser -->|No| Error3[404 Staff not found]

    FindUser -->|Yes| CheckDuplicate{Invoice already<br/>exists for this<br/>staff + period?}
    CheckDuplicate -->|Yes| Error4["400 'Invoice already exists<br/>(ID: X)'"]

    CheckDuplicate -->|No| GenerateInvoice["Invoice.generate_for_staff_period()"]

    subgraph CalcLoop ["Calculate Line Items"]
        GetShifts["SELECT approved shifts<br/>WHERE staff_user AND date range"]
        GetShifts --> GetRates[Get applicable PayRate<br/>for each shift]
        GetRates --> LoopStart{More shifts<br/>to process?}
        LoopStart -->|Yes| CalcHours["Calculate hours_worked<br/>(actual_hours or scheduled)"]
        CalcHours --> CalcAmount["Calculate amount<br/>hours x rate<br/>+ overtime if applicable"]
        CalcAmount --> CreateItem["INSERT invoice_item<br/>{shift, hours, rate, amount}"]
        CreateItem --> LoopStart
        LoopStart -->|No| SumTotal["Calculate total_amount<br/>= SUM(all item amounts)"]
    end

    GenerateInvoice --> GetShifts
    SumTotal --> CreateInvoice["INSERT invoice<br/>{staff_user, dates, total,<br/>status='pending', source='admin'}"]

    CreateInvoice --> ReturnInvoice["201 Invoice data returned"]

    ReturnInvoice --> PDFDecision{Generate PDF?}
    PDFDecision -->|No| Done([Done])
    PDFDecision -->|Yes| GenPDF["POST /invoices/{id}/generate-pdf/"]
    GenPDF --> RenderTemplate[Render invoice PDF template]
    RenderTemplate --> SavePDF["Save to media/invoices/<br/>invoice_{id}.pdf"]
    SavePDF --> ReturnPDF["200 {pdf_url}"]
    ReturnPDF --> Done

    subgraph AutoUpdate ["Auto-Update on Time Adjustment"]
        TimeAdj["Signal: TimeAdjustment created"]
        TimeAdj --> FindItem{InvoiceItem exists<br/>for this shift?}
        FindItem -->|No| NoAction[No action needed<br/>Will be included later]
        FindItem -->|Yes| CheckStatus{Invoice status<br/>== 'pending'?}
        CheckStatus -->|No| SkipUpdate["Skip: Invoice already<br/>paid/rejected"]
        CheckStatus -->|Yes| Recalc["Recalculate item:<br/>hours = shift.get_effective_actual_hours()<br/>amount = shift.calculate_payment()"]
        Recalc --> RecalcTotal["invoice.recalculate_from_shifts()"]
    end

    Error1 --> End2([End])
    Error2 --> End2
    Error3 --> End2
    Error4 --> End2
```

## 5. Incident Response Process

The workflow for reporting, classifying, and resolving security incidents at venues.

```mermaid
flowchart TD
    Start([Security staff detects incident])

    Start --> OnShift{Staff currently<br/>on active shift?}
    OnShift -->|No| ContactManager[Contact manager directly]
    OnShift -->|Yes| CreateReport["Create Incident Report<br/>at current venue"]

    CreateReport --> CaptureDetails["Capture details:<br/>- incident_time<br/>- description<br/>- actions_taken"]

    CaptureDetails --> ClassifySeverity{Classify severity}

    ClassifySeverity -->|Low| SetLow["severity='low'<br/>Minor issue, no immediate risk"]
    ClassifySeverity -->|Medium| SetMedium["severity='medium'<br/>Requires attention"]
    ClassifySeverity -->|High| SetHigh["severity='high'<br/>Significant safety concern"]
    ClassifySeverity -->|Critical| SetCritical["severity='critical'<br/>Immediate danger"]

    SetLow --> FollowupCheck
    SetMedium --> FollowupCheck
    SetHigh --> FollowupCheck
    SetCritical --> FollowupCheck

    FollowupCheck{Requires follow-up?}
    FollowupCheck -->|Yes| SetFollowup["requires_followup=True<br/>Add followup_notes"]
    FollowupCheck -->|No| SkipFollowup["requires_followup=False"]

    SetFollowup --> SaveReport
    SkipFollowup --> SaveReport

    SaveReport["Save IncidentReport<br/>linked to venue + shift + staff<br/>resolved=False"]

    SaveReport --> VenueChecks{Related venue<br/>check failures?}

    VenueChecks -->|Fire exit blocked| LogFire["FireExitCheck<br/>is_clear=False<br/>Logged as critical issue"]
    VenueChecks -->|At capacity| LogCapacity["CapacityCheck<br/>is_at_capacity=True<br/>Logged as critical issue"]
    VenueChecks -->|Toilet poor/critical| LogToilet["ToiletCheck<br/>condition='poor'/'critical'<br/>Logged as critical issue"]
    VenueChecks -->|None| NoChecks[No related checks]

    LogFire --> ManagerNotify
    LogCapacity --> ManagerNotify
    LogToilet --> ManagerNotify
    NoChecks --> ManagerNotify

    ManagerNotify["Manager notified<br/>Incident appears in<br/>compliance reports"]

    ManagerNotify --> ManagerReview["Manager reviews incident<br/>via compliance/safety reports"]

    ManagerReview --> ResolutionPath{Resolution approach}

    ResolutionPath -->|Resolve directly| Resolve["Set resolved=True<br/>resolved_at=now<br/>resolved_by=manager"]
    ResolutionPath -->|Needs investigation| Investigate["Add followup_notes<br/>Coordinate with venue management"]
    ResolutionPath -->|Escalate| Escalate["Escalate to Admin<br/>High/Critical severity<br/>requires further action"]

    Investigate --> Resolve
    Escalate --> AdminReview[Admin reviews escalation]
    AdminReview --> Resolve

    Resolve --> UpdateReport["Update IncidentReport<br/>resolved=True, resolved_at, resolved_by"]

    UpdateReport --> ComplianceRecord["Incident recorded in<br/>venue compliance history"]

    ComplianceRecord --> ReportAvailable["Available in:<br/>- Safety reports<br/>- Compliance reports<br/>- Venue incident history"]

    ReportAvailable --> End([End])
    ContactManager --> End
```

## Legend

| Symbol | Meaning |
|--------|---------|
| `([text])` | Start / End terminal |
| `[text]` | Action / Process step |
| `{text}` | Decision / Condition |
| `subgraph` | Grouped related steps |
| Solid arrow | Flow direction |

### Decision Outcomes

| Pattern | Meaning |
|---------|---------|
| `-->` with label `|Yes|` or `|No|` | Binary decision branch |
| `-->` with label `|condition|` | Named condition branch |
| Multiple outputs from decision | Multi-way branching |

## Notes

- **Onboarding** triggers the `setup_trial_period` signal automatically, giving all new companies 14 days of full-feature access regardless of subscription tier
- **Shift check-in** enforces a strict 15-minute early window; overnight shifts have special date handling logic
- **Leave approval** maintains three balance counters: `total_days`, `pending_days`, and `used_days` to track real-time availability
- **Invoice auto-update** is triggered by Django signals when a `TimeAdjustment` is created, ensuring payment accuracy after manager corrections
- **Incident severity** levels (low/medium/high/critical) are tied to venue compliance reports and appear in the admin safety dashboard
- See `05_Use_Case_Diagram.md` for actor capabilities that trigger these processes
- See `06_Sequence_Diagrams.md` for detailed message flow in the check-in and leave workflows
- See `07_State_Diagrams.md` for state machine transitions referenced in these flows
- See `13_API_Architecture.md` for the specific API endpoints called at each step

## Source Files

- `backend/api/views.py` - OnboardingViewSet (line 5976): initiate (line 6015), regional-setup (line 6190), staff-config (line 6226), integrations (line 6263), complete (line 6336); InvoiceViewSet (line 1825): generate (line 1948), preview (line 2021), generate-pdf (line 2083)
- `backend/shifts/views.py` - ShiftViewSet: check_in (line 932), check_out (line 1051), cancel (line 1116), create_multi_staff (line 1248), approve (line 1290)
- `backend/leave_management/views.py` - LeaveRequestViewSet: create (line 780), submit (line 820), approve (line 858), reject (line 893), cancel (line 929)
- `backend/api/signals.py` - setup_trial_period (line 17), notify_shift_assignment (line 80), auto_create_open_shift_request (line 288), auto_update_invoice_on_time_adjustment (line 535)
- `backend/api/models.py` - IncidentReport (line 3281), CapacityFlow (line 3315)
- `backend/api/tasks.py` - schedule_shift_reminders (line 616), send_open_shift_notifications (line 819)
