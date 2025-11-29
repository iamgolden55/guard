/**
 * TeamScreen
 * Microsoft Teams-style team collaboration and shift coordination hub
 * Features: List view with sections, presence indicators, quick actions, subscription-aware features
 */

import React, { useState, useMemo } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Alert, Linking } from 'react-native';
import { Container, Body, Card } from '@components/ui';
import { Ionicons } from '@expo/vector-icons';
import {
  TeamMemberListData,
  PresenceStatus,
  FilterOption,
  ActiveShiftBanner,
  TeamHeader,
  TeamQuickActions,
  TeamMemberListCard,
  TeamSectionHeader,
} from './components';
import { teamsColors } from '../../theme/teamsColors';
import { spacing } from '../../theme';
import { logger } from '../../utils/logger';
import { useSubscription } from '../../contexts/SubscriptionContext';

export const TeamScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const { subscription } = useSubscription();

  // Mock team members with Teams-style data
  const [teamMembers] = useState<TeamMemberListData[]>([
    {
      id: 1,
      name: 'Sarah Johnson',
      role: 'Shift Manager',
      phone: '+44 7700 900123',
      email: 'sarah.j@example.com',
      presenceStatus: 'available',
      currentVenue: 'Main Entrance',
      statusMessage: 'Available for calls',
    },
    {
      id: 2,
      name: 'Mike Thompson',
      role: 'Door Supervisor',
      phone: '+44 7700 900456',
      email: 'mike.t@example.com',
      presenceStatus: 'in_call',
      currentVenue: 'VIP Section',
      activity: 'In a call',
    },
    {
      id: 3,
      name: 'Emma Williams',
      role: 'Door Supervisor',
      phone: '+44 7700 900789',
      presenceStatus: 'available',
      currentVenue: 'Main Entrance',
    },
    {
      id: 4,
      name: 'James Anderson',
      role: 'Security Guard',
      phone: '+44 7700 900321',
      email: 'james.a@example.com',
      presenceStatus: 'away',
      currentVenue: 'Back Entrance',
      statusMessage: 'On break',
    },
    {
      id: 5,
      name: 'Lisa Martinez',
      role: 'Security Guard',
      phone: '+44 7700 900654',
      presenceStatus: 'busy',
      currentVenue: 'Parking Lot',
      statusMessage: 'Do not disturb',
    },
    {
      id: 6,
      name: 'David Chen',
      role: 'Door Supervisor',
      phone: '+44 7700 900987',
      email: 'david.c@example.com',
      presenceStatus: 'offline',
    },
    {
      id: 7,
      name: 'Rachel Foster',
      role: 'Security Guard',
      presenceStatus: 'presenting',
      currentVenue: 'Conference Room',
      activity: 'Presenting',
    },
    {
      id: 8,
      name: 'Tom Bradley',
      role: 'Shift Manager',
      phone: '+44 7700 900111',
      presenceStatus: 'available',
      currentVenue: 'Reception',
    },
  ]);

  // Log screen view
  React.useEffect(() => {
    logger.info('Team screen viewed (Teams style)', {
      tier: subscription?.tier,
      totalMembers: teamMembers.length,
    });
  }, [subscription]);

  // Filter members by search query and filter option
  const filteredMembers = useMemo(() => {
    let members = teamMembers;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      members = members.filter(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query) ||
          member.currentVenue?.toLowerCase().includes(query)
      );
    }

    // Apply presence filter
    if (selectedFilter !== 'all') {
      members = members.filter((member) => member.presenceStatus === selectedFilter);
    }

    return members;
  }, [teamMembers, searchQuery, selectedFilter]);

  // Group members by section
  const groupedMembers = useMemo(() => {
    // Define presence priority for "On Shift" section
    const onShiftStatuses: PresenceStatus[] = ['available', 'busy', 'in_call', 'presenting'];

    const groups = {
      onShift: filteredMembers.filter((m) =>
        m.currentVenue && onShiftStatuses.includes(m.presenceStatus)
      ),
      away: filteredMembers.filter((m) => m.presenceStatus === 'away'),
      offline: filteredMembers.filter((m) => m.presenceStatus === 'offline'),
    };

    return groups;
  }, [filteredMembers]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeCount = teamMembers.filter((m) =>
      m.presenceStatus === 'available' || m.presenceStatus === 'busy' || m.presenceStatus === 'in_call'
    ).length;

    const venues = new Set(
      teamMembers.filter((m) => m.currentVenue).map((m) => m.currentVenue)
    );

    return {
      activeCount,
      totalCount: teamMembers.length,
      venuesCount: venues.size,
    };
  }, [teamMembers]);

  // Handle pull to refresh
  const handleRefresh = async () => {
    logger.info('Refreshing team list');
    setRefreshing(true);

    // TODO: Fetch team members from API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setRefreshing(false);
    logger.info('Team list refreshed');
  };

  // Handle section collapse toggle
  const handleToggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
  };

  // Handle member press
  const handleMemberPress = (member: TeamMemberListData) => {
    logger.info('Team member tapped', { memberId: member.id });

    const actions = [
      { text: 'Cancel', style: 'cancel' as const },
      member.phone && {
        text: 'Call',
        onPress: () => Linking.openURL(`tel:${member.phone}`),
      },
      member.email && {
        text: 'Email',
        onPress: () => Linking.openURL(`mailto:${member.email}`),
      },
      {
        text: 'View Profile',
        onPress: () => logger.info('View profile pressed'),
      },
    ].filter(Boolean);

    Alert.alert(
      member.name,
      `${member.role}${member.currentVenue ? `\n${member.currentVenue}` : ''}\n${member.phone || 'No phone'}`,
      actions as any
    );
  };

  // Handle quick action on member card
  const handleCallPress = (member: TeamMemberListData) => {
    if (member.phone) {
      Linking.openURL(`tel:${member.phone}`);
    }
  };

  const handleChatPress = (member: TeamMemberListData) => {
    logger.info('Chat with member', { memberId: member.id });
    Alert.alert('Chat', `Start chat with ${member.name}`);
  };

  const handleVideoPress = (member: TeamMemberListData) => {
    logger.info('Video call with member', { memberId: member.id });
    Alert.alert('Video Call', `Start video call with ${member.name}`);
  };

  const handleMorePress = (member: TeamMemberListData) => {
    logger.info('More options for member', { memberId: member.id });
    Alert.alert('More Options', `Additional options for ${member.name}`);
  };

  // Quick action handlers (banner actions)
  const handleTeamChatPress = () => {
    logger.info('Team chat opened');
    Alert.alert('Team Chat', 'Team chat feature coming soon!');
  };

  const handleBroadcastPress = () => {
    logger.info('Broadcast message opened');
    Alert.alert('Broadcast', 'Send a message to all active team members');
  };

  const handleEmergencyPress = () => {
    logger.info('Emergency alert sent to team');
    Alert.alert('Emergency', 'Emergency alert sent to all team members');
  };

  const handleSharePress = () => {
    logger.info('Share status pressed');
    Alert.alert('Share Status', 'Share your current status with the team');
  };

  // Handle stat press in banner
  const handleStatPress = (stat: 'active' | 'venues' | 'total') => {
    logger.info('Banner stat pressed', { stat });

    switch (stat) {
      case 'active':
        setSelectedFilter('available');
        break;
      case 'venues':
        Alert.alert('Venues', `Currently covering ${stats.venuesCount} venues`);
        break;
      case 'total':
        setSelectedFilter('all');
        break;
    }
  };

  // Render empty state
  const renderEmptyState = () => (
    <Card variant="flat" padding="xl" style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={teamsColors.text.tertiary} style={styles.emptyIcon} />
      <Body style={styles.emptyText}>
        {searchQuery ? 'No team members found' : 'No team members available'}
      </Body>
    </Card>
  );

  // Render a section of team members
  const renderSection = (
    title: string,
    members: TeamMemberListData[],
    icon: keyof typeof Ionicons.glyphMap,
    sectionKey: string
  ) => {
    if (members.length === 0) return null;

    const isCollapsed = collapsedSections.has(sectionKey);

    return (
      <View key={sectionKey}>
        <TeamSectionHeader
          title={title}
          icon={icon}
          count={members.length}
          collapsible={true}
          collapsed={isCollapsed}
          onToggleCollapse={() => handleToggleSection(sectionKey)}
        />
        {!isCollapsed &&
          members.map((member) => (
            <TeamMemberListCard
              key={member.id}
              member={member}
              onPress={() => handleMemberPress(member)}
              onCallPress={member.phone ? () => handleCallPress(member) : undefined}
              onChatPress={() => handleChatPress(member)}
              onVideoPress={() => handleVideoPress(member)}
              onMorePress={() => handleMorePress(member)}
            />
          ))}
      </View>
    );
  };

  return (
    <Container
      scrollable={false}
      safeArea={false}
      style={{ padding: 0, backgroundColor: teamsColors.background.secondary }}
    >
      <View style={styles.container}>
        {/* Header with Search and Filters */}
        <TeamHeader
          title="Team"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={teamsColors.primary}
              colors={[teamsColors.primary]}
            />
          }
        >
          {/* Active Shift Banner */}
          <ActiveShiftBanner
            companyName={subscription?.companyName || 'Your Company'}
            activeCount={stats.activeCount}
            totalCount={stats.totalCount}
            venuesCount={stats.venuesCount}
            onStatPress={handleStatPress}
          />

          {/* Quick Actions */}
          <TeamQuickActions
            onChatPress={handleTeamChatPress}
            onBroadcastPress={handleBroadcastPress}
            onEmergencyPress={handleEmergencyPress}
            onSharePress={handleSharePress}
          />

          {/* Team Members List (Grouped) */}
          {filteredMembers.length > 0 ? (
            <View style={styles.listContainer}>
              {renderSection('On Shift', groupedMembers.onShift, 'shield-checkmark', 'onShift')}
              {renderSection('Away', groupedMembers.away, 'time', 'away')}
              {renderSection('Offline', groupedMembers.offline, 'ellipse-outline', 'offline')}
            </View>
          ) : (
            <View style={styles.emptyContainer}>{renderEmptyState()}</View>
          )}

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    marginTop: spacing.md,
  },
  emptyContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    backgroundColor: teamsColors.background.primary,
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    color: teamsColors.text.secondary,
  },
  bottomSpacer: {
    height: spacing['3xl'],
  },
});
