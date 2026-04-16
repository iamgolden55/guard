/**
 * TeamMemberProfileScreen
 * Read-only profile view for a team member, shown as a modal from the Team screen.
 */

import React from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../types/navigation';
import { PresenceBadge, PresenceStatus } from './components/PresenceBadge';
import { getTeamsColors } from '../../theme/teamsColors';
import { spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { LinearGradient } from 'expo-linear-gradient';

type TeamMemberProfileRoute = RouteProp<MainStackParamList, 'TeamMemberProfile'>;

const roleLabels: Record<string, string> = {
  ds: 'Door Supervisor',
  sg: 'Security Guard',
  cctv: 'CCTV Operator',
  cp: 'Close Protection',
  steward: 'Steward',
  k9: 'Dog Handler',
  retail: 'Retail Security',
  static: 'Static Guard',
  mobile: 'Mobile Patrol',
  event: 'Event Security',
};

const licenseTypeLabels: Record<string, string> = {
  ds: 'Door Supervision',
  sg: 'Security Guarding',
  cctv: 'Public Space CCTV',
  cp: 'Close Protection',
  vi: 'Vehicle Immobiliser',
  ki: 'Key Holding',
};

export const TeamMemberProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<TeamMemberProfileRoute>();
  const { isDark } = useTheme();
  const teamsColors = getTeamsColors(isDark);
  const {
    name,
    role,
    photo,
    presenceStatus,
    currentVenue,
    securityRoles,
    employmentType,
    siaLicenseTypes,
    isOnShift,
    activeShift,
  } = route.params;

  const formatTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: teamsColors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: teamsColors.background.primary, borderBottomColor: teamsColors.border.light }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={teamsColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: teamsColors.text.primary }]}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="rgba(255,255,255,0.9)" />
              </LinearGradient>
            )}
            <View style={styles.presenceBadge}>
              <PresenceBadge status={presenceStatus as PresenceStatus} size="large" />
            </View>
          </View>
        </View>

        {/* Name and Role */}
        <Text style={[styles.name, { color: teamsColors.text.primary }]}>{name}</Text>
        <Text style={[styles.role, { color: teamsColors.text.secondary }]}>{role}</Text>

        {/* Shift Status Card */}
        <View style={[styles.card, { backgroundColor: teamsColors.background.primary }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: isOnShift ? '#00B67A15' : `${teamsColors.text.tertiary}15` }]}>
              <Ionicons
                name={isOnShift ? 'shield-checkmark' : 'ellipse-outline'}
                size={22}
                color={isOnShift ? '#00B67A' : teamsColors.text.tertiary}
              />
            </View>
            <Text style={[styles.cardTitle, { color: teamsColors.text.primary }]}>Shift Status</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: teamsColors.text.secondary }]}>Status</Text>
              <Text style={[styles.infoValue, { color: isOnShift ? '#00B67A' : teamsColors.text.tertiary }]}>
                {isOnShift ? 'On Shift' : 'Off Duty'}
              </Text>
            </View>
            {isOnShift && activeShift?.venue_name && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: teamsColors.text.secondary }]}>Venue</Text>
                <Text style={[styles.infoValue, { color: teamsColors.text.primary }]}>{activeShift.venue_name}</Text>
              </View>
            )}
            {isOnShift && activeShift?.check_in_time && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: teamsColors.text.secondary }]}>Checked In</Text>
                <Text style={[styles.infoValue, { color: teamsColors.text.primary }]}>{formatTime(activeShift.check_in_time)}</Text>
              </View>
            )}
            {isOnShift && activeShift?.role_on_shift && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: teamsColors.text.secondary }]}>Role</Text>
                <Text style={[styles.infoValue, { color: teamsColors.text.primary }]}>
                  {roleLabels[activeShift.role_on_shift] || activeShift.role_on_shift}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Qualifications Card */}
        {(siaLicenseTypes.length > 0 || securityRoles.length > 0) && (
          <View style={[styles.card, { backgroundColor: teamsColors.background.primary }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#0066FF15' }]}>
                <Ionicons name="ribbon" size={22} color="#0066FF" />
              </View>
              <Text style={[styles.cardTitle, { color: teamsColors.text.primary }]}>Qualifications</Text>
            </View>
            <View style={styles.cardBody}>
              {siaLicenseTypes.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: teamsColors.text.secondary }]}>SIA Licenses</Text>
                  <View style={styles.pillContainer}>
                    {siaLicenseTypes.map((type) => (
                      <View key={type} style={[styles.pill, { backgroundColor: '#0066FF15' }]}>
                        <Text style={[styles.pillText, { color: '#0066FF' }]}>
                          {licenseTypeLabels[type] || type.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {securityRoles.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: teamsColors.text.secondary, marginTop: siaLicenseTypes.length > 0 ? spacing.md : 0 }]}>
                    Security Roles
                  </Text>
                  <View style={styles.pillContainer}>
                    {securityRoles.map((r) => (
                      <View key={r} style={[styles.pill, { backgroundColor: '#8B5CF615' }]}>
                        <Text style={[styles.pillText, { color: '#8B5CF6' }]}>
                          {roleLabels[r] || r}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Employment Type Card */}
        {employmentType && (
          <View style={[styles.card, { backgroundColor: teamsColors.background.primary }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#FF980015' }]}>
                <Ionicons name="briefcase" size={22} color="#FF9800" />
              </View>
              <Text style={[styles.cardTitle, { color: teamsColors.text.primary }]}>Employment</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: teamsColors.text.secondary }]}>Type</Text>
                <Text style={[styles.infoValue, { color: teamsColors.text.primary }]}>{employmentType}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  role: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  card: {
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBody: {},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: spacing.xl * 2,
  },
});
