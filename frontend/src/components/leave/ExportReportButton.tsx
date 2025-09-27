import React, { useState, useCallback } from 'react';
import {
  DefaultButton,
  PrimaryButton,
  IconButton,
  Callout,
  DirectionalHint,
  Stack,
  Text,
  Dropdown,
  IDropdownOption,
  Toggle,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  IStackTokens
} from '@fluentui/react';
import { LeaveRequestFilterOptions } from '../../types/leave';

interface ExportReportButtonProps {
  filters?: LeaveRequestFilterOptions;
  onExport: (format: 'csv' | 'xlsx' | 'pdf', options: ExportOptions) => Promise<void>;
  isExporting?: boolean;
  className?: string;
}

interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  customFileName?: string;
  dateRange: {
    start?: string;
    end?: string;
  };
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
};

const ExportReportButton: React.FC<ExportReportButtonProps> = ({
  filters = {},
  onExport,
  isExporting = false,
  className = ''
}) => {
  const [isCalloutVisible, setIsCalloutVisible] = useState(false);
  const [calloutTarget, setCalloutTarget] = useState<HTMLElement | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'xlsx',
    includeCharts: true,
    includeSummary: true,
    includeDetails: true,
    dateRange: {
      start: filters.start_date,
      end: filters.end_date
    }
  });
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  // Format options
  const formatOptions: IDropdownOption[] = [
    { key: 'xlsx', text: 'Excel (.xlsx)', data: { icon: 'ExcelDocument' } },
    { key: 'csv', text: 'CSV (.csv)', data: { icon: 'Table' } },
    { key: 'pdf', text: 'PDF (.pdf)', data: { icon: 'PDF' } }
  ];

  // Toggle export options callout
  const toggleExportOptions = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setCalloutTarget(event.currentTarget as HTMLElement);
    setIsCalloutVisible(!isCalloutVisible);
  }, [isCalloutVisible]);

  // Handle export option changes
  const handleOptionChange = useCallback((field: keyof ExportOptions, value: any) => {
    setExportOptions(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Quick export with default options
  const handleQuickExport = useCallback(async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      await onExport(format, {
        ...exportOptions,
        format
      });

      setNotification({
        type: MessageBarType.success,
        message: `Report exported successfully as ${format.toUpperCase()}!`
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to export report. Please try again.'
      });
    }
  }, [onExport, exportOptions]);

  // Custom export with selected options
  const handleCustomExport = useCallback(async () => {
    try {
      await onExport(exportOptions.format, exportOptions);

      setIsCalloutVisible(false);
      setNotification({
        type: MessageBarType.success,
        message: `Report exported successfully as ${exportOptions.format.toUpperCase()}!`
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to export report. Please try again.'
      });
    }
  }, [onExport, exportOptions]);

  // Generate default filename
  const generateFileName = useCallback(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `leave_report_${dateStr}_${timeStr}`;
  }, []);

  // Clear notification after 5 seconds
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Update export options when filters change
  React.useEffect(() => {
    setExportOptions(prev => ({
      ...prev,
      dateRange: {
        start: filters.start_date,
        end: filters.end_date
      }
    }));
  }, [filters.start_date, filters.end_date]);

  return (
    <div className={`export-report-button ${className}`}>
      {/* Notification */}
      {notification && (
        <MessageBar
          messageBarType={notification.type}
          onDismiss={() => setNotification(null)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 16 } }}
        >
          {notification.message}
        </MessageBar>
      )}

      <Stack horizontal tokens={{ childrenGap: 8 }}>
        {/* Quick Export Buttons */}
        <DefaultButton
          text="Excel"
          iconProps={{ iconName: 'ExcelDocument' }}
          onClick={() => handleQuickExport('xlsx')}
          disabled={isExporting}
          title="Export to Excel with default settings"
        />

        <DefaultButton
          text="CSV"
          iconProps={{ iconName: 'Table' }}
          onClick={() => handleQuickExport('csv')}
          disabled={isExporting}
          title="Export to CSV with default settings"
        />

        <DefaultButton
          text="PDF"
          iconProps={{ iconName: 'PDF' }}
          onClick={() => handleQuickExport('pdf')}
          disabled={isExporting}
          title="Export to PDF with default settings"
        />

        {/* Custom Export Options */}
        <IconButton
          id="export-options-button"
          iconProps={{ iconName: 'Settings' }}
          title="Export Options"
          onClick={toggleExportOptions}
          disabled={isExporting}
        />

        {isExporting && (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Spinner size={SpinnerSize.small} />
            <Text variant="small">Exporting...</Text>
          </Stack>
        )}
      </Stack>

      {/* Export Options Callout */}
      {isCalloutVisible && (
        <Callout
          target={calloutTarget}
          onDismiss={() => setIsCalloutVisible(false)}
          directionalHint={DirectionalHint.bottomRightEdge}
          isBeakVisible={true}
          gapSpace={10}
        >
          <div className="p-6 w-96">
            <Stack tokens={stackTokens}>
              <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                Export Options
              </Text>

              {/* Format Selection */}
              <Dropdown
                label="Export Format"
                selectedKey={exportOptions.format}
                options={formatOptions}
                onChange={(_, option) => handleOptionChange('format', option?.key)}
                onRenderOption={(option) => (
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <i className={`ms-Icon ms-Icon--${option?.data?.icon}`} />
                    <span>{option?.text}</span>
                  </Stack>
                )}
              />

              {/* Content Options */}
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                  Include in Export
                </Text>

                <Toggle
                  label="Summary Statistics"
                  checked={exportOptions.includeSummary}
                  onChange={(_, checked) => handleOptionChange('includeSummary', checked)}
                />

                <Toggle
                  label="Detailed Data"
                  checked={exportOptions.includeDetails}
                  onChange={(_, checked) => handleOptionChange('includeDetails', checked)}
                />

                {exportOptions.format === 'pdf' && (
                  <Toggle
                    label="Charts and Graphs"
                    checked={exportOptions.includeCharts}
                    onChange={(_, checked) => handleOptionChange('includeCharts', checked)}
                  />
                )}
              </Stack>

              {/* File Name */}
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                  File Settings
                </Text>

                <input
                  type="text"
                  placeholder={generateFileName()}
                  value={exportOptions.customFileName || ''}
                  onChange={(e) => handleOptionChange('customFileName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Text variant="small" styles={{ root: { color: '#666', marginTop: 4 } }}>
                  Leave empty to use default filename
                </Text>
              </Stack>

              {/* Date Range Summary */}
              {(exportOptions.dateRange.start || exportOptions.dateRange.end) && (
                <Stack>
                  <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                    Date Range
                  </Text>
                  <div className="p-3 bg-gray-50 rounded border">
                    <Text variant="small">
                      {exportOptions.dateRange.start && (
                        <span>From: {new Date(exportOptions.dateRange.start).toLocaleDateString()}</span>
                      )}
                      {exportOptions.dateRange.start && exportOptions.dateRange.end && <br />}
                      {exportOptions.dateRange.end && (
                        <span>To: {new Date(exportOptions.dateRange.end).toLocaleDateString()}</span>
                      )}
                      {!exportOptions.dateRange.start && !exportOptions.dateRange.end && (
                        <span>All dates</span>
                      )}
                    </Text>
                  </div>
                </Stack>
              )}

              {/* Preview Information */}
              <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                <Text variant="small" styles={{ root: { color: '#0078d4' } }}>
                  <strong>Export Preview:</strong><br />
                  Format: {exportOptions.format.toUpperCase()}<br />
                  {exportOptions.includeSummary && 'Summary statistics included'}<br />
                  {exportOptions.includeDetails && 'Detailed data included'}<br />
                  {exportOptions.includeCharts && exportOptions.format === 'pdf' && 'Charts and graphs included'}
                </Text>
              </div>

              {/* Actions */}
              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                <DefaultButton
                  text="Cancel"
                  onClick={() => setIsCalloutVisible(false)}
                />
                <PrimaryButton
                  text={`Export ${exportOptions.format.toUpperCase()}`}
                  onClick={handleCustomExport}
                  disabled={isExporting}
                  iconProps={{
                    iconName: exportOptions.format === 'pdf' ? 'PDF' :
                              exportOptions.format === 'xlsx' ? 'ExcelDocument' : 'Table'
                  }}
                />
              </Stack>
            </Stack>
          </div>
        </Callout>
      )}
    </div>
  );
};

export default ExportReportButton;