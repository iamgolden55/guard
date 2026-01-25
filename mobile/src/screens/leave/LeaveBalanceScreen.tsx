/**
 * LeaveBalanceScreen - Wise-Inspired Leave Balance Display
 * Shows all leave balances with progress bars and visual indicators
 */

import React, { useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { fetchMyBalances, fetchLeaveTypes, selectLeaveBalances, selectLeaveTypes } from '../../store/slices/leaveSlice';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const LeaveBalanceScreen: React.FC = () => {
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
        'Leave balances are only available for permanent employees. As a contractor, please use the Availability feature to manage your schedule.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isContractor, navigation]);

  const balances = useAppSelector(selectLeaveBalances);
  const leaveTypes = useAppSelector(selectLeaveTypes);
  const balancesLoading = useAppSelector((state) => state.leave.balancesLoading);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      dispatch(fetchMyBalances()),
      dispatch(fetchLeaveTypes()),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getLeaveTypeColor = (code: string) => {
    switch (code) {
      case 'ANNUAL':
        return '#0066FF';
      case 'SICK':
        return '#22C55E';
      case 'PERSONAL':
        return '#F59E0B';
      case 'MATERNITY':
      case 'PATERNITY':
        return '#EC4899';
      case 'BEREAVEMENT':
        return '#6B7280';
      default:
        return colors.primary;
    }
  };

  const getProgressPercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return (used / total) * 100;
  };

  const renderBalanceCard = (balance: typeof balances[0]) => {
    const color = getLeaveTypeColor(balance.leave_type.code);
    const progressPercentage = getProgressPercentage(balance.used_balance, balance.total_entitlement);

    return (
      <View key={balance.id} style={styles.balanceCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
            <Ionicons name="calendar" size={24} color={color} />
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{balance.leave_type.name}</Text>
            <Text style={styles.cardSubtitle}>{balance.leave_type.code}</Text>
          </View>
        </View>

        {/* Available Days */}
        <View style={styles.availableSection}>
          <Text style={styles.availableLabel}>Available</Text>
          <Text style={[styles.availableDays, { color }]}>
            {balance.available_balance.toFixed(1)} days
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Used</Text>
            <Text style={styles.detailValue}>{balance.used_balance.toFixed(1)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={styles.detailValue}>{balance.total_entitlement.toFixed(1)}</Text>
          </View>
          {balance.pending_balance > 0 && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Pending</Text>
                <Text style={[styles.detailValue, { color: colors.warning }]}>
                  {balance.pending_balance.toFixed(1)}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  if (balancesLoading && (!balances || balances.length === 0)) {
    return (
      <Container style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading balances...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
        <Ionicons name="close" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <Text style={styles.mainHeading}>LEAVE BALANCE</Text>
        <Text style={styles.subtitle}>View your available leave days</Text>

        {/* Balance Cards */}
        {balances && balances.length > 0 ? (
          <View style={styles.cardsContainer}>
            {balances.map(renderBalanceCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No leave balances found</Text>
            <Text style={styles.emptySubtext}>Contact your manager for more information</Text>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer - Request Leave Button */}
      {balances && balances.length > 0 && (
        <View style={styles.footer}>
          <Button
            title="Request Leave"
            variant="primary"
            size="large"
            onPress={() => navigation.navigate('LeaveRequest')}
            style={styles.actionButton}
            icon={<Ionicons name="add-circle-outline" size={22} color={colors.white} />}
          />
        </View>
      )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  // Header
  mainHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Cards Container
  cardsContainer: {
    width: '100%',
    gap: spacing.lg,
  },
  // Balance Card
  balanceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Available Section
  availableSection: {
    alignItems: 'center',
    marginVertical: spacing.base,
  },
  availableLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  availableDays: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  // Progress Bar
  progressContainer: {
    marginBottom: spacing.base,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Details Row
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  detailDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['4xl'],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Footer
  footer: {
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    minHeight: 56,
  },
});
