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
import LeaveReports from '../admin/LeaveReports';
import LeaveSettings from '../admin/LeaveSettings';

const LeaveManagement: React.FC = () => {
  const { isUserRole } = useAuth();
  const location = useLocation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle successful form submissions to trigger refreshes
  const handleRequestSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
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
            
            {/* Staff Routes - Available to all authenticated users */}
            <Route 
              path="/request" 
              element={
                <LeaveRequestForm 
                  onSuccess={handleRequestSuccess}
                  className="max-w-4xl"
                />
              } 
            />
            <Route 
              path="/balance" 
              element={
                <LeaveBalanceDisplay 
                  refreshTrigger={refreshTrigger}
                  className="max-w-6xl"
                />
              } 
            />
            <Route 
              path="/history" 
              element={
                <LeaveHistoryTable 
                  className="max-w-7xl"
                />
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
                <Route
                  path="/reports"
                  element={<LeaveReports />}
                />
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