import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Text,
  Badge,
  Card,
  CardHeader,
  Spinner,
  MessageBar,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Globe24Regular,
  Warning24Regular,
  CheckmarkCircle24Regular,
  Info24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { RegionComparison } from '../../types/compliance';

interface RegulationComparisonProps {
  regionCodes: string[];
  onClose: () => void;
}

const RegulationComparisonModal: React.FC<RegulationComparisonProps> = ({
  regionCodes,
  onClose,
}) => {
  // Fetch region comparison data
  const { data: comparisonData, isLoading, error } = useQuery({
    queryKey: ['region-comparison', regionCodes],
    queryFn: async () => {
      const response = await ComplianceService.compareRegions(regionCodes);
      return response.data;
    },
    enabled: regionCodes.length >= 2,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="large" label="Comparing regional regulations..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <MessageBar intent="error">
          Failed to load comparison data: {(error as Error).message}
        </MessageBar>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  if (!comparisonData || comparisonData.length < 2) {
    return (
      <div className="space-y-4">
        <MessageBar intent="warning">
          At least 2 regions are required for comparison.
        </MessageBar>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const getComplexityBadge = (complexity: 'low' | 'medium' | 'high') => {
    const complexityConfig = {
      low: { color: 'success', text: 'Low', icon: <CheckmarkCircle24Regular /> },
      medium: { color: 'warning', text: 'Medium', icon: <Warning24Regular /> },
      high: { color: 'danger', text: 'High', icon: <Warning24Regular /> }
    };

    const config = complexityConfig[complexity];

    return (
      <Badge
        appearance="outline"
        color={config.color as any}
        icon={config.icon}
      >
        {config.text} Complexity
      </Badge>
    );
  };

  const formatHours = (hours: string) => {
    const num = parseFloat(hours);
    return num % 1 === 0 ? `${num}h` : `${num}h`;
  };

  const comparisonRows = [
    {
      category: 'Working Hours',
      rows: [
        {
          label: 'Standard Daily Hours',
          values: comparisonData.map(region => formatHours(region.regulations.standard_daily_hours)),
        },
        {
          label: 'Standard Weekly Hours',
          values: comparisonData.map(region => formatHours(region.regulations.standard_weekly_hours)),
        },
        {
          label: 'Max Daily Hours',
          values: comparisonData.map(region => formatHours(region.regulations.max_daily_hours)),
        },
        {
          label: 'Max Weekly Hours',
          values: comparisonData.map(region => formatHours(region.regulations.max_weekly_hours)),
        },
      ],
    },
    {
      category: 'Overtime Rules',
      rows: [
        {
          label: 'OT Threshold',
          values: comparisonData.map(region => formatHours(region.regulations.overtime_threshold_hours)),
        },
        {
          label: 'OT Multiplier (Primary)',
          values: comparisonData.map(region => `${region.regulations.overtime_multiplier_1}x`),
        },
        {
          label: 'OT Threshold (Secondary)',
          values: comparisonData.map(region =>
            region.regulations.overtime_threshold_2
              ? formatHours(region.regulations.overtime_threshold_2)
              : 'N/A'
          ),
        },
        {
          label: 'OT Multiplier (Secondary)',
          values: comparisonData.map(region =>
            region.regulations.overtime_multiplier_2
              ? `${region.regulations.overtime_multiplier_2}x`
              : 'N/A'
          ),
        },
      ],
    },
    {
      category: 'Rest & Breaks',
      rows: [
        {
          label: 'Max Consecutive Days',
          values: comparisonData.map(region => `${region.regulations.max_consecutive_days} days`),
        },
        {
          label: 'Min Rest Between Shifts',
          values: comparisonData.map(region => formatHours(region.regulations.min_rest_between_shifts_hours)),
        },
        {
          label: 'Min Weekly Rest',
          values: comparisonData.map(region => formatHours(region.regulations.min_weekly_rest_hours)),
        },
        {
          label: 'Break Duration',
          values: comparisonData.map(region => `${region.regulations.break_duration_minutes}min`),
        },
        {
          label: 'Break Trigger',
          values: comparisonData.map(region => formatHours(region.regulations.break_trigger_hours)),
        },
      ],
    },
  ];

  // Calculate comparison insights
  const getComparisonInsights = () => {
    const insights = [];

    // Working hours variation
    const maxDailyHours = comparisonData.map(r => parseFloat(r.regulations.max_daily_hours));
    const maxDailyRange = Math.max(...maxDailyHours) - Math.min(...maxDailyHours);
    if (maxDailyRange > 2) {
      insights.push(`Daily hour limits vary by ${maxDailyRange} hours across regions`);
    }

    // Overtime complexity
    const hasSecondaryOT = comparisonData.some(r => r.regulations.overtime_threshold_2);
    if (hasSecondaryOT) {
      insights.push('Some regions use tiered overtime structures');
    }

    // Rest requirements
    const restHours = comparisonData.map(r => parseFloat(r.regulations.min_rest_between_shifts_hours));
    const restRange = Math.max(...restHours) - Math.min(...restHours);
    if (restRange > 3) {
      insights.push(`Rest requirements vary significantly (${restRange}h difference)`);
    }

    // Complexity differences
    const complexities = comparisonData.map(r => r.compliance_complexity);
    const hasHighComplexity = complexities.includes('high');
    const hasLowComplexity = complexities.includes('low');
    if (hasHighComplexity && hasLowComplexity) {
      insights.push('Mix of simple and complex regulatory environments');
    }

    return insights;
  };

  const insights = getComparisonInsights();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text size={600} weight="semibold">Regional Regulation Comparison</Text>
          <Text size={400} className="text-gray-600 mt-1">
            Comparing {comparisonData.length} regional working hours regulations
          </Text>
        </div>
        <Button
          appearance="subtle"
          icon={<Dismiss24Regular />}
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      {/* Region Headers */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparisonData.length}, 1fr)` }}>
        {comparisonData.map((region) => (
          <Card key={region.country_code}>
            <CardHeader
              header={
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Globe24Regular className="text-blue-600" />
                    <Text size={500} weight="semibold">
                      {region.country_code}
                    </Text>
                  </div>
                  <Text size={400} className="text-gray-600 mb-2">
                    {region.country_name}
                  </Text>
                  {getComplexityBadge(region.compliance_complexity)}
                </div>
              }
            />
          </Card>
        ))}
      </div>

      {/* Key Differences */}
      {comparisonData.some(r => r.key_differences.length > 0) && (
        <Card>
          <CardHeader
            header={
              <div className="flex items-center gap-2">
                <Info24Regular className="text-blue-600" />
                <Text size={500} weight="semibold">Key Differences Highlights</Text>
              </div>
            }
          />
          <div className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparisonData.length}, 1fr)` }}>
              {comparisonData.map((region) => (
                <div key={region.country_code}>
                  <Text size={400} weight="semibold" className="mb-2 block">
                    {region.country_name}
                  </Text>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {region.key_differences.slice(0, 3).map((difference, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        <span>{difference}</span>
                      </li>
                    ))}
                    {region.key_differences.length > 3 && (
                      <li className="text-xs text-gray-500">
                        +{region.key_differences.length - 3} more differences
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Detailed Comparison Table */}
      <div className="space-y-6">
        {comparisonRows.map((section) => (
          <div key={section.category}>
            <Text size={500} weight="semibold" className="mb-4 block">
              {section.category}
            </Text>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className="w-1/4">Regulation</TableHeaderCell>
                  {comparisonData.map((region) => (
                    <TableHeaderCell key={region.country_code} className="text-center">
                      {region.country_code}
                    </TableHeaderCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {row.values.map((value, index) => (
                      <TableCell key={index} className="text-center">
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>

      {/* Comparison Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader
            header={
              <Text size={500} weight="semibold">Comparison Insights</Text>
            }
          />
          <div className="p-4">
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Info24Regular className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <Text size={400}>{insight}</Text>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader
          header={
            <Text size={500} weight="semibold">Summary Statistics</Text>
          }
        />
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Text size={600} weight="bold" className="text-blue-600 block">
                {Math.min(...comparisonData.map(r => parseFloat(r.regulations.max_daily_hours)))} - {Math.max(...comparisonData.map(r => parseFloat(r.regulations.max_daily_hours)))}h
              </Text>
              <Text size={300} className="text-gray-600">Daily Hours Range</Text>
            </div>
            <div className="text-center">
              <Text size={600} weight="bold" className="text-green-600 block">
                {Math.min(...comparisonData.map(r => parseFloat(r.regulations.max_weekly_hours)))} - {Math.max(...comparisonData.map(r => parseFloat(r.regulations.max_weekly_hours)))}h
              </Text>
              <Text size={300} className="text-gray-600">Weekly Hours Range</Text>
            </div>
            <div className="text-center">
              <Text size={600} weight="bold" className="text-orange-600 block">
                {Math.min(...comparisonData.map(r => parseFloat(r.regulations.overtime_multiplier_1)))} - {Math.max(...comparisonData.map(r => parseFloat(r.regulations.overtime_multiplier_1)))}x
              </Text>
              <Text size={300} className="text-gray-600">OT Multiplier Range</Text>
            </div>
            <div className="text-center">
              <Text size={600} weight="bold" className="text-red-600 block">
                {comparisonData.filter(r => r.compliance_complexity === 'high').length}
              </Text>
              <Text size={300} className="text-gray-600">High Complexity</Text>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          appearance="primary"
          onClick={onClose}
        >
          Close Comparison
        </Button>
      </div>
    </div>
  );
};

export default RegulationComparisonModal;