import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Container, SpaceBetween, EmptyState, Alert } from '../../components/cloudscape';
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
  { key: 'all', text: 'All Shifts' },
  { key: 'upcoming', text: 'Upcoming' },
  { key: 'active', text: 'Active' },
  { key: 'completed', text: 'Completed' },
  { key: 'approved', text: 'Approved' },
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
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Previous
        </button>

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

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Next
        </button>
      </div>
    );
  };

  const handleCheckIn = useCallback((shift: MyShift) => {
    navigate(`/shifts/${shift.id}/checkin`);
  }, [navigate]);

  const handleCheckOut = useCallback((shift: MyShift) => {
    navigate(`/shifts/${shift.id}/checkout`);
  }, [navigate]);

  const handleEndShift = useCallback((shift: MyShift) => {
    navigate(`/shifts/${shift.id}/end`);
  }, [navigate]);

  const paginatedPastShifts = getPaginatedPastShifts();

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <button
              onClick={handleRefresh}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleNewShift}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Start New Shift
            </button>
          </SpaceBetween>
        }
      >
        My Shifts
      </Header>

      {/* Active Shift Widget */}
      <ActiveShiftWidget />

      {/* Search and Filters */}
      <Container>
        <SpaceBetween size="m">
          <input
            type="text"
            placeholder="Search by venue or shift ID..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />

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
        </SpaceBetween>
      </Container>

      {/* Pending Earnings */}
      {pendingEarnings && pendingEarnings.total_pending > 0 && (
        <Alert
          type="info"
          action={
            <button
              onClick={() => navigate('/invoices')}
              className="px-4 h-9 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              View Invoices
            </button>
          }
        >
          <span className="font-semibold">{'\u00A3'}{pendingEarnings.total_pending.toFixed(2)} Pending</span>
          {' \u2014 '}
          {pendingEarnings.shift_count} approved shift{pendingEarnings.shift_count !== 1 ? 's' : ''} awaiting invoice
        </Alert>
      )}

      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <SpaceBetween size="m">
          {[1, 2, 3].map(i => (
            <Container key={i}>
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/5" />
                <div className="h-4 bg-gray-200 rounded w-2/5" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </Container>
          ))}
        </SpaceBetween>
      ) : (
        <SpaceBetween size="l">
          {/* Upcoming Shifts Section */}
          {categorizeShifts.upcoming.length > 0 && (
            <SpaceBetween size="m">
              <Header variant="h2" counter={`${categorizeShifts.upcoming.length}`}>
                Upcoming Shifts
              </Header>
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
            </SpaceBetween>
          )}

          {/* Active Shifts Section */}
          {categorizeShifts.active.length > 0 && (
            <SpaceBetween size="m">
              <Header
                variant="h2"
                counter={`${categorizeShifts.active.length}`}
                info={
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold animate-pulse">
                    LIVE
                  </span>
                }
              >
                Active Shifts
              </Header>
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
            </SpaceBetween>
          )}

          {/* Recent Shifts Section */}
          {categorizeShifts.recent.length > 0 && (
            <SpaceBetween size="m">
              <Header variant="h2">Recent Shifts</Header>
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
            </SpaceBetween>
          )}

          {/* Past Shifts Section with Pagination */}
          {paginatedPastShifts.totalItems > 0 && (
            <SpaceBetween size="m">
              <Header
                variant="h2"
                description={`${paginatedPastShifts.totalItems} total shifts`}
              >
                Past Shifts
              </Header>

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
                <Container>
                  <EmptyState
                    title="No past shifts found"
                    description="No past shifts match your current search criteria"
                    variant="no-match"
                  />
                </Container>
              )}
            </SpaceBetween>
          )}

          {/* Empty State */}
          {shifts.length === 0 && !isLoading && (
            <Container>
              <EmptyState
                title="No shifts yet"
                description="Start your first shift to begin tracking your work"
                action={
                  <button
                    onClick={handleNewShift}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Start New Shift
                  </button>
                }
              />
            </Container>
          )}
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};

export default MyShifts;
