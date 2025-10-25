# Security Staff Mobile App - Setup & Development Guide

## Project Status

✅ **Phase 0: Setup & Foundation** - IN PROGRESS (30% complete)
- ✅ Expo project initialized
- ✅ Agent memory system created
- ✅ Project structure created
- ⏳ Dependencies installation (minimal core installed)
- ⏳ Configuration setup

---

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- iOS: Xcode (Mac only) + iOS Simulator
- Android: Android Studio + Android Emulator
- Physical device with Expo Go app (recommended for camera/GPS features)

### Installation

```bash
# Navigate to mobile folder
cd /Users/new/Projects/mead-security/remix2/mobile

# The base Expo app is already initialized
# You'll need to install additional dependencies as we build features

# Start the development server
npm start
```

### Testing the App

1. **Start Django Backend** (Must be running first!)
```bash
cd /Users/new/Projects/mead-security/remix2/backend
python manage.py runserver
```

2. **Start Expo Development Server**
```bash
cd /Users/new/Projects/mead-security/remix2/mobile
npm start
```

3. **Run on Device/Simulator**
- **Physical Device (Recommended)**: Scan QR code with Expo Go app
- **iOS Simulator**: Press `i` in terminal
- **Android Emulator**: Press `a` in terminal

---

## Project Structure

```
mobile/
├── src/
│   ├── app/                    # Main app entry
│   ├── navigation/             # Navigation structure
│   ├── screens/                # Screen components
│   │   ├── auth/              # Login, biometric
│   │   ├── dashboard/         # Main dashboard
│   │   ├── shifts/            # Shift management & check-in
│   │   ├── incidents/         # Incident reporting
│   │   ├── checks/            # Shift checks
│   │   ├── profile/           # Profile & settings
│   │   └── sync/              # Sync queue management
│   ├── components/            # Reusable components
│   │   ├── ui/               # UI primitives
│   │   ├── forms/            # Form components
│   │   ├── shift/            # Shift-specific components
│   │   ├── camera/           # Camera components
│   │   └── common/           # Common components
│   ├── store/                # Redux store
│   │   ├── slices/           # Redux slices
│   │   └── api/              # RTK Query APIs
│   ├── database/             # WatermelonDB (offline storage)
│   │   ├── models/           # Database models
│   │   └── migrations/       # Database migrations
│   ├── services/             # Business logic services
│   ├── hooks/                # Custom React hooks
│   ├── utils/                # Utility functions
│   ├── types/                # TypeScript types
│   └── assets/               # Static assets
│
├── agent_memory/             # Agent coordination (project root)
│   └── mobile_project/
│       ├── orchestrator/     # Project coordination
│       ├── frontend_agents/  # Frontend development agents
│       ├── backend_agents/   # Backend development agents
│       └── shared/           # Shared coordination files
│
├── docs/                     # Documentation (project root)
│   └── mobile-build-knowlege/
│       ├── MOBILE_APP_MASTER_PLAN.md
│       ├── UI_WIREFRAMES_AND_USER_FLOWS.md
│       └── TECHNICAL_ARCHITECTURE.md
│
├── App.tsx                   # Root component
├── package.json              # Dependencies
├── app.json                  # Expo configuration
└── tsconfig.json             # TypeScript configuration
```

---

## Development Workflow

### Phase-by-Phase Implementation

The project is organized into phases (see `/docs/mobile-build-knowlege/MOBILE_APP_MASTER_PLAN.md`):

**Current Phase: Phase 0 - Setup & Foundation**
- ✅ Initialize Expo project
- ✅ Create agent memory system
- ✅ Create project structure
- ⏳ Install dependencies
- ⏳ Configure EAS Build

**Next Phase: Phase 1 - Authentication & Navigation** (Weeks 1-2)
- Set up Redux Toolkit store
- Implement JWT authentication
- Build Login screen
- Implement biometric authentication
- Set up React Navigation
- Build Dashboard screen

**Upcoming Phases:**
- Phase 2: Offline-First Architecture (Weeks 2-3)
- Phase 3: Shift Management & Check-In (Weeks 3-5)
- Phase 4: Incident Reporting (Weeks 5-7)
- Phase 5: Shift Checks & Virtual ID (Weeks 7-9)
- Phase 6: Testing & Optimization (Weeks 9-11)
- Phase 7: Deployment (Weeks 11-12)

### Agent Coordination

Specialized agents work in parallel and coordinate through the agent memory system:

```bash
# Check agent coordination status
cat agent_memory/mobile_project/orchestrator/master_checklist.json

# View pending handoffs between agents
cat agent_memory/mobile_project/shared/handoff_queue.json

# Check for blocked tasks
cat agent_memory/mobile_project/shared/blocked_tasks.json
```

**Active Agents:**
- **orchestrator**: Project coordination
- **react-component-architect**: UI components & screens
- **react-state-manager**: Redux, WatermelonDB, state management
- **performance-optimizer**: Offline sync, photo optimization
- **code-reviewer**: Code quality, security, accessibility

---

## Installing Dependencies

Dependencies are installed incrementally as we build features:

### Phase 1: Navigation & Auth
```bash
npx expo install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
npx expo install @reduxjs/toolkit react-redux redux-persist @react-native-async-storage/async-storage
npx expo install expo-secure-store expo-local-authentication
npx expo install axios jwt-decode
```

### Phase 2: Offline Storage
```bash
npm install @nozbe/watermelondb @nozbe/with-observables
```

### Phase 3: Camera & Location
```bash
npx expo install expo-camera expo-image-picker expo-image-manipulator expo-image
npx expo install expo-location react-native-maps
```

### Phase 4: Voice & Signature
```bash
npm install @react-native-voice/voice react-native-signature-canvas
```

### Phase 5: UI & Animation
```bash
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install react-native-svg expo-linear-gradient
npm install @shopify/flash-list
```

### Development Tools
```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev prettier
```

---

## Testing Strategy

### Development Testing (Fastest Iteration)
```bash
npm start

# Then choose:
# - Scan QR code with Expo Go (recommended)
# - Press 'i' for iOS Simulator
# - Press 'a' for Android Emulator
```

**Features that REQUIRE Physical Device:**
- Camera (check-in photos, incident photos)
- GPS (location verification)
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- Haptic feedback

### Unit Testing
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
```

### Backend Integration Testing
```bash
# 1. Start Django backend
cd ../backend
python manage.py runserver

# 2. Start mobile app
cd ../mobile
npm start

# 3. Test API endpoints from mobile app
# - Login: POST http://localhost:8000/api/v1/auth/login/
# - Shifts: GET http://localhost:8000/api/v1/shifts/
# - Check-in: POST http://localhost:8000/api/v1/shifts/check-in/
```

### Build Testing (EAS Build)
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android

# Create preview build (for testing)
eas build --profile preview --platform all
```

---

## Environment Configuration

### API Endpoints

The mobile app connects to the Django backend:

**Development:**
- Backend: `http://localhost:8000/api/v1/`
- WebSocket: `ws://localhost:8000/ws/`

**Production:**
- Backend: `https://api.yourdomain.com/api/v1/`
- WebSocket: `wss://api.yourdomain.com/ws/`

Configuration is managed in `src/utils/constants.ts` (to be created).

### Expo Configuration (`app.json`)

Key configuration already set:
- App name: "mobile"
- Bundle identifier: (to be configured)
- Permissions: Camera, Location, Notifications, etc. (to be added)

---

## Troubleshooting

### Common Issues

**1. "Command timed out" during npm install**
- This is common with large dependency installations
- Solution: Install dependencies in smaller batches (see "Installing Dependencies" section)

**2. "Cannot find module 'expo'"**
- Solution: Make sure you're in the mobile folder: `cd mobile`
- Reinstall: `npm install`

**3. "Network request failed" in app**
- Make sure Django backend is running: `python manage.py runserver`
- Check API URL is correct (http://localhost:8000 for development)

**4. Camera/GPS not working in Expo Go**
- These features require physical device (not simulator)
- Make sure permissions are granted in device settings

**5. "Metro bundler error"**
- Clear cache: `npx expo start -c`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

---

## Next Steps

1. **Complete Phase 0 Setup**
   - Configure `app.json` with permissions
   - Set up `eas.json` for builds
   - Configure TypeScript (`tsconfig.json`)

2. **Begin Phase 1: Authentication & Navigation**
   - Install navigation dependencies
   - Set up Redux store
   - Create login screen
   - Implement JWT authentication

3. **Agent Coordination**
   - Launch `react-component-architect` for UI development
   - Launch `react-state-manager` for Redux/WatermelonDB setup
   - Agents coordinate through `agent_memory/mobile_project/`

---

## Resources

### Documentation
- [Mobile App Master Plan](/docs/mobile-build-knowlege/MOBILE_APP_MASTER_PLAN.md)
- [UI Wireframes & User Flows](/docs/mobile-build-knowlege/UI_WIREFRAMES_AND_USER_FLOWS.md)
- [Technical Architecture](/docs/mobile-build-knowlege/TECHNICAL_ARCHITECTURE.md)

### External Links
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [WatermelonDB](https://watermelondb.dev/)
- [React Native](https://reactnative.dev/)

---

## Project Health

**Current Status:** ✅ Foundation Ready

**Metrics (from master_checklist.json):**
- Total Tasks: 61
- Completed: 6
- In Progress: 1
- Progress: ~10%

**Active Work:**
- Phase 0: Setup & Foundation (30% complete)
- Next: Install dependencies and begin Phase 1

**Coordination:**
- Agent memory system: ✅ Active
- Orchestrator checklist: ✅ Up to date
- Handoff queue: ✅ Empty (ready for work)
- Blocked tasks: ✅ None

---

## Contact & Support

For issues, questions, or feature requests, refer to the agent memory system for coordination between specialized agents working on this project.
