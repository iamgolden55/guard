/**
 * Photo Service Tests
 * Tests for photo optimization and storage functionality
 * Updated for expo-file-system v19+ (File/Directory API)
 */

import { photoService } from '../photoService';
import { File, Directory } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Mock expo modules
jest.mock('expo-file-system');
jest.mock('expo-image-manipulator');

// Mock File and Directory classes
const mockFileInfo = jest.fn();
const mockFileCopy = jest.fn();
const mockFileDelete = jest.fn();
const mockFileText = jest.fn();

const mockDirectoryInfo = jest.fn();
const mockDirectoryCreate = jest.fn();
const mockDirectoryList = jest.fn();
const mockDirectoryDelete = jest.fn();

(File as jest.MockedClass<typeof File>) = jest.fn().mockImplementation((path: string) => ({
  info: mockFileInfo,
  copy: mockFileCopy,
  delete: mockFileDelete,
  text: mockFileText,
  path,
})) as any;

(Directory as jest.MockedClass<typeof Directory>) = jest.fn().mockImplementation((path: string) => ({
  info: mockDirectoryInfo,
  create: mockDirectoryCreate,
  list: mockDirectoryList,
  delete: mockDirectoryDelete,
  path,
})) as any;

describe('PhotoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileInfo.mockReset();
    mockFileCopy.mockReset();
    mockFileDelete.mockReset();
    mockFileText.mockReset();
    mockDirectoryInfo.mockReset();
    mockDirectoryCreate.mockReset();
    mockDirectoryList.mockReset();
    mockDirectoryDelete.mockReset();
  });

  describe('initialize', () => {
    it('should create photo and thumbnail directories', async () => {
      mockDirectoryCreate.mockResolvedValue(undefined);

      await photoService.initialize();

      // Should create 2 directories (photos and thumbnails)
      expect(Directory).toHaveBeenCalledTimes(2);
      expect(Directory).toHaveBeenCalledWith(expect.stringContaining('photos/'));
      expect(Directory).toHaveBeenCalledWith(expect.stringContaining('thumbnails/'));
      expect(mockDirectoryCreate).toHaveBeenCalledTimes(2);
      expect(mockDirectoryCreate).toHaveBeenCalledWith({ intermediates: true });
    });

    it('should handle existing directories gracefully', async () => {
      // Simulate directories already existing
      mockDirectoryCreate.mockRejectedValue(new Error('Directory exists'));

      await expect(photoService.initialize()).resolves.not.toThrow();
    });
  });

  describe('optimizePhoto', () => {
    it('should optimize photo and create thumbnail', async () => {
      const mockUri = 'file:///mock/photo.jpg';
      const mockOptimizedUri = 'file:///mock/optimized.jpg';
      const mockThumbnailUri = 'file:///mock/thumbnail.jpg';

      // Mock file info - use 1.5MB to avoid aggressive compression
      mockFileInfo.mockReturnValue({
        exists: true,
        size: 1.5 * 1024 * 1024, // 1.5MB (under 2MB threshold)
      });

      // Mock image manipulation
      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({
          uri: mockOptimizedUri,
          width: 1920,
          height: 1080,
        })
        .mockResolvedValueOnce({
          uri: mockThumbnailUri,
          width: 400,
          height: 225,
        });

      // Mock file copy
      mockFileCopy.mockResolvedValue(undefined);

      const result = await photoService.optimizePhoto(mockUri);

      expect(result).toHaveProperty('uri');
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('width', 1920);
      expect(result).toHaveProperty('height', 1080);
      expect(result.size).toBe(1.5 * 1024 * 1024);

      // Called twice: once for main photo resize, once for thumbnail
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(2);
      expect(mockFileCopy).toHaveBeenCalledTimes(2);
    });

    it('should apply aggressive compression for large files', async () => {
      const mockUri = 'file:///mock/large-photo.jpg';

      // Mock large file - first call for original, subsequent calls for compressed versions
      mockFileInfo
        .mockReturnValueOnce({ exists: true, size: 10 * 1024 * 1024 })  // Original: 10MB
        .mockReturnValueOnce({ exists: true, size: 3 * 1024 * 1024 })   // After first compression: 3MB (still too large)
        .mockReturnValueOnce({ exists: true, size: 1.5 * 1024 * 1024 }) // After aggressive: 1.5MB
        .mockReturnValue({ exists: true, size: 1.5 * 1024 * 1024 });    // All subsequent calls

      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({ uri: 'file:///mock/compressed.jpg', width: 1920, height: 1080 })
        .mockResolvedValueOnce({ uri: 'file:///mock/aggressive.jpg', width: 1280, height: 720 })
        .mockResolvedValueOnce({ uri: 'file:///mock/thumb.jpg', width: 400, height: 225 });

      mockFileCopy.mockResolvedValue(undefined);

      const result = await photoService.optimizePhoto(mockUri);

      // Should call manipulateAsync 3 times (first compression, aggressive compression, thumbnail)
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);

      // Check that aggressive compression was used
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { width: 1280 } }],
        expect.objectContaining({ compress: 0.6 })
      );

      // Final result should be the aggressively compressed size
      expect(result.size).toBe(1.5 * 1024 * 1024);
    });

    it('should preserve original size information', async () => {
      const mockUri = 'file:///mock/photo.jpg';
      const originalSize = 5 * 1024 * 1024; // 5MB
      const optimizedSize = 1.8 * 1024 * 1024; // 1.8MB

      mockFileInfo
        .mockReturnValueOnce({ exists: true, size: originalSize })
        .mockReturnValue({ exists: true, size: optimizedSize });

      (ImageManipulator.manipulateAsync as jest.Mock)
        .mockResolvedValueOnce({ uri: 'file:///opt.jpg', width: 1920, height: 1080 })
        .mockResolvedValueOnce({ uri: 'file:///thumb.jpg', width: 400, height: 225 });

      mockFileCopy.mockResolvedValue(undefined);

      const result = await photoService.optimizePhoto(mockUri);

      expect(result.originalSize).toBe(originalSize);
      expect(result.size).toBe(optimizedSize);
    });
  });

  describe('toBase64', () => {
    it('should convert photo to base64 data URI', async () => {
      const mockUri = 'file:///mock/photo.jpg';
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      mockFileText.mockResolvedValue(mockBase64);

      const result = await photoService.toBase64(mockUri);

      expect(result).toBe(`data:image/jpeg;base64,${mockBase64}`);
      expect(File).toHaveBeenCalledWith(mockUri);
      expect(mockFileText).toHaveBeenCalled();
    });

    it('should handle read errors', async () => {
      const mockUri = 'file:///mock/photo.jpg';

      mockFileText.mockRejectedValue(new Error('Read failed'));

      await expect(photoService.toBase64(mockUri)).rejects.toThrow();
    });
  });

  describe('convertToBase64', () => {
    it('should be an alias for toBase64', async () => {
      const mockUri = 'file:///mock/photo.jpg';
      const mockBase64 = 'base64data';

      mockFileText.mockResolvedValue(mockBase64);

      const result = await photoService.convertToBase64(mockUri);

      expect(result).toBe(`data:image/jpeg;base64,${mockBase64}`);
      expect(mockFileText).toHaveBeenCalled();
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo and thumbnail', async () => {
      const mockPhotoUri = 'file:///photos/12345.jpg';

      mockFileInfo.mockReturnValue({ exists: true });
      mockFileDelete.mockResolvedValue(undefined);

      await photoService.deletePhoto(mockPhotoUri);

      // Should create File instances for both photo and thumbnail
      expect(File).toHaveBeenCalledWith(mockPhotoUri);
      expect(File).toHaveBeenCalledWith(expect.stringContaining('12345_thumb.jpg'));
      expect(mockFileDelete).toHaveBeenCalledTimes(2);
    });

    it('should handle missing files gracefully', async () => {
      const mockPhotoUri = 'file:///photos/missing.jpg';

      mockFileInfo.mockReturnValue({ exists: false });

      await expect(photoService.deletePhoto(mockPhotoUri)).resolves.not.toThrow();
      expect(mockFileDelete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const mockPhotoUri = 'file:///photos/12345.jpg';

      mockFileInfo.mockReturnValue({ exists: true });
      mockFileDelete.mockRejectedValue(new Error('Delete failed'));

      await expect(photoService.deletePhoto(mockPhotoUri)).resolves.not.toThrow();
    });
  });

  describe('getStorageUsed', () => {
    it('should calculate total storage used', async () => {
      // Mock directory exists
      mockDirectoryInfo.mockReturnValue({ exists: true });

      // Mock file instances with sizes
      const mockFiles = [
        { path: 'photo1.jpg', info: () => ({ exists: true, size: 1024 * 1024 }) },      // 1MB
        { path: 'photo2.jpg', info: () => ({ exists: true, size: 2 * 1024 * 1024 }) },  // 2MB
        { path: 'photo3.jpg', info: () => ({ exists: true, size: 1.5 * 1024 * 1024 }) },// 1.5MB
      ];

      // Mock directory.list() to return async iterable
      mockDirectoryList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const file of mockFiles) {
            // Return File instances
            yield Object.assign(new File(file.path), {
              info: file.info,
            });
          }
        },
      });

      const result = await photoService.getStorageUsed();

      expect(result.photoCount).toBe(3);
      expect(result.totalSize).toBe(4.5 * 1024 * 1024); // 4.5MB
    });

    it('should return zero if directory does not exist', async () => {
      mockDirectoryInfo.mockReturnValue({ exists: false });

      const result = await photoService.getStorageUsed();

      expect(result.photoCount).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should handle empty directory', async () => {
      mockDirectoryInfo.mockReturnValue({ exists: true });

      // Mock empty directory
      mockDirectoryList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Yield nothing
        },
      });

      const result = await photoService.getStorageUsed();

      expect(result.photoCount).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should skip non-file items in directory', async () => {
      mockDirectoryInfo.mockReturnValue({ exists: true });

      const mockItems = [
        Object.assign(new File('photo1.jpg'), {
          info: () => ({ exists: true, size: 1024 * 1024 }),
        }),
        Object.assign(new Directory('subdir'), {
          info: () => ({ exists: true }),
        }),
        Object.assign(new File('photo2.jpg'), {
          info: () => ({ exists: true, size: 2 * 1024 * 1024 }),
        }),
      ];

      mockDirectoryList.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const item of mockItems) {
            yield item;
          }
        },
      });

      const result = await photoService.getStorageUsed();

      // Should only count File instances, not Directory
      expect(result.photoCount).toBe(2);
      expect(result.totalSize).toBe(3 * 1024 * 1024); // 3MB
    });
  });

  describe('clearAll', () => {
    it('should delete both directories and reinitialize', async () => {
      mockDirectoryInfo.mockReturnValue({ exists: true });
      mockDirectoryDelete.mockResolvedValue(undefined);
      mockDirectoryCreate.mockResolvedValue(undefined);

      await photoService.clearAll();

      // Should delete both directories
      expect(mockDirectoryDelete).toHaveBeenCalledTimes(2);
      expect(mockDirectoryDelete).toHaveBeenCalledWith({ idempotent: true });

      // Should recreate directories (initialize called)
      expect(mockDirectoryCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle non-existent directories', async () => {
      mockDirectoryInfo.mockReturnValue({ exists: false });
      mockDirectoryCreate.mockResolvedValue(undefined);

      await expect(photoService.clearAll()).resolves.not.toThrow();

      // Should still try to initialize
      expect(mockDirectoryCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('capturePhoto', () => {
    // Note: capturePhoto uses ImagePicker which would need separate mocking
    // This is a placeholder for future integration tests
    it.skip('should capture photo using device camera', async () => {
      // TODO: Mock expo-image-picker
    });
  });
});
