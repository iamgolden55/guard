---
date: 2025-10-25T13:50:13Z
researcher: Claude Code
git_commit: bf03d58d758283f99a8242c5bbe8301aea9e0689
branch: main
repository: mead-security/remix2
topic: "Mobile App Incident Report vs Backend Storage Capability Gap Analysis"
tags: [research, incident-reports, mobile-app, backend, data-model, gap-analysis]
status: complete
last_updated: 2025-10-25
last_updated_by: Claude Code
---

# Research: Mobile App Incident Report vs Backend Storage Capability Gap Analysis

**Date**: 2025-10-25T13:50:13Z
**Researcher**: Claude Code
**Git Commit**: bf03d58d758283f99a8242c5bbe8301aea9e0689
**Branch**: main
**Repository**: mead-security/remix2

## Research Question

The mobile app collects extensive incident report data including voice recordings, photos, videos, witness information, GPS coordinates, and detailed metadata. Does the current backend database schema support storing all this information, and what gaps exist between what the mobile app collects and what the backend can store?

## Executive Summary

**Critical Finding**: The mobile app's incident reporting capabilities are **significantly more comprehensive** than what the backend can currently store. The backend `IncidentReport` model is missing **10 critical fields** that the mobile app collects, and there are **NO API endpoints or serializers** implemented for incident reports.

**Impact**: All the valuable data collected by the mobile app (voice recordings, photos, videos, witness names, GPS coordinates, emergency service notifications, and incident types) **cannot be saved to the backend** and will be lost.

**Urgency**: HIGH - Staff are currently using the mobile app to report incidents, but this data is only stored locally on their devices and will not sync to the central database.

## Detailed Findings

### Mobile App Incident Data Collection

**Location**: `/mobile/src/types/incident.ts`, `/mobile/src/screens/incidents/IncidentFormScreen.tsx`, `/mobile/src/screens/incidents/VoiceReportScreen.tsx`

The mobile app collects the following comprehensive incident data:

#### Basic Information
- `incident_type`: IncidentType enum with 7 options
  - 'security_breach'
  - 'medical_emergency'
  - 'fire_alarm'
  - 'suspicious_activity'
  - 'property_damage'
  - 'assault'
  - 'other'
- `severity`: IncidentSeverity ('low' | 'medium' | 'high' | 'critical')
- `title`: string (max 100 chars) - Brief summary
- `description`: string - Detailed description
- `shift`: number (optional) - Associated shift ID

#### Location Data
- `location_description`: string - Human-readable location ("Floor 2 restroom")
- `latitude`: number (optional) - GPS coordinate
- `longitude`: number (optional) - GPS coordinate
- GPS coordinates automatically captured at time of reporting

#### Temporal Data
- `occurred_at`: string (ISO timestamp) - When incident happened
- `reported_at`: string (ISO timestamp) - When it was reported

#### Evidence Collection
- `photos`: string[] (array) - Multiple photo URIs
- `videos`: string[] (array) - Multiple video URIs
- `voice_note`: string - Audio recording URI
- Camera integration for capturing incident photos (`mobile/src/components/camera/CameraView.tsx`)
- Voice recording with duration tracking (`VoiceReportScreen.tsx`)

#### People Involved
- `witnesses`: string[] (array) - Comma-separated witness names
- `persons_involved`: string[] (array) - People involved in incident

#### Actions Taken
- `actions_taken`: string (optional) - Description of response
- `police_notified`: boolean - Whether police were called
- `ambulance_called`: boolean - Whether ambulance was called

#### Status Tracking
- `status`: 'draft' | 'submitted' | 'under_review' | 'resolved'
- `sync_status`: 'pending' | 'synced' | 'failed'

### Backend IncidentReport Model

**Location**: `/backend/api/models.py:2672-2704`

Current backend fields:

```python
class IncidentReport(models.Model):
    SEVERITY_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    )

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE)
    incident_time = models.DateTimeField()
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS)
    actions_taken = models.TextField()
    requires_followup = models.BooleanField(default=False)
    followup_notes = models.TextField(null=True, blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Critical Gaps Identified

#### 1. **Missing Core Fields** (10 fields)

| Mobile App Field | Backend Field | Status | Impact |
|-----------------|---------------|---------|--------|
| `title` | ❌ Missing | **CRITICAL** | No brief summary stored |
| `incident_type` | ❌ Missing | **CRITICAL** | Cannot categorize incidents by type |
| `location_description` | ❌ Missing | **HIGH** | Lose human-readable location detail |
| `latitude` | ❌ Missing | **HIGH** | GPS evidence lost |
| `longitude` | ❌ Missing | **HIGH** | GPS evidence lost |
| `occurred_at` | Only `incident_time` | **MEDIUM** | Lose distinction between occurrence and reporting time |
| `reported_at` | Uses `created_at` | **LOW** | Approximated by created_at |
| `witnesses` | ❌ Missing | **CRITICAL** | Witness information lost |
| `persons_involved` | ❌ Missing | **CRITICAL** | Key incident data lost |
| `police_notified` | ❌ Missing | **HIGH** | Emergency response tracking lost |
| `ambulance_called` | ❌ Missing | **HIGH** | Emergency response tracking lost |

#### 2. **Missing Media/Evidence Storage** (3 field types)

| Evidence Type | Mobile Collection | Backend Storage | Status |
|--------------|-------------------|-----------------|---------|
| Photos | ✅ Array of URIs | ❌ No field | **CRITICAL** |
| Videos | ✅ Array of URIs | ❌ No field | **CRITICAL** |
| Voice Notes | ✅ Audio recording | ❌ No field | **CRITICAL** |

**Impact**: All photographic, video, and voice evidence collected in the field is lost. This is a severe legal and operational liability.

#### 3. **Missing API Implementation**

**Search Results**:
- ❌ No serializers found for IncidentReport
- ❌ No API endpoints at `/api/v1/incidents/`
- ❌ No ViewSets or views for incident management
- ✅ Model exists but is not exposed via API

**Impact**: Even if the mobile app tried to submit data, there's no backend endpoint to receive it.

**Mobile Service**: `mobile/src/services/incidentService.ts:16-44` attempts to POST to `/incidents/` but this endpoint doesn't exist.

#### 4. **Field Type Mismatches**

| Field | Mobile Type | Backend Type | Issue |
|-------|-------------|--------------|-------|
| `actions_taken` | Optional string | Required TextField | Mobile allows blank, backend requires value |
| `shift` | Optional FK | Required FK | Mobile allows incidents without shifts, backend requires it |
| `venue` | Derived from shift | Required FK | Mobile doesn't collect venue directly |

### Architecture Insights

#### Mobile App Design Patterns

1. **Offline-First Architecture** (`incidentService.ts:20-26`)
   - Incidents saved to local SQLite database first
   - Added to sync queue with priority based on severity
   - Critical incidents get priority 0, others priority 1
   - Automatic background sync when online

2. **Evidence Collection System**
   - Camera component reusable for multiple purposes (`CameraView.tsx:26`)
   - Voice recording with visual feedback and duration tracking
   - High-quality audio recording (expo-av preset)
   - Automatic GPS capture on form load

3. **User Experience**
   - Voice-only incident reporting option for hands-free use
   - Clear severity indicators with color coding
   - Form validation prevents submission of incomplete data
   - Emergency service toggles for quick documentation

#### Backend Design Gaps

1. **No Media Handling Infrastructure**
   - No file upload endpoints
   - No media storage configuration (S3, CloudFront, etc.)
   - No thumbnail generation or media processing
   - No evidence retrieval API

2. **No Structured Witness/Person Tracking**
   - Could benefit from separate Witness model
   - PersonInvolved model for better data structure
   - Enables future features like witness statement collection

3. **Missing Location Services Integration**
   - Backend doesn't validate GPS coordinates
   - No geofencing to verify incident at correct venue
   - No location-based incident clustering/analysis

## Recommendations

### Phase 1: Immediate Backend Model Updates (CRITICAL)

Update `IncidentReport` model to include all mobile app fields:

```python
class IncidentReport(models.Model):
    INCIDENT_TYPES = (
        ('security_breach', 'Security Breach'),
        ('medical_emergency', 'Medical Emergency'),
        ('fire_alarm', 'Fire Alarm'),
        ('suspicious_activity', 'Suspicious Activity'),
        ('property_damage', 'Property Damage'),
        ('assault', 'Assault'),
        ('other', 'Other'),
    )

    SEVERITY_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    )

    # Existing fields (keep all)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, null=True, blank=True)
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, null=True, blank=True)

    # NEW: Core fields from mobile
    incident_type = models.CharField(max_length=30, choices=INCIDENT_TYPES)
    title = models.CharField(max_length=100)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS)

    # NEW: Location fields
    location_description = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # NEW: Temporal fields
    occurred_at = models.DateTimeField()
    reported_at = models.DateTimeField()

    # NEW: People involved (stored as JSON arrays)
    witnesses = models.JSONField(default=list, blank=True)
    persons_involved = models.JSONField(default=list, blank=True)

    # Existing/updated action fields
    actions_taken = models.TextField(blank=True, null=True)
    police_notified = models.BooleanField(default=False)
    ambulance_called = models.BooleanField(default=False)

    # Existing status fields
    requires_followup = models.BooleanField(default=False)
    followup_notes = models.TextField(null=True, blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_incidents')

    # Status tracking
    status = models.CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('resolved', 'Resolved'),
    ], default='submitted')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Phase 2: Evidence Storage Models (CRITICAL)

Create separate models for media evidence:

```python
class IncidentEvidence(models.Model):
    EVIDENCE_TYPES = (
        ('photo', 'Photo'),
        ('video', 'Video'),
        ('audio', 'Audio/Voice Note'),
    )

    incident = models.ForeignKey(IncidentReport, on_delete=models.CASCADE, related_name='evidence')
    evidence_type = models.CharField(max_length=10, choices=EVIDENCE_TYPES)
    file = models.FileField(upload_to='incident_evidence/%Y/%m/%d/')
    thumbnail = models.ImageField(upload_to='incident_evidence/thumbnails/%Y/%m/%d/', null=True, blank=True)
    file_size = models.IntegerField()
    duration = models.IntegerField(null=True, blank=True)  # For audio/video in seconds
    caption = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        db_table = 'incident_evidence'
        ordering = ['uploaded_at']
```

### Phase 3: API Implementation (CRITICAL)

1. **Create Serializers** (`backend/api/serializers.py`)
   - IncidentReportSerializer with nested evidence
   - IncidentEvidenceSerializer for media uploads
   - Read/write serializer separation for complex fields

2. **Create ViewSets** (`backend/api/views.py` or new `backend/incidents/views.py`)
   - CRUD operations for incidents
   - Filtering by severity, type, status, shift, venue
   - Evidence upload endpoint with multipart/form-data
   - Bulk operations for syncing multiple incidents

3. **URL Routing** (`backend/core/urls.py`)
   ```python
   router.register(r'incidents', IncidentViewSet, basename='incident')
   # POST /api/v1/incidents/
   # GET /api/v1/incidents/
   # GET /api/v1/incidents/{id}/
   # PATCH /api/v1/incidents/{id}/
   # POST /api/v1/incidents/{id}/evidence/
   ```

### Phase 4: Enhanced Features (RECOMMENDED)

1. **Geofencing Validation**
   - Validate incident GPS coordinates are within venue radius
   - Flag suspicious location discrepancies
   - Enable location-based incident clustering

2. **Witness Management System**
   - Separate Witness model with contact details
   - Link witnesses to multiple incidents
   - Enable witness statement collection workflow

3. **Media Processing Pipeline**
   - Automatic thumbnail generation for photos
   - Video compression and transcoding
   - Voice note transcription for searchability
   - S3/CloudFront CDN integration for media delivery

4. **Analytics & Reporting**
   - Incident heat maps by location
   - Trend analysis by type and severity
   - Response time tracking (occurred_at → reported_at → resolved_at)
   - Emergency service utilization metrics

## Code References

### Mobile App
- **Incident Type Definition**: `mobile/src/types/incident.ts:1-51`
- **Form Screen**: `mobile/src/screens/incidents/IncidentFormScreen.tsx:31-376`
- **Voice Report Screen**: `mobile/src/screens/incidents/VoiceReportScreen.tsx:23-253`
- **Incident Service**: `mobile/src/services/incidentService.ts:12-81`
- **Camera Component**: `mobile/src/components/camera/CameraView.tsx:23-335`
- **Database Schema**: `mobile/src/services/database.ts` (SQLite schema for offline storage)
- **Sync Service**: `mobile/src/services/syncService.ts` (offline sync queue)

### Backend
- **Current Model**: `backend/api/models.py:2672-2704`
- **Migration**: `backend/api/migrations/0002_capacityflow_incidentreport_latenessrecord_and_more.py:72-153`
- **Admin Registration**: `backend/api/admin.py` (check if IncidentReport is registered)

## Related Research

- `thoughts/shared/research/2025-10-XX-mobile-offline-sync-architecture.md` (if exists)
- `docs/mobile-build-knowlege/PHASE_2_OFFLINE_IMPLEMENTATION.md`

## Open Questions

1. **Media Storage Strategy**:
   - Should we use AWS S3, Google Cloud Storage, or local file storage?
   - What's the retention policy for incident media?
   - Do we need GDPR-compliant deletion workflows for evidence?

2. **Witness Data Privacy**:
   - Should witness names be encrypted at rest?
   - What consent is required for storing witness information?
   - How long do we retain witness data?

3. **API Performance**:
   - Should evidence upload be separate from incident creation?
   - Do we need chunked upload for large videos?
   - What's the max file size limit for uploads?

4. **Sync Conflict Resolution**:
   - How do we handle conflicts if incident is edited on mobile and backend?
   - Should critical incidents bypass queue and sync immediately?
   - What happens to local incidents if sync fails repeatedly?

5. **Historical Data**:
   - Are there existing incidents in local databases that need migration?
   - Do we need a bulk import process for backfilling historical incidents?

## Implementation Priority

**IMMEDIATE (This Week)**:
1. Create database migration to add missing fields to IncidentReport
2. Create IncidentEvidence model for media storage
3. Set up basic media storage (S3 or local for MVP)

**URGENT (Next Sprint)**:
1. Implement IncidentReport serializers and viewsets
2. Create API endpoints for incident CRUD operations
3. Implement evidence upload endpoint
4. Test mobile app sync with new backend

**IMPORTANT (Following Sprint)**:
1. Add geofencing validation
2. Implement analytics queries
3. Create admin interface for incident management
4. Add witness management system

**NICE-TO-HAVE (Future)**:
1. Voice note transcription
2. Incident heat maps
3. Automated incident clustering
4. Integration with external incident reporting systems

---

## Conclusion

The mobile app has built a sophisticated, production-ready incident reporting system with offline capabilities, multimedia evidence collection, and comprehensive data capture. However, the backend is **not ready to receive this data**.

**Critical Action Required**: Implement the recommended backend changes immediately to prevent data loss and enable the full incident reporting workflow. The gap between mobile capabilities and backend storage is significant and poses a risk to operational efficiency and legal compliance.

Without these changes, staff will continue reporting incidents on mobile devices, but this valuable data will remain trapped in local SQLite databases and will not be accessible to management, will not sync across devices, and will be lost if devices are replaced or reset.
