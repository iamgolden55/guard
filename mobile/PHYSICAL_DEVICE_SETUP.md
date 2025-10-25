# Testing on Physical Device - Quick Setup

## The Problem
When testing on a physical phone, `localhost` refers to the phone itself, not your computer. So the app can't reach the Django backend.

## The Solution (3 Steps)

### Step 1: Find Your Computer's IP Address

**On Mac:**
```bash
ipconfig getifaddr en0
```

**Expected output:** Something like `192.168.1.100` (your actual IP will be different)

**Copy this IP address!** You'll need it in Step 2 and 3.

---

### Step 2: Update Mobile App API URL

Open: `/Users/new/Projects/mead-security/remix2/mobile/src/utils/constants.ts`

**Find this line (around line 17):**
```typescript
BASE_URL: isDevelopment
  ? 'http://localhost:8000/api/v1'
  : 'https://api.meadsecurity.com/api/v1',
```

**Change it to (replace with YOUR IP):**
```typescript
BASE_URL: isDevelopment
  ? 'http://192.168.1.100:8000/api/v1'  // ← Use YOUR IP here!
  : 'https://api.meadsecurity.com/api/v1',
```

**Example:** If your IP is `192.168.1.155`, use `http://192.168.1.155:8000/api/v1`

---

### Step 3: Update Django ALLOWED_HOSTS

Open: `/Users/new/Projects/mead-security/remix2/backend/backend/settings.py`

**Find this line:**
```python
ALLOWED_HOSTS = ['localhost', '127.0.0.1']
```

**Change it to (replace with YOUR IP):**
```python
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.1.100']  # ← Add YOUR IP!
```

---

### Step 4: Restart Everything

**Terminal 1 - Django Backend:**
```bash
cd /Users/new/Projects/mead-security/remix2/backend
python manage.py runserver 0.0.0.0:8000
```
Note: `0.0.0.0:8000` instead of just `8000` - this allows external connections!

**Terminal 2 - Mobile App:**
```bash
cd /Users/new/Projects/mead-security/remix2/mobile
npm start
```

**On Your Phone:**
1. Make sure you're on the **same WiFi** as your computer
2. Open Expo Go app
3. Scan the QR code
4. Try logging in!

---

## Quick Test Checklist

- [ ] Found my computer's IP address
- [ ] Updated `constants.ts` with my IP
- [ ] Updated Django `ALLOWED_HOSTS` with my IP
- [ ] Phone and computer on same WiFi network
- [ ] Django running with `0.0.0.0:8000`
- [ ] Mobile app running (`npm start`)
- [ ] Scanned QR code in Expo Go
- [ ] App loaded on phone
- [ ] Can see login screen
- [ ] Tried logging in

---

## Troubleshooting

### "Network request failed"
- Double-check your IP address is correct in `constants.ts`
- Ensure Django is running with `0.0.0.0:8000` (not just `8000`)
- Verify phone and computer are on same WiFi
- Check Django's `ALLOWED_HOSTS` includes your IP

### "Connection refused"
- Make sure Django backend is actually running
- Check if firewall is blocking port 8000
- Try accessing `http://YOUR_IP:8000/api/v1/` in your phone's browser - if it doesn't load, it's a network issue

### "Cannot connect to Metro bundler"
- This is different - it's about Expo, not Django
- Make sure you're on same WiFi
- Try restarting Expo with `npm start -- --clear`

### Getting Different IP Each Time?
Your IP can change if you restart your router. Solutions:
1. Set a static IP in your router settings (best)
2. Just update `constants.ts` each time (quick)

---

## For iOS/Android Simulator/Emulator

**Good news:** Simulators and emulators work with `localhost`!

- **iOS Simulator**: Use `http://localhost:8000/api/v1` (works fine)
- **Android Emulator**: Use `http://10.0.2.2:8000/api/v1` (special Android address for host machine)

So you don't need to change anything for simulator testing.

---

## After Testing

When you're done testing on physical device, remember to change back to `localhost` if you want to use simulator:

```typescript
BASE_URL: isDevelopment
  ? 'http://localhost:8000/api/v1'  // Back to localhost
  : 'https://api.meadsecurity.com/api/v1',
```

Or better yet, create an environment variable to switch easily!
