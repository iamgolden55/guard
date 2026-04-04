import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutoCheckoutStatus } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, profileService } from '../../services';
import { type Shift, type Invoice, ShiftStatus, StaffProfile } from '../../types';
import MandatoryProfileForm from '../../components/MandatoryProfileForm';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { Header, Container, SpaceBetween, StatusIndicator, Alert, EmptyState } from '../../components/cloudscape';

const StaffDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const { pendingCount, isSyncing, isOnline, syncNow, lastSyncResult } = useOfflineSync();
  const [isLoading, setIsLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [showMandatoryForm, setShowMandatoryForm] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [earningsPeriod, setEarningsPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [pendingEarnings, setPendingEarnings] = useState(0);

  const calculatePendingEarnings = useCallback((shift: Shift | null) => {
    if (!shift || !shift.checkInTime || !shift.hourlyRate) return 0;
    try {
      const now = new Date();
      const checkInTime = new Date(shift.checkInTime || shift.check_in_time || shift.startTime);
      const endTime = new Date(shift.endTime);
      const elapsedMs = now.getTime() - checkInTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const scheduledMs = endTime.getTime() - new Date(shift.startTime).getTime();
      const scheduledHours = scheduledMs / (1000 * 60 * 60);
      const breakHours = (shift.breakDuration || 0) / 60;
      const maxPayableHours = scheduledHours - breakHours;
      const payableHours = Math.max(0, Math.min(elapsedHours, maxPayableHours));
      return payableHours * (shift.hourlyRate || 0);
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const profileData = await profileService.getProfile();
        setProfile(profileData);
        const incomplete = authState.user?.role === 'staff' &&
          (!profileData.securityRoles?.length || !profileData.siaLicenses?.length);
        setShowMandatoryForm(!!incomplete);
        setShowResubmit(false);

        const shifts = await shiftService.getShifts();
        const shiftsArray = Array.isArray(shifts) ? shifts : [];
        const active = shiftsArray.find(s => s.status === ShiftStatus.ACTIVE || s.status === 'in_progress');
        const recent = shiftsArray
          .filter(s => s.status !== ShiftStatus.ACTIVE && s.status !== 'in_progress')
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 3);
        setActiveShift(active || null);
        setRecentShifts(recent);

        if (active) setPendingEarnings(calculatePendingEarnings(active));
        else setPendingEarnings(0);

        const invoices = await invoiceService.getInvoices();
        setPendingInvoices(invoices.slice(0, 3));

        const [w, m] = await Promise.all([calculateEarnings('weekly'), calculateEarnings('monthly')]);
        setWeeklyEarnings(w);
        setMonthlyEarnings(m);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, [authState.user]);

  useEffect(() => {
    if (!activeShift) return;
    const update = () => setPendingEarnings(calculatePendingEarnings(activeShift));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [activeShift, calculatePendingEarnings]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const calculateEarnings = async (period: 'weekly' | 'monthly') => {
    try {
      const now = new Date();
      let startDate: Date, endDate: Date;
      if (period === 'weekly') {
        startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); endDate.setHours(23, 59, 59, 999);
      }
      const shifts = await shiftService.getShifts();
      const shiftsArray = Array.isArray(shifts) ? shifts : [];
      return shiftsArray.filter(s => {
        const d = new Date(s.startTime || s.start_time);
        return d >= startDate && d <= endDate && (s.status === 'completed' || s.status === 'approved');
      }).reduce((t, s) => t + (s.calculatedPayment || (s.actualHoursWorked || 0) * (s.hourlyRate || 0)), 0);
    } catch { return 0; }
  };

  const needsApproval = authState.user?.role === 'staff' && profile &&
    profile.securityRoles?.length && profile.siaLicenses?.length && !profile.isApproved;

  const currentEarnings = earningsPeriod === 'weekly' ? weeklyEarnings : monthlyEarnings;
  const target = earningsPeriod === 'weekly' ? 500 : 2000;
  const progress = Math.min(currentEarnings / target, 1);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'approved': return 'success' as const;
      case 'pending': case 'in_progress': return 'in-progress' as const;
      case 'rejected': return 'error' as const;
      default: return 'pending' as const;
    }
  };

  if (showMandatoryForm || showResubmit) {
    return profile ? (
      <MandatoryProfileForm
        profile={profile}
        onComplete={() => { setShowMandatoryForm(false); setShowResubmit(false); }}
      />
    ) : null;
  }

  return (
    <SpaceBetween size="xl">
      {needsApproval && (
        <Alert type="warning" header="Profile under review">
          <p className="text-[13px]">Your profile is under review. You will be notified when approved.</p>
          <button
            onClick={() => setShowResubmit(true)}
            className="mt-3 px-4 py-2 text-[13px] font-medium text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors"
          >
            Resubmit profile
          </button>
        </Alert>
      )}

      {/* Pending offline submissions */}
      {pendingCount > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#92400E]">
                  {pendingCount} pending submission{pendingCount > 1 ? 's' : ''}
                </p>
                <p className="text-[12px] text-[#A16207] mt-0.5">
                  {!isOnline ? 'Currently offline. Will sync when connectivity returns.' : 'Waiting to sync.'}
                </p>
                {lastSyncResult && <p className="text-[12px] text-[#059669] mt-0.5">{lastSyncResult}</p>}
              </div>
            </div>
            <button
              onClick={syncNow}
              disabled={isSyncing || !isOnline}
              className="px-4 py-2 text-[13px] font-medium text-[#92400E] bg-white border border-[#FDE68A] rounded-[10px] hover:bg-[#FEF3C7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {isSyncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#D97706]/30 border-t-[#D97706] rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync now'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        variant="h1"
        description={new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={!activeShift ? (
          <button
            onClick={() => navigate('/shifts/new')}
            className="px-5 py-2.5 text-[13px] font-medium text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors"
          >
            Start new shift
          </button>
        ) : undefined}
      >
        Welcome, {authState.user?.firstName}
      </Header>

      {/* Top row: Earnings (large, hero) + Active shift side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Earnings — hero card, spans 5 cols */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-[#EAEAF0] rounded-2xl p-6 h-full">
            <div className="flex flex-col items-center">
              {/* Period toggle */}
              <div className="flex items-center bg-[#F7F7FA] rounded-xl p-1 mb-6 self-center">
                {(['weekly', 'monthly'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setEarningsPeriod(p)}
                    className={`px-5 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
                      earningsPeriod === p ? 'bg-white text-[#DC2626] shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A2E]'
                    }`}
                  >
                    {p === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>

              {/* Circle */}
              <div className="relative">
                <svg width="200" height="200" className="transform -rotate-90">
                  <circle cx="100" cy="100" r={radius} stroke="#FEF2F2" strokeWidth="8" fill="none" />
                  <circle cx="100" cy="100" r={radius} stroke="url(#earningsGrad)" strokeWidth="8" fill="none"
                    strokeDasharray={circumference} strokeDashoffset={isLoading ? circumference : strokeDashoffset}
                    strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  <defs>
                    <linearGradient id="earningsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#DC2626" /><stop offset="100%" stopColor="#EF4444" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-medium text-[#9CA3AF] tracking-wide uppercase mb-1">
                    {earningsPeriod === 'weekly' ? 'This week' : 'This month'}
                  </span>
                  <span className="text-[36px] font-bold text-[#1A1A2E] tracking-[-0.02em] transition-all duration-300">
                    £{isLoading ? '0' : currentEarnings.toFixed(2)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#ECFDF5] text-[#059669] mt-1">
                    Confirmed
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="mt-5 w-full max-w-[240px] space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#9CA3AF]">Confirmed</span>
                  <span className="font-semibold text-[#059669]">£{currentEarnings.toFixed(2)}</span>
                </div>
                {pendingEarnings > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#9CA3AF]">Current shift</span>
                      <span className="font-semibold text-[#D97706]">£{pendingEarnings.toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-[#D1D5DB] text-center">Updates every 30s</p>
                  </>
                ) : (
                  <p className="text-[11px] text-[#D1D5DB] text-center">No active shift</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active shift + Quick actions — spans 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Active shift card */}
          <Container header="Active shift">
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-[#F0F0F5] rounded w-3/5" />
                <div className="h-4 bg-[#F0F0F5] rounded w-2/5" />
                <div className="h-9 bg-[#F0F0F5] rounded w-1/4 mt-4" />
              </div>
            ) : activeShift ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-[15px] font-semibold text-[#1A1A2E]">{activeShift.venue.name}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ECFDF5] text-[#059669]">
                      Active
                    </span>
                  </div>
                  <p className="text-[13px] text-[#9CA3AF] ml-[42px]">
                    Started {formatDate(activeShift.startTime)} at {formatTime(activeShift.startTime)}
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <button onClick={() => navigate(`/shifts/${activeShift.id}/end`)}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors">
                    End shift
                  </button>
                  <button onClick={() => navigate(`/shifts/${activeShift.id}/checks`)}
                    className="px-4 py-2 text-[13px] font-medium text-[#1A1A2E] bg-white border border-[#EAEAF0] rounded-[10px] hover:bg-[#F7F7FA] transition-colors">
                    Add checks
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No active shifts"
                description="You have no active shifts right now."
                action={
                  <button onClick={() => navigate('/shifts/new')}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors">
                    Start new shift
                  </button>
                }
              />
            )}
          </Container>

          {/* Auto-checkout status */}
          <AutoCheckoutStatus
            currentShift={activeShift || undefined}
            onCheckOutClick={() => activeShift && navigate(`/shifts/${activeShift.id}/end`)}
          />
        </div>
      </div>

      {/* Recent shifts — full width */}
      <Container header={
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#1A1A2E]">Recent shifts</h2>
          <button onClick={() => navigate('/shifts')}
            className="text-[13px] font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors">
            View all
          </button>
        </div>
      }>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F5] p-5">
                <div className="h-5 bg-[#F0F0F5] rounded w-4/5 mb-3" />
                <div className="h-4 bg-[#F0F0F5] rounded w-3/5 mb-2" />
                <div className="h-4 bg-[#F0F0F5] rounded w-2/5" />
              </div>
            ))}
          </div>
        ) : recentShifts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentShifts.map((shift) => (
              <button
                key={shift.id}
                onClick={() => navigate(`/shifts/${shift.id}`)}
                className="text-left rounded-xl border border-[#EAEAF0] p-5 hover:border-[#D1D5DB] transition-all group"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center group-hover:bg-[#FECACA] transition-colors">
                    <svg className="w-4 h-4 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-[#1A1A2E] text-[13px]">{shift.venue.name}</span>
                </div>
                <div className="space-y-1.5 text-[13px]">
                  <p className="text-[#6B7280]">{formatDate(shift.startTime)}</p>
                  <p className="text-[#6B7280]">
                    {formatTime(shift.startTime)} – {shift.endTime ? formatTime(shift.endTime) : 'In progress'}
                  </p>
                  <StatusIndicator type={statusColor(shift.status)}>
                    {shift.status.replace('_', ' ')}
                  </StatusIndicator>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent shifts" description="No completed shifts found." />
        )}
      </Container>

      {/* Invoices */}
      <Container header={
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#1A1A2E]">Invoices</h2>
          <button onClick={() => navigate('/invoices')}
            className="text-[13px] font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors">
            View all
          </button>
        </div>
      }>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center justify-between p-3 rounded-lg">
                <div><div className="h-5 bg-[#F0F0F5] rounded w-32 mb-2" /><div className="h-4 bg-[#F0F0F5] rounded w-48" /></div>
                <div className="h-6 bg-[#F0F0F5] rounded w-20" />
              </div>
            ))}
          </div>
        ) : pendingInvoices.length > 0 ? (
          <div className="divide-y divide-[#F0F0F5]">
            {pendingInvoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => navigate(`/invoices/${invoice.id}`)}
                className="w-full text-left flex items-center justify-between py-3.5 px-3 hover:bg-[#F7F7FA] rounded-xl transition-colors group"
              >
                <div>
                  <span className="font-semibold text-[#1A1A2E] text-[13px]">Invoice #{invoice.id}</span>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                    {formatDate(invoice.startDate || invoice.start_date)} – {formatDate(invoice.endDate || invoice.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[18px] font-bold text-[#1A1A2E]">
                      £{Number(invoice.totalAmount || invoice.total_amount || 0).toFixed(2)}
                    </span>
                    <div className="mt-0.5">
                      <StatusIndicator type={invoice.status === 'paid' ? 'success' : 'pending'}>
                        {invoice.status}
                      </StatusIndicator>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#DC2626] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No invoices" description="No recent invoices found." />
        )}
      </Container>
    </SpaceBetween>
  );
};

export default StaffDashboard;
