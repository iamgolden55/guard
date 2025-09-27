import React, { useState } from 'react';
import { Text, Dropdown, type IDropdownOption, Stack } from '@fluentui/react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useComplianceData } from '../../hooks/useComplianceData';

interface ComplianceTrendsProps {
  className?: string;
}

const ComplianceTrends: React.FC<ComplianceTrendsProps> = ({ className = '' }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('30d');
  const [selectedMetric, setSelectedMetric] = useState<string>('violations');

  const { violations, metricsData, isLoading } = useComplianceData({
    refreshInterval: 30000
  });

  const timeframeOptions: IDropdownOption[] = [
    { key: '7d', text: 'Last 7 days' },
    { key: '30d', text: 'Last 30 days' },
    { key: '90d', text: 'Last 90 days' },
    { key: '1y', text: 'Last year' }
  ];

  const metricOptions: IDropdownOption[] = [
    { key: 'violations', text: 'Violations Count' },
    { key: 'resolution-time', text: 'Resolution Time' },
    { key: 'compliance-rate', text: 'Compliance Rate' },
    { key: 'working-hours', text: 'Working Hours Issues' }
  ];

  // Mock trend data - in a real app, this would come from the API
  const getTrendData = () => {
    switch (selectedMetric) {
      case 'violations':
        return {
          current: violations?.length || 0,
          previous: 15,
          change: violations?.length ? ((violations.length - 15) / 15 * 100) : 0,
          trend: 'up'
        };
      case 'resolution-time':
        return {
          current: metricsData?.average_resolution_time_hours || 0,
          previous: 8.5,
          change: metricsData?.average_resolution_time_hours ? ((metricsData.average_resolution_time_hours - 8.5) / 8.5 * 100) : 0,
          trend: 'down'
        };
      case 'compliance-rate':
        return {
          current: 94.2,
          previous: 91.8,
          change: 2.6,
          trend: 'up'
        };
      case 'working-hours':
        return {
          current: 8,
          previous: 12,
          change: -33.3,
          trend: 'down'
        };
      default:
        return { current: 0, previous: 0, change: 0, trend: 'neutral' };
    }
  };

  const trendData = getTrendData();

  const formatMetricValue = (value: number, metric: string): string => {
    switch (metric) {
      case 'violations':
      case 'working-hours':
        return value.toString();
      case 'resolution-time':
        return `${value.toFixed(1)}h`;
      case 'compliance-rate':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  const getChangeColor = (change: number): string => {
    if (selectedMetric === 'resolution-time' || selectedMetric === 'violations' || selectedMetric === 'working-hours') {
      // For these metrics, lower is better
      return change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-600';
    } else {
      // For compliance rate, higher is better
      return change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600';
    }
  };

  const getChangeIcon = (change: number): string => {
    if (selectedMetric === 'resolution-time' || selectedMetric === 'violations' || selectedMetric === 'working-hours') {
      return change > 0 ? 'ChevronUp' : change < 0 ? 'ChevronDown' : 'Remove';
    } else {
      return change > 0 ? 'ChevronUp' : change < 0 ? 'ChevronDown' : 'Remove';
    }
  };

  // Mock chart data for visualization placeholder
  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    value: Math.floor(Math.random() * 20) + 5
  }));

  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <Icon iconName="LineChart" className="text-red-600" style={{ fontSize: '24px' }} />
          </div>
          <div>
            <Text variant="xxLarge" className="font-bold text-gray-900">
              Trends & Analytics
            </Text>
            <Text variant="medium" className="text-gray-600 block mt-1">
              Track compliance trends and identify patterns over time
            </Text>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Time Period
            </Text>
            <Dropdown
              selectedKey={selectedTimeframe}
              onChange={(_, option) => setSelectedTimeframe(option?.key as string)}
              options={timeframeOptions}
              styles={{
                dropdown: { width: '100%' }
              }}
            />
          </div>
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Metric
            </Text>
            <Dropdown
              selectedKey={selectedMetric}
              onChange={(_, option) => setSelectedMetric(option?.key as string)}
              options={metricOptions}
              styles={{
                dropdown: { width: '100%' }
              }}
            />
          </div>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Current Value */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Current Value
              </Text>
              <Text variant="xxLarge" className="font-bold text-gray-900 mt-1">
                {formatMetricValue(trendData.current, selectedMetric)}
              </Text>
            </div>
            <Icon iconName="LineChart" className="text-blue-600" style={{ fontSize: '32px' }} />
          </div>
        </div>

        {/* Change from Previous Period */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Change from Previous
              </Text>
              <div className="flex items-center gap-2 mt-1">
                <Text variant="xxLarge" className={`font-bold ${getChangeColor(trendData.change)}`}>
                  {trendData.change > 0 ? '+' : ''}{trendData.change.toFixed(1)}%
                </Text>
                <Icon
                  iconName={getChangeIcon(trendData.change)}
                  className={getChangeColor(trendData.change)}
                  style={{ fontSize: '20px' }}
                />
              </div>
            </div>
            <Icon
              iconName={trendData.change > 0 ? 'ChevronUp' : trendData.change < 0 ? 'ChevronDown' : 'Remove'}
              className={getChangeColor(trendData.change)}
              style={{ fontSize: '32px' }}
            />
          </div>
        </div>

        {/* Time Period */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                Analysis Period
              </Text>
              <Text variant="large" className="font-semibold text-gray-900 mt-1">
                {timeframeOptions.find(opt => opt.key === selectedTimeframe)?.text}
              </Text>
            </div>
            <Icon iconName="Calendar" className="text-green-600" style={{ fontSize: '32px' }} />
          </div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <Text variant="large" className="font-semibold text-gray-900">
            {metricOptions.find(opt => opt.key === selectedMetric)?.text} Trend
          </Text>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <Text variant="small" className="text-gray-600">Current Period</Text>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <Text variant="small" className="text-gray-600">Previous Period</Text>
            </div>
          </div>
        </div>

        {/* Chart Placeholder - In a real app, you'd use a charting library like Chart.js or Recharts */}
        <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
          <div className="text-center">
            <Icon iconName="LineChart" className="text-gray-400 mb-4" style={{ fontSize: '48px' }} />
            <Text variant="large" className="text-gray-500 font-medium">
              Chart Visualization
            </Text>
            <Text variant="medium" className="text-gray-400 mt-2">
              Interactive trend chart would be displayed here
            </Text>
          </div>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Key Insights */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon iconName="Lightbulb" className="text-yellow-600" style={{ fontSize: '20px' }} />
            <Text variant="large" className="font-semibold text-gray-900">
              Key Insights
            </Text>
          </div>
          <Stack tokens={{ childrenGap: 12 }}>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
              <Text variant="medium" className="text-gray-700">
                Violation patterns show increased frequency during weekend shifts
              </Text>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <Text variant="medium" className="text-gray-700">
                Resolution times have improved by 15% over the last month
              </Text>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <Text variant="medium" className="text-gray-700">
                Overall compliance rate maintains above 90% target
              </Text>
            </div>
          </Stack>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon iconName="Megaphone" className="text-blue-600" style={{ fontSize: '20px' }} />
            <Text variant="large" className="font-semibold text-gray-900">
              Recommendations
            </Text>
          </div>
          <Stack tokens={{ childrenGap: 12 }}>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
              <Text variant="medium" className="text-gray-700">
                Review weekend staffing policies to reduce violations
              </Text>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <Text variant="medium" className="text-gray-700">
                Implement automated monitoring for working hours compliance
              </Text>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
              <Text variant="medium" className="text-gray-700">
                Consider additional training for high-risk venues
              </Text>
            </div>
          </Stack>
        </div>
      </div>
    </div>
  );
};

export default ComplianceTrends;