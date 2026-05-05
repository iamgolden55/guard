// LeaveManagementPage — staff & manager leave directory.
// Composition mirrors PayrollPage / StaffPage: page-level header + 2-col grid
// (left = tabs + tab body, right = balance + upcoming + bank holidays cards).
// The Approvals tab + manager-only queries are gated by useAuth() role.
import { useMemo, useState } from "react";
import { Card } from "../../design-system/primitives/Card";
import { tokens } from "../../design-system/tokens";
import { useAuth } from "../../contexts/AuthContext";
import { useLeaveData } from "./hooks/useLeaveData";
import { ApprovalQueue } from "./components/ApprovalQueue";
import { LeaveCalendar } from "./components/LeaveCalendar";
import { LeaveHeader } from "./components/LeaveHeader";
import { LeaveTabs, type LeaveTabKey } from "./components/LeaveTabs";
import { MyRequestsTable } from "./components/MyRequestsTable";
import { RequestLeaveModal } from "./components/RequestLeaveModal";
import {
  BalanceBreakdownCard,
  BankHolidaysCard,
  UpcomingLeaveCard,
} from "./components/RightRailCards";
import {
  LeaveRequestStatus,
  type LeaveRequest,
  type PendingLeaveRequest,
} from "../../types/leave";

function isManagerOrAdmin(
  role: string | undefined,
  membershipRole: string | undefined,
): boolean {
  const r = (role ?? "").toLowerCase();
  const m = (membershipRole ?? "").toLowerCase();
  return (
    r === "manager" ||
    r === "admin" ||
    m === "manager" ||
    m === "admin" ||
    m === "owner"
  );
}

export default function LeaveManagementPage() {
  const { authState } = useAuth();
  const userRole = authState.user?.role;
  const membershipRole = authState.currentMembership?.role;
  const canApprove = isManagerOrAdmin(userRole, membershipRole);

  const [tab, setTab] = useState<LeaveTabKey>("calendar");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [requestOpen, setRequestOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const data = useLeaveData({ calendarMonth, isManager: canApprove });

  const totals = useMemo(() => {
    if (!data.balances) return { available: 0, pending: 0, used: 0 };
    return {
      available: Number.parseFloat(data.balances.total_days_available) || 0,
      pending: Number.parseFloat(data.balances.total_days_pending) || 0,
      used: Number.parseFloat(data.balances.total_days_used) || 0,
    };
  }, [data.balances]);

  const pendingMyRequestsCount = useMemo(
    () =>
      data.myRequests.filter(
        (r) => r.status === LeaveRequestStatus.PENDING,
      ).length,
    [data.myRequests],
  );

  const handleCancel = async (request: LeaveRequest) => {
    setCancellingId(request.id);
    try {
      await data.cancelRequest.mutateAsync({ id: request.id });
    } finally {
      setCancellingId(null);
    }
  };

  const handleApprove = async (request: PendingLeaveRequest) => {
    setProcessingId(request.id);
    try {
      await data.processRequest.mutateAsync({
        request_id: request.id,
        action: "approve",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: PendingLeaveRequest, reason: string) => {
    setProcessingId(request.id);
    try {
      await data.processRequest.mutateAsync({
        request_id: request.id,
        action: "reject",
        comments: reason,
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <>
      <LeaveHeader
        totalAvailable={totals.available}
        totalPending={totals.pending}
        totalUsed={totals.used}
        onRequestLeave={() => setRequestOpen(true)}
      />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          background: tokens.color.ink50,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <LeaveTabs
              active={tab}
              myRequestsCount={pendingMyRequestsCount}
              pendingCount={data.pendingApprovals.length}
              showApprovals={canApprove}
              onChange={setTab}
            />

            {tab === "calendar" && (
              <LeaveCalendar
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                events={data.calendarEvents}
                bankHolidays={data.bankHolidays}
                isLoading={data.isCalendarLoading}
              />
            )}

            {tab === "requests" && (
              <MyRequestsTable
                requests={data.myRequests}
                onCancel={handleCancel}
                cancellingId={cancellingId}
                isLoading={data.isLoading}
              />
            )}

            {tab === "approvals" && canApprove && (
              <ApprovalQueue
                requests={data.pendingApprovals}
                onApprove={handleApprove}
                onReject={handleReject}
                processingId={processingId}
                isLoading={data.isPendingLoading}
              />
            )}

            {tab === "approvals" && !canApprove && (
              <Card padding={32}>
                <div
                  style={{
                    fontFamily: tokens.font.display,
                    fontWeight: 700,
                    fontSize: 16,
                    color: tokens.color.ink900,
                    marginBottom: 4,
                  }}
                >
                  Managers only
                </div>
                <div
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 13,
                    color: tokens.color.ink600,
                  }}
                >
                  Approvals are visible to managers and admins.
                </div>
              </Card>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <BalanceBreakdownCard
              balances={data.balances}
              isLoading={data.isLoading}
            />
            <UpcomingLeaveCard myRequests={data.myRequests} />
            <BankHolidaysCard holidays={data.bankHolidays} />
          </div>
        </div>

        <div style={{ height: 24 }} />
      </main>

      <RequestLeaveModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        leaveTypes={data.leaveTypes}
        onSubmit={(payload) =>
          data.submitRequest.mutateAsync(payload).then(() => undefined)
        }
        isSubmitting={data.submitRequest.isPending}
      />
    </>
  );
}
