import { DAY_VIEW_CONFIG } from '../constants';
import type { TimeSlot } from '../types';

export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (let hour = DAY_VIEW_CONFIG.startHour; hour < DAY_VIEW_CONFIG.endHour; hour++) {
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

export function dateToPixels(date: Date): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = (hours - DAY_VIEW_CONFIG.startHour) * 60 + minutes;
  return Math.max(0, (totalMinutes / 60) * DAY_VIEW_CONFIG.slotHeight);
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

export function isWithinTimelineHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= DAY_VIEW_CONFIG.startHour && hour < DAY_VIEW_CONFIG.endHour;
}
