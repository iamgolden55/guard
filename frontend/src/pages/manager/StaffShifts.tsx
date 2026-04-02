import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Header,
  Container,
  CloudscapeTable,
  StatusIndicator,
  EmptyState,
  ConfirmationModal,
  SpaceBetween,
  Alert,
  ExpandableSection,
  Pagination,
} from '../../components/cloudscape';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { ShiftStatus } from '../../types';
import { shiftService } from '../../services';

interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface VenueCheckSummary {
  fireExitChecks: number;
  capacityChecks: number;
  toiletChecks: number;
  totalChecks: number;
  criticalIssues: number;
}

interface Shift {
  id: number;
  staff: Staff;
  venue: {
    id: number;
    name: string;
    requiresFireSafetyChecks?: boolean;
    requiresCapacityMonitoring?: boolean;
    requiresToiletChecks?: boolean;
  };
  startTime: string;
  endTime: string | null;
  duration: number | null; // in hours
  status: ShiftStatus;
  managerApproved: boolean;
  venueChecks?: VenueCheckSummary;
  checkInTime?: string;
  checkOutTime?: string;
}

// Pagination interface
interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

const getStatusIndicatorType = (status: ShiftStatus) => {
  switch (status) {
    case ShiftStatus.ACTIVE:
      return 'in-progress' as const;
    case ShiftStatus.COMPLETED:
      return 'warning' as const;
    case ShiftStatus.APPROVED:
      return 'success' as const;
    case ShiftStatus.REJECTED:
      return 'error' as const;
    default:
      return 'stopped' as const;
  }
};

const StaffShifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [venueFilter, setVenueFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [venueOptions, setVenueOptions] = useState<{ key: string; text: string }[]>([{ key: '', text: 'All Venues' }]);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('excel');
  const [expandedShifts, setExpandedShifts] = useState<Set<number>>(new Set());
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  });

  // Status filter options
  const statusOptions = [
    { key: '', text: 'All Statuses' },
    { key: ShiftStatus.ACTIVE, text: 'Active' },
    { key: ShiftStatus.COMPLETED, text: 'Completed' },
    { key: ShiftStatus.APPROVED, text: 'Approved' },
    { key: ShiftStatus.REJECTED, text: 'Rejected' },
  ];

  // Column definitions for CloudscapeTable
  const columnDefinitions: ColumnDefinition<Shift>[] = [
    {
      id: 'expand',
      header: '',
      width: 40,
      cell: (item: Shift) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleShiftExpansion(item.id); }}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedShifts.has(item.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ),
    },
    {
      id: 'id',
      header: 'ID',
      width: 60,
      sortingField: 'id',
      cell: (item: Shift) => <span className="font-medium text-gray-900">#{item.id}</span>,
    },
    {
      id: 'staff',
      header: 'Staff Member',
      minWidth: 150,
      sortingField: 'staff',
      cell: (item: Shift) => `${item.staff.firstName} ${item.staff.lastName}`,
    },
    {
      id: 'venue',
      header: 'Venue',
      minWidth: 120,
      sortingField: 'venue',
      cell: (item: Shift) => item.venue.name,
    },
    {
      id: 'startTime',
      header: 'Start Time',
      minWidth: 140,
      sortingField: 'startTime',
      cell: (item: Shift) => new Date(item.startTime).toLocaleString(),
    },
    {
      id: 'endTime',
      header: 'End Time',
      minWidth: 140,
      cell: (item: Shift) => item.endTime ? new Date(item.endTime).toLocaleString() : '-',
    },
    {
      id: 'duration',
      header: 'Duration',
      width: 90,
      cell: (item: Shift) => item.duration ? `${item.duration.toFixed(2)} hrs` : '-',
    },
    {
      id: 'status',
      header: 'Status',
      width: 120,
      cell: (item: Shift) => (
        <StatusIndicator type={getStatusIndicatorType(item.status)}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </StatusIndicator>
      ),
    },
    {
      id: 'approved',
      header: 'Approval',
      width: 110,
      cell: (item: Shift) => (
        item.managerApproved
          ? <StatusIndicator type="success">Approved</StatusIndicator>
          : <StatusIndicator type="pending">Pending</StatusIndicator>
      ),
    },
    {
      id: 'venueChecks',
      header: 'Venue Checks',
      width: 130,
      cell: (item: Shift) => (
        <div className="flex flex-col gap-0.5">
          {item.venueChecks ? (
            <>
              <span className="text-sm font-semibold">{item.venueChecks.totalChecks} Total</span>
              {item.venueChecks.criticalIssues > 0 && (
                <span className="text-xs font-semibold text-red-600">
                  {item.venueChecks.criticalIssues} Issues
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 130,
      cell: (item: Shift) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewShift(item.id)}
            className="text-sm text-red-600 hover:text-red-700 hover:underline font-medium"
          >
            View
          </button>
          {(item.venueChecks?.totalChecks || 0) > 0 && (
            <button
              onClick={() => handleViewChecks(item.id)}
              className="text-sm text-red-600 hover:text-red-700 hover:underline font-medium"
            >
              Checks
            </button>
          )}
          {item.status === ShiftStatus.COMPLETED && !item.managerApproved && (
            <button
              onClick={() => handleApproveShift(item.id)}
              className="text-sm text-green-600 hover:text-green-700 hover:underline font-medium"
            >
              Approve
            </button>
          )}
        </div>
      ),
    },
  ];

  // Load shifts from API with venue check summaries
  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all shifts for manager view
      const shiftsData = await shiftService.getAllShiftsForManager();

      // Transform the data to include venue check summaries
      const transformedShifts: Shift[] = shiftsData.map((shift: any) => ({
        id: shift.id,
        staff: {
          id: shift.staff_details?.id || shift.staff_user,
          firstName: shift.staff_details?.first_name || 'Unknown',
          lastName: shift.staff_details?.last_name || 'User',
          email: shift.staff_details?.email || ''
        },
        venue: {
          id: shift.venue_details?.id || shift.venue,
          name: shift.venue_details?.name || 'Unknown Venue',
          requiresFireSafetyChecks: shift.venue_details?.requires_fire_safety_checks,
          requiresCapacityMonitoring: shift.venue_details?.requires_capacity_monitoring,
          requiresToiletChecks: shift.venue_details?.requires_toilet_checks
        },
        startTime: shift.start_time,
        endTime: shift.end_time,
        duration: shift.duration_hours,
        status: shift.status,
        managerApproved: shift.manager_approved || false,
        checkInTime: shift.check_in_time,
        checkOutTime: shift.check_out_time,
        venueChecks: shift.venue_checks_summary || {
          fireExitChecks: 0,
          capacityChecks: 0,
          toiletChecks: 0,
          totalChecks: 0,
          criticalIssues: 0
        }
      }));

      // Extract unique venues for the filter dropdown
      const venues = Array.from(new Set(transformedShifts.map(shift => shift.venue.id))).map(venueId => {
        const venue = transformedShifts.find(shift => shift.venue.id === venueId)?.venue;
        return { key: venueId.toString(), text: venue?.name || '' };
      });

      setVenueOptions([{ key: '', text: 'All Venues' }, ...venues]);
      setShifts(transformedShifts);
      setFilteredShifts(transformedShifts);
    } catch (error) {
      console.error('Failed to load shifts:', error);
      setError('Failed to load shifts. Please try again later.');

      // Fallback to empty array instead of showing mock data
      setShifts([]);
      setFilteredShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleViewShift = useCallback((shiftId: number) => {
    navigate(`/shifts/${shiftId}`);
  }, [navigate]);

  const handleApproveShift = useCallback((shiftId: number) => {
    navigate(`/approvals/${shiftId}`);
  }, [navigate]);

  const handleViewChecks = useCallback((shiftId: number) => {
    navigate(`/shifts/${shiftId}/checks`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadShifts();
  }, [loadShifts]);

  const handleApplyFilters = useCallback(() => {
    setShowFiltersDialog(false);
    // Filters are already applied in useEffect
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setStatusFilter('');
    setVenueFilter('');
    setStartDate('');
    setEndDate('');
    setShowFiltersDialog(false);
  }, []);

  const handleExport = useCallback(() => {
    try {
      if (exportFormat === 'excel') {
        exportToExcel(filteredShifts);
      } else if (exportFormat === 'csv') {
        exportToCSV(filteredShifts);
      }
      setShowExportDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Export failed. Please try again.');
    }
  }, [exportFormat, filteredShifts]);

  const exportToExcel = (data: Shift[]) => {
    // Create Excel-compatible data
    const excelData = data.map(shift => ({
      'Shift ID': shift.id,
      'Staff Name': `${shift.staff.firstName} ${shift.staff.lastName}`,
      'Staff Email': shift.staff.email,
      'Venue': shift.venue.name,
      'Start Time': new Date(shift.startTime).toLocaleString(),
      'End Time': shift.endTime ? new Date(shift.endTime).toLocaleString() : '-',
      'Check In': shift.checkInTime ? new Date(shift.checkInTime).toLocaleString() : '-',
      'Check Out': shift.checkOutTime ? new Date(shift.checkOutTime).toLocaleString() : '-',
      'Duration (Hours)': shift.duration || '-',
      'Status': shift.status.toUpperCase(),
      'Manager Approved': shift.managerApproved ? 'Yes' : 'No',
      'Fire Exit Checks': shift.venueChecks?.fireExitChecks || 0,
      'Capacity Checks': shift.venueChecks?.capacityChecks || 0,
      'Toilet Checks': shift.venueChecks?.toiletChecks || 0,
      'Total Checks': shift.venueChecks?.totalChecks || 0,
      'Critical Issues': shift.venueChecks?.criticalIssues || 0
    }));

    // Create CSV content
    const headers = Object.keys(excelData[0] || {});
    const csvContent = [
      headers.join(','),
      ...excelData.map(row =>
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Download as Excel file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `staff-shifts-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToCSV = (data: Shift[]) => {
    // Use the same logic as Excel export for now
    exportToExcel(data);
  };

  const toggleShiftExpansion = useCallback((shiftId: number) => {
    setExpandedShifts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shiftId)) {
        newSet.delete(shiftId);
      } else {
        newSet.add(shiftId);
      }
      return newSet;
    });
  }, []);

  // Pagination functions
  const getPaginatedShifts = () => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;

    return {
      items: filteredShifts.slice(startIndex, endIndex),
      totalItems: filteredShifts.length,
      totalPages: Math.ceil(filteredShifts.length / pagination.itemsPerPage)
    };
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };

  // Apply filters when search text or status filter changes
  useEffect(() => {
    let result = shifts;

    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      result = result.filter(shift =>
        `${shift.staff.firstName} ${shift.staff.lastName}`.toLowerCase().includes(lowerCaseSearch) ||
        shift.venue.name.toLowerCase().includes(lowerCaseSearch) ||
        shift.id.toString().includes(lowerCaseSearch)
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(shift => shift.status === statusFilter);
    }

    // Apply venue filter
    if (venueFilter) {
      result = result.filter(shift => shift.venue.id.toString() === venueFilter);
    }

    // Apply date range filters
    if (startDate) {
      const startDateTime = new Date(startDate);
      result = result.filter(shift => new Date(shift.startTime) >= startDateTime);
    }

    if (endDate) {
      // Add one day to include the entire end date
      const endDateTime = new Date(endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      result = result.filter(shift => new Date(shift.startTime) <= endDateTime);
    }

    setFilteredShifts(result);

    // Reset pagination when filters change
    setPagination(prev => ({
      ...prev,
      currentPage: 1,
      totalItems: result.length
    }));
  }, [searchText, statusFilter, venueFilter, startDate, endDate, shifts]);

  // Load shifts when component mounts
  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const paginatedData = getPaginatedShifts();

  // Build items with expansion rows
  const tableItems = paginatedData.items;

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowFiltersDialog(true)}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Advanced Filters
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Export
            </button>
          </div>
        }
      >
        Staff Shifts
      </Header>

      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Active filters display */}
      {(statusFilter || venueFilter || startDate || endDate) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          {statusFilter && (
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">
              Status: {statusOptions.find(option => option.key === statusFilter)?.text}
            </span>
          )}
          {venueFilter && (
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">
              Venue: {venueOptions.find(option => option.key === venueFilter)?.text}
            </span>
          )}
          {startDate && (
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">
              From: {new Date(startDate).toLocaleDateString()}
            </span>
          )}
          {endDate && (
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">
              To: {new Date(endDate).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={handleClearFilters}
            className="text-sm text-red-600 hover:text-red-700 hover:underline font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      <CloudscapeTable<Shift>
        items={tableItems}
        columnDefinitions={columnDefinitions}
        loading={isLoading}
        loadingText="Loading shifts..."
        trackBy="id"
        stripedRows
        wrapLines
        header={
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by staff name or venue..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent sm:w-48"
            >
              {statusOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.text}</option>
              ))}
            </select>
          </div>
        }
        empty={
          <EmptyState
            title="No shifts found"
            description="Try adjusting your search criteria."
            variant="no-match"
          />
        }
        pagination={
          paginatedData.totalPages > 1 ? (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={paginatedData.totalPages}
              onPageChange={handlePageChange}
              totalItems={filteredShifts.length}
            />
          ) : undefined
        }
        cardDefinition={{
          header: (item: Shift) => (
            <div className="flex items-center justify-between w-full">
              <span>#{item.id} - {item.staff.firstName} {item.staff.lastName}</span>
              <StatusIndicator type={getStatusIndicatorType(item.status)}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </StatusIndicator>
            </div>
          ),
          sections: [
            {
              id: 'venue',
              header: 'Venue',
              content: (item: Shift) => item.venue.name,
            },
            {
              id: 'time',
              header: 'Start Time',
              content: (item: Shift) => new Date(item.startTime).toLocaleString(),
            },
            {
              id: 'duration',
              header: 'Duration',
              content: (item: Shift) => item.duration ? `${item.duration.toFixed(1)}h` : '-',
            },
            {
              id: 'approval',
              header: 'Approval',
              content: (item: Shift) => (
                item.managerApproved
                  ? <StatusIndicator type="success">Approved</StatusIndicator>
                  : <StatusIndicator type="pending">Pending</StatusIndicator>
              ),
            },
            {
              id: 'actions',
              header: 'Actions',
              content: (item: Shift) => (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleViewShift(item.id)}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    View
                  </button>
                  {(item.venueChecks?.totalChecks || 0) > 0 && (
                    <button
                      onClick={() => handleViewChecks(item.id)}
                      className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Checks
                    </button>
                  )}
                  {item.status === ShiftStatus.COMPLETED && !item.managerApproved && (
                    <button
                      onClick={() => handleApproveShift(item.id)}
                      className="px-4 h-9 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                </div>
              ),
            },
          ],
        }}
      />

      {/* Expanded shift details rendered below the table */}
      {tableItems.filter(s => expandedShifts.has(s.id)).map(shift => (
        <Container key={`expanded-${shift.id}`} header={
          <Header variant="h3">
            Shift #{shift.id} Details &amp; Venue Check History
          </Header>
        }>
          <ShiftDetailsExpanded shift={shift} />
        </Container>
      ))}

      {/* Advanced Filters Modal */}
      <ConfirmationModal
        visible={showFiltersDialog}
        header="Advanced Filters"
        confirmLabel="Apply"
        cancelLabel="Cancel"
        onConfirm={handleApplyFilters}
        onCancel={() => setShowFiltersDialog(false)}
      >
        <SpaceBetween size="m">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Staff name, venue, or shift ID"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {statusOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.text}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {venueOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.text}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleClearFilters}
            className="text-sm text-red-600 hover:text-red-700 hover:underline font-medium"
          >
            Clear all filters
          </button>
        </SpaceBetween>
      </ConfirmationModal>

      {/* Export Modal */}
      <ConfirmationModal
        visible={showExportDialog}
        header="Export Shift Data"
        confirmLabel="Export"
        cancelLabel="Cancel"
        onConfirm={handleExport}
        onCancel={() => setShowExportDialog(false)}
      >
        <SpaceBetween size="m">
          <p className="text-sm text-gray-600">
            Export {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''} with venue check data
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="excel">Excel/CSV (.csv)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>

          <p className="text-xs text-gray-500 italic">
            Export includes: Shift details, staff information, venue data, check summaries, and compliance status
          </p>
        </SpaceBetween>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

// Expanded Shift Details Component
interface ShiftDetailsExpandedProps {
  shift: Shift;
}

const ShiftDetailsExpanded: React.FC<ShiftDetailsExpandedProps> = ({ shift }) => {
  const [checkDetails, setCheckDetails] = useState<{
    fireChecks: any[];
    capacityChecks: any[];
    toiletChecks: any[];
    loading: boolean;
  }>({
    fireChecks: [],
    capacityChecks: [],
    toiletChecks: [],
    loading: true
  });

  useEffect(() => {
    const loadCheckDetails = async () => {
      try {
        setCheckDetails(prev => ({ ...prev, loading: true }));

        const [fireChecks, capacityChecks, toiletChecks] = await Promise.all([
          shiftService.getFireExitChecks(shift.id).catch(() => []),
          shiftService.getCapacityChecks(shift.id).catch(() => []),
          shiftService.getToiletChecks(shift.id).catch(() => [])
        ]);

        setCheckDetails({
          fireChecks,
          capacityChecks,
          toiletChecks,
          loading: false
        });
      } catch (error) {
        console.error('Failed to load check details:', error);
        setCheckDetails(prev => ({ ...prev, loading: false }));
      }
    };

    loadCheckDetails();
  }, [shift.id]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-GB');
  };

  return (
    <SpaceBetween size="m">
      {/* Shift Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2">Shift Information</h4>
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>Staff: {`${shift.staff.firstName} ${shift.staff.lastName}`}</p>
            <p>Email: {shift.staff.email}</p>
            <p>Venue: {shift.venue.name}</p>
            <p>Status: {shift.status.toUpperCase()}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2">Timing</h4>
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>Scheduled: {new Date(shift.startTime).toLocaleString()}</p>
            {shift.checkInTime && (
              <p>Checked In: {new Date(shift.checkInTime).toLocaleString()}</p>
            )}
            {shift.checkOutTime && (
              <p>Checked Out: {new Date(shift.checkOutTime).toLocaleString()}</p>
            )}
            {shift.duration && (
              <p>Duration: {shift.duration.toFixed(2)} hours</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-red-700 mb-2">Venue Requirements</h4>
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>
              Fire Safety: {shift.venue.requiresFireSafetyChecks
                ? <StatusIndicator type="success">Required</StatusIndicator>
                : <StatusIndicator type="stopped">Not Required</StatusIndicator>
              }
            </p>
            <p>
              Capacity: {shift.venue.requiresCapacityMonitoring
                ? <StatusIndicator type="success">Required</StatusIndicator>
                : <StatusIndicator type="stopped">Not Required</StatusIndicator>
              }
            </p>
            <p>
              Toilets: {shift.venue.requiresToiletChecks
                ? <StatusIndicator type="success">Required</StatusIndicator>
                : <StatusIndicator type="stopped">Not Required</StatusIndicator>
              }
            </p>
          </div>
        </div>
      </div>

      {/* Check Details */}
      {checkDetails.loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-2 text-sm text-gray-500">Loading check details...</span>
        </div>
      ) : (
        <SpaceBetween size="m">
          {/* Fire Exit Checks */}
          {checkDetails.fireChecks.length > 0 && (
            <ExpandableSection
              headerText={`Fire Exit Checks (${checkDetails.fireChecks.length})`}
              defaultExpanded
              variant="container"
            >
              <div className="space-y-2">
                {checkDetails.fireChecks.map((check: any) => (
                  <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{check.exitName}</p>
                      <p className="text-xs text-gray-500">{formatDate(check.timestamp)} at {formatTime(check.timestamp)}</p>
                      {check.comments && <p className="text-xs text-gray-600 mt-1">{check.comments}</p>}
                    </div>
                    <StatusIndicator type={check.isPassed ? 'success' : 'error'}>
                      {check.isPassed ? 'Clear' : 'Blocked'}
                    </StatusIndicator>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Capacity Checks */}
          {checkDetails.capacityChecks.length > 0 && (
            <ExpandableSection
              headerText={`Capacity Checks (${checkDetails.capacityChecks.length})`}
              defaultExpanded
              variant="container"
            >
              <div className="space-y-2">
                {checkDetails.capacityChecks.map((check: any, index: number) => (
                  <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Count: {check.count} people</p>
                      <p className="text-xs text-gray-500">{formatDate(check.timestamp)} at {formatTime(check.timestamp)}</p>
                      {check.comments && <p className="text-xs text-gray-600 mt-1">{check.comments}</p>}
                    </div>
                    <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* Toilet Checks */}
          {checkDetails.toiletChecks.length > 0 && (
            <ExpandableSection
              headerText={`Toilet Checks (${checkDetails.toiletChecks.length})`}
              defaultExpanded
              variant="container"
            >
              <div className="space-y-2">
                {checkDetails.toiletChecks.map((check: any) => (
                  <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{check.location}</p>
                      <p className="text-xs text-gray-500">{formatDate(check.timestamp)} at {formatTime(check.timestamp)}</p>
                      {check.comments && <p className="text-xs text-gray-600 mt-1">{check.comments}</p>}
                    </div>
                    <StatusIndicator
                      type={
                        check.condition === 'excellent' || check.condition === 'good' ? 'success' :
                        check.condition === 'fair' ? 'warning' : 'error'
                      }
                    >
                      {check.condition}
                    </StatusIndicator>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          )}

          {/* No Checks Message */}
          {checkDetails.fireChecks.length === 0 &&
           checkDetails.capacityChecks.length === 0 &&
           checkDetails.toiletChecks.length === 0 && (
            <p className="text-sm text-gray-500 text-center italic py-4">
              No venue checks logged for this shift
            </p>
          )}
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};

export default StaffShifts;
