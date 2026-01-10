import React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import type { ScheduleShift } from '../types';
import { THEME, DAYS_OF_WEEK } from '../types';
import { DayCell } from './DayCell';

interface CalendarGridProps {
  calendarDays: Date[];
  currentDate: Date;
  shifts: ScheduleShift[];
  isLoading?: boolean;
  isSelectionMode?: boolean;
  selectedShifts?: Set<number>;
  getShiftsForDay: (date: Date) => ScheduleShift[];
  isCurrentMonth: (date: Date) => boolean;
  isToday: (date: Date) => boolean;
  onAddShift?: (date: Date) => void;
  onEditShift?: (shift: ScheduleShift) => void;
  onDeleteShift?: (shift: ScheduleShift) => void;
  onSelectShift?: (shiftId: number) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  calendarDays,
  currentDate,
  shifts,
  isLoading = false,
  isSelectionMode = false,
  selectedShifts = new Set(),
  getShiftsForDay,
  isCurrentMonth,
  isToday,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onSelectShift
}) => {
  return (
    <div
      style={{
        backgroundColor: THEME.bg.primary,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        position: 'relative'
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            zIndex: 10
          }}
        >
          <Spinner
            size={SpinnerSize.large}
            label="Loading shifts..."
            styles={{
              label: { color: THEME.text.secondary }
            }}
          />
        </div>
      )}

      {/* Day headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          marginBottom: '1px'
        }}
      >
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            style={{
              padding: '12px 8px',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: THEME.text.secondary,
              backgroundColor: THEME.bg.secondary,
              borderBottom: `2px solid ${THEME.border.default}`
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          backgroundColor: THEME.border.light,
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden'
        }}
      >
        {calendarDays.map((day, index) => (
          <DayCell
            key={`${day.toISOString()}-${index}`}
            date={day}
            shifts={getShiftsForDay(day)}
            isCurrentMonth={isCurrentMonth(day)}
            isToday={isToday(day)}
            isSelectionMode={isSelectionMode}
            selectedShifts={selectedShifts}
            onAddShift={onAddShift}
            onEditShift={onEditShift}
            onDeleteShift={onDeleteShift}
            onSelectShift={onSelectShift}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}
      >
        <LegendItem
          color={THEME.shift.assigned.border}
          bgColor={THEME.shift.assigned.bg}
          label="Assigned"
        />
        <LegendItem
          color={THEME.shift.open.border}
          bgColor={THEME.shift.open.bg}
          label="Open Shift"
        />
        <LegendItem
          color={THEME.shift.published.border}
          bgColor={THEME.shift.published.bg}
          label="Published"
        />
      </div>
    </div>
  );
};

// Legend item component
interface LegendItemProps {
  color: string;
  bgColor: string;
  label: string;
}

const LegendItem: React.FC<LegendItemProps> = ({ color, bgColor, label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: THEME.text.secondary
    }}
  >
    <div
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '3px',
        backgroundColor: bgColor,
        borderLeft: `3px solid ${color}`
      }}
    />
    {label}
  </div>
);

export default CalendarGrid;
