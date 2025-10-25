/**
 * PhotoPreview Component
 * Preview captured photo before confirming
 */

import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button } from '@components/ui';
import { colors, spacing } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface PhotoPreviewProps {
  photoUri: string;
  onConfirm: () => void;
  onRetake: () => void;
}

export const PhotoPreview: React.FC<PhotoPreviewProps> = ({
  photoUri,
  onConfirm,
  onRetake,
}) => {
  return (
    <View style={styles.container}>
      {/* Photo */}
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Body color={colors.white} style={styles.headerText}>
            Photo Captured
          </Body>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Button
          variant="secondary"
          onPress={onRetake}
          style={styles.retakeButton}
          icon={<Ionicons name="camera-outline" size={20} color={colors.white} />}
        >
          Retake
        </Button>

        <Button
          variant="primary"
          onPress={onConfirm}
          style={styles.confirmButton}
          icon={<Ionicons name="checkmark" size={20} color={colors.white} />}
        >
          Use Photo
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    paddingTop: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  retakeButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});
