# Mobile App Testing Strategy with Test Cases

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Test Pyramid](#test-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Performance Testing](#performance-testing)
7. [Accessibility Testing](#accessibility-testing)
8. [Test Environment Setup](#test-environment-setup)
9. [CI/CD Integration](#cicd-integration)
10. [Test Cases by Feature](#test-cases-by-feature)
11. [Coverage Goals](#coverage-goals)

---

## Testing Overview

### Testing Strategy Summary

```
┌─────────────────────────────────────────────────────────┐
│              MOBILE APP TESTING PYRAMID                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                      E2E (10%)                          │
│                  Detox / Appium Tests                   │
│                 (Full user journeys)                    │
│                    /         \                          │
│                   /           \                         │
│              INTEGRATION (30%)                          │
│          Integration Tests                             │
│      (API + Database + Storage)                         │
│          /                 \                            │
│         /                   \                           │
│         UNIT (60%)                                      │
│  Jest + React Testing Library                          │
│ (Individual components/functions)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Testing Tools

```json
{
  "test_runners": {
    "jest": "^29.7.0",
    "jest-setup": "@testing-library/jest-native"
  },
  "component_testing": {
    "react-testing-library": "^12.9.0",
    "native_testing_library": "@testing-library/react-native"
  },
  "e2e_testing": {
    "detox": "^20.28.3"
  },
  "mocking": {
    "msw": "^1.3.2",
    "jest_mock_extended": "^3.0.5",
    "redux_mock_store": "^1.5.4"
  },
  "coverage": {
    "coverage_reporters": ["text", "lcov", "html"]
  }
}
```

### Coverage Goals

- **Unit Tests**: 80% coverage (critical paths 95%)
- **Integration Tests**: 60% coverage
- **E2E Tests**: 40% critical user journeys
- **Overall Target**: 75% code coverage

---

## Test Pyramid

### Unit Tests (60%)

**What**: Test individual functions, components, hooks in isolation
**Tools**: Jest, React Testing Library
**Speed**: Very fast (100ms - 1s per test)
**Cost**: Low
**Maintainability**: High

```typescript
// Example: Testing a utility function
describe('formatShiftDuration', () => {
  it('should format hours and minutes correctly', () => {
    const duration = formatShiftDuration(3.5);
    expect(duration).toBe('3h 30m');
  });

  it('should handle zero duration', () => {
    const duration = formatShiftDuration(0);
    expect(duration).toBe('0m');
  });
});

// Example: Testing a component
describe('ShiftCard Component', () => {
  it('should render shift details', () => {
    const shift = {
      id: 1,
      start_time: '2026-02-13T09:00:00Z',
      venue: { name: 'The Grand Hotel' },
      status: 'scheduled',
    };

    const { getByText } = render(<ShiftCard shift={shift} />);
    expect(getByText('The Grand Hotel')).toBeInTheDocument();
  });

  it('should call onPress when tapped', () => {
    const mockPress = jest.fn();
    const { getByRole } = render(<ShiftCard shift={shift} onPress={mockPress} />);
    
    fireEvent.press(getByRole('button'));
    expect(mockPress).toHaveBeenCalled();
  });
});
```

### Integration Tests (30%)

**What**: Test multiple components/services working together
**Tools**: Jest + Mock API (MSW)
**Speed**: Moderate (1s - 5s per test)
**Cost**: Medium
**Maintainability**: Medium

```typescript
// Example: Testing check-in flow with API
describe('Check-In Integration', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should complete check-in flow with location and photo', async () => {
    const { getByText, getByA11yLabel } = render(
      <CheckInFlow shiftId={1} />
    );

    // Step 1: Verify location
    await waitFor(() => {
      expect(getByText('Location verified')).toBeInTheDocument();
    });

    // Step 2: Capture photo
    fireEvent.press(getByA11yLabel('Take photo'));
    fireEvent.press(getByText('Confirm'));

    // Step 3: API call
    await waitFor(() => {
      expect(getByText('Check-in successful')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      rest.post('/api/v1/shifts/:id/check-in/', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({ detail: 'Invalid location' })
        );
      })
    );

    const { getByText } = render(<CheckInFlow shiftId={1} />);

    await waitFor(() => {
      expect(getByText('Invalid location')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (10%)

**What**: Test complete user journeys from login to task completion
**Tools**: Detox / Appium
**Speed**: Slow (5s - 60s per test)
**Cost**: High
**Maintainability**: Low (brittle)

```typescript
// Example: E2E test for check-in flow
describe('Check-In E2E Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should login and check in to shift', async () => {
    // Login
    await element(by.id('email-input')).typeText('staff@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // Wait for dashboard
    await waitFor(element(by.id('dashboard-header')))
      .toBeVisible()
      .withTimeout(5000);

    // Start check-in
    await element(by.id('current-shift-card')).tap();
    await element(by.id('check-in-button')).tap();

    // Verify location
    await waitFor(element(by.id('location-status')))
      .toHaveText('Location verified')
      .withTimeout(10000);

    await element(by.id('location-continue')).tap();

    // Take photo
    await element(by.id('camera-capture')).multiTap(2);
    await element(by.id('photo-confirm')).tap();

    // Verify success
    await waitFor(element(by.id('check-in-success')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

## Unit Testing

### Testing Components

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import userEvent from '@testing-library/user-event';

describe('GlassButton Component', () => {
  it('should render with correct label', () => {
    const { getByText } = render(<GlassButton label="Click Me" />);
    expect(getByText('Click Me')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    const { getByRole } = render(<GlassButton label="Click" disabled={true} />);
    expect(getByRole('button')).toBeDisabled();
  });

  it('should call onPress when pressed', async () => {
    const mockPress = jest.fn();
    const { getByRole } = render(
      <GlassButton label="Click" onPress={mockPress} />
    );

    fireEvent.press(getByRole('button'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });

  it('should show loading state', () => {
    const { getByTestId } = render(
      <GlassButton label="Submit" loading={true} />
    );

    expect(getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should handle long press', async () => {
    const mockLongPress = jest.fn();
    const { getByRole } = render(
      <GlassButton label="Hold" onLongPress={mockLongPress} />
    );

    // Simulate long press (500ms+)
    fireEvent(getByRole('button'), 'longPress');
    expect(mockLongPress).toHaveBeenCalled();
  });
});

describe('ShiftStatus Component', () => {
  const testCases = [
    { status: 'scheduled', displayText: 'Not Started' },
    { status: 'active', displayText: 'In Progress' },
    { status: 'completed', displayText: 'Complete' },
    { status: 'cancelled', displayText: 'Cancelled' },
  ];

  testCases.forEach(({ status, displayText }) => {
    it(`should display "${displayText}" for status "${status}"`, () => {
      const { getByText } = render(<ShiftStatus status={status} />);
      expect(getByText(displayText)).toBeInTheDocument();
    });
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '@/hooks/useAuth';

describe('useAuth Hook', () => {
  it('should return initial auth state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should handle login', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });

  it('should handle logout', async () => {
    const { result } = renderHook(() => useAuth());

    // First login
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should refresh token on expiry', async () => {
    const { result } = renderHook(() => useAuth());

    const tokenRefreshed = jest.fn();
    
    // Mock token expiry
    await act(async () => {
      result.current.onTokenExpired(tokenRefreshed);
    });

    // Simulate token being invalid
    expect(tokenRefreshed).toHaveBeenCalled();
  });
});

describe('useLocation Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get current location', async () => {
    const { result } = renderHook(() => useLocation());

    await act(async () => {
      await result.current.getCurrentLocation();
    });

    expect(result.current.latitude).toBeDefined();
    expect(result.current.longitude).toBeDefined();
    expect(result.current.accuracy).toBeLessThan(100); // Within 100m
  });

  it('should track location updates', async () => {
    const { result } = renderHook(() => useLocation());
    const mockCallback = jest.fn();

    await act(async () => {
      result.current.watchLocation(mockCallback);
    });

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  it('should handle location permission denied', async () => {
    jest.spyOn(Location, 'requestForegroundPermissionsAsync').mockResolvedValue({
      granted: false,
      canAskAgain: true,
      expires: 'never',
    } as any);

    const { result } = renderHook(() => useLocation());

    await act(async () => {
      const granted = await result.current.requestPermission();
      expect(granted).toBe(false);
    });
  });
});
```

### Testing Redux Slices

```typescript
import { configureStore } from '@reduxjs/toolkit';
import shiftsReducer, { setShifts, filterByVenue } from '@/store/slices/shiftsSlice';

describe('Shifts Slice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: { shifts: shiftsReducer },
    });
  });

  it('should handle setShifts', () => {
    const shifts = [
      { id: 1, venue: 'Hotel A', status: 'active' },
      { id: 2, venue: 'Hotel B', status: 'scheduled' },
    ];

    store.dispatch(setShifts(shifts));
    const state = store.getState().shifts;

    expect(state.items).toEqual(shifts);
    expect(state.items.length).toBe(2);
  });

  it('should filter shifts by venue', () => {
    const shifts = [
      { id: 1, venue: 'Hotel A', status: 'active' },
      { id: 2, venue: 'Hotel B', status: 'scheduled' },
      { id: 3, venue: 'Hotel A', status: 'completed' },
    ];

    store.dispatch(setShifts(shifts));
    store.dispatch(filterByVenue('Hotel A'));

    const state = store.getState().shifts;
    expect(state.filtered).toEqual([shifts[0], shifts[2]]);
  });
});
```

### Testing Services

```typescript
describe('SyncManager', () => {
  it('should add item to queue', async () => {
    const syncManager = new SyncManager();

    await syncManager.addToQueue({
      type: 'check_in',
      payload: { shift_id: 1 },
      priority: 1,
    });

    const queue = await syncManager.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].type).toBe('check_in');
  });

  it('should sync queue items when online', async () => {
    const syncManager = new SyncManager();
    const apiMock = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: { success: true },
    });

    await syncManager.addToQueue({
      type: 'check_in',
      payload: { shift_id: 1 },
      priority: 1,
    });

    await syncManager.startSync();

    expect(apiMock).toHaveBeenCalled();
  });

  it('should retry failed sync items with backoff', async () => {
    jest.useFakeTimers();
    const syncManager = new SyncManager();

    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network error'));

    await syncManager.addToQueue({
      type: 'check_in',
      payload: { shift_id: 1 },
      priority: 1,
    });

    await syncManager.startSync();

    // Should retry after exponential backoff
    jest.advanceTimersByTime(2000);

    const queue = await syncManager.getQueue();
    expect(queue[0].retries).toBeGreaterThan(0);

    jest.useRealTimers();
  });
});
```

---

## Integration Testing

### API Integration Tests

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.post('/api/v1/auth/login/', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access: 'test_access_token',
        refresh: 'test_refresh_token',
        user: { id: 1, email: 'test@example.com', role: 'staff' },
      })
    );
  }),

  rest.get('/api/v1/shifts/current/', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        venue: { name: 'The Grand Hotel' },
        status: 'scheduled',
        start_time: '2026-02-13T09:00:00Z',
      })
    );
  })
);

describe('Auth API Integration', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should login and fetch current shift', async () => {
    const { getByA11yLabel, getByText } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    // Login
    await userEvent.type(getByA11yLabel('Email'), 'test@example.com');
    await userEvent.type(getByA11yLabel('Password'), 'password123');
    fireEvent.press(getByText('Log In'));

    // Wait for dashboard
    await waitFor(() => {
      expect(getByText('The Grand Hotel')).toBeInTheDocument();
    });
  });

  it('should handle authentication errors', async () => {
    server.use(
      rest.post('/api/v1/auth/login/', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({ detail: 'Invalid credentials' })
        );
      })
    );

    const { getByText, getByA11yLabel } = render(
      <Provider store={store}>
        <LoginScreen />
      </Provider>
    );

    await userEvent.type(getByA11yLabel('Email'), 'test@example.com');
    await userEvent.type(getByA11yLabel('Password'), 'wrong');
    fireEvent.press(getByText('Log In'));

    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
```

### Database Integration Tests

```typescript
import { database } from '@/database';
import { Q } from '@nozbe/watermelondb';

describe('Shift Database Integration', () => {
  beforeEach(async () => {
    // Clean database before each test
    await database.write(async () => {
      const shifts = await database.get('shifts').query().fetch();
      for (const shift of shifts) {
        await shift.destroyPermanently();
      }
    });
  });

  it('should save and retrieve shift', async () => {
    const shiftId = await database.write(async () => {
      const shift = await database.get('shifts').create((record) => {
        record.shift_id = 123;
        record.venue_id = 1;
        record.status = 'scheduled';
        record.sync_status = 'pending';
      });
      return shift.id;
    });

    const shift = await database.get('shifts').find(shiftId);
    expect(shift.shift_id).toBe(123);
    expect(shift.status).toBe('scheduled');
  });

  it('should filter shifts by status', async () => {
    await database.write(async () => {
      await database.get('shifts').create((record) => {
        record.shift_id = 1;
        record.status = 'active';
        record.sync_status = 'synced';
      });
      await database.get('shifts').create((record) => {
        record.shift_id = 2;
        record.status = 'scheduled';
        record.sync_status = 'synced';
      });
    });

    const activeShifts = await database
      .get('shifts')
      .query(Q.where('status', Q.eq('active')))
      .fetch();

    expect(activeShifts.length).toBe(1);
    expect(activeShifts[0].shift_id).toBe(1);
  });

  it('should update shift with relationships', async () => {
    const shiftId = await database.write(async () => {
      const shift = await database.get('shifts').create((record) => {
        record.shift_id = 123;
        record.status = 'scheduled';
      });

      // Create related incident
      await database.get('incidents').create((record) => {
        record.shift_id = 123;
        record.type = 'assault';
        record.severity = 'moderate';
        record.description = 'Test incident';
      });

      return shift.id;
    });

    const shift = await database.get('shifts').find(shiftId);
    const incidents = await shift.incidents.fetch();

    expect(incidents.length).toBe(1);
    expect(incidents[0].type).toBe('assault');
  });
});
```

### Offline Sync Integration Tests

```typescript
describe('Offline Sync Integration', () => {
  let syncManager: SyncManager;

  beforeEach(async () => {
    syncManager = new SyncManager();
    jest.clearAllMocks();
  });

  it('should queue action when offline and sync when online', async () => {
    // Simulate offline
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({ isConnected: false });

    // Add action
    await syncManager.addToQueue({
      type: 'check_in',
      payload: { shift_id: 1 },
      priority: 1,
    });

    const queueBefore = await syncManager.getQueue();
    expect(queueBefore.length).toBe(1);

    // Go online
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({ isConnected: true });
    await syncManager.startSync();

    const queueAfter = await syncManager.getQueue();
    expect(queueAfter.length).toBe(0); // Should be synced
  });

  it('should retry failed syncs with exponential backoff', async () => {
    jest.useFakeTimers();

    const apiMock = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { success: true } });

    await syncManager.addToQueue({
      type: 'check_in',
      payload: { shift_id: 1 },
      priority: 1,
    });

    await syncManager.startSync();
    expect(apiMock).toHaveBeenCalledTimes(1);

    // First retry after 1 second
    jest.advanceTimersByTime(1000);
    expect(apiMock).toHaveBeenCalledTimes(2);

    const queue = await syncManager.getQueue();
    expect(queue.length).toBe(0); // Should be successful on retry

    jest.useRealTimers();
  });
});
```

---

## E2E Testing

### E2E Setup with Detox

```typescript
// detox.config.js
module.exports = {
  testRunner: 'jest',
  apps: {
    ios: {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/MeadSecurity.app',
      build:
        'xcodebuild -workspace ios/MeadSecurity.xcworkspace -scheme MeadSecurity -configuration Release -derivedDataPath ios/build -arch x86_64 -gpu off',
    },
    android: {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  configurations: {
    'ios.sim.release': {
      device: {
        type: 'iPhone 14',
      },
      app: 'ios',
    },
    'android.emu.release': {
      device: {
        type: 'Android',
        device: {
          avdName: 'Pixel_4_API_30',
        },
      },
      app: 'android',
    },
  },
  testRunner: 'jest',
};
```

### E2E Test Examples

```typescript
describe('Complete Check-In Flow E2E', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { locations: 'always' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete full check-in from login to confirmation', async () => {
    // 1. Login
    await element(by.id('login-screen')).waitForVisible();
    await element(by.id('email-input')).typeText('staff@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).multiTap(1);

    // 2. Wait for dashboard
    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // 3. Find and tap current shift
    await element(by.id('current-shift-card')).tap();

    // 4. Verify shift details screen
    await waitFor(element(by.id('shift-details-screen')))
      .toBeVisible()
      .withTimeout(3000);

    // 5. Start check-in
    await element(by.id('check-in-button')).tap();

    // 6. Verify location screen
    await waitFor(element(by.id('location-screen')))
      .toBeVisible()
      .withTimeout(3000);
    await expect(element(by.id('location-status'))).toHaveText('Location verified');

    // 7. Continue to photo
    await element(by.id('location-continue')).tap();

    // 8. Capture photo (camera screen)
    await waitFor(element(by.id('camera-screen')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('camera-capture')).multiTap(2); // Double tap for capture

    // 9. Confirm photo
    await waitFor(element(by.id('photo-preview')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.id('photo-confirm')).tap();

    // 10. Signature (may skip for testing)
    await waitFor(element(by.id('signature-screen')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('signature-skip')).tap();

    // 11. Terms acceptance
    await waitFor(element(by.id('terms-screen')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('terms-checkbox')).tap();
    await element(by.id('terms-accept')).tap();

    // 12. Verify success screen
    await waitFor(element(by.id('check-in-success-screen')))
      .toBeVisible()
      .withTimeout(3000);
    await expect(element(by.id('success-message'))).toHaveText(
      'Check-in successful'
    );
  });

  it('should handle location permission denial', async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { locations: 'never' },
    });

    // Login
    await element(by.id('email-input')).typeText('staff@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('dashboard-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Start check-in
    await element(by.id('current-shift-card')).tap();
    await element(by.id('check-in-button')).tap();

    // Should show permission error
    await waitFor(element(by.id('permission-error')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should handle offline check-in', async () => {
    // Disable network
    await device.disableNetwork();

    // Login (should use cached credentials)
    await element(by.id('email-input')).typeText('staff@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // Wait for offline mode
    await waitFor(element(by.id('offline-banner')))
      .toBeVisible()
      .withTimeout(3000);

    // Continue with check-in (should queue action)
    await element(by.id('check-in-button')).tap();
    await element(by.id('photo-capture')).tap();
    await element(by.id('photo-confirm')).tap();
    await element(by.id('terms-accept')).tap();

    // Should show queued message
    await waitFor(element(by.id('sync-pending-message')))
      .toBeVisible()
      .withTimeout(2000);

    // Re-enable network
    await device.enableNetwork();

    // Should sync
    await waitFor(element(by.id('check-in-success-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

## Performance Testing

### Performance Benchmarks

```typescript
describe('Performance Tests', () => {
  it('should render large shift list in < 500ms', async () => {
    const shifts = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      venue: `Venue ${i}`,
      status: 'scheduled',
    }));

    const startTime = performance.now();

    const { getByTestId } = render(
      <Provider store={store}>
        <ShiftList shifts={shifts} />
      </Provider>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(500);
  });

  it('should navigate between screens in < 300ms', async () => {
    const { getByTestId } = render(<AppNavigator />);

    const startTime = performance.now();
    fireEvent.press(getByTestId('dashboard-tab'));
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(300);
  });

  it('should query database in < 100ms', async () => {
    const startTime = performance.now();

    const shifts = await database
      .get('shifts')
      .query()
      .fetch();

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100);
  });
});
```

---

## Accessibility Testing

### Accessibility Test Suite

```typescript
describe('Accessibility Tests', () => {
  it('should have proper accessibility labels on buttons', () => {
    const { getByA11yLabel } = render(<CheckInFlow />);

    expect(getByA11yLabel('Check In')).toBeInTheDocument();
    expect(getByA11yLabel('Take Photo')).toBeInTheDocument();
    expect(getByA11yLabel('Accept Terms')).toBeInTheDocument();
  });

  it('should announce status changes', async () => {
    const mockAnnounce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    const { getByText, rerender } = render(
      <ShiftStatus status="scheduled" />
    );

    rerender(<ShiftStatus status="active" />);

    await waitFor(() => {
      expect(mockAnnounce).toHaveBeenCalledWith('Shift is now active');
    });
  });

  it('should have minimum touch targets of 44x44pt', () => {
    const { getByA11yLabel } = render(<GlassButton label="Tap Me" />);
    const button = getByA11yLabel('Tap Me');

    const { width, height } = button.measure();
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });

  it('should have sufficient color contrast', async () => {
    const { getByText } = render(
      <Text style={{ color: '#000000', backgroundColor: '#FFFFFF' }}>
        High contrast text
      </Text>
    );

    // Use contrast checking library
    const contrastRatio = await checkContrast('#000000', '#FFFFFF');
    expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA
  });
});
```

---

## Test Environment Setup

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '@testing-library/jest-native/extend-expect',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@fluentui/react-native$': '<rootDir>/__mocks__/fluentui.js',
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/index.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    './src/utils/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
};
```

### Jest Setup File

```typescript
// jest.setup.js
import '@testing-library/jest-native/extend-expect';
import { server } from './__mocks__/server';

// Establish API mocking before all tests.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());

// Mock secure storage
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock location services
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 51.5074,
      longitude: -0.1278,
      accuracy: 10,
    },
  }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({
    granted: true,
  }),
}));
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Mobile App Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Build E2E
        run: npm run detox:build:release

      - name: Run E2E tests
        run: npm run detox:test:release
```

---

## Test Cases by Feature

### Authentication

- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Password reset flow
- [ ] Biometric authentication
- [ ] Token refresh on expiry
- [ ] Logout clears data

### Shifts

- [ ] Get current shift
- [ ] List all shifts (paginated)
- [ ] Filter shifts by status/venue
- [ ] Check-in with location verification
- [ ] Check-out with photo
- [ ] Handle check-in errors

### Incidents

- [ ] Create incident report
- [ ] Voice-to-text transcription
- [ ] Upload incident photos
- [ ] Submit incident when offline
- [ ] Sync incident when online

### Sync

- [ ] Add items to sync queue
- [ ] Sync items when online
- [ ] Queue items when offline
- [ ] Retry failed sync with backoff
- [ ] Handle sync conflicts

### Offline

- [ ] Use cached data offline
- [ ] Queue actions offline
- [ ] Sync when reconnected
- [ ] Show offline indicator
- [ ] Clear old cache data

---

## Coverage Goals

```
Target Coverage: 75% Overall
├── Unit Tests: 80% (high priority paths 95%)
├── Integration: 60%
├── E2E: 40% (critical user journeys)
└── Accessibility: 100% (all interactive elements)
```

**Status**: ✅ Complete | **Last Updated**: February 2026
