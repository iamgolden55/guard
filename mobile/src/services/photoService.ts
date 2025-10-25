/**
 * Photo Service
 * Photo capture, optimization, and storage
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import { logger } from '../utils/logger';

export interface OptimizedPhoto {
  uri: string;
  thumbnail: string;
  width: number;
  height: number;
  size: number;
  originalSize: number;
}

export interface PhotoCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  thumbnailWidth?: number;
}

class PhotoService {
  private readonly photosDir = new Directory(Paths.document, 'photos');
  private readonly thumbnailsDir = new Directory(Paths.document, 'thumbnails');

  /**
   * Initialize directories for photo storage
   */
  async initialize() {
    try {
      // Create photos directory
      await this.photosDir.create({ intermediates: true });

      // Create thumbnails directory
      await this.thumbnailsDir.create({ intermediates: true });

      logger.info('[PhotoService] Directories initialized');
    } catch (error) {
      // Directories might already exist, that's fine
      logger.info('[PhotoService] Directory initialization (may already exist):', error);
    }
  }

  /**
   * Optimize photo with compression and resizing
   * Targets <2MB file size for efficient sync
   */
  async optimizePhoto(
    uri: string,
    options: PhotoCompressionOptions = {}
  ): Promise<OptimizedPhoto> {
    try {
      await this.initialize();

      const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.8,
        thumbnailWidth = 400,
      } = options;

      logger.info('[PhotoService] Starting photo optimization');

      // 1. Get original file info
      const originalFile = new File(uri);
      const fileInfo = originalFile.info();
      const originalSize = fileInfo.exists ? (fileInfo.size || 0) : 0;

      logger.info('[PhotoService] Original size:', (originalSize / 1024 / 1024).toFixed(2), 'MB');

      // 2. Resize and compress main photo
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxWidth } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      logger.info('[PhotoService] Photo manipulated:', manipulated.width, 'x', manipulated.height);

      // 3. Check compressed size
      const compressedFile = new File(manipulated.uri);
      const compressedInfo = compressedFile.info();
      const compressedSize = compressedInfo.exists ? (compressedInfo.size || 0) : 0;

      logger.info('[PhotoService] Compressed size:', (compressedSize / 1024 / 1024).toFixed(2), 'MB');

      // 4. If still too large (>2MB), compress more aggressively
      let finalUri = manipulated.uri;
      let finalSize = compressedSize;

      if (compressedSize > 2 * 1024 * 1024) {
        logger.info('[PhotoService] File still too large, applying aggressive compression');

        const aggressive = await ImageManipulator.manipulateAsync(
          manipulated.uri,
          [{ resize: { width: 1280 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        const aggressiveFile = new File(aggressive.uri);
        const aggressiveInfo = aggressiveFile.info();
        finalSize = aggressiveInfo.exists ? (aggressiveInfo.size || 0) : 0;
        finalUri = aggressive.uri;

        logger.info('[PhotoService] Final size after aggressive compression:', (finalSize / 1024 / 1024).toFixed(2), 'MB');
      }

      // 5. Generate thumbnail
      const thumbnail = await ImageManipulator.manipulateAsync(
        finalUri,
        [{ resize: { width: thumbnailWidth } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // 6. Save to permanent storage
      const timestamp = Date.now();
      const photoFile = new File(this.photosDir, `${timestamp}.jpg`);
      const thumbnailFileTarget = new File(this.thumbnailsDir, `${timestamp}_thumb.jpg`);

      const finalFile = new File(finalUri);
      await finalFile.copy(photoFile);

      const thumbnailFile = new File(thumbnail.uri);
      await thumbnailFile.copy(thumbnailFileTarget);

      logger.info('[PhotoService] Photo saved:', photoFile.uri);
      logger.info('[PhotoService] Thumbnail saved:', thumbnailFileTarget.uri);

      return {
        uri: photoFile.uri,
        thumbnail: thumbnailFileTarget.uri,
        width: manipulated.width,
        height: manipulated.height,
        size: finalSize,
        originalSize,
      };
    } catch (error) {
      logger.info('[PhotoService] Optimization error:', error);
      throw error;
    }
  }

  /**
   * Delete photo and its thumbnail
   */
  async deletePhoto(photoUri: string): Promise<void> {
    try {
      // Delete main photo
      const photoFile = new File(photoUri);
      const photoInfo = photoFile.info();
      if (photoInfo.exists) {
        await photoFile.delete();
        logger.info('[PhotoService] Deleted photo:', photoUri);
      }

      // Delete thumbnail (extract filename from URI)
      const filename = photoUri.split('/').pop()?.replace('.jpg', '_thumb.jpg');
      if (filename) {
        const thumbnailFile = new File(this.thumbnailsDir, filename);
        const thumbnailInfo = thumbnailFile.info();
        if (thumbnailInfo.exists) {
          await thumbnailFile.delete();
          logger.info('[PhotoService] Deleted thumbnail:', thumbnailFile.uri);
        }
      }
    } catch (error) {
      logger.info('[PhotoService] Delete error:', error);
    }
  }

  /**
   * Get total storage used by photos
   */
  async getStorageUsed(): Promise<{ totalSize: number; photoCount: number }> {
    try {
      const photosInfo = this.photosDir.info();

      if (!photosInfo.exists) {
        return { totalSize: 0, photoCount: 0 };
      }

      const items = this.photosDir.list();
      let totalSize = 0;
      let photoCount = 0;

      for await (const item of items) {
        if (item instanceof File) {
          const fileInfo = item.info();
          if (fileInfo.exists) {
            totalSize += fileInfo.size || 0;
            photoCount++;
          }
        }
      }

      return {
        totalSize,
        photoCount,
      };
    } catch (error) {
      logger.info('[PhotoService] Get storage error:', error);
      return { totalSize: 0, photoCount: 0 };
    }
  }

  /**
   * Clear all photos (for debugging/testing)
   */
  async clearAll(): Promise<void> {
    try {
      // Delete photos directory
      const photosInfo = this.photosDir.info();
      if (photosInfo.exists) {
        await this.photosDir.delete({ idempotent: true });
      }

      // Delete thumbnails directory
      const thumbnailsInfo = this.thumbnailsDir.info();
      if (thumbnailsInfo.exists) {
        await this.thumbnailsDir.delete({ idempotent: true });
      }

      // Recreate directories
      await this.initialize();

      logger.info('[PhotoService] All photos cleared');
    } catch (error) {
      logger.info('[PhotoService] Clear all error:', error);
    }
  }

  /**
   * Capture photo using device camera
   */
  async capturePhoto(): Promise<{ uri: string } | null> {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        logger.info('[PhotoService] Camera permission denied');
        throw new Error('Camera permission is required to take photos');
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled) {
        logger.info('[PhotoService] Photo capture canceled');
        return null;
      }

      logger.info('[PhotoService] Photo captured successfully', { uri: result.assets[0].uri });
      return { uri: result.assets[0].uri };
    } catch (error) {
      logger.error('[PhotoService] Camera capture error:', error);
      throw error;
    }
  }

  /**
   * Convert photo to base64 (for API upload)
   * Alias for toBase64 for backwards compatibility
   */
  async convertToBase64(uri: string): Promise<string> {
    return this.toBase64(uri);
  }

  /**
   * Convert photo to base64 (for API upload)
   */
  async toBase64(uri: string): Promise<string> {
    try {
      logger.info('[PhotoService] Converting photo to base64', { uri });

      const file = new File(uri);
      const base64 = await file.text();

      logger.info('[PhotoService] Base64 conversion successful', {
        length: base64.length,
        preview: `data:image/jpeg;base64,${base64.substring(0, 50)}...`
      });

      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      logger.error('[PhotoService] Base64 conversion error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const photoService = new PhotoService();
export default photoService;
