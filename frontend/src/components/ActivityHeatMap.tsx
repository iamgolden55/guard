import type React from 'react';
import { useState, useMemo } from 'react';
import type { ActivityHeatMapData, HeatMapDayData } from '../types';

interface ActivityHeatMapProps {
  data: ActivityHeatMapData;
  isLoading?: boolean;
}

// Get intensity level (0-4) based on completion rate
const getIntensityLevel = (day: HeatMapDayData): number => {
  if (day.isFuture || day.scheduled === 0) return 0;
  const rate = day.completed / day.scheduled;
  if (rate === 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.50) return 2;
  if (rate <= 0.75) return 3;
  return 4;
};

// Color classes for each intensity level
const intensityColors: Record<number, string> = {
  0: 'bg-gray-100',
  1: 'bg-emerald-100',
  2: 'bg-emerald-300',
  3: 'bg-emerald-500',
  4: 'bg-emerald-700',
};

// Day labels for the left side
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format date for tooltip
const formatTooltipDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Get month label for a date
const getMonthLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-AU', { month: 'short' });
};

interface TooltipData {
  day: HeatMapDayData;
  x: number;
  y: number;
}

const ActivityHeatMap: React.FC<ActivityHeatMapProps> = ({
  data,
  isLoading = false,
}) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Organize days into a grid (7 rows x ~13 columns)
  const { grid, monthLabels, weekCount } = useMemo(() => {
    // Handle empty data case
    if (data.days.length === 0) {
      return {
        grid: Array(7).fill(null).map(() => [] as (HeatMapDayData | null)[]),
        monthLabels: [] as { label: string; weekIndex: number }[],
        weekCount: 0,
      };
    }

    // Create a 2D grid: rows are days of week (0-6), columns are weeks
    const weeks = new Map<number, HeatMapDayData[]>();

    for (const day of data.days) {
      if (!weeks.has(day.weekIndex)) {
        weeks.set(day.weekIndex, []);
      }
      weeks.get(day.weekIndex)!.push(day);
    }

    const weekCount = Math.max(...Array.from(weeks.keys())) + 1;

    // Create the grid structure
    const grid: (HeatMapDayData | null)[][] = Array(7)
      .fill(null)
      .map(() => Array(weekCount).fill(null));

    for (const day of data.days) {
      grid[day.dayOfWeek][day.weekIndex] = day;
    }

    // Calculate month labels - find first day of each month
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastMonth = '';

    for (const day of data.days) {
      const month = getMonthLabel(day.date);
      // Show month label at the first occurrence in a new week
      if (month !== lastMonth) {
        monthLabels.push({ label: month, weekIndex: day.weekIndex });
        lastMonth = month;
      }
    }

    return { grid, monthLabels, weekCount };
  }, [data.days]);

  const handleCellMouseEnter = (
    day: HeatMapDayData,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      day,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleCellMouseLeave = () => {
    setTooltip(null);
  };

  if (isLoading) {
    return (
      <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg p-3 inline-block">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-6" />
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(13, 14px)`, gridTemplateRows: 'repeat(7, 14px)' }}
          >
            {[...Array(91)].map((_, i) => (
              <div
                key={i}
                className="w-[14px] h-[14px] bg-gray-200 rounded-sm animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg p-3 inline-block">
      {/* Header with inline legend */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Shift Activity</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {summary.totalCompleted} of {summary.totalScheduled} shifts completed ({summary.completionRate}%)
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400">Less</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`w-3 h-3 rounded-sm ${intensityColors[level]}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-400">More</span>
          </div>
          <p className="text-[10px] text-gray-400">Last 13 weeks</p>
        </div>
      </div>

      {/* Heat Map Grid */}
      <div className="flex gap-1.5">
        {/* Day labels column */}
        <div className="flex flex-col gap-[3px] pt-4 pr-0.5">
          {dayLabels.map((label, index) => (
            <div
              key={label}
              className="h-[14px] text-[10px] text-gray-400 flex items-center justify-end"
              style={{ visibility: index % 2 === 1 ? 'visible' : 'hidden' }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div>
          {/* Month labels row */}
          <div
            className="grid gap-[3px] mb-0.5 h-3"
            style={{ gridTemplateColumns: `repeat(${weekCount || 13}, 14px)` }}
          >
            {Array.from({ length: weekCount || 13 }).map((_, weekIdx) => {
              const monthLabel = monthLabels.find(m => m.weekIndex === weekIdx);
              return (
                <div
                  key={weekIdx}
                  className="text-[10px] text-gray-400 whitespace-nowrap leading-none"
                >
                  {monthLabel?.label || ''}
                </div>
              );
            })}
          </div>

          {/* Grid cells - 7 rows (days) x 13 columns (weeks) */}
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${weekCount || 13}, 14px)`,
              gridTemplateRows: 'repeat(7, 14px)'
            }}
          >
            {/* Render column by column (week by week), then row by row (day by day) */}
            {Array.from({ length: weekCount || 13 }).map((_, weekIndex) =>
              grid.map((row, dayOfWeek) => {
                const day = row[weekIndex];

                if (!day) {
                  return (
                    <div
                      key={`${dayOfWeek}-${weekIndex}`}
                      className="w-[14px] h-[14px] rounded-sm bg-transparent"
                      style={{ gridColumn: weekIndex + 1, gridRow: dayOfWeek + 1 }}
                    />
                  );
                }

                const intensity = getIntensityLevel(day);
                const colorClass = intensityColors[intensity];

                return (
                  <div
                    key={day.date}
                    className={`
                      w-[14px] h-[14px] rounded-sm cursor-pointer transition-all duration-150
                      ${colorClass}
                      ${day.isToday ? 'ring-2 ring-gray-900 ring-offset-1' : ''}
                      ${day.isFuture ? 'opacity-40' : ''}
                      hover:ring-2 hover:ring-gray-400 hover:ring-offset-1
                    `}
                    style={{ gridColumn: weekIndex + 1, gridRow: dayOfWeek + 1 }}
                    onMouseEnter={(e) => handleCellMouseEnter(day, e)}
                    onMouseLeave={handleCellMouseLeave}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="font-medium mb-1">
            {formatTooltipDate(tooltip.day.date)}
          </div>
          {tooltip.day.isFuture ? (
            <div className="text-gray-300">No data yet</div>
          ) : tooltip.day.scheduled === 0 ? (
            <div className="text-gray-300">No shifts scheduled</div>
          ) : (
            <>
              <div>Scheduled: {tooltip.day.scheduled} shift{tooltip.day.scheduled !== 1 ? 's' : ''}</div>
              <div>Completed: {tooltip.day.completed} shift{tooltip.day.completed !== 1 ? 's' : ''}</div>
              <div className="text-emerald-300">
                {Math.round((tooltip.day.completed / tooltip.day.scheduled) * 100)}% completion rate
              </div>
            </>
          )}
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityHeatMap;
