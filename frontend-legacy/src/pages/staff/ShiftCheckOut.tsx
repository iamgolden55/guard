import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header, Container, SpaceBetween, KeyValuePairs, Alert } from '../../components/cloudscape';
import { SignatureCanvas } from '../../components';
import { shiftService } from '../../services';
import { offlineQueue, OfflineQueue } from '../../services/offlineQueue';

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
  totalHours: number;
  checkInTime?: string;
}

interface CheckOutData {
  location: { latitude: number; longitude: number; accuracy: number } | null;
  photo: string | null;
  signature: string | null;
}

const ShiftCheckOut: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<ShiftDetails | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [checkOutData, setCheckOutData] = useState<CheckOutData>({
    location: null,
    photo: null,
    signature: null
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [photoTaken, setPhotoTaken] = useState(false);

  // Load shift details
  useEffect(() => {
    const loadShiftDetails = async () => {
      if (!id) return;

      try {
        const shiftData: any = await shiftService.getShiftById(parseInt(id));

        const startTime = shiftData.start_time || shiftData.startTime;
        const endTime = shiftData.end_time || shiftData.endTime || '';

        const venueData = shiftData.venue || shiftData.venue_details || shiftData.venueDetails;

        if (!venueData) {
          throw new Error('Venue data not found in shift response');
        }

        const startTimeDate = new Date(startTime);
        const endTimeDate = new Date(endTime);
        const diffMs = endTimeDate.getTime() - startTimeDate.getTime();
        const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

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
          totalHours,
          checkInTime: shiftData.check_in_time
        };

        if (!transformedShift.venue.latitude || !transformedShift.venue.longitude) {
          setError('This venue does not have location coordinates set up. Please contact your manager.');
          return;
        }

        setShift(transformedShift);

        if (transformedShift.status !== 'in_progress') {
          setError('This shift is not in progress and cannot be checked out.');
          return;
        }

      } catch (err) {
        console.error('Error loading shift details:', err);
        setError('Failed to load shift details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadShiftDetails();
  }, [id]);

  // Location verification logic
  useEffect(() => {
    if (shift && currentStep === 1 && locationStatus === 'idle') {
      verifyLocation();
    }
  }, [shift, currentStep, locationStatus]);

  const verifyLocation = () => {
    if (!shift) return;

    setLocationStatus('pending');
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        if (shift?.venue.latitude && shift?.venue.longitude) {
          const distance = calculateDistance(
            userLoc.latitude,
            userLoc.longitude,
            Number(shift.venue.latitude),
            Number(shift.venue.longitude)
          );

          const venueCheckRadius = shift.venue?.checkRadius || shift.venue?.check_radius || 100;
          const gpsAccuracyBuffer = Math.min(userLoc.accuracy, 20);
          const allowedDistance = venueCheckRadius + gpsAccuracyBuffer;
          const isWithin = distance * 1000 <= allowedDistance;

          if (isWithin) {
            setLocationStatus('success');
            setCurrentStep(2);
          } else {
            setLocationStatus('error');
            setLocationError(`You are ${(distance * 1000).toFixed(0)}m away from the venue. You must be within ${venueCheckRadius}m (+ ${gpsAccuracyBuffer.toFixed(0)}m GPS buffer = ${allowedDistance.toFixed(0)}m total) to check out.`);
          }
        } else {
          setLocationStatus('error');
          setLocationError('Venue coordinates not available for verification.');
        }

        setCheckOutData(prev => ({
          ...prev,
          location: userLoc
        }));
      },
      (error) => {
        console.error('Location verification failed:', error);
        setLocationStatus('error');

        switch (error.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            setLocationError('Location access denied. Please enable location permissions in your browser and try again.');
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable. Please check your GPS/location services and try again.');
            break;
          case GeolocationPositionError.TIMEOUT:
            setLocationError('Location request timed out. Please try again.');
            break;
          default:
            setLocationError('Unable to get your location. Please ensure location permissions are enabled and try again.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
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
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCheckOutData(prev => ({
          ...prev,
          photo: photoDataUrl
        }));
        setPhotoTaken(true);

        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
      }
    }
  };

  const retakePhoto = () => {
    setPhotoTaken(false);
    setCheckOutData(prev => ({
      ...prev,
      photo: null
    }));
    startCamera();
  };

  const handleSignatureSave = (signatureDataUrl: string) => {
    setCheckOutData(prev => ({
      ...prev,
      signature: signatureDataUrl
    }));
  };

  const submitCheckOut = async () => {
    if (!checkOutData.location || !checkOutData.photo || !checkOutData.signature) {
      setError('Please complete all check-out steps');
      return;
    }

    setIsCheckingOut(true);
    setError(null);

    try {
      await shiftService.checkOutShift(parseInt(id!), {
        location: checkOutData.location,
        photo: checkOutData.photo,
        signature: checkOutData.signature
      });

      navigate('/shifts', {
        state: {
          message: 'Successfully checked out of shift!',
          type: 'success'
        }
      });
    } catch (error) {
      console.error('Check-out failed, attempting offline save:', error);

      // Save to offline queue so the submission is not lost
      try {
        const submission = OfflineQueue.createSubmission('check-out', parseInt(id!), {
          latitude: checkOutData.location!.latitude,
          longitude: checkOutData.location!.longitude,
          accuracy: checkOutData.location!.accuracy,
          photo: checkOutData.photo ?? undefined,
          signature: checkOutData.signature ?? undefined,
        });
        await offlineQueue.add(submission);

        navigate('/shifts', {
          state: {
            message: 'Check-out saved offline. It will be submitted automatically when your connection is restored.',
            type: 'info',
          },
        });
        return;
      } catch (offlineError) {
        console.error('Failed to save check-out offline:', offlineError);
      }

      setError('Failed to check out. Please try again.');
    } finally {
      setIsCheckingOut(false);
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

  if (error && !shift) {
    return <Alert type="error">{error}</Alert>;
  }

  if (!shift) {
    return <Alert type="error">Shift not found</Alert>;
  }

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Check Out of Shift</Header>

      {/* Shift Info */}
      <Container header={<Header variant="h2">{shift.venue.name}</Header>}>
        <KeyValuePairs
          columns={2}
          items={[
            { label: 'Address', value: shift.venue.address },
            { label: 'Shift Time', value: `${new Date(shift.startTime).toLocaleString()} - ${new Date(shift.endTime).toLocaleString()}` },
            { label: 'Total Hours', value: `${shift.totalHours}` },
            { label: 'Checked In', value: shift.checkInTime ? new Date(shift.checkInTime).toLocaleString() : 'Not checked in' },
          ]}
        />
      </Container>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-red-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-center">Step {currentStep} of 3</p>

      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step 1: Location */}
      {currentStep === 1 && (
        <Container header={<Header variant="h2">Step 1: Verify Your Location</Header>}>
          <SpaceBetween size="m">
            {locationStatus === 'pending' && (
              <div className="flex items-center gap-3 py-4">
                <div className="w-6 h-6 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-600">Getting your location...</p>
              </div>
            )}

            {locationStatus === 'success' && (
              <SpaceBetween size="s">
                <Alert type="success">Location verified! You are within range of the venue.</Alert>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-full px-6 h-12 text-base font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                >
                  Continue to Photo
                </button>
              </SpaceBetween>
            )}

            {locationStatus === 'error' && (
              <SpaceBetween size="s">
                <Alert type="error">{locationError}</Alert>
                <button
                  onClick={() => {
                    setLocationError(null);
                    setLocationStatus('idle');
                  }}
                  className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Try Again
                </button>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Step 2: Photo */}
      {currentStep === 2 && (
        <Container header={<Header variant="h2">Step 2: Take Departure Photo</Header>}>
          <SpaceBetween size="m">
            {!photoTaken && (
              <SpaceBetween size="m">
                <p className="text-sm text-gray-600">Take a photo to confirm your departure from the venue</p>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-w-md rounded-xl border border-gray-200"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <button
                  onClick={takePhoto}
                  className="w-full px-6 h-12 text-base font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                >
                  Take Photo
                </button>
              </SpaceBetween>
            )}

            {photoTaken && checkOutData.photo && (
              <SpaceBetween size="m">
                <p className="text-sm font-medium text-green-700">Photo captured successfully!</p>
                <img
                  src={checkOutData.photo!}
                  alt="Departure proof"
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

      {/* Step 3: Signature */}
      {currentStep === 3 && (
        <Container header={<Header variant="h2">Step 3: Digital Signature</Header>}>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-600">Please sign below to confirm your departure</p>

            <SignatureCanvas
              onSave={handleSignatureSave}
              required={true}
            />

            <button
              onClick={submitCheckOut}
              disabled={!checkOutData.signature || isCheckingOut}
              className="w-full px-6 h-12 text-base font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isCheckingOut ? 'Checking Out...' : 'Complete Check-Out'}
            </button>
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
};

export default ShiftCheckOut;
