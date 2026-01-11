import React from 'react';
import { ComboBox, type IComboBoxOption, IconButton } from '@fluentui/react';
import type { Venue, StaffProfile } from '../../../../types';
import { THEME } from '../types';

interface FilterBarProps {
  venues: Venue[];
  staff: StaffProfile[];
  venueFilter: string | null;
  staffFilter: string | null;
  onVenueFilterChange: (venueId: string | null) => void;
  onStaffFilterChange: (staffId: string | null) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  venues,
  staff,
  venueFilter,
  staffFilter,
  onVenueFilterChange,
  onStaffFilterChange,
  onClearFilters,
  hasActiveFilters
}) => {
  // Venue options
  const venueOptions: IComboBoxOption[] = [
    { key: '', text: 'All Venues' },
    ...venues.map((venue) => ({
      key: venue.id?.toString() || '',
      text: venue.name
    }))
  ];

  // Staff options
  const staffOptions: IComboBoxOption[] = [
    { key: '', text: 'All Staff' },
    { key: 'open', text: 'Open Shifts Only' },
    ...staff.map((s) => ({
      key: s.id?.toString() || '',
      text: `${s.firstName} ${s.lastName}`
    }))
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        flexWrap: 'wrap'
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: THEME.text.secondary
        }}
      >
        Filters:
      </span>

      {/* Venue filter */}
      <ComboBox
        placeholder="All Venues"
        options={venueOptions}
        selectedKey={venueFilter || ''}
        onChange={(_, option) => {
          onVenueFilterChange(option?.key === '' ? null : (option?.key as string) || null);
        }}
        styles={{
          root: {
            width: '180px'
          },
          input: {
            fontSize: '13px'
          },
          container: {
            borderRadius: '6px'
          }
        }}
        allowFreeform={false}
        autoComplete="on"
      />

      {/* Staff filter */}
      <ComboBox
        placeholder="All Staff"
        options={staffOptions}
        selectedKey={staffFilter || ''}
        onChange={(_, option) => {
          onStaffFilterChange(option?.key === '' ? null : (option?.key as string) || null);
        }}
        styles={{
          root: {
            width: '180px'
          },
          input: {
            fontSize: '13px'
          },
          container: {
            borderRadius: '6px'
          }
        }}
        allowFreeform={false}
        autoComplete="on"
      />

      {/* Clear filters button */}
      {hasActiveFilters && (
        <IconButton
          iconProps={{ iconName: 'ClearFilter' }}
          onClick={onClearFilters}
          title="Clear filters"
          styles={{
            root: {
              backgroundColor: THEME.primaryLight,
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              ':hover': {
                backgroundColor: THEME.primary
              }
            },
            icon: {
              color: THEME.primary,
              fontSize: '14px'
            },
            rootHovered: {
              '& .ms-Button-icon': {
                color: 'white'
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default FilterBar;
