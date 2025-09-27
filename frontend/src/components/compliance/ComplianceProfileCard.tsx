import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardPreview,
  Button,
  Badge,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Checkbox,
  Spinner,
  Tooltip
} from '@fluentui/react-components';
import {
  MoreHorizontal24Regular,
  Edit24Regular,
  Checkmark24Regular,
  Star24Regular,
  Star24Filled,
  Settings24Regular,
  Globe24Regular,
  Warning24Regular,
  CheckmarkCircle24Regular
} from '@fluentui/react-icons';
import { ComplianceProfile } from '../../types/compliance';
import { format } from 'date-fns';

interface ComplianceProfileCardProps {
  profile: ComplianceProfile;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onSetActive: () => void;
  onApplyPreset: (regionCode: string) => void;
  isSettingActive?: boolean;
  isApplyingPreset?: boolean;
}

const ComplianceProfileCard: React.FC<ComplianceProfileCardProps> = ({
  profile,
  selected,
  onSelect,
  onEdit,
  onSetActive,
  onApplyPreset,
  isSettingActive = false,
  isApplyingPreset = false,
}) => {
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const getStatusBadge = () => {
    if (profile.is_active) {
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
          color="subtle"
        >
          Inactive
        </Badge>
      );
    }
  };

  const getRegionBadge = () => {
    const region = profile.working_hours_regulation_data;
    if (!region) return null;

    return (
      <Badge
        appearance="outline"
        color="brand"
        icon={<Globe24Regular />}
      >
        {region.country_code}
      </Badge>
    );
  };

  const getComplianceIndicator = () => {
    const warningThreshold = parseFloat(profile.daily_hours_warning_threshold);
    const maxDailyHours = parseFloat(profile.effective_max_daily_hours);

    if (warningThreshold >= 90) {
      return { color: 'danger', icon: <Warning24Regular />, text: 'High Risk' };
    } else if (warningThreshold >= 80) {
      return { color: 'warning', icon: <Warning24Regular />, text: 'Medium Risk' };
    } else {
      return { color: 'success', icon: <CheckmarkCircle24Regular />, text: 'Low Risk' };
    }
  };

  const complianceIndicator = getComplianceIndicator();

  const formatHours = (hours: string) => {
    const num = parseFloat(hours);
    return num % 1 === 0 ? `${num}h` : `${num}h`;
  };

  const handlePresetSelect = (regionCode: string) => {
    onApplyPreset(regionCode);
    setShowPresetMenu(false);
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        selected ? 'ring-2 ring-blue-500' : ''
      } ${profile.is_active ? 'border-green-200' : ''}`}
      onClick={() => onSelect(!selected)}
    >
      <CardHeader
        header={
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                checked={selected}
                onChange={() => onSelect(!selected)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {profile.name}
                  </h3>
                  {profile.is_active && (
                    <Star24Filled className="text-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {profile.description}
                </p>
              </div>
            </div>

            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  icon={<MoreHorizontal24Regular />}
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                />
              </MenuTrigger>

              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<Edit24Regular />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                  >
                    Edit Profile
                  </MenuItem>

                  {!profile.is_active && (
                    <MenuItem
                      icon={<Star24Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetActive();
                      }}
                      disabled={isSettingActive}
                    >
                      {isSettingActive ? (
                        <>
                          <Spinner size="tiny" />
                          Setting Active...
                        </>
                      ) : (
                        'Set as Active'
                      )}
                    </MenuItem>
                  )}

                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <MenuItem
                        icon={<Globe24Regular />}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Apply Regional Preset
                      </MenuItem>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePresetSelect('GB');
                          }}
                          disabled={isApplyingPreset}
                        >
                          UK (SIA Standards)
                        </MenuItem>
                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePresetSelect('US');
                          }}
                          disabled={isApplyingPreset}
                        >
                          US (FLSA Standards)
                        </MenuItem>
                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePresetSelect('EU');
                          }}
                          disabled={isApplyingPreset}
                        >
                          EU (Working Time Directive)
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        }
      />

      <CardPreview>
        <div className="p-4 space-y-4">
          {/* Status and Region Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge()}
            {getRegionBadge()}
            <Badge
              appearance="outline"
              color={complianceIndicator.color as any}
              icon={complianceIndicator.icon}
            >
              {complianceIndicator.text}
            </Badge>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Max Daily:</span>
              <div className="font-medium">
                {formatHours(profile.effective_max_daily_hours)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Max Weekly:</span>
              <div className="font-medium">
                {formatHours(profile.effective_max_weekly_hours)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Max Consecutive Days:</span>
              <div className="font-medium">
                {profile.effective_max_consecutive_days} days
              </div>
            </div>
            <div>
              <span className="text-gray-500">Grace Period:</span>
              <div className="font-medium">
                {profile.grace_period_minutes}min
              </div>
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              {profile.auto_approve_overtime ? (
                <CheckmarkCircle24Regular className="text-green-500" />
              ) : (
                <Warning24Regular className="text-orange-500" />
              )}
              <span>Auto OT</span>
            </div>
            <div className="flex items-center gap-1">
              {profile.require_manager_approval ? (
                <CheckmarkCircle24Regular className="text-blue-500" />
              ) : (
                <Warning24Regular className="text-gray-400" />
              )}
              <span>Mgr Approval</span>
            </div>
            <div className="flex items-center gap-1">
              {profile.notify_on_violations ? (
                <CheckmarkCircle24Regular className="text-red-500" />
              ) : (
                <Warning24Regular className="text-gray-400" />
              )}
              <span>Alerts</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-gray-400 border-t pt-2">
            <div>Created: {format(new Date(profile.created_at), 'MMM d, yyyy')}</div>
            {profile.updated_at !== profile.created_at && (
              <div>Updated: {format(new Date(profile.updated_at), 'MMM d, yyyy')}</div>
            )}
          </div>
        </div>
      </CardPreview>
    </Card>
  );
};

export default ComplianceProfileCard;