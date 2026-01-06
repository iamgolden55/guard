# Xcode Mobile Device Debugging Guide

## Quick Fix for API Connectivity Issues

### The Problem
When running your React Native app through Xcode on a physical device, the app doesn't connect to your Django backend even though both are on the same WiFi network.

### Root Cause
React Native apps cache the API configuration. When your IP changes, you need to clean the build and restart.

## ✅ Complete Fix (5 Minutes)

### Step 1: Update Environment Configuration
```bash
cd mobile
./restart-dev.sh
```

This script will:
- Clean build artifacts
- Update your IP in .env file
- Show you next steps

### Step 2: Clean Xcode Build
In Xcode:
1. **Stop** the app (⌘+.)
2. **Product** → **Clean Build Folder** (⇧⌘K)
3. Wait for "Clean Finished"

### Step 3: Rebuild and Run
1. **Product** → **Run** (⌘R)
2. Wait for build to complete (~2-5 minutes first time)
3. App launches on your physical device with new API URL

## 🔍 Verify It's Working

### 1. Check Backend is Accessible
```bash
curl http://192.168.0.127:8000/api/v1/shifts/
```
Should return: `{"detail":"Authentication credentials were not provided."}`
- ✅ This is GOOD - backend is responding
- ❌ Connection refused = backend not running or firewall blocking

### 2. Check App Console in Xcode
When you try to login in the app, you should see in Xcode console:
```
LOG  API Request: POST http://192.168.0.127:8000/api/v1/login/
```

### 3. Check Django Terminal
You should see requests appearing:
```
[03/Jan/2026 22:30:15] "POST /api/v1/login/ HTTP/1.1" 200 1234
```

## 🚨 Common Issues and Fixes

### Issue 1: "Network request failed" in App

**Cause**: App is using old IP address from cache

**Fix**:
```bash
cd mobile
rm -rf ios/build .expo
# Then in Xcode: Clean Build Folder + Rebuild
```

### Issue 2: "Connection Refused" or Timeout

**Possible Causes**:
1. Backend not running on `0.0.0.0:8000`
2. macOS Firewall blocking port 8000
3. Different WiFi networks

**Fix**:

**Check 1: Backend running correctly?**
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```
Must use `0.0.0.0:8000` NOT `localhost:8000`

**Check 2: Firewall?**
```bash
# Check if firewall is blocking Python
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

If firewall is enabled:
1. Go to **System Settings** → **Network** → **Firewall**
2. Click **Options**
3. Find **Python** in the list
4. Set to **Allow incoming connections**
5. Restart Django: `python manage.py runserver 0.0.0.0:8000`

**Check 3: Same WiFi?**
```bash
# On Mac - check your IP:
ipconfig getifaddr en0

# On iPhone - check WiFi:
# Settings → WiFi → (i) button → IP Address
# First 3 numbers should match: 192.168.0.XXX
```

### Issue 3: App Shows Old IP in Logs

**Cause**: Metro bundler cache or Xcode derived data

**Fix**:
```bash
cd mobile

# Clear ALL caches
rm -rf ios/build
rm -rf .expo
rm -rf ~/Library/Developer/Xcode/DerivedData/*SecurityStaff*
watchman watch-del-all  # If you have watchman installed

# Update .env
./update-ip.sh

# Rebuild in Xcode
```

### Issue 4: Works in Simulator but Not on Device

**Cause**: Simulator uses localhost, device uses network IP

**Fix**: This is expected behavior
- **Simulator**: Uses `localhost:8000` (same machine)
- **Physical Device**: Uses `192.168.0.127:8000` (network)

Make sure `.env` has the network IP (not localhost):
```bash
cat mobile/.env | grep API_BASE_URL
# Should show: API_BASE_URL=http://192.168.0.127:8000
# NOT: API_BASE_URL=http://localhost:8000
```

## 🔧 Advanced Debugging

### Enable Detailed Logging

**1. In api.config.ts**, verify the URL being used:
```typescript
// Add this temporarily to see what URL is being used:
console.log('🌐 API_BASE_URL:', API_BASE_URL);
console.log('🔧 ENV_API_BASE_URL:', ENV_API_BASE_URL);
```

**2. In services/api.ts**, add request logging:
```typescript
// Add this to see all API calls:
axios.interceptors.request.use(request => {
  console.log('📡 API Request:', request.method?.toUpperCase(), request.url);
  return request;
});
```

**3. Watch Django logs in real-time**:
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
# Keep this terminal visible while testing
```

### Test Network Connectivity from Your Phone

**Using Safari on iPhone**:
1. Open Safari
2. Go to: `http://192.168.0.127:8000/admin`
3. Should see Django admin login page
4. ✅ If you see the page = network connection works
5. ❌ If timeout = network or firewall issue

### Check CORS Configuration

If requests are reaching Django but being rejected:
```bash
cd backend
cat core/settings.py | grep -A 5 "CORS_ALLOW"
```

Should show:
```python
CORS_ALLOW_ALL_ORIGINS = True  # If DEBUG=True
```

## 📱 Best Practices for Xcode Development

### 1. Keep Backend Running
In a dedicated terminal:
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
# Leave this running
```

### 2. Use a Stable Network
For best results:
- Use 5GHz WiFi (more stable than 2.4GHz)
- Avoid public WiFi (often blocks device-to-device communication)
- Consider using USB tethering for most stable connection

### 3. Quick Restart Workflow
When IP changes:
```bash
cd mobile
./restart-dev.sh
# Then in Xcode: ⇧⌘K, then ⌘R
```

### 4. Alternative: Use Mac's Network Name
Instead of IP, use your Mac's local hostname:
```bash
# Find your Mac's name:
scutil --get LocalHostName
# Example output: "MacBook-Pro"

# Update mobile/.env:
API_BASE_URL=http://MacBook-Pro.local:8000
```

**Benefits**:
- Survives IP changes
- More stable
- No need to run update-ip.sh

**To use this permanently**:
```bash
cd mobile
echo "API_BASE_URL=http://$(scutil --get LocalHostName).local:8000" > .env.temp
cat .env | grep -v API_BASE_URL >> .env.temp
mv .env.temp .env
```

## 🎯 Checklist for Troubleshooting

Use this checklist when things aren't working:

- [ ] Backend running on `0.0.0.0:8000`? (not localhost)
- [ ] Both devices on same WiFi network?
- [ ] IP address correct in `mobile/.env`?
- [ ] Xcode build folder cleaned? (⇧⌘K)
- [ ] App rebuilt after cleaning? (⌘R)
- [ ] Can access `http://192.168.0.127:8000` from Mac?
- [ ] Can access `http://192.168.0.127:8000` from iPhone Safari?
- [ ] macOS Firewall allowing Python?
- [ ] ALLOWED_HOSTS includes `*` or your IP?
- [ ] Django terminal showing incoming requests?

## 📞 Still Not Working?

If you've tried everything and it still doesn't work:

### 1. Capture Full Debug Info
```bash
# Run this and save the output:
cd /Users/new/Projects/mead-security/remix2
echo "=== NETWORK INFO ==="
ipconfig getifaddr en0
echo ""
echo "=== BACKEND STATUS ==="
curl -v http://192.168.0.127:8000/api/v1/shifts/ 2>&1
echo ""
echo "=== MOBILE ENV ==="
cat mobile/.env
echo ""
echo "=== DJANGO SETTINGS ==="
cd backend
python -c "from core.settings import ALLOWED_HOSTS, DEBUG, CORS_ALLOW_ALL_ORIGINS; print(f'ALLOWED_HOSTS: {ALLOWED_HOSTS}'); print(f'DEBUG: {DEBUG}'); print(f'CORS_ALLOW_ALL_ORIGINS: {CORS_ALLOW_ALL_ORIGINS}')"
```

### 2. Try USB Tethering
As a last resort, bypass WiFi issues:
1. Connect iPhone to Mac via USB
2. On iPhone: Settings → Personal Hotspot → Enable
3. On Mac: Connect to iPhone's hotspot
4. Run `./update-ip.sh` to get new IP
5. Rebuild in Xcode

This ensures direct connection between devices.
