import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header, Container, SpaceBetween, KeyValuePairs, Alert, ConfirmationModal, FormSection } from '../../components/cloudscape';
import { SignatureCanvas } from '../../components';
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

      await shiftService.endShift(shiftId, signature);

      setShowConfirmDialog(false);
      navigate('/');
    } catch (error) {
      console.error('Failed to end shift:', error);
      setError('Failed to end shift. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">End Shift</Header>

      <Container>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading shift details...</p>
            </div>
          </div>
        ) : error && !shift ? (
          <Alert type="error">{error}</Alert>
        ) : shift ? (
          <SpaceBetween size="l">
            {error && (
              <Alert type="error">{error}</Alert>
            )}

            <FormSection header="Shift Details">
              <div className="p-4 bg-gray-50 rounded-lg">
                <KeyValuePairs
                  columns={2}
                  items={[
                    { label: 'Venue', value: shift.venue.name },
                    { label: 'Start Date', value: formatDate(shift.startTime) },
                    { label: 'Start Time', value: formatTime(shift.startTime) },
                    { label: 'Status', value: <span className="capitalize">{shift.status}</span> },
                  ]}
                />
              </div>
            </FormSection>

            <FormSection
              header="End Shift Confirmation"
              description="By signing below, you confirm that all required checks and duties for this shift have been completed."
            >
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
                onClick={() => navigate('/')}
                disabled={isSaving}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={!signature || isSaving}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                End Shift
              </button>
            </div>
          </SpaceBetween>
        ) : (
          <p className="text-sm text-gray-500 py-8 text-center">Shift not found.</p>
        )}
      </Container>

      {/* Confirmation Dialog */}
      <ConfirmationModal
        visible={showConfirmDialog}
        header="Confirm End Shift"
        confirmLabel="End Shift"
        variant="destructive"
        onConfirm={handleConfirmEnd}
        onCancel={() => setShowConfirmDialog(false)}
        loading={isSaving}
      >
        <p>Are you sure you want to end this shift? This action cannot be undone.</p>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default EndShift;
