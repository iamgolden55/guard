import React, { useState } from 'react';
import { Text, PrimaryButton, DefaultButton, Dropdown, type IDropdownOption, Stack, Spinner, MessageBar } from '@fluentui/react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useComplianceData } from '../../hooks/useComplianceData';

interface ComplianceCheckProps {
  className?: string;
}

interface CheckResult {
  id: string;
  type: 'user' | 'shift' | 'venue';
  name: string;
  status: 'compliant' | 'warning' | 'violation';
  issues: string[];
  recommendations: string[];
}

const ComplianceCheck: React.FC<ComplianceCheckProps> = ({ className = '' }) => {
  const [selectedCheckType, setSelectedCheckType] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  const { violations, isLoading } = useComplianceData();

  const checkTypeOptions: IDropdownOption[] = [
    { key: 'all', text: 'All Compliance Areas' },
    { key: 'working-hours', text: 'Working Hours Compliance' },
    { key: 'shift-patterns', text: 'Shift Pattern Compliance' },
    { key: 'break-times', text: 'Break Time Compliance' },
    { key: 'rest-periods', text: 'Rest Period Compliance' },
    { key: 'location-compliance', text: 'Location Compliance' }
  ];

  const entityOptions: IDropdownOption[] = [
    { key: '', text: 'All Users and Venues' },
    { key: 'user-1', text: 'John Doe' },
    { key: 'user-2', text: 'Jane Smith' },
    { key: 'user-3', text: 'Mike Johnson' },
    { key: 'venue-1', text: 'Main Office' },
    { key: 'venue-2', text: 'Security HQ' },
    { key: 'venue-3', text: 'Training Center' }
  ];

  const runComplianceCheck = async () => {
    setIsRunningCheck(true);
    setCheckResults([]);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock results based on selected check type
      const mockResults: CheckResult[] = [
        {
          id: '1',
          type: 'user',
          name: 'John Doe',
          status: 'violation',
          issues: ['Exceeded 48-hour weekly limit (52.5 hours)', 'Insufficient rest period between shifts'],
          recommendations: ['Reduce scheduled hours for next week', 'Ensure 11-hour rest period between shifts']
        },
        {
          id: '2',
          type: 'user',
          name: 'Jane Smith',
          status: 'compliant',
          issues: [],
          recommendations: ['Continue current scheduling pattern']
        },
        {
          id: '3',
          type: 'user',
          name: 'Mike Johnson',
          status: 'warning',
          issues: ['Approaching weekly hour limit (46 hours)'],
          recommendations: ['Monitor hours for remainder of week']
        },
        {
          id: '4',
          type: 'venue',
          name: 'Main Office',
          status: 'violation',
          issues: ['2 staff members exceeding hour limits', 'Missing break periods in shift logs'],
          recommendations: ['Review staffing levels', 'Implement automated break reminders']
        },
        {
          id: '5',
          type: 'shift',
          name: 'Evening Shift - Sep 16',
          status: 'compliant',
          issues: [],
          recommendations: ['Maintain current compliance standards']
        }
      ];

      setCheckResults(mockResults);
      setLastCheckTime(new Date());
    } catch (error) {
      console.error('Compliance check failed:', error);
    } finally {
      setIsRunningCheck(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'compliant':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'violation':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'compliant':
        return 'CheckMark';
      case 'warning':
        return 'Warning';
      case 'violation':
        return 'ErrorBadge';
      default:
        return 'Unknown';
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'violation':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const complianceStats = {
    total: checkResults.length,
    compliant: checkResults.filter(r => r.status === 'compliant').length,
    warnings: checkResults.filter(r => r.status === 'warning').length,
    violations: checkResults.filter(r => r.status === 'violation').length
  };

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <Icon iconName="Completed" className="text-red-600" style={{ fontSize: '24px' }} />
          </div>
          <div>
            <Text variant="xxLarge" className="font-bold text-gray-900">
              Compliance Check
            </Text>
            <Text variant="medium" className="text-gray-600 block mt-1">
              Run comprehensive compliance checks for users, shifts, and venues
            </Text>
          </div>
        </div>
      </div>

      {/* Check Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <Text variant="large" className="font-semibold text-gray-900 mb-4">
          Check Configuration
        </Text>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Check Type
            </Text>
            <Dropdown
              selectedKey={selectedCheckType}
              onChange={(_, option) => setSelectedCheckType(option?.key as string)}
              options={checkTypeOptions}
              styles={{
                dropdown: { width: '100%' }
              }}
            />
          </div>
          <div>
            <Text variant="medium" className="font-medium text-gray-700 mb-2 block">
              Specific Entity (Optional)
            </Text>
            <Dropdown
              selectedKey={selectedEntity}
              onChange={(_, option) => setSelectedEntity(option?.key as string)}
              options={entityOptions}
              styles={{
                dropdown: { width: '100%' }
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Text variant="medium" className="font-medium text-gray-900">
              Ready to run compliance check
            </Text>
            <Text variant="small" className="text-gray-600 mt-1">
              This will analyze current schedules, shifts, and working hours for compliance violations
            </Text>
          </div>
          <Stack horizontal tokens={{ childrenGap: 12 }}>
            <DefaultButton
              text="Schedule Check"
              iconProps={{ iconName: 'Clock' }}
              disabled={isRunningCheck}
            />
            <PrimaryButton
              text={isRunningCheck ? 'Running Check...' : 'Run Check Now'}
              iconProps={{ iconName: isRunningCheck ? 'ProgressRingDots' : 'Play' }}
              onClick={runComplianceCheck}
              disabled={isRunningCheck}
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

      {/* Loading State */}
      {isRunningCheck && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-center justify-center gap-4">
            <Spinner size={3} />
            <div className="text-center">
              <Text variant="large" className="font-medium text-gray-900">
                Running Compliance Check...
              </Text>
              <Text variant="medium" className="text-gray-600 mt-1">
                Analyzing schedules, working hours, and compliance rules
              </Text>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {checkResults.length > 0 && !isRunningCheck && (
        <>
          <div className="grid md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                    Total Checked
                  </Text>
                  <Text variant="xxLarge" className="font-bold text-gray-900 mt-1">
                    {complianceStats.total}
                  </Text>
                </div>
                <Icon iconName="CheckboxComposite" className="text-blue-600" style={{ fontSize: '32px' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                    Compliant
                  </Text>
                  <Text variant="xxLarge" className="font-bold text-green-600 mt-1">
                    {complianceStats.compliant}
                  </Text>
                </div>
                <Icon iconName="CheckMark" className="text-green-600" style={{ fontSize: '32px' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                    Warnings
                  </Text>
                  <Text variant="xxLarge" className="font-bold text-yellow-600 mt-1">
                    {complianceStats.warnings}
                  </Text>
                </div>
                <Icon iconName="Warning" className="text-yellow-600" style={{ fontSize: '32px' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text variant="small" className="text-gray-600 uppercase tracking-wide font-medium">
                    Violations
                  </Text>
                  <Text variant="xxLarge" className="font-bold text-red-600 mt-1">
                    {complianceStats.violations}
                  </Text>
                </div>
                <Icon iconName="ErrorBadge" className="text-red-600" style={{ fontSize: '32px' }} />
              </div>
            </div>
          </div>

          {/* Last Check Info */}
          {lastCheckTime && (
            <MessageBar>
              <div className="flex items-center justify-between w-full">
                <span>
                  Last check completed: {lastCheckTime.toLocaleString()}
                </span>
                <span>
                  Check type: {checkTypeOptions.find(opt => opt.key === selectedCheckType)?.text}
                </span>
              </div>
            </MessageBar>
          )}

          {/* Detailed Results */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <div className="flex items-center justify-between mb-6">
              <Text variant="large" className="font-semibold text-gray-900">
                Detailed Results
              </Text>
              <DefaultButton
                text="Export Results"
                iconProps={{ iconName: 'Download' }}
              />
            </div>

            <div className="space-y-4">
              {checkResults.map((result) => (
                <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Icon
                        iconName={result.type === 'user' ? 'Contact' : result.type === 'venue' ? 'POI' : 'Calendar'}
                        className="text-gray-500"
                        style={{ fontSize: '20px' }}
                      />
                      <div>
                        <Text variant="medium" className="font-semibold text-gray-900">
                          {result.name}
                        </Text>
                        <Text variant="small" className="text-gray-600 capitalize">
                          {result.type}
                        </Text>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(result.status)}`}>
                      {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                    </span>
                  </div>

                  {result.issues.length > 0 && (
                    <div className="mb-3">
                      <Text variant="small" className="font-medium text-red-700 mb-2 block">
                        Issues Found:
                      </Text>
                      <ul className="space-y-1">
                        {result.issues.map((issue, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Icon iconName="Warning" className="text-red-500 mt-0.5" style={{ fontSize: '12px' }} />
                            <Text variant="small" className="text-red-700">{issue}</Text>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <Text variant="small" className="font-medium text-blue-700 mb-2 block">
                      Recommendations:
                    </Text>
                    <ul className="space-y-1">
                      {result.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Icon iconName="Lightbulb" className="text-blue-500 mt-0.5" style={{ fontSize: '12px' }} />
                          <Text variant="small" className="text-blue-700">{recommendation}</Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {checkResults.length === 0 && !isRunningCheck && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <Icon iconName="Search" className="text-gray-400 mb-4" style={{ fontSize: '48px' }} />
            <Text variant="large" className="text-gray-500 font-medium">
              No compliance check has been run yet
            </Text>
            <Text variant="medium" className="text-gray-400 mt-2">
              Configure your check parameters above and click "Run Check Now" to get started
            </Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceCheck;