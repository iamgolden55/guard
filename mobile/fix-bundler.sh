#!/bin/bash

echo "🧹 Clearing Metro bundler cache..."
npx expo start --clear

echo ""
echo "✅ Metro bundler cache cleared!"
echo ""
echo "📱 Next steps:"
echo "1. Press 'a' for Android or 'i' for iOS to rebuild"
echo "2. If the error persists, try:"
echo "   - Close Metro bundler (Ctrl+C)"
echo "   - Run: rm -rf node_modules && npm install"
echo "   - Run: npx expo start --clear again"
