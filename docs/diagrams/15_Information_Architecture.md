# Information Architecture

## Overview

Navigation sitemap for the Mead Security staff management system, organized by user role and platform. Shows all accessible routes, page hierarchies, and role-based access control boundaries across the web frontend (React) and mobile app (React Native).

## Web Application Sitemap by Role

### Staff Role Sitemap

```mermaid
flowchart TD
    subgraph Public["Public Routes"]
        Login["/login - Login Page"]
        Register["/register - Register Page"]
        ResetPwd["/reset-password - Password Reset"]
        ResetConfirm["/reset-password/confirm/:token"]
        Recruitment["/recruitment - Public Application"]
        Apply["/apply/:companySlug - Company Application"]
    end

    subgraph Onboarding["Onboarding Flow"]
        OnboardingWizard["/onboarding/* - Onboarding Wizard"]
        CompanySetup["/company-setup - Company Setup"]
    end

    subgraph Staff["Staff Routes (All Authenticated Users)"]
        StaffDash["/dashboard - Staff Dashboard"]

        subgraph Shifts["Shift Management"]
            MyShifts["/shifts - My Shifts"]
            ShiftDetails["/shifts/:id - Shift Details"]
            StartShift["/shifts/new - Start Shift"]
            CheckIn["/shifts/:id/checkin - Check In"]
            CheckOut["/shifts/:id/checkout - Check Out"]
            EndShift["/shifts/:id/end - End Shift"]
            ShiftChecks["/shifts/:id/checks - Shift Checks"]
            ShiftExchange["/shifts/exchange - Shift Exchange"]
        end

        subgraph Invoices["Invoices"]
            MyInvoices["/invoices - My Invoices"]
            InvoiceDetails["/invoices/:id - Invoice Details"]
        end

        Profile["/profile - Profile Page"]

        subgraph LeaveStaff["Leave Management (Staff)"]
            LeaveDash["/leave - Leave Dashboard"]
            LeaveRequest["/leave/request - Submit Request"]
            LeaveBalance["/leave/balance - View Balance"]
            LeaveHistory["/leave/history - Leave History"]
            LeaveUnavail["/leave/unavailability - Contractor Unavailability"]
        end
    end

    Login -->|Auth Success| StaffDash
    StaffDash --> Shifts
    StaffDash --> Invoices
    StaffDash --> Profile
    StaffDash --> LeaveStaff
```

### Manager Role Sitemap

```mermaid
flowchart TD
    subgraph Manager["Manager Routes (Manager + Admin)"]
        ManagerDash["/dashboard - Manager Dashboard"]

        subgraph StaffRoutes["Staff Routes (Inherited)"]
            MyShifts["/shifts - My Shifts"]
            ShiftDetails["/shifts/:id - Shift Details"]
            MyInvoices["/invoices - My Invoices"]
            Profile["/profile - Profile Page"]
        end

        subgraph ManagerOnly["Manager-Specific"]
            StaffShifts["/staff-shifts - Staff Shifts Overview"]
            Approvals["/approvals - Shift Approvals"]
            ApprovalDetail["/approvals/:id - Approval Detail"]
        end

        subgraph LeaveManager["Leave Management (Manager)"]
            LeaveDash["/leave - Leave Dashboard"]
            LeaveApprovals["/leave/approvals - Leave Approvals"]
            LeaveCalendar["/leave/calendar - Leave Calendar"]
            TeamOverview["/leave/team-overview - Team Overview"]
        end

        subgraph Compliance["Compliance Management"]
            CompDash["/compliance - Compliance Dashboard"]
            Violations["/compliance/violations - Violations List"]
            Monitor["/compliance/monitor - Real-Time Monitor"]
            CompCheck["/compliance/check - Compliance Check"]
            CompReports["/compliance/reports - Compliance Reports"]
            CompTrends["/compliance/trends - Compliance Trends"]
            WorkingHours["/compliance/working-hours - Working Hours Report"]
        end
    end

    ManagerDash --> StaffRoutes
    ManagerDash --> ManagerOnly
    ManagerDash --> LeaveManager
    ManagerDash --> Compliance
    Approvals --> ApprovalDetail
```

### Admin Role Sitemap

```mermaid
flowchart TD
    subgraph Admin["Admin Routes (Admin Only)"]
        AdminDash["/dashboard - Admin Dashboard"]

        subgraph Inherited["Inherited Manager Routes"]
            StaffShifts["/staff-shifts"]
            Approvals["/approvals"]
            Compliance["/compliance/*"]
        end

        subgraph StaffMgmt["Staff & HR"]
            StaffManagement["/admin/staff - Staff Management"]
            EmploymentTypes["/admin/employment-types - Employment Types"]
            RecruitmentMgmt["/admin/recruitment - Recruitment"]
        end

        subgraph VenueOps["Venue & Scheduling"]
            Venues["/admin/venues - Venue Management"]
            Scheduling["/admin/scheduling - Shift Scheduling"]
            BankHolidays["/admin/bank-holidays - Bank Holidays"]
            Attendance["/admin/attendance - Attendance Analytics"]
        end

        subgraph Finance["Finance & Invoicing"]
            InvoiceGen["/admin/invoices - Invoice Generation"]
            PayRates["/admin/payrates - Pay Rates"]
            FinanceInteg["/admin/finance-integrations - Finance Integrations"]
            FinanceOAuth["/admin/finance-integrations/oauth-callback"]
        end

        subgraph Integrations["Integrations"]
            Deputy["/admin/deputy - Deputy Integration"]
            DeputySync["/admin/deputy/sync - Deputy Sync"]
        end

        subgraph ComplianceAdmin["Compliance (Admin-Only)"]
            CompSettings["/admin/compliance-settings - Global Settings"]
            CompVenue["/admin/compliance-settings/venue/:venueId"]
            CompStaff["/admin/compliance-settings/staff/:staffId"]
        end

        subgraph LeaveAdmin["Leave (Admin-Only)"]
            LeavePolicies["/leave/policies - Leave Policies"]
            LeaveSettings["/leave/settings - Leave Settings"]
        end

        subgraph System["System & Analytics"]
            Settings["/admin/settings - System Settings"]
            Analytics["/admin/analytics - Analytics Dashboard"]
        end
    end

    AdminDash --> Inherited
    AdminDash --> StaffMgmt
    AdminDash --> VenueOps
    AdminDash --> Finance
    AdminDash --> Integrations
    AdminDash --> ComplianceAdmin
    AdminDash --> LeaveAdmin
    AdminDash --> System
```

## Mobile Application Screen Hierarchy

```mermaid
flowchart TD
    subgraph MobileApp["Mobile App (React Native)"]
        AppNav["App Navigator"]

        subgraph AuthFlow["Auth Flow (Unauthenticated)"]
            Onboarding["Onboarding Carousel"]
            Welcome["Welcome Screen"]
            MobileLogin["Login Screen"]
            MobileRegister["Register Screen"]
            ForgotPwd["Forgot Password"]
        end

        subgraph MainNav["Main Navigator (Authenticated)"]
            subgraph TabBar["Bottom Tab Navigator"]
                HomeTab["Home Tab"]
                ShiftsTab["Shifts Tab"]
                TeamTab["Stats Tab"]
                ProfileTab["Profile Tab"]
            end

            subgraph HomeScreens["Home"]
                Dashboard["Uber Dashboard"]
                MapHeader["Map Header + GPS"]
                LiveTimer["Live Shift Timer"]
                QuickActions["Quick Actions Grid"]
                ActiveShift["Active Shift Card"]
            end

            subgraph ShiftScreens["Shift Screens"]
                ShiftsList["Shifts List (Calendar View)"]
                ShiftDetail["Shift Details"]
                CheckInFlow["Check-In Flow (GPS + Signature)"]
                AvailableShifts["Available Shifts"]
                ShiftExchanges["Shift Exchanges"]
            end

            subgraph CheckScreens["Shift Check Screens"]
                ShiftChecks["Shift Checks Hub"]
                FireExit["Fire Exit Check"]
                Capacity["Capacity Check"]
                Toilet["Toilet Check"]
            end

            subgraph TeamScreens["Team Screens"]
                TeamView["Team Overview"]
                TeamMembers["Team Member Cards"]
                PresenceBadges["Presence Badges"]
            end

            subgraph ProfileScreens["Profile Screens"]
                ProfileView["Profile Screen"]
                EditProfile["Edit Profile"]
                VirtualID["Virtual ID Card"]
                Earnings["Earnings / Pay"]
                InvoiceDetail["Invoice Detail"]
                SyncQueue["Sync Queue"]
            end

            subgraph LeaveScreens["Leave Management"]
                LeaveBalance["Leave Balance"]
                LeaveRequest["Leave Request Form"]
                LeaveHistory["Leave History"]
                LeaveRequestDetail["Leave Request Detail"]
                ContractorUnavail["Contractor Unavailability"]
            end

            subgraph IncidentScreens["Incident Reporting"]
                IncidentReport["Incident Report"]
                IncidentForm["Incident Form"]
                VoiceReport["Voice Report"]
                IncidentDetail["Incident Detail"]
            end

            subgraph VenueScreens["Venue"]
                VenueTerms["Venue Terms & Conditions"]
            end
        end
    end

    AppNav -->|Not Onboarded| Onboarding
    AppNav -->|Not Authenticated| AuthFlow
    AppNav -->|Authenticated| MainNav

    HomeTab --> HomeScreens
    ShiftsTab --> ShiftScreens
    TeamTab --> TeamScreens
    ProfileTab --> ProfileScreens

    ShiftDetail --> CheckInFlow
    ShiftDetail --> ShiftChecks
    ShiftChecks --> FireExit
    ShiftChecks --> Capacity
    ShiftChecks --> Toilet

    ProfileView --> EditProfile
    ProfileView --> VirtualID
    ProfileView --> Earnings
    ProfileView --> LeaveScreens
    ProfileView --> IncidentScreens
    Earnings --> InvoiceDetail
```

## Role-Based Access Control Matrix

```mermaid
flowchart TD
    subgraph RBAC["Access Control Overview"]
        direction TB

        subgraph PublicAccess["Public (No Auth)"]
            P1["/login"]
            P2["/register"]
            P3["/reset-password"]
            P4["/recruitment"]
            P5["/apply/:companySlug"]
        end

        subgraph AllAuth["All Authenticated Users"]
            A1["/dashboard (role-routed)"]
            A2["/shifts/*"]
            A3["/invoices/*"]
            A4["/profile"]
            A5["/leave (dashboard, request, balance, history)"]
        end

        subgraph ManagerAdmin["Manager + Admin"]
            M1["/staff-shifts"]
            M2["/approvals/*"]
            M3["/compliance/*"]
            M4["/leave/approvals"]
            M5["/leave/calendar"]
            M6["/leave/team-overview"]
        end

        subgraph AdminOnly["Admin Only"]
            AD1["/admin/staff"]
            AD2["/admin/venues"]
            AD3["/admin/scheduling"]
            AD4["/admin/invoices"]
            AD5["/admin/deputy"]
            AD6["/admin/recruitment"]
            AD7["/admin/employment-types"]
            AD8["/admin/bank-holidays"]
            AD9["/admin/attendance"]
            AD10["/admin/finance-integrations"]
            AD11["/admin/compliance-settings"]
            AD12["/admin/settings"]
            AD13["/admin/analytics"]
            AD14["/leave/policies"]
            AD15["/leave/settings"]
        end
    end

    PublicAccess -->|Login| AllAuth
    AllAuth -->|Role: Manager| ManagerAdmin
    ManagerAdmin -->|Role: Admin| AdminOnly
```

## Legend

| Symbol | Meaning |
|--------|---------|
| Rounded box | Page / Screen |
| Subgraph | Logical grouping / section |
| Arrow | Navigation path / access hierarchy |
| `/*` suffix | Contains nested sub-routes |
| `:param` | Dynamic URL parameter |
| Tab bar icons | Home, Shifts (Calendar), Stats (Team), Profile |

## Navigation Patterns

### Web Frontend
- **Role-based dashboard routing**: `/dashboard` renders `StaffDashboard`, `ManagerDashboard`, or `AdminDashboard` based on user role via `DashboardRouter`
- **AuthGuard**: All authenticated routes wrapped with `AuthGuard` component requiring completed onboarding
- **Lazy loading**: Heavy admin pages (`StaffManagement`, `VenueManagement`, `DeputyIntegration`, `RecruitmentManagement`, `Attendance`, `AnalyticsDashboard`, `BankHolidayManagement`) use React lazy loading
- **Nested route modules**: Leave (`/leave/*`) and Compliance (`/compliance/*`) use their own `Routes` with sidebar navigation
- **Owner role mapping**: Membership role `owner` maps to `admin` for access control

### Mobile App
- **Stack + Tab pattern**: `AppNavigator` (Stack) > `MainNavigator` (Stack) > `TabNavigator` (Bottom Tabs) > individual screens
- **Modal presentation**: Detail screens (`ShiftDetails`, `CheckInFlow`, etc.) presented as modals over the tab navigator
- **Onboarding gate**: `OnboardingCarousel` shown before auth flow for first-time users
- **Offline support**: `NetworkStatusBanner` and `SyncStatusBanner` shown at top of main navigator

## Notes

- Cross-reference with `16_User_Flows.md` for detailed journey maps through these screens
- Cross-reference with `17_Wireframes/index.md` for visual layout of key screens
- Cross-reference with `14_Security_Architecture.md` for detailed RBAC implementation
- Cross-reference with `11_DFD_Level2.md` for data flow through these interfaces

## Source Files

- `frontend/src/Router.tsx` - Main web routing configuration and DashboardRouter
- `frontend/src/pages/admin/*.tsx` - Admin page components (20 files)
- `frontend/src/pages/staff/*.tsx` - Staff page components (11 files)
- `frontend/src/pages/manager/*.tsx` - Manager page components (5 files)
- `frontend/src/pages/leave/LeaveManagement.tsx` - Leave sub-routing with role guards
- `frontend/src/pages/compliance/ComplianceManagement.tsx` - Compliance sub-routing with role guards
- `frontend/src/pages/public/RecruitmentApplication.tsx` - Public recruitment form
- `frontend/src/pages/shared/NotFoundPage.tsx` - 404 page
- `frontend/src/pages/shared/UnauthorizedPage.tsx` - 403 page
- `mobile/src/navigation/AppNavigator.tsx` - Root mobile navigator with auth gate
- `mobile/src/navigation/AuthNavigator.tsx` - Mobile auth flow (Welcome, Login, Register, ForgotPassword)
- `mobile/src/navigation/MainNavigator.tsx` - Authenticated mobile stack with modal screens
- `mobile/src/navigation/TabNavigator.tsx` - Bottom tabs (Home, Shifts, Stats, Profile)
- `mobile/src/screens/**/*.tsx` - 60+ mobile screen components
