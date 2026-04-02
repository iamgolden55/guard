# User Flows

## Overview

Detailed user journey maps for the core workflows in the Mead Security staff management system. Each flow shows decision points, system interactions, and error handling paths across web and mobile platforms.

## Flow 1: Staff Onboarding Journey

Registration through to first dashboard access, covering account creation, company onboarding wizard, and profile setup.

```mermaid
flowchart TD
    Start([New User]) --> ChoosePlatform{Web or Mobile?}

    %% Web Registration
    ChoosePlatform -->|Web| WebRegister["/register - Registration Form<br/>username, email, name, password"]
    ChoosePlatform -->|Mobile| MobileOnboard["Onboarding Carousel<br/>(Welcome, Shift Mgmt, Security, Achievements)"]

    MobileOnboard --> MobileWelcome["Welcome Screen"]
    MobileWelcome --> MobileLogin["Login / Register"]
    MobileLogin --> AuthAPI

    WebRegister --> AuthAPI["POST /api/v1/auth/register/"]
    AuthAPI --> AuthSuccess{Registration<br/>Success?}
    AuthSuccess -->|No| ShowError["Show Validation Errors<br/>(duplicate email, weak password)"]
    ShowError --> WebRegister

    AuthSuccess -->|Yes| JWT["JWT Tokens Issued<br/>(access + refresh)"]
    JWT --> CheckOnboarding{Onboarding<br/>Complete?}

    CheckOnboarding -->|No| OnboardingWizard["Onboarding Wizard"]

    subgraph Wizard["5-Step Company Onboarding"]
        Step1["Step 1: Company Info<br/>Name, registration #, business type,<br/>address, primary contact"]
        Step2["Step 2: Regional Compliance<br/>Country, working time regulations,<br/>data protection level"]
        Step3["Step 3: Staff Operations<br/>Staff size, shift patterns,<br/>operational preferences"]
        Step4["Step 4: Integrations Setup<br/>Deputy, accounting provider,<br/>finance integrations"]
        Step5["Step 5: Account Finalization<br/>Review, admin roles, confirm"]
    end

    OnboardingWizard --> Step1
    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5
    Step5 --> SaveOnboarding["POST /api/v1/onboarding/complete/"]
    SaveOnboarding --> OnboardingDone{Success?}
    OnboardingDone -->|No| RetryStep["Return to Failed Step"]
    RetryStep --> Step1

    OnboardingDone -->|Yes| CheckMembership{Has Company<br/>Membership?}
    CheckMembership -->|No| CompanySetup["/company-setup<br/>Create or Join Company"]
    CompanySetup --> CheckMembership

    CheckMembership -->|Yes| RoleDashboard{User Role?}
    CheckOnboarding -->|Yes| RoleDashboard

    RoleDashboard -->|Staff| StaffDash["Staff Dashboard"]
    RoleDashboard -->|Manager| ManagerDash["Manager Dashboard"]
    RoleDashboard -->|Admin/Owner| AdminDash["Admin Dashboard"]
```

## Flow 2: Daily Shift Workflow (Mobile)

The complete shift lifecycle from viewing schedule through GPS-verified check-in, on-shift checks, and check-out with digital signature.

```mermaid
flowchart TD
    Start([Staff Opens App]) --> Dashboard["Home Tab - Dashboard<br/>View active/upcoming shifts"]
    Dashboard --> HasActive{Active Shift?}

    HasActive -->|Yes| LiveTimer["Live Shift Timer<br/>Running clock, venue name"]
    HasActive -->|No| ViewSchedule["Shifts Tab - Calendar View<br/>Browse upcoming shifts"]

    ViewSchedule --> SelectShift["Tap Shift Card"]
    SelectShift --> ShiftDetail["Shift Details Screen<br/>Venue, time, requirements"]
    ShiftDetail --> TimeCheck{Within check-in<br/>window?}
    TimeCheck -->|No| WaitMessage["Not yet available<br/>(too early / too late)"]
    WaitMessage --> ViewSchedule

    TimeCheck -->|Yes| StartCheckIn["Tap 'Check In'"]
    StartCheckIn --> CheckInFlow["Check-In Flow Screen"]

    subgraph CheckIn["Multi-Step Check-In"]
        direction TB
        LocCheck["Step 1: GPS Location Verification<br/>Compare device GPS vs venue coords<br/>(100m radius)"]
        LocResult{Within<br/>Range?}
        LocCheck --> LocResult
        LocResult -->|No| LocError["Alert: Not at venue<br/>Retry / Cancel"]
        LocError -->|Retry| LocCheck

        LocResult -->|Yes| VenueTerms{Venue Has<br/>Terms?}
        VenueTerms -->|Yes| ShowTerms["Step 2: Accept Venue Terms<br/>Display T&Cs, require acceptance"]
        VenueTerms -->|No| Camera
        ShowTerms --> Camera

        Camera["Step 3: Take Photo<br/>Camera capture for verification"]
        Camera --> PhotoPreview["Review Photo<br/>Accept / Retake"]
        PhotoPreview -->|Retake| Camera
        PhotoPreview -->|Accept| Signature

        Signature["Step 4: Digital Signature<br/>Canvas capture for legal record"]
        Signature --> Processing["Step 5: Processing<br/>Submit check-in to API"]
    end

    CheckInFlow --> LocCheck
    Processing --> SubmitAPI["POST /api/v1/shifts/{id}/checkin/<br/>{location, photo, signature}"]

    SubmitAPI --> OnlineCheck{Device<br/>Online?}
    OnlineCheck -->|Yes| APIResponse{API<br/>Success?}
    OnlineCheck -->|No| QueueSync["Queue in SyncService<br/>Store locally (SQLite)"]
    QueueSync --> CheckedIn

    APIResponse -->|Yes| CheckedIn["Shift Active<br/>Live timer starts"]
    APIResponse -->|No| ErrorHandle["Show Error<br/>Retry submission"]
    ErrorHandle --> Processing

    %% On-Shift Activities
    CheckedIn --> OnShift{On-Shift<br/>Activities}

    OnShift -->|Checks Due| ShiftChecks["Shift Checks Screen"]
    subgraph Checks["Periodic Venue Checks"]
        FireExit["Fire Exit Check<br/>Verify exits clear"]
        CapCheck["Capacity Check<br/>Record current count"]
        ToiletCheck["Toilet Check<br/>Verify facilities"]
    end
    ShiftChecks --> FireExit
    ShiftChecks --> CapCheck
    ShiftChecks --> ToiletCheck
    Checks --> CheckedIn

    OnShift -->|Incident| IncidentReport["Incident Report<br/>Form / Voice Report"]
    IncidentReport --> CheckedIn

    OnShift -->|End Shift| CheckOut["Tap 'Check Out'"]

    subgraph CheckOutFlow["Check-Out Flow"]
        OutLoc["GPS Location Verification"]
        OutSig["Digital Signature Capture"]
        OutProcess["Submit Check-Out"]
    end

    CheckOut --> OutLoc
    OutLoc --> OutSig
    OutSig --> OutProcess
    OutProcess --> ShiftComplete["Shift Complete<br/>Hours calculated, pending approval"]
```

## Flow 3: Leave Request Journey

Staff member checking their leave balance, submitting a leave request, and tracking the approval outcome. Includes contractor vs permanent employee routing.

```mermaid
flowchart TD
    Start([Staff Member]) --> Platform{Web or Mobile?}

    Platform -->|Web| WebLeave["/leave - Leave Dashboard"]
    Platform -->|Mobile| MobileLeave["Profile > Leave Balance"]

    WebLeave --> CheckType{Employment<br/>Type?}
    MobileLeave --> MobileCheckType{Employment<br/>Type?}

    CheckType -->|Permanent| ViewBalance["/leave/balance<br/>Leave Balance Display"]
    CheckType -->|Contractor| Unavailability["/leave/unavailability<br/>Contractor Unavailability Form"]
    CheckType -->|Unknown| NeedSetup["Redirect to Dashboard<br/>Employment type not set"]

    MobileCheckType -->|Permanent| MobileBalance["Leave Balance Screen<br/>View all leave types & accruals"]
    MobileCheckType -->|Contractor| MobileUnavail["Contractor Unavailability Screen"]

    ViewBalance --> ReviewPolicies["Review Leave Policies<br/>Allowance, accrued, used, remaining"]
    MobileBalance --> ReviewPolicies

    ReviewPolicies --> EnoughLeave{Sufficient<br/>Balance?}
    EnoughLeave -->|No| WaitAccrual["Wait for Accrual<br/>or Check Other Leave Types"]
    WaitAccrual --> ReviewPolicies

    EnoughLeave -->|Yes| StartRequest["Click 'New Request'"]
    StartRequest --> RequestForm["Leave Request Form"]

    subgraph FormFill["Leave Request Form"]
        SelectType["Select Leave Type<br/>(Annual, Sick, etc.)"]
        SelectDates["Select Start & End Dates<br/>Date picker with blackout dates"]
        AddNotes["Add Notes / Reason<br/>(required for some types)"]
        ReviewReq["Review Request Summary<br/>Days requested, remaining balance"]
    end

    RequestForm --> SelectType
    SelectType --> SelectDates
    SelectDates --> AddNotes
    AddNotes --> ReviewReq

    ReviewReq --> Submit["Submit Request<br/>POST /api/v1/leave/requests/"]
    Submit --> SubmitResult{Success?}
    SubmitResult -->|No| ValidationErr["Show Validation Errors<br/>(overlapping dates, blackout period,<br/>insufficient balance)"]
    ValidationErr --> SelectDates

    SubmitResult -->|Yes| Pending["Request Status: PENDING<br/>Notification sent to manager"]

    Pending --> ManagerAction{Manager<br/>Decision}
    ManagerAction -->|Approved| Approved["Status: APPROVED<br/>Balance deducted<br/>Staff notified"]
    ManagerAction -->|Rejected| Rejected["Status: REJECTED<br/>Reason provided<br/>Staff notified"]

    Approved --> ViewHistory["/leave/history<br/>View in Leave History"]
    Rejected --> ViewHistory
    ViewHistory --> ModifyOption{Modify?}
    ModifyOption -->|Resubmit| StartRequest
    ModifyOption -->|No| End([Done])

    %% Contractor Path
    Unavailability --> ContractorForm["Mark Unavailable Dates<br/>Select date ranges"]
    MobileUnavail --> ContractorForm
    ContractorForm --> SaveUnavail["POST /api/v1/leave/unavailability/"]
    SaveUnavail --> End
```

## Flow 4: Manager Approval Workflow

Manager reviewing and processing shift approvals and leave requests, including bulk operations.

```mermaid
flowchart TD
    Start([Manager]) --> Notification{Notification<br/>Received?}

    Notification -->|Push/Email| OpenNotif["Open Notification<br/>Navigate to relevant page"]
    Notification -->|No, Proactive| ManagerDash["/dashboard<br/>Manager Dashboard"]

    ManagerDash --> PendingWidget["View Pending Items<br/>Approval counts widget"]
    PendingWidget --> ChooseType{Approval<br/>Type?}
    OpenNotif --> ChooseType

    %% Shift Approval Path
    ChooseType -->|Shift| ShiftApprovals["/approvals<br/>Shift Approvals Page"]
    ShiftApprovals --> FilterShifts["Filter by status, date, staff<br/>Search and sort"]
    FilterShifts --> SelectShift["Select Shift to Review"]
    SelectShift --> ShiftDetail["/approvals/:id<br/>Shift Approval Detail"]

    subgraph ShiftReview["Shift Review"]
        StaffInfo["Staff: Name, role, qualifications"]
        VenueInfo["Venue: Location, requirements met"]
        TimeInfo["Times: Check-in/out, total hours<br/>GPS coordinates, location verified"]
        SignatureView["Signatures: Start & end captured"]
        BreakInfo["Breaks: Duration, compliance check"]
    end

    ShiftDetail --> StaffInfo
    StaffInfo --> VenueInfo
    VenueInfo --> TimeInfo
    TimeInfo --> SignatureView
    SignatureView --> BreakInfo

    BreakInfo --> AdjustTime{Need Time<br/>Adjustment?}
    AdjustTime -->|Yes| AdjustDialog["Adjust Time Dialog<br/>Modify start/end time with reason"]
    AdjustDialog --> ShiftDecision

    AdjustTime -->|No| ShiftDecision{Decision}
    ShiftDecision -->|Approve| ApproveShift["POST /api/v1/shifts/{id}/approve/<br/>Status: APPROVED"]
    ShiftDecision -->|Reject| RejectReason["Enter Rejection Reason"]
    RejectReason --> RejectShift["POST /api/v1/shifts/{id}/reject/<br/>Status: REJECTED"]

    ApproveShift --> StaffNotified["Staff Notified<br/>(push + in-app)"]
    RejectShift --> StaffNotified

    StaffNotified --> MoreShifts{More Pending<br/>Shifts?}
    MoreShifts -->|Yes| FilterShifts
    MoreShifts -->|No| Done

    %% Leave Approval Path
    ChooseType -->|Leave| LeaveApprovals["/leave/approvals<br/>Leave Approval Dashboard"]
    LeaveApprovals --> FilterLeave["Filter by type, staff, date"]
    FilterLeave --> SelectLeave["Select Leave Request"]

    subgraph LeaveReview["Leave Review"]
        LeaveStaff["Staff: Name, employment type"]
        LeaveType["Type: Annual, Sick, etc."]
        LeaveDates["Dates: Start, end, days requested"]
        LeaveBalance["Balance: Current, after approval"]
        TeamCalendar["Team Calendar: Check conflicts"]
    end

    SelectLeave --> LeaveStaff
    LeaveStaff --> LeaveType
    LeaveType --> LeaveDates
    LeaveDates --> LeaveBalance
    LeaveBalance --> TeamCalendar

    TeamCalendar --> ConflictCheck{Team<br/>Conflict?}
    ConflictCheck -->|Yes| ReviewConflict["Review Coverage Gaps<br/>Check minimum staffing"]
    ReviewConflict --> LeaveDecision

    ConflictCheck -->|No| LeaveDecision{Decision}
    LeaveDecision -->|Approve| ApproveLeave["PATCH /api/v1/leave/requests/{id}/<br/>Status: APPROVED"]
    LeaveDecision -->|Reject| LeaveRejectReason["Enter Rejection Reason"]
    LeaveRejectReason --> RejectLeave["PATCH /api/v1/leave/requests/{id}/<br/>Status: REJECTED"]

    ApproveLeave --> LeaveNotified["Staff Notified<br/>Balance Updated"]
    RejectLeave --> LeaveNotified

    LeaveNotified --> MoreLeave{More Pending<br/>Requests?}
    MoreLeave -->|Yes| FilterLeave
    MoreLeave -->|No| Done([Return to Dashboard])
```

## Flow 5: Incident Reporting (Mobile)

Staff reporting a security incident during an active shift, including voice reporting and photo evidence.

```mermaid
flowchart TD
    Start([Staff on Active Shift]) --> TriggerIncident{How to<br/>Report?}

    TriggerIncident -->|Quick Action| QuickAction["Dashboard Quick Actions<br/>Tap 'Report Incident'"]
    TriggerIncident -->|From Shift| ShiftAction["Shift Details<br/>Tap 'Report Incident'"]

    QuickAction --> IncidentReport["Incident Report Screen"]
    ShiftAction --> IncidentReport

    IncidentReport --> ReportType{Report<br/>Method?}

    ReportType -->|Written| IncidentForm["Incident Form Screen"]
    ReportType -->|Voice| VoiceReport["Voice Report Screen<br/>Audio recording + transcription"]

    VoiceReport --> Transcribe["Transcribe Audio<br/>Review & edit text"]
    Transcribe --> IncidentForm

    subgraph FormEntry["Incident Form"]
        IncType["Select Incident Type<br/>(Theft, Assault, Trespass, etc.)"]
        IncDesc["Description<br/>(text or transcribed voice)"]
        IncSeverity["Severity Level"]
        IncLocation["Location Details<br/>(auto-filled from GPS)"]
        IncPhotos["Attach Photo Evidence<br/>(camera or gallery)"]
        IncWitnesses["Add Witnesses<br/>(optional)"]
    end

    IncidentForm --> IncType
    IncType --> IncDesc
    IncDesc --> IncSeverity
    IncSeverity --> IncLocation
    IncLocation --> IncPhotos
    IncPhotos --> IncWitnesses

    IncWitnesses --> ReviewSubmit["Review Incident Report"]
    ReviewSubmit --> SubmitIncident["POST /api/v1/incidents/<br/>Submit with attachments"]

    SubmitIncident --> Online{Device<br/>Online?}
    Online -->|Yes| Submitted["Incident Logged<br/>Manager notified"]
    Online -->|No| Queued["Queued for Sync<br/>Stored in local DB"]
    Queued -->|When online| Submitted

    Submitted --> IncidentDetail["Incident Detail Screen<br/>View status and updates"]
    IncidentDetail --> End([Return to Shift])
```

## Flow 6: Admin Invoice Generation

Admin generating, reviewing, and managing invoices from approved shifts.

```mermaid
flowchart TD
    Start([Admin]) --> AdminDash["/dashboard - Admin Dashboard"]
    AdminDash --> InvoicePage["/admin/invoices<br/>Invoice Generation"]

    InvoicePage --> SelectStaff["Select Staff Member(s)<br/>Filter by name, venue, date range"]
    SelectStaff --> ReviewShifts["Review Approved Shifts<br/>Shifts pending invoicing"]

    ReviewShifts --> HasShifts{Approved Shifts<br/>Available?}
    HasShifts -->|No| NoShifts["No shifts to invoice<br/>Check approvals page"]
    NoShifts --> End

    HasShifts -->|Yes| SelectShifts["Select Shifts to Include"]
    SelectShifts --> PayRateCheck["Verify Pay Rates<br/>Regular, overtime, holiday rates"]

    PayRateCheck --> GenerateInvoice["Generate Invoice<br/>POST /api/v1/invoices/generate/"]
    GenerateInvoice --> InvoicePreview["Invoice Preview<br/>Line items, totals, taxes"]

    InvoicePreview --> Correct{Details<br/>Correct?}
    Correct -->|No| AdjustItems["Adjust Line Items<br/>Modify hours or rates"]
    AdjustItems --> InvoicePreview

    Correct -->|Yes| Finalize{Action}
    Finalize -->|Save Draft| SaveDraft["Save as Draft<br/>Can edit later"]
    Finalize -->|Finalize| FinalizeInvoice["Finalize Invoice<br/>PDF Generated"]

    FinalizeInvoice --> FinanceInteg{Finance<br/>Integration?}
    FinanceInteg -->|Xero Connected| SyncXero["Sync to Xero<br/>Push invoice data"]
    FinanceInteg -->|None| Manual["Manual Processing"]

    SyncXero --> StaffNotified["Staff Notified<br/>Invoice available in portal"]
    Manual --> StaffNotified

    StaffNotified --> StaffView["Staff Views in<br/>/invoices - My Invoices"]
    StaffView --> End([Done])
```

## Legend

| Symbol | Meaning |
|--------|---------|
| Rounded rectangle `([text])` | Start / End terminal |
| Rectangle `[text]` | Process / Action step |
| Diamond `{text}` | Decision point |
| Subgraph | Grouped related steps |
| Solid arrow | Primary flow path |
| `POST/PATCH/GET` | API endpoint called |

## Cross-Platform Considerations

| Flow | Web Support | Mobile Support | Offline Support |
|------|-------------|---------------|-----------------|
| Onboarding | Full wizard (5 steps) | Carousel + auth only | No |
| Shift Check-In/Out | Basic (location + signature) | Full (GPS + photo + signature) | Yes (sync queue) |
| Leave Request | Full (with sidebar nav) | Balance + request form | No |
| Manager Approvals | Full (shift + leave) | Not available | No |
| Incident Reporting | Not available | Full (form + voice + photo) | Yes (sync queue) |
| Invoice Generation | Full (admin only) | Not available | No |

## Notes

- Cross-reference with `15_Information_Architecture.md` for the complete page/screen inventory
- Cross-reference with `17_Wireframes/index.md` for visual layouts of key screens in these flows
- Cross-reference with `06_Sequence_Diagrams.md` for technical API call sequences
- Cross-reference with `08_Activity_Diagrams.md` for business process modeling

## Source Files

- `frontend/src/Router.tsx` - Route definitions and DashboardRouter role switching
- `frontend/src/pages/auth/LoginPage.tsx` - Web login with JWT and onboarding redirect
- `frontend/src/pages/auth/RegisterPage.tsx` - Web registration with Formik/Yup validation
- `frontend/src/components/onboarding/OnboardingWizard.tsx` - 5-step company onboarding wizard
- `frontend/src/pages/staff/ShiftCheckIn.tsx` - Web check-in with location + signature
- `frontend/src/pages/leave/LeaveManagement.tsx` - Leave sub-router with employment type guards
- `frontend/src/pages/manager/Approvals.tsx` - Shift approval list and actions
- `frontend/src/components/LeaveApprovalDashboard.tsx` - Leave approval interface
- `frontend/src/pages/admin/InvoiceGeneration.tsx` - Invoice creation and management
- `mobile/src/navigation/AppNavigator.tsx` - Root navigator with auth/onboarding gates
- `mobile/src/screens/shifts/CheckInFlowScreen.tsx` - Multi-step check-in (GPS, terms, photo, signature)
- `mobile/src/screens/leave/LeaveRequestScreen.tsx` - Mobile leave request form
- `mobile/src/screens/leave/LeaveBalanceScreen.tsx` - Mobile leave balance display
- `mobile/src/screens/incidents/IncidentFormScreen.tsx` - Incident reporting form
- `mobile/src/screens/incidents/VoiceReportScreen.tsx` - Voice-based incident reporting
- `mobile/src/screens/profile/EarningsScreen.tsx` - Mobile earnings and invoice viewing
