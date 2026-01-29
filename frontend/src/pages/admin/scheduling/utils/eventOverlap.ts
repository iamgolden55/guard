import { DAY_VIEW_CONFIG } from '../constants';
import type { CalendarEvent, PositionedEvent } from '../types';
import { dateToPixels, calculateEventHeight } from './timeUtils';

interface EventGroup {
  events: CalendarEvent[];
  columns: CalendarEvent[][];
}

function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.start < b.end && a.end > b.start;
}

function groupOverlappingEvents(events: CalendarEvent[]): EventGroup[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const groups: EventGroup[] = [];
  let currentGroup: CalendarEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    const overlapsWithGroup = currentGroup.some(e => eventsOverlap(e, event));

    if (overlapsWithGroup) {
      currentGroup.push(event);
    } else {
      groups.push({ events: currentGroup, columns: [] });
      currentGroup = [event];
    }
  }

  groups.push({ events: currentGroup, columns: [] });
  return groups;
}

function assignColumns(group: EventGroup): void {
  const { events } = group;
  const columns: CalendarEvent[][] = [];

  for (const event of events) {
    let placed = false;

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const column = columns[colIdx];
      const lastInColumn = column[column.length - 1];

      if (!eventsOverlap(lastInColumn, event)) {
        column.push(event);
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push([event]);
    }
  }

  group.columns = columns;
}

export function calculateEventPositions(
  events: CalendarEvent[],
  startHour: number = DAY_VIEW_CONFIG.startHour
): PositionedEvent[] {
  if (events.length === 0) return [];

  const groups = groupOverlappingEvents(events);
  const positioned: PositionedEvent[] = [];

  for (const group of groups) {
    assignColumns(group);
    const totalColumns = group.columns.length;
    const columnWidth = 100 / totalColumns;

    for (let colIdx = 0; colIdx < group.columns.length; colIdx++) {
      const column = group.columns[colIdx];

      for (const event of column) {
        const startTime = `${event.start.getHours().toString().padStart(2, '0')}:${event.start.getMinutes().toString().padStart(2, '0')}`;
        const endTime = `${event.end.getHours().toString().padStart(2, '0')}:${event.end.getMinutes().toString().padStart(2, '0')}`;

        positioned.push({
          ...event,
          top: dateToPixels(event.start, startHour),
          height: calculateEventHeight(startTime, endTime),
          left: colIdx * columnWidth,
          width: columnWidth,
          column: colIdx,
          totalColumns
        });
      }
    }
  }

  return positioned;
}

export function detectOverlaps(events: CalendarEvent[]): Map<string, string[]> {
  const overlaps = new Map<string, string[]>();

  for (let i = 0; i < events.length; i++) {
    const eventOverlaps: string[] = [];

    for (let j = 0; j < events.length; j++) {
      if (i !== j && eventsOverlap(events[i], events[j])) {
        eventOverlaps.push(events[j].id);
      }
    }

    if (eventOverlaps.length > 0) {
      overlaps.set(events[i].id, eventOverlaps);
    }
  }

  return overlaps;
}
