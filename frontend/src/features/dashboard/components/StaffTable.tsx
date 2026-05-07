// StaffTable — ported 1:1 from project/dashboard.jsx:606-716.
// Filter button opens a checkbox popover (role / venue / status). Export
// button downloads a CSV of the currently visible rows.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Icon } from "../../../design-system/Icon";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import type { DashboardStaff, StaffStatus } from "../data/mocks";

const PAGE_SIZE = 10;

const STATUS_TONES: Record<StaffStatus, { tone: PillTone; label: string }> = {
  "on-shift": { tone: "positive", label: "On shift" },
  break: { tone: "info", label: "On break" },
  late: { tone: "warning", label: "Late" },
  "off-duty": { tone: "neutral", label: "Off duty" },
};

const STATUS_OPTIONS: StaffStatus[] = ["on-shift", "break", "late", "off-duty"];

type Filter = "all" | "active" | "attention";

const TD_STYLE = {
  padding: "12px 16px",
  fontSize: 13,
  color: tokens.color.ink800,
} as const;

const ghostBtnStyle = {
  display: "inline-flex" as const,
  alignItems: "center" as const,
  gap: 6,
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  padding: "6px 12px",
  borderRadius: 7,
  fontFamily: tokens.font.body,
  fontSize: 12,
  fontWeight: 500,
  color: tokens.color.ink800,
  cursor: "pointer",
};

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: DashboardStaff[]): void {
  const header = [
    "ID",
    "Name",
    "Role",
    "Venue",
    "Status",
    "License",
    "Days to expiry",
    "Hours this wk",
  ];
  const body = rows.map((s) => [
    s.id,
    s.name,
    s.role,
    s.venue,
    STATUS_TONES[s.status].label,
    s.license,
    s.expiresIn,
    s.hours,
  ]);
  const csv = [header, ...body]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `staff-roster-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface StaffTableProps {
  staff: DashboardStaff[];
}

export function StaffTable({ staff }: StaffTableProps) {
  const { palette } = useAccent();
  const [filter, setFilter] = useState<Filter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedVenues, setSelectedVenues] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StaffStatus>>(
    new Set(),
  );
  const [page, setPage] = useState(0);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverContentRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Dynamic option lists from current staff data.
  const roleOptions = useMemo(
    () => Array.from(new Set(staff.map((s) => s.role))).sort(),
    [staff],
  );
  const venueOptions = useMemo(
    () => Array.from(new Set(staff.map((s) => s.venue))).sort(),
    [staff],
  );

  const filtered = useMemo(() => {
    let list = staff;
    if (filter === "active")
      list = list.filter(
        (s) => s.status === "on-shift" || s.status === "break",
      );
    else if (filter === "attention")
      list = list.filter((s) => s.status === "late" || s.expiresIn < 30);
    if (selectedRoles.size)
      list = list.filter((s) => selectedRoles.has(s.role));
    if (selectedVenues.size)
      list = list.filter((s) => selectedVenues.has(s.venue));
    if (selectedStatuses.size)
      list = list.filter((s) => selectedStatuses.has(s.status));
    return list;
  }, [staff, filter, selectedRoles, selectedVenues, selectedStatuses]);

  const activeFilterCount =
    selectedRoles.size + selectedVenues.size + selectedStatuses.size;

  // Reset to page 1 when the filter set or tab changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filtered.length is the trigger
  useEffect(() => {
    setPage(0);
  }, [filter, selectedRoles, selectedVenues, selectedStatuses]);

  // Position the portal popover relative to the anchor.
  useEffect(() => {
    if (!filterOpen) return;
    const update = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPopoverPos({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [filterOpen]);

  // Close popover on outside click + ESC.
  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        popoverContentRef.current?.contains(target)
      ) {
        return;
      }
      setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const tabs: [Filter, string, number][] = [
    ["all", "All staff", staff.length],
    [
      "active",
      "On duty",
      staff.filter((s) => s.status === "on-shift" || s.status === "break")
        .length,
    ],
    [
      "attention",
      "Needs attention",
      staff.filter((s) => s.status === "late" || s.expiresIn < 30).length,
    ],
  ];

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding: 0,
        fontFamily: tokens.font.body,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 20px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: tokens.font.display,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                color: tokens.color.ink900,
              }}
            >
              Staff roster
            </h3>
            <div
              style={{
                fontSize: 12.5,
                color: tokens.color.ink500,
                marginTop: 2,
              }}
            >
              SIA-licensed personnel currently in the system
            </div>
          </div>
          <div
            ref={anchorRef}
            style={{ display: "flex", gap: 8, position: "relative" }}
          >
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                ...ghostBtnStyle,
                ...(activeFilterCount
                  ? { borderColor: palette.primary, color: palette.primary }
                  : null),
              }}
            >
              <Icon name="filter" size={14} /> Filters
              {activeFilterCount > 0 && (
                <span
                  style={{
                    background: palette.primary,
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 999,
                    marginLeft: 2,
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(filtered)}
              style={ghostBtnStyle}
              title={`Export ${filtered.length} rows`}
            >
              <Icon name="download" size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "0 20px",
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        {tabs.map(([k, label, count]) => {
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "10px 4px",
                marginRight: 18,
                fontFamily: tokens.font.body,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? palette.primary : tokens.color.ink600,
                borderBottom: active
                  ? `2px solid ${palette.primary}`
                  : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {label}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? palette.primary : tokens.color.ink500,
                  background: active ? palette.soft : tokens.color.ink100,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: tokens.font.body,
          }}
        >
          <thead>
            <tr style={{ background: tokens.color.ink50 }}>
              {[
                "Officer",
                "Role",
                "Assignment",
                "Status",
                "SIA License",
                "Hours wk",
                "Rating",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i === 5 || i === 6 ? "right" : "left",
                    padding: "10px 16px",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: tokens.color.ink600,
                    borderBottom: `1px solid ${tokens.color.ink200}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s) => {
              const st = STATUS_TONES[s.status];
              const licTone: PillTone =
                s.expiresIn < 14
                  ? "danger"
                  : s.expiresIn < 60
                    ? "warning"
                    : "neutral";
              return (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: `1px solid ${tokens.color.ink100}`,
                    transition: "background .1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.color.ink50;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={TD_STYLE}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <Avatar name={s.name} hue={s.avatarHue} size={32} />
                      <div
                        style={{
                          fontWeight: 600,
                          color: tokens.color.ink900,
                          fontSize: 13.5,
                        }}
                      >
                        {s.name}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...TD_STYLE, color: tokens.color.ink800 }}>
                    {s.role}
                  </td>
                  <td style={{ ...TD_STYLE, color: tokens.color.ink600 }}>
                    {s.venue}
                  </td>
                  <td style={TD_STYLE}>
                    <Pill tone={st.tone} dot>
                      {st.label}
                    </Pill>
                  </td>
                  <td style={TD_STYLE}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: tokens.color.ink800,
                        }}
                      >
                        {s.license}
                      </span>
                      <Pill tone={licTone}>
                        {s.expiresIn < 14
                          ? `${s.expiresIn}d left`
                          : s.expiresIn < 60
                            ? `${s.expiresIn}d`
                            : "Valid"}
                      </Pill>
                    </div>
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: tokens.color.ink900,
                    }}
                  >
                    {s.hours}h
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ color: palette.primary, fontSize: 13 }}>
                        ★
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: tokens.color.ink900,
                          fontSize: 13,
                        }}
                      >
                        {s.rating.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    <button
                      type="button"
                      style={{ ...ghostBtnStyle, padding: "5px 8px" }}
                      aria-label="Row actions"
                    >
                      <Icon name="more" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: `1px solid ${tokens.color.ink200}`,
            background: "white",
            fontSize: 12.5,
            color: tokens.color.ink600,
          }}
        >
          <div style={{ fontVariantNumeric: "tabular-nums" }}>
            Showing {pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              style={{
                ...ghostBtnStyle,
                opacity: safePage === 0 ? 0.4 : 1,
                cursor: safePage === 0 ? "not-allowed" : "pointer",
              }}
            >
              <Icon name="chevron-left" size={14} /> Prev
            </button>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 10px",
                fontWeight: 600,
                color: tokens.color.ink800,
              }}
            >
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              style={{
                ...ghostBtnStyle,
                opacity: safePage >= totalPages - 1 ? 0.4 : 1,
                cursor: safePage >= totalPages - 1 ? "not-allowed" : "pointer",
              }}
            >
              Next <Icon name="chevron-right" size={14} />
            </button>
          </div>
        </div>
      )}

      {filterOpen &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverContentRef}
            style={{
              position: "fixed",
              top: popoverPos.top,
              right: popoverPos.right,
              width: 260,
              background: "white",
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: 10,
              boxShadow: "0 12px 28px -8px rgba(32,31,30,0.20)",
              padding: 14,
              zIndex: 1000,
            }}
          >
            <FilterGroup
              label="Role"
              options={roleOptions}
              selected={selectedRoles}
              onToggle={(v) => toggle(selectedRoles, v, setSelectedRoles)}
              primary={palette.primary}
            />
            <FilterGroup
              label="Venue"
              options={venueOptions}
              selected={selectedVenues}
              onToggle={(v) => toggle(selectedVenues, v, setSelectedVenues)}
              primary={palette.primary}
            />
            <FilterGroup
              label="Status"
              options={STATUS_OPTIONS}
              renderOption={(o) => STATUS_TONES[o].label}
              selected={selectedStatuses}
              onToggle={(v) => toggle(selectedStatuses, v, setSelectedStatuses)}
              primary={palette.primary}
            />
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRoles(new Set());
                  setSelectedVenues(new Set());
                  setSelectedStatuses(new Set());
                }}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "6px 10px",
                  background: tokens.color.ink50,
                  border: `1px solid ${tokens.color.ink200}`,
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  color: tokens.color.ink700,
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface FilterGroupProps<T extends string> {
  label: string;
  options: T[];
  selected: Set<T>;
  onToggle: (value: T) => void;
  primary: string;
  renderOption?: (value: T) => string;
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  primary,
  renderOption,
}: FilterGroupProps<T>) {
  if (options.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tokens.color.ink600,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 140,
          overflowY: "auto",
        }}
      >
        {options.map((opt) => {
          const active = selected.has(opt);
          return (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 6px",
                borderRadius: 5,
                fontSize: 12.5,
                color: tokens.color.ink800,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.color.ink50;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(opt)}
                style={{ accentColor: primary, cursor: "pointer" }}
              />
              {renderOption ? renderOption(opt) : opt}
            </label>
          );
        })}
      </div>
    </div>
  );
}
