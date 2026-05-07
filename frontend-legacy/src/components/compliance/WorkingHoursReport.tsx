import React, { useState } from 'react';
import { Text, PrimaryButton, DefaultButton, Dropdown, type IDropdownOption, DatePicker, Stack } from '@fluentui/react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useComplianceData } from '../../hooks/useComplianceData';

interface WorkingHoursReportProps {
  className?: string;
}

const WorkingHoursReport: React.FC<WorkingHoursReportProps> = ({ className = '' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStaff, setSelectedStaff] = useState<string>('all');

  const { violations, isLoading } = useComplianceData({
    refreshInterval: 30000
  });

  const periodOptions: IDropdownOption[] = [
    { key: 'week', text: 'Weekly Report' },
    { key: 'month', text: 'Monthly Report' },
    { key: 'quarter', text: 'Quarterly Report' }
  ];

  const staffOptions: IDropdownOption[] = [
    { key: 'all', text: 'All Staff Members' },
    { key: 'john-doe', text: 'John Doe' },
    { key: 'jane-smith', text: 'Jane Smith' },
    { key: 'mike-johnson', text: 'Mike Johnson' },
    { key: 'sarah-wilson', text: 'Sarah Wilson' }
  ];

  // Mock working hours data
  const workingHoursData = {
    totalHours: 1847.5,
    regularHours: 1680,
    overtimeHours: 167.5,
    averageWeeklyHours: 41.2,
    maxWeeklyHours: 48,
    staffWithViolations: 3,
    totalStaff: 24,
    complianceRate: 87.5
  };

  const recentViolations = [
    {
      id: 1,
      staff: 'John Doe',
      violation: 'Exceeded 48-hour weekly limit',
      week: 'Week of Sep 9-15',
      hours: 52.5,
      status: 'Under Review'
    },
    {
      id: 2,
      staff: 'Sarah Wilson',
      violation: 'Insufficient rest period',
      week: 'Week of Sep 2-8',
      hours: 47.0,
      status: 'Resolved'
    },
    {
      id: 3,
      staff: 'Mike Johnson',
      violation: 'Consecutive working days',
      week: 'Week of Aug 26-Sep 1',
      hours: 45.5,
      status: 'Action Required'
    }
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Resolved':
        return 'bg-green-100 text-green-800';
      case 'Under Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'Action Required':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <Icon iconName="Clock" className="text-red-600" style={{ fontSize: '24px' }} />
          </div>
          <div>
            <Text variant="xxLarge" className="font-bold text-gray-900">
              Working Hours Report
            </Text>
            <Text variant="medium" className="text-gray-600 block mt-1">
              Monitor working hours compliance and identify potential violations
            </Text>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <Text variant="large" className="font-semibold text-gray-900 mb-4">
          Report Filters
        </Text>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Report Period
            </Text>
            <Dropdown
              selectedKey={selectedPeriod}
              onChange={(_, option) => setSelectedPeriod(option?.key as string)}
              options={periodOptions}
              styles={{
                dropdown: { width: '100%' }
              }}
            />
          </div>
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Reference Date
            </Text>
            <DatePicker
              value={selectedDate}
              onSelectDate={(date) => date && setSelectedDate(date)}
              maxDate={new Date()}
              styles={{
                root: { width: '100%' }
              }}
            />
          </div>
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Staff Filter
            </Text>
            <Dropdown
              selectedKey={selectedStaff}
              onChange={(_, option) => setSelectedStaff(option?.key as string)}
              options={staffOptions}
              styles={{
                dropdown: { width: '100%' }
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Total Hours
              </Text>
              <Text variant="xxLarge" className="font-bold text-gray-900 mt-1">
                {workingHoursData.totalHours.toLocaleString()}
              </Text>
            </div>
            <Icon iconName="TimeEntry" className="text-blue-600" style={{ fontSize: '32px' }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Overtime Hours
              </Text>
              <Text variant="xxLarge" className="font-bold text-orange-600 mt-1">
                {workingHoursData.overtimeHours}
              </Text>
            </div>
            <Icon iconName="Clock" className="text-orange-600" style={{ fontSize: '32px' }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Avg Weekly Hours
              </Text>
              <Text variant="xxLarge" className="font-bold text-green-600 mt-1">
                {workingHoursData.averageWeeklyHours}
              </Text>
            </div>
            <Icon iconName="CalendarWeek" className="text-green-600" style={{ fontSize: '32px' }} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Compliance Rate
              </Text>
              <Text variant="xxLarge" className="font-bold text-red-600 mt-1">
                {workingHoursData.complianceRate}%
              </Text>
            </div>
            <Icon iconName="ComplianceAudit" className="text-red-600" style={{ fontSize: '32px' }} />
          </div>
        </div>
      </div>

      {/* Working Hours Breakdown */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Hours Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <Text variant="large" className="font-semibold text-gray-900 mb-4">
            Hours Distribution
          </Text>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <Text variant="medium" className="text-gray-700">Regular Hours</Text>
                <Text variant="medium" className="font-semibold text-gray-900">
                  {workingHoursData.regularHours} ({((workingHoursData.regularHours / workingHoursData.totalHours) * 100).toFixed(1)}%)
                </Text>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{ width: `${(workingHoursData.regularHours / workingHoursData.totalHours) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Text variant="medium" className="text-gray-700">Overtime Hours</Text>
                <Text variant="medium" className="font-semibold text-gray-900">
                  {workingHoursData.overtimeHours} ({((workingHoursData.overtimeHours / workingHoursData.totalHours) * 100).toFixed(1)}%)
                </Text>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-orange-500 h-3 rounded-full"
                  style={{ width: `${(workingHoursData.overtimeHours / workingHoursData.totalHours) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <Text variant="large" className="font-semibold text-gray-900 mb-4">
            Compliance Status
          </Text>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon iconName="CheckMark" className="text-green-600" />
                <div>
                  <Text variant="medium" className="font-medium text-green-900">Compliant Staff</Text>
                  <Text variant="small" className="text-green-700">Within working hours limits</Text>
                </div>
              </div>
              <Text variant="large" className="font-bold text-green-600">
                {workingHoursData.totalStaff - workingHoursData.staffWithViolations}
              </Text>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon iconName="Warning" className="text-red-600" />
                <div>
                  <Text variant="medium" className="font-medium text-red-900">Non-Compliant Staff</Text>
                  <Text variant="small" className="text-red-700">Exceeded working hours limits</Text>
                </div>
              </div>
              <Text variant="large" className="font-bold text-red-600">
                {workingHoursData.staffWithViolations}
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Violations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <Text variant="large" className="font-semibold text-gray-900">
            Recent Working Hours Violations
          </Text>
          <DefaultButton
            text="View All"
            iconProps={{ iconName: 'List' }}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4">
                  <Text variant="medium" className="font-semibold text-gray-700">Staff Member</Text>
                </th>
                <th className="text-left py-3 px-4">
                  <Text variant="medium" className="font-semibold text-gray-700">Violation Type</Text>
                </th>
                <th className="text-left py-3 px-4">
                  <Text variant="medium" className="font-semibold text-gray-700">Period</Text>
                </th>
                <th className="text-left py-3 px-4">
                  <Text variant="medium" className="font-semibold text-gray-700">Hours Worked</Text>
                </th>
                <th className="text-left py-3 px-4">
                  <Text variant="medium" className="font-semibold text-gray-700">Status</Text>
                </th>
              </tr>
            </thead>
            <tbody>
              {recentViolations.map((violation) => (
                <tr key={violation.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <Text variant="medium" className="font-medium text-gray-900">{violation.staff}</Text>
                  </td>
                  <td className="py-4 px-4">
                    <Text variant="medium" className="text-gray-700">{violation.violation}</Text>
                  </td>
                  <td className="py-4 px-4">
                    <Text variant="medium" className="text-gray-700">{violation.week}</Text>
                  </td>
                  <td className="py-4 px-4">
                    <Text variant="medium" className="font-medium text-gray-900">{violation.hours}h</Text>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(violation.status)}`}>
                      {violation.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="large" className="font-semibold text-gray-900">
              Export Report
            </Text>
            <Text variant="medium" className="text-gray-600 mt-1">
              Download detailed working hours compliance report
            </Text>
          </div>
          <Stack horizontal tokens={{ childrenGap: 12 }}>
            <DefaultButton
              text="Preview"
              iconProps={{ iconName: 'RedEye' }}
            />
            <PrimaryButton
              text="Export PDF"
              iconProps={{ iconName: 'FilePDF' }}
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
    </div>
  );
};

export default WorkingHoursReport;