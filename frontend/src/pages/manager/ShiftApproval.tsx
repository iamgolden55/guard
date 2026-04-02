import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Header,
  Container,
  CloudscapeTable,
  StatusIndicator,
  EmptyState,
  ConfirmationModal,
  SpaceBetween,
  KeyValuePairs,
  Alert,
  ColumnLayout,
} from '../../components/cloudscape';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { SignatureCanvas } from '../../components';
import { shiftService } from '../../services';
import type {
  Shift,
  FireExitCheck,
  CapacityCheck,
  ToiletCheck,
  EnforcementVisit
} from '../../types';

const ShiftApproval: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const shiftId = Number(id);

  // Check if we're being asked to reject rather than approve
  const isRejectMode = searchParams.get('reject') === 'true';

  const [shift, setShift] = useState<Shift | null>(null);
  const [fireExitChecks, setFireExitChecks] = useState<FireExitCheck[]>([]);
  const [capacityChecks, setCapacityChecks] = useState<CapacityCheck[]>([]);
  const [toiletChecks, setToiletChecks] = useState<ToiletCheck[]>([]);
  const [enforcementVisits, setEnforcementVisits] = useState<EnforcementVisit[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load shift details and all checks on mount
  useEffect(() => {
    const loadShiftData = async () => {
      try {
        setIsLoading(true);

        if (Number.isNaN(shiftId)) {
          setError('Invalid shift ID');
          return;
        }

        // Load shift details
        const shiftData = await shiftService.getShiftById(shiftId);
        setShift(shiftData);

        // Check if shift is completed and not approved yet
        if (shiftData.status !== 'completed') {
          setError('This shift is not ready for approval. Only completed shifts can be approved.');
          return;
        }

        if (shiftData.managerApproved) {
          setError('This shift has already been approved.');
          return;
        }

        // Load all checks and logs
        const [fireExits, capacity, toilets, enforcement] = await Promise.all([
          shiftService.getFireExitChecks(shiftId),
          shiftService.getCapacityChecks(shiftId),
          shiftService.getToiletChecks(shiftId),
          shiftService.getEnforcementVisits(shiftId)
        ]);

        setFireExitChecks(fireExits);
        setCapacityChecks(capacity);
        setToiletChecks(toilets);
        setEnforcementVisits(enforcement);
      } catch (error) {
        console.error('Failed to load shift data:', error);
        setError('Failed to load shift data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadShiftData();
  }, [shiftId]);

  // Form validation schema
  const approvalSchema = Yup.object({
    notes: Yup.string().test(
      'required-if-rejected',
      'Notes are required when rejecting a shift',
      function(value) {
        return this.parent.approved || !!value;
      }
    ),
    approved: Yup.boolean().required()
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      notes: '',
      approved: !isRejectMode // Default based on mode
    },
    validationSchema: approvalSchema,
    onSubmit: async (values) => {
      try {
        if (!signature) {
          setError('Your signature is required to approve or reject this shift.');
          return;
        }

        setShowConfirmDialog(true);
      } catch (error) {
        console.error('Form submission error:', error);
        setError('An error occurred while processing your request.');
      }
    }
  });

  // Handle signature save
  const handleSignatureSave = (signatureDataUrl: string) => {
    setSignature(signatureDataUrl);
    setError(null);
  };

  // Handle confirm approval/rejection
  const handleConfirm = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!signature) {
        setError('Your signature is required');
        setIsSaving(false);
        return;
      }

      // Submit manager approval/rejection
      await shiftService.managerApproval(shiftId, {
        approved: formik.values.approved,
        managerSignature: signature,
        managerNotes: formik.values.notes
      });

      // Close dialog and navigate back to approvals
      setShowConfirmDialog(false);
      navigate('/approvals');
    } catch (error) {
      console.error('Failed to process approval:', error);
      setError('Failed to process approval. Please try again.');
      setShowConfirmDialog(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate shift duration
  const calculateDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 'N/A';

    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  // Column definitions for fire exit checks
  const fireExitColumnDefs: ColumnDefinition<FireExitCheck>[] = [
    {
      id: 'timestamp',
      header: 'Time',
      cell: (item: FireExitCheck) => formatTime(item.timestamp),
      minWidth: 100,
    },
    {
      id: 'exitName',
      header: 'Exit Location',
      cell: (item: FireExitCheck) => item.exitName,
      minWidth: 150,
    },
    {
      id: 'isPassed',
      header: 'Status',
      cell: (item: FireExitCheck) => (
        <StatusIndicator type={item.isPassed ? 'success' : 'error'}>
          {item.isPassed ? 'PASS' : 'FAIL'}
        </StatusIndicator>
      ),
      minWidth: 100,
    },
    {
      id: 'comments',
      header: 'Comments',
      cell: (item: FireExitCheck) => item.comments || '-',
      minWidth: 200,
    },
  ];

  // Column definitions for capacity checks
  const capacityColumnDefs: ColumnDefinition<CapacityCheck>[] = [
    {
      id: 'timestamp',
      header: 'Time',
      cell: (item: CapacityCheck) => formatTime(item.timestamp),
      minWidth: 100,
    },
    {
      id: 'count',
      header: 'Count',
      cell: (item: CapacityCheck) => String(item.count),
      minWidth: 80,
    },
    {
      id: 'comments',
      header: 'Comments',
      cell: (item: CapacityCheck) => item.comments || '-',
      minWidth: 250,
    },
  ];

  // Column definitions for toilet checks
  const toiletColumnDefs: ColumnDefinition<ToiletCheck>[] = [
    {
      id: 'timestamp',
      header: 'Time',
      cell: (item: ToiletCheck) => formatTime(item.timestamp),
      minWidth: 100,
    },
    {
      id: 'location',
      header: 'Location',
      cell: (item: ToiletCheck) => item.location,
      minWidth: 150,
    },
    {
      id: 'condition',
      header: 'Condition',
      cell: (item: ToiletCheck) => {
        const type =
          item.condition === 'excellent' || item.condition === 'good' ? 'success' as const :
          item.condition === 'fair' ? 'warning' as const : 'error' as const;
        return (
          <StatusIndicator type={type}>
            <span className="capitalize">{item.condition}</span>
          </StatusIndicator>
        );
      },
      minWidth: 120,
    },
    {
      id: 'comments',
      header: 'Comments',
      cell: (item: ToiletCheck) => item.comments || '-',
      minWidth: 200,
    },
  ];

  // Column definitions for enforcement visits
  const enforcementColumnDefs: ColumnDefinition<EnforcementVisit>[] = [
    {
      id: 'timestamp',
      header: 'Time',
      cell: (item: EnforcementVisit) => formatTime(item.timestamp),
      minWidth: 100,
    },
    {
      id: 'officerName',
      header: 'Officer Name',
      cell: (item: EnforcementVisit) => item.officerName,
      minWidth: 150,
    },
    {
      id: 'officerBadge',
      header: 'Badge #',
      cell: (item: EnforcementVisit) => item.officerBadge,
      minWidth: 100,
    },
    {
      id: 'reasonForVisit',
      header: 'Reason',
      cell: (item: EnforcementVisit) => item.reasonForVisit,
      minWidth: 200,
    },
    {
      id: 'outcome',
      header: 'Outcome',
      cell: (item: EnforcementVisit) => item.outcome,
      minWidth: 200,
    },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description={shift ? `Shift #${shift.id} at ${shift.venue.name}` : undefined}
      >
        {formik.values.approved ? 'Approve Shift' : 'Reject Shift'}
      </Header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-sm text-gray-500">Loading shift details...</span>
        </div>
      ) : error && !shift ? (
        <Alert
          type="error"
          action={
            <button
              onClick={() => navigate('/approvals')}
              className="text-sm text-red-700 hover:text-red-800 underline font-medium"
            >
              Return to Approvals
            </button>
          }
        >
          {error}
        </Alert>
      ) : shift ? (
        <form onSubmit={formik.handleSubmit}>
          <SpaceBetween size="l">
            {/* Error message */}
            {error && (
              <Alert type="error" dismissible onDismiss={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Shift Summary */}
            <Container header={<Header variant="h2">Shift Summary</Header>}>
              <ColumnLayout columns={2}>
                <KeyValuePairs
                  items={[
                    { label: 'Staff ID', value: String(shift.staffUser) },
                    { label: 'Venue', value: shift.venue.name },
                    { label: 'Shift Date', value: formatDate(shift.startTime) },
                    { label: 'Start Time', value: formatTime(shift.startTime) },
                    { label: 'End Time', value: shift.endTime ? formatTime(shift.endTime) : 'N/A' },
                    { label: 'Duration', value: calculateDuration(shift.startTime, shift.endTime) },
                  ]}
                  columns={2}
                />

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Start Signature</h4>
                    {shift.startSignature ? (
                      <img
                        src={shift.startSignature}
                        alt="Start Signature"
                        className="max-w-full max-h-[100px] border border-gray-200 rounded-lg p-1"
                      />
                    ) : (
                      <StatusIndicator type="error">Missing signature</StatusIndicator>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">End Signature</h4>
                    {shift.endSignature ? (
                      <img
                        src={shift.endSignature}
                        alt="End Signature"
                        className="max-w-full max-h-[100px] border border-gray-200 rounded-lg p-1"
                      />
                    ) : (
                      <StatusIndicator type="error">Missing signature</StatusIndicator>
                    )}
                  </div>
                </div>
              </ColumnLayout>
            </Container>

            {/* Fire Exit Checks */}
            <Container header={<Header variant="h2" counter={String(fireExitChecks.length)}>Fire Exit Checks</Header>}>
              {fireExitChecks.length > 0 ? (
                <CloudscapeTable<FireExitCheck>
                  items={fireExitChecks}
                  columnDefinitions={fireExitColumnDefs}
                  variant="embedded"
                  trackBy="id"
                  wrapLines
                />
              ) : (
                <p className="text-sm text-gray-500 italic">No fire exit checks recorded</p>
              )}
            </Container>

            {/* Capacity Checks */}
            <Container header={<Header variant="h2" counter={String(capacityChecks.length)}>Capacity Checks</Header>}>
              {capacityChecks.length > 0 ? (
                <CloudscapeTable<CapacityCheck>
                  items={capacityChecks}
                  columnDefinitions={capacityColumnDefs}
                  variant="embedded"
                  trackBy="id"
                  wrapLines
                />
              ) : (
                <p className="text-sm text-gray-500 italic">No capacity checks recorded</p>
              )}
            </Container>

            {/* Toilet Checks */}
            <Container header={<Header variant="h2" counter={String(toiletChecks.length)}>Toilet Checks</Header>}>
              {toiletChecks.length > 0 ? (
                <CloudscapeTable<ToiletCheck>
                  items={toiletChecks}
                  columnDefinitions={toiletColumnDefs}
                  variant="embedded"
                  trackBy="id"
                  wrapLines
                />
              ) : (
                <p className="text-sm text-gray-500 italic">No toilet checks recorded</p>
              )}
            </Container>

            {/* Enforcement Visits */}
            <Container header={<Header variant="h2" counter={String(enforcementVisits.length)}>Enforcement Visits</Header>}>
              {enforcementVisits.length > 0 ? (
                <CloudscapeTable<EnforcementVisit>
                  items={enforcementVisits}
                  columnDefinitions={enforcementColumnDefs}
                  variant="embedded"
                  trackBy="id"
                  wrapLines
                />
              ) : (
                <p className="text-sm text-gray-500 italic">No enforcement visits recorded</p>
              )}
            </Container>

            {/* Manager Approval Section */}
            <Container header={<Header variant="h2">Manager Decision</Header>}>
              <SpaceBetween size="m">
                {/* Toggle */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formik.values.approved}
                      onChange={(e) => formik.setFieldValue('approved', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                  </label>
                  <span className="text-sm font-medium text-gray-700">
                    {formik.values.approved ? 'Approve this shift' : 'Reject this shift'}
                  </span>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes {!formik.values.approved && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    value={formik.values.notes}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder={formik.values.approved
                      ? "Optional notes for the staff member"
                      : "Please explain why you're rejecting this shift"
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <p className="mt-1 text-sm text-red-600">{formik.errors.notes}</p>
                  )}
                </div>

                {/* Signature */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Manager Signature</h4>
                  <SignatureCanvas
                    onSave={handleSignatureSave}
                    width={500}
                    height={200}
                    required
                    errorMessage={error && !signature ? 'Signature is required' : undefined}
                  />
                </div>
              </SpaceBetween>
            </Container>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/approvals')}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {formik.values.approved ? "Submit Approval" : "Submit Rejection"}
              </button>
            </div>
          </SpaceBetween>
        </form>
      ) : (
        <EmptyState
          title="Shift not found"
          description="The shift you are looking for does not exist."
          variant="error"
          action={
            <button
              onClick={() => navigate('/approvals')}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Return to Approvals
            </button>
          }
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmDialog}
        header={formik.values.approved ? 'Confirm Approval' : 'Confirm Rejection'}
        confirmLabel={formik.values.approved ? 'Approve' : 'Reject'}
        cancelLabel="Cancel"
        variant={formik.values.approved ? 'default' : 'destructive'}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirmDialog(false)}
        loading={isSaving}
      >
        <p>
          {formik.values.approved
            ? 'Are you sure you want to approve this shift?'
            : 'Are you sure you want to reject this shift?'
          }
        </p>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default ShiftApproval;
