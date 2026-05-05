// RecruitmentHeader — exact AttendanceHeader shape:
// row 1 = breadcrumb + title + status chip (when pending > 0) + bell + Export + Copy apply link
// row 2 = tab strip (icon + label + count badge per tab) + search input on the right
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button, Input } from "../../../design-system";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { RecruitmentStats } from "../../../services/recruitmentService";

export type RecruitmentTab = "pending" | "approved" | "rejected" | "all";

interface TabSpec {
  id: RecruitmentTab;
  label: string;
  icon: IconName;
}

const TABS: TabSpec[] = [
  { id: "pending", label: "Pending review", icon: "clock" },
  { id: "approved", label: "Approved", icon: "check" },
  { id: "rejected", label: "Rejected", icon: "x" },
  { id: "all", label: "All applications", icon: "stack" },
];

export interface RecruitmentHeaderProps {
  view: RecruitmentTab;
  onViewChange: (next: RecruitmentTab) => void;
  stats: RecruitmentStats;
  search: string;
  onSearchChange: (value: string) => void;
  applyUrl: string | null;
  onCopyApplyLink: () => void;
  copyFeedback: string | null;
  onExport?: () => void;
  exportDisabled?: boolean;
}

export function RecruitmentHeader({
  view,
  onViewChange,
  stats,
  search,
  onSearchChange,
  applyUrl,
  onCopyApplyLink,
  copyFeedback,
  onExport,
  exportDisabled,
}: RecruitmentHeaderProps) {
  const { palette } = useAccent();

  const counts: Record<RecruitmentTab, number> = {
    pending: stats.pending,
    approved: stats.approved,
    rejected: stats.rejected,
    all: stats.total,
  };

  return (
    <header
      style={{
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 24px 12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: tokens.color.ink500,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <Link
              to="/dashboard"
              style={{ color: tokens.color.ink500, textDecoration: "none" }}
            >
              People
            </Link>
            <Icon name="chevron-right" size={11} />
            <span style={{ color: tokens.color.ink600 }}>Recruitment</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginTop: 2,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: tokens.font.display,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: tokens.color.ink900,
              }}
            >
              Recruitment
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>
              {stats.total} {stats.total === 1 ? "application" : "applications"}
            </span>
          </div>
        </div>

        {stats.pending > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: tokens.color.warnSoft,
              border: `1px solid ${tokens.color.warn}40`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: tokens.color.warn,
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: tokens.color.warnInk,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {stats.pending} PENDING
            </span>
          </div>
        )}

        <button
          type="button"
          aria-label="Notifications"
          style={{
            position: "relative",
            width: 38,
            height: 38,
            borderRadius: 8,
            background: tokens.color.ink100,
            border: "none",
            color: tokens.color.ink800,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Icon name="bell" size={18} />
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 7,
              width: 7,
              height: 7,
              borderRadius: 4,
              background: palette.primary,
              border: "2px solid white",
            }}
          />
        </button>

        <Button
          variant="secondary"
          leading={<Icon name="download" size={14} />}
          onClick={onExport}
          disabled={!onExport || exportDisabled}
        >
          Export
        </Button>

        {applyUrl && (
          <Button
            variant="primary"
            accent={palette}
            leading={<Icon name="copy" size={14} />}
            onClick={onCopyApplyLink}
          >
            {copyFeedback ?? "Copy apply link"}
          </Button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 24px",
          borderTop: `1px solid ${tokens.color.ink100}`,
        }}
      >
        {TABS.map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onViewChange(t.id)}
              style={{
                padding: "13px 4px",
                marginRight: 28,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderBottom: active
                  ? `2px solid ${palette.primary}`
                  : "2px solid transparent",
                color: active ? palette.ink : tokens.color.ink600,
                fontFamily: tokens.font.body,
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                letterSpacing: "-0.005em",
                marginBottom: -1,
                position: "relative",
              }}
            >
              <Icon name={t.icon} size={15} />
              <span>{t.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: active ? palette.soft : tokens.color.ink100,
                  color: active ? palette.ink : tokens.color.ink600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 0",
          }}
        >
          <Input
            leading={<Icon name="search" size={14} />}
            placeholder="Search applicant by name or email…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            wrapperStyle={{ width: 280, padding: "6px 10px" }}
          />
        </div>
      </div>
    </header>
  );
}
