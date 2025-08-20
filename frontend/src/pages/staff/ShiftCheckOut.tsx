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
  totalHours: number;
  checkInTime?: string;
}

interface CheckOutData {
  location: { latitude: number; longitude: number; accuracy: number } | null;
  photo: string | null;
  signature: string | null;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
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
        // Load shift data from API
        const shiftData: any = await shiftService.getShiftById(parseInt(id));
        console.log('Shift data received:', shiftData);
        
        // Transform the API response to match our component interface
        const startTime = shiftData.start_time || shiftData.startTime;
        const endTime = shiftData.end_time || shiftData.endTime || '';
        
        // Extract venue data - coordinates should be included in shift response
        const venueData = shiftData.venue || shiftData.venue_details || shiftData.venueDetails;
        console.log('Venue data from shift:', venueData);
        
        if (!venueData) {
          throw new Error('Venue data not found in shift response');
        }
        
        // Calculate total hours
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
        
        console.log('Transformed shift for UI:', transformedShift);
        console.log('Venue coordinates from shift response:', {
          latitude: transformedShift.venue.latitude,
          longitude: transformedShift.venue.longitude,
          hasCoordinates: !!(transformedShift.venue.latitude && transformedShift.venue.longitude)
        });
        
        // Check if venue has coordinates
        if (!transformedShift.venue.latitude || !transformedShift.venue.longitude) {
          setError('This venue does not have location coordinates set up. Please contact your manager.');
          return;
        }
        
        setShift(transformedShift);
        
        // Verify shift is in_progress
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
    console.log('Location verification check:', {
      shift: !!shift,
      currentStep,
      locationStatus
    });
    
    if (shift && currentStep === 1 && locationStatus === 'idle') {
      console.log('Starting location verification...');
      verifyLocation();
    }
  }, [shift, currentStep, locationStatus]);

  const verifyLocation = () => {
    if (!shift) return;
    
    setLocationStatus('pending');
    setLocationError(null);
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported by this browser.');
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
        const userLoc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        
        // Check if user is within acceptable range of venue (if venue has coordinates)
        console.log('Venue coordinates:', shift?.venue.latitude, shift?.venue.longitude);
        if (shift?.venue.latitude && shift?.venue.longitude) {
          const distance = calculateDistance(
            userLoc.latitude,
            userLoc.longitude,
            Number(shift.venue.latitude),
            Number(shift.venue.longitude)
          );
          
          console.log(`Distance to venue: ${(distance * 1000).toFixed(0)}m`);
          
          // Allow check-out within 100 meters of venue
          const isWithin = distance <= 0.1; // 0.1 km = 100 meters
          
          if (isWithin) {
            setLocationStatus('success');
            setCurrentStep(2);
          } else {
            setLocationStatus('error');
            setLocationError(`You are ${(distance * 1000).toFixed(0)}m away from the venue. You must be within 100m to check out.`);
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
        
        // Provide more specific error messages based on the error type
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
      options
    );
  };


  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Camera functions
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
        
        // Stop camera stream
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
      // Call the backend check-out API
      await shiftService.checkOutShift(parseInt(id!), {
        location: checkOutData.location,
        photo: checkOutData.photo,
        signature: checkOutData.signature
      });
      
      // Navigate back to shifts with success message
      navigate('/shifts', { 
        state: { 
          message: 'Successfully checked out of shift!',
          type: 'success'
        }
      });
    } catch (error) {
      console.error('Check-out failed:', error);
      setError('Failed to check out. Please try again.');
    } finally {
      setIsCheckingOut(false);
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

  if (error) {
    return (
      <MainLayout>
        <MessageBar messageBarType={MessageBarType.error}>
          {error}
        </MessageBar>
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
        <Text variant="xxLarge" className="font-semibold">
          Check Out of Shift
        </Text>
        
        <Card>
          <Stack tokens={{ childrenGap: 16 }}>
            <Text variant="large" className="font-semibold">
              {shift.venue.name}
            </Text>
            <Text variant="medium">
              📍 {shift.venue.address}
            </Text>
            <Text variant="medium">
              🕒 {new Date(shift.startTime).toLocaleString()} - {new Date(shift.endTime).toLocaleString()}
            </Text>
            <Text variant="medium">
              ⏱️ Total Hours: {shift.totalHours}
            </Text>
            <Text variant="medium">
              ✅ Checked In: {shift.checkInTime ? new Date(shift.checkInTime).toLocaleString() : 'Not checked in'}
            </Text>
          </Stack>
        </Card>

        <ProgressIndicator 
          percentComplete={(currentStep - 1) / 3} 
          description={`Step ${currentStep} of 3`}
        />

        {/* Step 1: Location Verification */}
        {currentStep === 1 && (
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large" className="font-semibold">
                Step 1: Verify Your Location
              </Text>
              
              {locationStatus === 'pending' && (
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <Spinner size={SpinnerSize.small} />
                  <Text>Getting your location...</Text>
                </Stack>
              )}
              
              {locationStatus === 'success' && (
                <Stack tokens={{ childrenGap: 8 }}>
                  <MessageBar messageBarType={MessageBarType.success}>
                    ✅ Location verified! You are within range of the venue.
                  </MessageBar>
                  <PrimaryButton
                    text="Continue to Photo"
                    onClick={() => setCurrentStep(2)}
                    iconProps={{ iconName: 'Forward' }}
                  />
                </Stack>
              )}
              
              {locationStatus === 'error' && (
                <Stack tokens={{ childrenGap: 8 }}>
                  <MessageBar messageBarType={MessageBarType.error}>
                    {locationError}
                  </MessageBar>
                  <DefaultButton
                    text="Try Again"
                    onClick={() => {
                      setLocationError(null);
                      setLocationStatus('idle');
                    }}
                    iconProps={{ iconName: 'Refresh' }}
                  />
                </Stack>
              )}
            </Stack>
          </Card>
        )}

        {/* Step 2: Take Photo */}
        {currentStep === 2 && (
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large" className="font-semibold">
                Step 2: Take Departure Photo
              </Text>
              
              {!photoTaken && (
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text>Take a photo to confirm your departure from the venue</Text>
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }}
                  />
                  <canvas 
                    ref={canvasRef}
                    style={{ display: 'none' }}
                  />
                  <PrimaryButton
                    text="Take Photo"
                    onClick={takePhoto}
                    iconProps={{ iconName: 'Camera' }}
                  />
                </Stack>
              )}
              
              {photoTaken && checkOutData.photo && (
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text variant="medium" className="font-semibold">
                    Photo captured successfully!
                  </Text>
                  <img 
                    src={checkOutData.photo!}
                    alt="Departure proof"
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
              <Text variant="large" className="font-semibold">
                Step 3: Digital Signature
              </Text>
              
              <Text>Please sign below to confirm your departure</Text>
              
              <Stack tokens={{ childrenGap: 16 }}>
                <SignatureCanvas
                  onSave={handleSignatureSave}
                  required={true}
                />
                
                <PrimaryButton
                  text={isCheckingOut ? "Checking Out..." : "Complete Check-Out"}
                  onClick={submitCheckOut}
                  disabled={!checkOutData.signature || isCheckingOut}
                  iconProps={{ iconName: isCheckingOut ? undefined : 'CheckMark' }}
                />
              </Stack>
            </Stack>
          </Card>
        )}
      </Stack>
    </MainLayout>
  );
};

export default ShiftCheckOut;