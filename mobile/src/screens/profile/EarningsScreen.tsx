/**
 * EarningsScreen
 * Shows earnings breakdown and allows viewing/downloading statements (invoices)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '../../services/api';
import { API_ENDPOINTS } from '../../config/api.config';
import { logger } from '../../utils/logger';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Interface matching the API response
interface Invoice {
  id: number;
  start_date: string;
  end_date: string;
  total_amount: string | number;
  status: 'pending' | 'paid' | 'overdue';
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export const EarningsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earningsStats, setEarningsStats] = useState({
    currentMonth: 0,
    lastMonth: 0,
    ytd: 0,
    shiftsCompleted: 0, // Note: invoices might not have shift count directly unless calculated
  });

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.INVOICES.LIST);
      // Handle pagination or direct array response
      const invoiceList = Array.isArray(response) ? response : response.results || [];
      
      setInvoices(invoiceList);
      calculateEarnings(invoiceList);
    } catch (error) {
      logger.error('Failed to fetch invoices', error);
      Alert.alert('Error', 'Failed to load earnings information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const calculateEarnings = (invoiceList: Invoice[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let monthTotal = 0;
    let lastMonthTotal = 0;
    let yearTotal = 0;
    
    invoiceList.forEach(inv => {
      const invDate = new Date(inv.start_date); // Use start date for period
      const amount = typeof inv.total_amount === 'string' ? parseFloat(inv.total_amount) : inv.total_amount;

      // Current Year (YTD)
      if (invDate.getFullYear() === currentYear) {
        yearTotal += amount;
        
        // Current Month
        if (invDate.getMonth() === currentMonth) {
          monthTotal += amount;
        }
        
        // Last Month
        if (invDate.getMonth() === lastMonth) { // Logic specific to current year check is tricky for Jan, strictly:
           // This simple logic assumes filters are applied correctly. 
           // Better logic below for cross-year:
        }
      }
      
      // Strict Last Month Check (could be Dec of prev year)
      if (invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear) {
          lastMonthTotal += amount;
      }
    });

    setEarningsStats({
      currentMonth: monthTotal,
      lastMonth: lastMonthTotal,
      ytd: yearTotal,
      shiftsCompleted: 0, // Not available in invoice summary list typically
    });
  };

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDownloadStatement = async (url: string | null) => {
    if (!url) {
      Alert.alert('Unavailable', 'No PDF statement available for this period.');
      return;
    }
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link: ' + url);
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred while trying to open the PDF.');
    }
  };

  const handleGenerateCustomReport = () => {
    Alert.alert(
      'Custom Report',
      'Select date range for your report (Feature coming soon)',
      [
        { text: 'OK' }
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPeriod = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    return `${start.toLocaleDateString('en-GB', { month: 'short' })} - ${end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
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
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <Text style={styles.mainHeading}>EARNINGS</Text>
        <Text style={styles.subtitle}>Track your income and invoices</Text>

        {loading ? (
            <View style={{ padding: 40 }}>
                <ActivityIndicator size="large" color="#0066FF" />
            </View>
        ) : (
            <>
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
                                    ? formatCurrency(earningsStats.currentMonth) 
                                    : formatCurrency(earningsStats.ytd)}
                            </Text>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>{selectedPeriod === 'month' ? 'Last Month' : 'Previous Year'}</Text>
                                <Text style={styles.statValue}>
                                    {selectedPeriod === 'month' 
                                        ? formatCurrency(earningsStats.lastMonth)
                                        : 'N/A'} 
                                </Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Status</Text>
                                <Text style={styles.statValue}>Verified</Text>
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

                {/* Recent Statements (Invoices) */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Invoices & Statements</Text>
                </View>

                <View style={styles.statementsContainer}>
                    {invoices.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>No invoices found.</Text>
                    ) : (
                        invoices.map((invoice) => (
                            <TouchableOpacity 
                                key={invoice.id} 
                                style={styles.statementItem}
                                onPress={() => handleDownloadStatement(invoice.pdf_url)}
                            >
                                <View style={styles.statementIcon}>
                                    <Ionicons name="document-text-outline" size={24} color="#666" />
                                </View>
                                <View style={styles.statementInfo}>
                                    <Text style={styles.statementPeriod}>{formatPeriod(invoice.start_date, invoice.end_date)}</Text>
                                    <Text style={styles.statementDate}>Issued {new Date(invoice.created_at).toLocaleDateString()}</Text>
                                    <View style={{ flexDirection: 'row', marginTop: 2 }}>
                                        <Text style={[ 
                                            styles.statusPill, 
                                            { color: invoice.status === 'paid' ? '#00B67A' : (invoice.status === 'overdue' ? 'red' : '#F59E0B') }
                                        ]}>
                                            {invoice.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.statementRight}>
                                    <Text style={styles.statementAmount}>
                                        {formatCurrency(typeof invoice.total_amount === 'string' ? parseFloat(invoice.total_amount) : invoice.total_amount)}
                                    </Text>
                                    {invoice.pdf_url ? (
                                        <Ionicons name="download-outline" size={20} color="#0066FF" />
                                    ) : (
                                        <Text style={{ fontSize: 10, color: '#999' }}>Processing</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </>
        )}

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
  statusPill: {
      fontSize: 10,
      fontWeight: '700',
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