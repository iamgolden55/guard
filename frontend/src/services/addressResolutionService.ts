// @ts-nocheck — depends on Google Maps SDK + types not installed in this rewrite. Restore in Phase 8 (venue management) by adding @types/google.maps + @googlemaps/js-api-loader.
import { VenueLocationData } from '../components/VenueLocationPicker';
import ukAddressService, { UKAddressResult } from './ukAddressService';

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface AddressOption {
  placeId: string;
  formattedAddress: string;
  streetNumber?: string;
  streetName?: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  addressComponents: AddressComponent[];
  source: 'geocoding' | 'places' | 'address_validation' | 'postcode_expansion';
  confidence: number;
  buildingType?: 'residential' | 'commercial' | 'mixed';
}

export interface PostcodeArea {
  postcode: string;
  district: string;
  ward: string;
  county: string;
  country: string;
  latitude: number;
  longitude: number;
  addresses?: AddressOption[];
}

export interface AddressResolutionResult {
  query: string;
  exactMatches: AddressOption[];
  postcodeExpansions: AddressOption[];
  suggestedAlternatives: AddressOption[];
  postcodeArea?: PostcodeArea;
  hasMoreResults: boolean;
  totalResults: number;
}

class AddressResolutionService {
  private geocoder: google.maps.Geocoder | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private autocompleteService: google.maps.places.AutocompleteService | null = null;

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    // Wait for Google Maps to load
    let attempts = 0;
    const maxAttempts = 20;

    const waitForGoogleMaps = () => {
      if (window.google?.maps?.Geocoder) {
        this.geocoder = new google.maps.Geocoder();

        if (window.google.maps.places?.PlacesService && window.google.maps.places?.AutocompleteService) {
          // Create a dummy map element for PlacesService
          const dummyMap = new google.maps.Map(document.createElement('div'));
          this.placesService = new google.maps.places.PlacesService(dummyMap);
          this.autocompleteService = new google.maps.places.AutocompleteService();
        }

        console.log('AddressResolutionService: Google Maps services initialized. Places:', !!window.google.maps.places);
      } else {
        console.warn('AddressResolutionService: Geocoder found, but Places Service missing or incomplete.');
        attempts++;

        if (attempts < maxAttempts) {
          setTimeout(waitForGoogleMaps, 500);
        } else {
          console.warn('AddressResolutionService: Google Maps not available after maximum attempts');
        }
      }
    };

    waitForGoogleMaps();
  }

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

  /**
   * Main method for intelligent address resolution
   */
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

    try {
      // Strategy 1: Check if input is a UK postcode and use UK Address Service
      if (this.isPostcode(query)) {
        console.log('Using UK Address Service for postcode:', query);

        try {
          const ukAddresses = await ukAddressService.lookupPostcode(query);

          if (ukAddresses.items.length > 0) {
            // Convert UK addresses to our format
            const convertedAddresses = ukAddresses.items.map(ukAddr => this.convertUKAddressToAddressOption(ukAddr));
            result.postcodeExpansions = convertedAddresses;

            // Set postcode area info
            result.postcodeArea = {
              postcode: ukAddresses.postcode,
              district: ukAddresses.items[0]?.meta.locality || '',
              ward: '',
              county: ukAddresses.items[0]?.meta.county || '',
              country: 'United Kingdom',
              latitude: ukAddresses.items[0]?.meta.latitude || 0,
              longitude: ukAddresses.items[0]?.meta.longitude || 0,
              addresses: convertedAddresses
            };

            result.totalResults = convertedAddresses.length;
            console.log(`Found ${result.totalResults} addresses from UK Address Service`);
            return result;
          }
        } catch (ukError) {
          console.warn('UK Address Service failed, falling back to Google Maps:', ukError);
        }
      }

      // Strategy 2: Direct geocoding for exact matches (fallback or non-postcode queries)
      const geocodingResults = await this.performGeocoding(query);
      result.exactMatches = geocodingResults.filter(addr => addr.confidence >= 0.8);

      // Strategy 3: If still a postcode, try our Google Maps expansion
      if (this.isPostcode(query) && result.exactMatches.length === 0) {
        const postcodeExpansion = await this.expandPostcode(query);
        result.postcodeExpansions = postcodeExpansion.addresses || [];
        result.postcodeArea = postcodeExpansion;
      }


      // Strategy 4: Places API Text Search (performTextSearch) - robust search for venue names
      if (result.exactMatches.length === 0 && !this.isPostcode(query)) {
        console.log('Strategy 4: Attempting Text Search due to no exact matches');
        const placeSearchResults = await this.performTextSearch(query);

        // Add unique results
        const newResults = placeSearchResults.filter(addr =>
          !result.exactMatches.some(exact => exact.placeId === addr.placeId) &&
          !result.postcodeExpansions.some(postcode => postcode.placeId === addr.placeId)
        );

        console.log(`Text Search found ${newResults.length} new results`);
        result.exactMatches.push(...newResults);
      }

      // Strategy 5: Places API autocomplete for additional suggestions
      // This is especially useful for venue names when Text Search fails
      if (result.exactMatches.length === 0 && !this.isPostcode(query)) {
        console.log('Strategy 5: Using Places Autocomplete as primary source for venue name search');
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
        console.log(`Promoted ${boostedResults.length} autocomplete results to exact matches with boosted confidence`);
      } else {
        result.suggestedAlternatives = placesResults.filter(addr =>
          !result.exactMatches.some(exact => exact.placeId === addr.placeId) &&
          !result.postcodeExpansions.some(postcode => postcode.placeId === addr.placeId)
        );
      }

      // Strategy 6: Address validation for comprehensive results
      if (result.exactMatches.length === 0 && result.postcodeExpansions.length === 0) {
        const validationResults = await this.performAddressValidation(query);
        result.suggestedAlternatives.push(...validationResults);
      }

      result.totalResults = result.exactMatches.length + result.postcodeExpansions.length + result.suggestedAlternatives.length;
      result.hasMoreResults = result.totalResults > 20; // Increased limit for UK addresses

      return result;
    } catch (error) {
      console.error('AddressResolutionService: Error resolving address. Full error:', error);
      // Log the state of services for debugging
      console.log('Service State:', {
        hasGeocoder: !!this.geocoder,
        hasPlacesService: !!this.placesService,
        hasAutocomplete: !!this.autocompleteService
      });
      throw new Error('Failed to resolve address. Please try a different search term.');
    }
  }

  /**
   * Perform standard Google Maps geocoding
   */
  private async performGeocoding(address: string): Promise<AddressOption[]> {
    if (!this.geocoder) {
      throw new Error('Geocoder not initialized');
    }

    return new Promise((resolve, reject) => {
      this.geocoder!.geocode(
        {
          address: address,
          region: 'GB',
          componentRestrictions: { country: 'GB' }
        },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results) {
            const options = results.map((result, index) =>
              this.mapGeocoderResultToAddressOption(result, 'geocoding', Math.max(0.9 - index * 0.1, 0.5))
            );
            resolve(options);
          } else {
            console.warn('Geocoding failed:', status);
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Expand postcode to find specific addresses within the area
   */
  private async expandPostcode(postcode: string): Promise<PostcodeArea> {
    const normalizedPostcode = this.normalizePostcode(postcode);

    // First get the postcode area information
    const geocodingResults = await this.performGeocoding(normalizedPostcode);

    if (geocodingResults.length === 0) {
      throw new Error(`No results found for postcode: ${normalizedPostcode}`);
    }

    const primaryResult = geocodingResults[0];
    const postcodeArea: PostcodeArea = {
      postcode: normalizedPostcode,
      district: this.extractAddressComponent(primaryResult.addressComponents, 'sublocality') ||
        this.extractAddressComponent(primaryResult.addressComponents, 'locality') || '',
      ward: this.extractAddressComponent(primaryResult.addressComponents, 'sublocality_level_1') || '',
      county: this.extractAddressComponent(primaryResult.addressComponents, 'administrative_area_level_2') || '',
      country: this.extractAddressComponent(primaryResult.addressComponents, 'country') || 'United Kingdom',
      latitude: primaryResult.latitude,
      longitude: primaryResult.longitude,
      addresses: []
    };

    // Step 1: Use multiple strategies to find specific addresses
    const allAddresses: AddressOption[] = [];

    // Strategy 1: Use Places API autocomplete with specific patterns
    const addressSearchQueries = this.generateTargetedSearchQueries(normalizedPostcode);

    for (const searchQuery of addressSearchQueries) {
      try {
        // Use both geocoding and places API
        const geocodingResults = await this.performGeocoding(searchQuery);
        const placesResults = await this.searchPlacesForAddress(searchQuery);

        // Combine and filter results
        const combinedResults = [...geocodingResults, ...placesResults];
        const validResults = combinedResults.filter(addr =>
          addr.postalCode.replace(/\s/g, '').toLowerCase() === normalizedPostcode.replace(/\s/g, '').toLowerCase()
        );

        allAddresses.push(...validResults);

        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.warn(`Failed to search for addresses with query: ${searchQuery}`, error);
      }
    }

    // Strategy 2: Search for common street patterns in UK
    const streetPatterns = await this.findStreetsInPostcode(normalizedPostcode);
    allAddresses.push(...streetPatterns);

    // Remove duplicates and sort by street name, then house number
    const uniqueAddresses = this.deduplicateAddresses(allAddresses);
    postcodeArea.addresses = uniqueAddresses.sort((a, b) => {
      // First sort by street name
      const aStreet = a.streetName || '';
      const bStreet = b.streetName || '';
      if (aStreet !== bStreet) {
        return aStreet.localeCompare(bStreet);
      }
      // Then by house number
      const aNum = parseInt(a.streetNumber || '0');
      const bNum = parseInt(b.streetNumber || '0');
      return aNum - bNum;
    });

    return postcodeArea;
  }

  /**
   * Find places and establishments within a postcode area
   */
  private async findPlacesInPostcode(postcode: string): Promise<AddressOption[]> {
    if (!this.autocompleteService || !this.placesService) {
      return [];
    }

    // Search for places in the postcode area
    const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
      this.autocompleteService!.getPlacePredictions(
        {
          input: postcode,
          componentRestrictions: { country: 'GB' }
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            resolve(predictions);
          } else {
            resolve([]);
          }
        }
      );
    });

    // Get detailed information for places
    const detailedResults: AddressOption[] = [];
    for (const prediction of predictions.slice(0, 15)) { // Limit results
      try {
        const details = await this.getPlaceDetails(prediction.place_id);
        if (details && details.postalCode.replace(/\s/g, '').toLowerCase() === postcode.replace(/\s/g, '').toLowerCase()) {
          detailedResults.push(details);
        }
      } catch (error) {
        console.warn('Failed to get place details for:', prediction.place_id, error);
      }
    }

    return detailedResults;
  }

  /**
   * Find specific house numbers on a given street using Text Search
   */
  private async findHouseNumbersOnStreet(streetName: string, postcode: string): Promise<AddressOption[]> {
    const addresses: AddressOption[] = [];

    // Use a more targeted approach with Google Places Text Search
    // Try specific house number ranges that are most common
    const targetNumbers = [
      // Try key house numbers that often exist
      1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
      // For Marlwood Drive specifically, try numbers we know might exist
      31, 41, 51, 61, 71, 81, 91
    ];

    // Search in smaller batches to be more API-friendly
    for (let i = 0; i < targetNumbers.length; i += 5) {
      const batch = targetNumbers.slice(i, i + 5);

      for (const num of batch) {
        try {
          const query = `${num} ${streetName}, ${postcode}, UK`;
          const results = await this.performGeocoding(query);

          // Filter to only include results with the exact street and postcode
          const validResults = results.filter(addr => {
            const hasCorrectPostcode = addr.postalCode.replace(/\s/g, '').toLowerCase() === postcode.replace(/\s/g, '').toLowerCase();
            const hasCorrectStreet = addr.streetName && streetName &&
              (addr.streetName.toLowerCase().includes(streetName.toLowerCase()) ||
                streetName.toLowerCase().includes(addr.streetName.toLowerCase()));
            const hasHouseNumber = addr.streetNumber && parseInt(addr.streetNumber) === num;

            return hasCorrectPostcode && hasCorrectStreet && hasHouseNumber;
          });

          addresses.push(...validResults);

          // Small delay to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          console.warn(`Failed to geocode: ${num} ${streetName} ${postcode}`, error);
        }
      }

      // Longer delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return addresses;
  }

  /**
   * Get suggestions from Places API
   */
  private async getPlacesSuggestions(query: string): Promise<AddressOption[]> {
    if (!this.autocompleteService || !this.placesService) {
      return [];
    }

    // Get predictions
    const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
      this.autocompleteService!.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'GB' }
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            resolve(predictions);
          } else {
            resolve([]);
          }
        }
      );
    });

    // Get detailed information for each prediction
    const detailedResults: AddressOption[] = [];
    for (const prediction of predictions.slice(0, 10)) { // Limit to first 10
      try {
        const details = await this.getPlaceDetails(prediction.place_id);
        if (details) {
          detailedResults.push(details);
        }
      } catch (error) {
        console.warn('Failed to get place details for:', prediction.place_id, error);
      }
    }

    return detailedResults;
  }

  /**
   * Get detailed place information
   */
  private async getPlaceDetails(placeId: string): Promise<AddressOption | null> {
    if (!this.placesService) {
      return null;
    }

    return new Promise((resolve) => {
      this.placesService!.getDetails(
        {
          placeId: placeId,
          fields: ['formatted_address', 'geometry', 'address_components', 'name', 'types', 'place_id']
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            const addressOption = this.mapPlaceResultToAddressOption(place, 'places', 0.7);
            resolve(addressOption);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Perform address validation (fallback method)
   */
  private async performAddressValidation(address: string): Promise<AddressOption[]> {
    // This is a fallback that tries various address formats
    const variations = this.generateAddressVariations(address);
    const results: AddressOption[] = [];

    for (const variation of variations) {
      try {
        const geocodingResults = await this.performGeocoding(variation);
        results.push(...geocodingResults);
      } catch (error) {
        console.warn(`Address validation failed for variation: ${variation}`, error);
      }
    }

    return this.deduplicateAddresses(results);
  }

  /**
   * Generate targeted search queries for better address resolution
   */
  private generateTargetedSearchQueries(postcode: string): string[] {
    const queries: string[] = [];

    // Strategy 1: Search for specific house number ranges with postcode
    const commonNumbers = [1, 2, 3, 5, 10, 15, 20, 25, 30, 31, 35, 40, 41, 45, 50, 55, 60];
    commonNumbers.forEach(num => {
      queries.push(`${num} ${postcode}`);
    });

    // Strategy 2: Search for street names + postcode
    const commonStreetNames = [
      'Drive', 'Road', 'Street', 'Avenue', 'Lane', 'Close', 'Way',
      'Gardens', 'Park', 'Crescent', 'Place', 'Court', 'Grove'
    ];
    commonStreetNames.forEach(street => {
      queries.push(`${street} ${postcode}`);
    });

    // Strategy 3: Search with partial postcode for broader results
    const outwardCode = postcode.split(' ')[0]; // e.g., "BS10" from "BS10 6SH"
    if (outwardCode) {
      queries.push(`${outwardCode} drive`);
      queries.push(`${outwardCode} road`);
      queries.push(`${outwardCode} street`);
    }

    return queries.slice(0, 25); // Limit to prevent API abuse
  }

  /**
   * Search for places using the query
   */
  private async searchPlacesForAddress(query: string): Promise<AddressOption[]> {
    if (!this.autocompleteService) {
      return [];
    }

    return new Promise((resolve) => {
      this.autocompleteService!.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'GB' }
        },
        async (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            const detailedResults: AddressOption[] = [];

            // Get details for first few predictions
            for (const prediction of predictions.slice(0, 5)) {
              try {
                const details = await this.getPlaceDetails(prediction.place_id);
                if (details) {
                  detailedResults.push(details);
                }
              } catch (error) {
                console.warn('Failed to get place details:', error);
              }
            }

            resolve(detailedResults);
          } else {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Find place using Text Search (most robust for venue names)
   * Updated to use new Google Places API (Place.searchByText) since legacy PlacesService
   * was deprecated as of March 1st, 2025
   */
  private async performTextSearch(query: string): Promise<AddressOption[]> {
    // Check if new Places API is available
    if (!window.google?.maps?.places?.Place?.searchByText) {
      console.warn('performTextSearch: New Places API (Place.searchByText) not available. Falling back to legacy...');
      return this.performTextSearchLegacy(query);
    }

    try {
      console.log('performTextSearch: Using new Place.searchByText API for query:', query);

      const request = {
        textQuery: query + ' UK', // Bias towards UK results
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'id', 'types'] as const,
        maxResultCount: 10,
        region: 'gb'
      };

      const { places } = await google.maps.places.Place.searchByText(request);

      console.log('performTextSearch result:', { status: 'OK', count: places?.length });

      if (places && places.length > 0) {
        const options = await Promise.all(
          places.map(place => this.mapNewPlaceToAddressOption(place, 0.95))
        );
        return options.filter((opt): opt is AddressOption => opt !== null);
      }

      return [];
    } catch (error) {
      console.error('performTextSearch error with new API:', error);
      // Fallback to legacy if new API fails
      return this.performTextSearchLegacy(query);
    }
  }

  /**
   * Legacy text search using deprecated PlacesService (fallback)
   */
  private async performTextSearchLegacy(query: string): Promise<AddressOption[]> {
    if (!this.placesService) {
      console.warn('performTextSearchLegacy: PlacesService not available.');
      return [];
    }

    return new Promise((resolve) => {
      this.placesService!.textSearch(
        {
          query: query,
        },
        (results, status) => {
          console.log('performTextSearchLegacy result:', { status, count: results?.length });

          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            const options = results.map(place =>
              this.mapPlaceResultToAddressOption(place, 'places', 0.95)
            );
            resolve(options);
          } else {
            console.warn('performTextSearchLegacy failed:', status);
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Map new Place API result to AddressOption
   */
  private async mapNewPlaceToAddressOption(
    place: google.maps.places.Place,
    confidence: number
  ): Promise<AddressOption | null> {
    try {
      const location = place.location;
      const addressComponents = place.addressComponents || [];

      // Convert new address component format to our format
      const components: AddressComponent[] = addressComponents.map(comp => ({
        long_name: comp.longText || '',
        short_name: comp.shortText || '',
        types: comp.types || []
      }));

      return {
        placeId: place.id || '',
        formattedAddress: place.formattedAddress || place.displayName || '',
        streetNumber: this.extractAddressComponent(components, 'street_number'),
        streetName: this.extractAddressComponent(components, 'route'),
        city: this.extractAddressComponent(components, 'locality') ||
          this.extractAddressComponent(components, 'postal_town') || '',
        postalCode: this.extractAddressComponent(components, 'postal_code') || '',
        country: this.extractAddressComponent(components, 'country') || 'United Kingdom',
        latitude: location?.lat() || 0,
        longitude: location?.lng() || 0,
        addressComponents: components,
        source: 'places',
        confidence,
        buildingType: this.determineBuildingType(place.types || [])
      };
    } catch (error) {
      console.error('Error mapping new Place to AddressOption:', error);
      return null;
    }
  }

  /**
   * Find streets in the postcode area
   */
  private async findStreetsInPostcode(postcode: string): Promise<AddressOption[]> {
    const results: AddressOption[] = [];

    // Search for the postcode itself to find what streets exist
    try {
      const postcodeResults = await this.performGeocoding(postcode);

      // Try to extract street information from the results
      if (postcodeResults.length > 0) {
        const primaryResult = postcodeResults[0];

        // Look for route (street name) in address components
        const streetName = this.extractAddressComponent(primaryResult.addressComponents, 'route');

        if (streetName) {
          // Now search for specific house numbers on this street
          const houseNumbers = [1, 5, 10, 15, 20, 25, 30, 31, 35, 40, 41, 45, 50];

          for (const num of houseNumbers.slice(0, 8)) { // Limit to 8 searches
            try {
              const houseQuery = `${num} ${streetName} ${postcode}`;
              const houseResults = await this.performGeocoding(houseQuery);

              const validHouses = houseResults.filter(addr =>
                addr.streetNumber &&
                parseInt(addr.streetNumber) === num &&
                addr.postalCode.replace(/\s/g, '').toLowerCase() === postcode.replace(/\s/g, '').toLowerCase()
              );

              results.push(...validHouses);

              // Small delay
              await new Promise(resolve => setTimeout(resolve, 50));

            } catch (error) {
              console.warn(`Failed to search for ${num} ${streetName}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to find streets in postcode:', error);
    }

    return results;
  }

  /**
   * Generate search queries for finding specific addresses in a postcode
   */
  private generateAddressSearchQueries(postcode: string): string[] {
    const queries: string[] = [];

    // First, try to get street names from the postcode area
    // This is more efficient than trying random house numbers
    queries.push(postcode); // Get the general area first

    // Try searching for common house number patterns with the postcode
    // Focus on smaller ranges to be more targeted
    const smallRanges = [
      [1, 30], [31, 60], [61, 90], [91, 120], [121, 150],
      [151, 180], [181, 210], [211, 240], [241, 270], [271, 300]
    ];

    // Try both odd and even numbers as many UK streets have both
    for (const [start, end] of smallRanges.slice(0, 5)) { // Limit to first 5 ranges
      // Try odd numbers
      for (let i = start; i <= Math.min(start + 15, end); i += 2) {
        queries.push(`${i} ${postcode}`);
      }
      // Try even numbers  
      for (let i = start + 1; i <= Math.min(start + 16, end); i += 2) {
        queries.push(`${i} ${postcode}`);
      }
    }

    // Try common street name patterns to discover street names in the area
    const commonStreetTypes = [
      'Road', 'Street', 'Avenue', 'Lane', 'Close', 'Way', 'Drive',
      'Gardens', 'Park', 'Crescent', 'Place', 'Court', 'Grove'
    ];

    for (const streetType of commonStreetTypes) {
      queries.push(`${streetType} ${postcode}`);
      // Also try with numbers
      queries.push(`1 ${streetType} ${postcode}`);
    }

    return queries.slice(0, 80); // Increased limit but still reasonable
  }

  /**
   * Generate address variations for fallback search
   */
  private generateAddressVariations(address: string): string[] {
    const variations: string[] = [address];

    // Add "UK" if not present
    if (!address.toLowerCase().includes('uk')) {
      variations.push(`${address}, UK`);
    }

    // Try with different formatting
    variations.push(address.replace(/,/g, ''));
    variations.push(address.replace(/\s+/g, ' ').trim());

    // If it looks like a postcode, try nearby postcodes
    if (this.isPostcode(address)) {
      const nearby = this.generateNearbyPostcodes(address);
      variations.push(...nearby);
    }

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Generate nearby postcodes for broader search
   */
  private generateNearbyPostcodes(postcode: string): string[] {
    const normalized = this.normalizePostcode(postcode);
    const parts = normalized.split(' ');

    if (parts.length !== 2) return [];

    const [outward, inward] = parts;
    const inwardNum = parseInt(inward.substring(0, 1));
    const inwardLetters = inward.substring(1);

    const nearby: string[] = [];

    // Try adjacent numbers
    for (let i = Math.max(0, inwardNum - 2); i <= inwardNum + 2; i++) {
      if (i !== inwardNum) {
        nearby.push(`${outward} ${i}${inwardLetters}`);
      }
    }

    return nearby;
  }

  /**
   * Map geocoder result to AddressOption
   */
  private mapGeocoderResultToAddressOption(
    result: google.maps.GeocoderResult,
    source: AddressOption['source'],
    confidence: number
  ): AddressOption {
    const components = result.address_components.map(comp => ({
      long_name: comp.long_name,
      short_name: comp.short_name,
      types: comp.types
    }));

    return {
      placeId: result.place_id,
      formattedAddress: result.formatted_address,
      streetNumber: this.extractAddressComponent(components, 'street_number'),
      streetName: this.extractAddressComponent(components, 'route'),
      city: this.extractAddressComponent(components, 'locality') ||
        this.extractAddressComponent(components, 'sublocality') || '',
      postalCode: this.extractAddressComponent(components, 'postal_code') || '',
      country: this.extractAddressComponent(components, 'country') || 'United Kingdom',
      latitude: result.geometry.location.lat(),
      longitude: result.geometry.location.lng(),
      addressComponents: components,
      source,
      confidence,
      buildingType: this.determineBuildingType(result.types)
    };
  }

  /**
   * Map place result to AddressOption
   */
  private mapPlaceResultToAddressOption(
    place: google.maps.places.PlaceResult,
    source: AddressOption['source'],
    confidence: number
  ): AddressOption {
    const components = place.address_components?.map(comp => ({
      long_name: comp.long_name,
      short_name: comp.short_name,
      types: comp.types
    })) || [];

    return {
      placeId: place.place_id || '',
      formattedAddress: place.formatted_address || '',
      streetNumber: this.extractAddressComponent(components, 'street_number'),
      streetName: this.extractAddressComponent(components, 'route'),
      city: this.extractAddressComponent(components, 'locality') ||
        this.extractAddressComponent(components, 'sublocality') || '',
      postalCode: this.extractAddressComponent(components, 'postal_code') || '',
      country: this.extractAddressComponent(components, 'country') || 'United Kingdom',
      latitude: place.geometry?.location?.lat() || 0,
      longitude: place.geometry?.location?.lng() || 0,
      addressComponents: components,
      source,
      confidence,
      buildingType: this.determineBuildingType(place.types || [])
    };
  }

  /**
   * Extract specific component from address components
   */
  private extractAddressComponent(components: AddressComponent[], type: string): string | undefined {
    const component = components.find(comp => comp.types.includes(type));
    return component?.long_name;
  }

  /**
   * Determine building type from Google Maps types
   */
  private determineBuildingType(types: string[]): AddressOption['buildingType'] {
    if (types.includes('establishment') || types.includes('point_of_interest')) {
      return 'commercial';
    }
    if (types.includes('premise') || types.includes('subpremise')) {
      return 'mixed';
    }
    return 'residential';
  }

  /**
   * Check if string is a UK postcode
   */
  private isPostcode(input: string): boolean {
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
    return ukPostcodeRegex.test(input.trim());
  }

  /**
   * Normalize postcode format
   */
  private normalizePostcode(postcode: string): string {
    const cleaned = postcode.replace(/\s/g, '').toUpperCase();
    if (cleaned.length >= 5) {
      return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
    }
    return cleaned;
  }

  /**
   * Remove duplicate addresses based on coordinates and place ID
   */
  private deduplicateAddresses(addresses: AddressOption[]): AddressOption[] {
    const seen = new Set<string>();
    return addresses.filter(addr => {
      const key = `${addr.placeId}_${addr.latitude.toFixed(6)}_${addr.longitude.toFixed(6)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Convert UK Address Service result to AddressOption
   */
  private convertUKAddressToAddressOption(ukAddress: UKAddressResult): AddressOption {
    return {
      placeId: ukAddress.id,
      formattedAddress: ukAddress.label,
      streetNumber: ukAddress.meta.building_number || undefined,
      streetName: ukAddress.meta.thoroughfare || undefined,
      city: ukAddress.meta.town || '',
      postalCode: ukAddress.meta.postcode,
      country: 'United Kingdom',
      latitude: ukAddress.meta.latitude || 0,
      longitude: ukAddress.meta.longitude || 0,
      addressComponents: [],
      source: 'address_validation', // UK Address Service uses official PAF data
      confidence: 0.95, // High confidence for official PAF data
      buildingType: ukAddress.meta.building_name ? 'commercial' : 'residential'
    };
  }

  /**
   * Convert AddressOption to VenueLocationData
   */
  convertToVenueLocationData(addressOption: AddressOption): VenueLocationData {
    return {
      address: `${addressOption.streetNumber ? addressOption.streetNumber + ' ' : ''}${addressOption.streetName || ''}`.trim() || addressOption.formattedAddress,
      latitude: addressOption.latitude,
      longitude: addressOption.longitude,
      formattedAddress: addressOption.formattedAddress,
      city: addressOption.city,
      postalCode: addressOption.postalCode,
      placeId: addressOption.placeId
    };
  }
}

export default new AddressResolutionService();