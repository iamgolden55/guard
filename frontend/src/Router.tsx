import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import { UserRole } from './types';
import { useAuth } from './contexts/AuthContext';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/auth';
import { NotFoundPage, UnauthorizedPage } from './pages/shared';

// Dashboard Pages
import { StaffDashboard, StartShift, EndShift, ShiftChecks, MyShifts, MyInvoices, ProfilePage, ShiftExchange, ShiftCheckIn, ShiftCheckOut } from './pages/staff';
import ShiftDetails from './pages/staff/ShiftDetails';
import { ManagerDashboard, ShiftApproval } from './pages/manager';
import { AdminDashboard, InvoiceGeneration, ShiftScheduling, Settings, FinanceIntegrations } from './pages/admin';
import FinanceIntegrationsOAuthCallback from './pages/admin/FinanceIntegrationsOAuthCallback';

// Lazy load heavy admin components to improve navigation performance
const StaffShifts = lazy(() => import('./pages/manager/StaffShifts'));
const Approvals = lazy(() => import('./pages/manager/Approvals'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const VenueManagement = lazy(() => import('./pages/admin/VenueManagement'));
const DeputyIntegration = lazy(() => import('./pages/admin/DeputyIntegration'));
const RecruitmentManagement = lazy(() => import('./pages/admin/RecruitmentManagement'));
const RecruitmentApplication = lazy(() => import('./pages/public/RecruitmentApplication'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const ComplianceSettings = lazy(() => import('./components/compliance/ComplianceSettings'));

// Leave Management Pages - Lazy Loading
const TeamOverview = lazy(() => import('./pages/manager/TeamOverview'));
const LeavePolicies = lazy(() => import('./pages/admin/LeavePolicies'));
const LeaveReports = lazy(() => import('./pages/admin/LeaveReports'));
const LeaveSettings = lazy(() => import('./pages/admin/LeaveSettings'));

// Onboarding Components - Lazy Loading
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard'));

// Leave Management Components
import { LeaveManagement } from './pages/leave';
import LeaveRequestForm from './components/LeaveRequestForm';
import LeaveBalanceDisplay from './components/LeaveBalanceDisplay';
import LeaveHistoryTable from './components/LeaveHistoryTable';
import LeaveApprovalDashboard from './components/LeaveApprovalDashboard';
import LeaveCalendar from './components/LeaveCalendar';

// Compliance Management Components
import { ComplianceManagement } from './pages/compliance';

// Main Router component
const Router: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/recruitment" element={<RecruitmentApplication />} />

      {/* Onboarding Routes - Protected but bypassed by OnboardingGuard */}
      <Route
        path="/onboarding/*"
        element={
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading onboarding...</p>
            </div>
          </div>}>
            <OnboardingWizard />
          </Suspense>
        }
      />

      {/* Dashboard redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<AuthGuard requireOnboarding={true}><DashboardRouter /></AuthGuard>} />

      {/* Staff Routes - Accessible by all authenticated users with completed onboarding */}
      <Route element={<AuthGuard requireOnboarding={true} />}>
        <Route path="/shifts" element={<MyShifts />} />
        <Route path="/shifts/new" element={<StartShift />} />
        <Route path="/shifts/:id" element={<ShiftDetails />} />
        <Route path="/shifts/:id/checkin" element={<ShiftCheckIn />} />
        <Route path="/shifts/:id/checkout" element={<ShiftCheckOut />} />
        <Route path="/shifts/:id/end" element={<EndShift />} />
        <Route path="/shifts/:id/checks" element={<ShiftChecks />} />
        <Route path="/shifts/exchange" element={<ShiftExchange />} />
        <Route path="/invoices" element={<MyInvoices />} />
        <Route path="/invoices/:id" element={<div>Invoice Details</div>} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Leave Management - Consolidated Routes */}
        <Route path="/leave/*" element={<LeaveManagement />} />
      </Route>

      {/* Manager Routes - Accessible by Managers and Admins with completed onboarding */}
      <Route element={<AuthGuard requireOnboarding={true} allowedRoles={[UserRole.MANAGER, UserRole.ADMIN]} />}>
        <Route
          path="/staff-shifts"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading staff shifts...</span></div>}>
              <StaffShifts />
            </Suspense>
          }
        />
        <Route
          path="/approvals"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading approvals...</span></div>}>
              <Approvals />
            </Suspense>
          }
        />
        <Route path="/approvals/:id" element={<ShiftApproval />} />

        {/* Compliance Management - Consolidated Routes */}
        <Route path="/compliance/*" element={<ComplianceManagement />} />

      </Route>

      {/* Admin Routes - Only accessible by Admins with completed onboarding */}
      <Route element={<AuthGuard requireOnboarding={true} allowedRoles={[UserRole.ADMIN]} />}>
        <Route
          path="/admin/staff"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading staff management...</span></div>}>
              <StaffManagement />
            </Suspense>
          }
        />
        <Route
          path="/admin/venues"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading venues...</span></div>}>
              <VenueManagement />
            </Suspense>
          }
        />
        <Route path="/admin/scheduling" element={<ShiftScheduling />} />
        <Route path="/admin/invoices" element={<InvoiceGeneration />} />
        <Route path="/admin/payrates" element={<div>Pay Rates</div>} />
        <Route
          path="/admin/deputy"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading deputy integration...</span></div>}>
              <DeputyIntegration />
            </Suspense>
          }
        />
        <Route path="/admin/deputy/sync" element={<div>Deputy Sync</div>} />
        <Route
          path="/admin/recruitment"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading recruitment...</span></div>}>
              <RecruitmentManagement />
            </Suspense>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading reports...</span></div>}>
              <Reports />
            </Suspense>
          }
        />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading reports dashboard...</span></div>}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="/reports/*"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading reports...</span></div>}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route path="/admin/finance-integrations" element={<FinanceIntegrations />} />
        <Route path="/admin/finance-integrations/oauth-callback" element={<FinanceIntegrationsOAuthCallback />} />

        {/* Compliance Settings - Admin Access */}
        <Route
          path="/admin/compliance-settings"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading compliance settings...</span></div>}>
              <ComplianceSettings level="global" canEdit={true} />
            </Suspense>
          }
        />
        <Route
          path="/admin/compliance-settings/venue/:venueId"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading venue compliance settings...</span></div>}>
              <ComplianceSettings level="venue" canEdit={true} />
            </Suspense>
          }
        />
        <Route
          path="/admin/compliance-settings/staff/:staffId"
          element={
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="text-gray-600">Loading staff compliance settings...</span></div>}>
              <ComplianceSettings level="staff" canEdit={true} />
            </Suspense>
          }
        />

        <Route path="/admin/settings" element={<Settings />} />
      </Route>

      {/* 404 Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// Component that shows the appropriate dashboard based on user role
// Authentication and onboarding checks are now handled by AuthGuard
const DashboardRouter: React.FC = () => {
  const { isUserRole } = useAuth();

  // Check role and return appropriate dashboard
  if (isUserRole(UserRole.ADMIN)) {
    return <AdminDashboard />;
  }

  if (isUserRole(UserRole.MANAGER)) {
    return <ManagerDashboard />;
  }

  // Default to staff dashboard for any other role
  return <StaffDashboard />;
};

export default Router;
