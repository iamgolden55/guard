import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header, Container, SpaceBetween, KeyValuePairs, Alert } from '../../components/cloudscape';
import { SignatureCanvas } from '../../components';
import { shiftService } from '../../services';

interface ShiftDetails {
  id: number;
  venue: {
    id: number;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    checkRadius?: number;
    check_radius?: number;
  };
  startTime: string;
  endTime: string;
  status: string;
  totalHours?: number;
}

interface LocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface CheckInData {
  location: LocationPosition | null;
  photo: string | null;
  signature: string | null;
}

// Helper function to calculate total hours
const calculateTotalHours = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.round(diffHours * 100) / 100;
  } catch (error) {
    console.error('Error calculating total hours:', error);
    return 0;
  }
};

// Helper function to validate check-in timing
const validateCheckInTiming = (shiftStartTime: string): { isValid: boolean; errorMessage?: string; availableTime?: string } => {
  const now = new Date();
  const shiftStart = new Date(shiftStartTime);

  if (isNaN(shiftStart.getTime())) {
    return { isValid: false, errorMessage: 'Invalid shift start time' };
  }

  const shiftDate = shiftStart.toDateString();
  const currentDate = now.toDateString();

  if (shiftDate !== currentDate) {
    if (shiftStart > now) {
      const daysDiff = Math.ceil((shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        isValid: false,
        errorMessage: `Cannot check in ${daysDiff} day${daysDiff > 1 ? 's' : ''} early. You can only check in on the day of your shift (${shiftStart.toLocaleDateString()}).`
      };
    } else {
      return {
        isValid: false,
        errorMessage: 'Cannot check in to a shift from a previous date. Please contact your manager.'
      };
    }
  }

  const earlyCheckInWindowMinutes = 15;
  const earliestCheckInTime = new Date(shiftStart.getTime() - (earlyCheckInWindowMinutes * 60 * 1000));

  if (now < earliestCheckInTime) {
    const timeDiff = earliestCheckInTime.getTime() - now.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    let waitTime: string;
    if (hours > 0) {
      waitTime = `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      waitTime = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const availableTime = earliestCheckInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      isValid: false,
      errorMessage: `Cannot check in ${waitTime} early. Check-in becomes available at ${availableTime} (15 minutes before shift start).`,
      availableTime: availableTime
    };
  }

  return { isValid: true };
};

const ShiftCheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [shift, setShift] = useState<ShiftDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [checkInData, setCheckInData] = useState<CheckInData>({
    location: null,
    photo: null,
    signature: null
  });
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isWithinRange, setIsWithinRange] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [checkInAvailable, setCheckInAvailable] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [photoTaken, setPhotoTaken] = useState(false);

  // Load shift details
  useEffect(() => {
    const loadShift = async () => {
      if (!id) {
        setError('Invalid shift ID');
        setIsLoading(false);
        return;
      }

      try {
        const shiftData: any = await shiftService.getShiftById(parseInt(id));

        const startTime = shiftData.start_time || shiftData.startTime;
        const endTime = shiftData.end_time || shiftData.endTime || '';

        const venueData = shiftData.venue || shiftData.venue_details || shiftData.venueDetails;

        const transformedShift: ShiftDetails = {
          id: shiftData.id,
          venue: {
            id: venueData?.id,
            name: venueData?.name || 'Unknown Venue',
            address: venueData?.address || 'Unknown Address',
            latitude: venueData?.latitude,
            longitude: venueData?.longitude
          },
          startTime: startTime,
          endTime: endTime,
          status: shiftData.status || 'scheduled',
          totalHours: calculateTotalHours(startTime, endTime)
        };

        const timingValidation = validateCheckInTiming(transformedShift.startTime);
        if (!timingValidation.isValid) {
          setError(timingValidation.errorMessage || 'Check-in not available at this time');
          setShift(transformedShift);
          setCheckInAvailable(false);
          return;
        }

        setCheckInAvailable(true);
        setShift(transformedShift);

        checkVenueTermsAcceptance(transformedShift.venue.id);
      } catch (error) {
        console.error('Failed to load shift:', error);
        setError('Failed to load shift details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadShift();
  }, [id]);

  // Countdown timer effect
  useEffect(() => {
    if (!shift || checkInAvailable) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const shiftStart = new Date(shift.startTime);
      const earlyCheckInWindowMinutes = 15;
      const earliestCheckInTime = new Date(shiftStart.getTime() - (earlyCheckInWindowMinutes * 60 * 1000));

      if (now >= earliestCheckInTime) {
        const timingValidation = validateCheckInTiming(shift.startTime);
        if (timingValidation.isValid) {
          setCheckInAvailable(true);
          setError(null);
          setCountdown(null);
        }
        return;
      }

      const timeDiff = earliestCheckInTime.getTime() - now.getTime();
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      let countdownText: string;
      if (hours > 0) {
        countdownText = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        countdownText = `${minutes}m ${seconds}s`;
      } else {
        countdownText = `${seconds}s`;
      }

      const availableTime = earliestCheckInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCountdown(`Check-in available in ${countdownText} (at ${availableTime})`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [shift, checkInAvailable]);

  // Start location verification
  useEffect(() => {
    if (shift && currentStep === 1 && locationStatus === 'idle' && checkInAvailable && hasAcceptedTerms && !error) {
      requestLocation();
    }
  }, [shift, currentStep, locationStatus, checkInAvailable, hasAcceptedTerms, error]);

  const checkVenueTermsAcceptance = async (venueId: number) => {
    try {
      const hasAccepted = await shiftService.hasAcceptedVenueTerms(venueId);
      setHasAcceptedTerms(hasAccepted);
    } catch (error) {
      console.error('Error checking venue terms acceptance:', error);
      setHasAcceptedTerms(false);
    }
  };

  const acceptVenueTerms = async () => {
    if (!shift) return;

    setIsAcceptingTerms(true);
    try {
      await shiftService.acceptVenueTerms(shift.venue.id);
      setHasAcceptedTerms(true);
    } catch (error) {
      console.error('Error accepting venue terms:', error);
      setError('Failed to accept venue terms. Please try again.');
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  const isDevelopmentMode = import.meta.env.DEV || window.location.hostname === 'localhost';

  const requestLocation = async () => {
    setLocationStatus('pending');
    setLocationError(null);

    if (isDevelopmentMode && import.meta.env.VITE_BYPASS_LOCATION_CHECK === 'true') {
      setLocationStatus('success');
      setCurrentStep(2);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      setLocationStatus('error');
      return;
    }

    const tryLocation = (enableHighAccuracy: boolean, timeout: number): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy,
          timeout,
          maximumAge: enableHighAccuracy ? 60000 : 300000
        });
      });
    };

    try {
      let position: GeolocationPosition;

      try {
        position = await tryLocation(true, 10000);
      } catch (highAccuracyError) {
        try {
          position = await tryLocation(false, 20000);
        } catch (lowAccuracyError) {
          position = await tryLocation(false, 5000);
        }
      }

      const userLocation: LocationPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      setCheckInData(prev => ({ ...prev, location: userLocation }));

      if (shift?.venue.latitude && shift?.venue.longitude) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          Number(shift.venue.latitude),
          Number(shift.venue.longitude)
        );

        const venueCheckRadius = shift.venue.checkRadius || shift.venue.check_radius || 50;
        const gpsAccuracyBuffer = Math.min(userLocation.accuracy, 20);
        const allowedDistance = venueCheckRadius + gpsAccuracyBuffer;
        const isWithin = distance * 1000 <= allowedDistance;

        setIsWithinRange(isWithin);

        if (isWithin) {
          setLocationStatus('success');
          setCurrentStep(2);
        } else {
          setLocationError(`You are ${(distance * 1000).toFixed(0)}m away from the venue. You must be within ${venueCheckRadius}m (+ ${gpsAccuracyBuffer.toFixed(0)}m GPS buffer = ${allowedDistance.toFixed(0)}m total) to check in.`);
          setLocationStatus('error');
        }
      } else {
        setLocationError('This venue does not have location coordinates set up. Please contact your manager to configure the venue location before check-in is allowed.');
        setLocationStatus('error');
      }
    } catch (error: any) {
      let errorMessage = 'Unable to retrieve your location';

      if (error.code) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. To check in, you need to:\n1. Click the location icon in your browser address bar\n2. Select "Allow" for location access\n3. Refresh this page and try again';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please ensure you have a stable internet connection and GPS is enabled.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again or move to an area with better GPS signal.';
            break;
          default:
            errorMessage = `Location error (${error.code}): ${error.message}`;
        }
      }

      setLocationError(errorMessage);
      setLocationStatus('error');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please ensure camera permissions are granted.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCheckInData(prev => ({ ...prev, photo: photoDataUrl }));
        setPhotoTaken(true);

        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }

        setCurrentStep(3);
      }
    }
  };

  const retakePhoto = () => {
    setPhotoTaken(false);
    setCheckInData(prev => ({ ...prev, photo: null }));
    startCamera();
  };

  const handleSignatureSave = (signatureDataUrl: string) => {
    setCheckInData(prev => ({ ...prev, signature: signatureDataUrl }));
  };

  const submitCheckIn = async () => {
    if (!checkInData.location || !checkInData.photo || !checkInData.signature) {
      setError('Please complete all check-in steps');
      return;
    }

    setIsCheckingIn(true);
    setError(null);

    try {
      await shiftService.checkInShift(parseInt(id!), {
        location: checkInData.location,
        photo: checkInData.photo,
        signature: checkInData.signature
      });

      navigate('/shifts', {
        state: {
          message: 'Successfully checked in to shift!',
          type: 'success'
        }
      });
    } catch (error: any) {
      console.error('Check-in failed:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.detail || error.message || 'Failed to check in. Please try again.';
      setError(`Check-in failed: ${errorMessage}`);
    } finally {
      setIsCheckingIn(false);
    }
  };

  useEffect(() => {
    if (currentStep === 2 && !cameraStream && !photoTaken) {
      startCamera();
    }
  }, [currentStep, cameraStream, photoTaken]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading shift details...</p>
        </div>
      </div>
    );
  }

  if (!shift) {
    return <Alert type="error">Shift not found</Alert>;
  }

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <button
            onClick={() => navigate('/shifts')}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        }
      >
        Check In to Shift
      </Header>

      {/* Shift Details */}
      <Container header={<Header variant="h2">{shift.venue.name}</Header>}>
        <KeyValuePairs
          columns={2}
          items={[
            { label: 'Address', value: shift.venue.address },
            { label: 'Start Time', value: shift.startTime ? new Date(shift.startTime).toLocaleString() : 'Invalid Date' },
            { label: 'End Time', value: shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Invalid Date' },
            { label: 'Total Hours', value: shift.totalHours ? `${shift.totalHours} hours` : 'Unable to calculate' },
          ]}
        />
      </Container>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-red-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${hasAcceptedTerms ? (currentStep / 3) * 100 : 0}%` }}
        />
      </div>

      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Countdown */}
      {countdown && !checkInAvailable && (
        <Alert type="warning">{countdown}</Alert>
      )}

      {/* Step 0: Venue Terms */}
      {currentStep === 1 && checkInAvailable && hasAcceptedTerms === false && (
        <Container header={<Header variant="h2">Step 1: Accept Venue Terms & Conditions</Header>}>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-600">
              Before you can check in to your shift at <strong>{shift?.venue.name}</strong>, you must accept the venue's terms and conditions.
            </p>
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Venue', value: shift?.venue.name },
                { label: 'Address', value: shift?.venue.address },
              ]}
            />
            <Alert type="warning">
              By accepting these terms, you agree to follow all venue-specific policies, safety procedures, and conduct requirements during your shift.
            </Alert>
            <button
              onClick={acceptVenueTerms}
              disabled={isAcceptingTerms}
              className="w-full px-6 h-12 text-base font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isAcceptingTerms ? 'Accepting Terms...' : 'Accept Terms & Continue'}
            </button>
          </SpaceBetween>
        </Container>
      )}

      {/* Step 1: Location Verification */}
      {currentStep === 1 && checkInAvailable && hasAcceptedTerms === true && (
        <Container header={<Header variant="h2">Step 2: Verify Your Location</Header>}>
          <SpaceBetween size="m">
            {isDevelopmentMode && import.meta.env.VITE_BYPASS_LOCATION_CHECK === 'true' && (
              <Alert type="info">Development Mode: Location verification is bypassed for testing</Alert>
            )}
            <p className="text-sm text-gray-600">We need to verify that you are at the correct venue before you can check in.</p>

            {locationStatus === 'pending' && (
              <div className="flex items-center gap-3 py-4">
                <div className="w-6 h-6 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-600">Getting your location...</p>
              </div>
            )}

            {locationStatus === 'error' && (
              <SpaceBetween size="s">
                <Alert type="error">{locationError}</Alert>
                <SpaceBetween direction="horizontal" size="s">
                  <button
                    onClick={() => {
                      setLocationError(null);
                      setLocationStatus('idle');
                      setTimeout(() => requestLocation(), 100);
                    }}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      alert(`Location troubleshooting tips:\n1. Ensure location services are enabled in your browser\n2. Allow location access when prompted\n3. Try refreshing the page\n4. Move to an area with better GPS signal\n5. Check that location services are enabled on your device\n6. If using iOS Safari, go to Settings > Privacy & Security > Location Services > Safari Websites and ensure it's enabled`);
                    }}
                    className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Troubleshoot
                  </button>
                  {isDevelopmentMode && (
                    <button
                      onClick={() => {
                        const confirmed = confirm(
                          `DEVELOPMENT OVERRIDE\n\nAre you physically present at:\n${shift?.venue.name}\n${shift?.venue.address}\n\nThis bypasses location verification for testing only.`
                        );
                        if (confirmed) {
                          setLocationStatus('success');
                          setCurrentStep(2);
                          setCheckInData(prev => ({
                            ...prev,
                            location: {
                              latitude: Number(shift?.venue.latitude || 0),
                              longitude: Number(shift?.venue.longitude || 0),
                              accuracy: 10
                            }
                          }));
                        }
                      }}
                      className="px-4 h-9 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Manual Override
                    </button>
                  )}
                </SpaceBetween>
              </SpaceBetween>
            )}

            {locationStatus === 'success' && isWithinRange && (
              <Alert type="success">Location verified! You are at the correct venue.</Alert>
            )}

            {locationStatus !== 'pending' && locationStatus !== 'success' && (
              <button
                onClick={requestLocation}
                className="w-full px-6 h-12 text-base font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                Verify Location
              </button>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Step 2: Photo Capture */}
      {currentStep === 2 && (
        <Container header={<Header variant="h2">Step 3: Take Arrival Photo</Header>}>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-600">Take a photo as proof of your arrival at the venue.</p>

            {!photoTaken ? (
              <SpaceBetween size="m">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-w-md rounded-xl border border-gray-200"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <button
                  onClick={capturePhoto}
                  className="w-full px-6 h-12 text-base font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                >
                  Capture Photo
                </button>
              </SpaceBetween>
            ) : (
              <SpaceBetween size="m">
                <img
                  src={checkInData.photo!}
                  alt="Arrival proof"
                  className="w-full max-w-md rounded-xl border border-gray-200"
                />
                <SpaceBetween direction="horizontal" size="s">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Continue
                  </button>
                  <button
                    onClick={retakePhoto}
                    className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Retake
                  </button>
                </SpaceBetween>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Step 3: Digital Signature */}
      {currentStep === 3 && (
        <Container header={<Header variant="h2">Step 4: Confirm with Signature</Header>}>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-600">Please sign below to confirm your check-in and start of shift.</p>

            <SignatureCanvas
              onSave={handleSignatureSave}
              width={500}
              height={200}
              label="Your Signature"
              required
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={submitCheckIn}
                disabled={!checkInData.signature || isCheckingIn}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isCheckingIn ? 'Checking In...' : 'Complete Check-In'}
              </button>
            </div>
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
};

export default ShiftCheckIn;
