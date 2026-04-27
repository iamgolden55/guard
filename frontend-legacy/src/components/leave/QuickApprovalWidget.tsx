import React, { useState, useCallback } from 'react';
import {

  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  IconButton,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  TextField,
  Modal,
  IStackTokens,
  Persona,
  PersonaSize,
  Icon,
  TooltipHost
} from '@fluentui/react';
import { PendingLeaveRequest, LeaveApprovalAction } from '../../types/leave';

interface QuickApprovalWidgetProps {
  pendingRequests: PendingLeaveRequest[];
  onApprove: (requestId: number, comments?: string) => Promise<void>;
  onReject: (requestId: number, comments?: string) => Promise<void>;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

interface ApprovalModalState {
  isOpen: boolean;
  requestId: number | null;
  action: 'approve' | 'reject' | null;
  comments: string;
  isProcessing: boolean;
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
  padding: 16,
};

const QuickApprovalWidget: React.FC<QuickApprovalWidgetProps> = ({
  pendingRequests,
  onApprove,
  onReject,
  onRefresh,
  isLoading = false,
  className = ''
}) => {
  const [modalState, setModalState] = useState<ApprovalModalState>({
    isOpen: false,
    requestId: null,
    action: null,
    comments: '',
    isProcessing: false,
  });

  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  // Open approval modal
  const openApprovalModal = useCallback((requestId: number, action: 'approve' | 'reject') => {
    setModalState({
      isOpen: true,
      requestId,
      action,
      comments: '',
      isProcessing: false,
    });
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      requestId: null,
      action: null,
      comments: '',
      isProcessing: false,
    });
  }, []);

  // Handle approval/rejection
  const handleApprovalAction = useCallback(async () => {
    if (!modalState.requestId || !modalState.action) return;

    setModalState(prev => ({ ...prev, isProcessing: true }));

    try {
      if (modalState.action === 'approve') {
        await onApprove(modalState.requestId, modalState.comments || undefined);
        setNotification({
          type: MessageBarType.success,
          message: 'Leave request approved successfully!'
        });
      } else {
        await onReject(modalState.requestId, modalState.comments || undefined);
        setNotification({
          type: MessageBarType.success,
          message: 'Leave request rejected successfully!'
        });
      }

      closeModal();
      onRefresh?.();
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: `Failed to ${modalState.action} request. Please try again.`
      });
    } finally {
      setModalState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [modalState, onApprove, onReject, onRefresh, closeModal]);

  // Clear notification after 5 seconds
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Get urgency color
  const getUrgencyColor = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'high':
        return '#d13438';
      case 'medium':
        return '#ff8c00';
      default:
        return '#0078d4';
    }
  };

  // Get urgency icon
  const getUrgencyIcon = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'high':
        return 'Warning';
      case 'medium':
        return 'Clock';
      default:
        return 'Info';
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 quick-approval-widget ${className}`}>
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading pending requests..." />
        </Stack>
      </div>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 quick-approval-widget ${className}`}>
        <Stack tokens={stackTokens} horizontalAlign="center">
          <Icon iconName="CheckMark" styles={{ root: { fontSize: 48, color: '#107c10' } }} />
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            All caught up!
          </Text>
          <Text variant="medium" styles={{ root: { color: '#666', textAlign: 'center' } }}>
            No pending leave requests require your attention.
          </Text>
        </Stack>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 quick-approval-widget ${className}`}>
        <Stack tokens={stackTokens}>
          {/* Header */}
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
              Quick Approvals
            </Text>
            <Stack horizontal tokens={{ childrenGap: 8 }}>
              <Text variant="medium" styles={{ root: { color: '#666' } }}>
                {pendingRequests.length} pending
              </Text>
              <TooltipHost content="Refresh">
                <IconButton
                  iconProps={{ iconName: 'Refresh' }}
                  onClick={onRefresh}
                  disabled={isLoading}
                />
              </TooltipHost>
            </Stack>
          </Stack>

          {/* Notification */}
          {notification && (
            <MessageBar
              messageBarType={notification.type}
              onDismiss={() => setNotification(null)}
              dismissButtonAriaLabel="Close"
            >
              {notification.message}
            </MessageBar>
          )}

          {/* Pending Requests List */}
          <Stack tokens={{ childrenGap: 12 }}>
            {pendingRequests.slice(0, 5).map((request) => (
              <Stack
                key={request.id}
                className="pending-request-card p-4 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-all duration-200"
              >
                <Stack tokens={{ childrenGap: 12 }}>
                  {/* Header with user and urgency */}
                  <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                    <Persona
                      text={`${request.user.first_name} ${request.user.last_name}`.trim() || request.user.username}
                      secondaryText={request.user.email}
                      size={PersonaSize.size32}
                      showSecondaryText={true}
                    />

                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                      <TooltipHost content={`${request.urgency_level.charAt(0).toUpperCase() + request.urgency_level.slice(1)} priority`}>
                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                          <Icon
                            iconName={getUrgencyIcon(request.urgency_level)}
                            styles={{ root: { color: getUrgencyColor(request.urgency_level), fontSize: 14 } }}
                          />
                          <Text
                            variant="small"
                            styles={{
                              root: {
                                color: getUrgencyColor(request.urgency_level),
                                fontWeight: 600,
                                textTransform: 'capitalize'
                              }
                            }}
                          >
                            {request.urgency_level}
                          </Text>
                        </Stack>
                      </TooltipHost>

                      {request.days_until_start <= 3 && (
                        <TooltipHost content="Starts in 3 days or less">
                          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                            <Icon iconName="Clock" styles={{ root: { color: '#d13438', fontSize: 12 } }} />
                            <Text variant="small" styles={{ root: { color: '#d13438', fontWeight: 600 } }}>
                              {request.days_until_start} days
                            </Text>
                          </Stack>
                        </TooltipHost>
                      )}
                    </Stack>
                  </Stack>

                  {/* Leave details */}
                  <Stack tokens={{ childrenGap: 8 }}>
                    <Stack horizontal tokens={{ childrenGap: 20 }}>
                      <Stack tokens={{ childrenGap: 2 }}>
                        <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                          Leave Type
                        </Text>
                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: request.leave_type.color_code || '#0078d4',
                            }}
                          />
                          <Text variant="medium">{request.leave_type.name}</Text>
                        </Stack>
                      </Stack>

                      <Stack tokens={{ childrenGap: 2 }}>
                        <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                          Duration
                        </Text>
                        <Text variant="medium">
                          {request.days_requested} days
                        </Text>
                      </Stack>

                      <Stack tokens={{ childrenGap: 2 }}>
                        <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                          Dates
                        </Text>
                        <Text variant="medium">
                          {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                        </Text>
                      </Stack>
                    </Stack>

                    {/* Reason */}
                    {request.reason && (
                      <Stack tokens={{ childrenGap: 2 }}>
                        <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                          Reason
                        </Text>
                        <Text variant="medium" styles={{ root: { fontStyle: 'italic' } }}>
                          "{request.reason}"
                        </Text>
                      </Stack>
                    )}
                  </Stack>

                  {/* Action buttons */}
                  <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                    <DefaultButton
                      text="Reject"
                      iconProps={{ iconName: 'Cancel' }}
                      onClick={() => openApprovalModal(request.id, 'reject')}
                      styles={{
                        root: {
                          borderColor: '#d13438',
                          color: '#d13438',
                        }
                      }}
                    />
                    <PrimaryButton
                      text="Approve"
                      iconProps={{ iconName: 'CheckMark' }}
                      onClick={() => openApprovalModal(request.id, 'approve')}
                      styles={{
                        root: {
                          backgroundColor: '#107c10',
                          borderColor: '#107c10',
                        }
                      }}
                    />
                  </Stack>
                </Stack>
              </Stack>
            ))}

            {pendingRequests.length > 5 && (
              <Stack horizontalAlign="center" className="mt-2">
                <Text variant="medium" styles={{ root: { color: '#666' } }}>
                  +{pendingRequests.length - 5} more requests pending approval
                </Text>
              </Stack>
            )}
          </Stack>
        </Stack>
      </div>

      {/* Approval Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onDismiss={closeModal}
        isBlocking={modalState.isProcessing}
        containerClassName="approval-modal"
      >
        <div className="p-6 bg-white min-w-96">
          <Stack tokens={{ childrenGap: 16 }}>
            <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
              {modalState.action === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </Text>

            <Text variant="medium">
              Are you sure you want to {modalState.action} this leave request?
              {modalState.action === 'reject' && ' Please provide a reason below.'}
            </Text>

            <TextField
              label={modalState.action === 'approve' ? 'Comments (optional)' : 'Reason for rejection'}
              placeholder={
                modalState.action === 'approve'
                  ? 'Add any comments for this approval...'
                  : 'Please provide a reason for rejecting this request...'
              }
              multiline
              rows={3}
              value={modalState.comments}
              onChange={(_, value) => setModalState(prev => ({ ...prev, comments: value || '' }))}
              required={modalState.action === 'reject'}
            />

            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <DefaultButton
                text="Cancel"
                onClick={closeModal}
                disabled={modalState.isProcessing}
              />
              <PrimaryButton
                text={modalState.action === 'approve' ? 'Approve' : 'Reject'}
                onClick={handleApprovalAction}
                disabled={
                  modalState.isProcessing ||
                  (modalState.action === 'reject' && !modalState.comments.trim())
                }
                styles={{
                  root: {
                    backgroundColor: modalState.action === 'approve' ? '#107c10' : '#d13438',
                    borderColor: modalState.action === 'approve' ? '#107c10' : '#d13438',
                  }
                }}
              />
            </Stack>

            {modalState.isProcessing && (
              <Stack horizontal horizontalAlign="center">
                <Spinner size={SpinnerSize.medium} label="Processing request..." />
              </Stack>
            )}
          </Stack>
        </div>
      </Modal>
    </>
  );
};

export default QuickApprovalWidget;