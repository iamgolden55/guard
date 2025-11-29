/**
 * TransferShiftModal - Modal for transferring shifts to other staff
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>Transfer Shift</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Shift Info */}
          <View style={styles.shiftInfo}>
            <Text style={styles.shiftInfoTitle}>Shift Details</Text>
            <Text style={styles.shiftInfoText}>
              {shift.venue.name} • {new Date(shift.start_time).toLocaleDateString()}
            </Text>
            <Text style={styles.shiftInfoTime}>
              {new Date(shift.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' - '}
              {new Date(shift.end_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Staff Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Transfer to:</Text>

              {/* Search Input */}
              {!loading && staffMembers.length > 0 && (
                <View style={styles.searchContainer}>
                  <Ionicons
                    name="search"
                    size={20}
                    color={colors.text.secondary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.clearButton}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading staff...</Text>
                </View>
              ) : (
                <View style={styles.staffList}>
                  {staffMembers.length === 0 ? (
                    <Text style={styles.emptyText}>No staff members available</Text>
                  ) : filteredStaffMembers.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No staff found matching "{searchQuery}"
                    </Text>
                  ) : (
                    filteredStaffMembers.map((staff) => (
                      <TouchableOpacity
                        key={staff.id}
                        style={[
                          styles.staffItem,
                          selectedStaff?.id === staff.id && styles.staffItemSelected,
                        ]}
                        onPress={() => setSelectedStaff(staff)}
                      >
                        <View style={styles.staffInfo}>
                          <Text style={styles.staffName}>
                            {staff.first_name} {staff.last_name}
                          </Text>
                          <Text style={styles.staffEmail}>{staff.email}</Text>
                        </View>
                        {selectedStaff?.id === staff.id && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>

            {/* Reason Input */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Reason for transfer: <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="E.g., Personal emergency, schedule conflict, etc."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.characterCount}>{reason.length}/500</Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              style={styles.footerButton}
              disabled={submitting}
            />
            <Button
              title={submitting ? 'Sending...' : 'Send Request'}
              variant="primary"
              onPress={handleSubmit}
              style={styles.footerButton}
              disabled={submitting || !selectedStaff || !reason.trim()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  shiftInfo: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
  },
  shiftInfoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  shiftInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  shiftInfoTime: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  staffList: {
    gap: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: 14,
    padding: spacing.xl,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  staffItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  staffEmail: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerButton: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
