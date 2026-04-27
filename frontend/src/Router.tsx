import { Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import LoginPage from "./features/auth/LoginPage";
import ThemeSmokePage from "./features/dev/ThemeSmokePage";
import { Card, SectionHeader, textStyles, tokens } from "./design-system";

// Phase 1 stub — each route renders an MSCard placeholder. Phase 2 wraps
// these in AppLayout (Sidebar + Topbar). Phases 3-7 build out each screen.
function PagePlaceholder({ title }: { title: string }) {
  return (
    <div
      className="min-h-screen p-8"
      style={{ background: tokens.color.ink50 }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Card padding={32}>
          <SectionHeader
            title={title}
            subtitle="Coming soon — Phase 1 placeholder"
          />
          <p style={{ ...textStyles.body }}>
            This route is reachable. The full screen will be built out in a later phase
            against the prototype at <code>project/{title}.html</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Dev-only token swatch page. Safe to keep in prod since it's
          intentionally unlinked, but feel free to gate behind import.meta.env.DEV
          when stripping pre-launch. */}
      <Route path="/dev/theme" element={<ThemeSmokePage />} />

      <Route element={<AuthGuard />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<PagePlaceholder title="Dashboard" />} />
        <Route path="/scheduling" element={<PagePlaceholder title="Scheduling" />} />
        <Route path="/attendance" element={<PagePlaceholder title="Attendance" />} />
        <Route path="/invoices" element={<PagePlaceholder title="Invoices" />} />
        <Route path="/payroll" element={<PagePlaceholder title="Payroll" />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
