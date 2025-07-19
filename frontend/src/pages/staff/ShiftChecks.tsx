import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Pivot,
  PivotItem,
  ChoiceGroup,
  type IChoiceGroupOption,
  ComboBox,
  type IComboBoxOption,
  Label
} from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { MainLayout } from '../../layouts';
import { Card } from '../../components';
import { shiftService } from '../../services';
import { type Shift, ConditionRating } from '../../types';

enum CheckType {
  FIRE_EXIT = 'fire-exit',
  CAPACITY = 'capacity',
  TOILET = 'toilet',
  ENFORCEMENT = 'enforcement'
}

const ShiftChecks: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const shiftId = Number(id);

  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCheckType, setActiveCheckType] = useState<CheckType>(CheckType.FIRE_EXIT);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load shift details on mount
  useEffect(() => {
    const loadShiftDetails = async () => {
      try {
        setIsLoading(true);

        if (Number.isNaN(shiftId)) {
          setError('Invalid shift ID');
          return;
        }

        const shiftData = await shiftService.getShiftById(shiftId);
        setShift(shiftData);

        // Check if shift is active or in progress
        if (shiftData.status !== 'active' && shiftData.status !== 'in_progress') {
          setError('This shift is not active. Checks can only be added to active shifts.');
        }
      } catch (error) {
        console.error('Failed to load shift details:', error);
        setError('Failed to load shift details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadShiftDetails();
  }, [shiftId]);

  // Fire Exit Check Form
  const fireExitSchema = Yup.object({
    exitName: Yup.string().required('Exit name is required'),
    isPassed: Yup.boolean().required('Please select whether the check passed or failed'),
    comments: Yup.string().test(
      'required-if-failed',
      'Comments are required when check fails',
      function(value) {
        return this.parent.isPassed || !!value;
      }
    )
  });

  const fireExitForm = useFormik({
    initialValues: {
      exitName: '',
      isPassed: true,
      comments: ''
    },
    validationSchema: fireExitSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Add fire exit check
        await shiftService.addFireExitCheck(shiftId, {
          exitName: values.exitName,
          isPassed: values.isPassed,
          comments: values.comments
        });

        // Reset form and show success message
        resetForm();
        setSuccessMessage('Fire exit check saved successfully.');

        // Clear success message after a delay
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error('Failed to save fire exit check:', error);
        setError('Failed to save fire exit check. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  });

  // Capacity Check Form
  const capacitySchema = Yup.object({
    count: Yup.number()
      .required('Capacity count is required')
      .min(0, 'Count cannot be negative')
      .integer('Count must be a whole number'),
    comments: Yup.string()
  });

  const capacityForm = useFormik({
    initialValues: {
      count: 0,
      comments: ''
    },
    validationSchema: capacitySchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Add capacity check
        await shiftService.addCapacityCheck(shiftId, {
          count: values.count,
          comments: values.comments
        });

        // Reset form and show success message
        resetForm();
        setSuccessMessage('Capacity check saved successfully.');

        // Clear success message after a delay
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error('Failed to save capacity check:', error);
        setError('Failed to save capacity check. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  });

  // Toilet Check Form
  const toiletSchema = Yup.object({
    location: Yup.string().required('Location is required'),
    condition: Yup.string().required('Condition rating is required'),
    comments: Yup.string().test(
      'required-if-poor-or-critical',
      'Comments are required for poor or critical conditions',
      function(value) {
        const condition = this.parent.condition;
        return (
          condition !== ConditionRating.POOR &&
          condition !== ConditionRating.CRITICAL
        ) || !!value;
      }
    )
  });

  const toiletForm = useFormik({
    initialValues: {
      location: '',
      condition: ConditionRating.GOOD,
      comments: ''
    },
    validationSchema: toiletSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Add toilet check
        await shiftService.addToiletCheck(shiftId, {
          location: values.location,
          condition: values.condition as ConditionRating,
          comments: values.comments
        });

        // Reset form and show success message
        resetForm();
        setSuccessMessage('Toilet check saved successfully.');

        // Clear success message after a delay
        setTimeout(() => setSuccessMessage(null), 5000);
      } finally {
        setIsSaving(false);
      }
    }
  });

  // Enforcement Visit Form
  const enforcementSchema = Yup.object({
    officerName: Yup.string().required('Officer name is required'),
    officerBadge: Yup.string().required('Badge number is required'),
    reasonForVisit: Yup.string().required('Reason for visit is required'),
    actionTaken: Yup.string().required('Action taken is required'),
    outcome: Yup.string().required('Outcome is required')
  });

  const enforcementForm = useFormik({
    initialValues: {
      officerName: '',
      officerBadge: '',
      reasonForVisit: '',
      actionTaken: '',
      outcome: ''
    },
    validationSchema: enforcementSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Add enforcement visit
        await shiftService.addEnforcementVisit(shiftId, {
          officerName: values.officerName,
          officerBadge: values.officerBadge,
          reasonForVisit: values.reasonForVisit,
          actionTaken: values.actionTaken,
          outcome: values.outcome
        });

        // Reset form and show success message
        resetForm();
        setSuccessMessage('Enforcement visit logged successfully.');

        // Clear success message after a delay
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error('Failed to log enforcement visit:', error);
        setError('Failed to log enforcement visit. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  });

  // Options for fire exit check pass/fail
  const passFailOptions: IChoiceGroupOption[] = [
    { key: 'true', text: 'Pass' },
    { key: 'false', text: 'Fail' }
  ];

  // Options for toilet condition
  const conditionOptions: IComboBoxOption[] = [
    { key: ConditionRating.EXCELLENT, text: 'Excellent' },
    { key: ConditionRating.GOOD, text: 'Good' },
    { key: ConditionRating.FAIR, text: 'Fair' },
    { key: ConditionRating.POOR, text: 'Poor' },
    { key: ConditionRating.CRITICAL, text: 'Critical' }
  ];

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Shift Checks & Logs</Text>
        </Stack>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={SpinnerSize.large} label="Loading shift details..." />
          </div>
        ) : error && !shift ? (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        ) : (
          <Stack tokens={{ childrenGap: 16 }}>
            {/* Shift Info Card */}
            <Card>
              <Stack tokens={{ childrenGap: 10 }}>
                <Text variant="large" className="font-semibold">
                  Shift Details
                </Text>
                <div className="p-4 bg-gray-50 rounded-md">
                  <Stack tokens={{ childrenGap: 8 }}>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Venue:</Text>
                      <Text>{shift?.venue.name}</Text>
                    </Stack>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Date:</Text>
                      <Text>{shift?.startTime ? formatDate(shift.startTime) : 'N/A'}</Text>
                    </Stack>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Status:</Text>
                      <Text className="capitalize">{shift?.status || 'N/A'}</Text>
                    </Stack>
                  </Stack>
                </div>
              </Stack>
            </Card>

            {/* Checks Pivot */}
            <Card>
              {successMessage && (
                <MessageBar
                  messageBarType={MessageBarType.success}
                  isMultiline={false}
                  dismissButtonAriaLabel="Close"
                  className="mb-4"
                >
                  {successMessage}
                </MessageBar>
              )}

              {error && (
                <MessageBar
                  messageBarType={MessageBarType.error}
                  isMultiline={false}
                  dismissButtonAriaLabel="Close"
                  className="mb-4"
                >
                  {error}
                </MessageBar>
              )}

              <Pivot
                selectedKey={activeCheckType}
                onLinkClick={(item) => {
                  if (item?.props.itemKey) {
                    setActiveCheckType(item.props.itemKey as CheckType);
                  }
                }}
              >
                {/* Fire Exit Check */}
                <PivotItem headerText="Fire Exit Check" itemKey={CheckType.FIRE_EXIT}>
                  <div className="p-4">
                    <form onSubmit={fireExitForm.handleSubmit}>
                      <Stack tokens={{ childrenGap: 16 }}>
                        <Text variant="mediumPlus">
                          Record fire exit checks to ensure all exits are accessible and functioning correctly.
                        </Text>

                        <TextField
                          label="Exit Name / Location"
                          name="exitName"
                          value={fireExitForm.values.exitName}
                          onChange={fireExitForm.handleChange}
                          onBlur={fireExitForm.handleBlur}
                          errorMessage={
                            fireExitForm.touched.exitName && fireExitForm.errors.exitName
                              ? fireExitForm.errors.exitName
                              : undefined
                          }
                          required
                        />

                        <Stack>
                          <Label required>Status</Label>
                          <ChoiceGroup
                            options={passFailOptions}
                            selectedKey={fireExitForm.values.isPassed.toString()}
                            onChange={(_, option) => {
                              fireExitForm.setFieldValue('isPassed', option?.key === 'true');
                            }}
                            required
                          />
                          {fireExitForm.touched.isPassed && fireExitForm.errors.isPassed && (
                            <Text className="text-red-600 text-xs mt-1">{fireExitForm.errors.isPassed}</Text>
                          )}
                        </Stack>

                        <TextField
                          label="Comments"
                          name="comments"
                          multiline
                          rows={3}
                          value={fireExitForm.values.comments}
                          onChange={fireExitForm.handleChange}
                          onBlur={fireExitForm.handleBlur}
                          errorMessage={
                            fireExitForm.touched.comments && fireExitForm.errors.comments
                              ? fireExitForm.errors.comments
                              : undefined
                          }
                          required={!fireExitForm.values.isPassed}
                        />

                        <Stack horizontal horizontalAlign="end">
                          <PrimaryButton
                            type="submit"
                            text="Save Check"
                            disabled={isSaving}
                          />
                        </Stack>
                      </Stack>
                    </form>
                  </div>
                </PivotItem>

                {/* Capacity Check */}
                <PivotItem headerText="Capacity Check" itemKey={CheckType.CAPACITY}>
                  <div className="p-4">
                    <form onSubmit={capacityForm.handleSubmit}>
                      <Stack tokens={{ childrenGap: 16 }}>
                        <Text variant="mediumPlus">
                          Record the current occupancy to ensure the venue stays within safe capacity limits.
                        </Text>

                        <TextField
                          label="Current Count"
                          name="count"
                          type="number"
                          value={capacityForm.values.count.toString()}
                          onChange={capacityForm.handleChange}
                          onBlur={capacityForm.handleBlur}
                          errorMessage={
                            capacityForm.touched.count && capacityForm.errors.count
                              ? capacityForm.errors.count
                              : undefined
                          }
                          required
                        />

                        <TextField
                          label="Comments"
                          name="comments"
                          multiline
                          rows={3}
                          value={capacityForm.values.comments}
                          onChange={capacityForm.handleChange}
                          onBlur={capacityForm.handleBlur}
                          errorMessage={
                            capacityForm.touched.comments && capacityForm.errors.comments
                              ? capacityForm.errors.comments
                              : undefined
                          }
                        />

                        <Stack horizontal horizontalAlign="end">
                          <PrimaryButton
                            type="submit"
                            text="Save Check"
                            disabled={isSaving}
                          />
                        </Stack>
                      </Stack>
                    </form>
                  </div>
                </PivotItem>

                {/* Toilet Check */}
                <PivotItem headerText="Toilet Check" itemKey={CheckType.TOILET}>
                  <div className="p-4">
                    <form onSubmit={toiletForm.handleSubmit}>
                      <Stack tokens={{ childrenGap: 16 }}>
                        <Text variant="mediumPlus">
                          Record toilet condition checks to ensure cleanliness and functionality.
                        </Text>

                        <TextField
                          label="Location"
                          name="location"
                          value={toiletForm.values.location}
                          onChange={toiletForm.handleChange}
                          onBlur={toiletForm.handleBlur}
                          errorMessage={
                            toiletForm.touched.location && toiletForm.errors.location
                              ? toiletForm.errors.location
                              : undefined
                          }
                          required
                        />

                        <Stack>
                          <Label required>Condition</Label>
                          <ComboBox
                            selectedKey={toiletForm.values.condition}
                            options={conditionOptions}
                            onChange={(_, option) => {
                              toiletForm.setFieldValue('condition', option?.key || ConditionRating.GOOD);
                            }}
                            errorMessage={
                              toiletForm.touched.condition && toiletForm.errors.condition
                                ? toiletForm.errors.condition
                                : undefined
                            }
                          />
                        </Stack>

                        <TextField
                          label="Comments"
                          name="comments"
                          multiline
                          rows={3}
                          value={toiletForm.values.comments}
                          onChange={toiletForm.handleChange}
                          onBlur={toiletForm.handleBlur}
                          errorMessage={
                            toiletForm.touched.comments && toiletForm.errors.comments
                              ? toiletForm.errors.comments
                              : undefined
                          }
                          required={
                            toiletForm.values.condition === ConditionRating.POOR ||
                            toiletForm.values.condition === ConditionRating.CRITICAL
                          }
                        />

                        <Stack horizontal horizontalAlign="end">
                          <PrimaryButton
                            type="submit"
                            text="Save Check"
                            disabled={isSaving}
                          />
                        </Stack>
                      </Stack>
                    </form>
                  </div>
                </PivotItem>

                {/* Enforcement Visit */}
                <PivotItem headerText="Enforcement Visit" itemKey={CheckType.ENFORCEMENT}>
                  <div className="p-4">
                    <form onSubmit={enforcementForm.handleSubmit}>
                      <Stack tokens={{ childrenGap: 16 }}>
                        <Text variant="mediumPlus">
                          Record details of enforcement officer visits to the venue.
                        </Text>

                        <TextField
                          label="Officer Name"
                          name="officerName"
                          value={enforcementForm.values.officerName}
                          onChange={enforcementForm.handleChange}
                          onBlur={enforcementForm.handleBlur}
                          errorMessage={
                            enforcementForm.touched.officerName && enforcementForm.errors.officerName
                              ? enforcementForm.errors.officerName
                              : undefined
                          }
                          required
                        />

                        <TextField
                          label="Badge Number"
                          name="officerBadge"
                          value={enforcementForm.values.officerBadge}
                          onChange={enforcementForm.handleChange}
                          onBlur={enforcementForm.handleBlur}
                          errorMessage={
                            enforcementForm.touched.officerBadge && enforcementForm.errors.officerBadge
                              ? enforcementForm.errors.officerBadge
                              : undefined
                          }
                          required
                        />

                        <TextField
                          label="Reason for Visit"
                          name="reasonForVisit"
                          value={enforcementForm.values.reasonForVisit}
                          onChange={enforcementForm.handleChange}
                          onBlur={enforcementForm.handleBlur}
                          errorMessage={
                            enforcementForm.touched.reasonForVisit && enforcementForm.errors.reasonForVisit
                              ? enforcementForm.errors.reasonForVisit
                              : undefined
                          }
                          required
                        />

                        <TextField
                          label="Action Taken"
                          name="actionTaken"
                          multiline
                          rows={2}
                          value={enforcementForm.values.actionTaken}
                          onChange={enforcementForm.handleChange}
                          onBlur={enforcementForm.handleBlur}
                          errorMessage={
                            enforcementForm.touched.actionTaken && enforcementForm.errors.actionTaken
                              ? enforcementForm.errors.actionTaken
                              : undefined
                          }
                          required
                        />

                        <TextField
                          label="Outcome"
                          name="outcome"
                          multiline
                          rows={2}
                          value={enforcementForm.values.outcome}
                          onChange={enforcementForm.handleChange}
                          onBlur={enforcementForm.handleBlur}
                          errorMessage={
                            enforcementForm.touched.outcome && enforcementForm.errors.outcome
                              ? enforcementForm.errors.outcome
                              : undefined
                          }
                          required
                        />

                        <Stack horizontal horizontalAlign="end">
                          <PrimaryButton
                            type="submit"
                            text="Save Log"
                            disabled={isSaving}
                          />
                        </Stack>
                      </Stack>
                    </form>
                  </div>
                </PivotItem>
              </Pivot>
            </Card>

            {/* Bottom Action Buttons */}
            <Stack horizontal horizontalAlign="space-between">
              <DefaultButton
                text="Back to Dashboard"
                onClick={() => navigate('/')}
                iconProps={{ iconName: 'Home' }}
              />

              <DefaultButton
                text="View Shift Details"
                onClick={() => navigate(`/shifts/${shiftId}`)}
                iconProps={{ iconName: 'Info' }}
              />
            </Stack>
          </Stack>
        )}
      </Stack>
    </MainLayout>
  );
};

export default ShiftChecks;
