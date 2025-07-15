import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Pivot,
  PivotItem,
  CommandBar,
  type ICommandBarItemProps,
  DatePicker,
  Dropdown,
  type IDropdownOption,
  SearchBox,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Dialog,
  DialogType,
  DialogFooter
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { shiftService } from '../../services';

// Report Types
interface ComplianceReport {
  venueId: number;
  venueName: string;
  totalShifts: number;
  shiftsWithChecks: number;
  complianceRate: number;
  criticalIssues: number;
  lastIncident: string | null;
}

interface VenueSafetyReport {
  venueId: number;
  venueName: string;
  fireExitChecks: number;
  fireExitFailures: number;
  capacityChecks: number;
  capacityBreaches: number;
  toiletChecks: number;
  toiletIssues: number;
  overallSafetyScore: number;
}

interface StaffPerformanceReport {
  staffId: number;
  staffName: string;
  totalShifts: number;
  checksCompleted: number;
  checkCompletionRate: number;
  criticalIssuesFound: number;
  avgResponseTime: number;
  performanceScore: number;
}

const Reports: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<string>('compliance');
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Report Data
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [safetyReports, setSafetyReports] = useState<VenueSafetyReport[]>([]);
  const [performanceReports, setPerformanceReports] = useState<StaffPerformanceReport[]>([]);
  
  // UI State
  const [venueOptions, setVenueOptions] = useState<IDropdownOption[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('excel');

  // Load initial data
  useEffect(() => {
    loadVenueOptions();
    loadReports();
  }, []);

  // Reload reports when filters change
  useEffect(() => {
    loadReports();
  }, [selectedTab, startDate, endDate, selectedVenue]);

  const loadVenueOptions = useCallback(async () => {
    try {
      const venues = await shiftService.getVenues();
      const options = [
        { key: '', text: 'All Venues' },
        ...venues.map(venue => ({ key: venue.id.toString(), text: venue.name }))
      ];
      setVenueOptions(options);
    } catch (error) {
      console.error('Failed to load venues:', error);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        venueId: selectedVenue ? parseInt(selectedVenue) : undefined
      };

      switch (selectedTab) {
        case 'compliance':
          await loadComplianceReports(params);
          break;
        case 'safety':
          await loadSafetyReports(params);
          break;
        case 'performance':
          await loadPerformanceReports(params);
          break;
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
      setError('Failed to load reports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTab, startDate, endDate, selectedVenue]);

  const loadComplianceReports = async (params: any) => {
    try {
      const data = await shiftService.getComplianceReports(params);
      setComplianceReports(data);
    } catch (error) {
      console.error('Failed to load compliance reports:', error);
      setComplianceReports([]);
    }
  };

  const loadSafetyReports = async (params: any) => {
    try {
      const data = await shiftService.getSafetyReports(params);
      setSafetyReports(data);
    } catch (error) {
      console.error('Failed to load safety reports:', error);
      setSafetyReports([]);
    }
  };

  const loadPerformanceReports = async (params: any) => {
    try {
      const data = await shiftService.getPerformanceReports(params);
      setPerformanceReports(data);
    } catch (error) {
      console.error('Failed to load performance reports:', error);
      setPerformanceReports([]);
    }
  };

  const handleExport = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const doExport = useCallback(() => {
    try {
      let data: any[] = [];
      let filename = '';

      switch (selectedTab) {
        case 'compliance':
          data = complianceReports;
          filename = 'compliance-report';
          break;
        case 'safety':
          data = safetyReports;
          filename = 'safety-report';
          break;
        case 'performance':
          data = performanceReports;
          filename = 'performance-report';
          break;
      }

      if (data.length === 0) {
        setError('No data to export');
        return;
      }

      // Create CSV content
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
      link.click();

      setShowExportDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Export failed. Please try again.');
    }
  }, [selectedTab, complianceReports, safetyReports, performanceReports, startDate, endDate]);

  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: () => {
        loadReports();
        return false;
      },
    },
    {
      key: 'export',
      text: 'Export',
      iconProps: { iconName: 'ExcelDocument' },
      onClick: () => {
        handleExport();
        return false;
      },
    },
  ];

  const cardStyle = {
    padding: '16px',
    border: '1px solid #e1e1e1',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '12px'
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return '#10B981'; // Green
    if (rate >= 85) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 90) return '#10B981'; // Green
    if (score >= 75) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Text variant="xxLarge" style={{ fontWeight: '600' }}>
          📊 Security Reports & Analytics
        </Text>

        <CommandBar items={commandBarItems} />

        {/* Filters */}
        <div style={cardStyle}>
          <Stack tokens={{ childrenGap: 16 }}>
            <Text variant="large" style={{ fontWeight: '600' }}>Filters</Text>
            
            <Stack horizontal tokens={{ childrenGap: 20 }} wrap>
              <Stack tokens={{ childrenGap: 8 }}>
                <Text variant="medium">Date Range</Text>
                <Stack horizontal tokens={{ childrenGap: 12 }}>
                  <DatePicker
                    label="From"
                    value={startDate}
                    onSelectDate={(date) => setStartDate(date || new Date())}
                    formatDate={(date?: Date) => date?.toLocaleDateString() || ''}
                  />
                  <DatePicker
                    label="To"
                    value={endDate}
                    onSelectDate={(date) => setEndDate(date || new Date())}
                    formatDate={(date?: Date) => date?.toLocaleDateString() || ''}
                    minDate={startDate}
                  />
                </Stack>
              </Stack>

              <Stack style={{ minWidth: '200px' }}>
                <Dropdown
                  label="Venue"
                  options={venueOptions}
                  selectedKey={selectedVenue}
                  onChange={(_, option) => setSelectedVenue(option?.key as string || '')}
                />
              </Stack>
            </Stack>
          </Stack>
        </div>

        {error && (
          <MessageBar messageBarType={MessageBarType.error}>
            {error}
          </MessageBar>
        )}

        {/* Report Tabs */}
        <Pivot selectedKey={selectedTab} onLinkClick={(item) => setSelectedTab(item?.props.itemKey || 'compliance')}>
          <PivotItem headerText="📋 Shift Compliance" itemKey="compliance">
            {isLoading ? (
              <Stack horizontalAlign="center" style={{ padding: '40px' }}>
                <Spinner size={SpinnerSize.large} label="Loading compliance reports..." />
              </Stack>
            ) : (
              <ComplianceReportsView reports={complianceReports} />
            )}
          </PivotItem>

          <PivotItem headerText="🛡️ Venue Safety" itemKey="safety">
            {isLoading ? (
              <Stack horizontalAlign="center" style={{ padding: '40px' }}>
                <Spinner size={SpinnerSize.large} label="Loading safety reports..." />
              </Stack>
            ) : (
              <SafetyReportsView reports={safetyReports} />
            )}
          </PivotItem>

          <PivotItem headerText="👥 Staff Performance" itemKey="performance">
            {isLoading ? (
              <Stack horizontalAlign="center" style={{ padding: '40px' }}>
                <Spinner size={SpinnerSize.large} label="Loading performance reports..." />
              </Stack>
            ) : (
              <PerformanceReportsView reports={performanceReports} />
            )}
          </PivotItem>
        </Pivot>

        {/* Export Dialog */}
        <Dialog
          hidden={!showExportDialog}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Export Report Data',
          }}
          onDismiss={() => setShowExportDialog(false)}
          minWidth={400}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            <Text>Export current report data for external analysis</Text>
            <Dropdown
              label="Export Format"
              options={[
                { key: 'excel', text: 'Excel/CSV (.csv)' },
                { key: 'csv', text: 'CSV (.csv)' }
              ]}
              selectedKey={exportFormat}
              onChange={(_, option) => setExportFormat(option?.key as string)}
            />
          </Stack>
          <DialogFooter>
            <PrimaryButton text="Export" onClick={doExport} />
            <DefaultButton text="Cancel" onClick={() => setShowExportDialog(false)} />
          </DialogFooter>
        </Dialog>
      </Stack>
    </MainLayout>
  );
};

// Compliance Reports Component
interface ComplianceReportsViewProps {
  reports: ComplianceReport[];
}

const ComplianceReportsView: React.FC<ComplianceReportsViewProps> = ({ reports }) => {
  const cardStyle = {
    padding: '16px',
    border: '1px solid #e1e1e1',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '12px'
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return '#10B981';
    if (rate >= 85) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <Text variant="large" style={{ fontWeight: '600' }}>
        Venue Check Compliance Overview
      </Text>

      {reports.length === 0 ? (
        <div style={cardStyle}>
          <Text>No compliance data available for the selected period.</Text>
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 12 }}>
          {reports.map(report => (
            <div key={report.venueId} style={cardStyle}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text variant="mediumPlus" style={{ fontWeight: '600' }}>
                    {report.venueName}
                  </Text>
                  <Stack horizontal tokens={{ childrenGap: 20 }}>
                    <Text variant="small">
                      <strong>Total Shifts:</strong> {report.totalShifts}
                    </Text>
                    <Text variant="small">
                      <strong>Shifts with Checks:</strong> {report.shiftsWithChecks}
                    </Text>
                    <Text variant="small">
                      <strong>Critical Issues:</strong> {report.criticalIssues}
                    </Text>
                    {report.lastIncident && (
                      <Text variant="small">
                        <strong>Last Incident:</strong> {new Date(report.lastIncident).toLocaleDateString()}
                      </Text>
                    )}
                  </Stack>
                </Stack>
                
                <Stack horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                  <Text 
                    variant="xxLarge" 
                    style={{ 
                      fontWeight: '700',
                      color: getComplianceColor(report.complianceRate)
                    }}
                  >
                    {report.complianceRate.toFixed(1)}%
                  </Text>
                  <Text variant="small" style={{ color: '#666' }}>Compliance Rate</Text>
                </Stack>
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// Safety Reports Component
interface SafetyReportsViewProps {
  reports: VenueSafetyReport[];
}

const SafetyReportsView: React.FC<SafetyReportsViewProps> = ({ reports }) => {
  const cardStyle = {
    padding: '16px',
    border: '1px solid #e1e1e1',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '12px'
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 75) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <Text variant="large" style={{ fontWeight: '600' }}>
        Venue Safety Analytics
      </Text>

      {reports.length === 0 ? (
        <div style={cardStyle}>
          <Text>No safety data available for the selected period.</Text>
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 12 }}>
          {reports.map(report => (
            <div key={report.venueId} style={cardStyle}>
              <Stack tokens={{ childrenGap: 16 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Text variant="mediumPlus" style={{ fontWeight: '600' }}>
                    {report.venueName}
                  </Text>
                  <Stack horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                    <Text 
                      variant="xLarge" 
                      style={{ 
                        fontWeight: '700',
                        color: getSafetyScoreColor(report.overallSafetyScore)
                      }}
                    >
                      {report.overallSafetyScore.toFixed(1)}
                    </Text>
                    <Text variant="small" style={{ color: '#666' }}>Safety Score</Text>
                  </Stack>
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 40 }}>
                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="medium" style={{ color: '#ff6b6b', fontWeight: '600' }}>
                      🔥 Fire Safety
                    </Text>
                    <Text variant="small">Checks: {report.fireExitChecks}</Text>
                    <Text variant="small" style={{ color: report.fireExitFailures > 0 ? '#EF4444' : '#10B981' }}>
                      Failures: {report.fireExitFailures}
                    </Text>
                  </Stack>

                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="medium" style={{ color: '#4ecdc4', fontWeight: '600' }}>
                      👥 Capacity
                    </Text>
                    <Text variant="small">Checks: {report.capacityChecks}</Text>
                    <Text variant="small" style={{ color: report.capacityBreaches > 0 ? '#EF4444' : '#10B981' }}>
                      Breaches: {report.capacityBreaches}
                    </Text>
                  </Stack>

                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="medium" style={{ color: '#95e1d3', fontWeight: '600' }}>
                      🚻 Facilities
                    </Text>
                    <Text variant="small">Checks: {report.toiletChecks}</Text>
                    <Text variant="small" style={{ color: report.toiletIssues > 0 ? '#EF4444' : '#10B981' }}>
                      Issues: {report.toiletIssues}
                    </Text>
                  </Stack>
                </Stack>
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// Performance Reports Component
interface PerformanceReportsViewProps {
  reports: StaffPerformanceReport[];
}

const PerformanceReportsView: React.FC<PerformanceReportsViewProps> = ({ reports }) => {
  const cardStyle = {
    padding: '16px',
    border: '1px solid #e1e1e1',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '12px'
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 75) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <Text variant="large" style={{ fontWeight: '600' }}>
        Staff Performance Analytics
      </Text>

      {reports.length === 0 ? (
        <div style={cardStyle}>
          <Text>No performance data available for the selected period.</Text>
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 12 }}>
          {reports.map(report => (
            <div key={report.staffId} style={cardStyle}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text variant="mediumPlus" style={{ fontWeight: '600' }}>
                    {report.staffName}
                  </Text>
                  <Stack horizontal tokens={{ childrenGap: 30 }}>
                    <Text variant="small">
                      <strong>Shifts:</strong> {report.totalShifts}
                    </Text>
                    <Text variant="small">
                      <strong>Checks:</strong> {report.checksCompleted}
                    </Text>
                    <Text variant="small">
                      <strong>Completion Rate:</strong> {report.checkCompletionRate.toFixed(1)}%
                    </Text>
                    <Text variant="small">
                      <strong>Issues Found:</strong> {report.criticalIssuesFound}
                    </Text>
                    <Text variant="small">
                      <strong>Avg Response:</strong> {report.avgResponseTime.toFixed(1)}h
                    </Text>
                  </Stack>
                </Stack>
                
                <Stack horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                  <Text 
                    variant="xLarge" 
                    style={{ 
                      fontWeight: '700',
                      color: getPerformanceColor(report.performanceScore)
                    }}
                  >
                    {report.performanceScore.toFixed(1)}
                  </Text>
                  <Text variant="small" style={{ color: '#666' }}>Performance Score</Text>
                </Stack>
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default Reports;