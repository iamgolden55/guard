import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Input,
  Select,
  Field,
  MessageBar,
  Spinner,
  Card,
  CardHeader,
  CardPreview,
  Text,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Divider
} from '@fluentui/react-components';
import {
  CheckmarkCircle24Regular,
  Warning24Regular,
  Dismiss24Regular,
  CalendarLtr24Regular,
  Clock24Regular,
  Person24Regular,
  Building24Regular,
  ErrorCircle24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { ScheduleValidation } from '../../types/compliance';
import { format, parseISO } from 'date-fns';

interface ComplianceValidationPanelProps {
  onClose: () => void;
}

const validationSchema = Yup.object({
  user_id: Yup.number()
    .required('Staff member is required'),
  shifts: Yup.array()
    .of(
      Yup.object({
        start_time: Yup.string().required('Start time is required'),
        end_time: Yup.string().required('End time is required'),
        venue_id: Yup.number().optional(),
      })
    )
    .min(1, 'At least one shift is required'),
  region_code: Yup.string().optional(),
});

const ComplianceValidationPanel: React.FC<ComplianceValidationPanelProps> = ({
  onClose,
}) => {
  const [validationResult, setValidationResult] = useState<ScheduleValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch staff members (mock data - would come from staff API)
  const { data: staffMembers } = useQuery({
    queryKey: ['staff-members'],
    queryFn: async () => {
      // Mock data - in real app this would fetch from staff API
      return [
        { id: 1, name: 'John Doe', email: 'john.doe@company.com' },
        { id: 2, name: 'Jane Smith', email: 'jane.smith@company.com' },
        { id: 3, name: 'Mike Johnson', email: 'mike.johnson@company.com' },
      ];
    },
    refetchOnWindowFocus: false,
  });

  // Fetch venues (mock data - would come from venues API)
  const { data: venues } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      // Mock data - in real app this would fetch from venues API
      return [
        { id: 1, name: 'Main Office Building' },
        { id: 2, name: 'Warehouse District' },
        { id: 3, name: 'Shopping Center' },
      ];
    },
    refetchOnWindowFocus: false,
  });

  // Validate schedule mutation
  const validateMutation = useMutation({
    mutationFn: (data: any) => ComplianceService.validateScheduleAgainstRegion(data),
    onSuccess: (response) => {
      setValidationResult(response.data);
      setError(null);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to validate schedule');
      setValidationResult(null);
    },
  });

  const formik = useFormik({
    initialValues: {
      user_id: 0,
      region_code: '',
      shifts: [
        {
          start_time: '',
          end_time: '',
          venue_id: undefined,
        },
      ],
    },
    validationSchema,
    onSubmit: (values) => {
      setError(null);
      setValidationResult(null);

      const scheduleData = {
        user_id: values.user_id,
        region_code: values.region_code || undefined,
        shifts: values.shifts.filter(shift => shift.start_time && shift.end_time),
      };

      validateMutation.mutate(scheduleData);
    },
  });

  const addShift = () => {
    formik.setFieldValue('shifts', [
      ...formik.values.shifts,
      { start_time: '', end_time: '', venue_id: undefined },
    ]);
  };

  const removeShift = (index: number) => {
    const newShifts = formik.values.shifts.filter((_, i) => i !== index);
    formik.setFieldValue('shifts', newShifts);
  };

  const getSeverityIcon = (severity: 'minor' | 'major' | 'critical') => {
    switch (severity) {
      case 'critical':
        return <ErrorCircle24Regular className="text-red-600" />;
      case 'major':
        return <Warning24Regular className="text-orange-600" />;
      case 'minor':
        return <Warning24Regular className="text-yellow-600" />;
      default:
        return <Warning24Regular className="text-gray-600" />;
    }
  };

  const getSeverityBadge = (severity: 'minor' | 'major' | 'critical') => {
    const severityConfig = {
      minor: { color: 'warning', text: 'Minor' },
      major: { color: 'important', text: 'Major' },
      critical: { color: 'danger', text: 'Critical' }
    };

    const config = severityConfig[severity];

    return (
      <Badge appearance="filled" color={config.color as any}>
        {config.text}
      </Badge>
    );
  };

  const calculateTotalHours = () => {
    let totalHours = 0;
    formik.values.shifts.forEach(shift => {
      if (shift.start_time && shift.end_time) {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        if (hours > 0) totalHours += hours;
      }
    });
    return totalHours;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text size={600} weight="semibold">Schedule Compliance Validation</Text>
          <Text size={400} className="text-gray-600 mt-1">
            Validate a schedule against regional working hours regulations
          </Text>
        </div>
        <Button
          appearance="subtle"
          icon={<Dismiss24Regular />}
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      {error && (
        <MessageBar intent="error" onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Input Form */}
        <Card>
          <CardHeader
            header={
              <div className="flex items-center gap-2">
                <CalendarLtr24Regular className="text-blue-600" />
                <Text size={500} weight="semibold">Schedule Input</Text>
              </div>
            }
          />

          <CardPreview>
            <form onSubmit={formik.handleSubmit} className="p-4 space-y-4">
              {/* Staff Selection */}
              <Field
                label="Staff Member"
                required
                validationMessage={formik.touched.user_id && formik.errors.user_id}
                validationState={formik.touched.user_id && formik.errors.user_id ? 'error' : 'none'}
              >
                <Select
                  value={formik.values.user_id.toString()}
                  onSelectionChange={(_, data) => formik.setFieldValue('user_id', parseInt(data.value))}
                >
                  <option value="0">Select a staff member...</option>
                  {staffMembers?.map((staff) => (
                    <option key={staff.id} value={staff.id.toString()}>
                      {staff.name} ({staff.email})
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Region Code (Optional) */}
              <Field
                label="Region (Optional)"
                hint="Leave blank to use auto-detection"
              >
                <Select
                  value={formik.values.region_code}
                  onSelectionChange={(_, data) => formik.setFieldValue('region_code', data.value)}
                >
                  <option value="">Auto-detect region</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="US">United States (US)</option>
                  <option value="DE">Germany (DE)</option>
                  <option value="FR">France (FR)</option>
                </Select>
              </Field>

              {/* Shifts */}
              <div>
                <Text size={500} weight="semibold" className="mb-3 block">
                  Shifts ({formik.values.shifts.length})
                </Text>

                {formik.values.shifts.map((shift, index) => (
                  <Card key={index} className="mb-3">
                    <div className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Text size={400} weight="semibold">Shift {index + 1}</Text>
                        {formik.values.shifts.length > 1 && (
                          <Button
                            appearance="subtle"
                            size="small"
                            onClick={() => removeShift(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Start Time" required>
                          <Input
                            type="datetime-local"
                            value={formik.values.shifts[index].start_time}
                            onChange={(_, data) =>
                              formik.setFieldValue(`shifts.${index}.start_time`, data.value)
                            }
                          />
                        </Field>

                        <Field label="End Time" required>
                          <Input
                            type="datetime-local"
                            value={formik.values.shifts[index].end_time}
                            onChange={(_, data) =>
                              formik.setFieldValue(`shifts.${index}.end_time`, data.value)
                            }
                          />
                        </Field>
                      </div>

                      <Field label="Venue (Optional)">
                        <Select
                          value={formik.values.shifts[index].venue_id?.toString() || ''}
                          onSelectionChange={(_, data) =>
                            formik.setFieldValue(
                              `shifts.${index}.venue_id`,
                              data.value ? parseInt(data.value) : undefined
                            )
                          }
                        >
                          <option value="">No specific venue</option>
                          {venues?.map((venue) => (
                            <option key={venue.id} value={venue.id.toString()}>
                              {venue.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </Card>
                ))}

                <Button
                  appearance="subtle"
                  onClick={addShift}
                  className="w-full"
                >
                  + Add Shift
                </Button>
              </div>

              {/* Schedule Summary */}
              <Card className="bg-gray-50">
                <div className="p-3">
                  <Text size={400} weight="semibold" className="mb-2 block">
                    Schedule Summary
                  </Text>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Total Shifts:</span>
                      <span className="ml-2 font-medium">
                        {formik.values.shifts.filter(s => s.start_time && s.end_time).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Hours:</span>
                      <span className="ml-2 font-medium">
                        {calculateTotalHours().toFixed(1)}h
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Submit Button */}
              <Button
                appearance="primary"
                type="submit"
                disabled={validateMutation.isPending || !formik.isValid}
                icon={validateMutation.isPending ? <Spinner size="tiny" /> : <CheckmarkCircle24Regular />}
                className="w-full"
              >
                {validateMutation.isPending ? 'Validating...' : 'Validate Schedule'}
              </Button>
            </form>
          </CardPreview>
        </Card>

        {/* Validation Results */}
        <div className="space-y-4">
          {validationResult ? (
            <>
              {/* Compliance Status */}
              <Card>
                <CardHeader
                  header={
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {validationResult.compliant ? (
                          <CheckmarkCircle24Regular className="text-green-600" />
                        ) : (
                          <Warning24Regular className="text-red-600" />
                        )}
                        <Text size={500} weight="semibold">
                          {validationResult.compliant ? 'Compliant' : 'Non-Compliant'}
                        </Text>
                      </div>
                      <Badge
                        appearance="filled"
                        color={validationResult.compliant ? 'success' : 'danger'}
                      >
                        {validationResult.region_used}
                      </Badge>
                    </div>
                  }
                />

                <CardPreview>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Total Hours:</span>
                        <span className="ml-2 font-medium">{validationResult.summary.total_hours}h</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Overtime Hours:</span>
                        <span className="ml-2 font-medium">{validationResult.summary.overtime_hours}h</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Rest Violations:</span>
                        <span className="ml-2 font-medium">{validationResult.summary.rest_violations}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Break Violations:</span>
                        <span className="ml-2 font-medium">{validationResult.summary.break_violations}</span>
                      </div>
                    </div>
                  </div>
                </CardPreview>
              </Card>

              {/* Violations */}
              {validationResult.violations.length > 0 && (
                <Card>
                  <CardHeader
                    header={
                      <div className="flex items-center gap-2">
                        <ErrorCircle24Regular className="text-red-600" />
                        <Text size={500} weight="semibold">
                          Violations ({validationResult.violations.length})
                        </Text>
                      </div>
                    }
                  />

                  <CardPreview>
                    <div className="p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell>Severity</TableHeaderCell>
                            <TableHeaderCell>Type</TableHeaderCell>
                            <TableHeaderCell>Description</TableHeaderCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.violations.map((violation, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getSeverityIcon(violation.severity)}
                                  {getSeverityBadge(violation.severity)}
                                </div>
                              </TableCell>
                              <TableCell>{violation.type}</TableCell>
                              <TableCell>{violation.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardPreview>
                </Card>
              )}

              {/* Warnings & Recommendations */}
              {validationResult.warnings.length > 0 && (
                <Card>
                  <CardHeader
                    header={
                      <div className="flex items-center gap-2">
                        <Warning24Regular className="text-orange-600" />
                        <Text size={500} weight="semibold">
                          Warnings & Recommendations
                        </Text>
                      </div>
                    }
                  />

                  <CardPreview>
                    <div className="p-4 space-y-3">
                      {validationResult.warnings.map((warning, index) => (
                        <div key={index} className="border-l-4 border-orange-400 pl-4">
                          <Text size={400} weight="semibold" className="text-orange-800">
                            {warning.type}
                          </Text>
                          <Text size={300} className="text-gray-600 block">
                            {warning.message}
                          </Text>
                          <Text size={300} className="text-blue-600 block mt-1">
                            Recommendation: {warning.recommendation}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </CardPreview>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardPreview>
                <div className="p-8 text-center text-gray-500">
                  <Clock24Regular className="mx-auto mb-4 text-4xl" />
                  <Text size={500}>No validation results yet</Text>
                  <Text size={400} className="mt-2">
                    Fill out the schedule form and click validate to see compliance results
                  </Text>
                </div>
              </CardPreview>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceValidationPanel;