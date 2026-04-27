import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  accent: string;
  iconBg: string;
  iconColor: string;
  headerColor: string;
  Icon: LucideIcon;
}> = {
  success: { accent: '#059669', iconBg: 'bg-[#ECFDF5]', iconColor: 'text-[#059669]', headerColor: 'text-[#065F46]', Icon: CheckCircle },
  warning: { accent: '#D97706', iconBg: 'bg-[#FFFBEB]', iconColor: 'text-[#D97706]', headerColor: 'text-[#92400E]', Icon: AlertTriangle },
  error:   { accent: '#DC2626', iconBg: 'bg-[#FEF2F2]', iconColor: 'text-[#DC2626]', headerColor: 'text-[#991B1B]', Icon: XCircle },
  info:    { accent: '#2563EB', iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#2563EB]', headerColor: 'text-[#1E40AF]', Icon: Info },
};

const Alert: React.FC<AlertProps> = ({ type, header, children, dismissible = false, onDismiss, action, className = '' }) => {
  const [dismissed, setDismissed] = useState(false);
  const config = alertConfig[type];
  const { Icon } = config;

  if (dismissed) return null;

  const handleDismiss = () => { setDismissed(true); onDismiss?.(); };

  return (
    <div
      className={`relative flex items-start gap-4 p-5 bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden ${className}`}
      role="alert"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: config.accent }} />

      <div className={`w-9 h-9 rounded-[10px] ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={config.iconColor} strokeWidth={1.8} />
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        {header && <p className={`text-[14px] font-semibold ${config.headerColor} mb-0.5`}>{header}</p>}
        <div className="text-[13px] text-[#6B7280] leading-relaxed">{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>

      {dismissible && (
        <button onClick={handleDismiss} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#6B7280] transition-colors" aria-label="Dismiss">
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
};

export default Alert;
