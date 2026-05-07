// IncidentsPage — admin review surface for staff-filed incident reports.
// Composition mirrors RecruitmentPage / VenuesPage:
// header (with tabs inside) + view body + drawer + modal.
import { useEffect, useMemo, useState } from "react";
import { tokens } from "../../design-system/tokens";
import { Card } from "../../design-system/primitives/Card";
import { useAuth } from "../../contexts/AuthContext";
import { useIncidentsData } from "./hooks/useIncidentsData";
import {
  IncidentsHeader,
  type IncidentsTab,
} from "./components/IncidentsHeader";
import { IncidentsView } from "./components/IncidentsView";
import { IncidentDrawer } from "./components/IncidentDrawer";
import { ResolveIncidentModal } from "./components/ResolveIncidentModal";
import type { IncidentReport } from "../../services/incidentService";

function isManager(role?: string, membershipRole?: string): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return (
    r === "admin" || r === "manager" || m === "admin" || m === "manager" || m === "owner"
  );
}

export default function IncidentsPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;

  const [view, setView] = useState<IncidentsTab>("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<IncidentReport | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const data = useIncidentsData();

  const visible = useMemo(() => {
    let list = data.incidents;
    if (view === "open") list = list.filter((i) => !i.resolved);
    else if (view === "resolved") list = list.filter((i) => i.resolved);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        (i.venue_name ?? "").toLowerCase().includes(q) ||
        (i.reported_by_name ?? "").toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [data.incidents, view, search]);

  // Keep drawer in sync as cache invalidates after a mutation.
  useEffect(() => {
    if (!selected) return;
    const fresh = data.incidents.find((i) => i.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [data.incidents, selected]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

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
            Incident review is available to managers and admins. If you've
            filed an incident from the mobile app, your manager will follow up.
          </div>
        </Card>
      </main>
    );
  }

  const openDrawer = (incident: IncidentReport) => {
    setSelected(incident);
    setDrawerOpen(true);
  };

  const handleResolveSubmit = async (
    id: number,
    payload: { followup_notes?: string; requires_followup?: boolean },
  ) => {
    await data.resolveIncident.mutateAsync({ id, payload });
    setToast("Incident marked resolved.");
  };

  const emptyCopy: Record<IncidentsTab, { title: string; hint?: string }> = {
    all: {
      title: "No incidents reported",
      hint: "Reports filed from the mobile app appear here.",
    },
    open: {
      title: "No open incidents",
      hint: "Every incident has been reviewed and resolved.",
    },
    resolved: {
      title: "No resolved incidents yet",
    },
  };

  return (
    <>
      <IncidentsHeader
        view={view}
        onViewChange={setView}
        stats={data.stats}
        search={search}
        onSearchChange={setSearch}
      />

      <IncidentsView
        incidents={visible}
        isLoading={data.isLoading}
        emptyTitle={emptyCopy[view].title}
        emptyHint={emptyCopy[view].hint}
        onSelect={openDrawer}
      />

      <IncidentDrawer
        open={drawerOpen}
        incident={selected}
        onClose={() => setDrawerOpen(false)}
        onResolveClick={(i) => {
          setSelected(i);
          setResolveOpen(true);
        }}
        isMutating={data.resolveIncident.isPending}
      />

      <ResolveIncidentModal
        open={resolveOpen}
        incident={selected}
        onClose={() => setResolveOpen(false)}
        onSubmit={handleResolveSubmit}
        isSubmitting={data.resolveIncident.isPending}
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
