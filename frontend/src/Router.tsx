import { Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import LoginPage from "./features/auth/LoginPage";
import DashboardPage from "./features/dashboard/DashboardPage";
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
      </Route>

      {/* Dev-only token swatch page (no auth, no chrome) */}
      <Route path="/dev/theme" element={<ThemeSmokePage />} />

      {/* Protected app */}
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/scheduling" element={<PagePlaceholder title="Scheduling" />} />
          <Route path="/attendance" element={<PagePlaceholder title="Attendance" />} />
          <Route path="/invoices" element={<PagePlaceholder title="Invoices" />} />
          <Route path="/payroll" element={<PagePlaceholder title="Payroll" />} />
          <Route path="/staff" element={<PagePlaceholder title="Staff" />} />
          <Route path="/leave" element={<PagePlaceholder title="Leave" />} />
          <Route path="/venues" element={<PagePlaceholder title="Venues" />} />
          <Route path="/compliance" element={<PagePlaceholder title="Compliance" />} />
          <Route path="/incidents" element={<PagePlaceholder title="Incidents" />} />
          <Route path="/recruitment" element={<PagePlaceholder title="Recruitment" />} />
          <Route path="/integrations" element={<PagePlaceholder title="Integrations" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
