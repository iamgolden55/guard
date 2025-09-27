import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Card,
  Button,
  Text,
  Title2,
  MessageBar
} from '@fluentui/react-components';
// Simplified ErrorBoundary without specific icons to avoid import issues

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call the error callback if provided
    this.props.onError?.(error, errorInfo);

    // Log to external error reporting service
    this.logErrorToService(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    const prevResetKeys = prevProps.resetKeys;

    // Reset error boundary if reset keys have changed
    if (
      this.state.hasError &&
      prevResetKeys &&
      resetKeys &&
      this.hasResetKeysChanged(prevResetKeys, resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }
  }

  private hasResetKeysChanged(
    prevResetKeys: Array<string | number>,
    resetKeys: Array<string | number>
  ): boolean {
    return (
      prevResetKeys.length !== resetKeys.length ||
      prevResetKeys.some((key, index) => key !== resetKeys[index])
    );
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();

    // Optional: Reload the page after a short delay
    // this.resetTimeoutId = window.setTimeout(() => {
    //   window.location.reload();
    // }, 100);
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Log to external error reporting service (e.g., Sentry, LogRocket, etc.)
    // This would typically be configured in a real application

    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.group('🚨 Error Report');
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Full Report:', errorReport);
    console.groupEnd();

    // Example: Send to error reporting service
    // errorReportingService.report(errorReport);
  }

  private formatStackTrace(stack?: string): string {
    if (!stack) return '';

    return stack
      .split('\n')
      .slice(0, 10) // Limit to first 10 lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Card style={{ maxWidth: '600px', width: '100%' }}>
            <div style={{ padding: '16px' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                textAlign: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontSize: '32px',
                    color: '#d83b01'
                  }}>
                    ⚠️
                  </div>
                  <Title2>Something went wrong</Title2>
                </div>

                <Text>
                  An unexpected error occurred while rendering this component.
                  Don't worry, your data is safe and this has been reported to our team.
                </Text>

                <MessageBar intent="error">
                  <strong>Error:</strong> {this.state.error?.message || 'Unknown error occurred'}
                </MessageBar>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center',
                  marginTop: '16px'
                }}>
                  <Button
                    appearance="primary"
                    onClick={this.handleRetry}
                  >
                    🔄 Try Again
                  </Button>

                  <Button
                    appearance="secondary"
                    onClick={this.toggleDetails}
                  >
                    {this.state.showDetails ? '🔺 Hide Details' : '🔻 Show Details'}
                  </Button>
                </div>

                {this.state.showDetails && (
                  <div style={{
                    marginTop: '20px',
                    textAlign: 'left',
                    backgroundColor: '#f8f9fa',
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid #e1e4e8'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <span style={{ fontSize: '16px' }}>🐛</span>
                      <Text weight="semibold">Technical Details</Text>
                    </div>

                    {this.state.error && (
                      <div style={{ marginBottom: '16px' }}>
                        <Text size="small" weight="semibold" style={{ display: 'block', marginBottom: '4px' }}>
                          Error Message:
                        </Text>
                        <Text size="small" style={{
                          fontFamily: 'monospace',
                          backgroundColor: '#ffffff',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          display: 'block'
                        }}>
                          {this.state.error.message}
                        </Text>
                      </div>
                    )}

                    {this.state.error?.stack && (
                      <div style={{ marginBottom: '16px' }}>
                        <Text size="small" weight="semibold" style={{ display: 'block', marginBottom: '4px' }}>
                          Stack Trace:
                        </Text>
                        <Text size="small" style={{
                          fontFamily: 'monospace',
                          backgroundColor: '#ffffff',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          display: 'block',
                          whiteSpace: 'pre-wrap',
                          overflow: 'auto',
                          maxHeight: '200px'
                        }}>
                          {this.formatStackTrace(this.state.error.stack)}
                        </Text>
                      </div>
                    )}

                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <Text size="small" weight="semibold" style={{ display: 'block', marginBottom: '4px' }}>
                          Component Stack:
                        </Text>
                        <Text size="small" style={{
                          fontFamily: 'monospace',
                          backgroundColor: '#ffffff',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          display: 'block',
                          whiteSpace: 'pre-wrap',
                          overflow: 'auto',
                          maxHeight: '150px'
                        }}>
                          {this.state.errorInfo.componentStack}
                        </Text>
                      </div>
                    )}

                    <div style={{
                      marginTop: '12px',
                      padding: '8px',
                      backgroundColor: '#fff3cd',
                      borderRadius: '4px',
                      border: '1px solid #ffeaa7'
                    }}>
                      <Text size="small" style={{ color: '#856404' }}>
                        💡 If this error persists, please contact support with these technical details.
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Hook for manual error reporting
export const useErrorHandler = () => {
  return (error: Error, context?: string) => {
    console.error(`Manual error report${context ? ` (${context})` : ''}:`, error);

    // Log to error reporting service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Example: Send to error reporting service
    // errorReportingService.report(errorReport);
  };
};

export default ErrorBoundary;