#!/bin/bash

# Auto-detect IP and update mobile .env file
# Run this script whenever your WiFi network changes
#
# Platform notes:
#   • iOS Simulator   → uses the host machine directly; the LAN IP works.
#   • Physical iPhone → must be on the same Wi-Fi as the Mac; LAN IP works.
#   • Physical Android → same Wi-Fi as the Mac; LAN IP works.
#   • Android EMULATOR → does NOT see the host LAN IP. The emulator reaches the
#                        host at the special address 10.0.2.2 instead.
#                        If you're running on the Android emulator, override
#                        the .env value after this script:
#                          API_BASE_URL=http://10.0.2.2:8000
#                        (Or run: ./switch-env.sh local-emulator if/when added.)

echo "🔍 Detecting your local IP address..."

# Detect IP address (works on Mac/Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - Get the active IP address (not localhost)
    # This gets the IP used for external connections
    IP=$(ipconfig getifaddr $(route get default | grep interface | awk '{print $2}') 2>/dev/null)

    # Fallback: try common interfaces if the above fails
    if [ -z "$IP" ]; then
        IP=$(ipconfig getifaddr en0)
    fi
    if [ -z "$IP" ]; then
        IP=$(ipconfig getifaddr en1)
    fi
else
    # Linux
    IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    echo "❌ Could not detect IP address. Are you connected to WiFi?"
    exit 1
fi

echo "✅ Detected IP: $IP"

# Update mobile .env file
ENV_FILE="$(dirname "$0")/.env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found at: $ENV_FILE"
    exit 1
fi

# Update the API_BASE_URL line
sed -i.bak "s|API_BASE_URL=http://.*:8000|API_BASE_URL=http://$IP:8000|g" "$ENV_FILE"

echo "✅ Updated $ENV_FILE"
echo "   API_BASE_URL=http://$IP:8000"
echo ""
echo "🎯 Next steps:"
echo "   1. Restart your backend: cd backend && python manage.py runserver 0.0.0.0:8000"
echo "   2. Reload your mobile app (press 'r' in Expo)"
