import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SearchBox,
  Text,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  DefaultButton,
  Icon,
  Shimmer,
  ShimmerElementType
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { ShiftStatus } from '../../types';
import { shiftService } from '../../services';
import { fetchPendingEarnings, type PendingEarnings } from '../../services/api';
import { ShiftCard, ActiveShiftWidget } from '../../components';

interface MyShift {
  id: number;
  venue: {
    id: number;
    name: string;
  };
  startTime: string;
  endTime: string | null;
  status: ShiftStatus;
  managerApproved: boolean;
  autoCheckout?: boolean;
  calculated_payment?: number;
  is_invoiced?: boolean;
}


// Pagination interface
interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

// Filter options for quick filtering
const FILTER_OPTIONS = [
  { key: 'all', text: 'All Shifts', color: '#6b7280' },
  { key: 'upcoming', text: 'Upcoming', color: '#dc2626' },
  { key: 'active', text: 'Active', color: '#059669' },
  { key: 'completed', text: 'Completed', color: '#d97706' },
  { key: 'approved', text: 'Approved', color: '#2563eb' },
];

const MyShifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [pendingEarnings, setPendingEarnings] = useState<PendingEarnings | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 8,
    totalItems: 0
  });

  // Helper functions for categorizing shifts
  const categorizeShifts = useMemo(() => {
    const now = new Date();
    
    const upcoming = shifts.filter(shift => 
      new Date(shift.startTime) > now && 
      (shift.status === 'scheduled' || shift.status === ShiftStatus.ACTIVE)
    );
    
    const active = shifts.filter(shift => 
      shift.status === ShiftStatus.ACTIVE
    );
    
    const recent = shifts
      .filter(shift => 
        shift.status !== ShiftStatus.ACTIVE && 
        new Date(shift.startTime) <= now
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10);
    
    const past = shifts
      .filter(shift => 
        shift.status !== ShiftStatus.ACTIVE && 
        new Date(shift.startTime) <= now
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    return { upcoming, active, recent, past };
  }, [shifts]);

  // Filter shifts based on search and active filter
  const getFilteredShifts = (shiftsToFilter: MyShift[]) => {
    let filtered = shiftsToFilter;

    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      filtered = filtered.filter(shift =>
        shift.venue.name.toLowerCase().includes(lowerCaseSearch) ||
        shift.id.toString().includes(lowerCaseSearch)
      );
    }

    // Apply status filter
    switch (activeFilter) {
      case 'upcoming':
        filtered = filtered.filter(shift => new Date(shift.startTime) > new Date());
        break;
      case 'active':
        filtered = filtered.filter(shift => shift.status === ShiftStatus.ACTIVE);
        break;
      case 'completed':
        filtered = filtered.filter(shift => shift.status === ShiftStatus.COMPLETED);
        break;
      case 'approved':
        filtered = filtered.filter(shift => shift.status === ShiftStatus.APPROVED);
        break;
      // 'all' shows everything
    }

    return filtered;
  };

  // Paginate past shifts
  const getPaginatedPastShifts = () => {
    const filteredPast = getFilteredShifts(categorizeShifts.past);
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    
    return {
      items: filteredPast.slice(startIndex, endIndex),
      totalItems: filteredPast.length,
      totalPages: Math.ceil(filteredPast.length / pagination.itemsPerPage)
    };
  };

  // Load shifts from API
  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [shiftsResponse, earningsResponse] = await Promise.all([
        shiftService.getMyShifts(),
        fetchPendingEarnings().catch(err => {
          console.warn('Failed to load pending earnings:', err);
          return null;
        })
      ]);
      
      setShifts(shiftsResponse);
      setPendingEarnings(earningsResponse);
      
      // Update pagination total
      setPagination(prev => ({
        ...prev,
        totalItems: shiftsResponse.length
      }));
    } catch (error) {
      console.error('Failed to load shifts:', error);
      setError('Failed to load shifts. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleNewShift = useCallback(() => {
    navigate('/shifts/new');
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadShifts();
  }, [loadShifts]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  }, [searchText, activeFilter]);

  // Load shifts when component mounts
  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // Modern card component for consistent styling
  const ModernCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
    children, 
    className = '' 
  }) => (
    <div 
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out ${className}`}
      style={{ 
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transform: 'translateZ(0)'
      }}
    >
      {children}
    </div>
  );

  // Pagination component
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
          text="Previous"
          iconProps={{ iconName: 'ChevronLeft' }}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          styles={{ 
            root: { 
              borderRadius: '8px',
              border: '2px solid #e5e7eb'
            }
          }}
        />
        
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
          text="Next"
          iconProps={{ iconName: 'ChevronRight' }}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          styles={{ 
            root: { 
              borderRadius: '8px',
              border: '2px solid #e5e7eb'
            }
          }}
        />
      </div>
    );
  };

  const handleCheckIn = useCallback((shift: MyShift) => {
    // Navigate to a check-in page with the shift ID
    navigate(`/shifts/${shift.id}/checkin`);
  }, [navigate]);

  const handleCheckOut = useCallback((shift: MyShift) => {
    // Navigate to a check-out page with the shift ID
    navigate(`/shifts/${shift.id}/checkout`);
  }, [navigate]);

  const handleEndShift = useCallback((shift: MyShift) => {
    // Navigate to end shift page
    navigate(`/shifts/${shift.id}/end`);
  }, [navigate]);

  const paginatedPastShifts = getPaginatedPastShifts();

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <Text style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
                My Shifts
              </Text>
             
            </div>
            <div className="flex space-x-3">
              <DefaultButton
                text="Refresh"
                iconProps={{ iconName: 'Refresh' }}
                onClick={handleRefresh}
                styles={{ 
                  root: { 
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    fontWeight: '600'
                  }
                }}
              />
              <PrimaryButton
                text="Start New Shift"
                iconProps={{ iconName: 'Add' }}
                onClick={handleNewShift}
                styles={{ 
                  root: { 
                    backgroundColor: '#dc2626', 
                    borderRadius: '12px',
                    height: '48px',
                    fontSize: '16px',
                    fontWeight: '600'
                  } 
                }}
              />
            </div>
          </div>

          {/* Active Shift Widget */}
          <ActiveShiftWidget />

          {/* Search and Filters */}
          <ModernCard>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex-1">
                  <SearchBox
                    placeholder="Search by venue or shift ID..."
                    onChange={(_, newValue) => setSearchText(newValue || '')}
                    onClear={() => setSearchText('')}
                    styles={{ 
                      root: { borderRadius: '12px' }
                    }}
                  />
                </div>
              </div>
              
              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    onClick={() => setActiveFilter(option.key)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      activeFilter === option.key
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            </div>
          </ModernCard>

          {/* Pending Earnings */}
          {pendingEarnings && pendingEarnings.total_pending > 0 && (
            <ModernCard className="border-l-4 border-blue-400 bg-blue-50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <Icon iconName="Money" className="text-blue-600" style={{ fontSize: '24px' }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
                      £{pendingEarnings.total_pending.toFixed(2)} Pending
                    </Text>
                    <Text style={{ fontSize: '14px', color: '#1e40af' }}>
                      {pendingEarnings.shift_count} approved shift{pendingEarnings.shift_count !== 1 ? 's' : ''} awaiting invoice
                    </Text>
                  </div>
                </div>
                <DefaultButton
                  text="View Invoices"
                  iconProps={{ iconName: 'ChevronRight' }}
                  onClick={() => navigate('/invoices')}
                  styles={{ 
                    root: { 
                      borderRadius: '8px',
                      border: '2px solid #2563eb',
                      color: '#2563eb'
                    }
                  }}
                />
              </div>
            </ModernCard>
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
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <ModernCard key={i}>
                  <Shimmer shimmerElements={[
                    { type: ShimmerElementType.line, height: 24, width: '60%' },
                    { type: ShimmerElementType.gap, width: '100%', height: 8 },
                    { type: ShimmerElementType.line, height: 16, width: '40%' },
                    { type: ShimmerElementType.line, height: 16, width: '50%' }
                  ]} />
                </ModernCard>
              ))}
            </div>
          ) : (
            <>
              {/* Upcoming Shifts Section */}
              {categorizeShifts.upcoming.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-1 w-8 bg-red-600 rounded-full"></div>
                    <Text style={{ 
                      fontSize: '28px', 
                      fontWeight: '700', 
                      color: '#111827',
                      letterSpacing: '-0.025em'
                    }}>
                      Upcoming Shifts
                    </Text>
                    <div className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-semibold">
                      {categorizeShifts.upcoming.length}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {getFilteredShifts(categorizeShifts.upcoming).map(shift => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        variant="upcoming"
                        onCheckIn={handleCheckIn}
                        onCheckOut={handleCheckOut}
                        onEndShift={handleEndShift}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Active Shifts Section */}
              {categorizeShifts.active.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-1 w-8 bg-green-600 rounded-full"></div>
                    <Text style={{ 
                      fontSize: '28px', 
                      fontWeight: '700', 
                      color: '#111827',
                      letterSpacing: '-0.025em'
                    }}>
                      Active Shifts
                    </Text>
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-semibold animate-pulse">
                      {categorizeShifts.active.length} LIVE
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {getFilteredShifts(categorizeShifts.active).map(shift => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        variant="active"
                        onCheckIn={handleCheckIn}
                        onCheckOut={handleCheckOut}
                        onEndShift={handleEndShift}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Shifts Section */}
              {categorizeShifts.recent.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-1 w-8 bg-blue-600 rounded-full"></div>
                    <Text style={{ 
                      fontSize: '28px', 
                      fontWeight: '700', 
                      color: '#111827',
                      letterSpacing: '-0.025em'
                    }}>
                      Recent Shifts
                    </Text>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {getFilteredShifts(categorizeShifts.recent).map(shift => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        onCheckIn={handleCheckIn}
                        onCheckOut={handleCheckOut}
                        onEndShift={handleEndShift}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Shifts Section with Pagination */}
              {paginatedPastShifts.totalItems > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-1 w-8 bg-gray-600 rounded-full"></div>
                      <Text style={{ 
                        fontSize: '28px', 
                        fontWeight: '700', 
                        color: '#111827',
                        letterSpacing: '-0.025em'
                      }}>
                        Past Shifts
                      </Text>
                    </div>
                    <Text style={{ fontSize: '14px', color: '#6b7280' }}>
                      {paginatedPastShifts.totalItems} total shifts
                    </Text>
                  </div>
                  
                  {paginatedPastShifts.items.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {paginatedPastShifts.items.map(shift => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            onCheckIn={handleCheckIn}
                            onCheckOut={handleCheckOut}
                            onEndShift={handleEndShift}
                          />
                        ))}
                      </div>
                      
                      <PaginationControls
                        currentPage={pagination.currentPage}
                        totalPages={paginatedPastShifts.totalPages}
                        onPageChange={handlePageChange}
                      />
                    </>
                  ) : (
                    <ModernCard className="text-center py-12">
                      <Icon iconName="Calendar" className="text-gray-400 mb-4" style={{ fontSize: '48px' }} />
                      <Text style={{ fontSize: '18px', color: '#6b7280' }}>
                        No past shifts found matching your criteria
                      </Text>
                    </ModernCard>
                  )}
                </div>
              )}

              {/* Empty State */}
              {shifts.length === 0 && !isLoading && (
                <ModernCard className="text-center py-16">
                  <Icon iconName="Calendar" className="text-gray-400 mb-6" style={{ fontSize: '64px' }} />
                  <Text style={{ fontSize: '24px', fontWeight: '600', color: '#111827' }} className="mb-2">
                    No shifts yet
                  </Text>
                  <Text style={{ fontSize: '16px', color: '#6b7280' }} className="mb-6">
                    Start your first shift to begin tracking your work
                  </Text>
                  <PrimaryButton
                    text="Start New Shift"
                    iconProps={{ iconName: 'Add' }}
                    onClick={handleNewShift}
                    styles={{ 
                      root: { 
                        backgroundColor: '#dc2626', 
                        borderRadius: '12px',
                        height: '48px',
                        fontSize: '16px',
                        fontWeight: '600'
                      } 
                    }}
                  />
                </ModernCard>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default MyShifts;
