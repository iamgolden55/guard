import type React from 'react';

interface DayData {
  date: string;
  label: string;
  completed: number;
  scheduled: number;
}

interface WeeklyActivityChartProps {
  data: DayData[];
  isLoading?: boolean;
}

const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({
  data,
  isLoading = false,
}) => {
  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => Math.max(d.completed, d.scheduled)), 1);

  // Calculate bar height percentage
  const getBarHeight = (value: number) => {
    return Math.max((value / maxValue) * 100, 4); // Minimum 4% height for visibility
  };

  if (isLoading) {
    return (
      <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-32 flex items-end justify-around gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full h-20 bg-gray-200 rounded animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />
              <div className="h-3 w-6 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
  const totalScheduled = data.reduce((sum, d) => sum + d.scheduled, 0);
  const completionRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  return (
    <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Weekly Activity</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalCompleted} of {totalScheduled} shifts completed ({completionRate}%)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
            <span className="text-gray-600">Scheduled</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-28 flex items-end gap-1 sm:gap-2">
        {data.map((day, index) => {
          const isToday = new Date().toDateString() === new Date(day.date).toDateString();

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              {/* Bars container */}
              <div className="w-full h-20 flex items-end justify-center gap-0.5 sm:gap-1">
                {/* Scheduled bar (background) */}
                <div
                  className="w-1/2 sm:w-2/5 bg-gray-200 rounded-t transition-all duration-300"
                  style={{ height: `${getBarHeight(day.scheduled)}%` }}
                  title={`${day.scheduled} scheduled`}
                />
                {/* Completed bar */}
                <div
                  className="w-1/2 sm:w-2/5 bg-emerald-500 rounded-t transition-all duration-300"
                  style={{ height: `${getBarHeight(day.completed)}%` }}
                  title={`${day.completed} completed`}
                />
              </div>

              {/* Day label */}
              <span className={`text-xs ${isToday ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyActivityChart;
