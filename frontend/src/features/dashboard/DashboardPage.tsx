// DashboardPage — composes the bento grid from the prototype.
// Wired to /api/v1/admin/dashboard/overview/ via useDashboardData.
import { useNavigate } from "react-router-dom";
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

  return (
    <div className="flex flex-col gap-[18px]">
      <WelcomeBanner
        onSchedule={() => navigate("/scheduling")}
        onManage={() => navigate("/staff")}
        approvalsCount={data.openApprovalsCount}
        expiringLicensesCount={data.expiringLicensesCount}
      />

      <KpiGrid kpis={data.kpis} />

      <div className="grid gap-[18px] grid-cols-1 lg:grid-cols-[2fr_1fr]">
        <CoverageHeatmap data={data.heatmap} />
        <ApprovalsList
          items={data.approvals}
          totalCount={data.openApprovalsCount}
          onInbox={() => navigate("/leave")}
          onResolve={(id, action) => {
            if (id.startsWith("shift:")) {
              navigate("/scheduling");
              return;
            }
            data.resolveApproval(id, action);
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
        © Mead Security · Operations Console · v2.4
      </div>
    </div>
  );
}
