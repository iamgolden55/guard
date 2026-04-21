/**
 * EditProfileScreenV2 — Re-skinned edit profile matching Phase 4 design.
 * Preserves handlers from EditProfileScreen: photo pick/take + upload,
 * updateProfile dispatch, validation, cancel-with-discard-confirm.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { RootState } from '../../../store';
import { updateProfile } from '../../../store/slices/authSlice';
import authService from '../../../services/authService';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard } from '../../../components/redesign';

const ROLE_LABEL: Record<string, string> = {
  door_supervisor: 'Door supervisor',
  security_guard: 'Security guard',
  cctv_operator: 'CCTV operator',
  close_protection: 'Close protection',
  dog_handler: 'Dog handler',
  ds: 'Door supervisor',
  sg: 'Security guard',
  cctv: 'CCTV operator',
  cp: 'Close protection',
  k9: 'Dog handler',
};

const formatSecurityRoles = (roles?: string[]) => {
  if (!roles || roles.length === 0) return 'Not assigned';
  return roles.map((r) => ROLE_LABEL[r] || r).join(', ');
};

export const EditProfileScreenV2: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const user = useAppSelector((s: RootState) => s.auth.user);
  const accessToken = useAppSelector((s: RootState) => s.auth.accessToken);
  const staffProfile = user?.staff_profile as any;

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(staffProfile?.phone_number || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(
    staffProfile?.profile_image_url || null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const siaLicenseNumber = staffProfile?.sia_license_number || '';
  const siaExpiryDate = staffProfile?.sia_license_expiry || '';
  const securityRoles = useMemo(
    () => formatSecurityRoles(staffProfile?.security_roles || user?.security_roles),
    [staffProfile?.security_roles, user?.security_roles],
  );

  useEffect(() => {
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('[EditProfileV2] pick photo', error);
      Alert.alert('Error', 'Failed to select photo.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('[EditProfileV2] take photo', error);
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const handlePhotoOptions = () =>
    Alert.alert('Profile photo', 'Choose an option', [
      { text: 'Take photo', onPress: handleTakePhoto },
      { text: 'Choose from library', onPress: handleChoosePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const validateForm = () => {
    if (!firstName.trim()) {
      Alert.alert('Required field', 'Please enter your first name');
      return false;
    }
    if (!lastName.trim()) {
      Alert.alert('Required field', 'Please enter your last name');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Required field', 'Please enter your email address');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address');
      return false;
    }
    if (phone.trim() && !/^[\d\s\-()+]+$/.test(phone)) {
      Alert.alert('Invalid phone', 'Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      setIsSaving(true);
      const photoChanged = profilePhoto !== (staffProfile?.profile_image_url || null);
      const isLocalPhoto = profilePhoto && !profilePhoto.startsWith('http');
      if (photoChanged && isLocalPhoto && profilePhoto && accessToken) {
        try {
          await authService.uploadProfilePhoto(accessToken, profilePhoto);
        } catch (err) {
          logger.error('[EditProfileV2] upload photo', err);
          Alert.alert('Photo upload failed', 'Other changes will still be saved.');
        }
      }
      const profileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone_number: phone.trim() || null,
      };
      await dispatch(updateProfile(profileData)).unwrap();
      Alert.alert('Profile updated', 'Your profile has been updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      logger.error('[EditProfileV2] save', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Failed to update profile.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert('Discard changes?', 'You have unsaved changes.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.surface.hairline,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              borderBottomColor: theme.colors.surface.hairline,
            },
          ]}
        >
          <Pressable
            onPress={handleCancel}
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
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M5 5L19 19M19 5L5 19" stroke={theme.colors.text.primary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <Text
            allowFontScaling={false}
            style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
          >
            Edit profile
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              height: 36,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: !hasChanges || isSaving ? theme.colors.surface.chip : theme.colors.accent,
              borderWidth: 1,
              borderColor: !hasChanges || isSaving ? theme.colors.surface.hairline : theme.colors.accent,
              opacity: !hasChanges || isSaving ? 0.7 : pressed ? 0.9 : 1,
            })}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.colors.text.primary} />
            ) : (
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: !hasChanges ? theme.colors.text.tertiary : '#fff',
                  fontWeight: '500',
                }}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar + camera overlay */}
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 22 }}>
            <Pressable onPress={handlePhotoOptions} hitSlop={8}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.avatar} />
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
                  <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 12 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4 21 c0 -4 4 -7 8 -7 s8 3 8 7"
                      stroke={theme.colors.text.tertiary}
                      strokeWidth={1.4}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              )}
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: theme.colors.accent, borderColor: theme.colors.canvas },
                ]}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 8 H7 L9 5 H15 L17 8 H20 V19 H4 Z M12 17 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6"
                    stroke="#fff"
                    strokeWidth={1.6}
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
                marginTop: 10,
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: theme.colors.text.secondary,
              }}
            >
              Tap to change photo
            </Text>
          </View>

          {/* Personal info */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Personal information</Eyebrow>
          <GlassCard style={{ marginBottom: 18 }}>
            <FieldLabel>First name *</FieldLabel>
            <TextInput
              style={inputStyle}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={theme.colors.text.tertiary}
              autoCapitalize="words"
            />
            <View style={{ height: 12 }} />
            <FieldLabel>Last name *</FieldLabel>
            <TextInput
              style={inputStyle}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={theme.colors.text.tertiary}
              autoCapitalize="words"
            />
            <View style={{ height: 12 }} />
            <FieldLabel>Email *</FieldLabel>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={theme.colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ height: 12 }} />
            <FieldLabel>Phone number</FieldLabel>
            <TextInput
              style={inputStyle}
              value={phone}
              onChangeText={setPhone}
              placeholder="+44 7xxx xxx xxx"
              placeholderTextColor={theme.colors.text.tertiary}
              keyboardType="phone-pad"
            />
          </GlassCard>

          {/* Professional info */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Professional information</Eyebrow>
          <GlassCard style={{ marginBottom: 12 }}>
            <ReadOnlyField label="SIA licence number" value={siaLicenseNumber || 'Not provided'} />
            <Divider />
            <ReadOnlyField label="SIA licence expiry" value={siaExpiryDate || 'Not provided'} />
            <Divider />
            <ReadOnlyField label="Role / Position" value={securityRoles} />
          </GlassCard>

          <Pressable
            onPress={() =>
              Alert.alert(
                'Manage SIA licences',
                'SIA licence management will be available in a future update. Please contact your administrator to update licence information.',
              )
            }
            style={({ pressed }) => ({
              marginTop: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.accentSoft,
              borderWidth: 1,
              borderColor: theme.colors.accentBorder,
              opacity: pressed ? 0.85 : 1,
            })}
          >
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
            <Text
              style={{
                flex: 1,
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: theme.colors.accent,
                fontWeight: '500',
              }}
            >
              Manage SIA licences
            </Text>
            <Svg width={7} height={12} viewBox="0 0 8 14">
              <Path
                d="M1 1l6 6-6 6"
                stroke={theme.colors.accent}
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

          {/* Info */}
          <GlassCard style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
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
                * Required fields. Changes are saved to your profile immediately.
              </Text>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useRedesignTheme();
  return (
    <Text
      allowFontScaling={false}
      style={{
        marginBottom: 6,
        fontFamily: theme.fonts.mono,
        fontSize: 9,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: theme.colors.text.secondary,
        fontWeight: '500',
      }}
    >
      {children}
    </Text>
  );
};

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: theme.colors.text.secondary,
          }}
        >
          {label}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{ marginTop: 3, fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}
        >
          {value}
        </Text>
      </View>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 11 H19 V21 H5 Z M8 11 V7 a4 4 0 0 1 8 0 v4"
          stroke={theme.colors.text.tertiary}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const Divider: React.FC = () => {
  const theme = useRedesignTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.surface.hairline }} />;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EditProfileScreenV2;
