// Hand-rolled month-grid calendar — 6×7 cells (always full weeks). No external
// calendar dep — date-fns only. Each cell shows day number, a count badge if
// any leave events overlap that date, and a tinted background when the date
// is a company bank holiday.
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWeekend,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useMemo, useState } from "react";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { useAccent } from "../../../contexts/AccentContext";
import type { BankHoliday } from "../../../services/bankHolidayService";
import type { LeaveCalendarEvent } from "../../../types/leave";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface LeaveCalendarProps {
  month: Date;
  onMonthChange: (next: Date) => void;
  events: LeaveCalendarEvent[];
  bankHolidays: BankHoliday[];
  isLoading?: boolean;
}

interface CellEventsResult {
  events: LeaveCalendarEvent[];
  holiday: BankHoliday | null;
}

export function LeaveCalendar({
  month,
  onMonthChange,
  events,
  bankHolidays,
  isLoading,
}: LeaveCalendarProps) {
  const { palette } = useAccent();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const eventsByDate = useMemo(() => {
    // Pre-compute, per cell, which events overlap. Bank holidays exact-match.
    const map = new Map<string, CellEventsResult>();
    for (const day of days) {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayStart = startOfDay(day);
      const matching = events.filter((ev) => {
        const start = parseISO(ev.start);
        const end = parseISO(ev.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
          return false;
        return isWithinInterval(dayStart, { start: startOfDay(start), end: startOfDay(end) });
      });
      const holiday =
        bankHolidays.find((h) => h.date === dayKey) ?? null;
      map.set(dayKey, { events: matching, holiday });
    }
    return map;
  }, [days, events, bankHolidays]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return null;
    return eventsByDate.get(format(selectedDay, "yyyy-MM-dd")) ?? null;
  }, [selectedDay, eventsByDate]);

  const today = startOfDay(new Date());

  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
        overflow: "hidden",
      }}
    >
      {/* Header: month nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          gap: 8,
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => {
            onMonthChange(subMonths(month, 1));
            setSelectedDay(null);
          }}
          style={navButtonStyle}
        >
          <Icon name="chevron-left" size={14} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => {
            onMonthChange(addMonths(month, 1));
            setSelectedDay(null);
          }}
          style={navButtonStyle}
        >
          <Icon name="chevron-right" size={14} />
        </button>
        <div
          style={{
            flex: 1,
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 16,
            color: tokens.color.ink900,
            letterSpacing: "-0.01em",
          }}
        >
          {format(month, "MMMM yyyy")}
        </div>
        <button
          type="button"
          onClick={() => {
            onMonthChange(new Date());
            setSelectedDay(null);
          }}
          style={{
            background: "white",
            color: tokens.color.ink700,
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            padding: "6px 12px",
            fontFamily: tokens.font.display,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Today
        </button>
        {isLoading && (
          <span
            style={{
              fontSize: 11,
              color: tokens.color.ink500,
              fontFamily: tokens.font.body,
            }}
          >
            Loading…
          </span>
        )}
      </div>

      {/* Weekday header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          background: tokens.color.ink50,
          borderBottom: `1px solid ${tokens.color.ink200}`,
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              padding: "8px 12px",
              fontFamily: tokens.font.body,
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              color: tokens.color.ink500,
              textAlign: "center",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridAutoRows: "minmax(82px, 1fr)",
        }}
      >
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const cell = eventsByDate.get(dayKey) ?? { events: [], holiday: null };
          const inCurrentMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const weekend = isWeekend(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          let bg = "white";
          if (cell.holiday) bg = tokens.color.infoSoft;
          else if (weekend) bg = tokens.color.ink50;
          if (!inCurrentMonth) bg = tokens.color.ink50;
          if (isSelected) bg = palette.soft;

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => setSelectedDay(day)}
              title={cell.holiday ? cell.holiday.name : undefined}
              style={{
                background: bg,
                border: "none",
                borderRight: `1px solid ${tokens.color.ink100}`,
                borderBottom: `1px solid ${tokens.color.ink100}`,
                padding: 8,
                textAlign: "left",
                cursor: "pointer",
                minHeight: 82,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                position: "relative",
                outline: isSelected ? `2px solid ${palette.primary}` : "none",
                outlineOffset: -1,
                transition: `background ${tokens.motion.fast}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: tokens.font.display,
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 500,
                    color: !inCurrentMonth
                      ? tokens.color.ink400
                      : isToday
                        ? palette.primary
                        : tokens.color.ink800,
                    background: isToday ? palette.soft : "transparent",
                    padding: isToday ? "2px 7px" : "2px 0",
                    borderRadius: 999,
                    minWidth: 22,
                    textAlign: "center",
                  }}
                >
                  {format(day, "d")}
                </span>
                {cell.events.length > 0 && (
                  <span
                    style={{
                      background: palette.primary,
                      color: "white",
                      fontFamily: tokens.font.mono,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 999,
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {cell.events.length}
                  </span>
                )}
              </div>

              {cell.holiday && (
                <div
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: tokens.color.infoInk,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cell.holiday.name}
                </div>
              )}

              {cell.events.slice(0, 2).map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 10.5,
                    color: tokens.color.ink700,
                    background: tokens.color.ink100,
                    padding: "1px 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ev.user_display_name || ev.title}
                </div>
              ))}
              {cell.events.length > 2 && (
                <div
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 10,
                    color: tokens.color.ink500,
                  }}
                >
                  +{cell.events.length - 2} more
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedDayEvents && (
        <div
          style={{
            padding: 16,
            borderTop: `1px solid ${tokens.color.ink200}`,
            background: tokens.color.ink50,
          }}
        >
          <div
            style={{
              fontFamily: tokens.font.display,
              fontSize: 14,
              fontWeight: 700,
              color: tokens.color.ink900,
              marginBottom: 8,
            }}
          >
            {format(selectedDay, "EEEE, d MMMM yyyy")}
          </div>
          {selectedDayEvents.holiday && (
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 12.5,
                color: tokens.color.infoInk,
                marginBottom: 8,
              }}
            >
              <Icon name="calendar" size={12} /> Bank holiday:{" "}
              {selectedDayEvents.holiday.name}
            </div>
          )}
          {selectedDayEvents.events.length === 0 ? (
            <div
              style={{
                fontFamily: tokens.font.body,
                fontSize: 12.5,
                color: tokens.color.ink500,
              }}
            >
              No leave on this day.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedDayEvents.events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    background: "white",
                    border: `1px solid ${tokens.color.ink200}`,
                    borderRadius: tokens.radius.md,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: tokens.color.ink900,
                      }}
                    >
                      {ev.user_display_name}
                    </div>
                    <div
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: 11.5,
                        color: tokens.color.ink500,
                      }}
                    >
                      {ev.title}
                    </div>
                  </div>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: ev.color || tokens.color.ink400,
                      flexShrink: 0,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const navButtonStyle = {
  width: 30,
  height: 30,
  borderRadius: tokens.radius.md,
  background: tokens.color.ink100,
  border: "none",
  color: tokens.color.ink800,
  cursor: "pointer",
  display: "grid" as const,
  placeItems: "center" as const,
  flexShrink: 0,
};
