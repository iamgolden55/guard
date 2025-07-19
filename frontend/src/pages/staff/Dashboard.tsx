import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Text,
  PrimaryButton,
  DefaultButton,
  Shimmer,
  ShimmerElementType,
  Icon
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { AutoCheckoutStatus } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, profileService } from '../../services';
import { type Shift, type Invoice, ShiftStatus, StaffProfile } from '../../types';
import MandatoryProfileForm from '../../components/MandatoryProfileForm';


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

  // Calculate pending earnings from active shift
  const calculatePendingEarnings = useCallback((shift: Shift | null) => {
    if (!shift || !shift.checkInTime || !shift.hourlyRate) return 0;

    try {
      const now = new Date();
      const checkInTime = new Date(shift.checkInTime || shift.check_in_time || shift.startTime);
      const endTime = new Date(shift.endTime);
      
      // Calculate elapsed time since check-in
      const elapsedMs = now.getTime() - checkInTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      
      // Calculate scheduled hours for capping
      const scheduledMs = endTime.getTime() - new Date(shift.startTime).getTime();
      const scheduledHours = scheduledMs / (1000 * 60 * 60);
      const breakHours = (shift.breakDuration || 0) / 60; // Convert minutes to hours
      const maxPayableHours = scheduledHours - breakHours;
      
      // Cap elapsed hours at scheduled hours (same logic as backend)
      const payableHours = Math.max(0, Math.min(elapsedHours, maxPayableHours)); // Ensure not negative and cap at max
      const pendingAmount = payableHours * (shift.hourlyRate || 0);
      
      return pendingAmount;
    } catch (error) {
      console.error('Error calculating pending earnings:', error);
      return 0;
    }
  }, []);

  // Load dashboard data and profile
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        // Fetch staff profile
        const profileData = await profileService.getProfile();
        setProfile(profileData);
        // Check if staff needs to complete profile
        const incomplete =
          authState.user?.role === 'staff' &&
          (!profileData.securityRoles?.length || !profileData.siaLicenses?.length);
        setShowMandatoryForm(!!incomplete);
        setShowResubmit(false);
        // Get shifts, filter the active one
        const shifts = await shiftService.getShifts();
        
        // Ensure shifts is an array before using array methods
        const shiftsArray = Array.isArray(shifts) ? shifts : [];
        const active = shiftsArray.find(shift => 
          shift.status === ShiftStatus.ACTIVE || 
          shift.status === 'in_progress'
        );
        const recent = shiftsArray
          .filter(shift => 
            shift.status !== ShiftStatus.ACTIVE && 
            shift.status !== 'in_progress'
          )
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 3);
        setActiveShift(active || null);
        setRecentShifts(recent);
        
        // Calculate pending earnings from active shift
        if (active) {
          const pending = calculatePendingEarnings(active);
          setPendingEarnings(pending);
        } else {
          setPendingEarnings(0);
        }
        
        // Get pending invoices
        const invoices = await invoiceService.getInvoices();
        setPendingInvoices(invoices.slice(0, 3));
        
        // Calculate both weekly and monthly earnings
        const [weeklyEarnings, monthlyEarnings] = await Promise.all([
          calculateEarnings('weekly'),
          calculateEarnings('monthly')
        ]);
        setWeeklyEarnings(weeklyEarnings);
        setMonthlyEarnings(monthlyEarnings);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, [authState.user]);

  // Update pending earnings in real-time for active shift
  useEffect(() => {
    if (!activeShift) return;

    const updatePendingEarnings = () => {
      const pending = calculatePendingEarnings(activeShift);
      setPendingEarnings(pending);
    };

    // Update immediately
    updatePendingEarnings();

    // Update every 30 seconds
    const interval = setInterval(updatePendingEarnings, 30000);

    return () => clearInterval(interval);
  }, [activeShift, calculatePendingEarnings]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate earnings for a specific period
  const calculateEarnings = async (period: 'weekly' | 'monthly') => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (period === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Sunday
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Saturday
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of month
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
        endDate.setHours(23, 59, 59, 999);
      }

      // Get all shifts for the period
      const shifts = await shiftService.getShifts();
      const shiftsArray = Array.isArray(shifts) ? shifts : [];
      
      const periodShifts = shiftsArray.filter(shift => {
        const startTime = shift.startTime || shift.start_time;
        const shiftDate = new Date(startTime);
        const inPeriod = shiftDate >= startDate && shiftDate <= endDate;
        const validStatus = shift.status === 'completed' || shift.status === 'approved';
        
        return inPeriod && validStatus;
      });

      // Calculate total earnings from completed/approved shifts
      const totalEarnings = periodShifts.reduce((total, shift) => {
        const payment = shift.calculatedPayment || 
                       (shift.actualHoursWorked || 0) * (shift.hourlyRate || 0);
        
        return total + payment;
      }, 0);
      
      return totalEarnings;
    } catch (error) {
      console.error(`Error calculating ${period} earnings:`, error);
      return 0;
    }
  };

  // Modern card component inspired by Revolut with enhanced animations
  const ModernCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ 
    children, 
    className = '',
    onClick 
  }) => (
    <div 
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]' : 'hover:shadow-md'
      } ${className}`}
      onClick={onClick}
      style={{ 
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transform: 'translateZ(0)', // Force hardware acceleration
      }}
    >
      {children}
    </div>
  );

  // Enhanced earnings circle component with animations
  const EarningsCircle: React.FC<{ 
    amount: number; 
    isLoading?: boolean; 
    period: 'weekly' | 'monthly';
    onPeriodChange: (period: 'weekly' | 'monthly') => void;
    pendingAmount?: number;
  }> = ({ amount, isLoading = false, period, onPeriodChange, pendingAmount = 0 }) => {
    const [animatedAmount, setAnimatedAmount] = useState(0);
    const [lastAnimatedAmount, setLastAnimatedAmount] = useState(0);
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    
    // Calculate progress based on a target (confirmed earnings only)
    const target = period === 'weekly' ? 500 : 2000; // Example targets
    const progress = Math.min(amount / target, 1);
    const strokeDashoffset = circumference * (1 - progress);
    
    // Animate the amount counting up (only when confirmed amount actually changes)
    useEffect(() => {
      if (isLoading) return;
      
      // Only animate if the confirmed amount has actually changed significantly
      if (Math.abs(amount - lastAnimatedAmount) < 0.01) {
        // Amount hasn't changed significantly, just set it directly without animation
        setAnimatedAmount(amount);
        return;
      }
      
      const duration = 1500; // 1.5 seconds
      const steps = 60;
      const increment = amount / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= amount) {
          setAnimatedAmount(amount);
          setLastAnimatedAmount(amount);
          clearInterval(timer);
        } else {
          setAnimatedAmount(current);
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }, [amount, isLoading, lastAnimatedAmount]);
    
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Period Toggle */}
        <div className="flex items-center bg-gray-100 rounded-2xl p-1">
          <button
            onClick={() => onPeriodChange('weekly')}
            className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
              period === 'weekly' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => onPeriodChange('monthly')}
            className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
              period === 'monthly' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Earnings Circle */}
        <div className="flex flex-col items-center justify-center relative">
          <svg width="200" height="200" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="rgba(220, 38, 38, 0.1)"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={isLoading ? circumference : strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{
                filter: 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.3))'
              }}
            />
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Text 
              style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#6b7280',
                letterSpacing: '0.025em'
              }} 
              className="mb-2"
            >
              {period === 'weekly' ? 'This Week\'s' : 'This Month\'s'} Earnings
            </Text>
            <Text 
              style={{ 
                fontSize: '36px', 
                fontWeight: '800', 
                color: '#111827',
                lineHeight: '1',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
              className="transition-all duration-300"
            >
              £{isLoading ? '0.00' : animatedAmount.toFixed(2)}
            </Text>
            <Text 
              style={{ 
                fontSize: '12px', 
                fontWeight: '500', 
                color: '#059669',
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const
              }} 
              className="mt-2 transition-colors duration-300"
            >
              CONFIRMED
            </Text>
          </div>
        </div>

        {/* Earnings Breakdown */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-between max-w-xs mx-auto">
            <Text style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
              Confirmed
            </Text>
            <Text style={{ fontSize: '14px', color: '#059669', fontWeight: '600' }}>
              £{amount.toFixed(2)}
            </Text>
          </div>
          
          {pendingAmount > 0 && (
            <>
              <div className="flex items-center justify-between max-w-xs mx-auto">
                <Text style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Current shift
                </Text>
                <Text style={{ fontSize: '14px', color: '#f59e0b', fontWeight: '600' }}>
                  £{pendingAmount.toFixed(2)}
                </Text>
              </div>
              <Text style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                Updates every 30 seconds
              </Text>
            </>
          )}
          
          {pendingAmount === 0 && (
            <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
              No current shift running
            </Text>
          )}
        </div>
      </div>
    );
  };


  const needsApproval =
    authState.user?.role === 'staff' &&
    profile &&
    profile.securityRoles?.length &&
    profile.siaLicenses?.length &&
    !profile.isApproved;

  return (
    <MainLayout>
      {(showMandatoryForm || showResubmit) && profile && (
        <MandatoryProfileForm
          profile={profile}
          onComplete={() => {
            setShowMandatoryForm(false);
            setShowResubmit(false);
          }}
        />
      )}
      {!showMandatoryForm && !showResubmit && (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {needsApproval && (
              <ModernCard className="border-l-4 border-amber-400 bg-amber-50">
                <div className="flex items-start space-x-4">
                  <Icon iconName="Warning" className="text-amber-500 mt-1" />
                  <div className="flex-1">
                    <Text style={{ fontSize: '18px', fontWeight: '600', color: '#b45309' }} className="mb-2">
                      Profile Under Review
                    </Text>
                    <Text className="text-amber-700 mb-4">
                      Your profile is under review. You will be notified when approved.
                    </Text>
                    <PrimaryButton 
                      text="Resubmit Profile" 
                      onClick={() => setShowResubmit(true)}
                      styles={{ root: { backgroundColor: '#dc2626' } }}
                    />
                  </div>
                </div>
              </ModernCard>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div>
                <Text style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
                  Welcome, {authState.user?.firstName}
                </Text> <br />
                <Text className="text-gray-500 mt-1">
                  {new Date().toLocaleDateString('en-GB', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
              </div>
              {!activeShift && (
                <PrimaryButton
                  text="Start New Shift"
                  iconProps={{ iconName: 'Play' }}
                  onClick={() => navigate('/shifts/new')}
                  styles={{ 
                    root: { 
                      backgroundColor: '#dc2626', 
                      borderRadius: '12px',
                      height: '48px',
                      fontSize: '16px',
                      fontWeight: '600'
                    } 
                  }}
                />
              )}
            </div>

            {/* Earnings Overview */}
            <ModernCard className="text-center">
              <EarningsCircle 
                amount={earningsPeriod === 'weekly' ? weeklyEarnings : monthlyEarnings}
                isLoading={isLoading}
                period={earningsPeriod}
                onPeriodChange={setEarningsPeriod}
                pendingAmount={pendingEarnings}
              />
            </ModernCard>

            {/* Auto-Checkout Status */}
            <AutoCheckoutStatus 
              currentShift={activeShift || undefined}
              onCheckOutClick={() => activeShift && navigate(`/shifts/${activeShift.id}/end`)}
            />

            {/* Active Shift */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-1 w-8 bg-red-600 rounded-full"></div>
                <Text style={{ 
                  fontSize: '28px', 
                  fontWeight: '700', 
                  color: '#111827',
                  letterSpacing: '-0.025em'
                }}>
                  Active Shift
                </Text>
              </div>
              {isLoading ? (
                <ModernCard>
                  <Shimmer shimmerElements={[
                    { type: ShimmerElementType.line, height: 24, width: '60%' },
                    { type: ShimmerElementType.gap, width: '100%', height: 8 },
                    { type: ShimmerElementType.line, height: 16, width: '40%' },
                    { type: ShimmerElementType.gap, width: '100%', height: 16 },
                    { type: ShimmerElementType.line, height: 40, width: '30%' }
                  ]} />
                </ModernCard>
              ) : activeShift ? (
                <ModernCard className="border-l-4 border-green-400">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="mb-4 md:mb-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <Icon iconName="LocationDot" className="text-red-600" />
                        <Text style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                          {activeShift.venue.name}
                        </Text>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Icon iconName="Clock" />
                        <Text>
                          Started: {formatDate(activeShift.startTime)} at {formatTime(activeShift.startTime)}
                        </Text>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <PrimaryButton
                        text="End Shift"
                        iconProps={{ iconName: 'Stop' }}
                        onClick={() => navigate(`/shifts/${activeShift.id}/end`)}
                        styles={{ 
                          root: { 
                            backgroundColor: '#dc2626', 
                            borderRadius: '8px' 
                          } 
                        }}
                      />
                      <DefaultButton
                        text="Add Checks"
                        iconProps={{ iconName: 'CheckList' }}
                        onClick={() => navigate(`/shifts/${activeShift.id}/checks`)}
                        styles={{ root: { borderRadius: '8px' } }}
                      />
                    </div>
                  </div>
                </ModernCard>
              ) : (
                <ModernCard className="text-center py-8">
                  <Icon iconName="Sleep" className="text-gray-400 mb-4" style={{ fontSize: '48px' }} />
                  <Text style={{ fontSize: '18px', color: '#6b7280' }} className="mb-4">
                    You have no active shifts
                  </Text>
                  <PrimaryButton
                    text="Start New Shift"
                    iconProps={{ iconName: 'Play' }}
                    onClick={() => navigate('/shifts/new')}
                    styles={{ 
                      root: { 
                        backgroundColor: '#dc2626', 
                        borderRadius: '8px' 
                      } 
                    }}
                  />
                </ModernCard>
              )}
            </div>

            {/* Recent Shifts */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-1 w-8 bg-red-600 rounded-full"></div>
                  <Text style={{ 
                    fontSize: '28px', 
                    fontWeight: '700', 
                    color: '#111827',
                    letterSpacing: '-0.025em'
                  }}>
                    Recent Shifts
                  </Text>
                </div>
                <DefaultButton
                  text="View All"
                  iconProps={{ iconName: 'ChevronRight' }}
                  onClick={() => navigate('/shifts')}
                  styles={{ 
                    root: { 
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    },
                    rootHovered: {
                      borderColor: '#dc2626',
                      color: '#dc2626'
                    }
                  }}
                />
              </div>
              
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <ModernCard key={i}>
                      <Shimmer shimmerElements={[
                        { type: ShimmerElementType.line, height: 20, width: '80%' },
                        { type: ShimmerElementType.gap, width: '100%', height: 8 },
                        { type: ShimmerElementType.line, height: 16, width: '60%' },
                        { type: ShimmerElementType.line, height: 16, width: '50%' }
                      ]} />
                    </ModernCard>
                  ))}
                </div>
              ) : recentShifts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {recentShifts.map((shift, index) => (
                    <ModernCard 
                      key={shift.id} 
                      onClick={() => navigate(`/shifts/${shift.id}`)}
                      className="group"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors duration-200">
                          <Icon iconName="LocationDot" className="text-red-600" style={{ fontSize: '16px' }} />
                        </div>
                        <Text style={{ 
                          fontSize: '18px', 
                          fontWeight: '700', 
                          color: '#111827',
                          lineHeight: '1.2'
                        }}>
                          {shift.venue.name}
                        </Text>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <Icon iconName="Calendar" style={{ fontSize: '14px', color: '#6b7280' }} />
                          <Text style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                            {formatDate(shift.startTime)}
                          </Text>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Icon iconName="Clock" style={{ fontSize: '14px', color: '#6b7280' }} />
                          <Text style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                            {formatTime(shift.startTime)} - {
                              shift.endTime ? formatTime(shift.endTime) : 'In progress'
                            }
                          </Text>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Icon iconName="Tag" style={{ fontSize: '14px', color: '#6b7280' }} />
                            <Text style={{ 
                              fontSize: '12px', 
                              color: shift.status === ShiftStatus.COMPLETED ? '#059669' : '#6b7280',
                              fontWeight: '600',
                              textTransform: 'uppercase' as const,
                              letterSpacing: '0.05em'
                            }}>
                              {shift.status.toLowerCase()}
                            </Text>
                          </div>
                          <Icon iconName="ChevronRight" className="text-gray-400 group-hover:text-red-600 transition-colors duration-200" style={{ fontSize: '14px' }} />
                        </div>
                      </div>
                    </ModernCard>
                  ))}
                </div>
              ) : (
                <ModernCard className="text-center py-8">
                  <Icon iconName="History" className="text-gray-400 mb-4" style={{ fontSize: '48px' }} />
                  <Text style={{ fontSize: '18px', color: '#6b7280' }}>
                    No recent shifts found
                  </Text>
                </ModernCard>
              )}
            </div>

            {/* Invoices */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-1 w-8 bg-red-600 rounded-full"></div>
                  <Text style={{ 
                    fontSize: '28px', 
                    fontWeight: '700', 
                    color: '#111827',
                    letterSpacing: '-0.025em'
                  }}>
                    Invoices
                  </Text>
                </div>
                <DefaultButton
                  text="View All"
                  iconProps={{ iconName: 'ChevronRight' }}
                  onClick={() => navigate('/invoices')}
                  styles={{ 
                    root: { 
                      borderRadius: '12px',
                      border: '2px solid #e5e7eb',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    },
                    rootHovered: {
                      borderColor: '#dc2626',
                      color: '#dc2626'
                    }
                  }}
                />
              </div>
              
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <ModernCard key={i}>
                      <Shimmer shimmerElements={[
                        { type: ShimmerElementType.line, height: 20, width: '40%' },
                        { type: ShimmerElementType.gap, width: '100%', height: 8 },
                        { type: ShimmerElementType.line, height: 16, width: '60%' },
                        { type: ShimmerElementType.line, height: 16, width: '30%' }
                      ]} />
                    </ModernCard>
                  ))}
                </div>
              ) : pendingInvoices.length > 0 ? (
                <div className="space-y-4">
                  {pendingInvoices.map((invoice, index) => (
                    <ModernCard 
                      key={invoice.id}
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                      className="group"
                      style={{ animationDelay: `${index * 150}ms` }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="mb-4 md:mb-0 flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="p-2 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors duration-200">
                              <Icon iconName="PaymentCard" className="text-blue-600" style={{ fontSize: '16px' }} />
                            </div>
                            <Text style={{ 
                              fontSize: '20px', 
                              fontWeight: '700', 
                              color: '#111827',
                              lineHeight: '1.2'
                            }}>
                              Invoice #{invoice.id}
                            </Text>
                          </div>
                          <div className="space-y-2 ml-11">
                            <div className="flex items-center space-x-3">
                              <Icon iconName="Calendar" style={{ fontSize: '14px', color: '#6b7280' }} />
                              <Text style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                                {formatDate(invoice.startDate || invoice.start_date)} - {formatDate(invoice.endDate || invoice.end_date)}
                              </Text>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Icon iconName="Tag" style={{ fontSize: '14px', color: '#6b7280' }} />
                              <Text style={{ 
                                fontSize: '12px', 
                                color: invoice.status === 'paid' ? '#059669' : '#f59e0b',
                                fontWeight: '600',
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.05em'
                              }}>
                                {invoice.status}
                              </Text>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <Text style={{ 
                              fontSize: '28px', 
                              fontWeight: '800', 
                              color: '#111827',
                              lineHeight: '1',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                              £{Number(invoice.totalAmount || invoice.total_amount || 0).toFixed(2)}
                            </Text>
                          </div>
                          <Icon iconName="ChevronRight" className="text-gray-400 group-hover:text-red-600 transition-colors duration-200" style={{ fontSize: '16px' }} />
                        </div>
                      </div>
                    </ModernCard>
                  ))}
                </div>
              ) : (
                <ModernCard className="text-center py-8">
                  <Icon iconName="PaymentCard" className="text-gray-400 mb-4" style={{ fontSize: '48px' }} />
                  <Text style={{ fontSize: '18px', color: '#6b7280' }}>
                    No recent invoices found
                  </Text>
                </ModernCard>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default StaffDashboard;
