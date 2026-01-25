/**
 * ContractorUnavailabilityScreen - Manage Contractor Availability
 *
 * Allows contractors to mark dates when they're unavailable for shifts.
 * No approval needed - this is purely informational for scheduling.
 */

import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import contractorUnavailabilityService, {
  ContractorUnavailability,
  CreateUnavailabilityRequest,
} from '../../services/contractorUnavailabilityService';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const ContractorUnavailabilityScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [unavailabilityPeriods, setUnavailabilityPeriods] = useState<ContractorUnavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ContractorUnavailability | null>(null);

  // Form state
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const periods = await contractorUnavailabilityService.getUpcomingUnavailability();
      setUnavailabilityPeriods(periods);
    } catch (error) {
      console.error('Error loading unavailability periods:', error);
      Alert.alert('Error', 'Failed to load unavailability periods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
    setEditingPeriod(null);
    setShowAddForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const calculateDays = (start: Date, end: Date): number => {
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const handleSubmit = async () => {
    if (startDate > endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setSubmitting(true);
    try {
      const data: CreateUnavailabilityRequest = {
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        reason: reason.trim() || undefined,
      };

      if (editingPeriod) {
        await contractorUnavailabilityService.updateUnavailability(editingPeriod.id, data);
        Alert.alert('Success', 'Unavailability period updated');
      } else {
        await contractorUnavailabilityService.createUnavailability(data);
        Alert.alert('Success', 'Unavailability period added');
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving unavailability:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save unavailability period');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (period: ContractorUnavailability) => {
    setEditingPeriod(period);
    setStartDate(new Date(period.start_date));
    setEndDate(new Date(period.end_date));
    setReason(period.reason || '');
    setShowAddForm(true);
  };

  const handleDelete = (period: ContractorUnavailability) => {
    Alert.alert(
      'Delete Unavailability',
      `Are you sure you want to delete this unavailability period (${formatDate(period.start_date)} - ${formatDate(period.end_date)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await contractorUnavailabilityService.deleteUnavailability(period.id);
              Alert.alert('Success', 'Unavailability period deleted');
              loadData();
            } catch (error) {
              console.error('Error deleting unavailability:', error);
              Alert.alert('Error', 'Failed to delete unavailability period');
            }
          },
        },
      ]
    );
  };

  const renderPeriodCard = (period: ContractorUnavailability) => {
    const days = calculateDays(new Date(period.start_date), new Date(period.end_date));
    const isPast = new Date(period.end_date) < new Date();

    return (
      <View key={period.id} style={[styles.periodCard, isPast && styles.periodCardPast]}>
        <View style={styles.periodHeader}>
          <View style={styles.periodDates}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={isPast ? colors.text.tertiary : colors.primary}
            />
            <Text style={[styles.periodDateText, isPast && styles.textMuted]}>
              {formatDate(period.start_date)} - {formatDate(period.end_date)}
            </Text>
          </View>
          <View style={styles.daysChip}>
            <Text style={styles.daysChipText}>
              {days} day{days !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {period.reason && (
          <Text style={[styles.periodReason, isPast && styles.textMuted]}>
            {period.reason}
          </Text>
        )}

        <View style={styles.periodActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEdit(period)}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(period)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAddForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {editingPeriod ? 'Edit Unavailability' : 'Add Unavailability'}
        </Text>
        <TouchableOpacity onPress={resetForm}>
          <Ionicons name="close" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
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

        {startDate && endDate && startDate <= endDate && (
          <View style={styles.daysCard}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.daysCardText}>
              {calculateDays(startDate, endDate)} day{calculateDays(startDate, endDate) !== 1 ? 's' : ''} unavailable
            </Text>
          </View>
        )}
      </View>

      {/* Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Reason (Optional)</Text>
        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g., Personal commitment, vacation, etc."
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={200}
          numberOfLines={3}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{reason.length}/200</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.infoBannerText}>
          Marking yourself unavailable will prevent you from being assigned shifts during this period.
        </Text>
      </View>

      {/* Submit Button */}
      <Button
        title={submitting ? 'Saving...' : (editingPeriod ? 'Update' : 'Add Unavailability')}
        variant="primary"
        size="large"
        onPress={handleSubmit}
        disabled={submitting}
        icon={submitting ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
      />
    </View>
  );

  if (loading) {
    return (
      <Container style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
        <Ionicons name="arrow-back" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.mainHeading}>AVAILABILITY</Text>
        <Text style={styles.subtitle}>
          Mark the dates when you're not available for shifts
        </Text>

        {/* Add Form or Toggle */}
        {showAddForm ? (
          renderAddForm()
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add-circle" size={24} color={colors.primary} />
            <Text style={styles.addButtonText}>Add Unavailability Period</Text>
          </TouchableOpacity>
        )}

        {/* Existing Periods */}
        <View style={styles.periodsSection}>
          <Text style={styles.sectionLabel}>
            UPCOMING UNAVAILABILITY ({unavailabilityPeriods.length})
          </Text>

          {unavailabilityPeriods.length > 0 ? (
            unavailabilityPeriods.map(renderPeriodCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyStateTitle}>No Unavailability Set</Text>
              <Text style={styles.emptyStateText}>
                You haven't marked any upcoming unavailable dates.
                Tap the button above to add a period.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: 14,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  formContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  dateText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  daysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  daysCardText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  reasonInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.base,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 80,
  },
  charCount: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.primary}10`,
    padding: spacing.base,
    borderRadius: 12,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  periodsSection: {
    marginTop: spacing.sm,
  },
  periodCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  periodCardPast: {
    borderLeftColor: colors.text.tertiary,
    opacity: 0.7,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  periodDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  periodDateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  daysChip: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  daysChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  periodReason: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  textMuted: {
    color: colors.text.tertiary,
  },
  periodActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
    gap: spacing.base,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  deleteButton: {},
  deleteButtonText: {
    color: colors.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.base,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});

export default ContractorUnavailabilityScreen;
