/**
 * EditProfileScreen - Wise-Inspired Design
 * Clean, minimal profile editing with hero photo
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Container, Caption } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { RootState } from '../../store';
import { updateProfile } from '../../store/slices/authSlice';
import { logger } from '../../utils/logger';
import authService from '../../services/authService';

// Helper to format security roles for display
const formatSecurityRoles = (roles: string[] | undefined): string => {
  if (!roles || roles.length === 0) return 'Not assigned';
  
  const roleLabels: Record<string, string> = {
    'door_supervisor': 'Door Supervisor',
    'security_guard': 'Security Guard',
    'cctv_operator': 'CCTV Operator',
    'close_protection': 'Close Protection',
    'dog_handler': 'Dog Handler',
    'ds': 'Door Supervisor',
    'sg': 'Security Guard',
    'cctv': 'CCTV Operator',
    'cp': 'Close Protection',
    'k9': 'Dog Handler',
  };
  
  return roles.map(role => roleLabels[role] || role).join(', ');
};

export const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const accessToken = useAppSelector((state: RootState) => state.auth.accessToken);
  
  // Get staff profile data from the correct location
  const staffProfile = user?.staff_profile;

  // Form state - editable fields
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(staffProfile?.phone_number || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(
    staffProfile?.profile_image_url || null
  );

  // Read-only fields derived from user data
  const siaLicenseNumber = staffProfile?.sia_license_number || '';
  const siaExpiryDate = staffProfile?.sia_license_expiry || '';
  const securityRoles = useMemo(() => 
    formatSecurityRoles(staffProfile?.security_roles || user?.security_roles),
    [staffProfile?.security_roles, user?.security_roles]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes - only for editable fields
  React.useEffect(() => {
    const changed =
      firstName !== (user?.first_name || '') ||
      lastName !== (user?.last_name || '') ||
      email !== (user?.email || '') ||
      phone !== (staffProfile?.phone_number || '') ||
      profilePhoto !== (staffProfile?.profile_image_url || null);

    setHasChanges(changed);
  }, [firstName, lastName, email, phone, profilePhoto, user, staffProfile]);

  const handleChoosePhoto = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile photo.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
        logger.info('[EditProfile] Photo selected', { uri: result.assets[0].uri });
      }
    } catch (error) {
      logger.error('[EditProfile] Failed to pick photo', { error });
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take a profile photo.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
        logger.info('[EditProfile] Photo taken', { uri: result.assets[0].uri });
      }
    } catch (error) {
      logger.error('[EditProfile] Failed to take photo', { error });
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePhotoOptions = () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handleChoosePhoto },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const validateForm = (): boolean => {
    if (!firstName.trim()) {
      Alert.alert('Required Field', 'Please enter your first name');
      return false;
    }

    if (!lastName.trim()) {
      Alert.alert('Required Field', 'Please enter your last name');
      return false;
    }

    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter your email address');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }

    // Phone validation (optional but if provided, should be valid)
    if (phone.trim()) {
      const phoneRegex = /^[\d\s\-\(\)\+]+$/;
      if (!phoneRegex.test(phone)) {
        Alert.alert('Invalid Phone', 'Please enter a valid phone number');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setIsSaving(true);
      logger.info('[EditProfile] Saving profile changes');

      // Check if profile photo changed and is a local file (needs upload)
      const photoChanged = profilePhoto !== (staffProfile?.profile_image_url || null);
      const isLocalPhoto = profilePhoto && !profilePhoto.startsWith('http');

      if (photoChanged && isLocalPhoto && profilePhoto && accessToken) {
        logger.info('[EditProfile] Uploading new profile photo');
        try {
          const uploadResult = await authService.uploadProfilePhoto(accessToken, profilePhoto);
          logger.info('[EditProfile] Photo uploaded successfully:', uploadResult.url);
          // The profile photo URL will be updated on the server, 
          // it will be reflected when we fetch the profile again
        } catch (photoError: any) {
          logger.error('[EditProfile] Failed to upload photo', { error: photoError });
          // Show warning but continue with other updates
          Alert.alert(
            'Photo Upload Failed',
            'Your profile photo could not be uploaded, but other changes will be saved.',
            [{ text: 'OK' }]
          );
        }
      }

      // Prepare profile data in the format expected by the backend
      // Backend expects camelCase for user fields: firstName, lastName, email
      // And snake_case for profile fields: phone_number
      const profileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone_number: phone.trim() || null,
      };

      logger.info('[EditProfile] Sending data:', profileData);

      // Dispatch update action
      await dispatch(updateProfile(profileData)).unwrap();

      Alert.alert(
        'Profile Updated',
        'Your profile has been updated successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      logger.error('[EditProfile] Failed to save profile', { error });
      Alert.alert(
        'Error',
        error.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          style={styles.headerButton}
        >
          <Text
            style={[
              styles.saveText,
              (!hasChanges || isSaving) && styles.saveTextDisabled,
            ]}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handlePhotoOptions} style={styles.photoContainer}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={64} color={colors.gray[400]} />
              </View>
            )}
            <View style={styles.photoOverlay}>
              <Ionicons name="camera" size={24} color={colors.white} />
            </View>
          </TouchableOpacity>
          <Caption color={colors.text.secondary} style={styles.photoHint}>
            Tap to change photo
          </Caption>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>First Name *</Caption>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={colors.text.tertiary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>Last Name *</Caption>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor={colors.text.tertiary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>Email *</Caption>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>Phone Number</Caption>
            <TextInput
              style={styles.input}
              placeholder="+44 7xxx xxx xxx"
              placeholderTextColor={colors.text.tertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Professional Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Information</Text>

          {/* SIA License - Read Only */}
          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>SIA License Number</Caption>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>
                {siaLicenseNumber || 'Not provided'}
              </Text>
              <Ionicons name="lock-closed-outline" size={16} color={colors.text.tertiary} />
            </View>
          </View>

          {/* SIA Expiry - Read Only */}
          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>SIA License Expiry</Caption>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>
                {siaExpiryDate || 'Not provided'}
              </Text>
              <Ionicons name="lock-closed-outline" size={16} color={colors.text.tertiary} />
            </View>
          </View>

          {/* Role/Position - Read Only */}
          <View style={styles.fieldGroup}>
            <Caption style={styles.fieldLabel}>Role/Position</Caption>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>
                {securityRoles}
              </Text>
              <Ionicons name="lock-closed-outline" size={16} color={colors.text.tertiary} />
            </View>
          </View>

          {/* Manage SIA Licenses Button */}
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => {
              Alert.alert(
                'Manage SIA Licenses',
                'SIA license management will be available in a future update. Please contact your administrator to update license information.',
                [{ text: 'OK' }]
              );
            }}
          >
            <Ionicons name="card-outline" size={20} color="#0066FF" />
            <Text style={styles.manageButtonText}>Manage SIA Licenses</Text>
            <Ionicons name="chevron-forward" size={20} color="#0066FF" />
          </TouchableOpacity>
        </View>

        {/* Info Note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Caption style={styles.infoText}>
            * Required fields. Changes will be saved to your profile immediately.
          </Caption>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.white,
  },
  headerButton: {
    padding: spacing.xs,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  saveText: {
    color: '#0066FF',
    fontWeight: '700',
    fontSize: 17,
  },
  saveTextDisabled: {
    color: colors.text.tertiary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl * 1.5,
    paddingTop: spacing.lg,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: spacing.base,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#0066FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#0066FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
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
  photoHint: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.xl * 1.5,
  },
  sectionTitle: {
    marginBottom: spacing.lg,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  fieldHint: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.text.tertiary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: spacing.base + 2,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.white,
    fontWeight: '500',
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: spacing.base + 2,
    backgroundColor: colors.gray[50] || '#F9FAFB',
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
    flex: 1,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    marginTop: spacing.sm,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    gap: 8,
  },
  manageButtonText: {
    color: '#0066FF',
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: spacing.base + 2,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    alignItems: 'flex-start',
    marginTop: spacing.base,
  },
  infoText: {
    marginLeft: spacing.base,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});
