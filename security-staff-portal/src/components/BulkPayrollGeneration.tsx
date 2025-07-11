import type React from 'react';
import { useState } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Icon,
  DatePicker,
  Separator
} from '@fluentui/react';
import { Card } from '.';

interface PayrollSummary {
  total_staff: number;
  total_shifts: number;
  total_amount: number;
  staff_breakdown: Array<{
    staff_name: string;
    shift_count: number;
    total_amount: number;
  }>;
}

const BulkPayrollGenerationComponent: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate Monday-Sunday period for selected date
  const getWeekPeriod = (date: Date) => {
    const monday = new Date(date);
    monday.setDate(date.getDate() - date.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  };

  const weekPeriod = getWeekPeriod(selectedDate);

  const previewPayroll = async () => {
    setIsPreviewLoading(true);
    setError(null);
    
    try {
      // Import the api service
      const { default: api } = await import('../services/api');
      
      // Real API call to preview payroll
      const response = await api.post('/admin/payroll/preview/', {
        start_date: weekPeriod.monday.toISOString().split('T')[0],
        end_date: weekPeriod.sunday.toISOString().split('T')[0]
      });

      setPayrollSummary(response.data);
    } catch (error) {
      console.error('Payroll preview error:', error);
      setError('Failed to preview payroll. Please try again.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const generatePayroll = async () => {
    if (!payrollSummary) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      // Import the api service
      const { default: api } = await import('../services/api');
      
      // Real API call to generate payroll
      const response = await api.post('/admin/payroll/generate/', {
        start_date: weekPeriod.monday.toISOString().split('T')[0],
        end_date: weekPeriod.sunday.toISOString().split('T')[0]
      });

      const data = response.data;
      setSuccess(`${data.message} Total amount: £${data.total_amount.toFixed(2)}`);
      setPayrollSummary(null);
    } catch (error) {
      console.error('Payroll generation error:', error);
      setError('Failed to generate payroll. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="p-6">
      <Stack tokens={{ childrenGap: 20 }}>
        {/* Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack>
            <Text variant="xLarge" className="font-semibold">
              💼 Weekly Payroll Generation
            </Text>
            <Text variant="medium" className="text-gray-600">
              Generate invoices for all staff for a weekly period (Monday-Sunday)
            </Text>
          </Stack>
          <Icon iconName="PaymentCard" className="text-blue-600 text-3xl" />
        </Stack>

        {/* Date Selection */}
        <div className="bg-gray-50 rounded-lg p-4">
          <Stack tokens={{ childrenGap: 12 }}>
            <Text variant="mediumPlus" className="font-semibold">
              📅 Select Pay Period
            </Text>
            <Stack horizontal tokens={{ childrenGap: 20 }} verticalAlign="end">
              <Stack>
                <Text variant="small" className="text-gray-600 mb-1">
                  Select any date in the week
                </Text>
                <DatePicker
                  value={selectedDate}
                  onSelectDate={(date) => date && setSelectedDate(date)}
                  placeholder="Select date"
                  ariaLabel="Select date"
                />
              </Stack>
              <Stack>
                <Text variant="medium" className="font-semibold">
                  Pay Period: {formatDate(weekPeriod.monday)} - {formatDate(weekPeriod.sunday)}
                </Text>
                <Text variant="small" className="text-gray-600">
                  Payment will be processed on Monday
                </Text>
              </Stack>
            </Stack>
          </Stack>
        </div>

        {/* Preview Button */}
        <Stack horizontal tokens={{ childrenGap: 12 }}>
          <PrimaryButton
            text="Preview Payroll"
            iconProps={{ iconName: 'View' }}
            onClick={previewPayroll}
            disabled={isPreviewLoading || isGenerating}
          />
          {isPreviewLoading && <Spinner size={SpinnerSize.small} />}
        </Stack>

        {/* Error/Success Messages */}
        {error && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
            {error}
          </MessageBar>
        )}

        {success && (
          <MessageBar messageBarType={MessageBarType.success} onDismiss={() => setSuccess(null)}>
            {success}
          </MessageBar>
        )}

        {/* Payroll Summary */}
        {payrollSummary && (
          <>
            <Separator />
            <div className="bg-blue-50 rounded-lg p-4">
              <Stack tokens={{ childrenGap: 16 }}>
                <Text variant="large" className="font-semibold text-blue-800">
                  📊 Payroll Summary
                </Text>
                
                <Stack horizontal tokens={{ childrenGap: 30 }}>
                  <Stack>
                    <Text variant="xxLarge" className="font-bold text-green-600">
                      £{payrollSummary.total_amount.toFixed(2)}
                    </Text>
                    <Text variant="medium" className="text-gray-600">
                      Total Payroll
                    </Text>
                  </Stack>
                  <Stack>
                    <Text variant="xLarge" className="font-bold text-blue-600">
                      {payrollSummary.total_staff}
                    </Text>
                    <Text variant="medium" className="text-gray-600">
                      Staff Members
                    </Text>
                  </Stack>
                  <Stack>
                    <Text variant="xLarge" className="font-bold text-purple-600">
                      {payrollSummary.total_shifts}
                    </Text>
                    <Text variant="medium" className="text-gray-600">
                      Total Shifts
                    </Text>
                  </Stack>
                </Stack>

                {/* Staff Breakdown */}
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text variant="mediumPlus" className="font-semibold">
                    Staff Breakdown:
                  </Text>
                  <div className="max-h-60 overflow-y-auto">
                    {payrollSummary.staff_breakdown.map((staff, index) => (
                      <div key={index} className="bg-white rounded p-3 mb-2">
                        <Stack horizontal horizontalAlign="space-between">
                          <Stack>
                            <Text variant="medium" className="font-semibold">
                              {staff.staff_name}
                            </Text>
                            <Text variant="small" className="text-gray-600">
                              {staff.shift_count} shifts
                            </Text>
                          </Stack>
                          <Text variant="medium" className="font-semibold text-green-600">
                            £{staff.total_amount.toFixed(2)}
                          </Text>
                        </Stack>
                      </div>
                    ))}
                  </div>
                </Stack>

                {/* Generate Button */}
                <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center">
                  <PrimaryButton
                    text={isGenerating ? "Generating Invoices..." : "Generate All Invoices"}
                    iconProps={{ iconName: 'PaymentCard' }}
                    onClick={generatePayroll}
                    disabled={isGenerating}
                    className="bg-green-600 hover:bg-green-700"
                  />
                  <DefaultButton
                    text="Cancel"
                    onClick={() => setPayrollSummary(null)}
                    disabled={isGenerating}
                  />
                  {isGenerating && <Spinner size={SpinnerSize.small} />}
                </Stack>
              </Stack>
            </div>
          </>
        )}

        {/* Info Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            <Icon iconName="Info" className="text-yellow-600" />
            <Stack>
              <Text variant="small" className="text-yellow-800">
                <strong>How it works:</strong> This will generate individual invoices for all staff members who have approved shifts during the selected week. 
                Staff will be notified and can view their invoices immediately. Payment processing should be completed by the following Monday.
              </Text>
            </Stack>
          </Stack>
        </div>
      </Stack>
    </Card>
  );
};

export default BulkPayrollGenerationComponent;