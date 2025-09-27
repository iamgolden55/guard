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
  Star24Filled,
  CheckmarkCircle24Regular,
  Warning24Regular,
  Globe24Regular,
  Clock24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { ComplianceProfile } from '../../types/compliance';
import { format } from 'date-fns';

interface ProfileComparisonModalProps {
  profileIds: number[];
  onClose: () => void;
}

const ProfileComparisonModal: React.FC<ProfileComparisonModalProps> = ({
  profileIds,
  onClose,
}) => {
  // Fetch profiles data
  const { data: allProfiles, isLoading, error } = useQuery({
    queryKey: ['compliance-profiles'],
    queryFn: async () => {
      const response = await ComplianceService.getAllProfiles();
      return response.results;
    },
    refetchOnWindowFocus: false,
  });

  const profiles = allProfiles?.filter(profile => profileIds.includes(profile.id)) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="large" label="Loading profiles for comparison..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <MessageBar intent="error">
          Failed to load profiles: {(error as Error).message}
        </MessageBar>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  if (profiles.length < 2) {
    return (
      <div className="space-y-4">
        <MessageBar intent="warning">
          At least 2 profiles are required for comparison.
        </MessageBar>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const formatHours = (hours: string) => {
    const num = parseFloat(hours);
    return num % 1 === 0 ? `${num}h` : `${num}h`;
  };

  const getBooleanIcon = (value: boolean) => {
    return value ? (
      <CheckmarkCircle24Regular className="text-green-500" />
    ) : (
      <Warning24Regular className="text-gray-400" />
    );
  };

  const getStatusBadge = (profile: ComplianceProfile) => {
    if (profile.is_active) {
      return (
        <Badge
          appearance="filled"
          color="success"
          icon={<Star24Filled />}
        >
          Active
        </Badge>
      );
    } else {
      return (
        <Badge
          appearance="outline"
          color="subtle"
        >
          Inactive
        </Badge>
      );
    }
  };

  const getRegionBadge = (profile: ComplianceProfile) => {
    const region = profile.working_hours_regulation_data;
    if (!region) return <Badge appearance="outline">Unknown</Badge>;

    return (
      <Badge
        appearance="outline"
        color="brand"
        icon={<Globe24Regular />}
      >
        {region.country_code} - {region.country_name}
      </Badge>
    );
  };

  const comparisonRows = [
    {
      category: 'Basic Information',
      rows: [
        {
          label: 'Profile Name',
          values: profiles.map(p => p.name),
        },
        {
          label: 'Status',
          values: profiles.map(p => getStatusBadge(p)),
        },
        {
          label: 'Region',
          values: profiles.map(p => getRegionBadge(p)),
        },
        {
          label: 'Description',
          values: profiles.map(p => p.description),
        },
      ],
    },
    {
      category: 'Working Hours Limits',
      rows: [
        {
          label: 'Max Daily Hours',
          values: profiles.map(p => formatHours(p.effective_max_daily_hours)),
        },
        {
          label: 'Max Weekly Hours',
          values: profiles.map(p => formatHours(p.effective_max_weekly_hours)),
        },
        {
          label: 'Max Consecutive Days',
          values: profiles.map(p => `${p.effective_max_consecutive_days} days`),
        },
        {
          label: 'Grace Period',
          values: profiles.map(p => `${p.grace_period_minutes} min`),
        },
      ],
    },
    {
      category: 'Warning Thresholds',
      rows: [
        {
          label: 'Daily Hours Warning',
          values: profiles.map(p => `${p.daily_hours_warning_threshold}%`),
        },
        {
          label: 'Weekly Hours Warning',
          values: profiles.map(p => `${p.weekly_hours_warning_threshold}%`),
        },
        {
          label: 'Consecutive Days Warning',
          values: profiles.map(p => `${p.consecutive_days_warning_threshold} days`),
        },
      ],
    },
    {
      category: 'Automation Settings',
      rows: [
        {
          label: 'Auto-approve Overtime',
          values: profiles.map(p => (
            <div className="flex items-center gap-2">
              {getBooleanIcon(p.auto_approve_overtime)}
              <span>{p.auto_approve_overtime ? 'Yes' : 'No'}</span>
            </div>
          )),
        },
        {
          label: 'Auto-approve Extended Hours',
          values: profiles.map(p => (
            <div className="flex items-center gap-2">
              {getBooleanIcon(p.auto_approve_extended_hours)}
              <span>{p.auto_approve_extended_hours ? 'Yes' : 'No'}</span>
            </div>
          )),
        },
        {
          label: 'Require Manager Approval',
          values: profiles.map(p => (
            <div className="flex items-center gap-2">
              {getBooleanIcon(p.require_manager_approval)}
              <span>{p.require_manager_approval ? 'Yes' : 'No'}</span>
            </div>
          )),
        },
        {
          label: 'Break Flexibility',
          values: profiles.map(p => (
            <div className="flex items-center gap-2">
              {getBooleanIcon(p.allow_break_flexibility)}
              <span>{p.allow_break_flexibility ? 'Allowed' : 'Strict'}</span>
            </div>
          )),
        },
      ],
    },
    {
      category: 'Notifications',
      rows: [
        {
          label: 'Notify on Warnings',
          values: profiles.map(p => (
            <div className="flex items-center gap-2">
              {getBooleanIcon(p.notify_on_warnings)}
              <span>{p.notify_on_warnings ? 'Enabled' : 'Disabled'}</span>
            </div>
          )),
        },
        {
          label: 'Notify on Violations',
          values: profiles.map(p => (
            <div className="flex items-center gap-2">
              {getBooleanIcon(p.notify_on_violations)}
              <span>{p.notify_on_violations ? 'Enabled' : 'Disabled'}</span>
            </div>
          )),
        },
        {
          label: 'Notification Recipients',
          values: profiles.map(p => `${p.notification_recipients.length} recipients`),
        },
      ],
    },
    {
      category: 'Metadata',
      rows: [
        {
          label: 'Created',
          values: profiles.map(p => format(new Date(p.created_at), 'MMM d, yyyy')),
        },
        {
          label: 'Last Updated',
          values: profiles.map(p => format(new Date(p.updated_at), 'MMM d, yyyy')),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text size={600} weight="semibold">Profile Comparison</Text>
          <Text size={400} className="text-gray-600 mt-1">
            Comparing {profiles.length} compliance profiles
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

      {/* Profile Headers */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${profiles.length}, 1fr)` }}>
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardHeader
              header={
                <div className="text-center">
                  <Text size={500} weight="semibold" className="block mb-2">
                    {profile.name}
                  </Text>
                  {getStatusBadge(profile)}
                </div>
              }
            />
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="space-y-6">
        {comparisonRows.map((section) => (
          <div key={section.category}>
            <Text size={500} weight="semibold" className="mb-4 block">
              {section.category}
            </Text>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className="w-1/4">Property</TableHeaderCell>
                  {profiles.map((profile) => (
                    <TableHeaderCell key={profile.id} className="text-center">
                      {profile.name}
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

      {/* Key Differences Summary */}
      <Card>
        <CardHeader
          header={
            <Text size={500} weight="semibold">Key Differences Summary</Text>
          }
        />
        <div className="p-4 space-y-3">
          {/* Working Hours Comparison */}
          <div>
            <Text size={400} weight="semibold" className="block mb-2">Working Hours Limits</Text>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Max Daily Range:</span>
                <span className="ml-2 font-medium">
                  {Math.min(...profiles.map(p => parseFloat(p.effective_max_daily_hours)))}h - {Math.max(...profiles.map(p => parseFloat(p.effective_max_daily_hours)))}h
                </span>
              </div>
              <div>
                <span className="text-gray-500">Max Weekly Range:</span>
                <span className="ml-2 font-medium">
                  {Math.min(...profiles.map(p => parseFloat(p.effective_max_weekly_hours)))}h - {Math.max(...profiles.map(p => parseFloat(p.effective_max_weekly_hours)))}h
                </span>
              </div>
              <div>
                <span className="text-gray-500">Consecutive Days Range:</span>
                <span className="ml-2 font-medium">
                  {Math.min(...profiles.map(p => p.effective_max_consecutive_days))} - {Math.max(...profiles.map(p => p.effective_max_consecutive_days))} days
                </span>
              </div>
            </div>
          </div>

          {/* Automation Differences */}
          <div>
            <Text size={400} weight="semibold" className="block mb-2">Automation Settings</Text>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Auto OT: {profiles.filter(p => p.auto_approve_overtime).length}/{profiles.length} enabled
              </span>
              <span>
                Manager Approval: {profiles.filter(p => p.require_manager_approval).length}/{profiles.length} required
              </span>
              <span>
                Violation Alerts: {profiles.filter(p => p.notify_on_violations).length}/{profiles.length} enabled
              </span>
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

export default ProfileComparisonModal;