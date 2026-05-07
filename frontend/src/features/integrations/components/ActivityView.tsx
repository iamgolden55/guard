// ActivityView — chronological feed combining finance + Deputy sync logs.
import { format, parseISO } from "date-fns";
import { Card } from "../../../design-system/primitives/Card";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type {
  ActivityEntry,
  ActivityLevel,
} from "../hooks/useIntegrationsData";

const LEVEL_TONE: Record<ActivityLevel, PillTone> = {
  info: "neutral",
  success: "positive",
  warning: "warning",
  error: "danger",
};

function fmt(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM, HH:mm");
  } catch {
    return iso;
  }
}

export interface ActivityViewProps {
  activity: ActivityEntry[];
  isLoading: boolean;
}

export function ActivityView({ activity, isLoading }: ActivityViewProps) {
  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty title="Loading activity…" />
      </ScrollWrap>
    );
  }

  if (activity.length === 0) {
    return (
      <ScrollWrap>
        <Empty
          title="No sync activity yet"
          hint="Once an integration runs a sync or webhook arrives, it'll appear here."
        />
      </ScrollWrap>
    );
  }

  return (
    <ScrollWrap>
      <Card padding={0}>
        <div>
          {activity.map((entry, index) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              isLast={index === activity.length - 1}
            />
          ))}
        </div>
      </Card>
    </ScrollWrap>
  );
}

function ActivityRow({
  entry,
  isLast,
}: {
  entry: ActivityEntry;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderBottom: isLast
          ? "none"
          : `1px solid ${tokens.color.ink100}`,
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background:
            entry.level === "success"
              ? tokens.color.successSoft
              : entry.level === "error"
                ? tokens.color.dangerSoft
                : entry.level === "warning"
                  ? tokens.color.warnSoft
                  : tokens.color.ink100,
          color:
            entry.level === "success"
              ? tokens.color.successInk
              : entry.level === "error"
                ? tokens.color.dangerInk
                : entry.level === "warning"
                  ? tokens.color.warnInk
                  : tokens.color.ink600,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          name={
            entry.level === "success"
              ? "check"
              : entry.level === "error"
                ? "shield-x"
                : entry.level === "warning"
                  ? "warning"
                  : "info"
          }
          size={14}
        />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 13,
              color: tokens.color.ink900,
            }}
          >
            {entry.providerLabel}
          </span>
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: 11.5,
              color: tokens.color.ink500,
              padding: "1px 6px",
              borderRadius: 4,
              background: tokens.color.ink50,
            }}
          >
            {entry.operation}
          </span>
        </div>
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 3,
          }}
        >
          {entry.message}
        </div>
      </div>
      <Pill tone={LEVEL_TONE[entry.level]} dot>
        {entry.level}
      </Pill>
      <span
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12,
          color: tokens.color.ink500,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {fmt(entry.timestamp)}
      </span>
    </div>
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
        <Icon name="history" size={20} />
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
