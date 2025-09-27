import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  Tab,
  TabList,
  SelectTabData,
  SelectTabEvent,
  Title1
} from '@fluentui/react-components';
import {
  AddRegular,
  TableRegular,
  ChartMultipleRegular,
  SettingsRegular,
  HomeRegular,
  ArrowLeftRegular
} from '@fluentui/react-icons';
import {
  ReportDashboard,
  ReportJobMonitor,
  ReportGenerationForm
} from '../../components/reports';

const ReportsPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'monitor' | 'generate'>('dashboard');
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const navigate = useNavigate();

  const handleTabSelect = (event: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as 'dashboard' | 'monitor' | 'generate');
  };

  const handleReportGenerated = (jobId: string) => {
    console.log('Report generated with job ID:', jobId);
    setShowGenerationForm(false);
    // Switch to monitor tab to show the new job
    setSelectedTab('monitor');
  };

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
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '10px'
      }}>
        <Button
          appearance="subtle"
          icon={<ArrowLeftRegular />}
          onClick={() => navigate('/dashboard')}
          aria-label="Back to Dashboard"
          style={{
            minWidth: '40px',
            padding: '8px'
          }}
        />
        <Button
          appearance="subtle"
          icon={<HomeRegular />}
          onClick={() => navigate('/dashboard')}
          aria-label="Home Dashboard"
          style={{
            minWidth: '40px',
            padding: '8px'
          }}
        />
        <Title1 style={{ margin: '0', color: '#323130' }}>
          Reports & Analytics
        </Title1>
      </div>

      {/* Tab Navigation */}
      <div style={{ borderBottom: '1px solid #e1e1e1' }}>
        <TabList selectedValue={selectedTab} onTabSelect={handleTabSelect}>
          <Tab id="dashboard" value="dashboard" icon={<ChartMultipleRegular />}>
            Dashboard
          </Tab>
          <Tab id="monitor" value="monitor" icon={<TableRegular />}>
            Job Monitor
          </Tab>
          <Tab id="generate" value="generate" icon={<AddRegular />}>
            Generate Report
          </Tab>
        </TabList>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: '600px' }}>
        {renderContent()}
      </div>

      {/* Report Generation Dialog */}
      <Dialog
        open={showGenerationForm}
        onOpenChange={(_, data) => setShowGenerationForm(data.open)}
        modalType="modal"
      >
        <DialogSurface style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
          <DialogBody>
            <DialogTitle>Generate New Report</DialogTitle>
            <DialogContent style={{ padding: '0' }}>
              <ReportGenerationForm
                onReportGenerated={handleReportGenerated}
                onCancel={() => setShowGenerationForm(false)}
              />
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default ReportsPage;