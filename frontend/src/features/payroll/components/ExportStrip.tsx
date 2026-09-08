// ExportStrip — payment + export status row.
// Ported 1:1 from project/payroll-hero.jsx:114-160.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import billingService from "../../../services/billingService";
import { PROVIDERS } from "../data/mocks";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "1";

export interface ExportStripProps {
  onOpenExport: () => void;
  /** Process date for the current run, used in the status copy. */
  processDate?: string;
}

export function ExportStrip({ onOpenExport, processDate }: ExportStripProps) {
  const providersQuery = useQuery({
    queryKey: ["billing", "providers"],
    queryFn: () => billingService.getFinanceProviders(),
    enabled: !USE_MOCKS,
    staleTime: 5 * 60_000,
  });
  // Falling back to the PROVIDERS fixture whenever the real list came back
  // empty meant a company with no accounting integration still saw
  // "Xero · 2 connectors connected" on its payroll screen.
  const providers = USE_MOCKS ? PROVIDERS : (providersQuery.data ?? []);
  const defaultProvider = providers.find((p) => p.default) ?? providers[0];
  const connected = providers.filter((p) => p.connected);
  const processed = processDate
    ? new Date(processDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "Mon 27 Apr";

  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 14,
        padding: "14px 20px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: 20,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            flexShrink: 0,
            background: tokens.color.warnSoft,
            color: tokens.color.warn,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="clock" size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: tokens.color.ink600,
              marginBottom: 2,
            }}
          >
            Payment status
          </div>
          <div style={{ fontSize: 13.5, color: tokens.color.ink900, lineHeight: 1.35 }}>
            <strong>Pending</strong> — weekly run processed {processed} · marked paid once cleared by
            accounts
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderLeft: `1px solid ${tokens.color.ink200}`,
          paddingLeft: 20,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            flexShrink: 0,
            background: defaultProvider
              ? `${defaultProvider.color}22`
              : tokens.color.ink100,
            color: defaultProvider ? defaultProvider.color : tokens.color.ink600,
            display: "grid",
            placeItems: "center",
            fontFamily: tokens.font.display,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {defaultProvider ? defaultProvider.name[0] : <Icon name="plug" size={16} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: tokens.color.ink600,
              marginBottom: 2,
            }}
          >
            {defaultProvider
              ? `Export to ${defaultProvider.name}`
              : "Accounting export"}
          </div>
          <div style={{ fontSize: 13.5, color: tokens.color.ink900, lineHeight: 1.35 }}>
            {defaultProvider ? (
              <>
                Not yet exported ·{" "}
                <span style={{ color: tokens.color.ink600 }}>
                  {connected.length} connector
                  {connected.length === 1 ? "" : "s"} connected
                </span>
              </>
            ) : (
              <span style={{ color: tokens.color.ink600 }}>
                No accounting provider connected —{" "}
                <Link to="/integrations" style={{ color: "inherit", fontWeight: 600 }}>
                  set one up in Integrations
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      <Button
        variant="secondary"
        size="md"
        leading={<Icon name="external" size={13} />}
        onClick={onOpenExport}
        disabled={!defaultProvider}
        title={
          defaultProvider
            ? undefined
            : "Connect an accounting provider before exporting"
        }
      >
        Export options
      </Button>
    </div>
  );
}
