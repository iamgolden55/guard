// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  expo: {
    name: "Mead Security",
    slug: "security-staff-mobile",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "securitystaff",
    updates: {
      url: "https://u.expo.dev/9d8d1bce-0f46-4c87-99c4-503a32be2113"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      // Dark canvas matches the V2 launch animation so there's no
      // white/blue flash between native splash and LaunchScreenV2.
      // The old splash-icon.png (teal padlock) will briefly appear on
      // this dark bg until the PNG is replaced with a dark-theme asset.
      backgroundColor: "#0b0b0e"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.meadsecurity.staffapp",
      buildNumber: "12",
      infoPlist: {
        NSCameraUsageDescription: "This app requires camera access to capture venue entrance photos during shift check-in and incident evidence photos.",
        NSPhotoLibraryUsageDescription: "This app requires photo library access to attach existing photos to incident reports.",
        NSLocationWhenInUseUsageDescription: "This app requires location access to verify you are at the venue during shift check-in and check-out.",
        NSFaceIDUsageDescription: "This app uses Face ID for secure and convenient login.",
        NSMicrophoneUsageDescription: "This app requires microphone access for voice-to-text incident reporting."
      },
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0b0b0e"
      },
      package: "com.meadsecurity.staffapp",
      versionCode: 1,
      // Firebase / FCM for Android push notifications.
      //
      // google-services.json is GITIGNORED — it contains a live Google API
      // key that GitHub flags as a secret (and that can be abused for billing).
      //   • Local dev: download from Firebase console (com.meadsecurity.staffapp
      //     Android app) and drop into mobile/. The file is on disk but not
      //     committed.
      //   • EAS production builds: provided via EAS Secrets:
      //       eas secret:create --type file --name GOOGLE_SERVICES_JSON \
      //         --value mobile/google-services.json
      //     EAS makes it available at build time as $GOOGLE_SERVICES_JSON.
      // Without this file an EAS Android build will succeed but backend pushes
      // will silently no-op on Android.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "CAMERA",
        "RECORD_AUDIO",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "VIBRATE"
      ],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-secure-store",
      "expo-camera",
      "expo-location",
      "expo-notifications",
      "expo-local-authentication",
      "expo-apple-authentication",
      "expo-web-browser",
      "@react-native-community/datetimepicker",
      "expo-font",
      ["@sentry/react-native/expo", {
        organization: "mead-security",
        project: "security-staff-mobile",
        uploadSourceMaps: false,
      }],
    ],
    install: {
      exclude: [
        "react-native-reanimated"
      ]
    },
    extra: {
      eas: {
        // Expo Project ID - Required for EAS builds and push notifications
        //
        // For Expo Go Development (current setup):
        //   - Leave as placeholder or undefined
        //   - Local notifications work perfectly without this
        //   - All app features work except server-sent push
        //
        // For Development Builds:
        //   1. Run: eas project:init
        //   2. Copy project ID to .env: EXPO_PROJECT_ID=your-id-here
        //   3. Run: eas build --platform android --profile development
        //
        // See DEVELOPMENT_BUILD_SETUP.md for complete guide
        projectId: process.env.EXPO_PROJECT_ID || "9d8d1bce-0f46-4c87-99c4-503a32be2113"
      },
      // Environment variables accessible via expo-constants
      apiBaseUrl: process.env.API_BASE_URL || "http://localhost:8000",
      // Google OAuth configuration
      google: {
        expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      },
    }
  }
};
