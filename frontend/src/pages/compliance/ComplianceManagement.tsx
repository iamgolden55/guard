import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import ComplianceSidebar from '../../components/compliance/ComplianceSidebar';
import ComplianceDashboardPage from './ComplianceDashboardPage';
import ViolationsList from '../../components/compliance/ViolationsList';
import RealTimeMonitor from '../../components/compliance/RealTimeMonitor';
import ComplianceSettings from '../../components/compliance/ComplianceSettings';
import ComplianceReports from '../../components/compliance/ComplianceReports';
import ComplianceTrends from '../../components/compliance/ComplianceTrends';
import WorkingHoursReport from '../../components/compliance/WorkingHoursReport';
import ComplianceCheck from '../../components/compliance/ComplianceCheck';
import ComplianceProfilesList from '../../components/compliance/ComplianceProfilesList';
import WorkingHoursRegulationsList from '../../components/compliance/WorkingHoursRegulationsList';

const ComplianceManagement: React.FC = () => {
  const { isUserRole } = useAuth();
  const location = useLocation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle successful operations to trigger refreshes
  const handleRefreshSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex -mx-5 lg:-mx-6 -mt-4">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <ComplianceSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            {/* Default route - Dashboard */}
            <Route
              path="/"
              element={
                <ComplianceDashboardPage
                  refreshTrigger={refreshTrigger}
                />
              }
            />

            {/* Manager Routes - Available to Managers and Admins */}
            {(isUserRole(UserRole.MANAGER) || isUserRole(UserRole.ADMIN)) && (
              <>
                <Route
                  path="/violations"
                  element={
                    <ViolationsList
                      onResolutionSuccess={handleRefreshSuccess}
                      className="max-w-7xl"
                    />
                  }
                />
                <Route
                  path="/monitor"
                  element={
                    <RealTimeMonitor
                      className="max-w-7xl"
                    />
                  }
                />
                <Route
                  path="/check"
                  element={
                    <ComplianceCheck
                      className="max-w-6xl"
                    />
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ComplianceReports
                      className="max-w-6xl"
                    />
                  }
                />
                <Route
                  path="/trends"
                  element={
                    <ComplianceTrends
                      className="max-w-7xl"
                    />
                  }
                />
                <Route
                  path="/working-hours"
                  element={
                    <WorkingHoursReport
                      className="max-w-7xl"
                    />
                  }
                />
              </>
            )}

            {/* Admin Routes - Available to Admins only */}
            {isUserRole(UserRole.ADMIN) && (
              <>
                <Route
                  path="/settings"
                  element={
                    <ComplianceSettings
                      onSettingsChange={handleRefreshSuccess}
                      className="max-w-6xl"
                    />
                  }
                />
                <Route
                  path="/profiles"
                  element={
                    <ComplianceProfilesList className="max-w-7xl mx-auto" />
                  }
                />
                <Route
                  path="/regulations"
                  element={
                    <WorkingHoursRegulationsList className="max-w-7xl mx-auto" />
                  }
                />
              </>
            )}

            {/* Redirect unknown routes back to dashboard */}
            <Route path="*" element={<Navigate to="/compliance" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default ComplianceManagement;