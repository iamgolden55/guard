// CapacityLogbookPage — admin "Operations → Capacity logs" view.
//
// Lists end-of-shift capacity logbook signoffs scoped to the current company,
// with venue + date filters and CSV bulk export. Click a row to open a side
// drawer with the full timeline and a "Download PDF" action — same UX shape
// as Staff and Invoices.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../../design-system/primitives/Card";
import { Button } from "../../design-system/primitives/Button";
import { Pill } from "../../design-system/primitives/Pill";
import { tokens } from "../../design-system/tokens";
import { Icon } from "../../design-system/Icon";
import {
  capacityLogbookService,
  type ActiveCapacityShift,
  type CapacityLogbookSignoff,
  type ListLogbookParams,
} from "../../services/capacityLogbookService";
import shiftService from "../../services/shiftService";
import type { Venue } from "../../types";
import { CapacityLogbookDrawer } from "./components/CapacityLogbookDrawer";
import { ActiveShiftsTable } from "./components/ActiveShiftsTable";

type TabKey = "active" | "closed";

const HEADER_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: tokens.color.ink500,
  textAlign: "left",
  padding: "10px 14px",
  background: tokens.color.ink50,
  borderBottom: `1px solid ${tokens.color.ink200}`,
  whiteSpace: "nowrap",
};

const CELL_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink800,
  padding: "12px 14px",
  borderBottom: `1px solid ${tokens.color.ink100}`,
  verticalAlign: "middle",
};

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function CapacityLogbookPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role?.toLowerCase();
  const membershipRole = authState.currentMembership?.role?.toLowerCase();
  const isAdminOrManager =
    userRole === "admin" ||
    userRole === "manager" ||
    membershipRole === "admin" ||
    membershipRole === "owner" ||
    membershipRole === "manager";

  const [tab, setTab] = useState<TabKey>("active");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [logs, setLogs] = useState<CapacityLogbookSignoff[]>([]);
  const [activeShifts, setActiveShifts] = useState<ActiveCapacityShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (closed tab only)
  const [venueId, setVenueId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Detail drawer
  const [selected, setSelected] = useState<CapacityLogbookSignoff | null>(null);

  // CSV export feedback
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Load venues once for the filter dropdown.
  useEffect(() => {
    let cancelled = false;
    shiftService
      .getVenues()
      .then((vs) => {
        if (cancelled) return;
        setVenues(vs);
      })
      .catch(() => {
        if (cancelled) return;
        setVenues([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load whichever tab's data is currently selected. Closed tab honours the
  // venue + date filters; active tab shows everything in-progress and polls
  // every 15s so the admin sees countdowns advance and last-check rows update
  // without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;

    const loadClosed = async () => {
      const params: ListLogbookParams = {};
      if (venueId != null) params.venueId = venueId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      try {
        const results = await capacityLogbookService.list(params);
        if (cancelled) return;
        setLogs(results);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load capacity logbooks.");
        setLogs([]);
      }
    };

    const loadActive = async () => {
      try {
        const results = await capacityLogbookService.listActive();
        if (cancelled) return;
        setActiveShifts(results);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load active shifts.");
        setActiveShifts([]);
      }
    };

    setIsLoading(true);
    const initial = tab === "active" ? loadActive() : loadClosed();
    initial.finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    if (tab === "active") {
      pollTimer = window.setInterval(loadActive, 15_000);
    }

    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [tab, venueId, dateFrom, dateTo]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.venue_name.toLowerCase().includes(q) ||
        l.closed_by_name.toLowerCase().includes(q) ||
        l.shift_group.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params: ListLogbookParams = {};
      if (venueId != null) params.venueId = venueId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const filename = await capacityLogbookService.exportCsv(params);
      setToast(`Downloaded ${filename}`);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "CSV export failed. Try again.";
      setToast(message);
    } finally {
      setExporting(false);
    }
  };

  if (!isAdminOrManager) {
    return (
      <div style={{ padding: 32, fontFamily: tokens.font.body }}>
        <Card padding={24}>
          <h2
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 18,
            }}
          >
            Restricted
          </h2>
          <p style={{ color: tokens.color.ink600, marginTop: 8 }}>
            Capacity logbooks are only available to admins and managers.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px 32px 64px",
        maxWidth: 1280,
        margin: "0 auto",
        fontFamily: tokens.font.body,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: tokens.color.ink500,
              marginBottom: 6,
            }}
          >
            Operations
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 28,
              fontWeight: 700,
              color: tokens.color.ink900,
              letterSpacing: "-0.01em",
            }}
          >
            Capacity logs
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13.5,
              color: tokens.color.ink600,
            }}
          >
            Signed-off capacity-monitoring logbooks across all venues. One row
            per shift. Click any row to view the timeline or download the audit
            PDF.
          </p>
        </div>
        {tab === "closed" && (
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={exporting || filteredLogs.length === 0}
            leading={<Icon name="download" size={16} />}
          >
            {exporting ? "Preparing…" : "Export CSV"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: `1px solid ${tokens.color.ink200}`,
          marginBottom: 16,
        }}
      >
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Active{" "}
          <span style={{ color: tokens.color.ink500, fontWeight: 500 }}>
            · {activeShifts.length}
          </span>
        </TabButton>
        <TabButton active={tab === "closed"} onClick={() => setTab("closed")}>
          Closed
        </TabButton>
      </div>

      {/* Filter bar — closed tab only */}
      {tab === "closed" && (
      <Card padding={16} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 1fr) minmax(140px, auto) minmax(140px, auto) minmax(220px, 1.5fr)",
            gap: 12,
            alignItems: "end",
          }}
        >
          <FilterField label="Venue">
            <select
              value={venueId ?? ""}
              onChange={(e) =>
                setVenueId(e.target.value ? Number(e.target.value) : null)
              }
              style={SELECT_STYLE}
            >
              <option value="">All venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="From">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={INPUT_STYLE}
            />
          </FilterField>
          <FilterField label="To">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={INPUT_STYLE}
            />
          </FilterField>
          <FilterField label="Search">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Venue, signer, or shift ID"
              style={INPUT_STYLE}
            />
          </FilterField>
        </div>
      </Card>
      )}

      {/* Active shifts tab */}
      {tab === "active" ? (
        <ActiveShiftsTable
          shifts={activeShifts}
          isLoading={isLoading}
          error={error}
        />
      ) : (
      /* Closed-logbooks table */
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th style={HEADER_STYLE}>Date</th>
                <th style={HEADER_STYLE}>Venue</th>
                <th style={HEADER_STYLE}>Status</th>
                <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Checks</th>
                <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Missed</th>
                <th style={HEADER_STYLE}>Signed by</th>
                <th style={HEADER_STYLE}>Signed at</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ ...CELL_STYLE, textAlign: "center", color: tokens.color.ink500 }}>
                    Loading capacity logbooks…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ ...CELL_STYLE, textAlign: "center", color: tokens.color.ink600 }}>
                    {error}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...CELL_STYLE, textAlign: "center", color: tokens.color.ink500 }}>
                    No capacity logbooks match these filters yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSelected = selected?.id === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? tokens.color.ink50 : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLTableRowElement).style.background = tokens.color.ink50;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }
                      }}
                    >
                      <td style={CELL_STYLE}>{formatDate(log.signed_at || log.created_at)}</td>
                      <td style={{ ...CELL_STYLE, fontWeight: 600 }}>{log.venue_name}</td>
                      <td style={CELL_STYLE}>
                        {log.is_override ? (
                          <Pill tone="warning" dot>
                            Override
                          </Pill>
                        ) : (
                          <Pill tone="positive" dot>
                            Signed
                          </Pill>
                        )}
                      </td>
                      <td style={{ ...CELL_STYLE, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {log.total_checks}
                      </td>
                      <td
                        style={{
                          ...CELL_STYLE,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color:
                            log.total_missed > 0
                              ? tokens.color.dangerInk
                              : tokens.color.ink800,
                          fontWeight: log.total_missed > 0 ? 600 : 400,
                        }}
                      >
                        {log.total_missed}
                      </td>
                      <td style={CELL_STYLE}>
                        {log.is_override ? (
                          <span style={{ color: tokens.color.ink500 }}>—</span>
                        ) : (
                          <span>
                            {log.closed_by_name}
                            {log.closed_by_role ? (
                              <span style={{ color: tokens.color.ink500 }}>
                                {" "}
                                · {log.closed_by_role}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td style={{ ...CELL_STYLE, color: tokens.color.ink600 }}>
                        {formatDateTime(log.signed_at || log.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: tokens.color.ink900,
            color: "white",
            padding: "10px 14px",
            borderRadius: tokens.radius.md,
            fontSize: 13,
            boxShadow: tokens.shadow.lg,
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}

      {/* Detail drawer */}
      <CapacityLogbookDrawer
        log={selected}
        onClose={() => setSelected(null)}
        onToast={(msg) => setToast(msg)}
      />
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: "10px 14px",
        fontFamily: tokens.font.body,
        fontSize: 13.5,
        fontWeight: 600,
        color: active ? tokens.color.ink900 : tokens.color.ink600,
        cursor: "pointer",
        borderBottom: `2px solid ${active ? tokens.color.primary : "transparent"}`,
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const INPUT_STYLE: CSSProperties = {
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.md,
  padding: "8px 10px",
  fontFamily: tokens.font.body,
  fontSize: 13,
  background: "white",
};

const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
};
