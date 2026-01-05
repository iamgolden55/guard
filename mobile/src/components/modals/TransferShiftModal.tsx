/**
 * TransferShiftModal - Wise-Inspired Minimal Design
 * Clean, product-focused shift transfer with clear visual hierarchy
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { Button } from '../ui';
import exchangeService from '../../services/exchangeService';
import { Shift } from '../../store/slices/shiftsSlice';
import { apiService } from '../../services/api';

interface StaffMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

// Helper function to get initials from name
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Helper function to generate consistent avatar color from name
const getAvatarColor = (name: string): string => {
  const colors = [
    '#0066FF', '#00C853', '#FF6B00', '#9C27B0',
    '#00BCD4', '#FF5722', '#4CAF50', '#FFC107'
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

interface TransferShiftModalProps {
  visible: boolean;
  shift: Shift | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferShiftModal: React.FC<TransferShiftModalProps> = ({
  visible,
  shift,
  onClose,
  onSuccess,
}) => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scaleAnim] = useState(new Animated.Value(1));

  // Fetch available staff when modal opens
  useEffect(() => {
    if (visible && shift) {
      fetchStaffMembers();
    }
  }, [visible, shift]);

  const fetchStaffMembers = async () => {
    try {
      setLoading(true);
      // Fetch eligible staff filtered by shift's required security role
      const response = await apiService.get<StaffMember[]>(
        `/api/v1/users/eligible-for-transfer/?shift_id=${shift!.id}`
      );

      // Response is direct array, not paginated (no .results wrapper needed)
      setStaffMembers(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      Alert.alert('Error', 'Failed to load staff members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!shift || !selectedStaff) {
      Alert.alert('Error', 'Please select a staff member');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the transfer');
      return;
    }

    try {
      setSubmitting(true);

      await exchangeService.createExchange({
        original_shift: shift.id,
        target_user: selectedStaff.id,
        request_reason: reason.trim(),
      });

      Alert.alert(
        'Success',
        `Shift transfer request sent to ${selectedStaff.first_name} ${selectedStaff.last_name}`,
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating exchange:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create transfer request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedStaff(null);
    setReason('');
    setSearchQuery('');
    onClose();
  };

  // Filter staff members based on search query
  const filteredStaffMembers = staffMembers.filter((staff) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const fullName = `${staff.first_name} ${staff.last_name}`.toLowerCase();
    const email = staff.email.toLowerCase();

    return (
      fullName.includes(query) ||
      staff.first_name.toLowerCase().includes(query) ||
      staff.last_name.toLowerCase().includes(query) ||
      email.includes(query)
    );
  });

  if (!shift) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Minimal Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={26} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>Transfer Shift</Text>
          </View>

          {/* Hero Shift Card - Wise Style */}
          <View style={styles.heroCard}>
            {/* Prominent Date Badge */}
            <View style={styles.dateHighlight}>
              <Text style={styles.dateHighlightDay}>
                {new Date(shift.start_time).getDate()}
              </Text>
              <Text style={styles.dateHighlightMonth}>
                {new Date(shift.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
              <Text style={styles.dateHighlightYear}>
                {new Date(shift.start_time).getFullYear()}
              </Text>
            </View>

            <Text style={styles.heroVenueName}>
              {shift.venue.name.toUpperCase()}
            </Text>
            <View style={styles.heroDetails}>
              <View style={styles.heroDetailItem}>
                <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.heroDetailText}>
                  {new Date(shift.start_time).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.heroDetails}>
              <View style={styles.heroDetailItem}>
                <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.heroDetailText}>
                  {new Date(shift.start_time).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {new Date(shift.end_time).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Staff Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select Team Member</Text>

              {/* Search Input - Wise Style */}
              {!loading && staffMembers.length > 0 && (
                <View style={styles.searchWrapper}>
                  <Ionicons
                    name="search"
                    size={20}
                    color={colors.text.tertiary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search team members..."
                    placeholderTextColor={colors.text.tertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.clearIcon}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading team members...</Text>
                </View>
              ) : (
                <View style={styles.staffList}>
                  {staffMembers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
                      <Text style={styles.emptyText}>No team members available</Text>
                    </View>
                  ) : filteredStaffMembers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="search-outline" size={48} color={colors.text.tertiary} />
                      <Text style={styles.emptyText}>
                        No results for "{searchQuery}"
                      </Text>
                    </View>
                  ) : (
                    filteredStaffMembers.map((staff) => {
                      const isSelected = selectedStaff?.id === staff.id;
                      const initials = getInitials(staff.first_name, staff.last_name);
                      const avatarColor = getAvatarColor(staff.first_name);

                      return (
                        <TouchableOpacity
                          key={staff.id}
                          style={[
                            styles.staffCard,
                            isSelected && styles.staffCardSelected,
                          ]}
                          onPress={() => setSelectedStaff(staff)}
                          activeOpacity={0.7}
                        >
                          {/* Avatar Circle */}
                          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>

                          {/* Staff Info */}
                          <View style={styles.staffInfo}>
                            <Text style={styles.staffName}>
                              {staff.first_name} {staff.last_name}
                            </Text>
                            <Text style={styles.staffEmail}>{staff.email}</Text>
                          </View>

                          {/* Selection Indicator */}
                          {isSelected && (
                            <View style={styles.checkmarkContainer}>
                              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* Reason Input - Wise Style */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Why are you transferring? <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Personal emergency, schedule conflict, family matter..."
                  placeholderTextColor={colors.text.tertiary}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <View style={styles.textAreaFooter}>
                  <Text style={styles.characterCount}>{reason.length}/500</Text>
                </View>
              </View>
            </View>

            {/* Bottom Spacing */}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Wise-Style Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.footerButton, styles.cancelButton]}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[
                styles.footerButton,
                styles.submitButton,
                (submitting || !selectedStaff || !reason.trim()) && styles.submitButtonDisabled
              ]}
              disabled={submitting || !selectedStaff || !reason.trim()}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Send Request</Text>
                  <Ionicons name="checkmark" size={20} color={colors.white} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: colors.white,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  // Hero Shift Card - Wise Style
  heroCard: {
    marginHorizontal: spacing.xl,
    marginVertical: spacing.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'center',
  },
  // Prominent date display
  dateHighlight: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    minWidth: 100,
  },
  dateHighlightDay: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 40,
  },
  dateHighlightMonth: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    marginTop: 2,
  },
  dateHighlightYear: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  heroVenueName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
    lineHeight: 28,
    textAlign: 'center',
  },
  heroDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  heroDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroDetailText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  heroDivider: {
    fontSize: 15,
    color: colors.text.tertiary,
    marginHorizontal: spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  required: {
    color: '#FF3B30',
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  staffList: {
    gap: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  // Staff Card - Wise Style with Avatar
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  staffCardSelected: {
    borderColor: colors.success,
    backgroundColor: '#F0FFF4',
    shadowOpacity: 0.08,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  staffEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  checkmarkContainer: {
    marginLeft: spacing.sm,
  },
  // Text Area - Wise Style
  textAreaWrapper: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 16,
    overflow: 'hidden',
  },
  textArea: {
    padding: spacing.base,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 120,
    lineHeight: 22,
  },
  textAreaFooter: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  characterCount: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'right',
    fontWeight: '500',
  },
  // Wise-Style Footer
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: colors.white,
  },
  footerButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  submitButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#D0D0D0',
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: -0.3,
  },
  // Search - Wise Style
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
    height: 52,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  clearIcon: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
