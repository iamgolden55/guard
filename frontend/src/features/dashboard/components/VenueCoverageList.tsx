// VenueCoverageList — ported from project/dashboard.jsx:492-536.
// Card shows top 5 venues; "View all" opens a modal with the full list.
import { useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Icon } from "../../../design-system/Icon";
import { Modal } from "../../../design-system/primitives/Modal";
import { Pill } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import type { DashboardVenue } from "../data/mocks";

const TOP_N = 5;

export interface VenueCoverageListProps {
  venues: DashboardVenue[];
}

export function VenueCoverageList({ venues }: VenueCoverageListProps) {
  const { palette } = useAccent();
  const [open, setOpen] = useState(false);
  const visible = venues.slice(0, TOP_N);
  const hasMore = venues.length > TOP_N;

  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding: 20,
        fontFamily: tokens.font.body,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: tokens.color.ink900,
            }}
          >
            Venue coverage
          </h3>
          <div
            style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 2 }}
          >
            Live staffing vs contracted requirement
          </div>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: palette.primary,
              fontFamily: tokens.font.body,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer",
              padding: 0,
            }}
          >
            View all ({venues.length}) <Icon name="chevron-right" size={12} />
          </button>
        )}
      </div>

      <VenueRows
        venues={visible}
        primary={palette.primary}
        dark={palette.dark}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Venue coverage"
        description={`All ${venues.length} venues · staffed vs required this week`}
        size="lg"
      >
        <VenueRows
          venues={venues}
          primary={palette.primary}
          dark={palette.dark}
        />
      </Modal>
    </div>
  );
}

interface VenueRowsProps {
  venues: DashboardVenue[];
  primary: string;
  dark: string;
}

function VenueRows({ venues, primary, dark }: VenueRowsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {venues.map((v) => {
        const under = v.staffed < v.required;
        const pct = v.coverage;
        return (
          <div
            key={v.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: 16,
              alignItems: "center",
              padding: "10px 4px",
              borderBottom: `1px solid ${tokens.color.ink100}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: tokens.color.ink900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {v.name}
                </div>
                {v.incidents > 0 && (
                  <Pill tone="warning" dot>
                    {v.incidents} incident{v.incidents > 1 ? "s" : ""}
                  </Pill>
                )}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: tokens.color.ink500,
                  marginTop: 2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {v.staffed} / {v.required} officers deployed
              </div>
            </div>
            <div style={{ width: 120 }}>
              <div
                style={{
                  height: 6,
                  background: tokens.color.ink100,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: under
                      ? "linear-gradient(90deg,#f59e0b,#d97706)"
                      : `linear-gradient(90deg, ${primary}, ${dark})`,
                    transition: "width .4s",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 14,
                color: under ? tokens.color.warn : tokens.color.success,
                width: 44,
                textAlign: "right",
              }}
            >
              {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
