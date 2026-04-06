/**
 * TeamScreen
 * Microsoft Teams-style team collaboration and shift coordination hub
 * Features: List view with sections, presence indicators, quick actions, subscription-aware features
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
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
import { getTeamsColors } from '../../theme/teamsColors';
import { spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '../../hooks/useRedux';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api.config';
import axios from 'axios';

interface TeamMemberAPI {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  security_roles: string[];
  profile_image_url: string | null;
  employment_type: string | null;
  sia_license_types: string[];
  is_on_shift: boolean;
  active_shift: {
    venue_name: string | null;
    check_in_time: string | null;
    role_on_shift: string;
  } | null;
  is_current_user: boolean;
}

/**
 * Map API team member to UI data model.
 * Presence is derived from shift status — no mock statuses.
 */
function mapToListData(member: TeamMemberAPI): TeamMemberListData {
  const presenceStatus: PresenceStatus = member.is_on_shift ? 'available' : 'offline';

  const roleParts: string[] = [];
  if (member.role === 'manager' || member.role === 'admin') {
    roleParts.push(member.role.charAt(0).toUpperCase() + member.role.slice(1));
  }
  if (member.security_roles.length > 0) {
    const roleLabels: Record<string, string> = {
      ds: 'Door Supervisor',
      sg: 'Security Guard',
      cctv: 'CCTV Operator',
      cp: 'Close Protection',
      steward: 'Steward',
      k9: 'Dog Handler',
      retail: 'Retail Security',
      static: 'Static Guard',
      mobile: 'Mobile Patrol',
      event: 'Event Security',
    };
    const mapped = member.security_roles.map((r) => roleLabels[r] || r);
    roleParts.push(...mapped);
  }

  return {
    id: member.id,
    name: `${member.first_name} ${member.last_name}`.trim() || 'Unknown',
    role: roleParts.join(' · ') || member.employment_type || 'Staff',
    photo: member.profile_image_url || undefined,
    presenceStatus,
    currentVenue: member.active_shift?.venue_name || undefined,
    statusMessage: member.is_on_shift ? 'On duty' : undefined,
  };
}

export const TeamScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<TeamMemberListData[]>([]);
  const [rawMembers, setRawMembers] = useState<TeamMemberAPI[]>([]);
  const { subscription } = useSubscription();
  const { isDark } = useTheme();
  const teamsColors = getTeamsColors(isDark);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  // Fetch team members from API
  const fetchTeamMembers = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await axios.get<TeamMemberAPI[]>(API_ENDPOINTS.TEAM.MEMBERS, {
        headers: getAuthHeaders(accessToken),
      });
      const members = response.data;
      setRawMembers(members);
      setTeamMembers(members.map(mapToListData));
    } catch (error: any) {
      logger.error('[Team] Failed to fetch team members', error);
      if (!refreshing) {
        Alert.alert('Error', 'Unable to load team members. Pull down to retry.');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTeamMembers();
    }, [fetchTeamMembers])
  );

  // Log screen view
  React.useEffect(() => {
    logger.info('Team screen viewed (Teams style)', {
      tier: subscription?.tier,
      totalMembers: teamMembers.length,
    });
  }, [subscription, teamMembers.length]);

  // Filter members by search query and filter option
  const filteredMembers = useMemo(() => {
    let members = teamMembers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      members = members.filter(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query) ||
          member.currentVenue?.toLowerCase().includes(query)
      );
    }

    if (selectedFilter === 'available') {
      members = members.filter((m) => m.presenceStatus === 'available');
    } else if (selectedFilter === 'offline') {
      members = members.filter((m) => m.presenceStatus === 'offline');
    } else if (selectedFilter !== 'all') {
      members = members.filter((m) => m.presenceStatus === selectedFilter);
    }

    return members;
  }, [teamMembers, searchQuery, selectedFilter]);

  // Group members by section
  const groupedMembers = useMemo(() => {
    return {
      onShift: filteredMembers.filter((m) => m.presenceStatus === 'available'),
      offline: filteredMembers.filter((m) => m.presenceStatus === 'offline'),
    };
  }, [filteredMembers]);

  // Calculate stats from real data
  const stats = useMemo(() => {
    const onShiftMembers = rawMembers.filter((m) => m.is_on_shift);
    const venues = new Set(
      onShiftMembers
        .map((m) => m.active_shift?.venue_name)
        .filter(Boolean)
    );

    return {
      activeCount: onShiftMembers.length,
      totalCount: rawMembers.length,
      venuesCount: venues.size,
    };
  }, [rawMembers]);

  // Handle pull to refresh
  const handleRefresh = async () => {
    logger.info('Refreshing team list');
    setRefreshing(true);
    await fetchTeamMembers();
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

    const actions: any[] = [{ text: 'Cancel', style: 'cancel' }];

    actions.push({
      text: 'View Profile',
      onPress: () => logger.info('View profile pressed', { memberId: member.id }),
    });

    Alert.alert(
      member.name,
      `${member.role}${member.currentVenue ? `\nVenue: ${member.currentVenue}` : ''}`,
      actions
    );
  };

  // Handle quick action on member card
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
        Alert.alert('Venues', `Currently covering ${stats.venuesCount} venue${stats.venuesCount !== 1 ? 's' : ''}`);
        break;
      case 'total':
        setSelectedFilter('all');
        break;
    }
  };

  // Render loading state
  if (loading && teamMembers.length === 0) {
    return (
      <Container scrollable={false} safeArea={false} style={{ padding: 0, backgroundColor: teamsColors.background.secondary }}>
        <View style={[styles.container, styles.loadingContainer, { backgroundColor: teamsColors.background.secondary }]}>
          <ActivityIndicator size="large" color={teamsColors.primary} />
          <Body style={{ color: teamsColors.text.secondary, marginTop: spacing.md }}>Loading team...</Body>
        </View>
      </Container>
    );
  }

  // Render empty state
  const renderEmptyState = () => (
    <Card variant="flat" padding="xl" style={[styles.emptyState, { backgroundColor: teamsColors.background.primary }]}>
      <Ionicons name="people-outline" size={64} color={teamsColors.text.tertiary} style={styles.emptyIcon} />
      <Body style={[styles.emptyText, { color: teamsColors.text.secondary }]}>
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
          isDark={isDark}
        />
        {!isCollapsed &&
          members.map((member) => (
            <TeamMemberListCard
              key={member.id}
              member={member}
              onPress={() => handleMemberPress(member)}
              onChatPress={() => handleChatPress(member)}
              onVideoPress={() => handleVideoPress(member)}
              onMorePress={() => handleMorePress(member)}
              isDark={isDark}
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
      <View style={[styles.container, { backgroundColor: teamsColors.background.secondary }]}>
        {/* Header with Search and Filters */}
        <TeamHeader
          title="Team"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          isDark={isDark}
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
            isDark={isDark}
          />

          {/* Quick Actions */}
          <TeamQuickActions
            onChatPress={handleTeamChatPress}
            onBroadcastPress={handleBroadcastPress}
            onEmergencyPress={handleEmergencyPress}
            onSharePress={handleSharePress}
            isDark={isDark}
          />

          {/* Team Members List (Grouped) */}
          {filteredMembers.length > 0 ? (
            <View style={styles.listContainer}>
              {renderSection('On Shift', groupedMembers.onShift, 'shield-checkmark', 'onShift')}
              {renderSection('Off Duty', groupedMembers.offline, 'ellipse-outline', 'offline')}
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
  },
  bottomSpacer: {
    height: spacing['3xl'],
  },
});
