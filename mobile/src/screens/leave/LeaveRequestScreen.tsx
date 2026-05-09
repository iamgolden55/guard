/**
 * LeaveRequestScreen - Submit Leave Request
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import {
  fetchMyBalances,
  fetchLeaveTypes,
  createLeaveRequest,
  selectLeaveBalances,
  selectLeaveTypes,
  clearMessages,
} from '../../store/slices/leaveSlice';
import { leaveService } from '../../services/leaveService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const LeaveRequestScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();

  // Employment type check - only permanent employees should access this screen
  const user = useAppSelector((state) => state.auth.user);
  const employmentCategory = user?.staff_profile?.employment_type?.employment_category;
  const isContractor = employmentCategory === 'contractor' || employmentCategory === 'temporary';

  // Redirect contractors away from this screen
  useEffect(() => {
    if (isContractor) {
      Alert.alert(
        'Access Restricted',
        'Leave requests are only available for permanent employees. As a contractor, please use the Availability feature to manage your schedule.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isContractor, navigation]);

  const balances = useAppSelector(selectLeaveBalances);
  const leaveTypes = useAppSelector(selectLeaveTypes);
  const loading = useAppSelector((state) => state.leave.requestsLoading);
  const successMessage = useAppSelector((state) => state.leave.successMessage);

  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);

  useEffect(() => {
    dispatch(fetchMyBalances());
    dispatch(fetchLeaveTypes());
  }, []);

  useEffect(() => {
    if (successMessage) {
      Alert.alert('Success', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            dispatch(clearMessages());
            navigation.goBack();
          },
        },
      ]);
    }
  }, [successMessage]);

  useEffect(() => {
    if (startDate && endDate) {
      const days = leaveService.calculateWorkingDays(
        leaveService.formatDateForAPI(startDate),
        leaveService.formatDateForAPI(endDate)
      );
      setWorkingDays(days);
    }
  }, [startDate, endDate]);

  const getAvailableBalance = () => {
    if (!selectedLeaveTypeId) return null;
    const balance = balances.find((b) => b.leave_type.id === selectedLeaveTypeId);
    return balance?.available_balance || 0;
  };

  const handleSubmit = async () => {
    if (!selectedLeaveTypeId) {
      Alert.alert('Error', 'Please select a leave type');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your leave');
      return;
    }

    if (workingDays <= 0) {
      Alert.alert('Error', 'Please select valid dates');
      return;
    }

    const availableBalance = getAvailableBalance();
    if (availableBalance !== null && workingDays > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${availableBalance.toFixed(1)} days available. You're requesting ${workingDays} days.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Anyway', onPress: submitRequest },
        ]
      );
      return;
    }

    submitRequest();
  };

  const submitRequest = async () => {
    await dispatch(
      createLeaveRequest({
        leave_type_id: selectedLeaveTypeId!,
        start_date: leaveService.formatDateForAPI(startDate),
        end_date: leaveService.formatDateForAPI(endDate),
        days_requested: workingDays,
        reason: reason.trim(),
      })
    );
  };

  const renderLeaveTypeOption = (leaveType: typeof leaveTypes[0]) => {
    const isSelected = selectedLeaveTypeId === leaveType.id;
    const balance = balances.find((b) => b.leave_type.id === leaveType.id);

    return (
      <TouchableOpacity
        key={leaveType.id}
        style={[styles.leaveTypeOption, isSelected && styles.leaveTypeOptionSelected]}
        onPress={() => setSelectedLeaveTypeId(leaveType.id)}
      >
        <View style={[styles.leaveTypeBadge, { backgroundColor: `${leaveType.color_code}15` }]}>
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'calendar'}
            size={24}
            color={leaveType.color_code}
          />
        </View>
        <View style={styles.leaveTypeInfo}>
          <Text style={styles.leaveTypeName}>{leaveType.name}</Text>
          {balance && (
            <Text style={styles.leaveTypeBalance}>
              Available: {balance.available_balance.toFixed(1)} days
            </Text>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Container style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
        <Ionicons name="close" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.mainHeading}>REQUEST LEAVE</Text>
        <Text style={styles.subtitle}>Submit a new leave request</Text>

        {/* Leave Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Leave Type</Text>
          {leaveTypes && leaveTypes.length > 0 ? (
            leaveTypes.map(renderLeaveTypeOption)
          ) : (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.emptyText}>Loading leave types...</Text>
            </View>
          )}
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dates</Text>

          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowStartPicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.dateText}>
              Start: {startDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowEndPicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
            <Text style={styles.dateText}>
              End: {endDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>

          {workingDays > 0 && (
            <View style={styles.workingDaysCard}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.workingDaysText}>
                {workingDays} working day{workingDays !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {selectedLeaveTypeId && (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>
                {getAvailableBalance()?.toFixed(1)} days
              </Text>
            </View>
          )}
        </View>

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reason</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason for leave request..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={200}
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{reason.length}/200</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) {
              setStartDate(date);
              if (date > endDate) setEndDate(date);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={startDate}
          onChange={(event, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) setEndDate(date);
          }}
        />
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={loading ? 'Submitting...' : 'Submit Request'}
          variant="primary"
          size="large"
          onPress={handleSubmit}
          disabled={loading}
          icon={loading ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
        />
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    backgroundColor: colors.white,
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dededeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  mainHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  leaveTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  leaveTypeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}05`,
  },
  leaveTypeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  leaveTypeInfo: {
    flex: 1,
  },
  leaveTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  leaveTypeBalance: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  dateText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  workingDaysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  workingDaysText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  reasonInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
