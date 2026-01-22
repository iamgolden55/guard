import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import LeaveSidebar from '../../components/leave/LeaveSidebar';
import LeaveDashboard from './LeaveDashboard';
import LeaveRequestForm from '../../components/LeaveRequestForm';
import LeaveBalanceDisplay from '../../components/LeaveBalanceDisplay';
import LeaveHistoryTable from '../../components/LeaveHistoryTable';
import LeaveApprovalDashboard from '../../components/LeaveApprovalDashboard';
import LeaveCalendar from '../../components/LeaveCalendar';
import TeamOverview from '../manager/TeamOverview';
import LeavePolicies from '../admin/LeavePolicies';
import LeaveSettings from '../admin/LeaveSettings';
import ContractorUnavailability from './ContractorUnavailability';
import { useStaffProfile } from '../../hooks/useStaffProfile';
import { Spinner, SpinnerSize } from '@fluentui/react';

const LeaveManagement: React.FC = () => {
  const { isUserRole } = useAuth();
  const location = useLocation();
  const { isContractor, isPermanentEmployee, isLoading: profileLoading, employmentCategory } = useStaffProfile();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle successful form submissions to trigger refreshes
  const handleRequestSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Route guard component for permanent-only routes
  const PermanentOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (profileLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Spinner size={SpinnerSize.large} label="Loading..." />
        </div>
      );
    }
    // Redirect contractors to unavailability page
    if (isContractor) {
      return <Navigate to="/leave/unavailability" replace />;
    }
    // Redirect users with unknown employment type to dashboard (will show message there)
    if (!employmentCategory) {
      return <Navigate to="/leave" replace />;
    }
    return <>{children}</>;
  };

  // Route guard component for contractor-only routes
  const ContractorOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (profileLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Spinner size={SpinnerSize.large} label="Loading..." />
        </div>
      );
    }
    // Redirect permanent employees to balance page
    if (isPermanentEmployee) {
      return <Navigate to="/leave/balance" replace />;
    }
    // Redirect users with unknown employment type to dashboard (will show message there)
    if (!employmentCategory) {
      return <Navigate to="/leave" replace />;
    }
    return <>{children}</>;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <LeaveSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            {/* Default route - Dashboard */}
            <Route path="/" element={<LeaveDashboard refreshTrigger={refreshTrigger} />} />

            {/* Permanent Employee Routes - Protected with route guard */}
            <Route
              path="/request"
              element={
                <PermanentOnlyRoute>
                  <LeaveRequestForm
                    onSuccess={handleRequestSuccess}
                    className="max-w-4xl"
                  />
                </PermanentOnlyRoute>
              }
            />
            <Route
              path="/balance"
              element={
                <PermanentOnlyRoute>
                  <LeaveBalanceDisplay
                    refreshTrigger={refreshTrigger}
                    className="max-w-6xl"
                  />
                </PermanentOnlyRoute>
              }
            />
            <Route
              path="/history"
              element={
                <PermanentOnlyRoute>
                  <LeaveHistoryTable
                    className="max-w-7xl"
                  />
                </PermanentOnlyRoute>
              }
            />

            {/* Contractor Unavailability Route - Protected with route guard */}
            <Route
              path="/unavailability"
              element={
                <ContractorOnlyRoute>
                  <ContractorUnavailability className="max-w-4xl" />
                </ContractorOnlyRoute>
              }
            />

            {/* Manager Routes - Available to Managers and Admins */}
            {(isUserRole(UserRole.MANAGER) || isUserRole(UserRole.ADMIN)) && (
              <>
                <Route 
                  path="/approvals" 
                  element={
                    <LeaveApprovalDashboard 
                      onApprovalChange={handleRequestSuccess}
                      className="max-w-7xl"
                    />
                  } 
                />
                <Route 
                  path="/calendar" 
                  element={
                    <LeaveCalendar 
                      className="max-w-7xl"
                    />
                  } 
                />
                <Route
                  path="/team-overview"
                  element={<TeamOverview />}
                />
              </>
            )}

            {/* Admin Routes - Available to Admins only */}
            {isUserRole(UserRole.ADMIN) && (
              <>
                <Route
                  path="/policies"
                  element={<LeavePolicies />}
                />
                {/* Reports removed */}
                <Route
                  path="/settings"
                  element={<LeaveSettings />}
                />
              </>
            )}

            {/* Redirect unknown routes back to dashboard */}
            <Route path="*" element={<Navigate to="/leave" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default LeaveManagement;