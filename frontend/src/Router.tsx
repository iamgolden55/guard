import { Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import FullScreenAppLayout from "./layouts/FullScreenAppLayout";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import PasswordResetRequestPage from "./features/auth/PasswordResetRequestPage";
import PasswordResetConfirmPage from "./features/auth/PasswordResetConfirmPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import AttendancePage from "./features/attendance/AttendancePage";
import CompliancePage from "./features/compliance/CompliancePage";
import IncidentsPage from "./features/incidents/IncidentsPage";
import IntegrationsPage from "./features/integrations/IntegrationsPage";
import OAuthCallbackPage from "./features/integrations/OAuthCallbackPage";
import InvoicesPage from "./features/invoices/InvoicesPage";
import LeaveManagementPage from "./features/leave/LeaveManagementPage";
import PayrollPage from "./features/payroll/PayrollPage";
import PayRatesPage from "./features/settings/PayRatesPage";
import ProfilePage from "./features/profile/ProfilePage";
import RecruitmentPage from "./features/recruitment/RecruitmentPage";
import ApplyPage from "./features/recruitment/ApplyPage";
import SchedulingPage from "./features/scheduling/SchedulingPage";
import StaffPage from "./features/staff/StaffPage";
import VenuesPage from "./features/venues/VenuesPage";
import ThemeSmokePage from "./features/dev/ThemeSmokePage";
import { Card, SectionHeader, textStyles } from "./design-system";

// Phase 2 stub — protected routes mount inside AppLayout (Sidebar +
// Topbar + scrollable main). Phases 3-7 build out each screen.
function PagePlaceholder({ title }: { title: string }) {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Card padding={28}>
        <SectionHeader title={title} subtitle="Coming soon — placeholder" />
        <p style={{ ...textStyles.body }}>
          This route is reachable. The full screen will be built out in a later phase
          against <code>project/{title}.html</code>.
        </p>
      </Card>
    </div>
  );
}

export default function Router() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<PasswordResetRequestPage />} />
        <Route
          path="/reset-password/confirm/:token"
          element={<PasswordResetConfirmPage />}
        />
      </Route>

      {/* Dev-only token swatch page (no auth, no chrome) */}
      <Route path="/dev/theme" element={<ThemeSmokePage />} />

      {/* Public recruitment apply form (no auth, no chrome) */}
      <Route path="/apply/:companySlug" element={<ApplyPage />} />

      {/* Protected app — standard layout */}
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* OAuth callback inherits AppLayout chrome; legacy redirect URI
              path preserved so backend's whitelist keeps working. */}
          <Route
            path="/admin/finance-integrations/oauth-callback"
            element={<OAuthCallbackPage />}
          />
          <Route
            path="/integrations/oauth/callback"
            element={<OAuthCallbackPage />}
          />
        </Route>

        {/* Routes with their own page-level header bring no AppLayout topbar. */}
        <Route element={<FullScreenAppLayout />}>
          <Route path="/scheduling" element={<SchedulingPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/settings/pay-rates" element={<PayRatesPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/leave" element={<LeaveManagementPage />} />
          <Route path="/recruitment" element={<RecruitmentPage />} />
          <Route path="/venues" element={<VenuesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
