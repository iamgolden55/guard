import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Header, Container, SpaceBetween, Alert, FormSection, ConfirmationModal } from '../../components/cloudscape';
import { SignatureCanvas } from '../../components';
import { shiftService } from '../../services';
import type { Venue } from '../../types';

const StartShift: React.FC = () => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  // Load venues on mount
  useEffect(() => {
    const loadVenues = async () => {
      try {
        setIsLoading(true);
        const venueData = await shiftService.getVenues();
        setVenues(venueData.filter(venue => venue.isActive));
      } catch (error) {
        console.error('Failed to load venues:', error);
        setError('Failed to load venues. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadVenues();
  }, []);

  // Form validation schema
  const validationSchema = Yup.object({
    venueId: Yup.number()
      .required('Please select a venue')
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      venueId: 0
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        if (!signature) {
          setError('Please sign to confirm your shift start.');
          return;
        }

        if (selectedVenue?.termsAndConditions && !hasAcceptedTerms && !termsAccepted) {
          setError('You must accept the venue terms and conditions to start a shift.');
          return;
        }

        setIsLoading(true);
        setError(null);

        await shiftService.startShift({
          venueId: values.venueId,
          startSignature: signature,
          termsAccepted: termsAccepted || hasAcceptedTerms
        });

        navigate('/');
      } catch (error) {
        console.error('Failed to start shift:', error);
        setError('Failed to start shift. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  });

  const handleSignatureSave = (signatureDataUrl: string) => {
    setSignature(signatureDataUrl);
    setError(null);
  };

  // Update selected venue when venueId changes
  useEffect(() => {
    const checkVenueTerms = async (venueId: number) => {
      setCheckingTerms(true);
      try {
        const termsAccepted = await shiftService.hasAcceptedVenueTerms(venueId);
        setHasAcceptedTerms(termsAccepted);
      } catch (error) {
        console.error('Error checking venue terms:', error);
        setHasAcceptedTerms(false);
      } finally {
        setCheckingTerms(false);
      }
    };

    if (formik.values.venueId) {
      const venue = venues.find(v => v.id === formik.values.venueId);
      setSelectedVenue(venue || null);

      setTermsAccepted(false);

      if (venue?.termsAndConditions) {
        checkVenueTerms(formik.values.venueId);
      } else {
        setHasAcceptedTerms(true);
      }
    } else {
      setSelectedVenue(null);
      setHasAcceptedTerms(false);
    }
  }, [formik.values.venueId, venues]);

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Start New Shift</Header>

      <Container>
        {isLoading && !venues.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading venues...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={formik.handleSubmit}>
            <SpaceBetween size="l">
              {error && (
                <Alert type="error" dismissible onDismiss={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <FormSection
                header="Shift Details"
                description="Please select your venue and provide your signature to start a shift."
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Venue *</label>
                  <select
                    value={formik.values.venueId}
                    onChange={(e) => formik.setFieldValue('venueId', Number(e.target.value) || 0)}
                    disabled={isLoading}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value={0}>Choose a venue</option>
                    {venues.filter(v => v.isActive).map(venue => (
                      <option key={venue.id} value={venue.id}>{venue.name}</option>
                    ))}
                  </select>
                  {formik.touched.venueId && formik.errors.venueId && (
                    <p className="text-red-600 text-xs mt-1">{formik.errors.venueId}</p>
                  )}
                </div>
              </FormSection>

              {/* Venue Information */}
              {selectedVenue && (
                <FormSection header="Venue Information">
                  {selectedVenue.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Venue Description</label>
                      <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        {selectedVenue.description}
                      </div>
                    </div>
                  )}

                  {/* Terms and Conditions */}
                  {selectedVenue.termsAndConditions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Terms and Conditions *</label>
                      {checkingTerms ? (
                        <div className="flex items-center gap-2 py-2">
                          <div className="w-4 h-4 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
                          <p className="text-sm text-gray-500">Checking terms acceptance...</p>
                        </div>
                      ) : hasAcceptedTerms ? (
                        <Alert type="success">
                          You have already accepted the terms and conditions for this venue.{' '}
                          <button
                            type="button"
                            onClick={() => setShowTermsDialog(true)}
                            className="text-sm text-green-800 underline hover:no-underline"
                          >
                            View Terms
                          </button>
                        </Alert>
                      ) : (
                        <SpaceBetween size="s">
                          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 max-h-48 overflow-y-auto border border-gray-200">
                            {selectedVenue.termsAndConditions}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={termsAccepted}
                              onChange={(e) => setTermsAccepted(e.target.checked)}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-700">I have read and agree to the venue terms and conditions</span>
                          </label>
                        </SpaceBetween>
                      )}
                    </div>
                  )}
                </FormSection>
              )}

              {/* Signature */}
              <FormSection header="Your Signature" description="Please sign to confirm start of shift:">
                <SignatureCanvas
                  onSave={handleSignatureSave}
                  width={500}
                  height={200}
                  label="Your Signature"
                  required
                  errorMessage={!signature && error ? 'Signature is required' : undefined}
                />
              </FormSection>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  disabled={isLoading}
                  className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    Boolean(selectedVenue?.termsAndConditions && !hasAcceptedTerms && !termsAccepted)
                  }
                  className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Starting Shift...' : 'Start Shift'}
                </button>
              </div>
            </SpaceBetween>
          </form>
        )}
      </Container>

      {/* Terms Dialog */}
      <ConfirmationModal
        visible={showTermsDialog}
        header={selectedVenue ? `${selectedVenue.name} - Terms and Conditions` : 'Terms and Conditions'}
        confirmLabel="Close"
        onConfirm={() => setShowTermsDialog(false)}
        onCancel={() => setShowTermsDialog(false)}
      >
        <div className="max-h-96 overflow-y-auto">
          <p className="text-sm text-gray-500 mb-3">You have previously accepted these terms and conditions.</p>
          {selectedVenue?.termsAndConditions && (
            <p className="text-sm text-gray-600">{selectedVenue.termsAndConditions}</p>
          )}
        </div>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default StartShift;
