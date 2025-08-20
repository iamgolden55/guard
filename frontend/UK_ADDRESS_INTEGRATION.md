# UK Address Integration Guide

## Overview

The venue creation system now includes property-level UK address lookup using official Royal Mail PAF (Postcode Address File) data. This ensures staff can check-in at exact venue locations rather than general street-level coordinates.

## Features

### ✅ **Property-Level Accuracy**
- **Before**: "Marlwood Dr, Bristol BS10 6SH, UK" (generic street)
- **After**: "31 Marlwood Drive, Bristol, BS10 6SH" (specific house number)

### ✅ **Official Data Source**
- Royal Mail PAF data via GetAddress.io
- Accurate coordinates for each property
- Validated UK postcode format

### ✅ **Smart Fallback**
- UK Address Service (GetAddress.io) for postcodes
- Google Maps API as fallback
- Demo data when API key not configured

## Configuration

### 1. GetAddress.io Setup

Sign up at [GetAddress.io](https://getaddress.io) and get an API key:

```bash
# Add to .env.local
VITE_GETADDRESS_API_KEY=your_actual_api_key_here
```

**Pricing:**
- Free tier: 20 lookups per day  
- Paid plans: From £5/month for 1,000 lookups
- Enterprise: Custom pricing for high volume

### 2. Alternative Providers

The system can be easily adapted for other UK address providers:

#### Ideal Postcodes
```typescript
// Change base URL in ukAddressService.ts
baseUrl = 'https://api.ideal-postcodes.co.uk/v1'
```

#### Loqate (PCA Predict)
```typescript
// Different API structure but same data source
baseUrl = 'https://services.postcodeanywhere.co.uk'
```

## Usage Examples

### Basic Postcode Lookup
```typescript
import ukAddressService from './services/ukAddressService';

// Get all addresses for a postcode
const result = await ukAddressService.lookupPostcode('BS10 6SH');
console.log(result.items);
// Returns: [
//   { label: "31 Marlwood Drive, Bristol, BS10 6SH", ... },
//   { label: "41 Marlwood Drive, Bristol, BS10 6SH", ... }
// ]
```

### Address Search with Filtering
```typescript
// Search with house number filter
const result = await ukAddressService.searchAddresses('41 BS10 6SH');
// Returns only addresses matching "41"
```

## API Response Format

```typescript
interface UKAddressResponse {
  postcode: string;
  items: UKAddressResult[];
  count: number;
}

interface UKAddressResult {
  id: string;
  label: string; // Full display address
  meta: {
    building_number?: string;    // "31"
    building_name?: string;      // "Tesco Express"
    thoroughfare?: string;       // "Marlwood Drive"
    locality?: string;          // "Filton"
    town?: string;              // "Bristol"
    county?: string;            // "Bristol"
    postcode: string;           // "BS10 6SH"
    latitude?: number;          // 51.4545
    longitude?: number;         // -2.5879
  };
}
```

## Demo Data

When `VITE_GETADDRESS_API_KEY=demo_key` or not configured, the system uses demo data:

**BS10 6SH:**
- 31 Marlwood Drive, Bristol, BS10 6SH
- 41 Marlwood Drive, Bristol, BS10 6SH  
- 42 Marlwood Drive, Bristol, BS10 6SH

**BS34 7HH:**
- 829 Filton Avenue, Filton, Bristol, BS34 7HH
- 831 Filton Avenue, Filton, Bristol, BS34 7HH

## UI Integration

### Address Picker Component

The `IntelligentAddressPicker` automatically:

1. **Detects UK postcodes** and uses UK Address Service
2. **Shows "Official UK Addresses"** section with PAF data badge
3. **Falls back to Google Maps** if UK service fails
4. **Displays property-level results** with house numbers

### Visual Indicators

- 🛡️ **Green header**: Official PAF data from UK Address Service
- 📊 **Blue header**: Google Maps geocoding data
- 95% **confidence score**: UK Address Service results
- **Building type**: Residential/Commercial detection

## Benefits for Staff Check-in

### ✅ **Precise Location**
Staff arrive at exact house number, not general street area

### ✅ **Reduced Errors**  
No confusion about which building on a street

### ✅ **GPS Accuracy**
Correct coordinates for location verification

### ✅ **Professional Experience**
Proper address format matching UK standards

## Technical Implementation

### Address Resolution Flow

1. **User enters postcode** → UK Address Service lookup
2. **UK service fails** → Google Maps geocoding fallback  
3. **Non-postcode query** → Google Maps Places API
4. **All sources fail** → Address validation service

### Data Mapping

```typescript
// UK Address Service → Internal format
UKAddressResult → AddressOption → VenueLocationData
```

### Rate Limiting

- **UK Address Service**: Built-in per API key limits
- **Google Maps**: Delays between requests (100ms)
- **Combined**: Smart caching and deduplication

## Troubleshooting

### Common Issues

**"Using demo data" message:**
```bash
# Check environment variable is set correctly
echo $VITE_GETADDRESS_API_KEY
```

**No addresses found:**
```bash
# Verify postcode format
"BS10 6SH" ✅  
"BS106SH" ✅ (auto-normalized)
"BS10" ❌ (incomplete)
```

**Rate limit exceeded:**
```bash
# Check GetAddress.io dashboard for usage
# Upgrade plan or implement caching
```

### Debug Logging

```typescript
// Enable debug logs in browser console
localStorage.setItem('debug', 'uk-address:*');
```

## Migration Guide

### From Google Maps Only

1. **Add UK Address Service**:
   ```bash
   VITE_GETADDRESS_API_KEY=your_key
   ```

2. **Update venue creation form** to use `IntelligentAddressPicker`

3. **Test with real postcodes** to verify property-level results

### Existing Venues

- Existing venue coordinates remain unchanged
- New venues get property-level accuracy
- Optional: Batch update existing venues with new lookup

## Cost Optimization

### API Usage Patterns

- **Postcode lookup**: 1 API call per postcode
- **Caching**: Browser session storage (optional)
- **Fallback**: Google Maps only if UK service fails

### Recommended Plans

- **Development**: Free tier (20/day)
- **Small venues**: £5/month (1,000 lookups)  
- **Enterprise**: Custom pricing for 10,000+ venues

## Support

- **GetAddress.io**: [support@getaddress.io](mailto:support@getaddress.io)
- **Integration issues**: Check browser console for detailed errors
- **Alternative providers**: Ideal Postcodes, Loqate have similar APIs