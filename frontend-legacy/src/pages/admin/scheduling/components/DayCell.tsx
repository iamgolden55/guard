import React from 'react';
import { IconButton } from '@fluentui/react';
import type { ScheduleShift } from '../types';
import { THEME } from '../types';
import { ShiftCard } from './ShiftCard';

interface DayCellProps {
  date: Date;
  shifts: ScheduleShift[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelectionMode?: boolean;
  selectedShifts?: Set<number>;
  onAddShift?: (date: Date) => void;
  onEditShift?: (shift: ScheduleShift) => void;
  onDeleteShift?: (shift: ScheduleShift) => void;
  onSelectShift?: (shiftId: number) => void;
}

export const DayCell: React.FC<DayCellProps> = ({
  date,
  shifts,
  isCurrentMonth,
  isToday,
  isSelectionMode = false,
  selectedShifts = new Set(),
  onAddShift,
  onEditShift,
  onDeleteShift,
  onSelectShift
}) => {
  const handleCellClick = () => {
    if (!isSelectionMode && onAddShift) {
      onAddShift(date);
    }
  };

  return (
    <div
      className="day-cell group"
      onClick={handleCellClick}
      style={{
        padding: '8px',
        backgroundColor: isToday ? THEME.primaryLight : THEME.bg.card,
        minHeight: '140px',
        position: 'relative',
        cursor: isSelectionMode ? 'default' : 'pointer',
        opacity: isCurrentMonth ? 1 : 0.4,
        transition: 'all 0.2s ease',
        borderBottom: `1px solid ${THEME.border.light}`,
        borderRight: `1px solid ${THEME.border.light}`,
        ...(isToday && {
          boxShadow: `inset 0 0 0 2px ${THEME.primary}`
        })
      }}
      onMouseEnter={(e) => {
        if (isCurrentMonth && !isToday) {
          e.currentTarget.style.backgroundColor = THEME.bg.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (isCurrentMonth && !isToday) {
          e.currentTarget.style.backgroundColor = THEME.bg.card;
        }
      }}
    >
      {/* Date label */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          fontSize: '14px',
          fontWeight: isToday ? 700 : 500,
          backgroundColor: isToday ? THEME.primary : 'transparent',
          color: isToday ? 'white' : THEME.text.primary,
          padding: isToday ? '2px 8px' : '2px 4px',
          borderRadius: '6px',
          minWidth: '24px',
          textAlign: 'center'
        }}
      >
        {date.getDate()}
      </div>

      {/* Add shift button - visible on hover */}
      {!isSelectionMode && isCurrentMonth && (
        <div
          className="add-shift-btn"
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            opacity: 0,
            transition: 'opacity 0.15s ease'
          }}
        >
          <IconButton
            iconProps={{ iconName: 'Add' }}
            styles={{
              root: {
                width: '24px',
                height: '24px',
                backgroundColor: THEME.primary,
                borderRadius: '6px',
                ':hover': {
                  backgroundColor: THEME.primaryHover
                }
              },
              icon: {
                fontSize: '12px',
                color: 'white'
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAddShift) onAddShift(date);
            }}
            title="Add shift"
          />
        </div>
      )}

      {/* Shifts container */}
      <div
        style={{
          marginTop: '28px',
          maxHeight: 'calc(100% - 36px)',
          overflowY: 'auto',
          paddingRight: '2px'
        }}
      >
        {shifts.length === 0 && isCurrentMonth && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px 8px',
              color: THEME.text.muted,
              fontSize: '11px',
              opacity: 0
            }}
            className="empty-hint"
          >
            Click to add shift
          </div>
        )}

        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            isSelected={selectedShifts.has(shift.id)}
            isSelectionMode={isSelectionMode}
            onEdit={onEditShift}
            onDelete={onDeleteShift}
            onSelect={onSelectShift}
          />
        ))}
      </div>

      {/* Shift count badge for overflow */}
      {shifts.length > 3 && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            fontSize: '10px',
            backgroundColor: THEME.text.muted,
            color: 'white',
            padding: '2px 6px',
            borderRadius: '10px',
            fontWeight: 500
          }}
        >
          +{shifts.length - 3} more
        </div>
      )}

      {/* Hover styles */}
      <style>{`
        .day-cell:hover .add-shift-btn {
          opacity: 1 !important;
        }
        .day-cell:hover .empty-hint {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default DayCell;
