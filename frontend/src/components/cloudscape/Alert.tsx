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

const alertStyles: Record<AlertType, { container: string; icon: string; iconPath: string }> = {
  success: {
    container: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]',
    icon: 'text-[#059669]',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    container: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
    icon: 'text-[#D97706]',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  },
  error: {
    container: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
    icon: 'text-[#DC2626]',
    iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  info: {
    container: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]',
    icon: 'text-[#2563EB]',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
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
  const styles = alertStyles[type];

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={`flex items-start gap-3 p-5 border rounded-2xl ${styles.container} ${className}`}
      role="alert"
    >
      <svg
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={styles.iconPath} />
      </svg>

      <div className="flex-1 min-w-0">
        {header && (
          <p className="text-[13px] font-semibold mb-1">{header}</p>
        )}
        <div className="text-[13px]">{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;
