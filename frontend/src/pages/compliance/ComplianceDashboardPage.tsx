import React from 'react';
import ComplianceDashboard from '../../components/compliance/ComplianceDashboard';

interface ComplianceDashboardPageProps {
  refreshTrigger?: number;
}

const ComplianceDashboardPage: React.FC<ComplianceDashboardPageProps> = ({
  refreshTrigger
}) => {
  return (
    <div className="max-w-7xl mx-auto">
      <ComplianceDashboard
        autoRefresh={true}
        timeRange={[
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          new Date()
        ]}
      />
    </div>
  );
};

export default ComplianceDashboardPage;