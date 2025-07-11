import React from 'react';
import {
  Stack,
  Text,
  Icon,
  Persona,
  PersonaSize,
  DefaultButton,
  PrimaryButton,
  IStackTokens,
  useTheme,
  mergeStyles
} from '@fluentui/react';
import { RecruitmentApplication } from '../services/recruitmentService';

interface ApplicationCardProps {
  application: RecruitmentApplication;
  onView: (application: RecruitmentApplication) => void;
  onApprove?: (application: RecruitmentApplication) => void;
  onReject?: (application: RecruitmentApplication) => void;
  onConvert?: (application: RecruitmentApplication) => void;
  isMobile?: boolean;
}

const cardTokens: IStackTokens = { childrenGap: 12 };
const actionTokens: IStackTokens = { childrenGap: 8 };

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  onView,
  onApprove,
  onReject,
  onConvert,
  isMobile = false
}) => {
  const theme = useTheme();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return { iconName: 'Clock', color: theme.palette.themePrimary };
      case 'approved':
        return { iconName: 'CheckMark', color: theme.palette.green };
      case 'rejected':
        return { iconName: 'Cancel', color: theme.palette.red };
      default:
        return { iconName: 'Unknown', color: theme.palette.neutralSecondary };
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const baseStyle = {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      display: 'inline-block'
    };

    switch (status) {
      case 'pending':
        return mergeStyles(baseStyle, {
          backgroundColor: theme.palette.themeLighterAlt,
          color: theme.palette.themePrimary,
          border: `1px solid ${theme.palette.themeLight}`
        });
      case 'approved':
        return mergeStyles(baseStyle, {
          backgroundColor: '#f3f9ff',
          color: theme.palette.green,
          border: `1px solid ${theme.palette.greenLight}`
        });
      case 'rejected':
        return mergeStyles(baseStyle, {
          backgroundColor: '#fef4f4',
          color: theme.palette.red,
          border: `1px solid ${theme.palette.redLight}`
        });
      default:
        return mergeStyles(baseStyle, {
          backgroundColor: theme.palette.neutralLighterAlt,
          color: theme.palette.neutralSecondary
        });
    }
  };

  const cardStyle = mergeStyles({
    background: theme.palette.white,
    border: `1px solid ${theme.palette.neutralLight}`,
    borderRadius: '8px',
    padding: isMobile ? '16px' : '20px',
    boxShadow: theme.effects.elevation4,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      boxShadow: theme.effects.elevation8,
      borderColor: theme.palette.themePrimary
    },
    ...(isMobile && {
      margin: '8px 0',
      minHeight: '120px'
    })
  });

  const statusIcon = getStatusIcon(application.status);

  return (
    <div className={cardStyle} onClick={() => onView(application)}>
      <Stack tokens={cardTokens}>
        {/* Header: Name and Status */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Persona
            text={application.full_name}
            secondaryText={application.email}
            size={isMobile ? PersonaSize.size32 : PersonaSize.size40}
            styles={{
              primaryText: {
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '600',
                color: theme.palette.neutralPrimary
              },
              secondaryText: {
                fontSize: isMobile ? '12px' : '14px',
                color: theme.palette.neutralSecondary
              }
            }}
          />
          <div className={getStatusBadgeStyle(application.status)}>
            {application.status}
          </div>
        </Stack>

        {/* Application Details */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack tokens={{ childrenGap: 4 }}>
            <Text variant={isMobile ? 'small' : 'medium'} style={{ color: theme.palette.neutralSecondary }}>
              {application.employment_type_details?.name || 'Unknown Type'}
            </Text>
            <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
              <Icon 
                iconName={application.has_sia_licence ? 'CheckMark' : 'Cancel'} 
                style={{ 
                  color: application.has_sia_licence ? theme.palette.green : theme.palette.red,
                  fontSize: '12px'
                }}
              />
              <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
                SIA License: {application.has_sia_licence ? 'Yes' : 'No'}
              </Text>
            </Stack>
          </Stack>
          
          <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
            {new Date(application.application_date).toLocaleDateString()}
          </Text>
        </Stack>

        {/* Action Buttons */}
        <Stack horizontal tokens={actionTokens} horizontalAlign="start">
          <DefaultButton
            text="View"
            iconProps={{ iconName: 'View' }}
            onClick={(e) => {
              e.stopPropagation();
              onView(application);
            }}
            styles={{
              root: {
                minWidth: isMobile ? '60px' : '80px',
                height: isMobile ? '32px' : '36px'
              },
              label: {
                fontSize: isMobile ? '12px' : '14px'
              }
            }}
          />
          
          {application.status === 'pending' && (
            <>
              {onApprove && (
                <PrimaryButton
                  text="Approve"
                  iconProps={{ iconName: 'CheckMark' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(application);
                  }}
                  styles={{
                    root: {
                      minWidth: isMobile ? '70px' : '90px',
                      height: isMobile ? '32px' : '36px',
                      backgroundColor: theme.palette.green
                    },
                    label: {
                      fontSize: isMobile ? '12px' : '14px'
                    }
                  }}
                />
              )}
              {onReject && (
                <DefaultButton
                  text="Reject"
                  iconProps={{ iconName: 'Cancel' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject(application);
                  }}
                  styles={{
                    root: {
                      minWidth: isMobile ? '60px' : '80px',
                      height: isMobile ? '32px' : '36px',
                      color: theme.palette.red,
                      borderColor: theme.palette.red
                    },
                    label: {
                      fontSize: isMobile ? '12px' : '14px'
                    }
                  }}
                />
              )}
            </>
          )}
          
          {application.status === 'approved' && !application.converted_to_user && onConvert && (
            <PrimaryButton
              text="Convert"
              iconProps={{ iconName: 'AddFriend' }}
              onClick={(e) => {
                e.stopPropagation();
                onConvert(application);
              }}
              styles={{
                root: {
                  minWidth: isMobile ? '70px' : '90px',
                  height: isMobile ? '32px' : '36px'
                },
                label: {
                  fontSize: isMobile ? '12px' : '14px'
                }
              }}
            />
          )}
        </Stack>
      </Stack>
    </div>
  );
};

export default ApplicationCard;