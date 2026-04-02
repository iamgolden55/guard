import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutoCheckoutStatus } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, profileService } from '../../services';
import { type Shift, type Invoice, ShiftStatus, StaffProfile } from '../../types';
import MandatoryProfileForm from '../../components/MandatoryProfileForm';
import { Header, Container, SpaceBetween, StatusIndicator, Alert, EmptyState } from '../../components/cloudscape';

const StaffDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
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
    <SpaceBetween size="l">
      {needsApproval && (
        <Alert type="warning" header="Profile under review">
          <p>Your profile is under review. You will be notified when approved.</p>
          <button
            onClick={() => setShowResubmit(true)}
            className="mt-2 px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Resubmit profile
          </button>
        </Alert>
      )}

      {/* Header */}
      <Header
        variant="h1"
        description={new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={!activeShift ? (
          <button
            onClick={() => navigate('/shifts/new')}
            className="px-5 h-10 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Start new shift
          </button>
        ) : undefined}
      >
        Welcome, {authState.user?.firstName}
      </Header>

      {/* Earnings */}
      <Container>
        <div className="flex flex-col items-center py-4">
          {/* Period toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 mb-6">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setEarningsPeriod(p)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  earningsPeriod === p ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {p === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* Circle */}
          <div className="relative">
            <svg width="200" height="200" className="transform -rotate-90">
              <circle cx="100" cy="100" r={radius} stroke="rgba(220,38,38,0.1)" strokeWidth="8" fill="none" />
              <circle cx="100" cy="100" r={radius} stroke="url(#earningsGrad)" strokeWidth="8" fill="none"
                strokeDasharray={circumference} strokeDashoffset={isLoading ? circumference : strokeDashoffset}
                strokeLinecap="round" className="transition-all duration-1000 ease-out"
                style={{ filter: 'drop-shadow(0 0 6px rgba(220,38,38,0.3))' }} />
              <defs>
                <linearGradient id="earningsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#dc2626" /><stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-medium text-gray-500 tracking-wide mb-1">
                {earningsPeriod === 'weekly' ? "This week's" : "This month's"} earnings
              </span>
              <span className="text-4xl font-extrabold text-gray-900 transition-all duration-300">
                £{isLoading ? '0.00' : currentEarnings.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-green-600 tracking-wider uppercase mt-1">
                Confirmed
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-4 text-center space-y-1.5">
            <div className="flex items-center justify-between gap-12 text-sm">
              <span className="text-gray-500">Confirmed</span>
              <span className="font-semibold text-green-600">£{currentEarnings.toFixed(2)}</span>
            </div>
            {pendingEarnings > 0 ? (
              <>
                <div className="flex items-center justify-between gap-12 text-sm">
                  <span className="text-gray-500">Current shift</span>
                  <span className="font-semibold text-amber-500">£{pendingEarnings.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 italic">Updates every 30 seconds</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">No current shift running</p>
            )}
          </div>
        </div>
      </Container>

      {/* Auto-checkout status */}
      <AutoCheckoutStatus
        currentShift={activeShift || undefined}
        onCheckOutClick={() => activeShift && navigate(`/shifts/${activeShift.id}/end`)}
      />

      {/* Active shift */}
      <Container header={
        <h2 className="text-lg font-semibold text-gray-900">Active shift</h2>
      }>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/5" />
            <div className="h-4 bg-gray-200 rounded w-2/5" />
            <div className="h-9 bg-gray-200 rounded w-1/4 mt-4" />
          </div>
        ) : activeShift ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-base font-semibold text-gray-900">{activeShift.venue.name}</span>
                <StatusIndicator type="success">Active</StatusIndicator>
              </div>
              <p className="text-sm text-gray-500">
                Started: {formatDate(activeShift.startTime)} at {formatTime(activeShift.startTime)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate(`/shifts/${activeShift.id}/end`)}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                End shift
              </button>
              <button onClick={() => navigate(`/shifts/${activeShift.id}/checks`)}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                Start new shift
              </button>
            }
          />
        )}
      </Container>

      {/* Recent shifts */}
      <Container header={
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent shifts</h2>
          <button onClick={() => navigate('/shifts')}
            className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
            View all
          </button>
        </div>
      }>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-100 p-4">
                <div className="h-5 bg-gray-200 rounded w-4/5 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-3/5 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/5" />
              </div>
            ))}
          </div>
        ) : recentShifts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentShifts.map((shift) => (
              <button
                key={shift.id}
                onClick={() => navigate(`/shifts/${shift.id}`)}
                className="text-left rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">{shift.venue.name}</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="text-gray-600">{formatDate(shift.startTime)}</p>
                  <p className="text-gray-600">
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
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
          <button onClick={() => navigate('/invoices')}
            className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
            View all
          </button>
        </div>
      }>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center justify-between p-3 rounded-lg">
                <div><div className="h-5 bg-gray-200 rounded w-32 mb-2" /><div className="h-4 bg-gray-200 rounded w-48" /></div>
                <div className="h-6 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        ) : pendingInvoices.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {pendingInvoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => navigate(`/invoices/${invoice.id}`)}
                className="w-full text-left flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div>
                  <span className="font-medium text-gray-900 text-sm">Invoice #{invoice.id}</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(invoice.startDate || invoice.start_date)} – {formatDate(invoice.endDate || invoice.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      £{Number(invoice.totalAmount || invoice.total_amount || 0).toFixed(2)}
                    </span>
                    <div className="mt-0.5">
                      <StatusIndicator type={invoice.status === 'paid' ? 'success' : 'pending'}>
                        {invoice.status}
                      </StatusIndicator>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
