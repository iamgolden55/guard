# Mobile Auto-Checkout and Network Timeout Fixes - Implementation Plan

## Overview

Fix critical mobile app issues preventing proper shift management: network timeouts causing indefinite hangs and stale local data showing completed shifts as still active. This plan implements a 3-phase approach to fix immediate issues, improve visibility, and optionally add mobile-side auto-checkout capabilities.

## Current State Analysis

### Problems Identified:
1. **Network Timeout Issue**: API calls have no timeout configuration, causing indefinite hangs when network is poor
2. **Stale Data Syndrome**: James44's shift shows as 63+ hours active in mobile app, but backend shows it was completed and approved 2 days ago
3. **No Auto-Checkout in Mobile**: Unlike web version (which relies on backend cron), mobile has no auto-checkout monitoring or UI
4. **Limited Sync Visibility**: Users can't see when data is stale or pending sync

### Key Discoveries:
- **API Service** (`mobile/src/services/api.ts:47-57`): Uses plain fetch() with NO timeout parameter
- **Backend Auto-Checkout** (`backend/api/models.py:2103-2212`): Working perfectly - cron runs every 15 minutes
- **Sync Service** (`mobile/src/services/syncService.ts`): Has retry logic but NO timeout at API layer
- **Database Query Result**: `Active shifts: 0` - James44's shift completed 2 days ago in backend
- **Mobile UI**: NetworkStatusBanner exists, but no sync status on individual items
- **Background Tasks**: NO expo-task-manager or expo-background-fetch installed

### Current Architecture:
- **Offline-First**: Sophisticated sync queue with exponential backoff (1s, 2s, 5s, 10s, 30s)
- **Network Detection**: NetInfo listener triggers sync when connection restores
- **Error Handling**: Try-catch blocks with Alert.alert dialogs
- **Local Storage**: AsyncStorage for shifts, incidents, and sync queue

## Desired End State

After implementation:
1. **Network calls timeout after 30 seconds** with clear error messages
2. **Users can see sync status** (pending/syncing/synced) on shifts and in settings
3. **Stale data can be cleared manually** via settings option
4. **Auto-checkout monitoring** (optional Phase 3) runs in background

### Verification:
- [ ] Network timeout test: Slow network causes timeout error within 30s (not indefinite hang)
- [ ] Sync status visible on dashboard and shift cards
- [ ] Clear Data button in settings works correctly
- [ ] James44's 63+ hour shift resolved after clearing local storage
- [ ] New shifts automatically fetch fresh data on app open

## What We're NOT Doing

- ❌ Changing backend auto-checkout logic (it works perfectly)
- ❌ Rewriting sync service from scratch (just adding timeout)
- ❌ Implementing real-time websocket sync
- ❌ Adding background location tracking
- ❌ Building custom error tracking service (just improving messages)
- ❌ Redesigning the entire offline architecture

## Implementation Approach

**Strategy**: Incremental fixes with backward compatibility
- **Phase 1**: Fix the immediate crisis (network timeout + clear stale data)
- **Phase 2**: Prevent future occurrences (sync status visibility)
- **Phase 3**: Optional enhancement (mobile auto-checkout monitoring)

Each phase is independently deployable and testable.

---

## Phase 1: Critical Network Timeout Fixes

### Overview
Add timeout configuration to API service, improve error handling, and provide manual data clearing. **This phase fixes the immediate 63+ hour shift issue.**

### Changes Required:

#### 1. API Service - Add Timeout Support
**File**: `mobile/src/services/api.ts`

**Changes**: Add AbortController and timeout to all HTTP methods

```typescript
// Add at class level (line 18)
private defaultTimeout = 30000; // 30 seconds

// Update get() method (lines 47-57)
async get<T = any>(endpoint: string, timeout: number = this.defaultTimeout): Promise<T> {
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
      throw new ApiError(response.status, response.statusText, endpoint);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
    }

    if (!navigator.onLine) {
      throw new NetworkError('No internet connection');
    }

    throw error;
  }
}

// Apply same pattern to: post(), put(), patch(), delete()
```

**Apply timeout to**: Lines 62-75 (post), 80-93 (put), 98-111 (patch), 116-128 (delete)

#### 2. Create Custom Error Classes
**File**: `mobile/src/services/api.ts` (add at top, after imports)

**Changes**: Define error types for better error handling

```typescript
// Add after imports (line 7)
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public endpoint: string
  ) {
    super(`HTTP ${statusCode}: ${statusText}`);
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

#### 3. Update Error Messages Constants
**File**: `mobile/src/utils/constants.ts`

**Changes**: Ensure timeout messages are defined (already exists at line 277)

```typescript
// Verify these exist (lines 276-280):
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to server. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.', // ← Confirm this exists
  SERVER_ERROR: 'Server error. Please try again later.',
  // ... rest
};
```

#### 4. Add Clear Data Feature to Settings
**File**: `mobile/src/screens/profile/ProfileScreen.tsx`

**Changes**: Add "Clear Local Data" button in debug/settings section

```typescript
// Add after other ProfileInfoSections (around line 200)
<ProfileInfoSection
  title="Data Management"
  icon="folder-outline"
  iconColor={colors.gray[500]}
>
  <View style={styles.dataManagementSection}>
    <Body color={colors.text.secondary} style={styles.warningText}>
      Clear local data if you're experiencing sync issues. This will force a fresh sync from the server.
    </Body>

    <Button
      title="Clear Local Data"
      variant="outline"
      size="medium"
      onPress={handleClearLocalData}
      icon={<Ionicons name="trash-outline" size={20} color={colors.error} />}
      style={[styles.clearDataButton, { borderColor: colors.error }]}
      textStyle={{ color: colors.error }}
    />
  </View>
</ProfileInfoSection>

// Add handler function (around line 50)
const handleClearLocalData = () => {
  Alert.alert(
    'Clear Local Data',
    'This will remove all offline data and force a fresh sync. Your work is safe on the server. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Data',
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear AsyncStorage
            await database.clearAll();

            // Force fresh fetch
            await dispatch(fetchShifts());
            await dispatch(fetchUserProfile());

            Alert.alert('Success', 'Local data cleared. Fresh data loaded from server.');
          } catch (error) {
            logger.error('[Profile] Clear data error:', error);
            Alert.alert('Error', 'Failed to clear data. Please try again.');
          }
        },
      },
    ]
  );
};

// Add styles (around line 300)
const styles = StyleSheet.create({
  // ... existing styles
  dataManagementSection: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  warningText: {
    fontSize: 13,
  },
  clearDataButton: {
    marginTop: spacing.xs,
  },
});
```

#### 5. Import Error Classes in Consumers
**Files to Update**:
- `mobile/src/screens/auth/LoginScreen.tsx`
- `mobile/src/screens/shifts/CheckInFlowScreen.tsx`
- `mobile/src/screens/shifts/ShiftDetailsScreen.tsx`

**Changes**: Update catch blocks to handle specific error types

```typescript
// Example for LoginScreen.tsx (lines 53-87)
import { ApiError, ApiTimeoutError, NetworkError } from '@/services/api';

try {
  await dispatch(loginUser({ email, password }));
} catch (error: any) {
  logger.error('Login failed', error);

  if (error instanceof ApiTimeoutError) {
    Alert.alert('Timeout', ERROR_MESSAGES.TIMEOUT_ERROR);
  } else if (error instanceof NetworkError) {
    Alert.alert('Network Error', ERROR_MESSAGES.NETWORK_ERROR);
  } else if (error instanceof ApiError) {
    Alert.alert('Login Failed', error.statusCode === 401
      ? ERROR_MESSAGES.AUTH_FAILED
      : error.statusText
    );
  } else {
    Alert.alert('Error', 'An unexpected error occurred');
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] App builds successfully: `npx expo prebuild` (if needed)
- [ ] No console errors on app startup

#### Manual Verification:
- [ ] Slow network test: Enable slow 3G in dev tools → API calls timeout after 30s with clear message
- [ ] Timeout error shows "Request timed out" alert (not indefinite spinner)
- [ ] Clear Data button appears in Profile screen
- [ ] Clear Data works: Clears local storage and fetches fresh data
- [ ] James44's 63+ hour shift disappears after clearing data
- [ ] Login with bad credentials shows appropriate error (not generic timeout)
- [ ] Offline mode shows "Network Error" (not timeout)

---

## Phase 2: Sync Status Visibility

### Overview
Add UI indicators showing sync status for shifts and overall app sync state. **This prevents future confusion about stale data.**

### Changes Required:

#### 1. Add Sync Status to Shift Interface
**File**: `mobile/src/store/slices/shiftsSlice.ts`

**Changes**: Ensure shift interface includes sync metadata

```typescript
// Update Shift interface (around line 15)
export interface Shift {
  // ... existing fields
  sync_status: 'synced' | 'pending' | 'syncing' | 'failed';
  last_sync_time?: string; // ISO timestamp
  local_only?: boolean; // True if only exists locally
}
```

#### 2. Create Sync Status Badge Component
**File**: `mobile/src/components/common/SyncStatusBadge.tsx` (NEW FILE)

**Changes**: Create reusable sync status indicator

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodySmall } from '@/components/ui';
import { colors, spacing } from '@/theme';

interface SyncStatusBadgeProps {
  status: 'synced' | 'pending' | 'syncing' | 'failed';
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  compact = false
}) => {
  const config = {
    synced: {
      icon: 'checkmark-circle' as const,
      color: colors.success,
      text: 'Synced',
    },
    pending: {
      icon: 'cloud-upload-outline' as const,
      color: colors.warning,
      text: 'Pending',
    },
    syncing: {
      icon: 'sync-outline' as const,
      color: colors.info,
      text: 'Syncing',
    },
    failed: {
      icon: 'alert-circle-outline' as const,
      color: colors.error,
      text: 'Failed',
    },
  };

  const { icon, color, text } = config[status];

  if (compact) {
    return (
      <Ionicons name={icon} size={16} color={color} />
    );
  }

  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={14} color={color} />
      <BodySmall color={color} style={styles.text}>
        {text}
      </BodySmall>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  text: {
    fontSize: 12,
  },
});
```

#### 3. Add Sync Status to ActiveShiftCard
**File**: `mobile/src/screens/dashboard/components/ActiveShiftCard.tsx`

**Changes**: Show sync status badge in shift card header

```typescript
// Add import (line 8)
import { SyncStatusBadge } from '@/components/common/SyncStatusBadge';

// Add sync status indicator (around line 110, after venue name)
<View style={styles.headerRight}>
  <SyncStatusBadge
    status={shift.sync_status || 'synced'}
    compact={false}
  />
</View>

// Update styles (around line 280)
const styles = StyleSheet.create({
  // ... existing styles
  headerRight: {
    alignItems: 'flex-end',
  },
});
```

#### 4. Add Sync Info Section to Profile
**File**: `mobile/src/screens/profile/ProfileScreen.tsx`

**Changes**: Add data sync status section

```typescript
// Add hook for sync status (around line 25)
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
const { isOnline, isSyncing, queueCount } = useNetworkStatus();

// Add after SIA License section (around line 180)
<ProfileInfoSection
  title="Data Sync"
  icon="sync-outline"
  iconColor={isOnline ? colors.success : colors.gray[400]}
>
  <ProfileInfoRow
    label="Status"
    value={
      <SyncStatusBadge
        status={isSyncing ? 'syncing' : queueCount > 0 ? 'pending' : 'synced'}
      />
    }
  />
  <ProfileInfoRow
    label="Network"
    value={
      <View style={styles.networkStatus}>
        <Ionicons
          name={isOnline ? 'wifi' : 'wifi-off'}
          size={16}
          color={isOnline ? colors.success : colors.gray[400]}
        />
        <BodySmall color={isOnline ? colors.success : colors.gray[400]}>
          {isOnline ? 'Connected' : 'Offline'}
        </BodySmall>
      </View>
    }
  />
  <ProfileInfoRow
    label="Pending Items"
    value={queueCount.toString()}
  />

  {queueCount > 0 && (
    <Button
      title="Retry Sync Now"
      variant="outline"
      size="small"
      onPress={handleRetrySync}
      icon={<Ionicons name="refresh-outline" size={18} />}
      style={{ marginTop: spacing.sm }}
    />
  )}
</ProfileInfoSection>

// Add retry handler (around line 60)
const handleRetrySync = async () => {
  try {
    await syncService.startSync();
    Alert.alert('Sync Started', 'Pending items are being synced to the server.');
  } catch (error) {
    logger.error('[Profile] Retry sync error:', error);
    Alert.alert('Error', 'Failed to start sync. Please check your connection.');
  }
};
```

#### 5. Update Shift List to Show Sync Status
**File**: `mobile/src/screens/shifts/ShiftsListScreen.tsx`

**Changes**: Add sync status indicator to shift list items

```typescript
// Add import
import { SyncStatusBadge } from '@/components/common/SyncStatusBadge';

// Add to shift card (in renderShiftCard around line 120)
{shift.sync_status && shift.sync_status !== 'synced' && (
  <View style={styles.syncStatusContainer}>
    <SyncStatusBadge status={shift.sync_status} compact={false} />
  </View>
)}

// Add styles
const styles = StyleSheet.create({
  // ... existing styles
  syncStatusContainer: {
    marginTop: spacing.xs,
  },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run type-check`
- [ ] No import errors for SyncStatusBadge component
- [ ] All sync status values are typed correctly

#### Manual Verification:
- [ ] Sync status badge appears on active shift card
- [ ] Profile screen shows "Data Sync" section with network status
- [ ] "Pending Items" count matches actual queue size
- [ ] Badge colors match status: Green (synced), Orange (pending), Blue (syncing), Red (failed)
- [ ] Going offline shows "Offline" in network status
- [ ] Coming back online triggers sync and status updates
- [ ] "Retry Sync Now" button appears when queue > 0
- [ ] Retry button triggers sync successfully

---

## Phase 3: Mobile Auto-Checkout Monitoring (Optional)

### Overview
Implement mobile-side auto-checkout monitoring that mirrors backend logic. **This is optional and should only be implemented if backend-only auto-checkout proves insufficient.**

**Note**: This phase is significantly more complex and requires testing background task behavior on both iOS and Android. Consider implementing only if users frequently report missed auto-checkouts.

### Changes Required:

#### 1. Install Required Packages
**File**: `mobile/package.json`

**Changes**: Add background task dependencies

```bash
# Run these commands:
npx expo install expo-task-manager
npx expo install expo-background-fetch
```

This adds to package.json:
```json
{
  "dependencies": {
    "expo-task-manager": "~12.0.0",
    "expo-background-fetch": "~13.0.0"
  }
}
```

#### 2. Configure Background Modes
**File**: `mobile/app.json`

**Changes**: Enable background fetch capability

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": [
          "fetch",
          "remote-notification"
        ]
      }
    },
    "android": {
      "permissions": [
        "RECEIVE_BOOT_COMPLETED",
        "WAKE_LOCK"
      ]
    }
  }
}
```

#### 3. Create Auto-Checkout Service
**File**: `mobile/src/services/autoCheckoutService.ts` (NEW FILE)

**Changes**: Implement shift monitoring logic

```typescript
import { database } from './database';
import { logger } from '@/utils/logger';
import { Shift } from '@/store/slices/shiftsSlice';

class AutoCheckoutService {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly GRACE_PERIOD_MINUTES = 30; // Match backend
  private readonly FORCE_TIMEOUT_HOURS = 12; // Match backend

  /**
   * Start foreground monitoring (runs every 5 minutes)
   */
  startMonitoring() {
    if (this.checkInterval) {
      logger.info('[AutoCheckout] Monitoring already active');
      return;
    }

    logger.info('[AutoCheckout] Starting shift monitoring');

    // Check immediately
    this.checkShiftsForAutoCheckout();

    // Then check every 5 minutes
    this.checkInterval = setInterval(
      () => this.checkShiftsForAutoCheckout(),
      5 * 60 * 1000 // 5 minutes
    );
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('[AutoCheckout] Monitoring stopped');
    }
  }

  /**
   * Check all active shifts for auto-checkout eligibility
   */
  async checkShiftsForAutoCheckout() {
    try {
      const shifts = await database.getShifts();
      const activeShift = shifts.find(
        s => s.status === 'in_progress' &&
             s.check_in_time &&
             !s.check_out_time
      );

      if (!activeShift) {
        return; // No active shift
      }

      const shouldAutoCheckout = this.shouldAutoCheckout(activeShift);

      if (shouldAutoCheckout) {
        logger.info('[AutoCheckout] Shift eligible for auto-checkout', {
          shiftId: activeShift.id
        });
        await this.performAutoCheckout(activeShift);
      }
    } catch (error) {
      logger.error('[AutoCheckout] Check error:', error);
    }
  }

  /**
   * Determine if shift should be auto-checked-out
   */
  private shouldAutoCheckout(shift: Shift): boolean {
    if (!shift.end_time) {
      return false; // No scheduled end time
    }

    const now = new Date();
    const scheduledEnd = new Date(shift.end_time);
    const graceCutoff = new Date(
      scheduledEnd.getTime() + this.GRACE_PERIOD_MINUTES * 60 * 1000
    );

    // Check if past grace period
    return now > graceCutoff;
  }

  /**
   * Check if shift exceeded force timeout (12 hours)
   */
  private isForceTimeout(shift: Shift): boolean {
    if (!shift.end_time) return false;

    const now = new Date();
    const scheduledEnd = new Date(shift.end_time);
    const forceTimeoutCutoff = new Date(
      scheduledEnd.getTime() + this.FORCE_TIMEOUT_HOURS * 60 * 60 * 1000
    );

    return now > forceTimeoutCutoff;
  }

  /**
   * Queue auto-checkout action for sync
   */
  private async performAutoCheckout(shift: Shift) {
    try {
      const isForce = this.isForceTimeout(shift);
      const checkoutTime = shift.end_time; // Use scheduled end, not current time

      logger.info('[AutoCheckout] Queueing auto-checkout', {
        shiftId: shift.id,
        isForceTimeout: isForce
      });

      // Add to sync queue
      await database.addToSyncQueue({
        type: 'check_out',
        entityType: 'shift',
        entityId: shift.id.toString(),
        payload: {
          check_out_time: checkoutTime,
          signature: isForce
            ? 'MOBILE_AUTO_CHECKOUT_FORCE_TIMEOUT'
            : 'MOBILE_AUTO_CHECKOUT',
          latitude: 0, // Backend will use venue coordinates
          longitude: 0,
        },
        priority: 1, // High priority
      });

      // Update local shift status
      await database.updateShift(shift.id, {
        check_out_time: checkoutTime,
        status: 'pending_approval',
        sync_status: 'pending',
      });

      logger.info('[AutoCheckout] Auto-checkout queued successfully');
    } catch (error) {
      logger.error('[AutoCheckout] Perform auto-checkout error:', error);
      throw error;
    }
  }
}

export const autoCheckoutService = new AutoCheckoutService();
```

#### 4. Register Background Task
**File**: `mobile/App.tsx`

**Changes**: Register and configure background fetch

```typescript
// Add imports at top
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { autoCheckoutService } from '@/services/autoCheckoutService';

// Define background task (add before App component)
const SHIFT_MONITOR_TASK = 'SHIFT_MONITOR';

TaskManager.defineTask(SHIFT_MONITOR_TASK, async () => {
  try {
    logger.info('[Background] Running shift monitor task');
    await autoCheckoutService.checkShiftsForAutoCheckout();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    logger.error('[Background] Shift monitor error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Add registration function
async function registerBackgroundTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SHIFT_MONITOR_TASK);

    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(SHIFT_MONITOR_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      logger.info('[Background] Task registered successfully');
    }
  } catch (error) {
    logger.error('[Background] Task registration failed:', error);
  }
}

// Add to App component useEffect (around line 40)
useEffect(() => {
  // Start foreground monitoring when authenticated
  if (isAuthenticated) {
    autoCheckoutService.startMonitoring();

    // Register background task
    registerBackgroundTask();
  }

  return () => {
    autoCheckoutService.stopMonitoring();
  };
}, [isAuthenticated]);
```

#### 5. Add Force Timeout Warning UI
**File**: `mobile/src/screens/dashboard/components/ActiveShiftCard.tsx`

**Changes**: Show warning for excessive overtime

```typescript
// Add overtime warning (around line 120, after elapsed time display)
{(() => {
  const scheduledEnd = new Date(shift.end_time);
  const overtimeMs = Date.now() - scheduledEnd.getTime();
  const overtimeHours = overtimeMs / (1000 * 60 * 60);

  if (overtimeHours > 11) {
    return (
      <View style={styles.forceTimeoutWarning}>
        <Ionicons name="warning" size={20} color={colors.error} />
        <View style={styles.warningTextContainer}>
          <BodySmall color={colors.error} style={styles.warningTitle}>
            Force Timeout Imminent
          </BodySmall>
          <Caption color={colors.error}>
            This shift has been open for {Math.floor(overtimeHours)} hours.
            Auto-checkout will occur within 1 hour. Please check out manually now.
          </Caption>
        </View>
      </View>
    );
  }
  return null;
})()}

// Add styles
const styles = StyleSheet.create({
  // ... existing styles
  forceTimeoutWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.error + '10', // 10% opacity
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  warningTextContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  warningTitle: {
    fontWeight: '600',
  },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] App builds successfully with new dependencies: `npx expo prebuild`
- [ ] TypeScript compilation passes: `npm run type-check`
- [ ] Background task registration succeeds (check logs)
- [ ] No crashes when backgrounding/foregrounding app

#### Manual Verification:
- [ ] Auto-checkout service starts when user logs in
- [ ] Foreground monitoring runs every 5 minutes (check logs)
- [ ] Create test shift with end time 35 minutes ago → Should auto-checkout
- [ ] Background task triggers on iOS (check after 15+ minutes in background)
- [ ] Background task triggers on Android (check after backgrounding)
- [ ] Force timeout warning appears for 11+ hour shifts
- [ ] Auto-checkout queues to sync service (check AsyncStorage @sync_queue)
- [ ] Auto-checked-out shifts sync to backend when online

---

## Testing Strategy

### Phase 1 Testing:

#### Network Timeout Tests:
1. **Simulate Slow Network**:
   - Enable Chrome DevTools slow 3G network throttling
   - Make API call (login, fetch shifts, etc.)
   - Verify timeout occurs at 30 seconds with "Request timed out" alert
   - Verify no indefinite spinner

2. **Offline Test**:
   - Turn off device WiFi/cellular
   - Attempt API call
   - Verify "Network Error" alert (not timeout)

3. **Normal Network Test**:
   - Enable normal network
   - Verify all API calls complete successfully
   - Verify no timeout errors on fast responses

#### Clear Data Tests:
1. **Clear and Refresh**:
   - Have stale shifts in local storage
   - Go to Profile → Clear Local Data
   - Confirm action
   - Verify AsyncStorage cleared (@shifts, @sync_queue, @incidents)
   - Verify fresh data loaded from backend
   - Verify James44's 63+ hour shift disappears

2. **Error Handling**:
   - Clear data while offline
   - Verify appropriate error message
   - Verify app doesn't crash

### Phase 2 Testing:

#### Sync Status Tests:
1. **Synced State**:
   - Fresh app load with good network
   - Verify all shifts show "Synced" badge
   - Verify Profile shows "Synced" status

2. **Pending State**:
   - Create shift check while offline
   - Verify shift shows "Pending" badge
   - Verify Profile shows pending count > 0
   - Verify "Retry Sync Now" button appears

3. **Syncing State**:
   - Queue action and go online
   - Verify badge shows "Syncing" with blue color
   - Verify returns to "Synced" when complete

4. **Failed State**:
   - Force sync failure (server error 500)
   - Verify badge shows "Failed" with red color

#### UI Visual Tests:
1. **Badge Appearance**:
   - Verify colors match design: Green (synced), Orange (pending), Blue (syncing), Red (failed)
   - Verify icons are appropriate size and alignment
   - Verify text is readable in both light/dark modes (if applicable)

2. **Profile Section**:
   - Verify Data Sync section displays correctly
   - Verify network status icon changes online/offline
   - Verify pending count updates in real-time

### Phase 3 Testing:

#### Auto-Checkout Monitoring Tests:
1. **Grace Period Test**:
   - Create shift with end_time = 35 minutes ago
   - Wait 5 minutes (next monitoring cycle)
   - Verify shift auto-checks out
   - Verify check_out_time = scheduled end_time (not current time)

2. **Force Timeout Test**:
   - Create shift with end_time = 12 hours ago
   - Verify force timeout warning appears in UI
   - Wait for monitoring cycle
   - Verify shift auto-checks out with FORCE_TIMEOUT signature

3. **Background Task Test (iOS)**:
   - Start shift, background app
   - Wait 20+ minutes (allow background fetch to trigger)
   - Foreground app
   - Verify auto-checkout occurred (check logs)

4. **Background Task Test (Android)**:
   - Similar to iOS test
   - Android may be more aggressive with background tasks

#### Edge Cases:
1. **No End Time**: Shift without end_time → Should NOT auto-checkout
2. **Multiple Shifts**: Only one active shift should auto-checkout
3. **Already Checked Out**: Should not process shifts with check_out_time
4. **Offline During Auto-Checkout**: Should queue for sync, process when online

---

## Performance Considerations

### API Timeout Impact:
- **Memory**: AbortController adds ~100 bytes per request (negligible)
- **CPU**: setTimeout adds minimal overhead (<1ms)
- **Network**: No change to actual network behavior, just adds safety net

### Sync Status UI Impact:
- **Re-renders**: SyncStatusBadge is lightweight, memoization not needed for typical use
- **Storage**: Adds 2 fields to each shift (~50 bytes per shift)
- **Network**: No additional API calls, uses existing sync service

### Auto-Checkout Service Impact:
- **Battery**: Foreground monitoring every 5 minutes is negligible
- **Background**: iOS background fetch is power-optimized by OS
- **Memory**: Service instance ~1KB, timer references ~100 bytes
- **Network**: Only triggers sync when auto-checkout conditions met

### Optimization Strategies:
1. **Batch Sync**: Sync queue already batches actions
2. **Debounce**: Network listener already debounces with retry delays
3. **Lazy Loading**: Shift list already uses FlatList for virtualization
4. **Selective Updates**: Only update shifts that change sync status

---

## Migration Notes

### Data Migration:
- **No database schema changes required**
- Existing shifts will show `sync_status: undefined` → Default to 'synced' in UI
- Next sync cycle will populate `sync_status` field
- No data loss risk

### Backward Compatibility:
- Phase 1 changes are backward compatible (API calls still work, just add timeout)
- Phase 2 changes are additive (new UI components, existing code unchanged)
- Phase 3 is entirely new functionality (no existing behavior modified)

### Rollback Strategy:
- **Phase 1**: Revert api.ts changes, no data cleanup needed
- **Phase 2**: Hide sync status UI, data remains but unused
- **Phase 3**: Unregister background task, stop monitoring service

### User Communication:
- **No announcement needed** for Phase 1 (invisible fix)
- **Optional announcement** for Phase 2 ("New: See sync status in settings")
- **Announcement recommended** for Phase 3 ("New: Automatic shift checkout after scheduled end")

---

## References

- Original research: `/Users/new/Projects/mead-security/remix2/thoughts/shared/research/2025-10-16-mobile-auto-checkout-network-issues.md`
- Backend auto-checkout: `backend/api/models.py:2103-2212`
- Backend cron: `backend/scripts/auto_checkout_processor.sh`
- Mobile API service: `mobile/src/services/api.ts:47-57`
- Mobile sync service: `mobile/src/services/syncService.ts:50-255`
- UI patterns: `mobile/src/components/common/NetworkStatusBanner.tsx`
- Background fetch docs: https://docs.expo.dev/versions/latest/sdk/background-fetch/
- Task Manager docs: https://docs.expo.dev/versions/latest/sdk/task-manager/
