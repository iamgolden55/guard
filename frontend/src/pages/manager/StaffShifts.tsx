import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  CommandBar,
  type ICommandBarItemProps,
  SearchBox,
  Dropdown,
  type IDropdownOption,
  Stack,
  Text,
  StackItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Link,
  DatePicker,
  DefaultButton,
  TextField,
  PrimaryButton,
  Dialog,
  DialogType,
  DialogFooter,
  Label
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp24Regular, ChevronDown24Regular, ChevronLeft24Regular, ChevronRight24Regular } from '@fluentui/react-icons';
import { MainLayout } from '../../layouts';
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

// Status indicator pill component
const StatusPill: React.FC<{status: ShiftStatus}> = ({ status }) => {
  let backgroundColor = '';
  let color = 'white';

  switch(status) {
    case ShiftStatus.ACTIVE:
      backgroundColor = '#10B981'; // Green
      break;
    case ShiftStatus.COMPLETED:
      backgroundColor = '#F59E0B'; // Yellow
      color = 'black';
      break;
    case ShiftStatus.APPROVED:
      backgroundColor = '#3B82F6'; // Blue
      break;
    case ShiftStatus.REJECTED:
      backgroundColor = '#EF4444'; // Red
      break;
    default:
      backgroundColor = '#9CA3AF'; // Gray
  }

  return (
    <div
      style={{
        backgroundColor,
        color,
        padding: '4px 8px',
        borderRadius: '12px',
        display: 'inline-block',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase'
      }}
    >
      {status}
    </div>
  );
};

// Pagination interface
interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

const StaffShifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [venueFilter, setVenueFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [venueOptions, setVenueOptions] = useState<IDropdownOption[]>([{ key: '', text: 'All Venues' }]);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('excel');
  const [expandedShifts, setExpandedShifts] = useState<Set<number>>(new Set());
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  });

  // Set up columns for the DetailsList
  const columns: IColumn[] = [
    {
      key: 'expand',
      name: '',
      minWidth: 30,
      maxWidth: 30,
      isResizable: false,
      onRender: (item: Shift) => (
        <DefaultButton
          onClick={() => toggleShiftExpansion(item.id)}
          styles={{
            root: {
              minWidth: 'auto',
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none'
            }
          }}
        >
          {expandedShifts.has(item.id) ? <ChevronUp24Regular /> : <ChevronDown24Regular />}
        </DefaultButton>
      ),
    },
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 50,
      isResizable: true,
    },
    {
      key: 'staff',
      name: 'Staff Member',
      fieldName: 'staff',
      minWidth: 150,
      maxWidth: 180,
      isResizable: true,
      onRender: (item: Shift) => <Text>{`${item.staff.firstName} ${item.staff.lastName}`}</Text>,
    },
    {
      key: 'venue',
      name: 'Venue',
      fieldName: 'venue',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.venue.name}</Text>,
    },
    {
      key: 'startTime',
      name: 'Start Time',
      fieldName: 'startTime',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{new Date(item.startTime).toLocaleString()}</Text>,
    },
    {
      key: 'endTime',
      name: 'End Time',
      fieldName: 'endTime',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>,
    },
    {
      key: 'duration',
      name: 'Duration',
      fieldName: 'duration',
      minWidth: 70,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.duration ? `${item.duration.toFixed(2)} hrs` : '-'}</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: Shift) => <StatusPill status={item.status} />,
    },
    {
      key: 'approved',
      name: 'Approval',
      fieldName: 'managerApproved',
      minWidth: 70,
      maxWidth: 90,
      isResizable: true,
      onRender: (item: Shift) => (
        <Text>
          {item.managerApproved ?
            <span style={{ color: '#10B981' }}>✓ Approved</span> :
            <span style={{ color: '#9CA3AF' }}>Pending</span>
          }
        </Text>
      ),
    },
    {
      key: 'venueChecks',
      name: 'Venue Checks',
      minWidth: 100,
      maxWidth: 130,
      isResizable: true,
      onRender: (item: Shift) => (
        <Stack tokens={{ childrenGap: 4 }}>
          {item.venueChecks ? (
            <>
              <Text variant="small" style={{ fontWeight: '600' }}>
                {item.venueChecks.totalChecks} Total
              </Text>
              {item.venueChecks.criticalIssues > 0 && (
                <Text variant="small" style={{ color: '#EF4444', fontWeight: '600' }}>
                  ⚠️ {item.venueChecks.criticalIssues} Issues
                </Text>
              )}
              {item.venueChecks.totalChecks === 0 && (
                <Text variant="small" style={{ color: '#F59E0B' }}>
                  No checks
                </Text>
              )}
            </>
          ) : (
            <Text variant="small" style={{ color: '#9CA3AF' }}>
              -
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Shift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <Link onClick={() => handleViewShift(item.id)}>
            View
          </Link>
          {(item.venueChecks?.totalChecks || 0) > 0 && (
            <Link onClick={() => handleViewChecks(item.id)}>
              Checks
            </Link>
          )}
          {item.status === ShiftStatus.COMPLETED && !item.managerApproved && (
            <Link onClick={() => handleApproveShift(item.id)}>
              Approve
            </Link>
          )}
        </Stack>
      ),
    },
  ];

  // Status filter options
  const statusOptions: IDropdownOption[] = [
    { key: '', text: 'All Statuses' },
    { key: ShiftStatus.ACTIVE, text: 'Active' },
    { key: ShiftStatus.COMPLETED, text: 'Completed' },
    { key: ShiftStatus.APPROVED, text: 'Approved' },
    { key: ShiftStatus.REJECTED, text: 'Rejected' },
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
    return false; // Return false to prevent default behavior
  }, [loadShifts]);

  const handleShowFilters = useCallback(() => {
    setShowFiltersDialog(true);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setShowFiltersDialog(false);
    // Filters are already applied in useEffect
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setStatusFilter('');
    setVenueFilter('');
    setStartDate(null);
    setEndDate(null);
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

  // Pagination Controls Component
  const PaginationControls: React.FC<{ 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
  }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const showPages = pages.filter(page => 
      page === 1 || 
      page === totalPages || 
      (page >= currentPage - 1 && page <= currentPage + 1)
    );

    return (
      <div className="flex items-center justify-center space-x-2 mt-8">
        <DefaultButton
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          styles={{
            root: {
              borderRadius: '8px',
              border: '2px solid #e5e7eb'
            }
          }}
        >
          <ChevronLeft24Regular style={{ marginRight: 4 }} />
          Previous
        </DefaultButton>
        
        <div className="flex space-x-1">
          {showPages.map((page, index) => (
            <div key={page}>
              {index > 0 && showPages[index - 1] !== page - 1 && (
                <span className="px-2 text-gray-400">...</span>
              )}
              <button
                onClick={() => onPageChange(page)}
                className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  currentPage === page
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            </div>
          ))}
        </div>
        
        <DefaultButton
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          styles={{
            root: {
              borderRadius: '8px',
              border: '2px solid #e5e7eb'
            }
          }}
        >
          Next
          <ChevronRight24Regular style={{ marginLeft: 4 }} />
        </DefaultButton>
      </div>
    );
  };

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefresh,
    },
    {
      key: 'filters',
      text: 'Advanced Filters',
      iconProps: { iconName: 'Filter' },
      onClick: handleShowFilters,
    },
    {
      key: 'export',
      text: 'Export',
      iconProps: { iconName: 'ExcelDocument' },
      onClick: () => {
        setShowExportDialog(true);
        return false;
      },
    },
  ];

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
      result = result.filter(shift => new Date(shift.startTime) >= startDate);
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

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Staff Shifts</Text>
        </Stack>

        <CommandBar items={commandBarItems} />

        {/* Search and Filter - Responsive */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 md:flex-grow-3">
            <SearchBox
              placeholder="Search by staff name or venue"
              onChange={(_, newValue) => setSearchText(newValue || '')}
              onClear={() => setSearchText('')}
              value={searchText}
            />
          </div>
          <div className="flex-1 md:flex-grow-1 md:max-w-xs">
            <Dropdown
              placeholder="Filter by status"
              options={statusOptions}
              selectedKey={statusFilter}
              onChange={(_, option) => setStatusFilter(option?.key as string)}
            />
          </div>
        </div>

        {/* Active filters display */}
        {(statusFilter || venueFilter || startDate || endDate) && (
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            <Text>Active filters:</Text>
            {statusFilter && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                Status: {statusOptions.find(option => option.key === statusFilter)?.text}
              </div>
            )}
            {venueFilter && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                Venue: {venueOptions.find(option => option.key === venueFilter)?.text}
              </div>
            )}
            {startDate && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                From: {startDate.toLocaleDateString()}
              </div>
            )}
            {endDate && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                To: {endDate.toLocaleDateString()}
              </div>
            )}
            <Link onClick={handleClearFilters}>Clear all</Link>
          </Stack>
        )}

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size={SpinnerSize.large} label="Loading shifts..." />
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Text variant="large">No shifts found</Text>
            <Text>Try adjusting your search criteria.</Text>
          </div>
        ) : (
          <div>
            {/* Pagination Info */}
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: '16px' }}>
              <Text variant="medium">
                Showing {Math.min((pagination.currentPage - 1) * pagination.itemsPerPage + 1, filteredShifts.length)} - {Math.min(pagination.currentPage * pagination.itemsPerPage, filteredShifts.length)} of {filteredShifts.length} shifts
              </Text>
            </Stack>
            
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden md:block">
              <Stack tokens={{ childrenGap: 0 }}>
                {/* Table Header */}
                <div style={{ 
                  display: 'flex', 
                  backgroundColor: '#f8f9fa', 
                  borderBottom: '1px solid #dee2e6', 
                  padding: '8px 12px',
                  fontWeight: '600'
                }}>
                  <div style={{ width: '30px' }}></div>
                  <div style={{ width: '50px', marginRight: '12px' }}>ID</div>
                  <div style={{ width: '150px', marginRight: '12px' }}>Staff Member</div>
                  <div style={{ width: '120px', marginRight: '12px' }}>Venue</div>
                  <div style={{ width: '120px', marginRight: '12px' }}>Start Time</div>
                  <div style={{ width: '120px', marginRight: '12px' }}>End Time</div>
                  <div style={{ width: '70px', marginRight: '12px' }}>Duration</div>
                  <div style={{ width: '100px', marginRight: '12px' }}>Status</div>
                  <div style={{ width: '90px', marginRight: '12px' }}>Approval</div>
                  <div style={{ width: '130px', marginRight: '12px' }}>Venue Checks</div>
                  <div style={{ width: '120px' }}>Actions</div>
                </div>

                {/* Table Rows */}
                {getPaginatedShifts().items.map((shift, index) => (
                  <div key={shift.id}>
                    {/* Main Row */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa', 
                      borderBottom: '1px solid #dee2e6', 
                      padding: '8px 12px',
                      minHeight: '40px'
                    }}>
                      <div style={{ width: '30px' }}>
                        <DefaultButton
                          onClick={() => toggleShiftExpansion(shift.id)}
                          styles={{
                            root: {
                              minWidth: 'auto',
                              padding: '4px',
                              backgroundColor: 'transparent',
                              border: 'none'
                            }
                          }}
                        >
                          {expandedShifts.has(shift.id) ? <ChevronUp24Regular /> : <ChevronDown24Regular />}
                        </DefaultButton>
                      </div>
                      <div style={{ width: '50px', marginRight: '12px' }}>{shift.id}</div>
                      <div style={{ width: '150px', marginRight: '12px' }}>
                        {`${shift.staff.firstName} ${shift.staff.lastName}`}
                      </div>
                      <div style={{ width: '120px', marginRight: '12px' }}>{shift.venue.name}</div>
                      <div style={{ width: '120px', marginRight: '12px' }}>
                        {new Date(shift.startTime).toLocaleString()}
                      </div>
                      <div style={{ width: '120px', marginRight: '12px' }}>
                        {shift.endTime ? new Date(shift.endTime).toLocaleString() : '-'}
                      </div>
                      <div style={{ width: '70px', marginRight: '12px' }}>
                        {shift.duration ? `${shift.duration.toFixed(2)} hrs` : '-'}
                      </div>
                      <div style={{ width: '100px', marginRight: '12px' }}>
                        <StatusPill status={shift.status} />
                      </div>
                      <div style={{ width: '90px', marginRight: '12px' }}>
                        {shift.managerApproved ?
                          <span style={{ color: '#10B981' }}>✓ Approved</span> :
                          <span style={{ color: '#9CA3AF' }}>Pending</span>
                        }
                      </div>
                      <div style={{ width: '130px', marginRight: '12px' }}>
                        <Stack tokens={{ childrenGap: 4 }}>
                          {shift.venueChecks ? (
                            <>
                              <Text variant="small" style={{ fontWeight: '600' }}>
                                {shift.venueChecks.totalChecks} Total
                              </Text>
                              {shift.venueChecks.criticalIssues > 0 && (
                                <Text variant="small" style={{ color: '#EF4444', fontWeight: '600' }}>
                                  ⚠️ {shift.venueChecks.criticalIssues} Issues
                                </Text>
                              )}
                            </>
                          ) : (
                            <Text variant="small" style={{ color: '#9CA3AF' }}>-</Text>
                          )}
                        </Stack>
                      </div>
                      <div style={{ width: '120px' }}>
                        <Stack horizontal tokens={{ childrenGap: 8 }}>
                          <Link onClick={() => handleViewShift(shift.id)}>View</Link>
                          {(shift.venueChecks?.totalChecks || 0) > 0 && (
                            <Link onClick={() => handleViewChecks(shift.id)}>Checks</Link>
                          )}
                          {shift.status === ShiftStatus.COMPLETED && !shift.managerApproved && (
                            <Link onClick={() => handleApproveShift(shift.id)}>Approve</Link>
                          )}
                        </Stack>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedShifts.has(shift.id) && (
                      <ShiftDetailsExpanded shift={shift} />
                    )}
                  </div>
                ))}
              </Stack>
            </div>

            {/* Mobile Card View - Visible only on mobile */}
            <div className="block md:hidden">
              <Stack tokens={{ childrenGap: 12 }}>
                {getPaginatedShifts().items.map((shift, index) => (
                  <div key={shift.id} style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    {/* Card Header */}
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: '12px' }}>
                      <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                        <Text variant="medium" style={{ fontWeight: '600' }}>#{shift.id}</Text>
                        <StatusPill status={shift.status} />
                      </Stack>
                      <DefaultButton
                        onClick={() => toggleShiftExpansion(shift.id)}
                        styles={{
                          root: {
                            minWidth: 'auto',
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px'
                          }
                        }}
                      >
                        {expandedShifts.has(shift.id) ? <ChevronUp24Regular /> : <ChevronDown24Regular />}
                      </DefaultButton>
                    </Stack>

                    {/* Staff and Venue Info */}
                    <Stack tokens={{ childrenGap: 8 }} style={{ marginBottom: '12px' }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Staff</Text>
                        <Text variant="small" style={{ fontWeight: '600' }}>
                          {`${shift.staff.firstName} ${shift.staff.lastName}`}
                        </Text>
                      </Stack>
                      <Stack horizontal horizontalAlign="space-between">
                        <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Venue</Text>
                        <Text variant="small">{shift.venue.name}</Text>
                      </Stack>
                    </Stack>

                    {/* Time Information */}
                    <Stack tokens={{ childrenGap: 8 }} style={{ marginBottom: '12px' }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Start</Text>
                        <Text variant="small">{new Date(shift.startTime).toLocaleDateString()}</Text>
                      </Stack>
                      <Stack horizontal horizontalAlign="space-between">
                        <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Time</Text>
                        <Text variant="small">{new Date(shift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </Stack>
                      {shift.duration && (
                        <Stack horizontal horizontalAlign="space-between">
                          <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Duration</Text>
                          <Text variant="small">{shift.duration.toFixed(1)}h</Text>
                        </Stack>
                      )}
                    </Stack>

                    {/* Status Information */}
                    <Stack horizontal horizontalAlign="space-between" style={{ marginBottom: '12px' }}>
                      <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Approval</Text>
                      <Text variant="small" style={{ 
                        color: shift.managerApproved ? '#10B981' : '#9CA3AF',
                        fontWeight: '600'
                      }}>
                        {shift.managerApproved ? '✓ Approved' : 'Pending'}
                      </Text>
                    </Stack>

                    {/* Venue Checks Summary */}
                    {shift.venueChecks && shift.venueChecks.totalChecks > 0 && (
                      <Stack horizontal horizontalAlign="space-between" style={{ marginBottom: '12px' }}>
                        <Text variant="small" style={{ color: '#6c757d', fontWeight: '600' }}>Checks</Text>
                        <Stack horizontal tokens={{ childrenGap: 8 }}>
                          <Text variant="small" style={{ fontWeight: '600' }}>
                            {shift.venueChecks.totalChecks} Total
                          </Text>
                          {shift.venueChecks.criticalIssues > 0 && (
                            <Text variant="small" style={{ color: '#EF4444', fontWeight: '600' }}>
                              ⚠️ {shift.venueChecks.criticalIssues}
                            </Text>
                          )}
                        </Stack>
                      </Stack>
                    )}

                    {/* Actions */}
                    <Stack horizontal tokens={{ childrenGap: 12 }} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f8f9fa' }}>
                      <DefaultButton
                        text="View"
                        onClick={() => handleViewShift(shift.id)}
                        styles={{
                          root: { 
                            flex: 1,
                            backgroundColor: '#B91C1C',
                            color: 'white',
                            border: 'none'
                          }
                        }}
                      />
                      {(shift.venueChecks?.totalChecks || 0) > 0 && (
                        <DefaultButton
                          text="Checks"
                          onClick={() => handleViewChecks(shift.id)}
                          styles={{
                            root: { 
                              flex: 1,
                              backgroundColor: '#f8f9fa',
                              color: '#B91C1C',
                              border: '1px solid #dee2e6'
                            }
                          }}
                        />
                      )}
                      {shift.status === ShiftStatus.COMPLETED && !shift.managerApproved && (
                        <DefaultButton
                          text="Approve"
                          onClick={() => handleApproveShift(shift.id)}
                          styles={{
                            root: { 
                              flex: 1,
                              backgroundColor: '#10B981',
                              color: 'white',
                              border: 'none'
                            }
                          }}
                        />
                      )}
                    </Stack>

                    {/* Expanded Content */}
                    {expandedShifts.has(shift.id) && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f8f9fa' }}>
                        <ShiftDetailsExpanded shift={shift} />
                      </div>
                    )}
                  </div>
                ))}
              </Stack>
            </div>
            
            {/* Pagination Controls */}
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={getPaginatedShifts().totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </Stack>

      {/* Advanced Filters Dialog */}
      <Dialog
        hidden={!showFiltersDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Advanced Filters',
        }}
        onDismiss={() => setShowFiltersDialog(false)}
        minWidth={400}
      >
        <Stack tokens={{ childrenGap: 15 }}>
          <TextField
            label="Search"
            value={searchText}
            onChange={(_, newValue) => setSearchText(newValue || '')}
            placeholder="Staff name, venue, or shift ID"
          />

          <Dropdown
            label="Status"
            options={statusOptions}
            selectedKey={statusFilter}
            onChange={(_, option) => setStatusFilter(option?.key as string)}
          />

          <Dropdown
            label="Venue"
            options={venueOptions}
            selectedKey={venueFilter}
            onChange={(_, option) => setVenueFilter(option?.key as string)}
          />

          <Label>Date Range</Label>
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <DatePicker
              label="From"
              value={startDate || undefined}
              onSelectDate={(date) => setStartDate(date || null)}
              placeholder="Select start date"
              formatDate={(date?: Date) => date ? date.toLocaleDateString() : ''}
            />
            <DatePicker
              label="To"
              value={endDate || undefined}
              onSelectDate={(date) => setEndDate(date || null)}
              placeholder="Select end date"
              formatDate={(date?: Date) => date ? date.toLocaleDateString() : ''}
              minDate={startDate || undefined}
            />
          </Stack>
        </Stack>
        <DialogFooter>
          <PrimaryButton text="Apply" onClick={handleApplyFilters} />
          <DefaultButton text="Clear" onClick={handleClearFilters} />
          <DefaultButton text="Cancel" onClick={() => setShowFiltersDialog(false)} />
        </DialogFooter>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        hidden={!showExportDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Export Shift Data',
        }}
        onDismiss={() => setShowExportDialog(false)}
        minWidth={400}
      >
        <Stack tokens={{ childrenGap: 15 }}>
          <Text>
            Export {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''} with venue check data
          </Text>

          <Dropdown
            label="Export Format"
            options={[
              { key: 'excel', text: 'Excel/CSV (.csv)' },
              { key: 'csv', text: 'CSV (.csv)' }
            ]}
            selectedKey={exportFormat}
            onChange={(_, option) => setExportFormat(option?.key as string)}
          />

          <Text variant="small" style={{ fontStyle: 'italic' }}>
            Export includes: Shift details, staff information, venue data, check summaries, and compliance status
          </Text>
        </Stack>
        <DialogFooter>
          <PrimaryButton text="Export" onClick={handleExport} />
          <DefaultButton text="Cancel" onClick={() => setShowExportDialog(false)} />
        </DialogFooter>
      </Dialog>
    </MainLayout>
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
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderTop: 'none',
      padding: '16px',
      marginLeft: window.innerWidth < 768 ? '0' : '30px'
    }}>
      <Stack tokens={{ childrenGap: 16 }}>
        <Text variant="medium" style={{ fontWeight: '600' }}>
          📋 Shift Details & Venue Check History
        </Text>

        {/* Shift Overview - Responsive Layout */}
        <div className="flex flex-col md:flex-row md:gap-10 gap-4">
          <Stack tokens={{ childrenGap: 6 }} className="flex-1">
            <Text variant="small" style={{ fontWeight: '600', color: '#B91C1C' }}>Shift Information</Text>
            <Text variant="small">Staff: {`${shift.staff.firstName} ${shift.staff.lastName}`}</Text>
            <Text variant="small">Email: {shift.staff.email}</Text>
            <Text variant="small">Venue: {shift.venue.name}</Text>
            <Text variant="small">Status: {shift.status.toUpperCase()}</Text>
          </Stack>
          
          <Stack tokens={{ childrenGap: 6 }} className="flex-1">
            <Text variant="small" style={{ fontWeight: '600', color: '#B91C1C' }}>Timing</Text>
            <Text variant="small">Scheduled: {new Date(shift.startTime).toLocaleString()}</Text>
            {shift.checkInTime && (
              <Text variant="small">Checked In: {new Date(shift.checkInTime).toLocaleString()}</Text>
            )}
            {shift.checkOutTime && (
              <Text variant="small">Checked Out: {new Date(shift.checkOutTime).toLocaleString()}</Text>
            )}
            {shift.duration && (
              <Text variant="small">Duration: {shift.duration.toFixed(2)} hours</Text>
            )}
          </Stack>

          <Stack tokens={{ childrenGap: 6 }} className="flex-1">
            <Text variant="small" style={{ fontWeight: '600', color: '#B91C1C' }}>Venue Requirements</Text>
            <Text variant="small">
              Fire Safety: {shift.venue.requiresFireSafetyChecks ? '✓ Required' : '✗ Not Required'}
            </Text>
            <Text variant="small">
              Capacity: {shift.venue.requiresCapacityMonitoring ? '✓ Required' : '✗ Not Required'}
            </Text>
            <Text variant="small">
              Toilets: {shift.venue.requiresToiletChecks ? '✓ Required' : '✗ Not Required'}
            </Text>
          </Stack>
        </div>

        {/* Check Details */}
        {checkDetails.loading ? (
          <Stack horizontalAlign="center">
            <Spinner size={SpinnerSize.medium} label="Loading check details..." />
          </Stack>
        ) : (
          <Stack tokens={{ childrenGap: 16 }}>
            {/* Fire Exit Checks */}
            {checkDetails.fireChecks.length > 0 && (
              <Stack tokens={{ childrenGap: 8 }}>
                <Text variant="medium" style={{ fontWeight: '600', color: '#ff6b6b' }}>
                  🔥 Fire Exit Checks ({checkDetails.fireChecks.length})
                </Text>
                <Stack tokens={{ childrenGap: 4 }}>
                  {checkDetails.fireChecks.map((check, index) => (
                    <div key={check.id} style={{
                      padding: '8px 12px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e1e5e9'
                    }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Stack>
                          <Text variant="small" style={{ fontWeight: '600' }}>{check.exitName}</Text>
                          <Text variant="small">{formatDate(check.timestamp)} at {formatTime(check.timestamp)}</Text>
                          {check.comments && <Text variant="small">{check.comments}</Text>}
                        </Stack>
                        <Text variant="small" style={{
                          color: check.isPassed ? '#155724' : '#721c24',
                          fontWeight: '600'
                        }}>
                          {check.isPassed ? '✅ Clear' : '❌ Blocked'}
                        </Text>
                      </Stack>
                    </div>
                  ))}
                </Stack>
              </Stack>
            )}

            {/* Capacity Checks */}
            {checkDetails.capacityChecks.length > 0 && (
              <Stack tokens={{ childrenGap: 8 }}>
                <Text variant="medium" style={{ fontWeight: '600', color: '#4ecdc4' }}>
                  👥 Capacity Checks ({checkDetails.capacityChecks.length})
                </Text>
                <Stack tokens={{ childrenGap: 4 }}>
                  {checkDetails.capacityChecks.map((check, index) => (
                    <div key={check.id} style={{
                      padding: '8px 12px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e1e5e9'
                    }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Stack>
                          <Text variant="small" style={{ fontWeight: '600' }}>Count: {check.count} people</Text>
                          <Text variant="small">{formatDate(check.timestamp)} at {formatTime(check.timestamp)}</Text>
                          {check.comments && <Text variant="small">{check.comments}</Text>}
                        </Stack>
                        <Text variant="small" style={{ fontWeight: '600' }}>#{index + 1}</Text>
                      </Stack>
                    </div>
                  ))}
                </Stack>
              </Stack>
            )}

            {/* Toilet Checks */}
            {checkDetails.toiletChecks.length > 0 && (
              <Stack tokens={{ childrenGap: 8 }}>
                <Text variant="medium" style={{ fontWeight: '600', color: '#95e1d3' }}>
                  🚻 Toilet Checks ({checkDetails.toiletChecks.length})
                </Text>
                <Stack tokens={{ childrenGap: 4 }}>
                  {checkDetails.toiletChecks.map((check, index) => (
                    <div key={check.id} style={{
                      padding: '8px 12px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #e1e5e9'
                    }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Stack>
                          <Text variant="small" style={{ fontWeight: '600' }}>{check.location}</Text>
                          <Text variant="small">{formatDate(check.timestamp)} at {formatTime(check.timestamp)}</Text>
                          {check.comments && <Text variant="small">{check.comments}</Text>}
                        </Stack>
                        <Text variant="small" style={{
                          fontWeight: '600',
                          textTransform: 'capitalize',
                          color: check.condition === 'excellent' ? '#155724' :
                                check.condition === 'good' ? '#0c5460' :
                                check.condition === 'fair' ? '#856404' :
                                '#721c24'
                        }}>
                          {check.condition}
                        </Text>
                      </Stack>
                    </div>
                  ))}
                </Stack>
              </Stack>
            )}

            {/* No Checks Message */}
            {checkDetails.fireChecks.length === 0 && 
             checkDetails.capacityChecks.length === 0 && 
             checkDetails.toiletChecks.length === 0 && (
              <Text variant="medium" style={{ color: '#6c757d', textAlign: 'center', fontStyle: 'italic' }}>
                No venue checks logged for this shift
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export default StaffShifts;
