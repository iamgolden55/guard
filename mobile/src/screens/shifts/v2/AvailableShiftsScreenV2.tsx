/**
 * AvailableShiftsScreenV2 — Browse and claim open shifts, re-skinned to match
 * the Phase 4 design language.
 *
 * Preserves the logic of UberAvailableShiftsScreen (fetch open requests,
 * pull-to-refresh, claim flow with alert).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import exchangeService, { OpenShiftRequest } from '../../../services/exchangeService';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const formatTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const AvailableCard: React.FC<{
  shift: OpenShiftRequest;
  onClaim: () => void;
  isClaiming: boolean;
}> = ({ shift, onClaim, isClaiming }) => {
  const theme = useRedesignTheme();
  const start = new Date(shift.original_shift_details.start_time);
  const end = new Date(shift.original_shift_details.end_time);
  const durationHours = Math.round((end.getTime() - start.getTime()) / 3_600_000);

  return (
    <View
      style={{
        padding: 14,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            paddingVertical: 8,
            borderRadius: 10,
            alignItems: 'center',
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              color: theme.colors.text.secondary,
              letterSpacing: 1.6,
            }}
          >
            {DAY_ABBR[start.getDay()]}
          </Text>
          <Text
            allowFontScaling={false}
            style={{ fontSize: 18, color: theme.colors.text.primary, fontWeight: '400', marginTop: 1 }}
          >
            {start.getDate()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            {shift.original_shift_details.venue?.name || 'Unknown venue'}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}
          >
            {formatTime(start)} — {formatTime(end)} · {durationHours}h
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 4,
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              color: theme.colors.text.tertiary,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
            }}
          >
            Released by {shift.requesting_user_details.first_name}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onClaim}
        disabled={isClaiming}
        style={({ pressed }) => ({
          marginTop: 12,
          height: 44,
          borderRadius: theme.radii.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.accent,
          opacity: isClaiming ? 0.7 : pressed ? 0.9 : 1,
          shadowColor: theme.colors.accent,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 6,
        })}
      >
        {isClaiming ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text
            allowFontScaling={false}
            style={{ color: '#fff', fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}
          >
            Claim shift
          </Text>
        )}
      </Pressable>
    </View>
  );
};

export const AvailableShiftsScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const [shifts, setShifts] = useState<OpenShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const data = await exchangeService.getAvailableShifts();
      setShifts(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load available shifts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const handleClaim = (shift: OpenShiftRequest) => {
    Alert.alert(
      'Claim shift',
      `Claim this shift at ${shift.original_shift_details.venue?.name || 'this venue'}?\n\nRequires manager approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: async () => {
            try {
              setClaimingId(shift.id);
              await exchangeService.claimShift(shift.id);
              Alert.alert('Success', 'Shift claimed. Awaiting manager approval.', [
                { text: 'OK', onPress: () => fetchAll() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to claim shift.');
            } finally {
              setClaimingId(null);
            }
          },
        },
      ],
    );
  };

  const renderEmpty = () => (
    <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.surface.chip,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
            stroke={theme.colors.text.secondary}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text allowFontScaling={false} style={{ fontSize: 17, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.3 }}>
        No available shifts
      </Text>
      <Text allowFontScaling={false} style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 6 }}>
        Check back later for new opportunities.
      </Text>
      <Pressable
        onPress={() => fetchAll()}
        style={({ pressed }) => ({
          marginTop: 18,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: theme.colors.accentSoft,
          borderWidth: 1,
          borderColor: theme.colors.accentBorder,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            color: theme.colors.accent,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
          }}
        >
          Refresh
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path d="M8 2 L2 8 L8 14" stroke={theme.colors.text.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{ fontSize: 18, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            Open shifts
          </Text>
        </View>
        <Pressable
          onPress={() => fetchAll()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 12 a8 8 0 1 1 -2.34 -5.66 M20 4 v4 h-4"
              stroke={theme.colors.text.primary}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {/* Info banner */}
      <GlassCard style={{ marginHorizontal: 20, marginTop: 6, marginBottom: 10 }} pad={12}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.colors.accentSoft,
              borderWidth: 1,
              borderColor: theme.colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>i</Text>
          </View>
          <Text
            allowFontScaling={false}
            style={{ flex: 1, fontSize: 12, color: theme.colors.text.secondary, lineHeight: 18 }}
          >
            Released shifts require manager approval after claiming.
          </Text>
        </View>
      </GlassCard>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, flexGrow: 1 }}
          renderItem={({ item }) => (
            <AvailableCard
              shift={item}
              onClaim={() => handleClaim(item)}
              isClaiming={claimingId === item.id}
            />
          )}
          ListHeaderComponent={
            shifts.length > 0 ? (
              <Eyebrow style={{ marginLeft: 6, marginBottom: 10 }}>
                {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'} · claim before anyone else
              </Eyebrow>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAll(true);
              }}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});

export default AvailableShiftsScreenV2;
