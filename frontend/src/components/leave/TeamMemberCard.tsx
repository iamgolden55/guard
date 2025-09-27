import React from 'react';
import {
  Stack,
  Text,
  Persona,
  PersonaSize,
  ProgressIndicator,
  DefaultButton,
  PrimaryButton,
  Icon,
  IStackTokens,
  Separator,
  TooltipHost
} from '@fluentui/react';
import { LeaveBalanceSummary, User, PendingLeaveRequest } from '../../types/leave';

interface TeamMemberCardProps {
  user: User;
  leaveBalances: LeaveBalanceSummary[];
  pendingRequests: PendingLeaveRequest[];
  onViewDetails?: (userId: number) => void;
  onQuickApprove?: (requestId: number) => void;
  onQuickReject?: (requestId: number) => void;
  className?: string;
}

const cardTokens: IStackTokens = {
  childrenGap: 12,
  padding: 16,
};

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  user,
  leaveBalances,
  pendingRequests,
  onViewDetails,
  onQuickApprove,
  onQuickReject,
  className = ''
}) => {
  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.username;

  // Calculate total available days across all leave types
  const totalAvailableDays = leaveBalances.reduce((sum, balance) => {
    return sum + parseFloat(balance.available_balance || '0');
  }, 0);

  // Calculate total used days
  const totalUsedDays = leaveBalances.reduce((sum, balance) => {
    const entitlement = parseFloat(balance.entitlement.annual_entitlement || '0');
    const available = parseFloat(balance.available_balance || '0');
    return sum + (entitlement - available);
  }, 0);

  // Calculate usage percentage
  const totalEntitlement = leaveBalances.reduce((sum, balance) => {
    return sum + parseFloat(balance.entitlement.annual_entitlement || '0');
  }, 0);
  const usagePercentage = totalEntitlement > 0 ? (totalUsedDays / totalEntitlement) * 100 : 0;

  // Get high priority pending requests (start date within 7 days)
  const urgentPendingRequests = pendingRequests.filter(request => request.urgency_level === 'high');

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 team-member-card ${className}`}>
      <Stack tokens={cardTokens}>
        {/* Header with user info */}
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <Persona
            text={displayName}
            secondaryText={user.email}
            size={PersonaSize.size48}
            showSecondaryText={true}
          />
          <Stack.Item grow>
            <div />
          </Stack.Item>
          <DefaultButton
            text="View Details"
            iconProps={{ iconName: 'View' }}
            onClick={() => onViewDetails?.(user.id)}
          />
        </Stack>

        <Separator />

        {/* Leave Balance Summary */}
        <Stack>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            Leave Balance Overview
          </Text>

          <Stack horizontal horizontalAlign="space-between" tokens={{ childrenGap: 20 }}>
            <Stack.Item grow>
              <Stack tokens={{ childrenGap: 4 }}>
                <Text variant="small" styles={{ root: { color: '#666' } }}>
                  Total Available
                </Text>
                <Text variant="large" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                  {totalAvailableDays.toFixed(1)} days
                </Text>
              </Stack>
            </Stack.Item>

            <Stack.Item grow>
              <Stack tokens={{ childrenGap: 4 }}>
                <Text variant="small" styles={{ root: { color: '#666' } }}>
                  Used This Year
                </Text>
                <Text variant="large" styles={{ root: { fontWeight: 600, color: '#8a8886' } }}>
                  {totalUsedDays.toFixed(1)} days
                </Text>
              </Stack>
            </Stack.Item>

            <Stack.Item grow>
              <Stack tokens={{ childrenGap: 4 }}>
                <Text variant="small" styles={{ root: { color: '#666' } }}>
                  Usage Rate
                </Text>
                <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                  {usagePercentage.toFixed(0)}%
                </Text>
              </Stack>
            </Stack.Item>
          </Stack>

          {/* Usage Progress Bar */}
          <ProgressIndicator
            percentComplete={usagePercentage / 100}
            styles={{
              itemProgress: {
                backgroundColor: usagePercentage > 80 ? '#d13438' : usagePercentage > 60 ? '#ff8c00' : '#0078d4'
              }
            }}
          />
        </Stack>

        {/* Leave Types Breakdown */}
        {leaveBalances.length > 0 && (
          <Stack>
            <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
              Leave Types
            </Text>
            <Stack tokens={{ childrenGap: 8 }}>
              {leaveBalances.slice(0, 3).map((balance) => (
                <Stack
                  key={balance.leave_type.id}
                  horizontal
                  horizontalAlign="space-between"
                  verticalAlign="center"
                  tokens={{ childrenGap: 8 }}
                >
                  <Stack.Item>
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: balance.leave_type.color_code || '#0078d4',
                        }}
                      />
                      <Text variant="small">{balance.leave_type.name}</Text>
                    </Stack>
                  </Stack.Item>
                  <Stack.Item>
                    <Text variant="small" styles={{ root: { fontWeight: 600 } }}>
                      {parseFloat(balance.available_balance || '0').toFixed(1)} days
                    </Text>
                  </Stack.Item>
                </Stack>
              ))}
              {leaveBalances.length > 3 && (
                <Text variant="small" styles={{ root: { color: '#666', fontStyle: 'italic' } }}>
                  +{leaveBalances.length - 3} more types
                </Text>
              )}
            </Stack>
          </Stack>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <>
            <Separator />
            <Stack>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  Pending Requests
                </Text>
                {urgentPendingRequests.length > 0 && (
                  <TooltipHost content="Urgent: Starting within 7 days">
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                      <Icon iconName="Warning" styles={{ root: { color: '#ff8c00' } }} />
                      <Text variant="small" styles={{ root: { color: '#ff8c00', fontWeight: 600 } }}>
                        {urgentPendingRequests.length} Urgent
                      </Text>
                    </Stack>
                  </TooltipHost>
                )}
              </Stack>

              <Stack tokens={{ childrenGap: 8 }}>
                {pendingRequests.slice(0, 2).map((request) => (
                  <Stack
                    key={request.id}
                    className="pending-request-item p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Stack tokens={{ childrenGap: 4 }}>
                        <Text variant="small" styles={{ root: { fontWeight: 600 } }}>
                          {request.leave_type.name}
                        </Text>
                        <Text variant="small" styles={{ root: { color: '#666' } }}>
                          {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                        </Text>
                        <Text variant="small">
                          {request.days_requested} days
                        </Text>
                      </Stack>

                      <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <DefaultButton
                          text="Reject"
                          iconProps={{ iconName: 'Cancel' }}
                          onClick={() => onQuickReject?.(request.id)}
                          styles={{
                            root: {
                              minWidth: 70,
                              backgroundColor: '#fff',
                              borderColor: '#d13438',
                              color: '#d13438'
                            }
                          }}
                        />
                        <PrimaryButton
                          text="Approve"
                          iconProps={{ iconName: 'CheckMark' }}
                          onClick={() => onQuickApprove?.(request.id)}
                          styles={{
                            root: {
                              minWidth: 70,
                              backgroundColor: '#107c10',
                              borderColor: '#107c10'
                            }
                          }}
                        />
                      </Stack>
                    </Stack>

                    {request.reason && (
                      <Text variant="small" styles={{ root: { color: '#666', marginTop: 4, fontStyle: 'italic' } }}>
                        "{request.reason}"
                      </Text>
                    )}
                  </Stack>
                ))}

                {pendingRequests.length > 2 && (
                  <Text variant="small" styles={{ root: { color: '#666', textAlign: 'center' } }}>
                    +{pendingRequests.length - 2} more requests
                  </Text>
                )}
              </Stack>
            </Stack>
          </>
        )}

        {/* Quick Stats Footer */}
        <Separator />
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack horizontal tokens={{ childrenGap: 16 }}>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
              <Icon iconName="Calendar" styles={{ root: { color: '#666', fontSize: 14 } }} />
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                {pendingRequests.length} pending
              </Text>
            </Stack>

            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
              <Icon iconName="Clock" styles={{ root: { color: '#666', fontSize: 14 } }} />
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Last updated: {new Date().toLocaleDateString()}
              </Text>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </div>
  );
};

export default TeamMemberCard;