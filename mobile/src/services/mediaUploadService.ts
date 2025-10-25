/**
 * Media Upload Service
 * Abstraction layer for uploading photos/videos to backend
 * Currently stores locally, ready for S3 integration
 */

import { File } from 'expo-file-system';
import { logger } from '../utils/logger';
import { api } from './api';

export type MediaType = 'photo' | 'video' | 'voice';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  url: string;           // Local file URI or S3 URL
  key?: string;          // S3 key (when S3 is enabled)
  type: MediaType;
  size: number;
  uploadedAt: string;
}

class MediaUploadService {
  private useS3 = false; // Toggle this to true when S3 backend is ready

  /**
   * Upload media to backend (or return local URI for now)
   *
   * Phase 1 (NOW): Returns local file URI
   * Phase 2 (S3 READY): Uploads to backend → S3 and returns S3 URL
   */
  async uploadToBackend(
    fileUri: string,
    type: MediaType,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      logger.info('[MediaUploadService] Starting upload', { fileUri, type, useS3: this.useS3 });

      // Phase 1: Local storage (works NOW)
      if (!this.useS3) {
        const file = new File(fileUri);
        const fileInfo = file.info();

        logger.info('[MediaUploadService] Using local storage', {
          uri: fileUri,
          size: fileInfo.size
        });

        return {
          url: fileUri,
          type,
          size: fileInfo.size || 0,
          uploadedAt: new Date().toISOString(),
        };
      }

      // Phase 2: S3 upload (enable when backend ready)
      return await this.uploadToS3(fileUri, type, onProgress);
    } catch (error) {
      logger.error('[MediaUploadService] Upload failed', { error, fileUri, type });
      throw error;
    }
  }

  /**
   * Upload to S3 via backend endpoint
   * ENABLE THIS when backend is ready
   */
  private async uploadToS3(
    fileUri: string,
    type: MediaType,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      logger.info('[MediaUploadService] Uploading to S3 via backend', { fileUri, type });

      const file = new File(fileUri);
      const fileInfo = file.info();

      // Prepare form data
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: this.getMimeType(type, fileUri),
        name: this.getFileName(fileUri),
      } as any);
      formData.append('type', type);

      // Upload to backend endpoint
      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            });
          }
        },
      });

      logger.info('[MediaUploadService] S3 upload successful', {
        url: response.data.url,
        key: response.data.key,
      });

      return {
        url: response.data.url,      // S3 URL from backend
        key: response.data.key,      // S3 object key
        type,
        size: fileInfo.size || 0,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[MediaUploadService] S3 upload failed', { error });
      throw error;
    }
  }

  /**
   * Upload multiple media files
   */
  async uploadMultiple(
    files: Array<{ uri: string; type: MediaType }>,
    onProgress?: (index: number, progress: UploadProgress) => void
  ): Promise<UploadResult[]> {
    logger.info('[MediaUploadService] Uploading multiple files', { count: files.length });

    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const { uri, type } = files[i];
      const result = await this.uploadToBackend(
        uri,
        type,
        onProgress ? (progress) => onProgress(i, progress) : undefined
      );
      results.push(result);
    }

    logger.info('[MediaUploadService] Multiple uploads complete', {
      count: results.length,
    });

    return results;
  }

  /**
   * Get MIME type from media type and URI
   */
  private getMimeType(type: MediaType, uri: string): string {
    if (type === 'photo') {
      return uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    }
    if (type === 'video') {
      return 'video/mp4';
    }
    if (type === 'voice') {
      return 'audio/m4a';
    }
    return 'application/octet-stream';
  }

  /**
   * Extract filename from URI
   */
  private getFileName(uri: string): string {
    const parts = uri.split('/');
    return parts[parts.length - 1] || `upload_${Date.now()}`;
  }

  /**
   * Delete uploaded media (local or S3)
   */
  async deleteMedia(url: string): Promise<void> {
    try {
      logger.info('[MediaUploadService] Deleting media', { url });

      if (this.useS3 && url.includes('s3.amazonaws.com')) {
        // Delete from S3 via backend
        await api.delete('/media/delete', { params: { url } });
        logger.info('[MediaUploadService] S3 media deleted');
      } else {
        // Delete local file
        const file = new File(url);
        const fileInfo = file.info();
        if (fileInfo.exists) {
          await file.delete();
          logger.info('[MediaUploadService] Local media deleted');
        }
      }
    } catch (error) {
      logger.error('[MediaUploadService] Delete failed', { error, url });
      throw error;
    }
  }

  /**
   * Enable S3 uploads (call when backend is ready)
   */
  enableS3() {
    logger.info('[MediaUploadService] S3 uploads ENABLED');
    this.useS3 = true;
  }

  /**
   * Disable S3 uploads (fallback to local)
   */
  disableS3() {
    logger.info('[MediaUploadService] S3 uploads DISABLED - using local storage');
    this.useS3 = false;
  }

  /**
   * Check if S3 is enabled
   */
  isS3Enabled(): boolean {
    return this.useS3;
  }
}

// Export singleton instance
export const mediaUploadService = new MediaUploadService();
export default mediaUploadService;
