import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  TextField,
  MessageBar,
  MessageBarType,
  Stack,
  Text,
  Spinner,
  SpinnerSize,
  Label,
} from '@fluentui/react';
import { format, parseISO } from 'date-fns';
import shiftService from '../services/shiftService';
import type { AdjustmentData, AdjustmentResponse } from '../types/invoice';

// Uses raw API response (snake_case fields) rather than the camelCase Shift type
interface AdjustTimeDialogProps {
  shift: Record<string, any>;
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

const AdjustTimeDialog: React.FC<AdjustTimeDialogProps> = ({
  shift,
  isOpen,
  onDismiss,
  onSuccess,
}) => {
  const [adjustedCheckIn, setAdjustedCheckIn] = useState('');
  const [adjustedCheckOut, setAdjustedCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentImpact, setPaymentImpact] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Initialize form with shift times when dialog opens
  useEffect(() => {
    if (isOpen && shift) {
      // Convert shift times to datetime-local format
      if (shift.check_in_time) {
        const checkInDate = parseISO(shift.check_in_time);
        setAdjustedCheckIn(format(checkInDate, "yyyy-MM-dd'T'HH:mm"));
      } else if (shift.start_time) {
        const startDate = parseISO(shift.start_time);
        setAdjustedCheckIn(format(startDate, "yyyy-MM-dd'T'HH:mm"));
      }

      if (shift.check_out_time) {
        const checkOutDate = parseISO(shift.check_out_time);
        setAdjustedCheckOut(format(checkOutDate, "yyyy-MM-dd'T'HH:mm"));
      } else if (shift.end_time) {
        const endDate = parseISO(shift.end_time);
        setAdjustedCheckOut(format(endDate, "yyyy-MM-dd'T'HH:mm"));
      }

      setReason('');
      setSignature('');
      setHasSignature(false);
      setError(null);
      setPaymentImpact(null);

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    }
  }, [isOpen, shift]);

  // Calculate adjusted hours when times change
  // Uses seconds/3600 to match backend precision exactly
  useEffect(() => {
    if (adjustedCheckIn && adjustedCheckOut) {
      const checkIn = new Date(adjustedCheckIn);
      const checkOut = new Date(adjustedCheckOut);
      const diffMs = checkOut.getTime() - checkIn.getTime();
      // Calculate hours using seconds (matching backend: total_seconds() / 3600)
      const hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      // Auto-calculate payment impact
      if (shift.hourly_rate && shift.actual_hours_worked) {
        const originalPayment = shift.actual_hours_worked * shift.hourly_rate;
        const adjustedPayment = hours * shift.hourly_rate;
        setPaymentImpact({
          original_hours: shift.actual_hours_worked,
          adjusted_hours: hours,
          original_payment: originalPayment,
          adjusted_payment: adjustedPayment,
          payment_difference: adjustedPayment - originalPayment,
        });
      }
    }
  }, [adjustedCheckIn, adjustedCheckOut, shift]);

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignature('');
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!adjustedCheckIn || !adjustedCheckOut) {
      setError('Please specify both check-in and check-out times');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the adjustment');
      return;
    }

    if (!hasSignature) {
      setError('Please provide your signature');
      return;
    }

    // Calculate adjusted hours using seconds/3600 to match backend precision exactly
    const checkIn = new Date(adjustedCheckIn);
    const checkOut = new Date(adjustedCheckOut);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const adjustedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    if (adjustedHours <= 0) {
      setError('Check-out must be after check-in');
      return;
    }

    // Convert canvas to base64 signature
    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Signature canvas not found');
      return;
    }

    const signatureDataUrl = canvas.toDataURL('image/png');

    const adjustmentData: AdjustmentData = {
      adjusted_check_in_time: new Date(adjustedCheckIn).toISOString(),
      adjusted_check_out_time: new Date(adjustedCheckOut).toISOString(),
      adjusted_actual_hours: adjustedHours,
      reason: reason.trim(),
      manager_signature: signatureDataUrl,
    };

    setIsSubmitting(true);

    try {
      const response: AdjustmentResponse = await shiftService.adjustTime(shift.id, adjustmentData);

      // Success! Notify parent and close
      onSuccess();
      onDismiss();
    } catch (err: any) {
      console.error('Error adjusting shift times:', err);
      // Extract validation errors from DRF response
      const responseData = err?.response?.data;
      let errorMessage = 'Failed to adjust shift times. Please try again.';

      if (responseData) {
        if (typeof responseData === 'string') {
          errorMessage = responseData;
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (typeof responseData === 'object') {
          // Handle DRF validation errors: {"field": ["error1", "error2"]}
          const errors = Object.entries(responseData)
            .map(([field, messages]) => {
              const msgList = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgList.join(', ')}`;
            })
            .join('; ');
          if (errors) errorMessage = errors;
        }
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={{
        type: DialogType.largeHeader,
        title: 'Adjust Shift Times',
        subText: `Adjust check-in/out times for shift at ${shift.venue_details?.name || 'Unknown Venue'}`,
      }}
      modalProps={{
        isBlocking: true,
        styles: { main: { maxWidth: 600 } },
      }}
    >
      <Stack tokens={{ childrenGap: 16 }}>
        {error && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
            {error}
          </MessageBar>
        )}

        {/* Original vs Scheduled Times */}
        <Stack tokens={{ childrenGap: 8 }}>
          <Text variant="mediumPlus" style={{ fontWeight: 600 }}>
            Original Times
          </Text>
          <Stack horizontal tokens={{ childrenGap: 16 }}>
            <Stack style={{ flex: 1 }}>
              <Label>Scheduled</Label>
              <Text>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</Text>
            </Stack>
            <Stack style={{ flex: 1 }}>
              <Label>Actual</Label>
              <Text>
                {formatTime(shift.check_in_time)} - {formatTime(shift.check_out_time)}
              </Text>
            </Stack>
          </Stack>
          <Stack>
            <Label>Original Hours Worked</Label>
            <Text>{shift.actual_hours_worked || 'N/A'} hours</Text>
          </Stack>
        </Stack>

        {/* Adjusted Times */}
        <Stack tokens={{ childrenGap: 8 }}>
          <Text variant="mediumPlus" style={{ fontWeight: 600 }}>
            Corrected Times
          </Text>
          <TextField
            label="Adjusted Check-In Time"
            type="datetime-local"
            value={adjustedCheckIn}
            onChange={(_, value) => setAdjustedCheckIn(value || '')}
            required
          />
          <TextField
            label="Adjusted Check-Out Time"
            type="datetime-local"
            value={adjustedCheckOut}
            onChange={(_, value) => setAdjustedCheckOut(value || '')}
            required
          />
        </Stack>

        {/* Payment Impact */}
        {paymentImpact && (
          <Stack tokens={{ childrenGap: 8 }} style={{ padding: 12, backgroundColor: '#f3f2f1', borderRadius: 4 }}>
            <Text variant="mediumPlus" style={{ fontWeight: 600 }}>
              Payment Impact
            </Text>
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <Stack style={{ flex: 1 }}>
                <Label>Before</Label>
                <Text>{paymentImpact.original_hours.toFixed(2)} hours</Text>
                <Text>£{paymentImpact.original_payment.toFixed(2)}</Text>
              </Stack>
              <Stack style={{ flex: 1 }}>
                <Label>After</Label>
                <Text>{paymentImpact.adjusted_hours.toFixed(2)} hours</Text>
                <Text>£{paymentImpact.adjusted_payment.toFixed(2)}</Text>
              </Stack>
              <Stack style={{ flex: 1 }}>
                <Label>Difference</Label>
                <Text style={{ color: paymentImpact.payment_difference >= 0 ? 'green' : 'red', fontWeight: 600 }}>
                  {paymentImpact.payment_difference >= 0 ? '+' : ''}£{paymentImpact.payment_difference.toFixed(2)}
                </Text>
              </Stack>
            </Stack>
          </Stack>
        )}

        {/* Reason */}
        <TextField
          label="Reason for Adjustment"
          multiline
          rows={3}
          value={reason}
          onChange={(_, value) => setReason(value || '')}
          placeholder="E.g., Network issues prevented timely check-in, verified staff present on CCTV at 8:00 AM"
          required
        />

        {/* Signature Canvas */}
        <Stack tokens={{ childrenGap: 8 }}>
          <Stack horizontal horizontalAlign="space-between">
            <Label>Manager Signature (Required)</Label>
            <DefaultButton text="Clear" onClick={clearSignature} />
          </Stack>
          <canvas
            ref={canvasRef}
            width={540}
            height={150}
            style={{ border: '1px solid #ccc', cursor: 'crosshair', backgroundColor: '#fff' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </Stack>
      </Stack>

      <DialogFooter>
        <PrimaryButton
          onClick={handleSubmit}
          text={isSubmitting ? 'Adjusting...' : 'Adjust Times'}
          disabled={isSubmitting || !hasSignature}
        />
        <DefaultButton onClick={onDismiss} text="Cancel" disabled={isSubmitting} />
      </DialogFooter>
    </Dialog>
  );
};

export default AdjustTimeDialog;
