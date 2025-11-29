import type React from 'react';
import { Text, PrimaryButton, DefaultButton, Icon } from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { ShiftStatus } from '../types';

interface Shift {
  id: number;
  venue: {
    id: number;
    name: string;
  };
  startTime: string;
  endTime: string | null;
  status: ShiftStatus;
  managerApproved: boolean;
  autoCheckout?: boolean;
  calculated_payment?: number;
  is_invoiced?: boolean;
}

interface ShiftCardProps {
  shift: Shift;
  variant?: 'default' | 'upcoming' | 'active';
  onCheckIn?: (shift: Shift) => void;
  onCheckOut?: (shift: Shift) => void;
  onEndShift?: (shift: Shift) => void;
  className?: string;
}

const ShiftCard: React.FC<ShiftCardProps> = ({ 
  shift, 
  variant = 'default',
  onCheckIn,
  onCheckOut,
  onEndShift,
  className = '' 
}) => {
  const navigate = useNavigate();

  // Format date and time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate shift duration
  const getShiftDuration = () => {
    if (!shift.endTime) return null;
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return `${durationHours.toFixed(1)}h`;
  };

  // Check if shift is upcoming (starts in future)
  const isUpcoming = () => {
    return new Date(shift.startTime) > new Date();
  };

  // Check if shift is ready to start (within 15 minutes of start time)
  const isReadyToStart = () => {
    const now = new Date();
    const startTime = new Date(shift.startTime);

    // Don't show button if shift has ended
    if (shift.endTime) {
      const endTime = new Date(shift.endTime);
      if (endTime < now) return false;
    }

    // Don't show button if shift is from a previous date
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const shiftDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
    if (shiftDate < today) return false;

    const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= 15 && diffMinutes >= -5; // Can check in 15 mins early, 5 mins after
  };

  // Get status color and icon
  const getStatusDetails = () => {
    switch (shift.status) {
      case ShiftStatus.ACTIVE:
        return { 
          color: '#059669', 
          bgColor: '#d1fae5', 
          icon: 'Play', 
          text: 'Active' 
        };
      case ShiftStatus.COMPLETED:
        return { 
          color: '#d97706', 
          bgColor: '#fef3c7', 
          icon: 'CheckMark', 
          text: 'Completed' 
        };
      case ShiftStatus.APPROVED:
        return { 
          color: '#2563eb', 
          bgColor: '#dbeafe', 
          icon: 'Like', 
          text: 'Approved' 
        };
      case ShiftStatus.REJECTED:
        return { 
          color: '#dc2626', 
          bgColor: '#fee2e2', 
          icon: 'Cancel', 
          text: 'Rejected' 
        };
      default:
        return { 
          color: '#6b7280', 
          bgColor: '#f3f4f6', 
          icon: 'Clock', 
          text: 'Scheduled' 
        };
    }
  };

  const statusDetails = getStatusDetails();

  // Get card styling based on variant
  const getCardStyles = () => {
    const baseStyles = "bg-white rounded-2xl shadow-sm border transition-all duration-300 ease-out cursor-pointer";
    
    switch (variant) {
      case 'upcoming':
        if (isReadyToStart()) {
          return `${baseStyles} border-red-400 bg-gradient-to-r from-red-50 to-white shadow-md hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] ring-2 ring-red-200`;
        }
        return `${baseStyles} border-red-200 bg-gradient-to-r from-red-50 to-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]`;
      case 'active':
        return `${baseStyles} border-green-200 bg-gradient-to-r from-green-50 to-white hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]`;
      default:
        return `${baseStyles} border-gray-100 hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.99]`;
    }
  };

  // Render action buttons based on shift status
  const renderActions = () => {
    if (variant === 'upcoming' && isUpcoming()) {
      return (
        <div className="flex space-x-2">
          {isReadyToStart() && (
            <PrimaryButton
              text="Check In"
              iconProps={{ iconName: 'CheckMark' }}
              onClick={(e) => {
                e.stopPropagation();
                onCheckIn?.(shift);
              }}
              styles={{ 
                root: { 
                  backgroundColor: '#dc2626',
                  borderRadius: '8px',
                  fontSize: '12px',
                  minWidth: 'auto',
                  padding: '4px 12px'
                } 
              }}
            />
          )}
        </div>
      );
    }

    switch (shift.status) {
      case 'scheduled':
        return (
          <div className="flex space-x-2">
            <PrimaryButton
              text="Check In"
              iconProps={{ iconName: 'CheckMark' }}
              onClick={(e) => {
                e.stopPropagation();
                onCheckIn?.(shift);
              }}
              styles={{ 
                root: { 
                  backgroundColor: '#dc2626',
                  borderRadius: '8px',
                  fontSize: '12px',
                  minWidth: 'auto',
                  padding: '4px 12px'
                } 
              }}
            />
          </div>
        );
      case 'in_progress':
        return (
          <div className="flex space-x-2">
            <PrimaryButton
              text="Check Out"
              iconProps={{ iconName: 'SignOut' }}
              onClick={(e) => {
                e.stopPropagation();
                onCheckOut?.(shift);
              }}
              styles={{ 
                root: { 
                  backgroundColor: '#dc2626',
                  borderRadius: '8px',
                  fontSize: '12px',
                  minWidth: 'auto',
                  padding: '4px 12px'
                } 
              }}
            />
          </div>
        );
      case ShiftStatus.ACTIVE:
        return (
          <div className="flex space-x-2">
            <PrimaryButton
              text="End Shift"
              iconProps={{ iconName: 'Stop' }}
              onClick={(e) => {
                e.stopPropagation();
                onEndShift?.(shift);
              }}
              styles={{ 
                root: { 
                  backgroundColor: '#dc2626',
                  borderRadius: '8px',
                  fontSize: '12px',
                  minWidth: 'auto',
                  padding: '4px 12px'
                } 
              }}
            />
          </div>
        );
      default:
        return (
          <Icon 
            iconName="ChevronRight" 
            className="text-gray-400 group-hover:text-red-600 transition-colors duration-200" 
            style={{ fontSize: '16px' }} 
          />
        );
    }
  };

  return (
    <div 
      className={`${getCardStyles()} p-6 group ${className}`}
      onClick={() => navigate(`/shifts/${shift.id}`)}
      style={{ 
        transform: 'translateZ(0)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div 
            className="p-2 rounded-lg transition-colors duration-200"
            style={{ 
              backgroundColor: statusDetails.bgColor,
            }}
          >
            <Icon 
              iconName="LocationDot" 
              className="text-red-600" 
              style={{ fontSize: '16px' }} 
            />
          </div>
          <div>
            <Text style={{ 
              fontSize: '18px', 
              fontWeight: '700', 
              color: '#111827',
              lineHeight: '1.2'
            }}>
              {shift.venue.name}
            </Text>
            <Text style={{ 
              fontSize: '12px', 
              color: '#6b7280',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              fontWeight: '500'
            }}>
              Shift #{shift.id}
            </Text>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          {variant === 'upcoming' && isReadyToStart() && (
            <div className="px-2 py-1 rounded-full bg-red-100 border border-red-300">
              <Text style={{ 
                fontSize: '10px', 
                fontWeight: '700',
                color: '#dc2626',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em'
              }}>
                Ready to Start
              </Text>
            </div>
          )}
          <div 
            className="px-3 py-1 rounded-full flex items-center space-x-1"
            style={{ 
              backgroundColor: statusDetails.bgColor,
              color: statusDetails.color
            }}
          >
            <Icon 
              iconName={statusDetails.icon} 
              style={{ fontSize: '12px' }} 
            />
            <Text style={{ 
              fontSize: '12px', 
              fontWeight: '600',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.025em'
            }}>
              {statusDetails.text}
            </Text>
            {shift.autoCheckout && (
              <Icon 
                iconName="Robot" 
                style={{ fontSize: '10px', marginLeft: '4px' }} 
                title="Auto checkout"
              />
            )}
          </div>
        </div>
      </div>

      {/* Shift Details */}
      <div className="space-y-3 mb-4">
        {/* Date and Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Icon 
                iconName="Calendar" 
                style={{ fontSize: '14px', color: '#6b7280' }} 
              />
              <Text style={{ 
                fontSize: '14px', 
                color: '#374151', 
                fontWeight: '500' 
              }}>
                {formatDate(shift.startTime)}
              </Text>
            </div>
            <div className="flex items-center space-x-2">
              <Icon 
                iconName="Clock" 
                style={{ fontSize: '14px', color: '#6b7280' }} 
              />
              <Text style={{ 
                fontSize: '14px', 
                color: '#374151', 
                fontWeight: '500' 
              }}>
                {formatTime(shift.startTime)} - {
                  shift.endTime ? formatTime(shift.endTime) : 'TBD'
                }
              </Text>
            </div>
          </div>
          
          {getShiftDuration() && (
            <div className="flex items-center space-x-1">
              <Icon 
                iconName="Timer" 
                style={{ fontSize: '12px', color: '#6b7280' }} 
              />
              <Text style={{ 
                fontSize: '12px', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                {getShiftDuration()}
              </Text>
            </div>
          )}
        </div>

        {/* Earnings and Approval */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Earnings */}
            {shift.calculated_payment ? (
              <div className="flex items-center space-x-2">
                <Icon 
                  iconName="Money" 
                  style={{ fontSize: '14px', color: '#059669' }} 
                />
                <Text style={{ 
                  fontSize: '16px', 
                  color: '#059669', 
                  fontWeight: '700' 
                }}>
                  £{shift.calculated_payment.toFixed(2)}
                </Text>
                {shift.is_invoiced && (
                  <Text style={{ 
                    fontSize: '10px', 
                    color: '#059669',
                    backgroundColor: '#d1fae5',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase' as const,
                    fontWeight: '600'
                  }}>
                    Invoiced
                  </Text>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Icon 
                  iconName="Money" 
                  style={{ fontSize: '14px', color: '#9ca3af' }} 
                />
                <Text style={{ 
                  fontSize: '14px', 
                  color: '#9ca3af' 
                }}>
                  Earnings TBD
                </Text>
              </div>
            )}

            {/* Manager Approval */}
            <div className="flex items-center space-x-2">
              <Icon 
                iconName={shift.managerApproved ? 'UserCheck' : 'UserClockCog'} 
                style={{ 
                  fontSize: '14px', 
                  color: shift.managerApproved ? '#059669' : '#f59e0b' 
                }} 
              />
              <Text style={{ 
                fontSize: '12px', 
                color: shift.managerApproved ? '#059669' : '#f59e0b',
                fontWeight: '500',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.025em'
              }}>
                {shift.managerApproved ? 'Approved' : 'Pending'}
              </Text>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center">
            {renderActions()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftCard;