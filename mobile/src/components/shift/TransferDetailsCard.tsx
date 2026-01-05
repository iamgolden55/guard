/**
 * TransferDetailsCard - Wise-Inspired Transfer Status Display
 * Clean, timeline-based visualization of transfer/release status
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Shift } from '../../store/slices/shiftsSlice';
import { colors as themeColors, spacing } from '../../theme';

interface TransferDetailsCardProps {
  exchange?: Shift['pending_exchange'];
  release?: Shift['pending_release'];
  onCancel: () => void;
}

// Status step types for the timeline
type StepStatus = 'completed' | 'active' | 'pending';

interface TimelineStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  status: StepStatus;
}

export const TransferDetailsCard: React.FC<TransferDetailsCardProps> = ({
  exchange,
  release,
  onCancel,
}) => {
  // Helper function to get initials
  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Helper function to get avatar color based on name
  const getAvatarColor = (name: string): string => {
    const avatarColors = [
      '#0061FF', '#00C853', '#FF6B00', '#9C27B0',
      '#00BCD4', '#FF5722', '#4CAF50', '#163300'
    ];
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  // Render timeline step
  const renderTimelineStep = (step: TimelineStep, isLast: boolean) => {
    const isCompleted = step.status === 'completed';
    const isActive = step.status === 'active';

    return (
      <View key={step.title} style={styles.timelineStep}>
        {/* Timeline indicator */}
        <View style={styles.timelineIndicator}>
          <View style={[
            styles.stepDot,
            isCompleted && styles.stepDotCompleted,
            isActive && styles.stepDotActive,
          ]}>
            {isCompleted ? (
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            ) : isActive ? (
              <View style={styles.activePulse} />
            ) : null}
          </View>
          {!isLast && (
            <View style={[
              styles.stepLine,
              isCompleted && styles.stepLineCompleted,
            ]} />
          )}
        </View>

        {/* Step content */}
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <View style={[
              styles.stepIconCircle,
              isActive && styles.stepIconCircleActive,
              isCompleted && styles.stepIconCircleCompleted,
            ]}>
              <Ionicons
                name={step.icon}
                size={16}
                color={isActive ? themeColors.primary : isCompleted ? themeColors.success : themeColors.gray[400]}
              />
            </View>
            <Text style={[
              styles.stepTitle,
              isActive && styles.stepTitleActive,
              isCompleted && styles.stepTitleCompleted,
            ]}>
              {step.title}
            </Text>
          </View>
          <Text style={[
            styles.stepDescription,
            isActive && styles.stepDescriptionActive,
          ]}>
            {step.description}
          </Text>
        </View>
      </View>
    );
  };

  // Render for Exchange (Transfer to specific person)
  if (exchange) {
    const fullName = `${exchange.target_user.first_name} ${exchange.target_user.last_name}`;
    const initials = getInitials(exchange.target_user.first_name, exchange.target_user.last_name);
    const avatarColor = getAvatarColor(fullName);
    const isAccepted = exchange.status === 'accepted_by_target';

    const exchangeSteps: TimelineStep[] = [
      {
        icon: 'paper-plane-outline',
        title: 'Request Sent',
        description: `Transfer request sent to ${exchange.target_user.first_name}`,
        status: 'completed',
      },
      {
        icon: 'person-outline',
        title: isAccepted ? 'Accepted' : 'Awaiting Response',
        description: isAccepted
          ? `${exchange.target_user.first_name} accepted the transfer`
          : `Waiting for ${exchange.target_user.first_name} to accept`,
        status: isAccepted ? 'completed' : 'active',
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'Manager Approval',
        description: 'Final approval from manager',
        status: isAccepted ? 'active' : 'pending',
      },
    ];

    return (
      <View style={styles.card}>
        {/* Header with recipient info */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="swap-horizontal" size={24} color={themeColors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Shift Transfer</Text>
            <Text style={styles.headerSubtitle}>In progress</Text>
          </View>
        </View>

        {/* Recipient card */}
        <View style={styles.recipientCard}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientLabel}>Transferring to</Text>
            <Text style={styles.recipientName}>{fullName}</Text>
          </View>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, isAccepted && styles.statusDotAccepted]} />
            <Text style={[styles.statusChipText, isAccepted && styles.statusChipTextAccepted]}>
              {isAccepted ? 'Accepted' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {exchangeSteps.map((step, index) =>
            renderTimelineStep(step, index === exchangeSteps.length - 1)
          )}
        </View>

        {/* Reason if provided */}
        {exchange.request_reason && (
          <View style={styles.reasonSection}>
            <Text style={styles.reasonLabel}>Your reason</Text>
            <Text style={styles.reasonText}>{exchange.request_reason}</Text>
          </View>
        )}

        {/* Cancel action */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={18} color={themeColors.error} />
          <Text style={styles.cancelButtonText}>Cancel Transfer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render for Release (Open pool)
  if (release) {
    const isClaimed = release.status === 'claimed';

    let claimerInfo = null;
    if (isClaimed && release.claimed_by) {
      const fullName = `${release.claimed_by.first_name} ${release.claimed_by.last_name}`;
      const initials = getInitials(release.claimed_by.first_name, release.claimed_by.last_name);
      const avatarColor = getAvatarColor(fullName);

      claimerInfo = (
        <View style={styles.recipientCard}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientLabel}>Claimed by</Text>
            <Text style={styles.recipientName}>{fullName}</Text>
          </View>
          <View style={styles.statusChip}>
            <View style={styles.statusDotAccepted} />
            <Text style={styles.statusChipTextAccepted}>Claimed</Text>
          </View>
        </View>
      );
    }

    const releaseSteps: TimelineStep[] = [
      {
        icon: 'hand-left-outline',
        title: 'Released',
        description: 'Shift added to open pool',
        status: 'completed',
      },
      {
        icon: 'people-outline',
        title: isClaimed ? 'Claimed' : 'Available',
        description: isClaimed
          ? `${release.claimed_by?.first_name} wants to take this shift`
          : 'Waiting for someone to claim',
        status: isClaimed ? 'completed' : 'active',
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'Manager Approval',
        description: 'Final approval from manager',
        status: isClaimed ? 'active' : 'pending',
      },
    ];

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, styles.headerIconRelease]}>
            <Ionicons name="people" size={24} color="#00897B" />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Released to Pool</Text>
            <Text style={styles.headerSubtitle}>
              {isClaimed ? 'Awaiting approval' : 'Available for pickup'}
            </Text>
          </View>
        </View>

        {/* Claimer info if claimed */}
        {claimerInfo}

        {/* Open pool indicator if not claimed */}
        {!isClaimed && (
          <View style={styles.poolIndicator}>
            <View style={styles.poolIconContainer}>
              <Ionicons name="globe-outline" size={28} color="#00897B" />
            </View>
            <View style={styles.poolContent}>
              <Text style={styles.poolTitle}>Open for all staff</Text>
              <Text style={styles.poolDescription}>
                Any qualified team member can claim this shift
              </Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timeline}>
          {releaseSteps.map((step, index) =>
            renderTimelineStep(step, index === releaseSteps.length - 1)
          )}
        </View>

        {/* Reason if provided */}
        {release.request_reason && (
          <View style={styles.reasonSection}>
            <Text style={styles.reasonLabel}>Your reason</Text>
            <Text style={styles.reasonText}>{release.request_reason}</Text>
          </View>
        )}

        {/* Cancel action */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={18} color={themeColors.error} />
          <Text style={styles.cancelButtonText}>Cancel Release</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: themeColors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.border.light,
    marginHorizontal: 0,
    marginVertical: spacing.md,
    overflow: 'hidden',
    // Make card stretch to full width (parent has alignItems: 'center')
    alignSelf: 'stretch',
    width: '100%',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.gray[100],
    backgroundColor: themeColors.gray[50],
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${themeColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconRelease: {
    backgroundColor: 'rgba(0, 137, 123, 0.1)',
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: themeColors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: themeColors.text.secondary,
    marginTop: 2,
  },

  // Recipient/Claimer card
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: themeColors.gray[50],
    borderRadius: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recipientInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  recipientLabel: {
    fontSize: 12,
    color: themeColors.text.secondary,
    letterSpacing: -0.1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: themeColors.text.primary,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: themeColors.warning + '15',
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: themeColors.warning,
    marginRight: 6,
  },
  statusDotAccepted: {
    backgroundColor: themeColors.success,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: themeColors.warning,
  },
  statusChipTextAccepted: {
    color: themeColors.success,
  },

  // Pool indicator (for release)
  poolIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(0, 137, 123, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 137, 123, 0.15)',
    borderStyle: 'dashed',
  },
  poolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 137, 123, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  poolTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00695C',
  },
  poolDescription: {
    fontSize: 13,
    color: '#00897B',
    marginTop: 2,
  },

  // Timeline
  timeline: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  timelineStep: {
    flexDirection: 'row',
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 24,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: themeColors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: themeColors.gray[200],
  },
  stepDotCompleted: {
    backgroundColor: themeColors.success,
    borderColor: themeColors.success,
  },
  stepDotActive: {
    backgroundColor: themeColors.white,
    borderColor: themeColors.primary,
    borderWidth: 2,
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: themeColors.primary,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: themeColors.gray[200],
    marginVertical: 4,
  },
  stepLineCompleted: {
    backgroundColor: themeColors.success,
  },
  stepContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.lg,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: themeColors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepIconCircleActive: {
    backgroundColor: `${themeColors.primary}15`,
  },
  stepIconCircleCompleted: {
    backgroundColor: `${themeColors.success}15`,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.gray[400],
  },
  stepTitleActive: {
    color: themeColors.primary,
  },
  stepTitleCompleted: {
    color: themeColors.text.primary,
  },
  stepDescription: {
    fontSize: 13,
    color: themeColors.gray[400],
    marginLeft: 36,
  },
  stepDescriptionActive: {
    color: themeColors.text.secondary,
  },

  // Reason section
  reasonSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: themeColors.gray[50],
    borderRadius: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: themeColors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  reasonText: {
    fontSize: 14,
    color: themeColors.text.primary,
    lineHeight: 20,
  },

  // Cancel button
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themeColors.gray[100],
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.error,
  },
});
