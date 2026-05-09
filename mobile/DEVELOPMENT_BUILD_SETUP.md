# Development Build Setup Guide

This guide explains how to create a development build for the Security Staff Portal mobile app. Development builds provide full native functionality including server-sent push notifications.

## When Do You Need a Development Build?

### ✅ Use Expo Go (Current Setup) When:
- Rapid development and testing of UI/UX features
- Testing business logic and app flows
- Using local notifications (shift reminders work perfectly!)
- Quick iteration without build wait times

### 🔧 Create Development Build When:
- Testing server-sent push notifications from backend
- Preparing for production release
- Testing on devices without Expo Go installed
- Using native modules not available in Expo Go
- Distributing test builds to stakeholders

---

## Current Status

**Notification Support:**
- ✅ **Local Notifications**: Fully working in Expo Go
  - Shift reminders (3 hours and 45 minutes before)
  - Notification badges
  - Deep linking from notifications
  - Works completely offline

- ⏳ **Remote Push Notifications**: Requires development build
  - Server-sent notifications (e.g., "New shift available")
  - Real-time updates from backend
  - Multi-device notification sync

---

## Prerequisites

1. **Expo Account**
   ```bash
   # Create account at https://expo.dev
   # Then login via CLI:
   eas login
   ```

2. **EAS CLI** (Already installed)
   ```bash
   npm install -g eas-cli
   ```

3. **For Local Builds** (Optional - faster but requires setup):
   - Android: Android SDK and Studio
   - iOS: Xcode (Mac only)

---

## Step 1: Initialize Expo Project

This creates a unique project ID and links your app to your Expo account.

```bash
cd /Users/new/Projects/mead-security/remix2/mobile

# Initialize project (this creates/updates the project ID)
eas project:init
```

**What happens:**
- Creates a new Expo project in your account
- Generates a unique project ID (UUID format)
- Automatically updates `app.config.js` with the new project ID

**Expected output:**
```
✔ What would you like to name your project? … security-staff-mobile
✔ Created project security-staff-mobile
Updated app.config.js with project ID: 12345678-1234-1234-1234-123456789abc
```

---

## Step 2: Configure Environment Variables

Add the project ID to your `.env` file:

```bash
# Edit .env
nano .env

# Add this line (replace with your actual project ID from Step 1):
EXPO_PROJECT_ID=12345678-1234-1234-1234-123456789abc
```

**Why:** Separates configuration from code, allows different project IDs for different environments.

---

## Step 3: Build Development Build

### Option A: Cloud Build (Recommended)

Builds your app on Expo's servers. **Free for development builds**, no local setup required.

```bash
# Build for Android
eas build --platform android --profile development

# Build for iOS (requires Apple Developer account)
eas build --platform ios --profile development
```

**Build time:** 10-20 minutes

**What you get:**
- Android: APK file you can install directly
- iOS: App you can install via TestFlight or direct install

**Installation:**
1. EAS provides a download link when build completes
2. Download to your device and install
3. Trust the developer certificate (Settings > General > Device Management)

### Option B: Local Build (Faster)

Builds on your machine. Requires Android SDK or Xcode installed.

```bash
# Android local build
eas build --platform android --profile development --local

# iOS local build (Mac only)
eas build --platform ios --profile development --local
```

**Requirements:**
- **Android**: Android SDK, ANDROID_HOME environment variable
- **iOS**: Xcode 14+ (Mac only), valid signing certificates

**Build time:** 5-10 minutes

---

## Step 4: Install Development Build

### Android Installation

1. **Transfer APK to device:**
   ```bash
   # If building locally, APK is in project directory
   # If cloud build, download from EAS link

   # Install via USB
   adb install security-staff-mobile.apk

   # Or send download link to device and install
   ```

2. **Enable "Install Unknown Apps"** (if prompted)
   - Settings > Security > Install unknown apps
   - Allow your browser/file manager to install apps

3. **Launch the app** - you'll see the dev menu on shake

### iOS Installation

1. **Via TestFlight** (Cloud builds):
   - EAS automatically uploads to TestFlight
   - Install TestFlight from App Store
   - Open invitation link from EAS

2. **Direct Install** (Local builds):
   - Connect device via USB
   - Use Xcode to install: Window > Devices and Simulators

---

## Step 5: Testing Push Notifications

Once your development build is installed:

### 1. Verify Push Token Registration

Check app logs (shake device > View Logs):
```
[Notifications] ✅ Push token registered: ExponentPushToken[xxx...]
[Notifications] ✅ Token registered with backend
```

### 2. Test Server-Sent Notifications

From your backend Django shell:
```python
from api.models import User
from api.services.notification_service import send_push_notification

# Get a test user
user = User.objects.first()

# Send test notification
send_push_notification(
    user=user,
    title="Test Notification",
    body="This is a server-sent push notification!",
    data={"test": True}
)
```

### 3. Test Real Features

- Create a new shift (should receive notification)
- Release a shift (assignees get notified)
- Claim an available shift (requester gets confirmation)

---

## Step 6: Development Workflow

### Running the Development Build

```bash
# Start Expo dev server
npx expo start --dev-client

# Scan QR code with development build app
# OR press 'a' for Android, 'i' for iOS
```

**Key differences from Expo Go:**
- Uses your custom build instead of Expo Go
- Full access to all native modules
- Push notifications work end-to-end
- Slightly slower to reload (custom build, not Expo Go)

---

## Troubleshooting

### Build Fails: "Invalid UUID appId"

**Cause:** No valid Expo project ID configured

**Fix:**
```bash
eas project:init
# Then add project ID to .env file
```

### Build Fails: "eas.json validation error"

**Cause:** Conflicting version configuration

**Fix:** Already resolved in current `eas.json` (uses `autoIncrement: true` without manual version numbers)

### Push Token Registration Fails

**Cause:** App still using Expo Go instead of development build

**Fix:** Verify you're running the development build, not Expo Go:
```bash
# Check app logs for:
# "📱 Running in Expo Go - remote push not available" ← Wrong!
# "[Notifications] ✅ Push token registered" ← Correct!
```

### Can't Install APK on Android

**Cause:** "Install from Unknown Sources" disabled

**Fix:**
1. Settings > Security > Install unknown apps
2. Enable for browser/file manager
3. Try installation again

### iOS Signing Issues

**Cause:** No valid Apple Developer certificate

**Fix:**
1. Enroll in Apple Developer Program ($99/year)
2. Generate signing certificates in Xcode
3. Or use `eas credentials` to let EAS manage certificates

---

## Cost Breakdown

| Service | Development Builds | Production Builds |
|---------|-------------------|-------------------|
| Expo EAS Build | **FREE** (unlimited) | First 30/month free, then paid |
| Apple Developer | N/A for dev builds | $99/year (required for App Store) |
| Google Play | N/A for dev builds | $25 one-time (required for Play Store) |

**For development:** Completely free! ✅

---

## Build Profiles

Current `eas.json` configuration:

### `development` Profile
```json
{
  "developmentClient": true,
  "distribution": "internal",
  "android": { "buildType": "apk" }
}
```
- Full dev tools and debugging
- Connects to Expo dev server
- Can load JS bundles over network
- **Use this for testing**

### `preview` Profile
```json
{
  "distribution": "internal",
  "android": { "buildType": "apk" }
}
```
- Production-like build
- Standalone (no dev server needed)
- **Use for stakeholder testing**

### `production` Profile
```json
{
  "autoIncrement": true
}
```
- App Store / Play Store builds
- Fully optimized
- **Use for releases**

---

## Next Steps After First Build

1. **Set up automated builds** (CI/CD)
   ```bash
   # GitHub Actions example
   eas build --platform android --profile preview --non-interactive
   ```

2. **Configure update channels**
   ```bash
   # Over-the-air updates for JS-only changes
   eas update --branch production
   ```

3. **Set up crash reporting**
   ```bash
   # Sentry, BugSnag, or Expo's built-in error tracking
   ```

4. **Prepare production credentials**
   ```bash
   # iOS
   eas credentials

   # Android
   eas credentials
   ```

---

## Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Build Configuration**: https://docs.expo.dev/build/eas-json/
- **Development Builds**: https://docs.expo.dev/develop/development-builds/introduction/
- **Push Notifications**: https://docs.expo.dev/push-notifications/overview/
- **Expo Status**: https://status.expo.dev/

---

## Quick Reference Commands

```bash
# Initialize project
eas project:init

# Cloud build (recommended)
eas build --platform android --profile development

# Local build (faster)
eas build --platform android --profile development --local

# Start dev server for development build
npx expo start --dev-client

# Check build status
eas build:list

# View build logs
eas build:view [build-id]

# Update over-the-air (JS changes only)
eas update --branch main

# Check project info
eas project:info
```

---

## Summary

**Current Setup (Expo Go):**
✅ Fast development
✅ Local notifications work
❌ No server-sent push

**With Development Build:**
✅ Fast development (slightly slower reload)
✅ Local notifications work
✅ **Server-sent push notifications work**
✅ Full native module access
✅ Production-ready testing environment

**When ready to build, just run:**
```bash
eas project:init
eas build --platform android --profile development
```

**Total time:** ~15 minutes for first build (mostly waiting)

---

## Android: First-Time Setup

The codebase is already cross-platform (Expo managed, `app.config.js` has a complete `android` block, EAS profiles already include Android). This section covers the Android-specific environment setup a developer needs the first time.

### 1. Android Studio + Emulator (AVD)

If you only have a physical Android device (USB debugging on, on the same Wi-Fi as your dev machine), you can skip the emulator.

1. Install Android Studio: <https://developer.android.com/studio>
2. Open Studio → **More Actions → Virtual Device Manager → Create Virtual Device**
3. Pick **Pixel 7** (or similar) → **API 34 (Android 14)** → finish.
4. Start the AVD. Verify `adb devices` shows it:
   ```bash
   adb devices
   # List of devices attached
   # emulator-5554   device
   ```

### 2. Networking caveat: emulator vs. physical device

The repo's `update-ip.sh` writes your Mac's **LAN IP** into `mobile/.env` as `API_BASE_URL=http://<lan-ip>:8000`. That works for:
- iOS Simulator (loopback)
- Physical iPhone on the same Wi-Fi
- Physical Android phone on the same Wi-Fi

The Android **emulator** is different — it cannot see your Mac's LAN IP. The emulator reaches the host machine at the special address `10.0.2.2`. So for emulator runs:

```bash
# In mobile/.env, override after running ./update-ip.sh:
API_BASE_URL=http://10.0.2.2:8000
```

(Backend still needs to be running on `0.0.0.0:8000` so it accepts non-localhost connections — `python manage.py runserver 0.0.0.0:8000`.)

### 3. Run on Android via Expo Go (fastest path, no native push)

```bash
cd mobile
npm start                # starts Metro
# In the Metro terminal, press: a
# (or scan the QR with Expo Go on a physical Android device)
```

Use this for UI/flow QA. Local shift-reminder notifications work; backend-pushed notifications do **not** (Expo Go limitation — same as iOS).

### 4. Build a development APK (for native push, real builds)

```bash
cd mobile
npm run build:android:dev      # → eas build --platform android --profile development
```

EAS produces an APK; install it via:
- The QR/install link emailed by EAS, **or**
- `adb install ~/Downloads/security-staff-mobile.apk`

Launch the dev APK, then point it at your Metro server:
```bash
npx expo start --dev-client
# scan the QR from the dev APK (it has a built-in scanner)
```

### 5. Android: Firebase / FCM setup (required for push notifications)

Android push goes via FCM, not APNs. Without this configured, backend pushes silently no-op on Android.

1. **Create a Firebase project** (or reuse an existing one): <https://console.firebase.google.com>
2. **Add an Android app** to the project:
   - Package name: `com.meadsecurity.staffapp` (must match `app.config.js` android.package)
3. **Download `google-services.json`** and place it at `mobile/google-services.json`.
4. **Enable it in `app.config.js`** by uncommenting this line in the `android` block:
   ```js
   googleServicesFile: "./google-services.json",
   ```
5. **Upload the FCM V1 service-account key to EAS:**
   - In Firebase Console → Project Settings → Service Accounts → **Generate new private key** → download JSON.
   - Then run, from `mobile/`:
     ```bash
     eas credentials -p android
     # Select: push notifications
     # Select: Google Service Account Key for Push Notifications (FCM V1)
     # Upload the JSON you just downloaded
     ```
6. **Re-build** the dev APK so the new `google-services.json` is included:
   ```bash
   npm run build:android:dev
   ```

The app's `notificationService.ts` already creates the three required Android notification channels (SHIFT_REMINDERS, INCIDENT_ALERTS, SYNC_STATUS) and registers `platform: 'android'` with the backend at `/api/v1/notifications/devices/`. No code changes needed.

### 6. Google Sign-In on Android

The `app.config.js` `extra.google` block already reads an Android client ID from the env:
```js
androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

To wire it up:
1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth 2.0 Client ID** of type **Android**.
2. Package: `com.meadsecurity.staffapp`
3. SHA-1: from your EAS-managed Android signing cert. Find it via:
   ```bash
   eas credentials -p android
   # The Android Keystore section shows the SHA-1 fingerprint.
   ```
4. Add the resulting client ID to `mobile/.env`:
   ```
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxxxxxxxxx-yyyyyyyyy.apps.googleusercontent.com
   ```
5. Re-build the dev APK so the value ships.

Apple Sign-In stays iOS-only (already gated by `Platform.OS === 'ios'` in `LoginScreenV2.tsx` and `RegisterScreenV2.tsx`); Android users use Google Sign-In or email/password.

### 7. Smoke-test checklist on Android

Run these on both a physical Android device and the AVD:
- Email/password sign-in
- Google Sign-In (after step 6)
- Confirm Apple Sign-In button is **not** rendered on Android
- Dashboard, Scheduling (week view + drag-and-drop), Leave request (date pickers), Shift details (Open in Maps → opens Google Maps via `geo:` intent)
- Camera capture for shift photos
- Signature canvas
- Biometric login button shows "Use biometric login" copy (not "Face ID")
- Backend-pushed notification arrives and uses the correct channel (after step 5)
