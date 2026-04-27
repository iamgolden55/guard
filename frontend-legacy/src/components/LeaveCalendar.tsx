import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from './cloudscape';
import AppleCalendar from './leave/AppleCalendar';
import type {
  LeaveCalendarEvent
} from '../types/leave';

interface LeaveCalendarProps {
  className?: string;
  defaultView?: 'month' | 'week' | 'agenda';
  showAllStaff?: boolean;
  onEventSelect?: (event: LeaveCalendarEvent) => void;
  onDateSelect?: (date: Date) => void;
  teamOnly?: boolean;
}

// Apple-inspired Leave Calendar Component
const LeaveCalendar: React.FC<LeaveCalendarProps> = ({
  className = '',
  showAllStaff = true,
  onEventSelect,
  onDateSelect,
  teamOnly = false
}) => {
  const { isUserRole } = useAuth();

  // Check permissions
  const canViewAll = showAllStaff && (isUserRole('manager') || isUserRole('admin') || isUserRole('staff'));

  if (!canViewAll) {
    return (
      <div className={className}>
        <Alert type="warning">
          You do not have permission to view the leave calendar.
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Leave Calendar
            </h1>
            <p className="text-gray-600 mt-2">
              View team leave schedules and public holidays in a beautiful, intuitive interface
            </p>
          </div>
        </div>
      </div>

      {/* Apple Calendar */}
      <AppleCalendar
        showAllStaff={showAllStaff}
        onEventSelect={onEventSelect}
        onDateSelect={onDateSelect}
        teamOnly={teamOnly}
        className="apple-calendar-fade-in"
      />
    </div>
  );
};

export default LeaveCalendar;
