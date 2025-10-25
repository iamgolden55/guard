/**
 * SignatureCanvas Component
 * Full-screen signature capture with validation and export
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import SignaturePad from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Container, Heading2, Body, Caption, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';

interface SignatureCanvasProps {
  title?: string;
  subtitle?: string;
  onConfirm: (signatureData: string) => void;
  onClose: () => void;
  showExport?: boolean;
  requireValidation?: boolean;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  title = 'Digital Signature',
  subtitle = 'Sign below to confirm',
  onConfirm,
  onClose,
  showExport = true,
  requireValidation = true,
}) => {
  const [signature, setSignature] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const signatureRef = useRef<any>(null);

  // Handle signature drawing start
  const handleBegin = () => {
    setHasDrawn(true);
    setIsDrawing(true);
    logger.debug('[SignatureCanvas] User started drawing signature');
  };

  // Handle signature drawing end
  const handleEnd = () => {
    setIsDrawing(false);
    setStrokeCount((prev) => prev + 1);
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    }
  };

  // Capture signature data
  const handleOK = (signatureData: string) => {
    logger.info('[SignatureCanvas] Signature captured');
    setSignature(signatureData);
  };

  // Clear signature
  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
      setSignature(null);
      setHasDrawn(false);
      setIsDrawing(false);
      setStrokeCount(0);
      logger.debug('[SignatureCanvas] Signature cleared');
    }
  };

  // Validate signature complexity
  const validateSignature = (): { valid: boolean; message?: string } => {
    if (!hasDrawn || !signature) {
      return {
        valid: false,
        message: 'Please provide your signature before continuing.',
      };
    }

    // Check minimum stroke count (signature should have at least 3 strokes)
    if (requireValidation && strokeCount < 3) {
      return {
        valid: false,
        message: 'Please provide a more detailed signature. Draw at least your initials.',
      };
    }

    // Check signature data length (should be substantial)
    if (requireValidation && signature.length < 500) {
      return {
        valid: false,
        message: 'Signature appears too simple. Please sign with more detail.',
      };
    }

    return { valid: true };
  };

  // Export signature as PNG
  const handleExport = async () => {
    if (!signature) {
      Alert.alert('No Signature', 'Please sign before exporting.');
      return;
    }

    try {
      logger.info('[SignatureCanvas] Exporting signature');

      // Convert base64 to file
      const filename = `signature_${Date.now()}.png`;
      const file = new File(Paths.document, filename);

      // Extract base64 data (remove data:image/png;base64, prefix)
      const base64Data = signature.replace(/^data:image\/png;base64,/, '');

      await file.write(base64Data);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'image/png',
          dialogTitle: 'Export Signature',
        });

        logger.info('[SignatureCanvas] Signature exported successfully');
      } else {
        Alert.alert(
          'Export Saved',
          `Signature saved to: ${file.uri}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('[SignatureCanvas] Export failed', { error });
      Alert.alert('Export Failed', 'Unable to export signature. Please try again.');
    }
  };

  // Confirm signature
  const handleConfirm = () => {
    const validation = validateSignature();

    if (!validation.valid) {
      Alert.alert('Invalid Signature', validation.message, [{ text: 'OK' }]);
      return;
    }

    logger.info('[SignatureCanvas] Signature confirmed', {
      strokeCount,
      dataLength: signature?.length,
    });

    onConfirm(signature!);
  };

  // Handle close with confirmation if signature exists
  const handleCloseWithConfirmation = () => {
    if (hasDrawn && signature) {
      Alert.alert(
        'Discard Signature?',
        'Are you sure you want to close without confirming your signature?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              handleClear();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  // Signature canvas web style
  const signatureStyle = `
    .signature-pad {
      width: 100%;
      height: 100%;
      background-color: white;
    }
    .signature-pad-body {
      border: none;
    }
  `;

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCloseWithConfirmation} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Heading2 style={styles.title}>{title}</Heading2>
          {subtitle && <Caption color={colors.text.secondary}>{subtitle}</Caption>}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Body color={colors.text.secondary}>
          Use your finger to draw your signature in the box below
        </Body>
        {requireValidation && (
          <Caption color={colors.text.secondary} style={styles.validationHint}>
            Your signature must have at least 3 strokes
          </Caption>
        )}
      </View>

      {/* Signature Canvas */}
      <View style={styles.canvasContainer}>
        <SignaturePad
          ref={signatureRef}
          onOK={handleOK}
          onBegin={handleBegin}
          onEnd={handleEnd}
          descriptionText=""
          clearText="Clear"
          confirmText="Done"
          webStyle={signatureStyle}
          autoClear={false}
          backgroundColor={colors.white}
          penColor={colors.text.primary}
          minWidth={2}
          maxWidth={4}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.topActions}>
          <TouchableOpacity
            onPress={handleClear}
            style={[styles.actionButton, !hasDrawn && styles.actionButtonDisabled]}
            disabled={!hasDrawn}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={hasDrawn ? colors.primary : colors.text.disabled}
            />
            <Body
              color={hasDrawn ? colors.primary : colors.text.disabled}
              style={styles.actionButtonText}
            >
              Clear
            </Body>
          </TouchableOpacity>

          {showExport && (
            <TouchableOpacity
              onPress={handleExport}
              style={[styles.actionButton, !signature && styles.actionButtonDisabled]}
              disabled={!signature}
            >
              <Ionicons
                name="share-outline"
                size={20}
                color={signature ? colors.primary : colors.text.disabled}
              />
              <Body
                color={signature ? colors.primary : colors.text.disabled}
                style={styles.actionButtonText}
              >
                Export
              </Body>
            </TouchableOpacity>
          )}
        </View>

        {/* Confirm Button */}
        <Button
          variant="primary"
          size="large"
          onPress={handleConfirm}
          disabled={!hasDrawn}
          style={styles.confirmButton}
        >
          Confirm Signature
        </Button>
      </View>

      {/* Stroke Counter (for debugging) */}
      {__DEV__ && hasDrawn && (
        <Caption color={colors.text.secondary} style={styles.debugInfo}>
          Strokes: {strokeCount} | Data length: {signature?.length || 0}
        </Caption>
      )}
    </Container>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    textAlign: 'center',
  },
  instructions: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  validationHint: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  canvasContainer: {
    flex: 1,
    margin: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  actions: {
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  confirmButton: {
    width: '100%',
  },
  debugInfo: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? spacing['3xl'] : spacing['2xl'],
    left: spacing.lg,
    fontSize: 10,
  },
});
