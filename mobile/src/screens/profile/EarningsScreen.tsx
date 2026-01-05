/**
 * EarningsScreen - Wise-Inspired Earnings Display
 * Shows earnings breakdown and allows generating statements
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { LinearGradient } from 'expo-linear-gradient';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Mock data for earnings
const MOCK_EARNINGS = {
  currentMonth: 2450.50,
  ytd: 18500.75,
  lastMonth: 2100.25,
  currency: '£',
};

const MOCK_STATEMENTS = [
  { id: '1', date: '2025-12-01', period: 'December 2025', amount: 2450.50 },
  { id: '2', date: '2025-11-01', period: 'November 2025', amount: 2100.25 },
  { id: '3', date: '2025-10-01', period: 'October 2025', amount: 2250.00 },
  { id: '4', date: '2025-09-01', period: 'September 2025', amount: 1950.80 },
];

export const EarningsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');

  const handleDownloadStatement = (period: string) => {
    Alert.alert(
      'Download Statement',
      `Downloading statement for ${period}...`,
      [{ text: 'OK' }]
    );
  };

  const handleGenerateCustomReport = () => {
    Alert.alert(
      'Custom Report',
      'Select date range for your report',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: () => console.log('Generate report') }
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `${MOCK_EARNINGS.currency}${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Container style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
        <Ionicons name="close" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.mainHeading}>EARNINGS</Text>
        <Text style={styles.subtitle}>Track your income and generate reports</Text>

        {/* Total Earnings Card */}
        <View style={styles.summaryCard}>
            <LinearGradient
                colors={['#0066FF', '#0052CC']}
                style={styles.summaryGradient}
            >
                <View style={styles.periodSelector}>
                    <TouchableOpacity 
                        style={[styles.periodTab, selectedPeriod === 'month' && styles.periodTabActive]}
                        onPress={() => setSelectedPeriod('month')}
                    >
                        <Text style={[styles.periodText, selectedPeriod === 'month' && styles.periodTextActive]}>This Month</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.periodTab, selectedPeriod === 'year' && styles.periodTabActive]}
                        onPress={() => setSelectedPeriod('year')}
                    >
                        <Text style={[styles.periodText, selectedPeriod === 'year' && styles.periodTextActive]}>Year to Date</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Total Earnings</Text>
                    <Text style={styles.amountValue}>
                        {selectedPeriod === 'month' 
                            ? formatCurrency(MOCK_EARNINGS.currentMonth) 
                            : formatCurrency(MOCK_EARNINGS.ytd)}
                    </Text>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>{selectedPeriod === 'month' ? 'Last Month' : 'Last Year'}</Text>
                        <Text style={styles.statValue}>
                            {selectedPeriod === 'month' 
                                ? formatCurrency(MOCK_EARNINGS.lastMonth)
                                : 'N/A'} 
                        </Text>
                    </View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Shifts Completed</Text>
                        <Text style={styles.statValue}>{selectedPeriod === 'month' ? '12' : '145'}</Text>
                    </View>
                </View>
            </LinearGradient>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
             <TouchableOpacity style={styles.actionButton} onPress={handleGenerateCustomReport}>
                <View style={styles.actionIcon}>
                    <Ionicons name="calendar-outline" size={24} color="#0066FF" />
                </View>
                <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Custom Report</Text>
                    <Text style={styles.actionSubtitle}>Generate for specific dates</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
        </View>

        {/* Recent Statements */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Statements</Text>
        </View>

        <View style={styles.statementsContainer}>
            {MOCK_STATEMENTS.map((statement) => (
                <TouchableOpacity 
                    key={statement.id} 
                    style={styles.statementItem}
                    onPress={() => handleDownloadStatement(statement.period)}
                >
                    <View style={styles.statementIcon}>
                        <Ionicons name="document-text-outline" size={24} color="#666" />
                    </View>
                    <View style={styles.statementInfo}>
                        <Text style={styles.statementPeriod}>{statement.period}</Text>
                        <Text style={styles.statementDate}>Issued {statement.date}</Text>
                    </View>
                    <View style={styles.statementRight}>
                        <Text style={styles.statementAmount}>{formatCurrency(statement.amount)}</Text>
                        <Ionicons name="download-outline" size={20} color="#0066FF" />
                    </View>
                </TouchableOpacity>
            ))}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    backgroundColor: colors.white,
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dededeff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  // Header
  mainHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Summary Card
  summaryCard: {
    borderRadius: 24,
    marginBottom: spacing.xl,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: spacing.lg,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.lg,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: 'white',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  periodTextActive: {
    color: '#0066FF',
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  amountLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountValue: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
    padding: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  // Actions
  actionsContainer: {
    marginBottom: spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  // Statements Section
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  statementsContainer: {
    gap: spacing.sm,
  },
  statementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statementInfo: {
    flex: 1,
  },
  statementPeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  statementDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  statementRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statementAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
});
