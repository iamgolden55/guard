# Testing Guide - Release Shift Fix

## Quick Test

**Django server is already running** - The changes are live!

### Test 1: Try to Release a Future Shift (Should Work)

1. Open the mobile app
2. Go to **Calendar tab**
3. Tap on an **upcoming shift** (one that hasn't started yet)
4. Tap the **"Release"** button
5. Enter a reason
6. Tap **"Release Shift"**

**Expected Result:**
- ✅ Success alert: "Shift released to the open pool"
- ✅ Shift appears in "Available Shifts"
- ✅ Django logs: `"POST /api/v1/open-shift-requests/ HTTP/1.1" 201`

### Test 2: Try to Release a Started Shift (Should Fail with Clear Message)

1. Open the mobile app
2. Go to **Calendar tab**
3. Tap on a **shift that has already started**
4. Notice: **"Transfer" and "Release" buttons are grayed out**
5. Try tapping them anyway

**Expected Result:**
- ✅ Alert shown: "Cannot Release - This shift has already started"
- ✅ Modal doesn't open
- ✅ No API call made

### Test 3: Bypass Client Validation (Manual Test)

If you want to verify the backend error message:

1. Temporarily remove the client-side validation in `ReleaseShiftModal.tsx` (lines 44-54)
2. Try to release a started shift
3. Submit the form

**Expected Result:**
- ✅ Django returns: `400 {"error": "Cannot release shifts that have already started"}`
- ✅ Mobile shows: "HTTP 400: Cannot release shifts that have already started"
- ✅ Django logs show the actual error message

## Check Django Logs

You should see different responses now:

### Before Fix
```
Bad Request: /api/v1/open-shift-requests/
[26/Oct/2025 00:47:58] "POST /api/v1/open-shift-requests/ HTTP/1.1" 400 92
```

### After Fix - Success
```
[26/Oct/2025 01:00:00] "POST /api/v1/open-shift-requests/ HTTP/1.1" 201 567
```

### After Fix - Error with Message
```
[26/Oct/2025 01:00:00] "POST /api/v1/open-shift-requests/ HTTP/1.1" 400 67
```

The response size will be larger now because it includes the error message JSON.

## Verify Different Error Cases

### Missing shift_id
```bash
# From terminal (replace $TOKEN with your auth token)
TOKEN="your_token_here"

curl -X POST http://localhost:8000/api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"request_reason": "Emergency"}'

# Expected: {"error": "shift_id is required"}
```

### Missing reason
```bash
curl -X POST http://localhost:8000/api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shift_id": 123}'

# Expected: {"error": "request_reason is required"}
```

### Shift not found
```bash
curl -X POST http://localhost:8000/api/v1/open-shift-requests/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shift_id": 999999, "request_reason": "Emergency"}'

# Expected: {"error": "Shift not found or not assigned to you"}
```

## Success Criteria

- ✅ Release shift for **future shifts** works
- ✅ Client validation **prevents** releasing started shifts
- ✅ Backend validation **catches** any bypassed attempts
- ✅ Error messages are **clear and specific**
- ✅ Success returns **201 with shift data**

## Troubleshooting

### Still Getting 400?

1. **Check Django server is running**
   ```bash
   # Should see: Starting development server at http://0.0.0.0:8000/
   ```

2. **Verify the changes are loaded**
   ```bash
   # Restart Django if needed
   # Press Ctrl+C, then:
   python manage.py runserver 0.0.0.0:8000
   ```

3. **Check mobile app is using correct backend URL**
   - Open `mobile/.env`
   - Should be: `API_BASE_URL=http://YOUR_IP:8000`

### Still Getting Generic Errors?

1. **Mobile app needs rebuild**
   ```bash
   # The mobile error handling changes need reload
   npx expo start --clear
   ```

2. **Check Django logs** - They will now show the actual error

## What's Fixed

✅ **Backend now:**
- Accepts `shift_id` instead of requiring `original_shift`
- Returns specific error messages in JSON
- Handles all validation errors properly

✅ **Mobile app now:**
- Shows Django error messages instead of generic "400"
- Has client-side validation to prevent errors
- Disables buttons for invalid states

✅ **Complete validation chain:**
1. UI prevents invalid actions (grayed out buttons)
2. Client validates before sending (shift not started)
3. Backend validates and returns clear errors

---

**Ready to Test!** Try releasing a future shift - it should work now! 🎉
