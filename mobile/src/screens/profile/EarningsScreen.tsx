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
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Container } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '../../services/api';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { Invoice } from '../../types/invoice';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const EarningsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year' | 'custom'>('month');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [displayedInvoices, setDisplayedInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earningsStats, setEarningsStats] = useState({
    currentMonth: 0,
    lastMonth: 0,
    ytd: 0,
    customTotal: 0,
    shiftsCompleted: 0, 
  });

  // Custom Report State
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await apiService.get(API_ENDPOINTS.INVOICES.LIST);
      // Handle pagination or direct array response
      const invoiceList = Array.isArray(response) ? response : response.results || [];
      
      setInvoices(invoiceList);
      setDisplayedInvoices(invoiceList);
      calculateEarnings(invoiceList);

      // If we were in custom mode and refreshed, reset or re-filter?
      // Let's reset to avoid confusion
      if (selectedPeriod === 'custom') {
        setSelectedPeriod('month');
      }
    } catch (error) {
      logger.error('Failed to fetch invoices', error);
      Alert.alert('Error', 'Failed to load earnings information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

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
      }
      
      // Last Month Check
      if (invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear) {
          lastMonthTotal += amount;
      }
    });

    setEarningsStats(prev => ({
      ...prev,
      currentMonth: monthTotal,
      lastMonth: lastMonthTotal,
      ytd: yearTotal,
    }));
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
    
    // Construct full URL if it's relative
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    try {
      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Error', 'Cannot open this link: ' + fullUrl);
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred while trying to open the PDF.');
    }
  };

  const openCustomReportModal = () => {
    // Default to current month range
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start);
    setEndDate(now);
    setReportModalVisible(true);
  };

  const generateReport = () => {
    setReportModalVisible(false);
    setSelectedPeriod('custom');
    setLoading(true); // Artificial loading feeling + ensures UI updates

    // Filter invoices
    const filtered = invoices.filter(inv => {
      const invStart = new Date(inv.start_date);
      // Compare dates (ignoring time)
      const s = new Date(startDate); s.setHours(0,0,0,0);
      const e = new Date(endDate); e.setHours(23,59,59,999);
      const i = new Date(invStart); i.setHours(12,0,0,0); // Mid-day for safety
      
      return i >= s && i <= e;
    });

    setDisplayedInvoices(filtered);

    // Calculate total for this period
    const total = filtered.reduce((sum, inv) => {
      const amount = typeof inv.total_amount === 'string' ? parseFloat(inv.total_amount) : inv.total_amount;
      return sum + amount;
    }, 0);

    setEarningsStats(prev => ({
      ...prev,
      customTotal: total,
    }));

    // Small timeout to allow UI to render properly
    setTimeout(() => setLoading(false), 300);
  };

  const clearReport = () => {
    setSelectedPeriod('month');
    setDisplayedInvoices(invoices);
  };

  const onDateChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
    if (Platform.OS === 'android') {
      if (type === 'start') setShowStartDatePicker(false);
      if (type === 'end') setShowEndDatePicker(false);
    }

    if (selectedDate) {
      if (type === 'start') setStartDate(selectedDate);
      if (type === 'end') setEndDate(selectedDate);
    }
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
                            <Text style={styles.amountLabel}>
                                {selectedPeriod === 'custom' ? 'Custom Period Earnings' : 'Total Earnings'}
                            </Text>
                            <Text style={styles.amountValue}>
                                {selectedPeriod === 'month' 
                                    ? formatCurrency(earningsStats.currentMonth) 
                                    : (selectedPeriod === 'year' 
                                        ? formatCurrency(earningsStats.ytd)
                                        : formatCurrency(earningsStats.customTotal))}
                            </Text>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>
                                    {selectedPeriod === 'month' ? 'Last Month' : (selectedPeriod === 'year' ? 'Previous Year' : 'Period')}
                                </Text>
                                <Text style={styles.statValue}>
                                    {selectedPeriod === 'month' 
                                        ? formatCurrency(earningsStats.lastMonth)
                                        : (selectedPeriod === 'custom' 
                                            ? `${startDate.toLocaleDateString('en-GB', {month:'short'})}-${endDate.toLocaleDateString('en-GB', {month:'short'})}`
                                            : 'N/A')} 
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
                    <TouchableOpacity style={styles.actionButton} onPress={openCustomReportModal}>
                        <View style={styles.actionIcon}>
                            <Ionicons name="calendar-outline" size={24} color="#0066FF" />
                        </View>
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Custom Report</Text>
                            <Text style={styles.actionSubtitle}>Generate for specific dates</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>

                    {selectedPeriod === 'custom' && (
                        <TouchableOpacity 
                            style={[styles.actionButton, { marginTop: 10, backgroundColor: '#FFF0F0', borderColor: '#FECACA' }]} 
                            onPress={clearReport}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
                                <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
                            </View>
                            <View style={styles.actionTextContainer}>
                                <Text style={[styles.actionTitle, { color: '#B91C1C' }]}>Clear Report</Text>
                                <Text style={styles.actionSubtitle}>Show all invoices</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Recent Statements (Invoices) */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        {selectedPeriod === 'custom' ? 'Filtered Invoices' : 'Invoices & Statements'}
                    </Text>
                </View>

                <View style={styles.statementsContainer}>
                    {displayedInvoices.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>No invoices found for this period.</Text>
                    ) : (
                        displayedInvoices.map((invoice) => (
                            <TouchableOpacity 
                                key={invoice.id} 
                                style={styles.statementItem}
                                onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: invoice.id })}
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
                                        <TouchableOpacity onPress={() => handleDownloadStatement(invoice.pdf_url)} style={{ padding: 4 }}>
                                            <Ionicons name="download-outline" size={20} color="#0066FF" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
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

      {/* Date Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            
            <View style={styles.datePickerContainer}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>Start Date</Text>
                {Platform.OS === 'android' && (
                  <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={styles.dateButton}>
                    <Text style={styles.dateButtonText}>{startDate.toLocaleDateString()}</Text>
                    <Ionicons name="calendar" size={20} color="#0066FF" />
                  </TouchableOpacity>
                )}
                {(Platform.OS === 'ios' || showStartDatePicker) && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                    onChange={(e, date) => onDateChange(e, date, 'start')}
                    style={Platform.OS === 'ios' ? { width: 120 } : undefined}
                  />
                )}
              </View>

              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>End Date</Text>
                 {Platform.OS === 'android' && (
                  <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={styles.dateButton}>
                    <Text style={styles.dateButtonText}>{endDate.toLocaleDateString()}</Text>
                    <Ionicons name="calendar" size={20} color="#0066FF" />
                  </TouchableOpacity>
                )}
                {(Platform.OS === 'ios' || showEndDatePicker) && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                    onChange={(e, date) => onDateChange(e, date, 'end')}
                    style={Platform.OS === 'ios' ? { width: 120 } : undefined}
                  />
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.generateButton} onPress={generateReport}>
                <Text style={styles.generateButtonText}>Generate Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  datePickerContainer: {
    marginBottom: spacing.xl,
    gap: spacing.lg,
  },
  dateInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 15,
    color: '#0066FF',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  generateButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});