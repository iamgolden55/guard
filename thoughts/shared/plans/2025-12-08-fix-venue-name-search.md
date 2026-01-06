# Fix Venue Name Search in Intelligent Address Picker

## Overview

When users search for a venue by name (e.g., "BIMM INSTITUTE") instead of postcode, the Smart Search falls back to low-quality results because Google Places API services aren't properly initialized. This plan fixes the race condition and ensures venue name searches work correctly.

## Current State Analysis

### The Issue
When searching "BIMM INSTITUTE", the system shows:
- "BIMM INSTITUTE, UK" - 30% confidence (Source: Address Validation)
- "BIMM INstreetITUTE" - 30% confidence (Source: Address Validation)

These are garbage results from the fallback Strategy 6, not real venue locations.

### Root Cause
Race condition in service initialization:

1. `AddressResolutionService` singleton is created at module load time
2. Constructor tries to initialize Google Maps services
3. Google Maps script only loads when `MapComponent` renders
4. If services aren't ready, `performTextSearch()` returns `[]`
5. System falls back to Strategy 6 which just creates text variations

### Code Evidence
- `addressResolutionService.ts:551-554`: Returns empty if `placesService` is null
- `addressResolutionService.ts:148-160`: Strategy 4 (Text Search) should handle venue names
- `addressResolutionService.ts:56-86`: Service tries initialization for 10 seconds then gives up

## Desired End State

1. Users can search for venues by name (e.g., "BIMM INSTITUTE", "Tesco Bristol", "Colston Hall")
2. Google Places Text Search returns real results with full addresses
3. Service gracefully handles initialization timing issues
4. Clear feedback when services are unavailable

### Verification
- [ ] Search "BIMM INSTITUTE" returns the actual BIMM Institute Bristol with address
- [ ] Search "Tesco Filton" returns Tesco stores in Filton area
- [ ] Console shows "performTextSearch result: { status: OK, count: X }"
- [ ] No fallback to "Address Validation" source for venue name searches

## What We're NOT Doing

- Changing the postcode lookup functionality (Strategy 1)
- Modifying the UK Address Service integration
- Adding new third-party APIs
- Changing the overall search strategy order

## Implementation Approach

Fix the race condition by implementing lazy initialization with retry logic in the `AddressResolutionService`.

## Phase 1: Fix Service Initialization Race Condition

### Overview
Ensure Google Maps services are properly initialized before use, with retry logic.

### Changes Required:

#### 1. Update AddressResolutionService initialization
**File**: `frontend/src/services/addressResolutionService.ts`

**Change 1**: Add lazy initialization with retry in `resolveAddress()`

Replace lines 91-99:
```typescript
async resolveAddress(query: string): Promise<AddressResolutionResult> {
    const result: AddressResolutionResult = {
      query,
      exactMatches: [],
      postcodeExpansions: [],
      suggestedAlternatives: [],
      hasMoreResults: false,
      totalResults: 0
    };
```

With:
```typescript
async resolveAddress(query: string): Promise<AddressResolutionResult> {
    // Ensure services are initialized before resolving
    await this.ensureServicesInitialized();

    const result: AddressResolutionResult = {
      query,
      exactMatches: [],
      postcodeExpansions: [],
      suggestedAlternatives: [],
      hasMoreResults: false,
      totalResults: 0
    };
```

**Change 2**: Add `ensureServicesInitialized()` method after line 86:

```typescript
  /**
   * Ensure Google Maps services are initialized before use
   * This handles the race condition where the service is created before Google Maps loads
   */
  private async ensureServicesInitialized(): Promise<void> {
    // If services are already initialized, return immediately
    if (this.geocoder && this.placesService && this.autocompleteService) {
      return;
    }

    // Wait for Google Maps to be available
    const maxWaitTime = 15000; // 15 seconds
    const checkInterval = 100; // 100ms
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      if (window.google?.maps?.Geocoder) {
        // Initialize services
        this.geocoder = new google.maps.Geocoder();

        if (window.google.maps.places?.PlacesService && window.google.maps.places?.AutocompleteService) {
          const dummyMap = new google.maps.Map(document.createElement('div'));
          this.placesService = new google.maps.places.PlacesService(dummyMap);
          this.autocompleteService = new google.maps.places.AutocompleteService();
          console.log('AddressResolutionService: Services initialized successfully via ensureServicesInitialized');
          return;
        } else {
          console.warn('AddressResolutionService: Google Maps loaded but Places API not available. Check API key permissions.');
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    console.warn('AddressResolutionService: Timed out waiting for Google Maps. Services may not work correctly.');
  }
```

**Change 3**: Improve error handling in `performTextSearch()` (line 551-577):

Replace:
```typescript
private async performTextSearch(query: string): Promise<AddressOption[]> {
    if (!this.placesService) {
      return [];
    }
```

With:
```typescript
private async performTextSearch(query: string): Promise<AddressOption[]> {
    if (!this.placesService) {
      console.warn('performTextSearch: PlacesService not available. Attempting re-initialization...');
      await this.ensureServicesInitialized();

      if (!this.placesService) {
        console.error('performTextSearch: PlacesService still not available after re-initialization. Check if Google Places API is enabled for your API key.');
        return [];
      }
    }
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] No console errors on page load

#### Manual Verification:
- [ ] Search "BIMM INSTITUTE" returns real venue results from Google Places
- [ ] Console shows "performTextSearch result: { status: OK, count: X }" with X > 0
- [ ] Results show "Source: places" not "Source: address_validation"
- [ ] Confidence is 95% (as set in line 567) not 30%

---

## Phase 2: Improve User Feedback for Service Unavailability

### Overview
Add clear user feedback when Google Maps services are unavailable.

### Changes Required:

#### 1. Update IntelligentAddressPicker to show service status
**File**: `frontend/src/components/IntelligentAddressPicker.tsx`

**Change 1**: Add service status state after line 78:

```typescript
const [serviceStatus, setServiceStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
```

**Change 2**: Add service check effect after line 99:

```typescript
// Check if address resolution service is ready
useEffect(() => {
  const checkServices = async () => {
    try {
      // Trigger service initialization check
      if (window.google?.maps?.places) {
        setServiceStatus('ready');
      } else {
        // Wait a bit and check again
        setTimeout(() => {
          if (window.google?.maps?.places) {
            setServiceStatus('ready');
          } else {
            setServiceStatus('error');
          }
        }, 5000);
      }
    } catch {
      setServiceStatus('error');
    }
  };

  checkServices();
}, []);
```

**Change 3**: Add warning message before search input (after line 343):

```typescript
{serviceStatus === 'error' && (
  <MessageBar
    messageBarType={MessageBarType.warning}
    isMultiline={true}
  >
    <strong>Limited Search Mode:</strong> Google Places API is not available.
    Venue name searches may not work. Try searching with a UK postcode instead
    (e.g., "BS34 7HH").
  </MessageBar>
)}

{serviceStatus === 'initializing' && (
  <MessageBar messageBarType={MessageBarType.info}>
    Initializing address search services...
  </MessageBar>
)}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] No type errors in IntelligentAddressPicker.tsx

#### Manual Verification:
- [ ] "Initializing..." message shows briefly on component load
- [ ] Message disappears once Google Maps is ready
- [ ] If Places API fails, warning message appears

---

## Phase 3: Add Fallback to Basic Google Places Autocomplete

### Overview
When Text Search fails, fall back to the working VenueLocationPicker autocomplete flow.

### Changes Required:

#### 1. Update search strategies in addressResolutionService
**File**: `frontend/src/services/addressResolutionService.ts`

**Change**: Improve Strategy 5 (Places Autocomplete) to work better for venue names.

After Strategy 4 (around line 161), update Strategy 5:

```typescript
// Strategy 5: Places API autocomplete for additional suggestions
// This is especially useful for venue names when Text Search fails
if (result.exactMatches.length === 0) {
  console.log('Strategy 5: Using Places Autocomplete as primary source');
}

const placesResults = await this.getPlacesSuggestions(query);

// If this is a venue name search (not postcode) and no exact matches yet,
// treat autocomplete results as higher confidence
if (!this.isPostcode(query) && result.exactMatches.length === 0 && placesResults.length > 0) {
  // Boost confidence for autocomplete results when they're our best option
  const boostedResults = placesResults.map(addr => ({
    ...addr,
    confidence: Math.max(addr.confidence, 0.85) // Boost to at least 85%
  }));
  result.exactMatches = boostedResults;
  console.log(`Promoted ${boostedResults.length} autocomplete results to exact matches`);
} else {
  result.suggestedAlternatives = placesResults.filter(addr =>
    !result.exactMatches.some(exact => exact.placeId === addr.placeId) &&
    !result.postcodeExpansions.some(postcode => postcode.placeId === addr.placeId)
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `npm run build`
- [ ] No runtime errors in console

#### Manual Verification:
- [ ] Even if Text Search fails, autocomplete provides usable results
- [ ] Venue name searches show results in "Exact Matches" section
- [ ] Results have reasonable confidence (85%+)

---

## Testing Strategy

### Unit Tests:
- Service initialization handles timing edge cases
- `ensureServicesInitialized()` retries properly
- Fallback logic promotes autocomplete results correctly

### Integration Tests:
- End-to-end venue search flow works
- Service handles page refresh gracefully
- Multiple search queries don't cause race conditions

### Manual Testing Steps:
1. Open venue management page
2. Click "Add Venue"
3. Wait for map to load
4. Type "BIMM INSTITUTE" in search
5. Verify Google Places results appear (not "Address Validation" fallback)
6. Type "Tesco Bristol" - verify Tesco locations appear
7. Type "BS34 7HH" - verify postcode search still works
8. Refresh page and repeat to test initialization

## Performance Considerations

- `ensureServicesInitialized()` uses exponential backoff could be considered for future optimization
- Currently uses 100ms polling which is reasonable
- 15 second timeout prevents indefinite waiting

## References

- Original code: `frontend/src/services/addressResolutionService.ts`
- Component: `frontend/src/components/IntelligentAddressPicker.tsx`
- Map loading: `frontend/src/components/MapComponent.working.tsx`
- Google Places API docs: https://developers.google.com/maps/documentation/places/web-service/text-search