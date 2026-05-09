#!/bin/bash

# Restart Development Environment
# Run this when your IP changes or build artifacts get into a weird state.
# Works for both iOS (Xcode) and Android (Android Studio / Gradle) workflows.

echo "🧹 Cleaning build artifacts..."

# iOS build artifacts (only present after `expo prebuild --platform ios` or local iOS build)
if [ -d ios/build ]; then
  rm -rf ios/build
  echo "   • removed ios/build"
fi

# Android build artifacts (only present after `expo prebuild --platform android` or local Android build)
if [ -d android/build ]; then
  rm -rf android/build
  echo "   • removed android/build"
fi
if [ -d android/app/build ]; then
  rm -rf android/app/build
  echo "   • removed android/app/build"
fi
if [ -d android/.gradle ]; then
  rm -rf android/.gradle
  echo "   • removed android/.gradle"
fi

# Expo cache (always present)
rm -rf .expo
echo "   • removed .expo"

echo "🔄 Updating IP address..."
./update-ip.sh

echo ""
echo "🎯 Next steps:"
echo "   • iOS:     in Xcode → Product → Clean Build Folder (⇧⌘K), then Run (⌘R)"
echo "   • Android: in Android Studio → Build → Clean Project, then Run, OR"
echo "              run \"npx expo start --dev-client\" and open the dev APK on your device"
echo "   • Expo Go: just run \"npx expo start\" and press i (iOS) or a (Android)"
echo ""
echo "✅ App will use: $(grep API_BASE_URL .env)"
