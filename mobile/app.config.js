// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debug: Log environment variables
console.log('DEBUG app.config.js - Environment variables:');
console.log('  API_BASE_URL:', process.env.API_BASE_URL);
console.log('  EXPO_PROJECT_ID:', process.env.EXPO_PROJECT_ID);
console.log('  NODE_ENV:', process.env.NODE_ENV);

module.exports = {
  expo: {
    name: "Security Staff Portal",
    slug: "security-staff-mobile",
    version: "1.0.0",
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
      backgroundColor: "#007AFF"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.meadsecurity.staffapp",
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription: "This app requires camera access to capture venue entrance photos during shift check-in and incident evidence photos.",
        NSPhotoLibraryUsageDescription: "This app requires photo library access to attach existing photos to incident reports.",
        NSLocationWhenInUseUsageDescription: "This app requires location access to verify you are at the venue during shift check-in and check-out.",
        NSLocationAlwaysUsageDescription: "This app requires location access to verify you are at the venue during shift check-in and check-out.",
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
        backgroundColor: "#007AFF"
      },
      package: "com.meadsecurity.staffapp",
      versionCode: 1,
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
      "@react-native-community/datetimepicker"
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
    }
  }
};
