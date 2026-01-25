/**
 * ProfileScreen - Wise-Inspired Design
 * Clean, minimal profile with hero photo and feature list
 */

import React from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Image, ScrollView, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Container, Body, Button } from '@components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { selectCurrentUser, fetchUserProfile } from '../../store/slices/authSlice';
import { useFocusEffect } from '@react-navigation/native';
import { resetOnboarding } from '../../store/slices/onboardingSlice';
import { fetchShifts } from '../../store/slices/shiftsSlice';
import { colors, spacing, layout } from '../../theme';
import { logger } from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../services/database';
import { apiService, ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { ERROR_MESSAGES } from '../../utils/constants';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const { logout } = useAuth();

  // Log screen view
  React.useEffect(() => {
    logger.info('Profile screen viewed');
  }, []);

  // Refresh profile data when screen comes into focus (e.g., returning from EditProfile)
  useFocusEffect(
    React.useCallback(() => {
      logger.info('[Profile] Screen focused - refreshing profile data');
      dispatch(fetchUserProfile());
    }, [dispatch])
  );

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get staff profile for easier access
  const staffProfile = user?.staff_profile;
  const siaLicenses = staffProfile?.sia_licenses || [];

  // Determine employment category for conditional navigation
  const employmentCategory = staffProfile?.employment_type?.employment_category;
  const isContractor = employmentCategory === 'contractor' || employmentCategory === 'temporary';

  // Check if SIA license is expiring soon (within 30 days)
  const isLicenseExpiringSoon = () => {
    if (siaLicenses.length === 0) return false;
    const license = siaLicenses[0];
    if (!license.expiry_date) return false;

    const expiryDate = new Date(license.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  // Check if license is expired
  const isLicenseExpired = () => {
    if (siaLicenses.length === 0) return false;
    const license = siaLicenses[0];
    if (!license.expiry_date) return false;

    return new Date(license.expiry_date) < new Date();
  };

  // Handlers
  const handleEditProfile = () => {
    logger.info('[Profile] Navigating to EditProfile');
    navigation.navigate('EditProfile');
  };

  const handleViewVirtualID = () => {
    logger.info('View virtual ID tapped');
    navigation.navigate('VirtualID');
  };

  const handleLogout = async () => {
    logger.info('Logout initiated from profile');
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleReplayOnboarding = () => {
    logger.info('Replay onboarding initiated from profile');
    Alert.alert(
      'Replay Onboarding',
      'Would you like to view the onboarding tutorial again?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replay',
          onPress: () => {
            dispatch(resetOnboarding());
            logger.info('[Profile] Onboarding reset - will show on next app restart');
            Alert.alert('Success', 'Onboarding will be shown when you restart the app.');
          },
        },
      ]
    );
  };

  const handleClearLocalData = () => {
    logger.info('Clear local data initiated from profile');
    Alert.alert(
      'Clear Local Data',
      'This will remove all offline data and force a fresh sync. Your work is safe on the server. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              logger.info('[Profile] Clearing local data');

              // Clear AsyncStorage
              await database.clearAll();
              logger.info('[Profile] Local storage cleared');

              // Force fresh fetch from server
              await dispatch(fetchShifts()).unwrap();
              await dispatch(fetchUserProfile()).unwrap();
              logger.info('[Profile] Fresh data fetched from server');

              Alert.alert('Success', 'Local data cleared. Fresh data loaded from server.');
            } catch (error: any) {
              logger.error('[Profile] Clear data error:', error);

              // Show specific error messages based on error type
              if (error instanceof ApiTimeoutError) {
                Alert.alert(
                  'Connection Timeout',
                  ERROR_MESSAGES.TIMEOUT_ERROR + '\n\nLocal data was cleared, but fresh data could not be loaded. Please try again when connection improves.'
                );
              } else if (error instanceof NetworkError) {
                Alert.alert(
                  'No Internet Connection',
                  ERROR_MESSAGES.NETWORK_ERROR + '\n\nLocal data was cleared, but fresh data could not be loaded. Please connect to the internet and try again.'
                );
              } else if (error instanceof ApiError) {
                Alert.alert(
                  'Server Error',
                  `Unable to fetch fresh data: ${error.statusText}\n\nLocal data was cleared. Please try again later.`
                );
              } else {
                Alert.alert('Error', 'Failed to clear data and reload. Please try again.');
              }
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <Container style={styles.container}>
        <View style={styles.loadingContainer}>
          <Body>Loading profile...</Body>
        </View>
      </Container>
    );
  }

  const siaLicense = siaLicenses[0];
  const licenseExpired = isLicenseExpired();
  const licenseExpiringSoon = isLicenseExpiringSoon();

  // Get license status
  const getLicenseStatus = () => {
    if (licenseExpired) return { text: 'Expired', color: colors.error, icon: 'close-circle' };
    if (licenseExpiringSoon) return { text: 'Expiring Soon', color: colors.warning, icon: 'warning' };
    return { text: 'Active', color: '#00B67A', icon: 'checkmark-circle' };
  };

  const licenseStatus = getLicenseStatus();

  return (
    <Container style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Hero Profile Photo */}
        <TouchableOpacity onPress={handleEditProfile} style={styles.photoWrapper}>
          <View style={styles.photoContainer}>
            {staffProfile?.profile_image_url ? (
              <Image source={{ uri: staffProfile.profile_image_url }} style={styles.photo} />
            ) : (
              <LinearGradient
                colors={['#667EEA', '#764BA2']}
                style={styles.photoPlaceholder}
              >
                <Ionicons name="person" size={64} color="rgba(255,255,255,0.9)" />
              </LinearGradient>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="create" size={18} color={colors.white} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Bold Name */}
        <Text style={styles.name}>
          {user.first_name || 'Security'} {user.last_name || 'Staff'}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Door Supervisor</Text>
        <Text style={styles.email}>{user.email}</Text>

        {/* SIA License Status Card */}
        {siaLicense && (
          <View style={styles.licenseCard}>
            <View style={styles.licenseHeader}>
              <View style={styles.licenseIcon}>
                <Ionicons name="shield-checkmark" size={24} color="#0066FF" />
              </View>
              <View style={styles.licenseInfo}>
                <Text style={styles.licenseTitle}>SIA License</Text>
                <Text style={styles.licenseNumber}>{siaLicense.license_number}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${licenseStatus.color}15` }]}>
                <Ionicons name={licenseStatus.icon as any} size={14} color={licenseStatus.color} />
                <Text style={[styles.statusText, { color: licenseStatus.color }]}>
                  {licenseStatus.text}
                </Text>
              </View>
            </View>
            <View style={styles.licenseExpiry}>
              <Text style={styles.expiryLabel}>Valid until</Text>
              <Text style={styles.expiryDate}>{formatDate(siaLicense.expiry_date)}</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('Earnings')}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="cash" size={22} color="#0066FF" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Earnings & Statements</Text>
              <Text style={styles.actionDescription}>
                View earnings and download statements
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleViewVirtualID}>
            <View style={styles.actionIconCircle}>
              <Ionicons name="card" size={22} color="#0066FF" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Virtual ID Card</Text>
              <Text style={styles.actionDescription}>
                Access your digital ID for venue check-ins
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Conditional: Leave Management for permanent, Availability for contractors */}
          {isContractor ? (
            // Contractor/Temporary: Show Manage Availability
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('ContractorUnavailability')}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="calendar-outline" size={22} color="#0066FF" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Manage Availability</Text>
                <Text style={styles.actionDescription}>
                  Mark dates when you're unavailable for shifts
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          ) : (
            // Permanent: Show Leave Management options
            <>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate('LeaveBalance')}
              >
                <View style={styles.actionIconCircle}>
                  <Ionicons name="calendar" size={22} color="#0066FF" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Leave Balance</Text>
                  <Text style={styles.actionDescription}>
                    View your available leave days and balances
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate('LeaveRequest')}
              >
                <View style={styles.actionIconCircle}>
                  <Ionicons name="add-circle" size={22} color="#0066FF" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Request Leave</Text>
                  <Text style={styles.actionDescription}>
                    Submit a new leave request for approval
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate('LeaveHistory')}
              >
                <View style={styles.actionIconCircle}>
                  <Ionicons name="document-text" size={22} color="#0066FF" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Leave History</Text>
                  <Text style={styles.actionDescription}>
                    View and manage your leave requests
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.actionItem} onPress={handleEditProfile}>
            <View style={styles.actionIconCircle}>
              <Ionicons name="create" size={22} color="#0066FF" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionDescription}>
                Update your personal and professional information
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {staffProfile?.phone_number && (
            <View style={styles.actionItem}>
              <View style={styles.actionIconCircle}>
                <Ionicons name="call" size={22} color="#0066FF" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Phone Number</Text>
                <Text style={styles.actionDescription}>{staffProfile.phone_number}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Account Actions */}
        <View style={styles.accountSection}>
          <Text style={styles.sectionHeading}>Account</Text>

          <TouchableOpacity style={styles.accountItem} onPress={handleReplayOnboarding}>
            <View style={[styles.accountIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="play-circle" size={20} color="#2196F3" />
            </View>
            <Text style={styles.accountText}>Replay Onboarding</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.accountItem} onPress={handleClearLocalData}>
            <View style={[styles.accountIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="sync" size={20} color="#FF9800" />
            </View>
            <Text style={styles.accountText}>Clear Local Data</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.accountItem} onPress={handleLogout}>
            <View style={[styles.accountIcon, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="log-out" size={20} color={colors.error} />
            </View>
            <Text style={[styles.accountText, { color: colors.error }]}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
    alignItems: 'center',
  },
  // Hero Photo
  photoWrapper: {
    marginBottom: spacing.base,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  // Bold Name
  name: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // License Card
  licenseCard: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  licenseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  licenseInfo: {
    flex: 1,
  },
  licenseTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  licenseNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  licenseExpiry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  expiryLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  expiryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  // Actions Container
  actionsContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.base,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  // Account Section
  accountSection: {
    width: '100%',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.base,
  },
  accountText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
