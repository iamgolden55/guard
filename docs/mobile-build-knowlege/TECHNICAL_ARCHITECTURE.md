# Mobile App Technical Architecture

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Data Layer Architecture](#data-layer-architecture)
5. [State Management](#state-management)
6. [Navigation Architecture](#navigation-architecture)
7. [Authentication & Security](#authentication--security)
8. [Offline-First Architecture](#offline-first-architecture)
9. [Photo & Media Management](#photo--media-management)
10. [Push Notifications](#push-notifications)
11. [Performance Optimization](#performance-optimization)
12. [Testing Architecture](#testing-architecture)
13. [Build & Deployment](#build--deployment)

---

## Architecture Overview

### High-Level Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PRESENTATION LAYER                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  - Liquid Glass UI Components (@expo/ui)             │  │
│  │  - Screen Components (Dashboard, Shifts, etc.)       │  │
│  │  - Navigation (React Navigation v7)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              BUSINESS LOGIC LAYER                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  - Redux Toolkit (State Management)                  │  │
│  │  - RTK Query (API Integration)                       │  │
│  │  - Custom Hooks (Business Logic)                     │  │
│  │  - Utilities (Validation, Formatting, etc.)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              DATA LAYER                              │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  - WatermelonDB (Offline SQLite Storage)             │  │
│  │  - AsyncStorage (App Preferences)                    │  │
│  │  - SecureStore (Sensitive Data)                      │  │
│  │  - FileSystem (Photos, Documents)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↕                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              INTEGRATION LAYER                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  - API Client (Axios with interceptors)              │  │
│  │  - Sync Manager (Queue-based sync)                   │  │
│  │  - Push Notifications (Expo Notifications)           │  │
│  │  - Location Services (expo-location)                 │  │
│  │  - Camera & Media (expo-camera, expo-image-picker)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTPS/REST API
┌─────────────────────────────────────────────────────────────┐
│                  DJANGO BACKEND (Existing)                  │
├─────────────────────────────────────────────────────────────┤
│  - Django REST Framework                                    │
│  - JWT Authentication (SimpleJWT)                           │
│  - PostgreSQL Database                                      │
│  - API Endpoints (/api/v1/...)                              │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles
1. **Offline-First**: App works fully without network connection
2. **Mobile-First**: Optimized for mobile devices, not desktop
3. **Performance-First**: 60 FPS animations, fast load times
4. **Security-First**: JWT tokens, encrypted storage, secure communication
5. **Accessibility-First**: WCAG 2.1 AA compliant throughout

---

## Technology Stack

### Core Framework
```json
{
  "react-native": "0.76.x",
  "expo": "~54.0.0",
  "expo-dev-client": "~5.0.0"
}
```

**Why Expo Managed Workflow?**
- Liquid Glass UI available via `@expo/ui`
- EAS Build/Submit for streamlined deployment
- OTA updates for quick fixes without app store review
- Pre-built modules for camera, location, notifications
- Excellent developer experience with Expo Go

### UI Framework
```json
{
  "@expo/ui": "^1.0.0",
  "react-native-reanimated": "~4.0.0",
  "react-native-gesture-handler": "~2.22.0",
  "react-native-svg": "15.8.0",
  "expo-linear-gradient": "~14.0.0"
}
```

**Liquid Glass UI Components**:
- `GlassView`: Frosted glass containers
- `GlassButton`: Interactive buttons with blur effect
- `GlassCard`: Content cards with elevation
- `GlassModal`: Modal overlays with backdrop blur

### Navigation
```json
{
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/stack": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0",
  "@react-navigation/drawer": "^7.0.0"
}
```

**Navigation Structure**:
- Stack Navigator: Main navigation flow
- Bottom Tabs: Primary navigation (Home, Calendar, Team, Settings)
- Drawer: Side menu for secondary features
- Modal Stack: Overlays for check-in, incident reporting

### State Management
```json
{
  "@reduxjs/toolkit": "^2.5.0",
  "react-redux": "^9.2.0",
  "redux-persist": "^6.0.0"
}
```

**RTK Query for API Integration**:
```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.example.com/api/v1/',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    getShifts: builder.query<Shift[], void>({
      query: () => 'shifts/',
    }),
    checkInShift: builder.mutation<CheckInResponse, CheckInRequest>({
      query: (data) => ({
        url: 'shifts/check-in/',
        method: 'POST',
        body: data,
      }),
    }),
  }),
});
```

### Offline Storage
```json
{
  "@nozbe/watermelondb": "^0.27.0",
  "@react-native-async-storage/async-storage": "^2.1.0",
  "expo-secure-store": "~14.0.0",
  "expo-file-system": "~18.0.0"
}
```

**WatermelonDB Schema**:
```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'shifts',
      columns: [
        { name: 'shift_id', type: 'number', isIndexed: true },
        { name: 'venue_id', type: 'number', isIndexed: true },
        { name: 'staff_id', type: 'number', isIndexed: true },
        { name: 'start_time', type: 'number' },
        { name: 'end_time', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'check_in_photo', type: 'string', isOptional: true },
        { name: 'check_out_photo', type: 'string', isOptional: true },
        { name: 'signature', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'venues',
      columns: [
        { name: 'venue_id', type: 'number', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'address', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'capacity', type: 'number' },
        { name: 'terms_version', type: 'string' },
        { name: 'terms_content', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'incidents',
      columns: [
        { name: 'incident_id', type: 'string', isIndexed: true },
        { name: 'shift_id', type: 'number', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'severity', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'transcription', type: 'string', isOptional: true },
        { name: 'photos', type: 'string', isOptional: true }, // JSON array
        { name: 'people_involved', type: 'string', isOptional: true }, // JSON array
        { name: 'police_involved', type: 'boolean' },
        { name: 'ambulance_called', type: 'boolean' },
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'shift_checks',
      columns: [
        { name: 'check_id', type: 'string', isIndexed: true },
        { name: 'shift_id', type: 'number', isIndexed: true },
        { name: 'check_type', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'photo', type: 'string', isOptional: true },
        { name: 'metadata', type: 'string', isOptional: true }, // JSON
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'action_id', type: 'string', isIndexed: true },
        { name: 'action_type', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON
        { name: 'priority', type: 'number' },
        { name: 'retries', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
```

### Camera & Media
```json
{
  "expo-camera": "~16.0.0",
  "expo-image-picker": "~16.0.0",
  "expo-image-manipulator": "~13.0.0",
  "expo-media-library": "~17.0.0"
}
```

### Location Services
```json
{
  "expo-location": "~18.0.0",
  "react-native-maps": "1.18.0"
}
```

### Notifications
```json
{
  "expo-notifications": "~0.29.0",
  "@react-native-firebase/messaging": "^21.8.0"
}
```

### Authentication & Security
```json
{
  "expo-local-authentication": "~15.0.0",
  "expo-secure-store": "~14.0.0",
  "jwt-decode": "^4.0.0",
  "react-native-keychain": "^8.2.0"
}
```

### Utilities
```json
{
  "axios": "^1.7.0",
  "date-fns": "^4.1.0",
  "react-hook-form": "^7.54.0",
  "zod": "^3.24.0",
  "uuid": "^11.0.0",
  "lodash": "^4.17.21"
}
```

### Development Tools
```json
{
  "typescript": "~5.7.2",
  "@types/react": "~18.3.12",
  "@types/react-native": "^0.73.0",
  "eslint": "^9.17.0",
  "prettier": "^3.4.2",
  "jest": "^29.7.0",
  "@testing-library/react-native": "^12.9.0",
  "detox": "^20.28.3"
}
```

---

## Project Structure

```
security-staff-mobile/
├── app.json                    # Expo configuration
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── eas.json                    # EAS Build configuration
│
├── src/
│   ├── app/                    # Main app entry
│   │   ├── App.tsx             # Root component
│   │   ├── index.tsx           # App entry point
│   │   └── theme.ts            # Liquid Glass theme config
│   │
│   ├── navigation/             # Navigation structure
│   │   ├── AppNavigator.tsx    # Root navigator
│   │   ├── AuthNavigator.tsx   # Auth flow
│   │   ├── MainNavigator.tsx   # Main app flow
│   │   ├── TabNavigator.tsx    # Bottom tabs
│   │   └── types.ts            # Navigation types
│   │
│   ├── screens/                # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── BiometricScreen.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardScreen.tsx
│   │   │   └── components/
│   │   ├── shifts/
│   │   │   ├── ShiftDetailsScreen.tsx
│   │   │   ├── CalendarScreen.tsx
│   │   │   └── CheckInFlow/
│   │   │       ├── LocationVerificationScreen.tsx
│   │   │       ├── PhotoCaptureScreen.tsx
│   │   │       ├── SignatureScreen.tsx
│   │   │       └── TermsAcceptanceScreen.tsx
│   │   ├── incidents/
│   │   │   ├── IncidentReportScreen.tsx
│   │   │   ├── VoiceReportScreen.tsx
│   │   │   └── QuickReportScreen.tsx
│   │   ├── checks/
│   │   │   ├── ShiftChecksScreen.tsx
│   │   │   ├── FireExitCheckScreen.tsx
│   │   │   ├── CapacityCheckScreen.tsx
│   │   │   └── ToiletCheckScreen.tsx
│   │   ├── profile/
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── VirtualIDScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── sync/
│   │       └── SyncQueueScreen.tsx
│   │
│   ├── components/             # Reusable components
│   │   ├── ui/                 # UI primitives
│   │   │   ├── GlassCard.tsx
│   │   │   ├── GlassButton.tsx
│   │   │   ├── GlassInput.tsx
│   │   │   ├── GlassModal.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── forms/
│   │   │   ├── FormField.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   └── RadioGroup.tsx
│   │   ├── shift/
│   │   │   ├── ActiveShiftCard.tsx
│   │   │   ├── UpcomingShiftCard.tsx
│   │   │   └── ShiftCheckItem.tsx
│   │   ├── camera/
│   │   │   ├── CameraView.tsx
│   │   │   └── PhotoPreview.tsx
│   │   └── common/
│   │       ├── NetworkStatusBanner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── store/                  # Redux store
│   │   ├── index.ts            # Store configuration
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── shiftsSlice.ts
│   │   │   ├── incidentsSlice.ts
│   │   │   ├── checksSlice.ts
│   │   │   └── syncSlice.ts
│   │   └── api/
│   │       ├── baseApi.ts      # RTK Query base API
│   │       ├── shiftsApi.ts
│   │       ├── incidentsApi.ts
│   │       ├── checksApi.ts
│   │       └── authApi.ts
│   │
│   ├── database/               # WatermelonDB
│   │   ├── index.ts            # Database instance
│   │   ├── schema.ts           # Schema definition
│   │   ├── models/
│   │   │   ├── Shift.ts
│   │   │   ├── Venue.ts
│   │   │   ├── Incident.ts
│   │   │   ├── ShiftCheck.ts
│   │   │   └── SyncQueue.ts
│   │   └── migrations/
│   │       └── index.ts
│   │
│   ├── services/               # Business logic services
│   │   ├── authService.ts      # Authentication logic
│   │   ├── syncService.ts      # Sync queue management
│   │   ├── locationService.ts  # GPS verification
│   │   ├── cameraService.ts    # Photo capture/optimization
│   │   ├── notificationService.ts
│   │   └── storageService.ts
│   │
│   ├── hooks/                  # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useLocation.ts
│   │   ├── useCamera.ts
│   │   ├── useSync.ts
│   │   ├── useNetworkStatus.ts
│   │   └── useHaptics.ts
│   │
│   ├── utils/                  # Utility functions
│   │   ├── validation.ts       # Form validation (Zod schemas)
│   │   ├── formatting.ts       # Date, currency formatting
│   │   ├── constants.ts        # App constants
│   │   ├── permissions.ts      # Permission helpers
│   │   └── helpers.ts          # General helpers
│   │
│   ├── types/                  # TypeScript types
│   │   ├── shift.ts
│   │   ├── incident.ts
│   │   ├── check.ts
│   │   ├── user.ts
│   │   └── api.ts
│   │
│   └── assets/                 # Static assets
│       ├── images/
│       ├── fonts/
│       └── icons/
│
├── __tests__/                  # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── docs/                       # Documentation
    ├── API.md
    ├── SETUP.md
    └── TROUBLESHOOTING.md
```

---

## Data Layer Architecture

### Storage Strategy
```
┌─────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  WatermelonDB (SQLite)              Use Case            │
│  ├─ Shifts                          ├─ Core app data   │
│  ├─ Venues                          ├─ Offline access  │
│  ├─ Incidents                       ├─ Complex queries │
│  ├─ Shift Checks                    └─ Relationships   │
│  └─ Sync Queue                                          │
│                                                         │
│  AsyncStorage                       Use Case            │
│  ├─ App preferences                 ├─ Simple key-value│
│  ├─ Theme settings                  ├─ Non-sensitive   │
│  ├─ Language                        └─ App state       │
│  └─ Last sync timestamp                                │
│                                                         │
│  SecureStore (Keychain/Keystore)    Use Case            │
│  ├─ JWT access token                ├─ Credentials     │
│  ├─ JWT refresh token               ├─ Sensitive data  │
│  ├─ Biometric auth key              └─ Encryption keys │
│  └─ User PIN                                           │
│                                                         │
│  FileSystem                         Use Case            │
│  ├─ Check-in photos                 ├─ Large files     │
│  ├─ Incident photos/videos          ├─ Media content   │
│  ├─ Signatures                      └─ Temp files      │
│  └─ PDF documents                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Database Models (WatermelonDB)

#### Shift Model
```typescript
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export class Shift extends Model {
  static table = 'shifts';
  static associations = {
    venues: { type: 'belongs_to', key: 'venue_id' },
    incidents: { type: 'has_many', foreignKey: 'shift_id' },
    shift_checks: { type: 'has_many', foreignKey: 'shift_id' },
  };

  @field('shift_id') shiftId!: number;
  @field('venue_id') venueId!: number;
  @field('staff_id') staffId!: number;
  @date('start_time') startTime!: Date;
  @date('end_time') endTime?: Date;
  @field('status') status!: 'scheduled' | 'active' | 'completed' | 'cancelled';
  @field('check_in_photo') checkInPhoto?: string;
  @field('check_out_photo') checkOutPhoto?: string;
  @field('signature') signature?: string;
  @field('sync_status') syncStatus!: 'synced' | 'pending' | 'failed';
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('venues', 'venue_id') venue: Relation<Venue>;
  @children('incidents') incidents: Query<Incident>;
  @children('shift_checks') checks: Query<ShiftCheck>;
}
```

#### Incident Model
```typescript
export class Incident extends Model {
  static table = 'incidents';
  static associations = {
    shifts: { type: 'belongs_to', key: 'shift_id' },
  };

  @field('incident_id') incidentId!: string;
  @field('shift_id') shiftId!: number;
  @field('type') type!: string;
  @field('severity') severity!: 'minor' | 'moderate' | 'critical';
  @field('description') description!: string;
  @field('transcription') transcription?: string;
  @field('photos') photosJson?: string;
  @field('people_involved') peopleInvolvedJson?: string;
  @field('police_involved') policeInvolved!: boolean;
  @field('ambulance_called') ambulanceCalled!: boolean;
  @field('sync_status') syncStatus!: 'synced' | 'pending' | 'failed';
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('shifts', 'shift_id') shift: Relation<Shift>;

  get photos(): string[] {
    return this.photosJson ? JSON.parse(this.photosJson) : [];
  }

  get peopleInvolved(): string[] {
    return this.peopleInvolvedJson ? JSON.parse(this.peopleInvolvedJson) : [];
  }
}
```

### Data Synchronization Flow
```
┌─────────────────────────────────────────────────────────┐
│                  SYNC ARCHITECTURE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Action (e.g., Check-In)                          │
│         ↓                                              │
│  1. Save to WatermelonDB                               │
│         ├─ Status: "pending"                           │
│         └─ Generate local ID (UUID)                    │
│         ↓                                              │
│  2. Add to Sync Queue                                  │
│         ├─ Action type: "check_in"                     │
│         ├─ Payload: { shift_id, photo, signature }    │
│         ├─ Priority: 1 (high)                          │
│         └─ Retries: 0                                  │
│         ↓                                              │
│  3. Network Check                                      │
│         ├─ Online?                                     │
│         │   ├─ Yes → Start sync immediately           │
│         │   └─ No → Queue for later                   │
│         └─ Network listener active                    │
│         ↓                                              │
│  4. Sync Process (Online)                              │
│         ├─ Get highest priority items                 │
│         ├─ Upload photos first                        │
│         ├─ Send API request                           │
│         └─ Handle response                            │
│         ↓                                              │
│  5. Update Local Data                                  │
│         ├─ Success?                                    │
│         │   ├─ Yes → Update sync_status: "synced"     │
│         │   │        Remove from queue                │
│         │   │        Update local record with server ID│
│         │   └─ No  → Increment retries                │
│         │            Apply exponential backoff        │
│         │            Max retries: 5                    │
│         └─ After 5 failures → Mark as "failed"        │
│                  Show user notification                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Sync Queue Manager Implementation
```typescript
import { database } from '@/database';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

interface QueuedAction {
  id: string;
  type: 'check_in' | 'check_out' | 'incident' | 'shift_check';
  payload: any;
  priority: number;
  retries: number;
  createdAt: Date;
}

class SyncManager {
  private isSyncing = false;
  private isOnline = false;
  private maxRetries = 5;
  private retryDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

  constructor() {
    this.initializeNetworkListener();
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        console.log('Back online, starting sync...');
        this.startSync();
      }
    });
  }

  async addToQueue(action: Omit<QueuedAction, 'id' | 'retries' | 'createdAt'>) {
    const queuedAction: QueuedAction = {
      ...action,
      id: uuid.v4(),
      retries: 0,
      createdAt: new Date(),
    };

    await database.write(async () => {
      await database.get('sync_queue').create((record) => {
        record.action_id = queuedAction.id;
        record.action_type = queuedAction.type;
        record.payload = JSON.stringify(queuedAction.payload);
        record.priority = queuedAction.priority;
        record.retries = 0;
        record.created_at = Date.now();
      });
    });

    if (this.isOnline) {
      this.startSync();
    }
  }

  async startSync() {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;

    try {
      const queueItems = await database
        .get('sync_queue')
        .query()
        .fetch();

      // Sort by priority (1 = highest) then by created_at
      const sortedItems = queueItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.created_at - b.created_at;
      });

      for (const item of sortedItems) {
        await this.processQueueItem(item);
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async processQueueItem(item: any) {
    try {
      const payload = JSON.parse(item.payload);

      // Upload photos first if present
      if (payload.photo) {
        const photoUrl = await this.uploadPhoto(payload.photo);
        payload.photo = photoUrl;
      }

      // Make API request based on action type
      let response;
      switch (item.action_type) {
        case 'check_in':
          response = await api.post('/shifts/check-in/', payload);
          break;
        case 'check_out':
          response = await api.post('/shifts/check-out/', payload);
          break;
        case 'incident':
          response = await api.post('/incidents/', payload);
          break;
        case 'shift_check':
          response = await api.post('/shift-checks/', payload);
          break;
      }

      // Success - remove from queue and update local record
      await this.onSyncSuccess(item, response.data);
    } catch (error) {
      // Failed - increment retries or mark as failed
      await this.onSyncFailure(item, error);
    }
  }

  private async uploadPhoto(localUri: string): Promise<string> {
    const formData = new FormData();
    formData.append('photo', {
      uri: localUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);

    const response = await api.post('/media/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.url;
  }

  private async onSyncSuccess(item: any, serverResponse: any) {
    await database.write(async () => {
      // Update local record with server ID
      const localRecord = await this.getLocalRecord(item.action_type, item.payload);
      if (localRecord) {
        await localRecord.update((record) => {
          record.sync_status = 'synced';
          if (serverResponse.id) {
            record[`${item.action_type}_id`] = serverResponse.id;
          }
        });
      }

      // Remove from queue
      await item.destroyPermanently();
    });
  }

  private async onSyncFailure(item: any, error: any) {
    const newRetries = item.retries + 1;

    if (newRetries >= this.maxRetries) {
      // Max retries reached - mark as failed
      await database.write(async () => {
        await item.update((record) => {
          record.last_error = error.message;
        });

        const localRecord = await this.getLocalRecord(item.action_type, item.payload);
        if (localRecord) {
          await localRecord.update((record) => {
            record.sync_status = 'failed';
          });
        }
      });

      // Notify user
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sync Failed',
          body: `Failed to sync ${item.action_type}. Please try again later.`,
        },
        trigger: null,
      });
    } else {
      // Schedule retry with exponential backoff
      await database.write(async () => {
        await item.update((record) => {
          record.retries = newRetries;
          record.last_error = error.message;
        });
      });

      const delay = this.retryDelays[newRetries - 1] || 30000;
      setTimeout(() => {
        this.startSync();
      }, delay);
    }
  }

  private async getLocalRecord(actionType: string, payload: any) {
    switch (actionType) {
      case 'check_in':
      case 'check_out':
        return await database.get('shifts').find(payload.shift_id);
      case 'incident':
        return await database.get('incidents').find(payload.incident_id);
      case 'shift_check':
        return await database.get('shift_checks').find(payload.check_id);
    }
  }
}

export const syncManager = new SyncManager();
```

---

## State Management

### Redux Store Structure
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './api/baseApi';
import authReducer from './slices/authSlice';
import shiftsReducer from './slices/shiftsSlice';
import syncReducer from './slices/syncSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth'], // Only persist auth state
};

const persistedAuthReducer = persistReducer(persistConfig, authReducer);

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: persistedAuthReducer,
    shifts: shiftsReducer,
    sync: syncReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware),
});

setupListeners(store.dispatch);

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Auth Slice
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    setTokens: async (state, action: PayloadAction<{ access: string; refresh: string }>) => {
      await SecureStore.setItemAsync('access_token', action.payload.access);
      await SecureStore.setItemAsync('refresh_token', action.payload.refresh);
    },
    logout: async (state) => {
      state.user = null;
      state.isAuthenticated = false;
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setUser, setTokens, logout, setLoading } = authSlice.actions;
export default authSlice.reducer;
```

---

## Navigation Architecture

### Navigation Flow
```
┌─────────────────────────────────────────────────────────┐
│                 APP NAVIGATOR (Root)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  isAuthenticated?                                       │
│    ├─ No  → AUTH STACK                                 │
│    │        ├─ Login Screen                            │
│    │        └─ Biometric Screen                        │
│    │                                                    │
│    └─ Yes → MAIN STACK                                 │
│             ├─ TAB NAVIGATOR (Bottom Tabs)             │
│             │   ├─ Home Tab → Dashboard                │
│             │   ├─ Calendar Tab → Shifts Calendar      │
│             │   ├─ Team Tab → Team Communication       │
│             │   └─ Settings Tab → Profile & Settings   │
│             │                                           │
│             ├─ MODAL STACK (Overlays)                  │
│             │   ├─ Check-In Flow (Modal)               │
│             │   │   ├─ Location Verification           │
│             │   │   ├─ Photo Capture                   │
│             │   │   ├─ Signature                       │
│             │   │   └─ Terms Acceptance                │
│             │   │                                       │
│             │   ├─ Incident Report (Modal)             │
│             │   │   ├─ Voice Report                    │
│             │   │   ├─ Quick Report                    │
│             │   │   └─ Detailed Form                   │
│             │   │                                       │
│             │   └─ Shift Checks (Modal)                │
│             │       ├─ Fire Exit Check                 │
│             │       ├─ Capacity Check                  │
│             │       └─ Toilet Check                    │
│             │                                           │
│             └─ DRAWER NAVIGATOR (Side Menu)            │
│                 ├─ Dashboard                           │
│                 ├─ My Shifts                           │
│                 ├─ Incident Reports                    │
│                 ├─ Shift Checks History                │
│                 ├─ Training & Docs                     │
│                 ├─ Virtual ID                          │
│                 ├─ Invoices                            │
│                 ├─ Settings                            │
│                 └─ Logout                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Navigation Implementation
```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// Tab Navigator (Bottom Navigation)
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{
          tabBarIcon: ({ color, size }) => <TeamIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Main Navigator (With Drawer)
function MainNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerType: 'slide',
        drawerStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="Main" component={TabNavigator} />
    </Drawer.Navigator>
  );
}

// App Navigator (Root)
export function AppNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="CheckInFlow" component={CheckInFlowNavigator} />
            <Stack.Screen name="IncidentReport" component={IncidentReportNavigator} />
            <Stack.Screen name="ShiftCheck" component={ShiftCheckScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Authentication & Security

### JWT Authentication Flow
```
┌─────────────────────────────────────────────────────────┐
│              AUTHENTICATION FLOW                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Login Request                                      │
│     POST /api/v1/auth/login/                           │
│     { email, password }                                │
│         ↓                                              │
│  2. Server Response                                    │
│     {                                                  │
│       access: "eyJhbGciOiJIUzI1NiIs...",              │
│       refresh: "eyJhbGciOiJIUzI1NiIs...",             │
│       user: { id, email, role, ... }                  │
│     }                                                  │
│         ↓                                              │
│  3. Store Tokens Securely                              │
│     SecureStore.setItemAsync('access_token', access)   │
│     SecureStore.setItemAsync('refresh_token', refresh) │
│         ↓                                              │
│  4. Store User in Redux                                │
│     dispatch(setUser(user))                            │
│     dispatch(setTokens({ access, refresh }))           │
│         ↓                                              │
│  5. Navigate to Dashboard                              │
│     navigation.replace('Main')                         │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  API Request with Token                                │
│     GET /api/v1/shifts/                                │
│     Headers: {                                         │
│       Authorization: "Bearer eyJhbGciOiJIUzI1NiIs..."  │
│     }                                                  │
│         ↓                                              │
│  Token Expired? (401 Unauthorized)                     │
│     ├─ Yes → Refresh Token Flow                       │
│     │         POST /api/v1/auth/refresh/              │
│     │         { refresh: "eyJhbGciOiJIUzI1NiIs..." }  │
│     │         ↓                                        │
│     │         Get new access token                    │
│     │         Store new access token                  │
│     │         Retry original request                  │
│     │                                                  │
│     └─ No → Return response                           │
│                                                         │
│  Refresh Token Expired? (401 Unauthorized)             │
│     ├─ Yes → Logout user                              │
│     │         Clear all tokens                        │
│     │         Navigate to Login                       │
│     │                                                  │
│     └─ No → Continue                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Axios Interceptors
```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { store } from '@/store';
import { logout } from '@/store/slices/authSlice';

const api = axios.create({
  baseURL: 'https://api.example.com/api/v1/',
  timeout: 10000,
});

// Request interceptor - Add access token to headers
api.interceptors.request.use(
  async (config) => {
    const accessToken = await SecureStore.getItemAsync('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Request new access token
        const response = await axios.post(
          'https://api.example.com/api/v1/auth/refresh/',
          { refresh: refreshToken }
        );

        const { access } = response.data;

        // Store new access token
        await SecureStore.setItemAsync('access_token', access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token expired - logout user
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### Biometric Authentication
```typescript
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const useBiometric = () => {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    setIsBiometricSupported(compatible && enrolled);

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      setBiometricType('Face ID');
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      setBiometricType('Touch ID / Fingerprint');
    }
  };

  const authenticate = async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Retrieve stored credentials
        const email = await SecureStore.getItemAsync('biometric_email');
        const token = await SecureStore.getItemAsync('biometric_token');

        if (email && token) {
          // Auto-login using stored credentials
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  };

  const enableBiometric = async (email: string, refreshToken: string) => {
    await SecureStore.setItemAsync('biometric_email', email);
    await SecureStore.setItemAsync('biometric_token', refreshToken);
    await AsyncStorage.setItem('biometric_enabled', 'true');
  };

  const disableBiometric = async () => {
    await SecureStore.deleteItemAsync('biometric_email');
    await SecureStore.deleteItemAsync('biometric_token');
    await AsyncStorage.removeItem('biometric_enabled');
  };

  return {
    isBiometricSupported,
    biometricType,
    authenticate,
    enableBiometric,
    disableBiometric,
  };
};
```

---

## Offline-First Architecture

### Offline Strategy Summary
```
1. All core features work offline
2. Data saved locally in WatermelonDB
3. Actions queued for sync when online
4. Optimistic UI updates (instant feedback)
5. Background sync when network returns
6. Conflict resolution (server wins)
```

### Offline Check-In Flow Example
```typescript
export const useCheckIn = () => {
  const dispatch = useAppDispatch();
  const { isOnline } = useNetworkStatus();

  const checkIn = async (shiftId: number, photo: string, signature: string) => {
    try {
      // 1. Save locally to WatermelonDB (works offline)
      const shift = await database.write(async () => {
        const shiftRecord = await database.get('shifts').find(shiftId);
        await shiftRecord.update((shift) => {
          shift.status = 'active';
          shift.check_in_photo = photo;
          shift.signature = signature;
          shift.start_time = Date.now();
          shift.sync_status = isOnline ? 'pending' : 'pending';
        });
        return shiftRecord;
      });

      // 2. Optimistic UI update (show success immediately)
      dispatch(shiftCheckedIn({ shiftId, status: 'active' }));

      // 3. Add to sync queue
      await syncManager.addToQueue({
        type: 'check_in',
        payload: {
          shift_id: shiftId,
          photo,
          signature,
          timestamp: Date.now(),
        },
        priority: 1, // High priority
      });

      // 4. If online, trigger sync immediately
      if (isOnline) {
        syncManager.startSync();
      }

      return { success: true, shift };
    } catch (error) {
      console.error('Check-in failed:', error);
      return { success: false, error };
    }
  };

  return { checkIn };
};
```

---

## Photo & Media Management

### Photo Optimization Pipeline
```typescript
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export const optimizePhoto = async (uri: string): Promise<{ uri: string; size: number }> => {
  try {
    // 1. Get original file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const originalSize = fileInfo.size || 0;

    console.log(`Original photo size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // 2. Resize to max width 1920px
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 3. Check compressed size
    const compressedInfo = await FileSystem.getInfoAsync(manipulated.uri);
    const compressedSize = compressedInfo.size || 0;

    console.log(`Compressed photo size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);

    // 4. Generate thumbnail (for list views)
    const thumbnail = await ImageManipulator.manipulateAsync(
      manipulated.uri,
      [{ resize: { width: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 5. Save to app directory
    const photoDir = `${FileSystem.documentDirectory}photos/`;
    await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });

    const timestamp = Date.now();
    const photoPath = `${photoDir}${timestamp}_full.jpg`;
    const thumbnailPath = `${photoDir}${timestamp}_thumb.jpg`;

    await FileSystem.copyAsync({
      from: manipulated.uri,
      to: photoPath,
    });

    await FileSystem.copyAsync({
      from: thumbnail.uri,
      to: thumbnailPath,
    });

    return {
      uri: photoPath,
      thumbnail: thumbnailPath,
      size: compressedSize,
      originalSize,
    };
  } catch (error) {
    console.error('Photo optimization failed:', error);
    throw error;
  }
};
```

### Photo Upload Queue
```typescript
export const queuePhotoUpload = async (photoPath: string, metadata: any) => {
  const uploadId = uuid.v4();

  await database.write(async () => {
    await database.get('sync_queue').create((record) => {
      record.action_id = uploadId;
      record.action_type = 'photo_upload';
      record.payload = JSON.stringify({
        photo_path: photoPath,
        metadata,
      });
      record.priority = 2; // Medium priority (after critical actions)
      record.retries = 0;
      record.created_at = Date.now();
    });
  });

  syncManager.startSync();
};
```

---

## Push Notifications

### Notification Setup
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async (): Promise<string | null> => {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push notification permission!');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
};
```

### Notification Triggers
```typescript
// Shift check reminder
export const scheduleShiftCheckReminder = async (
  checkType: string,
  dueTime: number
) => {
  const trigger = new Date(dueTime - 10 * 60 * 1000); // 10 minutes before due

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Shift Check Due',
      body: `${checkType} is due in 10 minutes`,
      data: { checkType, dueTime },
    },
    trigger,
  });
};

// Sync failure notification
export const notifySyncFailure = async (actionType: string) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sync Failed',
      body: `Failed to sync ${actionType}. Please check your connection.`,
      data: { actionType },
    },
    trigger: null, // Immediate
  });
};
```

---

## Performance Optimization

### React Native Reanimated for 60 FPS Animations
```typescript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const AnimatedGlassCard = ({ children, onPress }: Props) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    opacity.value = withTiming(0.8);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withTiming(1);
  };

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};
```

### Image Caching & Optimization
```typescript
import { Image } from 'expo-image';

export const OptimizedImage = ({ source, ...props }: ImageProps) => {
  return (
    <Image
      source={source}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk" // Cache in memory and disk
      {...props}
    />
  );
};
```

### List Rendering Optimization
```typescript
import { FlashList } from '@shopify/flash-list';

export const ShiftsList = ({ shifts }: Props) => {
  const renderItem = useCallback(({ item }: { item: Shift }) => (
    <ShiftCard shift={item} />
  ), []);

  const keyExtractor = useCallback((item: Shift) => item.id.toString(), []);

  return (
    <FlashList
      data={shifts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={120}
      // 50x faster than FlatList for large lists
    />
  );
};
```

---

## Testing Architecture

### Testing Stack
```json
{
  "jest": "^29.7.0",
  "@testing-library/react-native": "^12.9.0",
  "@testing-library/jest-native": "^5.4.3",
  "detox": "^20.28.3"
}
```

### Unit Testing Example
```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CheckInButton } from '@/components/shift/CheckInButton';

describe('CheckInButton', () => {
  it('should trigger check-in flow when pressed', async () => {
    const mockCheckIn = jest.fn();
    const { getByText } = render(<CheckInButton onCheckIn={mockCheckIn} />);

    const button = getByText('Check In');
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockCheckIn).toHaveBeenCalled();
    });
  });

  it('should be disabled when shift is already active', () => {
    const { getByText } = render(
      <CheckInButton shiftStatus="active" onCheckIn={() => {}} />
    );

    const button = getByText('Check In');
    expect(button).toBeDisabled();
  });
});
```

### E2E Testing with Detox
```typescript
describe('Check-In Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should complete full check-in flow', async () => {
    // Login
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    // Wait for dashboard
    await waitFor(element(by.id('dashboard')))
      .toBeVisible()
      .withTimeout(5000);

    // Start check-in
    await element(by.id('check-in-button')).tap();

    // Location verification
    await waitFor(element(by.id('location-verified')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('continue-button')).tap();

    // Photo capture
    await element(by.id('camera-capture')).tap();
    await element(by.id('photo-confirm')).tap();

    // Signature
    // (Detox doesn't support drawing gestures well - skip or mock)
    await element(by.id('signature-skip')).tap();

    // Terms acceptance
    await element(by.id('terms-checkbox')).tap();
    await element(by.id('accept-button')).tap();

    // Verify success
    await waitFor(element(by.id('check-in-success')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

## Build & Deployment

### EAS Build Configuration (`eas.json`)
```json
{
  "cli": {
    "version": ">= 13.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Build Commands
```bash
# Development build (with Expo Go features)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build (for internal testing)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to App Store / Play Store
eas submit --platform ios
eas submit --platform android
```

### Over-The-Air (OTA) Updates
```bash
# Publish OTA update to production
eas update --branch production --message "Bug fixes and performance improvements"

# Publish to preview channel
eas update --branch preview --message "Testing new feature"
```

---

## Summary

This technical architecture provides:

✅ **Complete Technology Stack**: All dependencies with versions
✅ **Detailed Project Structure**: Clear organization of files and folders
✅ **Offline-First Architecture**: WatermelonDB + Sync Queue implementation
✅ **State Management**: Redux Toolkit + RTK Query configuration
✅ **Navigation Structure**: React Navigation with tabs, stack, and drawer
✅ **Authentication & Security**: JWT + Biometric + Secure storage
✅ **Photo Management**: Optimization pipeline with compression
✅ **Push Notifications**: Expo Notifications setup
✅ **Performance Optimization**: Reanimated, image caching, list rendering
✅ **Testing Strategy**: Unit, integration, and E2E testing setup
✅ **Build & Deployment**: EAS Build configuration and OTA updates

**Next Documentation Tasks**:
1. ✅ UI Wireframes & User Flows (COMPLETED)
2. ✅ Technical Architecture (COMPLETED)
3. ⏳ Accessibility Implementation Guide
4. ⏳ API Integration Specification
5. ⏳ Testing Strategy with Test Cases

This architecture ensures a scalable, performant, and maintainable mobile app that works seamlessly offline and provides an excellent user experience.
