// InvoicesHeader — breadcrumb + title + overdue pill + ledger toggle +
// notifications + actions, plus tab strip with counts.
// Ported 1:1 from project/invoice-shell.jsx ITopbar (lines 131-251).
import { Link } from "react-router-dom";
import { useAccent } from "../../../contexts/AccentContext";
import { Button } from "../../../design-system";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  moneyShort,
  TODAY_STR,
  type InvoiceKind,
  type InvoiceStats,
} from "../data/mocks";

export type InvoicesTab = "outbox" | "my" | "archive";

export interface InvoicesHeaderProps {
  tab: InvoicesTab;
  onTabChange: (next: InvoicesTab) => void;
  ledger: InvoiceKind;
  onLedgerChange: (next: InvoiceKind) => void;
  stats: InvoiceStats;
  onNew: () => void;
  onStatement: () => void;
  /** Outbox-only: toggle visibility of the left list pane and right details pane. */
  leftPaneOpen?: boolean;
  rightPaneOpen?: boolean;
  onToggleLeftPane?: () => void;
  onToggleRightPane?: () => void;
}

const TAB_SPECS: { id: InvoicesTab; label: string; icon: IconName }[] = [
  { id: "outbox", label: "Outbox", icon: "send" },
  { id: "my", label: "My invoices", icon: "user" },
  { id: "archive", label: "Archive", icon: "stack" },
];

export function InvoicesHeader({
  tab,
  onTabChange,
  ledger,
  onLedgerChange,
  stats,
  onNew,
  leftPaneOpen,
  rightPaneOpen,
  onToggleLeftPane,
  onToggleRightPane,
  onStatement,
}: InvoicesHeaderProps) {
  const { palette } = useAccent();

  const tabCount = (id: InvoicesTab) => {
    if (id === "outbox") return stats.counts.draft + stats.counts.sent + stats.counts.overdue;
    if (id === "archive") return stats.counts.paid;
    return null;
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px 12px" }}>
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
            <span style={{ color: tokens.color.ink600 }}>Invoices</span>
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
              Invoices
            </h1>
            <span style={{ fontSize: 13, color: tokens.color.ink600 }}>{TODAY_STR}</span>
            {stats.counts.overdue > 0 && tab === "outbox" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: tokens.color.dangerSoft,
                  color: "#8a1820",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Icon name="warning" size={12} />
                {stats.counts.overdue} overdue · {moneyShort(stats.totals.overdue)}
              </span>
            )}
          </div>
        </div>

        {tab !== "my" && (
          <div
            role="tablist"
            style={{
              display: "inline-flex",
              padding: 3,
              borderRadius: 999,
              background: tokens.color.ink100,
              border: `1px solid ${tokens.color.ink200}`,
            }}
          >
            {(
              [
                ["client", "Clients", "building"],
                ["staff", "Staff", "user"],
              ] as [InvoiceKind, string, IconName][]
            ).map(([id, label, icon]) => {
              const active = ledger === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onLedgerChange(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: active ? "white" : "transparent",
                    color: active ? palette.ink : tokens.color.ink600,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: tokens.font.body,
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    boxShadow: active ? "0 1px 3px rgba(32,31,30,0.08)" : "none",
                    transition: "all .15s",
                  }}
                >
                  <Icon name={icon} size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {tab === "outbox" && onToggleLeftPane && (
          <PaneToggleButton
            side="left"
            open={leftPaneOpen ?? true}
            onClick={onToggleLeftPane}
          />
        )}
        {tab === "outbox" && onToggleRightPane && (
          <PaneToggleButton
            side="right"
            open={rightPaneOpen ?? true}
            onClick={onToggleRightPane}
          />
        )}

        <button
          type="button"
          aria-label="Notifications"
          style={{
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

        {tab === "outbox" && (
          <>
            <Button
              variant="secondary"
              leading={<Icon name="mail" size={14} />}
              onClick={onStatement}
            >
              Send statement…
            </Button>
            <Button
              variant="primary"
              accent={palette}
              leading={<Icon name="plus" size={14} />}
              onClick={onNew}
            >
              New invoice
            </Button>
          </>
        )}
        {tab === "my" && (
          <Button variant="secondary" leading={<Icon name="download" size={14} />}>
            Download all
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
        {TAB_SPECS.map((t) => {
          const active = tab === t.id;
          const count = tabCount(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              style={{
                padding: "13px 4px",
                marginRight: 28,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderBottom: active ? `2px solid ${palette.primary}` : "2px solid transparent",
                color: active ? palette.ink : tokens.color.ink600,
                fontFamily: tokens.font.body,
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                letterSpacing: "-0.005em",
                marginBottom: -1,
              }}
            >
              <Icon name={t.icon} size={15} />
              <span>{t.label}</span>
              {count != null && (
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
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}

interface PaneToggleButtonProps {
  side: "left" | "right";
  open: boolean;
  onClick: () => void;
}

function PaneToggleButton({ side, open, onClick }: PaneToggleButtonProps) {
  const label =
    side === "left"
      ? open
        ? "Hide invoice list"
        : "Show invoice list"
      : open
        ? "Hide details panel"
        : "Show details panel";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: open ? tokens.color.ink100 : "transparent",
        border: open ? "none" : `1px solid ${tokens.color.ink200}`,
        color: open ? tokens.color.ink800 : tokens.color.ink500,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background .15s, color .15s",
      }}
    >
      <Icon name={side === "left" ? "panel-left" : "panel-right"} size={17} />
    </button>
  );
}
