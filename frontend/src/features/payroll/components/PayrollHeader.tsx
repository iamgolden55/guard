// PayrollHeader — page-level header (breadcrumb + title + search + bell +
// Download payslips + Export to Xero).
// Ported 1:1 from project/payroll-shell.jsx Topbar (lines 147-196).
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button } from "../../../design-system";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { PayrollCycle, PayrollRun } from "../data/mocks";

export interface PayrollHeaderProps {
  /** Kept for backward compat — run code is shown in the hero, not the topbar. */
  run?: PayrollRun;
  /** Active pay cycle. Drives the segmented toggle. */
  cycle?: PayrollCycle;
  onCycleChange?: (cycle: PayrollCycle) => void;
  /** Triggered by the primary "Export to Xero" action. */
  onOpenExport?: () => void;
  /** Triggered by the secondary "Download payslips" action. */
  onDownloadPayslips?: () => void;
}

export function PayrollHeader({
  cycle = "weekly",
  onCycleChange,
  onOpenExport,
  onDownloadPayslips,
}: PayrollHeaderProps = {}) {
  const { palette } = useAccent();
  return (
    <header
      style={{
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
        padding: "16px 28px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
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
            Finance
          </Link>
          <Icon name="chevron-right" size={11} />
          <span style={{ color: tokens.color.ink600 }}>Payroll</span>
        </div>
        <h1
          style={{
            margin: "2px 0 0",
            fontFamily: tokens.font.display,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: tokens.color.ink900,
          }}
        >
          Payroll
        </h1>
      </div>

      {/* P6 (M3 fix): removed unbound dummy search input — real search lives
          in FilterBar inside the page body, properly bound to state. */}

      <CycleToggle
        cycle={cycle}
        onChange={onCycleChange}
        accent={palette.ink}
      />

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
        leading={<Icon name="file" size={14} />}
        onClick={onDownloadPayslips}
      >
        Download payslips
      </Button>
      <Button
        variant="primary"
        accent={palette}
        leading={<Icon name="external" size={14} />}
        onClick={onOpenExport}
      >
        Export to Xero
      </Button>
    </header>
  );
}

interface CycleToggleProps {
  cycle: PayrollCycle;
  onChange?: (next: PayrollCycle) => void;
  accent: string;
}

/** Segmented Weekly/Monthly switch. Weekly covers contractor/part-time staff
 * paid per ISO week; Monthly covers full-time employees paid on the
 * calendar-month cycle. Driven by StaffProfile.pay_frequency. */
function CycleToggle({ cycle, onChange, accent }: CycleToggleProps) {
  const options: { value: PayrollCycle; label: string }[] = [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Pay cycle"
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 8,
        background: tokens.color.ink100,
        border: `1px solid ${tokens.color.ink200}`,
      }}
    >
      {options.map((opt) => {
        const active = cycle === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onChange?.(opt.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: active ? "white" : "transparent",
              color: active ? accent : tokens.color.ink600,
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              fontWeight: active ? 700 : 500,
              border: "none",
              cursor: active ? "default" : "pointer",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              transition: "background .15s, color .15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
