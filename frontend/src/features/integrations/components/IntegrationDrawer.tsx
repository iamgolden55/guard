// IntegrationDrawer — right-slide overlay routing by integration kind.
//   • finance + not-connected → ConnectFinanceFlow (OAuth init)
//   • finance + connected     → status/test/refresh/disconnect actions
//   • deputy + not-connected  → ConnectDeputyForm (API key)
//   • deputy + connected      → status, sync buttons, disconnect, edit creds
//   • soon                    → coming-soon notice
import { format, parseISO } from "date-fns";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { ProviderConnection } from "../../../services/financeIntegrationsService";
import type { DeputyStatus } from "../../../types/deputy";
import type { CatalogItem } from "../data/catalog";
import { ConnectFinanceFlow } from "./ConnectFinanceFlow";
import { ConnectDeputyForm } from "./ConnectDeputyForm";

const FINANCE_TONE: Record<ProviderConnection["status"], PillTone> = {
  connected: "positive",
  pending: "warning",
  expired: "danger",
  error: "danger",
  disabled: "neutral",
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy 'at' HH:mm");
  } catch {
    return iso;
  }
}

export interface IntegrationDrawerProps {
  open: boolean;
  item: CatalogItem | null;
  financeConnection: ProviderConnection | null;
  deputyStatus: DeputyStatus | null;
  onClose: () => void;
  onTestFinance: (connectionId: number) => Promise<{ success: boolean; error?: string }>;
  onRefreshFinanceToken: (connectionId: number) => Promise<void>;
  onDisconnectFinance: (connection: ProviderConnection) => void;
  onDisconnectDeputy: () => void;
  onSaveDeputyCredentials: (data: {
    apiEndpoint: string;
    apiKey: string;
    isActive: boolean;
  }) => Promise<void>;
  onSyncDeputyEmployees: () => Promise<void>;
  onSyncDeputyTimesheets: () => Promise<void>;
  isFinanceMutating: boolean;
  isDeputyMutating: boolean;
}

export function IntegrationDrawer({
  open,
  item,
  financeConnection,
  deputyStatus,
  onClose,
  onTestFinance,
  onRefreshFinanceToken,
  onDisconnectFinance,
  onDisconnectDeputy,
  onSaveDeputyCredentials,
  onSyncDeputyEmployees,
  onSyncDeputyTimesheets,
  isFinanceMutating,
  isDeputyMutating,
}: IntegrationDrawerProps) {
  const [mount, setMount] = useState(open);
  const [vis, setVis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setMount(true);
      setError(null);
      setTestResult(null);
      requestAnimationFrame(() => setVis(true));
    } else {
      setVis(false);
      const t = setTimeout(() => setMount(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!mount) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: tokens.z.modal,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: vis ? "rgba(32,31,30,0.40)" : "rgba(32,31,30,0)",
          backdropFilter: vis ? "blur(2px)" : "none",
          transition: "background .2s",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 540,
          maxWidth: "100vw",
          height: "100%",
          background: "white",
          boxShadow: "-24px 0 48px -16px rgba(32,31,30,0.22)",
          transform: vis ? "translateX(0)" : "translateX(40px)",
          opacity: vis ? 1 : 0,
          transition: "transform .25s ease, opacity .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!item ? (
          <div />
        ) : (
          <>
            <Header item={item} onClose={onClose} />
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                background: tokens.color.ink50,
              }}
            >
              {item.kind === "soon" && <ComingSoonSection item={item} />}

              {item.kind === "finance" && financeConnection && (
                <ConnectedFinanceSection
                  connection={financeConnection}
                  onTest={async () => {
                    if (!financeConnection) return;
                    setTestResult(null);
                    setError(null);
                    try {
                      const res = await onTestFinance(financeConnection.id);
                      setTestResult({
                        success: res.success,
                        message: res.success
                          ? "Connection healthy."
                          : res.error || "Connection test failed.",
                      });
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Test failed.",
                      );
                    }
                  }}
                  onRefresh={async () => {
                    setError(null);
                    try {
                      await onRefreshFinanceToken(financeConnection.id);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Token refresh failed.",
                      );
                    }
                  }}
                  testResult={testResult}
                  isMutating={isFinanceMutating}
                />
              )}

              {item.kind === "finance" && !financeConnection && (
                <Section icon="external" label="Connect via OAuth">
                  <ConnectFinanceFlow item={item} onError={setError} />
                </Section>
              )}

              {item.kind === "deputy" && deputyStatus?.isConnected && (
                <ConnectedDeputySection
                  status={deputyStatus}
                  onSyncEmployees={onSyncDeputyEmployees}
                  onSyncTimesheets={onSyncDeputyTimesheets}
                  isMutating={isDeputyMutating}
                />
              )}

              {item.kind === "deputy" && (
                <Section
                  icon="lock"
                  label={
                    deputyStatus?.isConnected
                      ? "Update credentials"
                      : "Connect with API key"
                  }
                >
                  <ConnectDeputyForm
                    isUpdate={Boolean(deputyStatus?.isConnected)}
                    onSubmit={onSaveDeputyCredentials}
                    isSubmitting={isDeputyMutating}
                  />
                </Section>
              )}

              {error && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: tokens.color.dangerInk,
                    background: tokens.color.dangerSoft,
                    border: `1px solid ${tokens.color.danger}40`,
                    borderRadius: tokens.radius.md,
                    padding: "8px 12px",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <FooterActions
              item={item}
              financeConnection={financeConnection}
              deputyConnected={Boolean(deputyStatus?.isConnected)}
              onDisconnectFinance={onDisconnectFinance}
              onDisconnectDeputy={onDisconnectDeputy}
              isMutating={isFinanceMutating || isDeputyMutating}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  item,
  onClose,
}: {
  item: CatalogItem;
  onClose: () => void;
}) {
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        padding: "20px 24px 16px",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: `${item.brandColor}1a`,
          color: item.brandColor,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          fontFamily: tokens.font.display,
          fontWeight: 800,
          fontSize: 16,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 18,
            color: tokens.color.ink900,
            letterSpacing: "-0.015em",
          }}
        >
          {item.name}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 2,
          }}
        >
          {item.description}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tokens.color.ink100,
          border: "none",
          color: tokens.color.ink600,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

const SECTION_STYLE: CSSProperties = {
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.lg,
  padding: 18,
};

function Section({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={SECTION_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: tokens.color.ink100,
            color: tokens.color.ink700,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={13} />
        </span>
        <span
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 13,
            color: tokens.color.ink900,
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ComingSoonSection({ item }: { item: CatalogItem }) {
  return (
    <Section icon="info" label="Coming soon">
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.ink800,
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        We're building backend support for <strong>{item.name}</strong>. It
        isn't connectable yet, but it's on the roadmap.
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12.5,
          color: tokens.color.ink600,
          lineHeight: 1.55,
        }}
      >
        Want to help us prioritize? Tell your account manager which integrations
        matter most for your team.
      </div>
    </Section>
  );
}

function ConnectedFinanceSection({
  connection,
  onTest,
  onRefresh,
  testResult,
  isMutating,
}: {
  connection: ProviderConnection;
  onTest: () => Promise<void>;
  onRefresh: () => Promise<void>;
  testResult: { success: boolean; message: string } | null;
  isMutating: boolean;
}) {
  return (
    <Section icon="plug" label="Connection status">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 20px",
          marginBottom: 16,
        }}
      >
        <KV label="Status">
          <Pill tone={FINANCE_TONE[connection.status]} dot>
            {connection.status}
          </Pill>
        </KV>
        <KV label="Token">
          {connection.is_token_valid ? (
            <Pill tone="positive" dot>
              Valid
            </Pill>
          ) : (
            <Pill tone="warning" dot>
              Expired
            </Pill>
          )}
        </KV>
        <KV label="Tenant" value={connection.company_name || connection.tenant_id} />
        <KV
          label="Environment"
          value={connection.is_sandbox ? "Sandbox" : "Production"}
        />
        <KV label="Last sync" value={fmtDateTime(connection.last_sync_at)} />
        <KV label="Connected by" value={connection.created_by_name} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          onClick={onTest}
          disabled={isMutating}
          leading={<Icon name="check" size={13} />}
        >
          Test connection
        </Button>
        {!connection.is_token_valid && (
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={isMutating}
            leading={<Icon name="refresh" size={13} />}
          >
            Refresh token
          </Button>
        )}
      </div>

      {testResult && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: tokens.radius.md,
            background: testResult.success
              ? tokens.color.successSoft
              : tokens.color.dangerSoft,
            color: testResult.success
              ? tokens.color.successInk
              : tokens.color.dangerInk,
            fontSize: 12.5,
            fontFamily: tokens.font.body,
          }}
        >
          {testResult.message}
        </div>
      )}

      {connection.error_message && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: tokens.radius.md,
            background: tokens.color.dangerSoft,
            color: tokens.color.dangerInk,
            fontSize: 12.5,
            fontFamily: tokens.font.body,
          }}
        >
          {connection.error_message}
        </div>
      )}
    </Section>
  );
}

function ConnectedDeputySection({
  status,
  onSyncEmployees,
  onSyncTimesheets,
  isMutating,
}: {
  status: DeputyStatus;
  onSyncEmployees: () => Promise<void>;
  onSyncTimesheets: () => Promise<void>;
  isMutating: boolean;
}) {
  return (
    <Section icon="plug" label="Connection status">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 20px",
          marginBottom: 16,
        }}
      >
        <KV label="Status">
          <Pill tone={status.errorMessage ? "danger" : "positive"} dot>
            {status.errorMessage ? "Error" : "Connected"}
          </Pill>
        </KV>
        <KV label="Last sync" value={fmtDateTime(status.lastSyncDate)} />
        <KV label="Employees" value={String(status.employeeCount)} />
        <KV label="Timesheets" value={String(status.timesheetCount)} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          onClick={onSyncEmployees}
          disabled={isMutating}
          leading={<Icon name="refresh" size={13} />}
        >
          Sync employees
        </Button>
        <Button
          variant="secondary"
          onClick={onSyncTimesheets}
          disabled={isMutating}
          leading={<Icon name="refresh" size={13} />}
        >
          Sync timesheets
        </Button>
      </div>

      {status.errorMessage && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: tokens.radius.md,
            background: tokens.color.dangerSoft,
            color: tokens.color.dangerInk,
            fontSize: 12.5,
            fontFamily: tokens.font.body,
          }}
        >
          {status.errorMessage}
        </div>
      )}
    </Section>
  );
}

function KV({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.ink900,
          wordBreak: "break-word",
        }}
      >
        {children ??
          (value || <span style={{ color: tokens.color.ink500 }}>—</span>)}
      </div>
    </div>
  );
}

function FooterActions({
  item,
  financeConnection,
  deputyConnected,
  onDisconnectFinance,
  onDisconnectDeputy,
  isMutating,
}: {
  item: CatalogItem;
  financeConnection: ProviderConnection | null;
  deputyConnected: boolean;
  onDisconnectFinance: (c: ProviderConnection) => void;
  onDisconnectDeputy: () => void;
  isMutating: boolean;
}) {
  const showDisconnect =
    (item.kind === "finance" && financeConnection) ||
    (item.kind === "deputy" && deputyConnected);

  return (
    <div
      style={{
        padding: "14px 24px",
        background: "white",
        borderTop: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 11.5, color: tokens.color.ink500 }}>
        {item.kind === "soon"
          ? "Awaiting backend support"
          : item.kind === "finance"
            ? "OAuth · token-based auth"
            : "API key · server-stored"}
      </span>
      {showDisconnect && (
        <Button
          variant="ghost"
          onClick={() => {
            if (item.kind === "finance" && financeConnection) {
              onDisconnectFinance(financeConnection);
            } else if (item.kind === "deputy") {
              onDisconnectDeputy();
            }
          }}
          disabled={isMutating}
        >
          Disconnect
        </Button>
      )}
    </div>
  );
}
