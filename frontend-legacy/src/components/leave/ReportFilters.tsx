import React, { useState, useCallback } from 'react';
import {
  Stack,
  Text,
  TextField,
  Dropdown,
  IDropdownOption,
  DatePicker,
  Toggle,
  DefaultButton,
  PrimaryButton,
  IconButton,
  Callout,
  DirectionalHint,
  IStackTokens,
  Separator
} from '@fluentui/react';
import { LeaveType, LeaveRequestStatus, LeaveRequestFilterOptions } from '../../types/leave';

interface ReportFiltersProps {
  leaveTypes: LeaveType[];
  onFiltersChange: (filters: LeaveRequestFilterOptions) => void;
  onReset: () => void;
  initialFilters?: LeaveRequestFilterOptions;
  className?: string;
}

interface FilterState extends LeaveRequestFilterOptions {
  isAdvancedOpen: boolean;
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
};

const ReportFilters: React.FC<ReportFiltersProps> = ({
  leaveTypes,
  onFiltersChange,
  onReset,
  initialFilters = {},
  className = ''
}) => {
  const [filters, setFilters] = useState<FilterState>({
    ...initialFilters,
    isAdvancedOpen: false
  });
  const [isCalloutVisible, setIsCalloutVisible] = useState(false);
  const [calloutTarget, setCalloutTarget] = useState<HTMLElement | null>(null);

  // Dropdown options
  const statusOptions: IDropdownOption[] = [
    { key: LeaveRequestStatus.PENDING, text: 'Pending' },
    { key: LeaveRequestStatus.APPROVED, text: 'Approved' },
    { key: LeaveRequestStatus.REJECTED, text: 'Rejected' },
    { key: LeaveRequestStatus.CANCELLED, text: 'Cancelled' },
    { key: LeaveRequestStatus.WITHDRAWN, text: 'Withdrawn' }
  ];

  const leaveTypeOptions: IDropdownOption[] = leaveTypes.map(type => ({
    key: type.id,
    text: type.name
  }));

  const departmentOptions: IDropdownOption[] = [
    { key: 'security', text: 'Security' },
    { key: 'admin', text: 'Administration' },
    { key: 'management', text: 'Management' },
    { key: 'operations', text: 'Operations' }
  ];

  // Handle filter changes
  const handleFilterChange = useCallback((field: keyof LeaveRequestFilterOptions, value: any) => {
    const newFilters = {
      ...filters,
      [field]: value
    };
    setFilters(newFilters);

    // Remove the isAdvancedOpen property before passing to parent
    const { isAdvancedOpen, ...filterOptions } = newFilters;
    onFiltersChange(filterOptions);
  }, [filters, onFiltersChange]);

  // Handle array filter changes (for multi-select dropdowns)
  const handleArrayFilterChange = useCallback((field: keyof LeaveRequestFilterOptions, selectedKeys: (string | number)[]) => {
    const value = selectedKeys.length > 0 ? selectedKeys as number[] : undefined;
    handleFilterChange(field, value);
  }, [handleFilterChange]);

  // Reset all filters
  const handleReset = useCallback(() => {
    const resetFilters: FilterState = {
      isAdvancedOpen: false
    };
    setFilters(resetFilters);
    onReset();
  }, [onReset]);

  // Toggle advanced filters
  const toggleAdvancedFilters = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setCalloutTarget(event.currentTarget as HTMLElement);
    setIsCalloutVisible(!isCalloutVisible);
  }, [isCalloutVisible]);

  // Apply quick date range filters
  const applyDateRange = useCallback((range: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year') => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'this_week':
        const startOfWeek = now.getDate() - now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), startOfWeek);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    handleFilterChange('start_date', startDate.toISOString().split('T')[0]);
    handleFilterChange('end_date', endDate.toISOString().split('T')[0]);
  }, [handleFilterChange]);

  // Count active filters
  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof FilterState];
    return value !== undefined && value !== null && value !== '' &&
           (Array.isArray(value) ? value.length > 0 : true) &&
           key !== 'isAdvancedOpen';
  }).length;

  return (
    <div className={`report-filters bg-white p-4 border border-gray-200 rounded-lg ${className}`}>
      <Stack tokens={stackTokens}>
        {/* Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
            Report Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {activeFiltersCount} active
              </span>
            )}
          </Text>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <IconButton
              id="advanced-filters-button"
              iconProps={{ iconName: 'Settings' }}
              title="Advanced Filters"
              onClick={toggleAdvancedFilters}
            />
            <DefaultButton
              text="Reset"
              iconProps={{ iconName: 'ClearFilter' }}
              onClick={handleReset}
              disabled={activeFiltersCount === 0}
            />
          </Stack>
        </Stack>

        {/* Quick Date Range Filters */}
        <Stack>
          <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
            Quick Date Ranges
          </Text>
          <Stack horizontal wrap tokens={{ childrenGap: 8 }}>
            <DefaultButton
              text="Today"
              size="small"
              onClick={() => applyDateRange('today')}
            />
            <DefaultButton
              text="This Week"
              size="small"
              onClick={() => applyDateRange('this_week')}
            />
            <DefaultButton
              text="This Month"
              size="small"
              onClick={() => applyDateRange('this_month')}
            />
            <DefaultButton
              text="Last Month"
              size="small"
              onClick={() => applyDateRange('last_month')}
            />
            <DefaultButton
              text="This Year"
              size="small"
              onClick={() => applyDateRange('this_year')}
            />
          </Stack>
        </Stack>

        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <DatePicker
              label="Start Date"
              placeholder="Select start date"
              value={filters.start_date ? new Date(filters.start_date) : undefined}
              onSelectDate={(date) => handleFilterChange('start_date', date ? date.toISOString().split('T')[0] : undefined)}
            />
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <DatePicker
              label="End Date"
              placeholder="Select end date"
              value={filters.end_date ? new Date(filters.end_date) : undefined}
              onSelectDate={(date) => handleFilterChange('end_date', date ? date.toISOString().split('T')[0] : undefined)}
            />
          </Stack>

          <Dropdown
            label="Status"
            placeholder="Select status"
            multiSelect
            options={statusOptions}
            selectedKeys={filters.status || []}
            onChange={(_, option) => {
              if (option) {
                const currentStatus = filters.status || [];
                const newStatus = option.selected
                  ? [...currentStatus, option.key as LeaveRequestStatus]
                  : currentStatus.filter(status => status !== option.key);
                handleFilterChange('status', newStatus.length > 0 ? newStatus : undefined);
              }
            }}
          />

          <Dropdown
            label="Leave Type"
            placeholder="Select leave type"
            multiSelect
            options={leaveTypeOptions}
            selectedKeys={filters.leave_type?.map(String) || []}
            onChange={(_, option) => {
              if (option) {
                const currentTypes = filters.leave_type || [];
                const newTypes = option.selected
                  ? [...currentTypes, Number(option.key)]
                  : currentTypes.filter(type => type !== Number(option.key));
                handleFilterChange('leave_type', newTypes.length > 0 ? newTypes : undefined);
              }
            }}
          />
        </div>

        {/* Advanced Filters Callout */}
        {isCalloutVisible && (
          <Callout
            target={calloutTarget}
            onDismiss={() => setIsCalloutVisible(false)}
            directionalHint={DirectionalHint.bottomLeftEdge}
            isBeakVisible={true}
            gapSpace={10}
          >
            <div className="p-4 w-80">
              <Stack tokens={stackTokens}>
                <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
                  Advanced Filters
                </Text>

                <Separator />

                <Dropdown
                  label="Department"
                  placeholder="Select departments"
                  multiSelect
                  options={departmentOptions}
                  selectedKeys={filters.department || []}
                  onChange={(_, option) => {
                    if (option) {
                      const currentDepts = filters.department || [];
                      const newDepts = option.selected
                        ? [...currentDepts, option.key as string]
                        : currentDepts.filter(dept => dept !== option.key);
                      handleFilterChange('department', newDepts.length > 0 ? newDepts : undefined);
                    }
                  }}
                />

                <TextField
                  label="Employee Search"
                  placeholder="Search by name or email"
                  value={filters.user_search || ''}
                  onChange={(_, value) => handleFilterChange('user_search', value || undefined)}
                />

                <Stack horizontal horizontalAlign="end">
                  <PrimaryButton
                    text="Apply Filters"
                    onClick={() => setIsCalloutVisible(false)}
                  />
                </Stack>
              </Stack>
            </div>
          </Callout>
        )}

        {/* Active Filters Summary */}
        {activeFiltersCount > 0 && (
          <Stack>
            <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
              Active Filters
            </Text>
            <Stack horizontal wrap tokens={{ childrenGap: 8 }}>
              {filters.start_date && (
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  <span>From: {new Date(filters.start_date).toLocaleDateString()}</span>
                  <IconButton
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => handleFilterChange('start_date', undefined)}
                    styles={{ root: { width: 16, height: 16, minWidth: 16 } }}
                  />
                </div>
              )}

              {filters.end_date && (
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                  <span>To: {new Date(filters.end_date).toLocaleDateString()}</span>
                  <IconButton
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => handleFilterChange('end_date', undefined)}
                    styles={{ root: { width: 16, height: 16, minWidth: 16 } }}
                  />
                </div>
              )}

              {filters.status && filters.status.length > 0 && (
                <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                  <span>Status: {filters.status.join(', ')}</span>
                  <IconButton
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => handleFilterChange('status', undefined)}
                    styles={{ root: { width: 16, height: 16, minWidth: 16 } }}
                  />
                </div>
              )}

              {filters.leave_type && filters.leave_type.length > 0 && (
                <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm flex items-center gap-2">
                  <span>Types: {filters.leave_type.map(id => leaveTypes.find(lt => lt.id === id)?.name).join(', ')}</span>
                  <IconButton
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => handleFilterChange('leave_type', undefined)}
                    styles={{ root: { width: 16, height: 16, minWidth: 16 } }}
                  />
                </div>
              )}

              {filters.department && filters.department.length > 0 && (
                <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2">
                  <span>Dept: {filters.department.join(', ')}</span>
                  <IconButton
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => handleFilterChange('department', undefined)}
                    styles={{ root: { width: 16, height: 16, minWidth: 16 } }}
                  />
                </div>
              )}
            </Stack>
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export default ReportFilters;