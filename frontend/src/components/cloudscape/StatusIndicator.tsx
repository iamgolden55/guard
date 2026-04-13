import React from 'react';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'stopped' | 'pending' | 'in-progress' | 'loading';

interface StatusIndicatorProps {
  type: StatusType;
  children: React.ReactNode;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#059669]',
    dot: 'bg-[#059669]',
  },
  warning: {
    bg: 'bg-[#FFFBEB]',
    text: 'text-[#D97706]',
    dot: 'bg-[#D97706]',
  },
  error: {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#DC2626]',
    dot: 'bg-[#DC2626]',
  },
  info: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#2563EB]',
    dot: 'bg-[#2563EB]',
  },
  stopped: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#6B7280]',
    dot: 'bg-[#6B7280]',
  },
  pending: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#6B7280]',
    dot: 'bg-[#9CA3AF]',
  },
  'in-progress': {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#2563EB]',
    dot: 'bg-[#2563EB]',
  },
  loading: {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#DC2626]',
    dot: 'bg-[#DC2626] animate-pulse',
  },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ type, children, className = '' }) => {
  const config = statusConfig[type] || statusConfig.info;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium ${config.bg} ${config.text} ${className}`}>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
        aria-hidden="true"
      />
      <span className="capitalize">{children}</span>
    </span>
  );
};

export default StatusIndicator;
