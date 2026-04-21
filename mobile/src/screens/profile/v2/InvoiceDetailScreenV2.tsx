/**
 * InvoiceDetailScreenV2 — Phase 4 re-skin of the invoice breakdown page.
 * Preserves API load (apiService.get + API_ENDPOINTS.INVOICES.DETAIL) and
 * the authenticated PDF download helper.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import { apiService } from '../../../services/api';
import { API_ENDPOINTS, API_BASE_URL } from '../../../config/api.config';
import { logger } from '../../../utils/logger';
import type { Invoice, InvoiceItem } from '../../../types/invoice';
import { useAppSelector } from '../../../hooks/useRedux';
import { selectAccessToken } from '../../../store/slices/authSlice';
import { downloadAndShareAuthenticated } from '../../../utils/document';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'InvoiceDetail'>;

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  paid: '#22c55e',
  overdue: '#ef4444',
};

const formatCurrency = (amount: string | number) => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return '£0.00';
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatHours = (n: string | number) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(v)) return '0';
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const InvoiceDetailScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { invoiceId } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const token = useAppSelector(selectAccessToken);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const endpointDef: any = API_ENDPOINTS.INVOICES.DETAIL;
      const endpoint =
        typeof endpointDef === 'function'
          ? endpointDef(invoiceId)
          : endpointDef.replace('{id}', invoiceId.toString());
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
    fetchInvoice();
  }, [fetchInvoice]);

  const handleDownloadPDF = async () => {
    if (!invoice?.pdf_url) return;
    setDownloading(true);
    try {
      const fullUrl = invoice.pdf_url.startsWith('http')
        ? invoice.pdf_url
        : `${API_BASE_URL}${invoice.pdf_url}`;
      const fileName = `invoice-${invoice.id}.pdf`;
      await downloadAndShareAuthenticated(fullUrl, fileName, token);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.canvas,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.accent} />
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 12,
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: theme.colors.text.tertiary,
          }}
        >
          Loading invoice
        </Text>
      </View>
    );
  }

  if (!invoice) return null;

  const statusKey = (invoice.status || 'pending').toLowerCase();
  const statusColor = STATUS_COLORS[statusKey] || theme.colors.text.secondary;
  const breakdown = invoice.payment_breakdown;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingHorizontal: 20,
          paddingBottom: (invoice.pdf_url ? 120 : 40) + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow color={theme.colors.accent}>Statement</Eyebrow>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 10,
            fontSize: 28,
            color: theme.colors.text.primary,
            fontWeight: '400',
            letterSpacing: -0.8,
          }}
        >
          Invoice #{invoice.id}
        </Text>
        <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
          {formatDateLong(invoice.start_date)} – {formatDateLong(invoice.end_date)}
        </Eyebrow>

        {/* Hero amount card */}
        <LinearGradient
          colors={theme.shiftCardGradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            padding: 18,
            borderRadius: theme.radii.xl,
            borderWidth: 1,
            borderColor: theme.shiftCardBorder,
            marginBottom: 18,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View>
              <Eyebrow color={theme.colors.accent}>Total amount</Eyebrow>
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 8,
                  fontSize: 40,
                  color: theme.colors.text.primary,
                  fontWeight: '400',
                  letterSpacing: -1.6,
                }}
              >
                {formatCurrency(invoice.total_amount)}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: hexAlpha(statusColor, 0.18),
                borderWidth: 1,
                borderColor: hexAlpha(statusColor, 0.45),
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: statusColor,
                  fontWeight: '500',
                }}
              >
                {(invoice.status || '').toUpperCase()}
              </Text>
            </View>
          </View>

          {breakdown ? (
            <View
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.surface.hairline,
                flexDirection: 'row',
              }}
            >
              <HeroCell
                label="Shifts"
                value={String(
                  (breakdown.regular_shifts?.count || 0) +
                    (breakdown.special_event_shifts?.count || 0),
                )}
              />
              <HeroDivider />
              <HeroCell label="Hours" value={formatHours(breakdown.total?.hours ?? 0)} />
              <HeroDivider />
              <HeroCell
                label="Issued"
                value={new Date(invoice.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              />
            </View>
          ) : null}
        </LinearGradient>

        {/* Breakdown */}
        {breakdown ? (
          <>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
              Payment breakdown
            </Eyebrow>
            <GlassCard style={{ padding: 16, marginBottom: 18 }}>
              {breakdown.regular_shifts?.count > 0 ? (
                <BreakdownRow
                  title="Regular shifts"
                  sub={`${breakdown.regular_shifts.count} shifts · ${formatHours(breakdown.regular_shifts.hours)} hrs`}
                  amount={formatCurrency(breakdown.regular_shifts.amount)}
                  rate={
                    breakdown.regular_shifts.average_rate
                      ? `@${formatCurrency(breakdown.regular_shifts.average_rate)}/hr`
                      : undefined
                  }
                />
              ) : null}

              {breakdown.special_event_shifts?.count > 0 ? (
                <>
                  {breakdown.regular_shifts?.count > 0 ? <RowDivider /> : null}
                  <BreakdownRow
                    title="Special events"
                    sub={`${breakdown.special_event_shifts.count} shifts · ${formatHours(breakdown.special_event_shifts.hours)} hrs`}
                    amount={formatCurrency(breakdown.special_event_shifts.amount)}
                    rate={
                      breakdown.special_event_shifts.average_rate
                        ? `@${formatCurrency(breakdown.special_event_shifts.average_rate)}/hr`
                        : undefined
                    }
                    accent
                  />
                </>
              ) : null}

              <RowDivider />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    textTransform: 'uppercase',
                    color: theme.colors.text.secondary,
                  }}
                >
                  Total hours
                </Text>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 15,
                    color: theme.colors.text.primary,
                    fontWeight: '500',
                  }}
                >
                  {formatHours(breakdown.total.hours)} hrs
                </Text>
              </View>
            </GlassCard>
          </>
        ) : null}

        {/* Shifts */}
        <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
          Shift details
          {invoice.items && invoice.items.length > 0
            ? ` · ${invoice.items.length}`
            : ''}
        </Eyebrow>
        {invoice.items && invoice.items.length > 0 ? (
          invoice.items.map((item, index) => (
            <ShiftRow key={item.id || index} item={item} />
          ))
        ) : (
          <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 14,
                color: theme.colors.text.tertiary,
              }}
            >
              No shift details available
            </Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* Back */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [
          styles.navBtn,
          {
            top: insets.top + 12,
            backgroundColor: theme.colors.surface.chip,
            borderColor: theme.colors.surface.hairline,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Svg width={10} height={16} viewBox="0 0 10 16">
          <Path
            d="M8 2 L2 8 L8 14"
            stroke={theme.colors.text.primary}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      {/* Download CTA */}
      {invoice.pdf_url ? (
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: insets.bottom + 16,
          }}
        >
          <PrimaryCTA
            label={downloading ? 'Preparing PDF…' : 'Download PDF statement'}
            disabled={downloading}
            trailingArrow={false}
            onPress={handleDownloadPDF}
          />
        </View>
      ) : null}
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────

const HeroCell: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 18,
          color: theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 3,
          fontFamily: theme.fonts.mono,
          fontSize: 9,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: theme.colors.text.tertiary,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

const HeroDivider: React.FC = () => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
        backgroundColor: theme.colors.surface.hairline,
      }}
    />
  );
};

const BreakdownRow: React.FC<{
  title: string;
  sub: string;
  amount: string;
  rate?: string;
  accent?: boolean;
}> = ({ title, sub, amount, rate, accent }) => {
  const theme = useRedesignTheme();
  const titleColor = accent ? theme.colors.accent : theme.colors.text.primary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {accent ? (
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3 L14.8 9.3 L21.5 10 L16.5 14.6 L18 21 L12 17.5 L6 21 L7.5 14.6 L2.5 10 L9.2 9.3 Z"
                fill={theme.colors.accent}
              />
            </Svg>
          ) : null}
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 14,
              color: titleColor,
              fontWeight: '500',
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
        </View>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 2,
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 1.4,
            color: theme.colors.text.tertiary,
          }}
        >
          {sub}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 15,
            color: titleColor,
            fontWeight: '500',
            letterSpacing: -0.2,
          }}
        >
          {amount}
        </Text>
        {rate ? (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 2,
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.colors.text.tertiary,
            }}
          >
            {rate}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const RowDivider: React.FC = () => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.surface.hairline,
        marginVertical: 12,
      }}
    />
  );
};

const ShiftRow: React.FC<{ item: InvoiceItem }> = ({ item }) => {
  const theme = useRedesignTheme();
  const isSpecial = !!item.shift_details?.is_special_event;
  const accentColor = isSpecial ? theme.colors.accent : theme.colors.text.tertiary;
  const d = new Date(item.date);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const dayNum = d.getDate();

  return (
    <GlassCard style={{ marginBottom: 10, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            alignItems: 'center',
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: isSpecial
              ? theme.colors.accentBorder
              : theme.colors.surface.hairline,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.6,
              color: accentColor,
              fontWeight: '500',
            }}
          >
            {day}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 1,
              fontSize: 18,
              color: theme.colors.text.primary,
              fontWeight: '400',
              letterSpacing: -0.4,
            }}
          >
            {dayNum}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontSize: 15,
              color: theme.colors.text.primary,
              fontWeight: '500',
              letterSpacing: -0.2,
            }}
          >
            {item.venue_details?.name || item.venue || 'Venue'}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 2,
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              letterSpacing: 1.6,
              color: theme.colors.text.tertiary,
            }}
          >
            {formatHours(item.hours_worked)} hrs · @{formatCurrency(item.rate)}/hr
          </Text>
          {isSpecial ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: theme.colors.accent,
                  fontWeight: '500',
                }}
              >
                Special event
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 15,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.2,
          }}
        >
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </GlassCard>
  );
};

// ─── Utils ───────────────────────────────────────────────────
const hexAlpha = (hex: string, alpha: number): string => {
  const raw = (hex || '').replace('#', '');
  if (raw.length !== 3 && raw.length !== 6) return `rgba(225,52,44,${alpha})`;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(225,52,44,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBtn: {
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
});

export default InvoiceDetailScreenV2;
