import React, { useState } from 'react';
import { Text, PrimaryButton, DefaultButton, Dropdown, type IDropdownOption, DatePicker, Stack } from '@fluentui/react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useComplianceData } from '../../hooks/useComplianceData';

interface ComplianceReportsProps {
  className?: string;
}

const ComplianceReports: React.FC<ComplianceReportsProps> = ({ className = '' }) => {
  const [selectedReportType, setSelectedReportType] = useState<string>('violations');
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedViolationType, setSelectedViolationType] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  const { violations, isLoading } = useComplianceData({
    refreshInterval: 0 // No auto-refresh for reports
  });

  const reportTypeOptions: IDropdownOption[] = [
    { key: 'violations', text: 'Violations Report' },
    { key: 'working-hours', text: 'Working Hours Report' },
    { key: 'compliance-summary', text: 'Compliance Summary' },
    { key: 'trends', text: 'Trends Analysis' },
    { key: 'staff-compliance', text: 'Staff Compliance Report' },
    { key: 'venue-compliance', text: 'Venue Compliance Report' }
  ];

  const violationTypeOptions: IDropdownOption[] = [
    { key: 'all', text: 'All Violation Types' },
    { key: 'daily_overtime', text: 'Daily Overtime' },
    { key: 'weekly_overtime', text: 'Weekly Overtime' },
    { key: 'consecutive_days', text: 'Consecutive Days' },
    { key: 'insufficient_rest', text: 'Insufficient Rest' },
    { key: 'missing_break', text: 'Missing Break' },
    { key: 'location_violation', text: 'Location Violation' }
  ];

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Here you would typically call an API to generate and download the report
    const reportData = {
      reportType: selectedReportType,
      dateRange: { start: startDate, end: endDate },
      violationType: selectedViolationType,
      timestamp: new Date().toISOString()
    };

    // For now, we'll just download a JSON file as an example
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${selectedReportType}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsGenerating(false);
  };

  const getReportDescription = (reportType: string): string => {
    switch (reportType) {
      case 'violations':
        return 'Generate a detailed report of all compliance violations within the selected date range.';
      case 'working-hours':
        return 'Analyze working hours compliance and identify potential violations.';
      case 'compliance-summary':
        return 'High-level overview of overall compliance status and key metrics.';
      case 'trends':
        return 'Identify compliance trends and patterns over time.';
      case 'staff-compliance':
        return 'Individual staff member compliance records and performance.';
      case 'venue-compliance':
        return 'Venue-specific compliance analysis and venue performance metrics.';
      default:
        return 'Generate compliance reports for analysis and documentation.';
    }
  };

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <Icon iconName="BarChart4" className="text-red-600" style={{ fontSize: '24px' }} />
          </div>
          <div>
            <Text variant="xxLarge" className="font-bold text-gray-900">
              Compliance Reports
            </Text>
            <Text variant="medium" className="text-gray-600 block mt-1">
              Generate detailed compliance reports and analytics
            </Text>
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <Text variant="large" className="font-semibold text-gray-900 mb-4">
          Report Configuration
        </Text>

        <Stack tokens={{ childrenGap: 20 }}>
          {/* Report Type Selection */}
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Report Type
            </Text>
            <Dropdown
              selectedKey={selectedReportType}
              onChange={(_, option) => setSelectedReportType(option?.key as string)}
              options={reportTypeOptions}
              styles={{
                dropdown: { width: '100%', maxWidth: '400px' }
              }}
            />
            <Text variant="small" className="text-gray-500 mt-1 block">
              {getReportDescription(selectedReportType)}
            </Text>
          </div>

          {/* Date Range */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
                Start Date
              </Text>
              <DatePicker
                value={startDate}
                onSelectDate={(date) => date && setStartDate(date)}
                maxDate={endDate}
                styles={{
                  root: { width: '100%' }
                }}
              />
            </div>
            <div>
              <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
                End Date
              </Text>
              <DatePicker
                value={endDate}
                onSelectDate={(date) => date && setEndDate(date)}
                minDate={startDate}
                maxDate={new Date()}
                styles={{
                  root: { width: '100%' }
                }}
              />
            </div>
          </div>

          {/* Violation Type Filter (only for violations report) */}
          {selectedReportType === 'violations' && (
            <div>
              <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
                Violation Type Filter
              </Text>
              <Dropdown
                selectedKey={selectedViolationType}
                onChange={(_, option) => setSelectedViolationType(option?.key as string)}
                options={violationTypeOptions}
                styles={{
                  dropdown: { width: '100%', maxWidth: '400px' }
                }}
              />
            </div>
          )}
        </Stack>
      </div>

      {/* Quick Stats Preview */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Total Violations
              </Text>
              <Text variant="xxLarge" className="font-bold text-red-600 mt-1">
                {violations?.length || 0}
              </Text>
            </div>
            <Icon iconName="Warning" className="text-red-600" style={{ fontSize: '32px' }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Date Range
              </Text>
              <Text variant="medium" className="font-semibold text-gray-900 mt-1">
                {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
              </Text>
            </div>
            <Icon iconName="Calendar" className="text-blue-600" style={{ fontSize: '32px' }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Report Type
              </Text>
              <Text variant="medium" className="font-semibold text-gray-900 mt-1">
                {reportTypeOptions.find(opt => opt.key === selectedReportType)?.text}
              </Text>
            </div>
            <Icon iconName="FilePDF" className="text-green-600" style={{ fontSize: '32px' }} />
          </div>
        </div>
      </div>

      {/* Generate Report Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="large" className="font-semibold text-gray-900">
              Generate Report
            </Text>
            <Text variant="medium" className="text-gray-600 mt-1">
              Click to generate and download your compliance report
            </Text>
          </div>

          <Stack horizontal tokens={{ childrenGap: 12 }}>
            <DefaultButton
              text="Preview"
              iconProps={{ iconName: 'RedEye' }}
              disabled={isGenerating}
            />
            <PrimaryButton
              text={isGenerating ? 'Generating...' : 'Generate Report'}
              iconProps={{ iconName: isGenerating ? 'ProgressLoopOuter' : 'Download' }}
              onClick={handleGenerateReport}
              disabled={isGenerating}
              styles={{
                root: {
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626'
                },
                rootHovered: {
                  backgroundColor: '#b91c1c',
                  borderColor: '#b91c1c'
                }
              }}
            />
          </Stack>
        </div>
      </div>

      {/* Available Export Formats */}
      <div className="mt-6 bg-gray-50 rounded-xl p-4">
        <Text variant="medium" className="font-medium text-gray-700 mb-3">
          Available Export Formats
        </Text>
        <div className="flex flex-wrap gap-2">
          {['PDF', 'Excel', 'CSV', 'JSON'].map((format) => (
            <div key={format} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
              <Icon iconName={format === 'PDF' ? 'FilePDF' : format === 'Excel' ? 'ExcelDocument' : 'Document'} className="text-gray-500" />
              <Text variant="small" className="text-gray-700">{format}</Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComplianceReports;