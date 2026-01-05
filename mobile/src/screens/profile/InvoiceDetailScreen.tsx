/**
 * InvoiceDetailScreen
 * Shows detailed breakdown of an invoice including shifts and rates
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Card, Body, BodySmall, Heading3 } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { apiService } from '../../services/api';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { Invoice, InvoiceItem } from '../../types/invoice';
import { useAppSelector } from '../../hooks/useRedux';
import { selectAccessToken } from '../../store/slices/authSlice';
import { downloadAndShareAuthenticated } from '../../utils/document';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'InvoiceDetail'>;

export const InvoiceDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { invoiceId } = route.params;
  const token = useAppSelector(selectAccessToken);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoiceDetails = useCallback(async () => {
    try {
      setLoading(true);
      // API_ENDPOINTS.INVOICES.DETAIL is a function that returns the URL string
      // @ts-ignore - TS might complain if types aren't fully updated but it is a function in config
      const endpoint = typeof API_ENDPOINTS.INVOICES.DETAIL === 'function' 
        ? API_ENDPOINTS.INVOICES.DETAIL(invoiceId)
        : API_ENDPOINTS.INVOICES.DETAIL.replace('{id}', invoiceId.toString());
        
      const response = await apiService.get(endpoint);
      setInvoice(response);
    } catch (error) {
      logger.error('Failed to fetch invoice details', error);
      Alert.alert('Error', 'Failed to load invoice details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [invoiceId, navigation]);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [fetchInvoiceDetails]);

  const handleDownloadPDF = async () => {
    if (!invoice?.pdf_url) return;
    
    // Construct full URL if it's relative
    const fullUrl = invoice.pdf_url.startsWith('http') ? invoice.pdf_url : `${API_BASE_URL}${invoice.pdf_url}`;

    // Use authenticated download helper
    const fileName = `invoice-${invoice.id}.pdf`;
    await downloadAndShareAuthenticated(fullUrl, fileName, token);
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading) {
    return (
      <Container style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Body style={{ marginTop: spacing.md }}>Loading invoice details...</Body>
        </View>
      </Container>
    );
  }

  if (!invoice) return null;

  const isPending = invoice.status === 'pending';
  const breakdown = invoice.payment_breakdown;

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Heading3 style={styles.headerTitle}>Invoice #{invoice.id}</Heading3>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.label}>Total Amount</Text>
              <Text style={styles.amount}>{formatCurrency(invoice.total_amount)}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: isPending ? '#FFF4E5' : (invoice.status === 'paid' ? '#E6F4EA' : '#FEE2E2') }
            ]}>
              <Text style={[
                styles.statusText,
                { color: isPending ? '#B95000' : (invoice.status === 'paid' ? '#137333' : '#B91C1C') }
              ]}>
                {invoice.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.dateRow}>
            <View>
              <Text style={styles.label}>Period</Text>
              <Text style={styles.value}>
                {new Date(invoice.start_date).toLocaleDateString()} - {new Date(invoice.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </Card>

        {/* Breakdown Section */}
        {breakdown && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Breakdown</Text>
            <Card style={styles.breakdownCard}>
              {/* Regular Shifts */}
              {breakdown.regular_shifts.count > 0 && (
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownInfo}>
                    <Text style={styles.breakdownTitle}>Regular Shifts</Text>
                    <Text style={styles.breakdownSubtitle}>
                      {breakdown.regular_shifts.count} shifts • {breakdown.regular_shifts.hours} hrs
                    </Text>
                  </View>
                  <View style={styles.breakdownAmount}>
                    <Text style={styles.value}>{formatCurrency(breakdown.regular_shifts.amount)}</Text>
                    {breakdown.regular_shifts.average_rate && (
                       <Text style={styles.rate}>@{formatCurrency(breakdown.regular_shifts.average_rate)}/hr</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Special Events */}
              {breakdown.special_event_shifts.count > 0 && (
                <>
                  <View style={styles.divider} />
                  <View style={[styles.breakdownRow, { backgroundColor: '#FFF9F0', marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 8 }]}>
                    <View style={styles.breakdownInfo}>
                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="star" size={14} color="#B95000" style={{ marginRight: 4 }} />
                          <Text style={[styles.breakdownTitle, { color: '#B95000' }]}>Special Events</Text>
                       </View>
                      <Text style={styles.breakdownSubtitle}>
                        {breakdown.special_event_shifts.count} shifts • {breakdown.special_event_shifts.hours} hrs
                      </Text>
                    </View>
                    <View style={styles.breakdownAmount}>
                      <Text style={[styles.value, { color: '#B95000' }]}>{formatCurrency(breakdown.special_event_shifts.amount)}</Text>
                       {breakdown.special_event_shifts.average_rate && (
                           <Text style={[styles.rate, { color: '#B95000' }]}>@{formatCurrency(breakdown.special_event_shifts.average_rate)}/hr</Text>
                       )}
                    </View>
                  </View>
                </>
              )}

              <View style={styles.divider} />
              
              {/* Total */}
              <View style={styles.breakdownRow}>
                <Text style={styles.totalLabel}>Total Hours</Text>
                <Text style={styles.totalValue}>{breakdown.total.hours} hrs</Text>
              </View>
            </Card>
          </View>
        )}

        {/* Shift Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shift Details</Text>
          {invoice.items && invoice.items.length > 0 ? (
             invoice.items.map((item, index) => (
               <Card key={item.id || index} style={[styles.shiftCard, item.shift_details?.is_special_event && styles.specialShiftCard]}>
                 <View style={styles.shiftHeader}>
                   <Text style={styles.shiftDate}>{formatDate(item.date)}</Text>
                   <Text style={styles.shiftAmount}>{formatCurrency(item.amount)}</Text>
                 </View>
                 <Text style={styles.shiftVenue}>{item.venue_details?.name || item.venue}</Text>
                 <View style={styles.shiftMeta}>
                   <Text style={styles.shiftDetail}>
                     {item.hours_worked} hrs @ {formatCurrency(item.rate)}/hr
                   </Text>
                   {item.shift_details?.is_special_event && (
                     <View style={styles.specialBadge}>
                       <Text style={styles.specialBadgeText}>Special Event</Text>
                     </View>
                   )}
                 </View>
               </Card>
             ))
          ) : (
            <Text style={styles.emptyText}>No shift details available.</Text>
          )}
        </View>

      </ScrollView>

      {/* Floating Action Button for PDF */}
      {invoice.pdf_url && (
        <View style={styles.footer}>
           <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPDF}>
             <Ionicons name="document-text" size={20} color="white" style={{ marginRight: 8 }} />
             <Text style={styles.downloadButtonText}>Download PDF Statement</Text>
           </TouchableOpacity>
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  statusCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateRow: {
    marginTop: spacing.sm,
  },
  label: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: spacing.md,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  breakdownCard: {
    padding: spacing.md,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownAmount: {
    alignItems: 'flex-end',
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  breakdownSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  rate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  shiftCard: {
    padding: spacing.md,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  specialShiftCard: {
    borderLeftColor: '#F59E0B',
    backgroundColor: '#FFFCF8',
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  shiftDate: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  shiftAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  shiftVenue: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  shiftMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  shiftDetail: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  specialBadge: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B95000',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.tertiary,
    marginTop: spacing.lg,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  downloadButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 12,
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});