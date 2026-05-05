import { useQueryClient } from "@tanstack/react-query";
// PayrollPage — composes hero + export strip + filter bar + table + right rail.
// Ported from project/payroll-app.jsx:50-133.
import { useMemo, useState } from "react";
import { Icon } from "../../design-system/Icon";
import { Card } from "../../design-system/primitives/Card";
import { tokens } from "../../design-system/tokens";
import billingService from "../../services/billingService";
import payrollService from "../../services/payrollService";
import { ExportStrip } from "./components/ExportStrip";
import { FilterBar, type PayrollFilter } from "./components/FilterBar";
import { OfficerDrawer } from "./components/OfficerDrawer";
import { type Density, OfficersTable } from "./components/OfficersTable";
import { PayrollHeader } from "./components/PayrollHeader";
import {
  CompositionCard,
  RunHistoryCard,
  SiaHoldsCard,
} from "./components/RightRailCards";
import { RunHero } from "./components/RunHero";
import {
  CURRENT_RUN,
  OFFICERS,
  type Officer,
  type PayrollCycle,
} from "./data/mocks";
import { usePayrollRun, useRunOfficers } from "./hooks/usePayrollData";

// Phase 8.5: real-API toggle — set VITE_USE_MOCKS=1 in .env to keep the mocks.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "1";

export default function PayrollPage() {
  const [filter, setFilter] = useState<PayrollFilter>("all");
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailOfficer, setDetailOfficer] = useState<Officer | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDownloadingPayslips, setIsDownloadingPayslips] = useState(false);
  const [density] = useState<Density>("comfortable");
  const [showRightRail] = useState(true);
  const [showExportStrip] = useState(true);
  const queryClient = useQueryClient();

  const [cycle, setCycle] = useState<PayrollCycle>("weekly");
  const [activeRunCode, setActiveRunCode] = useState<string | null>(null);
  const runQuery = usePayrollRun(activeRunCode, cycle);

  const handleCycleChange = (next: PayrollCycle) => {
    if (next === cycle) return;
    // Switching cycle: reset back to current-of-cycle so we don't try to
    // resolve a weekly run code in the monthly view (or vice versa).
    setActiveRunCode(null);
    setCycle(next);
  };
  const officersQuery = useRunOfficers(runQuery.data?.id ?? null);
  const run = USE_MOCKS ? CURRENT_RUN : (runQuery.data ?? CURRENT_RUN);
  const officers = USE_MOCKS ? OFFICERS : (officersQuery.data ?? []);

  const filteredOfficers = useMemo(() => {
    let list = officers;
    if (filter === "flagged") {
      list = list.filter(
        (o) =>
          o.sia.expired ||
          o.sia.expiresInDays <= 30 ||
          o.adjustments > 0 ||
          o.status === "rejected",
      );
    } else if (filter !== "all") {
      list = list.filter((o) => o.status === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.venue.toLowerCase().includes(q) ||
          o.role.toLowerCase().includes(q),
      );
    }
    if (venueFilter) {
      list = list.filter((o) => o.venue === venueFilter);
    }
    return list;
  }, [filter, search, venueFilter, officers]);

  const venueOptions = useMemo(
    () =>
      Array.from(new Set(officers.map((o) => o.venue).filter(Boolean))).sort(),
    [officers],
  );

  const counts = useMemo(
    () => ({
      all: officers.length,
      pending: officers.filter((o) => o.status === "pending").length,
      approved: officers.filter((o) => o.status === "approved").length,
      paid: officers.filter((o) => o.status === "paid").length,
      rejected: officers.filter((o) => o.status === "rejected").length,
      flagged: officers.filter(
        (o) =>
          o.sia.expired ||
          o.sia.expiresInDays <= 30 ||
          o.adjustments > 0 ||
          o.status === "rejected",
      ).length,
    }),
    [officers],
  );

  const fireExportToast = () => {
    setExportToast("Export modal — Phase 6.5");
    window.setTimeout(() => setExportToast(null), 2200);
  };

  const handleRunExport = async () => {
    if (USE_MOCKS) {
      fireExportToast();
      return;
    }
    if (officers.length === 0) {
      setExportToast("Nothing to export — this run has no officers yet.");
      window.setTimeout(() => setExportToast(null), 2200);
      return;
    }
    setExportToast("Queuing run export to Xero…");
    try {
      const invoiceIds = officers
        .map((o) => o.invoiceId)
        .filter((id): id is string => Boolean(id));
      if (invoiceIds.length === 0) {
        setExportToast("No invoice IDs available — generate the run first.");
        window.setTimeout(() => setExportToast(null), 2500);
        return;
      }
      await Promise.all(
        invoiceIds.slice(0, 50).map((id) => billingService.exportToXero(id)),
      );
      setExportToast(
        "Run queued for Xero — pills update when the worker completes.",
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Export failed";
      setExportToast(`Export error: ${detail}`);
    } finally {
      window.setTimeout(() => setExportToast(null), 3500);
    }
  };

  const handleDownloadPayslips = async (targetOfficers: Officer[]) => {
    if (USE_MOCKS) {
      fireExportToast();
      return;
    }
    const invoiceIds = targetOfficers
      .map((o) => o.invoiceId)
      .filter((id): id is string => Boolean(id));
    if (invoiceIds.length === 0) {
      setExportToast("No payslips to download — this run has no invoices yet.");
      window.setTimeout(() => setExportToast(null), 2500);
      return;
    }
    setIsDownloadingPayslips(true);
    setExportToast(
      `Downloading ${invoiceIds.length} payslip${invoiceIds.length === 1 ? "" : "s"}…`,
    );
    try {
      // Browsers throttle / block multiple parallel auto-downloads, so go serial.
      for (const id of invoiceIds) {
        await billingService.downloadPdf(id);
      }
      setExportToast(
        `Downloaded ${invoiceIds.length} payslip${invoiceIds.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Download failed";
      setExportToast(`Payslip download error: ${detail}`);
    } finally {
      setIsDownloadingPayslips(false);
      window.setTimeout(() => setExportToast(null), 3000);
    }
  };

  const handleDownloadAllPayslips = () => handleDownloadPayslips(officers);
  const handleBulkDownloadPayslips = () =>
    handleDownloadPayslips(officers.filter((o) => selectedIds.includes(o.id)));

  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const handleApproveAllPending = async () => {
    if (USE_MOCKS) {
      fireExportToast();
      return;
    }
    // If the manager has checkboxes ticked, scope to only those pending
    // officers. Empty selection = all pending in the run.
    const selectedPendingIds = selectedIds.filter((id) => {
      const o = officers.find((x) => x.id === id);
      return o?.status === "pending";
    });
    const allPendingIds = officers
      .filter((o) => o.status === "pending")
      .map((o) => o.id);
    const targetIds =
      selectedPendingIds.length > 0 ? selectedPendingIds : allPendingIds;
    if (targetIds.length === 0) return;
    const scopeLabel = selectedPendingIds.length > 0 ? "selected" : "pending";
    const confirmed = window.confirm(
      `Mark ${targetIds.length} ${scopeLabel} invoice${targetIds.length === 1 ? "" : "s"} as paid for ${run.id}? ` +
        `This is the bulk equivalent of clicking Approve on each officer — once you've ` +
        `confirmed payment has been sent.`,
    );
    if (!confirmed) return;
    setIsApprovingAll(true);
    setExportToast(
      `Approving ${targetIds.length} invoice${targetIds.length === 1 ? "" : "s"}…`,
    );
    try {
      const result = await payrollService.approveAllPending(
        run.id,
        selectedPendingIds.length > 0 ? selectedPendingIds : undefined,
      );
      setExportToast(
        `Approved ${result.approved_count} invoice${result.approved_count === 1 ? "" : "s"}.`,
      );
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ["payroll"] });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Approve failed";
      setExportToast(`Approve error: ${detail}`);
    } finally {
      setIsApprovingAll(false);
      window.setTimeout(() => setExportToast(null), 3000);
    }
  };

  const handleMarkPaidAllApproved = async () => {
    if (USE_MOCKS) {
      fireExportToast();
      return;
    }
    const selectedApprovedIds = selectedIds.filter((id) => {
      const o = officers.find((x) => x.id === id);
      return o?.status === "approved";
    });
    const allApprovedIds = officers
      .filter((o) => o.status === "approved")
      .map((o) => o.id);
    const targetIds =
      selectedApprovedIds.length > 0 ? selectedApprovedIds : allApprovedIds;
    if (targetIds.length === 0) return;
    const scopeLabel = selectedApprovedIds.length > 0 ? "selected" : "approved";
    const confirmed = window.confirm(
      `Mark ${targetIds.length} ${scopeLabel} invoice${targetIds.length === 1 ? "" : "s"} as paid for ${run.id}? ` +
        `Use this once payment has actually been sent — paid_date is set to today and the run becomes a closed record.`,
    );
    if (!confirmed) return;
    setIsMarkingPaid(true);
    setExportToast(
      `Marking ${targetIds.length} invoice${targetIds.length === 1 ? "" : "s"} paid…`,
    );
    try {
      const result = await payrollService.markPaidAllApproved(
        run.id,
        selectedApprovedIds.length > 0 ? selectedApprovedIds : undefined,
      );
      setExportToast(
        `Marked ${result.paid_count} invoice${result.paid_count === 1 ? "" : "s"} paid.`,
      );
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ["payroll"] });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Mark paid failed";
      setExportToast(`Mark paid error: ${detail}`);
    } finally {
      setIsMarkingPaid(false);
      window.setTimeout(() => setExportToast(null), 3000);
    }
  };

  const handleRegenerate = async () => {
    if (USE_MOCKS) {
      fireExportToast();
      return;
    }
    setIsRegenerating(true);
    setExportToast(`Regenerating ${run.id}…`);
    try {
      const result = await payrollService.regenerateRun(run.id);
      setExportToast(
        result.errors > 0
          ? `Regenerated ${result.regenerated} invoice${result.regenerated === 1 ? "" : "s"} (${result.errors} error${result.errors === 1 ? "" : "s"}).`
          : `Regenerated ${result.regenerated} invoice${result.regenerated === 1 ? "" : "s"}.`,
      );
      // Refresh run + officers + composition so the hero/table/right rail show new totals.
      await queryClient.invalidateQueries({ queryKey: ["payroll"] });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Regenerate failed";
      setExportToast(`Regenerate error: ${detail}`);
    } finally {
      setIsRegenerating(false);
      window.setTimeout(() => setExportToast(null), 3000);
    }
  };

  return (
    <>
      <PayrollHeader
        run={run}
        cycle={cycle}
        onCycleChange={handleCycleChange}
        onOpenExport={handleRunExport}
        onDownloadPayslips={handleDownloadAllPayslips}
      />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          background: tokens.color.ink50,
        }}
      >
        <RunHero
          run={run}
          officers={officers}
          onOpenExport={handleRunExport}
          onGeneratePdfs={handleDownloadAllPayslips}
          onRegenerate={handleRegenerate}
          onApproveAllPending={handleApproveAllPending}
          onMarkPaidAllApproved={handleMarkPaidAllApproved}
          selectedIds={selectedIds}
          isRegenerating={isRegenerating}
          isDownloadingPayslips={isDownloadingPayslips}
          isApprovingAll={isApprovingAll}
          isMarkingPaid={isMarkingPaid}
        />

        {showExportStrip && (
          <ExportStrip
            onOpenExport={handleRunExport}
            processDate={run.processDate}
          />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: showRightRail ? "1fr 340px" : "1fr",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minWidth: 0,
            }}
          >
            <FilterBar
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              counts={counts}
              selected={selectedIds.length}
              onBulkExport={fireExportToast}
              onBulkDownloadPayslips={handleBulkDownloadPayslips}
              runCode={run.id}
              venues={venueOptions}
              venueFilter={venueFilter}
              onVenueChange={setVenueFilter}
            />
            <OfficersTable
              officers={filteredOfficers}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onOpenDetail={setDetailOfficer}
              density={density}
              runCode={run.id}
            />
          </div>

          {showRightRail && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CompositionCard runCode={run.id} />
              <SiaHoldsCard runCode={run.id} />
              <RunHistoryCard
                activeRunCode={run.id}
                onSelect={setActiveRunCode}
                cycle={cycle}
              />
            </div>
          )}
        </div>

        <div style={{ height: 40 }} />
      </main>

      <OfficerDrawer
        officer={detailOfficer}
        onClose={() => setDetailOfficer(null)}
        runCode={run.id}
      />

      {exportToast && (
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
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            zIndex: tokens.z.toast,
          }}
        >
          <Icon name="check" size={14} />
          {exportToast}
        </div>
      )}
    </>
  );
}

// Suppress unused import warning when right rail / export strip toggles are wired up later.
void Card;
