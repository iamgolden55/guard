import React from 'react';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'stopped' | 'pending' | 'in-progress' | 'loading';

interface StatusIndicatorProps {
  type: StatusType;
  children: React.ReactNode;
  className?: string;
}

const statusConfig: Record<StatusType, { dotClass: string; textClass: string; icon?: string }> = {
  success: {
    dotClass: 'bg-green-600',
    textClass: 'text-green-700',
  },
  warning: {
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
  },
  error: {
    dotClass: 'bg-red-600',
    textClass: 'text-red-700',
  },
  info: {
    dotClass: 'bg-blue-600',
    textClass: 'text-blue-700',
  },
  stopped: {
    dotClass: 'bg-gray-500',
    textClass: 'text-gray-600',
  },
  pending: {
    dotClass: 'bg-gray-400',
    textClass: 'text-gray-600',
  },
  'in-progress': {
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
  },
  loading: {
    dotClass: 'bg-blue-500 animate-pulse',
    textClass: 'text-blue-700',
  },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ type, children, className = '' }) => {
  const config = statusConfig[type];

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${config.textClass} ${className}`}>
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`}
        aria-hidden="true"
      />
      <span>{children}</span>
    </span>
  );
};

export default StatusIndicator;
