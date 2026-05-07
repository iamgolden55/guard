import React, { useState, useEffect, useCallback } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import type {
  LeaveType,
  LeaveRequestFormData,
  LeaveRequestFormErrors,
  LeaveBalanceSummary
} from '../types/leave';
import { Container, SpaceBetween, Alert } from './cloudscape';

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
  const [submitSuccess, setSubmitSuccess] = useState<string>('');
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

  // Calculate working days when dates change (client-side calculation)
  const calculateWorkingDays = useCallback((startDate: string, endDate: string) => {
    if (!startDate || !endDate) {
      setWorkingDays(0);
      return;
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        setWorkingDays(0);
        return;
      }

      // Simple calculation: count days excluding weekends
      let days = 0;
      const current = new Date(start);

      while (current <= end) {
        const dayOfWeek = current.getDay();
        // Count Monday (1) through Friday (5)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          days++;
        }
        current.setDate(current.getDate() + 1);
      }

      setWorkingDays(days);
    } catch (error) {
      console.error('Error calculating working days:', error);
      setWorkingDays(0);
    }
  }, []);

  // Validate leave request in real-time
  const validateRequest = useCallback(async (formData: LeaveRequestFormData) => {
    // Skip validation - not implemented in backend yet
    setValidationWarnings([]);
    setBalanceAfter('');
  }, []);

  // Handle leave type selection
  const handleLeaveTypeChange = (leaveTypeId: number, setFieldValue: any) => {
    setFieldValue('leave_type_id', leaveTypeId);
    const balance = balances.find(b => b.leave_type.id === leaveTypeId);
    setSelectedLeaveBalance(balance || null);
  };

  // Handle form submission
  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      // Convert FileList to File array
      const files = values.supporting_documents
        ? Array.from(values.supporting_documents)
        : undefined;

      const requestData: LeaveRequestFormData = {
        leave_type_id: values.leave_type_id,
        start_date: values.start_date,
        end_date: values.end_date,
        days_requested: workingDays,
        reason: values.reason,
        supporting_documents: files
      };

      let result;
      if (editMode && requestId) {
        result = await leaveService.updateLeaveRequest(requestId, requestData);
        setSubmitSuccess('Leave request updated successfully! Your changes have been saved.');
      } else {
        result = await leaveService.createLeaveRequest(requestData);
        setSubmitSuccess('Leave request submitted successfully! You can view it in your leave history.');
      }

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSubmitSuccess('');
      }, 5000);

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

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading leave request form...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <Container>
        <SpaceBetween size="l">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editMode ? 'Edit Leave Request' : 'Request Time Off'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {editMode
                ? 'Update your leave request details below'
                : 'Please fill out the form below to request time off'
              }
            </p>
          </div>

          {submitSuccess && (
            <Alert type="success" dismissible onDismiss={() => setSubmitSuccess('')}>
              {submitSuccess}
            </Alert>
          )}

          {submitError && (
            <Alert type="error" dismissible onDismiss={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}

          {validationWarnings.length > 0 && (
            <Alert type="warning">
              <div>
                <strong>Please note:</strong>
                <ul className="mt-1">
                  {validationWarnings.map((warning, index) => (
                    <li key={index} className="ml-4">- {warning}</li>
                  ))}
                </ul>
              </div>
            </Alert>
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
                  <SpaceBetween size="m">
                    {/* Leave Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Leave Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={values.leave_type_id || ''}
                        onChange={(e) => handleLeaveTypeChange(Number(e.target.value), setFieldValue)}
                        disabled={isSubmitting}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                        aria-label="Select the type of leave you are requesting"
                      >
                        <option value="">Select leave type</option>
                        {(leaveTypes || []).map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name} ({type.code})
                          </option>
                        ))}
                      </select>
                      {touched.leave_type_id && errors.leave_type_id && (
                        <p className="text-red-500 text-xs mt-1">{errors.leave_type_id}</p>
                      )}
                    </div>

                    {/* Current Balance Display */}
                    {selectedLeaveBalance && (
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">
                          Current Balance: {selectedLeaveBalance.leave_type.name}
                        </p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">Available Balance:</span>
                            <span className="text-xs font-medium text-gray-900">
                              {selectedLeaveBalance.available_balance} days
                            </span>
                          </div>
                          {selectedLeaveBalance.pending_balance !== '0' && (
                            <div className="flex justify-between">
                              <span className="text-xs text-orange-600">Pending Requests:</span>
                              <span className="text-xs font-medium text-orange-700">
                                {selectedLeaveBalance.pending_balance} days
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  (parseFloat(selectedLeaveBalance.entitlement.used_to_date) /
                                  parseFloat(selectedLeaveBalance.entitlement.total_entitlement)) * 100,
                                  100
                                )}%`
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedLeaveBalance.entitlement.used_to_date} of {selectedLeaveBalance.entitlement.total_entitlement} days used this year
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Date Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <Field name="start_date">
                          {({ field }: any) => (
                            <input
                              type="date"
                              id="start_date"
                              value={field.value || ''}
                              onChange={(e) => setFieldValue('start_date', e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              disabled={isSubmitting}
                              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              aria-label="Select the start date of your leave"
                            />
                          )}
                        </Field>
                        <ErrorMessage name="start_date" component="div" className="text-red-600 text-xs mt-1" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date <span className="text-red-500">*</span>
                        </label>
                        <Field name="end_date">
                          {({ field }: any) => (
                            <input
                              type="date"
                              id="end_date"
                              value={field.value || ''}
                              onChange={(e) => setFieldValue('end_date', e.target.value)}
                              min={values.start_date || new Date().toISOString().split('T')[0]}
                              disabled={isSubmitting}
                              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              aria-label="Select the end date of your leave"
                            />
                          )}
                        </Field>
                        <ErrorMessage name="end_date" component="div" className="text-red-600 text-xs mt-1" />
                      </div>
                    </div>

                    {/* Working Days Display */}
                    {workingDays > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium">Working Days: {workingDays}</span>
                          {balanceAfter && (
                            <span className="text-xs text-gray-600">(Balance after: {balanceAfter} days)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for Leave <span className="text-red-500">*</span>
                      </label>
                      <Field name="reason">
                        {({ field, meta }: any) => (
                          <div>
                            <textarea
                              id="reason"
                              rows={4}
                              {...field}
                              placeholder="Please provide a detailed reason for your leave request..."
                              disabled={isSubmitting}
                              maxLength={500}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                              aria-label="Provide a detailed reason for your leave request"
                            />
                            <div className="flex justify-between mt-1">
                              {meta.touched && meta.error && (
                                <p className="text-red-500 text-xs">{meta.error}</p>
                              )}
                              <p className="text-xs text-gray-500 ml-auto">{field.value?.length || 0}/500 characters</p>
                            </div>
                          </div>
                        )}
                      </Field>
                    </div>

                    {/* Supporting Documents */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Supporting Documents (Optional)
                      </label>
                      <input
                        id="supporting_documents"
                        name="supporting_documents"
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          setFieldValue('supporting_documents', event.currentTarget.files);
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                        disabled={isSubmitting}
                        aria-describedby="file-help"
                      />
                      <p id="file-help" className="text-xs text-gray-500 mt-1">
                        You can upload multiple files (PDF, Word documents, or images). Maximum 10MB per file.
                      </p>
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        aria-label={editMode ? 'Update leave request' : 'Submit leave request'}
                      >
                        {isSubmitting
                          ? (editMode ? 'Updating...' : 'Submitting...')
                          : (editMode ? 'Update Request' : 'Submit Request')
                        }
                      </button>
                      {onCancel && (
                        <button
                          type="button"
                          onClick={onCancel}
                          disabled={isSubmitting}
                          className="flex-1 px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          aria-label="Cancel and close form"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </SpaceBetween>
                </Form>
              );
            }}
          </Formik>
        </SpaceBetween>
      </Container>
    </div>
  );
};

export default LeaveRequestForm;
