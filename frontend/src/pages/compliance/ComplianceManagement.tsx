import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import ComplianceDashboardPage from './ComplianceDashboardPage';
import ViolationsList from '../../components/compliance/ViolationsList';
import RealTimeMonitor from '../../components/compliance/RealTimeMonitor';
import ComplianceSettings from '../../components/compliance/ComplianceSettings';
import ComplianceReports from '../../components/compliance/ComplianceReports';
import ComplianceTrends from '../../components/compliance/ComplianceTrends';
import WorkingHoursReport from '../../components/compliance/WorkingHoursReport';
import ComplianceCheck from '../../components/compliance/ComplianceCheck';
import ComplianceProfilesList from '../../components/compliance/ComplianceProfilesList';
import WorkingHoursRegulationsList from '../../components/compliance/WorkingHoursRegulationsList';
import {
  LayoutDashboard, AlertTriangle, Activity, CheckCircle,
  BarChart3, TrendingUp, Clock, Settings, FileText, Scale,
  type LucideIcon,
} from 'lucide-react';

interface TabItem {
  label: string;
  path: string;
  Icon: LucideIcon;
  adminOnly?: boolean;
}

const tabs: TabItem[] = [
  { label: 'Overview', path: '/compliance', Icon: LayoutDashboard },
  { label: 'Violations', path: '/compliance/violations', Icon: AlertTriangle },
  { label: 'Monitor', path: '/compliance/monitor', Icon: Activity },
  { label: 'Check', path: '/compliance/check', Icon: CheckCircle },
  { label: 'Reports', path: '/compliance/reports', Icon: BarChart3 },
  { label: 'Trends', path: '/compliance/trends', Icon: TrendingUp },
  { label: 'Working Hours', path: '/compliance/working-hours', Icon: Clock },
  { label: 'Settings', path: '/compliance/settings', Icon: Settings, adminOnly: true },
  { label: 'Profiles', path: '/compliance/profiles', Icon: FileText, adminOnly: true },
  { label: 'Regulations', path: '/compliance/regulations', Icon: Scale, adminOnly: true },
];

const ComplianceManagement: React.FC = () => {
  const { isUserRole } = useAuth();
  const location = useLocation();
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const isAdmin = isUserRole(UserRole.ADMIN);

  const handleRefreshSuccess = () => setRefreshTrigger(prev => prev + 1);

  const isActive = (path: string) => {
    if (path === '/compliance') {
      return location.pathname === '/compliance' || location.pathname === '/compliance/';
    }
    return location.pathname.startsWith(path);
  };

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="overflow-x-auto">
          <nav className="flex min-w-max px-2" aria-label="Compliance navigation">
            {visibleTabs.map((tab) => {
              const active = isActive(tab.path);
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`
                    flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors no-underline whitespace-nowrap
                    ${active
                      ? 'border-[#DC2626] text-[#DC2626]'
                      : 'border-transparent text-[#6B7280] hover:text-[#1A1A2E] hover:border-[#E5E7EB]'
                    }
                  `}
                >
                  <tab.Icon size={15} strokeWidth={active ? 2 : 1.5} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <Routes>
        <Route path="/" element={<ComplianceDashboardPage refreshTrigger={refreshTrigger} />} />

        {(isUserRole(UserRole.MANAGER) || isAdmin) && (
          <>
            <Route path="/violations" element={<ViolationsList onResolutionSuccess={handleRefreshSuccess} className="max-w-7xl" />} />
            <Route path="/monitor" element={<RealTimeMonitor className="max-w-7xl" />} />
            <Route path="/check" element={<ComplianceCheck className="max-w-6xl" />} />
            <Route path="/reports" element={<ComplianceReports className="max-w-6xl" />} />
            <Route path="/trends" element={<ComplianceTrends className="max-w-7xl" />} />
            <Route path="/working-hours" element={<WorkingHoursReport className="max-w-7xl" />} />
          </>
        )}

        {isAdmin && (
          <>
            <Route path="/settings" element={<ComplianceSettings onSettingsChange={handleRefreshSuccess} className="max-w-6xl" />} />
            <Route path="/profiles" element={<ComplianceProfilesList className="max-w-7xl mx-auto" />} />
            <Route path="/regulations" element={<WorkingHoursRegulationsList className="max-w-7xl mx-auto" />} />
          </>
        )}

        <Route path="*" element={<Navigate to="/compliance" replace />} />
      </Routes>
    </div>
  );
};

export default ComplianceManagement;
