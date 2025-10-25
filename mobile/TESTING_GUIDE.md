# Mobile App Testing Guide

## ✅ What We've Built So Far

### Phase 0 Setup (100% Complete)
- ✅ Expo project with TypeScript
- ✅ Project folder structure
- ✅ EAS Build configuration
- ✅ Environment constants
- ✅ Theme configuration (Liquid Glass UI)
- ✅ Type definitions
- ✅ **Login Screen** (fully functional!)

### Login Screen Features
- Email and password inputs
- Password visibility toggle
- Form validation
- Loading state
- Error handling
- Biometric login button (placeholder)
- Beautiful Liquid Glass UI design
- Responsive layout

---

## 🚀 How to Test the App Right Now

### Step 1: Start the Django Backend

The mobile app needs the Django backend running to authenticate:

```bash
# Terminal 1: Start Django backend
cd /Users/new/Projects/mead-security/remix2/backend
python manage.py runserver
```

**Expected output:**
```
Starting development server at http://127.0.0.1:8000/
```

### Step 2: Start the Mobile App

```bash
# Terminal 2: Start Expo development server
cd /Users/new/Projects/mead-security/remix2/mobile
npm start
```

**Expected output:**
```
Metro waiting on exp://...
› Press i │ open iOS simulator
› Press a │ open Android emulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
```

### Step 3: Run on Device/Simulator

You have 3 options:

#### Option 1: Physical Device (Recommended)
1. Install **Expo Go** app from App Store (iOS) or Play Store (Android)
2. Scan the QR code displayed in the terminal
3. App will load on your phone

#### Option 2: iOS Simulator (Mac only)
1. Press `i` in the terminal
2. iOS Simulator will launch automatically
3. App will load in the simulator

#### Option 3: Android Emulator
1. Start Android Emulator from Android Studio
2. Press `a` in the terminal
3. App will load in the emulator

---

## 🧪 Testing the Login Screen

### Test Case 1: Valid Login
1. **Email**: Use a valid staff email from your Django database
2. **Password**: Use the correct password
3. **Expected**:
   - Loading spinner appears
   - Success message displayed
   - Navigate to dashboard placeholder

### Test Case 2: Invalid Credentials
1. **Email**: `test@example.com`
2. **Password**: `wrongpassword`
3. **Expected**:
   - Alert dialog with error message
   - Form remains on screen
   - Can try again

### Test Case 3: Empty Fields
1. Leave both fields empty
2. Press LOGIN button
3. **Expected**:
   - Alert: "Please enter both email and password."

### Test Case 4: Network Error
1. Stop the Django backend (`Ctrl+C`)
2. Try to login
3. **Expected**:
   - Alert: "Unable to connect to server..."
   - Form remains functional

### Test Case 5: Password Visibility Toggle
1. Type password
2. Press the eye icon 👁️
3. **Expected**:
   - Password becomes visible
   - Icon changes
   - Can toggle back

### Test Case 6: Biometric Login (Placeholder)
1. Press "Biometric Login" button
2. **Expected**:
   - Alert: "Biometric authentication will be implemented in Phase 1"

---

## 🎨 UI/UX Testing

### Visual Checks
- ✅ Blue gradient background
- ✅ Lock icon (🔒) at top
- ✅ "Security Portal" title in white
- ✅ Glass-effect input fields
- ✅ White login button
- ✅ Glass-effect biometric button
- ✅ Version number at bottom

### Interaction Testing
- ✅ Keyboard appears when tapping inputs
- ✅ Keyboard hides when tapping outside
- ✅ Buttons respond to touch (opacity change)
- ✅ Loading spinner visible during API call
- ✅ Form disabled during loading

### Responsive Design
- ✅ Works on small phones (iPhone SE)
- ✅ Works on large phones (iPhone Pro Max)
- ✅ Works on tablets (iPad)
- ✅ Landscape orientation (limited support - form might clip)

---

## 🔧 Troubleshooting

### "Cannot connect to backend"
**Problem**: Mobile app can't reach Django backend at `http://localhost:8000`

**Solution for Physical Device**:
```typescript
// In src/utils/constants.ts, update API_CONFIG.BASE_URL:
BASE_URL: isDevelopment
  ? 'http://YOUR_COMPUTER_IP:8000/api/v1'  // e.g., http://192.168.1.100:8000/api/v1
  : 'https://api.meadsecurity.com/api/v1',
```

**How to find your computer's IP**:
- Mac: System Settings → Network → Wi-Fi → Details → IP Address
- Windows: Open Command Prompt → type `ipconfig` → look for IPv4 Address

**Important**: Your phone must be on the same Wi-Fi network as your computer!

**Solution for Simulator/Emulator**:
- iOS Simulator: `http://localhost:8000` works fine
- Android Emulator: Use `http://10.0.2.2:8000` instead

### "Module not found" error
**Problem**: Import path issues

**Solution**:
```bash
cd mobile
rm -rf node_modules
npm install
npm start -- --clear
```

### "Expo Go app crashes"
**Problem**: Incompatible native modules

**Solution**: Some features require a development build (not Expo Go):
- Camera
- Biometric authentication
- Push notifications

For now, these will show placeholder alerts. They'll work in Phase 1 with EAS Build.

### "TypeScript errors"
**Problem**: Type checking errors

**Solution**:
```bash
cd mobile
npx tsc --noEmit
```

This will show all TypeScript errors. Most can be ignored in development with `// @ts-ignore`.

---

## 📋 What's Next: Phase 1 Development

### Immediate Next Steps (Phase 1: Authentication & Navigation)

#### 1. Install Navigation Dependencies
```bash
cd mobile
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context react-native-gesture-handler
```

#### 2. Install State Management (Redux)
```bash
npm install @reduxjs/toolkit react-redux redux-persist @react-native-async-storage/async-storage
```

#### 3. Install Authentication Dependencies
```bash
npm install expo-secure-store axios jwt-decode
```

#### 4. Build These Screens (in order):
1. **Dashboard Screen** - Main screen after login
2. **Bottom Tab Navigation** - Home, Calendar, Team, Settings
3. **Shift Calendar Screen** - View all shifts
4. **Profile Screen** - User profile and settings

#### 5. Implement Real Authentication
- Store JWT tokens in SecureStore
- Set up Redux store
- Implement token refresh logic
- Add logout functionality

---

## 🎯 Testing Checklist Before Moving to Phase 2

- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Empty fields show validation error
- [ ] Network error shows appropriate message
- [ ] Password visibility toggle works
- [ ] UI looks good on different screen sizes
- [ ] Keyboard doesn't cover inputs
- [ ] Loading state is visible
- [ ] App doesn't crash on any interaction

---

## 📱 Backend API Endpoints Needed

The mobile app will use these Django API endpoints:

### Authentication
- `POST /api/v1/auth/login/` - Login with email/password
- `POST /api/v1/auth/refresh/` - Refresh JWT token
- `POST /api/v1/auth/logout/` - Logout

### User Profile
- `GET /api/v1/users/me/` - Get current user profile
- `PATCH /api/v1/users/me/` - Update user profile

### Shifts (Phase 3)
- `GET /api/v1/shifts/` - Get all shifts
- `GET /api/v1/shifts/{id}/` - Get shift details
- `POST /api/v1/shifts/check-in/` - Check in to shift
- `POST /api/v1/shifts/check-out/` - Check out from shift

### Incidents (Phase 4)
- `POST /api/v1/incidents/` - Create incident report
- `GET /api/v1/incidents/` - Get all incident reports

### Shift Checks (Phase 5)
- `POST /api/v1/shift-checks/` - Submit shift check
- `GET /api/v1/shift-checks/` - Get shift checks

**Note**: Most of these endpoints already exist in the Django backend! We just need to ensure they work with the mobile app.

---

## 🚀 Performance Testing

### Metrics to Monitor
- **App Launch Time**: Should be < 3 seconds
- **Login API Call**: Should be < 2 seconds
- **Screen Transitions**: Should be smooth (60 FPS)
- **Memory Usage**: Should be < 100 MB
- **Battery Impact**: Should be minimal

### Tools for Performance Testing
- **React DevTools**: Monitor component renders
- **Flipper**: Network requests, Redux state
- **Expo DevTools**: Bundle size, performance metrics

---

## 📚 Additional Resources

### Documentation
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Complete setup instructions
- [MOBILE_APP_MASTER_PLAN.md](../docs/mobile-build-knowlege/MOBILE_APP_MASTER_PLAN.md) - 12-week roadmap
- [UI_WIREFRAMES_AND_USER_FLOWS.md](../docs/mobile-build-knowlege/UI_WIREFRAMES_AND_USER_FLOWS.md) - All screen designs
- [TECHNICAL_ARCHITECTURE.md](../docs/mobile-build-knowlege/TECHNICAL_ARCHITECTURE.md) - Technical details

### External Links
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)

---

## 📞 Getting Help

### Common Questions

**Q: Can I test camera features?**
A: Not yet in Expo Go. Camera will work in Phase 3 with EAS Development Build.

**Q: How do I test on multiple devices?**
A: Run `npm start`, scan QR code on each device with Expo Go app.

**Q: Can I test offline features?**
A: Phase 2 will implement offline-first architecture with WatermelonDB.

**Q: How do I debug?**
A: Use `console.log()` - logs appear in the terminal where you ran `npm start`.

---

## ✅ Success!

You now have a **fully functional Login Screen** running! 🎉

The app demonstrates:
- Beautiful Liquid Glass UI design
- Form validation
- API integration with Django backend
- Error handling
- Loading states
- Responsive design

**Next**: Continue with Phase 1 to build the Dashboard and Navigation system!
