# Mobile Integration Guide
## Legal Compliance Reporting System - Progressive Web App Features

This guide provides comprehensive documentation for implementing mobile-optimized compliance features using Progressive Web App (PWA) technologies. It covers offline compliance checking, mobile-specific APIs, push notifications, and local data management patterns.

## Table of Contents

1. [PWA Architecture Overview](#pwa-architecture-overview)
2. [Offline Compliance Features](#offline-compliance-features)
3. [Mobile-Optimized APIs](#mobile-optimized-apis)
4. [Push Notification System](#push-notification-system)
5. [Local Data Management](#local-data-management)
6. [Mobile UI Components](#mobile-ui-components)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)
9. [Installation and Setup](#installation-and-setup)

---

## PWA Architecture Overview

### Service Worker Configuration

```typescript
// src/serviceWorker.ts
const CACHE_NAME = 'compliance-pwa-v1.0.0';
const API_CACHE_NAME = 'compliance-api-v1.0.0';
const OFFLINE_FALLBACK = '/offline.html';

// Resources to cache for offline use
const STATIC_RESOURCES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/offline.html',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png'
];

// API endpoints to cache
const CACHEABLE_API_ROUTES = [
  '/api/v1/compliance/profiles/active/',
  '/api/v1/compliance/regulations/',
  '/api/v1/users/me',
  '/api/v1/venues/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_RESOURCES);
      }),

      // Pre-cache critical API responses
      caches.open(API_CACHE_NAME).then((cache) => {
        return Promise.all(
          CACHEABLE_API_ROUTES.map(async (route) => {
            try {
              const response = await fetch(route);
              if (response.ok) {
                cache.put(route, response.clone());
              }
            } catch (error) {
              console.warn(`Failed to pre-cache ${route}:`, error);
            }
          })
        );
      })
    ])
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),

      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static resources
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).catch(() => {
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_FALLBACK);
        }
      });
    })
  );
});

async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Try network first for fresh data
  try {
    const networkResponse = await fetch(request.clone());

    // Cache GET requests that succeed
    if (method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request.url, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn('Network request failed, trying cache:', error);

    // For GET requests, try cache fallback
    if (method === 'GET') {
      const cachedResponse = await caches.match(request.url);
      if (cachedResponse) {
        // Add offline indicator header
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-From-Cache', 'true');

        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: headers
        });
      }
    }

    // For POST/PUT requests (compliance checks, etc.), use IndexedDB
    if (method === 'POST' || method === 'PUT') {
      return await handleOfflineRequest(request);
    }

    // Return offline error
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Network unavailable',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleOfflineRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Handle offline compliance checks
  if (url.pathname.includes('/compliance/check/')) {
    return await handleOfflineComplianceCheck(request);
  }

  // Queue other requests for later sync
  await queueRequestForSync(request);

  return new Response(
    JSON.stringify({
      status: 'queued',
      message: 'Request queued for when connection is restored',
      offline: true
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

### PWA Manifest Configuration

```json
// public/manifest.json
{
  "name": "Compliance Manager",
  "short_name": "Compliance",
  "description": "Legal Compliance Reporting System",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#1f2937",
  "background_color": "#ffffff",
  "categories": ["business", "productivity"],
  "lang": "en-US",
  "scope": "/",
  "prefer_related_applications": false,
  "icons": [
    {
      "src": "/assets/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Quick Compliance Check",
      "short_name": "Check",
      "description": "Perform quick compliance check",
      "url": "/compliance/check",
      "icons": [
        {
          "src": "/assets/icons/shortcut-check-96x96.png",
          "sizes": "96x96"
        }
      ]
    },
    {
      "name": "My Violations",
      "short_name": "Violations",
      "description": "View my compliance violations",
      "url": "/violations",
      "icons": [
        {
          "src": "/assets/icons/shortcut-violations-96x96.png",
          "sizes": "96x96"
        }
      ]
    }
  ],
  "related_applications": [],
  "screenshots": [
    {
      "src": "/assets/screenshots/desktop-1.png",
      "type": "image/png",
      "sizes": "1280x720"
    },
    {
      "src": "/assets/screenshots/mobile-1.png",
      "type": "image/png",
      "sizes": "375x667"
    }
  ]
}
```

---

## Offline Compliance Features

### Offline Compliance Check Engine

```typescript
// src/services/offlineComplianceService.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineComplianceDB extends DBSchema {
  regulations: {
    key: string;
    value: {
      country_code: string;
      rules: WorkingHoursRegulation;
      cached_at: number;
    };
  };
  user_context: {
    key: number;
    value: {
      user_id: number;
      current_week_hours: number;
      consecutive_days: number;
      last_shift_end: string | null;
      recent_violations: number;
      cached_at: number;
    };
  };
  offline_checks: {
    key: number;
    value: {
      id?: number;
      user_id: number;
      shift_start: string;
      shift_end: string;
      venue_id?: number;
      result: ComplianceCheckResponse;
      checked_at: number;
      synced: boolean;
    };
  };
  queued_requests: {
    key: number;
    value: {
      id?: number;
      url: string;
      method: string;
      body: string;
      headers: Record<string, string>;
      timestamp: number;
    };
  };
}

export class OfflineComplianceService {
  private db: IDBPDatabase<OfflineComplianceDB> | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB<OfflineComplianceDB>('ComplianceOfflineDB', 1, {
      upgrade(db) {
        // Regulations store
        if (!db.objectStoreNames.contains('regulations')) {
          db.createObjectStore('regulations', { keyPath: 'country_code' });
        }

        // User context store
        if (!db.objectStoreNames.contains('user_context')) {
          const userContextStore = db.createObjectStore('user_context', { keyPath: 'user_id' });
          userContextStore.createIndex('cached_at', 'cached_at');
        }

        // Offline checks store
        if (!db.objectStoreNames.contains('offline_checks')) {
          const checksStore = db.createObjectStore('offline_checks', {
            keyPath: 'id',
            autoIncrement: true
          });
          checksStore.createIndex('user_id', 'user_id');
          checksStore.createIndex('synced', 'synced');
        }

        // Queued requests store
        if (!db.objectStoreNames.contains('queued_requests')) {
          const queueStore = db.createObjectStore('queued_requests', {
            keyPath: 'id',
            autoIncrement: true
          });
          queueStore.createIndex('timestamp', 'timestamp');
        }
      }
    });
  }

  async cacheRegulations(regulations: WorkingHoursRegulation[]): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('regulations', 'readwrite');
    const store = tx.objectStore('regulations');

    await Promise.all(
      regulations.map(regulation =>
        store.put({
          country_code: regulation.country_code,
          rules: regulation,
          cached_at: Date.now()
        })
      )
    );
  }

  async cacheUserContext(userId: number, context: any): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('user_context', 'readwrite');
    await tx.objectStore('user_context').put({
      user_id: userId,
      ...context,
      cached_at: Date.now()
    });
  }

  async performOfflineComplianceCheck(
    userId: number,
    shiftStart: string,
    shiftEnd: string,
    venueId?: number
  ): Promise<ComplianceCheckResponse> {
    if (!this.db) await this.initialize();

    // Get cached user context
    const userContext = await this.db!.get('user_context', userId);
    if (!userContext || this.isContextStale(userContext.cached_at)) {
      throw new Error('User context not available offline');
    }

    // Get cached regulations (assume GB for now, could be user-specific)
    const regulations = await this.db!.get('regulations', 'GB');
    if (!regulations || this.isContextStale(regulations.cached_at)) {
      throw new Error('Compliance regulations not available offline');
    }

    // Perform compliance calculation
    const result = await this.calculateOfflineCompliance(
      userContext,
      regulations.rules,
      shiftStart,
      shiftEnd,
      venueId
    );

    // Store offline check result
    await this.storeOfflineCheck(userId, shiftStart, shiftEnd, venueId, result);

    return result;
  }

  private async calculateOfflineCompliance(
    userContext: any,
    regulations: WorkingHoursRegulation,
    shiftStart: string,
    shiftEnd: string,
    venueId?: number
  ): Promise<ComplianceCheckResponse> {

    const startDate = new Date(shiftStart);
    const endDate = new Date(shiftEnd);
    const shiftDurationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    const warnings: Array<{type: string, message: string, severity: string}> = [];
    const violations: Array<{type: string, message: string, severity: string}> = [];
    const recommendations: string[] = [];

    // Check daily hours limit
    const projectedDailyHours = shiftDurationHours; // Simplified - would need same-day shifts
    const maxDailyHours = parseFloat(regulations.max_daily_hours);

    if (projectedDailyHours > maxDailyHours) {
      violations.push({
        type: 'daily_overtime',
        message: `Shift would exceed daily limit of ${maxDailyHours} hours`,
        severity: 'major'
      });
    } else if (projectedDailyHours > maxDailyHours * 0.9) {
      warnings.push({
        type: 'approaching_daily_limit',
        message: `Shift approaches daily limit (${projectedDailyHours.toFixed(1)}h/${maxDailyHours}h)`,
        severity: 'warning'
      });
    }

    // Check weekly hours
    const projectedWeeklyHours = userContext.current_week_hours + shiftDurationHours;
    const maxWeeklyHours = parseFloat(regulations.max_weekly_hours);

    if (projectedWeeklyHours > maxWeeklyHours) {
      violations.push({
        type: 'weekly_overtime',
        message: `Would exceed weekly limit of ${maxWeeklyHours} hours`,
        severity: 'major'
      });
    } else if (projectedWeeklyHours > maxWeeklyHours * 0.85) {
      warnings.push({
        type: 'approaching_weekly_limit',
        message: `Approaching weekly limit (${projectedWeeklyHours.toFixed(1)}h/${maxWeeklyHours}h)`,
        severity: 'warning'
      });
      recommendations.push('Consider shorter shifts to maintain compliance buffer');
    }

    // Check rest period
    if (userContext.last_shift_end) {
      const lastShiftEnd = new Date(userContext.last_shift_end);
      const restHours = (startDate.getTime() - lastShiftEnd.getTime()) / (1000 * 60 * 60);
      const minRestHours = parseFloat(regulations.min_rest_between_shifts_hours);

      if (restHours < minRestHours) {
        violations.push({
          type: 'insufficient_rest',
          message: `Insufficient rest period (${restHours.toFixed(1)}h < ${minRestHours}h required)`,
          severity: 'major'
        });
      }
    }

    // Check consecutive days
    const maxConsecutiveDays = regulations.max_consecutive_days;
    if (userContext.consecutive_days >= maxConsecutiveDays) {
      violations.push({
        type: 'consecutive_days',
        message: `Would exceed maximum consecutive working days (${maxConsecutiveDays})`,
        severity: 'minor'
      });
    }

    const compliant = violations.length === 0;

    return {
      compliant,
      warnings,
      violations,
      recommendations,
      current_week_hours: userContext.current_week_hours,
      projected_week_hours: projectedWeeklyHours,
      weekly_limit: maxWeeklyHours,
      consecutive_days: userContext.consecutive_days,
      last_rest_period_hours: userContext.last_shift_end
        ? (startDate.getTime() - new Date(userContext.last_shift_end).getTime()) / (1000 * 60 * 60)
        : 0
    };
  }

  private async storeOfflineCheck(
    userId: number,
    shiftStart: string,
    shiftEnd: string,
    venueId: number | undefined,
    result: ComplianceCheckResponse
  ): Promise<void> {
    const tx = this.db!.transaction('offline_checks', 'readwrite');
    await tx.objectStore('offline_checks').add({
      user_id: userId,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      venue_id: venueId,
      result,
      checked_at: Date.now(),
      synced: false
    });
  }

  async syncOfflineChecks(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('offline_checks', 'readwrite');
    const store = tx.objectStore('offline_checks');
    const unsyncedChecks = await store.index('synced').getAll(false);

    for (const check of unsyncedChecks) {
      try {
        // Send to server for logging/tracking
        await fetch('/api/v1/compliance/offline-check-sync/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: check.user_id,
            shift_start: check.shift_start,
            shift_end: check.shift_end,
            venue_id: check.venue_id,
            result: check.result,
            checked_at: new Date(check.checked_at).toISOString()
          })
        });

        // Mark as synced
        check.synced = true;
        await store.put(check);

      } catch (error) {
        console.warn('Failed to sync offline check:', error);
      }
    }
  }

  private isContextStale(cachedAt: number, maxAgeHours: number = 6): boolean {
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    return Date.now() - cachedAt > maxAge;
  }

  async cleanupOldData(): Promise<void> {
    if (!this.db) return;

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Clean old offline checks
    const checksTx = this.db.transaction('offline_checks', 'readwrite');
    const checksStore = checksTx.objectStore('offline_checks');
    const oldChecks = await checksStore.getAll();

    for (const check of oldChecks) {
      if (check.checked_at < sevenDaysAgo && check.synced) {
        await checksStore.delete(check.id!);
      }
    }

    // Clean old queued requests
    const queueTx = this.db.transaction('queued_requests', 'readwrite');
    const queueStore = queueTx.objectStore('queued_requests');
    const oldRequests = await queueStore.index('timestamp').getAll();

    for (const request of oldRequests) {
      if (request.timestamp < sevenDaysAgo) {
        await queueStore.delete(request.id!);
      }
    }
  }
}
```

### Background Sync for Offline Actions

```typescript
// src/services/backgroundSyncService.ts
export class BackgroundSyncService {
  private db: IDBPDatabase<OfflineComplianceDB> | null = null;

  async initialize(): Promise<void> {
    // Register background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('compliance-sync');
    }
  }

  async queueRequest(request: Request): Promise<void> {
    if (!this.db) {
      const offlineService = new OfflineComplianceService();
      await offlineService.initialize();
      this.db = (offlineService as any).db;
    }

    const body = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const tx = this.db!.transaction('queued_requests', 'readwrite');
    await tx.objectStore('queued_requests').add({
      url: request.url,
      method: request.method,
      body,
      headers,
      timestamp: Date.now()
    });

    // Trigger sync if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('queued_requests', 'readwrite');
    const store = tx.objectStore('queued_requests');
    const queuedRequests = await store.getAll();

    for (const queuedRequest of queuedRequests) {
      try {
        const response = await fetch(queuedRequest.url, {
          method: queuedRequest.method,
          headers: queuedRequest.headers,
          body: queuedRequest.body || undefined
        });

        if (response.ok) {
          await store.delete(queuedRequest.id!);
        }
      } catch (error) {
        console.warn('Failed to sync queued request:', error);
        // Keep in queue for retry
      }
    }
  }
}

// Service Worker background sync handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'compliance-sync') {
    event.waitUntil(
      Promise.all([
        processQueuedRequests(),
        syncOfflineChecks()
      ])
    );
  }
});

async function processQueuedRequests() {
  const db = await openDB('ComplianceOfflineDB', 1);
  const queuedRequests = await db.getAll('queued_requests');

  for (const request of queuedRequests) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      if (response.ok) {
        await db.delete('queued_requests', request.id);
      }
    } catch (error) {
      console.warn('Background sync failed for request:', error);
    }
  }
}

async function syncOfflineChecks() {
  const db = await openDB('ComplianceOfflineDB', 1);
  const unsyncedChecks = await db.getAllFromIndex('offline_checks', 'synced', false);

  for (const check of unsyncedChecks) {
    try {
      const response = await fetch('/api/v1/compliance/offline-check-sync/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: check.user_id,
          shift_start: check.shift_start,
          shift_end: check.shift_end,
          venue_id: check.venue_id,
          result: check.result,
          checked_at: new Date(check.checked_at).toISOString()
        })
      });

      if (response.ok) {
        check.synced = true;
        await db.put('offline_checks', check);
      }
    } catch (error) {
      console.warn('Background sync failed for offline check:', error);
    }
  }
}
```

---

## Mobile-Optimized APIs

### Bandwidth-Optimized Endpoints

```python
# backend/api/mobile_views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta

class MobileComplianceViewSet(viewsets.ViewSet):
    """Mobile-optimized compliance endpoints"""

    @action(detail=False, methods=['get'])
    def sync_data(self, request):
        """Get all necessary data for offline sync in single request"""
        user = request.user

        # Get data with minimal fields for mobile
        profile = ComplianceProfile.objects.filter(is_active=True).values(
            'id', 'name', 'working_hours_regulation_id',
            'daily_hours_warning_threshold', 'weekly_hours_warning_threshold',
            'auto_approve_overtime', 'require_manager_approval'
        ).first()

        regulations = WorkingHoursRegulation.objects.filter(is_active=True).values(
            'id', 'country_code', 'country_name',
            'standard_weekly_hours', 'standard_daily_hours',
            'max_daily_hours', 'max_weekly_hours', 'max_consecutive_days',
            'min_rest_between_shifts_hours', 'overtime_threshold_hours'
        )

        # User context for offline compliance checks
        user_context = self._get_mobile_user_context(user.id)

        # Recent violations (last 30 days, minimal data)
        recent_violations = ComplianceViolation.objects.filter(
            user=user,
            created_at__gte=timezone.now() - timedelta(days=30)
        ).values(
            'id', 'violation_type', 'severity', 'description',
            'period_start', 'period_end', 'resolution_status', 'created_at'
        ).order_by('-created_at')[:50]

        # Venues (minimal data for location checking)
        venues = Venue.objects.filter(is_active=True).values(
            'id', 'name', 'latitude', 'longitude', 'address'
        )

        return Response({
            'status': 'success',
            'sync_timestamp': timezone.now().isoformat(),
            'data': {
                'profile': profile,
                'regulations': list(regulations),
                'user_context': user_context,
                'recent_violations': list(recent_violations),
                'venues': list(venues)
            },
            'cache_duration': 3600  # 1 hour
        })

    def _get_mobile_user_context(self, user_id):
        """Get optimized user context for mobile compliance checks"""

        # Current week calculation
        now = timezone.now()
        week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - \
                    timedelta(days=now.weekday())

        # Optimized single query for current week data
        weekly_data = Shift.objects.filter(
            user_id=user_id,
            start_time__gte=week_start,
            status__in=['completed', 'in_progress']
        ).aggregate(
            total_hours=models.Sum('duration_hours'),
            shift_count=models.Count('id'),
            max_end_time=models.Max('end_time')
        )

        # Count consecutive working days (simplified)
        consecutive_days = Shift.objects.filter(
            user_id=user_id,
            start_time__gte=week_start,
            status__in=['completed', 'in_progress']
        ).values('start_time__date').distinct().count()

        # Recent violation count
        violation_count = ComplianceViolation.objects.filter(
            user_id=user_id,
            created_at__gte=timezone.now() - timedelta(days=30),
            resolution_status='open'
        ).count()

        return {
            'current_week_hours': float(weekly_data['total_hours'] or 0),
            'shifts_this_week': weekly_data['shift_count'],
            'consecutive_days': consecutive_days,
            'last_shift_end': weekly_data['max_end_time'].isoformat() if weekly_data['max_end_time'] else None,
            'recent_violations': violation_count,
            'cache_timestamp': timezone.now().isoformat()
        }

    @action(detail=False, methods=['post'])
    def offline_check_sync(self, request):
        """Sync offline compliance check results"""
        offline_checks = request.data.get('offline_checks', [])

        synced_count = 0
        for check_data in offline_checks:
            try:
                # Log offline check for audit purposes
                OfflineComplianceCheck.objects.create(
                    user_id=check_data['user_id'],
                    shift_start=check_data['shift_start'],
                    shift_end=check_data['shift_end'],
                    venue_id=check_data.get('venue_id'),
                    result_data=check_data['result'],
                    checked_at=check_data['checked_at'],
                    synced_at=timezone.now()
                )
                synced_count += 1
            except Exception as e:
                logger.error(f"Failed to sync offline check: {e}")

        return Response({
            'status': 'success',
            'synced_count': synced_count,
            'total_count': len(offline_checks)
        })

    @action(detail=False, methods=['get'])
    def quick_status(self, request):
        """Get quick compliance status for mobile dashboard"""
        user = request.user

        # Ultra-lightweight status check
        status_data = ComplianceViolation.objects.filter(
            user=user,
            resolution_status='open'
        ).aggregate(
            total_violations=models.Count('id'),
            critical_count=models.Count('id', filter=models.Q(severity='critical')),
            major_count=models.Count('id', filter=models.Q(severity='major'))
        )

        # Current week hours (cached)
        current_week_hours = cache.get(f'user_week_hours_{user.id}')
        if current_week_hours is None:
            current_week_hours = self._calculate_current_week_hours(user.id)
            cache.set(f'user_week_hours_{user.id}', current_week_hours, 300)  # 5 minutes

        return Response({
            'status': 'success',
            'data': {
                'total_violations': status_data['total_violations'],
                'critical_violations': status_data['critical_count'],
                'major_violations': status_data['major_count'],
                'current_week_hours': current_week_hours,
                'compliance_status': 'compliant' if status_data['total_violations'] == 0 else 'violations',
                'last_updated': timezone.now().isoformat()
            },
            'cached': True
        })

# Mobile-optimized URL patterns
# urls.py
router.register('mobile/compliance', MobileComplianceViewSet, basename='mobile-compliance')
```

### Compressed Response Format

```python
# backend/api/mobile_serializers.py
class MobileComplianceViolationSerializer(serializers.ModelSerializer):
    """Lightweight serializer for mobile violations"""

    class Meta:
        model = ComplianceViolation
        fields = [
            'id', 'violation_type', 'severity', 'period_start', 'period_end',
            'description', 'resolution_status', 'created_at'
        ]

    def to_representation(self, instance):
        """Compress field names for mobile bandwidth optimization"""
        data = super().to_representation(instance)

        # Use abbreviated field names to reduce payload size
        return {
            'id': data['id'],
            'type': data['violation_type'],
            'sev': data['severity'],
            'start': data['period_start'],
            'end': data['period_end'],
            'desc': data['description'][:100],  # Truncate descriptions
            'status': data['resolution_status'],
            'created': data['created_at']
        }

class MobileUserContextSerializer(serializers.Serializer):
    """Compressed user context for offline compliance"""

    id = serializers.IntegerField()
    wh = serializers.FloatField()  # week_hours
    cd = serializers.IntegerField()  # consecutive_days
    lse = serializers.DateTimeField(allow_null=True)  # last_shift_end
    rv = serializers.IntegerField()  # recent_violations
    ct = serializers.DateTimeField()  # cache_timestamp
```

---

## Push Notification System

### Web Push Notifications

```typescript
// src/services/pushNotificationService.ts
interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push messaging is not supported');
    }

    this.registration = await navigator.serviceWorker.ready;
  }

  async requestPermission(): Promise<boolean> {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async subscribeToNotifications(userId: number): Promise<boolean> {
    if (!this.registration) {
      await this.initialize();
    }

    try {
      const subscription = await this.registration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlB64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY!)
      });

      // Send subscription to backend
      const response = await fetch('/api/v1/push-notifications/subscribe/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          user_id: userId,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
              auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
            }
          }
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  async unsubscribeFromNotifications(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Notify backend
        await fetch('/api/v1/push-notifications/unsubscribe/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;
    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }

  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    return window.btoa(binary);
  }
}

// Service Worker push event handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    tag: data.tag || 'compliance-notification',
    data: data.data,
    actions: data.actions || [
      {
        action: 'view',
        title: 'View Details',
        icon: '/assets/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/assets/icons/action-dismiss.png'
      }
    ],
    requireInteraction: data.priority === 'high'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default click action
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        const client = clientList.find((c) => c.visibilityState === 'visible');
        if (client) {
          client.navigate(url);
          client.focus();
        } else {
          clients.openWindow(url);
        }
      })
    );
  }
});
```

### Backend Push Notification System

```python
# backend/push_notifications/models.py
class PushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    endpoint = models.URLField(max_length=500)
    p256dh_key = models.TextField()
    auth_key = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['user', 'endpoint']

class PushNotificationLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    subscription = models.ForeignKey(PushSubscription, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    body = models.TextField()
    tag = models.CharField(max_length=100)
    sent_at = models.DateTimeField(auto_now_add=True)
    delivery_status = models.CharField(max_length=20, default='sent')
    error_message = models.TextField(blank=True)

# backend/push_notifications/services.py
from pywebpush import webpush, WebPushException
from django.conf import settings
import json

class CompliancePushNotificationService:
    """Send push notifications for compliance events"""

    def __init__(self):
        self.vapid_private_key = settings.VAPID_PRIVATE_KEY
        self.vapid_claims = {
            'sub': f'mailto:{settings.VAPID_CONTACT_EMAIL}'
        }

    def send_violation_alert(self, violation):
        """Send push notification for new compliance violation"""

        user = violation.user
        subscriptions = PushSubscription.objects.filter(user=user, is_active=True)

        if not subscriptions.exists():
            return False

        # Create notification payload
        payload = {
            'title': f'{violation.get_severity_display()} Compliance Violation',
            'body': violation.description[:120] + ('...' if len(violation.description) > 120 else ''),
            'tag': f'violation-{violation.id}',
            'data': {
                'violation_id': violation.id,
                'url': f'/violations/{violation.id}',
                'type': 'violation_alert'
            },
            'actions': [
                {
                    'action': 'view',
                    'title': 'View Details'
                },
                {
                    'action': 'dismiss',
                    'title': 'Dismiss'
                }
            ],
            'priority': 'high' if violation.severity in ['critical', 'major'] else 'normal'
        }

        return self._send_to_subscriptions(subscriptions, payload)

    def send_shift_reminder(self, user, shift, reminder_type='upcoming'):
        """Send push notification for shift reminders"""

        subscriptions = PushSubscription.objects.filter(user=user, is_active=True)
        if not subscriptions.exists():
            return False

        if reminder_type == 'upcoming':
            title = 'Upcoming Shift'
            body = f'Your shift at {shift.venue.name} starts in 30 minutes'
        elif reminder_type == 'check_in':
            title = 'Time to Check In'
            body = f'Your shift at {shift.venue.name} is starting now'
        else:
            return False

        payload = {
            'title': title,
            'body': body,
            'tag': f'shift-{shift.id}-{reminder_type}',
            'data': {
                'shift_id': shift.id,
                'url': f'/shifts/{shift.id}',
                'type': 'shift_reminder'
            },
            'actions': [
                {
                    'action': 'check_in',
                    'title': 'Check In'
                },
                {
                    'action': 'view',
                    'title': 'View Shift'
                }
            ]
        }

        return self._send_to_subscriptions(subscriptions, payload)

    def _send_to_subscriptions(self, subscriptions, payload):
        """Send notification to all user's subscriptions"""

        success_count = 0
        for subscription in subscriptions:
            try:
                subscription_info = {
                    'endpoint': subscription.endpoint,
                    'keys': {
                        'p256dh': subscription.p256dh_key,
                        'auth': subscription.auth_key
                    }
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=self.vapid_private_key,
                    vapid_claims=self.vapid_claims
                )

                # Log successful send
                PushNotificationLog.objects.create(
                    user=subscription.user,
                    subscription=subscription,
                    title=payload['title'],
                    body=payload['body'],
                    tag=payload['tag'],
                    delivery_status='sent'
                )

                success_count += 1

            except WebPushException as ex:
                # Log failed send
                PushNotificationLog.objects.create(
                    user=subscription.user,
                    subscription=subscription,
                    title=payload['title'],
                    body=payload['body'],
                    tag=payload['tag'],
                    delivery_status='failed',
                    error_message=str(ex)
                )

                # Deactivate invalid subscriptions
                if ex.response and ex.response.status_code in [404, 410]:
                    subscription.is_active = False
                    subscription.save()

        return success_count > 0

# Signal handlers for automatic notifications
@receiver(post_save, sender=ComplianceViolation)
def send_violation_notification(sender, instance, created, **kwargs):
    if created and instance.severity in ['critical', 'major']:
        push_service = CompliancePushNotificationService()
        push_service.send_violation_alert(instance)

# backend/push_notifications/views.py
class PushNotificationViewSet(viewsets.ViewSet):
    """Push notification management endpoints"""

    @action(detail=False, methods=['post'])
    def subscribe(self, request):
        """Subscribe user to push notifications"""

        user = request.user
        subscription_data = request.data.get('subscription')

        if not subscription_data:
            return Response({'error': 'Subscription data required'}, status=400)

        subscription, created = PushSubscription.objects.get_or_create(
            user=user,
            endpoint=subscription_data['endpoint'],
            defaults={
                'p256dh_key': subscription_data['keys']['p256dh'],
                'auth_key': subscription_data['keys']['auth']
            }
        )

        if not created:
            # Update existing subscription
            subscription.p256dh_key = subscription_data['keys']['p256dh']
            subscription.auth_key = subscription_data['keys']['auth']
            subscription.is_active = True
            subscription.save()

        return Response({
            'status': 'success',
            'subscription_id': subscription.id,
            'created': created
        })

    @action(detail=False, methods=['post'])
    def unsubscribe(self, request):
        """Unsubscribe from push notifications"""

        endpoint = request.data.get('endpoint')
        if not endpoint:
            return Response({'error': 'Endpoint required'}, status=400)

        PushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint
        ).update(is_active=False)

        return Response({'status': 'success'})

    @action(detail=False, methods=['post'])
    def test_notification(self, request):
        """Send test notification (development only)"""

        if not settings.DEBUG:
            return Response({'error': 'Only available in debug mode'}, status=403)

        push_service = CompliancePushNotificationService()
        # Create a test notification payload
        subscriptions = PushSubscription.objects.filter(user=request.user, is_active=True)

        payload = {
            'title': 'Test Notification',
            'body': 'This is a test notification from the compliance system',
            'tag': 'test-notification',
            'data': {
                'url': '/',
                'type': 'test'
            }
        }

        success = push_service._send_to_subscriptions(subscriptions, payload)

        return Response({
            'status': 'success' if success else 'failed',
            'sent_to': subscriptions.count()
        })
```

---

## Local Data Management

### IndexedDB Schema and Management

```typescript
// src/services/localDataManager.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ComplianceLocalDB extends DBSchema {
  app_config: {
    key: string;
    value: {
      key: string;
      value: any;
      updated_at: number;
    };
  };
  user_data: {
    key: number;
    value: {
      user_id: number;
      profile_data: any;
      preferences: any;
      cached_at: number;
    };
  };
  sync_queue: {
    key: number;
    value: {
      id?: number;
      action: string;
      data: any;
      timestamp: number;
      attempts: number;
      max_attempts: number;
    };
  };
  offline_analytics: {
    key: number;
    value: {
      id?: number;
      event_type: string;
      event_data: any;
      timestamp: number;
      synced: boolean;
    };
  };
}

export class LocalDataManager {
  private db: IDBPDatabase<ComplianceLocalDB> | null = null;
  private readonly DB_VERSION = 1;
  private readonly DB_NAME = 'ComplianceLocalDB';

  async initialize(): Promise<void> {
    this.db = await openDB<ComplianceLocalDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // App configuration store
        if (!db.objectStoreNames.contains('app_config')) {
          db.createObjectStore('app_config', { keyPath: 'key' });
        }

        // User data store
        if (!db.objectStoreNames.contains('user_data')) {
          const userStore = db.createObjectStore('user_data', { keyPath: 'user_id' });
          userStore.createIndex('cached_at', 'cached_at');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true
          });
          syncStore.createIndex('timestamp', 'timestamp');
          syncStore.createIndex('action', 'action');
        }

        // Offline analytics store
        if (!db.objectStoreNames.contains('offline_analytics')) {
          const analyticsStore = db.createObjectStore('offline_analytics', {
            keyPath: 'id',
            autoIncrement: true
          });
          analyticsStore.createIndex('synced', 'synced');
          analyticsStore.createIndex('timestamp', 'timestamp');
        }
      }
    });
  }

  // App Configuration Management
  async setConfig(key: string, value: any): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('app_config', 'readwrite');
    await tx.objectStore('app_config').put({
      key,
      value,
      updated_at: Date.now()
    });
  }

  async getConfig(key: string): Promise<any | null> {
    if (!this.db) await this.initialize();

    const config = await this.db!.get('app_config', key);
    return config ? config.value : null;
  }

  // User Data Management
  async cacheUserData(userId: number, profileData: any, preferences: any): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('user_data', 'readwrite');
    await tx.objectStore('user_data').put({
      user_id: userId,
      profile_data: profileData,
      preferences,
      cached_at: Date.now()
    });
  }

  async getUserData(userId: number): Promise<any | null> {
    if (!this.db) await this.initialize();

    const userData = await this.db!.get('user_data', userId);
    if (!userData) return null;

    // Check if data is stale (older than 1 hour)
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (Date.now() - userData.cached_at > maxAge) {
      return null; // Data is stale
    }

    return userData;
  }

  // Sync Queue Management
  async addToSyncQueue(action: string, data: any, maxAttempts: number = 3): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('sync_queue', 'readwrite');
    await tx.objectStore('sync_queue').add({
      action,
      data,
      timestamp: Date.now(),
      attempts: 0,
      max_attempts: maxAttempts
    });
  }

  async processSyncQueue(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const queueItems = await store.getAll();

    for (const item of queueItems) {
      try {
        await this.processSyncItem(item);
        await store.delete(item.id!);
      } catch (error) {
        console.warn(`Sync failed for item ${item.id}:`, error);

        // Increment attempt count
        item.attempts += 1;

        if (item.attempts >= item.max_attempts) {
          // Max attempts reached, remove from queue
          await store.delete(item.id!);
          console.error(`Max attempts reached for sync item ${item.id}, removing from queue`);
        } else {
          // Update attempt count
          await store.put(item);
        }
      }
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    switch (item.action) {
      case 'update_user_preferences':
        await this.syncUserPreferences(item.data);
        break;
      case 'log_offline_event':
        await this.syncOfflineEvent(item.data);
        break;
      case 'update_compliance_settings':
        await this.syncComplianceSettings(item.data);
        break;
      default:
        console.warn(`Unknown sync action: ${item.action}`);
    }
  }

  // Offline Analytics
  async logOfflineEvent(eventType: string, eventData: any): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db.transaction('offline_analytics', 'readwrite');
    await tx.objectStore('offline_analytics').add({
      event_type: eventType,
      event_data: eventData,
      timestamp: Date.now(),
      synced: false
    });
  }

  async syncOfflineAnalytics(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('offline_analytics', 'readwrite');
    const store = tx.objectStore('offline_analytics');
    const unsyncedEvents = await store.index('synced').getAll(false);

    for (const event of unsyncedEvents) {
      try {
        await fetch('/api/v1/analytics/offline-events/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            event_type: event.event_type,
            event_data: event.event_data,
            timestamp: new Date(event.timestamp).toISOString()
          })
        });

        // Mark as synced
        event.synced = true;
        await store.put(event);

      } catch (error) {
        console.warn('Failed to sync offline analytics event:', error);
      }
    }
  }

  // Data Cleanup
  async cleanupOldData(): Promise<void> {
    if (!this.db) return;

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Clean old analytics events
    const analyticsTx = this.db.transaction('offline_analytics', 'readwrite');
    const analyticsStore = analyticsTx.objectStore('offline_analytics');
    const oldEvents = await analyticsStore.index('timestamp').getAll(
      IDBKeyRange.upperBound(oneWeekAgo)
    );

    for (const event of oldEvents) {
      if (event.synced) {
        await analyticsStore.delete(event.id!);
      }
    }

    // Clean old sync queue items
    const syncTx = this.db.transaction('sync_queue', 'readwrite');
    const syncStore = syncTx.objectStore('sync_queue');
    const oldSyncItems = await syncStore.index('timestamp').getAll(
      IDBKeyRange.upperBound(oneWeekAgo)
    );

    for (const item of oldSyncItems) {
      await syncStore.delete(item.id!);
    }
  }

  // Storage Usage Information
  async getStorageUsage(): Promise<{quota: number, usage: number, available: number}> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0)
      };
    }

    return { quota: 0, usage: 0, available: 0 };
  }

  async clearAllData(): Promise<void> {
    if (!this.db) return;

    const stores = ['app_config', 'user_data', 'sync_queue', 'offline_analytics'];

    for (const storeName of stores) {
      const tx = this.db.transaction(storeName, 'readwrite');
      await tx.objectStore(storeName).clear();
    }
  }

  private async syncUserPreferences(data: any): Promise<void> {
    const response = await fetch('/api/v1/user/preferences/', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to sync user preferences: ${response.statusText}`);
    }
  }

  private async syncOfflineEvent(data: any): Promise<void> {
    const response = await fetch('/api/v1/analytics/events/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to sync offline event: ${response.statusText}`);
    }
  }

  private async syncComplianceSettings(data: any): Promise<void> {
    const response = await fetch('/api/v1/compliance/settings/', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to sync compliance settings: ${response.statusText}`);
    }
  }
}

// Global instance
export const localDataManager = new LocalDataManager();

// Auto-initialize on app start
localDataManager.initialize().catch(error => {
  console.error('Failed to initialize local data manager:', error);
});

// Periodic cleanup (every hour)
setInterval(async () => {
  try {
    await localDataManager.cleanupOldData();
    await localDataManager.processSyncQueue();
    await localDataManager.syncOfflineAnalytics();
  } catch (error) {
    console.error('Periodic maintenance failed:', error);
  }
}, 60 * 60 * 1000); // 1 hour
```

---

## Mobile UI Components

### Touch-Optimized Compliance Dashboard

```typescript
// src/components/mobile/MobileComplianceDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { RefreshControl, ScrollView } from 'react-native-web';
import { ComplianceClient } from '../../services/complianceClient';
import { localDataManager } from '../../services/localDataManager';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const MobileComplianceDashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [localData, setLocalData] = useState<any>(null);
  const isOnline = useOnlineStatus();

  // Online data query
  const {
    data: onlineData,
    isLoading,
    refetch,
    error
  } = useQuery(
    ['mobile-compliance-status'],
    () => ComplianceClient.getQuickStatus(),
    {
      enabled: isOnline,
      staleTime: 2 * 60 * 1000, // 2 minutes
      onSuccess: (data) => {
        // Cache data locally for offline use
        localDataManager.setConfig('last_dashboard_data', data);
      }
    }
  );

  // Load cached data when offline
  useEffect(() => {
    if (!isOnline) {
      localDataManager.getConfig('last_dashboard_data').then(cached => {
        if (cached) {
          setLocalData(cached);
        }
      });
    }
  }, [isOnline]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isOnline) {
        await refetch();
      } else {
        // Simulate refresh delay for offline mode
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, refetch]);

  const data = isOnline ? onlineData?.data : localData?.data;

  if (isLoading && !localData) {
    return <MobileLoadingSpinner />;
  }

  if (error && !localData) {
    return (
      <div className="flex items-center justify-center h-64 p-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 text-red-500">
            <ExclamationTriangleIcon />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Unable to Load Data
          </h3>
          <p className="text-gray-600 mb-4">
            Please check your connection and try again.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center">
            <WifiIcon className="w-4 h-4 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              Offline Mode - Showing cached data
            </span>
          </div>
        </div>
      )}

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Compliance</h1>
            <div className="flex items-center space-x-2">
              {data?.compliance_status === 'compliant' ? (
                <div className="flex items-center text-green-600">
                  <CheckCircleIcon className="w-5 h-5 mr-1" />
                  <span className="text-sm font-medium">Compliant</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-1" />
                  <span className="text-sm font-medium">Issues</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <MobileStatCard
              title="Open Violations"
              value={data?.total_violations || 0}
              color={data?.total_violations > 0 ? 'red' : 'green'}
              icon={ExclamationTriangleIcon}
              onClick={() => navigateToViolations()}
            />

            <MobileStatCard
              title="Weekly Hours"
              value={`${data?.current_week_hours || 0}h`}
              color="blue"
              icon={ClockIcon}
              onClick={() => navigateToHours()}
            />

            <MobileStatCard
              title="Critical Issues"
              value={data?.critical_violations || 0}
              color={data?.critical_violations > 0 ? 'red' : 'gray'}
              icon={ExclamationIcon}
              onClick={() => navigateToViolations('critical')}
            />

            <MobileStatCard
              title="Major Issues"
              value={data?.major_violations || 0}
              color={data?.major_violations > 0 ? 'orange' : 'gray'}
              icon={ExclamationTriangleIcon}
              onClick={() => navigateToViolations('major')}
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <MobileActionButton
                title="Check Compliance"
                description="Verify compliance for upcoming shift"
                icon={SearchIcon}
                onClick={() => navigateToComplianceCheck()}
              />

              <MobileActionButton
                title="View Violations"
                description="Review and resolve compliance violations"
                icon={DocumentTextIcon}
                onClick={() => navigateToViolations()}
                badge={data?.total_violations > 0 ? data.total_violations : undefined}
              />

              <MobileActionButton
                title="Working Hours"
                description="Track your weekly working hours"
                icon={ClockIcon}
                onClick={() => navigateToHours()}
              />
            </div>
          </div>

          {/* Recent Activity */}
          {data?.recent_activity && data.recent_activity.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-3">Recent Activity</h2>
              <div className="space-y-2">
                {data.recent_activity.slice(0, 3).map((activity: any, index: number) => (
                  <div key={index} className="flex items-center p-2 bg-gray-50 rounded-md">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-600">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollView>

      {/* Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
};

interface MobileStatCardProps {
  title: string;
  value: string | number;
  color: 'red' | 'green' | 'blue' | 'orange' | 'gray';
  icon: React.ComponentType<any>;
  onClick: () => void;
}

const MobileStatCard: React.FC<MobileStatCardProps> = ({
  title,
  value,
  color,
  icon: Icon,
  onClick
}) => {
  const colorClasses = {
    red: 'bg-red-50 border-red-200 text-red-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border text-left transition-colors ${colorClasses[color]} hover:opacity-80 active:opacity-90`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm font-medium">{title}</p>
    </button>
  );
};

interface MobileActionButtonProps {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  onClick: () => void;
  badge?: number;
}

const MobileActionButton: React.FC<MobileActionButtonProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  badge
}) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
    >
      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      {badge && (
        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-xs font-medium text-white">{badge}</span>
        </div>
      )}
      <ChevronRightIcon className="w-4 h-4 text-gray-400 ml-2" />
    </button>
  );
};

const MobileLoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};
```

### Mobile Compliance Check Component

```typescript
// src/components/mobile/MobileComplianceCheck.tsx
import React, { useState, useEffect } from 'react';
import { useMutation } from 'react-query';
import { ComplianceClient } from '../../services/complianceClient';
import { OfflineComplianceService } from '../../services/offlineComplianceService';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const MobileComplianceCheck: React.FC = () => {
  const [shiftData, setShiftData] = useState({
    shift_start: '',
    shift_end: '',
    venue_id: null as number | null
  });
  const [result, setResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const isOnline = useOnlineStatus();
  const offlineService = new OfflineComplianceService();

  // Online compliance check
  const complianceCheckMutation = useMutation(
    ComplianceClient.checkCompliance,
    {
      onSuccess: (data) => {
        setResult(data.data);
      },
      onError: (error) => {
        console.error('Online compliance check failed:', error);
      }
    }
  );

  const handleComplianceCheck = async () => {
    if (!shiftData.shift_start || !shiftData.shift_end) {
      alert('Please provide shift start and end times');
      return;
    }

    setIsChecking(true);

    try {
      if (isOnline) {
        // Online check
        await complianceCheckMutation.mutateAsync({
          user_id: getCurrentUserId(),
          shift_start: shiftData.shift_start,
          shift_end: shiftData.shift_end,
          venue_id: shiftData.venue_id
        });
      } else {
        // Offline check
        const offlineResult = await offlineService.performOfflineComplianceCheck(
          getCurrentUserId(),
          shiftData.shift_start,
          shiftData.shift_end,
          shiftData.venue_id
        );
        setResult(offlineResult);
      }
    } catch (error) {
      alert('Unable to perform compliance check. Please try again.');
      console.error('Compliance check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Pre-fill current time + 8 hours
  useEffect(() => {
    const now = new Date();
    const eightHoursLater = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    setShiftData({
      shift_start: formatDateTimeLocal(now),
      shift_end: formatDateTimeLocal(eightHoursLater),
      venue_id: null
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Compliance Check</h1>
          <p className="text-gray-600">
            Verify compliance for your upcoming shift
          </p>
          {!isOnline && (
            <div className="mt-2 p-2 bg-yellow-100 rounded-md">
              <p className="text-sm text-yellow-800">
                🔄 Offline mode - Using cached data
              </p>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Start Time
              </label>
              <input
                type="datetime-local"
                value={shiftData.shift_start}
                onChange={(e) => setShiftData({ ...shiftData, shift_start: e.target.value })}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift End Time
              </label>
              <input
                type="datetime-local"
                value={shiftData.shift_end}
                onChange={(e) => setShiftData({ ...shiftData, shift_end: e.target.value })}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>

            <button
              onClick={handleComplianceCheck}
              disabled={isChecking}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isChecking ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Checking...
                </div>
              ) : (
                'Check Compliance'
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            {/* Compliance Status */}
            <div className={`flex items-center mb-4 p-3 rounded-lg ${
              result.compliant
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-3 ${
                result.compliant ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div className="flex-1">
                <p className="font-medium text-lg">
                  {result.compliant ? 'Compliant ✓' : 'Non-Compliant ⚠️'}
                </p>
                <p className="text-sm opacity-75">
                  {result.compliant
                    ? 'This shift meets all compliance requirements'
                    : 'This shift has compliance issues that need attention'
                  }
                </p>
              </div>
            </div>

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-yellow-700 mb-2 flex items-center">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                  Warnings ({result.warnings.length})
                </h4>
                <div className="space-y-1">
                  {result.warnings.map((warning: any, index: number) => (
                    <div key={index} className="p-2 bg-yellow-50 rounded text-sm text-yellow-700">
                      {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Violations */}
            {result.violations && result.violations.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                  <ExclamationIcon className="w-4 h-4 mr-1" />
                  Violations ({result.violations.length})
                </h4>
                <div className="space-y-1">
                  {result.violations.map((violation: any, index: number) => (
                    <div key={index} className="p-2 bg-red-50 rounded text-sm text-red-700">
                      {violation.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
                  <LightBulbIcon className="w-4 h-4 mr-1" />
                  Recommendations
                </h4>
                <div className="space-y-1">
                  {result.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="p-2 bg-blue-50 rounded text-sm text-blue-700">
                      💡 {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-gray-600">Current Week</p>
                <p className="font-medium">{result.current_week_hours}h</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-gray-600">After Shift</p>
                <p className="font-medium">{result.projected_week_hours}h</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-gray-600">Consecutive Days</p>
                <p className="font-medium">{result.consecutive_days}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-gray-600">Last Rest</p>
                <p className="font-medium">{result.last_rest_period_hours}h</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Utility function to format datetime for input
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getCurrentUserId(): number {
  // Implementation depends on your auth system
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  return user.id || 1;
}
```

---

This Mobile Integration Guide provides comprehensive coverage of PWA features for the compliance system, including offline functionality, mobile-optimized APIs, push notifications, and touch-friendly UI components. The implementation ensures that staff can access critical compliance features even when offline, while maintaining data synchronization when connectivity is restored.

The next step would be to create the WebSocket Architecture documentation for real-time compliance monitoring features.