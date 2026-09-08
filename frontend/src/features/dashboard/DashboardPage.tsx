// DashboardPage — composes the bento grid from the prototype.
// Wired to /api/v1/admin/dashboard/overview/ via useDashboardData.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../design-system/Icon";
import { Button } from "../../design-system/primitives/Button";
import { Card } from "../../design-system/primitives/Card";
import { Toast } from "../../design-system/primitives/Toast";
import { tokens } from "../../design-system/tokens";
import { ActivityFeed } from "./components/ActivityFeed";
import { ApprovalsList } from "./components/ApprovalsList";
import { ComplianceTile } from "./components/ComplianceTile";
import { CoverageHeatmap } from "./components/CoverageHeatmap";
import { KpiGrid } from "./components/KpiGrid";
import { StaffTable } from "./components/StaffTable";
import { VenueCoverageList } from "./components/VenueCoverageList";
import { WelcomeBanner } from "./components/WelcomeBanner";
import { useDashboardData } from "./hooks/useDashboardData";

export default function DashboardPage() {
  const navigate = useNavigate();
  const data = useDashboardData();
  const [toast, setToast] = useState<{
    text: string;
    tone: "neutral" | "danger";
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Every tile below reads from one query. Rendering the zeroed
  // EMPTY_OVERVIEW while that query is in flight — or after it failed —
  // shows "0 officers on shift" as though it were a fact, so both states
  // get their own screen instead.
  if (data.isLoading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 320,
          gap: 12,
        }}
      >
        <Spinner />
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            color: tokens.color.ink600,
          }}
        >
          Loading today's operations…
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div style={{ maxWidth: 620, margin: "48px auto 0" }}>
        <Card padding={28}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              fontFamily: tokens.font.body,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: tokens.color.dangerSoft,
                color: tokens.color.dangerInk,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="alert" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: tokens.font.display,
                  fontSize: 17,
                  fontWeight: 700,
                  color: tokens.color.ink900,
                }}
              >
                Couldn't load the dashboard
              </h2>
              <p
                style={{
                  margin: "6px 0 16px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: tokens.color.ink600,
                }}
              >
                The operations overview didn't come back, so nothing on this
                page is up to date. {data.error.message}
              </p>
              <Button
                variant="secondary"
                leading={<Icon name="refresh" size={14} />}
                onClick={data.refetch}
              >
                Try again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <WelcomeBanner
        onSchedule={() => navigate("/scheduling")}
        onManage={() => navigate("/staff")}
        approvalsCount={data.openApprovalsCount}
        expiringLicensesCount={data.expiringLicensesCount}
        officersOnShift={data.officersOnShift}
        hoursDelivered={data.hoursDeliveredToday}
        revenueThisWeek={data.revenueThisWeek}
        hoursSpark={data.hoursSpark}
        staff={data.staff}
        venues={data.venues}
      />

      <KpiGrid kpis={data.kpis} />

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <CoverageHeatmap data={data.heatmap} />
        <ApprovalsList
          items={data.approvals}
          totalCount={data.openApprovalsCount}
          isResolving={data.isResolving}
          onInbox={() => navigate("/leave")}
          onResolve={(id, action) => {
            if (id.startsWith("shift:")) {
              navigate("/scheduling");
              return;
            }
            data.resolveApproval(id, action, {
              onSuccess: (text) => setToast({ text, tone: "neutral" }),
              onError: (text) => setToast({ text, tone: "danger" }),
            });
          }}
        />
      </div>

      <div className="grid gap-[18px] grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr]">
        <VenueCoverageList venues={data.venues} />
        <ComplianceTile staff={data.staff} />
        <ActivityFeed items={data.activity} />
      </div>

      <StaffTable staff={data.staff} />

      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: tokens.color.ink500,
          padding: "20px 0 8px",
        }}
      >
        © Mead Security · Operations Console
      </div>

      {toast && <Toast message={toast.text} tone={toast.tone} />}
    </div>
  );
}
