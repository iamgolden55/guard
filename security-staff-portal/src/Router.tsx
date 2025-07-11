import type React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components';
import { UserRole } from './types';
import { useAuth } from './contexts/AuthContext';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/auth';
import { NotFoundPage, UnauthorizedPage } from './pages/shared';

// Dashboard Pages
import { StaffDashboard, StartShift, EndShift, ShiftChecks, MyShifts, MyInvoices, ProfilePage, ShiftExchange, ShiftCheckIn, ShiftCheckOut } from './pages/staff';
import { ManagerDashboard, ShiftApproval } from './pages/manager';
import { AdminDashboard, InvoiceGeneration, ShiftScheduling, Settings } from './pages/admin';

// New Components
import StaffShifts from './pages/manager/StaffShifts';
import Approvals from './pages/manager/Approvals';
import StaffManagement from './pages/admin/StaffManagement';
import VenueManagement from './pages/admin/VenueManagement';
import DeputyIntegration from './pages/admin/DeputyIntegration';
import RecruitmentManagement from './pages/admin/RecruitmentManagement';
import RecruitmentApplication from './pages/public/RecruitmentApplication';
import Reports from './pages/admin/Reports';

// Main Router component
const Router: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/recruitment" element={<RecruitmentApplication />} />

      {/* Dashboard redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardRouter />} />

      {/* Staff Routes - Accessible by all authenticated users */}
      <Route element={<ProtectedRoute />}>
        <Route path="/shifts" element={<MyShifts />} />
        <Route path="/shifts/new" element={<StartShift />} />
        <Route path="/shifts/:id" element={<div>Shift Details</div>} />
        <Route path="/shifts/:id/checkin" element={<ShiftCheckIn />} />
        <Route path="/shifts/:id/checkout" element={<ShiftCheckOut />} />
        <Route path="/shifts/:id/end" element={<EndShift />} />
        <Route path="/shifts/:id/checks" element={<ShiftChecks />} />
        <Route path="/shifts/exchange" element={<ShiftExchange />} />
        <Route path="/invoices" element={<MyInvoices />} />
        <Route path="/invoices/:id" element={<div>Invoice Details</div>} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Manager Routes - Accessible by Managers and Admins */}
      <Route element={<ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.ADMIN]} />}>
        <Route path="/staff-shifts" element={<StaffShifts />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/approvals/:id" element={<ShiftApproval />} />
      </Route>

      {/* Admin Routes - Only accessible by Admins */}
      <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
        <Route path="/admin/staff" element={<StaffManagement />} />
        <Route path="/admin/venues" element={<VenueManagement />} />
        <Route path="/admin/scheduling" element={<ShiftScheduling />} />
        <Route path="/admin/invoices" element={<InvoiceGeneration />} />
        <Route path="/admin/payrates" element={<div>Pay Rates</div>} />
        <Route path="/admin/deputy" element={<DeputyIntegration />} />
        <Route path="/admin/deputy/sync" element={<div>Deputy Sync</div>} />
        <Route path="/admin/recruitment" element={<RecruitmentManagement />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Route>

      {/* 404 Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// Component that shows the appropriate dashboard based on user role
const DashboardRouter: React.FC = () => {
  const { authState, isUserRole } = useAuth();

  // If not authenticated, redirect to login
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

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
