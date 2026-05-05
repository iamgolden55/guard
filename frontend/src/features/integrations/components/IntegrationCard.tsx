// IntegrationCard — single tile in the catalog grid.
// Renders the provider's brand monogram (or logo if available), name,
// description, and a status pill (Connected / Connect / Coming soon).
import { Card } from "../../../design-system/primitives/Card";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { CatalogItem } from "../data/catalog";

export interface IntegrationCardProps {
  item: CatalogItem;
  /** Whether a real ProviderConnection or DeputyConfig is wired up */
  connected: boolean;
  /** Optional sub-label, e.g. "Last synced 12 min ago" */
  detail?: string;
  /** Tone for the status pill (overrides the connected/not-connected default) */
  statusTone?: PillTone;
  /** Status pill label override */
  statusLabel?: string;
  onClick: () => void;
}

export function IntegrationCard({
  item,
  connected,
  detail,
  statusTone,
  statusLabel,
  onClick,
}: IntegrationCardProps) {
  const isSoon = item.kind === "soon";

  const tone: PillTone =
    statusTone ?? (isSoon ? "neutral" : connected ? "positive" : "info");
  const label =
    statusLabel ?? (isSoon ? "Coming soon" : connected ? "Connected" : "Available");

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        padding: 0,
        margin: 0,
        border: "none",
        background: "transparent",
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        opacity: isSoon ? 0.85 : 1,
      }}
    >
      <Card
        padding={18}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          transition: `transform ${tokens.motion.fast}, box-shadow ${tokens.motion.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = tokens.shadow.md;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "";
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Monogram item={item} />
          <Pill tone={tone} dot={!isSoon}>
            {label}
          </Pill>
        </div>
        <div>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 15,
              color: tokens.color.ink900,
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            {item.name}
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              color: tokens.color.ink600,
              lineHeight: 1.5,
              minHeight: 36,
            }}
          >
            {item.description}
          </div>
        </div>
        {detail && (
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 11.5,
              color: tokens.color.ink500,
              borderTop: `1px solid ${tokens.color.ink100}`,
              paddingTop: 10,
              marginTop: "auto",
            }}
          >
            {detail}
          </div>
        )}
      </Card>
    </button>
  );
}

function Monogram({ item }: { item: CatalogItem }) {
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
        position: "relative",
      }}
    >
      <Icon name={item.icon} size={20} />
      <span
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          fontFamily: tokens.font.display,
          fontWeight: 800,
          fontSize: 9,
          padding: "2px 5px",
          borderRadius: 4,
          background: item.brandColor,
          color: "white",
          letterSpacing: "0.05em",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
