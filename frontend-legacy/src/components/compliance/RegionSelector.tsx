import React from 'react';
import {
  Card,
  CardHeader,
  CardPreview,
  Checkbox,
  Badge,
  Text,
  Tooltip
} from '@fluentui/react-components';
import {
  Globe24Regular,
  CheckmarkCircle24Regular,
  Warning24Regular,
  Info24Regular
} from '@fluentui/react-icons';
import { WorkingHoursRegulation } from '../../types/compliance';

interface RegionSelectorProps {
  countries: Array<{
    country_code: string;
    country_name: string;
    is_active: boolean;
  }>;
  regulations: WorkingHoursRegulation[];
  selectedRegions: string[];
  onRegionSelect: (regionCode: string, selected: boolean) => void;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({
  countries,
  regulations,
  selectedRegions,
  onRegionSelect,
}) => {
  const getRegulationSummary = (countryCode: string) => {
    const regulation = regulations.find(reg => reg.country_code === countryCode);
    if (!regulation) return null;

    return {
      standardWeekly: regulation.standard_weekly_hours,
      maxWeekly: regulation.max_weekly_hours,
      otThreshold: regulation.overtime_threshold_hours,
      otMultiplier: regulation.overtime_multiplier_1,
      isActive: regulation.is_active,
    };
  };

  const getComplexityLevel = (countryCode: string) => {
    const regulation = regulations.find(reg => reg.country_code === countryCode);
    if (!regulation) return 'unknown';

    const specialRulesCount = regulation.special_rules ? Object.keys(regulation.special_rules).length : 0;
    const hasMultipleOTThresholds = regulation.overtime_threshold_2 ? true : false;

    let score = 0;
    if (specialRulesCount > 3) score += 2;
    else if (specialRulesCount > 0) score += 1;

    if (hasMultipleOTThresholds) score += 1;
    if (parseFloat(regulation.max_weekly_hours) > 50) score += 1;

    if (score >= 3) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
  };

  const getComplexityBadge = (complexity: string) => {
    const complexityConfig = {
      low: { color: 'success', text: 'Simple' },
      medium: { color: 'warning', text: 'Moderate' },
      high: { color: 'danger', text: 'Complex' },
      unknown: { color: 'subtle', text: 'Unknown' }
    };

    const config = complexityConfig[complexity as keyof typeof complexityConfig] || complexityConfig.unknown;

    return (
      <Badge appearance="outline" color={config.color as any} size="small">
        {config.text}
      </Badge>
    );
  };

  const getRegionDescription = (countryCode: string) => {
    const descriptions: Record<string, string> = {
      'GB': 'UK Working Time Regulations 1998, SIA security standards',
      'US': 'Fair Labor Standards Act (FLSA), state variations',
      'DE': 'German Working Time Act, EU Working Time Directive',
      'FR': 'French Labour Code, 35-hour work week',
      'IT': 'Italian Labour Law, EU Working Time Directive',
      'ES': 'Spanish Workers\' Statute, EU standards',
      'NL': 'Dutch Working Hours Act, flexible arrangements',
      'BE': 'Belgian Labour Law, EU compliance',
      'AT': 'Austrian Working Time Act, strict regulations',
      'SE': 'Swedish Working Time Act, progressive standards',
      'DK': 'Danish Working Time Act, collective agreements',
      'NO': 'Norwegian Working Environment Act, EEA standards',
      'CH': 'Swiss Labour Law, bilateral agreements',
      'CA': 'Canada Labour Code, provincial variations',
      'AU': 'Fair Work Act 2009, federal standards',
      'NZ': 'Employment Relations Act, flexible work',
    };

    return descriptions[countryCode] || 'Regional working hours regulations';
  };

  return (
    <Card>
      <CardHeader
        header={
          <div className="flex items-center gap-2">
            <Globe24Regular className="text-blue-600" />
            <Text size={500} weight="semibold">Region Selection</Text>
          </div>
        }
        description="Select regions to compare regulations"
      />

      <CardPreview>
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {countries.map((country) => {
            const summary = getRegulationSummary(country.country_code);
            const complexity = getComplexityLevel(country.country_code);
            const isSelected = selectedRegions.includes(country.country_code);

            return (
              <div
                key={country.country_code}
                className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => onRegionSelect(country.country_code, !isSelected)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onRegionSelect(country.country_code, !isSelected)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Text size={400} weight="semibold">
                          {country.country_code}
                        </Text>
                        {summary?.isActive ? (
                          <CheckmarkCircle24Regular className="text-green-500" />
                        ) : (
                          <Warning24Regular className="text-orange-500" />
                        )}
                      </div>
                      {getComplexityBadge(complexity)}
                    </div>

                    <Text size={300} className="text-gray-700 block mb-2">
                      {country.country_name}
                    </Text>

                    <Text size={200} className="text-gray-500 line-clamp-2 mb-2">
                      {getRegionDescription(country.country_code)}
                    </Text>

                    {summary && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Standard:</span>
                          <span className="ml-1 font-medium">{summary.standardWeekly}h/wk</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Max:</span>
                          <span className="ml-1 font-medium">{summary.maxWeekly}h/wk</span>
                        </div>
                        <div>
                          <span className="text-gray-400">OT:</span>
                          <span className="ml-1 font-medium">{summary.otThreshold}h @ {summary.otMultiplier}x</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Status:</span>
                          <span className={`ml-1 font-medium ${summary.isActive ? 'text-green-600' : 'text-orange-600'}`}>
                            {summary.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardPreview>

      {selectedRegions.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <Info24Regular className="text-blue-500" />
            <Text size={300} weight="semibold">Selected Regions</Text>
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedRegions.map((regionCode) => {
              const country = countries.find(c => c.country_code === regionCode);
              return (
                <Tooltip
                  key={regionCode}
                  content={country?.country_name || regionCode}
                  relationship="label"
                >
                  <Badge
                    appearance="filled"
                    color="brand"
                    size="small"
                  >
                    {regionCode}
                  </Badge>
                </Tooltip>
              );
            })}
          </div>

          {selectedRegions.length >= 2 && (
            <Text size={200} className="text-gray-600 mt-2">
              {selectedRegions.length} regions selected for comparison
            </Text>
          )}
        </div>
      )}
    </Card>
  );
};

export default RegionSelector;