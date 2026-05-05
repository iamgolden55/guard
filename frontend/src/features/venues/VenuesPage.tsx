// VenuesPage — admin "Operations → Venues" CRUD surface.
// Composition mirrors AttendancePage / RecruitmentPage: header (with tabs
// inside it) + view-per-tab + drawer + form modal + delete modal + toast.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../../design-system/primitives/Card";
import { tokens } from "../../design-system/tokens";
import type { Venue } from "../../types/venue";
import { DeleteVenueModal } from "./components/DeleteVenueModal";
import { VenueDrawer } from "./components/VenueDrawer";
import { VenueFormModal } from "./components/VenueFormModal";
import { VenuesCardsView } from "./components/VenuesCardsView";
import {
  VenuesHeader,
  type VenuesTab,
  type VenuesViewMode,
} from "./components/VenuesHeader";
import { VenuesMapView } from "./components/VenuesMapView";
import { VenuesView } from "./components/VenuesView";
import { useVenuesData } from "./hooks/useVenuesData";

const VIEW_MODE_KEY = "ms-venues-view-mode";

function readStoredViewMode(): VenuesViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === "list" || v === "cards" || v === "map") return v;
  } catch {
    // ignore
  }
  return "list";
}

function isAdmin(
  role: string | undefined,
  membershipRole: string | undefined,
): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return r === "admin" || m === "admin" || m === "owner";
}

export default function VenuesPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;

  const [view, setView] = useState<VenuesTab>("active");
  const [viewMode, setViewMode] = useState<VenuesViewMode>(() =>
    readStoredViewMode(),
  );
  const [search, setSearch] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState<Venue | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const data = useVenuesData();

  // Filter by tab + search.
  const visibleVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.venues.filter((v) => {
      if (view === "active" && !v.is_active) return false;
      if (view === "inactive" && v.is_active) return false;
      if (q) {
        const hay = `${v.name} ${v.city} ${v.address}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.venues, view, search]);

  // Keep the drawer's selected venue in sync after invalidations.
  useEffect(() => {
    if (!selectedVenue?.id) return;
    const fresh = data.venues.find((v) => v.id === selectedVenue.id);
    if (fresh && fresh !== selectedVenue) {
      setSelectedVenue(fresh);
    }
  }, [data.venues, selectedVenue]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Honour ?focus=<id> from the topbar search palette.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  useEffect(() => {
    if (!focusId) return;
    const id = Number(focusId);
    if (!Number.isFinite(id)) return;
    const venue = data.venues.find((v) => v.id === id);
    if (!venue) return;
    setView(venue.is_active ? "active" : "inactive");
    setSelectedVenue(venue);
    setDrawerOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }, [focusId, data.venues, searchParams, setSearchParams]);

  // Persist view mode.
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // Permission gate.
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
            Venue management is available to admin users. Speak to your team
            owner if you need access.
          </div>
        </Card>
      </main>
    );
  }

  // Action handlers.
  const openDrawer = (v: Venue) => {
    setSelectedVenue(v);
    setDrawerOpen(true);
  };

  const handleNewVenue = () => {
    setEditingVenue(null);
    setFormOpen(true);
  };

  const handleEdit = (v: Venue) => {
    setEditingVenue(v);
    setFormOpen(true);
  };

  const handleToggleStatus = async (v: Venue) => {
    if (!v.id) return;
    try {
      await data.toggleStatus.mutateAsync({
        id: v.id,
        isActive: !v.is_active,
      });
      setToast(
        v.is_active ? `${v.name} deactivated.` : `${v.name} reactivated.`,
      );
    } catch {
      setToast("Couldn't update status. Please try again.");
    }
  };

  const handleDeleteClick = (v: Venue) => {
    setDeletingVenue(v);
  };

  const handleConfirmDelete = async (id: number) => {
    const name = deletingVenue?.name ?? "Venue";
    await data.deleteVenue.mutateAsync(id);
    setToast(`${name} deleted.`);
    if (selectedVenue?.id === id) {
      setSelectedVenue(null);
      setDrawerOpen(false);
    }
  };

  const handleSubmitVenue = async (venue: Venue) => {
    if (venue.id) {
      const updated = await data.updateVenue.mutateAsync({
        id: venue.id,
        data: venue,
      });
      setToast(`${updated.name} saved.`);
      // Keep the drawer open on the updated venue.
      setSelectedVenue(updated);
    } else {
      const created = await data.createVenue.mutateAsync(venue);
      setToast(`${created.name} created.`);
    }
  };

  const isMutating =
    data.createVenue.isPending ||
    data.updateVenue.isPending ||
    data.toggleStatus.isPending ||
    data.deleteVenue.isPending;

  // Empty-state copy per tab.
  const emptyCopy: Record<VenuesTab, { title: string; hint?: string }> = {
    active: {
      title: "No active venues yet",
      hint: search
        ? "Try a different search term or check the All tab."
        : "Click New venue to add one.",
    },
    inactive: {
      title: "No inactive venues",
      hint: "Deactivated venues will appear here.",
    },
    all: {
      title: "No venues yet",
      hint: "Click New venue to add the first one.",
    },
  };

  return (
    <>
      <VenuesHeader
        view={view}
        onViewChange={setView}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        counts={data.counts}
        search={search}
        onSearchChange={setSearch}
        onNewVenue={handleNewVenue}
      />

      {viewMode === "list" && (
        <VenuesView
          venues={visibleVenues}
          isLoading={data.isLoading}
          emptyTitle={emptyCopy[view].title}
          emptyHint={emptyCopy[view].hint}
          onSelect={openDrawer}
        />
      )}

      {viewMode === "cards" && (
        <VenuesCardsView
          venues={visibleVenues}
          isLoading={data.isLoading}
          emptyTitle={emptyCopy[view].title}
          emptyHint={emptyCopy[view].hint}
          onSelect={openDrawer}
        />
      )}

      {viewMode === "map" && (
        <VenuesMapView
          venues={visibleVenues}
          isLoading={data.isLoading}
          onSelect={openDrawer}
        />
      )}

      <VenueDrawer
        open={drawerOpen}
        venue={selectedVenue}
        onClose={() => setDrawerOpen(false)}
        onEdit={handleEdit}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteClick}
        isMutating={isMutating}
      />

      <VenueFormModal
        open={formOpen}
        venue={editingVenue}
        onClose={() => {
          setFormOpen(false);
          setEditingVenue(null);
        }}
        onSubmit={handleSubmitVenue}
        isSubmitting={data.createVenue.isPending || data.updateVenue.isPending}
      />

      <DeleteVenueModal
        open={deletingVenue != null}
        venue={deletingVenue}
        onClose={() => setDeletingVenue(null)}
        onConfirm={handleConfirmDelete}
        isSubmitting={data.deleteVenue.isPending}
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
