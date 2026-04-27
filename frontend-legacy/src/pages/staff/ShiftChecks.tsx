import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Header, Container, SpaceBetween, KeyValuePairs, Alert, FormSection } from '../../components/cloudscape';
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

        await shiftService.addFireExitCheck(shiftId, {
          exitName: values.exitName,
          isPassed: values.isPassed,
          comments: values.comments
        });

        resetForm();
        setSuccessMessage('Fire exit check saved successfully.');
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

        await shiftService.addCapacityCheck(shiftId, {
          count: values.count,
          comments: values.comments
        });

        resetForm();
        setSuccessMessage('Capacity check saved successfully.');
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

        await shiftService.addToiletCheck(shiftId, {
          location: values.location,
          condition: values.condition as ConditionRating,
          comments: values.comments
        });

        resetForm();
        setSuccessMessage('Toilet check saved successfully.');
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

        await shiftService.addEnforcementVisit(shiftId, {
          officerName: values.officerName,
          officerBadge: values.officerBadge,
          reasonForVisit: values.reasonForVisit,
          actionTaken: values.actionTaken,
          outcome: values.outcome
        });

        resetForm();
        setSuccessMessage('Enforcement visit logged successfully.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error('Failed to log enforcement visit:', error);
        setError('Failed to log enforcement visit. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const checkTabs = [
    { key: CheckType.FIRE_EXIT, label: 'Fire Exit' },
    { key: CheckType.CAPACITY, label: 'Capacity' },
    { key: CheckType.TOILET, label: 'Toilet' },
    { key: CheckType.ENFORCEMENT, label: 'Enforcement' },
  ];

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Shift Checks & Logs</Header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading shift details...</p>
          </div>
        </div>
      ) : error && !shift ? (
        <Alert type="error">{error}</Alert>
      ) : (
        <SpaceBetween size="l">
          {/* Shift Info */}
          <Container header={<Header variant="h2">Shift Details</Header>}>
            <div className="p-4 bg-gray-50 rounded-lg">
              <KeyValuePairs
                columns={3}
                items={[
                  { label: 'Venue', value: shift?.venue.name },
                  { label: 'Date', value: shift?.startTime ? formatDate(shift.startTime) : 'N/A' },
                  { label: 'Status', value: <span className="capitalize">{shift?.status || 'N/A'}</span> },
                ]}
              />
            </div>
          </Container>

          {/* Checks */}
          <Container>
            <SpaceBetween size="m">
              {successMessage && (
                <Alert type="success" dismissible onDismiss={() => setSuccessMessage(null)}>
                  {successMessage}
                </Alert>
              )}

              {error && (
                <Alert type="error" dismissible onDismiss={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="flex gap-0 -mb-px overflow-x-auto">
                  {checkTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveCheckType(tab.key)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        activeCheckType === tab.key
                          ? 'border-red-600 text-red-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Fire Exit Check */}
              {activeCheckType === CheckType.FIRE_EXIT && (
                <form onSubmit={fireExitForm.handleSubmit}>
                  <FormSection
                    header="Fire Exit Check"
                    description="Record fire exit checks to ensure all exits are accessible and functioning correctly."
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exit Name / Location *</label>
                      <input
                        name="exitName"
                        value={fireExitForm.values.exitName}
                        onChange={fireExitForm.handleChange}
                        onBlur={fireExitForm.handleBlur}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {fireExitForm.touched.exitName && fireExitForm.errors.exitName && (
                        <p className="text-red-600 text-xs mt-1">{fireExitForm.errors.exitName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="isPassed"
                            checked={fireExitForm.values.isPassed === true}
                            onChange={() => fireExitForm.setFieldValue('isPassed', true)}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700">Pass</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="isPassed"
                            checked={fireExitForm.values.isPassed === false}
                            onChange={() => fireExitForm.setFieldValue('isPassed', false)}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700">Fail</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comments {!fireExitForm.values.isPassed && '*'}
                      </label>
                      <textarea
                        name="comments"
                        rows={3}
                        value={fireExitForm.values.comments}
                        onChange={fireExitForm.handleChange}
                        onBlur={fireExitForm.handleBlur}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {fireExitForm.touched.comments && fireExitForm.errors.comments && (
                        <p className="text-red-600 text-xs mt-1">{fireExitForm.errors.comments}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Save Check
                      </button>
                    </div>
                  </FormSection>
                </form>
              )}

              {/* Capacity Check */}
              {activeCheckType === CheckType.CAPACITY && (
                <form onSubmit={capacityForm.handleSubmit}>
                  <FormSection
                    header="Capacity Check"
                    description="Record the current occupancy to ensure the venue stays within safe capacity limits."
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Count *</label>
                      <input
                        name="count"
                        type="number"
                        value={capacityForm.values.count}
                        onChange={capacityForm.handleChange}
                        onBlur={capacityForm.handleBlur}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {capacityForm.touched.count && capacityForm.errors.count && (
                        <p className="text-red-600 text-xs mt-1">{capacityForm.errors.count}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                      <textarea
                        name="comments"
                        rows={3}
                        value={capacityForm.values.comments}
                        onChange={capacityForm.handleChange}
                        onBlur={capacityForm.handleBlur}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Save Check
                      </button>
                    </div>
                  </FormSection>
                </form>
              )}

              {/* Toilet Check */}
              {activeCheckType === CheckType.TOILET && (
                <form onSubmit={toiletForm.handleSubmit}>
                  <FormSection
                    header="Toilet Check"
                    description="Record toilet condition checks to ensure cleanliness and functionality."
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                      <input
                        name="location"
                        value={toiletForm.values.location}
                        onChange={toiletForm.handleChange}
                        onBlur={toiletForm.handleBlur}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {toiletForm.touched.location && toiletForm.errors.location && (
                        <p className="text-red-600 text-xs mt-1">{toiletForm.errors.location}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                      <select
                        value={toiletForm.values.condition}
                        onChange={(e) => toiletForm.setFieldValue('condition', e.target.value)}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      >
                        <option value={ConditionRating.EXCELLENT}>Excellent</option>
                        <option value={ConditionRating.GOOD}>Good</option>
                        <option value={ConditionRating.FAIR}>Fair</option>
                        <option value={ConditionRating.POOR}>Poor</option>
                        <option value={ConditionRating.CRITICAL}>Critical</option>
                      </select>
                      {toiletForm.touched.condition && toiletForm.errors.condition && (
                        <p className="text-red-600 text-xs mt-1">{toiletForm.errors.condition}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comments {(toiletForm.values.condition === ConditionRating.POOR || toiletForm.values.condition === ConditionRating.CRITICAL) && '*'}
                      </label>
                      <textarea
                        name="comments"
                        rows={3}
                        value={toiletForm.values.comments}
                        onChange={toiletForm.handleChange}
                        onBlur={toiletForm.handleBlur}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {toiletForm.touched.comments && toiletForm.errors.comments && (
                        <p className="text-red-600 text-xs mt-1">{toiletForm.errors.comments}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Save Check
                      </button>
                    </div>
                  </FormSection>
                </form>
              )}

              {/* Enforcement Visit */}
              {activeCheckType === CheckType.ENFORCEMENT && (
                <form onSubmit={enforcementForm.handleSubmit}>
                  <FormSection
                    header="Enforcement Visit"
                    description="Record details of enforcement officer visits to the venue."
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Officer Name *</label>
                      <input
                        name="officerName"
                        value={enforcementForm.values.officerName}
                        onChange={enforcementForm.handleChange}
                        onBlur={enforcementForm.handleBlur}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {enforcementForm.touched.officerName && enforcementForm.errors.officerName && (
                        <p className="text-red-600 text-xs mt-1">{enforcementForm.errors.officerName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Badge Number *</label>
                      <input
                        name="officerBadge"
                        value={enforcementForm.values.officerBadge}
                        onChange={enforcementForm.handleChange}
                        onBlur={enforcementForm.handleBlur}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {enforcementForm.touched.officerBadge && enforcementForm.errors.officerBadge && (
                        <p className="text-red-600 text-xs mt-1">{enforcementForm.errors.officerBadge}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Visit *</label>
                      <input
                        name="reasonForVisit"
                        value={enforcementForm.values.reasonForVisit}
                        onChange={enforcementForm.handleChange}
                        onBlur={enforcementForm.handleBlur}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {enforcementForm.touched.reasonForVisit && enforcementForm.errors.reasonForVisit && (
                        <p className="text-red-600 text-xs mt-1">{enforcementForm.errors.reasonForVisit}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action Taken *</label>
                      <textarea
                        name="actionTaken"
                        rows={2}
                        value={enforcementForm.values.actionTaken}
                        onChange={enforcementForm.handleChange}
                        onBlur={enforcementForm.handleBlur}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {enforcementForm.touched.actionTaken && enforcementForm.errors.actionTaken && (
                        <p className="text-red-600 text-xs mt-1">{enforcementForm.errors.actionTaken}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Outcome *</label>
                      <textarea
                        name="outcome"
                        rows={2}
                        value={enforcementForm.values.outcome}
                        onChange={enforcementForm.handleChange}
                        onBlur={enforcementForm.handleBlur}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {enforcementForm.touched.outcome && enforcementForm.errors.outcome && (
                        <p className="text-red-600 text-xs mt-1">{enforcementForm.errors.outcome}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Save Log
                      </button>
                    </div>
                  </FormSection>
                </form>
              )}
            </SpaceBetween>
          </Container>

          {/* Bottom Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => navigate('/')}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate(`/shifts/${shiftId}`)}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Shift Details
            </button>
          </div>
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
};

export default ShiftChecks;
