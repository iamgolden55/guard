// IntegrationsPage — admin surface to connect/manage external services.
// Composition matches RecruitmentPage / VenuesPage / IncidentsPage:
// header (with tabs inside) + view-per-tab + drawer + modals.
import { useEffect, useMemo, useState } from "react";
import { tokens } from "../../design-system/tokens";
import { Card } from "../../design-system/primitives/Card";
import { useAuth } from "../../contexts/AuthContext";
import { useIntegrationsData } from "./hooks/useIntegrationsData";
import {
  IntegrationsHeader,
  type IntegrationsTab,
} from "./components/IntegrationsHeader";
import { CatalogView } from "./components/CatalogView";
import { ConnectedView } from "./components/ConnectedView";
import { ActivityView } from "./components/ActivityView";
import { IntegrationDrawer } from "./components/IntegrationDrawer";
import { DisconnectModal } from "./components/DisconnectModal";
import { CATALOG, type CatalogItem } from "./data/catalog";
import type { ProviderConnection } from "../../services/financeIntegrationsService";

function isAdmin(role?: string, membershipRole?: string): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return r === "admin" || m === "admin" || m === "owner";
}

export default function IntegrationsPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;

  const [view, setView] = useState<IntegrationsTab>("catalog");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [disconnectFinance, setDisconnectFinance] =
    useState<ProviderConnection | null>(null);
  const [disconnectDeputy, setDisconnectDeputy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const data = useIntegrationsData();

  // Pair the selected catalog item with its current backend state so the
  // drawer can render the right view.
  const selectedFinanceConnection = useMemo<ProviderConnection | null>(() => {
    if (!selected || selected.kind !== "finance") return null;
    return (
      data.financeConnections.find(
        (c) => c.provider_key === selected.providerKey,
      ) ?? null
    );
  }, [selected, data.financeConnections]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

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
            Connecting external services is restricted to admin users.
          </div>
        </Card>
      </main>
    );
  }

  const openDrawer = (item: CatalogItem) => {
    setSelected(item);
    setDrawerOpen(true);
  };

  const handleSaveDeputyCredentials = async (payload: {
    apiEndpoint: string;
    apiKey: string;
    isActive: boolean;
  }) => {
    await data.updateDeputyConfig.mutateAsync(payload);
    setToast("Deputy credentials saved.");
  };

  const handleSyncDeputyEmployees = async () => {
    try {
      await data.syncDeputyEmployees.mutateAsync();
      setToast("Deputy employee sync queued.");
    } catch {
      setToast("Couldn't start the employee sync.");
    }
  };

  const handleSyncDeputyTimesheets = async () => {
    try {
      await data.syncDeputyTimesheets.mutateAsync();
      setToast("Deputy timesheet sync queued.");
    } catch {
      setToast("Couldn't start the timesheet sync.");
    }
  };

  const confirmDisconnectFinance = async () => {
    if (!disconnectFinance) return;
    await data.disconnectFinance.mutateAsync(disconnectFinance.id);
    setToast(`${disconnectFinance.provider_name} disconnected.`);
    setDisconnectFinance(null);
    setDrawerOpen(false);
  };

  const confirmDisconnectDeputy = async () => {
    await data.disconnectDeputy.mutateAsync();
    setToast("Deputy disconnected.");
    setDisconnectDeputy(false);
    setDrawerOpen(false);
  };

  const isFinanceMutating =
    data.disconnectFinance.isPending ||
    data.testFinanceConnection.isPending ||
    data.refreshFinanceToken.isPending;

  const isDeputyMutating =
    data.updateDeputyConfig.isPending ||
    data.disconnectDeputy.isPending ||
    data.syncDeputyEmployees.isPending ||
    data.syncDeputyTimesheets.isPending;

  return (
    <>
      <IntegrationsHeader
        view={view}
        onViewChange={setView}
        connectedCount={data.connectedCount}
        errorCount={data.errorCount}
        catalogCount={CATALOG.length}
        activityCount={data.activity.length}
        search={search}
        onSearchChange={setSearch}
      />

      {view === "catalog" && (
        <CatalogView
          search={search}
          financeConnections={data.financeConnections}
          deputyStatus={data.deputyStatus}
          onSelect={openDrawer}
        />
      )}

      {view === "connected" && (
        <ConnectedView
          financeConnections={data.financeConnections}
          deputyStatus={data.deputyStatus}
          isLoading={data.isLoading}
          onSelect={openDrawer}
        />
      )}

      {view === "activity" && (
        <ActivityView
          activity={data.activity}
          isLoading={data.isActivityLoading}
        />
      )}

      <IntegrationDrawer
        open={drawerOpen}
        item={selected}
        financeConnection={selectedFinanceConnection}
        deputyStatus={data.deputyStatus}
        onClose={() => setDrawerOpen(false)}
        onTestFinance={async (id) => {
          const res = await data.testFinanceConnection.mutateAsync(id);
          return { success: res.success, error: res.error_message };
        }}
        onRefreshFinanceToken={async (id) => {
          await data.refreshFinanceToken.mutateAsync(id);
        }}
        onDisconnectFinance={(connection) => setDisconnectFinance(connection)}
        onDisconnectDeputy={() => setDisconnectDeputy(true)}
        onSaveDeputyCredentials={handleSaveDeputyCredentials}
        onSyncDeputyEmployees={handleSyncDeputyEmployees}
        onSyncDeputyTimesheets={handleSyncDeputyTimesheets}
        isFinanceMutating={isFinanceMutating}
        isDeputyMutating={isDeputyMutating}
      />

      <DisconnectModal
        open={Boolean(disconnectFinance)}
        providerName={disconnectFinance?.provider_name ?? ""}
        warning="Pending exports will fail. You can reconnect later — your mappings are preserved."
        onClose={() => setDisconnectFinance(null)}
        onConfirm={confirmDisconnectFinance}
        isSubmitting={data.disconnectFinance.isPending}
      />

      <DisconnectModal
        open={disconnectDeputy}
        providerName="Deputy"
        warning="Future timesheet imports will pause until Deputy is reconnected."
        onClose={() => setDisconnectDeputy(false)}
        onConfirm={confirmDisconnectDeputy}
        isSubmitting={data.disconnectDeputy.isPending}
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
