// Compliance Dashboard Component — Premium Redesign
// SSMS-COMPLIANCE-2025

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, BarElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  ShieldCheck, AlertTriangle, CheckCircle, Clock, RefreshCw,
  TrendingUp, PieChart, AlertCircle, Info, ArrowRight,
} from 'lucide-react';

import {
  useComplianceDashboardMetrics,
  useComplianceAlerts,
  useComplianceTrends,
  useComplianceRealTimeUpdates
} from '../../hooks/useComplianceData';
import { ViolationSeverityBadge } from '../shared/ComplianceStatusBadge';
import DateRangePicker, { QuickDateRangeButtons } from '../shared/DateRangePicker';
import type { DateRange, ComplianceDashboardProps } from '../../types/compliance';
import { complianceColors } from '../../types/compliance';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement);

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  userId, venueId, timeRange: initialTimeRange, autoRefresh = true
}) => {
  const navigate = useNavigate();
  const [bannerAnimate, setBannerAnimate] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<DateRange>(
    initialTimeRange || [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()]
  );
  const [refreshInterval, setRefreshInterval] = useState(30);

  useEffect(() => {
    const t = setTimeout(() => setBannerAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  const { data: metricsData, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useComplianceDashboardMetrics(
    { venue_id: venueId, user_id: userId, start_date: selectedTimeRange?.[0]?.toISOString(), end_date: selectedTimeRange?.[1]?.toISOString() },
    { autoRefresh, refetchInterval: refreshInterval * 1000 }
  );
  const { data: alertsData } = useComplianceAlerts();
  const { data: trendsData } = useComplianceTrends(7, 'day');
  const { isConnected, latestViolations } = useComplianceRealTimeUpdates({
    onViolationReceived: (v) => console.log('New violation:', v),
  });

  const handleRefresh = useCallback(async () => { await refetchMetrics(); }, [refetchMetrics]);
  const handleTimeRangeChange = useCallback((range: DateRange) => { setSelectedTimeRange(range); }, []);

  const complianceTrendChart = useMemo(() => {
    if (!metricsData?.compliance_trend) return null;
    return {
      labels: metricsData.compliance_trend.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        { label: 'Compliance Rate (%)', data: metricsData.compliance_trend.map(item => item.compliance_rate), borderColor: complianceColors.compliant.primary, backgroundColor: complianceColors.compliant.background, tension: 0.4, fill: true },
        { label: 'Violations', data: metricsData.compliance_trend.map(item => item.violation_count), borderColor: complianceColors.violation.primary, backgroundColor: complianceColors.violation.background, tension: 0.4, yAxisID: 'y1' },
      ],
    };
  }, [metricsData]);

  const violationBreakdownChart = useMemo(() => {
    if (!metricsData?.violation_breakdown) return null;
    return {
      labels: metricsData.violation_breakdown.map(item => item.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())),
      datasets: [{
        data: metricsData.violation_breakdown.map(item => item.count),
        backgroundColor: metricsData.violation_breakdown.map(item => {
          switch (item.severity) { case 'critical': return complianceColors.critical.primary; case 'major': return complianceColors.violation.primary; case 'minor': return complianceColors.warning.primary; default: return complianceColors.compliant.primary; }
        }),
        borderWidth: 2, borderColor: '#ffffff',
      }],
    };
  }, [metricsData]);

  // Loading state
  if (metricsLoading && !metricsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#EAEAF0] border-t-[#DC2626] rounded-full animate-spin mx-auto" />
          <p className="text-[13px] text-[#9CA3AF] mt-3">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (metricsError) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-[20px] p-10 text-center" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
        <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-[#DC2626]" strokeWidth={1.5} />
        </div>
        <h3 className="text-[18px] font-bold text-[#1A1A2E] font-['Plus_Jakarta_Sans']">Failed to load dashboard</h3>
        <p className="text-[13px] text-[#6B7280] mt-1 mb-5">Unable to fetch compliance data. Please try refreshing.</p>
        <button onClick={handleRefresh} className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-[#1A1A2E] rounded-xl hover:bg-[#374151] transition-colors">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const complianceRate = metricsData?.complianceRate || 0;
  const rateStatus = complianceRate >= 95 ? 'success' : complianceRate >= 80 ? 'warning' : 'urgent';
  const rateLabel = complianceRate >= 95 ? 'Excellent' : complianceRate >= 80 ? 'Good' : complianceRate >= 60 ? 'Needs improvement' : 'Critical';

  return (
    <div className="space-y-6">

      {/* ── WELCOME BANNER ── */}
      <div className="relative overflow-hidden bg-white border border-[#E5E7EB] rounded-[20px] p-8 md:p-10" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
        <div className="relative z-10 max-w-lg bg-white/85 sm:bg-white/70 md:bg-transparent backdrop-blur-md sm:backdrop-blur-sm md:backdrop-blur-none rounded-2xl sm:rounded-xl md:rounded-none p-1 sm:p-3 md:p-0 -m-1 sm:-m-3 md:m-0">
          <div className="flex items-center gap-2 mb-3">
            <h1 className="text-[26px] md:text-[30px] font-extrabold text-[#1A1A2E] leading-tight tracking-[-0.02em] font-['Plus_Jakarta_Sans']">
              Compliance Overview
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${isConnected ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FFFBEB] text-[#D97706]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#059669] animate-pulse' : 'bg-[#D97706]'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#6B7280] leading-relaxed">
            Monitor working hours, SIA licences, and regulatory compliance across your operation.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button onClick={() => navigate('/compliance/check')} className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-[#1A1A2E] rounded-xl hover:bg-[#374151] transition-colors">
              <ShieldCheck size={14} /> Run compliance check
            </button>
            <button onClick={() => navigate('/compliance/reports')} className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-[#1A1A2E] bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors">
              View reports
            </button>
          </div>
        </div>

        {/* Decorative illustration — compliance documents deck */}
        <div className="absolute right-0 top-0 bottom-0 w-[50%] md:w-[45%] pointer-events-none hidden sm:block" aria-hidden="true">
          {/* SIA Licence Card (back) */}
          <div style={{
            position: 'absolute', width: '170px', height: '230px', right: bannerAnimate ? '105px' : '-200px', top: '8px',
            background: '#FFFFFF', border: '1.5px solid #E0F2FE', borderRadius: '16px', overflow: 'hidden',
            boxShadow: bannerAnimate ? '0 8px 32px rgba(6,182,212,0.10), 0 2px 8px rgba(0,0,0,0.04)' : 'none',
            transform: bannerAnimate ? 'rotate(-18deg) scale(1)' : 'rotate(-6deg) scale(0.88)',
            opacity: bannerAnimate ? 1 : 0, transition: 'all 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms',
          }}>
            <div style={{ background: 'linear-gradient(135deg, #0891B2, #06B6D4)', padding: '10px 14px' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'white', letterSpacing: '0.05em', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>SIA LICENCE</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#CFFAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '8px', fontWeight: 700, color: '#0E7490' }}>JD</span></div>
                <div><div style={{ fontSize: '8px', fontWeight: 700, color: '#1A1A2E' }}>James Donovan</div><div style={{ fontSize: '7px', color: '#9CA3AF' }}>Door Supervisor</div></div>
              </div>
              <div style={{ padding: '5px 7px', background: '#F0FDFA', borderRadius: '5px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '7px', color: '#6B7280' }}>Status</span>
                <span style={{ fontSize: '7px', fontWeight: 600, color: '#059669' }}>Valid</span>
              </div>
              <div style={{ padding: '5px 7px', background: '#F7F7FA', borderRadius: '5px', marginBottom: '6px' }}>
                <div style={{ fontSize: '6px', color: '#9CA3AF' }}>EXPIRY</div>
                <div style={{ fontSize: '8px', fontWeight: 600, color: '#1A1A2E', fontFamily: 'JetBrains Mono, monospace' }}>15 Mar 2027</div>
              </div>
            </div>
          </div>

          {/* Compliance Report Card (middle) */}
          <div style={{
            position: 'absolute', width: '180px', height: '245px', right: bannerAnimate ? '52px' : '-200px', top: '-10px',
            background: '#FFFFFF', border: '1.5px solid #E0E7FF', borderRadius: '16px', overflow: 'hidden',
            boxShadow: bannerAnimate ? '0 12px 40px rgba(99,102,241,0.12), 0 4px 12px rgba(0,0,0,0.05)' : 'none',
            transform: bannerAnimate ? 'rotate(-10deg) scale(1)' : 'rotate(-3deg) scale(0.88)',
            opacity: bannerAnimate ? 1 : 0, transition: 'all 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 300ms',
          }}>
            <div style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>COMPLIANCE REPORT</span>
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)' }}>Weekly</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#1A1A2E', marginBottom: '10px' }}>Week of 28 Mar</div>
              {[{ label: 'Compliance rate', value: '96%', color: '#059669' }, { label: 'Violations', value: '2', color: '#D97706' }, { label: 'Resolved', value: '2', color: '#059669' }].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontSize: '7px', color: '#6B7280' }}>{row.label}</span>
                  <span style={{ fontSize: '8px', fontWeight: 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div style={{ marginTop: '10px', padding: '4px 10px', borderRadius: '999px', background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#059669' }} />
                <span style={{ fontSize: '7px', fontWeight: 700, color: '#059669' }}>COMPLIANT</span>
              </div>
            </div>
          </div>

          {/* Regulation Card (front) */}
          <div style={{
            position: 'absolute', width: '185px', height: '255px', right: bannerAnimate ? '-5px' : '-220px', top: '-28px',
            background: '#FFFFFF', border: '1.5px solid #FFE4E6', borderRadius: '16px', overflow: 'hidden',
            boxShadow: bannerAnimate ? '0 16px 48px rgba(220,38,38,0.10), 0 6px 16px rgba(0,0,0,0.06)' : 'none',
            transform: bannerAnimate ? 'rotate(-3deg) scale(1)' : 'rotate(0deg) scale(0.88)',
            opacity: bannerAnimate ? 1 : 0, transition: 'all 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 450ms',
          }}>
            <div style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>REGULATION</span>
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.7)', fontFamily: 'JetBrains Mono, monospace' }}>WTR-2024</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#1A1A2E', marginBottom: '3px' }}>Working Time Regulations</div>
              <div style={{ fontSize: '7px', color: '#9CA3AF', marginBottom: '10px' }}>UK Employment Law</div>
              {[{ rule: 'Max weekly hours', val: '48h' }, { rule: 'Min rest between shifts', val: '11h' }, { rule: 'Max night shift', val: '8h' }].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontSize: '7px', color: '#6B7280' }}>{item.rule}</span>
                  <span style={{ fontSize: '8px', fontWeight: 600, color: '#1A1A2E', fontFamily: 'JetBrains Mono, monospace' }}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Accent dots */}
          <div className="absolute w-3 h-3 rounded-full" style={{ right: '165px', top: '18px', background: '#DC2626', opacity: bannerAnimate ? 0.4 : 0, boxShadow: '0 0 8px rgba(220,38,38,0.3)', transition: 'opacity 500ms ease 1000ms' }} />
          <div className="absolute w-2.5 h-2.5 rounded-full" style={{ right: '210px', top: '60px', background: '#6366F1', opacity: bannerAnimate ? 0.45 : 0, boxShadow: '0 0 6px rgba(99,102,241,0.3)', transition: 'opacity 500ms ease 1100ms' }} />
          <div className="absolute w-3.5 h-3.5 rounded-full" style={{ right: '130px', bottom: '22px', background: '#06B6D4', opacity: bannerAnimate ? 0.35 : 0, boxShadow: '0 0 10px rgba(6,182,212,0.3)', transition: 'opacity 500ms ease 1200ms' }} />
        </div>
      </div>

      {/* ── ALERT BANNER ── */}
      {alertsData?.data && alertsData.data.length > 0 && (
        <div className="relative flex items-start gap-4 p-5 bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#DC2626]" />
          <div className="w-9 h-9 rounded-[10px] bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-[#DC2626]" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#991B1B] mb-2">Active compliance alerts</p>
            <div className="space-y-2">
              {alertsData.data.slice(0, 3).map((alert, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                  <span className="text-[13px] text-[#374151] font-medium">{alert.message}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${alert.priority === 'high' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FFFBEB] text-[#D97706]'}`}>
                    {alert.count} {alert.count === 1 ? 'item' : 'items'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TIME RANGE CONTROLS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuickDateRangeButtons onRangeSelect={handleTimeRangeChange} selectedRange={selectedTimeRange} className="hidden sm:flex" />
        <div className="flex items-center gap-2">
          <DateRangePicker value={selectedTimeRange} onChange={handleTimeRangeChange} className="w-auto" />
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="h-9 px-3 text-[12px] bg-white border border-[#E5E7EB] rounded-lg text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20"
          >
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
            <option value={0}>Off</option>
          </select>
          <button onClick={handleRefresh} disabled={metricsLoading} className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12px] font-semibold text-white bg-[#1A1A2E] rounded-lg hover:bg-[#374151] transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={metricsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {metricsData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Compliance Rate */}
          <div className="relative bg-white border border-[#EAEAF0] rounded-[20px] p-5 overflow-hidden" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="absolute pointer-events-none" style={{ right: '-8px', bottom: '-8px', opacity: 0.04, color: 'var(--ds-tile-success)' }}><ShieldCheck size={64} strokeWidth={1} /></div>
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ backgroundColor: 'var(--ds-tile-success-bg)', color: 'var(--ds-tile-success)' }}><ShieldCheck size={18} strokeWidth={1.8} /></div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${rateStatus === 'success' ? 'bg-[#ECFDF5] text-[#059669]' : rateStatus === 'warning' ? 'bg-[#FFFBEB] text-[#D97706]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>{rateLabel}</span>
              </div>
              <p className="text-[12px] font-medium text-[#9CA3AF] mb-1">Compliance rate</p>
              <p className="text-[28px] font-extrabold text-[#1A1A2E] tracking-[-0.02em] leading-none font-['Plus_Jakarta_Sans']">{complianceRate}%</p>
              <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 mt-3">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${rateStatus === 'success' ? 'bg-[#059669]' : rateStatus === 'warning' ? 'bg-[#D97706]' : 'bg-[#DC2626]'}`} style={{ width: `${Math.min(complianceRate, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Total Violations */}
          <div className="relative bg-white border border-[#EAEAF0] rounded-[20px] p-5 overflow-hidden" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="absolute pointer-events-none" style={{ right: '-8px', bottom: '-8px', opacity: 0.04, color: 'var(--ds-tile-urgent)' }}><AlertTriangle size={64} strokeWidth={1} /></div>
            <div className="relative">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3" style={{ backgroundColor: (metricsData.total_violations || 0) > 0 ? 'var(--ds-tile-urgent-bg)' : '#F3F4F6', color: (metricsData.total_violations || 0) > 0 ? 'var(--ds-tile-urgent)' : '#9CA3AF' }}><AlertTriangle size={18} strokeWidth={1.8} /></div>
              <p className="text-[12px] font-medium text-[#9CA3AF] mb-1">Total violations</p>
              <p className="text-[28px] font-extrabold text-[#1A1A2E] tracking-[-0.02em] leading-none font-['Plus_Jakarta_Sans']">{metricsData.total_violations || 0}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">{metricsData.critical_violations || 0} critical</p>
            </div>
          </div>

          {/* Resolution Rate */}
          <div className="relative bg-white border border-[#EAEAF0] rounded-[20px] p-5 overflow-hidden" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="absolute pointer-events-none" style={{ right: '-8px', bottom: '-8px', opacity: 0.04, color: 'var(--ds-tile-info)' }}><CheckCircle size={64} strokeWidth={1} /></div>
            <div className="relative">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--ds-tile-info-bg)', color: 'var(--ds-tile-info)' }}><CheckCircle size={18} strokeWidth={1.8} /></div>
              <p className="text-[12px] font-medium text-[#9CA3AF] mb-1">Resolution rate</p>
              <p className="text-[28px] font-extrabold text-[#1A1A2E] tracking-[-0.02em] leading-none font-['Plus_Jakarta_Sans']">{metricsData.resolutionRate || 0}%</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">{metricsData.resolved_violations || 0} of {metricsData.total_violations || 0} resolved</p>
            </div>
          </div>

          {/* Avg Resolution Time */}
          <div className="relative bg-white border border-[#EAEAF0] rounded-[20px] p-5 overflow-hidden" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="absolute pointer-events-none" style={{ right: '-8px', bottom: '-8px', opacity: 0.04, color: 'var(--ds-tile-warning)' }}><Clock size={64} strokeWidth={1} /></div>
            <div className="relative">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--ds-tile-warning-bg)', color: 'var(--ds-tile-warning)' }}><Clock size={18} strokeWidth={1.8} /></div>
              <p className="text-[12px] font-medium text-[#9CA3AF] mb-1">Avg resolution time</p>
              <p className="text-[28px] font-extrabold text-[#1A1A2E] tracking-[-0.02em] leading-none font-['Plus_Jakarta_Sans']">
                {metricsData.average_resolution_time_hours && !isNaN(metricsData.average_resolution_time_hours) && isFinite(metricsData.average_resolution_time_hours)
                  ? `${Math.round(metricsData.average_resolution_time_hours)}h` : 'N/A'}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">Average time to resolve</p>
            </div>
          </div>
        </div>
      )}

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {complianceTrendChart && (
          <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-[10px] bg-[#EFF6FF] flex items-center justify-center"><TrendingUp size={16} className="text-[#2563EB]" strokeWidth={1.8} /></div>
              <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Compliance trends</h3>
            </div>
            <p className="text-[12px] text-[#9CA3AF] mb-4 ml-12">Last 7 days compliance rate and violation trends</p>
            <div className="h-64">
              <Line data={complianceTrendChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' as const, labels: { usePointStyle: true, padding: 20, font: { size: 12, family: 'Inter, sans-serif' } } }, title: { display: false } },
                scales: { y: { beginAtZero: true }, y1: { type: 'linear' as const, display: true, position: 'right' as const, beginAtZero: true } },
                elements: { point: { radius: 4, hoverRadius: 6 } },
              }} />
            </div>
          </div>
        )}

        {violationBreakdownChart && (
          <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-[10px] bg-[#FEF2F2] flex items-center justify-center"><PieChart size={16} className="text-[#DC2626]" strokeWidth={1.8} /></div>
              <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Violation breakdown</h3>
            </div>
            <p className="text-[12px] text-[#9CA3AF] mb-4 ml-12">Distribution of violations by type and severity</p>
            <div className="h-64">
              <Doughnut data={violationBreakdownChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' as const, labels: { usePointStyle: true, padding: 15, font: { size: 11, family: 'Inter, sans-serif' } } } },
                elements: { arc: { borderWidth: 2, borderColor: '#ffffff' } },
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── RECENT VIOLATIONS ── */}
      {latestViolations.length > 0 && (
        <div className="bg-white border border-[#EAEAF0] rounded-[20px] p-6" style={{ boxShadow: 'var(--ds-shadow-card)' }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-[10px] bg-[#FFFBEB] flex items-center justify-center"><AlertTriangle size={16} className="text-[#D97706]" strokeWidth={1.8} /></div>
            <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Recent violations</h3>
          </div>
          <p className="text-[12px] text-[#9CA3AF] mb-4 ml-12">Live violations detected in real-time</p>
          <div className="space-y-3">
            {latestViolations.slice(0, 5).map((violation) => (
              <div key={violation.id} className="flex items-start justify-between p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6] hover:bg-[#FEF2F2] hover:border-[#FECACA] transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ViolationSeverityBadge severity={violation.severity} size="small" />
                    <span className="text-[13px] font-semibold text-[#1A1A2E]">{violation.user_data.full_name}</span>
                  </div>
                  <p className="text-[12px] text-[#6B7280] mb-1">{violation.description}</p>
                  <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                    <Info size={11} /> {new Date(violation.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] px-2.5 py-1 rounded-full ml-3">
                  {violation.violation_type_display}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
