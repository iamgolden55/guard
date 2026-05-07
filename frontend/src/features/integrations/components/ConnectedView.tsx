// ConnectedView — list of active connections with status, last sync,
// and "Manage" CTA that opens the drawer.
import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { Card } from "../../../design-system/primitives/Card";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { findCatalogItemByProviderKey, findCatalogItem } from "../data/catalog";
import type {
  CatalogItem,
} from "../data/catalog";
import type { ProviderConnection } from "../../../services/financeIntegrationsService";
import type { DeputyStatus } from "../../../types/deputy";

const FINANCE_STATUS_TONE: Record<ProviderConnection["status"], PillTone> = {
  connected: "positive",
  pending: "warning",
  expired: "danger",
  error: "danger",
  disabled: "neutral",
};

export interface ConnectedViewProps {
  financeConnections: ProviderConnection[];
  deputyStatus: DeputyStatus | null;
  isLoading: boolean;
  onSelect: (item: CatalogItem) => void;
}

export function ConnectedView({
  financeConnections,
  deputyStatus,
  isLoading,
  onSelect,
}: ConnectedViewProps) {
  const totalConnected =
    financeConnections.length + (deputyStatus?.isConnected ? 1 : 0);

  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty title="Loading connections…" />
      </ScrollWrap>
    );
  }

  if (totalConnected === 0) {
    return (
      <ScrollWrap>
        <Empty
          title="No active integrations yet"
          hint="Browse the catalog and connect your first integration."
        />
      </ScrollWrap>
    );
  }

  return (
    <ScrollWrap>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {financeConnections.map((conn) => {
          const item = findCatalogItemByProviderKey(conn.provider_key);
          if (!item) return null;
          return (
            <FinanceConnectionRow
              key={conn.id}
              item={item}
              connection={conn}
              onSelect={() => onSelect(item)}
            />
          );
        })}
        {deputyStatus?.isConnected && (
          <DeputyConnectionRow
            status={deputyStatus}
            onSelect={() => {
              const deputy = findCatalogItem("deputy");
              if (deputy) onSelect(deputy);
            }}
          />
        )}
      </div>
    </ScrollWrap>
  );
}

function FinanceConnectionRow({
  item,
  connection,
  onSelect,
}: {
  item: CatalogItem;
  connection: ProviderConnection;
  onSelect: () => void;
}) {
  const lastSync = connection.last_sync_at
    ? safeRelative(connection.last_sync_at)
    : "Awaiting first sync";

  return (
    <Card padding={18}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Logo item={item} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 15,
                color: tokens.color.ink900,
              }}
            >
              {item.name}
            </span>
            <Pill tone={FINANCE_STATUS_TONE[connection.status]} dot>
              {connection.status}
            </Pill>
            {connection.is_sandbox && <Pill tone="info">Sandbox</Pill>}
            {!connection.is_token_valid && (
              <Pill tone="warning" dot>
                Token expired
              </Pill>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 6,
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              color: tokens.color.ink600,
              flexWrap: "wrap",
            }}
          >
            <span>{connection.company_name || "—"}</span>
            <span style={{ color: tokens.color.ink400 }}>·</span>
            <span>Last sync {lastSync}</span>
            <span style={{ color: tokens.color.ink400 }}>·</span>
            <span>Connected by {connection.created_by_name}</span>
          </div>
          {connection.error_message && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: tokens.radius.md,
                background: tokens.color.dangerSoft,
                color: tokens.color.dangerInk,
                fontSize: 12,
                fontFamily: tokens.font.body,
              }}
            >
              {connection.error_message}
            </div>
          )}
        </div>
        <ManageButton onClick={onSelect} />
      </div>
    </Card>
  );
}

function DeputyConnectionRow({
  status,
  onSelect,
}: {
  status: DeputyStatus;
  onSelect: () => void;
}) {
  const item = findCatalogItem("deputy");
  if (!item) return null;
  const lastSync = status.lastSyncDate
    ? safeRelative(status.lastSyncDate)
    : "Awaiting first sync";

  return (
    <Card padding={18}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Logo item={item} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 15,
                color: tokens.color.ink900,
              }}
            >
              {item.name}
            </span>
            <Pill tone={status.errorMessage ? "danger" : "positive"} dot>
              {status.errorMessage ? "error" : "connected"}
            </Pill>
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 6,
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              color: tokens.color.ink600,
              flexWrap: "wrap",
            }}
          >
            <span>{status.employeeCount} employees</span>
            <span style={{ color: tokens.color.ink400 }}>·</span>
            <span>{status.timesheetCount} timesheets</span>
            <span style={{ color: tokens.color.ink400 }}>·</span>
            <span>Last sync {lastSync}</span>
          </div>
          {status.errorMessage && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: tokens.radius.md,
                background: tokens.color.dangerSoft,
                color: tokens.color.dangerInk,
                fontSize: 12,
                fontFamily: tokens.font.body,
              }}
            >
              {status.errorMessage}
            </div>
          )}
        </div>
        <ManageButton onClick={onSelect} />
      </div>
    </Card>
  );
}

function Logo({ item }: { item: CatalogItem }) {
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${item.brandColor}1a`,
        color: item.brandColor,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        fontFamily: tokens.font.display,
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: "0.04em",
      }}
    >
      {initials}
    </div>
  );
}

function ManageButton({ onClick }: { onClick: () => void }) {
  const STYLE: CSSProperties = {
    background: "white",
    color: tokens.color.ink700,
    border: `1px solid ${tokens.color.ink200}`,
    borderRadius: tokens.radius.md,
    padding: "8px 14px",
    fontFamily: tokens.font.display,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  };
  return (
    <button type="button" onClick={onClick} style={STYLE}>
      Manage
    </button>
  );
}

function safeRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function ScrollWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 24,
        background: tokens.color.ink50,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "60px 20px",
        textAlign: "center",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: "0 auto 12px",
          borderRadius: 22,
          background: tokens.color.ink100,
          display: "grid",
          placeItems: "center",
          color: tokens.color.ink500,
        }}
      >
        <Icon name="plug" size={20} />
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 14,
          color: tokens.color.ink800,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

// Re-export needed because ManageButton uses CSSProperties via callsite
export type { CatalogItem };
