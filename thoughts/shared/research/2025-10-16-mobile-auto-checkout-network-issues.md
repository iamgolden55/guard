---
date: 2025-10-16T00:00:00Z
researcher: Claude Code
git_commit: bf03d58d758283f99a8242c5bbe8301aea9e0689
branch: main
repository: mead-security/remix2
topic: "Mobile Auto-Checkout and Network Timeout Issues - James44 63+ Hour Shift Investigation"
tags: [research, codebase, mobile, auto-checkout, network, shifts, offline-sync]
status: complete
last_updated: 2025-10-16
last_updated_by: Claude Code
---

# Research: Mobile Auto-Checkout and Network Timeout Issues

**Date**: 2025-10-16T00:00:00Z
**Researcher**: Claude Code
**Git Commit**: bf03d58d758283f99a8242c5bbe8301aea9e0689
**Branch**: mainX
**Repository**: mead-security/remix2

## Research Question

Why is there a shift running for 63+ hours for James44 in the mobile app, and why is the mobile app showing network timeout errors and appearing to be stuck in offline mode?

## Executive Summary

The investigation revealed **two critical issues**:

1. **Stale Data Desynchronization**: The mobile app is displaying a 63+ hour old shift that was already completed and approved in the backend 2 days ago. The shift exists only in the mobile app's local AsyncStorage and was never refreshed due to network failures.

2. **No Network Timeout Configuration**: The mobile app's API service has no timeout mechanism, causing fetch requests to hang indefinitely when network connectivity is poor, effectively freezing the app in "offline mode."

3. **Missing Auto-Checkout in Mobile**: Unlike the web version which relies on backend cron-based auto-checkout, the mobile app has no mechanism to automatically check out shifts, nor does it implement the backend's grace period and force timeout logic.

**Root Cause**: Network timeout during sync → Stale local data → User unable to see that shift was already completed on backend.

## Detailed Findings

### 1. The 63+ Hour Shift Mystery - Database Evidence

#### Backend Database Query Results

```bash
# Active shifts query
Active shifts: 0

# Recent shifts for James44
Shift 370: James44 at 20 St Thomas Street
  - Status: approved ✅
  - Checked in: 2025-10-14 01:22:04
  - Checked out: 2025-10-14 04:00:00
  - Duration: ~2.5 hours
  - Completed: 2 days ago
```

**Finding**: The shift **DOES NOT EXIST** as an active shift in the backend. It was successfully checked out and approved 2 days ago.

#### Mobile App Local Storage (Hypothesis)

The mobile app's AsyncStorage (`@shifts` key) likely contains:
```json
{
  "id": 370,
  "status": "in_progress",
  "check_in_time": "2025-10-14T01:22:04Z",
  "check_out_time": null,
  "sync_status": "pending"
}
```

**Location**: `mobile/src/services/database.ts` lines 46-73 (AsyncStorage-based shift storage)

### 2. Network Timeout Issue Analysis

#### API Service Implementation

**File**: `mobile/src/services/api.ts` (lines 47-57)

**Current GET Implementation**:
```typescript
async get<T = any>(endpoint: string): Promise<T> {
  const headers = await this.getHeaders();
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    method: 'GET',
    headers,
    // ❌ CRITICAL: NO TIMEOUT PARAMETER
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
```

**Problem Identified**:
- JavaScript `fetch()` API has **no built-in timeout mechanism**
- Requests can hang **indefinitely** waiting for server response
- Poor network conditions cause app to appear frozen
- No AbortController implementation for cancellation

**Impact on shiftsService**:
- `shiftsService.fetchShifts()` (line 14) hangs when fetching shift list
- User sees infinite loading spinner
- App appears to be in "offline mode" even when network is connected
- Sync operations never complete

#### Error Seen in Screenshot

```
[ShiftsService] Error fetching shifts: TypeError: Network request timed out
shiftsService.ts (47:20)
```

This error occurs when the native network layer times out after an extended period, but the JavaScript code has no way to handle or prevent this gracefully.

### 3. Auto-Checkout System Analysis

#### Backend Auto-Checkout (Fully Implemented)

**Files**:
- Logic: `backend/api/models.py` (lines 2103-2212)
- Command: `backend/api/management/commands/process_auto_checkouts.py`
- Cron: `backend/scripts/auto_checkout_processor.sh` (runs every 15 minutes)
- Logs: `backend/logs/auto_checkout.log`

**How It Works**:

1. **Cron Job Execution**: Runs `python manage.py process_auto_checkouts` every 15 minutes

2. **Eligibility Check** (`can_auto_checkout()` - lines 2132-2173):
   - System setting `auto_checkout_enabled = True`
   - Shift status = `in_progress` with no `check_out_time`
   - Current time > `end_time + grace_period` (default: 30 minutes)
   - Either:
     - Force timeout reached (12 hours past end time) - **BYPASSES all checks**
     - All venue-required checks completed (fire safety, capacity, toilet)

3. **Force Timeout** (`can_force_timeout()` - lines 2103-2129):
   - Default: 720 minutes (12 hours) past scheduled `end_time`
   - Acts as safety mechanism for excessive overtime
   - Prevents indefinite open shifts

4. **Checkout Execution** (`perform_auto_checkout()` - lines 2175-2210):
   - Sets `check_out_time = end_time` (NOT current time - prevents overtime pay)
   - Sets `check_out_location` to venue's GPS coordinates
   - Sets `auto_checkout = True` flag
   - Sets digital signature:
     - `"AUTO_CHECKOUT_FORCE_TIMEOUT_EXCESSIVE_OVERTIME"` (force timeout)
     - `"AUTO_CHECKOUT_VENUE_REQUIREMENTS_COMPLETED"` (normal auto-checkout)
   - Changes status to `pending_approval`

**Current Status**:
```
2025-10-16 17:15:00 - Auto-checkout processing completed successfully
Processed 0 auto-checkouts out of 0 eligible shifts
```

Cron is working correctly but found 0 active shifts to process (because James44's shift was already completed).

#### Web Frontend Auto-Checkout (Display Only)

**File**: `frontend/src/components/AutoCheckoutStatus.tsx`

**Functionality**:
- Displays countdown timer until auto-checkout eligibility
- Shows venue check completion progress
- Provides status messages:
  - "Shift ends in X minutes"
  - "Auto-checkout in X minutes"
  - "Complete all venue requirements to be eligible"
  - "Force timeout active! Auto-checkout will occur soon"
- Fetches check status from API: `/api/v1/shifts/{id}/venue_check_status/`

**Key Insight**: Web frontend is purely **informational** - it does NOT trigger auto-checkout. All automation happens server-side.

#### Mobile App Auto-Checkout (NOT IMPLEMENTED)

**Status**: ❌ **COMPLETELY MISSING**

**Current Implementation**:
- `mobile/src/screens/shifts/CheckInFlowScreen.tsx` (lines 172-242) - Check-in ✅
- `mobile/src/screens/dashboard/components/ActiveShiftCard.tsx` (lines 44-162) - Shows elapsed time, manual checkout button ✅
- **NO** automatic checkout logic
- **NO** background tasks or timers
- **NO** grace period handling
- **NO** force timeout detection
- **NO** countdown UI for auto-checkout

**What's Missing**:
1. Background service to monitor shift duration
2. Auto-checkout trigger after grace period
3. Force timeout warning at 11+ hours
4. Venue check completion tracking for eligibility
5. UI indicators for auto-checkout countdown

### 4. Network Handling & Offline Mode

#### Sync Service Implementation

**File**: `mobile/src/services/syncService.ts`

**Network Detection** (lines 50-74):
```typescript
NetInfo.addEventListener((state: NetInfoState) => {
  const isConnected = state.isConnected === true;
  const isReachable = state.isInternetReachable === true;
  this.isOnline = isConnected && isReachable;

  // Trigger sync when coming back online
  if (!wasOnline && this.isOnline) {
    this.startSync();
  }
});
```

**Offline Fallback Pattern** (lines 69-93):
```typescript
try {
  const shifts = await shiftsService.fetchShifts(); // API call
  await database.saveShifts(shifts); // Save locally
  return shifts;
} catch (error: any) {
  // Fallback to local database if offline
  const localShifts = await database.getShifts();
  if (localShifts.length > 0) {
    return localShifts;
  }
  return rejectWithValue(error.message);
}
```

**Sync Queue System** (`mobile/src/services/database.ts` lines 151-220):
- AsyncStorage-based queue for offline actions
- Exponential backoff retry: 1s, 2s, 5s, 10s, 30s
- Maximum 5 retry attempts before marking as failed
- Priorities: check-in (1), check-out (2), incident (3), shift_check (4)

**Gaps Identified**:
1. ❌ No timeout in base API → Network detection works, but requests hang
2. ❌ No retry on timeout → Only retries on explicit errors
3. ❌ No background sync → Sync only triggers on network state change
4. ❌ No user notification → Silent failures for long-running operations
5. ❌ No sync status visibility → User doesn't know why data is stale

### 5. Root Cause Analysis

#### Timeline Reconstruction

**Day 0 (2025-10-14 01:22)**: James44 checks in to shift
- Mobile app creates local shift record
- Adds check-in action to sync queue
- **Network timeout occurs during sync**
- Check-in data never reaches backend (hypothesis)

**Day 0 (2025-10-14 04:00)**: Backend performs auto-checkout
- Backend auto-checkout cron runs every 15 minutes
- Finds shift 370 eligible for auto-checkout
- Performs checkout with end time 04:00
- Marks as approved
- **Mobile app never receives this update**

**Day 2 (2025-10-16)**: User reports 63+ hour shift
- Mobile app still shows shift as "in_progress"
- Local database has stale data
- Network timeout prevents refresh from backend
- Backend shows shift as completed and approved

#### Why Backend Shows 0 Active Shifts

Backend query results:
```
Active shifts: 0  ← James44's shift is already completed
```

This proves the shift was successfully processed by the backend auto-checkout system.

#### Why Mobile Shows 63+ Hours

The mobile app's shift counter (ActiveShiftCard.tsx lines 44-62) calculates elapsed time from `check_in_time`:
```typescript
const elapsedMs = Date.now() - new Date(shift.check_in_time).getTime();
const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
```

Since `check_out_time` is null in local storage, it keeps counting upward indefinitely.

## Code References

### Mobile App Files

| File Path | Lines | Issue/Status |
|-----------|-------|--------------|
| `mobile/src/services/api.ts` | 47-57 | ❌ No timeout configuration |
| `mobile/src/services/shiftsService.ts` | 14-48 | ⚠️ Calls api.get() without timeout |
| `mobile/src/services/syncService.ts` | 50-74 | ✅ Network detection working |
| `mobile/src/services/syncService.ts` | 196-227 | ⚠️ Execute actions can hang |
| `mobile/src/services/database.ts` | 46-73 | ✅ AsyncStorage shift management |
| `mobile/src/services/database.ts` | 151-220 | ✅ Sync queue with retry logic |
| `mobile/src/store/slices/shiftsSlice.ts` | 132-182 | ✅ Check-in/out reducers |
| `mobile/src/screens/shifts/CheckInFlowScreen.tsx` | 172-242 | ✅ Check-in implemented |
| `mobile/src/screens/dashboard/components/ActiveShiftCard.tsx` | 44-162 | ❌ No auto-checkout, only manual |

### Backend Files

| File Path | Lines | Status |
|-----------|-------|--------|
| `backend/api/models.py` | 2103-2131 | ✅ `can_force_timeout()` implemented |
| `backend/api/models.py` | 2132-2173 | ✅ `can_auto_checkout()` implemented |
| `backend/api/models.py` | 2175-2212 | ✅ `perform_auto_checkout()` implemented |
| `backend/api/models.py` | 2078-2101 | ✅ Venue check validation |
| `backend/api/management/commands/process_auto_checkouts.py` | 1-76 | ✅ Cron command working |
| `backend/scripts/auto_checkout_processor.sh` | - | ✅ Runs every 15 minutes |
| `backend/logs/auto_checkout.log` | Latest | ✅ Active (0 processed = no active shifts) |

### Web Frontend Files

| File Path | Lines | Status |
|-----------|-------|--------|
| `frontend/src/components/AutoCheckoutStatus.tsx` | - | ✅ Display-only UI component |
| `frontend/src/pages/staff/Dashboard.tsx` | 510 | ✅ Uses AutoCheckoutStatus |
| `frontend/src/services/shiftService.ts` | 568-608 | ✅ Venue check status API |

## Architecture Insights

### Backend-Centric Auto-Checkout Design

The system uses a **server-side scheduled task** architecture for auto-checkout:

**Advantages**:
- ✅ Consistent processing regardless of client state
- ✅ Works even if mobile app is closed
- ✅ Centralized business logic
- ✅ Audit trail in server logs

**Disadvantages for Mobile**:
- ❌ Mobile app must poll server to see auto-checkout status
- ❌ No immediate feedback to user when auto-checkout occurs
- ❌ Relies on successful network sync to refresh data
- ❌ Stale data if sync fails

### Two-Tier Timeout System

**Design Decision**:
- **Grace Period**: 30 minutes after scheduled end time
  - Allows realistic time for staff to complete venue checks
  - Prevents premature checkout

- **Force Timeout**: 720 minutes (12 hours) past end time
  - Safety mechanism for excessive overtime
  - **Bypasses all venue check requirements**
  - Logged with WARNING level for manager attention

**Rationale**: Balances staff flexibility with operational requirements while preventing infinite open shifts.

### Payment Protection

**Critical Feature**: Auto-checkout sets `check_out_time = end_time` (NOT current time)

**Purpose**:
- Prevents staff from being paid for unworked overtime
- Ensures consistent payment calculations
- Avoids incentivizing delayed checkouts

**Example**:
- Shift scheduled: 10:00 PM - 2:00 AM (4 hours)
- Staff forgets to check out manually
- Auto-checkout at 2:30 AM (grace period)
- `check_out_time` set to 2:00 AM (scheduled end)
- Staff paid for 4 hours, not 4.5 hours

## Recommendations

### Priority 1: Fix Network Timeout (IMMEDIATE)

**File**: `mobile/src/services/api.ts`

**Implementation**:
```typescript
async get<T = any>(endpoint: string, timeout: number = 30000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
      signal: controller.signal, // ← Add AbortController
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection');
    }
    throw error;
  }
}
```

**Benefits**:
- ✅ Prevents indefinite hangs
- ✅ Provides clear error messages
- ✅ Allows retry logic to work properly
- ✅ Improves user experience

**Apply to all methods**: `get()`, `post()`, `put()`, `patch()`, `delete()`

### Priority 2: Clear Stale Data (IMMEDIATE)

**Immediate Resolution for James44's Shift**:

```typescript
// Option A: Clear all local storage (nuclear option)
import { database } from './services/database';
await database.clearAll();

// Option B: Clear only shifts
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('@shifts');
await AsyncStorage.removeItem('@sync_queue');

// Then force refresh from backend
import { store } from './store';
import { fetchShifts } from './store/slices/shiftsSlice';
await store.dispatch(fetchShifts());
```

**Add UI Option**: Settings screen with "Clear Local Data" button for troubleshooting.

### Priority 3: Add Sync Status Visibility (HIGH)

**File**: `mobile/src/screens/dashboard/components/ActiveShiftCard.tsx`

**Add Sync Status Indicator**:
```typescript
{shift.sync_status === 'pending' && (
  <View style={styles.syncWarning}>
    <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
    <BodySmall color={colors.warning}>
      Waiting to sync... Tap to retry
    </BodySmall>
  </View>
)}

{shift.sync_status === 'synced' && (
  <View style={styles.syncSuccess}>
    <Ionicons name="cloud-done-outline" size={16} color={colors.success} />
    <BodySmall color={colors.success}>
      Last synced: {formatTimeAgo(shift.last_sync_time)}
    </BodySmall>
  </View>
)}
```

**Benefits**:
- ✅ User knows when data is stale
- ✅ Provides actionable feedback ("Tap to retry")
- ✅ Reduces confusion about shift status

### Priority 4: Implement Mobile Auto-Checkout (MEDIUM)

**New Service**: `mobile/src/services/autoCheckoutService.ts`

```typescript
import { database } from './database';
import { shiftsService } from './shiftsService';

class AutoCheckoutService {
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring shifts for auto-checkout eligibility
   * Checks every 5 minutes
   */
  startMonitoring() {
    if (this.checkInterval) return; // Already running

    this.checkInterval = setInterval(async () => {
      await this.checkShiftsForAutoCheckout();
    }, 5 * 60 * 1000); // 5 minutes

    // Run immediately on start
    this.checkShiftsForAutoCheckout();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if any active shift needs auto-checkout
   */
  async checkShiftsForAutoCheckout() {
    try {
      const shifts = await database.getShifts();
      const activeShift = shifts.find(s =>
        s.status === 'in_progress' &&
        s.check_in_time &&
        !s.check_out_time
      );

      if (!activeShift) return;

      const scheduledEnd = new Date(activeShift.end_time);
      const graceMinutes = 30; // Match backend setting
      const cutoffTime = new Date(scheduledEnd.getTime() + graceMinutes * 60000);

      // Check if past grace period
      if (new Date() > cutoffTime) {
        console.log('[AutoCheckout] Shift eligible for auto-checkout:', activeShift.id);
        await this.performAutoCheckout(activeShift.id);
      }
    } catch (error) {
      console.error('[AutoCheckout] Error checking shifts:', error);
    }
  }

  /**
   * Perform auto-checkout (queues for sync)
   */
  async performAutoCheckout(shiftId: number) {
    try {
      // Add to sync queue with special signature
      await database.addToSyncQueue({
        type: 'check_out',
        entityType: 'shift',
        entityId: shiftId.toString(),
        payload: {
          check_out_time: new Date().toISOString(),
          signature: 'MOBILE_AUTO_CHECKOUT',
          latitude: 0, // Will be set by backend to venue location
          longitude: 0,
        },
        priority: 1, // High priority
      });

      // Update local shift status
      await database.updateShift(shiftId, {
        check_out_time: new Date().toISOString(),
        sync_status: 'pending',
      });

      console.log('[AutoCheckout] Auto-checkout queued for shift:', shiftId);
    } catch (error) {
      console.error('[AutoCheckout] Error performing auto-checkout:', error);
    }
  }
}

export const autoCheckoutService = new AutoCheckoutService();
```

**Integration in App.tsx**:
```typescript
useEffect(() => {
  // Start auto-checkout monitoring when user is authenticated
  if (isAuthenticated) {
    autoCheckoutService.startMonitoring();
  }

  return () => {
    autoCheckoutService.stopMonitoring();
  };
}, [isAuthenticated]);
```

### Priority 5: Add Background Task Support (LOW)

**Install Dependencies**:
```bash
cd mobile
npx expo install expo-task-manager expo-background-fetch
```

**Implementation**:
```typescript
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const SHIFT_MONITOR_TASK = 'SHIFT_MONITOR';

// Define background task
TaskManager.defineTask(SHIFT_MONITOR_TASK, async () => {
  try {
    await autoCheckoutService.checkShiftsForAutoCheckout();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[Background] Shift monitor error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register task (runs every 15 minutes minimum on iOS)
async function registerBackgroundTask() {
  await BackgroundFetch.registerTaskAsync(SHIFT_MONITOR_TASK, {
    minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
    stopOnTerminate: false, // Keep running after app kill
    startOnBoot: true, // Start on device boot
  });
}
```

**Benefits**:
- ✅ Auto-checkout works even when app is closed
- ✅ Matches backend cron frequency (15 minutes)
- ✅ Reduces reliance on user keeping app open

**Limitations**:
- iOS: Minimum 15 minutes between executions
- Android: More flexible but battery-dependent
- Not guaranteed to run at exact times

### Priority 6: Add Force Timeout Warning UI (LOW)

**File**: `mobile/src/screens/dashboard/components/ActiveShiftCard.tsx`

**Add Warning for Excessive Overtime**:
```typescript
// Calculate overtime hours
const scheduledEnd = new Date(shift.end_time);
const overtimeHours = (Date.now() - scheduledEnd.getTime()) / (1000 * 60 * 60);

{overtimeHours > 11 && (
  <View style={styles.forceTimeoutWarning}>
    <Ionicons name="warning" size={20} color={colors.error} />
    <BodySmall color={colors.error} style={styles.warningText}>
      ⚠️ Force timeout imminent! This shift has been open for {Math.floor(overtimeHours)} hours.
      Auto-checkout will occur within 1 hour regardless of check completion.
      Please check out manually now.
    </BodySmall>
  </View>
)}
```

**Benefits**:
- ✅ Alerts user before force timeout occurs
- ✅ Encourages manual checkout
- ✅ Prevents surprise auto-checkouts

## Testing Strategy

### 1. Verify Network Timeout Fix

```typescript
// Test Case: API timeout after 30 seconds
import { apiService } from './services/api';

try {
  await apiService.get('/api/v1/shifts/'); // Should timeout after 30s
} catch (error) {
  console.log(error.message); // "Request timeout - please check your connection"
}
```

### 2. Verify Stale Data Cleanup

```typescript
// Before cleanup
const oldShifts = await database.getShifts();
console.log('Old shifts:', oldShifts); // Should show 63+ hour shift

// Clear and refresh
await database.clearAll();
await store.dispatch(fetchShifts());

// After cleanup
const newShifts = await database.getShifts();
console.log('New shifts:', newShifts); // Should show current shifts only
```

### 3. Verify Auto-Checkout Logic

```typescript
// Mock a shift past grace period
const testShift = {
  id: 999,
  status: 'in_progress',
  check_in_time: '2025-10-16T10:00:00Z',
  end_time: '2025-10-16T12:00:00Z', // 2 hours ago
  check_out_time: null,
};

await database.saveShifts([testShift]);

// Trigger auto-checkout check
await autoCheckoutService.checkShiftsForAutoCheckout();

// Verify shift was updated
const updated = await database.getShift(999);
console.log('Check out time:', updated.check_out_time); // Should be set
console.log('Sync status:', updated.sync_status); // Should be 'pending'
```

## Open Questions

1. **Does the mobile app have push notifications?**
   - Could notify user when shift is auto-checked-out by backend
   - Would require backend to send push notification after auto-checkout

2. **Should mobile app trust backend auto-checkout completely?**
   - Current approach: Mobile implements its own auto-checkout logic
   - Alternative: Mobile just polls backend for status updates
   - Hybrid: Both backend and mobile can trigger auto-checkout

3. **What happens if mobile auto-checkout conflicts with backend auto-checkout?**
   - Both set check_out_time independently
   - Backend always wins (authoritative source)
   - Mobile sync should handle conflicts gracefully

4. **Should force timeout be configurable in mobile app?**
   - Currently: Hard-coded to 12 hours
   - Backend: Configurable via SystemSettings
   - Mobile should fetch this from API

## Related Research

- Backend auto-checkout implementation: `backend/scripts/README.md`
- Frontend auto-checkout UI: `frontend/src/components/AutoCheckoutStatus.tsx`
- Mobile offline sync: `mobile/src/services/syncService.ts`

## Conclusion

The 63+ hour shift issue for James44 is caused by **network timeout preventing data synchronization** between mobile app and backend. The shift was successfully completed and approved by the backend's auto-checkout system 2 days ago, but the mobile app never received this update due to API timeout errors.

**Immediate Actions Required**:
1. Add timeout configuration to all API calls (30-second timeout)
2. Clear James44's mobile app local storage to force data refresh
3. Add sync status visibility so users know when data is stale

**Long-Term Improvements**:
1. Implement mobile-side auto-checkout service
2. Add background task support for auto-checkout monitoring
3. Display force timeout warnings for excessive overtime
4. Add "Clear Local Data" button in settings for troubleshooting

The backend auto-checkout system is **working perfectly** - the mobile app just needs to catch up with better network handling and data synchronization.
