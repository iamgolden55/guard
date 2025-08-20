import type React from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  DefaultButton,
  Icon
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
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

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get OAuth parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const tenantId = searchParams.get('realmId') || searchParams.get('tenantId'); // QuickBooks uses realmId, Xero uses tenantId

        // Handle OAuth error
        if (error) {
          setError(`OAuth authorization failed: ${error}`);
          setIsProcessing(false);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setError('Missing required OAuth parameters. Please try the connection setup again.');
          setIsProcessing(false);
          return;
        }

        // Get stored OAuth state from session storage
        const storedState = sessionStorage.getItem('finance_oauth_state');
        const providerKey = sessionStorage.getItem('finance_oauth_provider');
        const isSandbox = sessionStorage.getItem('finance_oauth_sandbox') === 'true';
        const redirectUri = sessionStorage.getItem('finance_oauth_redirect');

        // Validate state to prevent CSRF attacks
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

        // Complete OAuth flow
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

        // Clean up session storage
        sessionStorage.removeItem('finance_oauth_state');
        sessionStorage.removeItem('finance_oauth_provider');
        sessionStorage.removeItem('finance_oauth_sandbox');
        sessionStorage.removeItem('finance_oauth_redirect');

        // Automatically test the connection
        await performConnectionTest(connectionData);

      } catch (error: any) {
        console.error('OAuth callback failed:', error);
        
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

  const performConnectionTest = async (connectionData: ProviderConnection) => {
    try {
      setIsTestingConnection(true);
      console.log('Automatically testing connection for:', connectionData.provider_name);
      
      const result = await financeIntegrationsService.testConnection(connectionData.id);
      
      setConnectionTestResult({
        success: result.success,
        error: result.error_message
      });
      
      if (result.success) {
        console.log('Connection test passed automatically');
      } else {
        console.warn('Connection test failed automatically:', result.error_message);
      }
      
    } catch (error: any) {
      console.error('Automatic connection test failed:', error);
      setConnectionTestResult({
        success: false,
        error: 'Failed to test connection automatically. You can test it manually later.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestConnection = async () => {
    if (!connection) return;

    try {
      setIsTestingConnection(true);
      const result = await financeIntegrationsService.testConnection(connection.id);
      
      setConnectionTestResult({
        success: result.success,
        error: result.error_message
      });
      
      if (result.success) {
        // Optional: Navigate with success message after manual test
        // navigate('/admin/finance-integrations', { 
        //   state: { 
        //     message: `Connection to ${connection.provider_name} tested successfully!`,
        //     type: 'success'
        //   }
        // });
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setConnectionTestResult({
        success: false,
        error: 'Failed to test connection. Please try again.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleGoToIntegrations = () => {
    navigate('/admin/finance-integrations');
  };

  const handleRetrySetup = () => {
    // Clear any remaining session data
    sessionStorage.removeItem('finance_oauth_state');
    sessionStorage.removeItem('finance_oauth_provider');
    sessionStorage.removeItem('finance_oauth_sandbox');
    sessionStorage.removeItem('finance_oauth_redirect');
    
    navigate('/admin/finance-integrations');
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }} style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
        <Text variant="xxLarge">Finance Integration Setup</Text>

        {isProcessing && (
          <Stack horizontalAlign="center" tokens={{ childrenGap: 20 }} style={{ padding: '40px 0' }}>
            <Spinner size={SpinnerSize.large} label="Completing connection setup..." />
            <Text>Please wait while we complete your connection setup.</Text>
          </Stack>
        )}

        {success && connection && (
          <Stack tokens={{ childrenGap: 20 }}>
            <MessageBar messageBarType={MessageBarType.success}>
              <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
                <Icon iconName="CheckMark" />
                <Text>Successfully connected to {connection.provider_name}!</Text>
              </Stack>
            </MessageBar>

            {/* Connection test status */}
            {isTestingConnection && (
              <MessageBar messageBarType={MessageBarType.info}>
                <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
                  <Spinner size={SpinnerSize.small} />
                  <Text>Testing connection to verify it's working correctly...</Text>
                </Stack>
              </MessageBar>
            )}

            {connectionTestResult && !isTestingConnection && (
              <MessageBar 
                messageBarType={connectionTestResult.success ? MessageBarType.success : MessageBarType.warning}
              >
                <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
                  <Icon iconName={connectionTestResult.success ? "CheckMark" : "Warning"} />
                  <Text>
                    {connectionTestResult.success 
                      ? `Connection test passed! ${connection.provider_name} is responding correctly.`
                      : `Connection test failed: ${connectionTestResult.error || 'Unknown error'}`
                    }
                  </Text>
                </Stack>
              </MessageBar>
            )}

            <Stack tokens={{ childrenGap: 12 }} style={{ 
              border: '1px solid #e1e1e1', 
              borderRadius: 8, 
              padding: 24, 
              backgroundColor: '#f9f9f9' 
            }}>
              <Text variant="large" style={{ fontWeight: 600 }}>Connection Details</Text>
              
              <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
                <img 
                  src={financeIntegrationsService.getProviderLogo(connection.provider_key)} 
                  alt={connection.provider_name}
                  style={{ width: 32, height: 32 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logos/default-accounting.svg';
                  }}
                />
                <Stack>
                  <Text variant="medium" style={{ fontWeight: 600 }}>{connection.provider_name}</Text>
                  <Text variant="small" style={{ color: '#666' }}>
                    {connection.company_name || 'Company name will be updated after first sync'}
                  </Text>
                </Stack>
              </Stack>

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack>
                  <Text variant="small" style={{ color: '#666' }}>Status</Text>
                  <Text variant="medium" style={{ color: 'green', fontWeight: 600 }}>{connection.status}</Text>
                </Stack>
                <Stack>
                  <Text variant="small" style={{ color: '#666' }}>Mode</Text>
                  <Text variant="medium">{connection.is_sandbox ? 'Sandbox' : 'Production'}</Text>
                </Stack>
              </Stack>
            </Stack>

            <Text style={{ color: '#666' }}>
              Your accounting software is now connected! You can now export invoices and payroll data 
              directly from the Security Staff Portal to {connection.provider_name}.
            </Text>

            <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center">
              {connectionTestResult?.success ? (
                <PrimaryButton
                  text="Go to Finance Integrations"
                  iconProps={{ iconName: 'NavigateExternalInline' }}
                  onClick={handleGoToIntegrations}
                />
              ) : (
                <>
                  <PrimaryButton
                    text={isTestingConnection ? "Testing..." : "Test Connection"}
                    iconProps={{ iconName: isTestingConnection ? undefined : 'TestBeaker' }}
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                  />
                  <DefaultButton
                    text="Go to Finance Integrations"
                    iconProps={{ iconName: 'NavigateExternalInline' }}
                    onClick={handleGoToIntegrations}
                    disabled={isTestingConnection}
                  />
                </>
              )}
            </Stack>
          </Stack>
        )}

        {error && !success && (
          <Stack tokens={{ childrenGap: 20 }}>
            <MessageBar messageBarType={MessageBarType.error}>
              <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
                <Icon iconName="Error" />
                <Text>{error}</Text>
              </Stack>
            </MessageBar>

            <Stack tokens={{ childrenGap: 12 }} style={{ 
              border: '1px solid #f3f2f1', 
              borderRadius: 8, 
              padding: 24 
            }}>
              <Text variant="large">What to do next:</Text>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  <Text>Check your internet connection and try again</Text>
                </li>
                <li>
                  <Text>Make sure you authorized the connection in your accounting software</Text>
                </li>
                <li>
                  <Text>Verify you logged into the correct company/organization</Text>
                </li>
                <li>
                  <Text>Contact support if the problem persists</Text>
                </li>
              </ul>
            </Stack>

            <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center">
              <PrimaryButton
                text="Try Setup Again"
                iconProps={{ iconName: 'Refresh' }}
                onClick={handleRetrySetup}
              />
              <DefaultButton
                text="Go to Finance Integrations"
                iconProps={{ iconName: 'Back' }}
                onClick={handleGoToIntegrations}
              />
            </Stack>
          </Stack>
        )}
      </Stack>
    </MainLayout>
  );
};

export default FinanceIntegrationsOAuthCallback;