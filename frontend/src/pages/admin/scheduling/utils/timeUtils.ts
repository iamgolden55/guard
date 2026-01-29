import { DAY_VIEW_CONFIG } from '../constants';
import type { TimeSlot, TimeBounds, CalendarEvent } from '../types';

const DEFAULT_START = 6;
const DEFAULT_END = 22;
const MIN_HOURS = 12;
const PADDING = 1;

export function calculateTimeBounds(events: CalendarEvent[]): TimeBounds {
  if (events.length === 0) {
    return { startHour: DEFAULT_START, endHour: DEFAULT_END };
  }

  let earliest = 24;
  let latest = 0;

  for (const event of events) {
    earliest = Math.min(earliest, event.start.getHours());
    const endHour = event.end.getHours() + (event.end.getMinutes() > 0 ? 1 : 0);
    latest = Math.max(latest, endHour);
  }

  let startHour = Math.max(0, earliest - PADDING);
  let endHour = Math.min(24, latest + PADDING);

  // Ensure minimum 12-hour window
  if (endHour - startHour < MIN_HOURS) {
    const deficit = MIN_HOURS - (endHour - startHour);
    startHour = Math.max(0, startHour - Math.floor(deficit / 2));
    endHour = Math.min(24, endHour + Math.ceil(deficit / 2));
  }

  return { startHour, endHour };
}

export function generateTimeSlots(
  startHour: number = DAY_VIEW_CONFIG.startHour,
  endHour: number = DAY_VIEW_CONFIG.endHour
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    const hour12 = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';

    slots.push({
      hour,
      label: `${hour12} ${ampm}`,
      isHalfHour: false
    });
  }

  return slots;
}

export function timeToPixels(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = (hours - DAY_VIEW_CONFIG.startHour) * 60 + minutes;
  return (totalMinutes / 60) * DAY_VIEW_CONFIG.slotHeight;
}

export function dateToPixels(date: Date, startHour: number = DAY_VIEW_CONFIG.startHour): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = (hours - startHour) * 60 + minutes;
  return (totalMinutes / 60) * DAY_VIEW_CONFIG.slotHeight;
}

export function calculateEventHeight(startTime: string, endTime: string): number {
  const [startHours, startMins] = startTime.split(':').map(Number);
  const [endHours, endMins] = endTime.split(':').map(Number);

  let startMinutes = startHours * 60 + startMins;
  let endMinutes = endHours * 60 + endMins;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = endMinutes - startMinutes;
  const height = (durationMinutes / 60) * DAY_VIEW_CONFIG.slotHeight;

  return Math.max(height, DAY_VIEW_CONFIG.minimumEventHeight);
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const hour12 = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function isWithinTimelineHours(
  date: Date,
  startHour: number = DAY_VIEW_CONFIG.startHour,
  endHour: number = DAY_VIEW_CONFIG.endHour
): boolean {
  const hour = date.getHours();
  return hour >= startHour && hour < endHour;
}
