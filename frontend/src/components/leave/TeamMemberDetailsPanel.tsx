import React, { useState, useEffect } from 'react';
import {
  Panel,
  PanelType,
  Stack,
  Text,
  Persona,
  PersonaSize,
  ProgressIndicator,
  Icon,
  Separator,
  Pivot,
  PivotItem,
  IStackTokens,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import { User, LeaveBalanceSummary, PendingLeaveRequest } from '../../types/leave';

interface TeamMemberDetailsPanelProps {
  isOpen: boolean;
  onDismiss: () => void;
  userId: number | null;
  memberData?: {
    user: User;
    leaveBalances: LeaveBalanceSummary[];
    pendingRequests: PendingLeaveRequest[];
  };
  onQuickApprove?: (requestId: number) => void;
  onQuickReject?: (requestId: number) => void;
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
};

const TeamMemberDetailsPanel: React.FC<TeamMemberDetailsPanelProps> = ({
  isOpen,
  onDismiss,
  userId,
  memberData,
  onQuickApprove,
  onQuickReject
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);

  if (!memberData || !userId) {
    return null;
  }

  const { user, leaveBalances, pendingRequests } = memberData;
  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.username;

  // Calculate statistics
  const totalAvailableDays = leaveBalances.reduce((sum, balance) => {
    return sum + parseFloat((balance as any).current_balance || '0');
  }, 0);

  const totalUsedDays = leaveBalances.reduce((sum, balance) => {
    return sum + parseFloat((balance as any).used_to_date || '0');
  }, 0);

  const totalEntitlement = leaveBalances.reduce((sum, balance) => {
    return sum + parseFloat((balance as any).total_entitlement || '0');
  }, 0);

  const usagePercentage = totalEntitlement > 0 ? (totalUsedDays / totalEntitlement) * 100 : 0;

  const urgentRequests = pendingRequests.filter(req => req.urgency_level === 'high');
  const mediumRequests = pendingRequests.filter(req => req.urgency_level === 'medium');

  const onRenderFooterContent = () => (
    <Stack horizontal tokens={{ childrenGap: 8 }}>
      <DefaultButton onClick={onDismiss}>Close</DefaultButton>
    </Stack>
  );

  return (
    <Panel
      isOpen={isOpen}
      onDismiss={onDismiss}
      type={PanelType.large}
      headerText={`Team Member Details - ${displayName}`}
      closeButtonAriaLabel="Close"
      onRenderFooterContent={onRenderFooterContent}
      isFooterAtBottom={true}
    >
      <Stack tokens={stackTokens}>
        {/* Member Header */}
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} className="p-4 bg-gray-50 rounded-lg">
          <Persona
            text={displayName}
            secondaryText={user.email}
            size={PersonaSize.size72}
            showSecondaryText={true}
          />
          <Stack.Item grow>
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                {displayName}
              </Text>
              <Text variant="medium" styles={{ root: { color: '#666' } }}>
                {user.email}
              </Text>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                User ID: {user.id}
              </Text>
            </Stack>
          </Stack.Item>
        </Stack>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Available Days
              </Text>
              <Text variant="xLarge" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                {totalAvailableDays.toFixed(1)}
              </Text>
            </Stack>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Used Days
              </Text>
              <Text variant="xLarge" styles={{ root: { fontWeight: 600, color: '#8a8886' } }}>
                {totalUsedDays.toFixed(1)}
              </Text>
            </Stack>
          </div>

          <div className={`p-4 rounded-lg border ${
            pendingRequests.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
          }`}>
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="small" styles={{ root: { color: '#666' } }}>
                Pending Requests
              </Text>
              <Text variant="xLarge" styles={{ root: { fontWeight: 600, color: pendingRequests.length > 0 ? '#ff8c00' : '#107c10' } }}>
                {pendingRequests.length}
              </Text>
            </Stack>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <Stack tokens={{ childrenGap: 8 }}>
          <Stack horizontal horizontalAlign="space-between">
            <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
              Leave Usage
            </Text>
            <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
              {usagePercentage.toFixed(0)}%
            </Text>
          </Stack>
          <ProgressIndicator
            percentComplete={usagePercentage / 100}
            styles={{
              itemProgress: {
                backgroundColor: usagePercentage > 80 ? '#d13438' : usagePercentage > 60 ? '#ff8c00' : '#0078d4'
              }
            }}
          />
          <Text variant="small" styles={{ root: { color: '#666' } }}>
            {totalUsedDays.toFixed(1)} of {totalEntitlement.toFixed(1)} days used
          </Text>
        </Stack>

        <Separator />

        {/* Tabs for different views */}
        <Pivot
          selectedKey={activeTab}
          onLinkClick={(item) => setActiveTab(item?.props.itemKey || 'overview')}
        >
          {/* Overview Tab */}
          <PivotItem headerText="Leave Balances" itemKey="overview">
            <Stack tokens={{ childrenGap: 16 }} styles={{ root: { paddingTop: 16 } }}>
              {leaveBalances.length > 0 ? (
                leaveBalances.map((balance, index) => {
                  const currentBalance = parseFloat((balance as any).current_balance || '0');
                  const usedDays = parseFloat((balance as any).used_to_date || '0');
                  const totalDays = parseFloat((balance as any).total_entitlement || '0');
                  const percentUsed = totalDays > 0 ? (usedDays / totalDays) * 100 : 0;

                  return (
                    <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
                      <Stack tokens={{ childrenGap: 12 }}>
                        {/* Leave Type Header */}
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                backgroundColor: (balance as any).color_code || '#0078d4',
                              }}
                            />
                            <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
                              {(balance as any).leave_type}
                            </Text>
                          </Stack>
                          <Text variant="large" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                            {currentBalance.toFixed(1)} days
                          </Text>
                        </Stack>

                        {/* Balance Details */}
                        <Stack horizontal tokens={{ childrenGap: 24 }}>
                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Total Entitlement
                            </Text>
                            <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                              {totalDays.toFixed(1)} days
                            </Text>
                          </Stack>

                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Used
                            </Text>
                            <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#8a8886' } }}>
                              {usedDays.toFixed(1)} days
                            </Text>
                          </Stack>

                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Available
                            </Text>
                            <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                              {currentBalance.toFixed(1)} days
                            </Text>
                          </Stack>
                        </Stack>

                        {/* Usage Progress */}
                        <Stack tokens={{ childrenGap: 4 }}>
                          <Stack horizontal horizontalAlign="space-between">
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Usage
                            </Text>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              {percentUsed.toFixed(0)}%
                            </Text>
                          </Stack>
                          <ProgressIndicator
                            percentComplete={percentUsed / 100}
                            styles={{
                              itemProgress: {
                                backgroundColor: (balance as any).color_code || '#0078d4'
                              }
                            }}
                          />
                        </Stack>
                      </Stack>
                    </div>
                  );
                })
              ) : (
                <MessageBar messageBarType={MessageBarType.info}>
                  No leave balances available for this team member.
                </MessageBar>
              )}
            </Stack>
          </PivotItem>

          {/* Pending Requests Tab */}
          <PivotItem
            headerText="Pending Requests"
            itemKey="pending"
            itemCount={pendingRequests.length}
          >
            <Stack tokens={{ childrenGap: 16 }} styles={{ root: { paddingTop: 16 } }}>
              {urgentRequests.length > 0 && (
                <MessageBar messageBarType={MessageBarType.warning}>
                  <strong>{urgentRequests.length}</strong> urgent request(s) starting within 3 days
                </MessageBar>
              )}

              {pendingRequests.length > 0 ? (
                pendingRequests.map((request) => (
                  <div key={request.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <Stack tokens={{ childrenGap: 12 }}>
                      {/* Request Header */}
                      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: request.leave_type.color_code || '#0078d4',
                            }}
                          />
                          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
                            {request.leave_type.name}
                          </Text>
                        </Stack>

                        {/* Urgency Badge */}
                        <div
                          className="inline-flex items-center gap-1 px-2 py-1 rounded"
                          style={{
                            backgroundColor: request.urgency_level === 'high'
                              ? '#FDE7E9'
                              : request.urgency_level === 'medium'
                              ? '#FFF4E5'
                              : '#DFF6DD'
                          }}
                        >
                          <Icon
                            iconName={
                              request.urgency_level === 'high'
                                ? 'WarningSolid'
                                : request.urgency_level === 'medium'
                                ? 'Warning'
                                : 'Info'
                            }
                            style={{
                              color: request.urgency_level === 'high'
                                ? '#D13438'
                                : request.urgency_level === 'medium'
                                ? '#FF8C00'
                                : '#107C10',
                              fontSize: '12px'
                            }}
                          />
                          <Text
                            variant="small"
                            style={{
                              color: request.urgency_level === 'high'
                                ? '#D13438'
                                : request.urgency_level === 'medium'
                                ? '#FF8C00'
                                : '#107C10',
                              fontWeight: 600
                            }}
                          >
                            {request.urgency_level.toUpperCase()}
                          </Text>
                        </div>
                      </Stack>

                      {/* Request Details */}
                      <Stack tokens={{ childrenGap: 8 }}>
                        <Stack horizontal tokens={{ childrenGap: 24 }}>
                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Start Date
                            </Text>
                            <Text variant="medium">
                              {new Date(request.start_date).toLocaleDateString()}
                            </Text>
                          </Stack>

                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              End Date
                            </Text>
                            <Text variant="medium">
                              {new Date(request.end_date).toLocaleDateString()}
                            </Text>
                          </Stack>

                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Duration
                            </Text>
                            <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                              {request.days_requested} days
                            </Text>
                          </Stack>

                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Days Until Start
                            </Text>
                            <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                              {request.days_until_start} days
                            </Text>
                          </Stack>
                        </Stack>

                        {request.reason && (
                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="small" styles={{ root: { color: '#666' } }}>
                              Reason
                            </Text>
                            <Text variant="medium" styles={{ root: { fontStyle: 'italic' } }}>
                              "{request.reason}"
                            </Text>
                          </Stack>
                        )}

                        <Text variant="small" styles={{ root: { color: '#666' } }}>
                          Requested on: {new Date(request.created_at).toLocaleDateString()}
                        </Text>
                      </Stack>

                      {/* Actions */}
                      <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <PrimaryButton
                          text="Approve"
                          iconProps={{ iconName: 'CheckMark' }}
                          onClick={() => onQuickApprove?.(request.id)}
                          styles={{
                            root: {
                              backgroundColor: '#107c10',
                              borderColor: '#107c10'
                            },
                            rootHovered: {
                              backgroundColor: '#0E6B0E',
                              borderColor: '#0E6B0E'
                            }
                          }}
                        />
                        <DefaultButton
                          text="Reject"
                          iconProps={{ iconName: 'Cancel' }}
                          onClick={() => onQuickReject?.(request.id)}
                          styles={{
                            root: {
                              color: '#d13438',
                              borderColor: '#d13438'
                            },
                            rootHovered: {
                              backgroundColor: '#FFF0F0',
                              borderColor: '#d13438'
                            }
                          }}
                        />
                      </Stack>
                    </Stack>
                  </div>
                ))
              ) : (
                <MessageBar messageBarType={MessageBarType.success}>
                  No pending requests for this team member.
                </MessageBar>
              )}
            </Stack>
          </PivotItem>
        </Pivot>
      </Stack>
    </Panel>
  );
};

export default TeamMemberDetailsPanel;
