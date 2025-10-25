# Mobile App API Connection Setup

## Issue
The mobile app login button is not connecting to the backend API.

## Root Cause
When testing on a physical iPhone, `localhost:8000` doesn't work because it refers to the phone itself, not your development computer.

## Solution Applied

### 1. Updated Mobile App API Configuration
**File:** `mobile/src/config/api.config.ts`

Changed from:
```typescript
const DEVELOPMENT_API_URL = 'http://localhost:8000/api/v1/';
```

To:
```typescript
const DEVELOPMENT_API_URL = 'http://10.0.4.21:8000/api/v1/';
```

**Your computer's local IP:** `10.0.4.21`

### 2. Updated Django Backend Settings
**File:** `backend/core/settings.py`

**ALLOWED_HOSTS** - Added your local IP:
```python
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,172.16.32.165,10.0.4.21').split(',')
```

**CORS_ALLOWED_ORIGINS** - Added mobile app origins:
```python
CORS_ALLOWED_ORIGINS = [
    # ... existing origins ...
    # Mobile app development
    "http://10.0.4.21:8081",
    "http://10.0.4.21:8082",
    "http://10.0.4.21:19000",
    "http://10.0.4.21:19001",
]
```

## Steps to Test

### 1. Start Django Backend
```bash
cd backend
source venv/bin/activate  # Activate virtual environment
python manage.py runserver 10.0.4.21:8000
```

You should see:
```
Starting development server at http://10.0.4.21:8000/
```

### 2. Verify Backend is Accessible
In a new terminal:
```bash
curl http://10.0.4.21:8000/api/v1/auth/login/
```

Expected response: `{"detail":"Method \"GET\" not allowed."}` (this is good - means it's accessible)

### 3. Start Mobile App
```bash
cd mobile
npx expo start --clear
```

### 4. Test Login
1. Scan QR code on your iPhone
2. App should show login screen
3. Enter credentials:
   - Username: (your test user)
   - Password: (your test password)
4. Click "Log In"
5. Check Django terminal for incoming request logs

## Troubleshooting

### If login still doesn't work:

**Check Django is running:**
```bash
lsof -i :8000
```

**Check Django logs:**
Look for POST requests to `/api/v1/auth/login/` in the Django runserver output

**Check mobile app logs:**
In Expo Dev Tools, check the console for any error messages

**Verify your IP hasn't changed:**
```bash
ipconfig getifaddr en0
```

If IP changed, update both:
- `mobile/src/config/api.config.ts` (DEVELOPMENT_API_URL)
- `backend/core/settings.py` (ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS)

### Common Issues:

1. **Connection Refused** - Django not running or firewall blocking
2. **CORS Error** - CORS_ALLOWED_ORIGINS not updated
3. **404 Error** - Wrong API endpoint URL
4. **403 Forbidden** - ALLOWED_HOSTS not updated

## Network Requirements

- iPhone and computer must be on the same WiFi network
- Firewall should allow connections on port 8000
- Django DEBUG must be True for development

## Production Deployment

For production, update:
```typescript
const PRODUCTION_API_URL = 'https://api.meadsecurity.com/api/v1/';
```

And the app will automatically use it when built for production.
