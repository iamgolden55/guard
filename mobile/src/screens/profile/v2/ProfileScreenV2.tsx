/**
 * ProfileScreenV2 — Main "You" tab redesigned to match the Phase 4 profile
 * design (ambient glow, avatar hero, mono role eyebrow, glass cards for
 * SIA licence + action menu + account).
 *
 * Preserves every handler from the original ProfileScreen: fetch profile on
 * focus, edit profile, virtual ID, earnings, leave/availability (contractor
 * branch), replay onboarding, clear local data, logout, delete account
 * (modal).
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import {
  selectCurrentUser,
  fetchUserProfile,
  deleteAccount,
} from '../../../store/slices/authSlice';
import { resetOnboarding } from '../../../store/slices/onboardingSlice';
import { fetchShifts } from '../../../store/slices/shiftsSlice';
import { useAuth } from '../../../hooks/useAuth';
import { logger } from '../../../utils/logger';
import { database } from '../../../services/database';
import {
  ApiError,
  ApiTimeoutError,
  NetworkError,
} from '../../../services/api';
import { ERROR_MESSAGES } from '../../../utils/constants';
import { useRedesignTheme } from '../../../theme/redesign';
import {
  AccentDot,
  AmbientGlow,
  Eyebrow,
  GlassCard,
} from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Role labels (matches the rest of the app)
const ROLE_LABEL: Record<string, string> = {
  ds: 'Door supervisor',
  sg: 'Security guard',
  cctv: 'CCTV operator',
  cp: 'Close protection',
  steward: 'Steward',
  k9: 'Dog handler',
  retail: 'Retail security',
  static: 'Static guard',
  mobile: 'Mobile patrol',
  event: 'Event security',
};

const formatDate = (iso?: string | null) => {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getInitials = (first?: string, last?: string) => {
  const f = (first || '').charAt(0);
  const l = (last || '').charAt(0);
  return (f + l).toUpperCase() || '?';
};

export const ProfileScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const { logout } = useAuth();
  const user = useAppSelector(selectCurrentUser);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchUserProfile());
    }, [dispatch]),
  );

  const staffProfile = user?.staff_profile as any;
  const siaLicenses = staffProfile?.sia_licenses || [];
  const siaLicense = siaLicenses[0];

  const employmentCategory = staffProfile?.employment_type?.employment_category;
  const isContractor =
    employmentCategory === 'contractor' || employmentCategory === 'temporary';

  // Role display
  const securityRoles: string[] = staffProfile?.security_roles || [];
  const roleDisplay =
    securityRoles.length > 0
      ? (ROLE_LABEL[securityRoles[0]] || securityRoles[0])
      : staffProfile?.employment_type?.name || 'Security staff';

  // Licence status
  const licenseStatus = (() => {
    if (!siaLicense) return null;
    if (!siaLicense.expiry_date) {
      return { label: 'Active', color: '#4ade80' };
    }
    const expiry = new Date(siaLicense.expiry_date);
    const now = new Date();
    const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expired', color: theme.colors.accent };
    if (daysLeft <= 30) return { label: 'Expiring soon', color: '#f59e0b' };
    return { label: 'Active', color: '#4ade80' };
  })();

  // Handlers (preserved)
  const handleEditProfile = () => navigation.navigate('EditProfile');
  const handleViewVirtualID = () => navigation.navigate('VirtualID');
  const handleOpenEarnings = () => navigation.navigate('Earnings');

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleReplayOnboarding = () =>
    Alert.alert('Replay onboarding', 'View the onboarding tutorial again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Replay',
        onPress: () => {
          dispatch(resetOnboarding());
          Alert.alert('Success', 'Onboarding will be shown when you restart the app.');
        },
      },
    ]);

  const handleClearLocalData = () =>
    Alert.alert(
      'Clear local data',
      'This removes all offline data and forces a fresh sync. Your work is safe on the server. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.clearAll();
              await dispatch(fetchShifts({ page: 1, pageSize: 20 })).unwrap();
              await dispatch(fetchUserProfile()).unwrap();
              Alert.alert('Success', 'Local data cleared. Fresh data loaded from server.');
            } catch (error: any) {
              logger.error('[ProfileV2] clear data', error);
              if (error instanceof ApiTimeoutError) {
                Alert.alert('Timeout', ERROR_MESSAGES.TIMEOUT_ERROR + '\n\nLocal data was cleared; fresh data could not load.');
              } else if (error instanceof NetworkError) {
                Alert.alert('Offline', ERROR_MESSAGES.NETWORK_ERROR + '\n\nLocal data was cleared; fresh data could not load.');
              } else if (error instanceof ApiError) {
                Alert.alert('Server error', `Unable to fetch fresh data: ${error.statusText}`);
              } else {
                Alert.alert('Error', 'Failed to clear data and reload.');
              }
            }
          },
        },
      ],
    );

  const handleDeleteAccount = () =>
    Alert.alert(
      'Delete account',
      'Your account will be deactivated immediately and permanently deleted after 30 days. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setShowDeleteModal(true);
          },
        },
      ],
    );

  const handleConfirmDelete = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Error', 'Please enter your password to confirm.');
      return;
    }
    setDeleteLoading(true);
    try {
      await dispatch(deleteAccount({ password: deletePassword })).unwrap();
      setShowDeleteModal(false);
      Alert.alert(
        'Account deleted',
        'Your account has been deactivated and will be permanently deleted in 30 days.',
        [{ text: 'OK', onPress: () => logout() }],
      );
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to delete account. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.canvas, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Ambient red glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          left: '50%',
          transform: [{ translateX: -210 }],
        }}
      >
        <AmbientGlow size={420} intensity={theme.isDark ? 0.26 : 0.18} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingHorizontal: 20,
          paddingBottom: 40 + insets.bottom,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + edit badge */}
        <Pressable onPress={handleEditProfile} style={styles.avatarWrap} hitSlop={8}>
          {staffProfile?.profile_image_url ? (
            <Image source={{ uri: staffProfile.profile_image_url }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(11,11,14,0.05)',
                  borderWidth: 1.5,
                  borderColor: theme.colors.surface.hairlineStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontSize: 34,
                  fontWeight: '300',
                  letterSpacing: -0.4,
                  color: theme.colors.text.primary,
                }}
              >
                {getInitials(user.first_name, user.last_name)}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.editBadge,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.canvas,
              },
            ]}
          >
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 20h9 M16.5 3.5 a2.12 2.12 0 0 1 3 3 L 7 19 l -4 1 1 -4 Z"
                stroke="#fff"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Pressable>

        <Text
          allowFontScaling={false}
          style={{
            marginTop: 14,
            fontSize: 22,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.4,
          }}
        >
          {user.first_name || 'Security'} {user.last_name || 'Staff'}
        </Text>
        <Eyebrow style={{ marginTop: 6 }}>{roleDisplay}</Eyebrow>
        {user.email ? (
          <Text
            allowFontScaling={false}
            style={{ marginTop: 6, fontSize: 13, color: theme.colors.text.tertiary }}
          >
            {user.email}
          </Text>
        ) : null}

        {/* SIA licence card */}
        {siaLicense ? (
          <GlassCard style={{ width: '100%', marginTop: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: theme.colors.accentSoft,
                  borderWidth: 1,
                  borderColor: theme.colors.accentBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 5 H21 V10 H3 Z M3 12 H21 V19 H3 Z"
                    stroke={theme.colors.accent}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Eyebrow>SIA Licence</Eyebrow>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 15,
                    color: theme.colors.text.primary,
                    fontWeight: '500',
                    letterSpacing: -0.2,
                  }}
                >
                  {siaLicense.license_number}
                </Text>
              </View>
              {licenseStatus ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: theme.colors.surface.chip,
                    borderWidth: 1,
                    borderColor: theme.colors.surface.hairline,
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: licenseStatus.color,
                    }}
                  />
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 9,
                      color: licenseStatus.color,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      fontWeight: '500',
                    }}
                  >
                    {licenseStatus.label}
                  </Text>
                </View>
              ) : null}
            </View>
            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: theme.colors.surface.hairline,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>Valid until</Text>
              <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}>
                {formatDate(siaLicense.expiry_date)}
              </Text>
            </View>
          </GlassCard>
        ) : null}

        {/* Main actions */}
        <GlassCard style={{ width: '100%', marginTop: 14 }} pad={0}>
          <MenuRow
            icon={
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2v20M2 12h20" stroke={theme.colors.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
                <Path
                  d="M12 6 a6 6 0 1 0 0 12 a6 6 0 0 0 0 -12"
                  stroke={theme.colors.accent}
                  strokeWidth={1.6}
                  fill="none"
                />
              </Svg>
            }
            label="Earnings & statements"
            sub="View earnings and download statements"
            first
            onPress={handleOpenEarnings}
          />
          <MenuRow
            icon={
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M3 5 H21 V19 H3 Z M3 10 H21"
                  stroke={theme.colors.accent}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            label="Virtual ID card"
            sub="Access your digital ID for venue check-ins"
            onPress={handleViewVirtualID}
          />

          {isContractor ? (
            <MenuRow
              icon={
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                    stroke={theme.colors.text.primary}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
              }
              label="Manage availability"
              sub="Mark dates when you're unavailable for shifts"
              onPress={() => navigation.navigate('ContractorUnavailability')}
            />
          ) : (
            <>
              <MenuRow
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                      stroke={theme.colors.text.primary}
                      strokeWidth={1.5}
                      fill="none"
                      strokeLinecap="round"
                    />
                  </Svg>
                }
                label="Leave balance"
                sub="View your available leave days and balances"
                onPress={() => navigation.navigate('LeaveBalance')}
              />
              <MenuRow
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 5 V19 M5 12 H19"
                      stroke={theme.colors.text.primary}
                      strokeWidth={1.6}
                      strokeLinecap="round"
                    />
                  </Svg>
                }
                label="Request leave"
                sub="Submit a new leave request for approval"
                onPress={() => navigation.navigate('LeaveRequest')}
              />
              <MenuRow
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 7h14M5 12h14M5 17h9"
                      stroke={theme.colors.text.primary}
                      strokeWidth={1.5}
                      fill="none"
                      strokeLinecap="round"
                    />
                  </Svg>
                }
                label="Leave history"
                sub="View and manage your leave requests"
                onPress={() => navigation.navigate('LeaveHistory')}
              />
            </>
          )}

          <MenuRow
            icon={
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 20h9 M16.5 3.5 a2.12 2.12 0 0 1 3 3 L 7 19 l -4 1 1 -4 Z"
                  stroke={theme.colors.text.primary}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            label="Edit profile"
            sub="Update your personal and professional information"
            onPress={handleEditProfile}
          />

          {staffProfile?.phone_number ? (
            <MenuRow
              icon={
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 7 Q 4 4 7 4 h3 L 12 8 L 10 10 Q 12 14 16 16 L 18 14 L 22 16 V 19 Q 22 22 19 22 Q 10 22 4 15 Q 4 11 4 7 Z"
                    stroke={theme.colors.text.primary}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
              label="Phone number"
              sub={staffProfile.phone_number}
              caret={false}
            />
          ) : null}
        </GlassCard>

        {/* Account section */}
        <View style={{ width: '100%', marginTop: 22 }}>
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Account</Eyebrow>
          <GlassCard pad={0}>
            <MenuRow
              icon={
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 5 v14 L18 12 Z" stroke={theme.colors.text.primary} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
                </Svg>
              }
              label="Replay onboarding"
              first
              onPress={handleReplayOnboarding}
            />
            <MenuRow
              icon={
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 12 a8 8 0 1 1 -2.34 -5.66 M20 4 v4 h-4"
                    stroke={theme.colors.text.primary}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
              label="Clear local data"
              onPress={handleClearLocalData}
            />
            <MenuRow
              icon={
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M16 17 l 5 -5 -5 -5 M21 12 H9 M13 22 H5 a2 2 0 0 1 -2 -2 V4 a2 2 0 0 1 2 -2 h8"
                    stroke={theme.colors.accent}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
              label="Logout"
              labelColor={theme.colors.accent}
              onPress={handleLogout}
            />
            <MenuRow
              icon={
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 6 h18 M8 6 V4 a2 2 0 0 1 2 -2 h4 a2 2 0 0 1 2 2 v2 M6 6 l 1 14 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 l 1 -14"
                    stroke={theme.colors.accent}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
              label="Delete account"
              labelColor={theme.colors.accent}
              onPress={handleDeleteAccount}
            />
          </GlassCard>
        </View>
      </ScrollView>

      {/* Top-centered "Profile" eyebrow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 16,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            textTransform: 'uppercase',
            color: theme.colors.text.secondary,
            fontWeight: '500',
          }}
        >
          Profile
        </Text>
      </View>

      {/* Delete account modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AccentDot size={6} />
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
                Delete account
              </Text>
            </View>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 20,
                color: theme.colors.text.primary,
                fontWeight: '500',
                letterSpacing: -0.4,
              }}
            >
              Confirm deletion
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 10,
                fontSize: 13,
                color: theme.colors.text.secondary,
                lineHeight: 20,
              }}
            >
              Enter your password to confirm. Your account will be permanently removed after 30 days.
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.text.tertiary}
              secureTextEntry
              autoFocus
              style={{
                marginTop: 14,
                height: 44,
                paddingHorizontal: 14,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surface.chip,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                color: theme.colors.text.primary,
                fontSize: 14,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
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
                  allowFontScaling={false}
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
                onPress={handleConfirmDelete}
                disabled={deleteLoading}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 44,
                  borderRadius: theme.radii.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.accent,
                  opacity: deleteLoading ? 0.7 : pressed ? 0.9 : 1,
                  shadowColor: theme.colors.accent,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  elevation: 6,
                })}
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                      color: '#fff',
                      fontWeight: '500',
                    }}
                  >
                    Delete
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── MenuRow ─────────────────────────────────────────────────
const MenuRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  sub?: string;
  first?: boolean;
  caret?: boolean;
  labelColor?: string;
  onPress?: () => void;
}> = ({ icon, label, sub, first, caret = true, labelColor, onPress }) => {
  const theme = useRedesignTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.surface.hairline,
      }}
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
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 14,
            color: labelColor || theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.2,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            allowFontScaling={false}
            style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {caret ? (
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
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
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

export default ProfileScreenV2;
