// WelcomeBanner — ported 1:1 from project/dashboard.jsx:825-908.
import { useMemo } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { BannerVisual } from "./BannerVisual";

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export interface WelcomeBannerProps {
  onSchedule?: () => void;
  onManage?: () => void;
  approvalsCount?: number;
  expiringLicensesCount?: number;
}

export function WelcomeBanner({
  onSchedule,
  onManage,
  approvalsCount = 0,
  expiringLicensesCount = 0,
}: WelcomeBannerProps) {
  const { palette } = useAccent();
  const { authState } = useAuth();

  const now = useMemo(() => new Date(), []);
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const greet = greeting(now);
  const firstName = authState.user?.firstName || authState.user?.username || "there";

  return (
    <div
      style={{
        position: "relative",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 14,
        padding: "26px 28px",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 24,
        alignItems: "center",
        minHeight: 180,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -80,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.soft} 0%, transparent 70%)`,
          pointerEvents: "none",
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${palette.primary}, ${palette.dark})`,
          opacity: 0.9,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            padding: "4px 10px",
            borderRadius: 999,
            background: palette.soft,
            color: palette.ink,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: palette.primary,
              animation: "ms-pulse 1.8s infinite",
            }}
          />
          {dateStr}
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: tokens.font.display,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: tokens.color.ink900,
            lineHeight: 1.15,
          }}
        >
          {greet}, {firstName}.
        </h2>
        <p
          style={{
            margin: "8px 0 18px",
            fontSize: 14,
            color: tokens.color.ink600,
            maxWidth: 520,
            lineHeight: 1.55,
          }}
        >
          You have{" "}
          <strong style={{ color: tokens.color.ink900 }}>
            {approvalsCount} {approvalsCount === 1 ? "approval" : "approvals"}
          </strong>{" "}
          awaiting review and{" "}
          <strong style={{ color: palette.primary }}>
            {expiringLicensesCount} {expiringLicensesCount === 1 ? "officer" : "officers"}
          </strong>{" "}
          with SIA licences expiring this month. Everything else is on track.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSchedule}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: tokens.color.ink900,
              color: "white",
              border: "none",
              padding: "11px 18px",
              borderRadius: 9,
              fontFamily: tokens.font.display,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
              letterSpacing: "-0.005em",
              boxShadow: "0 6px 14px -6px rgba(32,31,30,0.4)",
            }}
          >
            <Icon name="calendar" size={15} /> View schedule
          </button>
          <button
            type="button"
            onClick={onManage}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "white",
              color: tokens.color.ink900,
              border: `1px solid ${tokens.color.ink200}`,
              padding: "11px 18px",
              borderRadius: 9,
              fontFamily: tokens.font.display,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            <Icon name="users" size={15} /> Manage staff
          </button>
        </div>
      </div>

      <div style={{ position: "relative", height: 170 }}>
        <BannerVisual />
      </div>
    </div>
  );
}
