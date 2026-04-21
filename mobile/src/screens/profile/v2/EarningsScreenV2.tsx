/**
 * EarningsScreenV2 — Earnings & statements re-skinned to match the Phase 4
 * design language. Preserves handlers from EarningsScreen: stats fetch,
 * paginated invoice list, pull-to-refresh, custom-report date range modal,
 * authenticated PDF download, invoice detail navigation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ListRenderItem,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import { apiService } from '../../../services/api';
import { API_ENDPOINTS, API_BASE_URL } from '../../../config/api.config';
import { downloadAndShareAuthenticated } from '../../../utils/document';
import { useAppSelector } from '../../../hooks/useRedux';
import { selectAccessToken } from '../../../store/slices/authSlice';
import { Invoice } from '../../../types/invoice';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type PeriodKey = 'month' | 'year' | 'custom';

const formatCurrency = (amount: number) =>
  `£${Number(amount || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatPeriod = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  return `${start.toLocaleDateString('en-GB', { month: 'short' })} – ${end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
};

const statusColor = (theme: ReturnType<typeof useRedesignTheme>, status: string) => {
  if (status === 'paid') return '#4ade80';
  if (status === 'overdue') return theme.colors.accent;
  return '#f59e0b';
};

export const EarningsScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const token = useAppSelector(selectAccessToken);

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [earningsStats, setEarningsStats] = useState({
    currentMonth: 0,
    lastMonth: 0,
    ytd: 0,
    customTotal: 0,
  });

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [filterStart, setFilterStart] = useState<Date | null>(null);
  const [filterEnd, setFilterEnd] = useState<Date | null>(null);

  const fetchStats = useCallback(async (start?: Date, end?: Date) => {
    try {
      let url = API_ENDPOINTS.INVOICES.STATS;
      if (start && end) {
        url += `?start_date=${start.toISOString().split('T')[0]}&end_date=${end.toISOString().split('T')[0]}`;
      }
      const response = await apiService.get(url);
      setEarningsStats(response);
    } catch (error) {
      logger.error('[EarningsV2] stats', error);
    }
  }, []);

  const fetchInvoices = useCallback(
    async (pageNum: number, start?: Date | null, end?: Date | null, shouldRefresh = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);
        let url = `${API_ENDPOINTS.INVOICES.LIST}?page=${pageNum}`;
        if (start) url += `&start_date=${start.toISOString().split('T')[0]}`;
        if (end) url += `&end_date=${end.toISOString().split('T')[0]}`;
        const response = await apiService.get(url);
        const newInvoices: Invoice[] = response.results || [];
        const next = response.next;
        if (shouldRefresh || pageNum === 1) setInvoices(newInvoices);
        else setInvoices((prev) => [...prev, ...newInvoices]);
        setHasMore(!!next);
      } catch (error) {
        logger.error('[EarningsV2] invoices', error);
        Alert.alert('Error', 'Failed to load invoices.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchStats();
    fetchInvoices(1);
  }, [fetchStats, fetchInvoices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchStats(filterStart || undefined, filterEnd || undefined);
    fetchInvoices(1, filterStart, filterEnd, true);
  }, [fetchStats, fetchInvoices, filterStart, filterEnd]);

  const loadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchInvoices(nextPage, filterStart, filterEnd);
  };

  const handleDownloadStatement = async (url: string | null) => {
    if (!url) {
      Alert.alert('Unavailable', 'No PDF statement available for this period.');
      return;
    }
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const fileName = `statement-${new Date().getTime()}.pdf`;
    await downloadAndShareAuthenticated(fullUrl, fileName, token);
  };

  const openCustomReportModal = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start);
    setEndDate(now);
    setReportModalVisible(true);
  };

  const generateReport = () => {
    setReportModalVisible(false);
    setSelectedPeriod('custom');
    setFilterStart(startDate);
    setFilterEnd(endDate);
    setPage(1);
    fetchStats(startDate, endDate);
    fetchInvoices(1, startDate, endDate, true);
  };

  const clearReport = () => {
    setSelectedPeriod('month');
    setFilterStart(null);
    setFilterEnd(null);
    setPage(1);
    fetchStats();
    fetchInvoices(1, null, null, true);
  };

  const onDateChange = (_e: any, selected?: Date, type?: 'start' | 'end') => {
    if (Platform.OS === 'android') {
      if (type === 'start') setShowStartPicker(false);
      if (type === 'end') setShowEndPicker(false);
    }
    if (selected) {
      if (type === 'start') setStartDate(selected);
      if (type === 'end') setEndDate(selected);
    }
  };

  const totalForPeriod =
    selectedPeriod === 'month'
      ? earningsStats.currentMonth
      : selectedPeriod === 'year'
        ? earningsStats.ytd
        : earningsStats.customTotal;

  const renderHeader = () => (
    <View>
      {/* Title */}
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 28,
          color: theme.colors.text.primary,
          fontWeight: '400',
          letterSpacing: -0.8,
          marginTop: 4,
        }}
      >
        Earnings
      </Text>
      <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>Track your income and invoices</Eyebrow>

      {/* Hero card */}
      <View style={{ borderRadius: 22, overflow: 'hidden' }}>
        <LinearGradient
          colors={theme.isDark ? ['#3a1614', '#181317'] : ['#fddfdc', '#fbf5f4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            padding: 18,
            borderWidth: 1,
            borderColor: theme.shiftCardBorder,
            borderRadius: 22,
          }}
        >
          {/* Period tabs */}
          <View
            style={{
              flexDirection: 'row',
              padding: 4,
              borderRadius: 999,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(11,11,14,0.05)',
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              marginBottom: 18,
            }}
          >
            {(['month', 'year'] as PeriodKey[]).map((key) => {
              const active = selectedPeriod === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedPeriod(key)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    borderRadius: 999,
                    backgroundColor: active ? theme.colors.accent : 'transparent',
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      color: active ? '#fff' : theme.colors.text.secondary,
                      fontWeight: '500',
                    }}
                  >
                    {key === 'month' ? 'This month' : 'Year to date'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Amount */}
          <Eyebrow tracking={1.8}>
            {selectedPeriod === 'custom' ? 'Custom period' : 'Total earnings'}
          </Eyebrow>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 8,
              fontSize: 44,
              color: theme.colors.text.primary,
              fontWeight: '300',
              letterSpacing: -1.6,
            }}
          >
            {formatCurrency(totalForPeriod)}
          </Text>

          {/* Stat strip */}
          <View
            style={{
              marginTop: 18,
              flexDirection: 'row',
              borderRadius: theme.radii.lg,
              backgroundColor: theme.isDark ? 'rgba(0,0,0,0.25)' : 'rgba(11,11,14,0.04)',
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              padding: 14,
            }}
          >
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.text.secondary,
                }}
              >
                {selectedPeriod === 'month' ? 'Last month' : selectedPeriod === 'year' ? 'Previous year' : 'Period'}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 16,
                  color: theme.colors.text.primary,
                  fontWeight: '500',
                  letterSpacing: -0.2,
                }}
              >
                {selectedPeriod === 'month'
                  ? formatCurrency(earningsStats.lastMonth)
                  : selectedPeriod === 'custom'
                    ? `${startDate.toLocaleDateString('en-GB', { month: 'short' })}–${endDate.toLocaleDateString('en-GB', { month: 'short' })}`
                    : 'N/A'}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.surface.hairline }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.text.secondary,
                }}
              >
                Status
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
                <Text
                  style={{
                    fontSize: 16,
                    color: theme.colors.text.primary,
                    fontWeight: '500',
                    letterSpacing: -0.2,
                  }}
                >
                  Verified
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Custom report menu row */}
      <Pressable
        onPress={openCustomReportModal}
        style={({ pressed }) => ({
          marginTop: 16,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: theme.radii.xl,
          backgroundColor: theme.colors.surface.card,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: theme.colors.accentSoft,
            borderWidth: 1,
            borderColor: theme.colors.accentBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
              stroke={theme.colors.accent}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}>
            Custom report
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}>
            Generate for specific dates
          </Text>
        </View>
        <Svg width={7} height={12} viewBox="0 0 8 14">
          <Path
            d="M1 1l6 6-6 6"
            stroke={theme.colors.text.tertiary}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      {/* Clear filter */}
      {selectedPeriod === 'custom' ? (
        <Pressable
          onPress={clearReport}
          style={({ pressed }) => ({
            marginTop: 10,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: theme.radii.xl,
            backgroundColor: theme.colors.accentSoft,
            borderWidth: 1,
            borderColor: theme.colors.accentBorder,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M5 5L19 19M19 5L5 19" stroke={theme.colors.accent} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: theme.colors.accent,
                fontWeight: '500',
              }}
            >
              Clear report · Show all invoices
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Invoices header */}
      <Eyebrow style={{ marginTop: 24, marginBottom: 10, marginLeft: 4 }}>
        {selectedPeriod === 'custom' ? 'Filtered invoices' : 'Invoices & statements'}
      </Eyebrow>
    </View>
  );

  const renderInvoiceItem: ListRenderItem<Invoice> = ({ item, index }) => {
    const sColor = statusColor(theme, item.status);
    const isFirst = index === 0;
    return (
      <Pressable
        onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderTopWidth: isFirst ? 1 : 1,
          borderTopColor: theme.colors.surface.hairline,
          borderBottomWidth: 0,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderLeftColor: theme.colors.surface.hairline,
          borderRightColor: theme.colors.surface.hairline,
          backgroundColor: theme.colors.surface.card,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M7 2 H14 L19 7 V22 H7 Z M14 2 V7 H19 M9 13 H17 M9 17 H14"
              stroke={theme.colors.text.secondary}
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            {formatPeriod(item.start_date, item.end_date)}
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}>
            Issued {new Date(item.created_at).toLocaleDateString('en-GB')}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: sColor,
              fontWeight: '500',
            }}
          >
            {item.status}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}>
            {formatCurrency(typeof item.total_amount === 'string' ? parseFloat(item.total_amount) : item.total_amount)}
          </Text>
          {item.pdf_url ? (
            <Pressable
              onPress={() => handleDownloadStatement(item.pdf_url)}
              hitSlop={8}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
              }}
            >
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3 V15 M7 10 L 12 15 L 17 10 M5 21 H19"
                  stroke={theme.colors.accent}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ) : (
            <Svg width={7} height={12} viewBox="0 0 8 14">
              <Path
                d="M1 1l6 6-6 6"
                stroke={theme.colors.text.tertiary}
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (invoices.length === 0) return null;
    return (
      <View
        style={{
          borderBottomWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: theme.colors.surface.hairline,
          backgroundColor: theme.colors.surface.card,
          borderBottomLeftRadius: theme.radii.xl,
          borderBottomRightRadius: theme.radii.xl,
          height: 8,
          marginBottom: 16,
        }}
      />
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <GlassCard style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={{ fontSize: 14, color: theme.colors.text.secondary, textAlign: 'center' }}>
          No invoices found for this period.
        </Text>
      </GlassCard>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {loading && page === 1 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          renderItem={renderInvoiceItem}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            <>
              {renderFooter()}
              {loadingMore ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                </View>
              ) : (
                <View style={{ height: 40 }} />
              )}
            </>
          }
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{
            paddingTop: insets.top + 56,
            paddingHorizontal: 20,
            paddingBottom: 40 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Close button */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={[
          styles.closeBtn,
          {
            top: insets.top + 12,
            backgroundColor: theme.colors.surface.chip,
            borderColor: theme.colors.surface.hairline,
          },
        ]}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M5 5L19 19M19 5L5 19" stroke={theme.colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Pressable>

      {/* Custom report modal */}
      <Modal
        animationType="fade"
        transparent
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.isDark ? '#141417' : '#ffffff',
                borderColor: theme.colors.surface.hairline,
              },
            ]}
          >
            <Eyebrow color={theme.colors.accent}>Custom report</Eyebrow>
            <Text
              style={{
                marginTop: 10,
                fontSize: 20,
                color: theme.colors.text.primary,
                fontWeight: '500',
                letterSpacing: -0.4,
              }}
            >
              Select date range
            </Text>

            <View style={{ marginTop: 18, gap: 14 }}>
              {(['start', 'end'] as const).map((type) => {
                const value = type === 'start' ? startDate : endDate;
                const showPicker = type === 'start' ? showStartPicker : showEndPicker;
                return (
                  <View
                    key={type}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: theme.colors.text.secondary, fontWeight: '500' }}>
                      {type === 'start' ? 'Start date' : 'End date'}
                    </Text>
                    {Platform.OS === 'android' ? (
                      <Pressable
                        onPress={() => (type === 'start' ? setShowStartPicker(true) : setShowEndPicker(true))}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: theme.radii.md,
                          backgroundColor: theme.colors.surface.chip,
                          borderWidth: 1,
                          borderColor: theme.colors.surface.hairline,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}>
                          {value.toLocaleDateString('en-GB')}
                        </Text>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                            stroke={theme.colors.accent}
                            strokeWidth={1.6}
                            fill="none"
                            strokeLinecap="round"
                          />
                        </Svg>
                      </Pressable>
                    ) : null}
                    {(Platform.OS === 'ios' || showPicker) && (
                      <DateTimePicker
                        value={value}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'compact' : 'default'}
                        onChange={(e, d) => onDateChange(e, d, type)}
                        style={Platform.OS === 'ios' ? { width: 130 } : undefined}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={() => setReportModalVisible(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 44,
                  borderRadius: theme.radii.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairline,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    textTransform: 'uppercase',
                    color: theme.colors.text.primary,
                    fontWeight: '500',
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={generateReport}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 44,
                  borderRadius: theme.radii.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.accent,
                  opacity: pressed ? 0.9 : 1,
                  shadowColor: theme.colors.accent,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  elevation: 6,
                })}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    textTransform: 'uppercase',
                    color: '#fff',
                    fontWeight: '500',
                  }}
                >
                  Generate
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
  },
});

export default EarningsScreenV2;
