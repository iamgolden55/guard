import { format, parseISO } from "date-fns";
import { Card } from "../../../design-system/primitives/Card";
import { SectionHeader } from "../../../design-system/primitives/SectionHeader";
import { Pill } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import type { BankHoliday } from "../../../services/bankHolidayService";
import {
  type LeaveBalanceResponse,
  type LeaveBalanceSummary,
  type LeaveRequest,
  LeaveRequestStatus,
} from "../../../types/leave";

function fmt(value: string | number): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return String(value);
  const rounded = Math.round(num * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

export interface BalanceBreakdownCardProps {
  balances: LeaveBalanceResponse | null;
  isLoading: boolean;
}

export function BalanceBreakdownCard({
  balances,
  isLoading,
}: BalanceBreakdownCardProps) {
  if (isLoading) {
    return (
      <Card padding={20}>
        <SectionHeader title="Balance breakdown" subtitle="Loading…" />
      </Card>
    );
  }
  const summaries = Array.isArray(balances?.balances) ? balances.balances : [];
  if (!balances || summaries.length === 0) {
    return (
      <Card padding={20}>
        <SectionHeader title="Balance breakdown" subtitle="No allocated leave types" />
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
            paddingTop: 4,
          }}
        >
          A manager will allocate leave entitlements to your profile.
        </div>
      </Card>
    );
  }
  return (
    <Card padding={20}>
      <SectionHeader
        title="Balance breakdown"
        subtitle={`${fmt(balances.total_days_available)} days available`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {summaries.map((b) => (
          <BalanceBar key={b.leave_type.id} balance={b} />
        ))}
      </div>
    </Card>
  );
}

function toNum(v: number | string | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number.parseFloat(v) || 0;
}

function BalanceBar({ balance }: { balance: LeaveBalanceSummary }) {
  const entitlement = toNum(balance.total_entitlement);
  const used = toNum(balance.used_balance);
  const pending = toNum(balance.pending_balance);
  const usedPct = entitlement > 0 ? Math.min(100, (used / entitlement) * 100) : 0;
  const pendingPct = entitlement > 0 ? Math.min(100, (pending / entitlement) * 100) : 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.color.ink900,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: balance.leave_type.color_code || tokens.color.ink400,
            }}
          />
          {balance.leave_type.name}
        </span>
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 12,
            color: tokens.color.ink800,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {fmt(balance.available_balance)} / {fmt(entitlement)}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 6,
          background: tokens.color.ink100,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${usedPct + pendingPct}%`,
            background: tokens.color.warn,
            opacity: 0.6,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${usedPct}%`,
            background: balance.leave_type.color_code || tokens.color.ink600,
            opacity: 0.85,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 4,
          fontFamily: tokens.font.body,
          fontSize: 11,
          color: tokens.color.ink500,
        }}
      >
        <span>{fmt(used)} used</span>
        {pending > 0 && <span>{fmt(pending)} pending</span>}
      </div>
    </div>
  );
}

export interface UpcomingLeaveCardProps {
  myRequests: LeaveRequest[];
}

export function UpcomingLeaveCard({ myRequests }: UpcomingLeaveCardProps) {
  const now = new Date();
  const upcoming = myRequests
    .filter(
      (r) =>
        (r.status === LeaveRequestStatus.APPROVED ||
          r.status === LeaveRequestStatus.PENDING) &&
        new Date(r.end_date) >= now,
    )
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    )
    .slice(0, 5);

  return (
    <Card padding={20}>
      <SectionHeader
        title="Upcoming leave"
        subtitle={
          upcoming.length === 0
            ? "Nothing scheduled"
            : `${upcoming.length} block${upcoming.length === 1 ? "" : "s"}`
        }
      />
      {upcoming.length === 0 ? (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
            paddingTop: 4,
          }}
        >
          Submit a request to see it here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((req) => {
            const status = req.status === LeaveRequestStatus.APPROVED ? "positive" : "warning";
            return (
              <div
                key={req.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  border: `1px solid ${tokens.color.ink100}`,
                  borderRadius: tokens.radius.md,
                  background: "white",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: req.leave_type.color_code || tokens.color.ink400,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: tokens.color.ink900,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {req.leave_type.name}
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 11.5,
                      color: tokens.color.ink500,
                    }}
                  >
                    {format(parseISO(req.start_date), "d MMM")} –{" "}
                    {format(parseISO(req.end_date), "d MMM")}
                  </div>
                </div>
                <Pill tone={status} dot>
                  {req.status}
                </Pill>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export interface BankHolidaysCardProps {
  holidays: BankHoliday[];
}

export function BankHolidaysCard({ holidays }: BankHolidaysCardProps) {
  const now = new Date();
  const upcoming = holidays
    .filter((h) => new Date(h.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <Card padding={20}>
      <SectionHeader
        title="Bank holidays"
        subtitle={
          upcoming.length === 0
            ? "Nothing on the horizon"
            : `Next ${upcoming.length}`
        }
      />
      {upcoming.length === 0 ? (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
            paddingTop: 4,
          }}
        >
          Your admin hasn't configured any bank holidays yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {upcoming.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "6px 4px",
              }}
            >
              <span
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 12.5,
                  color: tokens.color.ink900,
                }}
              >
                {h.name}
              </span>
              <span
                style={{
                  fontFamily: tokens.font.mono,
                  fontSize: 11.5,
                  color: tokens.color.ink600,
                }}
              >
                {format(parseISO(h.date), "d MMM")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
