/**
 * VenueTermsScreen
 * Display and accept venue-specific terms before check-in
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Container,
  Heading2,
  Heading3,
  Body,
  BodySmall,
  Caption,
  Button,
} from '@components/ui';
import { colors, spacing, layout } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { log } from '../../utils/logger';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface VenueTermsScreenProps {
  route: {
    params: {
      venueId: number;
      venueName: string;
      venueTerms: string;
      onAccept: () => void;
    };
  };
}

export const VenueTermsScreen: React.FC<VenueTermsScreenProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { venueId, venueName, venueTerms, onAccept } = route.params;
  const [isAccepted, setIsAccepted] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  // Handle scroll to bottom
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;

    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
      log('[VenueTermsScreen] User scrolled to bottom');
    }
  };

  // Handle accept
  const handleAccept = () => {
    if (!isAccepted) {
      return;
    }

    log('[VenueTermsScreen] Terms accepted for venue:', venueId);
    onAccept();
    navigation.goBack();
  };

  // Handle close
  const handleClose = () => {
    log('[VenueTermsScreen] Terms rejected, closing');
    navigation.goBack();
  };

  // Default terms if none provided
  const displayTerms = venueTerms || getDefaultTerms();

  return (
    <Container scrollable={false} safeArea padding="none">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Heading2 style={styles.headerTitle}>Venue Terms</Heading2>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Venue Info */}
      <View style={styles.venueInfo}>
        <Ionicons name="location" size={24} color={colors.primary} />
        <View style={styles.venueTextContainer}>
          <Heading3 style={styles.venueName}>{venueName}</Heading3>
          <Caption color={colors.text.secondary}>
            Please review and accept the terms below
          </Caption>
        </View>
      </View>

      {/* Terms Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.termsContainer}>
          <Body style={styles.termsText}>{displayTerms}</Body>
        </View>

        {/* Scroll indicator */}
        {!hasScrolledToBottom && (
          <View style={styles.scrollIndicator}>
            <Ionicons
              name="arrow-down"
              size={20}
              color={colors.primary}
              style={styles.scrollIcon}
            />
            <Caption color={colors.primary} style={styles.scrollText}>
              Scroll to read all terms
            </Caption>
          </View>
        )}
      </ScrollView>

      {/* Acceptance Checkbox */}
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setIsAccepted(!isAccepted)}
          disabled={!hasScrolledToBottom}
        >
          <View
            style={[
              styles.checkboxBox,
              isAccepted && styles.checkboxBoxChecked,
              !hasScrolledToBottom && styles.checkboxBoxDisabled,
            ]}
          >
            {isAccepted && (
              <Ionicons name="checkmark" size={20} color={colors.white} />
            )}
          </View>
          <Body
            style={[
              styles.checkboxLabel,
              !hasScrolledToBottom && styles.checkboxLabelDisabled,
            ]}
          >
            I have read and accept the venue terms and conditions
          </Body>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          onPress={handleClose}
          style={styles.declineButton}
        >
          Decline
        </Button>

        <Button
          variant="primary"
          onPress={handleAccept}
          disabled={!isAccepted || !hasScrolledToBottom}
          style={styles.acceptButton}
          icon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />}
        >
          Accept & Continue
        </Button>
      </View>
    </Container>
  );
};

// Default terms template
const getDefaultTerms = () => `
VENUE ACCESS AND CONDUCT TERMS

1. GENERAL CONDUCT
You must maintain professional conduct at all times while on venue premises. Any behavior deemed inappropriate by venue management may result in immediate removal.

2. SECURITY RESPONSIBILITIES
As security personnel, you are responsible for:
• Monitoring all entry and exit points
• Checking identification where required
• Reporting any suspicious activity immediately
• Maintaining crowd control and safety
• Following all emergency procedures

3. VENUE-SPECIFIC RULES
• No personal mobile phone use during active shifts (emergency calls excepted)
• Uniform must be worn correctly at all times
• No food or drink in patron areas
• All incidents must be logged immediately
• Follow radio communication protocols

4. SAFETY AND COMPLIANCE
• You must complete all required safety checks
• Fire exits must remain clear and accessible
• Capacity limits must be strictly enforced
• All venue policies supersede general guidelines
• Emergency services must be contacted immediately for serious incidents

5. CONFIDENTIALITY
You may not disclose any information about:
• Venue operations or procedures
• Patron information or incidents
• Security systems or protocols
• Staff or management details

6. LIABILITY
• You are responsible for your actions while on duty
• The venue is not liable for personal property
• All incidents must be reported accurately
• False reporting may result in termination

7. TERMINATION
The venue reserves the right to:
• Remove you from duty at any time
• Ban you from future shifts
• Report serious misconduct to authorities

By accepting these terms, you acknowledge that you have read, understood, and agree to abide by all venue policies and procedures.
`;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.white,
  },
  closeButton: {
    padding: spacing.xs,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSpacer: {
    width: 44,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: `${colors.primary}10`,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  venueTextContainer: {
    flex: 1,
  },
  venueName: {
    marginBottom: spacing.xs,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  termsContainer: {
    backgroundColor: colors.gray[50],
    padding: spacing.lg,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  termsText: {
    lineHeight: 24,
    color: colors.text.primary,
  },
  scrollIndicator: {
    alignItems: 'center',
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: `${colors.primary}15`,
    borderRadius: layout.borderRadius.md,
  },
  scrollIcon: {
    marginBottom: spacing.xs,
  },
  scrollText: {
    fontWeight: '600',
  },
  checkboxContainer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.white,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  checkboxBox: {
    width: 28,
    height: 28,
    borderRadius: layout.borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.gray[400],
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxBoxDisabled: {
    backgroundColor: colors.gray[100],
    borderColor: colors.gray[300],
  },
  checkboxLabel: {
    flex: 1,
    lineHeight: 22,
  },
  checkboxLabelDisabled: {
    color: colors.gray[400],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.white,
  },
  declineButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 2,
  },
});
