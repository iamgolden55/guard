import { AddressOption } from '../services/addressResolutionService';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'missing_street_number' | 'ambiguous_address' | 'incomplete_postcode' | 'coordinates_mismatch' | 'rural_area' | 'new_development';
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export class AddressValidator {
  /**
   * Validate an address option for completeness and accuracy
   */
  static validateAddress(address: AddressOption): ValidationResult {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    let confidence = address.confidence;

    // Check for missing street number
    if (!address.streetNumber && address.buildingType === 'residential') {
      issues.push({
        type: 'missing_street_number',
        message: 'No house number found. This may be a general area rather than a specific address.',
        severity: 'warning'
      });
      suggestions.push('Try adding a house number to your search (e.g., "123 Main Street")');
      confidence *= 0.7;
    }

    // Check for incomplete postcode
    if (!this.isValidUKPostcode(address.postalCode)) {
      issues.push({
        type: 'incomplete_postcode',
        message: 'Postcode appears incomplete or invalid.',
        severity: 'error'
      });
      suggestions.push('Verify the postcode format (e.g., "SW1A 1AA")');
      confidence *= 0.5;
    }

    // Check for ambiguous addresses
    if (address.formattedAddress.toLowerCase().includes('unnamed road') || 
        address.formattedAddress.toLowerCase().includes('unnamed street')) {
      issues.push({
        type: 'ambiguous_address',
        message: 'Address contains unnamed roads which may be difficult to locate.',
        severity: 'warning'
      });
      suggestions.push('Try searching for nearby landmarks or more specific address details');
      confidence *= 0.8;
    }

    // Check for rural areas or new developments
    if (this.isRuralOrNewDevelopment(address)) {
      issues.push({
        type: address.streetName ? 'new_development' : 'rural_area',
        message: address.streetName ? 
          'This appears to be a new development. Address may not be fully established.' :
          'This appears to be a rural area. Precise addressing may be limited.',
        severity: 'info'
      });
      if (!address.streetName) {
        suggestions.push('Consider using the nearest postal address or landmark');
      }
    }

    // Validate coordinates
    if (!this.areValidUKCoordinates(address.latitude, address.longitude)) {
      issues.push({
        type: 'coordinates_mismatch',
        message: 'Coordinates appear to be outside the UK.',
        severity: 'error'
      });
      confidence *= 0.3;
    }

    const isValid = confidence >= 0.6 && !issues.some(issue => issue.severity === 'error');

    return {
      isValid,
      confidence: Math.round(confidence * 100) / 100,
      issues,
      suggestions
    };
  }

  /**
   * Validate UK postcode format
   */
  static isValidUKPostcode(postcode: string): boolean {
    if (!postcode) return false;
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
    return ukPostcodeRegex.test(postcode.trim());
  }

  /**
   * Check if coordinates are within UK bounds
   */
  static areValidUKCoordinates(lat: number, lng: number): boolean {
    // UK bounding box (approximate)
    const UK_BOUNDS = {
      north: 60.9,
      south: 49.9,
      east: 1.8,
      west: -8.2
    };

    return lat >= UK_BOUNDS.south && lat <= UK_BOUNDS.north &&
           lng >= UK_BOUNDS.west && lng <= UK_BOUNDS.east;
  }

  /**
   * Detect rural areas or new developments
   */
  static isRuralOrNewDevelopment(address: AddressOption): boolean {
    const ruralIndicators = [
      'farm', 'cottage', 'barn', 'field', 'lane end', 'moor',
      'development', 'phase', 'plot', 'site'
    ];

    const addressText = address.formattedAddress.toLowerCase();
    return ruralIndicators.some(indicator => addressText.includes(indicator)) ||
           (!address.streetNumber && !address.streetName && address.buildingType === 'residential');
  }

  /**
   * Generate user-friendly validation summary
   */
  static getValidationSummary(validation: ValidationResult): string {
    if (validation.isValid && validation.confidence >= 0.9) {
      return '✅ High confidence address match';
    }
    
    if (validation.isValid && validation.confidence >= 0.7) {
      return '⚠️ Good address match with minor concerns';
    }
    
    if (validation.isValid) {
      return '🔍 Address found but may need verification';
    }
    
    const errorCount = validation.issues.filter(issue => issue.severity === 'error').length;
    const warningCount = validation.issues.filter(issue => issue.severity === 'warning').length;
    
    if (errorCount > 0) {
      return `❌ ${errorCount} error${errorCount > 1 ? 's' : ''} found - address needs correction`;
    }
    
    if (warningCount > 0) {
      return `⚠️ ${warningCount} warning${warningCount > 1 ? 's' : ''} - please review carefully`;
    }
    
    return '❓ Unable to validate address';
  }

  /**
   * Filter and rank addresses by validation quality
   */
  static rankAddressesByQuality(addresses: AddressOption[]): AddressOption[] {
    return addresses
      .map(address => ({
        ...address,
        validation: this.validateAddress(address)
      }))
      .sort((a, b) => {
        // Sort by validation confidence, then by original confidence
        const aScore = (a.validation.confidence * 0.7) + (a.confidence * 0.3);
        const bScore = (b.validation.confidence * 0.7) + (b.confidence * 0.3);
        return bScore - aScore;
      });
  }

  /**
   * Get suggested search improvements based on current query
   */
  static getSuggestedSearchImprovements(query: string, results: AddressOption[]): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase().trim();

    // If it's just a postcode
    if (this.isValidUKPostcode(query) && results.length === 0) {
      suggestions.push('Try adding a house number: "123 ' + query + '"');
      suggestions.push('Try adding a street name: "Main Street ' + query + '"');
    }

    // If no house number provided but results exist
    if (!lowerQuery.match(/^\d+/) && results.some(r => r.streetNumber)) {
      suggestions.push('Add a house number for more specific results');
    }

    // If too few results
    if (results.length === 0) {
      suggestions.push('Check spelling of street names and postcode');
      suggestions.push('Try searching with just the postcode first');
      suggestions.push('Use a nearby landmark or main road');
    }

    // If too many results
    if (results.length > 20) {
      suggestions.push('Add more specific details like house number');
      suggestions.push('Include street name if known');
    }

    return suggestions;
  }
}

/**
 * Fallback address resolution strategies
 */
export class AddressFallbackService {
  /**
   * Attempt to resolve address using alternative methods
   */
  static async attemptFallbackResolution(query: string): Promise<AddressOption[]> {
    const fallbackResults: AddressOption[] = [];

    try {
      // Strategy 1: Try variations of the query
      const variations = this.generateQueryVariations(query);
      
      for (const variation of variations) {
        // This would integrate with the main address resolution service
        // For now, we'll just return the variations as potential suggestions
        if (variation !== query) {
          fallbackResults.push(this.createFallbackAddress(variation, query));
        }
      }

      // Strategy 2: Extract and search postcode only
      const postcodeMatch = query.match(/\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}\b/i);
      if (postcodeMatch && postcodeMatch[0] !== query) {
        fallbackResults.push(this.createFallbackAddress(postcodeMatch[0], query));
      }

      return fallbackResults;
    } catch (error) {
      console.warn('Fallback address resolution failed:', error);
      return [];
    }
  }

  /**
   * Generate query variations for fallback search
   */
  static generateQueryVariations(query: string): string[] {
    const variations: string[] = [];
    const cleaned = query.trim();

    // Remove commas and extra spaces
    variations.push(cleaned.replace(/,/g, ' ').replace(/\s+/g, ' '));

    // Add "UK" if not present
    if (!cleaned.toLowerCase().includes('uk')) {
      variations.push(cleaned + ', UK');
    }

    // Try without house numbers for broader search
    const withoutNumbers = cleaned.replace(/^\d+\s*/, '');
    if (withoutNumbers !== cleaned) {
      variations.push(withoutNumbers);
    }

    // Try common abbreviations
    const abbreviations = {
      'street': 'st',
      'road': 'rd',
      'avenue': 'ave',
      'close': 'cl',
      'drive': 'dr'
    };

    Object.entries(abbreviations).forEach(([full, abbr]) => {
      if (cleaned.toLowerCase().includes(full)) {
        variations.push(cleaned.replace(new RegExp(full, 'gi'), abbr));
      }
      if (cleaned.toLowerCase().includes(abbr)) {
        variations.push(cleaned.replace(new RegExp(abbr, 'gi'), full));
      }
    });

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Create a fallback address option for suggestions
   */
  static createFallbackAddress(suggestion: string, originalQuery: string): AddressOption {
    return {
      placeId: `fallback_${Date.now()}_${Math.random()}`,
      formattedAddress: suggestion,
      city: '',
      postalCode: '',
      country: 'United Kingdom',
      latitude: 0,
      longitude: 0,
      addressComponents: [],
      source: 'address_validation',
      confidence: 0.3,
      buildingType: 'residential'
    };
  }

  /**
   * Get user guidance for failed searches
   */
  static getSearchGuidance(query: string): {
    title: string;
    message: string;
    tips: string[];
  } {
    if (query.length < 3) {
      return {
        title: 'Search too short',
        message: 'Please enter at least 3 characters to search for addresses.',
        tips: [
          'Enter a postcode (e.g., BS34 7HH)',
          'Enter a street name and area',
          'Include house number for specific addresses'
        ]
      };
    }

    return {
      title: 'No addresses found',
      message: 'We couldn\'t find any addresses matching your search. Try these suggestions:',
      tips: [
        '✓ Check spelling of street names and postcodes',
        '✓ Try searching with just the postcode first',
        '✓ Use complete UK postcode format (e.g., "SW1A 1AA")',
        '✓ Search for nearby landmarks or main roads',
        '✓ Ensure the address exists and is in the UK'
      ]
    };
  }
}

export default AddressValidator;