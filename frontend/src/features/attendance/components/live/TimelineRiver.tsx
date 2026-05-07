// TimelineRiver — center pane of the Live tab. Horizontal scrollable
// timeline with day headers, hour grid, NOW line, and per-row shift
// ribbons. Ported 1:1 from project/attendance-live.jsx:159-427.
import { useEffect, useMemo, useRef } from "react";
import { useAccent } from "../../../../contexts/AccentContext";
import { Avatar } from "../../../../design-system/primitives/Avatar";
import { Icon } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import {
  fmtHr,
  fmtRange2,
  fmtVar,
  ribbonKey,
  RIBBON_COLORS,
  SCHEDULED_BG,
  SCHEDULED_BORDER,
  type AttendanceShift,
} from "../../data/mocks";
import { useAttendance } from "../../AttendanceContext";

const HOUR_PX = 56;
const HOUR_FROM = 5;
const HOUR_TO = 26;
const HOUR_COUNT = HOUR_TO - HOUR_FROM;

const xForHour = (h: number) => (h - HOUR_FROM) * HOUR_PX;

export type GroupBy = "venue" | "officer";

interface Group {
  key: string;
  label: string;
  sub: string;
  hue: number;
  list: AttendanceShift[];
  isOfficer: boolean;
}

export interface TimelineRiverProps {
  groupBy?: GroupBy;
  showPhotos?: boolean;
  onSelect: (shift: AttendanceShift) => void;
}

export function TimelineRiver({
  groupBy = "venue",
  showPhotos = true,
  onSelect,
}: TimelineRiverProps) {
  const { palette } = useAccent();
  const { shifts, venues, officerById, nowHour, nowLabel, todayLabel, matchesSearch, isToday } =
    useAttendance();
  const visibleShifts = useMemo(() => shifts.filter(matchesSearch), [shifts, matchesSearch]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    if (!isToday) {
      container.scrollLeft = 0;
      return;
    }
    const labelWidth = 220;
    const margin = 80;
    const nowX = xForHour(nowHour);
    // Only auto-scroll when NOW would otherwise be off-screen. On wide
    // viewports the timeline already shows NOW at its natural position,
    // and yanking the scroll forward hides the venue/officer label column.
    if (nowX + labelWidth + margin > container.clientWidth) {
      container.scrollLeft = Math.max(0, nowX - 280);
    } else {
      container.scrollLeft = 0;
    }
  }, [nowHour, isToday]);

  const groups: Group[] = useMemo(() => {
    if (groupBy === "officer") {
      const map = new Map<string, AttendanceShift[]>();
      visibleShifts.forEach((s) => {
        const key = s.oid || "_open";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
      });
      return Array.from(map.entries())
        .map(([k, list]): Group | null => {
          if (k === "_open") {
            return { key: k, label: "Open shifts", sub: "", hue: 0, list, isOfficer: true };
          }
          const o = officerById(k);
          if (!o) return null;
          return { key: k, label: o.name, sub: o.role, hue: o.hue, list, isOfficer: true };
        })
        .filter((g): g is Group => g !== null);
    }
    return venues
      .map((v): Group => ({
        key: v.id,
        label: v.name,
        sub: v.area,
        hue: v.hue,
        list: visibleShifts.filter((s) => s.vid === v.id),
        isOfficer: false,
      }))
      .filter((g) => g.list.length > 0);
  }, [groupBy, visibleShifts, venues, officerById]);

  const ROW_H = showPhotos ? 86 : 64;
  const totalWidth = HOUR_COUNT * HOUR_PX;
  const nowX = xForHour(nowHour);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: tokens.color.ink50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 20px",
          borderBottom: `1px solid ${tokens.color.ink200}`,
          background: "white",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tokens.color.ink500,
          }}
        >
          Timeline · {todayLabel.split(" ").slice(0, 2).join(" ")}
        </span>
        <div style={{ flex: 1 }} />
        <LegendChip dot={tokens.color.success} label="On duty" />
        <LegendChip dot={tokens.color.warn} label="Late" />
        <LegendChip dot={tokens.color.danger} label="No-show" />
        <LegendChip dot="#6d28d9" label="Geofence" />
        <LegendChip dot="rgba(96,94,92,0.45)" label="Scheduled" hollow />
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <div style={{ width: totalWidth + 220, position: "relative" }}>
          {/* Hour ruler */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 4,
              background: "white",
              borderBottom: `1px solid ${tokens.color.ink200}`,
              height: 38,
              display: "flex",
            }}
          >
            <div
              style={{
                width: 220,
                flexShrink: 0,
                borderRight: `1px solid ${tokens.color.ink200}`,
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                // Frozen first column — keeps the Venue/Officer label
                // visible while the timeline scrolls horizontally.
                position: "sticky",
                left: 0,
                background: "white",
                zIndex: 5,
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: tokens.color.ink500,
                }}
              >
                {groupBy === "officer" ? "Officer" : "Venue"} · {groups.length}
              </span>
            </div>
            <div style={{ position: "relative", height: 38 }}>
              {Array.from({ length: HOUR_COUNT + 1 }).map((_, i) => {
                const h = HOUR_FROM + i;
                const display = h % 24;
                const isMajor = display % 3 === 0;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: i * HOUR_PX,
                      top: 0,
                      bottom: 0,
                      paddingLeft: 6,
                      paddingTop: 12,
                      fontSize: 10.5,
                      color: isMajor ? tokens.color.ink600 : tokens.color.ink500,
                      fontWeight: isMajor ? 700 : 500,
                      fontFamily: tokens.font.mono,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(display).padStart(2, "0")}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 220,
                right: 0,
                bottom: 0,
                pointerEvents: "none",
              }}
            >
              {Array.from({ length: HOUR_COUNT + 1 }).map((_, i) => {
                const display = (HOUR_FROM + i) % 24;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: i * HOUR_PX,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: display % 3 === 0 ? tokens.color.ink200 : "rgba(225,223,221,0.5)",
                    }}
                  />
                );
              })}
            </div>

            {/* NOW line — only meaningful when viewing today */}
            {isToday && (
              <div
                style={{
                  position: "absolute",
                  left: 220 + nowX,
                  top: 0,
                  bottom: 0,
                  width: 0,
                  borderLeft: `1.5px dashed ${palette.primary}`,
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -22,
                    top: 4,
                    background: palette.primary,
                    color: "white",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    padding: "2px 8px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    boxShadow: `0 4px 10px -4px ${palette.primary}`,
                  }}
                >
                  NOW · {nowLabel}
                </div>
              </div>
            )}

            {/* Rows */}
            {groups.map((g) => (
              <div
                key={g.key}
                style={{
                  display: "flex",
                  borderBottom: `1px solid ${tokens.color.ink200}`,
                  minHeight: ROW_H,
                }}
              >
                <div
                  style={{
                    width: 220,
                    flexShrink: 0,
                    borderRight: `1px solid ${tokens.color.ink200}`,
                    padding: "12px 16px",
                    background: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    // Frozen first column for each row — venue / officer
                    // label stays visible while the timeline scrolls.
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  {g.isOfficer ? (
                    <Avatar name={g.label} hue={g.hue} size={30} />
                  ) : (
                    <span
                      style={{
                        width: 8,
                        height: 30,
                        borderRadius: 2,
                        background: `oklch(58% 0.16 ${g.hue})`,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: tokens.color.ink900,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {g.label}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.color.ink500, marginTop: 1 }}>
                      {g.sub} · {g.list.length} shift{g.list.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div style={{ position: "relative", flex: 1, minHeight: ROW_H }}>
                  {g.list.map((s) => (
                    <ShiftRibbon
                      key={s.id}
                      s={s}
                      showPhotos={showPhotos}
                      groupBy={groupBy}
                      onSelect={() => onSelect(s)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ height: 60 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendChip({ dot, label, hollow }: { dot: string; label: string; hollow?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        color: tokens.color.ink600,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: hollow ? "transparent" : dot,
          border: hollow ? `1.5px dashed ${dot}` : "none",
        }}
      />
      {label}
    </span>
  );
}

interface ShiftRibbonProps {
  s: AttendanceShift;
  showPhotos: boolean;
  groupBy: GroupBy;
  onSelect: () => void;
}

function ShiftRibbon({ s, showPhotos, groupBy, onSelect }: ShiftRibbonProps) {
  const { officerById, venueById, nowHour } = useAttendance();
  const v = venueById(s.vid);
  const o = officerById(s.oid);
  if (!v) return null;

  const schX = xForHour(s.sch_start);
  const schW = (s.sch_end - s.sch_start) * HOUR_PX;
  const key = ribbonKey(s);
  const colors = RIBBON_COLORS[key];

  let actX: number | null = null;
  let actW: number | null = null;
  let isLive = false;
  if (s.act_start != null) {
    actX = xForHour(s.act_start);
    if (s.act_end != null) {
      actW = (s.act_end - s.act_start) * HOUR_PX;
    } else {
      const endH = s.status === "missing_out" ? s.sch_end : nowHour;
      actW = (endH - s.act_start) * HOUR_PX;
      isLive = true;
    }
  }

  const showVarianceTail =
    s.act_end != null && Math.abs(s.act_end - s.sch_end) > 0.1;
  const variance = s.act_end != null ? s.act_end - s.sch_end : 0;

  return (
    <div
      onClick={onSelect}
      style={{
        position: "absolute",
        top: 8,
        bottom: 8,
        left: schX,
        width: schW,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: s.open
            ? "repeating-linear-gradient(135deg, #f3f2f1, #f3f2f1 5px, #faf9f8 5px, #faf9f8 8px)"
            : SCHEDULED_BG,
          border: `1.5px dashed ${SCHEDULED_BORDER}`,
          borderRadius: 6,
        }}
      />

      {actX != null && actW != null && (
        <div
          style={{
            position: "absolute",
            top: 4,
            bottom: 4,
            left: actX - schX,
            width: actW,
            background: colors.bg,
            borderRadius: 5,
            boxShadow: isLive
              ? `0 0 0 2px white, 0 6px 14px -4px ${colors.glow}`
              : `0 4px 10px -4px ${colors.glow}`,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            gap: 8,
            color: "white",
            minWidth: 24,
            overflow: "hidden",
            fontFamily: tokens.font.body,
          }}
        >
          {isLive && s.status !== "missing_out" && (
            <div
              style={{
                position: "absolute",
                right: -3,
                top: "50%",
                transform: "translateY(-50%)",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "white",
                boxShadow: `0 0 0 3px ${colors.bg}`,
                animation: "ms-pulse 1.2s ease-in-out infinite",
              }}
            />
          )}

          {showPhotos && s.photo && groupBy === "venue" && o && (
            <Avatar name={o.name} hue={o.hue} size={20} />
          )}

          <div
            style={{
              minWidth: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              lineHeight: 1.15,
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {groupBy === "venue" ? o?.name || "Open" : v.name}
            </div>
            {actW > 100 && (
              <div
                style={{
                  fontSize: 10,
                  opacity: 0.9,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtHr(s.act_start)} →{" "}
                {s.act_end ? fmtHr(s.act_end) : s.status === "missing_out" ? "—" : "live"}
                {(s.late_min ?? 0) >= 5 && ` · ${fmtVar(s.late_min!)}`}
              </div>
            )}
          </div>

          {s.geofence_fail && (
            <div
              title="Off-site check-in"
              style={{
                display: "grid",
                placeItems: "center",
                width: 20,
                height: 20,
                borderRadius: 10,
                background: "rgba(255,255,255,0.25)",
                flexShrink: 0,
              }}
            >
              <Icon name="map-pin" size={12} />
            </div>
          )}
        </div>
      )}

      {s.status === "no_show" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(135deg, #fde7e9, #fde7e9 4px, #fbd0d4 4px, #fbd0d4 7px)",
            border: `1.5px solid ${tokens.color.danger}`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: tokens.color.dangerInk,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          <Icon name="alert" size={14} />
          NO-SHOW
        </div>
      )}

      {showVarianceTail && (
        <div
          style={{
            position: "absolute",
            top: -2,
            right: 0,
            height: 4,
            width: Math.abs(variance) * HOUR_PX,
            background: variance < 0 ? tokens.color.warn : "#6d28d9",
            borderRadius: 2,
            opacity: 0.7,
          }}
        />
      )}

      {s.status === "upcoming" && schW > 80 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: tokens.color.ink600,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: tokens.font.body,
          }}
        >
          {s.open ? "Open · " : ""}
          {fmtRange2(s.sch_start, s.sch_end)}
        </div>
      )}
    </div>
  );
}
