import React, { useState } from 'react';

type AlertType = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  type: AlertType;
  header?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const alertConfig: Record<AlertType, {
  bg: string;
  border: string;
  accent: string;
  iconBg: string;
  iconColor: string;
  headerColor: string;
  textColor: string;
  lniIcon: string;
}> = {
  success: {
    bg: 'bg-white',
    border: 'border-[#E5E7EB]',
    accent: '#059669',
    iconBg: 'bg-[#ECFDF5]',
    iconColor: 'text-[#059669]',
    headerColor: 'text-[#065F46]',
    textColor: 'text-[#6B7280]',
    lniIcon: 'lni-check-circle-1',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-[#E5E7EB]',
    accent: '#D97706',
    iconBg: 'bg-[#FFFBEB]',
    iconColor: 'text-[#D97706]',
    headerColor: 'text-[#92400E]',
    textColor: 'text-[#6B7280]',
    lniIcon: 'lni-info',
  },
  error: {
    bg: 'bg-white',
    border: 'border-[#E5E7EB]',
    accent: '#DC2626',
    iconBg: 'bg-[#FEF2F2]',
    iconColor: 'text-[#DC2626]',
    headerColor: 'text-[#991B1B]',
    textColor: 'text-[#6B7280]',
    lniIcon: 'lni-xmark-circle',
  },
  info: {
    bg: 'bg-white',
    border: 'border-[#E5E7EB]',
    accent: '#2563EB',
    iconBg: 'bg-[#EFF6FF]',
    iconColor: 'text-[#2563EB]',
    headerColor: 'text-[#1E40AF]',
    textColor: 'text-[#6B7280]',
    lniIcon: 'lni-info',
  },
};

const Alert: React.FC<AlertProps> = ({
  type,
  header,
  children,
  dismissible = false,
  onDismiss,
  action,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(false);
  const config = alertConfig[type];

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={`relative flex items-start gap-4 p-5 ${config.bg} ${config.border} border rounded-[16px] overflow-hidden ${className}`}
      role="alert"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)' }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: config.accent }}
      />

      {/* Icon tile */}
      <div className={`w-9 h-9 rounded-[10px] ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
        <i className={`lni ${config.lniIcon} text-[16px] ${config.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {header && (
          <p className={`text-[14px] font-semibold ${config.headerColor} mb-0.5`}>{header}</p>
        )}
        <div className={`text-[13px] ${config.textColor} leading-relaxed`}>{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>

      {/* Dismiss */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          aria-label="Dismiss"
        >
          <i className="lni lni-xmark text-[12px]" />
        </button>
      )}
    </div>
  );
};

export default Alert;
