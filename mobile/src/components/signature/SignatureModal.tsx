/**
 * SignatureModal Component
 * Digital signature capture for shift check-in/check-out
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Button, Checkbox } from '@components/ui';
import { colors, getColors, spacing, layout } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onSignatureConfirmed: (signatureData: string) => void;
  title?: string;
  showVenueConfirmation?: boolean;
  showSIAConfirmation?: boolean;
  showSafetyConfirmation?: boolean;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  visible,
  onClose,
  onSignatureConfirmed,
  title = 'Digital Signature',
  showVenueConfirmation = true,
  showSIAConfirmation = true,
  showSafetyConfirmation = true,
}) => {
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);

  const [signature, setSignature] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Confirmation checkboxes
  const [venueConfirmed, setVenueConfirmed] = useState(false);
  const [siaConfirmed, setSiaConfirmed] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  const signatureRef = useRef<any>(null);

  // Handle signature drawing
  const handleBegin = () => {
    setHasDrawn(true);
    setIsDrawing(true);
    logger.debug('[SignatureModal] User started drawing signature');
  };

  // Handle signature completion
  const handleEnd = () => {
    setIsDrawing(false);
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    }
  };

  // Capture signature data
  const handleOK = (signatureData: string) => {
    logger.info('[SignatureModal] Signature captured');
    setSignature(signatureData);
  };

  // Clear signature
  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
      setSignature(null);
      setHasDrawn(false);
      setIsDrawing(false);
      logger.debug('[SignatureModal] Signature cleared');
    }
  };

  // Validate and confirm signature
  const handleConfirm = () => {
    // Validate signature exists
    if (!hasDrawn || !signature) {
      Alert.alert(
        'Signature Required',
        'Please provide your digital signature before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate confirmations
    const confirmations = [
      { checked: !showVenueConfirmation || venueConfirmed, message: 'venue arrival' },
      { checked: !showSIAConfirmation || siaConfirmed, message: 'SIA license validity' },
      { checked: !showSafetyConfirmation || safetyConfirmed, message: 'safety protocols' },
    ];

    const missingConfirmation = confirmations.find(c => !c.checked);
    if (missingConfirmation) {
      Alert.alert(
        'Confirmation Required',
        `Please confirm ${missingConfirmation.message} before continuing.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // All validations passed
    logger.info('[SignatureModal] Signature confirmed with all validations');
    onSignatureConfirmed(signature);

    // Reset state
    handleClear();
    setVenueConfirmed(false);
    setSiaConfirmed(false);
    setSafetyConfirmed(false);
  };

  // Handle close with confirmation if signature exists
  const handleClose = () => {
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
              setVenueConfirmed(false);
              setSiaConfirmed(false);
              setSafetyConfirmed(false);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  // Signature canvas HTML/CSS style - use light background for visibility in both modes
  const signatureStyle = `
    .signature-pad {
      width: 100%;
      height: 100%;
      background-color: ${isDark ? '#1f2937' : 'white'};
    }
    .signature-pad-body {
      border: 2px solid ${themeColors.border.light};
      border-radius: 8px;
    }
  `;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: themeColors.border.light }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Body style={[styles.headerTitle, { color: themeColors.text.primary }]}>{title}</Body>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDrawing}
        >
          {/* Instructions */}
          <View style={styles.instructions}>
            <Body style={[styles.instructionsTitle, { color: themeColors.text.primary }]}>Sign Below</Body>
            <BodySmall color={themeColors.text.secondary}>
              Use your finger to draw your signature in the box below
            </BodySmall>
          </View>

          {/* Signature Canvas */}
          <View style={[styles.canvasContainer, { backgroundColor: isDark ? '#1f2937' : colors.white, borderColor: themeColors.border.light }]}>
            <SignatureCanvas
              ref={signatureRef}
              onOK={handleOK}
              onBegin={handleBegin}
              onEnd={handleEnd}
              descriptionText=""
              clearText="Clear"
              confirmText="Done"
              webStyle={signatureStyle}
              autoClear={false}
              backgroundColor="rgba(255,255,255,0)"
              penColor={isDark ? '#ffffff' : colors.text.primary}
              minWidth={2}
              maxWidth={4}
            />
          </View>

          {/* Clear Button */}
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            disabled={!hasDrawn}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={hasDrawn ? colors.primary : colors.gray[400]}
            />
            <Body
              style={
                hasDrawn
                  ? styles.clearButtonText
                  : [styles.clearButtonText, styles.clearButtonTextDisabled]
              }
            >
              Clear Signature
            </Body>
          </TouchableOpacity>

          {/* Confirmation Checkboxes */}
          <View style={styles.confirmations}>
            <Body style={[styles.confirmationsTitle, { color: themeColors.text.primary }]}>Confirmations</Body>

            {showVenueConfirmation && (
              <Checkbox
                checked={venueConfirmed}
                onChange={setVenueConfirmed}
                label="I confirm I have arrived at the venue"
                style={styles.checkbox}
              />
            )}

            {showSIAConfirmation && (
              <Checkbox
                checked={siaConfirmed}
                onChange={setSiaConfirmed}
                label="I have verified my SIA license is valid"
                style={styles.checkbox}
              />
            )}

            {showSafetyConfirmation && (
              <Checkbox
                checked={safetyConfirmed}
                onChange={setSafetyConfirmed}
                label="I have read the venue safety protocols"
                style={styles.checkbox}
              />
            )}
          </View>
        </ScrollView>

        {/* Footer with Confirm Button */}
        <View style={[styles.footer, { backgroundColor: themeColors.background.primary, borderTopColor: themeColors.border.light }]}>
          <Button
            variant="primary"
            size="large"
            onPress={handleConfirm}
            disabled={!hasDrawn}
            fullWidth
            title="Confirm Signature"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
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
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
  },
  instructions: {
    marginBottom: spacing.lg,
  },
  instructionsTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  canvasContainer: {
    height: 250,
    width: '100%',
    borderWidth: 2,
    borderRadius: layout.borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  clearButtonText: {
    marginLeft: spacing.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  clearButtonTextDisabled: {
    color: colors.gray[400],
  },
  confirmations: {
    marginTop: spacing.md,
  },
  confirmationsTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  checkbox: {
    marginBottom: spacing.md,
  },
  footer: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.xl,
    borderTopWidth: 1,
  },
});
