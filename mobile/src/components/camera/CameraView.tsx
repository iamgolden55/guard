/**
 * CameraView Component
 * Full-screen camera for capturing venue photos and incident evidence
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView as ExpoCameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption } from '@components/ui';
import { colors, spacing } from '../../theme';
import { log } from '../../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface CameraViewProps {
  onCapture: (photoUri: string) => void;
  onClose: () => void;
  purpose: 'check-in' | 'check-out' | 'incident' | 'profile';
}

export const CameraView: React.FC<CameraViewProps> = ({
  onCapture,
  onClose,
  purpose,
}) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<ExpoCameraView>(null);

  // Request permissions on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Get camera title based on purpose
  const getCameraTitle = () => {
    switch (purpose) {
      case 'check-in':
        return 'Check-In Photo';
      case 'check-out':
        return 'Check-Out Photo';
      case 'incident':
        return 'Incident Photo';
      case 'profile':
        return 'Profile Photo';
      default:
        return 'Take Photo';
    }
  };

  // Get instructions based on purpose
  const getInstructions = () => {
    switch (purpose) {
      case 'check-in':
      case 'check-out':
        return 'Take a clear photo of the venue entrance';
      case 'incident':
        return 'Capture evidence of the incident';
      case 'profile':
        return 'Take a clear photo of your face';
      default:
        return 'Position your subject in frame';
    }
  };

  // Handle permission denied
  if (permission && !permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.gray[400]} />
          <Body style={styles.permissionText}>Camera permission required</Body>
          <Caption color={colors.text.secondary} style={styles.permissionSubtext}>
            Please grant camera access to take photos
          </Caption>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Body color={colors.primary} style={styles.permissionButtonText}>
              Grant Permission
            </Body>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Handle camera not ready
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    log('[CameraView] Camera facing toggled:', facing === 'back' ? 'front' : 'back');
  };

  // Capture photo
  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      log('[CameraView] Capturing photo for:', purpose);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: true,
      });

      if (photo && photo.uri) {
        log('[CameraView] Photo captured:', photo.uri);
        onCapture(photo.uri);
      } else {
        throw new Error('Failed to capture photo');
      }
    } catch (error: any) {
      log('[CameraView] Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle close
  const handleClose = () => {
    log('[CameraView] Camera closed');
    onClose();
  };

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <ExpoCameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Body color={colors.white} style={styles.title}>
              {getCameraTitle()}
            </Body>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionsBox}>
            <Caption color={colors.white} style={styles.instructions}>
              {getInstructions()}
            </Caption>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.controls}>
          {/* Flash Toggle (placeholder - can add flash control) */}
          <View style={styles.controlButton} />

          {/* Capture Button */}
          <TouchableOpacity
            style={styles.captureButtonContainer}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color={colors.white} />
            ) : (
              <View style={styles.captureButton}>
                <View style={styles.captureButtonInner} />
              </View>
            )}
          </TouchableOpacity>

          {/* Flip Camera Button */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCameraFacing}
          >
            <Ionicons name="camera-reverse" size={32} color={colors.white} />
          </TouchableOpacity>
        </View>
      </ExpoCameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionText: {
    marginTop: spacing.lg,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionSubtext: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 22,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSpacer: {
    width: 44,
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  instructionsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignSelf: 'center',
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    paddingTop: spacing.xl,
  },
  controlButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white,
  },
});
