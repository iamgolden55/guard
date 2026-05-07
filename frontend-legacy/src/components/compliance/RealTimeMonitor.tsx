// Real-Time Monitor Component
// Live compliance monitoring interface for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  CardHeader,
  Button,
  Spinner,
  Text,
  Title2,
  Title3,
  Badge,
  Select,
  Switch,
  Field,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  SearchBox,
  Body1,
  Caption1,
  Tooltip,
  ProgressBar
} from '@fluentui/react-components';
import {
  Play24Regular,
  Pause24Regular,
  Speaker224Regular,
  SpeakerMute24Regular,
  Warning24Regular,
  ErrorCircle24Regular,
  CheckmarkCircle24Regular,
  Info24Regular,
  Eye24Regular,
  Filter24Regular,
  Settings24Regular,
  Maximize24Regular,
  LocationLive24Regular
} from '@fluentui/react-icons';

import {
  useComplianceRealTimeUpdates,
  useComplianceViolationDetail
} from '../../hooks/useComplianceData';
import { ComplianceStatusBadge, LiveStatusIndicator } from '../shared/ComplianceStatusBadge';
import type {
  ComplianceViolation,
  ComplianceVenue,
  RealTimeMonitorProps,
  ViolationSeverity
} from '../../types/compliance';
import { complianceColors } from '../../types/compliance';

interface VenueStatusDisplay {
  venue: ComplianceVenue;
  status: 'compliant' | 'warning' | 'violation' | 'critical';
  lastUpdate: string;
  activeViolations: number;
  criticalViolations: number;
  staffCount: number;
  isOnline: boolean;
}

interface AlertSettings {
  soundEnabled: boolean;
  criticalOnly: boolean;
  volume: number;
  autoAcknowledge: boolean;
  acknowledgmentTimeout: number;
}

export const RealTimeMonitor: React.FC<RealTimeMonitorProps> = ({
  venueIds,
  autoRefresh = true,
  soundAlerts = true,
  fullscreen = false
}) => {
  const [isMonitoring, setIsMonitoring] = useState(autoRefresh);
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);
  const [showViolationDetails, setShowViolationDetails] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    soundEnabled: soundAlerts,
    criticalOnly: false,
    volume: 0.7,
    autoAcknowledge: false,
    acknowledgmentTimeout: 30
  });
  const [acknowledgedViolations, setAcknowledgedViolations] = useState<Set<number>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<ViolationSeverity | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Refs for sound and animation
  const audioRef = useRef<HTMLAudioElement>(null);
  const alertTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // API Hooks
  // Mock venues data - replace with actual API call when available
  const venuesData = [
    { id: 1, name: 'Main Office', status: 'active', violation_count: 2 },
    { id: 2, name: 'Security HQ', status: 'active', violation_count: 0 },
    { id: 3, name: 'Training Center', status: 'monitoring', violation_count: 1 }
  ];
  const venuesLoading = false;

  const {
    connectionStatus,
    isConnected,
    latestViolations,
    statusUpdates,
    reconnect
  } = useComplianceRealTimeUpdates({
    onViolationReceived: handleNewViolation,
    onStatusUpdate: handleStatusUpdate
  });

  // Map statusUpdates to venueStatuses for compatibility
  const venueStatuses = statusUpdates;
  const messageHistory: any[] = []; // Mock message history

  const {
    data: violationDetailsResponse,
    isLoading: detailsLoading
  } = useComplianceViolationDetail(selectedViolation?.id);

  const violationDetails = violationDetailsResponse?.data;

  // Handle new violations with sound alerts
  function handleNewViolation(violation: ComplianceViolation) {
    console.log('New violation received:', violation);

    // Play sound alert if enabled and meets criteria
    if (alertSettings.soundEnabled) {
      const shouldPlaySound = !alertSettings.criticalOnly ||
        ['critical', 'major'].includes(violation.severity);

      if (shouldPlaySound && audioRef.current) {
        audioRef.current.volume = alertSettings.volume;
        audioRef.current.play().catch(e => console.warn('Could not play alert sound:', e));
      }
    }

    // Auto-acknowledge if enabled
    if (alertSettings.autoAcknowledge) {
      const timeoutId = setTimeout(() => {
        setAcknowledgedViolations(prev => new Set(prev).add(violation.id));
        alertTimeoutsRef.current.delete(violation.id);
      }, alertSettings.acknowledgmentTimeout * 1000);

      alertTimeoutsRef.current.set(violation.id, timeoutId);
    }

    // Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${violation.severity.toUpperCase()} Violation`, {
        body: `${violation.user_data.full_name}: ${violation.description}`,
        icon: '/favicon.ico',
        tag: `violation-${violation.id}`
      });
    }
  }

  function handleStatusUpdate(update: any) {
    console.log('Status update received:', update);
  }

  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    setIsMonitoring(prev => !prev);
  }, []);

  // Toggle sound settings
  const toggleSound = useCallback(() => {
    setAlertSettings(prev => ({
      ...prev,
      soundEnabled: !prev.soundEnabled
    }));
  }, []);

  // Acknowledge violation
  const acknowledgeViolation = useCallback((violationId: number) => {
    setAcknowledgedViolations(prev => new Set(prev).add(violationId));

    // Clear auto-acknowledge timeout if exists
    const timeoutId = alertTimeoutsRef.current.get(violationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      alertTimeoutsRef.current.delete(violationId);
    }
  }, []);

  // View violation details
  const viewViolationDetails = useCallback((violation: ComplianceViolation) => {
    setSelectedViolation(violation);
    setShowViolationDetails(true);
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Prepare venue status data
  const venueStatusData = useMemo((): VenueStatusDisplay[] => {
    if (!venuesData?.results || !venueStatuses) return [];

    return venuesData.results
      .filter(venue => !venueIds || venueIds.includes(venue.id))
      .filter(venue => venue.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(venue => {
        const status = venueStatuses[venue.id];
        const violations = latestViolations.filter(v => v.venue === venue.id);
        const criticalViolations = violations.filter(v => v.severity === 'critical').length;
        const allViolations = violations.length;

        // Determine overall status
        let overallStatus: VenueStatusDisplay['status'] = 'compliant';
        if (criticalViolations > 0) overallStatus = 'critical';
        else if (violations.some(v => v.severity === 'major')) overallStatus = 'violation';
        else if (violations.some(v => ['minor', 'warning'].includes(v.severity))) overallStatus = 'warning';

        return {
          venue,
          status: overallStatus,
          lastUpdate: status?.lastUpdate || new Date().toISOString(),
          activeViolations: allViolations,
          criticalViolations,
          staffCount: status?.staffCount || 0,
          isOnline: status?.isOnline ?? false
        };
      })
      .sort((a, b) => {
        // Sort by severity first, then by venue name
        const severityOrder = { critical: 0, violation: 1, warning: 2, compliant: 3 };
        const severityDiff = severityOrder[a.status] - severityOrder[b.status];
        if (severityDiff !== 0) return severityDiff;
        return a.venue.name.localeCompare(b.venue.name);
      });
  }, [venuesData, venueStatuses, venueIds, latestViolations, searchTerm]);

  // Filter violations for display
  const filteredViolations = useMemo(() => {
    let filtered = latestViolations;

    if (filterSeverity !== 'all') {
      filtered = filtered.filter(v => v.severity === filterSeverity);
    }

    return filtered
      .slice(0, 20) // Show latest 20 violations
      .sort((a, b) => {
        // Show unacknowledged first, then by severity, then by time
        const aAcked = acknowledgedViolations.has(a.id);
        const bAcked = acknowledgedViolations.has(b.id);

        if (aAcked !== bAcked) return aAcked ? 1 : -1;

        const severityOrder = { critical: 0, major: 1, minor: 2, warning: 3, info: 4 };
        const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] -
                            severityOrder[b.severity as keyof typeof severityOrder];
        if (severityDiff !== 0) return severityDiff;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [latestViolations, filterSeverity, acknowledgedViolations]);

  // Connection status indicator
  const connectionStatusColor = useMemo(() => {
    switch (connectionStatus) {
      case 'connected': return 'compliant';
      case 'connecting': return 'warning';
      case 'disconnected': return 'violation';
      default: return 'warning';
    }
  }, [connectionStatus]);

  // MessageBar intent mapping
  const messageBarIntent = useMemo(() => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'disconnected': return 'error';
      default: return 'info';
    }
  }, [connectionStatus]);

  // Get severity icon
  const getSeverityIcon = (severity: ViolationSeverity) => {
    switch (severity) {
      case 'critical': return <ErrorCircle24Regular className="text-red-600" />;
      case 'major': return <Warning24Regular className="text-orange-600" />;
      case 'minor': return <Info24Regular className="text-yellow-600" />;
      case 'warning': return <Warning24Regular className="text-yellow-500" />;
      case 'info': return <Info24Regular className="text-blue-600" />;
      default: return <CheckmarkCircle24Regular className="text-gray-600" />;
    }
  };

  return (
    <div className={`space-y-6 ${fullscreen ? 'h-screen p-6' : 'p-6'}`}>
      {/* Hidden audio element for alerts */}
      <audio
        ref={audioRef}
        preload="auto"
        style={{ display: 'none' }}
      >
        <source src="/sounds/alert.mp3" type="audio/mpeg" />
        <source src="/sounds/alert.wav" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LocationLive24Regular className="text-blue-600" />
          <Title2>Real-Time Compliance Monitor</Title2>
          <LiveStatusIndicator
            status={connectionStatusColor}
            isConnected={isConnected}
            lastUpdate={new Date().toISOString()}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <SearchBox
            placeholder="Search venues..."
            value={searchTerm}
            onChange={(_, data) => setSearchTerm(data.value)}
            className="w-48"
          />

          {/* Severity Filter */}
          <Select
            value={filterSeverity}
            onChange={(_, data) => setFilterSeverity(data.value as ViolationSeverity | 'all')}
            className="w-32"
          >
            <option value="all">All Levels</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </Select>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Tooltip content={alertSettings.soundEnabled ? "Mute alerts" : "Enable sound alerts"} relationship="label">
              <Button
                appearance="outline"
                icon={alertSettings.soundEnabled ? <Speaker224Regular /> : <SpeakerMute24Regular />}
                onClick={toggleSound}
              />
            </Tooltip>

            <Tooltip content="Request notification permission" relationship="label">
              <Button
                appearance="outline"
                icon={<Info24Regular />}
                onClick={requestNotificationPermission}
                disabled={!('Notification' in window) || Notification.permission === 'granted'}
              />
            </Tooltip>

            <Button
              appearance={isMonitoring ? "primary" : "outline"}
              icon={isMonitoring ? <Pause24Regular /> : <Play24Regular />}
              onClick={toggleMonitoring}
            >
              {isMonitoring ? 'Pause' : 'Start'} Monitor
            </Button>
          </div>
        </div>
      </div>

      {/* Connection Status Bar */}
      <MessageBar intent={messageBarIntent as any}>
        <MessageBarBody>
          <div className="flex items-center justify-between w-full">
            <span>
              WebSocket: {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              {messageHistory.length > 0 && (
                <> • {messageHistory.length} messages received</>
              )}
            </span>
            {isConnected && (
              <span className="text-sm">
                {venueStatusData.length} venues • {filteredViolations.length} active alerts
              </span>
            )}
          </div>
        </MessageBarBody>
      </MessageBar>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Venue Status Grid */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <Title3>Venue Status Overview</Title3>
            <Caption1 className="text-gray-600">
              {venueStatusData.filter(v => v.status !== 'compliant').length} venues need attention
            </Caption1>
          </div>

          {venuesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="large" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {venueStatusData.map(({ venue, status, lastUpdate, activeViolations, criticalViolations, staffCount, isOnline }) => (
                <Card
                  key={venue.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    status === 'critical' ? 'border-red-200 bg-red-50' :
                    status === 'violation' ? 'border-orange-200 bg-orange-50' :
                    status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                    'border-green-200 bg-green-50'
                  }`}
                  onClick={() => console.log('Navigate to venue details:', venue.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between w-full">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Text className="font-medium">{venue.name}</Text>
                          <Badge
                            appearance="outline"
                            color={isOnline ? 'success' : 'danger'}
                            size="small"
                          >
                            {isOnline ? 'Online' : 'Offline'}
                          </Badge>
                        </div>

                        <Caption1 className="text-gray-600 mb-2">
                          {venue.address}
                        </Caption1>

                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Text>Staff:</Text>
                            <Badge size="small">{staffCount}</Badge>
                          </span>

                          {activeViolations > 0 && (
                            <span className="flex items-center gap-1">
                              <Text>Violations:</Text>
                              <Badge
                                color={criticalViolations > 0 ? 'danger' : 'warning'}
                                size="small"
                              >
                                {activeViolations}
                              </Badge>
                            </span>
                          )}
                        </div>
                      </div>

                      <ComplianceStatusBadge status={status} size="small" />
                    </div>
                  </CardHeader>

                  {activeViolations > 0 && (
                    <div className="px-4 pb-4">
                      <ProgressBar
                        value={Math.min(activeViolations / 10, 1)} // Scale to 10 max violations
                        color={status === 'critical' ? 'error' : status === 'violation' ? 'warning' : 'brand'}
                        thickness="medium"
                      />
                      <Caption1 className="text-gray-600 mt-1">
                        Last update: {new Date(lastUpdate).toLocaleTimeString()}
                      </Caption1>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Live Violations Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Title3>Live Violations Feed</Title3>
            <Badge appearance="outline">
              {filteredViolations.filter(v => !acknowledgedViolations.has(v.id)).length} unacknowledged
            </Badge>
          </div>

          <Card className="h-96 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {filteredViolations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <CheckmarkCircle24Regular className="text-green-600 text-4xl mb-2" />
                  <Text>No active violations</Text>
                  <Caption1 className="text-gray-600">All venues are compliant</Caption1>
                </div>
              ) : (
                filteredViolations.map(violation => {
                  const isAcknowledged = acknowledgedViolations.has(violation.id);

                  return (
                    <div
                      key={violation.id}
                      className={`p-3 rounded-lg border transition-all ${
                        isAcknowledged
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white border-gray-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(violation.severity)}
                          <ComplianceStatusBadge status={violation.severity} size="small" />
                        </div>

                        <div className="flex items-center gap-1">
                          <Tooltip content="View details" relationship="label">
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={<Eye24Regular />}
                              onClick={() => viewViolationDetails(violation)}
                            />
                          </Tooltip>

                          {!isAcknowledged && (
                            <Button
                              appearance="primary"
                              size="small"
                              onClick={() => acknowledgeViolation(violation.id)}
                            >
                              ACK
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Body1 className="font-medium">{violation.user_data.full_name}</Body1>
                        <Caption1 className="text-gray-600">{violation.description}</Caption1>
                        <Caption1 className="text-gray-500">
                          {new Date(violation.created_at).toLocaleString()}
                        </Caption1>
                      </div>

                      {!isAcknowledged && (
                        <div className="mt-2 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded animate-pulse" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Violation Details Dialog */}
      <Dialog
        open={showViolationDetails}
        onOpenChange={(_, data) => setShowViolationDetails(data.open)}
      >
        <DialogSurface className="max-w-2xl">
          <DialogBody>
            <DialogTitle>Violation Details</DialogTitle>
            <DialogContent className="space-y-4">
              {selectedViolation && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Title3>{selectedViolation.user_data.full_name}</Title3>
                      <Caption1>{selectedViolation.user_data.email}</Caption1>
                    </div>
                    <ComplianceStatusBadge status={selectedViolation.severity} />
                  </div>

                  <Divider />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Text className="font-medium">Violation Type</Text>
                      <Text>{selectedViolation.violation_type_display}</Text>
                    </div>
                    <div>
                      <Text className="font-medium">Created</Text>
                      <Text>{new Date(selectedViolation.created_at).toLocaleString()}</Text>
                    </div>
                    <div>
                      <Text className="font-medium">Status</Text>
                      <Text>{selectedViolation.status_display}</Text>
                    </div>
                    <div>
                      <Text className="font-medium">Venue</Text>
                      <Text>{selectedViolation.venue_name}</Text>
                    </div>
                  </div>

                  <div>
                    <Text className="font-medium">Description</Text>
                    <Text>{selectedViolation.description}</Text>
                  </div>

                  {violationDetails && violationDetails.data && (
                    <div>
                      <Text className="font-medium">Additional Details</Text>
                      <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(violationDetails.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {detailsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size="small" />
                      <Text className="ml-2">Loading details...</Text>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>

            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setShowViolationDetails(false)}
              >
                Close
              </Button>
              {selectedViolation && !acknowledgedViolations.has(selectedViolation.id) && (
                <Button
                  appearance="primary"
                  onClick={() => {
                    acknowledgeViolation(selectedViolation.id);
                    setShowViolationDetails(false);
                  }}
                >
                  Acknowledge
                </Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default RealTimeMonitor;