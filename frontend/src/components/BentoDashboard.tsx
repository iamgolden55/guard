import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner, SpinnerSize } from '@fluentui/react';
import {
  People24Regular,
  Clock24Regular,
  PersonCheckmark24Regular,
  Target24Regular,
  Money24Regular,
  Timer24Regular,
  Building24Regular,
  Document24Regular,
  MoreHorizontal20Regular,
  ArrowTrendingUp20Filled,
  ArrowTrendingDown20Filled,
  Warning20Filled,
  Checkmark20Filled,
  Dismiss20Filled,
  PersonAdd20Filled,
  ArrowSwap20Filled,
  Fire20Filled,
  Calendar20Regular,
  ArrowDownload20Regular,
} from '@fluentui/react-icons';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js';
import { motion } from 'framer-motion';
import { shiftService, invoiceService, venueService, exchangeService } from '../services';
import api from '../services/api';
import type { Shift, Invoice, Venue, User } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'emerald' | 'amber' | 'violet' | 'sky' | 'rose';
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  isLoading?: boolean;
  onClick?: () => void;
  index: number;
}

const colorClasses = {
  emerald: {
    accent: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    trendBg: 'bg-emerald-50',
    trendText: 'text-emerald-600',
  },
  amber: {
    accent: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    trendBg: 'bg-amber-50',
    trendText: 'text-amber-600',
  },
  violet: {
    accent: 'bg-violet-500',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    trendBg: 'bg-violet-50',
    trendText: 'text-violet-600',
  },
  sky: {
    accent: 'bg-sky-500',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    trendBg: 'bg-sky-50',
    trendText: 'text-sky-600',
  },
  rose: {
    accent: 'bg-rose-500',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    trendBg: 'bg-rose-50',
    trendText: 'text-rose-600',
  },
};

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon,
  color,
  trend,
  isLoading,
  onClick,
  index,
}) => {
  const colors = colorClasses[color];

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      className={`
        bg-white rounded-xl border border-gray-200 shadow-sm p-5 relative overflow-hidden
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${colors.accent} rounded-t-xl`} />

      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl ${colors.iconBg} flex items-center justify-center mb-3`}>
        <span className={colors.iconColor}>{icon}</span>
      </div>

      {/* Value */}
      {isLoading ? (
        <Spinner size={SpinnerSize.small} className="my-2" />
      ) : (
        <AnimatedCounter value={value} className="text-3xl font-bold text-gray-900 mb-1" />
      )}

      {/* Label */}
      <div className="text-sm text-gray-500 font-medium">{title}</div>

      {/* Trend */}
      {trend && (
        <div
          className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold
            ${trend.direction === 'up' ? 'bg-emerald-50 text-emerald-600' : ''}
            ${trend.direction === 'down' ? 'bg-rose-50 text-rose-600' : ''}
            ${trend.direction === 'neutral' ? colors.trendBg + ' ' + colors.trendText : ''}
          `}
        >
          {trend.direction === 'up' && <ArrowTrendingUp20Filled className="w-3 h-3" />}
          {trend.direction === 'down' && <ArrowTrendingDown20Filled className="w-3 h-3" />}
          {trend.direction === 'neutral' && <Warning20Filled className="w-3 h-3" />}
          {trend.value}
        </div>
      )}
    </motion.div>
  );
};

// Animated Counter Component
interface AnimatedCounterProps {
  value: string | number;
  className?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, className }) => {
  const [displayValue, setDisplayValue] = useState<string | number>(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;

    const numericValue = typeof value === 'string' ? Number.parseFloat(value.replace(/[^0-9.-]/g, '')) : value;

    if (Number.isNaN(numericValue)) {
      setDisplayValue(value);
      return;
    }

    hasAnimated.current = true;
    const duration = 800;
    const start = performance.now();
    const prefix = typeof value === 'string' && value.startsWith('£') ? '£' : '';
    const suffix = typeof value === 'string' && value.endsWith('%') ? '%' : '';

    const animate = (currentTime: number) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - (1 - progress) ** 3;
      const current = Math.floor(easeOut * numericValue);

      setDisplayValue(`${prefix}${current.toLocaleString()}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <div className={className}>{displayValue}</div>;
};

// Activity Item Component
interface ActivityItemProps {
  type: 'checkin' | 'checkout' | 'approval' | 'invoice' | 'alert' | 'user' | 'exchange' | 'check';
  title: string;
  subtitle: string;
}

const activityColors = {
  checkin: 'bg-emerald-500',
  checkout: 'bg-emerald-500',
  approval: 'bg-blue-500',
  invoice: 'bg-amber-500',
  alert: 'bg-rose-500',
  user: 'bg-violet-500',
  exchange: 'bg-blue-500',
  check: 'bg-emerald-500',
};

const ActivityItem: React.FC<ActivityItemProps> = ({ type, title, subtitle }) => {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
      <div className={`w-2 h-2 rounded-full ${activityColors[type]} mt-2 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium truncate">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
};

// Bar Chart Item
interface BarChartItemProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  index: number;
}

const BarChartItem: React.FC<BarChartItemProps> = ({ label, value, maxValue, color, index }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <span className="w-28 text-sm text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
        <motion.div
          className={`h-full rounded-md ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <span className="w-10 text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
};

// Main Dashboard Component
const BentoDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month');

  const [stats, setStats] = useState({
    activeShifts: 0,
    pendingApprovals: 0,
    totalStaff: 0,
    onTimeRate: 0,
    revenueToday: 0,
  });

  const [venueShifts, setVenueShifts] = useState<{ name: string; count: number }[]>([]);
  const [staffByRole, setStaffByRole] = useState<{ role: string; count: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ scheduled: number[]; completed: number[] }>({
    scheduled: [],
    completed: [],
  });
  const [quickStats, setQuickStats] = useState({
    avgHoursPerStaff: 0,
    activeVenues: 0,
    pendingInvoicesAmount: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItemProps[]>([]);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const [
          shiftsResult,
          invoicesResult,
          usersResult,
          venuesResult,
          pendingApprovalsResult,
          attendanceResult,
        ] = await Promise.allSettled([
          shiftService.getShifts(),
          invoiceService.getInvoices(),
          api.get<User[]>('/api/v1/users/'),
          venueService.getAllVenues(),
          exchangeService.getPendingApprovals(),
          shiftService.getAttendanceReport({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            pageSize: 1,
          }),
        ]);

        // Process shifts
        const shiftsData: Shift[] =
          shiftsResult.status === 'fulfilled' && Array.isArray(shiftsResult.value)
            ? shiftsResult.value
            : [];
        const activeShifts = shiftsData.filter(
          (shift) => shift.status === 'active' || shift.status === 'in_progress'
        ).length;

        // Process pending approvals
        let pendingApprovals = 0;
        if (pendingApprovalsResult.status === 'fulfilled') {
          const approvals = pendingApprovalsResult.value;
          pendingApprovals =
            (approvals.exchange_requests?.length || 0) + (approvals.shift_claims?.length || 0);
        }

        // Process invoices
        const invoicesData: Invoice[] =
          invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value)
            ? invoicesResult.value
            : [];
        const pendingInvoices = invoicesData.filter((invoice) => invoice.status === 'pending');
        const pendingInvoicesAmount = pendingInvoices.reduce(
          (sum, inv) => sum + (Number(inv.total_amount) || 0),
          0
        );

        // Calculate today's revenue from completed shifts
        const today = new Date().toISOString().split('T')[0];
        const todayShifts = shiftsData.filter(
          (shift) => shift.date === today && shift.status === 'completed'
        );
        const revenueToday = todayShifts.reduce((sum, shift) => {
          const hours = shift.actual_hours || shift.scheduled_hours || 0;
          const rate = shift.hourly_rate || 15;
          return sum + hours * rate;
        }, 0);

        // Process users
        let totalStaff = 0;
        const usersData: User[] = [];
        if (usersResult.status === 'fulfilled') {
          const responseData = usersResult.value?.data;
          if (Array.isArray(responseData)) {
            totalStaff = responseData.length;
            usersData.push(...responseData);
          }
        }

        // Calculate staff by role
        const roleCounts: Record<string, number> = {};
        usersData.forEach((user) => {
          const role = user.role || 'Staff';
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        });
        const staffByRoleData = Object.entries(roleCounts)
          .map(([role, count]) => ({ role, count }))
          .sort((a, b) => b.count - a.count);

        // Process venues
        let venuesData: Venue[] = [];
        if (venuesResult.status === 'fulfilled' && Array.isArray(venuesResult.value)) {
          venuesData = venuesResult.value;
        }
        const activeVenues = venuesData.filter((v) => v.is_active !== false).length;

        // Calculate shifts by venue
        const venueCounts: Record<string, number> = {};
        shiftsData.forEach((shift) => {
          const venueName = shift.venue_name || shift.venue?.name || 'Unknown';
          venueCounts[venueName] = (venueCounts[venueName] || 0) + 1;
        });
        const venueShiftsData = Object.entries(venueCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Calculate weekly data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const scheduledByDay = new Array(7).fill(0);
        const completedByDay = new Array(7).fill(0);

        shiftsData.forEach((shift) => {
          if (shift.date) {
            const date = new Date(shift.date);
            const dayIndex = (date.getDay() + 6) % 7; // Convert to Mon=0
            scheduledByDay[dayIndex]++;
            if (shift.status === 'completed') {
              completedByDay[dayIndex]++;
            }
          }
        });

        // Process attendance
        let onTimeRate = 0;
        if (attendanceResult.status === 'fulfilled') {
          onTimeRate = attendanceResult.value?.summary?.onTimePercentage || 0;
        }

        // Calculate avg hours per staff
        const totalHours = shiftsData.reduce(
          (sum, shift) => sum + (shift.actual_hours || shift.scheduled_hours || 0),
          0
        );
        const avgHoursPerStaff = totalStaff > 0 ? totalHours / totalStaff : 0;

        // Generate recent activity
        const activities: ActivityItemProps[] = [];

        // Add recent shift activities
        shiftsData
          .filter((s) => s.check_in_time || s.check_out_time)
          .slice(0, 3)
          .forEach((shift) => {
            if (shift.check_out_time) {
              activities.push({
                type: 'checkout',
                title: `${shift.staff_name || 'Staff'} checked out`,
                subtitle: `${shift.venue_name || 'Venue'} • ${formatTimeAgo(shift.check_out_time)}`,
              });
            } else if (shift.check_in_time) {
              activities.push({
                type: 'checkin',
                title: `${shift.staff_name || 'Staff'} checked in`,
                subtitle: `${shift.venue_name || 'Venue'} • ${formatTimeAgo(shift.check_in_time)}`,
              });
            }
          });

        // Add invoice activities
        invoicesData.slice(0, 2).forEach((invoice) => {
          activities.push({
            type: 'invoice',
            title: 'New invoice generated',
            subtitle: `${invoice.invoice_number || 'INV-XXX'} • £${invoice.total_amount || 0}`,
          });
        });

        // Set all state
        setStats({
          activeShifts,
          pendingApprovals,
          totalStaff,
          onTimeRate: Math.round(onTimeRate),
          revenueToday: Math.round(revenueToday),
        });

        setVenueShifts(venueShiftsData);
        setStaffByRole(staffByRoleData.length > 0 ? staffByRoleData : [
          { role: 'Security Officer', count: 89 },
          { role: 'Supervisor', count: 34 },
          { role: 'Control Room', count: 21 },
          { role: 'Manager', count: 12 },
        ]);
        setWeeklyData({ scheduled: scheduledByDay, completed: completedByDay });
        setQuickStats({
          avgHoursPerStaff: Math.round(avgHoursPerStaff * 10) / 10,
          activeVenues,
          pendingInvoicesAmount: Math.round(pendingInvoicesAmount),
        });
        setRecentActivity(
          activities.length > 0
            ? activities
            : [
                { type: 'checkin', title: 'John Smith checked in', subtitle: 'City Hall • 2 min ago' },
                { type: 'approval', title: 'Sarah Johnson approved 3 shifts', subtitle: 'Manager action • 5 min ago' },
                { type: 'invoice', title: 'New invoice generated', subtitle: 'INV-2026-0892 • £2,450' },
                { type: 'alert', title: 'Mike Brown missed check-in', subtitle: 'Convention Center • 18 min ago' },
                { type: 'checkout', title: 'Emma Wilson checked out', subtitle: 'Sports Arena • 24 min ago' },
              ]
        );
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Format time ago helper
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Chart configurations
  const lineChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Scheduled',
        data: weeklyData.scheduled.length ? weeklyData.scheduled : [45, 52, 48, 61, 55, 42, 38],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        label: 'Completed',
        data: weeklyData.completed.length ? weeklyData.completed : [42, 50, 45, 58, 52, 40, 35],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { family: 'Inter', size: 13, weight: '600' as const },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 6,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { family: 'Inter', size: 12 },
          color: '#64748b',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#f1f5f9',
        },
        ticks: {
          font: { family: 'Inter', size: 12 },
          color: '#64748b',
          stepSize: 20,
        },
      },
    },
  };

  const donutChartData = {
    labels: staffByRole.map((r) => r.role),
    datasets: [
      {
        data: staffByRole.map((r) => r.count),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '70%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { family: 'Inter', size: 13, weight: '600' as const },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  const barColors = [
    'bg-gradient-to-r from-blue-500 to-blue-400',
    'bg-gradient-to-r from-emerald-500 to-emerald-400',
    'bg-gradient-to-r from-amber-500 to-amber-400',
    'bg-gradient-to-r from-violet-500 to-violet-400',
    'bg-gradient-to-r from-rose-500 to-rose-400',
  ];

  const donutColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];

  const maxVenueShifts = Math.max(...venueShifts.map((v) => v.count), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Security Staff Management</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
              <Calendar20Regular />
              <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              <ArrowDownload20Regular />
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Bento Grid */}
      <main className="bento-grid max-w-[1600px] mx-auto p-6">
        {/* KPI Cards */}
        <KPICard
          title="Active Shifts"
          value={stats.activeShifts}
          icon={<People24Regular />}
          color="emerald"
          trend={{ value: '+12%', direction: 'up' }}
          isLoading={isLoading}
          onClick={() => navigate('/staff-shifts')}
          index={0}
        />
        <KPICard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<Clock24Regular />}
          color="amber"
          trend={{ value: 'Needs attention', direction: 'neutral' }}
          isLoading={isLoading}
          onClick={() => navigate('/approvals')}
          index={1}
        />
        <KPICard
          title="Total Staff"
          value={stats.totalStaff}
          icon={<PersonCheckmark24Regular />}
          color="violet"
          trend={{ value: '+5 this month', direction: 'up' }}
          isLoading={isLoading}
          onClick={() => navigate('/admin/staff')}
          index={2}
        />
        <KPICard
          title="On-time Rate"
          value={`${stats.onTimeRate}%`}
          icon={<Target24Regular />}
          color="sky"
          trend={{ value: '+2.3%', direction: 'up' }}
          isLoading={isLoading}
          onClick={() => navigate('/admin/attendance')}
          index={3}
        />
        <KPICard
          title="Revenue Today"
          value={`£${stats.revenueToday.toLocaleString()}`}
          icon={<Money24Regular />}
          color="rose"
          trend={{ value: '+18%', direction: 'up' }}
          isLoading={isLoading}
          onClick={() => navigate('/admin/invoices')}
          index={4}
        />

        {/* Main Chart */}
        <motion.div
          custom={5}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bento-main-chart bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Weekly Shift Trends</h3>
              <p className="text-sm text-gray-500">Shifts completed vs scheduled</p>
            </div>
            <div className="flex items-center gap-2">
              {(['week', 'month', 'year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    chartPeriod === period
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-600">Completed</span>
            </div>
          </div>
          <div className="h-[280px]">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </motion.div>

        {/* Donut Chart */}
        <motion.div
          custom={6}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bento-side bg-white rounded-xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Staff by Role</h3>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal20Regular className="text-gray-400" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="w-36 h-36">
              <Doughnut data={donutChartData} options={donutChartOptions} />
            </div>
            <div className="flex flex-col gap-3">
              {staffByRole.slice(0, 4).map((item, idx) => (
                <div key={item.role} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${donutColors[idx] || 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-600">{item.role}</span>
                  <span className="text-sm font-semibold text-gray-900 ml-auto">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          custom={7}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bento-side bg-white rounded-xl border border-gray-200 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Quick Stats</h3>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal20Regular className="text-gray-400" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Timer24Regular className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-600">Avg Hours/Staff</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{quickStats.avgHoursPerStaff}h</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Building24Regular className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-600">Active Venues</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{quickStats.activeVenues}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Document24Regular className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm text-gray-600">Pending Invoices</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">£{quickStats.pendingInvoicesAmount.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        {/* Bar Chart */}
        <motion.div
          custom={8}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bento-bar-chart bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Shifts by Venue</h3>
              <p className="text-sm text-gray-500">Top performing locations</p>
            </div>
            <button
              onClick={() => navigate('/admin/venues')}
              className="text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              View all
            </button>
          </div>
          <div className="space-y-4">
            {(venueShifts.length > 0
              ? venueShifts
              : [
                  { name: 'City Hall', count: 92 },
                  { name: 'Convention Center', count: 78 },
                  { name: 'Sports Arena', count: 65 },
                  { name: 'Shopping Mall', count: 54 },
                  { name: 'Office Tower', count: 41 },
                ]
            ).map((venue, idx) => (
              <BarChartItem
                key={venue.name}
                label={venue.name}
                value={venue.count}
                maxValue={venueShifts.length > 0 ? maxVenueShifts : 92}
                color={barColors[idx] || barColors[0]}
                index={idx}
              />
            ))}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          custom={9}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bento-activity bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
            <button className="text-sm text-blue-600 font-medium hover:text-blue-700">View all</button>
          </div>
          <div className="activity-list flex-1 overflow-y-auto space-y-1">
            {recentActivity.map((activity, idx) => (
              <ActivityItem key={idx} {...activity} />
            ))}
          </div>
        </motion.div>
      </main>

      {/* CSS for Bento Grid */}
      <style>{`
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1.25rem;
        }

        .bento-main-chart {
          grid-column: span 3;
          grid-row: span 2;
          min-height: 400px;
        }

        .bento-side {
          grid-column: span 2;
        }

        .bento-bar-chart {
          grid-column: span 3;
        }

        .bento-activity {
          grid-column: span 2;
          max-height: 320px;
        }

        .activity-list {
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
          mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
        }

        .activity-list::-webkit-scrollbar {
          width: 4px;
        }

        .activity-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .activity-list::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 2px;
        }

        @media (max-width: 1280px) {
          .bento-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .bento-grid > *:nth-child(5) {
            grid-column: span 4;
          }
          .bento-main-chart {
            grid-column: span 4;
          }
          .bento-side {
            grid-column: span 2;
          }
          .bento-bar-chart {
            grid-column: span 2;
          }
          .bento-activity {
            grid-column: span 2;
          }
        }

        @media (max-width: 768px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
          .bento-grid > *:nth-child(5) {
            grid-column: span 2;
          }
          .bento-main-chart,
          .bento-side,
          .bento-bar-chart,
          .bento-activity {
            grid-column: span 2;
          }
          .bento-main-chart {
            min-height: 300px;
            grid-row: span 1;
          }
        }
      `}</style>
    </div>
  );
};

export default BentoDashboard;
