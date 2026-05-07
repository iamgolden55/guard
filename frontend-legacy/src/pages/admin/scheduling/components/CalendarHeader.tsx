import React from 'react';
import { IconButton, PrimaryButton } from '@fluentui/react';
import { THEME } from '../types';

interface CalendarHeaderProps {
  monthYearDisplay: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onNewShift?: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  monthYearDisplay,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onNewShift
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}
    >
      {/* Left side - Title and navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        {/* Month/Year display */}
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: THEME.text.primary,
            margin: 0,
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          {monthYearDisplay}
        </h1>

        {/* Navigation buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <IconButton
            iconProps={{ iconName: 'ChevronLeft' }}
            onClick={onPreviousMonth}
            styles={{
              root: {
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${THEME.border.default}`,
                backgroundColor: 'white',
                ':hover': {
                  backgroundColor: THEME.bg.hover,
                  borderColor: THEME.text.muted
                }
              },
              icon: {
                fontSize: '14px',
                color: THEME.text.primary
              }
            }}
            title="Previous month"
          />
          <IconButton
            iconProps={{ iconName: 'ChevronRight' }}
            onClick={onNextMonth}
            styles={{
              root: {
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: `1px solid ${THEME.border.default}`,
                backgroundColor: 'white',
                ':hover': {
                  backgroundColor: THEME.bg.hover,
                  borderColor: THEME.text.muted
                }
              },
              icon: {
                fontSize: '14px',
                color: THEME.text.primary
              }
            }}
            title="Next month"
          />
          <button
            onClick={onToday}
            style={{
              marginLeft: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${THEME.primary}`,
              backgroundColor: 'white',
              color: THEME.primary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = THEME.primaryLight;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Right side - Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        {onNewShift && (
          <PrimaryButton
            iconProps={{ iconName: 'Add' }}
            text="New Shift"
            onClick={onNewShift}
            styles={{
              root: {
                backgroundColor: THEME.primary,
                borderColor: THEME.primary,
                borderRadius: '8px',
                padding: '0 20px',
                height: '40px',
                ':hover': {
                  backgroundColor: THEME.primaryHover,
                  borderColor: THEME.primaryHover
                }
              },
              label: {
                fontWeight: 600
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CalendarHeader;
