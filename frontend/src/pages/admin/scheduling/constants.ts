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
  cancelled: 'general'
};

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
