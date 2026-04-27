// PayrollHeader — page-level header (breadcrumb + title + bell).
// The hero + filter bar handle in-page actions; this matches the
// breadcrumb pattern used by Attendance and Invoices.
import { Link } from "react-router-dom";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { CURRENT_RUN } from "../data/mocks";

export function PayrollHeader() {
  return (
    <header
      style={{
        background: "white",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        position: "sticky",
        top: 0,
        zIndex: tokens.z.sticky,
        padding: "14px 28px 16px",
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
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
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
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
            Payroll
          </h1>
          <span style={{ fontSize: 13, color: tokens.color.ink600 }}>
            Processed Mon 27 Apr · {CURRENT_RUN.id}
          </span>
        </div>
      </div>

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
      </button>
    </header>
  );
}
