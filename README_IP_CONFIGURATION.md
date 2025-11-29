# IP Configuration Guide

## ⚡ The ONE Command Solution

When your IP changes (switching WiFi networks, etc.), just run:

```bash
cd mobile
./update-ip.sh
```

**That's it!** This automatically updates:
- ✅ `mobile/.env` → API_BASE_URL
- ✅ `backend/.env` → DJANGO_ALLOWED_HOSTS
- ✅ `backend/.env` → CORS_ALLOWED_ORIGINS

Then just restart your services:
```bash
# Terminal 1 - Backend
cd backend
python manage.py runserver 0.0.0.0:8000

# Terminal 2 - Mobile
cd mobile
npx expo start -c
```

---

## 🔧 What the Script Does

The `update-ip.sh` script:
1. **Auto-detects** your current IP address
2. **Updates mobile/.env** with the correct API URL
3. **Updates backend/.env** with the correct ALLOWED_HOSTS and CORS settings
4. **Shows you** exactly what changed

---

## 🆘 Troubleshooting

### Script can't detect IP
```bash
# Mac
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Wi-Fi*"}).IPAddress
```

Then manually edit `.env` files with that IP.

### Login still fails

**Check 1: Same WiFi**
- Phone and computer MUST be on the same WiFi network
- Turn off cellular data on phone during testing

**Check 2: Restart services**
```bash
# Kill old processes
lsof -ti:8000 | xargs kill
lsof -ti:8081 | xargs kill

# Start fresh
cd backend && python manage.py runserver 0.0.0.0:8000
cd mobile && npx expo start -c
```

**Check 3: Clear Expo cache**
```bash
cd mobile
npx expo start -c  # -c flag clears cache
```

**Check 4: Scan fresh QR code**
- Don't use recently opened apps in Expo Go
- Scan the NEW QR code from the terminal

---

## 📋 Manual Setup (If Script Fails)

1. **Find your IP:**
   ```bash
   ipconfig getifaddr en0  # Mac
   ```

2. **Edit mobile/.env:**
   ```env
   API_BASE_URL=http://YOUR_IP:8000
   ```

3. **Edit backend/.env:**
   ```env
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,YOUR_IP
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://YOUR_IP:8081,http://YOUR_IP:19000
   ```

4. **Restart both services**

---

## 🎯 Why This Approach?

**Before:** Edit 11+ lines across multiple files every time IP changes 😫

**After:** Run ONE command: `./update-ip.sh` ✨

This follows the DRY principle (Don't Repeat Yourself) and makes IP changes trivial.

---

## 🔒 Security Note

The script only updates **development** configurations. For production:
- Use proper domain names (not IPs)
- Configure CORS strictly for your production domains
- Never commit `.env` files to git (they're in `.gitignore`)
