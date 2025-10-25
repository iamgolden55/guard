/**
 * TeamScreen
 * View team members on current shift
 */

import React, { useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Alert, Linking } from 'react-native';
import { Container, Heading2, Body, Card } from '@components/ui';
import { Ionicons } from '@expo/vector-icons';
import { TeamMemberCard, TeamMember } from './components';
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';

export const TeamScreen = () => {
  const [refreshing, setRefreshing] = useState(false);

  // Mock team members - will be replaced with Redux data
  const [teamMembers] = useState<TeamMember[]>([
    {
      id: 1,
      name: 'Sarah Johnson',
      role: 'Shift Manager',
      phone: '+44 7700 900123',
      email: 'sarah.j@example.com',
      status: 'active',
    },
    {
      id: 2,
      name: 'Mike Thompson',
      role: 'Door Supervisor',
      phone: '+44 7700 900456',
      email: 'mike.t@example.com',
      status: 'active',
    },
    {
      id: 3,
      name: 'Emma Williams',
      role: 'Door Supervisor',
      phone: '+44 7700 900789',
      status: 'active',
    },
  ]);

  // Log screen view
  React.useEffect(() => {
    logger.info('Team screen viewed');
  }, []);

  // Handle pull to refresh
  const handleRefresh = async () => {
    logger.info('Refreshing team list');
    setRefreshing(true);

    // TODO: Fetch team members from API
    await new Promise(resolve => setTimeout(resolve, 1000));

    setRefreshing(false);
    logger.info('Team list refreshed');
  };

  // Handle member press
  const handleMemberPress = (member: TeamMember) => {
    logger.info('Team member tapped', { memberId: member.id });
    Alert.alert(
      member.name,
      `${member.role}\n${member.phone || 'No phone'}\n${member.email || 'No email'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        member.phone && {
          text: 'Call',
          onPress: () => Linking.openURL(`tel:${member.phone}`),
        },
        member.email && {
          text: 'Email',
          onPress: () => Linking.openURL(`mailto:${member.email}`),
        },
      ].filter(Boolean) as any
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <Card variant="flat" padding="xl" style={styles.emptyState}>
      <Ionicons
        name="people-outline"
        size={64}
        color={colors.gray[400]}
        style={styles.emptyIcon}
      />
      <Heading2 style={styles.emptyTitle}>No Team Members</Heading2>
      <Body color={colors.text.secondary} style={styles.emptyText}>
        Team members on your current shift will appear here
      </Body>
    </Card>
  );

  // Render team member card
  const renderMemberCard = ({ item }: { item: TeamMember }) => (
    <TeamMemberCard member={item} onPress={() => handleMemberPress(item)} />
  );

  // Count active members
  const activeCount = teamMembers.filter(m => m.status === 'active').length;

  return (
    <Container scrollable={false} safeArea={false} padding="none" backgroundColor={colors.background.secondary}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Heading2 style={styles.title}>Team</Heading2>
          {teamMembers.length > 0 && (
            <View style={styles.badge}>
              <Ionicons name="people" size={16} color={colors.primary} />
              <Body style={styles.badgeText}>
                {activeCount} {activeCount === 1 ? 'member' : 'members'} on shift
              </Body>
            </View>
          )}
        </View>

        {/* Team Members List */}
        <FlatList
          data={teamMembers}
          renderItem={renderMemberCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    marginBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  listContent: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
});
