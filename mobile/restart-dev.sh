#!/bin/bash

# Restart Development Environment for Xcode
# Run this when your IP changes

echo "🧹 Cleaning build artifacts..."
rm -rf ios/build
rm -rf .expo

echo "🔄 Updating IP address..."
./update-ip.sh

echo "📱 Metro bundler will start when you run from Xcode"
echo ""
echo "🎯 Next Steps:"
echo "1. In Xcode: Product → Clean Build Folder (⇧⌘K)"
echo "2. In Xcode: Run the app (⌘R)"
echo "3. App will now use: $(grep API_BASE_URL .env)"
echo ""
echo "✅ Backend is running at: http://192.168.0.127:8000"
