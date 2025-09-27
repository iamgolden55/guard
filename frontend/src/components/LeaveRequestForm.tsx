import React, { useState, useEffect, useCallback } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import {
  PrimaryButton,
  DefaultButton,
  TextField,
  Dropdown,
  IDropdownOption,
  DatePicker,
  Text,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Icon,
  Stack,
  Label,
  ProgressIndicator
} from '@fluentui/react';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import type {
  LeaveType,
  LeaveRequestFormData,
  LeaveRequestFormErrors,
  LeaveBalanceSummary
} from '../types/leave';

interface LeaveRequestFormProps {
  onSuccess?: (request: any) => void;
  onCancel?: () => void;
  initialData?: Partial<LeaveRequestFormData>;
  editMode?: boolean;
  requestId?: number;
  className?: string;
}

interface FormValues extends LeaveRequestFormData {
  supporting_documents: FileList | null;
}

// Validation schema
const validationSchema = Yup.object({
  leave_type_id: Yup.number()
    .required('Please select a leave type')
    .min(1, 'Please select a valid leave type'),
  start_date: Yup.date()
    .required('Start date is required')
    .min(new Date(), 'Start date cannot be in the past'),
  end_date: Yup.date()
    .required('End date is required')
    .min(Yup.ref('start_date'), 'End date must be after start date'),
  reason: Yup.string()
    .required('Please provide a reason for your leave request')
    .min(10, 'Please provide a more detailed reason (at least 10 characters)')
    .max(500, 'Reason cannot exceed 500 characters'),
});

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
  onSuccess,
  onCancel,
  initialData,
  editMode = false,
  requestId,
  className = ''
}) => {
  const { authState } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceSummary[]>([]);
  const [selectedLeaveBalance, setSelectedLeaveBalance] = useState<LeaveBalanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<number>(0);
  const [balanceAfter, setBalanceAfter] = useState<string>('');

  // Initial form values
  const initialValues: FormValues = {
    leave_type_id: initialData?.leave_type_id || 0,
    start_date: initialData?.start_date || '',
    end_date: initialData?.end_date || '',
    reason: initialData?.reason || '',
    supporting_documents: null
  };

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        // Load leave types and balances in parallel
        const [typesResult, balancesResult] = await Promise.all([
          leaveService.getLeaveTypes(true),
          leaveService.getMyBalances()
        ]);

        console.log('Leave types result:', typesResult, Array.isArray(typesResult));
        console.log('Balances result:', balancesResult);

        setLeaveTypes(Array.isArray(typesResult) ? typesResult : []);
        setBalances(balancesResult?.balances || []);

        // If editing, select the appropriate balance
        if (editMode && initialData?.leave_type_id && balancesResult?.balances) {
          const balance = balancesResult.balances.find(
            b => b.leave_type.id === initialData.leave_type_id
          );
          setSelectedLeaveBalance(balance || null);
        }

      } catch (error) {
        console.error('Error loading initial data:', error);
        setSubmitError('Failed to load leave types and balances. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [editMode, initialData?.leave_type_id]);

  // Calculate working days when dates change
  const calculateWorkingDays = useCallback(async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) {
      setWorkingDays(0);
      return;
    }

    try {
      const result = await leaveService.calculateWorkingDays(startDate, endDate);
      setWorkingDays(result.working_days);
    } catch (error) {
      console.error('Error calculating working days:', error);
      setWorkingDays(0);
    }
  }, []);

  // Validate leave request in real-time
  const validateRequest = useCallback(async (formData: LeaveRequestFormData) => {
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setValidationWarnings([]);
      setBalanceAfter('');
      return;
    }

    try {
      const validation = await leaveService.validateLeaveRequest(formData);
      setValidationWarnings(validation.warnings);
      setBalanceAfter(validation.balance_after);
    } catch (error) {
      console.error('Error validating request:', error);
      setValidationWarnings([]);
      setBalanceAfter('');
    }
  }, []);

  // Handle leave type selection
  const handleLeaveTypeChange = (option: IDropdownOption | undefined, setFieldValue: any) => {
    if (option) {
      const leaveTypeId = option.key as number;
      setFieldValue('leave_type_id', leaveTypeId);

      // Find and set the corresponding balance
      const balance = balances.find(b => b.leave_type.id === leaveTypeId);
      setSelectedLeaveBalance(balance || null);
    }
  };

  // Handle form submission
  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Convert FileList to File array
      const files = values.supporting_documents
        ? Array.from(values.supporting_documents)
        : undefined;

      const requestData: LeaveRequestFormData = {
        leave_type_id: values.leave_type_id,
        start_date: values.start_date,
        end_date: values.end_date,
        reason: values.reason,
        supporting_documents: files
      };

      let result;
      if (editMode && requestId) {
        result = await leaveService.updateLeaveRequest(requestId, requestData);
      } else {
        result = await leaveService.createLeaveRequest(requestData);
      }

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error: any) {
      console.error('Error submitting leave request:', error);

      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') {
          setSubmitError(errorData);
        } else if (errorData.non_field_errors) {
          setSubmitError(errorData.non_field_errors.join(', '));
        } else {
          setSubmitError('Please correct the errors below and try again.');
        }
      } else {
        setSubmitError('Failed to submit leave request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prepare dropdown options
  const leaveTypeOptions: IDropdownOption[] = (leaveTypes || []).map(type => ({
    key: type.id,
    text: `${type.name} (${type.code})`,
    data: type
  }));

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Spinner size={SpinnerSize.large} label="Loading leave request form..." />
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md ${className}`}>
      <div className="mb-6">
        <Text variant="xLarge" className="font-semibold text-gray-900">
          {editMode ? 'Edit Leave Request' : 'Request Time Off'}
        </Text>
        <Text variant="medium" className="text-gray-600 mt-1">
          {editMode
            ? 'Update your leave request details below'
            : 'Please fill out the form below to request time off'
          }
        </Text>
      </div>

      {submitError && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline
          className="mb-4"
        >
          {submitError}
        </MessageBar>
      )}

      {validationWarnings.length > 0 && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          isMultiline
          className="mb-4"
        >
          <div>
            <strong>Please note:</strong>
            <ul className="mt-1">
              {validationWarnings.map((warning, index) => (
                <li key={index} className="ml-4">• {warning}</li>
              ))}
            </ul>
          </div>
        </MessageBar>
      )}

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, setFieldValue, errors, touched }) => {
          // Watch for date changes to calculate working days
          React.useEffect(() => {
            if (values.start_date && values.end_date) {
              calculateWorkingDays(values.start_date, values.end_date);
              validateRequest(values);
            }
          }, [values.start_date, values.end_date, values.leave_type_id]);

          return (
            <Form>
              <Stack tokens={{ childrenGap: 20 }}>
                {/* Leave Type Selection */}
                <div>
                  <Label required htmlFor="leave_type_id">
                    Leave Type
                  </Label>
                  <Dropdown
                    id="leave_type_id"
                    placeholder="Select leave type"
                    options={leaveTypeOptions}
                    selectedKey={values.leave_type_id || undefined}
                    onChange={(_, option) => handleLeaveTypeChange(option, setFieldValue)}
                    errorMessage={touched.leave_type_id && errors.leave_type_id ? errors.leave_type_id : undefined}
                    required
                    disabled={isSubmitting}
                    ariaLabel="Select the type of leave you are requesting"
                  />
                </div>

                {/* Current Balance Display */}
                {selectedLeaveBalance && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Text variant="medium" className="font-semibold text-blue-900">
                      Current Balance: {selectedLeaveBalance.leave_type.name}
                    </Text>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <Text variant="small" className="text-blue-800">Available Balance:</Text>
                        <Text variant="small" className="font-medium text-blue-900">
                          {selectedLeaveBalance.available_balance} days
                        </Text>
                      </div>
                      {selectedLeaveBalance.pending_balance !== '0' && (
                        <div className="flex justify-between">
                          <Text variant="small" className="text-orange-600">Pending Requests:</Text>
                          <Text variant="small" className="font-medium text-orange-700">
                            {selectedLeaveBalance.pending_balance} days
                          </Text>
                        </div>
                      )}
                    </div>
                    <ProgressIndicator
                      percentComplete={
                        parseFloat(selectedLeaveBalance.entitlement.used_to_date) /
                        parseFloat(selectedLeaveBalance.entitlement.total_entitlement)
                      }
                      className="mt-2"
                      description={`${selectedLeaveBalance.entitlement.used_to_date} of ${selectedLeaveBalance.entitlement.total_entitlement} days used this year`}
                    />
                  </div>
                )}

                {/* Date Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label required htmlFor="start_date">
                      Start Date
                    </Label>
                    <Field name="start_date">
                      {({ field, meta }: any) => (
                        <DatePicker
                          id="start_date"
                          value={field.value ? new Date(field.value) : undefined}
                          onSelectDate={(date) => {
                            setFieldValue('start_date', date ? date.toISOString().split('T')[0] : '');
                          }}
                          placeholder="Select start date"
                          isRequired
                          disabled={isSubmitting}
                          minDate={new Date()}
                          ariaLabel="Select the start date of your leave"
                        />
                      )}
                    </Field>
                    <ErrorMessage name="start_date" component="div" className="text-red-600 text-sm mt-1" />
                  </div>

                  <div>
                    <Label required htmlFor="end_date">
                      End Date
                    </Label>
                    <Field name="end_date">
                      {({ field, meta }: any) => (
                        <DatePicker
                          id="end_date"
                          value={field.value ? new Date(field.value) : undefined}
                          onSelectDate={(date) => {
                            setFieldValue('end_date', date ? date.toISOString().split('T')[0] : '');
                          }}
                          placeholder="Select end date"
                          isRequired
                          disabled={isSubmitting}
                          minDate={values.start_date ? new Date(values.start_date) : new Date()}
                          ariaLabel="Select the end date of your leave"
                        />
                      )}
                    </Field>
                    <ErrorMessage name="end_date" component="div" className="text-red-600 text-sm mt-1" />
                  </div>
                </div>

                {/* Working Days Display */}
                {workingDays > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon iconName="Calendar" className="text-gray-600" />
                      <Text variant="medium" className="font-medium">
                        Working Days: {workingDays}
                      </Text>
                      {balanceAfter && (
                        <Text variant="small" className="text-gray-600">
                          (Balance after: {balanceAfter} days)
                        </Text>
                      )}
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <Label required htmlFor="reason">
                    Reason for Leave
                  </Label>
                  <Field name="reason">
                    {({ field, meta }: any) => (
                      <TextField
                        id="reason"
                        multiline
                        rows={4}
                        {...field}
                        placeholder="Please provide a detailed reason for your leave request..."
                        required
                        disabled={isSubmitting}
                        errorMessage={meta.touched && meta.error ? meta.error : undefined}
                        maxLength={500}
                        description={`${field.value?.length || 0}/500 characters`}
                        ariaLabel="Provide a detailed reason for your leave request"
                      />
                    )}
                  </Field>
                </div>

                {/* Supporting Documents */}
                <div>
                  <Label htmlFor="supporting_documents">
                    Supporting Documents (Optional)
                  </Label>
                  <input
                    id="supporting_documents"
                    name="supporting_documents"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(event) => {
                      setFieldValue('supporting_documents', event.currentTarget.files);
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    disabled={isSubmitting}
                    aria-describedby="file-help"
                  />
                  <Text variant="small" id="file-help" className="text-gray-600 mt-1">
                    You can upload multiple files (PDF, Word documents, or images). Maximum 10MB per file.
                  </Text>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <PrimaryButton
                    type="submit"
                    disabled={isSubmitting}
                    text={isSubmitting
                      ? (editMode ? 'Updating...' : 'Submitting...')
                      : (editMode ? 'Update Request' : 'Submit Request')
                    }
                    iconProps={isSubmitting ? { iconName: 'Clock' } : { iconName: 'Send' }}
                    className="flex-1"
                    ariaLabel={editMode ? 'Update leave request' : 'Submit leave request'}
                  />
                  <DefaultButton
                    text="Cancel"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    iconProps={{ iconName: 'Cancel' }}
                    className="flex-1"
                    ariaLabel="Cancel and close form"
                  />
                </div>
              </Stack>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default LeaveRequestForm;