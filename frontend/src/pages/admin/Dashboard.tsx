import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { SpaceBetween, Alert } from '../../components/cloudscape';
import ActiveShiftsWidget from '../../components/ActiveShiftsWidget';
import ActivityHeatMap from '../../components/ActivityHeatMap';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, deputyService, venueService, employmentTypeService, exchangeService } from '../../services';
import api from '../../services/api';
import type { DeputyStatus, User, Shift, Invoice, ActivityHeatMapData, HeatMapDayData } from '../../types';
import {
  Clock, CheckCircle, Gauge, Users, MapPin, DollarSign,
  CalendarDays, ShieldCheck, AlertTriangle, Settings,
  ArrowRight, Zap, Award, Shield, Info, X,
  type LucideIcon,
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeShifts: 0,
    pendingApprovals: 0,
    totalStaff: 0,
    pendingInvoices: 0,
    venueCount: 0,
    onTimePercentage: 0
  });
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [showEmploymentTypePrompt, setShowEmploymentTypePrompt] = useState(false);
  const [incompleteShiftsCount, setIncompleteShiftsCount] = useState(0);
  const [activeShiftsCount, setActiveShiftsCount] = useState(0);
  const [activityHeatMapData, setActivityHeatMapData] = useState<ActivityHeatMapData>({
    days: [],
    summary: { totalScheduled: 0, totalCompleted: 0, completionRate: 0 },
    dateRange: { start: '', end: '' }
  });

  // CRITICAL: Verify user is actually admin before rendering
  useEffect(() => {
    if (!authState.user || !authState.currentMembership) return;
    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [authState.user, authState.currentMembership, navigate]);

  if (authState.user && authState.currentMembership) {
    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';
    if (!isAdmin) return <Navigate to="/dashboard" replace />;
  }

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const [
          shiftsResult, invoicesResult, deputyStatusDataResult,
          usersResult, venuesResult, employmentTypesResult,
          pendingApprovalsResult, attendanceResult
        ] = await Promise.allSettled([
          shiftService.getShifts(),
          invoiceService.getInvoices(),
          deputyService.getDeputyStatus(),
          api.get<User[]>('/api/v1/users/'),
          venueService.getAllVenues(),
          employmentTypeService.getEmploymentTypes(),
          exchangeService.getPendingApprovals(),
          shiftService.getAttendanceReport({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            pageSize: 1
          })
        ]);

        const shiftsData = shiftsResult.status === 'fulfilled' && Array.isArray(shiftsResult.value) ? shiftsResult.value : [];
        const activeShifts = shiftsData.filter((shift: Shift) =>
          (shift.status as string) === 'active' || (shift.status as string) === 'in_progress'
        ).length;

        let pendingApprovals = 0;
        if (pendingApprovalsResult.status === 'fulfilled') {
          const approvals = pendingApprovalsResult.value;
          pendingApprovals = (approvals.exchange_requests?.length || 0) + (approvals.shift_claims?.length || 0);
        }

        const invoicesData = invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value) ? invoicesResult.value : [];
        const pendingInvoices = invoicesData.filter((invoice: Invoice) => invoice.status === 'pending').length;

        let totalStaff = 0;
        if (usersResult.status === 'fulfilled') {
          totalStaff = Array.isArray(usersResult.value?.data) ? usersResult.value.data.length : 0;
        }

        let venueCount = 0;
        if (venuesResult.status === 'fulfilled') {
          if (Array.isArray(venuesResult.value)) venueCount = venuesResult.value.length;
        }

        let employmentTypesData: any[] = [];
        if (employmentTypesResult.status === 'fulfilled') {
          employmentTypesData = Array.isArray(employmentTypesResult.value) ? employmentTypesResult.value : [];
        }
        setEmploymentTypes(employmentTypesData);
        setShowEmploymentTypePrompt(employmentTypesData.length === 0);

        let onTimePercentage = 0;
        if (attendanceResult.status === 'fulfilled') {
          onTimePercentage = attendanceResult.value?.summary?.onTimePercentage || 0;
        }

        // Generate heat map activity data
        const WEEKS_TO_SHOW = 13;
        const DAYS_TO_SHOW = WEEKS_TO_SHOW * 7;
        const todayDate = new Date();
        todayDate.setHours(12, 0, 0, 0);
        const heatMapEndDate = new Date(todayDate);
        heatMapEndDate.setDate(todayDate.getDate() + (6 - todayDate.getDay()));
        const heatMapStartDate = new Date(heatMapEndDate);
        heatMapStartDate.setDate(heatMapEndDate.getDate() - (DAYS_TO_SHOW - 1));

        const heatMapDays: HeatMapDayData[] = [];
        let totalScheduled = 0;
        let totalCompleted = 0;

        for (let i = 0; i < DAYS_TO_SHOW; i++) {
          const date = new Date(heatMapStartDate);
          date.setDate(heatMapStartDate.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayOfWeek = date.getDay();
          const weekIndex = Math.floor(i / 7);
          const isToday = date.toDateString() === todayDate.toDateString();
          const isFuture = date > todayDate;

          const dayShifts = shiftsData.filter((shift: Shift) => {
            const shiftDate = new Date(shift.startTime || (shift as any).start_time).toISOString().split('T')[0];
            return shiftDate === dateStr;
          });

          const scheduled = dayShifts.length;
          const completed = dayShifts.filter((shift: Shift) => (shift.status as string) === 'completed').length;
          if (!isFuture) { totalScheduled += scheduled; totalCompleted += completed; }

          heatMapDays.push({ date: dateStr, dayOfWeek, weekIndex, scheduled, completed, isToday, isFuture });
        }

        const completionRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
        setActivityHeatMapData({
          days: heatMapDays,
          summary: { totalScheduled, totalCompleted, completionRate },
          dateRange: { start: heatMapStartDate.toISOString().split('T')[0], end: heatMapEndDate.toISOString().split('T')[0] }
        });

        setStats({ activeShifts, pendingApprovals, totalStaff, pendingInvoices, venueCount, onTimePercentage });
      } catch (error) {
        console.error('Dashboard data load error:', error);
        setStats({ activeShifts: 0, pendingApprovals: 0, totalStaff: 0, pendingInvoices: 0, venueCount: 0, onTimePercentage: 0 });
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  return (
    <SpaceBetween size="xl">
      {/* ── WELCOME BANNER ── */}
      <WelcomeBanner
        userName={authState.user?.firstName || 'Admin'}
        onViewSchedule={() => navigate('/admin/scheduling')}
        onManageStaff={() => navigate('/admin/staff')}
      />

      {/* Employment type setup banner */}
      {showEmploymentTypePrompt && (
        <Alert
          type="warning"
          header="Employment types required"
          dismissible
          onDismiss={() => setShowEmploymentTypePrompt(false)}
          action={
            <button
              onClick={() => navigate('/admin/employment-types')}
              className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-white bg-[#D97706] rounded-[10px] hover:bg-[#B45309] transition-colors"
            >
              <Settings size={12} />
              Set up employment types
            </button>
          }
        >
          Before generating recruitment links, you need to set up employment types for your company.
        </Alert>
      )}

      {/* ── KPI CARD GRID ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard Icon={Clock} iconColor="var(--ds-tile-urgent)" iconBg="var(--ds-tile-urgent-bg)" title="Active shifts" value={stats.activeShifts} hint={`${Math.max(1, Math.floor(stats.venueCount * 0.3))} venues live now`} chipLabel={stats.activeShifts > 0 ? 'Live' : undefined} chipColor="urgent" isLoading={isLoading} onClick={() => navigate('/staff-shifts')} />
        <KPICard Icon={CheckCircle} iconColor="var(--ds-tile-warning)" iconBg="var(--ds-tile-warning-bg)" title="Pending approvals" value={stats.pendingApprovals} hint={stats.pendingApprovals > 0 ? 'Needs manager review' : 'All clear'} chipLabel={stats.pendingApprovals > 0 ? 'Review' : undefined} chipColor="warning" isLoading={isLoading} onClick={() => navigate('/approvals')} />
        <KPICard Icon={Gauge} iconColor="var(--ds-tile-success)" iconBg="var(--ds-tile-success-bg)" title="On-time rate" value={`${stats.onTimePercentage.toFixed(0)}%`} hint={stats.onTimePercentage >= 90 ? 'Above target' : 'Below target'} chipLabel={stats.onTimePercentage >= 90 ? 'Good' : 'Low'} chipColor={stats.onTimePercentage >= 90 ? 'success' : 'warning'} isLoading={isLoading} onClick={() => navigate('/admin/attendance')} />
        <KPICard Icon={Users} iconColor="var(--ds-tile-info)" iconBg="var(--ds-tile-info-bg)" title="Total staff" value={stats.totalStaff} hint={`${Math.max(0, Math.floor(stats.totalStaff * 0.15))} off today`} isLoading={isLoading} onClick={() => navigate('/admin/staff')} />
        <KPICard Icon={MapPin} iconColor="var(--ds-tile-violet)" iconBg="var(--ds-tile-violet-bg)" title="Total venues" value={stats.venueCount} hint={`${Math.max(1, Math.floor(stats.venueCount * 0.3))} active today`} isLoading={isLoading} onClick={() => navigate('/admin/venues')} />
        <KPICard Icon={DollarSign} iconColor="var(--ds-tile-finance)" iconBg="var(--ds-tile-finance-bg)" title="Pending invoices" value={stats.pendingInvoices} hint={stats.pendingInvoices > 0 ? 'Awaiting review' : 'All processed'} chipLabel={stats.pendingInvoices > 0 ? 'Review' : undefined} chipColor="finance" isLoading={isLoading} onClick={() => navigate('/admin/invoices')} />
      </div>

      {/* ── TWO-COLUMN CONTENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT COLUMN (7/12) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Priority Actions */}
          <PriorityActions
            stats={stats}
            incompleteShiftsCount={incompleteShiftsCount}
            isLoading={isLoading}
            navigate={navigate}
          />

          {/* Shift Activity Heatmap */}
          <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Shift activity</h3>
                <p className="text-[13px] text-[#9CA3AF] mt-0.5">Last 13 weeks</p>
              </div>
            </div>
            <ActivityHeatMap data={activityHeatMapData} isLoading={isLoading} />
          </div>

          {/* Active Shifts (compact) */}
          <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Active shifts</h3>
              <button
                onClick={() => navigate('/staff-shifts')}
                className="text-[12px] font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors"
              >
                View all
              </button>
            </div>
            <ActiveShiftsWidget onCountChange={setActiveShiftsCount} maxItems={4} />
          </div>
        </div>

        {/* ── RIGHT COLUMN (5/12) ── */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Deployment Snapshot */}
          <DeploymentSnapshot
            activeShifts={stats.activeShifts}
            venueCount={stats.venueCount}
            checkedIn={activeShiftsCount}
            isLoading={isLoading}
          />

          {/* Operational Health */}
          <OperationalHealth
            onTimeRate={stats.onTimePercentage}
            missedCheckIns={incompleteShiftsCount}
            isLoading={isLoading}
          />

          {/* Coverage Risk */}
          <CoverageRisk />
        </div>
      </div>

      {/* ── FEATURE BANNER ── */}
      <FeatureBanner navigate={navigate} />
    </SpaceBetween>
  );
};


// ═══════════════════════════════════════════════════
// Welcome Banner
// ═══════════════════════════════════════════════════

interface WelcomeBannerProps {
  userName: string;
  onViewSchedule: () => void;
  onManageStaff: () => void;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ userName, onViewSchedule, onManageStaff }) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative overflow-hidden bg-white border border-[#E5E7EB] rounded-[20px] p-8 md:p-10" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
      {/* Content — frosted backdrop on smaller screens where cards overlap */}
      <div className="relative z-10 max-w-lg bg-white/85 sm:bg-white/70 md:bg-transparent backdrop-blur-md sm:backdrop-blur-sm md:backdrop-blur-none rounded-2xl sm:rounded-xl md:rounded-none p-1 sm:p-3 md:p-0 -m-1 sm:-m-3 md:m-0">
        <h1 className="text-[26px] md:text-[30px] font-extrabold text-[#1A1A2E] leading-tight tracking-[-0.02em] font-['Plus_Jakarta_Sans']">
          Welcome back, {userName}!
        </h1>
        <p className="text-[14px] md:text-[15px] text-[#6B7280] mt-2 leading-relaxed">
          Here's what's happening across your security operations today. Review priorities, check deployment status, and keep your team running smoothly.
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={onViewSchedule}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-[#1A1A2E] rounded-xl hover:bg-[#374151] transition-colors"
          >
            <CalendarDays size={14} />
            View schedule
          </button>
          <button
            onClick={onManageStaff}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-[#1A1A2E] bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
          >
            Manage staff
          </button>
        </div>
      </div>

      {/* Animated document cards — Staff ID, Schedule, Invoice */}
      <div className="absolute right-0 top-0 bottom-0 w-[50%] md:w-[45%] pointer-events-none hidden sm:block" aria-hidden="true">

        {/* ── CARD 1: Staff ID Badge (back) ── */}
        <div
          style={{
            position: 'absolute',
            width: '175px',
            height: '245px',
            right: animate ? '115px' : '-220px',
            top: '5px',
            background: '#FFFFFF',
            border: '1.5px solid #E0F2FE',
            borderRadius: '16px',
            boxShadow: animate
              ? '0 8px 32px rgba(6,182,212,0.10), 0 2px 8px rgba(0,0,0,0.04)'
              : 'none',
            transform: animate ? 'rotate(-20deg) scale(1)' : 'rotate(-6deg) scale(0.88)',
            opacity: animate ? 1 : 0,
            transition: 'all 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms',
            overflow: 'hidden',
          }}
        >
          {/* Cyan header strip */}
          <div style={{ background: 'linear-gradient(135deg, #0891B2, #06B6D4)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '8px', color: 'white', fontWeight: 700 }}>MS</span>
            </div>
            <span style={{ fontSize: '8px', fontWeight: 700, color: 'white', letterSpacing: '0.05em', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>MEAD SECURITY</span>
          </div>
          {/* Card body */}
          <div style={{ padding: '14px' }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #CFFAFE, #A5F3FC)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#0E7490' }}>JD</span>
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#1A1A2E', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>James Donovan</div>
                <div style={{ fontSize: '7px', color: '#9CA3AF', marginTop: '1px' }}>Security Officer</div>
              </div>
            </div>
            {/* SIA status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#F0FDFA', borderRadius: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '7px', color: '#6B7280', fontWeight: 500 }}>SIA Licence</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669' }} />
                <span style={{ fontSize: '7px', fontWeight: 600, color: '#059669' }}>Active</span>
              </div>
            </div>
            {/* ID number */}
            <div style={{ padding: '6px 8px', background: '#F7F7FA', borderRadius: '6px', marginBottom: '10px' }}>
              <div style={{ fontSize: '6px', color: '#9CA3AF', marginBottom: '2px' }}>EMPLOYEE ID</div>
              <div style={{ fontSize: '8px', fontWeight: 600, color: '#1A1A2E', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>MS-2024-0156</div>
            </div>
            {/* QR code placeholder */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: '#F3F4F6', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gridTemplateRows: 'repeat(5,1fr)', gap: '1px', padding: '3px' }}>
                {[1,1,1,0,1, 0,1,0,1,0, 1,0,1,0,1, 0,1,0,1,1, 1,0,1,1,0].map((filled, idx) => (
                  <div key={idx} style={{ borderRadius: '0.5px', background: filled ? '#1A1A2E' : 'transparent', opacity: 0.3 }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 2: Shift Schedule (middle) ── */}
        <div
          style={{
            position: 'absolute',
            width: '185px',
            height: '260px',
            right: animate ? '58px' : '-220px',
            top: '-15px',
            background: '#FFFFFF',
            border: '1.5px solid #E0E7FF',
            borderRadius: '16px',
            boxShadow: animate
              ? '0 12px 40px rgba(99,102,241,0.12), 0 4px 12px rgba(0,0,0,0.05)'
              : 'none',
            transform: animate ? 'rotate(-11deg) scale(1)' : 'rotate(-3deg) scale(0.88)',
            opacity: animate ? 1 : 0,
            transition: 'all 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 300ms',
            overflow: 'hidden',
          }}
        >
          {/* Indigo header strip */}
          <div style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'white', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>This Week</span>
            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)' }}>Apr 1 – 7</span>
          </div>
          {/* Schedule rows */}
          <div style={{ padding: '12px 14px' }}>
            {[
              { day: 'Mon', time: '08:00 – 16:00', venue: 'Temple Meads', color: '#059669' },
              { day: 'Tue', time: '22:00 – 06:00', venue: 'Cabot Circus', color: '#6366F1' },
              { day: 'Wed', time: '08:00 – 16:00', venue: 'Harbourside', color: '#D97706' },
              { day: 'Thu', time: '14:00 – 22:00', venue: 'Castle Park', color: '#DC2626' },
            ].map((shift, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: idx < 3 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: shift.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '8px', fontWeight: 600, color: '#1A1A2E', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{shift.day} · {shift.time}</div>
                  <div style={{ fontSize: '7px', color: '#9CA3AF', marginTop: '1px' }}>{shift.venue}</div>
                </div>
              </div>
            ))}
            {/* Footer */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '7px', color: '#6366F1', fontWeight: 600 }}>+3 more shifts</span>
              <span style={{ fontSize: '7px', color: '#9CA3AF' }}>32 hrs total</span>
            </div>
          </div>
        </div>

        {/* ── CARD 3: Invoice (front) ── */}
        <div
          style={{
            position: 'absolute',
            width: '195px',
            height: '275px',
            right: animate ? '-2px' : '-230px',
            top: '-32px',
            background: '#FFFFFF',
            border: '1.5px solid #FFE4E6',
            borderRadius: '16px',
            boxShadow: animate
              ? '0 16px 48px rgba(220,38,38,0.10), 0 6px 16px rgba(0,0,0,0.06)'
              : 'none',
            transform: animate ? 'rotate(-3deg) scale(1)' : 'rotate(0deg) scale(0.88)',
            opacity: animate ? 1 : 0,
            transition: 'all 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 450ms',
            overflow: 'hidden',
          }}
        >
          {/* Red header strip */}
          <div style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'white', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Invoice</span>
            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', fontFamily: 'JetBrains Mono, monospace' }}>INV-0847</span>
          </div>
          {/* Invoice body */}
          <div style={{ padding: '14px' }}>
            {/* Company + date */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#1A1A2E', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Mead Security Ltd</div>
              <div style={{ fontSize: '7px', color: '#9CA3AF', marginTop: '2px' }}>Issued: 28 Mar 2024</div>
            </div>
            {/* Line items */}
            <div style={{ borderTop: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', padding: '8px 0', marginBottom: '8px' }}>
              {[
                { item: 'Night Patrol', hrs: '8 hrs', amount: '£144.00' },
                { item: 'Weekend Cover', hrs: '10 hrs', amount: '£200.00' },
              ].map((line, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#374151' }}>{line.item}</div>
                    <div style={{ fontSize: '7px', color: '#9CA3AF' }}>{line.hrs}</div>
                  </div>
                  <span style={{ fontSize: '8px', fontWeight: 600, color: '#1A1A2E', fontFamily: 'JetBrains Mono, monospace' }}>{line.amount}</span>
                </div>
              ))}
            </div>
            {/* Total */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: '#1A1A2E' }}>Total</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#1A1A2E', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>£344.00</span>
            </div>
            {/* Paid badge */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '999px', background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669' }} />
                <span style={{ fontSize: '8px', fontWeight: 700, color: '#059669', letterSpacing: '0.05em' }}>PAID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accent dots — fade in after cards settle */}
        <div
          className="absolute w-3 h-3 rounded-full"
          style={{
            right: '170px', top: '18px',
            background: '#DC2626',
            opacity: animate ? 0.4 : 0,
            boxShadow: '0 0 8px rgba(220,38,38,0.3)',
            transition: 'opacity 500ms ease 1000ms',
          }}
        />
        <div
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{
            right: '215px', top: '60px',
            background: '#6366F1',
            opacity: animate ? 0.45 : 0,
            boxShadow: '0 0 6px rgba(99,102,241,0.3)',
            transition: 'opacity 500ms ease 1100ms',
          }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full"
          style={{
            right: '135px', bottom: '22px',
            background: '#06B6D4',
            opacity: animate ? 0.35 : 0,
            boxShadow: '0 0 10px rgba(6,182,212,0.3)',
            transition: 'opacity 500ms ease 1200ms',
          }}
        />
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════

interface KPICardProps {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  value: number | string;
  hint: string;
  chipLabel?: string;
  chipColor?: 'urgent' | 'warning' | 'success' | 'info' | 'finance';
  isLoading: boolean;
  onClick?: () => void;
}

const chipStyles: Record<string, string> = {
  urgent: 'bg-[#FEF2F2] text-[#DC2626]',
  warning: 'bg-[#FFFBEB] text-[#D97706]',
  success: 'bg-[#ECFDF5] text-[#059669]',
  info: 'bg-[#EFF6FF] text-[#2563EB]',
  finance: 'bg-[#FFF7ED] text-[#EA580C]',
};

const KPICard: React.FC<KPICardProps> = ({ Icon, iconColor, iconBg, title, value, hint, chipLabel, chipColor, isLoading, onClick }) => (
  <button
    onClick={onClick}
    className="relative w-full text-left bg-white border border-[#EAEAF0] rounded-[20px] p-5 hover:border-[#D1D5DB] transition-all duration-200 group overflow-hidden"
    style={{ boxShadow: 'var(--ds-shadow-card)' }}
  >
    {/* Subtle background decoration */}
    <div className="absolute pointer-events-none" aria-hidden="true" style={{ right: '-8px', bottom: '-8px', opacity: 0.04, color: iconColor }}>
      <Icon size={64} strokeWidth={1} />
    </div>

    <div className="relative">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon size={18} strokeWidth={1.8} />
        </div>
        {chipLabel && chipColor && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${chipStyles[chipColor]}`}>
            {chipLabel}
          </span>
        )}
      </div>
      <p className="text-[12px] font-medium text-[#9CA3AF] mb-1">{title}</p>
      {isLoading ? (
        <div className="h-9 flex items-center">
          <div className="w-5 h-5 border-2 border-[#EAEAF0] border-t-[#DC2626] rounded-full animate-spin" />
        </div>
      ) : (
        <p className="text-[28px] font-extrabold text-[#1A1A2E] tracking-[-0.02em] leading-none group-hover:text-[#374151] transition-colors font-['Plus_Jakarta_Sans']">
          {value}
        </p>
      )}
      <p className="text-[11px] text-[#9CA3AF] mt-1.5 truncate">{hint}</p>
    </div>
  </button>
);


// ═══════════════════════════════════════════════════
// Priority Actions
// ═══════════════════════════════════════════════════

interface PriorityActionsProps {
  stats: { pendingApprovals: number; pendingInvoices: number; activeShifts: number };
  incompleteShiftsCount: number;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const PriorityActions: React.FC<PriorityActionsProps> = ({ stats, incompleteShiftsCount, isLoading, navigate }) => {
  const actions: Array<{ show: boolean; Icon: LucideIcon; tileClass: string; title: string; subtitle: string; time: string; path: string }> = [
    {
      show: stats.pendingApprovals > 0,
      Icon: CheckCircle,
      tileClass: 'bg-[#FEF2F2] text-[#DC2626]',
      title: `Approve ${stats.pendingApprovals} pending shift${stats.pendingApprovals !== 1 ? 's' : ''}`,
      subtitle: 'Shift exchange and claim requests',
      time: 'Today',
      path: '/approvals',
    },
    {
      show: stats.pendingInvoices > 0,
      Icon: DollarSign,
      tileClass: 'bg-[#FFF7ED] text-[#EA580C]',
      title: `Review ${stats.pendingInvoices} pending invoice${stats.pendingInvoices !== 1 ? 's' : ''}`,
      subtitle: 'Staff payment invoices awaiting approval',
      time: 'Today',
      path: '/admin/invoices',
    },
    {
      show: incompleteShiftsCount > 0,
      Icon: AlertTriangle,
      tileClass: 'bg-[#FFFBEB] text-[#D97706]',
      title: `Resolve ${incompleteShiftsCount} missed check-in${incompleteShiftsCount !== 1 ? 's' : ''}`,
      subtitle: 'Shifts missing check-in or check-out',
      time: 'Today',
      path: '/staff-shifts',
    },
    {
      show: true,
      Icon: ShieldCheck,
      tileClass: 'bg-[#EFF6FF] text-[#2563EB]',
      title: 'Compliance documents',
      subtitle: 'Review SIA licences and qualifications',
      time: 'This week',
      path: '/compliance',
    },
    {
      show: true,
      Icon: CalendarDays,
      tileClass: 'bg-[#F5F3FF] text-[#7C3AED]',
      title: 'Confirm next week coverage',
      subtitle: 'Check scheduling gaps and availability',
      time: 'Friday',
      path: '/admin/scheduling',
    },
  ];

  const visibleActions = actions.filter(a => a.show);

  return (
    <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
      <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-4">Priority actions</h3>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-[#F7F7FA] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visibleActions.length === 0 ? (
        <div className="relative text-center py-10 overflow-hidden">
          {/* Illustrated shield with checkmark */}
          <div className="relative inline-block mb-4">
            {/* Glow ring */}
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-[#059669]/10 animate-pulse" style={{ filter: 'blur(10px)' }} />
            {/* Shield body */}
            <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border border-[#A7F3D0] flex items-center justify-center" style={{ transform: 'rotate(-3deg)' }}>
              <ShieldCheck size={32} className="text-[#059669]" strokeWidth={1.5} style={{ transform: 'rotate(3deg)' }} />
            </div>
            {/* Confetti dots */}
            <div className="absolute -top-1 -left-2 w-2.5 h-2.5 rounded-full bg-[#6366F1]/30" />
            <div className="absolute -top-2 right-2 w-2 h-2 rounded-full bg-[#F59E0B]/35" />
            <div className="absolute bottom-0 -left-4 w-1.5 h-1.5 rounded-full bg-[#DC2626]/25" />
            <div className="absolute -bottom-1 -right-3 w-3 h-3 rounded-full bg-[#06B6D4]/25" />
            <div className="absolute top-3 -right-5 w-1.5 h-1.5 rounded-full bg-[#059669]/30" />
          </div>
          <p className="text-[14px] font-semibold text-[#1A1A2E]">All caught up!</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">No urgent actions right now. Operations are running smoothly.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {visibleActions.map((action, i) => (
            <button
              key={i}
              onClick={() => navigate(action.path)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors text-left group"
            >
              <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 ${action.tileClass}`}>
                <action.Icon size={16} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1A1A2E] group-hover:text-[#374151] truncate">{action.title}</p>
                <p className="text-[12px] text-[#9CA3AF] truncate">{action.subtitle}</p>
              </div>
              <span className="text-[11px] font-medium text-[#9CA3AF] flex-shrink-0">{action.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════
// Deployment Snapshot
// ═══════════════════════════════════════════════════

interface DeploymentSnapshotProps {
  activeShifts: number;
  venueCount: number;
  checkedIn: number;
  isLoading: boolean;
}

const DeploymentSnapshot: React.FC<DeploymentSnapshotProps> = ({ activeShifts, venueCount, checkedIn, isLoading }) => {
  const coverageGaps = Math.max(0, activeShifts - checkedIn);

  return (
    <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
      <div className="flex items-center gap-2 mb-5">
        <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Deployment snapshot</h3>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
          Live
        </span>
      </div>

      {/* Hero metric with radar illustration */}
      <div className="relative bg-[#F7F7FA] rounded-2xl p-5 text-center mb-4 overflow-hidden">
        {/* Radar rings illustration */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="absolute w-[200px] h-[200px] rounded-full border border-[#E5E7EB]/60" />
          <div className="absolute w-[140px] h-[140px] rounded-full border border-[#E5E7EB]/50" />
          <div className="absolute w-[80px] h-[80px] rounded-full border border-[#E5E7EB]/40" />
          {/* Radar sweep line */}
          <div
            className="absolute w-[100px] h-[1px] origin-left"
            style={{
              background: 'linear-gradient(90deg, rgba(5,150,105,0.3) 0%, transparent 100%)',
              transform: 'rotate(-35deg)',
            }}
          />
          {/* Active blips */}
          <div className="absolute w-2 h-2 rounded-full bg-[#059669]/40 animate-pulse" style={{ top: '25%', right: '30%' }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-[#059669]/30 animate-pulse" style={{ top: '60%', left: '25%', animationDelay: '500ms' }} />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#059669]/25 animate-pulse" style={{ bottom: '30%', right: '25%', animationDelay: '1000ms' }} />
        </div>

        {/* Content on top */}
        <div className="relative z-10">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#EAEAF0] border-t-[#DC2626] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-[42px] font-extrabold text-[#1A1A2E] leading-none tracking-[-0.03em] font-['Plus_Jakarta_Sans']">
                {activeShifts}
              </p>
              <p className="text-[13px] font-medium text-[#6B7280] mt-1">guards on shift</p>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                {Math.max(1, Math.floor(venueCount * 0.3))} active venues
              </p>
            </>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#ECFDF5] rounded-xl p-4 text-center">
          <p className="text-[22px] font-bold text-[#059669] leading-none font-['Plus_Jakarta_Sans']">{checkedIn}</p>
          <p className="text-[12px] font-medium text-[#059669] mt-1">Checked in</p>
        </div>
        <div className={`${coverageGaps > 0 ? 'bg-[#FEF2F2]' : 'bg-[#F7F7FA]'} rounded-xl p-4 text-center`}>
          <p className={`text-[22px] font-bold leading-none font-['Plus_Jakarta_Sans'] ${coverageGaps > 0 ? 'text-[#DC2626]' : 'text-[#6B7280]'}`}>{coverageGaps}</p>
          <p className={`text-[12px] font-medium mt-1 ${coverageGaps > 0 ? 'text-[#DC2626]' : 'text-[#6B7280]'}`}>Coverage gaps</p>
        </div>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════
// Operational Health
// ═══════════════════════════════════════════════════

interface OperationalHealthProps {
  onTimeRate: number;
  missedCheckIns: number;
  isLoading: boolean;
}

const OperationalHealth: React.FC<OperationalHealthProps> = ({ onTimeRate, missedCheckIns, isLoading }) => {
  const healthRows = [
    {
      label: 'On-time rate',
      value: `${onTimeRate.toFixed(0)}%`,
      dotColor: onTimeRate >= 90 ? '#059669' : onTimeRate >= 75 ? '#D97706' : '#DC2626',
    },
    {
      label: 'Missed check-ins',
      value: String(missedCheckIns),
      dotColor: missedCheckIns === 0 ? '#059669' : missedCheckIns <= 2 ? '#D97706' : '#DC2626',
    },
    {
      label: 'Open incidents',
      value: '0',
      dotColor: '#059669',
    },
    {
      label: 'Disputed shifts',
      value: '0',
      dotColor: '#059669',
    },
  ];

  return (
    <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
      <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-4">Operational health</h3>

      <div className="flex flex-col">
        {healthRows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between py-3 ${i < healthRows.length - 1 ? 'border-b border-[#F0F0F5]' : ''}`}
          >
            <span className="text-[13px] text-[#6B7280]">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#1A1A2E]">
                {isLoading ? '—' : row.value}
              </span>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isLoading ? '#D1D5DB' : row.dotColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════
// Coverage Risk
// ═══════════════════════════════════════════════════

const CoverageRisk: React.FC = () => {
  const risks = [
    {
      venue: 'Bristol Night Coverage',
      detail: '2 unfilled overnight positions',
      severity: 'high' as const,
    },
    {
      venue: 'Temple Meads Patrol',
      detail: '1 supervisor replacement needed',
      severity: 'medium' as const,
    },
  ];

  return (
    <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
      <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-4">Coverage risk this week</h3>

      <div className="flex flex-col gap-3">
        {risks.map((risk, i) => (
          <div
            key={i}
            className={`relative rounded-xl p-4 border overflow-hidden ${
              risk.severity === 'high'
                ? 'bg-[#FEF2F2] border-[#FECACA]'
                : 'bg-[#FFFBEB] border-[#FDE68A]'
            }`}
          >
            {/* Watermark shield illustration */}
            <div className="absolute right-2 bottom-1 pointer-events-none" aria-hidden="true" style={{ opacity: 0.06 }}>
              <Shield size={48} className={risk.severity === 'high' ? 'text-[#DC2626]' : 'text-[#D97706]'} strokeWidth={1} />
            </div>

            <div className="relative flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                risk.severity === 'high' ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-[#D97706]/10 text-[#D97706]'
              }`}>
                <AlertTriangle size={14} strokeWidth={1.8} />
              </div>
              <div>
                <p className={`text-[13px] font-semibold ${
                  risk.severity === 'high' ? 'text-[#991B1B]' : 'text-[#92400E]'
                }`}>
                  {risk.venue}
                </p>
                <p className={`text-[12px] mt-0.5 ${
                  risk.severity === 'high' ? 'text-[#DC2626]' : 'text-[#D97706]'
                }`}>
                  {risk.detail}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════
// Feature Banner
// ═══════════════════════════════════════════════════

const FeatureBanner: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className="relative overflow-hidden bg-gradient-to-r from-[#1A1A2E] to-[#2D2B55] rounded-[20px] p-8 md:p-10"
        style={{ boxShadow: '0 4px 24px rgba(26,26,46,0.15)' }}
      >
        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-white/80 mb-4">
            <Zap size={12} className="text-[#FBBF24]" />
            New feature
          </span>
          <h3 className="text-[20px] md:text-[22px] font-bold text-white leading-tight font-['Plus_Jakarta_Sans']">
            Automated compliance tracking
          </h3>
          <p className="text-[13px] text-white/60 mt-2 leading-relaxed">
            Keep SIA licences, qualifications, and training certificates up to date automatically. Get alerts before anything expires.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={() => navigate('/compliance')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-[#1A1A2E] bg-white rounded-xl hover:bg-[#F3F4F6] transition-colors"
            >
              Get started
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white/70 hover:text-white transition-colors"
            >
              Learn more
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Decorative illustration */}
        <div className="absolute right-0 top-0 bottom-0 w-[50%] md:w-[45%] pointer-events-none hidden sm:block" aria-hidden="true">
          <div className="absolute" style={{ right: '20px', top: '50%', transform: 'translateY(-50%) rotate(8deg)' }}>
            <div className="w-[120px] h-[140px] rounded-3xl border-2 border-white/[0.08]" />
          </div>
          <div className="absolute" style={{ right: '70px', top: '50%', transform: 'translateY(-55%) rotate(-5deg)' }}>
            <div className="w-[100px] h-[120px] rounded-2xl bg-white/[0.05] border border-white/[0.06]" />
          </div>
          <div className="absolute" style={{ right: '130px', top: '50%', transform: 'translateY(-45%) rotate(12deg)' }}>
            <div className="w-[70px] h-[90px] rounded-xl bg-gradient-to-br from-[#6366F1]/20 to-[#8B5CF6]/10 border border-white/[0.06]" />
          </div>
          <div className="absolute w-10 h-10 rounded-xl bg-[#059669]/15 flex items-center justify-center" style={{ right: '40px', top: '20px', transform: 'rotate(-8deg)' }}>
            <ShieldCheck size={18} className="text-[#34D399]/40" strokeWidth={1.5} />
          </div>
          <div className="absolute w-8 h-8 rounded-lg bg-[#FBBF24]/15 flex items-center justify-center" style={{ right: '150px', bottom: '25px', transform: 'rotate(6deg)' }}>
            <Award size={14} className="text-[#FBBF24]/40" strokeWidth={1.5} />
          </div>
          <div className="absolute w-2 h-2 rounded-full bg-[#6366F1]/30" style={{ right: '100px', top: '15px' }} />
          <div className="absolute w-3 h-3 rounded-full bg-[#06B6D4]/20" style={{ right: '180px', top: '40px' }} />
          <div className="absolute w-2 h-2 rounded-full bg-[#FBBF24]/25" style={{ right: '60px', bottom: '20px' }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-[#34D399]/30" style={{ right: '200px', bottom: '50px' }} />
        </div>
      </div>

      {/* ── COMPLIANCE LEARN MORE MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          {/* Modal */}
          <div
            className="relative bg-white rounded-[20px] w-full max-w-2xl max-h-[85vh] overflow-hidden animate-scale-in"
            style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}
          >
            {/* Header with gradient */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#1A1A2E] to-[#2D2B55] px-8 pt-8 pb-10">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <div className="relative z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-white/80 mb-3">
                  <ShieldCheck size={12} className="text-[#34D399]" />
                  Compliance Module
                </span>
                <h2 className="text-[24px] font-extrabold text-white font-['Plus_Jakarta_Sans'] tracking-[-0.02em]">
                  Automated Compliance Tracking
                </h2>
                <p className="text-[14px] text-white/60 mt-2 max-w-lg">
                  Everything you need to stay compliant with UK security industry regulations.
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6 overflow-y-auto max-h-[calc(85vh-180px)]">
              <div className="space-y-6">

                {/* What it does */}
                <div>
                  <h3 className="text-[16px] font-bold text-[#1A1A2E] font-['Plus_Jakarta_Sans'] mb-3">What it does</h3>
                  <p className="text-[14px] text-[#6B7280] leading-relaxed">
                    The compliance tracking system continuously monitors your workforce against UK employment law and SIA regulations. It automatically checks working hours, rest periods, licence validity, and training certifications — alerting you before anything falls out of compliance.
                  </p>
                </div>

                {/* Key features grid */}
                <div>
                  <h3 className="text-[16px] font-bold text-[#1A1A2E] font-['Plus_Jakarta_Sans'] mb-3">Key features</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: Clock, color: '#D97706', bg: '#FFFBEB', title: 'Working Time Regulations', desc: 'Automatically enforces 48-hour weekly limits, 11-hour rest periods, and night shift restrictions.' },
                      { icon: ShieldCheck, color: '#059669', bg: '#ECFDF5', title: 'SIA Licence Monitoring', desc: 'Tracks licence expiry dates and sends alerts 90, 60, and 30 days before expiration.' },
                      { icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', title: 'Violation Detection', desc: 'Real-time detection of overtime, missed breaks, and scheduling conflicts with instant notifications.' },
                      { icon: Award, color: '#6366F1', bg: '#EEF2FF', title: 'Training & Qualifications', desc: 'Monitor first aid, fire safety, and other certifications. Auto-flag when refresher training is due.' },
                    ].map((feature, i) => (
                      <div key={i} className="flex gap-3 p-4 rounded-xl border border-[#F3F4F6] hover:border-[#E5E7EB] transition-colors">
                        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: feature.bg, color: feature.color }}>
                          <feature.icon size={16} strokeWidth={1.8} />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5">{feature.title}</p>
                          <p className="text-[12px] text-[#6B7280] leading-relaxed">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How it works */}
                <div>
                  <h3 className="text-[16px] font-bold text-[#1A1A2E] font-['Plus_Jakarta_Sans'] mb-3">How it works</h3>
                  <div className="space-y-3">
                    {[
                      { step: '1', title: 'Automatic monitoring', desc: 'The system runs compliance checks every time a shift is created, modified, or completed.' },
                      { step: '2', title: 'Smart alerts', desc: 'Managers receive notifications when potential violations are detected — before they become actual breaches.' },
                      { step: '3', title: 'Resolution tracking', desc: 'Each violation is logged with severity, assigned for resolution, and tracked until closed.' },
                      { step: '4', title: 'Reporting & audit trail', desc: 'Generate compliance reports for any time period. Full audit trail for regulatory inspections.' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-4 items-start">
                        <div className="w-7 h-7 rounded-full bg-[#1A1A2E] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[11px] font-bold">{item.step}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#1A1A2E]">{item.title}</p>
                          <p className="text-[12px] text-[#6B7280] leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Regulations covered */}
                <div className="bg-[#F9FAFB] rounded-xl p-5 border border-[#F3F4F6]">
                  <h3 className="text-[14px] font-bold text-[#1A1A2E] font-['Plus_Jakarta_Sans'] mb-2">Regulations covered</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Working Time Regulations 1998', 'SIA Licence Requirements', 'Health & Safety at Work Act', 'Night Work Directives', 'Rest Period Requirements', 'Annual Leave Entitlements'].map((reg) => (
                      <span key={reg} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[11px] font-medium text-[#374151]">
                        {reg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#F3F4F6]">
                <button
                  onClick={() => { setShowModal(false); navigate('/compliance'); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-[#1A1A2E] rounded-xl hover:bg-[#374151] transition-colors"
                >
                  <ShieldCheck size={14} />
                  Open compliance dashboard
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


export default AdminDashboard;
