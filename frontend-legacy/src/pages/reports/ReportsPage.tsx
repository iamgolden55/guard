import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Container, SpaceBetween } from '../../components/cloudscape';
import {
  ReportDashboard,
  ReportJobMonitor,
  ReportGenerationForm
} from '../../components/reports';

const ReportsPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'monitor' | 'generate'>('dashboard');
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const navigate = useNavigate();

  const handleReportGenerated = (jobId: string) => {
    console.log('Report generated with job ID:', jobId);
    setShowGenerationForm(false);
    setSelectedTab('monitor');
  };

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: 'monitor' as const, label: 'Job Monitor', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'generate' as const, label: 'Generate Report', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    )},
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case 'dashboard':
        return (
          <ReportDashboard
            onCreateReport={() => setShowGenerationForm(true)}
            showCreateButton={true}
          />
        );
      case 'monitor':
        return (
          <ReportJobMonitor
            showTitle={true}
            showBulkActions={true}
            showMetrics={true}
            maxHeight="70vh"
          />
        );
      case 'generate':
        return (
          <ReportGenerationForm
            onReportGenerated={handleReportGenerated}
            onCancel={() => setSelectedTab('dashboard')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SpaceBetween size="l">
      {/* Navigation Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Back to Dashboard"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Home Dashboard"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        <Header>Reports & Analytics</Header>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'text-red-600 border-red-600'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div style={{ minHeight: '600px' }}>
        {renderContent()}
      </div>

      {/* Report Generation Dialog */}
      {showGenerationForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[90vw] max-h-[90vh] overflow-auto mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Report</h2>
            <ReportGenerationForm
              onReportGenerated={handleReportGenerated}
              onCancel={() => setShowGenerationForm(false)}
            />
          </div>
        </div>
      )}
    </SpaceBetween>
  );
};

export default ReportsPage;
