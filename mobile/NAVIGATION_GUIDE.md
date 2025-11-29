# Navigation Guide - Shift Exchanges

## How to Access Available Shifts

### Location: Calendar Tab (Shifts Screen)

The shift exchange features are accessible from the **Calendar tab** at the bottom of the app.

### Visual Layout:

```
┌─────────────────────────────────────┐
│           My Shifts                 │  ← Screen Title
├─────────────────────────────────────┤
│ [All] [Upcoming] [Completed]        │  ← Filter Tabs
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 🔍  Available Shifts          │  │  ← NEW! Click to browse
│  │     Browse open shifts to     │  │     shifts released by
│  │     claim                  →  │  │     other staff
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ ⇄  My Exchanges               │  │  ← NEW! Click to view
│  │     View transfer history  →  │  │     your exchange
│  └──────────────────────────────┘  │     history
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Your regular shifts list...        │
│                                     │
└─────────────────────────────────────┘
```

## Navigation Flow

### 1. Browse Available Shifts
**Path:** Calendar Tab → "Available Shifts" button

**What you'll see:**
- List of all shifts released to the open pool
- Shift details: venue, date, time, role
- Who released it and why
- "Claim Shift" button on each card

**Actions you can take:**
- Browse open shifts
- Claim a shift (requires manager approval)
- Pull to refresh for latest shifts
- See shift count at the top

### 2. View My Exchanges
**Path:** Calendar Tab → "My Exchanges" button

**What you'll see:**
- Two tabs: "Direct Exchanges" and "Released Shifts"
- Status of all your shift transfers
- Incoming transfer requests
- Shifts you've released to the pool

**Actions you can take:**
- Accept/decline incoming transfer requests
- Cancel outgoing transfer requests
- View exchange history
- See detailed status of each exchange

### 3. Transfer/Release from Shift Details
**Path:** Calendar Tab → Click any upcoming shift → "Transfer" or "Release" button

**What you'll see:**
- Full-screen modal for transfer or release
- Staff member selection (for transfers)
- Reason input field
- Confirmation alerts

## Quick Access Summary

| Feature | How to Access |
|---------|--------------|
| **Browse Available Shifts** | Calendar Tab → "Available Shifts" button |
| **View Exchange History** | Calendar Tab → "My Exchanges" button |
| **Transfer Specific Shift** | Calendar Tab → Click shift → "Transfer" button |
| **Release Shift to Pool** | Calendar Tab → Click shift → "Release" button |
| **Claim Open Shift** | Calendar Tab → "Available Shifts" → "Claim" button on shift card |
| **View Sync Queue** | Not yet added (needs Profile screen integration) |

## Bottom Tab Navigation

```
┌─────────────────────────────────────┐
│                                     │
│         Screen Content              │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  [Home]  [Shifts]  [Team]  [Profile]│  ← Bottom Tabs
└─────────────────────────────────────┘
           ↑
           └─ Go here for shift exchanges!
```

## User Journey Examples

### Example 1: Finding a shift to pick up
1. Tap **Calendar** tab (bottom navigation)
2. Tap **"Available Shifts"** button
3. Browse list of open shifts
4. Tap **"Claim Shift"** on desired shift
5. Confirm claim in alert
6. Wait for manager approval notification

### Example 2: Transferring your shift
1. Tap **Calendar** tab
2. Tap on your **upcoming shift**
3. Scroll down to action buttons
4. Tap **"Transfer"** button
5. Select staff member from list
6. Enter reason for transfer
7. Tap **"Send Request"**
8. Wait for recipient to accept

### Example 3: Releasing shift to pool
1. Tap **Calendar** tab
2. Tap on your **upcoming shift**
3. Scroll down to action buttons
4. Tap **"Release"** button
5. Read info about the process
6. Enter reason for release
7. Tap **"Release Shift"**
8. Wait for someone to claim it

### Example 4: Checking exchange status
1. Tap **Calendar** tab
2. Tap **"My Exchanges"** button
3. View **"Direct Exchanges"** tab for transfers
4. View **"Released Shifts"** tab for pool releases
5. See status badges (pending, accepted, approved, etc.)
6. Tap **Accept**/**Cancel** as needed

## Icon Reference

| Icon | Meaning | Location |
|------|---------|----------|
| 🔍 `calendar-search` | Available Shifts | Shifts screen |
| ⇄ `swap-horizontal` | My Exchanges | Shifts screen |
| ↔️ `swap-horizontal-outline` | Transfer action | Shift details |
| ✋ `hand-left-outline` | Release action | Shift details |
| ✓ `checkmark-circle` | Accepted/Approved | Exchange cards |
| ⏳ `time-outline` | Pending status | Exchange cards |
| ❌ `close-circle` | Rejected/Cancelled | Exchange cards |

## Offline Behavior

When you're offline, the app will:
1. **Queue your actions** - Transfers, releases, and claims are saved
2. **Show sync banner** - "X changes pending sync" at top of screen
3. **Auto-sync** - When connection restored, actions sync automatically
4. **Notify on failure** - If sync fails, you'll see "X changes failed to sync"

You can manually manage the queue:
- View queue: Profile → Sync Queue (not yet added)
- Retry failed: Tap "Retry" in sync queue screen
- Clear completed: Tap "Clear Completed" button

## Next Features (Not Yet Implemented)

The following features are planned but not yet available:
- **Push Notifications** - Get notified of exchange requests
- **Shift Reminders** - 3h and 45min before shifts
- **Sync Queue Access** - Button in Profile screen
- **Exchange Filters** - Filter by status, date, venue
- **Search** - Search shifts by venue or role

---

**Last Updated:** October 26, 2025
**Version:** Mobile Phase 1 - Complete
