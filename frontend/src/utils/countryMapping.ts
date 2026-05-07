/**
 * Utility functions for mapping country names to ISO codes
 * Used in onboarding process to convert frontend country selections
 * to backend-compatible ISO country codes
 */

/**
 * Mapping of country names to ISO 3166-1 alpha-3 country codes
 * This should match the countries supported in the onboarding process
 */
export const COUNTRY_NAME_TO_ISO_CODE: Record<string, string> = {
  'United Kingdom': 'GBR',
  'Ireland': 'IRL',
  'United States': 'USA',
  'Canada': 'CAN',
  'Australia': 'AUS',
  'New Zealand': 'NZL',
  'Germany': 'DEU',
  'France': 'FRA',
  'Spain': 'ESP',
  'Italy': 'ITA',
  'Netherlands': 'NLD',
  'Belgium': 'BEL',
  'Switzerland': 'CHE',
  'Austria': 'AUT',
  'Norway': 'NOR',
  'Sweden': 'SWE',
  'Denmark': 'DNK',
  'Finland': 'FIN',
  'Poland': 'POL',
  'Czech Republic': 'CZE',
  'Portugal': 'PRT',
  'Luxembourg': 'LUX'
};

/**
 * Convert country name to ISO country code
 * @param countryName - The country name as displayed in the UI
 * @param defaultCode - Default code to use if mapping not found (defaults to 'GBR')
 * @returns ISO 3166-1 alpha-3 country code
 */
export function mapCountryNameToCode(
  countryName: string,
  defaultCode = 'GBR'
): string {
  const normalizedName = countryName.trim();
  return COUNTRY_NAME_TO_ISO_CODE[normalizedName] || defaultCode;
}

/**
 * Reverse mapping - get country name from ISO code
 */
export const ISO_CODE_TO_COUNTRY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAME_TO_ISO_CODE).map(([name, code]) => [code, name])
);

/**
 * Convert ISO country code to country name
 * @param countryCode - ISO 3166-1 alpha-3 country code
 * @param defaultName - Default name to use if mapping not found
 * @returns Country name as displayed in the UI
 */
export function mapCountryCodeToName(
  countryCode: string,
  defaultName = 'United Kingdom'
): string {
  const normalizedCode = countryCode.toUpperCase();
  return ISO_CODE_TO_COUNTRY_NAME[normalizedCode] || defaultName;
}

/**
 * Get list of supported countries for dropdown options
 * @returns Array of country names that can be mapped to ISO codes
 */
export function getSupportedCountries(): string[] {
  return Object.keys(COUNTRY_NAME_TO_ISO_CODE);
}

/**
 * Validate if a country name is supported
 * @param countryName - Country name to validate
 * @returns true if the country is supported, false otherwise
 */
export function isCountrySupported(countryName: string): boolean {
  return countryName.trim() in COUNTRY_NAME_TO_ISO_CODE;
}