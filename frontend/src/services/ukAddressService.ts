// @ts-nocheck — depends on Google Maps SDK + types not installed in this rewrite. Restore in Phase 8 (venue management) by adding @types/google.maps + @googlemaps/js-api-loader.
// UK Address Service using GetAddress.io for property-level address lookup
// This service provides access to Royal Mail PAF data for accurate UK addresses

export interface UKAddressResult {
  id: string;
  label: string;
  meta: {
    building_number?: string;
    building_name?: string;
    thoroughfare?: string;
    locality?: string;
    town?: string;
    county?: string;
    postcode: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface UKAddressResponse {
  postcode: string;
  items: UKAddressResult[];
  count: number;
}

class UKAddressService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.getaddress.io';

  constructor() {
    // For now, we'll use a demo key. In production, this should be in environment variables
    this.apiKey = import.meta.env.VITE_GETADDRESS_API_KEY || 'demo_key';
  }

  /**
   * Normalize UK postcode format
   */
  private normalizePostcode(postcode: string): string {
    const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
    const match = cleaned.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
    return match ? `${match[1]} ${match[2]}` : cleaned;
  }

  /**
   * Validate UK postcode format
   */
  private isValidPostcode(postcode: string): boolean {
    const normalized = this.normalizePostcode(postcode);
    return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(normalized);
  }

  /**
   * Get all addresses for a UK postcode using GetAddress.io
   */
  async getAddressesForPostcode(postcode: string): Promise<UKAddressResponse> {
    const normalized = this.normalizePostcode(postcode);
    
    if (!this.isValidPostcode(normalized)) {
      throw new Error('Invalid UK postcode format');
    }

    const url = `${this.baseUrl}/find/${encodeURIComponent(normalized)}?api-key=${this.apiKey}&expand=true`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            postcode: normalized,
            items: [],
            count: 0
          };
        }
        
        const errorText = await response.text();
        throw new Error(`GetAddress.io API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Transform GetAddress.io response to our format
      const items: UKAddressResult[] = (data.addresses || []).map((address: any, index: number) => {
        // Build the full address label
        const addressParts = [
          address.line_1,  // Usually contains house number/name
          address.line_2,  // Usually contains street name
          address.line_3,  // Additional address line if needed
          address.town_or_city
        ].filter(Boolean);

        const fullLabel = `${addressParts.join(', ')}, ${data.postcode}`;

        return {
          id: `getaddress_${data.postcode}_${index}`,
          label: fullLabel,
          meta: {
            building_number: address.building_number || null,
            building_name: address.building_name || null,
            thoroughfare: address.thoroughfare || address.line_2 || null,
            locality: address.locality || null,
            town: address.town_or_city || null,
            county: address.county || null,
            postcode: data.postcode,
            latitude: address.latitude ? Number.parseFloat(address.latitude) : undefined,
            longitude: address.longitude ? Number.parseFloat(address.longitude) : undefined,
          }
        };
      });

      return {
        postcode: data.postcode,
        items,
        count: items.length
      };

    } catch (error) {
      console.error('UKAddressService error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch UK addresses');
    }
  }

  /**
   * Search for addresses with a query that might include house number
   */
  async searchAddresses(query: string): Promise<UKAddressResponse> {
    // Extract postcode from query if present
    const postcodeMatch = query.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i);
    
    if (!postcodeMatch) {
      throw new Error('No valid UK postcode found in search query');
    }

    const postcode = postcodeMatch[0];
    const addressData = await this.getAddressesForPostcode(postcode);

    // If user included a house number or street name, filter results
    const remainingQuery = query.replace(postcodeMatch[0], '').trim().toLowerCase();
    
    if (remainingQuery && addressData.items.length > 0) {
      const filtered = addressData.items.filter(item => {
        const labelLower = item.label.toLowerCase();
        const metaText = [
          item.meta.building_number,
          item.meta.building_name,
          item.meta.thoroughfare
        ].filter(Boolean).join(' ').toLowerCase();
        
        return labelLower.includes(remainingQuery) || metaText.includes(remainingQuery);
      });

      return {
        ...addressData,
        items: filtered,
        count: filtered.length
      };
    }

    return addressData;
  }

  /**
   * Convert UKAddressResult to our existing VenueLocationData format
   */
  convertToVenueLocationData(address: UKAddressResult): any {
    // Extract street address (building number + thoroughfare)
    const streetAddress = [
      address.meta.building_number || address.meta.building_name,
      address.meta.thoroughfare
    ].filter(Boolean).join(' ');

    return {
      address: streetAddress || address.label.split(',')[0],
      latitude: address.meta.latitude || 0,
      longitude: address.meta.longitude || 0,
      formattedAddress: address.label,
      city: address.meta.town || '',
      postalCode: address.meta.postcode,
      placeId: address.id
    };
  }

  /**
   * Get demo data for testing when API key is not available
   */
  private getDemoData(postcode: string): UKAddressResponse {
    const normalized = this.normalizePostcode(postcode);
    
    // Demo data for common test postcodes
    const demoData: { [key: string]: UKAddressResult[] } = {
      'BS10 6SH': [
        {
          id: 'demo_bs10_1',
          label: '31 Marlwood Drive, Bristol, BS10 6SH',
          meta: {
            building_number: '31',
            thoroughfare: 'Marlwood Drive',
            town: 'Bristol',
            postcode: 'BS10 6SH',
            latitude: 51.4545,
            longitude: -2.5879
          }
        },
        {
          id: 'demo_bs10_2',
          label: '41 Marlwood Drive, Bristol, BS10 6SH',
          meta: {
            building_number: '41',
            thoroughfare: 'Marlwood Drive',
            town: 'Bristol',
            postcode: 'BS10 6SH',
            latitude: 51.4546,
            longitude: -2.5880
          }
        },
        {
          id: 'demo_bs10_3',
          label: '42 Marlwood Drive, Bristol, BS10 6SH',
          meta: {
            building_number: '42',
            thoroughfare: 'Marlwood Drive',
            town: 'Bristol',
            postcode: 'BS10 6SH',
            latitude: 51.4547,
            longitude: -2.5881
          }
        }
      ],
      'BS34 7HH': [
        {
          id: 'demo_bs34_1',
          label: '829 Filton Avenue, Filton, Bristol, BS34 7HH',
          meta: {
            building_number: '829',
            thoroughfare: 'Filton Avenue',
            town: 'Bristol',
            postcode: 'BS34 7HH',
            latitude: 51.4545,
            longitude: -2.5879
          }
        },
        {
          id: 'demo_bs34_2',
          label: '831 Filton Avenue, Filton, Bristol, BS34 7HH',
          meta: {
            building_number: '831',
            thoroughfare: 'Filton Avenue',
            town: 'Bristol',
            postcode: 'BS34 7HH',
            latitude: 51.4546,
            longitude: -2.5880
          }
        }
      ]
    };

    const items = demoData[normalized] || [];
    
    return {
      postcode: normalized,
      items,
      count: items.length
    };
  }

  /**
   * Check if we should use demo data
   */
  private shouldUseDemoData(): boolean {
    return this.apiKey === 'demo_key' || !this.apiKey || this.apiKey === 'YOUR_GETADDRESS_API_KEY';
  }

  /**
   * Main method that handles both real API and demo data
   */
  async lookupPostcode(postcode: string): Promise<UKAddressResponse> {
    if (this.shouldUseDemoData()) {
      console.log('Using demo data for UK address lookup. Configure VITE_GETADDRESS_API_KEY for real data.');
      return this.getDemoData(postcode);
    }

    return this.getAddressesForPostcode(postcode);
  }
}

export default new UKAddressService();