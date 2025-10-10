# Mobile App UI Wireframes and User Flows

## Table of Contents
1. [Design System Overview](#design-system-overview)
2. [Authentication Flows](#authentication-flows)
3. [Dashboard & Navigation](#dashboard--navigation)
4. [Shift Management Flows](#shift-management-flows)
5. [Check-In Flow with Photo Verification](#check-in-flow-with-photo-verification)
6. [Incident Reporting Flow](#incident-reporting-flow)
7. [Shift Checks Flow](#shift-checks-flow)
8. [Profile & Settings](#profile--settings)
9. [Offline Mode Indicators](#offline-mode-indicators)

---

## Design System Overview

### Liquid Glass UI Theme
```
Primary Colors:
- Primary Blue: #007AFF (iOS accent)
- Success Green: #34C759
- Warning Orange: #FF9500
- Error Red: #FF3B30
- Background: Frosted glass with 0.8 opacity blur

Typography:
- Display: SF Pro Display (iOS) / Roboto (Android)
- Body: SF Pro Text (iOS) / Roboto (Android)
- Mono: SF Mono (iOS) / Roboto Mono (Android)

Spacing:
- Base unit: 8dp
- Minimum touch target: 48dp x 48dp
- Screen padding: 16dp
- Card spacing: 12dp

Shadows:
- Elevation 1: 0 2dp 4dp rgba(0,0,0,0.1)
- Elevation 2: 0 4dp 8dp rgba(0,0,0,0.15)
- Elevation 3: 0 8dp 16dp rgba(0,0,0,0.2)
```

### Accessibility Standards
- All interactive elements: minimum 48dp touch target
- Color contrast ratio: 4.5:1 for text, 3:1 for UI components
- Screen reader support: All elements have accessibility labels
- Haptic feedback: All button presses and critical actions
- Voice input: Available for all text input fields

---

## Authentication Flows

### 1. Login Screen
```
┌─────────────────────────────────────┐
│                                     │
│          🔒 Security Portal         │
│                                     │
│     ┌───────────────────────────┐   │
│     │ Email                     │   │
│     │ [                       ] │   │
│     └───────────────────────────┘   │
│                                     │
│     ┌───────────────────────────┐   │
│     │ Password                  │   │
│     │ [                       ]👁│   │
│     └───────────────────────────┘   │
│                                     │
│     ┌───────────────────────────┐   │
│     │       LOGIN               │   │
│     └───────────────────────────┘   │
│                                     │
│          Forgot Password?           │
│                                     │
│     ┌───────────────────────────┐   │
│     │   🔐 Biometric Login      │   │
│     └───────────────────────────┘   │
│                                     │
│         v1.0.0 • Build 42           │
└─────────────────────────────────────┘

Accessibility Features:
- Large touch targets (48dp height)
- Password visibility toggle
- Biometric authentication (Face ID/Touch ID/Fingerprint)
- Screen reader labels for all inputs
- High contrast mode support

User Flow:
1. App opens → Login screen
2. User enters credentials OR taps biometric button
3. On success → Dashboard
4. On error → Show error message with retry option
5. "Forgot Password" → Web view or deep link to web app
```

### 2. Biometric Authentication Flow
```
User Action: Tap "Biometric Login"
    ↓
System Check: Is biometric enabled?
    ↓
    ├─ Yes → Prompt for Face ID/Fingerprint
    │         ↓
    │         Success → Dashboard
    │         Fail → Show error, allow retry
    │
    └─ No → Redirect to Settings to enable biometric
```

---

## Dashboard & Navigation

### Main Dashboard (Post-Login)
```
┌─────────────────────────────────────┐
│ ☰  Dashboard          🔔 👤         │ ← Top Bar
├─────────────────────────────────────┤
│                                     │
│  👋 Welcome back, John!             │
│  📅 Monday, Jan 15, 2025            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 ACTIVE SHIFT                 │ │
│ │                                 │ │
│ │ 📍 The Grand Nightclub          │ │
│ │ ⏰ 10:00 PM - 4:00 AM           │ │
│ │                                 │ │
│ │ ⏱️  2h 15m elapsed              │ │
│ │                                 │ │
│ │ [📸 Check In Photo]             │ │
│ │                                 │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │    ❌ CHECK OUT            │ │ │
│ │ └─────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Quick Actions                       │
│ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │   🚨   │ │   ✅   │ │   📋   │   │
│ │ Report │ │ Checks │ │  Docs  │   │
│ └────────┘ └────────┘ └────────┘   │
│                                     │
│ Upcoming Shifts                     │
│ ┌─────────────────────────────────┐ │
│ │ 🗓️ Wed, Jan 17 • 9:00 PM       │ │
│ │ The Grand Nightclub             │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🗓️ Fri, Jan 19 • 10:00 PM      │ │
│ │ Blue Moon Bar                   │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
│ 🏠    📅    👥    ⚙️               │ ← Bottom Nav
└─────────────────────────────────────┘

Components:
1. Top Bar
   - Hamburger menu (☰) → Drawer navigation
   - Notifications bell (🔔) → Badge count
   - Profile avatar (👤) → Profile screen

2. Active Shift Card (Liquid Glass Style)
   - Frosted glass background with blur
   - Real-time elapsed time counter
   - Check-in photo thumbnail (tappable to view full)
   - Large "Check Out" button (48dp height)

3. Quick Actions Row
   - Report Incident (🚨)
   - Shift Checks (✅)
   - Documents/Training (📋)

4. Upcoming Shifts List
   - Scrollable list of next 5 shifts
   - Tap to view shift details

5. Bottom Navigation (Always Visible)
   - Home (🏠) - Current screen
   - Calendar (📅) - All shifts view
   - Team (👥) - Team communication
   - Settings (⚙️) - App settings

Accessibility:
- All cards have elevation and clear boundaries
- Bottom nav icons have labels for screen readers
- Quick action buttons have 56dp touch targets
- Haptic feedback on all button taps
```

### Navigation Drawer (Hamburger Menu)
```
┌─────────────────────────────────────┐
│                                     │
│  ┌───────────────┐                  │
│  │  👤 John Doe  │                  │
│  │  Door Supervisor │              │
│  └───────────────┘                  │
│                                     │
│  🏠 Dashboard                       │
│  📅 My Shifts                       │
│  🚨 Incident Reports                │
│  ✅ Shift Checks History            │
│  📋 Training & Docs                 │
│  💳 Virtual ID                      │
│  💰 Invoices                        │
│  ⚙️ Settings                        │
│  ❓ Help & Support                  │
│  🚪 Logout                          │
│                                     │
│  ────────────────────────────────   │
│  📶 Online • Synced 2m ago          │
│                                     │
└─────────────────────────────────────┘

Accessibility:
- Each menu item: 56dp height for easy tapping
- Screen reader announces menu state (open/closed)
- Swipe gesture to open/close drawer
- Tap outside drawer to close
```

---

## Shift Management Flows

### Shift Details Screen
```
┌─────────────────────────────────────┐
│ ←  Shift Details           ⋮        │
├─────────────────────────────────────┤
│                                     │
│ 📍 The Grand Nightclub              │
│ 123 Main Street, London, W1A 1AA    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🗓️ Monday, Jan 15, 2025         │ │
│ │ ⏰ 10:00 PM - 4:00 AM (6 hours) │ │
│ │ 💰 £15.50/hour                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Your Role                           │
│ ┌─────────────────────────────────┐ │
│ │ 🛡️ Door Supervisor              │ │
│ │ SIA License: Valid ✅           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Required Checks                     │
│ ┌─────────────────────────────────┐ │
│ │ ✅ Fire Exit Check (Every 2h)   │ │
│ │ ✅ Capacity Check (Every 1h)    │ │
│ │ ✅ Toilet Check (Every 2h)      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Venue Terms & Conditions            │
│ ┌─────────────────────────────────┐ │
│ │ [View Terms] → Not Yet Accepted │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │     🗺️ GET DIRECTIONS          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │     📞 CONTACT MANAGER          │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

Overflow Menu (⋮):
- Share Shift Details
- Add to Calendar
- Request Exchange
- Report Issue

Accessibility:
- All buttons: 48dp minimum height
- Venue address: Long-press to copy
- Screen reader announces all shift details
- Haptic feedback on critical actions
```

### Calendar View (All Shifts)
```
┌─────────────────────────────────────┐
│ ←  My Shifts          Jan 2025   ›  │
├─────────────────────────────────────┤
│                                     │
│  Mo  Tu  We  Th  Fr  Sa  Su        │
│                   1   2   3   4     │
│   5   6   7   8   9  10  11         │
│  12  13  14 [15] 16  17  18         │ ← Selected: 15
│  19  20  21  22  23  24  25         │
│  26  27  28  29  30  31             │
│                                     │
│ 🟢 = Active Shift                   │
│ 🔵 = Upcoming Shift                 │
│ ⚪ = No Shift                       │
│                                     │
│ Shifts on Monday, Jan 15            │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 10:00 PM - 4:00 AM           │ │
│ │ The Grand Nightclub             │ │
│ │ Door Supervisor • 6 hours       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │       + ADD TO CALENDAR         │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

Interactions:
- Tap date → Show shifts for that day
- Swipe left/right → Previous/Next month
- Long-press shift card → Quick actions menu
- Pull to refresh → Sync shifts from server

Accessibility:
- Calendar dates: Announce shift count
- Color-coded dots with labels (not just color)
- Screen reader announces selected date
```

---

## Check-In Flow with Photo Verification

### Step 1: Pre-Check-In Screen
```
┌─────────────────────────────────────┐
│ ←  Check In                         │
├─────────────────────────────────────┤
│                                     │
│  📍 Verify Your Location            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │      [MAP VIEW]             │   │
│  │                             │   │
│  │   📍 (Your Location)        │   │
│  │   🏢 (Venue Location)       │   │
│  │                             │   │
│  │   Distance: 12m             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ✅ You are at the venue            │
│                                     │
│  Next Steps:                        │
│  1. Take venue entrance photo       │
│  2. Sign digital signature          │
│  3. Accept venue terms              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    📸 START CHECK-IN        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Location Verification:
- GPS accuracy: ±5 meters
- Maximum distance from venue: 50 meters
- Fallback: Manual override with manager approval
- Offline mode: Queue check-in for later sync

Accessibility:
- Map view: Alternative text description of location
- Distance announced by screen reader
- Haptic feedback when within range
```

### Step 2: Camera Capture Screen
```
┌─────────────────────────────────────┐
│ ✕                              Flash│
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │                                 │ │
│ │        [CAMERA PREVIEW]         │ │
│ │                                 │ │
│ │   (Venue entrance in frame)     │ │
│ │                                 │ │
│ │                                 │ │
│ │  ┌───────────────────────────┐  │ │
│ │  │ Center venue entrance     │  │ │ ← Guidance
│ │  └───────────────────────────┘  │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  [Gallery]      ( O )      [Retake] │
│                                     │
│  📍 The Grand Nightclub             │
│  🕐 10:02 PM • Jan 15, 2025         │
│                                     │
└─────────────────────────────────────┘

Camera Features:
- Auto-focus on venue entrance
- Flash toggle (top right)
- Gallery access (bottom left) - select existing photo
- Retake button (bottom right)
- Metadata embedded: GPS, timestamp, venue ID

Accessibility:
- Voice guidance: "Point camera at venue entrance"
- Haptic feedback when photo captured
- Alternative: Upload photo from gallery
- Screen reader announces camera ready state
```

### Step 3: Photo Review Screen
```
┌─────────────────────────────────────┐
│ ←  Review Photo                     │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │    [CAPTURED PHOTO]             │ │
│ │                                 │ │
│ │    Venue entrance clearly       │ │
│ │    visible                      │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  📍 The Grand Nightclub             │
│  🕐 10:02 PM • Jan 15, 2025         │
│  📏 Optimized: 1.2 MB → 380 KB      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      ✅ LOOKS GOOD          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      🔄 RETAKE PHOTO        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Photo Processing:
- Automatic compression (max 2MB)
- Thumbnail generation for list views
- EXIF data preserved (GPS, timestamp)
- Offline: Save locally, queue for upload

Accessibility:
- Pinch to zoom on photo
- Screen reader describes photo metadata
- Haptic feedback on confirm
```

### Step 4: Digital Signature Screen
```
┌─────────────────────────────────────┐
│ ←  Digital Signature                │
├─────────────────────────────────────┤
│                                     │
│  Sign to confirm your arrival       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ╔═══════════════════════════╗   │ │
│ │ ║                           ║   │ │
│ │ ║   [Signature Canvas]      ║   │ │
│ │ ║                           ║   │ │
│ │ ║   Sign here with finger   ║   │ │
│ │ ║                           ║   │ │
│ │ ╚═══════════════════════════╝   │ │
│ └─────────────────────────────────┘ │
│                                     │
│  [Clear]                    [Done]  │
│                                     │
│  By signing, you confirm:           │
│  • You are at the venue             │
│  • You have read venue terms        │
│  • You are fit for duty             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      ✍️ CONFIRM & CHECK IN  │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Signature Features:
- Smooth canvas with pressure sensitivity
- Clear button to restart signature
- Signature saved as PNG with transparency
- Encrypted storage in database

Accessibility:
- Alternative: Type full name as signature
- Haptic feedback on signature start/end
- Screen reader announces signature status
```

### Step 5: Venue Terms Acceptance
```
┌─────────────────────────────────────┐
│ ←  Venue Terms                      │
├─────────────────────────────────────┤
│                                     │
│  The Grand Nightclub                │
│  Terms & Conditions v2.3            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │ 1. Staff must be in uniform... │ │
│ │                                 │ │
│ │ 2. Radio communication is...   │ │
│ │                                 │ │
│ │ 3. Prohibited items include... │ │
│ │                                 │ │
│ │ 4. Emergency procedures...     │ │
│ │                                 │ │
│ │        [Scrollable]             │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ☑️ I have read and accept   │   │
│  │    these terms              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    📋 ACCEPT & CONTINUE     │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Features:
- Only shown if terms not previously accepted
- Version tracking (re-accept if terms updated)
- Scrollable content area
- Must check checkbox before continuing
- Terms cached offline for re-reading

Accessibility:
- Screen reader reads terms aloud (with pause/resume)
- Large checkbox (56dp touch target)
- Text size adjustable in settings
```

### Step 6: Check-In Success
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│           ✅                         │
│                                     │
│      Check-In Successful!           │
│                                     │
│  📍 The Grand Nightclub             │
│  🕐 Started: 10:02 PM               │
│  ⏱️  Shift Duration: 6 hours        │
│                                     │
│  Your shift is now active.          │
│  Remember to complete:              │
│                                     │
│  • Fire Exit Checks (Every 2h)      │
│  • Capacity Checks (Every 1h)       │
│  • Toilet Checks (Every 2h)         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🏠 GO TO DASHBOARD       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ START FIRST CHECK     │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Success Feedback:
- Checkmark animation (scale + fade in)
- Haptic success feedback (3 short pulses)
- Optional sound notification
- Push notification scheduled for first check reminder

Accessibility:
- Screen reader announces "Check-in successful"
- High contrast checkmark icon
- Clear next action buttons
```

---

## Incident Reporting Flow

### Method 1: Voice-to-Text Reporting
```
┌─────────────────────────────────────┐
│ ←  Report Incident                  │
├─────────────────────────────────────┤
│                                     │
│  🎤 Voice Report (Recommended)      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │         🎙️ 🔴              │   │
│  │                             │   │
│  │     Hold to Record          │   │
│  │                             │   │
│  │     [Recording: 0:00]       │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Transcription:                     │
│  ┌─────────────────────────────┐   │
│  │ "There was a fight between  │   │
│  │  two patrons near the bar   │   │
│  │  at around 11:30 PM. I      │   │
│  │  separated them and..."     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✏️ EDIT TRANSCRIPTION   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ➡️ CONTINUE              │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Voice Features:
- Hold button to record (like voice messages)
- Real-time waveform visualization
- Automatic transcription (offline-capable)
- Edit transcription before submitting
- Voice feedback: "Recording started/stopped"

Accessibility:
- Large record button (80dp diameter)
- Haptic feedback on record start/stop
- Visual recording indicator (red pulse)
- Alternative: Switch to text input mode
```

### Method 2: Quick-Tap Incident Types
```
┌─────────────────────────────────────┐
│ ←  Report Incident                  │
├─────────────────────────────────────┤
│                                     │
│  Quick Report (Select Type)         │
│                                     │
│  ┌──────────┐ ┌──────────┐         │
│  │    👊    │ │    🚨    │         │
│  │  Fight   │ │  Alarm   │         │
│  └──────────┘ └──────────┘         │
│                                     │
│  ┌──────────┐ ┌──────────┐         │
│  │    🤕    │ │    🚪    │         │
│  │  Injury  │ │Ejection  │         │
│  └──────────┘ └──────────┘         │
│                                     │
│  ┌──────────┐ ┌──────────┐         │
│  │    🍺    │ │    💊    │         │
│  │  Drugs   │ │ Medical  │         │
│  └──────────┘ └──────────┘         │
│                                     │
│  ┌──────────┐ ┌──────────┐         │
│  │    🔥    │ │    ⚠️    │         │
│  │   Fire   │ │  Other   │         │
│  └──────────┘ └──────────┘         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    📝 DETAILED REPORT       │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Quick-Tap Features:
- Large icon buttons (96dp x 96dp)
- Single tap → Pre-filled template form
- Color-coded severity (red = critical, yellow = moderate)
- Grid layout for easy scanning

Accessibility:
- Icons with text labels (not just icons)
- Screen reader announces incident type
- Haptic feedback on selection
- High contrast mode support
```

### Incident Details Form (After Selection)
```
┌─────────────────────────────────────┐
│ ←  Fight Incident                   │
├─────────────────────────────────────┤
│                                     │
│  Incident Type: 👊 Fight            │
│  Time: 11:32 PM • Jan 15, 2025      │
│  Location: The Grand Nightclub      │
│                                     │
│  Severity                           │
│  ○ Minor   ● Moderate   ○ Critical  │
│                                     │
│  Description                        │
│  ┌─────────────────────────────┐   │
│  │ Two patrons were fighting   │   │
│  │ near the bar. I separated   │   │
│  │ them and escorted one out.  │   │
│  │ [                         ] │   │
│  └─────────────────────────────┘   │
│                                     │
│  People Involved                    │
│  ┌─────────────────────────────┐   │
│  │ [Add name or description] ➕│   │
│  └─────────────────────────────┘   │
│                                     │
│  Evidence                           │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ 📸   │ │ 🎥   │ │ 🎙️   │       │
│  │Photo │ │Video │ │Voice │       │
│  └──────┘ └──────┘ └──────┘       │
│                                     │
│  Police Involved?                   │
│  ○ Yes   ● No                       │
│                                     │
│  Ambulance Called?                  │
│  ○ Yes   ● No                       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    📤 SUBMIT REPORT         │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Form Features:
- Pre-filled timestamp and location
- Severity selection (visual + text)
- Multi-line description field
- Add multiple people involved
- Attach photo/video/voice evidence
- Yes/No toggles for emergency services
- Auto-save draft every 30 seconds

Accessibility:
- All radio buttons: 48dp touch targets
- Screen reader announces selected options
- Voice input available for description field
- Haptic feedback on evidence capture
```

### Incident Evidence Capture
```
┌─────────────────────────────────────┐
│ ✕  Add Photo Evidence               │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │     [CAMERA PREVIEW]            │ │
│ │                                 │ │
│ │   (Scene of incident)           │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  ( O )                              │
│                                     │
│  ⚠️ Ensure no identifiable faces    │
│     are visible (GDPR compliance)   │
│                                     │
│  Photos: 0/5                        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ ADD PHOTO             │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Evidence Features:
- Multiple photos (max 5 per incident)
- Video recording (max 30 seconds)
- Voice notes (max 2 minutes)
- GDPR warning about faces/identities
- Auto-compression before upload
- Offline: Queue for later upload

Accessibility:
- Voice guidance for camera positioning
- Haptic feedback on capture
- Alternative: Upload from gallery
```

### Incident Submission Success
```
┌─────────────────────────────────────┐
│                                     │
│           ✅                         │
│                                     │
│    Incident Report Submitted        │
│                                     │
│  Reference: INC-2025-001234         │
│  Submitted: 11:35 PM                │
│                                     │
│  Your report has been sent to:      │
│  • Venue Manager                    │
│  • Security Manager                 │
│                                     │
│  You will be notified when reviewed.│
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🏠 BACK TO DASHBOARD     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    📋 VIEW ALL REPORTS      │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Success Features:
- Unique reference number for tracking
- Email confirmation sent to staff
- Push notification on manager review
- Copy reference number to clipboard

Accessibility:
- Screen reader announces submission success
- Haptic success feedback
- Reference number announced clearly
```

---

## Shift Checks Flow

### Shift Checks Dashboard
```
┌─────────────────────────────────────┐
│ ←  Shift Checks                     │
├─────────────────────────────────────┤
│                                     │
│  Active Shift: The Grand Nightclub  │
│  Started: 10:02 PM                  │
│                                     │
│  Required Checks                    │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ 🔥 Fire Exit Check              │ │
│  │ Every 2 hours                   │ │
│  │                                 │ │
│  │ Last: 10:15 PM ✅               │ │
│  │ Next: 12:15 AM ⏰               │ │
│  │                                 │ │
│  │ [START CHECK]                   │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ 👥 Capacity Check               │ │
│  │ Every 1 hour                    │ │
│  │                                 │ │
│  │ Last: 11:00 PM ✅               │ │
│  │ Next: 12:00 AM ⏰               │ │
│  │                                 │ │
│  │ [START CHECK]                   │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ 🚽 Toilet Check                 │ │
│  │ Every 2 hours                   │ │
│  │                                 │ │
│  │ Last: 10:30 PM ✅               │ │
│  │ Next: 12:30 AM ⏰               │ │
│  │                                 │ │
│  │ [START CHECK]                   │ │
│  └─────────────────────────────────┘ │
│                                     │
│  Overall Progress: 75%              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░              │
│                                     │
└─────────────────────────────────────┘

Dashboard Features:
- Real-time next check countdown
- Visual progress bar for overall completion
- Push notification 10 minutes before due
- Color-coded status (green = done, yellow = due soon, red = overdue)

Accessibility:
- Screen reader announces overdue checks first
- Haptic reminder when check is due
- Large "Start Check" buttons (48dp)
```

### Fire Exit Check Form
```
┌─────────────────────────────────────┐
│ ←  Fire Exit Check                  │
├─────────────────────────────────────┤
│                                     │
│  Location: Main Entrance            │
│  Time: 12:15 AM                     │
│                                     │
│  Exit Status                        │
│  ● Clear   ○ Blocked   ○ Obstructed │
│                                     │
│  Exit Door                          │
│  ● Unlocked   ○ Locked   ○ Damaged  │
│                                     │
│  Signage Visible                    │
│  ● Yes   ○ No                       │
│                                     │
│  Emergency Lighting                 │
│  ● Working   ○ Not Working          │
│                                     │
│  Issues Found?                      │
│  ○ Yes   ● No                       │
│                                     │
│  Notes (Optional)                   │
│  ┌─────────────────────────────┐   │
│  │ [                         ] │   │
│  └─────────────────────────────┘   │
│                                     │
│  Photo Evidence (Optional)          │
│  ┌──────┐                           │
│  │ 📸   │ Tap to add photo          │
│  └──────┘                           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ COMPLETE CHECK        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Check Features:
- Pre-defined checklist items
- Radio button selections (single choice)
- Optional notes for details
- Photo evidence if issues found
- GPS location automatically recorded
- Offline: Save locally, sync later

Accessibility:
- All radio buttons: 56dp touch targets
- Screen reader announces check progress
- Voice input for notes field
- Haptic feedback on selection
```

### Capacity Check Form
```
┌─────────────────────────────────────┐
│ ←  Capacity Check                   │
├─────────────────────────────────────┤
│                                     │
│  Location: Main Floor               │
│  Time: 12:00 AM                     │
│  Max Capacity: 500                  │
│                                     │
│  Current Count                      │
│  ┌─────────────────────────────┐   │
│  │          450                │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌───┐   Quick Adjust   ┌───┐      │
│  │-10│  │-5│  │+5│  │+10│ │         │
│  └───┘   └──┘  └──┘  └───┘         │
│                                     │
│  Capacity Status                    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 90%          │
│  ⚠️ Approaching capacity limit      │
│                                     │
│  Action Taken                       │
│  ○ None   ● Restricted Entry        │
│  ○ Stopped Entry                    │
│                                     │
│  Notes (Optional)                   │
│  ┌─────────────────────────────┐   │
│  │ [                         ] │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ COMPLETE CHECK        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Capacity Features:
- Large number input for current count
- Quick adjustment buttons (±5, ±10)
- Visual capacity gauge
- Auto-warning at 85% capacity
- Action taken required if over 85%
- Historical trend graph (optional)

Accessibility:
- Number input: Large font (24pt)
- Voice input: "Current capacity is 450"
- Haptic warning when approaching limit
- Screen reader announces capacity percentage
```

### Check Completion Success
```
┌─────────────────────────────────────┐
│                                     │
│           ✅                         │
│                                     │
│      Check Completed!               │
│                                     │
│  Fire Exit Check                    │
│  Completed: 12:16 AM                │
│                                     │
│  Next check due: 2:16 AM            │
│  ⏰ Reminder set                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🏠 BACK TO DASHBOARD     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ VIEW ALL CHECKS       │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Success Features:
- Checkmark animation
- Next check reminder scheduled
- Haptic success feedback
- Auto-return to checks dashboard after 3 seconds

Accessibility:
- Screen reader announces completion
- Haptic pattern: 3 short pulses for success
```

---

## Profile & Settings

### Profile Screen
```
┌─────────────────────────────────────┐
│ ←  Profile                     ⚙️   │
├─────────────────────────────────────┤
│                                     │
│       ┌──────────┐                  │
│       │    👤    │                  │
│       │  Photo   │                  │
│       └──────────┘                  │
│                                     │
│       John Doe                      │
│       Door Supervisor               │
│       john.doe@example.com          │
│                                     │
│  ════════════════════════════════   │
│                                     │
│  📋 Personal Information            │
│  ┌─────────────────────────────┐   │
│  │ Phone: +44 7700 900123      │   │
│  │ DOB: Jan 15, 1990           │   │
│  │ NI Number: AB123456C        │   │
│  └─────────────────────────────┘   │
│                                     │
│  🛡️ SIA License                     │
│  ┌─────────────────────────────┐   │
│  │ License No: 123456789       │   │
│  │ Type: Door Supervisor       │   │
│  │ Valid Until: Dec 31, 2025 ✅│   │
│  └─────────────────────────────┘   │
│                                     │
│  📚 Qualifications                  │
│  ┌─────────────────────────────┐   │
│  │ First Aid: Valid ✅         │   │
│  │ Conflict Management: Valid ✅│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✏️ EDIT PROFILE          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    💳 VIEW VIRTUAL ID       │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Profile Features:
- Editable profile photo (tap to change)
- Read-only personal information
- SIA license status with expiry warning
- Qualifications list with validity
- Virtual ID access button

Accessibility:
- Profile photo: Alternative text with name
- License expiry: Announced with urgency
- All text: Scalable font sizes
```

### Virtual ID Card
```
┌─────────────────────────────────────┐
│ ←  Virtual ID                       │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │  ┌─────┐  John Doe              │ │
│ │  │     │  Door Supervisor       │ │
│ │  │Photo│  Security Portal Ltd   │ │
│ │  │     │                        │ │
│ │  └─────┘  SIA: 123456789        │ │
│ │           Valid: Dec 31, 2025   │ │
│ │                                 │ │
│ │  ┌─────────────────────────┐   │ │
│ │  │                         │   │ │
│ │  │      [QR CODE]          │   │ │
│ │  │                         │   │ │
│ │  └─────────────────────────┘   │ │
│ │                                 │ │
│ │  ID: VID-2025-001234            │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  ⚡ Brightness: ████████░░ (80%)    │
│                                     │
│  ℹ️ This ID is valid for 24 hours  │
│     Last updated: 10:00 PM          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🔄 REFRESH ID            │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    💾 SAVE TO WALLET        │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Virtual ID Features:
- QR code with encrypted staff data
- 24-hour validity with refresh option
- Auto-brightness boost for scanning
- Offline access (cached last 3 IDs)
- Add to Apple Wallet / Google Pay

Accessibility:
- QR code: Alternative text with ID number
- Large QR code for easy scanning
- Screen reader announces ID validity
- Haptic feedback on refresh
```

### Settings Screen
```
┌─────────────────────────────────────┐
│ ←  Settings                         │
├─────────────────────────────────────┤
│                                     │
│  Account                            │
│  ┌─────────────────────────────┐   │
│  │ 🔐 Change Password          │   │
│  │ 📱 Biometric Login     [ON] │   │
│  │ 📧 Email Notifications [ON] │   │
│  └─────────────────────────────┘   │
│                                     │
│  Appearance                         │
│  ┌─────────────────────────────┐   │
│  │ 🌓 Dark Mode          [ON]  │   │
│  │ 🔤 Text Size          [Aa]  │   │
│  │ 🎨 Theme         [Liquid]   │   │
│  └─────────────────────────────┘   │
│                                     │
│  Accessibility                      │
│  ┌─────────────────────────────┐   │
│  │ 📢 Voice Guidance     [ON]  │   │
│  │ 📳 Haptic Feedback    [ON]  │   │
│  │ 🔊 Sound Effects      [OFF] │   │
│  │ ♿ High Contrast      [OFF] │   │
│  └─────────────────────────────┘   │
│                                     │
│  Data & Storage                     │
│  ┌─────────────────────────────┐   │
│  │ 📶 Offline Mode       [ON]  │   │
│  │ 💾 Storage Used    1.2 GB   │   │
│  │ 🔄 Auto-Sync          [ON]  │   │
│  │ 🗑️ Clear Cache             │   │
│  └─────────────────────────────┘   │
│                                     │
│  About                              │
│  ┌─────────────────────────────┐   │
│  │ ℹ️ Version 1.0.0 (Build 42) │   │
│  │ 📄 Terms & Conditions       │   │
│  │ 🔒 Privacy Policy           │   │
│  │ ❓ Help & Support           │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🚪 LOGOUT                │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

Settings Features:
- Toggle switches for binary options
- Sliders for gradual settings (text size)
- Clear cache with confirmation dialog
- Logout with confirmation

Accessibility:
- All toggles: Large (56dp) touch targets
- Screen reader announces toggle states
- Haptic feedback on toggle changes
- High contrast mode affects entire app
```

---

## Offline Mode Indicators

### Network Status Banner
```
OFFLINE MODE:
┌─────────────────────────────────────┐
│ ⚠️ Offline Mode                     │
│ Changes will sync when online       │
└─────────────────────────────────────┘

SYNCING:
┌─────────────────────────────────────┐
│ 🔄 Syncing... (3 pending actions)   │
└─────────────────────────────────────┘

ONLINE:
┌─────────────────────────────────────┐
│ ✅ Online • Last synced 2m ago      │
└─────────────────────────────────────┘

Features:
- Persistent banner at top of all screens
- Auto-hide when online and synced
- Tap banner → View sync queue
- Color-coded: Yellow (offline), Blue (syncing), Green (online)

Accessibility:
- Screen reader announces network status changes
- Haptic pattern when going offline (long pulse)
- Haptic pattern when back online (3 short pulses)
```

### Sync Queue View
```
┌─────────────────────────────────────┐
│ ←  Sync Queue                       │
├─────────────────────────────────────┤
│                                     │
│  Pending Actions: 3                 │
│  Will sync when online              │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ 📸 Check-In Photo               │ │
│  │ The Grand Nightclub             │ │
│  │ Size: 1.2 MB                    │ │
│  │ Created: 10:02 PM               │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ 🚨 Incident Report              │ │
│  │ Reference: INC-2025-001234      │ │
│  │ Created: 11:35 PM               │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ ✅ Fire Exit Check              │ │
│  │ Main Entrance                   │ │
│  │ Created: 12:16 AM               │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │    🔄 SYNC NOW                  │ │
│  └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

Sync Queue Features:
- Shows all pending offline actions
- Displays action type, size, and timestamp
- Manual sync trigger button
- Auto-sync when network returns
- Retry failed syncs with exponential backoff

Accessibility:
- Screen reader announces queue count
- Haptic feedback on sync start/complete
- Visual progress indicator during sync
```

---

## Animation & Transition Specifications

### Screen Transitions
```
Navigation Push (Forward):
- Duration: 300ms
- Easing: ease-out
- Animation: Slide from right (X: 100% → 0%)

Navigation Pop (Back):
- Duration: 250ms
- Easing: ease-in
- Animation: Slide to right (X: 0% → 100%)

Modal Present:
- Duration: 400ms
- Easing: spring (damping: 0.8)
- Animation: Scale up (0.9 → 1.0) + Fade in (0 → 1)

Modal Dismiss:
- Duration: 300ms
- Easing: ease-in
- Animation: Scale down (1.0 → 0.9) + Fade out (1 → 0)
```

### Component Animations
```
Button Press:
- Duration: 150ms
- Animation: Scale (1.0 → 0.95 → 1.0)
- Haptic: Light impact

Card Tap:
- Duration: 200ms
- Animation: Scale (1.0 → 0.98) + Shadow increase
- Haptic: Medium impact

Success Checkmark:
- Duration: 600ms
- Animation: Scale (0 → 1.2 → 1.0) + Rotation (0° → 360°)
- Haptic: Success notification pattern

Error Shake:
- Duration: 400ms
- Animation: Translate X (0 → -10 → 10 → -5 → 5 → 0)
- Haptic: Error notification pattern

Loading Spinner:
- Duration: 1000ms (infinite)
- Animation: Rotation (0° → 360°)
- Easing: Linear

Skeleton Shimmer:
- Duration: 2000ms (infinite)
- Animation: Background gradient slide (left to right)
- Easing: ease-in-out
```

### Liquid Glass Effects
```
Glass Card:
- Background: rgba(255, 255, 255, 0.1) (dark mode)
            rgba(0, 0, 0, 0.05) (light mode)
- Backdrop Filter: blur(20px)
- Border: 1px solid rgba(255, 255, 255, 0.2)
- Shadow: 0 8px 32px rgba(0, 0, 0, 0.1)

Hover Effect:
- Duration: 200ms
- Animation: Translate Y (0 → -2px) + Shadow increase
- Background opacity: 0.1 → 0.15

Active State:
- Duration: 100ms
- Animation: Scale (1.0 → 0.98)
- Background opacity: 0.1 → 0.05
```

---

## Responsive Design Guidelines

### Breakpoints
```
Small Phones: < 375px width
- Single column layouts
- Stacked navigation
- Reduced padding (12dp)

Standard Phones: 375px - 414px
- Standard layouts (as shown in wireframes)
- Bottom navigation
- Standard padding (16dp)

Large Phones / Phablets: 414px - 600px
- Enhanced spacing
- Larger touch targets (optional)
- Increased padding (20dp)

Tablets: > 600px
- Two-column layouts where appropriate
- Side navigation (instead of bottom nav)
- Maximum content width: 800px (centered)
```

### Orientation Handling
```
Portrait (Default):
- All layouts optimized for portrait
- Bottom navigation visible
- Vertical scrolling

Landscape:
- Auto-rotate disabled for camera screens
- Check-in flow: Portrait only
- Incident reporting: Portrait only
- Dashboard: Landscape supported
- Settings: Landscape supported
```

---

## Platform-Specific Considerations

### iOS (Liquid Glass UI)
```
Navigation:
- Large title headers (iOS 11+)
- Swipe-back gesture enabled
- System font: SF Pro Display/Text

UI Elements:
- Frosted glass navigation bar
- System blur effects throughout
- Native action sheets for confirmations
- Pull-to-refresh with system animation

Interactions:
- Haptic feedback using UIImpactFeedbackGenerator
- 3D Touch for quick actions (if available)
- Face ID / Touch ID integration
```

### Android (Material Design)
```
Navigation:
- Material Design top app bar
- System back button respected
- System font: Roboto

UI Elements:
- Material elevation (shadows)
- Ripple effects on button taps
- Material dialogs for confirmations
- Swipe-to-refresh with material animation

Interactions:
- Haptic feedback using Vibrator API
- Long-press for quick actions
- Fingerprint authentication
```

---

## Error States & Edge Cases

### No Internet Connection
```
┌─────────────────────────────────────┐
│                                     │
│           📡                         │
│                                     │
│      No Internet Connection         │
│                                     │
│  You can continue working offline.  │
│  Your changes will sync when you're │
│  back online.                       │
│                                     │
│  Offline Features Available:        │
│  • View cached shifts               │
│  • Complete shift checks            │
│  • Report incidents                 │
│  • Check-in/out (with location)     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🔄 TRY AGAIN             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ✅ CONTINUE OFFLINE      │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### GPS Location Error
```
┌─────────────────────────────────────┐
│                                     │
│           📍                         │
│                                     │
│      Location Not Available         │
│                                     │
│  We couldn't determine your         │
│  location. Please:                  │
│                                     │
│  1. Enable Location Services        │
│  2. Grant app location permission   │
│  3. Ensure you're outdoors          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ⚙️ OPEN SETTINGS         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🔄 TRY AGAIN             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ℹ️ CONTACT SUPPORT       │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Session Expired
```
┌─────────────────────────────────────┐
│                                     │
│           🔒                         │
│                                     │
│      Session Expired                │
│                                     │
│  For your security, you've been     │
│  logged out. Please log in again    │
│  to continue.                       │
│                                     │
│  Don't worry - your offline data    │
│  is safe and will sync when you     │
│  log back in.                       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    🔐 LOG IN AGAIN          │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Camera Permission Denied
```
┌─────────────────────────────────────┐
│                                     │
│           📸                         │
│                                     │
│    Camera Access Required           │
│                                     │
│  To check in with a photo, we need  │
│  permission to access your camera.  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ⚙️ GRANT PERMISSION      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    📂 USE EXISTING PHOTO    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ⏭️ SKIP PHOTO            │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## Conclusion

This comprehensive UI wireframes and user flows document provides:

✅ **Complete Screen Designs**: All major screens with ASCII wireframes
✅ **Detailed User Flows**: Step-by-step navigation paths for all features
✅ **Accessibility Standards**: WCAG 2.1 AA compliance throughout
✅ **Offline Mode Handling**: Clear indicators and queuing system
✅ **Platform Considerations**: iOS and Android specific implementations
✅ **Error State Management**: Graceful handling of all edge cases
✅ **Animation Specifications**: Consistent motion design language
✅ **Responsive Guidelines**: Support for various device sizes

**Next Steps**:
1. Create technical architecture document
2. Document API integration specifications
3. Create accessibility implementation guide with code examples
4. Document testing strategy

This document serves as the single source of truth for the mobile app's user interface and interaction design.
