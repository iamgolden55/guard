import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Button,
  ProgressBar,
  Badge,
  MessageBar,
  Spinner
} from '@fluentui/react-components';
import {
  DismissRegular,
  PlayRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  ClockRegular
} from '@fluentui/react-icons';
import { useJobProgress } from '../../hooks/useJobProgress';
import { ReportJobStatus } from '../../types/reports';
import reportService from '../../services/reportService';

interface AsyncProgressTrackerProps {
  jobId: string;
  title?: string;
  compact?: boolean;
  showCancel?: boolean;
  showRetry?: boolean;
  autoStart?: boolean;
  onComplete?: (jobId: string) => void;
  onError?: (jobId: string, error: string) => void;
  onCancel?: (jobId: string) => void;
}

const AsyncProgressTracker: React.FC<AsyncProgressTrackerProps> = ({
  jobId,
  title,
  compact = false,
  showCancel = true,
  showRetry = true,
  autoStart = true,
  onComplete,
  onError,
  onCancel
}) => {
  const [canceling, setCanceling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const {
    progress,
    isPolling,
    isWebSocketConnected,
    error,
    startPolling,
    stopPolling,
    cancelJob,
    retryJob
  } = useJobProgress(jobId, {
    autoStart,
    enableWebSocket: true,
    onComplete: (job) => {
      console.log('Job completed via WebSocket/polling:', job);
      onComplete?.(jobId);
    },
    onError: (errorMessage) => {
      console.error('Job error via WebSocket/polling:', errorMessage);
      onError?.(jobId, errorMessage);
    },
    onCancel: () => {
      console.log('Job cancelled via WebSocket/polling');
      onCancel?.(jobId);
    }
  });

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await cancelJob();
      stopPolling();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    } finally {
      setCanceling(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryJob();
    } catch (err) {
      console.error('Failed to retry job:', err);
    } finally {
      setRetrying(false);
    }
  };

  const getStatusIcon = () => {
    if (!progress) return <Spinner size="tiny" />;

    switch (progress.status) {
      case ReportJobStatus.COMPLETED:
        return <CheckmarkCircleRegular style={{ color: '#107c10' }} />;
      case ReportJobStatus.PROCESSING:
        return <Spinner size="tiny" />;
      case ReportJobStatus.PENDING:
        return <ClockRegular style={{ color: '#797775' }} />;
      case ReportJobStatus.FAILED:
        return <ErrorCircleRegular style={{ color: '#d83b01' }} />;
      case ReportJobStatus.CANCELLED:
        return <DismissRegular style={{ color: '#ca5010' }} />;
      default:
        return <Spinner size="tiny" />;
    }
  };

  const getStatusColor = () => {
    if (!progress) return 'neutral';

    switch (progress.status) {
      case ReportJobStatus.COMPLETED:
        return 'success';
      case ReportJobStatus.PROCESSING:
      case ReportJobStatus.RETRYING:
        return 'important';
      case ReportJobStatus.PENDING:
        return 'neutral';
      case ReportJobStatus.FAILED:
        return 'danger';
      case ReportJobStatus.CANCELLED:
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const formatProgress = (value: number) => {
    return Math.min(Math.max(value, 0), 100);
  };

  const renderProgressDetails = () => {
    if (!progress || compact) return null;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px'
      }}>
        {progress.eta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>📅</span>
            <div>
              <Text size="small" style={{ display: 'block', fontWeight: 600 }}>ETA</Text>
              <Text size="small">{reportService.formatETA(progress.eta)}</Text>
            </div>
          </div>
        )}

        {progress.speed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>⚡</span>
            <div>
              <Text size="small" style={{ display: 'block', fontWeight: 600 }}>Speed</Text>
              <Text size="small">{reportService.formatProcessingSpeed(progress.speed)}</Text>
            </div>
          </div>
        )}

        {progress.processedRows !== undefined && progress.totalRows !== undefined && (
          <div>
            <Text size="small" style={{ display: 'block', fontWeight: 600 }}>Progress</Text>
            <Text size="small">{progress.processedRows.toLocaleString()} / {progress.totalRows.toLocaleString()} rows</Text>
          </div>
        )}

        {progress.currentOperation && (
          <div>
            <Text size="small" style={{ display: 'block', fontWeight: 600 }}>Operation</Text>
            <Text size="small">{progress.currentOperation}</Text>
          </div>
        )}
      </div>
    );
  };

  if (!progress) {
    return (
      <Card>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Spinner size="tiny" />
            <Text>Loading job progress...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        border: '1px solid #e1e1e1',
        borderRadius: '4px',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {getStatusIcon()}
          <div style={{ flex: 1 }}>
            {title && <Text size="small" weight="semibold">{title}</Text>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProgressBar
                value={formatProgress(progress.progress)}
                style={{ flex: 1 }}
                color={getStatusColor() as any}
              />
              <Text size="small">{Math.round(progress.progress)}%</Text>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {showCancel && [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(progress.status) && (
            <Button
              size="small"
              appearance="subtle"
              icon={<DismissRegular />}
              onClick={handleCancel}
              disabled={canceling}
            >
              {canceling ? 'Canceling...' : 'Cancel'}
            </Button>
          )}

          {showRetry && progress.status === ReportJobStatus.FAILED && (
            <Button
              size="small"
              appearance="subtle"
              icon={<PlayRegular />}
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {getStatusIcon()}
              <div>
                {title && <Text weight="semibold">{title}</Text>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge
                    appearance="outline"
                    color={getStatusColor() as any}
                  >
                    {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
                  </Badge>
                  {/* WebSocket Connection Indicator */}
                  <Badge
                    appearance="outline"
                    color={isWebSocketConnected ? "success" : isPolling ? "warning" : "neutral"}
                    style={{ fontSize: '10px' }}
                  >
                    {isWebSocketConnected ? "🟢 Real-time" : isPolling ? "🔄 Polling" : "⚫ Idle"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {showCancel && [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(progress.status) && (
                <Button
                  appearance="secondary"
                  icon={<DismissRegular />}
                  onClick={handleCancel}
                  disabled={canceling}
                >
                  {canceling ? 'Canceling...' : 'Cancel'}
                </Button>
              )}

              {showRetry && progress.status === ReportJobStatus.FAILED && (
                <Button
                  appearance="primary" style={{ backgroundColor: "#d13438", borderColor: "#d13438" }}
                  icon={<PlayRegular />}
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? 'Retrying...' : 'Retry'}
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {[ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(progress.status) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <Text size="small">Progress: {Math.round(progress.progress)}%</Text>
                {progress.eta && (
                  <Text size="small">ETA: {reportService.formatETA(progress.eta)}</Text>
                )}
              </div>
              <ProgressBar
                value={formatProgress(progress.progress)}
                color={getStatusColor() as any}
              />
            </div>
          )}

          {/* Error Message */}
          {progress.status === ReportJobStatus.FAILED && error && (
            <MessageBar intent="error">
              <strong>Error:</strong> {error}
            </MessageBar>
          )}

          {/* Progress Details */}
          {renderProgressDetails()}

          {/* Status Messages */}
          {progress.status === ReportJobStatus.COMPLETED && (
            <MessageBar intent="success">
              Report generated successfully!
            </MessageBar>
          )}

          {progress.status === ReportJobStatus.CANCELLED && (
            <MessageBar intent="warning">
              Report generation was cancelled.
            </MessageBar>
          )}
        </div>
      </div>
    </Card>
  );
};

export default AsyncProgressTracker;