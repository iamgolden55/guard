// Test scenarios for the intelligent address resolution system
// This file demonstrates how the system handles various address input scenarios

import { AddressValidator, AddressFallbackService } from './addressValidation';
import { AddressOption } from '../services/addressResolutionService';

export interface TestScenario {
  name: string;
  input: string;
  expectedResults: {
    shouldFindExactMatch: boolean;
    shouldExpandPostcode: boolean;
    shouldProvideAlternatives: boolean;
    minimumResults: number;
  };
  description: string;
}

export const testScenarios: TestScenario[] = [
  {
    name: 'Specific House Number with Postcode',
    input: '829 Filton Avenue BS34 7HH',
    expectedResults: {
      shouldFindExactMatch: true,
      shouldExpandPostcode: false,
      shouldProvideAlternatives: false,
      minimumResults: 1
    },
    description: 'Should find the exact address when house number and postcode are provided'
  },
  {
    name: 'Postcode Only - BS34 7HH',
    input: 'BS34 7HH',
    expectedResults: {
      shouldFindExactMatch: false,
      shouldExpandPostcode: true,
      shouldProvideAlternatives: true,
      minimumResults: 5
    },
    description: 'Should expand postcode to show multiple addresses in the area, including house 829'
  },
  {
    name: 'Partial Address with Street Name',
    input: 'Filton Avenue BS34',
    expectedResults: {
      shouldFindExactMatch: false,
      shouldExpandPostcode: false,
      shouldProvideAlternatives: true,
      minimumResults: 3
    },
    description: 'Should provide multiple addresses on Filton Avenue in BS34 area'
  },
  {
    name: 'Building Name with Postcode',
    input: 'Tesco Filton BS34 7HH',
    expectedResults: {
      shouldFindExactMatch: true,
      shouldExpandPostcode: false,
      shouldProvideAlternatives: true,
      minimumResults: 1
    },
    description: 'Should find the specific Tesco store and similar businesses'
  },
  {
    name: 'Invalid Postcode Format',
    input: 'BS34',
    expectedResults: {
      shouldFindExactMatch: false,
      shouldExpandPostcode: false,
      shouldProvideAlternatives: true,
      minimumResults: 0
    },
    description: 'Should provide helpful error guidance for incomplete postcode'
  },
  {
    name: 'Common Misspelling',
    input: 'Filten Avenue BS34 7HH',
    expectedResults: {
      shouldFindExactMatch: false,
      shouldExpandPostcode: true,
      shouldProvideAlternatives: true,
      minimumResults: 2
    },
    description: 'Should handle typos and suggest correct alternatives'
  },
  {
    name: 'Rural Address',
    input: 'Farm Cottage BS34 7HH',
    expectedResults: {
      shouldFindExactMatch: false,
      shouldExpandPostcode: true,
      shouldProvideAlternatives: true,
      minimumResults: 1
    },
    description: 'Should handle rural addresses with appropriate warnings'
  },
  {
    name: 'New Development',
    input: 'Plot 15 New Development BS34 7HH',
    expectedResults: {
      shouldFindExactMatch: false,
      shouldExpandPostcode: true,
      shouldProvideAlternatives: true,
      minimumResults: 1
    },
    description: 'Should handle new developments with appropriate validation warnings'
  }
];

export class AddressResolutionTester {
  /**
   * Test address validation functionality
   */
  static testAddressValidation(): void {
    console.log('=== Testing Address Validation ===');
    
    // Test valid UK postcode
    const validPostcodes = ['BS34 7HH', 'SW1A 1AA', 'M1 1AA', 'B33 8TH'];
    const invalidPostcodes = ['BS34', 'INVALID', '12345', 'SW1A'];
    
    validPostcodes.forEach(postcode => {
      const isValid = AddressValidator.isValidUKPostcode(postcode);
      console.log(`✓ ${postcode}: ${isValid ? 'VALID' : 'INVALID'}`);
    });
    
    invalidPostcodes.forEach(postcode => {
      const isValid = AddressValidator.isValidUKPostcode(postcode);
      console.log(`✗ ${postcode}: ${isValid ? 'VALID' : 'INVALID'}`);
    });
  }

  /**
   * Test coordinate validation
   */
  static testCoordinateValidation(): void {
    console.log('\n=== Testing Coordinate Validation ===');
    
    const testCoordinates = [
      { lat: 51.4545, lng: -2.5879, location: 'Bristol, UK', expected: true },
      { lat: 51.5074, lng: -0.1278, location: 'London, UK', expected: true },
      { lat: 40.7128, lng: -74.0060, location: 'New York, USA', expected: false },
      { lat: 48.8566, lng: 2.3522, location: 'Paris, France', expected: false },
      { lat: 55.9533, lng: -3.1883, location: 'Edinburgh, UK', expected: true }
    ];
    
    testCoordinates.forEach(({ lat, lng, location, expected }) => {
      const isValid = AddressValidator.areValidUKCoordinates(lat, lng);
      const status = isValid === expected ? '✓' : '✗';
      console.log(`${status} ${location} (${lat}, ${lng}): ${isValid ? 'UK' : 'NOT UK'}`);
    });
  }

  /**
   * Test address validation with sample data
   */
  static testAddressQualityValidation(): void {
    console.log('\n=== Testing Address Quality Validation ===');
    
    const sampleAddresses: AddressOption[] = [
      {
        placeId: 'test1',
        formattedAddress: '829 Filton Avenue, Filton, Bristol BS34 7HH, UK',
        streetNumber: '829',
        streetName: 'Filton Avenue',
        city: 'Bristol',
        postalCode: 'BS34 7HH',
        country: 'United Kingdom',
        latitude: 51.4545,
        longitude: -2.5879,
        addressComponents: [],
        source: 'geocoding',
        confidence: 0.95,
        buildingType: 'residential'
      },
      {
        placeId: 'test2',
        formattedAddress: 'Filton Avenue, Filton, Bristol BS34 7HH, UK',
        city: 'Bristol',
        postalCode: 'BS34 7HH',
        country: 'United Kingdom',
        latitude: 51.4545,
        longitude: -2.5879,
        addressComponents: [],
        source: 'geocoding',
        confidence: 0.7,
        buildingType: 'residential'
      },
      {
        placeId: 'test3',
        formattedAddress: 'Farm Cottage, Unnamed Road, BS34 7HH, UK',
        city: 'Bristol',
        postalCode: 'BS34 7HH',
        country: 'United Kingdom',
        latitude: 51.4545,
        longitude: -2.5879,
        addressComponents: [],
        source: 'geocoding',
        confidence: 0.6,
        buildingType: 'residential'
      }
    ];
    
    sampleAddresses.forEach((address, index) => {
      const validation = AddressValidator.validateAddress(address);
      const summary = AddressValidator.getValidationSummary(validation);
      
      console.log(`\nAddress ${index + 1}: ${address.formattedAddress}`);
      console.log(`Summary: ${summary}`);
      console.log(`Confidence: ${Math.round(validation.confidence * 100)}%`);
      
      if (validation.issues.length > 0) {
        console.log('Issues:');
        validation.issues.forEach(issue => {
          console.log(`  - ${issue.severity.toUpperCase()}: ${issue.message}`);
        });
      }
      
      if (validation.suggestions.length > 0) {
        console.log('Suggestions:');
        validation.suggestions.forEach(suggestion => {
          console.log(`  • ${suggestion}`);
        });
      }
    });
  }

  /**
   * Test fallback resolution strategies
   */
  static testFallbackStrategies(): void {
    console.log('\n=== Testing Fallback Strategies ===');
    
    const problemQueries = [
      '',
      'XY',
      'Invalid Address 123',
      'BS34',
      'Nonexistent Street BS99 9XX'
    ];
    
    problemQueries.forEach(query => {
      console.log(`\nQuery: "${query}"`);
      
      const guidance = AddressFallbackService.getSearchGuidance(query);
      console.log(`Guidance: ${guidance.title}`);
      console.log(`Message: ${guidance.message}`);
      
      const variations = AddressFallbackService.generateQueryVariations(query);
      if (variations.length > 1) {
        console.log('Suggested variations:');
        variations.forEach(variation => {
          if (variation !== query) {
            console.log(`  - "${variation}"`);
          }
        });
      }
    });
  }

  /**
   * Run all tests
   */
  static runAllTests(): void {
    console.log('🧪 INTELLIGENT ADDRESS RESOLUTION SYSTEM TESTS');
    console.log('================================================');
    
    this.testAddressValidation();
    this.testCoordinateValidation();
    this.testAddressQualityValidation();
    this.testFallbackStrategies();
    
    console.log('\n📋 TEST SCENARIOS FOR MANUAL VERIFICATION:');
    console.log('==========================================');
    
    testScenarios.forEach((scenario, index) => {
      console.log(`\n${index + 1}. ${scenario.name}`);
      console.log(`   Input: "${scenario.input}"`);
      console.log(`   Expected: ${scenario.description}`);
      console.log(`   Should find ≥${scenario.expectedResults.minimumResults} results`);
    });
    
    console.log('\n✅ All validation tests completed!');
    console.log('🌐 You can now test the system at: http://localhost:3000/admin/venues');
    console.log('💡 Try entering "BS34 7HH" to see postcode expansion in action');
  }
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).AddressResolutionTester = AddressResolutionTester;
  (window as any).testAddressResolution = () => AddressResolutionTester.runAllTests();
}

export default AddressResolutionTester;