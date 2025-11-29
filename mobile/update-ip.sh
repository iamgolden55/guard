#!/bin/bash
# Automatically update ALL .env files with current IP address
# ONE COMMAND TO RULE THEM ALL! 🚀

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Detecting your IP address...${NC}"

# Get IP address - try multiple interfaces
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

# If Mac methods fail, try generic approach
if [ -z "$IP" ]; then
    IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

if [ -z "$IP" ]; then
    echo -e "${RED}❌ Could not auto-detect IP address${NC}"
    echo "Please run one of these commands to find your IP:"
    echo "  Mac: ipconfig getifaddr en0"
    echo "  Linux: hostname -I | awk '{print \$1}'"
    echo "  Windows: ipconfig (look for IPv4 Address)"
    exit 1
fi

echo -e "${GREEN}✓ Found IP: $IP${NC}"
echo ""

# ============================================
# 1. Update mobile/.env
# ============================================
MOBILE_ENV="$(dirname "$0")/.env"
if [ -f "$MOBILE_ENV" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|API_BASE_URL=http://.*:8000|API_BASE_URL=http://$IP:8000|g" "$MOBILE_ENV"
    else
        # Linux
        sed -i "s|API_BASE_URL=http://.*:8000|API_BASE_URL=http://$IP:8000|g" "$MOBILE_ENV"
    fi
    echo -e "${GREEN}✓ Updated mobile/.env${NC}"
else
    echo -e "${YELLOW}⚠️  Mobile .env not found${NC}"
fi

# ============================================
# 2. Update backend/.env
# ============================================
BACKEND_ENV="$(dirname "$0")/../backend/.env"
if [ -f "$BACKEND_ENV" ]; then
    # Update DJANGO_ALLOWED_HOSTS to keep only localhost and current IP
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|DJANGO_ALLOWED_HOSTS=.*|DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,$IP|g" "$BACKEND_ENV"
        sed -i '' "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=http://localhost:3000,http://$IP:8081,http://$IP:19000|g" "$BACKEND_ENV"
        sed -i '' "s|CORS_ADDITIONAL_ORIGINS=.*|CORS_ADDITIONAL_ORIGINS=http://$IP:8081,http://$IP:19000|g" "$BACKEND_ENV"
    else
        # Linux
        sed -i "s|DJANGO_ALLOWED_HOSTS=.*|DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,$IP|g" "$BACKEND_ENV"
        sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=http://localhost:3000,http://$IP:8081,http://$IP:19000|g" "$BACKEND_ENV"
        sed -i "s|CORS_ADDITIONAL_ORIGINS=.*|CORS_ADDITIONAL_ORIGINS=http://$IP:8081,http://$IP:19000|g" "$BACKEND_ENV"
    fi
    echo -e "${GREEN}✓ Updated backend/.env${NC}"
else
    echo -e "${YELLOW}⚠️  Backend .env not found${NC}"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Configuration updated successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Current IP: ${GREEN}$IP${NC}"
echo ""
echo -e "${BLUE}Files updated:${NC}"
echo "  • mobile/.env"
echo "  • backend/.env"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "  1. Restart Django: ${YELLOW}python manage.py runserver 0.0.0.0:8000${NC}"
echo "  2. Restart Expo: ${YELLOW}npx expo start -c${NC}"
echo "  3. Scan fresh QR code from Expo Go"
echo ""
echo -e "${GREEN}Done! Now everything uses $IP${NC}"
