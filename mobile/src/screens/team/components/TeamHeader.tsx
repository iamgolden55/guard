/**
 * TeamHeader Component
 * Microsoft Teams-style header with search and filter chips
 */

import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Heading2, BodySmall } from '@components/ui';
import { getTeamsColors } from '../../../theme/teamsColors';
import { spacing, layout } from '../../../theme';

export type FilterOption = 'all' | 'available' | 'busy' | 'away' | 'offline';

interface TeamHeaderProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFilter?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
  isDark?: boolean;
}

export const TeamHeader: React.FC<TeamHeaderProps> = ({
  title,
  searchQuery,
  onSearchChange,
  selectedFilter = 'all',
  onFilterChange,
  isDark = false,
}) => {
  const teamsColors = getTeamsColors(isDark);
  const filters: { value: FilterOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'all', label: 'All', icon: 'people' },
    { value: 'available', label: 'Available', icon: 'checkmark-circle' },
    { value: 'busy', label: 'Busy', icon: 'remove-circle' },
    { value: 'away', label: 'Away', icon: 'time' },
    { value: 'offline', label: 'Offline', icon: 'ellipse-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: teamsColors.background.primary, borderBottomColor: teamsColors.border.light }]}>
      <Heading2 style={[styles.title, { color: teamsColors.text.primary }]}>{title}</Heading2>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: teamsColors.background.secondary, borderColor: teamsColors.border.light }]}>
        <Ionicons name="search" size={20} color={teamsColors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: teamsColors.text.primary }]}
          placeholder="Search by name, role, or venue..."
          placeholderTextColor={teamsColors.text.tertiary}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={teamsColors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      {onFilterChange && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterChip,
                { backgroundColor: teamsColors.background.tertiary, borderColor: teamsColors.border.medium },
                selectedFilter === filter.value && { backgroundColor: teamsColors.primary, borderColor: teamsColors.primary },
              ]}
              onPress={() => onFilterChange(filter.value)}
            >
              <Ionicons
                name={filter.icon}
                size={16}
                color={
                  selectedFilter === filter.value
                    ? teamsColors.white
                    : teamsColors.text.secondary
                }
                style={styles.filterIcon}
              />
              <BodySmall
                style={[
                  styles.filterText,
                  { color: teamsColors.text.secondary },
                  selectedFilter === filter.value && { color: teamsColors.white, fontWeight: '600' },
                ]}
              >
                {filter.label}
              </BodySmall>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    padding: spacing.xs,
  },
  filtersScroll: {
    marginTop: spacing.md,
  },
  filtersContent: {
    paddingBottom: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterIcon: {
    marginRight: spacing.xs,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
