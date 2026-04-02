# Wireframes

## Overview

ASCII wireframes for the 6 key screens in the Mead Security staff management system. These wireframes show component placement, layout structure, and responsive breakpoints across web and mobile platforms.

---

## 1. Staff Dashboard (Mobile)

The primary screen staff see when opening the mobile app. Uber-inspired design with map header, active shift status, quick actions, and upcoming shifts.

### Mobile Layout (375px)

```
┌─────────────────────────────────┐
│         STATUS BAR              │
├─────────────────────────────────┤
│                                 │
│   ┌─────────────────────────┐   │
│   │                         │   │
│   │      MAP HEADER         │   │
│   │   (Venue Location)      │   │
│   │                         │   │
│   │  Hi, {firstName}        │   │
│   │  📍 {venue or "No       │   │
│   │      active shift"}     │   │
│   └─────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │  ACTIVE SHIFT CARD        │   │
│ │  ┌─────────────────────┐  │   │
│ │  │  {Venue Name}       │  │   │
│ │  │  LIVE TIMER  02:34   │  │   │
│ │  │  Started: 08:00 AM   │  │   │
│ │  └─────────────────────┘  │   │
│ │                           │   │
│ │  [  CHECK OUT  ]          │   │
│ └───────────────────────────┘   │
│                                 │
│  -- OR (no active shift) --     │
│                                 │
│ ┌───────────────────────────┐   │
│ │  NEXT SHIFT CARD          │   │
│ │  {Venue} - {Time}        │   │
│ │  [  CHECK IN  ]           │   │
│ └───────────────────────────┘   │
│                                 │
│  OVERVIEW STATS                 │
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │ This │ │ Hrs  │ │ Next │     │
│ │ Week │ │ This │ │Shift │     │
│ │  3   │ │Month │ │ Mon  │     │
│ │shifts│ │ 42h  │ │08:00 │     │
│ └──────┘ └──────┘ └──────┘     │
│                                 │
│  QUICK ACTIONS                  │
│ ┌──────────┐ ┌──────────┐       │
│ │Available │ │ Report   │       │
│ │ Shifts   │ │ Incident │       │
│ ├──────────┤ ├──────────┤       │
│ │  Shift   │ │  Leave   │       │
│ │Exchanges │ │ Request  │       │
│ └──────────┘ └──────────┘       │
│                                 │
│  UPCOMING SHIFTS                │
│ ┌───────────────────────────┐   │
│ │ Mon 14 Feb  08:00-16:00  │   │
│ │ Westfield Mall            │   │
│ ├───────────────────────────┤   │
│ │ Tue 15 Feb  20:00-04:00  │   │
│ │ O2 Arena                  │   │
│ ├───────────────────────────┤   │
│ │ Wed 16 Feb  08:00-16:00  │   │
│ │ Canary Wharf Tower        │   │
│ └───────────────────────────┘   │
│                                 │
├────────┬────────┬───────┬───────┤
│  Home  │ Shifts │ Stats │Profile│
│   *    │        │       │       │
└────────┴────────┴───────┴───────┘
```

### Key Components
- **MapHeader**: Full-width map showing venue location (or user location if no active shift)
- **ActiveShiftCard / CheckActionCard**: Hero card with live timer or check-in button
- **OverviewStats**: 3-column stat summary row
- **UberQuickActions**: 2x2 grid of action buttons
- **UberUpcomingShifts**: Scrollable list of upcoming shift cards
- **TabBar**: Bottom navigation (Home, Shifts, Stats, Profile)

---

## 2. Shift Check-In Screen (Mobile)

Multi-step check-in flow with GPS verification, venue terms, photo capture, and digital signature.

### Mobile Layout (375px)

```
┌─────────────────────────────────┐
│  < Back        Check In         │
├─────────────────────────────────┤
│                                 │
│  PROGRESS INDICATOR             │
│  [====>    ] Step 1 of 4        │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │  STEP 1: LOCATION       │    │
│  │                         │    │
│  │    ┌─────────────┐      │    │
│  │    │   GPS Icon   │      │    │
│  │    │   Verifying  │      │    │
│  │    │   Location   │      │    │
│  │    └─────────────┘      │    │
│  │                         │    │
│  │  Venue: Westfield Mall  │    │
│  │  Distance: 45m          │    │
│  │  Status: Within range   │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  [    VERIFY LOCATION    ]      │
│                                 │
├─────────────────────────────────┤
│                                 │
│  STEP 2: VENUE TERMS            │
│  (shown if venue has terms)     │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Terms & Conditions      │    │
│  │ for Westfield Mall      │    │
│  │                         │    │
│  │ 1. All security staff   │    │
│  │    must wear visible    │    │
│  │    ID at all times...   │    │
│  │ 2. Report to control    │    │
│  │    room on arrival...   │    │
│  │                         │    │
│  │ [x] I accept the terms  │    │
│  └─────────────────────────┘    │
│                                 │
│  [       CONTINUE        ]      │
│                                 │
├─────────────────────────────────┤
│                                 │
│  STEP 3: PHOTO CAPTURE          │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │                         │    │
│  │     CAMERA VIEWFINDER   │    │
│  │                         │    │
│  │                         │    │
│  │                         │    │
│  │         [ O ]           │    │
│  │       (Shutter)         │    │
│  └─────────────────────────┘    │
│                                 │
│  -- After capture --            │
│  ┌─────────────────────────┐    │
│  │     PHOTO PREVIEW       │    │
│  │                         │    │
│  │  [Retake]    [Accept]   │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│                                 │
│  STEP 4: DIGITAL SIGNATURE      │
│                                 │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │   SIGNATURE CANVAS      │    │
│  │   (Touch to sign)       │    │
│  │                         │    │
│  │    ~~~~~~~~~~           │    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  [Clear]      [Confirm Sign]    │
│                                 │
├─────────────────────────────────┤
│                                 │
│  PROCESSING...                  │
│  ┌─────────────────────────┐    │
│  │   Submitting check-in   │    │
│  │   [========>   ]        │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

### Flow Steps
| Step | Component | Required |
|------|-----------|----------|
| 1 | GPS Location Verification (100m radius) | Always |
| 2 | Venue Terms & Conditions | If venue has terms |
| 3 | Camera Photo Capture + Preview | Always |
| 4 | Signature Canvas | Always |
| 5 | Processing / Submission | Always |

---

## 3. Manager Approvals Dashboard (Web)

Tabbed approval interface for shift exchanges, open shift claims, and incomplete shifts. Uses Fluent UI DetailsList.

### Desktop Layout (1280px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR  │                    MAIN CONTENT                         │
│           │                                                         │
│  Logo     │  ┌───────────────────────────────────────────────────┐  │
│           │  │  Approvals                                        │  │
│  Dashboard│  └───────────────────────────────────────────────────┘  │
│  Shifts   │                                                         │
│ *Approvals│  ┌─────────────┬──────────────┬──────────────────┐      │
│  Staff    │  │  Exchange   │  Open Shift  │  Incomplete      │      │
│  Shifts   │  │  Approvals  │  Claims      │  Shifts          │      │
│  Leave    │  │     *       │              │                  │      │
│  ...      │  └─────────────┴──────────────┴──────────────────┘      │
│           │                                                         │
│           │  ┌─────────────────────────────────────────────────┐    │
│           │  │  [Search...                    ] [Filter v]     │    │
│           │  └─────────────────────────────────────────────────┘    │
│           │                                                         │
│           │  ┌──────────────────────────────────────────────────┐   │
│           │  │ ID │ Staff    │ Venue      │ Date    │ Status   │   │
│           │  ├────┼──────────┼────────────┼─────────┼──────────┤   │
│           │  │ 42 │ J. Smith │ Westfield  │ 14 Feb  │ Pending  │   │
│           │  │    │          │            │         │[Approve] │   │
│           │  │    │          │            │         │[Reject]  │   │
│           │  ├────┼──────────┼────────────┼─────────┼──────────┤   │
│           │  │ 43 │ A. Jones │ O2 Arena   │ 15 Feb  │ Pending  │   │
│           │  │    │          │            │         │[Approve] │   │
│           │  │    │          │            │         │[Reject]  │   │
│           │  ├────┼──────────┼────────────┼─────────┼──────────┤   │
│           │  │ 44 │ M. Brown │ Canary Wf  │ 16 Feb  │ Approved │   │
│           │  └────┴──────────┴────────────┴─────────┴──────────┘   │
│           │                                                         │
│           │  INCOMPLETE SHIFTS TAB:                                  │
│           │  ┌──────────────────────────────────────────────────┐   │
│           │  │ ID │ Staff   │ Venue    │ Issue     │ Priority  │   │
│           │  ├────┼─────────┼──────────┼───────────┼───────────┤   │
│           │  │ 38 │ R. Lee  │ Mall     │ No Chkout │ CRITICAL  │   │
│           │  │    │         │          │ 4h overdue│           │   │
│           │  │    │ [Manual Checkout] [Adjust Time] [Force]    │   │
│           │  └────┴─────────┴──────────┴───────────┴───────────┘   │
│           │                                                         │
│           │  ADJUST TIME DIALOG (modal overlay):                    │
│           │  ┌────────────────────────────────────┐                 │
│           │  │  Adjust Shift Time                 │                 │
│           │  │                                    │                 │
│           │  │  Staff: J. Smith                   │                 │
│           │  │  Original: 08:00 - 16:00           │                 │
│           │  │                                    │                 │
│           │  │  New Start: [08:15    ]             │                 │
│           │  │  New End:   [16:00    ]             │                 │
│           │  │  Reason:    [Late arrival  ]        │                 │
│           │  │                                    │                 │
│           │  │       [Cancel]  [Save Changes]     │                 │
│           │  └────────────────────────────────────┘                 │
└───────────┴─────────────────────────────────────────────────────────┘
```

### Tablet Layout (768px)
- Sidebar collapses to hamburger menu
- Table columns stack or hide less important fields
- Action buttons become icon-only

### Mobile Layout (375px)
- Full-width card layout replaces table rows
- Each approval shows as a card with action buttons below
- Tabs become swipeable

---

## 4. Admin Dashboard (Web)

Overview dashboard with metric cards, activity heatmap, active shifts widget, incomplete shifts widget, and quick actions panel.

### Desktop Layout (1280px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR  │                    MAIN CONTENT                         │
│           │                                                         │
│  Logo     │  Dashboard                                              │
│           │  Welcome back. Here's what's happening today.           │
│ *Dashboard│                                                         │
│  Staff    │  NEEDS ATTENTION BANNER (conditional)                   │
│  Shifts   │  ┌──────────────────────────────────────────────────┐   │
│  Approvals│  │ ! 3 incomplete shifts | On-time at 68% | 5      │   │
│  Venues   │  │   pending approvals                              │   │
│  Invoices │  └──────────────────────────────────────────────────┘   │
│  Schedule │                                                         │
│  Staff Mgm│  PRIMARY METRICS (3-col grid)                           │
│  Settings │  ┌──────────────┬──────────────┬──────────────┐        │
│  Deputy   │  │ Active       │ Pending      │ On-time      │        │
│  Analytics│  │ Shifts       │ Approvals    │ Rate         │        │
│  ...      │  │              │              │              │        │
│           │  │    12        │     5        │   87%        │        │
│           │  │  [Clock]     │ [Permissions]│  [Timer]     │        │
│           │  └──────────────┴──────────────┴──────────────┘        │
│           │                                                         │
│           │  SECONDARY METRICS (3-col grid)                         │
│           │  ┌──────────────┬──────────────┬──────────────┐        │
│           │  │ Total        │ Total        │ Pending      │        │
│           │  │ Staff        │ Venues       │ Invoices     │        │
│           │  │    45        │    8         │     3        │        │
│           │  │  [People]    │   [POI]      │ [PayCard]    │        │
│           │  └──────────────┴──────────────┴──────────────┘        │
│           │                                                         │
│           │  ACTIVITY HEAT MAP (full width)                         │
│           │  ┌──────────────────────────────────────────────────┐   │
│           │  │  13-Week Activity                                │   │
│           │  │  Mon ░░▓▓░░▓▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓░░▓▓░░░▓▓▓▓░░│   │
│           │  │  Tue ░▓▓░░▓▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓░░▓▓░░░▓▓▓▓░░░│   │
│           │  │  Wed ░░▓▓▓▓░░▓▓░░░▓▓▓░░▓▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓░│   │
│           │  │  Thu ▓▓░░▓▓▓░░░▓▓▓▓░░▓▓░░░▓▓▓░░▓▓░░░▓▓▓▓░░▓▓│   │
│           │  │  Fri ░░▓▓░░▓▓▓░░░▓▓░░░▓▓▓░░▓▓░░░▓▓▓▓░░▓▓░░░▓│   │
│           │  │  Sat ░░░░░░▓░░░░░░░░▓░░░░░░░░░░▓░░░░░░░░░▓░░░│   │
│           │  │  Sun ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │
│           │  │         Less ░░▓▓██ More                        │   │
│           │  └──────────────────────────────────────────────────┘   │
│           │                                                         │
│           │  ACTIVE SHIFTS WIDGET (full width)                      │
│           │  ┌──────────────────────────────────────────────────┐   │
│           │  │ Active Shifts (12)                               │   │
│           │  │ Staff      │ Venue       │ Started  │ Duration   │   │
│           │  │ J. Smith   │ Westfield   │ 08:00    │ 2h 34m     │   │
│           │  │ A. Jones   │ O2 Arena    │ 20:00    │ 4h 12m     │   │
│           │  └──────────────────────────────────────────────────┘   │
│           │                                                         │
│           │  ┌──────────────────────────┬───────────────────────┐   │
│           │  │ INCOMPLETE SHIFTS (60%)  │ QUICK ACTIONS (40%)   │   │
│           │  │                          │                       │   │
│           │  │ 3 incomplete shifts      │ Common Tasks          │   │
│           │  │                          │                       │   │
│           │  │ R. Lee - Mall            │ ┌───────────────────┐ │   │
│           │  │ No checkout, 4h overdue  │ │ Manage Staff      │ │   │
│           │  │ [Manual] [Adjust]        │ │ [Manage Staff ->] │ │   │
│           │  │                          │ ├───────────────────┤ │   │
│           │  │ T. Park - Tower          │ │ Manage Venues     │ │   │
│           │  │ No checkin               │ │ [Manage Venues->] │ │   │
│           │  │ [Resolve]                │ ├───────────────────┤ │   │
│           │  │                          │ │ Shift Approvals   │ │   │
│           │  │                          │ │ [Approvals ->]    │ │   │
│           │  │                          │ ├───────────────────┤ │   │
│           │  │                          │ │ Generate Invoices │ │   │
│           │  │                          │ │ [Invoices ->]     │ │   │
│           │  └──────────────────────────┘ └───────────────────┘ │   │
│           │                                                         │
│           │  DEPUTY INTEGRATION STATUS (tab 2 in Quick Actions)     │
│           │  Connection: Connected | Last Sync: 13 Feb 14:30        │
│           │  Employees: 45 | Timesheets: 312                        │
│           │  [Configure Deputy] [Sync Now]                          │
└───────────┴─────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- **Desktop (1280px+)**: Full sidebar + 3-col metric grids + 60/40 split bottom
- **Tablet (768px)**: Collapsed sidebar, 2-col metric grids, stacked bottom section
- **Mobile (375px)**: Hamburger menu, single-col metrics, swipeable tabs for Quick Actions/Deputy

---

## 5. Leave Request Form (Web + Mobile)

Leave request submission with type selection, date picking, and balance preview.

### Web Layout (1280px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR  │ LEAVE SIDEBAR  │         MAIN CONTENT                   │
│           │                │                                        │
│  Logo     │  Dashboard     │  New Leave Request                     │
│           │  Balance       │                                        │
│ Dashboard │ *Request       │  ┌──────────────────────────────────┐  │
│  Shifts   │  History       │  │  Leave Type                      │  │
│  Leave *  │  Unavailability│  │  [Annual Leave         v]        │  │
│  Profile  │  ---           │  │                                  │  │
│  Invoices │  Approvals     │  │  Start Date           End Date   │  │
│           │  Calendar      │  │  [  14 Feb 2026  ]  [ 18 Feb  ] │  │
│           │  Team Overview │  │                                  │  │
│           │  ---           │  │  Duration: 3 working days        │  │
│           │  Policies      │  │                                  │  │
│           │  Settings      │  │  Notes / Reason                  │  │
│           │                │  │  ┌────────────────────────────┐  │  │
│           │                │  │  │ Family holiday booked      │  │  │
│           │                │  │  │                            │  │  │
│           │                │  │  └────────────────────────────┘  │  │
│           │                │  │                                  │  │
│           │                │  │  BALANCE PREVIEW                 │  │
│           │                │  │  ┌────────────────────────────┐  │  │
│           │                │  │  │ Annual Leave               │  │  │
│           │                │  │  │ Total: 25 days              │  │  │
│           │                │  │  │ Used:  12 days              │  │  │
│           │                │  │  │ This request: 3 days        │  │  │
│           │                │  │  │ Remaining: 10 days          │  │  │
│           │                │  │  │ [==========>        ]       │  │  │
│           │                │  │  └────────────────────────────┘  │  │
│           │                │  │                                  │  │
│           │                │  │  [Cancel]    [Submit Request]    │  │
│           │                │  └──────────────────────────────────┘  │
│           │                │                                        │
└───────────┴────────────────┴────────────────────────────────────────┘
```

### Mobile Layout (375px)

```
┌─────────────────────────────────┐
│  < Back     Leave Request       │
├─────────────────────────────────┤
│                                 │
│  Leave Type                     │
│  ┌───────────────────────────┐  │
│  │ Annual Leave          v   │  │
│  └───────────────────────────┘  │
│                                 │
│  Start Date                     │
│  ┌───────────────────────────┐  │
│  │ 14 Feb 2026               │  │
│  └───────────────────────────┘  │
│                                 │
│  End Date                       │
│  ┌───────────────────────────┐  │
│  │ 18 Feb 2026               │  │
│  └───────────────────────────┘  │
│                                 │
│  Duration: 3 working days       │
│                                 │
│  Notes                          │
│  ┌───────────────────────────┐  │
│  │ Family holiday booked     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  BALANCE PREVIEW                │
│  ┌───────────────────────────┐  │
│  │ Annual Leave              │  │
│  │ Remaining: 13 -> 10 days  │  │
│  │ [===========>       ]     │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │     SUBMIT REQUEST        │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

---

## 6. Invoice Detail View (Web)

Staff viewing an individual invoice with line items, totals, and payment status.

### Desktop Layout (1280px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIDEBAR  │                    MAIN CONTENT                         │
│           │                                                         │
│  Logo     │  < Back to Invoices                                     │
│           │                                                         │
│ Dashboard │  ┌──────────────────────────────────────────────────┐   │
│  Shifts   │  │  INVOICE #INV-2026-0070                          │   │
│  Leave    │  │                                                  │   │
│ *Invoices │  │  ┌────────────────────┬────────────────────┐     │   │
│  Profile  │  │  │ Staff              │ Payment Status     │     │   │
│           │  │  │ John Smith         │ ┌──────────────┐   │     │   │
│           │  │  │ SIA: 1234567890    │ │   PENDING    │   │     │   │
│           │  │  │                    │ └──────────────┘   │     │   │
│           │  │  ├────────────────────┼────────────────────┤     │   │
│           │  │  │ Period             │ Generated          │     │   │
│           │  │  │ 01 Feb - 14 Feb    │ 15 Feb 2026        │     │   │
│           │  │  │ 2026               │                    │     │   │
│           │  │  └────────────────────┴────────────────────┘     │   │
│           │  │                                                  │   │
│           │  │  LINE ITEMS                                      │   │
│           │  │  ┌───────────────────────────────────────────┐   │   │
│           │  │  │ Date    │ Venue      │ Hours │ Rate │ Total│   │   │
│           │  │  ├─────────┼────────────┼───────┼──────┼──────┤   │   │
│           │  │  │ 01 Feb  │ Westfield  │ 8.0   │12.50 │100.00│   │   │
│           │  │  │ 03 Feb  │ O2 Arena   │ 10.0  │15.00 │150.00│   │   │
│           │  │  │ 05 Feb  │ Westfield  │ 8.0   │12.50 │100.00│   │   │
│           │  │  │ 07 Feb  │ Canary Wf  │ 12.0  │14.00 │168.00│   │   │
│           │  │  │ 10 Feb  │ Westfield  │ 8.0   │12.50 │100.00│   │   │
│           │  │  │ 12 Feb  │ O2 Arena   │ 10.0  │15.00 │150.00│   │   │
│           │  │  ├─────────┼────────────┼───────┼──────┼──────┤   │   │
│           │  │  │                      │ 56.0h │      │      │   │   │
│           │  │  └───────────────────────────────────────────┘   │   │
│           │  │                                                  │   │
│           │  │  SUMMARY                                         │   │
│           │  │  ┌───────────────────────────────────────────┐   │   │
│           │  │  │ Subtotal:                       £768.00   │   │   │
│           │  │  │ Holiday Pay (12.07%):            £92.70   │   │   │
│           │  │  │ Deductions:                       £0.00   │   │   │
│           │  │  ├───────────────────────────────────────────┤   │   │
│           │  │  │ TOTAL:                          £860.70   │   │   │
│           │  │  └───────────────────────────────────────────┘   │   │
│           │  │                                                  │   │
│           │  │  [Download PDF]    [Print]                       │   │
│           │  └──────────────────────────────────────────────────┘   │
│           │                                                         │
└───────────┴─────────────────────────────────────────────────────────┘
```

### Mobile Layout (375px)
- Header section stacks vertically (staff info above status)
- Line items table becomes card-based (one card per shift)
- Summary section remains tabular but full-width
- Download/Print buttons become full-width stacked

---

## Responsive Breakpoint Summary

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Mobile | < 640px | Single column, hamburger menu, card-based tables, stacked forms |
| Tablet | 640px - 1024px | Collapsed sidebar, 2-col grids, condensed tables |
| Desktop | 1024px - 1280px | Full sidebar, 2-3 col grids, full tables |
| Wide | > 1280px | Full sidebar, 3-col grids, side-by-side panels |

## Component Library Reference

| Component | Framework | Usage |
|-----------|-----------|-------|
| MetricCard | Custom + Tailwind | Dashboard stat cards with icons and trends |
| DetailsList | Fluent UI | Tabular data (approvals, shifts, invoices) |
| Card | Custom + Tailwind | Content containers with hover effects |
| SignatureCanvas | Custom | Digital signature capture on mobile |
| ActivityHeatMap | Custom + SVG | GitHub-style activity visualization |
| SwipeableTabs | Custom | Mobile tab navigation with swipe |
| LiveShiftTimer | Custom | Real-time shift duration counter |
| MapHeader | React Native Maps | Map display with venue markers |

## Notes

- Cross-reference with `15_Information_Architecture.md` for complete page inventory
- Cross-reference with `16_User_Flows.md` for flow context of these screens
- Cross-reference with `12_System_Architecture.md` for frontend component architecture
- All wireframes derived from actual source code component structures

## Source Files

- `mobile/src/screens/dashboard/UberDashboardScreen.tsx` - Mobile dashboard with MapHeader, stats, quick actions
- `mobile/src/screens/dashboard/components/` - Dashboard sub-components (MapHeader, LiveShiftTimer, OverviewStats, etc.)
- `mobile/src/screens/shifts/CheckInFlowScreen.tsx` - Multi-step check-in (location, terms, camera, signature)
- `frontend/src/pages/manager/Approvals.tsx` - Tabbed approval interface with DetailsList
- `frontend/src/pages/admin/Dashboard.tsx` - Admin dashboard with metrics, heatmap, widgets
- `frontend/src/components/LeaveRequestForm.tsx` - Leave request form with balance preview
- `mobile/src/screens/leave/LeaveRequestScreen.tsx` - Mobile leave request
- `frontend/src/pages/admin/InvoiceGeneration.tsx` - Invoice generation and detail view
- `mobile/src/screens/profile/InvoiceDetailScreen.tsx` - Mobile invoice detail
- `frontend/src/components/ActiveShiftsWidget.tsx` - Active shifts table widget
- `frontend/src/components/IncompleteShiftsWidget.tsx` - Incomplete shifts management widget
- `frontend/src/components/AdjustTimeDialog.tsx` - Time adjustment modal dialog
