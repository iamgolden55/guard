import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  Toast,
  ToastTitle,
  ToastBody,
  Toaster,
  useToastController,
  ToastIntent
} from '@fluentui/react-components';
import {
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  InfoRegular,
  WarningRegular,
  DismissRegular
} from '@fluentui/react-icons';

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
  position = 'top-right',
  defaultDuration = 5000
}) => {
  const { dispatchToast } = useToastController();
  const [activeToasts, setActiveToasts] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const getToastIntent = (type: ToastNotification['type']): ToastIntent => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  };

  const getIcon = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success':
        return <CheckmarkCircleRegular />;
      case 'error':
        return <ErrorCircleRegular />;
      case 'warning':
        return <WarningRegular />;
      case 'info':
      default:
        return <InfoRegular />;
    }
  };

  const hideToast = useCallback((id: string) => {
    const timeoutId = activeToasts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setActiveToasts(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    }
  }, [activeToasts]);

  const showToast = useCallback((notification: Omit<ToastNotification, 'id'>): string => {
    const id = generateId();
    const duration = notification.duration ?? defaultDuration;

    dispatchToast(
      <Toast>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          {getIcon(notification.type)}
          <div style={{ flex: 1 }}>
            <ToastTitle>{notification.title}</ToastTitle>
            {notification.message && (
              <ToastBody>{notification.message}</ToastBody>
            )}
          </div>
          {notification.action && (
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--colorBrandBackground)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                textDecoration: 'underline'
              }}
              onClick={notification.action.onClick}
            >
              {notification.action.label}
            </button>
          )}
        </div>
      </Toast>,
      {
        intent: getToastIntent(notification.type),
        timeout: notification.persistent ? -1 : duration,
        toastId: id
      }
    );

    // Track timeout for manual dismissal
    if (!notification.persistent && duration > 0) {
      const timeoutId = setTimeout(() => {
        hideToast(id);
      }, duration);

      setActiveToasts(prev => new Map(prev.set(id, timeoutId)));
    }

    return id;
  }, [dispatchToast, generateId, hideToast, defaultDuration]);

  const showSuccess = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'success',
      ...options
    });
  }, [showToast]);

  const showError = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'error',
      persistent: true, // Errors should be persistent by default
      ...options
    });
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'warning',
      duration: 7000, // Warnings should stay longer
      ...options
    });
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, options?: Partial<ToastNotification>): string => {
    return showToast({
      title,
      message,
      type: 'info',
      ...options
    });
  }, [showToast]);

  // Report-specific convenience methods
  const showReportStarted = useCallback((reportTitle: string, jobId: string): string => {
    return showInfo(
      'Report Generation Started',
      `"${reportTitle}" is being generated. You'll be notified when it's ready.`,
      {
        duration: 3000
      }
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
      {
        duration: 5000
      }
    );
  }, [showWarning]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      activeToasts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, [activeToasts]);

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
      <Toaster />
      {children}
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