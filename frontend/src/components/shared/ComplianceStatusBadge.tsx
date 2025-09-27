// Compliance Status Badge Component
// Reusable status badge for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import React from 'react';
import { Badge } from '@fluentui/react-components';
import type { ComplianceStatus, ViolationSeverity } from '../../types/compliance';
import { complianceColors, severityColors } from '../../types/compliance';

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus | ViolationSeverity;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outline' | 'tint';
  className?: string;
}

export const ComplianceStatusBadge: React.FC<ComplianceStatusBadgeProps> = ({
  status,
  size = 'medium',
  variant = 'filled',
  className = ''
}) => {
  // Determine if it's a compliance status or violation severity
  const isComplianceStatus = ['compliant', 'warning', 'violation', 'critical'].includes(status);
  const colorConfig = isComplianceStatus
    ? complianceColors[status as ComplianceStatus]
    : severityColors[status as ViolationSeverity];

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      compliant: 'Compliant',
      warning: 'Warning',
      violation: 'Violation',
      critical: 'Critical',
      info: 'Info',
      minor: 'Minor',
      major: 'Major'
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getIconForStatus = (status: string): string => {
    const icons: Record<string, string> = {
      compliant: '✓',
      warning: '⚠',
      violation: '✗',
      critical: '⚡',
      info: 'ℹ',
      minor: '!',
      major: '!!',
    };
    return icons[status] || '';
  };

  const badgeStyles = {
    backgroundColor: variant === 'filled' ? colorConfig.primary :
                    variant === 'tint' ? colorConfig.background : 'transparent',
    color: variant === 'filled' ? 'white' : colorConfig.primary,
    border: variant === 'outline' ? `1px solid ${colorConfig.border}` : 'none',
    fontSize: size === 'small' ? '0.75rem' : size === 'large' ? '1rem' : '0.875rem',
    fontWeight: 500,
  };

  return (
    <Badge
      size={size}
      appearance={variant === 'filled' ? 'filled' : variant === 'outline' ? 'outline' : 'tint'}
      className={`inline-flex items-center gap-1 ${className}`}
      style={badgeStyles}
    >
      <span className="inline-block w-3 h-3 text-center leading-none">
        {getIconForStatus(status)}
      </span>
      <span>{getStatusLabel(status)}</span>
    </Badge>
  );
};

// Specific badge components for different use cases
export const ViolationSeverityBadge: React.FC<{
  severity: ViolationSeverity;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}> = ({ severity, size = 'small', showIcon = true }) => {
  const colorConfig = severityColors[severity];

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        size === 'small' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm'
      }`}
      style={{
        backgroundColor: colorConfig.background,
        color: colorConfig.primary,
        border: `1px solid ${colorConfig.border}`
      }}
    >
      {showIcon && (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorConfig.primary }} />
      )}
      <span>{severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
    </div>
  );
};

export const ComplianceScoreBadge: React.FC<{
  score: number;
  size?: 'small' | 'medium' | 'large';
}> = ({ score, size = 'medium' }) => {
  const getStatusFromScore = (score: number): ComplianceStatus => {
    if (score >= 95) return 'compliant';
    if (score >= 80) return 'warning';
    if (score >= 60) return 'violation';
    return 'critical';
  };

  const status = getStatusFromScore(score);
  const colorConfig = complianceColors[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold ${
        size === 'small' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-base'
      }`}
      style={{
        backgroundColor: colorConfig.background,
        color: colorConfig.primary,
        border: `1px solid ${colorConfig.border}`
      }}
    >
      <span className="text-2xl">{score}%</span>
      <div className="flex flex-col">
        <span className="text-xs opacity-80">Compliance</span>
        <span className="text-xs opacity-80">Score</span>
      </div>
    </div>
  );
};

export const LiveStatusIndicator: React.FC<{
  status: 'compliant' | 'warning' | 'violation';
  isConnected?: boolean;
  lastUpdate?: string;
}> = ({ status, isConnected = true, lastUpdate }) => {
  const colorConfig = complianceColors[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`w-3 h-3 rounded-full ${isConnected ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: colorConfig.primary }}
        />
        {isConnected && (
          <div
            className="absolute inset-0 w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: colorConfig.primary }}
          />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium" style={{ color: colorConfig.primary }}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {lastUpdate && (
          <span className="text-xs text-gray-500">
            Last update: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}
      </div>
      {!isConnected && (
        <span className="text-xs text-gray-400 ml-2">Disconnected</span>
      )}
    </div>
  );
};

export default ComplianceStatusBadge;