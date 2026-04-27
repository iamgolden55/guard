import api from './api';

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties?: string[];
  launchYear?: number;
  types: HolidayType[];
}

export enum HolidayType {
  PUBLIC = 'Public',
  BANK = 'Bank',
  SCHOOL = 'School',
  AUTHORITIES = 'Authorities',
  OPTIONAL = 'Optional',
  OBSERVANCE = 'Observance'
}

export interface HolidayCalendarEvent {
  id: string;
  title: string;
  date: string;
  isHoliday: true;
  type: 'public' | 'bank' | 'school';
  description?: string;
}

class HolidayService {
  private cache: Map<string, Holiday[]> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Get holidays for a specific country and year
   */
  async getHolidays(countryCode: string = 'GB', year: number = new Date().getFullYear()): Promise<Holiday[]> {
    const cacheKey = `${countryCode}-${year}`;

    // Check cache first
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey) || [];
    }

    try {
      // Use our backend API to proxy holiday requests (avoids CORS issues)
      const response = await api.get('/leave/holidays/', {
        params: {
          country: countryCode,
          year: year
        }
      });

      const holidays: Holiday[] = response.data;

      // Cache the results
      this.cache.set(cacheKey, holidays);
      this.cacheTimestamps.set(cacheKey, Date.now());

      return holidays;
    } catch (error) {
      console.error('Error fetching holidays from backend:', error);
      return this.getFallbackHolidays(year);
    }
  }

  /**
   * Get holidays for current month
   */
  async getCurrentMonthHolidays(countryCode: string = 'GB'): Promise<Holiday[]> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const allHolidays = await this.getHolidays(countryCode, year);

    return allHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === month && holidayDate.getFullYear() === year;
    });
  }

  /**
   * Get holidays for a specific date range
   */
  async getHolidaysInRange(
    startDate: Date,
    endDate: Date,
    countryCode: string = 'GB'
  ): Promise<Holiday[]> {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    // Fetch holidays for all required years
    const holidayPromises = years.map(year => this.getHolidays(countryCode, year));
    const holidayArrays = await Promise.all(holidayPromises);
    const allHolidays = holidayArrays.flat();

    // Filter to date range
    return allHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= startDate && holidayDate <= endDate;
    });
  }

  /**
   * Convert holidays to calendar events
   */
  holidaysToCalendarEvents(holidays: Holiday[]): HolidayCalendarEvent[] {
    return holidays.map(holiday => ({
      id: `holiday-${holiday.date}`,
      title: holiday.localName || holiday.name,
      date: holiday.date,
      isHoliday: true as const,
      type: this.getHolidayDisplayType(holiday.types),
      description: holiday.name !== holiday.localName ? holiday.name : undefined
    }));
  }

  /**
   * Check if a specific date is a holiday
   */
  async isHoliday(date: Date, countryCode: string = 'GB'): Promise<Holiday | null> {
    const dateStr = date.toISOString().split('T')[0];
    const year = date.getFullYear();

    const holidays = await this.getHolidays(countryCode, year);
    return holidays.find(holiday => holiday.date === dateStr) || null;
  }

  /**
   * Get next upcoming holiday
   */
  async getNextHoliday(countryCode: string = 'GB'): Promise<Holiday | null> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;

    // Get holidays for current and next year
    const [currentYearHolidays, nextYearHolidays] = await Promise.all([
      this.getHolidays(countryCode, currentYear),
      this.getHolidays(countryCode, nextYear)
    ]);

    const allHolidays = [...currentYearHolidays, ...nextYearHolidays];
    const todayStr = today.toISOString().split('T')[0];

    const upcomingHolidays = allHolidays
      .filter(holiday => holiday.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    return upcomingHolidays[0] || null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get supported countries
   */
  async getSupportedCountries(): Promise<Array<{countryCode: string; name: string}>> {
    try {
      const response = await fetch('https://date.nager.at/api/v3/AvailableCountries');
      if (!response.ok) {
        throw new Error('Failed to fetch countries');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching supported countries:', error);
      // Return common countries as fallback
      return [
        { countryCode: 'GB', name: 'United Kingdom' },
        { countryCode: 'US', name: 'United States' },
        { countryCode: 'CA', name: 'Canada' },
        { countryCode: 'AU', name: 'Australia' },
        { countryCode: 'DE', name: 'Germany' },
        { countryCode: 'FR', name: 'France' },
      ];
    }
  }

  // Private helper methods

  private isValidCache(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) return false;

    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  private getHolidayDisplayType(types: HolidayType[]): 'public' | 'bank' | 'school' {
    if (types.includes(HolidayType.PUBLIC)) return 'public';
    if (types.includes(HolidayType.BANK)) return 'bank';
    if (types.includes(HolidayType.SCHOOL)) return 'school';
    return 'public'; // fallback
  }

  private getFallbackHolidays(year: number): Holiday[] {
    // UK holidays as fallback
    const ukHolidays: Holiday[] = [
      {
        date: `${year}-01-01`,
        localName: "New Year's Day",
        name: "New Year's Day",
        countryCode: 'GB',
        fixed: true,
        global: true,
        types: [HolidayType.PUBLIC]
      },
      {
        date: `${year}-12-25`,
        localName: "Christmas Day",
        name: "Christmas Day",
        countryCode: 'GB',
        fixed: true,
        global: true,
        types: [HolidayType.PUBLIC]
      },
      {
        date: `${year}-12-26`,
        localName: "Boxing Day",
        name: "Boxing Day",
        countryCode: 'GB',
        fixed: true,
        global: true,
        types: [HolidayType.PUBLIC]
      }
    ];

    // Add Easter-based holidays (simplified calculation)
    const easter = this.calculateEaster(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);

    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    ukHolidays.push(
      {
        date: goodFriday.toISOString().split('T')[0],
        localName: "Good Friday",
        name: "Good Friday",
        countryCode: 'GB',
        fixed: false,
        global: true,
        types: [HolidayType.PUBLIC]
      },
      {
        date: easterMonday.toISOString().split('T')[0],
        localName: "Easter Monday",
        name: "Easter Monday",
        countryCode: 'GB',
        fixed: false,
        global: true,
        types: [HolidayType.PUBLIC]
      }
    );

    return ukHolidays;
  }

  private calculateEaster(year: number): Date {
    // Simple Easter calculation (Western/Gregorian calendar)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
  }
}

// Create and export singleton instance
const holidayService = new HolidayService();
export default holidayService;

// Also export the class for testing
export { HolidayService };