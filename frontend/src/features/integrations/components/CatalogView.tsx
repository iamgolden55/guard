// CatalogView — grid of IntegrationCard tiles grouped by category.
// Tiles can be filtered by the search query. "Coming soon" tiles render
// last within each category.
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { tokens } from "../../../design-system/tokens";
import { Icon } from "../../../design-system/Icon";
import { IntegrationCard } from "./IntegrationCard";
import {
  CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CatalogItem,
  type IntegrationCategory,
} from "../data/catalog";
import type { ProviderConnection } from "../../../services/financeIntegrationsService";
import type { DeputyStatus } from "../../../types/deputy";

export interface CatalogViewProps {
  search: string;
  financeConnections: ProviderConnection[];
  deputyStatus: DeputyStatus | null;
  onSelect: (item: CatalogItem) => void;
}

function detailForFinance(connection: ProviderConnection | null): string | undefined {
  if (!connection) return undefined;
  if (connection.last_sync_at) {
    try {
      return `Synced ${formatDistanceToNow(parseISO(connection.last_sync_at), {
        addSuffix: true,
      })}`;
    } catch {
      // fall through
    }
  }
  if (connection.is_sandbox) return "Sandbox · not synced yet";
  return "Connected · awaiting first sync";
}

function detailForDeputy(status: DeputyStatus | null): string | undefined {
  if (!status?.isConnected) return undefined;
  if (status.lastSyncDate) {
    try {
      return `Synced ${format(parseISO(status.lastSyncDate), "d MMM, HH:mm")}`;
    } catch {
      return "Connected";
    }
  }
  return `${status.employeeCount} employees synced`;
}

export function CatalogView({
  search,
  financeConnections,
  deputyStatus,
  onSelect,
}: CatalogViewProps) {
  const q = search.trim().toLowerCase();
  const items = q
    ? CATALOG.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
    : CATALOG;

  if (items.length === 0) {
    return (
      <ScrollWrap>
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
            <Icon name="search" size={20} />
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
            No integrations match “{search}”
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              color: tokens.color.ink500,
            }}
          >
            Try a broader search or browse by category.
          </div>
        </div>
      </ScrollWrap>
    );
  }

  // Group + order: connectable first within each category, "soon" last.
  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const inCat = items
        .filter((c) => c.category === cat)
        .sort((a, b) => {
          if (a.kind === "soon" && b.kind !== "soon") return 1;
          if (a.kind !== "soon" && b.kind === "soon") return -1;
          return a.name.localeCompare(b.name);
        });
      if (inCat.length > 0) acc.push({ category: cat, items: inCat });
      return acc;
    },
    [] as Array<{ category: IntegrationCategory; items: CatalogItem[] }>,
  );

  return (
    <ScrollWrap>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {grouped.map(({ category, items: catItems }) => (
          <CategorySection
            key={category}
            label={CATEGORY_LABELS[category]}
            items={catItems}
            onSelect={onSelect}
            financeConnections={financeConnections}
            deputyStatus={deputyStatus}
          />
        ))}
      </div>
    </ScrollWrap>
  );
}

function CategorySection({
  label,
  items,
  onSelect,
  financeConnections,
  deputyStatus,
}: {
  label: string;
  items: CatalogItem[];
  onSelect: (item: CatalogItem) => void;
  financeConnections: ProviderConnection[];
  deputyStatus: DeputyStatus | null;
}) {
  return (
    <section>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {items.map((item) => {
          let connected = false;
          let detail: string | undefined;

          if (item.kind === "finance") {
            const conn = financeConnections.find(
              (c) => c.provider_key === item.providerKey,
            );
            connected = Boolean(conn);
            detail = detailForFinance(conn ?? null);
          } else if (item.kind === "deputy") {
            connected = Boolean(deputyStatus?.isConnected);
            detail = detailForDeputy(deputyStatus);
          }

          return (
            <IntegrationCard
              key={item.id}
              item={item}
              connected={connected}
              detail={detail}
              onClick={() => onSelect(item)}
            />
          );
        })}
      </div>
    </section>
  );
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
