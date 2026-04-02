import React, { useState, useEffect, useMemo } from 'react';
import { shiftService, venueService } from '../../services';
import type { Venue } from '../../types';
import type { AttendanceReport, StaffAttendanceMetric, PerformanceStatus } from '../../types/attendance';

// Icons from Fluent UI
import {
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Clock24Regular,
  Timer24Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
  ArrowDownload24Regular,
  Filter24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular
} from '@fluentui/react-icons';

// Color palette from design spec
const colors = {
  checkIns: '#10B981',    // Emerald
  noShows: '#EF4444',     // Red
  late: '#F59E0B',        // Amber
  hours: '#6366F1',       // Indigo
  excellent: '#10B981',   // >= 95%
  good: '#6366F1',        // 80-94%
  warning: '#F59E0B',     // 60-79%
  critical: '#EF4444',    // < 60%
};

// Helper to format dates
const formatDateDisplay = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to format numbers with animation class
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
};

// Get status color
const getStatusColor = (status: PerformanceStatus): string => {
  return colors[status] || colors.good;
};

// Stat Card Component with glassmorphism design
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  trendLabel?: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend, trendLabel = 'vs last period', isLoading }) => {
  const isPositiveTrend = trend !== undefined && trend >= 0;
  const showTrend = trend !== undefined;

  return (
    <div
      className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 p-6 stat-card"
      style={{ minWidth: '200px' }}
    >
      {/* Gradient accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(to right, ${color}, ${color}dd)` }}
      />

      {/* Icon with soft background */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${color}15` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>

      {/* Label */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {title}
      </p>

      {/* Value with animation */}
      {isLoading ? (
        <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
      ) : (
        <p className="text-4xl font-bold text-gray-900 tabular-nums metric-value">
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
      )}

      {/* Trend indicator */}
      {showTrend && !isLoading && (
        <div className="flex items-center gap-1 mt-2">
          {isPositiveTrend ? (
            <ArrowUp16Regular className="w-4 h-4" style={{ color: title === 'No-shows' ? colors.critical : colors.checkIns }} />
          ) : (
            <ArrowDown16Regular className="w-4 h-4" style={{ color: title === 'No-shows' ? colors.checkIns : colors.critical }} />
          )}
          <span
            className="text-sm font-medium"
            style={{ color: title === 'No-shows' ? (isPositiveTrend ? colors.critical : colors.checkIns) : (isPositiveTrend ? colors.checkIns : colors.critical) }}
          >
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-sm text-gray-400">{trendLabel}</span>
        </div>
      )}
    </div>
  );
};

// Preset Period Button Component
interface PresetButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const PresetButton: React.FC<PresetButtonProps> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-white shadow-sm text-indigo-600'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    {label}
  </button>
);

// Progress Bar Component
interface ProgressBarProps {
  percentage: number;
  color: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, color }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full progress-fill"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
    <span className="text-sm font-semibold w-12" style={{ color }}>
      {percentage.toFixed(0)}%
    </span>
  </div>
);

// Main Attendance Component
const Attendance: React.FC = () => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activePreset, setActivePreset] = useState<string>('30days');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'onTimePercentage' | 'checkInCount' | 'noShowCount' | 'lateCount' | 'totalHoursWorked'>('onTimePercentage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const pageSize = 25;

  // Fetch venues on mount
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const venueList = await venueService.getAllVenues();
        setVenues(venueList);
      } catch (error) {
        console.error('Failed to fetch venues:', error);
      }
    };
    fetchVenues();
  }, []);

  // Fetch attendance report
  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        const data = await shiftService.getAttendanceReport({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          venueId: selectedVenueId,
          page: currentPage,
          pageSize
        });
        setReport(data);
      } catch (error) {
        console.error('Failed to fetch attendance report:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [startDate, endDate, selectedVenueId, currentPage]);

  // Handle preset period changes
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    let start: Date;

    switch (preset) {
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case '30days':
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
    }

    setStartDate(start);
    setEndDate(now);
    setCurrentPage(1);
  };

  // Sort staff metrics
  const sortedStaffMetrics = useMemo(() => {
    if (!report?.staffMetrics) return [];

    return [...report.staffMetrics].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      return ((aValue as number) - (bValue as number)) * multiplier;
    });
  }, [report?.staffMetrics, sortBy, sortOrder]);

  // Handle sort
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!report?.staffMetrics) return;

    const headers = ['Staff Name', 'Email', 'Check-ins', 'No-shows', 'Late', 'Hours Worked', 'On-time %', 'Status'];
    const rows = report.staffMetrics.map(m => [
      m.staffName,
      m.staffEmail,
      m.checkInCount.toString(),
      m.noShowCount.toString(),
      m.lateCount.toString(),
      m.totalHoursWorked.toString(),
      m.onTimePercentage.toString(),
      m.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Staff Attendance Analytics
            </h1>
            <p className="mt-2 text-gray-500">
              Track check-ins, identify no-shows, monitor punctuality
            </p>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Date range and presets */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Date picker */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-sm">📅</span>
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      setStartDate(new Date(e.target.value));
                      setActivePreset('custom');
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="date"
                    value={endDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      setEndDate(new Date(e.target.value));
                      setActivePreset('custom');
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Preset buttons */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <PresetButton label="This Week" isActive={activePreset === 'week'} onClick={() => handlePresetChange('week')} />
                  <PresetButton label="This Month" isActive={activePreset === 'month'} onClick={() => handlePresetChange('month')} />
                  <PresetButton label="Last 30 Days" isActive={activePreset === '30days'} onClick={() => handlePresetChange('30days')} />
                </div>
              </div>

              {/* Venue filter and export */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter24Regular className="w-5 h-5 text-gray-400" />
                  <select
                    value={selectedVenueId || ''}
                    onChange={(e) => {
                      setSelectedVenueId(e.target.value ? parseInt(e.target.value) : undefined);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
                  >
                    <option value="">All Venues</option>
                    {venues.map(venue => (
                      <option key={venue.id} value={venue.id}>{venue.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportCSV}
                  disabled={isLoading || !report?.staffMetrics?.length}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed export-btn"
                >
                  <ArrowDownload24Regular className="w-5 h-5" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Check-ins"
              value={report?.summary.totalCheckIns || 0}
              icon={<CheckmarkCircle24Regular className="w-6 h-6" />}
              color={colors.checkIns}
              trend={report?.summary.previousPeriodComparison.checkInsChange}
              isLoading={isLoading}
            />
            <StatCard
              title="No-shows"
              value={report?.summary.totalNoShows || 0}
              icon={<DismissCircle24Regular className="w-6 h-6" />}
              color={colors.noShows}
              trend={report?.summary.previousPeriodComparison.noShowsChange}
              isLoading={isLoading}
            />
            <StatCard
              title="Late"
              value={report?.summary.totalLateCheckIns || 0}
              icon={<Clock24Regular className="w-6 h-6" />}
              color={colors.late}
              trend={report?.summary.previousPeriodComparison.lateChange}
              isLoading={isLoading}
            />
            <StatCard
              title="Hours Worked"
              value={report?.summary.totalHoursWorked || 0}
              icon={<Timer24Regular className="w-6 h-6" />}
              color={colors.hours}
              trend={report?.summary.previousPeriodComparison.hoursChange}
              isLoading={isLoading}
            />
          </div>

          {/* Staff Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th
                      className="text-center py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                      onClick={() => handleSort('checkInCount')}
                    >
                      Check-ins {sortBy === 'checkInCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                      onClick={() => handleSort('noShowCount')}
                    >
                      No-shows {sortBy === 'noShowCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                      onClick={() => handleSort('lateCount')}
                    >
                      Late {sortBy === 'lateCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-center py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                      onClick={() => handleSort('totalHoursWorked')}
                    >
                      Hours {sortBy === 'totalHoursWorked' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 min-w-[200px]"
                      onClick={() => handleSort('onTimePercentage')}
                    >
                      On-time Rate {sortBy === 'onTimePercentage' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    // Loading skeleton
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="border-b border-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-gray-200 animate-pulse" />
                            <div>
                              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1" />
                              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-4 px-4"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                        <td className="text-center py-4 px-4"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                        <td className="text-center py-4 px-4"><div className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                        <td className="text-center py-4 px-4"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse mx-auto" /></td>
                        <td className="py-4 px-4"><div className="h-2 w-full bg-gray-200 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : sortedStaffMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No attendance data found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    sortedStaffMetrics.map((staff) => (
                      <tr key={staff.staffId} className="hover:bg-gray-50 transition-colors border-b border-gray-50 table-row">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {/* Status dot */}
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getStatusColor(staff.status) }}
                            />
                            <div>
                              <p className="font-medium text-gray-900">{staff.staffName}</p>
                              <p className="text-sm text-gray-400">{staff.staffEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-4 px-4 font-semibold">{staff.checkInCount}</td>
                        <td className="text-center py-4 px-4">
                          {staff.noShowCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                              {staff.noShowCount} 🔴
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="text-center py-4 px-4">
                          {staff.lateCount > 0 ? (
                            <span className="text-amber-500 font-medium">{staff.lateCount}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="text-center py-4 px-4 font-medium">{staff.totalHoursWorked}h</td>
                        <td className="py-4 px-4">
                          <ProgressBar
                            percentage={staff.onTimePercentage}
                            color={getStatusColor(staff.status)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {report && report.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, report.pagination.totalCount)} of {report.pagination.totalCount} staff
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft24Regular className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-600 px-4">
                    Page {currentPage} of {report.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(report.pagination.totalPages, prev + 1))}
                    disabled={currentPage === report.pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight24Regular className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        .stat-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
        }

        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .metric-value {
          animation: countUp 0.4s ease-out;
        }

        @keyframes fillProgress {
          from { width: 0; }
        }
        .progress-fill {
          animation: fillProgress 0.8s ease-out;
        }

        .table-row {
          transition: background-color 0.15s ease;
        }
        .table-row:hover {
          background-color: #F9FAFB;
        }

        .export-btn:hover:not(:disabled) {
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
        }
      `}</style>
    </>
  );
};

export default Attendance;
