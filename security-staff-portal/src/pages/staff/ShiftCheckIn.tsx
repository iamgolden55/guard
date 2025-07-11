import type React from 'react';
import { useState, useEffect, useRef } from 'react';
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
  Separator,
  Label,
  ProgressIndicator
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card, SignatureCanvas } from '../../components';
import { shiftService } from '../../services';
import type { Venue } from '../../types/venue';

interface ShiftDetails {
  id: number;
  venue: {
    id: number;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
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
    
    return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error calculating total hours:', error);
    return 0;
  }
};

// Helper function to validate check-in timing
const validateCheckInTiming = (shiftStartTime: string): { isValid: boolean; errorMessage?: string; availableTime?: string } => {
  const now = new Date();
  const shiftStart = new Date(shiftStartTime);
  
  // Check if dates are valid
  if (isNaN(shiftStart.getTime())) {
    return { isValid: false, errorMessage: 'Invalid shift start time' };
  }
  
  const shiftDate = shiftStart.toDateString();
  const currentDate = now.toDateString();
  
  // Restriction 1: Must be the same date
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
  
  // Restriction 2: Cannot check in more than 15 minutes early
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
        // Load shift data from API
        const shiftData: any = await shiftService.getShiftById(parseInt(id));
        console.log('Shift data received:', shiftData);
        
        // Get venue details with coordinates from venues API
        const venuesResponse = await shiftService.getVenues();
        console.log('Venues API response:', venuesResponse);
        
        // Handle different response structures
        let venues = venuesResponse;
        if (venuesResponse && typeof venuesResponse === 'object' && 'results' in venuesResponse) {
          venues = venuesResponse.results; // Paginated response
        } else if (venuesResponse && typeof venuesResponse === 'object' && 'venues' in venuesResponse) {
          venues = venuesResponse.venues; // Nested response
        }
        
        console.log('Processed venues array:', venues);
        console.log('Looking for venue ID:', shiftData.venue.id);
        
        const venueDetails = Array.isArray(venues) ? venues.find(v => v.id === shiftData.venue.id) as Venue : null;
        console.log('Found venue details:', venueDetails);
        
        // Transform the API response to match our component interface
        const startTime = shiftData.start_time || shiftData.startTime;
        const endTime = shiftData.end_time || shiftData.endTime || '';
        
        const transformedShift: ShiftDetails = {
          id: shiftData.id,
          venue: {
            id: shiftData.venue.id || shiftData.venue_details?.id,
            name: shiftData.venue.name || shiftData.venue_details?.name,
            address: shiftData.venue.address || shiftData.venue_details?.address || 'Unknown Address',
            latitude: venueDetails?.latitude,
            longitude: venueDetails?.longitude
          },
          startTime: startTime,
          endTime: endTime,
          status: shiftData.status || 'scheduled',
          totalHours: calculateTotalHours(startTime, endTime)
        };
        
        console.log('Transformed shift for UI:', transformedShift);
        console.log('Venue has coordinates:', transformedShift.venue.latitude, transformedShift.venue.longitude);
        
        // Validate check-in timing
        const timingValidation = validateCheckInTiming(transformedShift.startTime);
        if (!timingValidation.isValid) {
          setError(timingValidation.errorMessage || 'Check-in not available at this time');
          setShift(transformedShift); // Still set shift for display purposes
          setCheckInAvailable(false);
          return;
        }
        
        setCheckInAvailable(true);
        setShift(transformedShift);
        
        // Check if user has accepted venue terms
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
        // Check-in is now available, re-validate
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

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [shift, checkInAvailable]);

  // Start location verification once shift is loaded (only if check-in is available and terms accepted)
  useEffect(() => {
    console.log('Location verification check:', { 
      shift: !!shift, 
      currentStep, 
      locationStatus,
      checkInAvailable,
      hasAcceptedTerms,
      hasError: !!error
    });
    if (shift && currentStep === 1 && locationStatus === 'idle' && checkInAvailable && hasAcceptedTerms && !error) {
      console.log('Starting location verification...');
      requestLocation();
    }
  }, [shift, currentStep, locationStatus, checkInAvailable, hasAcceptedTerms, error]);

  // Check venue terms acceptance
  const checkVenueTermsAcceptance = async (venueId: number) => {
    try {
      const hasAccepted = await shiftService.hasAcceptedVenueTerms(venueId);
      setHasAcceptedTerms(hasAccepted);
      console.log('Venue terms acceptance status:', hasAccepted);
    } catch (error) {
      console.error('Error checking venue terms acceptance:', error);
      setHasAcceptedTerms(false);
    }
  };

  // Accept venue terms
  const acceptVenueTerms = async () => {
    if (!shift) return;
    
    setIsAcceptingTerms(true);
    try {
      await shiftService.acceptVenueTerms(shift.venue.id);
      setHasAcceptedTerms(true);
      console.log('Venue terms accepted successfully');
    } catch (error) {
      console.error('Error accepting venue terms:', error);
      setError('Failed to accept venue terms. Please try again.');
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  // Step 1: Get user location and verify proximity to venue
  const requestLocation = async () => {
    setLocationStatus('pending');
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      setLocationStatus('error');
      return;
    }

    const options = {
      enableHighAccuracy: false, // Changed to false for better compatibility
      timeout: 15000, // Increased timeout
      maximumAge: 300000 // 5 minutes cache
    };

    console.log('Requesting location permission...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location received:', position);
        const userLocation: LocationPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        setCheckInData(prev => ({ ...prev, location: userLocation }));
        
        // Check if user is within acceptable range of venue (if venue has coordinates)
        console.log('Venue coordinates:', shift?.venue.latitude, shift?.venue.longitude);
        if (shift?.venue.latitude && shift?.venue.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            Number(shift.venue.latitude),
            Number(shift.venue.longitude)
          );
          
          console.log(`Distance to venue: ${(distance * 1000).toFixed(0)}m`);
          
          // Allow check-in within 100 meters of venue
          const isWithin = distance <= 0.1; // 0.1 km = 100 meters
          setIsWithinRange(isWithin);
          
          if (isWithin) {
            setLocationStatus('success');
            setCurrentStep(2);
          } else {
            setLocationError(`You are ${(distance * 1000).toFixed(0)}m away from the venue. You must be within 100m to check in.`);
            setLocationStatus('error');
          }
        } else {
          // If venue doesn't have coordinates, cannot verify location - this is a security issue
          console.log('No venue coordinates available - cannot verify location');
          setLocationError('This venue does not have location coordinates set up. Please contact your manager to configure the venue location before check-in is allowed.');
          setLocationStatus('error');
        }
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location services and try again.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setLocationError(errorMessage);
        setLocationStatus('error');
      },
      options
    );
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Step 2: Start camera for photo capture
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera if available
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

  // Capture photo
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
        
        // Stop camera stream
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        
        setCurrentStep(3);
      }
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setPhotoTaken(false);
    setCheckInData(prev => ({ ...prev, photo: null }));
    startCamera();
  };

  // Step 3: Handle signature
  const handleSignatureSave = (signatureDataUrl: string) => {
    setCheckInData(prev => ({ ...prev, signature: signatureDataUrl }));
  };

  // Final step: Submit check-in
  const submitCheckIn = async () => {
    if (!checkInData.location || !checkInData.photo || !checkInData.signature) {
      setError('Please complete all check-in steps');
      return;
    }

    setIsCheckingIn(true);
    setError(null);

    try {
      // Call the backend check-in API
      await shiftService.checkInShift(parseInt(id!), {
        location: checkInData.location,
        photo: checkInData.photo,
        signature: checkInData.signature
      });
      
      // Navigate back to shifts with success message
      navigate('/shifts', { 
        state: { 
          message: 'Successfully checked in to shift!',
          type: 'success'
        }
      });
    } catch (error) {
      console.error('Check-in failed:', error);
      setError('Failed to check in. Please try again.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Start camera when reaching step 2
  useEffect(() => {
    if (currentStep === 2 && !cameraStream && !photoTaken) {
      startCamera();
    }
  }, [currentStep, cameraStream, photoTaken]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-12">
          <Spinner size={SpinnerSize.large} label="Loading shift details..." />
        </div>
      </MainLayout>
    );
  }

  if (!shift) {
    return (
      <MainLayout>
        <MessageBar messageBarType={MessageBarType.error}>
          Shift not found
        </MessageBar>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Check In to Shift</Text>
          <DefaultButton
            text="Cancel"
            onClick={() => navigate('/shifts')}
            iconProps={{ iconName: 'Cancel' }}
          />
        </Stack>

        {/* Shift Details Card */}
        <Card>
          <Stack tokens={{ childrenGap: 12 }}>
            <Text variant="large" styles={{ root: { fontWeight: 'bold' } }}>
              {shift.venue.name}
            </Text>
            <Text>{shift.venue.address}</Text>
            <Text>
              <strong>Start Time:</strong> {shift.startTime ? new Date(shift.startTime).toLocaleString() : 'Invalid Date'}
            </Text>
            <Text>
              <strong>End Time:</strong> {shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Invalid Date'}
            </Text>
            <Text>
              <strong>Total Hours:</strong> {shift.totalHours ? `${shift.totalHours} hours` : 'Unable to calculate'}
            </Text>
          </Stack>
        </Card>

        {/* Progress Indicator */}
        <ProgressIndicator 
          label="Check-in Progress" 
          percentComplete={hasAcceptedTerms ? (currentStep / 3) : 0} 
        />

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageBar>
        )}

        {/* Countdown Timer Display */}
        {countdown && !checkInAvailable && (
          <MessageBar
            messageBarType={MessageBarType.warning}
            styles={{
              root: {
                backgroundColor: '#fff4e6',
                borderColor: '#f4a261'
              }
            }}
          >
            🕒 {countdown}
          </MessageBar>
        )}

        {/* Step 0: Venue Terms Acceptance */}
        {currentStep === 1 && checkInAvailable && hasAcceptedTerms === false && (
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large" className="font-semibold">
                Step 1: Accept Venue Terms & Conditions
              </Text>
              <Text variant="medium">
                Before you can check in to your shift at <strong>{shift?.venue.name}</strong>, you must accept the venue's terms and conditions.
              </Text>
              <Text variant="medium">
                📍 <strong>Venue:</strong> {shift?.venue.name}<br />
                📍 <strong>Address:</strong> {shift?.venue.address}
              </Text>
              
              <MessageBar messageBarType={MessageBarType.warning}>
                <Text variant="medium">
                  <strong>Please note:</strong> By accepting these terms, you agree to follow all venue-specific policies, safety procedures, and conduct requirements during your shift.
                </Text>
              </MessageBar>
              
              <PrimaryButton
                text={isAcceptingTerms ? "Accepting Terms..." : "Accept Terms & Continue"}
                onClick={acceptVenueTerms}
                disabled={isAcceptingTerms}
                iconProps={{ iconName: isAcceptingTerms ? undefined : 'CheckMark' }}
              />
            </Stack>
          </Card>
        )}

        {/* Step 1: Location Verification */}
        {currentStep === 1 && checkInAvailable && hasAcceptedTerms === true && (
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Step 2: Verify Your Location</Text>
              <Text>
                We need to verify that you are at the correct venue before you can check in.
              </Text>
              
              {locationStatus === 'pending' && (
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                  <Spinner size={SpinnerSize.medium} />
                  <Text>Getting your location...</Text>
                </Stack>
              )}
              
              {locationStatus === 'error' && (
                <Stack tokens={{ childrenGap: 12 }}>
                  <MessageBar messageBarType={MessageBarType.error}>
                    {locationError}
                  </MessageBar>
                  <PrimaryButton
                    text="Try Again"
                    onClick={() => {
                      setLocationError(null);
                      setLocationStatus('idle');
                    }}
                    iconProps={{ iconName: 'Location' }}
                  />
                </Stack>
              )}
              
              {locationStatus === 'success' && isWithinRange && (
                <MessageBar messageBarType={MessageBarType.success}>
                  Location verified! You are at the correct venue.
                </MessageBar>
              )}
              
              {locationStatus !== 'pending' && locationStatus !== 'success' && (
                <PrimaryButton
                  text="Verify Location"
                  onClick={requestLocation}
                  iconProps={{ iconName: 'Location' }}
                />
              )}
            </Stack>
          </Card>
        )}

        {/* Step 2: Photo Capture */}
        {currentStep === 2 && (
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Step 3: Take Arrival Photo</Text>
              <Text>
                Take a photo as proof of your arrival at the venue.
              </Text>
              
              {!photoTaken ? (
                <Stack tokens={{ childrenGap: 12 }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <PrimaryButton
                      text="Capture Photo"
                      onClick={capturePhoto}
                      iconProps={{ iconName: 'Camera' }}
                    />
                  </Stack>
                </Stack>
              ) : (
                <Stack tokens={{ childrenGap: 12 }}>
                  <img
                    src={checkInData.photo!}
                    alt="Arrival proof"
                    style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }}
                  />
                  <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <PrimaryButton
                      text="Continue"
                      onClick={() => setCurrentStep(3)}
                      iconProps={{ iconName: 'Forward' }}
                    />
                    <DefaultButton
                      text="Retake"
                      onClick={retakePhoto}
                      iconProps={{ iconName: 'Refresh' }}
                    />
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Card>
        )}

        {/* Step 3: Digital Signature */}
        {currentStep === 3 && (
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Step 4: Confirm with Signature</Text>
              <Text>
                Please sign below to confirm your check-in and start of shift.
              </Text>
              
              <SignatureCanvas
                onSave={handleSignatureSave}
                width={500}
                height={200}
                label="Your Signature"
                required
              />
              
              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }}>
                <DefaultButton
                  text="Back"
                  onClick={() => setCurrentStep(2)}
                  iconProps={{ iconName: 'Back' }}
                />
                <PrimaryButton
                  text={isCheckingIn ? 'Checking In...' : 'Complete Check-In'}
                  onClick={submitCheckIn}
                  disabled={!checkInData.signature || isCheckingIn}
                  iconProps={{ iconName: isCheckingIn ? undefined : 'CheckMark' }}
                />
              </Stack>
            </Stack>
          </Card>
        )}
      </Stack>
    </MainLayout>
  );
};

export default ShiftCheckIn;