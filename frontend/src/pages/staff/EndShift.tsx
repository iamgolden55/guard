import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Dialog,
  DialogType,
  DialogFooter
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card, SignatureCanvas } from '../../components';
import { shiftService } from '../../services';
import type { Shift } from '../../types';

const EndShift: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const shiftId = Number(id);

  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

        // Check if shift is active
        if (shiftData.status !== 'active') {
          setError('This shift is not active and cannot be ended.');
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

  const handleSignatureSave = (signatureDataUrl: string) => {
    setSignature(signatureDataUrl);
    setError(null);
  };

  const handleConfirmEnd = async () => {
    try {
      if (!signature) {
        setError('Please sign to confirm your shift end.');
        return;
      }

      setIsSaving(true);
      setError(null);

      // End the shift
      await shiftService.endShift(shiftId, signature);

      // Close dialog and navigate back to dashboard
      setShowConfirmDialog(false);
      navigate('/');
    } catch (error) {
      console.error('Failed to end shift:', error);
      setError('Failed to end shift. Please try again.');
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

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">End Shift</Text>
        </Stack>

        <Card>
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
          ) : shift ? (
            <Stack tokens={{ childrenGap: 16 }}>
              {error && (
                <MessageBar
                  messageBarType={MessageBarType.error}
                  isMultiline={false}
                  dismissButtonAriaLabel="Close"
                >
                  {error}
                </MessageBar>
              )}

              <Stack>
                <Text variant="large" className="mb-2">Shift Details:</Text>
                <div className="p-4 bg-gray-50 rounded-md">
                  <Stack tokens={{ childrenGap: 8 }}>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Venue:</Text>
                      <Text>{shift.venue.name}</Text>
                    </Stack>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Start Date:</Text>
                      <Text>{formatDate(shift.startTime)}</Text>
                    </Stack>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Start Time:</Text>
                      <Text>{formatTime(shift.startTime)}</Text>
                    </Stack>
                    <Stack horizontal horizontalAlign="space-between">
                      <Text className="font-semibold">Status:</Text>
                      <Text className="capitalize">{shift.status}</Text>
                    </Stack>
                  </Stack>
                </div>
              </Stack>

              {/* End Shift Instructions */}
              <Stack className="mt-6">
                <Text variant="large">Please sign to confirm end of shift:</Text>
                <Text variant="medium" className="text-gray-600 mb-4">
                  By signing below, you confirm that all required checks and duties for this shift have been completed.
                </Text>

                {/* Signature Canvas */}
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
                  disabled={isSaving}
                />
                <PrimaryButton
                  text="End Shift"
                  disabled={!signature || isSaving}
                  iconProps={{ iconName: 'Stop' }}
                  onClick={() => setShowConfirmDialog(true)}
                />
              </Stack>
            </Stack>
          ) : (
            <Text>Shift not found.</Text>
          )}
        </Card>
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog
        hidden={!showConfirmDialog}
        onDismiss={() => setShowConfirmDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Confirm End Shift',
          subText: 'Are you sure you want to end this shift? This action cannot be undone.'
        }}
      >
        <DialogFooter>
          <PrimaryButton
            onClick={handleConfirmEnd}
            text="End Shift"
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

export default EndShift;
