import React, { useState, useEffect, useCallback } from 'react';
import { Header, Container, SpaceBetween, StatusIndicator, Alert, ConfirmationModal } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
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
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Report Data
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [safetyReports, setSafetyReports] = useState<VenueSafetyReport[]>([]);
  const [performanceReports, setPerformanceReports] = useState<StaffPerformanceReport[]>([]);

  // UI State
  const [venueOptions, setVenueOptions] = useState<Array<{key: string; text: string}>>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('excel');
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  useEffect(() => {
    loadVenueOptions();
    loadReports();
  }, []);

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
      addFlash({ type: 'error', content: 'Failed to load reports. Please try again.' });
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
        addFlash({ type: 'error', content: 'No data to export' });
        return;
      }

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
      addFlash({ type: 'error', content: 'Export failed. Please try again.' });
    }
  }, [selectedTab, complianceReports, safetyReports, performanceReports, startDate, endDate]);

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return '#10B981';
    if (rate >= 85) return '#F59E0B';
    return '#EF4444';
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 75) return '#F59E0B';
    return '#EF4444';
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 75) return '#F59E0B';
    return '#EF4444';
  };

  const tabs = [
    { id: 'compliance', label: 'Shift Compliance' },
    { id: 'safety', label: 'Venue Safety' },
    { id: 'performance', label: 'Staff Performance' },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => loadReports()}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Export
            </button>
          </div>
        }
      >
        Security Reports & Analytics
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      {/* Filters */}
      <Container header={<Header variant="h2">Filters</Header>}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={endDate.toISOString().split('T')[0]}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              min={startDate.toISOString().split('T')[0]}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-w-[200px]"
            >
              {venueOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.text}</option>
              ))}
            </select>
          </div>
        </div>
      </Container>

      {/* Report Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={selectedTab === tab.id
                ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <Container>
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-red-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </Container>
      ) : (
        <>
          {/* Compliance Reports */}
          {selectedTab === 'compliance' && (
            <SpaceBetween size="m">
              <h3 className="text-lg font-semibold text-gray-900">Venue Check Compliance Overview</h3>

              {complianceReports.length === 0 ? (
                <Container>
                  <p className="text-sm text-gray-500">No compliance data available for the selected period.</p>
                </Container>
              ) : (
                complianceReports.map(report => (
                  <Container key={report.venueId}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900 mb-2">{report.venueName}</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                          <span><strong>Total Shifts:</strong> {report.totalShifts}</span>
                          <span><strong>Shifts with Checks:</strong> {report.shiftsWithChecks}</span>
                          <span><strong>Critical Issues:</strong> {report.criticalIssues}</span>
                          {report.lastIncident && (
                            <span><strong>Last Incident:</strong> {new Date(report.lastIncident).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold" style={{ color: getComplianceColor(report.complianceRate) }}>
                          {report.complianceRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">Compliance Rate</p>
                      </div>
                    </div>
                  </Container>
                ))
              )}
            </SpaceBetween>
          )}

          {/* Safety Reports */}
          {selectedTab === 'safety' && (
            <SpaceBetween size="m">
              <h3 className="text-lg font-semibold text-gray-900">Venue Safety Analytics</h3>

              {safetyReports.length === 0 ? (
                <Container>
                  <p className="text-sm text-gray-500">No safety data available for the selected period.</p>
                </Container>
              ) : (
                safetyReports.map(report => (
                  <Container key={report.venueId}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-base font-semibold text-gray-900">{report.venueName}</p>
                      <div className="text-center">
                        <p className="text-2xl font-bold" style={{ color: getSafetyScoreColor(report.overallSafetyScore) }}>
                          {report.overallSafetyScore.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">Safety Score</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm font-semibold text-red-500 mb-1">Fire Safety</p>
                        <p className="text-sm text-gray-600">Checks: {report.fireExitChecks}</p>
                        <p className={`text-sm ${report.fireExitFailures > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          Failures: {report.fireExitFailures}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-teal-500 mb-1">Capacity</p>
                        <p className="text-sm text-gray-600">Checks: {report.capacityChecks}</p>
                        <p className={`text-sm ${report.capacityBreaches > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          Breaches: {report.capacityBreaches}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-400 mb-1">Facilities</p>
                        <p className="text-sm text-gray-600">Checks: {report.toiletChecks}</p>
                        <p className={`text-sm ${report.toiletIssues > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          Issues: {report.toiletIssues}
                        </p>
                      </div>
                    </div>
                  </Container>
                ))
              )}
            </SpaceBetween>
          )}

          {/* Performance Reports */}
          {selectedTab === 'performance' && (
            <SpaceBetween size="m">
              <h3 className="text-lg font-semibold text-gray-900">Staff Performance Analytics</h3>

              {performanceReports.length === 0 ? (
                <Container>
                  <p className="text-sm text-gray-500">No performance data available for the selected period.</p>
                </Container>
              ) : (
                performanceReports.map(report => (
                  <Container key={report.staffId}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900 mb-2">{report.staffName}</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                          <span><strong>Shifts:</strong> {report.totalShifts}</span>
                          <span><strong>Checks:</strong> {report.checksCompleted}</span>
                          <span><strong>Completion Rate:</strong> {report.checkCompletionRate.toFixed(1)}%</span>
                          <span><strong>Issues Found:</strong> {report.criticalIssuesFound}</span>
                          <span><strong>Avg Response:</strong> {report.avgResponseTime.toFixed(1)}h</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold" style={{ color: getPerformanceColor(report.performanceScore) }}>
                          {report.performanceScore.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">Performance Score</p>
                      </div>
                    </div>
                  </Container>
                ))
              )}
            </SpaceBetween>
          )}
        </>
      )}

      {/* Export Dialog */}
      <ConfirmationModal
        visible={showExportDialog}
        onCancel={() => setShowExportDialog(false)}
        onConfirm={doExport}
        header="Export Report Data"
        confirmLabel="Export"
      >
        <SpaceBetween size="m">
          <p className="text-sm text-gray-700">Export current report data for external analysis</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="excel">Excel/CSV (.csv)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
        </SpaceBetween>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default Reports;
