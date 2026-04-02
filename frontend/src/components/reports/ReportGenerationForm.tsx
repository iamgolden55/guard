import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Card,
  CardHeader,
  
  Text,
  Title1,
  Title3,
  Button,
  Field,
  Input,
  Dropdown,
  Option,
  Textarea,
  Checkbox,
  
  MessageBar,
  
  Spinner,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Badge,
  Divider
} from '@fluentui/react-components';
import {
  PlayRegular,
  DismissRegular,
  SaveRegular,
  SettingsRegular,
  CalendarRegular,
  FilterRegular,
  ChevronDownRegular
} from '@fluentui/react-icons';
import { Formik, Form, FormikProps } from 'formik';
import * as Yup from 'yup';
import { ReportGenerationRequest, ExportFormat } from '../../types/reports';
import reportService from '../../services/reportService';
import ExportFormatSelector from './ExportFormatSelector';
import AsyncProgressTracker from './AsyncProgressTracker';

interface ReportGenerationFormProps {
  onReportGenerated?: (jobId: string) => void;
  onCancel?: () => void;
  initialValues?: Partial<ReportGenerationRequest>;
  reportTypes?: Array<{ id: string; name: string; description: string }>;
}

interface FormValues extends ReportGenerationRequest {
  startDate: Date | null;
  endDate: Date | null;
}

const validationSchema = Yup.object({
  title: Yup.string()
    .required('Report title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters'),
  reportType: Yup.string()
    .required('Report type is required'),
  format: Yup.string()
    .oneOf(Object.values(ExportFormat), 'Invalid export format')
    .required('Export format is required'),
  startDate: Yup.date()
    .nullable()
    .max(new Date(), 'Start date cannot be in the future'),
  endDate: Yup.date()
    .nullable()
    .min(Yup.ref('startDate'), 'End date must be after start date')
    .max(new Date(), 'End date cannot be in the future')
});

// Default report types as fallback
const DEFAULT_REPORT_TYPES = [
  {
    id: 'staff_report',
    name: 'Staff Report',
    description: 'Generate reports about staff members, qualifications, and assignments'
  },
  {
    id: 'shift_report',
    name: 'Shift Report',
    description: 'Generate reports about shifts, schedules, and attendance'
  },
  {
    id: 'venue_report',
    name: 'Venue Report',
    description: 'Generate reports about venues and their activities'
  },
  {
    id: 'financial_report',
    name: 'Financial Report',
    description: 'Generate reports about payments, invoices, and financial data'
  }
];

const ReportGenerationForm: React.FC<ReportGenerationFormProps> = ({
  onReportGenerated,
  onCancel,
  initialValues,
  reportTypes
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null);
  const [availableReportTypes, setAvailableReportTypes] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [loadingReportTypes, setLoadingReportTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallbackTypes, setUsingFallbackTypes] = useState(false);
  const isLoadingRef = useRef(false);

  // Memoize reportTypes to prevent unnecessary re-renders
  const memoizedReportTypes = useMemo(() => {
    return Array.isArray(reportTypes) && reportTypes.length > 0 ? reportTypes : null;
  }, [reportTypes]);

  // Determine if we should load report types from API
  const shouldLoadFromAPI = useMemo(() => {
    return !memoizedReportTypes || memoizedReportTypes.length === 0;
  }, [memoizedReportTypes]);

  const defaultValues: FormValues = {
    title: '',
    reportType: '',
    format: ExportFormat.CSV,
    parameters: {
      dateRange: {
        startDate: '',
        endDate: ''
      },
      filters: {},
      columns: [],
      groupBy: [],
      orderBy: []
    },
    formatOptions: {},
    schedule: {
      recurring: false
    },
    startDate: '',
    endDate: '',
    ...initialValues
  };

  // Memoized function to load report types from API
  const loadReportTypes = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('Already loading report types, skipping duplicate call');
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoadingReportTypes(true);
      setError(null);
      console.log('Loading report types from API...');

      const response = await reportService.getReportTypes();
      console.log('Raw API response for report types:', response);

      // Handle different response formats defensively
      let types: Array<{ id: string; name: string; description: string }> = [];

      if (Array.isArray(response)) {
        // Direct array response
        types = response;
        console.log('Found direct array response with', types.length, 'report types');
      } else if (response && typeof response === 'object') {
        // Check for common pagination patterns
        if ('results' in response && Array.isArray(response.results)) {
          types = response.results;
          console.log('Found paginated response with', types.length, 'report types');
        } else if ('data' in response && Array.isArray(response.data)) {
          types = response.data;
          console.log('Found data field response with', types.length, 'report types');
        } else {
          console.warn('Unexpected API response format for report types:', response);
          throw new Error('Invalid response format from report types API');
        }
      } else {
        console.warn('API returned unexpected data type:', typeof response);
        throw new Error('API returned invalid data format');
      }

      // Validate that each type has required fields
      const validTypes = types.filter(type => {
        if (!type || typeof type !== 'object') {
          console.warn('Invalid report type found (not an object):', type);
          return false;
        }
        if (!type.id || !type.name) {
          console.warn('Report type missing required fields (id, name):', type);
          return false;
        }
        return true;
      });

      if (validTypes.length === 0) {
        console.warn('No valid report types found in API response');
        setError('No report types are currently available');
        setAvailableReportTypes([]);
      } else {
        console.log(`Successfully loaded ${validTypes.length} valid report types`);
        setAvailableReportTypes(validTypes);
        setError(null);
        setUsingFallbackTypes(false);
      }
    } catch (err) {
      console.error('Failed to load report types:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load available report types';
      console.log('Using fallback report types due to API error');

      // Use fallback types instead of showing error
      setAvailableReportTypes(DEFAULT_REPORT_TYPES);
      setUsingFallbackTypes(true);
      setError(`API unavailable - using default report types. (${errorMessage})`);
    } finally {
      setLoadingReportTypes(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Initialize report types - either from props or API
  useEffect(() => {
    if (memoizedReportTypes && memoizedReportTypes.length > 0) {
      // Use provided report types
      console.log(`Using ${memoizedReportTypes.length} provided report types`);
      setAvailableReportTypes(memoizedReportTypes);
      setLoadingReportTypes(false);
      setError(null);
      setUsingFallbackTypes(false);
    } else if (shouldLoadFromAPI && !isLoadingRef.current) {
      // Load from API only if we haven't already started loading
      loadReportTypes();
    }
  }, [memoizedReportTypes, shouldLoadFromAPI, loadReportTypes]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setIsGenerating(true);
      setError(null);

      // Prepare the request
      const request: ReportGenerationRequest = {
        ...values,
        parameters: {
          ...values.parameters,
          dateRange: values.startDate && values.endDate ? {
            startDate: values.startDate.toISOString(),
            endDate: values.endDate.toISOString()
          } : undefined
        }
      };

      // Remove the form-specific date fields
      delete (request as any).startDate;
      delete (request as any).endDate;

      // Generate the report
      const job = await reportService.generateReport(request);
      setGeneratedJobId(job.id);
      onReportGenerated?.(job.id);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderBasicFields = (formik: FormikProps<FormValues>) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Field
        label="Report Title"
        validationMessage={formik.touched.title ? formik.errors.title : undefined}
        validationState={formik.touched.title && formik.errors.title ? 'error' : 'none'}
        required
      >
        <Input
          value={formik.values.title}
          onChange={(_, data) => formik.setFieldValue('title', data.value)}
          placeholder="Enter a descriptive title for your report"
        />
      </Field>

      <Field
        label="Report Type"
        validationMessage={formik.touched.reportType ? formik.errors.reportType : undefined}
        validationState={formik.touched.reportType && formik.errors.reportType ? 'error' : 'none'}
        required
      >
        {loadingReportTypes ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size="tiny" />
            <Text size="small">Loading report types...</Text>
          </div>
        ) : error && !usingFallbackTypes ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <MessageBar intent="error">
              {error}
            </MessageBar>
            <Button
              appearance="secondary"
              size="small"
              onClick={() => {
                // Reset loading state and retry
                isLoadingRef.current = false;
                loadReportTypes();
              }}
            >
              Retry Loading
            </Button>
          </div>
        ) : !Array.isArray(availableReportTypes) || availableReportTypes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Text size="small" style={{ color: '#666' }}>
              No report types available. Please contact your administrator.
            </Text>
            <Button
              appearance="secondary"
              size="small"
              onClick={() => {
                // Reset and force reload from API
                isLoadingRef.current = false;
                setUsingFallbackTypes(false);
                loadReportTypes();
              }}
            >
              Refresh Page
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {usingFallbackTypes && (
              <MessageBar intent="warning">
                <Text size="small">
                  Using default report types. Some features may be limited until API connection is restored.
                </Text>
              </MessageBar>
            )}
            <Dropdown
              placeholder="Select report type"
              value={formik.values.reportType}
              selectedOptions={formik.values.reportType ? [formik.values.reportType] : []}
              onOptionSelect={(_, data) => formik.setFieldValue('reportType', data.optionValue)}
            >
              {(Array.isArray(availableReportTypes) ? availableReportTypes : [])
                .filter(type => type && typeof type === 'object' && type.id && type.name)
                .map(type => (
                  <Option key={type.id} value={type.id}>
                    <div>
                      <Text weight="semibold">{type.name}</Text>
                      {type.description && (
                        <Text size="small" style={{ display: 'block', color: '#666' }}>
                          {type.description}
                        </Text>
                      )}
                    </div>
                  </Option>
                ))}
            </Dropdown>
          </div>
        )}
      </Field>

      {/* Date Range */}
      <div>
        <Text weight="semibold" style={{ marginBottom: '8px', display: 'block' }}>Date Range</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Start Date">
            <Input
              value={formik.values.startDate}
              onChange={(e) => formik.setFieldValue('startDate', e.target.value)}
              placeholder="Select start date"
            />
          </Field>
          <Field label="End Date">
            <Input
              value={formik.values.endDate}
              onChange={(e) => formik.setFieldValue('endDate', e.target.value)}
              placeholder="Select end date"
            />
          </Field>
        </div>
      </div>
    </div>
  );

  const renderAdvancedOptions = (formik: FormikProps<FormValues>) => (
    <Accordion collapsible>
      <AccordionItem value="filters">
        <AccordionHeader icon={<FilterRegular />} expandIcon={<ChevronDownRegular />}>
          Filters & Columns
        </AccordionHeader>
        <AccordionPanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Column Selection */}
            <Field label="Columns to Include">
              <Textarea
                value={formik.values.parameters.columns?.join(', ') || ''}
                onChange={(_, data) => {
                  const columns = data.value.split(',').map(col => col.trim()).filter(Boolean);
                  formik.setFieldValue('parameters.columns', columns);
                }}
                placeholder="Enter column names separated by commas (e.g., name, date, status)"
                rows={3}
              />
              <Text size="small" style={{ color: '#666', marginTop: '4px' }}>
                Leave empty to include all available columns
              </Text>
            </Field>

            {/* Group By */}
            <Field label="Group By">
              <Input
                value={formik.values.parameters.groupBy?.join(', ') || ''}
                onChange={(_, data) => {
                  const groupBy = data.value.split(',').map(col => col.trim()).filter(Boolean);
                  formik.setFieldValue('parameters.groupBy', groupBy);
                }}
                placeholder="Enter columns to group by (e.g., department, status)"
              />
            </Field>

            {/* Order By */}
            <Field label="Sort By">
              <Input
                value={formik.values.parameters.orderBy?.join(', ') || ''}
                onChange={(_, data) => {
                  const orderBy = data.value.split(',').map(col => col.trim()).filter(Boolean);
                  formik.setFieldValue('parameters.orderBy', orderBy);
                }}
                placeholder="Enter columns to sort by (e.g., date desc, name asc)"
              />
            </Field>
          </div>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem value="scheduling">
        <AccordionHeader icon={<CalendarRegular />} expandIcon={<ChevronDownRegular />}>
          Scheduling Options
        </AccordionHeader>
        <AccordionPanel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field>
              <Checkbox
                label="Schedule recurring generation"
                checked={formik.values.schedule?.recurring || false}
                onChange={(_, data) => formik.setFieldValue('schedule.recurring', data.checked)}
              />
            </Field>

            {formik.values.schedule?.recurring && (
              <>
                <Field label="Frequency">
                  <Dropdown
                    placeholder="Select frequency"
                    value={formik.values.schedule?.frequency || 'weekly'}
                    selectedOptions={[formik.values.schedule?.frequency || 'weekly']}
                    onOptionSelect={(_, data) => formik.setFieldValue('schedule.frequency', data.optionValue)}
                  >
                    <Option value="daily">Daily</Option>
                    <Option value="weekly">Weekly</Option>
                    <Option value="monthly">Monthly</Option>
                  </Dropdown>
                </Field>

                <Field label="Time">
                  <Input
                    type="time"
                    value={formik.values.schedule?.time || '09:00'}
                    onChange={(_, data) => formik.setFieldValue('schedule.time', data.value)}
                  />
                </Field>
              </>
            )}
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );

  if (generatedJobId) {
    return (
      <Card>
        <CardHeader>
          <Title1>Report Generation Started</Title1>
        </CardHeader>
        <div className="p-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Text>Your report is being generated. You can monitor the progress below:</Text>

            <AsyncProgressTracker
              jobId={generatedJobId}
              showCancel={true}
              showRetry={true}
              onComplete={() => {
                // You can add custom completion logic here
                console.log('Report generation completed');
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                appearance="primary" style={{ backgroundColor: "#d13438", borderColor: "#d13438" }}
                onClick={() => {
                  setGeneratedJobId(null);
                  onCancel?.();
                }}
              >
                Generate Another Report
              </Button>
              <Button
                appearance="secondary"
                onClick={onCancel}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Title1>Generate Report</Title1>
      </CardHeader>
      <div className="p-4">
        {error && (
          <MessageBar intent="error" style={{ marginBottom: '16px' }}>
            {error}
          </MessageBar>
        )}

        <Formik
          initialValues={defaultValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {(formik) => (
            <Form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Basic Fields */}
                <Card>
                  <CardHeader>
                    <Title3>Basic Information</Title3>
                  </CardHeader>
                  <div className="p-4">
                    {renderBasicFields(formik)}
                  </div>
                </Card>

                {/* Export Format Selection */}
                <ExportFormatSelector
                  selectedFormat={formik.values.format}
                  onFormatChange={(format) => formik.setFieldValue('format', format)}
                  formatOptions={formik.values.formatOptions}
                  onFormatOptionsChange={(options) => formik.setFieldValue('formatOptions', options)}
                  disabled={isGenerating}
                  reportType={formik.values.reportType}
                />

                {/* Advanced Options */}
                <Card>
                  <CardHeader>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SettingsRegular />
                      <Title3>Advanced Options</Title3>
                    </div>
                  </CardHeader>
                  <div className="p-4">
                    {renderAdvancedOptions(formik)}
                  </div>
                </Card>

                <Divider />

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    appearance="secondary"
                    icon={<DismissRegular />}
                    onClick={onCancel}
                    disabled={isGenerating}
                  >
                    Cancel
                  </Button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      appearance="secondary"
                      icon={<SaveRegular />}
                      disabled={isGenerating}
                      // TODO: Implement save as template
                    >
                      Save as Template
                    </Button>

                    <Button
                      type="submit"
                      appearance="primary" style={{ backgroundColor: "#d13438", borderColor: "#d13438" }}
                      icon={isGenerating ? <Spinner size="tiny" /> : <PlayRegular />}
                      disabled={isGenerating || !formik.isValid}
                    >
                      {isGenerating ? 'Generating...' : 'Generate Report'}
                    </Button>
                  </div>
                </div>

                {/* Form Validation Summary */}
                {formik.submitCount > 0 && !formik.isValid && (
                  <MessageBar intent="error">
                    <Text weight="semibold">Please fix the following errors:</Text>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      {Object.entries(formik.errors).map(([field, error]) => (
                        <li key={field}>{error as string}</li>
                      ))}
                    </ul>
                  </MessageBar>
                )}
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Card>
  );
};

export default ReportGenerationForm;