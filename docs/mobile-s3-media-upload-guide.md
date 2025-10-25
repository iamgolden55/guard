# Complete S3 Media Upload Implementation Guide

**Created**: 2025-10-25
**Status**: Implementation Ready
**Current State**: Local storage (works NOW)
**Future State**: AWS S3 storage (easy migration)

---

## Table of Contents

1. [Overview](#overview)
2. [Current Architecture (Phase 1)](#current-architecture-phase-1)
3. [AWS S3 Setup (Phase 2)](#aws-s3-setup-phase-2)
4. [Backend Implementation (Phase 3)](#backend-implementation-phase-3)
5. [Mobile Configuration (Phase 4)](#mobile-configuration-phase-4)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Performance Optimization](#performance-optimization)

---

## Overview

### System Design Philosophy

The media upload system is designed with a **progressive enhancement** approach:

**Phase 1 (NOW)**: Local storage
- Photos/videos stored on device
- Works offline-first
- Zero configuration needed
- ✅ **IMPLEMENTED**

**Phase 2 (FUTURE)**: AWS S3 storage
- Backend uploads to S3
- Mobile sends to backend
- CDN delivery
- 🔄 **EASY TO ENABLE**

### Key Benefits

✅ **Works immediately** - No S3 required to start
✅ **S3-ready** - Single function call to enable S3
✅ **Offline-first** - Syncs when connection available
✅ **Scalable** - Handles large files efficiently
✅ **Flexible** - Easy to swap storage providers later

---

## Current Architecture (Phase 1)

### How It Works NOW

```
Mobile App
    ↓
1. Capture photo/video
    ↓
2. Optimize locally (photoService)
    ↓
3. Process through mediaUploadService
    ↓
4. Returns local file URI
    ↓
5. Save to SQLite with sync_status='pending'
    ↓
6. Sync to backend when online
```

### Files Involved

**Media Upload Service**
`/mobile/src/services/mediaUploadService.ts`
- Abstraction layer for uploads
- Currently returns local URIs
- S3-ready architecture

**Incident Service**
`/mobile/src/services/incidentService.ts`
- Processes photos/videos before submission
- Uses mediaUploadService
- Handles offline sync

**Photo Service**
`/mobile/src/services/photoService.ts`
- Optimizes photos (<2MB)
- Generates thumbnails
- Manages local storage

### Current Configuration

```typescript
// mediaUploadService.ts
class MediaUploadService {
  private useS3 = false; // ← Currently false (local storage)

  async uploadToBackend(fileUri: string, type: MediaType): Promise<UploadResult> {
    // Returns local URI for now
    if (!this.useS3) {
      return {
        url: fileUri,
        type,
        size: fileInfo.size || 0,
        uploadedAt: new Date().toISOString(),
      };
    }

    // S3 upload logic ready but not enabled
    return await this.uploadToS3(fileUri, type);
  }
}
```

---

## AWS S3 Setup (Phase 2)

### Prerequisites

- AWS Account
- AWS CLI installed (optional but helpful)
- Access to create IAM users and S3 buckets

### Step 1: Create S3 Bucket

**Via AWS Console:**

1. Go to **AWS Console** → **S3**
2. Click **Create bucket**
3. **Bucket name**: `mead-security-incidents` (must be globally unique)
4. **Region**: `us-east-1` (or your preferred region)
5. **Block Public Access settings**:
   - ✅ **Uncheck** "Block all public access" (for public read)
   - Or configure bucket policy for authenticated access
6. **Bucket Versioning**: Enable (optional, for backup)
7. **Default encryption**: Enable AES-256
8. Click **Create bucket**

**Via AWS CLI:**
```bash
aws s3api create-bucket \
  --bucket mead-security-incidents \
  --region us-east-1 \
  --acl private

aws s3api put-bucket-versioning \
  --bucket mead-security-incidents \
  --versioning-configuration Status=Enabled
```

### Step 2: Configure CORS

Required for browser/mobile app uploads (if using presigned URLs later):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Apply via AWS Console:**
1. Go to your bucket
2. **Permissions** → **CORS configuration**
3. Paste the JSON above
4. Save changes

**Apply via AWS CLI:**
```bash
aws s3api put-bucket-cors \
  --bucket mead-security-incidents \
  --cors-configuration file://cors-config.json
```

### Step 3: Create IAM User for Backend

Create dedicated IAM user for backend uploads:

**Via AWS Console:**
1. **IAM** → **Users** → **Add users**
2. **User name**: `mead-security-upload`
3. **Access type**: ✅ Programmatic access
4. **Permissions**: Attach existing policies
   - Option A: `AmazonS3FullAccess` (simple, less secure)
   - Option B: Custom policy (recommended, see below)
5. **Review** → **Create user**
6. **Save Access Key ID and Secret Access Key** ⚠️ (won't be shown again)

**Custom IAM Policy (Recommended):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mead-security-incidents",
        "arn:aws:s3:::mead-security-incidents/*"
      ]
    }
  ]
}
```

### Step 4: Optional - CloudFront CDN

For faster global delivery (optional but recommended):

1. **CloudFront** → **Create Distribution**
2. **Origin Domain**: Select your S3 bucket
3. **Origin Access**: Public or use OAI
4. **Viewer Protocol Policy**: Redirect HTTP to HTTPS
5. **Price Class**: Select based on budget
6. **Create Distribution**
7. Note the **Distribution Domain Name** (e.g., `d111111abcdef8.cloudfront.net`)

---

## Backend Implementation (Phase 3)

### Step 1: Install Dependencies

```bash
cd backend
pip install boto3
pip install python-decouple  # For environment variables
```

Update `requirements.txt`:
```txt
boto3==1.35.0
python-decouple==3.8
```

### Step 2: Configure Settings

**backend/.env**:
```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_STORAGE_BUCKET_NAME=mead-security-incidents
AWS_S3_REGION_NAME=us-east-1

# Optional: CloudFront CDN
AWS_CLOUDFRONT_DOMAIN=d111111abcdef8.cloudfront.net
```

**backend/core/settings.py**:
```python
from decouple import config

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='mead-security-incidents')
AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='us-east-1')
AWS_S3_CUSTOM_DOMAIN = config(
    'AWS_CLOUDFRONT_DOMAIN',
    default=f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
)

# S3 URL expiration for presigned URLs (optional)
AWS_PRESIGNED_EXPIRY = 3600  # 1 hour

# Maximum upload file size (20MB)
MAX_UPLOAD_SIZE = 20 * 1024 * 1024
```

### Step 3: Create S3 Upload Service

**backend/api/services/s3_service.py** (NEW FILE):
```python
"""
S3 Upload Service
Handles file uploads to AWS S3
"""

import boto3
import uuid
import mimetypes
from datetime import datetime
from django.conf import settings
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)


class S3UploadService:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        self.cdn_domain = settings.AWS_S3_CUSTOM_DOMAIN

    def upload_incident_media(self, file, media_type='photo'):
        """
        Upload incident photo/video to S3

        Args:
            file: Django UploadedFile object
            media_type: 'photo', 'video', or 'voice'

        Returns:
            dict: {'url': str, 'key': str, 'size': int}
        """
        try:
            # Generate unique key
            file_extension = self._get_extension(file.name)
            timestamp = datetime.now().strftime('%Y/%m/%d')
            unique_id = uuid.uuid4().hex
            s3_key = f'incidents/{timestamp}/{media_type}/{unique_id}{file_extension}'

            # Get content type
            content_type = self._get_content_type(file.name, media_type)

            # Upload to S3
            logger.info(f'Uploading to S3: {s3_key}')
            self.s3_client.upload_fileobj(
                file,
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'ContentType': content_type,
                    'CacheControl': 'max-age=31536000',  # 1 year
                    # Uncomment for public read access:
                    # 'ACL': 'public-read'
                }
            )

            # Generate URL
            url = self._generate_url(s3_key)

            logger.info(f'Upload successful: {url}')
            return {
                'url': url,
                'key': s3_key,
                'size': file.size,
            }

        except ClientError as e:
            logger.error(f'S3 upload failed: {e}')
            raise Exception(f'Failed to upload to S3: {str(e)}')

    def delete_file(self, s3_key):
        """Delete file from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            logger.info(f'Deleted from S3: {s3_key}')
        except ClientError as e:
            logger.error(f'S3 delete failed: {e}')
            raise Exception(f'Failed to delete from S3: {str(e)}')

    def generate_presigned_url(self, s3_key, expiration=3600):
        """Generate presigned URL for temporary access"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            logger.error(f'Presigned URL generation failed: {e}')
            return None

    def _generate_url(self, s3_key):
        """Generate public URL for uploaded file"""
        if settings.AWS_CLOUDFRONT_DOMAIN:
            return f'https://{settings.AWS_CLOUDFRONT_DOMAIN}/{s3_key}'
        return f'https://{self.bucket_name}.s3.amazonaws.com/{s3_key}'

    def _get_extension(self, filename):
        """Extract file extension"""
        if '.' in filename:
            return '.' + filename.rsplit('.', 1)[1].lower()
        return ''

    def _get_content_type(self, filename, media_type):
        """Determine content type"""
        content_type, _ = mimetypes.guess_type(filename)

        if content_type:
            return content_type

        # Fallback based on media type
        type_map = {
            'photo': 'image/jpeg',
            'video': 'video/mp4',
            'voice': 'audio/m4a',
        }
        return type_map.get(media_type, 'application/octet-stream')


# Singleton instance
s3_service = S3UploadService()
```

### Step 4: Create Media Upload API Endpoint

**backend/api/views.py** (add this):
```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from .services.s3_service import s3_service
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_media(request):
    """
    Upload incident media (photo/video/voice) to S3

    POST /api/v1/media/upload

    Form Data:
        file: File to upload
        type: 'photo' | 'video' | 'voice'

    Returns:
        {
            "url": "https://cdn.example.com/incidents/2025/10/25/photo/abc123.jpg",
            "key": "incidents/2025/10/25/photo/abc123.jpg",
            "size": 1048576,
            "uploaded_at": "2025-10-25T10:30:00Z"
        }
    """
    try:
        # Validate file
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate media type
        media_type = request.data.get('type', 'photo')
        if media_type not in ['photo', 'video', 'voice']:
            return Response(
                {'error': 'Invalid media type. Must be photo, video, or voice'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size
        if file.size > settings.MAX_UPLOAD_SIZE:
            return Response(
                {'error': f'File too large. Maximum size is {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            )

        logger.info(f'Uploading {media_type}: {file.name} ({file.size} bytes) for user {request.user.id}')

        # Upload to S3
        result = s3_service.upload_incident_media(file, media_type)

        # Add timestamp
        result['uploaded_at'] = datetime.now().isoformat()

        return Response(result, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f'Media upload failed: {e}')
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_media(request):
    """
    Delete media from S3

    DELETE /api/v1/media/delete?url=https://...
    """
    try:
        url = request.query_params.get('url')
        if not url:
            return Response(
                {'error': 'No URL provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract S3 key from URL
        # Example: https://bucket.s3.amazonaws.com/incidents/2025/10/25/photo/abc123.jpg
        #       → incidents/2025/10/25/photo/abc123.jpg
        s3_key = url.split('.com/')[-1] if '.com/' in url else url

        logger.info(f'Deleting media: {s3_key} for user {request.user.id}')

        s3_service.delete_file(s3_key)

        return Response({'message': 'Media deleted successfully'}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f'Media deletion failed: {e}')
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

### Step 5: Register URL Routes

**backend/core/urls.py**:
```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api import views

router = DefaultRouter()
# ... existing routes ...

urlpatterns = [
    # ... existing patterns ...

    # Media upload endpoints
    path('api/v1/media/upload', views.upload_media, name='media-upload'),
    path('api/v1/media/delete', views.delete_media, name='media-delete'),

    # ... rest of patterns ...
]
```

### Step 6: Test Backend Locally

```bash
# Start Django server
cd backend
python manage.py runserver

# Test upload with curl (replace TOKEN with real JWT token)
curl -X POST http://localhost:8000/api/v1/media/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/test-photo.jpg" \
  -F "type=photo"

# Expected response:
# {
#   "url": "https://mead-security-incidents.s3.amazonaws.com/incidents/2025/10/25/photo/abc123.jpg",
#   "key": "incidents/2025/10/25/photo/abc123.jpg",
#   "size": 1048576,
#   "uploaded_at": "2025-10-25T10:30:00Z"
# }
```

---

## Mobile Configuration (Phase 4)

### Enable S3 Uploads

**Single line change!**

**Option 1: Enable Globally**
```typescript
// mobile/src/App.tsx or mobile/src/index.ts
import { mediaUploadService } from './services/mediaUploadService';

// Enable S3 uploads when app starts
mediaUploadService.enableS3();
```

**Option 2: Enable Conditionally (Recommended)**
```typescript
// mobile/src/services/config.ts
import { mediaUploadService } from './mediaUploadService';

// Enable S3 based on environment or feature flag
const ENABLE_S3 = __DEV__ ? false : true; // Disable in dev, enable in production

if (ENABLE_S3) {
  mediaUploadService.enableS3();
  console.log('[Config] S3 uploads ENABLED');
} else {
  console.log('[Config] Using local storage');
}
```

**Option 3: Remote Feature Flag**
```typescript
// Check backend for feature flag
const checkS3Availability = async () => {
  try {
    const response = await api.get('/config/features');
    if (response.data.s3_enabled) {
      mediaUploadService.enableS3();
    }
  } catch (error) {
    // Fallback to local storage
    console.warn('[Config] S3 check failed, using local storage');
  }
};
```

### That's It!

No other mobile code changes needed! The `mediaUploadService` automatically:
- Detects if S3 is enabled
- Uploads to backend → S3 when enabled
- Falls back to local storage if disabled
- Handles errors gracefully

---

## Testing Guide

### Testing Checklist

#### Backend Tests

- [ ] **AWS Credentials Valid**
  ```bash
  aws s3 ls s3://mead-security-incidents --profile YOUR_PROFILE
  ```

- [ ] **Upload Endpoint Works**
  ```bash
  curl -X POST http://localhost:8000/api/v1/media/upload \
    -H "Authorization: Bearer TOKEN" \
    -F "file=@test.jpg" \
    -F "type=photo"
  ```

- [ ] **File Appears in S3**
  ```bash
  aws s3 ls s3://mead-security-incidents/incidents/ --recursive
  ```

- [ ] **URL is Accessible**
  ```bash
  curl -I "https://mead-security-incidents.s3.amazonaws.com/incidents/.../photo.jpg"
  ```

- [ ] **Delete Endpoint Works**
  ```bash
  curl -X DELETE "http://localhost:8000/api/v1/media/delete?url=..." \
    -H "Authorization: Bearer TOKEN"
  ```

#### Mobile Tests

- [ ] **Photo Capture Works (Local Mode)**
  ```typescript
  mediaUploadService.disableS3();
  // Capture photo → should return local URI
  ```

- [ ] **Photo Upload Works (S3 Mode)**
  ```typescript
  mediaUploadService.enableS3();
  // Capture photo → should upload to S3 and return S3 URL
  ```

- [ ] **Video Upload Works**
  - Record video → Check S3 for file

- [ ] **Offline Behavior**
  - Disable network → Capture photo → Should queue for sync
  - Enable network → Should upload to S3

- [ ] **Error Handling**
  - Invalid credentials → Falls back to local
  - Network timeout → Retries upload
  - Large file → Shows progress indicator

#### End-to-End Test Script

```typescript
// mobile/src/__tests__/s3-integration.test.ts
import { mediaUploadService } from '../services/mediaUploadService';
import { incidentService } from '../services/incidentService';

describe('S3 Integration', () => {
  it('should upload photo to S3 and save URL', async () => {
    // Enable S3
    mediaUploadService.enableS3();

    // Submit incident with photo
    const incident = await incidentService.submitIncident({
      incident_type: 'test',
      severity: 'low',
      title: 'Test Incident',
      description: 'Testing S3 upload',
      photos: ['/path/to/local/photo.jpg'],
    });

    // Check that photo URL is S3 URL
    expect(incident.photos[0]).toContain('s3.amazonaws.com');
    expect(incident.photos[0]).toContain('incidents/');
  });

  it('should fall back to local storage if S3 fails', async () => {
    // Disable S3
    mediaUploadService.disableS3();

    // Submit incident
    const incident = await incidentService.submitIncident({
      incident_type: 'test',
      severity: 'low',
      title: 'Test Incident',
      description: 'Testing local storage',
      photos: ['/path/to/local/photo.jpg'],
    });

    // Check that photo URL is local URI
    expect(incident.photos[0]).toContain('file://');
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Access Denied" Error

**Symptom:** S3 upload fails with 403 Access Denied

**Solutions:**
```bash
# Check IAM policy
aws iam get-user-policy --user-name mead-security-upload --policy-name S3UploadPolicy

# Verify credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://mead-security-incidents
```

#### 2. "Bucket Not Found" Error

**Symptom:** S3 upload fails with 404 bucket not found

**Solutions:**
- Verify bucket name in settings matches actual bucket
- Check bucket region matches configuration
- Ensure bucket exists: `aws s3 ls`

#### 3. CORS Errors (Browser/Mobile)

**Symptom:** "No 'Access-Control-Allow-Origin' header"

**Solution:** Add CORS configuration (see Step 2 above)

#### 4. File Too Large

**Symptom:** Upload fails with 413 error

**Solutions:**
- Increase `MAX_UPLOAD_SIZE` in Django settings
- Configure nginx/ALB upload limits
- Implement chunked uploads for videos

#### 5. Slow Uploads

**Symptom:** Uploads take too long

**Solutions:**
- Use CloudFront for CDN
- Enable multipart uploads for files >5MB
- Compress photos before upload (already implemented in photoService)
- Use S3 Transfer Acceleration

### Debug Mode

Enable verbose logging:

**Backend:**
```python
# settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'api.services.s3_service': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

**Mobile:**
```typescript
// services/mediaUploadService.ts
// Uncomment logger.info() calls to see detailed logs
```

---

## Performance Optimization

### Backend Optimizations

#### 1. Implement Multipart Upload (For Large Files)

```python
# backend/api/services/s3_service.py
def upload_large_file(self, file, media_type='video'):
    """Use multipart upload for files >5MB"""
    config = boto3.s3.transfer.TransferConfig(
        multipart_threshold=5 * 1024 * 1024,  # 5MB
        multipart_chunksize=5 * 1024 * 1024,   # 5MB chunks
    )

    self.s3_client.upload_fileobj(
        file,
        self.bucket_name,
        s3_key,
        Config=config
    )
```

#### 2. Enable S3 Transfer Acceleration

```python
# settings.py
AWS_S3_USE_ACCELERATE = True

# s3_service.py
self.s3_client = boto3.client(
    's3',
    # ... other config ...
    config=Config(s3={'use_accelerate_endpoint': True})
)
```

#### 3. Async Upload Processing

```python
# Use Celery for background uploads
from celery import shared_task

@shared_task
def async_upload_to_s3(file_path, s3_key):
    with open(file_path, 'rb') as f:
        s3_service.upload_incident_media(f, 'photo')
    os.remove(file_path)  # Clean up temp file
```

### Mobile Optimizations

#### 1. Compress Before Upload (Already Implemented)

```typescript
// photoService.ts already compresses to <2MB
const optimized = await photoService.optimizePhoto(uri);
```

#### 2. Batch Uploads

```typescript
// Upload multiple photos in parallel
const results = await mediaUploadService.uploadMultiple([
  { uri: photo1, type: 'photo' },
  { uri: photo2, type: 'photo' },
  { uri: video1, type: 'video' },
]);
```

#### 3. Progress Indicators

```typescript
const result = await mediaUploadService.uploadToBackend(
  photoUri,
  'photo',
  (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
    // Update UI progress bar
  }
);
```

### Cost Optimization

#### S3 Storage Classes

For older incident photos (after 30 days):

```python
# Configure lifecycle policy
lifecycle_config = {
    'Rules': [
        {
            'Id': 'MoveToInfrequentAccess',
            'Status': 'Enabled',
            'Transitions': [
                {
                    'Days': 30,
                    'StorageClass': 'STANDARD_IA'  # Cheaper storage
                },
                {
                    'Days': 90,
                    'StorageClass': 'GLACIER_IR'  # Even cheaper for archives
                }
            ]
        }
    ]
}
```

#### CloudFront Caching

```python
# Serve frequently accessed files via CDN
MEDIA_URL = f'https://{AWS_CLOUDFRONT_DOMAIN}/'

# Set cache headers
ExtraArgs={
    'CacheControl': 'max-age=31536000',  # 1 year cache
}
```

---

## Security Best Practices

### 1. Use IAM Roles (Production)

Instead of access keys, use IAM roles for EC2/ECS:

```python
# No credentials needed when using IAM roles
self.s3_client = boto3.client('s3', region_name=settings.AWS_S3_REGION_NAME)
```

### 2. Encrypt Files at Rest

```python
# Enable SSE-S3 encryption
ExtraArgs={
    'ServerSideEncryption': 'AES256'
}
```

### 3. Validate File Types

```python
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.mp4', '.m4a'}

def validate_file(file):
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError('Invalid file type')
```

### 4. Scan for Malware (Optional)

Integrate ClamAV or AWS Lambda for virus scanning before storing.

---

## Migration Checklist

### Phase 1 → Phase 2 Migration

- [ ] AWS account created
- [ ] S3 bucket created and configured
- [ ] IAM user created with correct permissions
- [ ] CORS policy applied
- [ ] Backend dependencies installed (`boto3`)
- [ ] Environment variables configured
- [ ] S3 service implemented
- [ ] API endpoints created
- [ ] Backend tested locally
- [ ] Backend deployed to staging
- [ ] Mobile app updated to enable S3
- [ ] End-to-end test passed
- [ ] Deployed to production
- [ ] Monitoring enabled

---

## Summary

### What You Have NOW

✅ Working photo/video capture
✅ Local storage (offline-first)
✅ Automatic optimization
✅ S3-ready architecture
✅ Zero configuration needed

### When You Enable S3

✅ Automatic cloud uploads
✅ CDN delivery
✅ Scalable storage
✅ Cost-effective archiving
✅ **ONE function call to enable!**

```typescript
// That's literally it!
mediaUploadService.enableS3();
```

---

**Questions or Issues?**
Refer to AWS S3 documentation: https://docs.aws.amazon.com/s3/
Check mobile logs for detailed error messages
Test backend endpoints with Postman/curl before enabling in mobile
