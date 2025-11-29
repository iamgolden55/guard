# Environment Setup Guide

## Quick IP Update Guide

When your IP address changes (e.g., when switching WiFi networks), you only need to update **one file**:

### Mobile App
**File:** `/mobile/.env`

```bash
# Find your current IP address
ipconfig getifaddr en0        # Mac
ipconfig                      # Windows (look for IPv4)

# Update this line in .env:
API_BASE_URL=http://YOUR_NEW_IP:8000
```

### Backend
**File:** `/backend/.env`

```bash
# Add your new IP to DJANGO_ALLOWED_HOSTS (comma-separated):
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,YOUR_NEW_IP

# Add your new IP to CORS_ALLOWED_ORIGINS:
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://YOUR_NEW_IP:8081,http://YOUR_NEW_IP:19000
```

### Restart Services

```bash
# 1. Restart backend
cd backend
# Kill existing process: Ctrl+C or lsof -ti:8000 | xargs kill
python manage.py runserver 0.0.0.0:8000

# 2. Restart mobile app (reload is enough)
cd mobile
# Press 'r' in the Metro terminal OR shake device and tap "Reload"
```

## First Time Setup

1. Copy example env files:
   ```bash
   # Mobile
   cd mobile
   cp .env.example .env

   # Backend
   cd ../backend
   cp .env.example .env  # if it exists
   ```

2. Update IPs in both .env files as shown above

3. Start services:
   ```bash
   # Backend
   cd backend
   python manage.py runserver 0.0.0.0:8000

   # Mobile (in another terminal)
   cd mobile
   npx expo start
   ```

4. Make sure your phone and computer are on the **same WiFi network**

## Troubleshooting

**Login fails / "Network request failed"**
- Check that mobile .env has correct IP
- Check that backend .env has your IP in ALLOWED_HOSTS
- Verify phone and computer are on same WiFi
- Restart both backend and mobile app

**"DisallowedHost" error**
- Add your IP to backend .env DJANGO_ALLOWED_HOSTS
- Restart Django backend

**Changes not taking effect**
- Mobile: Fully reload app (shake device → Reload)
- Backend: Restart Django server (Ctrl+C and run again)
