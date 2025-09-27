import React, { useState, useEffect, useMemo } from 'react';
import {
  Stack,
  Text,

  Dropdown,
  IDropdownOption,
  DatePicker,
  DefaultButton,
  PrimaryButton,
  Pivot,
  PivotItem,
  Spinner,
  SpinnerSize,
  IStackTokens,
  Icon,
  TooltipHost
} from '@fluentui/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Radar } from 'react-chartjs-2';
import { LeaveStatistics, LeaveType } from '../../types/leave';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LeaveAnalyticsDashboardProps {
  statistics: LeaveStatistics | null;
  leaveTypes: LeaveType[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  className?: string;
}

interface ChartData {
  labels: string[];
  datasets: any[];
}

const stackTokens: IStackTokens = {
  childrenGap: 20,
  padding: 16,
};

const LeaveAnalyticsDashboard: React.FC<LeaveAnalyticsDashboardProps> = ({
  statistics,
  leaveTypes,
  isLoading = false,
  onRefresh,
  onExport,
  className = ''
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_year');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date()
  });

  // Dropdown options
  const periodOptions: IDropdownOption[] = [
    { key: 'current_year', text: 'Current Year' },
    { key: 'last_year', text: 'Last Year' },
    { key: 'last_6_months', text: 'Last 6 Months' },
    { key: 'last_3_months', text: 'Last 3 Months' },
    { key: 'custom', text: 'Custom Range' }
  ];

  const departmentOptions: IDropdownOption[] = [
    { key: 'all', text: 'All Departments' },
    { key: 'security', text: 'Security' },
    { key: 'admin', text: 'Administration' },
    { key: 'management', text: 'Management' }
  ];

  // Chart colors
  const chartColors = {
    primary: '#0078d4',
    secondary: '#107c10',
    warning: '#ff8c00',
    danger: '#d13438',
    info: '#8a8886',
    light: '#f3f2f1'
  };

  // Generate sample data for demonstration (replace with real data)
  const generateSampleData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      monthlyTrends: {
        labels: months.slice(0, new Date().getMonth() + 1),
        datasets: [
          {
            label: 'Approved Requests',
            data: [15, 18, 22, 19, 24, 21, 28, 25, 23, 20, 19, 17].slice(0, new Date().getMonth() + 1),
            backgroundColor: chartColors.primary,
            borderColor: chartColors.primary,
            tension: 0.4,
            fill: false
          },
          {
            label: 'Rejected Requests',
            data: [2, 3, 1, 4, 2, 3, 1, 2, 3, 2, 1, 2].slice(0, new Date().getMonth() + 1),
            backgroundColor: chartColors.danger,
            borderColor: chartColors.danger,
            tension: 0.4,
            fill: false
          }
        ]
      },
      leaveTypeDistribution: {
        labels: leaveTypes.map(lt => lt.name),
        datasets: [
          {
            data: [45, 25, 15, 10, 5], // Sample data
            backgroundColor: [
              chartColors.primary,
              chartColors.secondary,
              chartColors.warning,
              chartColors.danger,
              chartColors.info
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }
        ]
      },
      departmentComparison: {
        labels: ['Security', 'Administration', 'Management', 'Operations'],
        datasets: [
          {
            label: 'Leave Days Taken',
            data: [120, 85, 45, 95],
            backgroundColor: chartColors.primary,
            borderColor: chartColors.primary,
            borderWidth: 1
          },
          {
            label: 'Leave Days Remaining',
            data: [80, 115, 155, 105],
            backgroundColor: chartColors.secondary,
            borderColor: chartColors.secondary,
            borderWidth: 1
          }
        ]
      },
      utilizationTrends: {
        labels: months.slice(0, new Date().getMonth() + 1),
        datasets: [
          {
            label: 'Leave Utilization %',
            data: [65, 70, 78, 72, 85, 80, 88, 82, 79, 75, 73, 68].slice(0, new Date().getMonth() + 1),
            backgroundColor: 'rgba(0, 120, 212, 0.1)',
            borderColor: chartColors.primary,
            pointBackgroundColor: chartColors.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      }
    };
  };

  const chartData = useMemo(() => generateSampleData(), [leaveTypes]);

  // Chart options
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 20,
          usePointStyle: true
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`leave-analytics-dashboard ${className}`}>
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading analytics..." />
        </Stack>
      </div>
    );
  }

  return (
    <div className={`leave-analytics-dashboard ${className}`}>
      <Stack tokens={stackTokens}>
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center" tokens={{ padding: 16 }}>
            <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="center">
              <Dropdown
                label="Time Period"
                selectedKey={selectedPeriod}
                options={periodOptions}
                onChange={(_, option) => setSelectedPeriod(option?.key as string)}
                styles={{ dropdown: { width: 150 } }}
              />

              <Dropdown
                label="Department"
                selectedKey={selectedDepartment}
                options={departmentOptions}
                onChange={(_, option) => setSelectedDepartment(option?.key as string)}
                styles={{ dropdown: { width: 150 } }}
              />

              {selectedPeriod === 'custom' && (
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <DatePicker
                    label="Start Date"
                    value={dateRange.startDate}
                    onSelectDate={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
                  />
                  <DatePicker
                    label="End Date"
                    value={dateRange.endDate}
                    onSelectDate={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
                  />
                </Stack>
              )}
            </Stack>

            <Stack horizontal tokens={{ childrenGap: 8 }}>
              <DefaultButton
                text="Export CSV"
                iconProps={{ iconName: 'ExcelDocument' }}
                onClick={() => onExport?.('csv')}
              />
              <DefaultButton
                text="Export PDF"
                iconProps={{ iconName: 'PDF' }}
                onClick={() => onExport?.('pdf')}
              />
              <PrimaryButton
                text="Refresh"
                iconProps={{ iconName: 'Refresh' }}
                onClick={onRefresh}
              />
            </Stack>
          </Stack>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <Stack tokens={{ padding: 16, childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { color: '#666' } }}>
                  Total Requests
                </Text>
                <Icon iconName="FileRequest" styles={{ root: { color: chartColors.primary } }} />
              </Stack>
              <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: chartColors.primary } }}>
                {statistics?.total_requests || 247}
              </Text>
              <Text variant="small" styles={{ root: { color: '#107c10' } }}>
                ↑ 12% vs last month
              </Text>
            </Stack>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <Stack tokens={{ padding: 16, childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { color: '#666' } }}>
                  Approval Rate
                </Text>
                <Icon iconName="CheckMark" styles={{ root: { color: chartColors.secondary } }} />
              </Stack>
              <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: chartColors.secondary } }}>
                94.2%
              </Text>
              <Text variant="small" styles={{ root: { color: '#107c10' } }}>
                ↑ 2.1% vs last month
              </Text>
            </Stack>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <Stack tokens={{ padding: 16, childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { color: '#666' } }}>
                  Avg Days/Request
                </Text>
                <Icon iconName="Calendar" styles={{ root: { color: chartColors.warning } }} />
              </Stack>
              <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: chartColors.warning } }}>
                {statistics?.average_days_per_request || '3.2'}
              </Text>
              <Text variant="small" styles={{ root: { color: '#d13438' } }}>
                ↓ 0.3 vs last month
              </Text>
            </Stack>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <Stack tokens={{ padding: 16, childrenGap: 8 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { color: '#666' } }}>
                  Peak Month
                </Text>
                <Icon iconName="TrendingUp" styles={{ root: { color: chartColors.info } }} />
              </Stack>
              <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: chartColors.info } }}>
                July
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                28 requests
              </Text>
            </Stack>
          </div>
        </div>

        {/* Charts */}
        <Pivot>
          <PivotItem headerText="Trends & Patterns">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Monthly Leave Requests
                    </Text>
                    <TooltipHost content="Approved vs Rejected requests by month">
                      <Icon iconName="Info" styles={{ root: { color: '#666' } }} />
                    </TooltipHost>
                  </Stack>
                  <div style={{ height: 300 }}>
                    <Line data={chartData.monthlyTrends} options={commonChartOptions} />
                  </div>
                </Stack>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Leave Utilization Trend
                    </Text>
                    <TooltipHost content="Percentage of available leave days used">
                      <Icon iconName="Info" styles={{ root: { color: '#666' } }} />
                    </TooltipHost>
                  </Stack>
                  <div style={{ height: 300 }}>
                    <Line data={chartData.utilizationTrends} options={commonChartOptions} />
                  </div>
                </Stack>
              </div>
            </div>
          </PivotItem>

          <PivotItem headerText="Leave Types & Distribution">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Leave Type Distribution
                    </Text>
                    <TooltipHost content="Breakdown of leave requests by type">
                      <Icon iconName="Info" styles={{ root: { color: '#666' } }} />
                    </TooltipHost>
                  </Stack>
                  <div style={{ height: 300 }}>
                    <Doughnut data={chartData.leaveTypeDistribution} options={doughnutOptions} />
                  </div>
                </Stack>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    Leave Type Statistics
                  </Text>
                  <Stack tokens={{ childrenGap: 12 }}>
                    {leaveTypes.slice(0, 5).map((type, index) => (
                      <Stack key={type.id} horizontal horizontalAlign="space-between" verticalAlign="center">
                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: type.color_code || chartColors.primary
                            }}
                          />
                          <Text variant="medium">{type.name}</Text>
                        </Stack>
                        <Stack horizontalAlign="end">
                          <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                            {[45, 25, 15, 10, 5][index] || 0}%
                          </Text>
                          <Text variant="small" styles={{ root: { color: '#666' } }}>
                            {[112, 62, 37, 25, 12][index] || 0} requests
                          </Text>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </div>
            </div>
          </PivotItem>

          <PivotItem headerText="Department Analysis">
            <div className="grid grid-cols-1 gap-6 mt-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                      Department Leave Comparison
                    </Text>
                    <TooltipHost content="Leave days taken vs remaining by department">
                      <Icon iconName="Info" styles={{ root: { color: '#666' } }} />
                    </TooltipHost>
                  </Stack>
                  <div style={{ height: 400 }}>
                    <Bar data={chartData.departmentComparison} options={commonChartOptions} />
                  </div>
                </Stack>
              </div>
            </div>
          </PivotItem>

          <PivotItem headerText="Advanced Analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    Predictive Insights
                  </Text>
                  <Stack tokens={{ childrenGap: 12 }}>
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                          Peak Season Alert
                        </Text>
                        <Text variant="small">
                          Based on historical data, expect 40% increase in leave requests during December.
                        </Text>
                      </Stack>
                    </div>

                    <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded">
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#ff8c00' } }}>
                          Capacity Planning
                        </Text>
                        <Text variant="small">
                          Security department may face staffing shortages in the next 2 weeks.
                        </Text>
                      </Stack>
                    </div>

                    <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded">
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                          Utilization Trend
                        </Text>
                        <Text variant="small">
                          Leave utilization is 15% below average - consider wellness initiatives.
                        </Text>
                      </Stack>
                    </div>
                  </Stack>
                </Stack>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                <Stack tokens={{ padding: 16, childrenGap: 16 }}>
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    Key Recommendations
                  </Text>
                  <Stack tokens={{ childrenGap: 12 }}>
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="start">
                      <Icon iconName="Lightbulb" styles={{ root: { color: '#ff8c00', marginTop: 4 } }} />
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                          Review Annual Leave Policies
                        </Text>
                        <Text variant="small" styles={{ root: { color: '#666' } }}>
                          High rejection rate for annual leave suggests policy review needed.
                        </Text>
                      </Stack>
                    </Stack>

                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="start">
                      <Icon iconName="People" styles={{ root: { color: '#0078d4', marginTop: 4 } }} />
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                          Cross-Training Initiative
                        </Text>
                        <Text variant="small" styles={{ root: { color: '#666' } }}>
                          Enable better coverage during peak leave periods.
                        </Text>
                      </Stack>
                    </Stack>

                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="start">
                      <Icon iconName="Calendar" styles={{ root: { color: '#107c10', marginTop: 4 } }} />
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                          Blackout Period Planning
                        </Text>
                        <Text variant="small" styles={{ root: { color: '#666' } }}>
                          Consider implementing blackout periods during critical business times.
                        </Text>
                      </Stack>
                    </Stack>
                  </Stack>
                </Stack>
              </div>
            </div>
          </PivotItem>
        </Pivot>
      </Stack>
    </div>
  );
};

export default LeaveAnalyticsDashboard;