/**
 * IncidentReportScreen
 * Quick-tap incident type selection + navigation to detailed form
 * Uber-inspired design with full-width layout
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getUberColors, getUberShadows, uberSpacing, uberRadius } from '../../theme/uberTheme';
import { useTheme } from '../../hooks/useTheme';
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
    color: '#EF4444',
    severity: 'high',
  },
  {
    type: 'medical_emergency',
    icon: 'medical-outline',
    label: 'Medical Emergency',
    color: '#EF4444',
    severity: 'critical',
  },
  {
    type: 'fire_alarm',
    icon: 'flame-outline',
    label: 'Fire Alarm',
    color: '#F59E0B',
    severity: 'critical',
  },
  {
    type: 'suspicious_activity',
    icon: 'eye-outline',
    label: 'Suspicious Activity',
    color: '#F59E0B',
    severity: 'medium',
  },
  {
    type: 'property_damage',
    icon: 'hammer-outline',
    label: 'Property Damage',
    color: '#6B7280',
    severity: 'medium',
  },
  {
    type: 'assault',
    icon: 'alert-circle-outline',
    label: 'Assault',
    color: '#EF4444',
    severity: 'critical',
  },
];

export const IncidentReportScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { shiftId } = (route.params as { shiftId?: number }) || {};
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

  const handleQuickReport = (incidentType: IncidentTypeOption) => {
    logger.info('[IncidentReport] Quick report selected', { type: incidentType.type });
    navigation.navigate('IncidentForm', {
      shiftId,
      prefilledType: incidentType.type,
      prefilledSeverity: incidentType.severity,
    });
  };

  const handleDetailedReport = () => {
    logger.info('[IncidentReport] Detailed report selected');
    navigation.navigate('IncidentForm', { shiftId });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: uberColors.background.light }]} edges={['top']}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: uberColors.background.light }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Emergency Banner - Compact */}
        <View style={[styles.emergencyBanner, { backgroundColor: `${uberColors.error}10` }]}>
          <View style={[styles.emergencyIcon, { backgroundColor: `${uberColors.error}15` }]}>
            <Ionicons name="alert-circle" size={18} color={uberColors.error} />
          </View>
          <Text style={[styles.emergencyText, { color: uberColors.error }]}>
            Emergency? Call 999 first, then report here
          </Text>
        </View>

        {/* Quick Report Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>
            Quick Report
          </Text>
          <Text style={[styles.sectionSubtitle, { color: uberColors.text.secondary }]}>
            Tap to report an incident type
          </Text>
        </View>

        {/* Quick Report Grid - 2 Column Layout */}
        <View style={styles.quickGrid}>
          {INCIDENT_TYPES.map((incident) => (
            <TouchableOpacity
              key={incident.type}
              style={[
                styles.quickButton,
                { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light },
                uberShadows.soft
              ]}
              onPress={() => handleQuickReport(incident)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickIconContainer,
                  { backgroundColor: `${incident.color}12` }
                ]}
              >
                <Ionicons name={incident.icon as any} size={22} color={incident.color} />
              </View>
              <Text style={[styles.quickLabel, { color: uberColors.text.primary }]}>
                {incident.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alternative Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>
            Other Options
          </Text>

          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light },
              uberShadows.soft
            ]}
            onPress={handleDetailedReport}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="document-text" size={24} color={uberColors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: uberColors.text.primary }]}>Detailed Form</Text>
              <Text style={[styles.optionDescription, { color: uberColors.text.secondary }]}>
                Fill out a comprehensive incident report
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={uberColors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Footer Info Text */}
        <View style={[styles.footerBadge, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }]}>
          <Ionicons name="location" size={14} color={uberColors.text.muted} />
          <Text style={[styles.footerText, { color: uberColors.text.muted }]}>
            All incidents include automatic timestamps and location
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: uberSpacing.md,
    paddingHorizontal: uberSpacing.lg,
    paddingBottom: uberSpacing['3xl'],
  },
  // Emergency Banner - Compact & Visible
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.md,
    borderRadius: uberRadius.lg,
    gap: uberSpacing.sm,
    marginBottom: uberSpacing.xl,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  // Section Titles
  section: {
    marginBottom: uberSpacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: uberSpacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  // Quick Report Grid - 2 Column Layout
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uberSpacing.sm,
    marginBottom: uberSpacing.xl,
  },
  quickButton: {
    width: '48%',
    borderRadius: uberRadius.lg,
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: uberSpacing.sm,
  },
  quickIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  // Option Cards
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: uberSpacing.base,
    borderRadius: uberRadius.lg,
    borderWidth: 1,
    marginBottom: uberSpacing.sm,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uberSpacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
  // Footer Badge
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uberSpacing.xs,
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.base,
    borderRadius: uberRadius.lg,
    borderWidth: 1,
    marginTop: uberSpacing.md,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
