// PayrollPage — composes hero + export strip + filter bar + table + right rail.
// Ported from project/payroll-app.jsx:50-133.
import { useMemo, useState } from "react";
import { tokens } from "../../design-system/tokens";
import { Card } from "../../design-system/primitives/Card";
import { Icon } from "../../design-system/Icon";
import { CURRENT_RUN, OFFICERS, type Officer } from "./data/mocks";
import { PayrollHeader } from "./components/PayrollHeader";
import { RunHero } from "./components/RunHero";
import { ExportStrip } from "./components/ExportStrip";
import { FilterBar, type PayrollFilter } from "./components/FilterBar";
import { OfficersTable, type Density } from "./components/OfficersTable";
import {
  CompositionCard,
  RunHistoryCard,
  SiaHoldsCard,
} from "./components/RightRailCards";
import { OfficerDrawer } from "./components/OfficerDrawer";

export default function PayrollPage() {
  const [filter, setFilter] = useState<PayrollFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailOfficer, setDetailOfficer] = useState<Officer | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [density] = useState<Density>("comfortable");
  const [showRightRail] = useState(true);
  const [showExportStrip] = useState(true);

  const filteredOfficers = useMemo(() => {
    let list = OFFICERS;
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
    return list;
  }, [filter, search]);

  const counts = useMemo(
    () => ({
      all: OFFICERS.length,
      pending: OFFICERS.filter((o) => o.status === "pending").length,
      paid: OFFICERS.filter((o) => o.status === "paid").length,
      rejected: OFFICERS.filter((o) => o.status === "rejected").length,
      flagged: OFFICERS.filter(
        (o) =>
          o.sia.expired ||
          o.sia.expiresInDays <= 30 ||
          o.adjustments > 0 ||
          o.status === "rejected",
      ).length,
    }),
    [],
  );

  const fireExportToast = () => {
    setExportToast("Export modal — Phase 6.5");
    window.setTimeout(() => setExportToast(null), 2200);
  };

  return (
    <>
      <PayrollHeader />

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
          run={CURRENT_RUN}
          onOpenExport={fireExportToast}
          onGeneratePdfs={fireExportToast}
        />

        {showExportStrip && <ExportStrip onOpenExport={fireExportToast} />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: showRightRail ? "1fr 340px" : "1fr",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <FilterBar
              filter={filter}
              setFilter={setFilter}
              search={search}
              setSearch={setSearch}
              counts={counts}
              selected={selectedIds.length}
              onBulkExport={fireExportToast}
            />
            <OfficersTable
              officers={filteredOfficers}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onOpenDetail={setDetailOfficer}
              density={density}
            />
          </div>

          {showRightRail && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <CompositionCard />
              <SiaHoldsCard />
              <RunHistoryCard />
            </div>
          )}
        </div>

        <div style={{ height: 40 }} />
      </main>

      <OfficerDrawer officer={detailOfficer} onClose={() => setDetailOfficer(null)} />

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
