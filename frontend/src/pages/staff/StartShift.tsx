import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  Dropdown,
  type IDropdownOption,
  PrimaryButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Checkbox,
  Label,
  Separator,
  DefaultButton,
  Dialog,
  DialogType,
  DialogFooter,
  Link
} from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { MainLayout } from '../../layouts';
import { Card, SignatureCanvas } from '../../components';
import { shiftService } from '../../services';
import type { Venue } from '../../types';

const StartShift: React.FC = () => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [venueOptions, setVenueOptions] = useState<IDropdownOption[]>([]);
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

        // Create dropdown options from venues
        const options = venueData
          .filter(venue => venue.isActive)
          .map(venue => ({
            key: venue.id,
            text: venue.name
          }));

        setVenueOptions(options);
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

        // If the venue has terms and the staff hasn't accepted them yet and hasn't checked the box
        if (selectedVenue?.termsAndConditions && !hasAcceptedTerms && !termsAccepted) {
          setError('You must accept the venue terms and conditions to start a shift.');
          return;
        }

        setIsLoading(true);
        setError(null);

        // Submit new shift
        await shiftService.startShift({
          venueId: values.venueId,
          startSignature: signature,
          termsAccepted: termsAccepted || hasAcceptedTerms // Send true if terms already accepted
        });

        // Redirect to dashboard
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
        // Check if staff has already accepted these terms
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

      // Reset terms acceptance when changing venues
      setTermsAccepted(false);

      // Check if the user has already accepted terms for this venue
      if (venue?.termsAndConditions) {
        checkVenueTerms(formik.values.venueId);
      } else {
        setHasAcceptedTerms(true); // If no terms, consider them accepted
      }
    } else {
      setSelectedVenue(null);
      setHasAcceptedTerms(false);
    }
  }, [formik.values.venueId, venues]);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Start New Shift</Text>
        </Stack>

        <Card>
          {isLoading && !venues.length ? (
            <div className="flex justify-center py-8">
              <Spinner size={SpinnerSize.large} label="Loading venues..." />
            </div>
          ) : (
            <form onSubmit={formik.handleSubmit}>
              <Stack tokens={{ childrenGap: 16 }}>
                {error && (
                  <MessageBar
                    messageBarType={MessageBarType.error}
                    isMultiline={false}
                    dismissButtonAriaLabel="Close"
                    onDismiss={() => setError(null)}
                  >
                    {error}
                  </MessageBar>
                )}

                <Stack>
                  <Text variant="large" className="mb-6">Please select your venue and provide your signature to start a shift.</Text>

                  {/* Venue Selection */}
                  <Dropdown
                    label="Select Venue"
                    placeholder="Choose a venue"
                    options={venueOptions}
                    selectedKey={formik.values.venueId}
                    onChange={(_, option) => {
                      formik.setFieldValue('venueId', option?.key || 0);
                    }}
                    errorMessage={
                      formik.touched.venueId && formik.errors.venueId
                        ? formik.errors.venueId
                        : undefined
                    }
                    required
                    disabled={isLoading}
                  />
                </Stack>

                {/* Venue Description */}
                {selectedVenue && (
                  <Stack className="mt-4">
                    <Separator>Venue Information</Separator>

                    {selectedVenue.description && (
                      <Stack className="mt-2">
                        <Label>Venue Description</Label>
                        <div className="bg-gray-50 p-4 rounded-md">
                          <Text>{selectedVenue.description}</Text>
                        </div>
                      </Stack>
                    )}

                    {/* Terms and Conditions */}
                    {selectedVenue.termsAndConditions && (
                      <Stack className="mt-4">
                        <Label required>Terms and Conditions</Label>
                        {checkingTerms ? (
                          <Spinner size={SpinnerSize.small} label="Checking terms acceptance..." />
                        ) : hasAcceptedTerms ? (
                          <MessageBar messageBarType={MessageBarType.success}>
                            You have already accepted the terms and conditions for this venue.
                            <Link
                              className="ml-2 cursor-pointer text-blue-600 hover:underline"
                              onClick={() => setShowTermsDialog(true)}
                            >
                              View Terms
                            </Link>
                          </MessageBar>
                        ) : (
                          <>
                            <div className="bg-gray-50 p-4 rounded-md max-h-48 overflow-y-auto border border-gray-200">
                              <Text>{selectedVenue.termsAndConditions}</Text>
                            </div>
                            <Checkbox
                              label="I have read and agree to the venue terms and conditions"
                              checked={termsAccepted}
                              onChange={(_, checked) => setTermsAccepted(!!checked)}
                              className="mt-2"
                              required
                            />
                          </>
                        )}
                      </Stack>
                    )}
                  </Stack>
                )}

                {/* Signature Canvas */}
                <Stack className="mt-6">
                  <Separator>Your Signature</Separator>
                  <Text>Please sign to confirm start of shift:</Text>
                  <div className="mt-2">
                    <SignatureCanvas
                      onSave={handleSignatureSave}
                      width={500}
                      height={200}
                      label="Your Signature"
                      required
                      errorMessage={!signature && error ? 'Signature is required' : undefined}
                    />
                  </div>
                </Stack>

                {/* Submit Button */}
                <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }}>
                  <DefaultButton
                    text="Cancel"
                    onClick={() => navigate('/')}
                    disabled={isLoading}
                  />
                  <PrimaryButton
                    type="submit"
                    text={isLoading ? 'Starting Shift...' : 'Start Shift'}
                    disabled={
                      isLoading ||
                      Boolean(selectedVenue?.termsAndConditions && !hasAcceptedTerms && !termsAccepted)
                    }
                    iconProps={{ iconName: 'PlaySolid' }}
                  />
                </Stack>
              </Stack>
            </form>
          )}
        </Card>
      </Stack>

      {/* Terms and Conditions Dialog */}
      <Dialog
        hidden={!showTermsDialog}
        onDismiss={() => setShowTermsDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: selectedVenue ? `${selectedVenue.name} - Terms and Conditions` : 'Terms and Conditions',
          subText: 'You have previously accepted these terms and conditions.'
        }}
        minWidth={600}
      >
        <div className="max-h-96 overflow-y-auto mb-4">
          {selectedVenue?.termsAndConditions && (
            <Text>{selectedVenue.termsAndConditions}</Text>
          )}
        </div>
        <DialogFooter>
          <PrimaryButton onClick={() => setShowTermsDialog(false)} text="Close" />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default StartShift;
