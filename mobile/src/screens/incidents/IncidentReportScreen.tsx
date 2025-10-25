/**
 * IncidentReportScreen
 * Quick-tap incident type selection + navigation to detailed form
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Body, Caption } from '@components/ui';
import { colors, spacing, layout } from '../../theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import type { IncidentTypeOption } from '../../types/incident';
import { logger } from '../../utils/logger';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const INCIDENT_TYPES: IncidentTypeOption[] = [
  {
    type: 'security_breach',
    icon: 'shield-outline',
    label: 'Security Breach',
    color: colors.error,
    severity: 'high',
  },
  {
    type: 'medical_emergency',
    icon: 'medical-outline',
    label: 'Medical Emergency',
    color: colors.error,
    severity: 'critical',
  },
  {
    type: 'fire_alarm',
    icon: 'flame-outline',
    label: 'Fire Alarm',
    color: colors.warning,
    severity: 'critical',
  },
  {
    type: 'suspicious_activity',
    icon: 'eye-outline',
    label: 'Suspicious Activity',
    color: colors.warning,
    severity: 'medium',
  },
  {
    type: 'property_damage',
    icon: 'hammer-outline',
    label: 'Property Damage',
    color: colors.gray[600],
    severity: 'medium',
  },
  {
    type: 'assault',
    icon: 'alert-circle-outline',
    label: 'Assault',
    color: colors.error,
    severity: 'critical',
  },
];

export const IncidentReportScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { shiftId } = (route.params as { shiftId?: number }) || {};

  const handleQuickReport = (incidentType: IncidentTypeOption) => {
    logger.info('[IncidentReport] Quick report selected', { type: incidentType.type });
    navigation.navigate('IncidentForm', {
      shiftId,
      prefilledType: incidentType.type,
      prefilledSeverity: incidentType.severity,
    });
  };

  const handleVoiceReport = () => {
    logger.info('[IncidentReport] Voice report selected');
    navigation.navigate('VoiceReport', { shiftId });
  };

  const handleDetailedReport = () => {
    logger.info('[IncidentReport] Detailed report selected');
    navigation.navigate('IncidentForm', { shiftId });
  };

  return (
    <Container safeArea={false} style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Emergency Banner - Compact */}
        <View style={styles.emergencyBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Body style={styles.emergencyText}>
            Emergency? Call 999 first, then report here
          </Body>
        </View>

        {/* Quick Report Grid - 2 Column Layout */}
        <View style={styles.quickGrid}>
          {INCIDENT_TYPES.map((incident) => (
            <TouchableOpacity
              key={incident.type}
              style={styles.quickButton}
              onPress={() => handleQuickReport(incident)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickIconContainer,
                  { backgroundColor: `${incident.color}15` }
                ]}
              >
                <Ionicons name={incident.icon as any} size={20} color={incident.color} />
              </View>
              <Body style={styles.quickLabel}>{incident.label}</Body>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alternative Options */}
        <View style={styles.section}>
          <Body weight="semibold" style={styles.sectionTitle}>
            Other Options
          </Body>

          <TouchableOpacity style={styles.optionCard} onPress={handleVoiceReport} activeOpacity={0.7}>
            <View style={styles.optionIcon}>
              <Ionicons name="mic" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Body weight="semibold">Voice Report</Body>
              <Caption color={colors.text.secondary}>
                Record a voice message for hands-free reporting
              </Caption>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={handleDetailedReport} activeOpacity={0.7}>
            <View style={styles.optionIcon}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Body weight="semibold">Detailed Form</Body>
              <Caption color={colors.text.secondary}>
                Fill out a comprehensive incident report
              </Caption>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Footer Info Text */}
        <Caption color={colors.text.tertiary} style={styles.footerText}>
          All incidents include automatic timestamps and location
        </Caption>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    paddingTop: spacing.base,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  // Emergency Banner - Compact & Visible
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: `${colors.error}15`,
    borderRadius: layout.borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  emergencyText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  // Quick Report Grid - 2 Column Layout
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 0,
    alignContent: 'flex-start',
  },
  quickButton: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    ...layout.shadow.sm,
  },
  quickIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 14,
  },
  // Other Options Section
  section: {
    marginTop: spacing.base,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: spacing.sm,
    color: colors.text.secondary,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.md,
    ...layout.shadow.sm,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  // Footer Text
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
});
