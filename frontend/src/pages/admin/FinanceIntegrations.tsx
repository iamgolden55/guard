import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Header, Container, SpaceBetween, StatusIndicator, CloudscapeTable, Alert, EmptyState, ConfirmationModal } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import { AccountMappingInterface } from '../../components';
import { financeIntegrationsService } from '../../services';
import type {
  ProviderConnection,
  AccountingProvider,
  InvoiceExport,
  PayrollExport,
  SyncLog,
  TestConnectionResponse
} from '../../services/financeIntegrationsService';

// Toggle Switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-red-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

const FinanceIntegrations: React.FC = () => {
  const location = useLocation();

  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [providers, setProviders] = useState<AccountingProvider[]>([]);
  const [invoiceExports, setInvoiceExports] = useState<InvoiceExport[]>([]);
  const [payrollExports, setPayrollExports] = useState<PayrollExport[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [authError, setAuthError] = useState<boolean>(false);
  const [connectionStatuses, setConnectionStatuses] = useState<{[key: number]: 'testing' | 'refreshing' | 'deleting'}>({});

  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [activeTab, setActiveTab] = useState('setup');
  const [exportSubTab, setExportSubTab] = useState<'invoices' | 'payroll'>('invoices');

  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      if (location.state?.type === 'success') {
        addFlash({ type: 'success', content: location.state.message });
      } else {
        addFlash({ type: 'error', content: location.state.message });
      }
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (connections.length === 0) return;

    const refreshInterval = setInterval(async () => {
      try {
        if (Object.keys(connectionStatuses).length === 0) {
          const connectionsData = await financeIntegrationsService.getConnections();
          setConnections(connectionsData);
        }
      } catch (error) {
        console.warn('Background connection refresh failed:', error);
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [connections.length, connectionStatuses]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setAuthError(false);

      try {
        const providersData = await financeIntegrationsService.getProviders();
        setProviders(providersData);
      } catch (providerError: any) {
        console.error('Failed to load providers:', providerError);
        if (providerError.response?.status === 401 || providerError.response?.status === 403) {
          setAuthError(true);
          addFlash({ type: 'error', content: 'Authentication required. Please log in to access finance integrations.' });
        } else {
          addFlash({ type: 'error', content: 'Failed to load accounting providers. Please check your connection.' });
        }
        return;
      }

      const loadPromises = [
        financeIntegrationsService.getConnections().catch(() => []),
        financeIntegrationsService.getInvoiceExports().catch(() => []),
        financeIntegrationsService.getPayrollExports().catch(() => []),
        financeIntegrationsService.getSyncLogs({ level: 'error' }).catch(() => [])
      ];

      const [connectionsData, exportsData, payrollData, logsData] = await Promise.all(loadPromises);

      setConnections(connectionsData as ProviderConnection[]);
      setInvoiceExports(exportsData as InvoiceExport[]);
      setPayrollExports(payrollData as PayrollExport[]);
      setSyncLogs(logsData as SyncLog[]);
    } catch (error: any) {
      console.error('Unexpected error loading finance integrations:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setAuthError(true);
        addFlash({ type: 'error', content: 'Authentication required. Please log in to access finance integrations.' });
      } else {
        addFlash({ type: 'error', content: 'An unexpected error occurred. Please try again.' });
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

      const redirectUri = financeIntegrationsService.generateOAuthRedirectUri();

      const oauthResponse = await financeIntegrationsService.initiateOAuth({
        provider_key: selectedProvider,
        redirect_uri: redirectUri,
        is_sandbox: isSandboxMode
      });

      sessionStorage.setItem('finance_oauth_state', oauthResponse.state);
      sessionStorage.setItem('finance_oauth_provider', selectedProvider);
      sessionStorage.setItem('finance_oauth_sandbox', isSandboxMode.toString());
      sessionStorage.setItem('finance_oauth_redirect', redirectUri);

      window.location.href = oauthResponse.oauth_url;
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      addFlash({ type: 'error', content: 'Failed to start connection setup. Please try again.' });
    } finally {
      setIsProcessing(false);
      setShowSetupDialog(false);
    }
  };

  const handleTestConnection = async (connection: ProviderConnection) => {
    try {
      setConnectionStatuses(prev => ({...prev, [connection.id]: 'testing'}));

      const result = await financeIntegrationsService.testConnection(connection.id);

      if (result.success) {
        addFlash({ type: 'success', content: `Connection to ${connection.provider_name} is working correctly.` });
      } else {
        addFlash({ type: 'error', content: `Connection test failed: ${result.error_message}` });
      }

      const connectionsData = await financeIntegrationsService.getConnections();
      setConnections(connectionsData);
    } catch (error) {
      console.error('Connection test failed:', error);
      addFlash({ type: 'error', content: 'Connection test failed. Please try again.' });
    } finally {
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

      await financeIntegrationsService.refreshToken(connection.id);
      addFlash({ type: 'success', content: `Token refreshed for ${connection.provider_name}.` });

      const connectionsData = await financeIntegrationsService.getConnections();
      setConnections(connectionsData);
    } catch (error) {
      console.error('Token refresh failed:', error);
      addFlash({ type: 'error', content: 'Token refresh failed. Please try again.' });
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

      await financeIntegrationsService.deleteConnection(connection.id);
      addFlash({ type: 'success', content: `Connection to ${connection.provider_name} deleted.` });

      const connectionsData = await financeIntegrationsService.getConnections();
      setConnections(connectionsData);
    } catch (error) {
      console.error('Delete connection failed:', error);
      addFlash({ type: 'error', content: 'Failed to delete connection. Please try again.' });
    } finally {
      setConnectionStatuses(prev => {
        const newStatuses = {...prev};
        delete newStatuses[connection.id];
        return newStatuses;
      });
    }
  };

  const tabs = [
    { id: 'setup', label: 'Setup' },
    { id: 'connections', label: 'Connections' },
    { id: 'mappings', label: 'Account Mappings' },
    { id: 'exports', label: 'Export History' },
    { id: 'logs', label: 'Sync Logs' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-red-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Loading finance integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <SpaceBetween size="l">
      <Header
        actions={
          <button
            onClick={handleSetupConnection}
            className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Setup New Connection
          </button>
        }
      >
        Finance Integrations
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id
                ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600 whitespace-nowrap'
                : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <Container header={<Header variant="h2">Available Accounting Providers</Header>}>
          <p className="text-sm text-gray-600 mb-6">
            Connect to your accounting software to automatically sync invoices and payroll data.
          </p>

          {authError ? (
            <Alert type="warning">
              <div className="flex items-center gap-4">
                <span>Please log in to view and set up accounting integrations.</span>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Go to Login
                </button>
              </div>
            </Alert>
          ) : providers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
              </svg>
              <p className="text-base font-medium text-gray-900 mb-1">No providers available</p>
              <p className="text-sm text-gray-500 mb-4">Unable to load accounting providers. Please try refreshing the page.</p>
              <button onClick={loadData} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Refresh
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((provider) => {
                const existingConnection = connections.find(c => c.provider_key === provider.provider_key);
                return (
                  <div
                    key={provider.id}
                    className={`border rounded-lg p-6 flex flex-col items-center text-center transition-all ${
                      existingConnection
                        ? 'border-gray-200 bg-gray-50 opacity-70'
                        : 'border-gray-200 bg-white hover:border-red-300 hover:shadow-sm cursor-pointer'
                    }`}
                    onClick={!existingConnection ? () => {
                      setSelectedProvider(provider.provider_key);
                      setShowSetupDialog(true);
                    } : undefined}
                  >
                    <img
                      src={financeIntegrationsService.getProviderLogo(provider.provider_key)}
                      alt={provider.display_name}
                      className="w-12 h-12 mb-3"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logos/default-accounting.svg'; }}
                    />
                    <p className="text-sm font-semibold text-gray-900 mb-2">{provider.display_name}</p>

                    {existingConnection ? (
                      <StatusIndicator type={existingConnection.status === 'connected' ? 'success' : 'warning'}>
                        {existingConnection.status === 'connected' ? 'Connected' : existingConnection.status}
                      </StatusIndicator>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProvider(provider.provider_key);
                          setShowSetupDialog(true);
                        }}
                        className="mt-2 px-4 h-8 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Container>
      )}

      {/* Connections Tab */}
      {activeTab === 'connections' && (
        <Container header={<Header variant="h2">Accounting Provider Connections</Header>}>
          <p className="text-sm text-gray-600 mb-4">
            Manage your connections to accounting software.
          </p>

          {connections.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.486a4.5 4.5 0 00-6.364-6.364L4.5 6.394" />
              </svg>
              <p className="text-base font-medium text-gray-900 mb-1">No connections configured</p>
              <p className="text-sm text-gray-500 mb-4">Set up your first accounting integration to get started.</p>
              <button onClick={handleSetupConnection} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                Setup Connection
              </button>
            </div>
          ) : (
            <CloudscapeTable
              columnDefinitions={[
                {
                  id: 'provider',
                  header: 'Provider',
                  cell: (item: ProviderConnection) => (
                    <div className="flex items-center gap-2">
                      <img
                        src={financeIntegrationsService.getProviderLogo(item.provider_key)}
                        alt={item.provider_name}
                        className="w-6 h-6"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-sm">{item.provider_name}</span>
                    </div>
                  ),
                },
                { id: 'company', header: 'Company', cell: (item: ProviderConnection) => item.company_name || '-' },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (item: ProviderConnection) => (
                    <div className="flex items-center gap-2">
                      <StatusIndicator type={item.status === 'connected' ? 'success' : item.status === 'pending' ? 'warning' : 'error'}>
                        {item.status}
                      </StatusIndicator>
                      {item.is_sandbox && <span className="text-xs text-amber-600">(Sandbox)</span>}
                    </div>
                  ),
                },
                {
                  id: 'lastSync',
                  header: 'Last Sync',
                  cell: (item: ProviderConnection) => item.last_sync_at ? new Date(item.last_sync_at).toLocaleDateString() : 'Never',
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  cell: (item: ProviderConnection) => {
                    const status = connectionStatuses[item.id];
                    const anyBusy = Object.keys(connectionStatuses).length > 0;
                    return (
                      <div className="flex items-center gap-3">
                        {status === 'testing' ? (
                          <span className="text-xs text-gray-500">Testing...</span>
                        ) : (
                          <button onClick={() => handleTestConnection(item)} disabled={anyBusy} className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50">Test</button>
                        )}
                        {item.status === 'expired' && (
                          status === 'refreshing' ? (
                            <span className="text-xs text-gray-500">Refreshing...</span>
                          ) : (
                            <button onClick={() => handleRefreshToken(item)} disabled={anyBusy} className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50">Refresh Token</button>
                          )
                        )}
                        {status === 'deleting' ? (
                          <span className="text-xs text-red-500">Deleting...</span>
                        ) : (
                          <button onClick={() => handleDeleteConnection(item)} disabled={anyBusy} className="text-sm text-gray-500 hover:text-red-600 font-medium disabled:opacity-50">Delete</button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
              items={connections}
              empty="No connections found."
            />
          )}
        </Container>
      )}

      {/* Account Mappings Tab */}
      {activeTab === 'mappings' && (
        <Container header={<Header variant="h2">Account Mappings</Header>}>
          {connections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-base font-medium text-gray-900 mb-1">No connections available</p>
              <p className="text-sm text-gray-500 mb-4">Set up an accounting connection first to configure account mappings.</p>
              <button onClick={handleSetupConnection} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                Setup Connection
              </button>
            </div>
          ) : (
            <SpaceBetween size="l">
              {connections.filter(conn => conn.status === 'connected').map(connection => (
                <AccountMappingInterface
                  key={connection.id}
                  connection={connection}
                  onMappingsChange={() => {
                    console.log('Account mappings changed for connection:', connection.id);
                  }}
                />
              ))}
              {connections.filter(conn => conn.status === 'connected').length === 0 && (
                <div className="text-center py-8">
                  <p className="text-base font-medium text-gray-900 mb-1">No active connections</p>
                  <p className="text-sm text-gray-500">Account mappings are only available for connected providers.</p>
                </div>
              )}
            </SpaceBetween>
          )}
        </Container>
      )}

      {/* Export History Tab */}
      {activeTab === 'exports' && (
        <Container header={<Header variant="h2">Export History</Header>}>
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex gap-0 -mb-px">
              <button
                onClick={() => setExportSubTab('invoices')}
                className={exportSubTab === 'invoices'
                  ? 'px-4 py-2 text-sm font-medium text-red-600 border-b-2 border-red-600'
                  : 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                }
              >
                Invoice Exports
              </button>
              <button
                onClick={() => setExportSubTab('payroll')}
                className={exportSubTab === 'payroll'
                  ? 'px-4 py-2 text-sm font-medium text-red-600 border-b-2 border-red-600'
                  : 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                }
              >
                Payroll Exports
              </button>
            </nav>
          </div>

          {exportSubTab === 'invoices' && (
            invoiceExports.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No invoice exports yet.</p>
            ) : (
              <CloudscapeTable
                columnDefinitions={[
                  { id: 'id', header: 'ID', cell: (item: InvoiceExport) => `${item.id}` },
                  { id: 'connection', header: 'Provider', cell: (item: InvoiceExport) => item.connection_name },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (item: InvoiceExport) => (
                      <StatusIndicator type={item.status === 'completed' ? 'success' : item.status === 'pending' || item.status === 'processing' ? 'warning' : 'error'}>
                        {item.status}
                      </StatusIndicator>
                    ),
                  },
                  { id: 'exportedAt', header: 'Exported', cell: (item: InvoiceExport) => new Date(item.exported_at).toLocaleDateString() },
                  { id: 'exportedBy', header: 'Exported By', cell: (item: InvoiceExport) => item.exported_by_name },
                ]}
                items={invoiceExports}
                empty="No invoice exports."
              />
            )
          )}

          {exportSubTab === 'payroll' && (
            payrollExports.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No payroll exports yet.</p>
            ) : (
              <CloudscapeTable
                columnDefinitions={[
                  { id: 'id', header: 'ID', cell: (item: PayrollExport) => `${item.id}` },
                  { id: 'connection', header: 'Provider', cell: (item: PayrollExport) => item.connection_name },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (item: PayrollExport) => (
                      <StatusIndicator type={item.status === 'completed' ? 'success' : item.status === 'pending' || item.status === 'processing' ? 'warning' : 'error'}>
                        {item.status}
                      </StatusIndicator>
                    ),
                  },
                  { id: 'exportedAt', header: 'Exported', cell: (item: PayrollExport) => new Date(item.exported_at).toLocaleDateString() },
                  { id: 'exportedBy', header: 'Exported By', cell: (item: PayrollExport) => item.exported_by_name },
                ]}
                items={payrollExports}
                empty="No payroll exports."
              />
            )
          )}
        </Container>
      )}

      {/* Sync Logs Tab */}
      {activeTab === 'logs' && (
        <Container header={<Header variant="h2">Sync Logs</Header>}>
          <p className="text-sm text-gray-600 mb-4">
            Monitor sync operations and troubleshoot any issues.
          </p>

          {syncLogs.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No recent errors or warnings.</p>
          ) : (
            <div className="space-y-2">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 border-l-4 bg-gray-50 rounded-r-lg ${
                    log.level === 'error' ? 'border-red-500' : 'border-amber-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">{log.operation}</p>
                    <p className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-sm text-gray-700">{log.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{log.connection_name} &bull; {log.created_by_name}</p>
                </div>
              ))}
            </div>
          )}
        </Container>
      )}

      {/* Setup Connection Modal */}
      {showSetupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Setup Accounting Connection</h2>
            <p className="text-sm text-gray-500 mb-6">Connect to your accounting software to automatically sync invoices and payroll data.</p>

            <SpaceBetween size="m">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accounting Provider</label>
                <select
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  <option value="">Select a provider</option>
                  {providers.map(p => (
                    <option key={p.provider_key} value={p.provider_key}>{p.display_name}</option>
                  ))}
                </select>
              </div>

              <ToggleSwitch
                label="Sandbox Mode"
                checked={isSandboxMode}
                onChange={setIsSandboxMode}
              />
              <p className="text-xs text-gray-500 -mt-2">Enable for testing with demo data. Disable for production use.</p>

              {selectedProvider && (
                <Alert type="info">
                  You will be redirected to {providers.find(p => p.provider_key === selectedProvider)?.display_name} to authorize the connection. Make sure you log in with the correct account.
                </Alert>
              )}
            </SpaceBetween>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSetupDialog(false)}
                disabled={isProcessing}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProviderSelection}
                disabled={!selectedProvider || isProcessing}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SpaceBetween>
  );
};

export default FinanceIntegrations;
