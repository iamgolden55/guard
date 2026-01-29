import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ToastNotification {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  showToast: (notification: Omit<ToastNotification, 'id'>) => string;
  hideToast: (id: string) => void;
  showSuccess: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  showError: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  showWarning: (title: string, message?: string, options?: Partial<ToastNotification>) => string;
  showInfo: (title: string, message?: string, options?: Partial<ToastNotification>) => string;

  // Report-specific convenience methods
  showReportStarted: (reportTitle: string, jobId: string) => string;
  showReportCompleted: (reportTitle: string, downloadAction?: () => void) => string;
  showReportFailed: (reportTitle: string, error: string, retryAction?: () => void) => string;
  showReportCancelled: (reportTitle: string) => string;
}

// ============================================================================
// Icons
// ============================================================================

const Icons = {
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ErrorCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Warning: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Info: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  X: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// ============================================================================
// Toast Item Component
// ============================================================================

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const dismissRef = useRef<NodeJS.Timeout | null>(null);

  const config = {
    success: {
      icon: <Icons.CheckCircle />,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      iconColor: 'text-emerald-600',
      titleColor: 'text-emerald-900',
      messageColor: 'text-emerald-700',
      progressColor: 'bg-emerald-500',
    },
    error: {
      icon: <Icons.ErrorCircle />,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      messageColor: 'text-red-700',
      progressColor: 'bg-red-500',
    },
    warning: {
      icon: <Icons.Warning />,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      messageColor: 'text-amber-700',
      progressColor: 'bg-amber-500',
    },
    info: {
      icon: <Icons.Info />,
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      iconColor: 'text-sky-600',
      titleColor: 'text-sky-900',
      messageColor: 'text-sky-700',
      progressColor: 'bg-sky-500',
    },
  };

  const { icon, bgColor, borderColor, iconColor, titleColor, messageColor, progressColor } = config[toast.type];
  const duration = toast.duration ?? 5000;

  useEffect(() => {
    if (toast.persistent) return;

    // Start progress animation
    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        if (progressRef.current) clearInterval(progressRef.current);
      }
    }, 50);

    // Auto dismiss
    dismissRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [toast.persistent, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  return (
    <div
      className={`
        relative overflow-hidden w-80 rounded-xl border-2 shadow-lg
        transform transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
        ${bgColor} ${borderColor}
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${iconColor}`}>
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${titleColor}`}>
              {toast.title}
            </p>
            {toast.message && (
              <p className={`mt-1 text-sm ${messageColor}`}>
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  handleDismiss();
                }}
                className={`mt-2 text-sm font-semibold ${iconColor} hover:underline`}
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 p-1 rounded-lg transition-colors ${iconColor} hover:bg-black/5`}
          >
            <Icons.X />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!toast.persistent && (
        <div className="h-1 bg-black/5">
          <div
            className={`h-full ${progressColor} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Toast Container Component
// ============================================================================

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// ============================================================================
// Context & Provider
// ============================================================================

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  defaultDuration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultDuration = 5000
}) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((notification: Omit<ToastNotification, 'id'>): string => {
    const id = generateId();
    const newToast: ToastNotification = {
      ...notification,
      id,
      duration: notification.duration ?? defaultDuration,
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, [generateId, defaultDuration]);

  const showSuccess = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'success',
      duration: 4000, // Success toasts auto-dismiss after 4 seconds
      ...options
    });
  }, [showToast]);

  const showError = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'error',
      duration: 8000, // Errors stay longer but still auto-dismiss
      ...options
    });
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'warning',
      duration: 6000, // Warnings stay a bit longer
      ...options
    });
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'info',
      duration: 5000,
      ...options
    });
  }, [showToast]);

  // Report-specific convenience methods
  const showReportStarted = useCallback((reportTitle: string, _jobId: string): string => {
    return showInfo(
      'Report Generation Started',
      `"${reportTitle}" is being generated. You'll be notified when it's ready.`,
      { duration: 3000 }
    );
  }, [showInfo]);

  const showReportCompleted = useCallback((reportTitle: string, downloadAction?: () => void): string => {
    return showSuccess(
      'Report Ready!',
      `"${reportTitle}" has been generated successfully.`,
      {
        duration: 10000,
        action: downloadAction ? {
          label: 'Download',
          onClick: downloadAction
        } : undefined
      }
    );
  }, [showSuccess]);

  const showReportFailed = useCallback((reportTitle: string, error: string, retryAction?: () => void): string => {
    return showError(
      'Report Generation Failed',
      `Failed to generate "${reportTitle}": ${error}`,
      {
        persistent: true,
        action: retryAction ? {
          label: 'Retry',
          onClick: retryAction
        } : undefined
      }
    );
  }, [showError]);

  const showReportCancelled = useCallback((reportTitle: string): string => {
    return showWarning(
      'Report Generation Cancelled',
      `"${reportTitle}" generation was cancelled.`,
      { duration: 5000 }
    );
  }, [showWarning]);

  const contextValue: ToastContextType = {
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showReportStarted,
    showReportCompleted,
    showReportFailed,
    showReportCancelled
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
};

// Higher-order component for automatic toast integration
export const withToastNotifications = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  return (props: P) => (
    <ToastProvider>
      <Component {...props} />
    </ToastProvider>
  );
};

export default ToastProvider;
