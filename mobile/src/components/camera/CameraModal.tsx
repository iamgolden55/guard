/**
 * CameraModal Component
 * Modal for capturing venue photos during check-in/check-out
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Body, BodySmall, Button } from '@components/ui';
import { colors, spacing, layout } from '../../theme';
import { logger } from '../../utils/logger';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoTaken: (photoUri: string) => void;
  title?: string;
  tips?: string[];
}

export const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  onClose,
  onPhotoTaken,
  title = 'Take Venue Photo',
  tips = [
    'Capture full venue entrance',
    'Ensure good lighting',
    'Include venue signage if visible',
  ],
}) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  // Request permission if not granted
  React.useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  // Handle taking photo
  const handleTakePhoto = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      logger.info('[CameraModal] Taking photo...');

      // Take picture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
      });

      if (!photo) {
        logger.error('[CameraModal] No photo returned');
        setIsProcessing(false);
        return;
      }

      logger.info('[CameraModal] Photo taken, optimizing...', {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });

      // Optimize and compress photo
      const optimized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1920 } }], // Max width 1920px
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      logger.info('[CameraModal] Photo optimized', {
        uri: optimized.uri,
        width: optimized.width,
        height: optimized.height,
      });

      // Return photo URI to parent
      onPhotoTaken(optimized.uri);
      onClose();
    } catch (error) {
      logger.error('[CameraModal] Error taking photo:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  // Close modal
  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  // Show permission denied message
  if (permission && !permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Body style={styles.headerTitle}>{title}</Body>
            <View style={styles.closeButton} />
          </View>

          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color={colors.gray[400]} />
            <Body style={styles.permissionTitle}>Camera Permission Required</Body>
            <BodySmall color={colors.text.secondary} style={styles.permissionText}>
              We need access to your camera to take venue photos for check-in verification.
            </BodySmall>
            <Button variant="primary" size="large" onPress={requestPermission}>
              Grant Permission
            </Button>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Body style={styles.headerTitle}>{title}</Body>
          <View style={styles.closeButton} />
        </View>

        {/* Camera View */}
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
            {/* Tips Overlay */}
            {showTips && (
              <View style={styles.tipsOverlay}>
                <View style={styles.tipsCard}>
                  <Body style={styles.tipsTitle}>Tips for good photos:</Body>
                  {tips.map((tip, index) => (
                    <BodySmall key={index} style={styles.tipText}>
                      • {tip}
                    </BodySmall>
                  ))}
                  <TouchableOpacity
                    onPress={() => setShowTips(false)}
                    style={styles.dismissButton}
                  >
                    <BodySmall color={colors.primary}>Got it</BodySmall>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Crosshair Guide */}
            <View style={styles.crosshair}>
              <View style={styles.crosshairCorner} />
            </View>
          </CameraView>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Flip Camera Button */}
          <TouchableOpacity
            onPress={toggleCameraFacing}
            style={styles.controlButton}
            disabled={isProcessing}
          >
            <Ionicons name="camera-reverse" size={32} color={colors.white} />
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            onPress={handleTakePhoto}
            style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          {/* Show Tips Button */}
          <TouchableOpacity
            onPress={() => setShowTips(true)}
            style={styles.controlButton}
            disabled={isProcessing}
          >
            <Ionicons name="help-circle" size={32} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  tipsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  tipsCard: {
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
  },
  tipsTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  tipText: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  dismissButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-end',
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -100,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: layout.borderRadius.md,
  },
  crosshairCorner: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 30,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.xl,
    backgroundColor: colors.black,
  },
  controlButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.gray[300],
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray[400],
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
    backgroundColor: colors.white,
  },
  permissionTitle: {
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
});
