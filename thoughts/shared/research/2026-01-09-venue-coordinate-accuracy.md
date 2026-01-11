---
date: 2026-01-09T02:12:26Z
researcher: Claude
git_commit: c28a1b96e2d3fa90274840b64c03bba98469737a
branch: main
repository: iamgolden55/guard
topic: "Venue Coordinate Collection and Accuracy Analysis"
tags: [research, codebase, venue, coordinates, google-maps, geocoding, location-verification]
status: complete
last_updated: 2026-01-09
last_updated_by: Claude
---

# Research: Venue Coordinate Collection and Accuracy Analysis

**Date**: 2026-01-09T02:12:26Z
**Researcher**: Claude
**Git Commit**: c28a1b96e2d3fa90274840b64c03bba98469737a
**Branch**: main
**Repository**: iamgolden55/guard

## Research Question

How are venues created on the backend, and how do we ensure the correct coordinates are collected? Specifically, when creating a venue like "BIMM Institute", how do we ensure Google API returns the right coordinates?

## Summary

The system uses a **dual-source coordinate system**:

1. **Frontend-sourced coordinates**: When admin uses location pickers (VenueLocationPicker or IntelligentAddressPicker), coordinates come directly from Google Places API based on user selection.

2. **Backend-sourced coordinates**: If coordinates aren't provided, or when address fields change, the backend automatically geocodes the full address string via Google Maps Geocoding API.

**Key Finding**: There is NO validation ensuring frontend-selected coordinates match the address text. The system trusts whichever source provides data first. This creates a potential accuracy gap when:
- Admin types address manually without using location picker
- Address text is ambiguous (e.g., "BIMM Institute" without full address)
- Geocoding returns incorrect results for complex addresses

## Detailed Findings

### 1. Backend Venue Model - Coordinate Storage

**File**: `backend/api/models.py:1192-1198`

```python
latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
check_radius = models.IntegerField(default=50, help_text="Radius in meters for location verification")
```

**Key Points**:
- Coordinates are OPTIONAL (`null=True, blank=True`)
- High precision (15 decimal places) for accurate GPS storage
- Default check radius is 50 meters for location verification

### 2. Backend Automatic Geocoding

**File**: `backend/api/models.py:1224-1263`

When a venue is saved, the `save()` method checks if address fields changed:

```python
def save(self, *args, **kwargs):
    # Check if address changed
    address_changed = (not self.pk) or \
                     self.tracker.has_changed('address') or \
                     self.tracker.has_changed('city') or \
                     self.tracker.has_changed('postal_code') or \
                     self.tracker.has_changed('country')

    if address_changed:
        self.update_coordinates()

    super().save(*args, **kwargs)
```

The `update_coordinates()` method constructs a geocoding request:

```python
def update_coordinates(self):
    gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
    address = f"{self.address}, {self.city}, {self.postal_code}, {self.country}"

    result = gmaps.geocode(address)

    if result:
        location = result[0]['geometry']['location']
        self.latitude = location['lat']
        self.longitude = location['lng']
```

**Accuracy Concern**: The geocoding query is a simple string concatenation of address fields. For "BIMM Institute", the query would be:
```
"BIMM Institute, London, SW9 0AB, United Kingdom"
```

This may or may not return the exact building location depending on how Google interprets it.

### 3. Frontend Venue Creation Flow

**File**: `frontend/src/pages/admin/VenueManagement.tsx:473-516`

The frontend sends coordinates from the location picker to the backend:

```typescript
const newApiVenue: ApiVenue = {
  name: formData.name,
  address: formData.address,
  city: formData.city,
  postal_code: formData.postalCode,
  latitude: selectedLocation?.latitude,   // Can be undefined!
  longitude: selectedLocation?.longitude,  // Can be undefined!
  country: 'United Kingdom',
  // ... other fields
};
```

**Critical Issue**: If `selectedLocation` is null/undefined (admin didn't use location picker), the venue is created with `latitude: undefined, longitude: undefined`, relying entirely on backend geocoding.

### 4. Location Picker Components

#### A. VenueLocationPicker (Basic)
**File**: `frontend/src/components/VenueLocationPicker.tsx`

- Uses Google Places Autocomplete for address search
- User can click on map to select location
- Marker is draggable for fine-tuning
- Coordinates come directly from Google Places API selection

#### B. IntelligentAddressPicker (Advanced)
**File**: `frontend/src/components/IntelligentAddressPicker.tsx`

- Uses UK Address Service (GetAddress.io) for postcode-based searches
- Provides property-level accuracy with Royal Mail PAF data
- Falls back to Google Places API for non-UK addresses or venue names
- Better for precise UK addresses

### 5. Coordinate Sources Comparison

| Source | Accuracy | When Used |
|--------|----------|-----------|
| Google Places (Frontend) | High - user selects exact location on map | Admin uses VenueLocationPicker |
| UK Address Service (Frontend) | Very High - property-level from PAF | Admin uses IntelligentAddressPicker with postcode |
| Google Geocoding (Backend) | Variable - depends on address quality | Address changes without frontend coordinates |

### 6. Form Validation Gap

**File**: `frontend/src/pages/admin/VenueManagement.tsx:683-696`

```typescript
const isFormValid = () => {
  return (
    formData.name.trim() !== '' &&
    formData.address.trim() !== '' &&
    formData.city.trim() !== '' &&
    formData.postalCode.trim() !== '' &&
    formData.capacity.trim() !== '' &&
    // ... other required fields
  );
};
```

**NO coordinate validation** - venues can be created without location selection, relying entirely on backend geocoding which may be less accurate.

### 7. Location Verification at Check-in

**File**: `backend/api/models.py:1265-1307`

When staff check in, the system verifies their location:

```python
def verify_location(self, lat, lng):
    if not (self.latitude and self.longitude):
        return False  # Blocks check-in if no coordinates!

    # Primary: Google Distance Matrix API
    result = gmaps.distance_matrix(
        origins=f"{lat},{lng}",
        destinations=f"{self.latitude},{self.longitude}",
        mode="walking"
    )
    distance = result['rows'][0]['elements'][0]['distance']['value']
    return distance <= self.check_radius
```

If coordinates are wrong, staff will be incorrectly blocked from checking in even when physically present.

## The BIMM Institute Example

For a venue like "BIMM Institute Brighton", here's what happens in each scenario:

### Scenario A: Admin uses location picker
1. Types "BIMM Institute Brighton" in search
2. Google Places returns suggestions including the exact location
3. Admin selects the correct result from dropdown
4. **Coordinates come from Google Places API directly** - HIGH accuracy
5. Frontend sends: `latitude: 50.8238, longitude: -0.1374` (example)

### Scenario B: Admin manually enters address
1. Types "BIMM Institute" in address field
2. Types "Brighton" in city field
3. Types "BN1 4FA" in postal code field
4. **NO location picker selection**
5. Frontend sends: `latitude: undefined, longitude: undefined`
6. Backend geocodes: `"BIMM Institute, Brighton, BN1 4FA, United Kingdom"`
7. **Accuracy depends on Google's interpretation** - VARIABLE

### Scenario C: Admin enters partial/wrong address
1. Types "BIMM" in address field
2. Backend geocodes: `"BIMM, Brighton, BN1 4FA, United Kingdom"`
3. **May return completely wrong location** - LOW accuracy

## Architecture Insights

### Coordinate Priority System
```
Frontend Coordinates (if provided)
         ↓
    Backend saves as-is

Frontend Coordinates (if NOT provided)
         ↓
    Backend auto-geocodes from address string
```

### Trust Model
The system implicitly trusts:
1. Google Places API selections (highest trust)
2. UK Address Service data (high trust)
3. Google Geocoding API results (medium trust - depends on address quality)

### No Cross-Validation
There is NO mechanism to verify that:
- Frontend coordinates match the typed address
- Backend geocoding result matches user intent
- Coordinates are actually within the expected city/region

## Code References

### Backend Files
- `backend/api/models.py:1179-1307` - Venue model with coordinate handling
- `backend/api/models.py:1224-1248` - `update_coordinates()` geocoding method
- `backend/api/models.py:1250-1263` - `save()` override with auto-geocoding
- `backend/api/models.py:1265-1307` - `verify_location()` for check-in
- `backend/api/serializers.py:287-318` - VenueSerializer (no coordinate validation)
- `backend/api/views.py:1059-1260` - VenueViewSet API endpoints
- `backend/core/settings.py:367` - Google Maps API key configuration

### Frontend Files
- `frontend/src/pages/admin/VenueManagement.tsx:473-516` - Venue creation handler
- `frontend/src/pages/admin/VenueManagement.tsx:683-696` - Form validation (no coord check)
- `frontend/src/components/VenueLocationPicker.tsx` - Basic location picker
- `frontend/src/components/IntelligentAddressPicker.tsx` - Advanced address picker
- `frontend/src/services/addressResolutionService.ts` - Multi-strategy address resolution
- `frontend/src/services/ukAddressService.ts` - UK-specific address lookup

### API Configuration
- Backend API key: `backend/.env:13` - `GOOGLE_MAPS_API_KEY`
- Frontend API key: `frontend/.env` - `VITE_GOOGLE_MAPS_API_KEY` (currently NOT set)

## Recommendations

### 1. Make Location Selection Required (High Priority)
Add validation to require coordinates before venue creation:

```typescript
const isFormValid = () => {
  return (
    // ... existing validation
    selectedLocation?.latitude !== undefined &&
    selectedLocation?.longitude !== undefined
  );
};
```

### 2. Add Coordinate Verification UI
Show a mini-map preview with the geocoded location before saving, allowing admin to confirm or adjust.

### 3. Implement Address-Coordinate Cross-Validation
Add backend validation that checks if geocoded coordinates are within expected region:

```python
def validate_coordinates(self):
    if self.city and self.latitude and self.longitude:
        # Reverse geocode to verify city matches
        result = gmaps.reverse_geocode((self.latitude, self.longitude))
        # Check if city component matches self.city
```

### 4. Add Coordinate Audit Logging
Log when coordinates are auto-generated vs. user-selected to track accuracy issues:

```python
self.coordinate_source = 'geocoding' if auto_geocoded else 'user_selected'
```

### 5. Configure Frontend API Key
The frontend Google Maps API key (`VITE_GOOGLE_MAPS_API_KEY`) is currently empty in `.env`, which may cause location picker issues.

## Open Questions

1. **Should venues without coordinates be blocked from having shifts assigned?** Currently, shifts at venues with no coordinates will fail location verification.

2. **Should there be a coordinate accuracy threshold?** Google Geocoding can return varying accuracy levels (rooftop, range_interpolated, geometric_center, approximate).

3. **Should admins be required to verify auto-geocoded locations?** A confirmation step could prevent silent geocoding errors.

4. **How should the system handle UK vs. international venues?** The IntelligentAddressPicker is UK-optimized; international venues may have lower accuracy.

---

## Follow-up Research: Deputy App Location Management (2026-01-09)

### How Deputy Handles Location/Coordinates

Based on research from Deputy's help center documentation, here's how they approach the venue location problem:

### Deputy's Geofencing System

**Source**: [Enable Geofence in Deputy](https://help.deputy.com/hc/en-au/articles/4657686206095-Enable-Geofence-in-Deputy)

#### 1. Location Setup Process

Deputy requires admins to:
1. **Accurately record the address** in the Location tab first
2. **View it on a map** before enabling geofencing
3. **Adjust the geofence radius** using a slider (100m - 1km)

**Key Quote**:
> "Firstly, ensure that the address of your location is accurately recorded in the Location tab. Select the Location you wish to configure Geofencing for and click on Edit Settings."

**This means**: Deputy makes the admin visually verify the location on a map before configuring geofencing - they don't blindly trust geocoding.

#### 2. Geofence Radius Configuration

Deputy allows configurable radius:
- **Minimum**: 100m (to account for GPS inaccuracy)
- **Maximum**: 1km
- **Reasoning**: "Due to the varied accuracy of GPS, we chose 100m as the most commonly requested minimum. Anything smaller than that could increase false positives."

**Your system**: Currently uses 50m default, which Deputy considers too aggressive.

#### 3. Distance Calculation Method

**Source**: Deputy FAQ

> "The distance used is the most direct straight line measurement (also known as 'as the crow flies') between the user clocking on or off and the workplace location. It does not take into account walking or driving distances."

**Your system**: Uses Google Distance Matrix API with `mode="walking"` which calculates actual walking distance. This is MORE accurate but also more expensive (API calls).

#### 4. Soft vs Hard Enforcement

Deputy offers TWO modes:

| Mode | Behavior |
|------|----------|
| **Notification Only** | Manager gets alert when staff clocks in far from location, but staff NOT blocked |
| **Geofence (Block)** | Staff physically blocked from clocking in if outside radius |

**Your system**: Only has hard enforcement (blocks check-in if outside radius).

#### 5. Location Accuracy Disclaimer

**Source**: [Deputy and Location Accuracy](https://help.deputy.com/hc/en-au/articles/4755734665871-Deputy-and-location-accuracy)

Deputy explicitly states:
> "Deputy cannot guarantee exact location accuracy. The location position shown in Deputy, based on these factors, is meant to serve as a record of the **approximate location** at the time of the clock in/out event, and should generally not be used as evidence of the **exact location** of the device."

Factors affecting accuracy:
- Hardware device capabilities
- Carrier network connection
- IP address mapping
- Wi-Fi location mapping
- Radio interference

### Comparison: Your System vs Deputy

| Feature | Your System | Deputy |
|---------|------------|--------|
| **Min geofence radius** | 50m (default) | 100m minimum |
| **Max geofence radius** | No limit | 1km |
| **Distance calculation** | Walking distance (Google API) | Straight-line (Haversine) |
| **Location setup** | Address text → geocode OR map picker | Address + map verification required |
| **Soft enforcement** | No | Yes (notification mode) |
| **Hard enforcement** | Yes (blocks check-in) | Yes (geofence mode) |
| **GPS accuracy buffer** | 20m max on frontend | Not specified |
| **Coordinate source** | Dual (frontend picker OR backend geocode) | Single (admin sets via UI) |
| **Coordinate validation** | None | Visual map confirmation |

### Key Lessons from Deputy

#### 1. Visual Verification is Critical
Deputy makes admins see the location on a map before configuring geofencing. This catches geocoding errors before they affect staff.

**Recommendation**: Add a mandatory map preview step when saving venues.

#### 2. 100m Minimum Radius is Industry Standard
Deputy chose 100m as minimum because GPS is inherently inaccurate. Your 50m default is aggressive and may cause false rejections.

**Recommendation**: Increase default `check_radius` to 100m.

#### 3. Soft Enforcement Option
Deputy allows managers to receive notifications without blocking staff. This is useful during initial setup or for venues with GPS issues.

**Recommendation**: Add a "notification only" mode as an alternative to blocking.

#### 4. Straight-Line vs Walking Distance
Deputy uses simple Haversine (straight-line) distance, not walking distance. This is:
- Faster (no API call needed)
- More predictable
- Potentially less accurate for complex environments

**Your approach** (walking distance via Google API) is more accurate but adds:
- API cost per check-in
- Dependency on Google API availability
- Potential latency

#### 5. Transparency About Accuracy
Deputy explicitly tells users that location is "approximate" and shouldn't be used as exact evidence. This sets appropriate expectations.

**Recommendation**: Add similar messaging to your UI.

### Implementation Suggestions Based on Deputy's Approach

#### 1. Mandatory Map Verification
```typescript
// VenueManagement.tsx - Add map confirmation step
const [locationConfirmed, setLocationConfirmed] = useState(false);

const isFormValid = () => {
  return (
    // ... existing validation
    locationConfirmed && // Admin must confirm location on map
    selectedLocation?.latitude !== undefined
  );
};
```

#### 2. Configurable Enforcement Mode
```python
# models.py - Add enforcement mode to Venue
class Venue(models.Model):
    ENFORCEMENT_CHOICES = [
        ('block', 'Block check-in outside radius'),
        ('notify', 'Notify manager only'),
        ('none', 'No location verification'),
    ]
    location_enforcement = models.CharField(
        max_length=10,
        choices=ENFORCEMENT_CHOICES,
        default='block'
    )
```

#### 3. Increase Default Radius
```python
# models.py - Change default
check_radius = models.IntegerField(
    default=100,  # Changed from 50 to match industry standard
    help_text="Radius in meters for location verification (min 100m recommended)"
)
```

#### 4. Add Location Accuracy Display
Show staff their GPS accuracy when checking in, similar to Deputy:
> "You are currently 45m from your assigned work location (accuracy: ±15m)"

### Sources

- [Deputy - Enable Geofence](https://help.deputy.com/hc/en-au/articles/4657686206095-Enable-Geofence-in-Deputy)
- [Deputy - Location Capture and Data Access](https://help.deputy.com/hc/en-au/articles/4753129803535-Deputy-Mobile-apps-Location-capture-and-data-access)
- [Deputy - Location Accuracy](https://help.deputy.com/hc/en-au/articles/4755734665871-Deputy-and-location-accuracy)
- [Deputy - Location Capture FAQs](https://help.deputy.com/hc/en-au/articles/4755748286223-Location-capture-FAQs)
