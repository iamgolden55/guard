import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  TextField,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  Toggle,
  Dialog,
  DialogType,
  DialogFooter,
  Link,
  mergeStyleSets
} from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { MainLayout } from '../../layouts';
import { Card, SignatureCanvas } from '../../components';
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

  // Custom styles
  const styles = mergeStyleSets({
    checkSummary: {
      margin: '12px 0',
      padding: '12px',
      backgroundColor: '#f9f9f9',
      border: '1px solid #eaeaea',
      borderRadius: '4px'
    },
    sectionTitle: {
      marginTop: '24px',
      marginBottom: '12px',
      fontWeight: 600,
      borderBottom: '1px solid #eaeaea',
      paddingBottom: '8px'
    },
    startSignature: {
      maxWidth: '100%',
      maxHeight: '100px',
      border: '1px solid #eaeaea',
      borderRadius: '4px',
      padding: '4px'
    },
    endSignature: {
      maxWidth: '100%',
      maxHeight: '100px',
      border: '1px solid #eaeaea',
      borderRadius: '4px',
      padding: '4px'
    }
  });

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
  const fireExitColumns: IColumn[] = [
    {
      key: 'timestamp',
      name: 'Time',
      fieldName: 'timestamp',
      minWidth: 120,
      isResizable: true,
      onRender: (item: FireExitCheck) => formatTime(item.timestamp)
    },
    {
      key: 'exitName',
      name: 'Exit Location',
      fieldName: 'exitName',
      minWidth: 150,
      isResizable: true
    },
    {
      key: 'isPassed',
      name: 'Status',
      fieldName: 'isPassed',
      minWidth: 100,
      isResizable: true,
      onRender: (item: FireExitCheck) => (
        <span className={item.isPassed ? 'text-green-600' : 'text-red-600 font-bold'}>
          {item.isPassed ? 'PASS' : 'FAIL'}
        </span>
      )
    },
    {
      key: 'comments',
      name: 'Comments',
      fieldName: 'comments',
      minWidth: 200,
      isResizable: true
    }
  ];

  // Column definitions for capacity checks
  const capacityColumns: IColumn[] = [
    {
      key: 'timestamp',
      name: 'Time',
      fieldName: 'timestamp',
      minWidth: 120,
      isResizable: true,
      onRender: (item: CapacityCheck) => formatTime(item.timestamp)
    },
    {
      key: 'count',
      name: 'Count',
      fieldName: 'count',
      minWidth: 100,
      isResizable: true
    },
    {
      key: 'comments',
      name: 'Comments',
      fieldName: 'comments',
      minWidth: 250,
      isResizable: true
    }
  ];

  // Column definitions for toilet checks
  const toiletColumns: IColumn[] = [
    {
      key: 'timestamp',
      name: 'Time',
      fieldName: 'timestamp',
      minWidth: 120,
      isResizable: true,
      onRender: (item: ToiletCheck) => formatTime(item.timestamp)
    },
    {
      key: 'location',
      name: 'Location',
      fieldName: 'location',
      minWidth: 150,
      isResizable: true
    },
    {
      key: 'condition',
      name: 'Condition',
      fieldName: 'condition',
      minWidth: 120,
      isResizable: true,
      onRender: (item: ToiletCheck) => {
        let colorClass = 'text-gray-600';

        switch (item.condition) {
          case 'excellent':
            colorClass = 'text-green-600 font-bold';
            break;
          case 'good':
            colorClass = 'text-green-500';
            break;
          case 'fair':
            colorClass = 'text-yellow-600';
            break;
          case 'poor':
            colorClass = 'text-orange-600 font-bold';
            break;
          case 'critical':
            colorClass = 'text-red-600 font-bold';
            break;
        }

        return (
          <span className={`${colorClass} capitalize`}>
            {item.condition}
          </span>
        );
      }
    },
    {
      key: 'comments',
      name: 'Comments',
      fieldName: 'comments',
      minWidth: 200,
      isResizable: true
    }
  ];

  // Column definitions for enforcement visits
  const enforcementColumns: IColumn[] = [
    {
      key: 'timestamp',
      name: 'Time',
      fieldName: 'timestamp',
      minWidth: 120,
      isResizable: true,
      onRender: (item: EnforcementVisit) => formatTime(item.timestamp)
    },
    {
      key: 'officerName',
      name: 'Officer Name',
      fieldName: 'officerName',
      minWidth: 150,
      isResizable: true
    },
    {
      key: 'officerBadge',
      name: 'Badge #',
      fieldName: 'officerBadge',
      minWidth: 100,
      isResizable: true
    },
    {
      key: 'reasonForVisit',
      name: 'Reason',
      fieldName: 'reasonForVisit',
      minWidth: 200,
      isResizable: true
    },
    {
      key: 'outcome',
      name: 'Outcome',
      fieldName: 'outcome',
      minWidth: 200,
      isResizable: true
    }
  ];

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">
            {formik.values.approved ? 'Approve Shift' : 'Reject Shift'}
          </Text>
        </Stack>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={SpinnerSize.large} label="Loading shift details..." />
          </div>
        ) : error && !shift ? (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={true}
            dismissButtonAriaLabel="Close"
          >
            {error}
            <Link
              className="block mt-2"
              onClick={() => navigate('/approvals')}
            >
              Return to Approvals
            </Link>
          </MessageBar>
        ) : shift ? (
          <form onSubmit={formik.handleSubmit}>
            <Stack tokens={{ childrenGap: 16 }}>
              {/* Error message */}
              {error && (
                <MessageBar
                  messageBarType={MessageBarType.error}
                  isMultiline={false}
                  dismissButtonAriaLabel="Close"
                >
                  {error}
                </MessageBar>
              )}

              {/* Shift Summary Card */}
              <Card>
                <Text variant="large" className="font-semibold mb-4">
                  Shift Summary
                </Text>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Stack tokens={{ childrenGap: 10 }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Text className="font-semibold">Staff ID:</Text>
                        <Text>{shift.staffUser}</Text>
                      </Stack>

                      <Stack horizontal horizontalAlign="space-between">
                        <Text className="font-semibold">Venue:</Text>
                        <Text>{shift.venue.name}</Text>
                      </Stack>

                      <Stack horizontal horizontalAlign="space-between">
                        <Text className="font-semibold">Shift Date:</Text>
                        <Text>{formatDate(shift.startTime)}</Text>
                      </Stack>

                      <Stack horizontal horizontalAlign="space-between">
                        <Text className="font-semibold">Start Time:</Text>
                        <Text>{formatTime(shift.startTime)}</Text>
                      </Stack>

                      <Stack horizontal horizontalAlign="space-between">
                        <Text className="font-semibold">End Time:</Text>
                        <Text>{shift.endTime ? formatTime(shift.endTime) : 'N/A'}</Text>
                      </Stack>

                      <Stack horizontal horizontalAlign="space-between">
                        <Text className="font-semibold">Duration:</Text>
                        <Text>{calculateDuration(shift.startTime, shift.endTime)}</Text>
                      </Stack>
                    </Stack>
                  </div>

                  <div>
                    <Stack tokens={{ childrenGap: 16 }}>
                      <Stack>
                        <Text className="font-semibold mb-2">Start Signature:</Text>
                        {shift.startSignature ? (
                          <img
                            src={shift.startSignature}
                            alt="Start Signature"
                            className={styles.startSignature}
                          />
                        ) : (
                          <Text className="text-red-600">Missing signature</Text>
                        )}
                      </Stack>

                      <Stack>
                        <Text className="font-semibold mb-2">End Signature:</Text>
                        {shift.endSignature ? (
                          <img
                            src={shift.endSignature}
                            alt="End Signature"
                            className={styles.endSignature}
                          />
                        ) : (
                          <Text className="text-red-600">Missing signature</Text>
                        )}
                      </Stack>
                    </Stack>
                  </div>
                </div>
              </Card>

              {/* Fire Exit Checks */}
              <Card>
                <Text variant="large" className="font-semibold mb-4">
                  Fire Exit Checks
                </Text>

                {fireExitChecks.length > 0 ? (
                  <DetailsList
                    items={fireExitChecks}
                    columns={fireExitColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible={true}
                  />
                ) : (
                  <Text className="text-gray-500 italic">No fire exit checks recorded</Text>
                )}
              </Card>

              {/* Capacity Checks */}
              <Card>
                <Text variant="large" className="font-semibold mb-4">
                  Capacity Checks
                </Text>

                {capacityChecks.length > 0 ? (
                  <DetailsList
                    items={capacityChecks}
                    columns={capacityColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible={true}
                  />
                ) : (
                  <Text className="text-gray-500 italic">No capacity checks recorded</Text>
                )}
              </Card>

              {/* Toilet Checks */}
              <Card>
                <Text variant="large" className="font-semibold mb-4">
                  Toilet Checks
                </Text>

                {toiletChecks.length > 0 ? (
                  <DetailsList
                    items={toiletChecks}
                    columns={toiletColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible={true}
                  />
                ) : (
                  <Text className="text-gray-500 italic">No toilet checks recorded</Text>
                )}
              </Card>

              {/* Enforcement Visits */}
              <Card>
                <Text variant="large" className="font-semibold mb-4">
                  Enforcement Visits
                </Text>

                {enforcementVisits.length > 0 ? (
                  <DetailsList
                    items={enforcementVisits}
                    columns={enforcementColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible={true}
                  />
                ) : (
                  <Text className="text-gray-500 italic">No enforcement visits recorded</Text>
                )}
              </Card>

              {/* Manager Approval Section */}
              <Card>
                <Text variant="large" className="font-semibold mb-4">
                  Manager Decision
                </Text>

                <Stack tokens={{ childrenGap: 16 }}>
                  <Toggle
                    label="Approve this shift"
                    checked={formik.values.approved}
                    onChange={(_, checked) => formik.setFieldValue('approved', checked)}
                  />

                  <TextField
                    label="Notes"
                    name="notes"
                    multiline
                    rows={3}
                    value={formik.values.notes}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    errorMessage={
                      formik.touched.notes && formik.errors.notes
                        ? formik.errors.notes
                        : undefined
                    }
                    required={!formik.values.approved}
                    placeholder={formik.values.approved
                      ? "Optional notes for the staff member"
                      : "Please explain why you're rejecting this shift"
                    }
                  />

                  <Stack>
                    <Text variant="medium" className="font-semibold mb-2">
                      Manager Signature
                    </Text>
                    <SignatureCanvas
                      onSave={handleSignatureSave}
                      width={500}
                      height={200}
                      required
                      errorMessage={error && !signature ? 'Signature is required' : undefined}
                    />
                  </Stack>
                </Stack>
              </Card>

              {/* Action Buttons */}
              <Stack horizontal horizontalAlign="space-between">
                <DefaultButton
                  text="Cancel"
                  onClick={() => navigate('/approvals')}
                />
                <PrimaryButton
                  type="submit"
                  text={formik.values.approved ? "Submit Approval" : "Submit Rejection"}
                  iconProps={{ iconName: formik.values.approved ? 'Accept' : 'Cancel' }}
                  disabled={isSaving}
                />
              </Stack>
            </Stack>
          </form>
        ) : (
          <Text>Shift not found.</Text>
        )}
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog
        hidden={!showConfirmDialog}
        onDismiss={() => setShowConfirmDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: formik.values.approved ? 'Confirm Approval' : 'Confirm Rejection',
          subText: formik.values.approved
            ? 'Are you sure you want to approve this shift?'
            : 'Are you sure you want to reject this shift?'
        }}
      >
        <DialogFooter>
          <PrimaryButton
            onClick={handleConfirm}
            text={formik.values.approved ? "Approve" : "Reject"}
            disabled={isSaving}
          />
          <DefaultButton
            onClick={() => setShowConfirmDialog(false)}
            text="Cancel"
            disabled={isSaving}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default ShiftApproval;
