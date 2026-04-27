// DashboardPage — composes the bento grid from the prototype.
// Layout maps directly to project/dashboard.jsx:1011-1080 (the "bento" branch).
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "./hooks/useDashboardData";
import { WelcomeBanner } from "./components/WelcomeBanner";
import { KpiGrid } from "./components/KpiGrid";
import { CoverageHeatmap } from "./components/CoverageHeatmap";
import { ApprovalsList } from "./components/ApprovalsList";
import { VenueCoverageList } from "./components/VenueCoverageList";
import { ComplianceTile } from "./components/ComplianceTile";
import { ActivityFeed } from "./components/ActivityFeed";
import { StaffTable } from "./components/StaffTable";
import { tokens } from "../../design-system/tokens";

const GAP = 18;

export default function DashboardPage() {
  const navigate = useNavigate();
  const data = useDashboardData();

  const expiringCount = data.staff.filter((s) => s.expiresIn < 30).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
      <WelcomeBanner
        onSchedule={() => navigate("/scheduling")}
        onManage={() => navigate("/staff")}
        approvalsCount={data.approvals.length}
        expiringLicensesCount={expiringCount}
      />

      <KpiGrid kpis={data.kpis} gap={GAP} />

      <div style={{ display: "grid", gap: GAP, gridTemplateColumns: "2fr 1fr" }}>
        <CoverageHeatmap data={data.heatmap} />
        <ApprovalsList items={data.approvals} onResolve={data.resolveApproval} />
      </div>

      <div style={{ display: "grid", gap: GAP, gridTemplateColumns: "1.2fr 1fr 1fr" }}>
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
