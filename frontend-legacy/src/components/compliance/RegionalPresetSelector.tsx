import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardPreview,
  Badge,
  MessageBar,
  Text,
  Radio,
  RadioGroup,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel
} from '@fluentui/react-components';
import {
  Globe24Regular,
  Info24Regular,
  CheckmarkCircle24Regular,
  Warning24Regular,
  Gavel24Regular,
  Building24Regular,
  Clock24Regular
} from '@fluentui/react-icons';
import { RegionalPreset } from '../../types/compliance';

interface RegionalPresetSelectorProps {
  presets: RegionalPreset[];
  onSelect: (regionCode: string) => void;
  onCancel: () => void;
}

const RegionalPresetSelector: React.FC<RegionalPresetSelectorProps> = ({
  presets,
  onSelect,
  onCancel,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [expandedPresets, setExpandedPresets] = useState<string[]>([]);

  const getPresetIcon = (presetType: string) => {
    switch (presetType) {
      case 'uk_sia':
        return <Building24Regular className="text-blue-600" />;
      case 'us_flsa':
        return <Gavel24Regular className="text-red-600" />;
      case 'eu_wtd':
        return <Globe24Regular className="text-green-600" />;
      default:
        return <Globe24Regular className="text-gray-600" />;
    }
  };

  const getPresetBadgeColor = (presetType: string) => {
    switch (presetType) {
      case 'uk_sia':
        return 'brand';
      case 'us_flsa':
        return 'danger';
      case 'eu_wtd':
        return 'success';
      default:
        return 'subtle';
    }
  };

  const formatComplexityBadge = (complexity: string) => {
    const complexityMap = {
      low: { color: 'success', text: 'Low Complexity' },
      medium: { color: 'warning', text: 'Medium Complexity' },
      high: { color: 'danger', text: 'High Complexity' }
    };

    const config = complexityMap[complexity as keyof typeof complexityMap] || complexityMap.medium;

    return (
      <Badge appearance="outline" color={config.color as any}>
        {config.text}
      </Badge>
    );
  };

  const getPresetDetails = (preset: RegionalPreset) => {
    const regulation = preset.regulations;

    return (
      <div className="space-y-4">
        {/* Key Regulations */}
        <div>
          <Text size={400} weight="semibold" className="mb-2 block">Working Hours Limits</Text>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Standard Daily:</span>
              <span className="ml-2 font-medium">{regulation.standard_daily_hours || 'N/A'}h</span>
            </div>
            <div>
              <span className="text-gray-500">Standard Weekly:</span>
              <span className="ml-2 font-medium">{regulation.standard_weekly_hours || 'N/A'}h</span>
            </div>
            <div>
              <span className="text-gray-500">Max Daily:</span>
              <span className="ml-2 font-medium">{regulation.max_daily_hours || 'N/A'}h</span>
            </div>
            <div>
              <span className="text-gray-500">Max Weekly:</span>
              <span className="ml-2 font-medium">{regulation.max_weekly_hours || 'N/A'}h</span>
            </div>
          </div>
        </div>

        {/* Overtime Rules */}
        <div>
          <Text size={400} weight="semibold" className="mb-2 block">Overtime & Breaks</Text>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">OT Threshold:</span>
              <span className="ml-2 font-medium">{regulation.overtime_threshold_hours || 'N/A'}h</span>
            </div>
            <div>
              <span className="text-gray-500">OT Multiplier:</span>
              <span className="ml-2 font-medium">{regulation.overtime_multiplier_1 || 'N/A'}x</span>
            </div>
            <div>
              <span className="text-gray-500">Break Duration:</span>
              <span className="ml-2 font-medium">{regulation.break_duration_minutes || 'N/A'}min</span>
            </div>
            <div>
              <span className="text-gray-500">Break Trigger:</span>
              <span className="ml-2 font-medium">{regulation.break_trigger_hours || 'N/A'}h</span>
            </div>
          </div>
        </div>

        {/* Rest Requirements */}
        <div>
          <Text size={400} weight="semibold" className="mb-2 block">Rest Requirements</Text>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Min Rest Between Shifts:</span>
              <span className="ml-2 font-medium">{regulation.min_rest_between_shifts_hours || 'N/A'}h</span>
            </div>
            <div>
              <span className="text-gray-500">Min Weekly Rest:</span>
              <span className="ml-2 font-medium">{regulation.min_weekly_rest_hours || 'N/A'}h</span>
            </div>
            <div>
              <span className="text-gray-500">Max Consecutive Days:</span>
              <span className="ml-2 font-medium">{regulation.max_consecutive_days || 'N/A'} days</span>
            </div>
          </div>
        </div>

        {/* Profile Defaults */}
        {preset.profile_defaults && Object.keys(preset.profile_defaults).length > 0 && (
          <div>
            <Text size={400} weight="semibold" className="mb-2 block">Profile Configuration</Text>
            <div className="space-y-2 text-sm">
              {preset.profile_defaults.auto_approve_overtime !== undefined && (
                <div className="flex items-center gap-2">
                  {preset.profile_defaults.auto_approve_overtime ? (
                    <CheckmarkCircle24Regular className="text-green-500" />
                  ) : (
                    <Warning24Regular className="text-orange-500" />
                  )}
                  <span>Auto-approve overtime: {preset.profile_defaults.auto_approve_overtime ? 'Yes' : 'No'}</span>
                </div>
              )}
              {preset.profile_defaults.require_manager_approval !== undefined && (
                <div className="flex items-center gap-2">
                  {preset.profile_defaults.require_manager_approval ? (
                    <CheckmarkCircle24Regular className="text-blue-500" />
                  ) : (
                    <Warning24Regular className="text-gray-400" />
                  )}
                  <span>Require manager approval: {preset.profile_defaults.require_manager_approval ? 'Yes' : 'No'}</span>
                </div>
              )}
              {preset.profile_defaults.notify_on_violations !== undefined && (
                <div className="flex items-center gap-2">
                  {preset.profile_defaults.notify_on_violations ? (
                    <CheckmarkCircle24Regular className="text-red-500" />
                  ) : (
                    <Warning24Regular className="text-gray-400" />
                  )}
                  <span>Violation alerts: {preset.profile_defaults.notify_on_violations ? 'Enabled' : 'Disabled'}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getPresetDescription = (presetType: string) => {
    switch (presetType) {
      case 'uk_sia':
        return 'UK Security Industry Authority standards with Working Time Regulations 1998 compliance. Suitable for UK security operations with SIA licensing requirements.';
      case 'us_flsa':
        return 'US Fair Labor Standards Act compliance with state-specific variations. Includes federal overtime requirements and break provisions.';
      case 'eu_wtd':
        return 'European Union Working Time Directive 2003/88/EC compliance. Harmonized standards across EU member states with country-specific adaptations.';
      default:
        return 'Regional compliance preset with localized working hours regulations.';
    }
  };

  const selectedPresetData = presets.find(p => p.region_code === selectedPreset);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Text size={600} weight="semibold" className="mb-2 block">Select Regional Preset</Text>
        <Text size={400} className="text-gray-600">
          Choose a regional preset to automatically configure compliance settings based on local regulations.
        </Text>
      </div>

      <MessageBar intent="info">
        <Info24Regular />
        Applying a regional preset will override existing compliance settings with region-specific defaults.
        You can customize these settings after applying the preset.
      </MessageBar>

      <div className="space-y-4">
        <RadioGroup
          value={selectedPreset}
          onChange={(_, data) => setSelectedPreset(data.value)}
        >
          {presets.map((preset) => (
            <div key={preset.region_code} className="space-y-2">
              <Radio value={preset.region_code} label="" />

              <Card
                className={`ml-6 cursor-pointer transition-all ${
                  selectedPreset === preset.region_code ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedPreset(preset.region_code)}
              >
                <CardHeader
                  header={
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getPresetIcon(preset.preset_type)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Text size={500} weight="semibold">{preset.region_name}</Text>
                            <Badge
                              appearance="outline"
                              color={getPresetBadgeColor(preset.preset_type) as any}
                            >
                              {preset.preset_type.toUpperCase()}
                            </Badge>
                          </div>
                          <Text size={300} className="text-gray-600">
                            {getPresetDescription(preset.preset_type)}
                          </Text>
                        </div>
                      </div>
                    </div>
                  }
                />

                <CardPreview>
                  <div className="p-4">
                    <Text size={400}>{preset.description}</Text>

                    <div className="mt-4">
                      <Button
                        appearance="subtle"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPresets(prev =>
                            prev.includes(preset.region_code)
                              ? prev.filter(p => p !== preset.region_code)
                              : [...prev, preset.region_code]
                          );
                        }}
                      >
                        {expandedPresets.includes(preset.region_code) ? 'Hide Details' : 'Show Details'}
                      </Button>
                    </div>

                    {expandedPresets.includes(preset.region_code) && (
                      <div className="mt-4 border-t pt-4">
                        {getPresetDetails(preset)}
                      </div>
                    )}
                  </div>
                </CardPreview>
              </Card>
            </div>
          ))}
        </RadioGroup>
      </div>

      {selectedPresetData && (
        <MessageBar intent="warning">
          <Warning24Regular />
          This will apply {selectedPresetData.region_name} regulations to the selected profile.
          Current settings will be replaced with regional defaults.
        </MessageBar>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          appearance="subtle"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          appearance="primary"
          onClick={() => onSelect(selectedPreset)}
          disabled={!selectedPreset}
        >
          Apply Regional Preset
        </Button>
      </div>
    </div>
  );
};

export default RegionalPresetSelector;