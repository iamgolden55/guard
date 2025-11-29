/**
 * TeamHeader Component
 * Microsoft Teams-style header with search and filter chips
 */

import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Heading2, BodySmall } from '@components/ui';
import { teamsColors } from '../../../theme/teamsColors';
import { spacing, layout } from '../../../theme';

export type FilterOption = 'all' | 'available' | 'busy' | 'away' | 'offline';

interface TeamHeaderProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFilter?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
}

export const TeamHeader: React.FC<TeamHeaderProps> = ({
  title,
  searchQuery,
  onSearchChange,
  selectedFilter = 'all',
  onFilterChange,
}) => {
  const filters: { value: FilterOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'all', label: 'All', icon: 'people' },
    { value: 'available', label: 'Available', icon: 'checkmark-circle' },
    { value: 'busy', label: 'Busy', icon: 'remove-circle' },
    { value: 'away', label: 'Away', icon: 'time' },
    { value: 'offline', label: 'Offline', icon: 'ellipse-outline' },
  ];

  return (
    <View style={styles.container}>
      <Heading2 style={styles.title}>{title}</Heading2>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={teamsColors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
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
                selectedFilter === filter.value && styles.filterChipActive,
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
                  selectedFilter === filter.value && styles.filterTextActive,
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
    backgroundColor: teamsColors.white,
    borderBottomWidth: 1,
    borderBottomColor: teamsColors.border.light,
  },
  title: {
    marginBottom: spacing.md,
    color: teamsColors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: teamsColors.background.secondary,
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: teamsColors.border.light,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: teamsColors.text.primary,
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
    backgroundColor: teamsColors.background.tertiary,
    borderWidth: 1,
    borderColor: teamsColors.border.medium,
  },
  filterChipActive: {
    backgroundColor: teamsColors.primary,
    borderColor: teamsColors.primary,
  },
  filterIcon: {
    marginRight: spacing.xs,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: teamsColors.text.secondary,
  },
  filterTextActive: {
    color: teamsColors.white,
    fontWeight: '600',
  },
});
