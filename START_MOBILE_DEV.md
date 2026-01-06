# Quick Start Guide for Mobile Development

## Every Time You Want to Use the Mobile App

### Prerequisites
- ✅ Your Mac and iPhone are on the **same WiFi network**
- ✅ Your iPhone has the app installed

### Start Both Servers (2 Terminals)

#### Terminal 1: Start Django Backend
```bash
cd /Users/new/Projects/mead-security/remix2/backend
python manage.py runserver 0.0.0.0:8000
```
Keep this running!

#### Terminal 2: Start Metro Bundler
```bash
cd /Users/new/Projects/mead-security/remix2/mobile
npx expo start
```
Keep this running!

### On Your iPhone
1. Open the **Security Staff Portal** app
2. If it asks for a server URL, enter: `http://Goldens-MacBook-Pro.local:8081`
3. Wait for it to connect (~10 seconds)
4. Login and use the app!

---

## One-Command Start (Optional)

Create this script to start both at once:

**File: `start-dev.sh`** (in the `remix2` folder)
```bash
#!/bin/bash

echo "🚀 Starting Mobile Development Environment"
echo ""

# Start Django in background
echo "1️⃣  Starting Django backend..."
cd backend
python manage.py runserver 0.0.0.0:8000 &
DJANGO_PID=$!
cd ..

# Wait for Django to start
sleep 3

# Start Metro bundler
echo "2️⃣  Starting Metro bundler..."
cd mobile
npx expo start

# Cleanup on exit
trap "kill $DJANGO_PID" EXIT
```

**To use:**
```bash
cd /Users/new/Projects/mead-security/remix2
chmod +x start-dev.sh
./start-dev.sh
```

This starts both servers at once!

---

## Different WiFi Networks

### ✅ What Still Works:
- Using `Goldens-MacBook-Pro.local` means **no IP updates needed**
- The app doesn't need to be rebuilt
- Same commands work

### ⚠️ What You Need to Do:
1. Make sure **both devices on the same new WiFi**
2. Start the servers (same commands as above)
3. That's it!

### Why It Works:
- `Goldens-MacBook-Pro.local` is a **hostname**, not an IP address
- It works on any WiFi network automatically
- macOS's Bonjour service handles this for you

---

## Traveling to Different Locations

**At home**: Same WiFi → Works ✅
**At office**: Same WiFi → Works ✅
**At coffee shop**: Same WiFi → Works ✅
**Using mobile data**: Won't work ❌ (need same network)

---

## When You Need to Rebuild

You **ONLY** need to rebuild the app if you:
1. ❌ Change native code (iOS/Android configuration)
2. ❌ Add new native dependencies (npm packages that need native code)
3. ❌ Update Expo SDK version
4. ❌ Change app permissions (camera, location, etc.)

You **DON'T** need to rebuild if you:
1. ✅ Change JavaScript code (automatic reload!)
2. ✅ Change WiFi networks
3. ✅ Change the backend API code
4. ✅ Travel to different locations

---

## Troubleshooting

### Issue: App won't connect to Metro

**Check 1**: Are both on same WiFi?
```bash
# On Mac - check network:
networksetup -getairportnetwork en0

# On iPhone: Settings → WiFi → Look at network name
# Should match!
```

**Check 2**: Is Metro running?
```bash
curl http://localhost:8081/status
# Should show: packager-status:running
```

**Fix**: Restart Metro
```bash
# Kill Metro if stuck:
pkill -f "expo start"

# Start fresh:
cd mobile
npx expo start --clear
```

### Issue: Metro connects but app won't login

**Check**: Is Django running?
```bash
curl http://localhost:8000/api/v1/shifts/
# Should return: {"detail":"Authentication credentials were not provided."}
```

**Fix**: Start Django
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

### Issue: "No development servers found"

**This means**: Metro bundler is not running or not reachable

**Fix**:
1. Make sure Metro is running: `cd mobile && npx expo start`
2. On iPhone, manually enter: `http://Goldens-MacBook-Pro.local:8081`
3. Or try IP: `http://192.168.0.127:8081`

---

## Daily Development Workflow

### Morning / Start of Day:
1. Open 2 terminals
2. Start Django (Terminal 1)
3. Start Metro (Terminal 2)
4. Open app on iPhone
5. Start coding!

### During Development:
- ✅ Edit JavaScript code → **Auto-reload** (shake phone to reload manually)
- ✅ Edit Django code → Restart Django server
- ✅ Metro keeps running → No restart needed

### End of Day:
1. Press **Ctrl+C** in both terminals to stop servers
2. Close terminals
3. Done!

---

## Pro Tips

### 1. Keep Terminals Visible
Use split terminal or separate windows so you can see:
- Django logs (shows API requests)
- Metro logs (shows JavaScript errors)

### 2. Shake to Reload
On your iPhone, **shake the device** to:
- Reload JavaScript
- Open developer menu
- Enable performance monitor

### 3. Fast Refresh
Metro has **Fast Refresh** enabled by default:
- Edit code in VS Code
- Save file
- See changes instantly on iPhone
- No need to manually reload!

### 4. Debug Like a Pro
In Metro terminal, press:
- `j` - Open debugger
- `r` - Reload JavaScript
- `d` - Open developer menu on device

---

## Summary

**What you need every time:**
1. ✅ Same WiFi network
2. ✅ Django running (`python manage.py runserver 0.0.0.0:8000`)
3. ✅ Metro running (`npx expo start`)

**What you DON'T need:**
1. ❌ Rebuild the app
2. ❌ Update .env files
3. ❌ Reconnect iPhone to Mac with cable

**It's that simple!** 🎉