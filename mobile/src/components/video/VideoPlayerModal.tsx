/**
 * VideoPlayerModal Component
 * Fullscreen modal for playing incident evidence videos
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption } from '@components/ui';
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoPlayerModalProps {
  visible: boolean;
  videoUri: string | null;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  visible,
  videoUri,
  onClose,
}) => {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
      setIsPlaying(true);
      setPosition(0);
      logger.info('[VideoPlayerModal] Opening video player', { videoUri });
    } else {
      // Pause video when modal closes
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
      }
    }
  }, [visible, videoUri]);

  // Handle video load completion
  const handleLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setDuration(status.durationMillis || 0);
      logger.info('[VideoPlayerModal] Video loaded', {
        duration: status.durationMillis,
        uri: videoUri,
      });
    }
  };

  // Handle playback status updates
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setPosition(status.positionMillis || 0);

      // Check if video ended
      if (status.didJustFinish && !status.isLooping) {
        setIsPlaying(false);
        logger.info('[VideoPlayerModal] Video playback finished');
      }
    }
  };

  // Handle video errors
  const handleError = (error: string) => {
    setHasError(true);
    setIsLoading(false);
    logger.error('[VideoPlayerModal] Video error', { error, videoUri });
  };

  // Toggle play/pause
  const togglePlayPause = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        logger.info('[VideoPlayerModal] Video paused');
      } else {
        await videoRef.current.playAsync();
        logger.info('[VideoPlayerModal] Video playing');
      }
    } catch (error) {
      logger.error('[VideoPlayerModal] Play/pause error', { error });
    }
  };

  // Seek to position
  const handleSeek = async (positionMs: number) => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.setPositionAsync(positionMs);
      logger.info('[VideoPlayerModal] Seeked to', { position: positionMs });
    } catch (error) {
      logger.error('[VideoPlayerModal] Seek error', { error });
    }
  };

  // Replay video
  const handleReplay = async () => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.replayAsync();
      logger.info('[VideoPlayerModal] Replaying video');
    } catch (error) {
      logger.error('[VideoPlayerModal] Replay error', { error });
    }
  };

  // Close modal
  const handleClose = () => {
    logger.info('[VideoPlayerModal] Closing video player');
    onClose();
  };

  // Format time in mm:ss
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!videoUri) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <View style={styles.closeButtonBackground}>
            <Ionicons name="close" size={28} color={colors.white} />
          </View>
        </TouchableOpacity>

        {/* Video Player */}
        <View style={styles.videoContainer}>
          {hasError ? (
            // Error State
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={64} color={colors.error} />
              <Body color={colors.white} style={styles.errorTitle}>
                Unable to Load Video
              </Body>
              <Caption color={colors.gray[300]} style={styles.errorMessage}>
                The video file may be corrupted or in an unsupported format.
              </Caption>
              <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
                <Body color={colors.white}>Close</Body>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls={Platform.OS === 'ios'}
                shouldPlay={isPlaying}
                isLooping={false}
                onLoad={handleLoad}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onError={handleError}
              />

              {/* Loading Indicator */}
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.white} />
                  <Caption color={colors.white} style={styles.loadingText}>
                    Loading video...
                  </Caption>
                </View>
              )}

              {/* Custom Controls for Android */}
              {Platform.OS === 'android' && !isLoading && !hasError && (
                <View style={styles.controls}>
                  {/* Play/Pause Button */}
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={togglePlayPause}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={32}
                      color={colors.white}
                    />
                  </TouchableOpacity>

                  {/* Time Display */}
                  <View style={styles.timeContainer}>
                    <Caption color={colors.white} style={styles.timeText}>
                      {formatTime(position)} / {formatTime(duration)}
                    </Caption>
                  </View>

                  {/* Replay Button */}
                  <TouchableOpacity
                    style={styles.replayButton}
                    onPress={handleReplay}
                  >
                    <Ionicons name="refresh" size={24} color={colors.white} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Caption color={colors.gray[300]} style={styles.infoText}>
            {Platform.OS === 'ios'
              ? 'Use native controls to play, pause, and seek'
              : 'Tap play to start video playback'}
          </Caption>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? spacing['3xl'] : spacing.xl,
    right: spacing.lg,
    zIndex: 10,
  },
  closeButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    marginTop: spacing.lg,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  replayButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  infoText: {
    textAlign: 'center',
    fontSize: 13,
  },
});
