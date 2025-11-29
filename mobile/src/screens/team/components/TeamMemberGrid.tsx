/**
 * TeamMemberGrid Component
 * 2-column grid layout for team members
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TeamMemberGridCard, TeamMemberGridData } from './TeamMemberGridCard';
import { spacing } from '../../../theme';

interface TeamMemberGridProps {
  members: TeamMemberGridData[];
  onMemberPress: (member: TeamMemberGridData) => void;
  onMemberLongPress?: (member: TeamMemberGridData) => void;
}

export const TeamMemberGrid: React.FC<TeamMemberGridProps> = ({
  members,
  onMemberPress,
  onMemberLongPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {members.map((member, index) => (
          <TeamMemberGridCard
            key={member.id}
            member={member}
            onPress={() => onMemberPress(member)}
            onLongPress={() => onMemberLongPress?.(member)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
