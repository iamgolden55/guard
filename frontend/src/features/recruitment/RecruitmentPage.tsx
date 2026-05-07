// RecruitmentPage — admin "People → Recruitment" review surface.
// Composition mirrors AttendancePage: header (with tabs inside it) + view-per-tab + drawer + modals.
import { useEffect, useMemo, useState } from "react";
import { tokens } from "../../design-system/tokens";
import { Card } from "../../design-system/primitives/Card";
import { useAuth } from "../../contexts/AuthContext";
import { useRecruitmentData } from "./hooks/useRecruitmentData";
import {
  RecruitmentHeader,
  type RecruitmentTab,
} from "./components/RecruitmentHeader";
import { ApplicationsView } from "./components/ApplicationsView";
import { ApplicationDrawer } from "./components/ApplicationDrawer";
import { RejectReasonModal } from "./components/RejectReasonModal";
import { ConvertToUserModal } from "./components/ConvertToUserModal";
import type { RecruitmentApplication } from "../../services/recruitmentService";

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function applicationsToCsv(apps: RecruitmentApplication[]): string {
  const header = [
    "ID",
    "Name",
    "Email",
    "Phone",
    "Employment type",
    "Has SIA licence",
    "Hours/week",
    "Status",
    "Applied",
  ];
  const rows = apps.map((a) => [
    a.id,
    a.full_name,
    a.email,
    (a as { phone_number?: string }).phone_number ?? "",
    (a as { employment_type_name?: string }).employment_type_name ?? "",
    a.has_sia_licence ? "yes" : "no",
    a.hours_per_week ?? "",
    a.status,
    a.created_at,
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

function isAdmin(
  role: string | undefined,
  membershipRole: string | undefined,
): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return r === "admin" || m === "admin" || m === "owner";
}

export default function RecruitmentPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;

  const [view, setView] = useState<RecruitmentTab>("pending");
  const [search, setSearch] = useState("");
  const [selectedApplication, setSelectedApplication] =
    useState<RecruitmentApplication | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Tab → server-side `status` filter. "all" passes undefined.
  const filters = useMemo(
    () => ({
      status: view === "all" ? undefined : view,
    }),
    [view],
  );

  const data = useRecruitmentData({ filters });

  // ── Search filter (client-side) ────────────────────────────────────────────
  const visibleApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.applications;
    return data.applications.filter(
      (app) =>
        app.full_name.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q),
    );
  }, [data.applications, search]);

  // Keep the selected application's drawer in sync with cache invalidation.
  useEffect(() => {
    if (!selectedApplication) return;
    const fresh = data.applications.find(
      (a) => a.id === selectedApplication.id,
    );
    if (fresh && fresh !== selectedApplication) {
      setSelectedApplication(fresh);
    }
  }, [data.applications, selectedApplication]);

  // ── Toast auto-dismiss ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!copyFeedback) return;
    const t = window.setTimeout(() => setCopyFeedback(null), 1800);
    return () => window.clearTimeout(t);
  }, [copyFeedback]);

  // ── Permission gate (admin/owner only) ─────────────────────────────────────
  if (!isAdmin(userRole, membershipRole)) {
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
            Admins only
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.ink600,
            }}
          >
            Recruitment review is available to admin users. Speak to your team
            owner if you need access.
          </div>
        </Card>
      </main>
    );
  }

  // ── Apply link ────────────────────────────────────────────────────────────
  const applyUrl = data.companySlug
    ? `${window.location.origin}/apply/${data.companySlug}`
    : null;

  const handleCopyApplyLink = async () => {
    if (!applyUrl) return;
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopyFeedback("Copied!");
    } catch {
      setCopyFeedback("Press ⌘C to copy");
    }
  };

  // ── Action handlers ────────────────────────────────────────────────────────
  const openDrawer = (app: RecruitmentApplication) => {
    setSelectedApplication(app);
    setDrawerOpen(true);
  };

  const handleApprove = async (app: RecruitmentApplication) => {
    try {
      await data.approveApplication.mutateAsync({ id: app.id });
      setToast(`${app.full_name} approved.`);
    } catch {
      setToast("Couldn't approve. Please try again.");
    }
  };

  const handleRejectSubmit = async (id: number, notes: string) => {
    await data.rejectApplication.mutateAsync({ id, notes });
    const app = data.applications.find((a) => a.id === id);
    setToast(`${app?.full_name ?? "Application"} rejected.`);
  };

  const handleSave = async (
    id: number,
    patch: Partial<RecruitmentApplication>,
  ) => {
    await data.updateApplication.mutateAsync({ id, patch });
    setToast("Application updated.");
  };

  const handleConvert = async (id: number) => {
    try {
      const result = await data.convertToUser.mutateAsync(id);
      const u = result?.user as
        | { first_name?: string; last_name?: string; username?: string }
        | undefined;
      const name =
        `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() ||
        u?.username ||
        "the new user";
      setToast(`Created staff account for ${name}.`);
    } catch {
      setToast("Couldn't convert to user. Please try again.");
    }
  };

  const isMutating =
    data.approveApplication.isPending ||
    data.rejectApplication.isPending ||
    data.convertToUser.isPending;

  // ── View body per tab ─────────────────────────────────────────────────────
  const emptyCopy: Record<RecruitmentTab, { title: string; hint?: string }> = {
    pending: {
      title: "No applications pending review",
      hint: "New applications will appear here as candidates apply.",
    },
    approved: { title: "No approved applications yet" },
    rejected: { title: "No rejected applications" },
    all: { title: "No applications yet", hint: applyUrl ? "Share the apply link to start receiving candidates." : undefined },
  };

  return (
    <>
      <RecruitmentHeader
        view={view}
        onViewChange={setView}
        stats={data.stats}
        search={search}
        onSearchChange={setSearch}
        applyUrl={applyUrl}
        onCopyApplyLink={handleCopyApplyLink}
        copyFeedback={copyFeedback}
        onExport={() => {
          if (visibleApplications.length === 0) {
            setToast("Nothing to export — no applications match.");
            return;
          }
          const stamp = new Date().toISOString().slice(0, 10);
          downloadFile(
            `recruitment-applications-${stamp}.csv`,
            applicationsToCsv(visibleApplications),
            "text/csv",
          );
          setToast(
            `Exported ${visibleApplications.length} application${visibleApplications.length === 1 ? "" : "s"}.`,
          );
        }}
        exportDisabled={visibleApplications.length === 0}
      />

      <ApplicationsView
        applications={visibleApplications}
        isLoading={data.isLoading}
        emptyTitle={emptyCopy[view].title}
        emptyHint={emptyCopy[view].hint}
        onSelect={openDrawer}
      />

      <ApplicationDrawer
        open={drawerOpen}
        application={selectedApplication}
        onClose={() => setDrawerOpen(false)}
        onApprove={handleApprove}
        onRejectClick={(app) => {
          setSelectedApplication(app);
          setRejectOpen(true);
        }}
        onConvertClick={(app) => {
          setSelectedApplication(app);
          setConvertOpen(true);
        }}
        onSave={handleSave}
        isMutating={isMutating}
        isSaving={data.updateApplication.isPending}
      />

      <RejectReasonModal
        open={rejectOpen}
        application={selectedApplication}
        onClose={() => setRejectOpen(false)}
        onSubmit={handleRejectSubmit}
        isSubmitting={data.rejectApplication.isPending}
      />

      <ConvertToUserModal
        open={convertOpen}
        application={selectedApplication}
        onClose={() => setConvertOpen(false)}
        onConfirm={handleConvert}
        isSubmitting={data.convertToUser.isPending}
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
