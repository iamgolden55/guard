import type { EventType } from './types';

// Tailwind color classes for event types
export const EVENT_COLORS: Record<EventType, {
  bg: string;
  border: string;
  text: string;
  pill: string;
}> = {
  work: {
    bg: 'bg-blue-50',
    border: 'border-l-blue-500',
    text: 'text-blue-900',
    pill: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  open: {
    bg: 'bg-emerald-50',
    border: 'border-l-emerald-500',
    text: 'text-emerald-900',
    pill: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  published: {
    bg: 'bg-purple-50',
    border: 'border-l-purple-500',
    text: 'text-purple-900',
    pill: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  general: {
    bg: 'bg-gray-50',
    border: 'border-l-gray-400',
    text: 'text-gray-700',
    pill: 'bg-gray-100 text-gray-700 border-gray-200'
  },
  personal: {
    bg: 'bg-orange-50',
    border: 'border-l-orange-500',
    text: 'text-orange-900',
    pill: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  break: {
    bg: 'bg-green-50',
    border: 'border-l-green-500',
    text: 'text-green-900',
    pill: 'bg-green-100 text-green-800 border-green-200'
  }
};

// Map shift status to event type
export const SHIFT_STATUS_TO_EVENT_TYPE: Record<string, EventType> = {
  scheduled: 'work',
  open: 'open',
  published: 'published',
  completed: 'general',
  cancelled: 'general',
  active: 'work',
  in_progress: 'work',
  pending_approval: 'general',
  approved: 'work',
  rejected: 'general',
  no_show: 'general'
};

// Safe accessor — returns 'general' colors for unknown event types
export const getEventColors = (type: string) =>
  EVENT_COLORS[type as EventType] || EVENT_COLORS.general;

// Day view configuration
export const DAY_VIEW_CONFIG = {
  startHour: 6,
  endHour: 24,
  slotHeight: 60,
  halfSlotHeight: 30,
  timeAxisWidth: 60,
  minimumEventHeight: 24
} as const;

// Week number calculation helper
export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Modern UI styling tokens for Day View components
export const MODERN_STYLES = {
  eventBlock: {
    base: 'rounded-lg border-l-[5px] px-3 py-2 text-left cursor-pointer overflow-hidden',
    transition: 'transition-all duration-200 ease-out',
    hover: 'hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5',
    active: 'active:scale-[0.99]',
    selected: 'ring-2 ring-amber-500 ring-offset-2 shadow-lg'
  },
  gridLine: {
    hour: 'border-gray-200',
    halfHour: 'border-gray-100/60'
  },
  currentTime: {
    line: 'bg-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]'
  },
  calendar: {
    selected: 'bg-amber-500 text-white',
    eventDot: 'bg-amber-500',
    hover: 'hover:bg-gray-100'
  }
} as const;
