import React from 'react';
import { IconButton } from '@fluentui/react';
import type { ScheduleShift } from '../types';
import { THEME } from '../types';

interface ShiftCardProps {
  shift: ScheduleShift;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onEdit?: (shift: ScheduleShift) => void;
  onDelete?: (shift: ScheduleShift) => void;
  onSelect?: (shiftId: number) => void;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  isSelected = false,
  isSelectionMode = false,
  onEdit,
  onDelete,
  onSelect
}) => {
  // Determine shift type for coloring
  const isOpen = !shift.staffId;
  const isPublished = shift.isPublished && shift.staffId;

  const getShiftColors = () => {
    if (isOpen) return THEME.shift.open;
    if (isPublished) return THEME.shift.published;
    return THEME.shift.assigned;
  };

  const colors = getShiftColors();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelectionMode && onSelect) {
      onSelect(shift.id);
    } else if (onEdit) {
      onEdit(shift);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(shift);
    }
  };

  return (
    <div
      className="shift-card group"
      onClick={handleClick}
      style={{
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
        padding: '8px 10px',
        borderRadius: '6px',
        marginBottom: '4px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease',
        boxShadow: isSelected
          ? `0 0 0 2px ${THEME.primary}`
          : '0 1px 2px rgba(0, 0, 0, 0.05)',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
        }
      }}
    >
      {/* Selection checkbox indicator */}
      {isSelectionMode && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            width: '16px',
            height: '16px',
            borderRadius: '4px',
            border: `2px solid ${isSelected ? THEME.primary : colors.border}`,
            backgroundColor: isSelected ? THEME.primary : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 5L4 7L8 3"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      {/* Time */}
      <div
        style={{
          fontSize: '10px',
          fontWeight: 600,
          opacity: 0.8,
          marginBottom: '2px',
          marginLeft: isSelectionMode ? '20px' : 0
        }}
      >
        {shift.startTime} - {shift.endTime}
      </div>

      {/* Venue */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          marginBottom: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginLeft: isSelectionMode ? '20px' : 0
        }}
      >
        {shift.venueName}
      </div>

      {/* Staff */}
      <div
        style={{
          fontSize: '11px',
          opacity: 0.9,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginLeft: isSelectionMode ? '20px' : 0
        }}
      >
        {shift.staffName || (
          <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Open Shift</span>
        )}
      </div>

      {/* Delete button - visible on hover */}
      {!isSelectionMode && onDelete && (
        <div
          className="shift-delete-btn"
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            opacity: 0,
            transition: 'opacity 0.15s ease'
          }}
        >
          <IconButton
            iconProps={{ iconName: 'Delete' }}
            styles={{
              root: {
                width: '24px',
                height: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '4px'
              },
              icon: {
                fontSize: '12px',
                color: '#ef4444'
              }
            }}
            onClick={handleDelete}
            title="Delete shift"
          />
        </div>
      )}

      {/* Hover styles injected via CSS */}
      <style>{`
        .shift-card:hover .shift-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default ShiftCard;
