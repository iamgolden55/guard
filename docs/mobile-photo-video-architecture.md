# Mobile Photo/Video System Architecture

## Executive Summary

This document describes the architecture of the mobile photo and video capture, storage, and upload system within the Mead Security mobile application. The system is designed with an **offline-first** approach, featuring local storage with cloud sync capabilities, and is architected to seamlessly transition from local storage to AWS S3.

**Key Design Principles:**
- ✅ Offline-first: Works without network connectivity
- ✅ Progressive enhancement: Local storage NOW, S3 LATER
- ✅ Automatic sync: Background upload when online
- ✅ Photo optimization: Automatic compression to <2MB
- ✅ Abstraction layer: Single point of configuration for storage backend
- ✅ Type-safe: Full TypeScript implementation

---

## System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     MOBILE APPLICATION                        │
│                                                               │
│  ┌────────────────┐      ┌─────────────────┐                │
│  │  UI Components │──────│  Service Layer  │                │
│  │                │      │                 │                │
│  │ - IncidentForm │      │ - incidentSvc   │                │
│  │ - PhotoPicker  │      │ - photoSvc      │                │
│  │ - SignatureCtl │      │ - mediaUploadSvc│                │
│  └────────────────┘      └─────────────────┘                │
│         │                         │                          │
│         │                         ▼                          │
│         │                ┌─────────────────┐                │
│         │                │  Local Storage  │                │
│         │                │                 │                │
│         │                │ - Photos        │                │
│         │                │ - Thumbnails    │                │
│         │                │ - SQLite DB     │                │
│         │                └─────────────────┘                │
│         │                         │                          │
│         └─────────────────────────┘                          │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                        Network Available?
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
              ┌─────────────┐            ┌─────────────┐
              │   PHASE 1   │            │   PHASE 2   │
              │    (NOW)    │            │  (FUTURE)   │
              │             │            │             │
              │   Offline   │            │   Django    │
              │   Storage   │            │   Backend   │
              │             │            │      │      │
              │  Local URIs │            │      ▼      │
              │   Stored    │            │   AWS S3    │
              │             │            │   Storage   │
              └─────────────┘            └─────────────┘
```

---

## Component Architecture

### 1. Service Layer Components

#### PhotoService (`/mobile/src/services/photoService.ts`)
**Purpose**: Photo capture, optimization, and local storage management

**Responsibilities:**
- Capture photos using device camera
- Optimize photos (resize, compress to <2MB)
- Generate thumbnails (400px width)
- Store photos in local file system
- Convert photos to base64 for API upload
- Manage photo deletion and cleanup
- Track storage usage statistics

**Key Methods:**
```typescript
class PhotoService {
  // Directory structure
  private photosDir = `${Directories.documents}/photos/`
  private thumbnailsDir = `${Directories.documents}/thumbnails/`

  // Core operations
  async capturePhoto(): Promise<{ uri: string } | null>
  async optimizePhoto(uri: string, options?: CompressionOptions): Promise<OptimizedPhoto>
  async deletePhoto(photoUri: string): Promise<void>
  async toBase64(uri: string): Promise<string>
  async getStorageUsed(): Promise<{ totalSize: number; photoCount: number }>
  async clearAll(): Promise<void>
}
```

**File Storage Structure:**
```
Directories.documents/
├── photos/
│   ├── 1730000000001.jpg  (optimized, <2MB)
│   ├── 1730000000002.jpg
│   └── 1730000000003.jpg
└── thumbnails/
    ├── 1730000000001_thumb.jpg  (400px width)
    ├── 1730000000002_thumb.jpg
    └── 1730000000003_thumb.jpg
```

**Optimization Strategy:**
```typescript
// Step 1: Initial resize to 1920px max width, 0.8 quality
manipulate(uri, [{ resize: { width: 1920 } }], { compress: 0.8 })

// Step 2: If still >2MB, aggressive compression
if (size > 2MB) {
  manipulate(uri, [{ resize: { width: 1280 } }], { compress: 0.6 })
}

// Step 3: Generate thumbnail at 400px width, 0.7 quality
manipulate(uri, [{ resize: { width: 400 } }], { compress: 0.7 })
```

---

#### MediaUploadService (`/mobile/src/services/mediaUploadService.ts`)
**Purpose**: Abstraction layer for media uploads - works with local storage NOW, S3 LATER

**Responsibilities:**
- Abstract storage backend (local vs S3)
- Handle file uploads to backend API
- Track upload progress
- Manage MIME types and file names
- Support batch uploads
- Provide single configuration point for S3 transition

**Key Architecture:**
```typescript
class MediaUploadService {
  private useS3 = false;  // ← Single toggle for entire system

  // Primary upload method - routing logic
  async uploadToBackend(
    fileUri: string,
    type: MediaType,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    if (!this.useS3) {
      return this.storeLocally(fileUri, type);  // Phase 1
    }
    return this.uploadToS3(fileUri, type, onProgress);  // Phase 2
  }

  // Phase 1: Local storage (works NOW)
  private storeLocally(fileUri: string, type: MediaType): UploadResult {
    return {
      url: fileUri,           // Local file:// URI
      type,
      size: fileInfo.size,
      uploadedAt: new Date().toISOString()
    };
  }

  // Phase 2: S3 upload (enable when backend ready)
  private async uploadToS3(
    fileUri: string,
    type: MediaType,
    onProgress?: Function
  ): UploadResult {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: this.getMimeType(type, fileUri),
      name: this.getFileName(fileUri)
    });

    const response = await api.post('/media/upload', formData);

    return {
      url: response.data.url,   // S3 HTTPS URL
      key: response.data.key,   // S3 object key
      type,
      size: fileInfo.size,
      uploadedAt: new Date().toISOString()
    };
  }

  // Configuration methods
  enableS3() { this.useS3 = true; }
  disableS3() { this.useS3 = false; }
  isS3Enabled(): boolean { return this.useS3; }
}
```

**Upload Result Interface:**
```typescript
interface UploadResult {
  url: string;           // Local URI (Phase 1) or S3 URL (Phase 2)
  key?: string;          // S3 object key (only in Phase 2)
  type: MediaType;       // 'photo' | 'video' | 'voice'
  size: number;          // File size in bytes
  uploadedAt: string;    // ISO timestamp
}
```

**Supported Media Types:**
- `photo`: JPEG/PNG images → `image/jpeg` or `image/png`
- `video`: MP4 videos → `video/mp4`
- `voice`: M4A audio → `audio/m4a`

---

#### IncidentService (`/mobile/src/services/incidentService.ts`)
**Purpose**: Coordinate incident reports with media attachments

**Responsibilities:**
- Process incident data with photos/videos
- Route media through mediaUploadService
- Store incidents in local database
- Queue incidents for sync
- Trigger immediate sync when online

**Media Processing Flow:**
```typescript
async submitIncident(incident: Incident): Promise<Incident> {
  // 1. Process photos through upload service
  if (incident.photos?.length) {
    const photoFiles = incident.photos.map(uri => ({
      uri,
      type: 'photo' as const
    }));
    const photoResults = await mediaUploadService.uploadMultiple(photoFiles);
    incident.photos = photoResults.map(result => result.url);
    // URLs are now: file:// (Phase 1) or https://s3... (Phase 2)
  }

  // 2. Process videos through upload service
  if (incident.videos?.length) {
    const videoFiles = incident.videos.map(uri => ({
      uri,
      type: 'video' as const
    }));
    const videoResults = await mediaUploadService.uploadMultiple(videoFiles);
    incident.videos = videoResults.map(result => result.url);
  }

  // 3. Process voice note
  if (incident.voice_note) {
    const voiceResult = await mediaUploadService.uploadToBackend(
      incident.voice_note,
      'voice'
    );
    incident.voice_note = voiceResult.url;
  }

  // 4. Save to local database with URLs
  const localIncident = await database.saveIncident({
    ...incident,
    reported_at: new Date().toISOString(),
    status: 'submitted',
    sync_status: 'pending'
  });

  // 5. Add to sync queue
  await syncService.addToQueue({
    type: 'create',
    entityType: 'incidents',
    entityId: localIncident.id?.toString() || 'temp',
    payload: localIncident,
    priority: incident.severity === 'critical' ? 0 : 1
  });

  // 6. Try immediate sync if online
  syncService.startSync();

  return localIncident;
}
```

---

#### SyncService (`/mobile/src/services/syncService.ts`)
**Purpose**: Background synchronization of local data to backend

**Responsibilities:**
- Queue CRUD operations for sync
- Prioritize critical incidents
- Handle network failures gracefully
- Retry failed syncs with exponential backoff
- Update sync status in local database

**Sync Queue Structure:**
```typescript
interface SyncQueueItem {
  type: 'create' | 'update' | 'delete';
  entityType: 'incidents' | 'shifts' | 'checkouts';
  entityId: string;
  payload: any;
  priority: number;  // 0 = critical, 1 = normal, 2 = low
  attempts: number;
  lastAttempt?: string;
  error?: string;
}
```

---

### 2. UI Components

#### IncidentForm (`/mobile/src/screens/incidents/IncidentForm.tsx`)
**Purpose**: User interface for creating incident reports with photos/videos

**Features:**
- Photo capture and gallery selection
- Video recording
- Voice note recording
- Form validation
- Progress indicators during photo processing
- Thumbnail previews
- Photo removal capability

**Photo Capture Flow:**
```typescript
const handlePhotoCapture = async () => {
  try {
    // 1. Capture photo using camera
    const photo = await photoService.capturePhoto();
    if (!photo) return;

    // 2. Optimize photo (compress, generate thumbnail)
    setProcessing(true);
    const optimized = await photoService.optimizePhoto(photo.uri, {
      maxWidth: 1920,
      quality: 0.8,
      thumbnailWidth: 400
    });

    // 3. Add to form state
    setPhotos(prev => [...prev, optimized]);

    // 4. Upload happens on form submit via incidentService
  } catch (error) {
    logger.error('[IncidentForm] Photo capture failed', { error });
    Alert.alert('Error', 'Failed to capture photo');
  } finally {
    setProcessing(false);
  }
};
```

---

#### SignatureCanvas (`/mobile/src/components/signature/SignatureCanvas.tsx`)
**Purpose**: Digital signature capture for incident reports

**Features:**
- Full-screen canvas for drawing
- Signature validation (minimum strokes, data length)
- Export to PNG with base64 encoding
- Clear and redo functionality
- Discard confirmation

**Signature Storage:**
```typescript
const handleExport = async () => {
  const filename = `signature_${Date.now()}.png`;
  const fileUri = `${Directories.documents}/${filename}`;

  // Extract base64 data
  const base64Data = signature.replace(/^data:image\/png;base64,/, '');

  // Save using new File API
  const file = new File(fileUri);
  await file.write(base64Data);

  // Share or store
  await Sharing.shareAsync(fileUri, { mimeType: 'image/png' });
};
```

---

## Data Flow

### Photo Capture & Upload Flow (Phase 1 - Local Storage)

```
┌──────────────┐
│     USER     │
└──────┬───────┘
       │ Taps "Capture Photo"
       ▼
┌─────────────────────┐
│  IncidentForm.tsx   │
│                     │
│ handlePhotoCapture()│
└──────┬──────────────┘
       │ Requests camera
       ▼
┌─────────────────────┐
│  PhotoService       │
│                     │
│ capturePhoto()      │
└──────┬──────────────┘
       │ Returns: { uri: "file://..." }
       ▼
┌─────────────────────┐
│  PhotoService       │
│                     │
│ optimizePhoto()     │
│  - Resize to 1920px │
│  - Compress to 80%  │
│  - Check size < 2MB │
│  - Generate thumb   │
└──────┬──────────────┘
       │ Returns: OptimizedPhoto
       │   uri: "file://Directories.documents/photos/123.jpg"
       │   thumbnail: "file://...thumbnails/123_thumb.jpg"
       │   size: 1.8MB
       ▼
┌─────────────────────┐
│  IncidentForm.tsx   │
│                     │
│ setPhotos([...])    │
│ Display thumbnail   │
└──────┬──────────────┘
       │ User submits form
       ▼
┌─────────────────────┐
│  IncidentService    │
│                     │
│ submitIncident()    │
└──────┬──────────────┘
       │ Process media
       ▼
┌─────────────────────┐
│ MediaUploadService  │
│                     │
│ uploadToBackend()   │
│  - useS3 = false    │
│  - Return local URI │
└──────┬──────────────┘
       │ Returns: UploadResult
       │   url: "file://...123.jpg"
       │   type: "photo"
       │   size: 1800000
       ▼
┌─────────────────────┐
│  IncidentService    │
│                     │
│ incident.photos =   │
│   ["file://..."]    │
└──────┬──────────────┘
       │ Save to database
       ▼
┌─────────────────────┐
│  Database Service   │
│                     │
│ saveIncident()      │
│  - sync_status:     │
│    'pending'        │
└──────┬──────────────┘
       │ Add to queue
       ▼
┌─────────────────────┐
│   Sync Service      │
│                     │
│ addToQueue()        │
│ startSync()         │
└──────┬──────────────┘
       │ Online?
       ▼
┌─────────────────────┐
│   Backend API       │
│                     │
│ POST /incidents/    │
│  Body: {            │
│    photos: [        │
│      "file://..."   │
│    ]                │
│  }                  │
└─────────────────────┘
```

### Photo Upload Flow (Phase 2 - S3 Storage)

```
┌──────────────┐
│     USER     │
└──────┬───────┘
       │ Photo captured & optimized
       │ (same as Phase 1)
       ▼
┌─────────────────────┐
│  IncidentService    │
│                     │
│ submitIncident()    │
└──────┬──────────────┘
       │ Process media
       ▼
┌─────────────────────┐
│ MediaUploadService  │
│                     │
│ uploadToBackend()   │
│  - useS3 = true ✓   │
└──────┬──────────────┘
       │ Route to S3 upload
       ▼
┌─────────────────────┐
│ MediaUploadService  │
│                     │
│ uploadToS3()        │
│  - Create FormData  │
│  - Add file blob    │
│  - Set MIME type    │
└──────┬──────────────┘
       │ POST /api/v1/media/upload
       │ Content-Type: multipart/form-data
       ▼
┌─────────────────────────────────────┐
│        Django Backend               │
│                                     │
│  MediaUploadView                    │
│   - Validate file                   │
│   - Check user permissions          │
│   - Generate unique filename        │
└──────┬──────────────────────────────┘
       │ Upload to S3
       ▼
┌─────────────────────────────────────┐
│         S3Service                   │
│                                     │
│  upload_file()                      │
│   - Put object to S3                │
│   - Set ACL: private                │
│   - Set metadata                    │
└──────┬──────────────────────────────┘
       │ Returns S3 URL
       ▼
┌─────────────────────────────────────┐
│        Django Backend               │
│                                     │
│  Response: {                        │
│    url: "https://bucket.s3.../key"  │
│    key: "incidents/uuid/photo.jpg"  │
│    size: 1800000                    │
│  }                                  │
└──────┬──────────────────────────────┘
       │ Response to mobile
       ▼
┌─────────────────────┐
│ MediaUploadService  │
│                     │
│ Returns: {          │
│   url: S3_URL       │
│   key: S3_KEY       │
│   type: "photo"     │
│   size: 1800000     │
│ }                   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  IncidentService    │
│                     │
│ incident.photos = [ │
│   "https://s3..."   │
│ ]                   │
└──────┬──────────────┘
       │ Save to database
       ▼
┌─────────────────────┐
│  Database Service   │
│                     │
│ saveIncident()      │
│  - photos: S3 URLs  │
│  - sync_status:     │
│    'synced'         │
└─────────────────────┘
```

---

## State Management

### Local Storage State

**SQLite Database Schema (incidents table):**
```sql
CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT,
  location TEXT,
  latitude REAL,
  longitude REAL,
  photos TEXT,              -- JSON array of URLs (local or S3)
  videos TEXT,              -- JSON array of URLs (local or S3)
  voice_note TEXT,          -- URL (local or S3)
  signature TEXT,           -- Base64 or S3 URL
  reported_at TEXT NOT NULL,
  reported_by_id INTEGER,
  shift_id INTEGER,
  status TEXT DEFAULT 'submitted',
  sync_status TEXT DEFAULT 'pending',  -- 'pending', 'syncing', 'synced', 'error'
  sync_error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Sync Queue Schema:**
```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL,    -- 'incidents', 'shifts', etc.
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON
  priority INTEGER DEFAULT 1,   -- 0=critical, 1=normal, 2=low
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt TEXT,
  error TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'success', 'failed'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### React State Management

**IncidentForm Component State:**
```typescript
const [photos, setPhotos] = useState<OptimizedPhoto[]>([]);
const [videos, setVideos] = useState<{ uri: string }[]>([]);
const [voiceNote, setVoiceNote] = useState<string | null>(null);
const [signature, setSignature] = useState<string | null>(null);
const [processing, setProcessing] = useState(false);
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
```

**Photo State Lifecycle:**
```typescript
// 1. Initial capture
{ uri: "file:///tmp/camera/IMG_123.jpg" }

// 2. After optimization
{
  uri: "file://Directories.documents/photos/1730000000001.jpg",
  thumbnail: "file://Directories.documents/thumbnails/1730000000001_thumb.jpg",
  width: 1920,
  height: 1080,
  size: 1800000,
  originalSize: 5400000
}

// 3. After upload (Phase 1)
{
  url: "file://Directories.documents/photos/1730000000001.jpg",
  type: "photo",
  size: 1800000,
  uploadedAt: "2025-10-25T10:30:00Z"
}

// 4. After upload (Phase 2)
{
  url: "https://mead-security-media.s3.amazonaws.com/incidents/uuid/photo.jpg",
  key: "incidents/uuid/photo.jpg",
  type: "photo",
  size: 1800000,
  uploadedAt: "2025-10-25T10:30:00Z"
}
```

---

## Offline-First Design

### Core Principles

1. **All operations work offline first**
   - Photos stored locally immediately
   - Database writes happen locally
   - UI never blocks on network

2. **Sync happens in background**
   - Queue-based sync system
   - Priority-based processing
   - Automatic retry with exponential backoff

3. **Graceful degradation**
   - Network failures don't block user
   - Clear sync status indicators
   - Manual sync trigger available

### Sync Strategy

```typescript
class SyncService {
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing = false;
  private retryDelays = [1000, 2000, 5000, 10000, 30000];  // ms

  async startSync() {
    if (this.isSyncing) return;
    if (!await this.isOnline()) return;

    this.isSyncing = true;

    try {
      // Get pending items sorted by priority
      const items = await this.getPendingItems();

      for (const item of items) {
        try {
          await this.syncItem(item);
          await this.markSynced(item.id);
        } catch (error) {
          await this.handleSyncError(item, error);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async handleSyncError(item: SyncQueueItem, error: any) {
    const attempts = item.attempts + 1;

    if (attempts >= 5) {
      // Max retries reached
      await this.markFailed(item.id, error.message);
      logger.error('[SyncService] Max retries reached', { item, error });
      return;
    }

    // Schedule retry with exponential backoff
    const delay = this.retryDelays[attempts - 1] || 30000;
    await this.scheduleRetry(item.id, delay);

    logger.warn('[SyncService] Sync failed, will retry', {
      item,
      attempts,
      nextRetry: delay
    });
  }
}
```

### Network State Handling

```typescript
// Listen for network changes
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    logger.info('[SyncService] Network connected, starting sync');
    syncService.startSync();
  } else {
    logger.info('[SyncService] Network disconnected, pausing sync');
    syncService.pauseSync();
  }
});

// App state changes
AppState.addEventListener('change', nextAppState => {
  if (nextAppState === 'active') {
    // App foregrounded, check sync status
    syncService.checkPendingSync();
  }
});
```

---

## Migration Path: Local → S3

### Phase 1: Local Storage (CURRENT)

**Configuration:**
```typescript
// mediaUploadService.ts
class MediaUploadService {
  private useS3 = false;  // ← Local storage
}
```

**Data stored:**
- Photos: `Directories.documents/photos/`
- Thumbnails: `Directories.documents/thumbnails/`
- Database: Local SQLite with `file://` URLs

**Characteristics:**
- ✅ Works offline
- ✅ Zero cloud costs
- ✅ Instant uploads (no network)
- ⚠️ Limited by device storage
- ⚠️ Not accessible from backend/web

---

### Phase 2: S3 Storage (FUTURE)

**Configuration:**
```typescript
// App initialization (App.tsx)
import { mediaUploadService } from './services/mediaUploadService';

// Enable S3 when backend is ready
useEffect(() => {
  // Check if backend has S3 configured
  api.get('/media/config').then(response => {
    if (response.data.s3Enabled) {
      mediaUploadService.enableS3();
      logger.info('[App] S3 uploads enabled');
    }
  });
}, []);
```

**Data stored:**
- Photos: AWS S3 bucket
- Thumbnails: S3 with CDN
- Database: Local SQLite with `https://` URLs

**Characteristics:**
- ✅ Works offline (queued sync)
- ✅ Unlimited cloud storage
- ✅ Accessible from backend/web
- ✅ CDN delivery for fast loading
- ⚠️ Network required for upload
- ⚠️ Cloud storage costs

---

### Transition Process

**Step-by-step migration:**

1. **Backend Setup** (See: `/docs/mobile-s3-media-upload-guide.md`)
   - Create AWS S3 bucket
   - Configure IAM permissions
   - Set up CORS policy
   - Implement Django upload endpoint
   - Deploy backend changes

2. **Test Backend**
   ```bash
   # Test upload endpoint
   curl -X POST http://localhost:8000/api/v1/media/upload \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@test.jpg" \
     -F "type=photo"

   # Should return:
   # {
   #   "url": "https://bucket.s3.amazonaws.com/...",
   #   "key": "incidents/uuid/photo.jpg",
   #   "size": 1800000
   # }
   ```

3. **Enable in Mobile App**
   ```typescript
   // App.tsx
   import { mediaUploadService } from './services/mediaUploadService';

   useEffect(() => {
     // Enable S3 globally
     mediaUploadService.enableS3();

     // Or conditionally based on backend config
     api.get('/media/config').then(response => {
       if (response.data.s3Enabled) {
         mediaUploadService.enableS3();
       }
     });
   }, []);
   ```

4. **Verify Behavior**
   - Capture photo in incident form
   - Check logs for S3 upload
   - Verify incident saved with S3 URL
   - Test sync queue with network toggle
   - Verify photo accessible from backend

5. **Data Migration (Optional)**
   - Script to upload existing local photos to S3
   - Update database URLs from `file://` to `https://`
   - Clean up local storage after successful upload

**Rollback Strategy:**
```typescript
// If issues with S3, instantly revert
mediaUploadService.disableS3();

// App continues working with local storage
// No data loss, no downtime
```

---

## Performance Optimization

### Photo Optimization Strategy

**Target: <2MB per photo**

```typescript
// photoService.ts optimization pipeline
async optimizePhoto(uri: string): Promise<OptimizedPhoto> {
  // Stage 1: Standard optimization
  // Target: 1920px width, 80% quality
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  let size = (await new File(result.uri).info()).size;

  // Stage 2: Aggressive if needed
  // Target: 1280px width, 60% quality
  if (size > 2 * 1024 * 1024) {
    result = await ImageManipulator.manipulateAsync(
      result.uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    size = (await new File(result.uri).info()).size;
  }

  // Stage 3: Thumbnail generation
  // Target: 400px width, 70% quality
  const thumbnail = await ImageManipulator.manipulateAsync(
    result.uri,
    [{ resize: { width: 400 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: result.uri,
    thumbnail: thumbnail.uri,
    size,
    ...
  };
}
```

**Typical Results:**
- Original: 8MB (4032x3024)
- Optimized: 1.5MB (1920x1440)
- Thumbnail: 50KB (400x300)
- Compression ratio: ~81%

### Batch Upload Optimization

```typescript
// mediaUploadService.ts
async uploadMultiple(
  files: Array<{ uri: string; type: MediaType }>,
  onProgress?: (index: number, progress: UploadProgress) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  // Sequential uploads to avoid overwhelming device/network
  for (let i = 0; i < files.length; i++) {
    const { uri, type } = files[i];

    const result = await this.uploadToBackend(
      uri,
      type,
      onProgress ? (progress) => onProgress(i, progress) : undefined
    );

    results.push(result);

    // Add small delay between uploads to prevent resource exhaustion
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
```

### Memory Management

**Avoid memory leaks:**
```typescript
// IncidentForm.tsx
useEffect(() => {
  return () => {
    // Clean up photo URIs on unmount
    photos.forEach(photo => {
      // Revoke object URLs if any
      if (photo.uri.startsWith('blob:')) {
        URL.revokeObjectURL(photo.uri);
      }
    });
  };
}, [photos]);
```

---

## Security Considerations

### Local Storage Security

1. **File System Permissions**
   - Photos stored in app's private Documents directory
   - Not accessible to other apps
   - Deleted on app uninstall

2. **Database Encryption**
   - SQLite database encrypted at rest (iOS)
   - SQLCipher for Android encryption
   - Sensitive data encrypted in transit

### S3 Security (Phase 2)

1. **Pre-signed URLs**
   - Backend generates time-limited upload URLs
   - Mobile never has direct S3 credentials
   - URLs expire after 15 minutes

2. **IAM Permissions**
   - Backend service account has minimal S3 permissions
   - `PutObject` and `DeleteObject` only
   - Bucket policy restricts public access

3. **CORS Configuration**
   - Restrict origins to known domains
   - Limit allowed methods to PUT/POST
   - Restrict headers

4. **Data Privacy**
   - S3 objects private by default
   - Backend provides signed URLs for viewing
   - Audit logging for all access

### Authentication

```typescript
// api.ts - Axios interceptor
api.interceptors.request.use(
  async config => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);
```

---

## Error Handling

### Error Categories

```typescript
enum MediaErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CAMERA_UNAVAILABLE = 'CAMERA_UNAVAILABLE',
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  STORAGE_FULL = 'STORAGE_FULL',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_FILE = 'INVALID_FILE'
}

class MediaError extends Error {
  constructor(
    public type: MediaErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'MediaError';
  }
}
```

### Error Handling Strategy

```typescript
// photoService.ts
async capturePhoto(): Promise<{ uri: string } | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      throw new MediaError(
        MediaErrorType.PERMISSION_DENIED,
        'Camera permission is required to take photos'
      );
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false
    });

    if (result.canceled) {
      return null;
    }

    return { uri: result.assets[0].uri };
  } catch (error) {
    if (error instanceof MediaError) {
      throw error;
    }

    logger.error('[PhotoService] Camera capture error:', error);
    throw new MediaError(
      MediaErrorType.CAMERA_UNAVAILABLE,
      'Unable to access camera',
      error as Error
    );
  }
}

// IncidentForm.tsx
const handlePhotoCapture = async () => {
  try {
    const photo = await photoService.capturePhoto();
    if (!photo) return;

    setProcessing(true);
    const optimized = await photoService.optimizePhoto(photo.uri);
    setPhotos(prev => [...prev, optimized]);
  } catch (error) {
    if (error instanceof MediaError) {
      switch (error.type) {
        case MediaErrorType.PERMISSION_DENIED:
          Alert.alert(
            'Permission Required',
            'Please enable camera access in Settings to capture photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          break;
        case MediaErrorType.STORAGE_FULL:
          Alert.alert(
            'Storage Full',
            'Not enough storage space for photos. Please free up space and try again.'
          );
          break;
        default:
          Alert.alert('Error', error.message);
      }
    } else {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }

    logger.error('[IncidentForm] Photo capture error', { error });
  } finally {
    setProcessing(false);
  }
};
```

---

## Testing Strategy

### Unit Tests

**photoService.test.ts:**
```typescript
describe('PhotoService', () => {
  describe('optimizePhoto', () => {
    it('should compress photo to <2MB', async () => {
      const result = await photoService.optimizePhoto(mockLargePhotoUri);
      expect(result.size).toBeLessThan(2 * 1024 * 1024);
    });

    it('should generate thumbnail at 400px width', async () => {
      const result = await photoService.optimizePhoto(mockPhotoUri);
      expect(result.thumbnail).toBeDefined();
      // Verify thumbnail dimensions
    });

    it('should handle optimization errors gracefully', async () => {
      await expect(
        photoService.optimizePhoto('invalid://uri')
      ).rejects.toThrow(MediaError);
    });
  });
});
```

**mediaUploadService.test.ts:**
```typescript
describe('MediaUploadService', () => {
  describe('Phase 1 - Local Storage', () => {
    beforeEach(() => {
      mediaUploadService.disableS3();
    });

    it('should return local URI when S3 disabled', async () => {
      const result = await mediaUploadService.uploadToBackend(
        'file:///photo.jpg',
        'photo'
      );
      expect(result.url).toStartWith('file://');
      expect(result.key).toBeUndefined();
    });
  });

  describe('Phase 2 - S3 Upload', () => {
    beforeEach(() => {
      mediaUploadService.enableS3();
      mockApiPost.mockResolvedValue({
        data: {
          url: 'https://s3.amazonaws.com/bucket/key',
          key: 'incidents/uuid/photo.jpg'
        }
      });
    });

    it('should upload to S3 when enabled', async () => {
      const result = await mediaUploadService.uploadToBackend(
        'file:///photo.jpg',
        'photo'
      );
      expect(result.url).toStartWith('https://');
      expect(result.key).toBe('incidents/uuid/photo.jpg');
      expect(mockApiPost).toHaveBeenCalledWith(
        '/media/upload',
        expect.any(FormData)
      );
    });
  });
});
```

### Integration Tests

**incident-photo-flow.test.tsx:**
```typescript
describe('Incident Photo Flow', () => {
  it('should capture, optimize, and submit incident with photo', async () => {
    const { getByText, getByTestId } = render(<IncidentForm />);

    // Mock camera capture
    mockCameraCapture('file:///tmp/camera/photo.jpg');

    // Capture photo
    fireEvent.press(getByText('Capture Photo'));

    // Wait for optimization
    await waitFor(() => {
      expect(getByTestId('photo-thumbnail')).toBeTruthy();
    });

    // Fill form
    fireEvent.changeText(getByTestId('description-input'), 'Test incident');

    // Submit
    fireEvent.press(getByText('Submit'));

    // Verify incident saved with photo
    await waitFor(() => {
      expect(mockDatabaseSave).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: [expect.stringContaining('file://')]
        })
      );
    });
  });
});
```

### Manual Testing Checklist

**Photo Capture:**
- [ ] Camera permission prompt appears
- [ ] Camera launches successfully
- [ ] Photo captured and displayed as thumbnail
- [ ] Photo optimized to <2MB
- [ ] Thumbnail generated correctly
- [ ] Multiple photos can be captured
- [ ] Photos can be removed before submit

**Offline Functionality:**
- [ ] Photos captured when offline
- [ ] Incident submitted when offline
- [ ] Sync status shows "pending"
- [ ] Sync triggers when back online
- [ ] Photos uploaded successfully
- [ ] Sync status shows "synced"

**S3 Integration (Phase 2):**
- [ ] S3 upload triggered correctly
- [ ] Progress indicator shows upload status
- [ ] S3 URL saved in database
- [ ] Photo accessible from backend
- [ ] CDN delivery working
- [ ] Fallback to local if S3 fails

---

## Monitoring & Logging

### Log Levels

```typescript
// logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;

  debug(message: string, data?: any) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  info(message: string, data?: any) {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, data);
    }
  }

  warn(message: string, data?: any) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, data);
    }
  }

  error(message: string, data?: any) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, data);
    }
    // Send to error tracking service (Sentry, etc.)
    this.reportToSentry(message, data);
  }
}
```

### Key Metrics to Track

**Photo Operations:**
```typescript
logger.info('[PhotoService] Photo captured', {
  uri: photo.uri,
  timestamp: Date.now()
});

logger.info('[PhotoService] Optimization complete', {
  originalSize: 5400000,
  optimizedSize: 1800000,
  compressionRatio: 0.67,
  duration: 850  // ms
});
```

**Upload Operations:**
```typescript
logger.info('[MediaUploadService] Starting upload', {
  fileUri,
  type,
  useS3: this.useS3
});

logger.info('[MediaUploadService] Upload complete', {
  url: result.url,
  size: result.size,
  duration: 1200  // ms
});
```

**Sync Operations:**
```typescript
logger.info('[SyncService] Sync started', {
  queueSize: items.length,
  timestamp: Date.now()
});

logger.info('[SyncService] Item synced', {
  entityType: 'incidents',
  entityId: item.id,
  attempts: item.attempts
});

logger.error('[SyncService] Sync failed', {
  entityType: 'incidents',
  entityId: item.id,
  attempts: item.attempts,
  error: error.message
});
```

---

## Future Enhancements

### Planned Features

1. **Video Capture & Upload**
   - Video recording within incident form
   - Video compression and optimization
   - Streaming upload for large files
   - Thumbnail generation from video frames

2. **Voice Note Recording**
   - Audio recording for incident notes
   - Audio compression (M4A format)
   - Waveform visualization
   - Playback controls

3. **Image Annotation**
   - Draw on captured photos
   - Add text labels
   - Highlight areas of interest
   - Save annotated version

4. **OCR Integration**
   - Extract text from photos
   - Auto-fill incident details from signs/documents
   - License plate recognition
   - ID card scanning

5. **Advanced Compression**
   - WebP format support (smaller files)
   - Progressive JPEG encoding
   - Adaptive quality based on content
   - HEIC format support (iOS)

6. **Cloud Backup**
   - Automatic backup to user's cloud storage
   - Google Drive / iCloud integration
   - Backup scheduling
   - Restore from backup

7. **Media Library**
   - Browse all captured photos/videos
   - Search and filter
   - Bulk operations
   - Usage statistics

---

## Conclusion

This architecture provides a robust, scalable, and maintainable foundation for photo and video management in the mobile application. Key strengths:

✅ **Offline-First**: Works seamlessly without network
✅ **Progressive Enhancement**: Local storage NOW, S3 LATER
✅ **Type-Safe**: Full TypeScript implementation
✅ **Abstraction**: Single toggle for storage backend
✅ **Optimized**: Automatic compression to <2MB
✅ **Resilient**: Queue-based sync with retry logic
✅ **Secure**: Proper permissions and encryption
✅ **Testable**: Clear separation of concerns

The system is production-ready for Phase 1 (local storage) and designed for seamless transition to Phase 2 (S3 storage) with minimal code changes.

---

## Related Documentation

- **S3 Implementation Guide**: `/docs/mobile-s3-media-upload-guide.md`
- **API Documentation**: `/database_schema/api_endpoints_documentation.md`
- **Database Models**: `/docs/models_documentation.md`
- **Frontend Model Analysis**: `/docs/frontend_model_analysis.md`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-25
**Author**: Claude Code
**Status**: Complete
