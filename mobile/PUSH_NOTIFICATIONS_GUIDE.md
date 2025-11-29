# Push Notifications Quick Reference

A quick guide to understanding push notifications in the Security Staff Portal mobile app.

---

## 🎯 TL;DR - What Works Where

| Feature | Expo Go | Development Build | Production |
|---------|---------|-------------------|------------|
| **Local Shift Reminders** | ✅ **Yes** | ✅ Yes | ✅ Yes |
| **Notification Badges** | ✅ **Yes** | ✅ Yes | ✅ Yes |
| **Deep Linking** | ✅ **Yes** | ✅ Yes | ✅ Yes |
| **Notification Channels** | ✅ **Yes** | ✅ Yes | ✅ Yes |
| **Offline Notifications** | ✅ **Yes** | ✅ Yes | ✅ Yes |
| **Server-Sent Push** | ❌ No | ✅ **Yes** | ✅ Yes |
| **Multi-device Sync** | ❌ No | ✅ **Yes** | ✅ Yes |

**Currently using:** Expo Go (all local features work!)

---

## 📱 Two Types of Notifications

### 1. Local Notifications (Scheduled)

**What:** Notifications scheduled by the app itself
**When:** Set when shifts are loaded from backend
**Works in:** Expo Go ✅, Development Build ✅, Production ✅

**Examples:**
- ⏰ "Your shift starts in 3 hours" (advance reminder)
- 📅 "Your shift starts in 45 minutes - Don't forget to check in!" (final reminder)
- 🔔 Badge count for unread notifications

**How it works:**
```
1. App fetches shifts from backend
2. App schedules local notifications:
   - 3 hours before shift start
   - 45 minutes before shift start
3. Android/iOS shows notifications at scheduled times
4. Works completely offline after scheduling!
```

### 2. Remote Push Notifications (Server-Sent)

**What:** Notifications sent from backend server in real-time
**When:** Events happen on the server that users need to know about
**Works in:** Development Build ✅, Production ✅, Expo Go ❌

**Examples:**
- 🆕 "New shift available at Venue A" (new open shift posted)
- 📝 "Your shift exchange request was accepted" (shift transfer approved)
- ⚠️ "Your upcoming shift was cancelled" (manager cancelled shift)
- 👥 "Someone wants to transfer their shift to you" (exchange request)

**How it works:**
```
1. Event happens on backend (e.g., new shift created)
2. Backend sends push notification via Expo Push Service
3. Expo routes notification to user's device
4. Notification appears immediately (even if app closed)
```

---

## 🔍 Current Implementation

### What's Already Built

✅ **Notification Service** (`src/services/notificationService.ts`)
- Permission handling
- Channel creation (Android)
- Local notification scheduling with deduplication
- Push token registration (ready for dev builds)
- Deep linking from notifications

✅ **Notification Hook** (`src/hooks/useNotifications.ts`)
- Automatic initialization
- Navigation from notifications
- Handles both local and remote notifications

✅ **Backend Integration**
- Shift reminder scheduling
- Badge management
- Test notification functions

### What Activates with Development Build

When you create a development build (`eas build`):

1. **Push Token Registration** automatically works
   ```typescript
   // Currently skipped in Expo Go
   const token = await Notifications.getExpoPushTokenAsync()
   // Token sent to backend → enables remote push
   ```

2. **Backend Can Send Notifications**
   ```python
   # Django backend
   send_push_notification(
       user=user,
       title="New Shift Available",
       body="Check out this new shift!",
       data={"screen": "AvailableShifts"}
   )
   ```

3. **Real-Time Updates**
   - User gets notified instantly when relevant events occur
   - No need to open app to receive updates

---

## 📊 Feature Matrix

### Local Notifications (Work Now)

| Feature | Status | Works In |
|---------|--------|----------|
| Shift reminders (3h before) | ✅ Working | Expo Go |
| Shift reminders (45min before) | ✅ Working | Expo Go |
| Badge counts | ✅ Working | Expo Go |
| Deep linking to shifts | ✅ Working | Expo Go |
| Notification channels | ✅ Working | Expo Go |
| Deduplication | ✅ Working | Expo Go |
| Offline scheduling | ✅ Working | Expo Go |
| Cancel on shift change | ✅ Working | Expo Go |

### Remote Push (Requires Dev Build)

| Feature | Status | Needs |
|---------|--------|-------|
| New shift posted | 🔧 Ready (needs build) | Dev Build |
| Shift exchange requests | 🔧 Ready (needs build) | Dev Build |
| Shift cancellations | 🔧 Ready (needs build) | Dev Build |
| Schedule changes | 🔧 Ready (needs build) | Dev Build |
| Team messages | 🔧 Ready (needs build) | Dev Build |
| Emergency alerts | 🔧 Ready (needs build) | Dev Build |

---

## 🧪 Testing Strategies

### Testing in Expo Go (Current)

**What to test:**
```bash
# 1. Shift Reminders
- Load shifts from backend
- Check notification scheduled (Settings > Notifications > Scheduled)
- Wait for notification to fire OR change system time

# 2. Deep Linking
- Tap notification → Should navigate to correct screen
- Test from: home screen, locked screen, notification tray

# 3. Badge Counts
- Check badge updates when notifications arrive
- Verify badge clears after viewing

# 4. Notification Channels (Android)
- Long-press notification → Settings
- Verify channel name and importance
- Test sound, vibration, badge settings
```

**Test notification function:**
```typescript
// In app code or dev menu
import notificationService from './services/notificationService';

// Immediate test notification
await notificationService.sendTestNotification();

// Scheduled test (10 seconds from now)
await notificationService.scheduleTestNotification(10);

// Test shift reminder format
await notificationService.sendTestShiftReminder(123, 'Test Venue');
```

### Testing in Development Build (When Ready)

**What to test additionally:**
```bash
# 1. Push Token Registration
- Check logs for: "Push token registered: ExponentPushToken[...]"
- Verify token sent to backend (check Django admin or API)

# 2. Server-Sent Notifications
# From Django shell:
python manage.py shell

from api.models import User
from api.services.notification_service import send_push_notification

user = User.objects.get(email='test@example.com')
send_push_notification(
    user=user,
    title="Test Remote Push",
    body="This came from the server!",
    data={"screen": "ShiftDetails", "shiftId": 123}
)

# 3. Real Use Cases
- Create new shift as manager → Staff receives notification
- Release shift → Available to others with notification
- Request shift exchange → Recipient gets notification
```

---

## 🚀 Migration Path

### Phase 1: Expo Go (Current) ← **You Are Here**

**Timeline:** Now
**What works:** All local notifications, full app functionality
**Testing:** Shift reminders, deep linking, badges
**Users:** Developers only

**Pros:**
✅ Fastest development cycle
✅ No build wait times
✅ Instant reload
✅ All core features work

**Cons:**
❌ No server-sent push

### Phase 2: Development Build

**Timeline:** When needed (~15 min to set up)
**What works:** Everything (local + remote push)
**Testing:** Full notification system end-to-end
**Users:** Internal testers, stakeholders

**When to move:**
- Need to test server-sent notifications
- Preparing for production
- Demo to stakeholders
- Integration testing with backend

**Commands:**
```bash
eas project:init                                    # Get project ID
eas build --platform android --profile development  # Build
```

### Phase 3: Production

**Timeline:** When releasing to users
**What works:** Everything, optimized for production
**Testing:** Final QA before release
**Users:** All staff members

**Commands:**
```bash
eas build --platform android --profile production   # Production build
eas submit --platform android                       # Submit to Play Store
```

---

## 📋 Notification Channel Reference

### Android Channels

| Channel | Importance | Use Case | Sound | Vibration |
|---------|-----------|----------|-------|-----------|
| **shift-reminders** | HIGH | Upcoming shifts | ✅ Default | ✅ Pattern |
| **incident-alerts** | MAX | Critical incidents | ✅ Default | ✅ Strong |
| **sync-status** | LOW | Offline sync complete | ❌ | ✅ Light |

Users can customize per-channel:
- Settings > Apps > Security Staff > Notifications
- Long-press notification → Settings

### iOS Categories

iOS doesn't have "channels" but has categories:
- Shift Reminders
- Incident Alerts
- General

---

## 🔧 Troubleshooting

### "Notifications not appearing"

**Check:**
1. Permissions granted? Settings > Security Staff > Notifications
2. Do Not Disturb mode off?
3. Battery optimization disabled? (Android)
4. Notification channels enabled? (Android)

**Debug:**
```typescript
// Check scheduled notifications
const scheduled = await notificationService.getScheduledNotifications();
console.log('Scheduled:', scheduled);

// Check permissions
const hasPermission = await notificationService.hasPermissions();
console.log('Permission:', hasPermission);
```

### "Deep linking not working"

**Check:**
1. Navigation initialized before notification tapped
2. Correct screen name in notification data
3. Screen registered in navigation stack

**Debug:**
```typescript
// Check navigation data
{
  data: {
    screen: 'ShiftDetails',  // Must match navigation stack
    shiftId: 123             // Passed as params
  }
}
```

### "Push token not registering"

**Check:**
1. Running in development build, not Expo Go?
2. Valid project ID configured?
3. Device has network connection?

**Debug:**
```typescript
// Check environment
import Constants from 'expo-constants';
console.log('Execution env:', Constants.executionEnvironment);
// Should be "standalone", not "storeClient" (Expo Go)

console.log('Project ID:', Constants.expoConfig?.extra?.eas?.projectId);
// Should be valid UUID, not "placeholder-project-id"
```

---

## 📖 Related Documentation

- **[DEVELOPMENT_BUILD_SETUP.md](./DEVELOPMENT_BUILD_SETUP.md)** - Complete guide to creating development builds
- **[Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/overview/)** - Official Expo documentation
- **[Notification Service](./src/services/notificationService.ts)** - Source code with detailed comments
- **[Notification Hook](./src/hooks/useNotifications.ts)** - React hook implementation

---

## 💡 Best Practices

### When Scheduling Notifications

✅ **DO:**
- Check for duplicates before scheduling
- Cancel old notifications when shift changes
- Validate shift times before scheduling
- Use meaningful notification data for deep linking

❌ **DON'T:**
- Schedule past shifts
- Schedule duplicate notifications
- Forget to cancel on shift cancellation
- Include large payloads in notification data

### Notification Content

✅ **DO:**
- Keep titles short and clear
- Include venue name and time
- Use emojis sparingly (enhance, don't clutter)
- Provide actionable information

❌ **DON'T:**
- Use all caps
- Write long messages (>2 lines)
- Include sensitive information
- Spam users with too many notifications

---

## 🎓 Understanding Push Token Flow

```
EXPO GO (Current):
┌──────────┐
│   App    │ 1. Detects Expo Go
│  (Expo   │ 2. Skips push token registration
│   Go)    │ 3. Local notifications work
└──────────┘

DEVELOPMENT BUILD (Future):
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│   App    │ 1. Get push token  │  Expo    │ 2. Send to backend │ Backend  │
│  (Dev    │ ─────────────────> │  Push    │ ─────────────────> │ Django   │
│  Build)  │                    │  Service │                    │  Server  │
└──────────┘                    └──────────┘                    └──────────┘
                                      │
                                      │ 3. Server sends notification
                                      │
                                      ▼
                                ┌──────────┐
                                │  User's  │ 4. Notification appears!
                                │  Device  │
                                └──────────┘
```

---

## ✅ Quick Decision Matrix

**Should I create a development build now?**

| Scenario | Use Expo Go | Create Dev Build |
|----------|-------------|------------------|
| Developing UI/features | ✅ | - |
| Testing shift reminders | ✅ | - |
| Fast iteration needed | ✅ | - |
| Testing server push | - | ✅ |
| Stakeholder demo | - | ✅ |
| Integration testing | - | ✅ |
| Preparing production | - | ✅ |

**Current recommendation:** Stick with Expo Go until you need server-sent notifications! 🎉

---

## 📞 Support

**Need help?**
- Check `DEVELOPMENT_BUILD_SETUP.md` for build instructions
- Review notification service code comments
- Test using built-in test functions
- Check Expo Status: https://status.expo.dev/

**Common questions:**
- Q: "Why don't remote notifications work in Expo Go?"
  - A: Android SDK 53+ removed this feature from Expo Go. Use development builds instead.

- Q: "Do I need to pay for push notifications?"
  - A: No! Development builds and Expo Push Service are free.

- Q: "Can I test without building?"
  - A: Yes! Local notifications (shift reminders) work perfectly in Expo Go.

- Q: "How long does a build take?"
  - A: First build: 10-20 minutes. Subsequent builds: 5-10 minutes.
