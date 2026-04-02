// Violations List Component
// Filterable violations management for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  Button,
  Input,
  Select,
  Checkbox,
  Spinner,
  Text,
  Title3,
  Body1,
  Caption1,
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Textarea,
  Label,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  TableColumnDefinition,
  createTableColumn,
  TableCellLayout
} from '@fluentui/react-components';
import {
  Search24Regular,
  Filter24Regular,
  ArrowExport24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  MoreHorizontal24Regular
} from '@fluentui/react-icons';
import { formatDistanceToNow } from 'date-fns';

import {
  useComplianceViolations,
  useViolationResolution
} from '../../hooks/useComplianceData';
import { ComplianceStatusBadge } from '../shared/ComplianceStatusBadge';
import DateRangePicker from '../shared/DateRangePicker';
import type {
  ViolationsListProps,
  ComplianceViolation,
  ViolationFilters,
  ViolationResolution
} from '../../types/compliance';

export const ViolationsList: React.FC<ViolationsListProps> = ({
  filters: initialFilters = {},
  onViolationSelect,
  allowResolution = true,
  showBulkActions = true
}) => {
  const [filters, setFilters] = useState<ViolationFilters>(initialFilters);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedViolations, setSelectedViolations] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [resolutionData, setResolutionData] = useState<{
    violationIds: number[];
    notes: string;
    exceptionGranted: boolean;
    exceptionReason: string;
  }>({
    violationIds: [],
    notes: '',
    exceptionGranted: false,
    exceptionReason: ''
  });

  // API Hooks
  const {
    data: violationsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useComplianceViolations(filters);

  const {
    resolveSingle,
    resolveBulk,
    isSingleResolving,
    isBulkResolving
  } = useViolationResolution();

  // Flatten data from infinite query
  const violations = useMemo(() => {
    return violationsData?.pages?.flatMap(page => page.results) || [];
  }, [violationsData]);

  // Filter violations by search term
  const filteredViolations = useMemo(() => {
    const safeViolations = (violations || []).filter(Boolean);
    if (!searchTerm) return safeViolations;

    const term = searchTerm.toLowerCase();
    return safeViolations.filter(violation =>
      violation.description?.toLowerCase().includes(term) ||
      violation.user_data?.full_name?.toLowerCase().includes(term) ||
      violation.violation_type_display?.toLowerCase().includes(term) ||
      (violation.shift_data?.venue_name?.toLowerCase().includes(term))
    );
  }, [violations, searchTerm]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof ViolationFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
  }, []);

  // Handle bulk selection
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedViolations(new Set(filteredViolations.map(v => v.id)));
    } else {
      setSelectedViolations(new Set());
    }
  }, [filteredViolations]);

  const handleSelectViolation = useCallback((violationId: number, checked: boolean) => {
    setSelectedViolations(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(violationId);
      } else {
        newSet.delete(violationId);
      }
      return newSet;
    });
  }, []);

  // Handle resolution
  const handleResolveClick = useCallback((violationIds: number[]) => {
    setResolutionData({
      violationIds,
      notes: '',
      exceptionGranted: false,
      exceptionReason: ''
    });
    setResolutionDialogOpen(true);
  }, []);

  const handleResolutionSubmit = useCallback(() => {
    const resolution: ViolationResolution = {
      resolution_notes: resolutionData.notes,
      exception_granted: resolutionData.exceptionGranted,
      exception_reason: resolutionData.exceptionGranted ? resolutionData.exceptionReason : undefined
    };

    if (resolutionData.violationIds.length === 1) {
      resolveSingle({
        violationId: resolutionData.violationIds[0],
        resolution
      });
    } else {
      resolveBulk({
        violationIds: resolutionData.violationIds,
        resolution
      });
    }

    setResolutionDialogOpen(false);
    setSelectedViolations(new Set());
  }, [resolutionData, resolveSingle, resolveBulk]);

  // Export functionality
  const handleExport = useCallback(async () => {
    try {
      // This would integrate with the export API
      console.log('Exporting violations with filters:', filters);
      // const blob = await ComplianceService.exportViolations(filters);
      // downloadBlob(blob, 'violations.csv');
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [filters]);

  // Table columns definition
  const columns: TableColumnDefinition<ComplianceViolation>[] = [
    createTableColumn<ComplianceViolation>({
      columnId: "select",
      renderHeaderCell: () => (
        showBulkActions ? (
          <Checkbox
            checked={selectedViolations.size === filteredViolations.length && filteredViolations.length > 0}
            indeterminate={selectedViolations.size > 0 && selectedViolations.size < filteredViolations.length}
            onChange={(_, data) => handleSelectAll(data.checked === true)}
          />
        ) : null
      ),
      renderCell: (item) => (
        showBulkActions ? (
          <TableCellLayout>
            <Checkbox
              checked={selectedViolations.has(item.id)}
              onChange={(_, data) => handleSelectViolation(item.id, data.checked === true)}
            />
          </TableCellLayout>
        ) : null
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "severity",
      renderHeaderCell: () => "Severity",
      renderCell: (item) => (
        <TableCellLayout>
          <ComplianceStatusBadge status={item.severity} size="small" />
        </TableCellLayout>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "type",
      renderHeaderCell: () => "Type",
      renderCell: (item) => (
        <TableCellLayout>
          <Badge appearance="outline">
            {item.violation_type_display}
          </Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "staff",
      renderHeaderCell: () => "Staff Member",
      renderCell: (item) => (
        <TableCellLayout>
          <div>
            <Body1 className="font-medium">{item.user_data.full_name}</Body1>
            <Caption1 className="text-gray-600">{item.user_data.email}</Caption1>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "description",
      renderHeaderCell: () => "Description",
      renderCell: (item) => (
        <TableCellLayout>
          <div className="max-w-xs">
            <Body1 className="truncate">{item.description}</Body1>
            {item.shift_data && (
              <Caption1 className="text-gray-600">
                {item.shift_data.venue_name} • {new Date(item.shift_data.start_time).toLocaleDateString()}
              </Caption1>
            )}
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (item) => (
        <TableCellLayout>
          <Badge
            appearance={item.is_resolved ? "filled" : "outline"}
            color={item.is_resolved ? "success" : "warning"}
          >
            {item.resolution_status_display}
          </Badge>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "created",
      renderHeaderCell: () => "Detected",
      renderCell: (item) => (
        <TableCellLayout>
          <div>
            <Body1>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</Body1>
            <Caption1 className="text-gray-600">
              {new Date(item.created_at).toLocaleDateString()}
            </Caption1>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (item) => (
        <TableCellLayout>
          <div className="flex items-center gap-2">
            {allowResolution && !item.is_resolved && (
              <Button
                size="small"
                appearance="secondary"
                icon={<Checkmark24Regular />}
                onClick={() => handleResolveClick([item.id])}
                disabled={isSingleResolving}
              >
                Resolve
              </Button>
            )}
            <Button
              size="small"
              appearance="subtle"
              icon={<MoreHorizontal24Regular />}
              onClick={() => onViolationSelect?.(item)}
            >
              Details
            </Button>
          </div>
        </TableCellLayout>
      ),
    }),
  ];

  if (error) {
    return (
      <Card className="p-6 bg-red-50 border border-red-200">
        <div className="text-center">
          <Text className="text-red-800 font-medium mb-2">Failed to Load Violations</Text>
          <Body1 className="text-red-600">
            Unable to fetch violations data. Please try refreshing the page.
          </Body1>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Title3>Compliance Violations</Title3>
          <Caption1 className="text-gray-600">
            {filteredViolations.length} violations
            {selectedViolations.size > 0 && (
              <span> • {selectedViolations.size} selected</span>
            )}
          </Caption1>
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk Actions */}
          {showBulkActions && selectedViolations.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border">
              <Text className="text-sm font-medium">{selectedViolations.size} selected</Text>
              {allowResolution && (
                <Button
                  size="small"
                  appearance="primary"
                  onClick={() => handleResolveClick(Array.from(selectedViolations))}
                  disabled={isBulkResolving}
                >
                  Resolve All
                </Button>
              )}
            </div>
          )}

          <Button
            appearance="secondary"
            icon={<ArrowExport24Regular />}
            onClick={handleExport}
          >
            Export
          </Button>

          <Button
            appearance="secondary"
            icon={<Filter24Regular />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search24Regular className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search violations by description, staff name, or venue..."
              value={searchTerm}
              onChange={(_, data) => setSearchTerm(data.value)}
              className="pl-10 w-full"
            />
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="type-filter">Violation Type</Label>
                <Select
                  id="type-filter"
                  value={filters.violation_type?.[0] || ''}
                  onChange={(_, data) =>
                    handleFilterChange('violation_type', data.value ? [data.value] : undefined)
                  }
                  className="w-full"
                >
                  <option value="">All Types</option>
                  <option value="daily_overtime">Daily Overtime</option>
                  <option value="weekly_overtime">Weekly Overtime</option>
                  <option value="consecutive_days">Consecutive Days</option>
                  <option value="insufficient_rest">Insufficient Rest</option>
                  <option value="missing_break">Missing Break</option>
                  <option value="location_violation">Location Violation</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="severity-filter">Severity</Label>
                <Select
                  id="severity-filter"
                  value={filters.severity?.[0] || ''}
                  onChange={(_, data) =>
                    handleFilterChange('severity', data.value ? [data.value] : undefined)
                  }
                  className="w-full"
                >
                  <option value="">All Severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select
                  id="status-filter"
                  value={filters.status?.[0] || ''}
                  onChange={(_, data) =>
                    handleFilterChange('status', data.value ? [data.value] : undefined)
                  }
                  className="w-full"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="investigating">Investigating</option>
                  <option value="dismissed">Dismissed</option>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Date Range</Label>
                <DateRangePicker
                  value={filters.start_date && filters.end_date ? [
                    new Date(filters.start_date),
                    new Date(filters.end_date)
                  ] : null}
                  onChange={(range) => {
                    handleFilterChange('start_date', range?.[0]?.toISOString());
                    handleFilterChange('end_date', range?.[1]?.toISOString());
                  }}
                  className="w-full"
                />
              </div>

              <div className="flex items-end">
                <Button
                  appearance="secondary"
                  onClick={clearFilters}
                  icon={<Dismiss24Regular />}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Violations Table */}
      <Card>
        {isLoading && !violations.length ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Spinner size="large" />
              <Text className="mt-4 block">Loading violations...</Text>
            </div>
          </div>
        ) : (
          <div>
            <DataGrid
              items={filteredViolations}
              columns={columns}
              sortable
              getRowId={(item) => item?.id ?? ''}
            >
              <DataGridHeader>
                <DataGridRow>
                  {({ renderHeaderCell }) => (
                    <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                  )}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<ComplianceViolation>>
                {({ item, rowId }) => (
                  <DataGridRow<ComplianceViolation> key={rowId}>
                    {({ renderCell }) => (
                      <DataGridCell>{renderCell(item)}</DataGridCell>
                    )}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>

            {/* Load More */}
            {hasNextPage && (
              <div className="p-4 text-center border-t">
                <Button
                  appearance="secondary"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Spinner size="small" /> : 'Load More'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={resolutionDialogOpen} onOpenChange={(_, data) => setResolutionDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              Resolve {resolutionData.violationIds.length === 1 ? 'Violation' : 'Violations'}
            </DialogTitle>
            <DialogContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resolution-notes" required>
                    Resolution Notes
                  </Label>
                  <Textarea
                    id="resolution-notes"
                    placeholder="Describe how this violation was resolved..."
                    value={resolutionData.notes}
                    onChange={(_, data) => setResolutionData(prev => ({ ...prev, notes: data.value }))}
                    rows={4}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Checkbox
                    checked={resolutionData.exceptionGranted}
                    onChange={(_, data) => setResolutionData(prev => ({
                      ...prev,
                      exceptionGranted: data.checked === true,
                      exceptionReason: data.checked ? prev.exceptionReason : ''
                    }))}
                    label="Grant exception for this violation"
                  />

                  {resolutionData.exceptionGranted && (
                    <div>
                      <Label htmlFor="exception-reason" required>
                        Exception Reason
                      </Label>
                      <Textarea
                        id="exception-reason"
                        placeholder="Explain why an exception is being granted..."
                        value={resolutionData.exceptionReason}
                        onChange={(_, data) => setResolutionData(prev => ({ ...prev, exceptionReason: data.value }))}
                        rows={3}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setResolutionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleResolutionSubmit}
                disabled={
                  !resolutionData.notes ||
                  (resolutionData.exceptionGranted && !resolutionData.exceptionReason) ||
                  isSingleResolving ||
                  isBulkResolving
                }
              >
                {isSingleResolving || isBulkResolving ? <Spinner size="small" /> : 'Resolve'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default ViolationsList;