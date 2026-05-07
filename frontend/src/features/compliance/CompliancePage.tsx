// CompliancePage — admin compliance surface.
// Composition mirrors RecruitmentPage / VenuesPage:
// header (with tabs inside) + view-per-tab + drawer + modals.
import { useEffect, useMemo, useState } from "react";
import { tokens } from "../../design-system/tokens";
import { Card } from "../../design-system/primitives/Card";
import { useAuth } from "../../contexts/AuthContext";
import { ComplianceService } from "../../services/complianceService";
import { useQuery } from "@tanstack/react-query";
import { useComplianceData } from "./hooks/useComplianceData";
import {
  ComplianceHeader,
  type ComplianceTab,
  type ComplianceStats,
} from "./components/ComplianceHeader";
import { OverviewView } from "./components/OverviewView";
import { ViolationsView } from "./components/ViolationsView";
import { WorkingHoursView } from "./components/WorkingHoursView";
import { ProfilesView } from "./components/ProfilesView";
import { ViolationDrawer } from "./components/ViolationDrawer";
import { ResolveViolationModal } from "./components/ResolveViolationModal";
import { ProfileFormModal } from "./components/ProfileFormModal";
import type {
  ComplianceProfile,
  ComplianceViolation,
  ViolationFilters,
  ViolationResolution,
  WorkingHoursRegulation,
  PaginatedResponse,
} from "../../types/compliance";

type Period = "weekly" | "monthly" | "quarterly";

// CSV helpers — keep here rather than a shared util since this is the only
// caller for now. Quotes around every cell and escapes embedded quotes per RFC 4180.
function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function violationsToCsv(violations: ComplianceViolation[]): string {
  const header = [
    "ID",
    "User",
    "Email",
    "Violation type",
    "Severity",
    "Period start",
    "Period end",
    "Threshold exceeded",
    "Description",
    "Status",
    "System generated",
    "Created at",
  ];
  const rows = violations.map((v) => [
    v.id,
    v.user_data?.full_name ?? v.user_data?.username ?? "",
    v.user_data?.email ?? "",
    v.violation_type_display ?? v.violation_type,
    v.severity_display ?? v.severity,
    v.period_start,
    v.period_end,
    v.threshold_exceeded,
    v.description,
    v.resolution_status_display ?? v.resolution_status,
    v.system_generated ? "yes" : "no",
    (v as { created_at?: string }).created_at ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isManager(role?: string, membershipRole?: string): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return (
    r === "admin" || r === "manager" || m === "admin" || m === "manager" || m === "owner"
  );
}

export default function CompliancePage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;

  const [view, setView] = useState<ComplianceTab>("overview");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("weekly");
  const [selected, setSelected] = useState<ComplianceViolation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<{
    open: boolean;
    profile: ComplianceProfile | null;
  }>({ open: false, profile: null });
  const [toast, setToast] = useState<string | null>(null);

  const violationFilters = useMemo<ViolationFilters>(
    () => ({
      // Overview shows recent open; Violations tab shows all (filterable later).
      ...(view === "overview" ? { resolved: false } : {}),
    }),
    [view],
  );

  const data = useComplianceData({
    violationFilters,
    metricsParams: { period_type: period },
  });

  // Regulations are loaded only when the new-profile flow needs them.
  const regulationsQuery = useQuery<PaginatedResponse<WorkingHoursRegulation>>({
    queryKey: ["compliance", "regulations"],
    queryFn: () => ComplianceService.getRegulations(),
    enabled: profileForm.open && profileForm.profile == null,
    staleTime: 60_000,
  });

  // Keep the open drawer in sync with cache invalidations.
  useEffect(() => {
    if (!selected) return;
    const fresh = data.violations.find((v) => v.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [data.violations, selected]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Client-side filter for the Violations tab.
  const visibleViolations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.violations;
    return data.violations.filter((v) => {
      const name = (v.user_data?.full_name ?? "").toLowerCase();
      const email = (v.user_data?.email ?? "").toLowerCase();
      const type = (
        v.violation_type_display ??
        v.violation_type ??
        ""
      ).toLowerCase();
      return name.includes(q) || email.includes(q) || type.includes(q);
    });
  }, [data.violations, search]);

  const stats: ComplianceStats = useMemo(() => {
    let open = 0;
    let critical = 0;
    for (const v of data.violations) {
      if (!v.is_resolved) open += 1;
      if (v.severity === "critical" && !v.is_resolved) critical += 1;
    }
    return { total: data.violations.length, open, critical };
  }, [data.violations]);

  if (!isManager(userRole, membershipRole)) {
    return (
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 28,
          background: tokens.color.ink50,
        }}
      >
        <Card padding={32}>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 18,
              color: tokens.color.ink900,
              marginBottom: 6,
            }}
          >
            Managers and admins only
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.ink600,
            }}
          >
            Compliance review is restricted to managers and admins.
          </div>
        </Card>
      </main>
    );
  }

  const openDrawer = (v: ComplianceViolation) => {
    setSelected(v);
    setDrawerOpen(true);
  };

  const handleResolveSubmit = async (
    id: number,
    resolution: ViolationResolution,
  ) => {
    await data.resolveViolation.mutateAsync({ id, resolution });
    setToast("Violation resolved.");
  };

  const handleSetActive = async (profile: ComplianceProfile) => {
    try {
      await data.setActiveProfile.mutateAsync(profile.id);
      setToast(`${profile.name} is now the active profile.`);
    } catch {
      setToast("Couldn't set active profile.");
    }
  };

  const handleProfileSubmit = async (
    payload: Partial<ComplianceProfile> & { id?: number },
  ) => {
    const { id, ...rest } = payload;
    await data.upsertProfile.mutateAsync({ id, payload: rest });
    setToast(id ? "Profile updated." : "Profile created.");
  };

  const showSearch = view === "violations";
  const showCreateProfile = view === "profiles";

  const handleExport = () => {
    const rows = visibleViolations;
    if (rows.length === 0) {
      setToast("Nothing to export — no violations match.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(
      `compliance-violations-${stamp}.csv`,
      violationsToCsv(rows),
      "text/csv",
    );
    setToast(`Exported ${rows.length} violation${rows.length === 1 ? "" : "s"}.`);
  };

  return (
    <>
      <ComplianceHeader
        view={view}
        onViewChange={setView}
        stats={stats}
        search={search}
        onSearchChange={setSearch}
        onCreateProfile={() => setProfileForm({ open: true, profile: null })}
        onExport={handleExport}
        exportLabel={
          view === "violations" ? "Export violations" : "Export"
        }
        exportDisabled={view !== "violations"}
        showSearch={showSearch}
        showCreateProfile={showCreateProfile}
      />

      {view === "overview" && (
        <OverviewView
          dashboard={data.dashboard}
          recentViolations={data.violations}
          isLoading={data.isDashboardLoading || data.isViolationsLoading}
          onSelectViolation={openDrawer}
        />
      )}

      {view === "violations" && (
        <ViolationsView
          violations={visibleViolations}
          isLoading={data.isViolationsLoading}
          emptyTitle={
            search ? "No matching violations" : "No violations on file"
          }
          emptyHint={
            search
              ? "Try a different name, email, or violation type."
              : "Compliance breaches will appear here as they're detected."
          }
          onSelect={openDrawer}
        />
      )}

      {view === "working-hours" && (
        <WorkingHoursView
          metrics={data.metrics}
          isLoading={data.isMetricsLoading}
          period={period}
          onPeriodChange={setPeriod}
        />
      )}

      {view === "profiles" && (
        <ProfilesView
          profiles={data.profiles}
          isLoading={data.isProfilesLoading}
          isMutating={data.setActiveProfile.isPending || data.upsertProfile.isPending}
          onSetActive={handleSetActive}
          onEdit={(p) => setProfileForm({ open: true, profile: p })}
          onCreate={() => setProfileForm({ open: true, profile: null })}
        />
      )}

      <ViolationDrawer
        open={drawerOpen}
        violation={selected}
        onClose={() => setDrawerOpen(false)}
        onResolveClick={(v) => {
          setSelected(v);
          setResolveOpen(true);
        }}
        isMutating={data.resolveViolation.isPending}
      />

      <ResolveViolationModal
        open={resolveOpen}
        violation={selected}
        onClose={() => setResolveOpen(false)}
        onSubmit={handleResolveSubmit}
        isSubmitting={data.resolveViolation.isPending}
      />

      <ProfileFormModal
        open={profileForm.open}
        profile={profileForm.profile}
        regulations={regulationsQuery.data?.results ?? []}
        onClose={() => setProfileForm({ open: false, profile: null })}
        onSubmit={handleProfileSubmit}
        isSubmitting={data.upsertProfile.isPending}
      />

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 20px",
            borderRadius: 999,
            background: tokens.color.ink900,
            color: "white",
            fontFamily: tokens.font.body,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 32px -8px rgba(32,31,30,0.4)",
            zIndex: tokens.z.toast,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
