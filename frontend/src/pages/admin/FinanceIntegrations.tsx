import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Stack,
  Text,
  Pivot,
  PivotItem,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  PrimaryButton,
  DefaultButton,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  Link,
  Dialog,
  DialogType,
  DialogFooter,
  Icon,
  Dropdown,
  type IDropdownOption,
  TextField,
  Toggle,
  Label,
  Separator
} from '@fluentui/react';
import { Card, AccountMappingInterface } from '../../components';
import { financeIntegrationsService } from '../../services';
import type {
  ProviderConnection,
  AccountingProvider,
  InvoiceExport,
  PayrollExport,
  SyncLog,
  TestConnectionResponse
} from '../../services/financeIntegrationsService';

const FinanceIntegrations: React.FC = () => {
  const location = useLocation();
  
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [providers, setProviders] = useState<AccountingProvider[]>([]);
  const [invoiceExports, setInvoiceExports] = useState<InvoiceExport[]>([]);
  const [payrollExports, setPayrollExports] = useState<PayrollExport[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);
  const [connectionStatuses, setConnectionStatuses] = useState<{[key: number]: 'testing' | 'refreshing' | 'deleting'}>({});
  
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isSandboxMode, setIsSandboxMode] = useState(true);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Handle navigation state messages
  useEffect(() => {
    if (location.state?.message) {
      if (location.state?.type === 'success') {
        setSuccess(location.state.message);
        // Clear the message after showing
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(location.state.message);
        setTimeout(() => setError(null), 5000);
      }
      
      // Clear the navigation state
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Auto-refresh connections every 30 seconds when there are connections
  useEffect(() => {
    if (connections.length === 0) return;

    const refreshInterval = setInterval(async () => {
      try {
        // Only refresh if no operations are in progress
        if (Object.keys(connectionStatuses).length === 0) {
          const connectionsData = await financeIntegrationsService.getConnections();
          setConnections(connectionsData);
        }
      } catch (error) {
        console.warn('Background connection refresh failed:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [connections.length, connectionStatuses]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setAuthError(false);
      
      // Load providers first - this should always work
      try {
        const providersData = await financeIntegrationsService.getProviders();
        setProviders(providersData);
        console.log('Loaded providers:', providersData.length);
      } catch (providerError: any) {
        console.error('Failed to load providers:', providerError);
        if (providerError.response?.status === 401 || providerError.response?.status === 403) {
          setAuthError(true);
          setError('Authentication required. Please log in to access finance integrations.');
        } else {
          setError('Failed to load accounting providers. Please check your connection.');
        }
        return; // Don't proceed if we can't load providers
      }
      
      // Load other data - handle each independently
      const loadPromises = [
        financeIntegrationsService.getConnections().catch(err => {
          console.warn('Failed to load connections:', err);
          return [];
        }),
        financeIntegrationsService.getInvoiceExports().catch(err => {
          console.warn('Failed to load invoice exports:', err);
          return [];
        }),
        financeIntegrationsService.getPayrollExports().catch(err => {
          console.warn('Failed to load payroll exports:', err);
          return [];
        }),
        financeIntegrationsService.getSyncLogs({ level: 'error' }).catch(err => {
          console.warn('Failed to load sync logs:', err);
          return [];
        })
      ];
      
      const [connectionsData, exportsData, payrollData, logsData] = await Promise.all(loadPromises);
      
      setConnections(connectionsData);
      setInvoiceExports(exportsData);
      setPayrollExports(payrollData);
      setSyncLogs(logsData);
      
      console.log('Finance integrations data loaded:', {
        providers: providers.length,
        connections: connectionsData.length,
        exports: exportsData.length,
        payroll: payrollData.length,
        logs: logsData.length
      });
      
    } catch (error: any) {
      console.error('Unexpected error loading finance integrations:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setAuthError(true);
        setError('Authentication required. Please log in to access finance integrations.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupConnection = () => {
    setSelectedProvider('');
    setIsSandboxMode(true);
    setShowSetupDialog(true);
  };

  const handleProviderSelection = async () => {
    if (!selectedProvider) return;

    try {
      setIsProcessing(true);
      setError(null);

      const redirectUri = financeIntegrationsService.generateOAuthRedirectUri();
      
      const oauthResponse = await financeIntegrationsService.initiateOAuth({
        provider_key: selectedProvider,
        redirect_uri: redirectUri,
        is_sandbox: isSandboxMode
      });

      // Store OAuth state for callback
      sessionStorage.setItem('finance_oauth_state', oauthResponse.state);
      sessionStorage.setItem('finance_oauth_provider', selectedProvider);
      sessionStorage.setItem('finance_oauth_sandbox', isSandboxMode.toString());
      sessionStorage.setItem('finance_oauth_redirect', redirectUri);

      // Redirect to provider OAuth
      window.location.href = oauthResponse.oauth_url;

    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setError('Failed to start connection setup. Please try again.');
    } finally {
      setIsProcessing(false);
      setShowSetupDialog(false);
    }
  };

  const handleTestConnection = async (connection: ProviderConnection) => {
    try {
      // Set loading state for this specific connection
      setConnectionStatuses(prev => ({...prev, [connection.id]: 'testing'}));
      setError(null);
      
      const result = await financeIntegrationsService.testConnection(connection.id);
      
      if (result.success) {
        setSuccess(`Connection to ${connection.provider_name} is working correctly.`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(`Connection test failed: ${result.error_message}`);
      }
      
      // Refresh connections to update status
      const connectionsData = await financeIntegrationsService.getConnections();
      setConnections(connectionsData);
      
    } catch (error) {
      console.error('Connection test failed:', error);
      setError('Connection test failed. Please try again.');
    } finally {
      // Clear loading state for this connection
      setConnectionStatuses(prev => {
        const newStatuses = {...prev};
        delete newStatuses[connection.id];
        return newStatuses;
      });
    }
  };

  const handleRefreshToken = async (connection: ProviderConnection) => {
    try {
      setConnectionStatuses(prev => ({...prev, [connection.id]: 'refreshing'}));
      setError(null);
      
      await financeIntegrationsService.refreshToken(connection.id);
      setSuccess(`Token refreshed for ${connection.provider_name}.`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh connections
      const connectionsData = await financeIntegrationsService.getConnections();
      setConnections(connectionsData);
      
    } catch (error) {
      console.error('Token refresh failed:', error);
      setError('Token refresh failed. Please try again.');
    } finally {
      setConnectionStatuses(prev => {
        const newStatuses = {...prev};
        delete newStatuses[connection.id];
        return newStatuses;
      });
    }
  };

  const handleDeleteConnection = async (connection: ProviderConnection) => {
    if (!window.confirm(`Are you sure you want to delete the connection to ${connection.provider_name}?`)) {
      return;
    }

    try {
      setConnectionStatuses(prev => ({...prev, [connection.id]: 'deleting'}));
      setError(null);
      
      await financeIntegrationsService.deleteConnection(connection.id);
      setSuccess(`Connection to ${connection.provider_name} deleted.`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh connections
      const connectionsData = await financeIntegrationsService.getConnections();
      setConnections(connectionsData);
      
    } catch (error) {
      console.error('Delete connection failed:', error);
      setError('Failed to delete connection. Please try again.');
    } finally {
      setConnectionStatuses(prev => {
        const newStatuses = {...prev};
        delete newStatuses[connection.id];
        return newStatuses;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Icon iconName="CheckMark" style={{ color: 'green' }} />;
      case 'expired':
      case 'error':
        return <Icon iconName="Error" style={{ color: 'red' }} />;
      case 'pending':
        return <Icon iconName="Clock" style={{ color: 'orange' }} />;
      default:
        return <Icon iconName="Warning" style={{ color: 'gray' }} />;
    }
  };

  // Column definitions for connections table
  const connectionColumns: IColumn[] = [
    {
      key: 'provider',
      name: 'Provider',
      fieldName: 'provider_name',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: ProviderConnection) => (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <img 
            src={financeIntegrationsService.getProviderLogo(item.provider_key)} 
            alt={item.provider_name}
            style={{ width: 24, height: 24 }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <Text>{item.provider_name}</Text>
        </Stack>
      )
    },
    {
      key: 'company',
      name: 'Company',
      fieldName: 'company_name',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: ProviderConnection) => (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
          {getStatusIcon(item.status)}
          <Text>{item.status}</Text>
          {item.is_sandbox && <Text style={{ fontSize: '10px', color: 'orange' }}>(Sandbox)</Text>}
        </Stack>
      )
    },
    {
      key: 'lastSync',
      name: 'Last Sync',
      fieldName: 'last_sync_at',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: ProviderConnection) => (
        <Text>
          {item.last_sync_at ? new Date(item.last_sync_at).toLocaleDateString() : 'Never'}
        </Text>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: ProviderConnection) => {
        const connectionStatus = connectionStatuses[item.id];
        
        return (
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            {connectionStatus === 'testing' ? (
              <Stack horizontal tokens={{ childrenGap: 4 }} verticalAlign="center">
                <Spinner size={SpinnerSize.xSmall} />
                <Text variant="small">Testing...</Text>
              </Stack>
            ) : (
              <Link 
                onClick={() => handleTestConnection(item)}
                disabled={Object.keys(connectionStatuses).length > 0}
              >
                Test
              </Link>
            )}
            
            {item.status === 'expired' && (
              connectionStatus === 'refreshing' ? (
                <Stack horizontal tokens={{ childrenGap: 4 }} verticalAlign="center">
                  <Spinner size={SpinnerSize.xSmall} />
                  <Text variant="small">Refreshing...</Text>
                </Stack>
              ) : (
                <Link 
                  onClick={() => handleRefreshToken(item)}
                  disabled={Object.keys(connectionStatuses).length > 0}
                >
                  Refresh Token
                </Link>
              )
            )}
            
            {connectionStatus === 'deleting' ? (
              <Stack horizontal tokens={{ childrenGap: 4 }} verticalAlign="center">
                <Spinner size={SpinnerSize.xSmall} />
                <Text variant="small" style={{ color: 'red' }}>Deleting...</Text>
              </Stack>
            ) : (
              <Link 
                onClick={() => handleDeleteConnection(item)} 
                style={{ color: 'red' }}
                disabled={Object.keys(connectionStatuses).length > 0}
              >
                Delete
              </Link>
            )}
          </Stack>
        );
      }
    }
  ];

  // Export columns
  const exportColumns: IColumn[] = [
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 70,
      isResizable: true
    },
    {
      key: 'connection',
      name: 'Provider',
      fieldName: 'connection_name',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: InvoiceExport | PayrollExport) => (
        <Stack horizontal tokens={{ childrenGap: 4 }}>
          {getStatusIcon(item.status)}
          <Text>{item.status}</Text>
        </Stack>
      )
    },
    {
      key: 'exportedAt',
      name: 'Exported',
      fieldName: 'exported_at',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: InvoiceExport | PayrollExport) => (
        <Text>{new Date(item.exported_at).toLocaleDateString()}</Text>
      )
    },
    {
      key: 'exportedBy',
      name: 'Exported By',
      fieldName: 'exported_by_name',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true
    }
  ];

  // Provider options for dropdown
  const providerOptions: IDropdownOption[] = providers.map(provider => ({
    key: provider.provider_key,
    text: provider.display_name
  }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size={SpinnerSize.large} label="Loading finance integrations..." />
      </div>
    );
  }

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Text variant="xxLarge">Finance Integrations</Text>
        <PrimaryButton
          text="Setup New Connection"
          iconProps={{ iconName: 'Add' }}
          onClick={handleSetupConnection}
        />
      </Stack>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          dismissButtonAriaLabel="Close"
          onDismiss={() => setError(null)}
        >
          {error}
        </MessageBar>
      )}

      {success && (
        <MessageBar
          messageBarType={MessageBarType.success}
          isMultiline={false}
          dismissButtonAriaLabel="Close"
          onDismiss={() => setSuccess(null)}
        >
          {success}
        </MessageBar>
      )}

      <Pivot>
        <PivotItem headerText="Setup">
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Available Accounting Providers</Text>
              <Text className="text-gray-600">
                Connect to your accounting software to automatically sync invoices and payroll data.
              </Text>

              {authError ? (
                <MessageBar messageBarType={MessageBarType.warning}>
                  Please log in to view and set up accounting integrations.
                  <PrimaryButton
                    text="Go to Login"
                    iconProps={{ iconName: 'SignIn' }}
                    onClick={() => window.location.href = '/login'}
                    style={{ marginLeft: 16 }}
                  />
                </MessageBar>
              ) : isLoading ? (
                <div className="text-center py-8">
                  <Spinner size={SpinnerSize.large} label="Loading accounting providers..." />
                </div>
              ) : providers.length === 0 ? (
                <div className="text-center py-8">
                  <Icon iconName="Cloud" style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <Text variant="large">No providers available</Text>
                  <Text>Unable to load accounting providers. Please try refreshing the page.</Text>
                  <DefaultButton
                    text="Refresh"
                    iconProps={{ iconName: 'Refresh' }}
                    onClick={loadData}
                    style={{ marginTop: 16 }}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                  {providers.map((provider) => {
                    const existingConnection = connections.find(c => c.provider_key === provider.provider_key);
                    return (
                      <div
                        key={provider.id}
                        style={{
                          border: '1px solid #e1e1e1',
                          borderRadius: 8,
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          cursor: existingConnection ? 'default' : 'pointer',
                          backgroundColor: existingConnection ? '#f9f9f9' : 'white',
                          opacity: existingConnection ? 0.7 : 1
                        }}
                        onClick={!existingConnection ? () => {
                          setSelectedProvider(provider.provider_key);
                          setShowSetupDialog(true);
                        } : undefined}
                      >
                        <img 
                          src={financeIntegrationsService.getProviderLogo(provider.provider_key)} 
                          alt={provider.display_name}
                          style={{ width: 48, height: 48, marginBottom: 12 }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logos/default-accounting.svg';
                          }}
                        />
                        <Text variant="medium" style={{ fontWeight: 600, marginBottom: 8 }}>
                          {provider.display_name}
                        </Text>
                        
                        {existingConnection ? (
                          <Stack horizontal tokens={{ childrenGap: 4 }} verticalAlign="center">
                            {getStatusIcon(existingConnection.status)}
                            <Text variant="small" style={{ color: 'green' }}>
                              {existingConnection.status === 'connected' ? 'Connected' : existingConnection.status}
                            </Text>
                          </Stack>
                        ) : (
                          <PrimaryButton
                            text="Connect"
                            iconProps={{ iconName: 'PlugConnected' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProvider(provider.provider_key);
                              setShowSetupDialog(true);
                            }}
                            style={{ marginTop: 8 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Stack>
          </Card>
        </PivotItem>

        <PivotItem headerText="Connections">
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Accounting Provider Connections</Text>
              <Text className="text-gray-600">
                Manage your connections to accounting software. Connect to Xero, QuickBooks, and other providers
                to automatically sync invoices and payroll data.
              </Text>

              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Icon iconName="PlugDisconnected" style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <Text variant="large">No connections configured</Text>
                  <Text>Set up your first accounting integration to get started.</Text>
                  <PrimaryButton
                    text="Setup Connection"
                    iconProps={{ iconName: 'Add' }}
                    onClick={handleSetupConnection}
                    style={{ marginTop: 16 }}
                  />
                </div>
              ) : (
                <DetailsList
                  items={connections}
                  columns={connectionColumns}
                  layoutMode={DetailsListLayoutMode.justified}
                  selectionMode={SelectionMode.none}
                  isHeaderVisible={true}
                />
              )}
            </Stack>
          </Card>
        </PivotItem>

        <PivotItem headerText="Account Mappings">
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              {connections.length === 0 ? (
                <div className="text-center py-8">
                  <Icon iconName="AccountActivity" style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <Text variant="large">No connections available</Text>
                  <Text>Set up an accounting connection first to configure account mappings.</Text>
                  <PrimaryButton
                    text="Setup Connection"
                    iconProps={{ iconName: 'Add' }}
                    onClick={handleSetupConnection}
                    style={{ marginTop: 16 }}
                  />
                </div>
              ) : (
                <Stack tokens={{ childrenGap: 24 }}>
                  {connections.filter(conn => conn.status === 'connected').map(connection => (
                    <AccountMappingInterface
                      key={connection.id}
                      connection={connection}
                      onMappingsChange={() => {
                        console.log('Account mappings changed for connection:', connection.id);
                        // Optionally refresh connections or show success message
                      }}
                    />
                  ))}
                  {connections.filter(conn => conn.status === 'connected').length === 0 && (
                    <div className="text-center py-8">
                      <Icon iconName="Warning" style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                      <Text variant="large">No active connections</Text>
                      <Text>Account mappings are only available for connected providers. Please ensure your connections are working correctly.</Text>
                    </div>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>
        </PivotItem>

        <PivotItem headerText="Export History">
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Export History</Text>
              
              <Pivot>
                <PivotItem headerText="Invoice Exports">
                  {invoiceExports.length === 0 ? (
                    <Text>No invoice exports yet.</Text>
                  ) : (
                    <DetailsList
                      items={invoiceExports}
                      columns={exportColumns}
                      layoutMode={DetailsListLayoutMode.justified}
                      selectionMode={SelectionMode.none}
                      isHeaderVisible={true}
                    />
                  )}
                </PivotItem>

                <PivotItem headerText="Payroll Exports">
                  {payrollExports.length === 0 ? (
                    <Text>No payroll exports yet.</Text>
                  ) : (
                    <DetailsList
                      items={payrollExports}
                      columns={exportColumns}
                      layoutMode={DetailsListLayoutMode.justified}
                      selectionMode={SelectionMode.none}
                      isHeaderVisible={true}
                    />
                  )}
                </PivotItem>
              </Pivot>
            </Stack>
          </Card>
        </PivotItem>

        <PivotItem headerText="Sync Logs">
          <Card>
            <Stack tokens={{ childrenGap: 16 }}>
              <Text variant="large">Sync Logs</Text>
              <Text className="text-gray-600">
                Monitor sync operations and troubleshoot any issues.
              </Text>

              {syncLogs.length === 0 ? (
                <Text>No recent errors or warnings.</Text>
              ) : (
                <div>
                  {syncLogs.map((log, index) => (
                    <div key={log.id} style={{ 
                      padding: 12, 
                      marginBottom: 8, 
                      borderLeft: `4px solid ${log.level === 'error' ? 'red' : 'orange'}`,
                      backgroundColor: '#f9f9f9' 
                    }}>
                      <Stack horizontal horizontalAlign="space-between">
                        <Text variant="medium" style={{ fontWeight: 600 }}>{log.operation}</Text>
                        <Text variant="small">{new Date(log.created_at).toLocaleString()}</Text>
                      </Stack>
                      <Text>{log.message}</Text>
                      <Text variant="small" style={{ color: '#666' }}>
                        {log.connection_name} • {log.created_by_name}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </Stack>
          </Card>
        </PivotItem>
      </Pivot>

      {/* Setup Connection Dialog */}
      <Dialog
        hidden={!showSetupDialog}
        onDismiss={() => setShowSetupDialog(false)}
        dialogContentProps={{
          type: DialogType.largeHeader,
          title: 'Setup Accounting Connection',
          subText: 'Connect to your accounting software to automatically sync invoices and payroll data.'
        }}
        minWidth={500}
      >
        <Stack tokens={{ childrenGap: 16 }}>
          <Dropdown
            label="Accounting Provider"
            placeholder="Select a provider"
            options={providerOptions}
            selectedKey={selectedProvider}
            onChange={(_, option) => setSelectedProvider(option?.key as string || '')}
            required
          />

          <Toggle
            label="Sandbox Mode"
            inlineLabel
            checked={isSandboxMode}
            onChange={(_, checked) => setIsSandboxMode(checked || false)}
          />
          <Text variant="small" className="text-gray-600">
            Enable for testing with demo data. Disable for production use.
          </Text>

          {selectedProvider && (
            <MessageBar messageBarType={MessageBarType.info}>
              You will be redirected to {providers.find(p => p.provider_key === selectedProvider)?.display_name} 
              to authorize the connection. Make sure you log in with the correct account.
            </MessageBar>
          )}
        </Stack>

        <DialogFooter>
          <PrimaryButton
            onClick={handleProviderSelection}
            text="Connect"
            disabled={!selectedProvider || isProcessing}
          />
          <DefaultButton 
            onClick={() => setShowSetupDialog(false)} 
            text="Cancel"
            disabled={isProcessing}
          />
        </DialogFooter>
      </Dialog>
    </Stack>
  );
};

export default FinanceIntegrations;