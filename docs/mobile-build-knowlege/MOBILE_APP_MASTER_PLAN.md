# Security Staff Management System - Mobile App Development Master Plan

**Version**: 1.0
**Last Updated**: 2025-10-10
**Status**: Approved - Ready for Implementation
**Estimated Timeline**: 14 weeks (Q1-Q2 2025)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [App Architecture](#app-architecture)
4. [Feature Specifications](#feature-specifications)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Scalability Architecture](#scalability-architecture)
7. [Implementation Phases](#implementation-phases)
8. [Success Metrics](#success-metrics)
9. [Deployment Strategy](#deployment-strategy)

---

## Executive Summary

### Project Goal
Build a **production-ready React Native mobile application** for security staff that provides essential on-the-go functionality while keeping complex admin operations on the web platform.

### Key Objectives
- ✅ **Staff-Centric Design**: Focus on daily operational needs
- ✅ **Accessibility-First**: WCAG 2.1 AA compliant
- ✅ **Offline-First**: Full functionality without network
- ✅ **Modern UI**: Liquid Glass design language (Apple iOS 26)
- ✅ **Scalable Architecture**: Support 10,000+ concurrent users

### Target Users
- **Primary**: Security Staff (on-shift operations)
- **Secondary**: Managers (approvals, team overview)
- **Excluded**: Admin users (use web platform)

---

## Technology Stack

### Frontend Framework
**Choice**: Expo Managed Workflow (React Native)

**Justification**:
- ✅ Liquid Glass UI support via @expo/ui (iOS 26 native)
- ✅ Production-ready in 2025 with full native module support
- ✅ EAS Build & Deploy for streamlined CI/CD
- ✅ OTA updates for quick fixes
- ✅ Excellent developer experience
- ✅ Works seamlessly with existing Django REST API

### Core Libraries

#### UI & Styling
```json
{
  "@expo/ui": "^0.2.0",                    // Liquid Glass components
  "react-native-elements": "^4.0.0",       // Additional UI components
  "nativewind": "^4.0.1",                  // Tailwind CSS for React Native
  "@react-navigation/native": "^7.0.0",    // Navigation
  "@react-navigation/bottom-tabs": "^7.0.0",
  "@react-navigation/stack": "^7.0.0"
}
```

#### State Management
```json
{
  "@reduxjs/toolkit": "^2.0.0",           // State management
  "react-redux": "^9.0.0",
  "@tanstack/react-query": "^5.0.0"       // Server state caching
}
```

#### Animations & Gestures
```json
{
  "react-native-reanimated": "^4.0.0",    // High-performance animations
  "react-native-gesture-handler": "^2.14.0"
}
```

#### Camera & Media
```json
{
  "expo-camera": "~15.0.0",               // Camera access
  "expo-image-picker": "~15.0.0",         // Photo library
  "expo-media-library": "~16.0.0",        // Photo storage
  "react-native-signature-canvas": "^4.7.0" // Digital signatures
}
```

#### Location & Maps
```json
{
  "expo-location": "~17.0.0",             // GPS location
  "react-native-maps": "1.14.0"           // Map display
}
```

#### Offline & Storage
```json
{
  "@nozbe/watermelondb": "^0.27.0",       // Local database
  "expo-secure-store": "~13.0.0",         // Secure token storage
  "expo-file-system": "~17.0.0"           // File management
}
```

#### Voice & Accessibility
```json
{
  "expo-speech": "~12.0.0",               // Text-to-speech
  "@react-native-voice/voice": "^3.2.0"   // Speech-to-text
}
```

#### Notifications
```json
{
  "expo-notifications": "~0.28.0",        // Push notifications
  "@react-native-firebase/messaging": "^20.0.0" // FCM
}
```

---

## App Architecture

### Navigation Structure

```
Root Stack Navigator
│
├── Auth Stack (Unauthenticated)
│   ├── Login Screen
│   ├── Forgot Password
│   └── Onboarding Wizard
│
└── Main Stack (Authenticated)
    │
    ├── Bottom Tab Navigator
    │   ├── 🏠 Dashboard Tab
    │   ├── 🕐 My Shifts Tab
    │   ├── 👤 Profile Tab
    │   └── ⚙️ Settings Tab
    │
    └── Modal Stack
        ├── Check-In Flow
        │   ├── Location Verification
        │   ├── Photo Capture
        │   └── Signature Capture
        │
        ├── Incident Report
        │   ├── Quick Report
        │   ├── Detailed Form
        │   └── Photo Evidence
        │
        ├── Shift Checks
        │   ├── Fire Exit Check
        │   ├── Capacity Check
        │   └── Toilet Check
        │
        └── Leave Request
            ├── Request Form
            └── Calendar Picker
```

### State Management Architecture

```typescript
// Redux Store Structure
{
  auth: {
    user: User | null,
    token: string | null,
    refreshToken: string | null,
    isAuthenticated: boolean,
    permissions: string[]
  },

  shifts: {
    activeShift: Shift | null,
    upcomingShifts: Shift[],
    openShifts: Shift[],
    shiftHistory: Shift[],
    isLoading: boolean
  },

  profile: {
    userProfile: StaffProfile,
    siaLicenses: SIALicense[],
    qualifications: Qualification[],
    emergencyContacts: EmergencyContact[],
    bankDetails: BankDetails | null
  },

  incidents: {
    draftReports: IncidentReport[],
    submittedReports: IncidentReport[],
    templates: IncidentTemplate[]
  },

  leave: {
    balance: LeaveBalance,
    requests: LeaveRequest[],
    blackoutPeriods: BlackoutPeriod[]
  },

  sync: {
    queue: QueuedAction[],
    isSyncing: boolean,
    lastSyncTime: Date | null,
    pendingUploads: number
  },

  ui: {
    isOnline: boolean,
    theme: 'light' | 'dark',
    accessibility: AccessibilitySettings,
    notifications: Notification[]
  }
}
```

### Offline-First Architecture

```
┌─────────────────────────────────────────────┐
│           Mobile App Layer                  │
│                                             │
│  ┌─────────────┐      ┌─────────────┐      │
│  │   React     │      │   Redux     │      │
│  │ Components  │◄────►│   Store     │      │
│  └─────────────┘      └──────┬──────┘      │
│                              │             │
│                              ▼             │
│  ┌─────────────────────────────────────┐   │
│  │     WatermelonDB (SQLite)          │   │
│  │  - Shifts, Incidents, Checks       │   │
│  │  - Offline queue, Photos           │   │
│  └───────────────┬─────────────────────┘   │
└──────────────────┼──────────────────────────┘
                   │
                   │ Sync Queue
                   │ (when online)
                   ▼
┌──────────────────────────────────────────────┐
│          Backend Services                    │
│                                             │
│  ┌─────────────┐      ┌─────────────┐      │
│  │   Django    │      │ PostgreSQL  │      │
│  │  REST API   │◄────►│  Database   │      │
│  └─────────────┘      └─────────────┘      │
└──────────────────────────────────────────────┘
```

---

## Feature Specifications

### 1. Dashboard (Home Screen)

#### Purpose
Provide at-a-glance view of current shift status, upcoming shifts, and quick actions.

#### UI Components
- **Hero Card**: Active shift status with real-time duration
- **Quick Actions**: Report Incident, Do Check, Take Break
- **Upcoming Shifts List**: Next 5 shifts
- **Notification Badge**: Unread count
- **Open Shifts CTA**: Claim available shifts

#### Data Sources
- Active shift: `/api/v1/shifts/active/`
- Upcoming shifts: `/api/v1/shifts/upcoming/`
- Notifications: `/api/v1/notifications/unread/`

#### Accessibility
- VoiceOver: "Active shift at Central Park Hotel, duration 2 hours 45 minutes"
- Large touch targets (minimum 48dp)
- High contrast mode support
- Haptic feedback on actions

---

### 2. Check-In Flow

#### Step 1: Location Verification

**Requirements**:
- GPS accuracy within 50 meters of venue
- Automatic detection when staff arrives
- Push notification trigger
- Offline queuing if no network

**UI**:
```
┌─────────────────────────────────┐
│        📍 LOCATION              │
│        ✓ Verified               │
│                                 │
│   You're at the correct venue   │
│   Central Park Hotel            │
│   123 Park Street               │
│                                 │
│        [Continue →]             │
└─────────────────────────────────┘
```

**Implementation**:
```typescript
const verifyLocation = async () => {
  const userLocation = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High
  });

  const venue = await getActiveShiftVenue();
  const distance = calculateDistance(
    userLocation.coords,
    venue.coordinates
  );

  if (distance <= 50) {
    return { verified: true, venue };
  } else {
    return {
      verified: false,
      error: `You are ${distance}m away from the venue`
    };
  }
};
```

#### Step 2: Venue Photo Capture

**Requirements**:
- High-quality photo (1920x1080 max)
- Auto-compress before upload
- AR overlay guide for framing
- Photo examples/templates
- Voice guidance
- Offline storage with sync

**UI**:
```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │     [CAMERA VIEWFINDER]     │ │
│ │                             │ │
│ │     📷                      │ │
│ │   "Show venue entrance"     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Tips for good photos:           │
│ • Capture full entrance         │
│ • Ensure lighting is good       │
│ • Include venue signage         │
│                                 │
│        [📸 Take Photo]          │
└─────────────────────────────────┘
```

**Implementation**:
```typescript
const captureVenuePhoto = async () => {
  const photo = await Camera.takePictureAsync({
    quality: 0.8,
    exif: true,
    base64: false
  });

  // Compress and tag
  const optimized = await ImageManipulator.manipulateAsync(
    photo.uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );

  // Add metadata
  const photoWithMetadata = {
    uri: optimized.uri,
    location: await Location.getCurrentPositionAsync(),
    timestamp: new Date().toISOString(),
    type: 'venue_entrance',
    venueId: activeShift.venue.id
  };

  // Queue for upload (offline-safe)
  await queuePhotoUpload(photoWithMetadata);

  return photoWithMetadata;
};
```

#### Step 3: Digital Signature

**Requirements**:
- Clear signature canvas
- Smooth drawing (60 FPS)
- Clear button
- Confirmation checkboxes
- Save to secure storage

**UI**:
```
┌─────────────────────────────────┐
│ I confirm I have:               │
│ ✓ Arrived at the venue          │
│ ✓ Verified my SIA license       │
│ ✓ Read venue safety protocols   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │  [SIGNATURE CANVAS]         │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Clear]    [✓ Check In]         │
└─────────────────────────────────┘
```

**Implementation**:
```typescript
<SignatureCanvas
  onOK={handleSignature}
  onClear={handleClearSignature}
  accessible={true}
  accessibilityLabel="Sign here to confirm check-in"
  descriptionText="Sign above"
  clearText="Clear"
  confirmText="Confirm"
  webStyle={`
    .m-signature-pad {
      box-shadow: none;
      border: 2px solid #007AFF;
    }
  `}
/>
```

---

### 3. Quick Incident Reporting

#### Design Philosophy
**Accessibility-First**: Multiple input methods to accommodate different needs and situations.

#### Input Methods

##### A. Voice Reporting (Primary for Quick Reports)
```
┌─────────────────────────────────┐
│ 🎙 VOICE REPORT (Tap & Hold)    │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │    🔴  Hold to Record       │ │
│ │       (0:00 / 2:00)         │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Transcription:                  │
│ "Fight broke out near the bar   │
│  between two patrons. Security  │
│  intervened. No injuries."      │
│                                 │
│ [🔄 Re-record]  [✓ Use This]   │
└─────────────────────────────────┘
```

**Implementation**:
```typescript
import Voice from '@react-native-voice/voice';

const VoiceIncidentReport = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    Voice.onSpeechResults = (e) => {
      setTranscript(e.value[0]);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const startRecording = async () => {
    try {
      await Voice.start('en-US');
      setIsRecording(true);

      // Voice feedback
      Speech.speak('Recording started', {
        language: 'en',
        rate: 1.0
      });

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error(error);
    }
  };

  const stopRecording = async () => {
    try {
      await Voice.stop();
      setIsRecording(false);

      Speech.speak('Recording stopped', {
        language: 'en',
        rate: 1.0
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Pressable
      onLongPress={startRecording}
      onPressOut={stopRecording}
      accessible={true}
      accessibilityLabel="Voice incident report"
      accessibilityHint="Hold to record your incident report"
    >
      <VoiceRecordingButton isRecording={isRecording} />
    </Pressable>
  );
};
```

##### B. Quick-Tap Incident Types
```
QUICK INCIDENT TYPES:
┌────┬────┬────┬────┬────┐
│🥊  │🚨  │🚑  │🔥  │👥  │
│Fight│Alarm│Injury│Fire│Crowd│
└────┴────┴────┴────┴────┘
```

**Benefits**:
- One-tap reporting for common incidents
- Large touch targets (72dp x 72dp)
- Visual icons + text labels
- Pre-filled templates

##### C. Photo/Video Evidence
```
📸 Add Photos (Optional)
┌────┬────┬────┬────┐
│ +  │    │    │    │
└────┴────┴────┴────┘
```

**Features**:
- Multiple photo upload
- Video recording (max 30 seconds)
- Auto-compress before upload
- Offline queue with sync

#### Full Incident Report Screen

```
┌─────────────────────────────────┐
│ ✕    Report Incident            │
├─────────────────────────────────┤
│                                 │
│ 🎙 VOICE REPORT (Tap & Hold)    │
│ ┌─────────────────────────────┐ │
│ │    🔴  Hold to Record       │ │
│ └─────────────────────────────┘ │
│                                 │
│         OR TYPE BELOW           │
│                                 │
│ QUICK INCIDENT TYPES:           │
│ ┌────┬────┬────┬────┬────┐     │
│ │🥊  │🚨  │🚑  │🔥  │👥  │     │
│ └────┴────┴────┴────┴────┘     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Describe what happened...   │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ 📸 Add Photos (Optional)        │
│ ┌────┬────┬────┬────┐          │
│ │ +  │    │    │    │          │
│ └────┴────┴────┴────┘          │
│                                 │
│ 📍 Location: Auto-captured      │
│ ⏰ Time: 20:15                  │
│ 🏢 Venue: Central Park Hotel    │
│                                 │
│ [Save as Draft]  [🚨 Submit]   │
└─────────────────────────────────┘
```

#### Data Model
```typescript
interface IncidentReport {
  id: string;
  type: 'fight' | 'alarm' | 'injury' | 'fire' | 'crowd' | 'other';
  description: string;
  transcription?: string; // From voice input
  photos: Photo[];
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: Date;
  venueId: number;
  shiftId: number;
  reportedBy: number;
  status: 'draft' | 'submitted' | 'reviewed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  syncStatus: 'pending' | 'synced' | 'failed';
}
```

---

### 4. Shift Checks System

#### Purpose
Simplify routine safety checks with visual progress tracking and photo evidence.

#### Check Types
1. **Fire Exits** (required every 2 hours)
2. **Capacity Monitoring** (continuous)
3. **Toilet Facilities** (required every hour)
4. **CCTV System** (required at start and end)
5. **Custom Checks** (venue-specific)

#### UI Design
```
┌─────────────────────────────────┐
│ ← Back    Shift Checks    3/5   │
├─────────────────────────────────┤
│                                 │
│ ✅ Fire Exit - Main Entrance    │
│    Completed 19:30              │
│    [View Photo]                 │
│                                 │
│ ✅ Capacity Check               │
│    Current: 245/300 (82%)       │
│    Updated 20:00                │
│                                 │
│ ✅ Toilet Facilities            │
│    All operational              │
│    Checked 20:15                │
│                                 │
│ ⏳ Fire Exit - Emergency (Rear) │
│    [Do Check Now]               │
│                                 │
│ ⏳ CCTV System Status            │
│    [Do Check Now]               │
│                                 │
│ Scheduled Checks:               │
│ Next check at 21:00 (45 min)    │
│                                 │
└─────────────────────────────────┘
```

#### Check Flow
1. Select check type
2. Capture photo evidence
3. Add notes (optional)
4. Submit (queued if offline)

#### Reminders
- Push notification 15 minutes before scheduled check
- In-app badge on Shift Checks tab
- Voice reminder if app is open

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance Checklist

#### ✅ Perceivable
- [ ] **Text alternatives** for all non-text content
- [ ] **Captions** for video content
- [ ] **Audio descriptions** for video
- [ ] **Color contrast** minimum 4.5:1 for normal text, 3:1 for large text
- [ ] **No color-only information** (use icons + text)
- [ ] **Resizable text** up to 200% without loss of functionality
- [ ] **Meaningful sequence** (logical reading order)

#### ✅ Operable
- [ ] **Keyboard accessible** (all functionality)
- [ ] **No keyboard traps**
- [ ] **Adjustable time limits**
- [ ] **Pause, stop, hide** for moving content
- [ ] **No seizure-inducing content** (< 3 flashes per second)
- [ ] **Clear focus indicator**
- [ ] **Multiple navigation methods**
- [ ] **Descriptive headings** and labels
- [ ] **Focus order** makes sense

#### ✅ Understandable
- [ ] **Language of page** identified
- [ ] **Consistent navigation**
- [ ] **Consistent identification** of components
- [ ] **Error identification**
- [ ] **Labels or instructions** for user input
- [ ] **Error suggestions** provided
- [ ] **Error prevention** for legal/financial/data actions

#### ✅ Robust
- [ ] **Valid HTML/markup**
- [ ] **Name, role, value** for all components
- [ ] **Status messages** announced to screen readers

### Implementation Checklist

```typescript
// ✅ Example: Accessible Button
<Button
  // Core accessibility props
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Check in to shift"
  accessibilityHint="Start your shift and record your arrival time"
  accessibilityState={{
    disabled: !canCheckIn,
    selected: false
  }}

  // Visual accessibility
  style={{
    minHeight: 48,        // Minimum touch target
    minWidth: 48,
    backgroundColor: theme.primary.blue,
    borderRadius: 8,
    borderWidth: 2,       // Visible focus indicator
    borderColor: isFocused ? '#000' : 'transparent'
  }}

  // Interaction feedback
  onPress={handleCheckIn}
  onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
  onPressOut={() => Speech.speak('Checking in', { language: 'en' })}

  // High contrast mode
  {...(isHighContrastMode && {
    style: {
      backgroundColor: '#000',
      borderColor: '#FFF',
      borderWidth: 3
    }
  })}
>
  <Text
    style={{
      color: '#FFF',
      fontSize: 16,       // Minimum readable size
      fontWeight: '600'
    }}
  >
    📍 Check In
  </Text>
</Button>
```

### Voice Commands Support

```typescript
// Voice command registry
const voiceCommands = {
  'report incident': () => navigation.navigate('IncidentReport'),
  'check in': () => handleCheckIn(),
  'check out': () => handleCheckOut(),
  'view shifts': () => navigation.navigate('MyShifts'),
  'take a break': () => handleBreak(),
  'help': () => navigation.navigate('Help')
};

// Voice command listener
useEffect(() => {
  Voice.onSpeechResults = (e) => {
    const command = e.value[0].toLowerCase();
    const handler = voiceCommands[command];

    if (handler) {
      handler();
      Speech.speak(`Executing ${command}`, { language: 'en' });
    } else {
      Speech.speak('Command not recognized', { language: 'en' });
    }
  };
}, []);
```

---

## Scalability Architecture

### Performance Targets
- **Cold Start**: < 2 seconds
- **Screen Transitions**: < 100ms
- **Animations**: 60 FPS consistent
- **API Response**: < 300ms p95
- **Memory Usage**: < 150MB
- **Bundle Size**: < 30MB
- **Concurrent Users**: 10,000+

### Offline-First Strategy

#### Local Database Schema (WatermelonDB)
```typescript
// Schema definition
const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'shifts',
      columns: [
        { name: 'shift_id', type: 'number', isIndexed: true },
        { name: 'venue_id', type: 'number' },
        { name: 'start_time', type: 'number' },
        { name: 'end_time', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'check_in_photo', type: 'string', isOptional: true },
        { name: 'signature', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    tableSchema({
      name: 'incidents',
      columns: [
        { name: 'incident_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'transcription', type: 'string', isOptional: true },
        { name: 'location_lat', type: 'number' },
        { name: 'location_lng', type: 'number' },
        { name: 'timestamp', type: 'number' },
        { name: 'venue_id', type: 'number' },
        { name: 'shift_id', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'sync_status', type: 'string' },
        { name: 'created_at', type: 'number' }
      ]
    }),

    tableSchema({
      name: 'photos',
      columns: [
        { name: 'photo_id', type: 'string', isIndexed: true },
        { name: 'uri', type: 'string' },
        { name: 'type', type: 'string' }, // venue_entrance, incident, check
        { name: 'related_id', type: 'string' },
        { name: 'compressed_uri', type: 'string', isOptional: true },
        { name: 'thumbnail_uri', type: 'string', isOptional: true },
        { name: 'upload_status', type: 'string' },
        { name: 'created_at', type: 'number' }
      ]
    }),

    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'action_id', type: 'string', isIndexed: true },
        { name: 'action_type', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON string
        { name: 'priority', type: 'string' },
        { name: 'retries', type: 'number' },
        { name: 'last_retry', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' }
      ]
    })
  ]
});
```

#### Sync Queue Implementation
```typescript
interface QueuedAction {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'INCIDENT_REPORT' | 'SHIFT_CHECK' | 'PHOTO_UPLOAD';
  payload: any;
  photos?: string[]; // URIs
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  retries: number;
  maxRetries: number;
  createdAt: Date;
  lastRetry?: Date;
}

class SyncManager {
  private queue: QueuedAction[] = [];
  private isSyncing = false;

  async addToQueue(action: Omit<QueuedAction, 'id' | 'retries' | 'createdAt'>) {
    const queuedAction: QueuedAction = {
      ...action,
      id: uuid.v4(),
      retries: 0,
      createdAt: new Date()
    };

    // Save to WatermelonDB
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

    this.queue.push(queuedAction);

    // Trigger sync if online
    if (this.isOnline()) {
      this.startSync();
    }
  }

  async startSync() {
    if (this.isSyncing) return;

    this.isSyncing = true;

    // Sort by priority
    const sortedQueue = this.queue.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const action of sortedQueue) {
      try {
        await this.syncAction(action);
        await this.removeFromQueue(action.id);
      } catch (error) {
        await this.handleSyncError(action, error);
      }
    }

    this.isSyncing = false;
  }

  private async syncAction(action: QueuedAction) {
    switch (action.type) {
      case 'CHECK_IN':
        await api.post('/shifts/check-in/', action.payload);
        break;
      case 'INCIDENT_REPORT':
        await api.post('/incidents/', action.payload);
        break;
      case 'PHOTO_UPLOAD':
        await this.uploadPhoto(action);
        break;
      // ... other action types
    }
  }

  private async handleSyncError(action: QueuedAction, error: any) {
    action.retries++;
    action.lastRetry = new Date();

    if (action.retries >= action.maxRetries) {
      // Move to failed queue
      console.error(`Action ${action.id} failed after ${action.retries} retries`);
      // Notify user
      await this.notifyUser(`Failed to sync ${action.type}`);
    } else {
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, action.retries), 30000);
      setTimeout(() => this.startSync(), delay);
    }
  }

  private isOnline(): boolean {
    // Check network status
    return NetInfo.isConnected;
  }
}
```

#### Photo Optimization Pipeline
```typescript
class PhotoManager {
  async optimizeAndQueue(photo: Photo): Promise<void> {
    // 1. Generate thumbnail
    const thumbnail = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 200 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );

    // 2. Compress full image
    const compressed = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    // 3. Save to local database
    await database.write(async () => {
      await database.get('photos').create((record) => {
        record.photo_id = photo.id;
        record.uri = photo.uri;
        record.compressed_uri = compressed.uri;
        record.thumbnail_uri = thumbnail.uri;
        record.type = photo.type;
        record.related_id = photo.relatedId;
        record.upload_status = 'pending';
        record.created_at = Date.now();
      });
    });

    // 4. Queue for upload
    await syncManager.addToQueue({
      type: 'PHOTO_UPLOAD',
      payload: {
        photoId: photo.id,
        uri: compressed.uri,
        metadata: {
          type: photo.type,
          relatedId: photo.relatedId,
          timestamp: photo.timestamp,
          location: photo.location
        }
      },
      priority: photo.type === 'incident' ? 'HIGH' : 'MEDIUM',
      maxRetries: 5
    });
  }

  async uploadPhoto(action: QueuedAction): Promise<void> {
    const { photoId, uri, metadata } = action.payload;

    // Create FormData
    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: 'image/jpeg',
      name: `${photoId}.jpg`
    });
    formData.append('metadata', JSON.stringify(metadata));

    // Upload with progress tracking
    const response = await api.post('/photos/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        this.updateUploadProgress(photoId, progress);
      }
    });

    // Update local record
    await database.write(async () => {
      const photo = await database.get('photos').find(photoId);
      await photo.update((record) => {
        record.upload_status = 'completed';
      });
    });
  }
}
```

### Caching Strategy

```typescript
// RTK Query cache configuration
export const api = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    }
  }),

  // Cache tags for invalidation
  tagTypes: ['Shifts', 'Incidents', 'Profile', 'Leave', 'Notifications'],

  endpoints: (builder) => ({
    // Shifts endpoints
    getActiveShift: builder.query({
      query: () => '/shifts/active/',
      providesTags: ['Shifts'],
      // Cache for 5 minutes
      keepUnusedDataFor: 300
    }),

    getUpcomingShifts: builder.query({
      query: () => '/shifts/upcoming/',
      providesTags: ['Shifts'],
      // Cache for 10 minutes
      keepUnusedDataFor: 600
    }),

    // Incidents endpoints
    getIncidents: builder.query({
      query: () => '/incidents/',
      providesTags: ['Incidents'],
      keepUnusedDataFor: 300
    }),

    createIncident: builder.mutation({
      query: (incident) => ({
        url: '/incidents/',
        method: 'POST',
        body: incident
      }),
      // Invalidate incidents cache on create
      invalidatesTags: ['Incidents']
    })
  })
});
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Project Setup
- [x] Initialize Expo project with TypeScript
- [x] Set up @expo/ui with Liquid Glass components
- [x] Configure navigation (React Navigation v7)
- [x] Set up Redux Toolkit + RTK Query
- [x] Configure ESLint, Prettier, TypeScript strict mode
- [x] Set up testing environment (Jest + React Native Testing Library)

#### Week 2: Authentication & API Integration
- [ ] Implement login screen with biometric auth
- [ ] Set up JWT token management (SecureStore)
- [ ] Configure API service layer
- [ ] Implement token refresh mechanism
- [ ] Create AuthContext and protected routes
- [ ] Test authentication flow end-to-end

**Deliverables**: Working authentication, API integration, navigation

---

### Phase 2: Shift Management (Weeks 3-5)

#### Week 3: Dashboard & My Shifts
- [ ] Build Dashboard screen with active shift card
- [ ] Implement upcoming shifts list
- [ ] Create shift details modal
- [ ] Add quick action buttons
- [ ] Implement notification badge

#### Week 4: Check-In Flow
- [ ] GPS location verification
- [ ] Camera integration for venue photos
- [ ] Photo optimization and compression
- [ ] Digital signature capture
- [ ] Offline queue implementation

#### Week 5: Check-Out & Shift Checks
- [ ] Check-out flow (similar to check-in)
- [ ] Shift checks list screen
- [ ] Individual check flows (Fire Exit, Capacity, etc.)
- [ ] Scheduled check reminders
- [ ] Photo evidence for checks

**Deliverables**: Complete shift workflow, offline support

---

### Phase 3: Profile & Documents (Weeks 6-7)

#### Week 6: Profile Management
- [ ] Profile view screen
- [ ] Profile editing
- [ ] SIA license upload & display
- [ ] Qualifications list
- [ ] Emergency contacts management

#### Week 7: Documents & Security
- [ ] Bank details (encrypted display)
- [ ] Document camera capture
- [ ] PDF viewer integration
- [ ] Secure storage implementation
- [ ] Preferred venues management

**Deliverables**: Complete profile management, document handling

---

### Phase 4: Incident Reporting (Week 8)

- [ ] Quick report screen with voice input
- [ ] Quick-tap incident types
- [ ] Detailed incident form
- [ ] Photo/video evidence capture
- [ ] Offline incident queue
- [ ] Draft saving functionality

**Deliverables**: Full incident reporting system

---

### Phase 5: Leave Management (Week 9)

- [ ] Leave request form
- [ ] Calendar picker integration
- [ ] Leave balance display (animated charts)
- [ ] Leave history list
- [ ] Blackout period warnings
- [ ] Manager approval notifications

**Deliverables**: Complete leave request workflow

---

### Phase 6: Payroll & Invoices (Week 10)

- [ ] Timesheet review screen
- [ ] Invoice history list
- [ ] Payment status tracking
- [ ] PDF invoice viewer
- [ ] Export/share invoices

**Deliverables**: Payroll information access

---

### Phase 7: Notifications & Real-Time (Week 11)

- [ ] Push notifications setup (Expo Notifications)
- [ ] FCM integration
- [ ] In-app notification center
- [ ] Real-time shift updates (WebSocket or polling)
- [ ] Badge counters
- [ ] Notification preferences

**Deliverables**: Complete notification system

---

### Phase 8: Polish & Performance (Week 12)

- [ ] Liquid Glass animations (Reanimated)
- [ ] Performance optimization (bundle size, memory)
- [ ] Offline mode improvements
- [ ] Error handling & retry logic
- [ ] Loading states with skeleton screens
- [ ] Dark mode support
- [ ] Accessibility audit & fixes

**Deliverables**: Production-ready UI, optimized performance

---

### Phase 9: Testing (Week 13)

- [ ] Unit tests for components and utils
- [ ] Integration tests for flows
- [ ] E2E tests with Detox
- [ ] Accessibility testing (VoiceOver/TalkBack)
- [ ] Performance testing (cold start, memory, FPS)
- [ ] Security testing (token storage, data encryption)

**Deliverables**: Comprehensive test suite

---

### Phase 10: Deployment (Week 14)

- [ ] EAS Build configuration
- [ ] App icons & splash screens
- [ ] App Store Connect setup
- [ ] Google Play Console setup
- [ ] Privacy policy & terms
- [ ] Beta testing (TestFlight + Internal Testing)
- [ ] Final QA
- [ ] Production release

**Deliverables**: Published apps on both stores

---

## Success Metrics

### Adoption Metrics
- **Target**: 80% staff adoption within 3 months
- **Measurement**: Active users / Total staff

### Performance Metrics
- **Cold Start**: < 2 seconds (Target: 1.5s)
- **Screen Transitions**: < 100ms (Target: 80ms)
- **Animations**: 60 FPS (Target: 60 FPS sustained)
- **API Latency**: < 300ms p95 (Target: 250ms)
- **Memory Usage**: < 150MB (Target: 120MB)

### Reliability Metrics
- **Crash-Free Rate**: > 99.5%
- **Successful Sync Rate**: > 99%
- **Photo Upload Success**: > 98%

### User Satisfaction
- **App Store Rating**: > 4.5 stars
- **Play Store Rating**: > 4.5 stars
- **Support Tickets**: < 2 per 100 check-ins

### Accessibility Metrics
- **WCAG 2.1 AA Compliance**: 100%
- **Screen Reader Compatibility**: 100%
- **Voice Command Success**: > 95%

---

## Deployment Strategy

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 5.0.0"
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
        "simulator": false
      }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "env": {
        "API_URL": "https://api.example.com",
        "SENTRY_DSN": "https://..."
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "user@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "production"
      }
    }
  }
}
```

### OTA Updates with EAS Update

```json
// app.config.js
export default {
  expo: {
    updates: {
      url: "https://u.expo.dev/...",
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 5000
    },
    runtimeVersion: {
      policy: "sdkVersion"
    }
  }
}
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy Mobile App

on:
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --non-interactive --no-wait

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas submit --platform all --non-interactive
```

---

## Risk Management

### Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API breaking changes | High | Low | Version API endpoints, maintain backwards compatibility |
| Photo storage limits | Medium | Medium | Implement photo cleanup policy, compress aggressively |
| Offline sync conflicts | High | Medium | Implement conflict resolution, last-write-wins with manual review |
| GPS inaccuracy | High | Low | Multiple location checks, user override with manager approval |
| Battery drain | Medium | Medium | Optimize background tasks, efficient sync intervals |
| App Store rejection | High | Low | Follow guidelines strictly, pre-submission review |
| User adoption resistance | High | Medium | Comprehensive training, gradual rollout, incentives |
| Performance on old devices | Medium | Medium | Minimum OS version requirements, performance testing |

---

## Next Steps

### Immediate Actions (Week 0)
1. ✅ **Approved**: Mobile app master plan
2. **Pending**: Developer environment setup
3. **Pending**: Expo project initialization
4. **Pending**: Design mockups finalization
5. **Pending**: API endpoint documentation review
6. **Pending**: Stakeholder presentation

### Phase 1 Kickoff (Week 1)
- Initialize project structure
- Set up development tools
- Configure CI/CD pipeline
- Begin authentication implementation

---

## Appendices

### A. API Endpoints Required

See [API Integration Specification](./API_INTEGRATION_SPEC.md)

### B. UI Component Library

See [UI Component Library](./UI_COMPONENT_LIBRARY.md)

### C. Accessibility Checklist

See [Accessibility Requirements](./ACCESSIBILITY_REQUIREMENTS.md)

### D. Testing Strategy

See [Testing Strategy Document](./TESTING_STRATEGY.md)

### E. Performance Benchmarks

See [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Next Review**: 2025-10-17
**Owner**: Mobile Development Team
**Stakeholders**: CTO, Product Manager, UX Lead, Security Team
