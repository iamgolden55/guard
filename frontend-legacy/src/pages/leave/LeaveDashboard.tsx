import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { leaveService } from '../../services';
import type {
  LeaveBalanceResponse,
  LeaveRequest
} from '../../types/leave';
import { LeaveRequestStatus } from '../../types/leave';
import LeaveBalanceWidget from '../../components/leave/LeaveBalanceWidget';
import { useStaffProfile } from '../../hooks/useStaffProfile';
import { Header, Container, SpaceBetween, StatusIndicator, Alert, EmptyState } from '../../components/cloudscape';

interface LeaveDashboardProps {
  refreshTrigger?: number;
}

interface DashboardStats {
  totalAvailable: string;
  totalUsed: string;
  pendingRequests: number;
  upcomingLeave: LeaveRequest[];
  recentRequests: LeaveRequest[];
}

const LeaveDashboard: React.FC<LeaveDashboardProps> = ({ refreshTrigger = 0 }) => {
  const { authState, isUserRole } = useAuth();
  const navigate = useNavigate();
  const { isContractor, isPermanentEmployee, isLoading: profileLoading, employmentCategory, employmentTypeName } = useStaffProfile();
  const [balanceData, setBalanceData] = useState<LeaveBalanceResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load balance data and recent requests in parallel
      const [balanceResult, recentRequestsResult] = await Promise.all([
        leaveService.getLeaveBalances(),
        leaveService.getMyLeaveRequests({ limit: 5 })
      ]);

      setBalanceData(balanceResult);

      // Calculate dashboard stats - handle placeholder API response
      const requestsArray = recentRequestsResult?.results || [];
      const upcomingLeave = requestsArray.filter(request =>
        request.status === LeaveRequestStatus.APPROVED &&
        new Date(request.start_date) > new Date()
      );

      const pendingRequests = requestsArray.filter(request =>
        request.status === LeaveRequestStatus.PENDING
      ).length;

      setStats({
        totalAvailable: balanceResult?.total_days_available || '0',
        totalUsed: balanceResult?.total_days_used || '0',
        pendingRequests,
        upcomingLeave: upcomingLeave.slice(0, 3), // Show max 3
        recentRequests: requestsArray.slice(0, 5)
      });

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  // Show loading while profile or dashboard data is loading
  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <Alert type="error">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={loadDashboardData}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retry
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  // Show message if employment type is not configured
  if (!employmentCategory) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Container>
          <SpaceBetween size="m">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Employment Type Not Set</h2>
                <p className="text-gray-600 mt-1">Your employment type has not been configured</p>
              </div>
            </div>
            <Alert type="warning">
              <strong>Action Required:</strong> Your employment type needs to be set up before you can access leave management features.
              Please contact your administrator or HR to configure your profile.
            </Alert>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button>
          </SpaceBetween>
        </Container>
      </div>
    );
  }

  // Show contractor-specific dashboard (for contractors and temporary workers)
  if (isContractor) {
    return (
      <div className="max-w-7xl">
        <SpaceBetween size="l">
          {/* Header */}
          <Header
            variant="h1"
            description="Manage your availability for scheduling"
            actions={
              <button
                onClick={() => navigate('/leave/unavailability')}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Manage Availability
              </button>
            }
          >
            Availability Dashboard
          </Header>

          {/* Contractor Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Container>
              <SpaceBetween size="s">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Your Employment Type</h3>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-xl font-bold text-purple-700">
                    {employmentTypeName || 'Contractor / Temporary'}
                  </p>
                  <p className="text-sm text-purple-600 mt-1">
                    As a contractor or temporary worker, you manage your availability instead of leave balances.
                  </p>
                </div>
              </SpaceBetween>
            </Container>

            <Container>
              <SpaceBetween size="s">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">How It Works</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">Mark dates when you're unavailable for shifts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">Scheduling will avoid assigning you during those periods</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">No approval needed - purely informational</span>
                  </div>
                </div>
              </SpaceBetween>
            </Container>
          </div>

          {/* Quick Action */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-white">Ready to update your availability?</p>
                <p className="text-purple-100 mt-1">
                  Let us know when you're not available so we can schedule around your commitments.
                </p>
              </div>
              <button
                onClick={() => navigate('/leave/unavailability')}
                className="px-4 h-9 text-sm font-medium text-purple-700 bg-white rounded-lg hover:bg-gray-100 transition-colors"
              >
                Go to Availability
              </button>
            </div>
          </div>

          {/* Manager/Admin Actions (contractors who are also managers) */}
          {(isUserRole(UserRole.MANAGER) || isUserRole(UserRole.ADMIN)) && (
            <Container>
              <SpaceBetween size="s">
                <h3 className="text-lg font-semibold text-gray-900">Team Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => navigate('/leave/approvals')}
                    className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Team Approvals
                  </button>
                  <button
                    onClick={() => navigate('/leave/calendar')}
                    className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Team Calendar
                  </button>
                  <button
                    onClick={() => navigate('/leave/team-overview')}
                    className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Team Overview
                  </button>
                </div>
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </div>
    );
  }

  // Permanent employee dashboard (existing code)
  return (
    <div className="max-w-7xl">
      <SpaceBetween size="l">
        {/* Header */}
        <Header
          variant="h1"
          description="Manage your time off and leave requests"
          actions={
            <button
              onClick={() => navigate('/leave/request')}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Request Leave
            </button>
          }
        >
          Leave Dashboard
        </Header>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Container>
              <div className="flex items-center">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.totalAvailable}</p>
                  <p className="text-sm text-gray-600">Days Available</p>
                </div>
              </div>
            </Container>

            <Container>
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsed}</p>
                  <p className="text-sm text-gray-600">Days Used</p>
                </div>
              </div>
            </Container>

            <Container>
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests}</p>
                  <p className="text-sm text-gray-600">Pending Requests</p>
                </div>
              </div>
            </Container>

            <Container>
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingLeave.length}</p>
                  <p className="text-sm text-gray-600">Upcoming Leave</p>
                </div>
              </div>
            </Container>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Balance Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Leave Balances Widget */}
            {balanceData && (
              <LeaveBalanceWidget
                balanceData={balanceData}
                compact={true}
                showTitle={true}
              />
            )}

            {/* Recent Requests */}
            {stats?.recentRequests && stats.recentRequests.length > 0 && (
              <Container>
                <SpaceBetween size="s">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Requests</h3>
                    <button
                      onClick={() => navigate('/leave/history')}
                      className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {stats.recentRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {request.leave_type && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: request.leave_type.color_code }}
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {request.leave_type?.name || 'Unknown Leave Type'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <StatusIndicator
                          type={
                            request.status === LeaveRequestStatus.APPROVED ? 'success' :
                            request.status === LeaveRequestStatus.PENDING ? 'pending' :
                            request.status === LeaveRequestStatus.REJECTED ? 'error' :
                            'stopped'
                          }
                        >
                          {request.status}
                        </StatusIndicator>
                      </div>
                    ))}
                  </div>
                </SpaceBetween>
              </Container>
            )}
          </div>

          {/* Right Column - Quick Actions & Upcoming */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Container>
              <SpaceBetween size="s">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate('/leave/request')}
                    className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Request Leave
                  </button>
                  <button
                    onClick={() => navigate('/leave/balance')}
                    className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    View Balance
                  </button>
                  <button
                    onClick={() => navigate('/leave/history')}
                    className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Leave History
                  </button>

                  {/* Manager/Admin Actions */}
                  {(isUserRole(UserRole.MANAGER) || isUserRole(UserRole.ADMIN)) && (
                    <>
                      <hr className="my-3" />
                      <button
                        onClick={() => navigate('/leave/approvals')}
                        className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Team Approvals
                      </button>
                      <button
                        onClick={() => navigate('/leave/calendar')}
                        className="w-full text-left px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Team Calendar
                      </button>
                    </>
                  )}
                </div>
              </SpaceBetween>
            </Container>

            {/* Upcoming Leave */}
            {stats?.upcomingLeave && stats.upcomingLeave.length > 0 && (
              <Container>
                <SpaceBetween size="s">
                  <h3 className="text-lg font-semibold text-gray-900">Upcoming Leave</h3>
                  <div className="space-y-3">
                    {stats.upcomingLeave.map((leave) => (
                      <div
                        key={leave.id}
                        className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          {leave.leave_type && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: leave.leave_type.color_code }}
                            />
                          )}
                          <p className="text-sm font-medium text-gray-900">
                            {leave.leave_type?.name || 'Unknown Leave Type'}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600">
                          {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-800 font-medium">{leave.days_requested} days</p>
                      </div>
                    ))}
                  </div>
                </SpaceBetween>
              </Container>
            )}
          </div>
        </div>
      </SpaceBetween>
    </div>
  );
};

export default LeaveDashboard;
