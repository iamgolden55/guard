/**
 * VenueTermsModal Component
 * Display and accept venue-specific safety protocols and terms
 */

import React, { useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Heading3, Caption, Button, Checkbox, Card } from '@components/ui';
import { colors, getColors, spacing, layout } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';

interface VenueTermsModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  venueName: string;
  venueRequirements?: {
    requires_fire_exit_check?: boolean;
    requires_capacity_check?: boolean;
    requires_id_scan?: boolean;
  };
}

export const VenueTermsModal: React.FC<VenueTermsModalProps> = ({
  visible,
  onClose,
  onAccept,
  venueName,
  venueRequirements = {},
}) => {
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [safetyProtocolsRead, setSafetyProtocolsRead] = useState(false);

  // Safety protocols (these would come from venue settings in production)
  const safetyProtocols = [
    'Emergency exits are clearly marked and must remain unobstructed at all times',
    'Maximum capacity limits must be strictly enforced',
    'Fire extinguishers are located at designated points throughout the venue',
    'First aid kit is available at the security desk',
    'Emergency contact numbers are posted in the security office',
    'All security staff must wear identification badges at all times',
    'Incident reports must be filed within 2 hours of any occurrence',
    'Regular patrols must be conducted every 30 minutes',
  ];

  // Handle accept
  const handleAccept = () => {
    // Validate confirmations
    if (!termsAccepted) {
      Alert.alert(
        'Terms Required',
        'Please confirm that you have read and accept the venue terms and conditions.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!safetyProtocolsRead) {
      Alert.alert(
        'Safety Protocols Required',
        'Please confirm that you have read and understand all safety protocols.',
        [{ text: 'OK' }]
      );
      return;
    }

    // All validations passed
    logger.info('[VenueTermsModal] Terms accepted for venue:', venueName);
    onAccept();

    // Reset state
    setTermsAccepted(false);
    setSafetyProtocolsRead(false);
  };

  // Handle close
  const handleClose = () => {
    if (termsAccepted || safetyProtocolsRead) {
      Alert.alert(
        'Exit Without Accepting?',
        'You must accept the venue terms to complete check-in. Are you sure you want to exit?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => {
              setTermsAccepted(false);
              setSafetyProtocolsRead(false);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: themeColors.border.light }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Body style={[styles.headerTitle, { color: themeColors.text.primary }]}>Venue Terms</Body>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Venue Info */}
          <View style={[styles.venueHeader, { backgroundColor: themeColors.background.primary }]}>
            <Ionicons name="business" size={32} color={colors.primary} />
            <View style={styles.venueInfo}>
              <Caption color={themeColors.text.secondary}>WORKING AT</Caption>
              <Heading3 style={{ color: themeColors.text.primary }}>{venueName}</Heading3>
            </View>
          </View>

          {/* Required Checks Section */}
          {(venueRequirements.requires_fire_exit_check ||
            venueRequirements.requires_capacity_check ||
            venueRequirements.requires_id_scan) && (
            <Card variant="flat" padding="lg" style={[styles.section, { backgroundColor: themeColors.background.primary }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <Body style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Required Security Checks</Body>
              </View>

              <BodySmall color={themeColors.text.secondary} style={styles.sectionDescription}>
                You will be responsible for performing the following checks during your shift:
              </BodySmall>

              {venueRequirements.requires_fire_exit_check && (
                <View style={[styles.requirementItem, { backgroundColor: themeColors.background.secondary }]}>
                  <Ionicons name="flame" size={18} color={colors.warning} />
                  <BodySmall style={[styles.requirementText, { color: themeColors.text.primary }]}>
                    Fire Exit Checks - Ensure all emergency exits are clear and accessible
                  </BodySmall>
                </View>
              )}

              {venueRequirements.requires_capacity_check && (
                <View style={[styles.requirementItem, { backgroundColor: themeColors.background.secondary }]}>
                  <Ionicons name="people" size={18} color={colors.info} />
                  <BodySmall style={[styles.requirementText, { color: themeColors.text.primary }]}>
                    Capacity Monitoring - Track and enforce maximum occupancy limits
                  </BodySmall>
                </View>
              )}

              {venueRequirements.requires_id_scan && (
                <View style={[styles.requirementItem, { backgroundColor: themeColors.background.secondary }]}>
                  <Ionicons name="card" size={18} color={colors.success} />
                  <BodySmall style={[styles.requirementText, { color: themeColors.text.primary }]}>
                    ID Scanning - Verify identification for all patrons as required
                  </BodySmall>
                </View>
              )}
            </Card>
          )}

          {/* Safety Protocols Section */}
          <Card variant="flat" padding="lg" style={[styles.section, { backgroundColor: themeColors.background.primary }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Body style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Safety Protocols</Body>
            </View>

            <BodySmall color={themeColors.text.secondary} style={styles.sectionDescription}>
              Please review the following safety protocols for this venue:
            </BodySmall>

            {safetyProtocols.map((protocol, index) => (
              <View key={index} style={styles.protocolItem}>
                <View style={styles.protocolBullet}>
                  <Caption style={styles.protocolNumber}>{index + 1}</Caption>
                </View>
                <BodySmall style={[styles.protocolText, { color: themeColors.text.primary }]}>{protocol}</BodySmall>
              </View>
            ))}
          </Card>

          {/* Emergency Contact Section */}
          <Card variant="flat" padding="lg" style={[styles.section, { backgroundColor: themeColors.background.primary }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="call" size={20} color={colors.error} />
              <Body style={[styles.sectionTitle, { color: themeColors.text.primary }]}>Emergency Contacts</Body>
            </View>

            <View style={styles.emergencyContact}>
              <Ionicons name="warning" size={16} color={colors.error} />
              <BodySmall style={[styles.emergencyText, { color: themeColors.text.primary }]}>
                Emergency Services: <Body style={styles.emergencyNumber}>999</Body>
              </BodySmall>
            </View>

            <View style={styles.emergencyContact}>
              <Ionicons name="headset" size={16} color={colors.primary} />
              <BodySmall style={[styles.emergencyText, { color: themeColors.text.primary }]}>
                Venue Manager: Contact via venue radio or security desk
              </BodySmall>
            </View>
          </Card>

          {/* Confirmation Checkboxes */}
          <View style={styles.confirmations}>
            <Checkbox
              checked={safetyProtocolsRead}
              onChange={setSafetyProtocolsRead}
              label="I have read and understand all safety protocols for this venue"
              style={styles.checkbox}
            />

            <Checkbox
              checked={termsAccepted}
              onChange={setTermsAccepted}
              label="I accept the venue terms and conditions and agree to follow all security procedures"
              style={styles.checkbox}
            />
          </View>
        </ScrollView>

        {/* Footer with Accept Button */}
        <View style={[styles.footer, { backgroundColor: themeColors.background.primary, borderTopColor: themeColors.border.light }]}>
          <Button
            variant="primary"
            size="large"
            onPress={handleAccept}
            disabled={!termsAccepted || !safetyProtocolsRead}
            fullWidth
            title="Accept & Complete Check-In"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied via inline style for dark mode
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
    paddingBottom: spacing.md,
    // backgroundColor and borderBottomColor applied via inline style for dark mode
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
    padding: spacing.lg,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // backgroundColor applied via inline style for dark mode
    padding: spacing.lg,
    borderRadius: layout.borderRadius.lg,
    marginBottom: spacing.lg,
  },
  venueInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionDescription: {
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    // backgroundColor applied via inline style for dark mode
    borderRadius: layout.borderRadius.sm,
    marginBottom: spacing.sm,
  },
  requirementText: {
    flex: 1,
    lineHeight: 20,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  protocolBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolNumber: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  protocolText: {
    flex: 1,
    lineHeight: 20,
  },
  emergencyContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emergencyText: {
    flex: 1,
  },
  emergencyNumber: {
    fontWeight: '700',
    color: colors.error,
  },
  confirmations: {
    marginTop: spacing.md,
  },
  checkbox: {
    marginBottom: spacing.lg,
  },
  footer: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.xl,
    // backgroundColor and borderTopColor applied via inline style for dark mode
    borderTopWidth: 1,
  },
});
