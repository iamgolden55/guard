import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  RegionalComplianceConfig,
  WorkingHoursConfig,
  OvertimeConfig,
  HolidayConfig,
  LicenseConfig,
  PublicHoliday,
  RegionalComplianceData
} from '../types';

/**
 * Hook for managing regional compliance auto-configuration
 */
export function useRegionalCompliance() {
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [complianceConfig, setComplianceConfig] = useState<RegionalComplianceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Country compliance configurations
  const complianceConfigs: Record<string, RegionalComplianceConfig> = useMemo(() => ({
    'GB': {
      countryCode: 'GB',
      workingHoursLimits: {
        maxDailyHours: 8,
        maxWeeklyHours: 48,
        minimumRestPeriod: 11, // hours between shifts
        nightShiftRegulations: {
          startTime: '23:00',
          endTime: '06:00',
          maxConsecutiveNights: 7,
          additionalBreaks: 1
        }
      },
      overtimeRules: {
        dailyThreshold: 8,
        weeklyThreshold: 48,
        multiplier: 1.5,
        requiresApproval: true
      },
      holidaySettings: {
        minimumAnnualLeave: 28, // days including bank holidays
        publicHolidays: [
          { date: '2024-01-01', name: 'New Year\'s Day', isPaid: true },
          { date: '2024-03-29', name: 'Good Friday', isPaid: true },
          { date: '2024-04-01', name: 'Easter Monday', isPaid: true },
          { date: '2024-05-06', name: 'Early May Bank Holiday', isPaid: true },
          { date: '2024-05-27', name: 'Spring Bank Holiday', isPaid: true },
          { date: '2024-08-26', name: 'Summer Bank Holiday', isPaid: true },
          { date: '2024-12-25', name: 'Christmas Day', isPaid: true },
          { date: '2024-12-26', name: 'Boxing Day', isPaid: true }
        ],
        leaveAccrualRate: 2.33 // days per month
      },
      licenseRequirements: [
        {
          type: 'SIA_DOOR_SUPERVISOR',
          name: 'SIA Door Supervisor Licence',
          isRequired: true,
          validityPeriod: 36, // months
          reminderDays: 30
        },
        {
          type: 'SIA_SECURITY_GUARD',
          name: 'SIA Security Guard Licence',
          isRequired: true,
          validityPeriod: 36,
          reminderDays: 30
        },
        {
          type: 'FIRST_AID',
          name: 'First Aid Certificate',
          isRequired: false,
          validityPeriod: 36,
          reminderDays: 60
        }
      ]
    },
    'US': {
      countryCode: 'US',
      workingHoursLimits: {
        maxDailyHours: 12,
        maxWeeklyHours: 40,
        minimumRestPeriod: 8,
        nightShiftRegulations: {
          startTime: '22:00',
          endTime: '06:00',
          maxConsecutiveNights: 14,
          additionalBreaks: 0
        }
      },
      overtimeRules: {
        dailyThreshold: 8,
        weeklyThreshold: 40,
        multiplier: 1.5,
        requiresApproval: false
      },
      holidaySettings: {
        minimumAnnualLeave: 0, // No federal requirement
        publicHolidays: [
          { date: '2024-01-01', name: 'New Year\'s Day', isPaid: true },
          { date: '2024-01-15', name: 'Martin Luther King Jr. Day', isPaid: true },
          { date: '2024-02-19', name: 'Presidents\' Day', isPaid: true },
          { date: '2024-05-27', name: 'Memorial Day', isPaid: true },
          { date: '2024-06-19', name: 'Juneteenth', isPaid: true },
          { date: '2024-07-04', name: 'Independence Day', isPaid: true },
          { date: '2024-09-02', name: 'Labor Day', isPaid: true },
          { date: '2024-10-14', name: 'Columbus Day', isPaid: true },
          { date: '2024-11-11', name: 'Veterans Day', isPaid: true },
          { date: '2024-11-28', name: 'Thanksgiving Day', isPaid: true },
          { date: '2024-12-25', name: 'Christmas Day', isPaid: true }
        ],
        leaveAccrualRate: 0 // Varies by company
      },
      licenseRequirements: [
        {
          type: 'SECURITY_GUARD',
          name: 'Security Guard License',
          isRequired: true,
          validityPeriod: 24,
          reminderDays: 30
        },
        {
          type: 'ARMED_SECURITY',
          name: 'Armed Security License',
          isRequired: false,
          validityPeriod: 12,
          reminderDays: 60
        }
      ]
    },
    'AU': {
      countryCode: 'AU',
      workingHoursLimits: {
        maxDailyHours: 10,
        maxWeeklyHours: 38,
        minimumRestPeriod: 10,
        nightShiftRegulations: {
          startTime: '22:00',
          endTime: '07:00',
          maxConsecutiveNights: 7,
          additionalBreaks: 1
        }
      },
      overtimeRules: {
        dailyThreshold: 8,
        weeklyThreshold: 38,
        multiplier: 1.5,
        requiresApproval: true
      },
      holidaySettings: {
        minimumAnnualLeave: 20, // working days
        publicHolidays: [
          { date: '2024-01-01', name: 'New Year\'s Day', isPaid: true },
          { date: '2024-01-26', name: 'Australia Day', isPaid: true },
          { date: '2024-03-29', name: 'Good Friday', isPaid: true },
          { date: '2024-04-01', name: 'Easter Monday', isPaid: true },
          { date: '2024-04-25', name: 'Anzac Day', isPaid: true },
          { date: '2024-06-10', name: 'Queen\'s Birthday', isPaid: true },
          { date: '2024-12-25', name: 'Christmas Day', isPaid: true },
          { date: '2024-12-26', name: 'Boxing Day', isPaid: true }
        ],
        leaveAccrualRate: 1.67 // days per month
      },
      licenseRequirements: [
        {
          type: 'SECURITY_LICENSE',
          name: 'Security Provider Licence',
          isRequired: true,
          validityPeriod: 60,
          reminderDays: 90
        },
        {
          type: 'CROWD_CONTROL',
          name: 'Crowd Control Licence',
          isRequired: false,
          validityPeriod: 60,
          reminderDays: 90
        }
      ]
    },
    'CA': {
      countryCode: 'CA',
      workingHoursLimits: {
        maxDailyHours: 8,
        maxWeeklyHours: 44,
        minimumRestPeriod: 8,
        nightShiftRegulations: {
          startTime: '23:00',
          endTime: '07:00',
          maxConsecutiveNights: 7,
          additionalBreaks: 1
        }
      },
      overtimeRules: {
        dailyThreshold: 8,
        weeklyThreshold: 44,
        multiplier: 1.5,
        requiresApproval: true
      },
      holidaySettings: {
        minimumAnnualLeave: 10, // days after 1 year
        publicHolidays: [
          { date: '2024-01-01', name: 'New Year\'s Day', isPaid: true },
          { date: '2024-02-19', name: 'Family Day', isPaid: true },
          { date: '2024-03-29', name: 'Good Friday', isPaid: true },
          { date: '2024-05-20', name: 'Victoria Day', isPaid: true },
          { date: '2024-07-01', name: 'Canada Day', isPaid: true },
          { date: '2024-08-05', name: 'Civic Holiday', isPaid: true },
          { date: '2024-09-02', name: 'Labour Day', isPaid: true },
          { date: '2024-10-14', name: 'Thanksgiving', isPaid: true },
          { date: '2024-11-11', name: 'Remembrance Day', isPaid: true },
          { date: '2024-12-25', name: 'Christmas Day', isPaid: true },
          { date: '2024-12-26', name: 'Boxing Day', isPaid: true }
        ],
        leaveAccrualRate: 0.83 // days per month
      },
      licenseRequirements: [
        {
          type: 'SECURITY_GUARD',
          name: 'Security Guard License',
          isRequired: true,
          validityPeriod: 24,
          reminderDays: 60
        }
      ]
    }
  }), []);

  // Available countries
  const availableCountries = useMemo(() => {
    return [
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'AU', name: 'Australia', flag: '🇦🇺' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' }
    ];
  }, []);

  // Load compliance configuration for a country
  const loadComplianceConfig = useCallback(async (countryCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const config = complianceConfigs[countryCode];
      if (!config) {
        throw new Error(`Compliance configuration not found for country: ${countryCode}`);
      }

      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));

      setComplianceConfig(config);
      setSelectedCountry(countryCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compliance configuration');
      setComplianceConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [complianceConfigs]);

  // Generate regional compliance data for onboarding form
  const generateRegionalComplianceData = useCallback((): RegionalComplianceData | null => {
    if (!complianceConfig) return null;

    return {
      primaryRegion: complianceConfig.countryCode,
      operatingRegions: [complianceConfig.countryCode],
      complianceProfile: {
        workingHoursRegulation: `Max ${complianceConfig.workingHoursLimits.maxDailyHours}h/day, ${complianceConfig.workingHoursLimits.maxWeeklyHours}h/week`,
        overtimeRules: `${complianceConfig.overtimeRules.multiplier}x rate after ${complianceConfig.overtimeRules.dailyThreshold}h daily or ${complianceConfig.overtimeRules.weeklyThreshold}h weekly`,
        breakRequirements: `Minimum ${complianceConfig.workingHoursLimits.minimumRestPeriod}h rest between shifts`,
        holidayEntitlements: `${complianceConfig.holidaySettings.minimumAnnualLeave} days annual leave`,
        leaveRequirements: `${complianceConfig.holidaySettings.leaveAccrualRate} days accrued per month`,
        healthSafetyStandards: complianceConfig.licenseRequirements
          .filter(license => license.isRequired)
          .map(license => license.name)
      },
      specialRequirements: complianceConfig.licenseRequirements
        .filter(license => license.isRequired)
        .map(license => `${license.name} - Valid for ${license.validityPeriod} months`),
      dataProtectionLevel: getDataProtectionLevel(complianceConfig.countryCode)
    };
  }, [complianceConfig]);

  // Get working hours compliance summary
  const getWorkingHoursCompliance = useCallback(() => {
    if (!complianceConfig) return null;

    return {
      dailyLimit: complianceConfig.workingHoursLimits.maxDailyHours,
      weeklyLimit: complianceConfig.workingHoursLimits.maxWeeklyHours,
      minimumRest: complianceConfig.workingHoursLimits.minimumRestPeriod,
      nightShiftRules: complianceConfig.workingHoursLimits.nightShiftRegulations,
      overtimeThreshold: {
        daily: complianceConfig.overtimeRules.dailyThreshold,
        weekly: complianceConfig.overtimeRules.weeklyThreshold,
        rate: complianceConfig.overtimeRules.multiplier,
        requiresApproval: complianceConfig.overtimeRules.requiresApproval
      }
    };
  }, [complianceConfig]);

  // Get holiday and leave configuration
  const getHolidayCompliance = useCallback(() => {
    if (!complianceConfig) return null;

    const currentYear = new Date().getFullYear();
    const publicHolidays = complianceConfig.holidaySettings.publicHolidays.filter(
      holiday => holiday.date.startsWith(currentYear.toString())
    );

    return {
      minimumAnnualLeave: complianceConfig.holidaySettings.minimumAnnualLeave,
      accrualRate: complianceConfig.holidaySettings.leaveAccrualRate,
      publicHolidays,
      paidHolidays: publicHolidays.filter(h => h.isPaid).length,
      totalPaidDaysOff: complianceConfig.holidaySettings.minimumAnnualLeave +
        publicHolidays.filter(h => h.isPaid).length
    };
  }, [complianceConfig]);

  // Get license requirements
  const getLicenseRequirements = useCallback(() => {
    if (!complianceConfig) return [];

    return complianceConfig.licenseRequirements.map(license => ({
      ...license,
      expiryWarning: `Reminder ${license.reminderDays} days before expiry`,
      renewalFrequency: `Every ${license.validityPeriod} months`
    }));
  }, [complianceConfig]);

  // Validate if current settings comply with regulations
  const validateCompliance = useCallback((workingHours: number, weeklyHours: number, consecutiveNights: number) => {
    if (!complianceConfig) return { isCompliant: true, violations: [] };

    const violations: string[] = [];

    if (workingHours > complianceConfig.workingHoursLimits.maxDailyHours) {
      violations.push(`Daily hours exceed limit of ${complianceConfig.workingHoursLimits.maxDailyHours}`);
    }

    if (weeklyHours > complianceConfig.workingHoursLimits.maxWeeklyHours) {
      violations.push(`Weekly hours exceed limit of ${complianceConfig.workingHoursLimits.maxWeeklyHours}`);
    }

    if (consecutiveNights > complianceConfig.workingHoursLimits.nightShiftRegulations.maxConsecutiveNights) {
      violations.push(`Consecutive night shifts exceed limit of ${complianceConfig.workingHoursLimits.nightShiftRegulations.maxConsecutiveNights}`);
    }

    return {
      isCompliant: violations.length === 0,
      violations
    };
  }, [complianceConfig]);

  // Auto-load configuration when country changes
  useEffect(() => {
    if (selectedCountry && !complianceConfig) {
      loadComplianceConfig(selectedCountry);
    }
  }, [selectedCountry, complianceConfig, loadComplianceConfig]);

  return {
    // State
    selectedCountry,
    complianceConfig,
    isLoading,
    error,

    // Data
    availableCountries,

    // Actions
    loadComplianceConfig,
    setSelectedCountry,

    // Generators
    generateRegionalComplianceData,

    // Compliance information
    getWorkingHoursCompliance,
    getHolidayCompliance,
    getLicenseRequirements,

    // Validation
    validateCompliance,

    // Utilities
    hasConfig: !!complianceConfig,
    isConfiguredCountry: (countryCode: string) => countryCode in complianceConfigs
  };
}

// Helper function to determine data protection level based on country
function getDataProtectionLevel(countryCode: string) {
  switch (countryCode) {
    case 'GB':
    case 'EU':
      return 'GDPR_COMPLIANT';
    case 'US':
      return 'ENHANCED';
    case 'AU':
    case 'CA':
      return 'ENHANCED';
    default:
      return 'BASIC';
  }
}

export default useRegionalCompliance;