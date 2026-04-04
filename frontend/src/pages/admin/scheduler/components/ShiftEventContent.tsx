import React from 'react';
import type { EventContentArg } from '@fullcalendar/core';
import { AlertTriangle, Clock, EyeOff } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { SHIFT_STATUS_COLORS, DRAFT_OVERLAY } from '../types/scheduler';
import type { ShiftExtendedProps, ShiftStatus } from '../types/scheduler';

export const ShiftEventContent: React.FC<{ eventInfo: EventContentArg }> = ({ eventInfo }) => {
  const props = eventInfo.event.extendedProps as ShiftExtendedProps;
  const statusColors = SHIFT_STATUS_COLORS[props.status as ShiftStatus] || SHIFT_STATUS_COLORS.scheduled;
  const isDraft = !props.isPublished;
  const isOpen = !props.staffId;

  // Calculate display duration
  const start = eventInfo.event.start;
  const end = eventInfo.event.end;
  let durationStr = '';
  if (start && end) {
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    durationStr = `${hours.toFixed(1)}h`;
  }

  return (
    <div
      className={cn(
        'h-full w-full rounded px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden border cursor-pointer transition-shadow hover:shadow-md',
        statusColors.bg,
        statusColors.border,
        statusColors.text,
        isDraft && DRAFT_OVERLAY,
        isOpen && 'border-dashed border-2'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold truncate">
          {isOpen ? 'OPEN' : props.staffName || eventInfo.event.title}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {isDraft && <EyeOff className="h-3 w-3 opacity-50" />}
        </div>
      </div>

      {/* Second row: venue + duration */}
      <div className="flex items-center justify-between gap-1 opacity-80">
        <span className="truncate">{props.venueName}</span>
        {durationStr && (
          <span className="flex items-center gap-0.5 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {durationStr}
          </span>
        )}
      </div>

      {/* Role badge if present */}
      {props.requiredRole && (
        <span className="uppercase text-[9px] font-medium opacity-60">
          {props.requiredRole}
        </span>
      )}
    </div>
  );
};
