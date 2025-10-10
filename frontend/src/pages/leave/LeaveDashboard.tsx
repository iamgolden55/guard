import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Text,
  Icon,
  DefaultButton,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { leaveService } from '../../services';
import type {
  LeaveBalanceResponse,
  LeaveRequest
} from '../../types/leave';
import { LeaveRequestStatus } from '../../types/leave';
import LeaveBalanceWidget from '../../components/leave/LeaveBalanceWidget';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={SpinnerSize.large} label="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline
          actions={
            <DefaultButton
              text="Retry"
              iconProps={{ iconName: 'Refresh' }}
              onClick={loadDashboardData}
            />
          }
        >
          {error}
        </MessageBar>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="xxLarge" className="font-bold text-gray-900">
              Leave Dashboard
            </Text><br />
            <Text variant="large" className="text-gray-600 mt-1">
              Manage your time off and leave requests
            </Text>
          </div>
          <PrimaryButton
            text="Request Leave"
            iconProps={{ iconName: 'Add' }}
            onClick={() => navigate('/leave/request')}
            styles={{
              root: {
                borderRadius: '8px',
                fontSize: '14px'
              }
            }}
          />
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Icon iconName="Clock" className="text-blue-600" style={{ fontSize: '20px' }} />
              </div>
              <div className="ml-4">
                <Text variant="xxLarge" className="font-bold text-gray-900">
                  {stats.totalAvailable}
                </Text>
                <Text variant="medium" className="text-gray-600">
                  Days Available
                </Text>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Icon iconName="CheckMark" className="text-green-600" style={{ fontSize: '20px' }} />
              </div>
              <div className="ml-4">
                <Text variant="xxLarge" className="font-bold text-gray-900">
                  {stats.totalUsed}
                </Text>
                <Text variant="medium" className="text-gray-600">
                  Days Used
                </Text>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Icon iconName="Clock" className="text-orange-600" style={{ fontSize: '20px' }} />
              </div>
              <div className="ml-4">
                <Text variant="xxLarge" className="font-bold text-gray-900">
                  {stats.pendingRequests}
                </Text>
                <Text variant="medium" className="text-gray-600">
                  Pending Requests
                </Text>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Icon iconName="Calendar" className="text-purple-600" style={{ fontSize: '20px' }} />
              </div>
              <div className="ml-4">
                <Text variant="xxLarge" className="font-bold text-gray-900">
                  {stats.upcomingLeave.length}
                </Text>
                <Text variant="medium" className="text-gray-600">
                  Upcoming Leave
                </Text>
              </div>
            </div>
          </div>
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <Text variant="xLarge" className="font-semibold text-gray-900">
                  Recent Requests
                </Text>
                <DefaultButton
                  text="View All"
                  iconProps={{ iconName: 'ChevronRight' }}
                  onClick={() => navigate('/leave/history')}
                />
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
                        <Text variant="medium" className="font-medium text-gray-900">
                          {request.leave_type?.name || 'Unknown Leave Type'}
                        </Text>
                        <Text variant="small" className="text-gray-600">
                          {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                        </Text>
                      </div>
                    </div>
                    <div className={`
                      px-2 py-1 rounded-full text-xs font-medium
                      ${request.status === LeaveRequestStatus.APPROVED ? 'bg-green-100 text-green-800' :
                        request.status === LeaveRequestStatus.PENDING ? 'bg-orange-100 text-orange-800' :
                        request.status === LeaveRequestStatus.REJECTED ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }
                    `}>
                      {request.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions & Upcoming */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <Text variant="large" className="font-semibold text-gray-900 mb-4">
              Quick Actions
            </Text>
            <div className="space-y-3">
              <DefaultButton
                text="Request Leave"
                iconProps={{ iconName: 'Add' }}
                onClick={() => navigate('/leave/request')}
                styles={{
                  root: {
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderRadius: '8px'
                  }
                }}
              />
              <DefaultButton
                text="View Balance"
                iconProps={{ iconName: 'TimeEntry' }}
                onClick={() => navigate('/leave/balance')}
                styles={{
                  root: {
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderRadius: '8px'
                  }
                }}
              />
              <DefaultButton
                text="Leave History"
                iconProps={{ iconName: 'History' }}
                onClick={() => navigate('/leave/history')}
                styles={{
                  root: {
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderRadius: '8px'
                  }
                }}
              />

              {/* Manager/Admin Actions */}
              {(isUserRole(UserRole.MANAGER) || isUserRole(UserRole.ADMIN)) && (
                <>
                  <hr className="my-3" />
                  <DefaultButton
                    text="Team Approvals"
                    iconProps={{ iconName: 'CalendarReply' }}
                    onClick={() => navigate('/leave/approvals')}
                    styles={{
                      root: {
                        width: '100%',
                        justifyContent: 'flex-start',
                        borderRadius: '8px'
                      }
                    }}
                  />
                  <DefaultButton
                    text="Team Calendar"
                    iconProps={{ iconName: 'CalendarWorkWeek' }}
                    onClick={() => navigate('/leave/calendar')}
                    styles={{
                      root: {
                        width: '100%',
                        justifyContent: 'flex-start',
                        borderRadius: '8px'
                      }
                    }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Upcoming Leave */}
          {stats?.upcomingLeave && stats.upcomingLeave.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <Text variant="large" className="font-semibold text-gray-900 mb-4">
                Upcoming Leave
              </Text>
              <div className="space-y-3">
                {stats.upcomingLeave.map((leave) => (
                  <div 
                    key={leave.id}
                    className="p-3 rounded-lg border border-gray-200 bg-blue-50"
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      {leave.leave_type && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: leave.leave_type.color_code }}
                        />
                      )}
                      <Text variant="medium" className="font-medium text-gray-900">
                        {leave.leave_type?.name || 'Unknown Leave Type'}
                      </Text>
                    </div>
                    <Text variant="small" className="text-gray-600">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </Text>
                    <Text variant="small" className="text-blue-700 font-medium">
                      {leave.days_requested} days
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveDashboard;