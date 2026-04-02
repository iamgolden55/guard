import type React from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header, Container, SpaceBetween, StatusIndicator, Alert } from '../../components/cloudscape';
import { financeIntegrationsService } from '../../services';
import type { ProviderConnection } from '../../services/financeIntegrationsService';

const FinanceIntegrationsOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [isProcessing, setIsProcessing] = useState(true);
  const [connection, setConnection] = useState<ProviderConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Xero tenant selection states
  const [showTenantSelection, setShowTenantSelection] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<Array<{ tenant_id: string; tenant_name: string; tenant_type: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [tenantSelectionData, setTenantSelectionData] = useState<any>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        let tenantId = searchParams.get('realmId') || searchParams.get('tenantId');

        if (error) {
          setError(`OAuth authorization failed: ${error}`);
          setIsProcessing(false);
          return;
        }

        if (!code || !state) {
          setError('Missing required OAuth parameters. Please try the connection setup again.');
          setIsProcessing(false);
          return;
        }

        const storedState = sessionStorage.getItem('finance_oauth_state');
        const providerKey = sessionStorage.getItem('finance_oauth_provider');
        const isSandbox = sessionStorage.getItem('finance_oauth_sandbox') === 'true';
        const redirectUri = sessionStorage.getItem('finance_oauth_redirect');

        if (state !== storedState) {
          setError('Invalid OAuth state. This may be a security issue. Please try again.');
          setIsProcessing(false);
          return;
        }

        if (!providerKey || !redirectUri) {
          setError('OAuth session data is missing. Please restart the connection setup.');
          setIsProcessing(false);
          return;
        }

        if (providerKey === 'xero' && !tenantId) {
          try {
            const tenantsData = await financeIntegrationsService.getTenants({
              provider_key: providerKey,
              code: code,
              redirect_uri: redirectUri,
              is_sandbox: isSandbox
            });

            setTenantSelectionData({ code, state, providerKey, redirectUri, isSandbox });

            if (tenantsData.tenants && tenantsData.tenants.length > 1) {
              setAvailableTenants(tenantsData.tenants);
              setSelectedTenantId(tenantsData.tenants[0].tenant_id);
              setShowTenantSelection(true);
              setIsProcessing(false);
              return;
            } else if (tenantsData.tenants && tenantsData.tenants.length === 1) {
              tenantId = tenantsData.tenants[0].tenant_id;
            } else {
              throw new Error('No Xero organizations found for this account');
            }
          } catch (tenantError: any) {
            setError(`Failed to retrieve Xero organizations: ${tenantError.response?.data?.error || tenantError.message}`);
            setIsProcessing(false);
            return;
          }
        }

        const connectionData = await financeIntegrationsService.completeOAuth({
          provider_key: providerKey,
          code: code,
          state: state,
          redirect_uri: redirectUri,
          tenant_id: tenantId || undefined,
          is_sandbox: isSandbox
        });

        setConnection(connectionData);
        setSuccess(true);

        sessionStorage.removeItem('finance_oauth_state');
        sessionStorage.removeItem('finance_oauth_provider');
        sessionStorage.removeItem('finance_oauth_sandbox');
        sessionStorage.removeItem('finance_oauth_redirect');

        await performConnectionTest(connectionData);
      } catch (error: any) {
        let errorMessage = 'Failed to complete connection setup.';
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        setError(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  const handleTenantSelection = async () => {
    if (!selectedTenantId || !tenantSelectionData) {
      setError('Please select an organization to continue.');
      return;
    }

    setIsProcessing(true);
    setShowTenantSelection(false);

    try {
      const { code, state, providerKey, redirectUri, isSandbox } = tenantSelectionData;

      const connectionData = await financeIntegrationsService.completeOAuth({
        provider_key: providerKey,
        code: code,
        state: state,
        redirect_uri: redirectUri,
        tenant_id: selectedTenantId,
        is_sandbox: isSandbox
      });

      setConnection(connectionData);
      setSuccess(true);

      sessionStorage.removeItem('finance_oauth_state');
      sessionStorage.removeItem('finance_oauth_provider');
      sessionStorage.removeItem('finance_oauth_sandbox');
      sessionStorage.removeItem('finance_oauth_redirect');

      await performConnectionTest(connectionData);
    } catch (error: any) {
      let errorMessage = 'Failed to complete connection setup.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const performConnectionTest = async (connectionData: ProviderConnection) => {
    try {
      setIsTestingConnection(true);
      const result = await financeIntegrationsService.testConnection(connectionData.id);
      setConnectionTestResult({ success: result.success, error: result.error_message });
    } catch (error: any) {
      setConnectionTestResult({ success: false, error: 'Failed to test connection automatically. You can test it manually later.' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestConnection = async () => {
    if (!connection) return;
    try {
      setIsTestingConnection(true);
      const result = await financeIntegrationsService.testConnection(connection.id);
      setConnectionTestResult({ success: result.success, error: result.error_message });
    } catch (error: any) {
      setConnectionTestResult({ success: false, error: 'Failed to test connection. Please try again.' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleGoToIntegrations = () => navigate('/admin/finance-integrations');

  const handleRetrySetup = () => {
    sessionStorage.removeItem('finance_oauth_state');
    sessionStorage.removeItem('finance_oauth_provider');
    sessionStorage.removeItem('finance_oauth_sandbox');
    sessionStorage.removeItem('finance_oauth_redirect');
    navigate('/admin/finance-integrations');
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <SpaceBetween size="l">
        <Header>Finance Integration Setup</Header>

        {/* Tenant Selection UI */}
        {showTenantSelection && !isProcessing && (
          <SpaceBetween size="m">
            <Alert type="info">
              Multiple Xero organizations found. Please select which organization you want to connect.
            </Alert>

            <Container header={<Header variant="h2">Select Xero Organization</Header>}>
              <div className="space-y-3 mb-6">
                {availableTenants.map(tenant => (
                  <label key={tenant.tenant_id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="tenant"
                      value={tenant.tenant_id}
                      checked={selectedTenantId === tenant.tenant_id}
                      onChange={() => setSelectedTenantId(tenant.tenant_id)}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tenant.tenant_name}</p>
                      <p className="text-xs text-gray-500">{tenant.tenant_type || 'Organization'}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={handleTenantSelection}
                  disabled={!selectedTenantId}
                  className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Connect to Selected Organization
                </button>
                <button
                  onClick={handleRetrySetup}
                  className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </Container>
          </SpaceBetween>
        )}

        {/* Processing State */}
        {isProcessing && !showTenantSelection && (
          <Container>
            <div className="flex flex-col items-center py-10 gap-4">
              <svg className="animate-spin h-10 w-10 text-red-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-600">Completing connection setup...</p>
            </div>
          </Container>
        )}

        {/* Success State */}
        {success && connection && !showTenantSelection && (
          <SpaceBetween size="m">
            <Alert type="success">Successfully connected to {connection.provider_name}!</Alert>

            {isTestingConnection && (
              <Alert type="info">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing connection to verify it's working correctly...
                </div>
              </Alert>
            )}

            {connectionTestResult && !isTestingConnection && (
              <Alert type={connectionTestResult.success ? 'success' : 'warning'}>
                {connectionTestResult.success
                  ? `Connection test passed! ${connection.provider_name} is responding correctly.`
                  : `Connection test failed: ${connectionTestResult.error || 'Unknown error'}`
                }
              </Alert>
            )}

            <Container header={<Header variant="h2">Connection Details</Header>}>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={financeIntegrationsService.getProviderLogo(connection.provider_key)}
                  alt={connection.provider_name}
                  className="w-8 h-8"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/logos/default-accounting.svg'; }}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{connection.provider_name}</p>
                  <p className="text-xs text-gray-500">{connection.company_name || 'Company name will be updated after first sync'}</p>
                </div>
              </div>

              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <StatusIndicator type="success">{connection.status}</StatusIndicator>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mode</p>
                  <p className="text-sm text-gray-900">{connection.is_sandbox ? 'Sandbox' : 'Production'}</p>
                </div>
              </div>
            </Container>

            <p className="text-sm text-gray-600">
              Your accounting software is now connected! You can now export invoices and payroll data
              directly from the Security Staff Portal to {connection.provider_name}.
            </p>

            <div className="flex justify-center gap-3">
              {connectionTestResult?.success ? (
                <button onClick={handleGoToIntegrations} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                  Go to Finance Integrations
                </button>
              ) : (
                <>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleGoToIntegrations}
                    disabled={isTestingConnection}
                    className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Go to Finance Integrations
                  </button>
                </>
              )}
            </div>
          </SpaceBetween>
        )}

        {/* Error State */}
        {error && !success && !showTenantSelection && (
          <SpaceBetween size="m">
            <Alert type="error">{error}</Alert>

            <Container header={<Header variant="h2">What to do next</Header>}>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li>Check your internet connection and try again</li>
                <li>Make sure you authorized the connection in your accounting software</li>
                <li>Verify you logged into the correct company/organization</li>
                <li>Contact support if the problem persists</li>
              </ul>
            </Container>

            <div className="flex justify-center gap-3">
              <button onClick={handleRetrySetup} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                Try Setup Again
              </button>
              <button onClick={handleGoToIntegrations} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Go to Finance Integrations
              </button>
            </div>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </div>
  );
};

export default FinanceIntegrationsOAuthCallback;
