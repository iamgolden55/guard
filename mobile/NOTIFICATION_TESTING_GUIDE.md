# 🔔 Notification System Testing Guide

## ✅ System Status: READY FOR TESTING

**Navigation fix applied successfully!** The app now uses a global navigation reference pattern that allows notifications to work correctly.

## Quick Answer to Your Question

**"If a shift is assigned to me, will I get the app notification?"**

**Answer**: You'll get **2 notifications** but NOT immediately when assigned:
1. **3 hours before** the shift starts (Advance Reminder)
2. **45 minutes before** the shift starts (Final Reminder)

These are **local notifications** - they work offline and don't require internet!

## Recent Fixes Applied

### Navigation Error Fix (2025-10-26)
**Problem**: App crashed with "Couldn't find a navigation object" error
**Solution**: Implemented global navigation reference pattern
- Created `navigationRef.ts` for global navigation access
- Updated `AppNavigator.tsx` to use the ref
- Modified `useNotifications.ts` to use ref instead of hook
- App now initializes notifications before NavigationContainer is ready

---

## Testing the Notifications

### Option 1: Using the Test Screen (Recommended)

I've created a dedicated test screen for you to easily test all notification features.

#### How to Access the Test Screen:

**Method A: Via React Navigation Debugger (if you have it)**
```
navigation.navigate('NotificationTest')
```

**Method B: Add a temporary button to Profile screen**
Add this to `mobile/src/screens/profile/ProfileScreen.tsx`:

```tsx
// Add this import at the top
import { useNavigation } from '@react-navigation/native';

// Add this button in your Profile screen JSX
<TouchableOpacity
  onPress={() => navigation.navigate('NotificationTest')}
  style={{ padding: 16, backgroundColor: '#0061FF', borderRadius: 8 }}
>
  <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
    🔔 Test Notifications
  </Text>
</TouchableOpacity>
```

**Method C: Use Expo Dev Menu**
1. Shake your phone or press `Ctrl+M` (Android) / `Cmd+D` (iOS) in development
2. Open React DevTools
3. Find the navigator and call: `navigation.navigate('NotificationTest')`

#### Test Screen Features:

Once you're on the test screen, you can:

✅ **Check Permissions** - See if notifications are enabled
✅ **Request Permissions** - Ask user for notification access
✅ **Register Push Token** - Register device with backend
✅ **Send Test Notification Now** - Immediate test notification
✅ **Send Shift Reminder Now** - Simulated shift reminder
✅ **Schedule Test (10 seconds)** - Test scheduled notifications
✅ **View Scheduled Notifications** - See all upcoming notifications
✅ **Clear All Scheduled** - Remove all scheduled notifications
✅ **Badge Management** - Test app badge counts

---

### Option 2: Testing with Real Shifts

#### Step 1: Make Sure You Have Shifts
```bash
# Check if you have upcoming shifts
# Login to the app and go to the Shifts tab
```

#### Step 2: Trigger Notification Scheduling
1. **Open the app** (this fetches shifts automatically)
2. **Go to Shifts tab** (shifts are fetched and notifications scheduled)
3. Check console logs for: `[ShiftsService] Scheduled notifications for X shifts`

#### Step 3: Verify Notifications Were Scheduled
Use the test screen or check the logs:
```typescript
// In the app console, you should see:
"Scheduled 2 notifications for shift 123"
// One notification 3 hours before
// One notification 45 minutes before
```

#### Step 4: Test Immediate Notification (Don't Wait!)
To test without waiting 3 hours, use the test screen's **"Send Shift Reminder Now"** button.

---

### Option 3: Manual Testing with Code

Add this temporary code to any screen for quick testing:

```typescript
import notificationService from '../services/notificationService';

// Test button handler
const testNotification = async () => {
  // Request permissions first
  const granted = await notificationService.requestPermissions();

  if (granted) {
    // Send immediate test
    await notificationService.sendTestShiftReminder(123, 'Security Venue');
    Alert.alert('Success', 'Test notification sent!');
  } else {
    Alert.alert('Error', 'Please enable notifications in Settings');
  }
};

// Add button to your screen
<TouchableOpacity onPress={testNotification}>
  <Text>Send Test Notification</Text>
</TouchableOpacity>
```

---

## What Happens in Production?

### When a Shift is Assigned:

1. **Admin assigns shift** → Shift saved to database with `start_time`

2. **User opens app** → App fetches shifts from backend

3. **Notification service activates**:
   ```
   For a shift starting at 2:00 PM today:

   ✅ Notification #1 scheduled for 11:00 AM (3 hours before)
      Title: "📅 Shift Reminder"
      Body: "Your shift at [Venue] starts in 3 hours"

   ✅ Notification #2 scheduled for 1:15 PM (45 minutes before)
      Title: "⏰ Shift Starting Soon!"
      Body: "Your shift at [Venue] starts in 45 minutes. Don't forget to check in!"
   ```

4. **User taps notification** → App opens directly to Shift Details screen

5. **Shift starts** → User checks in → Notifications automatically cancelled

---

## Notification Behavior

### ✅ Automatic Scheduling
- Notifications scheduled when app fetches shifts
- Works **offline** (local notifications)
- Stored on device, no internet needed to fire

### ✅ Automatic Cancellation
Notifications are automatically cancelled when:
- User checks into the shift
- User checks out from the shift
- User cancels the shift
- Shift is transferred to another user

### ✅ Deep Linking
- Tap notification → Opens shift details
- Works from background, foreground, or killed state

### ✅ Permission Handling
- Graceful permission requests
- Works even if permissions denied (no crashes)
- User-friendly permission prompts

---

## Testing Checklist

### Basic Tests
- [ ] Permissions granted when requested
- [ ] Immediate test notification appears
- [ ] Test shift reminder appears with correct venue name
- [ ] Scheduled test notification appears after 10 seconds
- [ ] Badge count increases with notifications

### Shift Integration Tests
- [ ] Opening app schedules notifications for upcoming shifts
- [ ] Check-in cancels shift notifications
- [ ] Check-out cancels shift notifications
- [ ] Transferring shift cancels notifications

### Deep Linking Tests
- [ ] Tap notification from foreground → Opens shift details
- [ ] Tap notification from background → Opens shift details
- [ ] Tap notification when app is killed → Opens app then shift details

### Permission Tests
- [ ] Can request permissions
- [ ] Handles permission denial gracefully
- [ ] Works in Settings → Notifications if denied

---

## Troubleshooting

### "No notification appeared"
1. Check permissions: Settings → App → Notifications
2. Check if notifications are scheduled: Use test screen → "View Scheduled Notifications"
3. Check console logs for errors
4. Try sending immediate test notification first

### "Notification appeared but tap does nothing"
1. Check if deep linking is set up (should be automatic)
2. Check console logs for navigation errors
3. Verify shift ID exists in the notification data

### "Can't find test screen"
1. Make sure you rebuilt the app after adding the screen
2. Check navigation is set up correctly
3. Try accessing via temporary button in Profile screen

### "Permission request doesn't show"
1. On iOS: Reset app permissions in Settings → General → Reset → Reset Location & Privacy
2. On Android: Uninstall and reinstall the app
3. Check if notifications are blocked at OS level

---

## Backend Integration (Future - AWS SNS)

The system is ready for remote push notifications via AWS SNS:

### What's Already Done ✅
- Device token registration endpoint: `/api/v1/notifications/devices/`
- Token storage in database (SNSDeviceToken model)
- Mobile app registers tokens on startup
- API ready for AWS endpoint ARN storage

### What's Pending ⏳
- AWS SNS Platform Application configuration
- Celery task to send SNS notifications
- SNS endpoint creation when token registered

### Why Local Notifications Are Enough for Now
- Work offline (no internet required)
- Instant delivery (no cloud delays)
- No AWS costs during development
- Easier to test and debug

---

## Support

If you encounter issues:

1. **Check console logs** - Most errors are logged
2. **Use test screen** - Diagnose problems quickly
3. **Check permissions** - Most common issue
4. **Verify shift data** - Make sure shifts exist in database

Happy testing! 🎉
