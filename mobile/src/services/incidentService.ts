/**
 * Incident Service
 * Handles incident reporting with offline support
 */

import { api } from './api';
import { syncService } from './syncService';
import { database } from './database';
import { mediaUploadService } from './mediaUploadService';
import { logger } from '../utils/logger';
import type { Incident } from '../types/incident';

class IncidentService {
  /**
   * Submit incident report (with offline support)
   * Phase 1: Stores media locally
   * Phase 2: When S3 enabled, uploads to S3 and stores URLs
   */
  async submitIncident(incident: Incident): Promise<Incident> {
    try {
      logger.info('[IncidentService] Submitting incident', { type: incident.incident_type });

      // Process photos through upload service (S3-ready)
      if (incident.photos?.length) {
        logger.info('[IncidentService] Processing photos', { count: incident.photos.length });
        const photoFiles = incident.photos.map(uri => ({ uri, type: 'photo' as const }));
        const photoResults = await mediaUploadService.uploadMultiple(photoFiles);
        incident.photos = photoResults.map(result => result.url);
        logger.info('[IncidentService] Photos processed', { urls: incident.photos });
      }

      // Process videos through upload service (S3-ready)
      if (incident.videos?.length) {
        logger.info('[IncidentService] Processing videos', { count: incident.videos.length });
        const videoFiles = incident.videos.map(uri => ({ uri, type: 'video' as const }));
        const videoResults = await mediaUploadService.uploadMultiple(videoFiles);
        incident.videos = videoResults.map(result => result.url);
        logger.info('[IncidentService] Videos processed', { urls: incident.videos });
      }

      // Process voice note through upload service (S3-ready)
      if (incident.voice_note) {
        logger.info('[IncidentService] Processing voice note');
        const voiceResult = await mediaUploadService.uploadToBackend(incident.voice_note, 'voice');
        incident.voice_note = voiceResult.url;
        logger.info('[IncidentService] Voice note processed', { url: incident.voice_note });
      }

      // Save full rich incident to local database first (keeps mobile-only
      // fields like photos, witnesses, location_description for offline UX).
      const localIncident = await database.saveIncident({
        ...incident,
        reported_at: new Date().toISOString(),
        status: 'submitted',
        sync_status: 'pending',
      });

      // Build server-shaped payload — backend IncidentReport only stores a
      // narrower set of fields than the mobile model. Title gets prepended to
      // description so it isn't dropped on the server side.
      const titlePrefix = incident.title?.trim() ? `${incident.title.trim()}\n\n` : '';
      const serverPayload = {
        venue: incident.venue,
        shift: incident.shift,
        incident_time: incident.occurred_at,
        description: `${titlePrefix}${incident.description ?? ''}`.trim(),
        severity: incident.severity,
        actions_taken: incident.actions_taken?.trim() || '',
      };

      // Add to sync queue
      await syncService.addToQueue({
        type: 'create_incident',
        entityType: 'incidents',
        entityId: localIncident.id?.toString() || 'temp',
        payload: serverPayload,
        priority: incident.severity === 'critical' ? 0 : 1,
      });

      // Try immediate sync if online
      syncService.startSync();

      return localIncident;
    } catch (error) {
      logger.error('[IncidentService] Failed to submit incident', { error });
      throw error;
    }
  }

  /**
   * Get incident history for current user
   */
  async getIncidents(filters?: { shiftId?: number; status?: string }): Promise<Incident[]> {
    try {
      // Try API first
      const response = await api.get<Incident[]>('/incidents/', { params: filters });
      return response.data;
    } catch (error) {
      // Fallback to local database
      logger.info('[IncidentService] Loading incidents from local database');
      return database.getIncidents(filters);
    }
  }

  /**
   * Upload incident photo/video evidence
   */
  async uploadEvidence(incidentId: number, file: string, type: 'photo' | 'video'): Promise<string> {
    const formData = new FormData();
    formData.append(type, {
      uri: file,
      type: type === 'photo' ? 'image/jpeg' : 'video/mp4',
      name: `${type}_${Date.now()}.${type === 'photo' ? 'jpg' : 'mp4'}`,
    } as any);

    const response = await api.post(`/incidents/${incidentId}/evidence/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data.url;
  }
}

export const incidentService = new IncidentService();
