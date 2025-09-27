import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  TabList,
  Tab,
  Spinner,
  MessageBar,
  Badge,
  Card,
  CardHeader,
  CardPreview,
  Text,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent
} from '@fluentui/react-components';
import {
  Globe24Regular,
  Settings24Regular,
  CheckmarkCircle24Regular,
  Warning24Regular,
  Eye24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { WorkingHoursRegulation, RegionComparison } from '../../types/compliance';
import RegionSelector from './RegionSelector';
import RegulationEditor from './RegulationEditor';
import RegulationComparison from './RegulationComparison';
import ComplianceValidationPanel from './ComplianceValidationPanel';

interface WorkingHoursRegulationsListProps {
  className?: string;
}

const WorkingHoursRegulationsList: React.FC<WorkingHoursRegulationsListProps> = ({ className = '' }) => {
  const [selectedTab, setSelectedTab] = useState<string>('GB');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [editingRegulation, setEditingRegulation] = useState<WorkingHoursRegulation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch working hours regulations
  const { data: regulations, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['working-hours-regulations'],
    queryFn: async () => {
      const response = await ComplianceService.getRegulations();
      return response.results;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch available countries
  const { data: countries } = useQuery({
    queryKey: ['regulation-countries'],
    queryFn: async () => {
      const response = await ComplianceService.getCountries();
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  // Get unique country codes for tabs
  const availableCountries = React.useMemo(() => {
    if (!regulations || !countries || !Array.isArray(countries)) return [];

    return countries
      .filter(country => regulations.some(reg => reg.country_code === country.country_code))
      .sort((a, b) => {
        // Prioritize major regions
        const priority = { 'GB': 1, 'US': 2, 'DE': 3, 'FR': 4 };
        const aPriority = priority[a.country_code as keyof typeof priority] || 999;
        const bPriority = priority[b.country_code as keyof typeof priority] || 999;

        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.country_name.localeCompare(b.country_name);
      });
  }, [regulations, countries]);

  // Get regulation for selected country
  const selectedRegulation = React.useMemo(() => {
    return regulations?.find(reg => reg.country_code === selectedTab);
  }, [regulations, selectedTab]);

  const handleEditRegulation = (regulation: WorkingHoursRegulation) => {
    setEditingRegulation(regulation);
  };

  const handleSaveSuccess = () => {
    refetch();
    setEditingRegulation(null);
    setSuccess('Regulation updated successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleRegionSelect = (regionCode: string, selected: boolean) => {
    if (selected && !selectedRegions.includes(regionCode)) {
      setSelectedRegions(prev => [...prev, regionCode]);
    } else if (!selected) {
      setSelectedRegions(prev => prev.filter(code => code !== regionCode));
    }
  };

  const getRegulationStatusBadge = (regulation: WorkingHoursRegulation) => {
    if (regulation.is_active) {
      return (
        <Badge
          appearance="filled"
          color="success"
          icon={<CheckmarkCircle24Regular />}
        >
          Active
        </Badge>
      );
    } else {
      return (
        <Badge
          appearance="outline"
          color="warning"
          icon={<Warning24Regular />}
        >
          Inactive
        </Badge>
      );
    }
  };

  const getComplexityIndicator = (regulation: WorkingHoursRegulation) => {
    // Calculate complexity based on special rules and variations
    const specialRulesCount = regulation.special_rules ? Object.keys(regulation.special_rules).length : 0;
    const hasMultipleOTThresholds = regulation.overtime_threshold_2 ? true : false;

    let complexity = 'low';
    let score = 0;

    if (specialRulesCount > 3) score += 2;
    else if (specialRulesCount > 0) score += 1;

    if (hasMultipleOTThresholds) score += 1;
    if (parseFloat(regulation.max_weekly_hours) > 50) score += 1;
    if (regulation.break_trigger_hours !== regulation.standard_daily_hours) score += 1;

    if (score >= 4) complexity = 'high';
    else if (score >= 2) complexity = 'medium';

    const complexityConfig = {
      low: { color: 'success', text: 'Low Complexity' },
      medium: { color: 'warning', text: 'Medium Complexity' },
      high: { color: 'danger', text: 'High Complexity' }
    };

    const config = complexityConfig[complexity as keyof typeof complexityConfig];

    return (
      <Badge appearance="outline" color={config.color as any}>
        {config.text}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Spinner size="large" label="Loading working hours regulations..." />
      </div>
    );
  }

  if (queryError) {
    return (
      <div className={`${className}`}>
        <MessageBar intent="error">
          Failed to load working hours regulations: {(queryError as Error).message}
        </MessageBar>
      </div>
    );
  }

  if (!availableCountries.length) {
    return (
      <div className={`${className}`}>
        <MessageBar intent="warning">
          No working hours regulations found. Please contact your administrator.
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Working Hours Regulations</h1>
          <p className="text-gray-600">Manage country-specific working hours regulations and compliance rules</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedRegions.length >= 2 && (
            <Button
              appearance="secondary"
              icon={<Eye24Regular />}
              onClick={() => setShowComparisonDialog(true)}
            >
              Compare ({selectedRegions.length})
            </Button>
          )}

          <Button
            appearance="primary"
            icon={<CheckmarkCircle24Regular />}
            onClick={() => setShowValidationDialog(true)}
          >
            Validate Schedule
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <MessageBar intent="error" onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      {success && (
        <MessageBar intent="success" onDismiss={() => setSuccess(null)}>
          {success}
        </MessageBar>
      )}

      {/* Region Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-4">
          <Globe24Regular className="text-blue-600" />
          <Text size={500} weight="semibold">Select Region</Text>
        </div>

        <TabList
          selectedValue={selectedTab}
          onTabSelect={(_, data) => setSelectedTab(data.value)}
        >
          {availableCountries.map((country) => {
            const regulation = regulations?.find(reg => reg.country_code === country.country_code);
            return (
              <Tab
                key={country.country_code}
                value={country.country_code}
                icon={regulation?.is_active ? <CheckmarkCircle24Regular /> : <Warning24Regular />}
              >
                {country.country_code} - {country.country_name}
              </Tab>
            );
          })}
        </TabList>
      </div>

      {/* Selected Regulation Details */}
      {selectedRegulation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Regulation Summary Card */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                header={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe24Regular className="text-blue-600" />
                      <div>
                        <Text size={600} weight="semibold">
                          {selectedRegulation.country_name}
                        </Text>
                        <Text size={400} className="text-gray-600 block">
                          {selectedRegulation.country_name_display}
                        </Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRegulationStatusBadge(selectedRegulation)}
                      {getComplexityIndicator(selectedRegulation)}
                    </div>
                  </div>
                }
                action={
                  <Button
                    appearance="subtle"
                    icon={<Settings24Regular />}
                    onClick={() => handleEditRegulation(selectedRegulation)}
                  >
                    Edit
                  </Button>
                }
              />

              <CardPreview>
                <div className="p-6 space-y-6">
                  {/* Working Hours Overview */}
                  <div>
                    <Text size={500} weight="semibold" className="mb-3 block">Working Hours</Text>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <Text size={700} weight="bold" className="text-blue-600 block">
                          {selectedRegulation.standard_daily_hours}h
                        </Text>
                        <Text size={300} className="text-gray-600">Standard Daily</Text>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <Text size={700} weight="bold" className="text-green-600 block">
                          {selectedRegulation.standard_weekly_hours}h
                        </Text>
                        <Text size={300} className="text-gray-600">Standard Weekly</Text>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <Text size={700} weight="bold" className="text-orange-600 block">
                          {selectedRegulation.max_daily_hours}h
                        </Text>
                        <Text size={300} className="text-gray-600">Max Daily</Text>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <Text size={700} weight="bold" className="text-red-600 block">
                          {selectedRegulation.max_weekly_hours}h
                        </Text>
                        <Text size={300} className="text-gray-600">Max Weekly</Text>
                      </div>
                    </div>
                  </div>

                  {/* Overtime Rules */}
                  <div>
                    <Text size={500} weight="semibold" className="mb-3 block">Overtime & Breaks</Text>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">OT Threshold:</span>
                        <div className="font-medium">{selectedRegulation.overtime_threshold_hours}h</div>
                      </div>
                      <div>
                        <span className="text-gray-500">OT Multiplier:</span>
                        <div className="font-medium">{selectedRegulation.overtime_multiplier_1}x</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Break Duration:</span>
                        <div className="font-medium">{selectedRegulation.break_duration_minutes}min</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Break Trigger:</span>
                        <div className="font-medium">{selectedRegulation.break_trigger_hours}h</div>
                      </div>
                    </div>
                  </div>

                  {/* Rest Requirements */}
                  <div>
                    <Text size={500} weight="semibold" className="mb-3 block">Rest Requirements</Text>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Min Rest Between Shifts:</span>
                        <div className="font-medium">{selectedRegulation.min_rest_between_shifts_hours}h</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Min Weekly Rest:</span>
                        <div className="font-medium">{selectedRegulation.min_weekly_rest_hours}h</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Max Consecutive Days:</span>
                        <div className="font-medium">{selectedRegulation.max_consecutive_days} days</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardPreview>
            </Card>
          </div>

          {/* Region Selector */}
          <div>
            <RegionSelector
              countries={availableCountries}
              regulations={regulations || []}
              selectedRegions={selectedRegions}
              onRegionSelect={handleRegionSelect}
            />
          </div>
        </div>
      )}

      {/* Regulation Editor Dialog */}
      <Dialog open={!!editingRegulation} onOpenChange={(_, data) => !data.open && setEditingRegulation(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Edit Working Hours Regulation</DialogTitle>
            <DialogContent>
              {editingRegulation && (
                <RegulationEditor
                  regulation={editingRegulation}
                  onSave={handleSaveSuccess}
                  onCancel={() => setEditingRegulation(null)}
                />
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Region Comparison Dialog */}
      <Dialog open={showComparisonDialog} onOpenChange={(_, data) => setShowComparisonDialog(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Regional Regulation Comparison</DialogTitle>
            <DialogContent>
              <RegulationComparison
                regionCodes={selectedRegions}
                onClose={() => setShowComparisonDialog(false)}
              />
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Schedule Validation Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={(_, data) => setShowValidationDialog(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Schedule Compliance Validation</DialogTitle>
            <DialogContent>
              <ComplianceValidationPanel
                onClose={() => setShowValidationDialog(false)}
              />
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default WorkingHoursRegulationsList;