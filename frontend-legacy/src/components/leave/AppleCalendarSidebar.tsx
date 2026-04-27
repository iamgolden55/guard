import React, { useCallback, useMemo } from 'react';
import {
  Text,
  PrimaryButton,
  DefaultButton,
  Icon,
  Stack,
  Persona,
  PersonaSize,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import type { LeaveRequest, LeaveRequestStatus } from '../../types/leave';
import type { CalendarDayEvent } from './AppleCalendarDay';
import type { Holiday } from '../../services/holidayService';

interface AppleCalendarSidebarProps {
  isOpen: boolean;
  selectedDate: Date | null;
  dayEvents: CalendarDayEvent[];
  dayHolidays: Holiday[];
  canManage: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onEventSelect: (event: CalendarDayEvent) => void;
  onApprove?: (requestId: number) => void;
  onReject?: (requestId: number) => void;
  onEdit?: (request: LeaveRequest) => void;
  className?: string;
}

const AppleCalendarSidebar: React.FC<AppleCalendarSidebarProps> = ({
  isOpen,
  selectedDate,
  dayEvents,
  dayHolidays,
  canManage,
  isProcessing,
  onClose,
  onEventSelect,
  onApprove,
  onReject,
  onEdit,
  className = ''
}) => {
  // Format selected date
  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';

    return selectedDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [selectedDate]);

  // Get status color and icon
  const getStatusColor = useCallback((status: LeaveRequestStatus) => {
    switch (status) {
      case 'APPROVED':
        return '#34C759'; // Apple green
      case 'PENDING':
        return '#FF9500'; // Apple orange
      case 'REJECTED':
        return '#FF3B30'; // Apple red
      case 'CANCELLED':
        return '#8E8E93'; // Apple gray
      default:
        return '#000000';
    }
  }, []);

  const getStatusIcon = useCallback((status: LeaveRequestStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'Accept';
      case 'PENDING':
        return 'Clock';
      case 'REJECTED':
        return 'Cancel';
      case 'CANCELLED':
        return 'StatusCircleBlock';
      default:
        return 'Info';
    }
  }, []);

  // Handle event click
  const handleEventClick = useCallback((event: CalendarDayEvent) => {
    onEventSelect(event);
  }, [onEventSelect]);

  // Handle action buttons
  const handleApprove = useCallback(async (requestId: number) => {
    if (onApprove) {
      await onApprove(requestId);
    }
  }, [onApprove]);

  const handleReject = useCallback(async (requestId: number) => {
    if (onReject) {
      await onReject(requestId);
    }
  }, [onReject]);

  const handleEdit = useCallback((request: LeaveRequest) => {
    if (onEdit) {
      onEdit(request);
    }
  }, [onEdit]);

  // Group events by status for better organization
  const eventsByStatus = useMemo(() => {
    const groups = {
      APPROVED: [] as CalendarDayEvent[],
      PENDING: [] as CalendarDayEvent[],
      REJECTED: [] as CalendarDayEvent[],
      CANCELLED: [] as CalendarDayEvent[]
    };

    dayEvents.forEach(event => {
      const status = event.leave_request.status;
      if (groups[status]) {
        groups[status].push(event);
      }
    });

    return groups;
  }, [dayEvents]);

  if (!isOpen || !selectedDate) {
    return null;
  }

  return (
    <div className={`apple-calendar-sidebar ${isOpen ? 'is-open' : ''} ${className}`}>
      {/* Header */}
      <div className="apple-calendar-sidebar-header">
        <div>
          <Text className="apple-calendar-sidebar-title" variant="large">
            {formattedDate}
          </Text>
          {(dayEvents.length > 0 || dayHolidays.length > 0) && (
            <Text variant="small" style={{ color: 'rgba(60, 60, 67, 0.6)', marginTop: '4px' }}>
              {dayEvents.length} leave request{dayEvents.length !== 1 ? 's' : ''}
              {dayHolidays.length > 0 && ` • ${dayHolidays.length} holiday${dayHolidays.length !== 1 ? 's' : ''}`}
            </Text>
          )}
        </div>
        <button
          className="apple-calendar-close-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <Icon iconName="Cancel" />
        </button>
      </div>

      {/* Content */}
      <div className="apple-calendar-sidebar-content">
        {/* Holidays */}
        {dayHolidays.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <Text variant="medium" style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
              Public Holidays
            </Text>
            {dayHolidays.map((holiday, index) => (
              <div
                key={`holiday-${index}`}
                className="apple-calendar-event-item"
                style={{
                  background: 'rgba(255, 59, 48, 0.1)',
                  borderColor: '#FF3B30',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon iconName="Vacation" style={{ color: '#FF3B30' }} />
                  <div>
                    <Text variant="medium" style={{ fontWeight: 600, display: 'block' }}>
                      {holiday.localName}
                    </Text>
                    {holiday.name !== holiday.localName && (
                      <Text variant="small" style={{ color: 'rgba(60, 60, 67, 0.6)' }}>
                        {holiday.name}
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leave Requests */}
        {dayEvents.length > 0 ? (
          <div>
            <Text variant="medium" style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
              Leave Requests
            </Text>

            {/* Pending Requests */}
            {eventsByStatus.PENDING.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <Text variant="small" style={{
                  color: '#FF9500',
                  fontWeight: 600,
                  marginBottom: '8px',
                  display: 'block',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.5px'
                }}>
                  Pending Approval ({eventsByStatus.PENDING.length})
                </Text>

                {eventsByStatus.PENDING.map((event, index) => {
                  const request = event.leave_request;
                  const isPending = request.status === 'PENDING';

                  return (
                    <div
                      key={`pending-${event.id}-${index}`}
                      className="apple-calendar-event-item"
                      onClick={() => handleEventClick(event)}
                      style={{ marginBottom: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Persona
                              text={event.user_display_name}
                              size={PersonaSize.size32}
                              hidePersonaDetails
                            />
                            <div>
                              <Text className="apple-calendar-event-title" variant="medium">
                                {event.user_display_name}
                              </Text>
                              <Text variant="small" style={{ color: 'rgba(60, 60, 67, 0.6)' }}>
                                {request.leave_type.name}
                              </Text>
                            </div>
                          </div>

                          <Text className="apple-calendar-event-details" variant="small">
                            {request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
                            {request.start_date !== request.end_date && (
                              <> • {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</>
                            )}
                          </Text>

                          <div className={`apple-calendar-event-status status-${request.status.toLowerCase()}`}>
                            {request.status}
                          </div>
                        </div>

                        <div
                          style={{
                            width: '4px',
                            height: '100%',
                            backgroundColor: event.backgroundColor,
                            borderRadius: '2px',
                            marginLeft: '8px'
                          }}
                        />
                      </div>

                      {/* Action buttons for pending requests */}
                      {canManage && isPending && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid rgba(0, 0, 0, 0.1)'
                        }}>
                          <PrimaryButton
                            text="Approve"
                            iconProps={{ iconName: 'Accept' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(request.id);
                            }}
                            disabled={isProcessing}
                            size="small"
                            styles={{
                              root: {
                                backgroundColor: '#34C759',
                                borderColor: '#34C759',
                                height: '28px',
                                minWidth: '80px'
                              }
                            }}
                          />
                          <DefaultButton
                            text="Reject"
                            iconProps={{ iconName: 'Cancel' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(request.id);
                            }}
                            disabled={isProcessing}
                            size="small"
                            styles={{
                              root: {
                                color: '#FF3B30',
                                borderColor: '#FF3B30',
                                height: '28px',
                                minWidth: '80px'
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Approved Requests */}
            {eventsByStatus.APPROVED.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <Text variant="small" style={{
                  color: '#34C759',
                  fontWeight: 600,
                  marginBottom: '8px',
                  display: 'block',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.5px'
                }}>
                  Approved ({eventsByStatus.APPROVED.length})
                </Text>

                {eventsByStatus.APPROVED.map((event, index) => (
                  <div
                    key={`approved-${event.id}-${index}`}
                    className="apple-calendar-event-item"
                    onClick={() => handleEventClick(event)}
                    style={{ marginBottom: '8px' }}
                  >
                    <EventSummary event={event} />
                  </div>
                ))}
              </div>
            )}

            {/* Other Status Requests */}
            {(eventsByStatus.REJECTED.length > 0 || eventsByStatus.CANCELLED.length > 0) && (
              <div>
                {eventsByStatus.REJECTED.length > 0 && (
                  <Text variant="small" style={{
                    color: '#FF3B30',
                    fontWeight: 600,
                    marginBottom: '8px',
                    display: 'block',
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    letterSpacing: '0.5px'
                  }}>
                    Rejected ({eventsByStatus.REJECTED.length})
                  </Text>
                )}

                {[...eventsByStatus.REJECTED, ...eventsByStatus.CANCELLED].map((event, index) => (
                  <div
                    key={`other-${event.id}-${index}`}
                    className="apple-calendar-event-item"
                    onClick={() => handleEventClick(event)}
                    style={{ marginBottom: '8px', opacity: 0.7 }}
                  >
                    <EventSummary event={event} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          !dayHolidays.length && (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: 'rgba(60, 60, 67, 0.6)'
            }}>
              <Icon iconName="Calendar" style={{ fontSize: '32px', marginBottom: '12px' }} />
              <Text variant="medium" style={{ display: 'block' }}>
                No leave requests
              </Text>
              <Text variant="small">
                This day has no scheduled leave
              </Text>
            </div>
          )
        )}

        {/* Loading overlay */}
        {isProcessing && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 10
          }}>
            <Spinner size={SpinnerSize.medium} />
            <Text variant="small">Processing...</Text>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for event summary
const EventSummary: React.FC<{ event: CalendarDayEvent }> = ({ event }) => {
  const request = event.leave_request;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Persona
            text={event.user_display_name}
            size={PersonaSize.size32}
            hidePersonaDetails
          />
          <div>
            <Text className="apple-calendar-event-title" variant="medium">
              {event.user_display_name}
            </Text>
            <Text variant="small" style={{ color: 'rgba(60, 60, 67, 0.6)' }}>
              {request.leave_type.name}
            </Text>
          </div>
        </div>

        <Text className="apple-calendar-event-details" variant="small">
          {request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
          {request.start_date !== request.end_date && (
            <> • {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</>
          )}
        </Text>

        <div className={`apple-calendar-event-status status-${request.status.toLowerCase()}`}>
          {request.status}
        </div>
      </div>

      <div
        style={{
          width: '4px',
          height: '100%',
          backgroundColor: event.backgroundColor,
          borderRadius: '2px',
          marginLeft: '8px'
        }}
      />
    </div>
  );
};

export default AppleCalendarSidebar;