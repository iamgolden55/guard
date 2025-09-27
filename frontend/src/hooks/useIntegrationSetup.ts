import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  IntegrationsSetupData,
  DeputyIntegration,
  AccountingProvider,
  AccountingIntegration,
  PayrollIntegration,
  CommunicationIntegration,
  CustomIntegration,
  SyncFrequency
} from '../types';

// Integration configuration templates
interface IntegrationTemplate {
  id: string;
  name: string;
  category: 'deputy' | 'accounting' | 'payroll' | 'communication' | 'custom';
  description: string;
  logoUrl: string;
  isPopular: boolean;
  setupComplexity: 'simple' | 'moderate' | 'complex';
  features: string[];
  requiredCredentials: string[];
  syncOptions?: string[];
}

/**
 * Hook for managing third-party integration setup during onboarding
 */
export function useIntegrationSetup() {
  const [selectedIntegrations, setSelectedIntegrations] = useState<Set<string>>(new Set());
  const [integrationData, setIntegrationData] = useState<IntegrationsSetupData>({
    deputy: {
      enabled: false,
      syncFrequency: SyncFrequency.DAILY,
      syncOptions: {
        employees: true,
        timesheets: true,
        rosters: true,
        locations: true,
        departments: true
      }
    },
    accounting: {
      provider: AccountingProvider.NONE,
      enabled: false,
      syncOptions: {
        invoices: false,
        expenses: false,
        payroll: false,
        taxes: false
      }
    },
    payroll: {
      provider: '',
      enabled: false,
      payFrequency: 'MONTHLY' as any
    },
    communication: {
      sms: { enabled: false, provider: '' },
      email: { enabled: false, provider: '' },
      whatsapp: { enabled: false }
    },
    customIntegrations: []
  });
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'connected' | 'failed' | 'pending'>>({});

  // Available integration templates
  const integrationTemplates: IntegrationTemplate[] = useMemo(() => [
    // Deputy Integration
    {
      id: 'deputy',
      name: 'Deputy',
      category: 'deputy',
      description: 'Workforce management and scheduling platform',
      logoUrl: '/logos/deputy.svg',
      isPopular: true,
      setupComplexity: 'moderate',
      features: ['Employee sync', 'Timesheet import', 'Roster integration', 'Location management'],
      requiredCredentials: ['apiKey', 'subdomain'],
      syncOptions: ['employees', 'timesheets', 'rosters', 'locations', 'departments']
    },

    // Accounting Integrations
    {
      id: 'xero',
      name: 'Xero',
      category: 'accounting',
      description: 'Cloud-based accounting software',
      logoUrl: '/logos/xero.svg',
      isPopular: true,
      setupComplexity: 'moderate',
      features: ['Invoice sync', 'Expense tracking', 'Financial reporting', 'Tax calculations'],
      requiredCredentials: ['clientId', 'clientSecret'],
      syncOptions: ['invoices', 'expenses', 'payroll', 'taxes']
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      category: 'accounting',
      description: 'Small business accounting software',
      logoUrl: '/logos/quickbooks.svg',
      isPopular: true,
      setupComplexity: 'moderate',
      features: ['Invoice management', 'Expense tracking', 'Payroll integration', 'Tax preparation'],
      requiredCredentials: ['clientId', 'clientSecret', 'tenantId'],
      syncOptions: ['invoices', 'expenses', 'payroll', 'taxes']
    },
    {
      id: 'sage',
      name: 'Sage',
      category: 'accounting',
      description: 'Business management software',
      logoUrl: '/logos/sage.svg',
      isPopular: false,
      setupComplexity: 'complex',
      features: ['Accounting', 'Payroll', 'HR management', 'Reporting'],
      requiredCredentials: ['apiKey', 'subscriptionId'],
      syncOptions: ['invoices', 'expenses', 'payroll', 'taxes']
    },
    {
      id: 'zoho',
      name: 'Zoho Books',
      category: 'accounting',
      description: 'Online accounting software for small businesses',
      logoUrl: '/logos/zoho.svg',
      isPopular: false,
      setupComplexity: 'simple',
      features: ['Invoice automation', 'Expense management', 'Banking', 'Reports'],
      requiredCredentials: ['clientId', 'clientSecret'],
      syncOptions: ['invoices', 'expenses', 'payroll', 'taxes']
    },

    // Payroll Integrations
    {
      id: 'adp',
      name: 'ADP',
      category: 'payroll',
      description: 'Human capital management solutions',
      logoUrl: '/logos/adp.svg',
      isPopular: true,
      setupComplexity: 'complex',
      features: ['Payroll processing', 'Tax filing', 'Benefits administration', 'HR management'],
      requiredCredentials: ['clientId', 'clientSecret', 'certificateAlias']
    },
    {
      id: 'paychex',
      name: 'Paychex',
      category: 'payroll',
      description: 'Payroll and HR services',
      logoUrl: '/logos/paychex.svg',
      isPopular: false,
      setupComplexity: 'moderate',
      features: ['Payroll', 'Tax services', 'HR support', 'Time tracking'],
      requiredCredentials: ['apiKey', 'companyId']
    },

    // Communication Integrations
    {
      id: 'twilio',
      name: 'Twilio',
      category: 'communication',
      description: 'SMS and communication APIs',
      logoUrl: '/logos/twilio.svg',
      isPopular: true,
      setupComplexity: 'simple',
      features: ['SMS notifications', 'Voice calls', 'WhatsApp integration', 'Email'],
      requiredCredentials: ['accountSid', 'authToken']
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      category: 'communication',
      description: 'Email delivery service',
      logoUrl: '/logos/sendgrid.svg',
      isPopular: true,
      setupComplexity: 'simple',
      features: ['Transactional emails', 'Marketing emails', 'Email templates', 'Analytics'],
      requiredCredentials: ['apiKey']
    },
    {
      id: 'whatsapp-business',
      name: 'WhatsApp Business',
      category: 'communication',
      description: 'Business messaging platform',
      logoUrl: '/logos/whatsapp.svg',
      isPopular: true,
      setupComplexity: 'moderate',
      features: ['Business messaging', 'Automated responses', 'Broadcast lists', 'Analytics'],
      requiredCredentials: ['businessAccountId', 'phoneNumberId', 'accessToken']
    }
  ], []);

  // Filter integrations by category
  const getIntegrationsByCategory = useCallback((category: string) => {
    return integrationTemplates.filter(template => template.category === category);
  }, [integrationTemplates]);

  // Popular integrations (for quick setup)
  const popularIntegrations = useMemo(() => {
    return integrationTemplates.filter(template => template.isPopular);
  }, [integrationTemplates]);

  // Toggle integration selection
  const toggleIntegration = useCallback((integrationId: string) => {
    setSelectedIntegrations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(integrationId)) {
        newSet.delete(integrationId);
      } else {
        newSet.add(integrationId);
      }
      return newSet;
    });
  }, []);

  // Update specific integration configuration
  const updateDeputyConfig = useCallback((config: Partial<DeputyIntegration>) => {
    setIntegrationData(prev => ({
      ...prev,
      deputy: { ...prev.deputy, ...config }
    }));
  }, []);

  const updateAccountingConfig = useCallback((config: Partial<AccountingIntegration>) => {
    setIntegrationData(prev => ({
      ...prev,
      accounting: { ...prev.accounting, ...config }
    }));
  }, []);

  const updatePayrollConfig = useCallback((config: Partial<PayrollIntegration>) => {
    setIntegrationData(prev => ({
      ...prev,
      payroll: { ...prev.payroll, ...config }
    }));
  }, []);

  const updateCommunicationConfig = useCallback((config: Partial<CommunicationIntegration>) => {
    setIntegrationData(prev => ({
      ...prev,
      communication: { ...prev.communication, ...config }
    }));
  }, []);

  const addCustomIntegration = useCallback((integration: CustomIntegration) => {
    setIntegrationData(prev => ({
      ...prev,
      customIntegrations: [...prev.customIntegrations, integration]
    }));
  }, []);

  const removeCustomIntegration = useCallback((integrationName: string) => {
    setIntegrationData(prev => ({
      ...prev,
      customIntegrations: prev.customIntegrations.filter(int => int.name !== integrationName)
    }));
  }, []);

  // Test integration connection
  const testConnection = useCallback(async (integrationId: string, credentials: Record<string, string>) => {
    setIsConnecting(integrationId);
    setConnectionStatus(prev => ({ ...prev, [integrationId]: 'pending' }));

    try {
      // Simulate API call to test connection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock connection test logic
      const isValid = Object.values(credentials).every(value => value && value.trim().length > 0);

      if (!isValid) {
        throw new Error('Invalid credentials provided');
      }

      // Randomly simulate some connection failures for demo purposes
      if (Math.random() < 0.1) {
        throw new Error('Connection timeout');
      }

      setConnectionStatus(prev => ({ ...prev, [integrationId]: 'connected' }));
      return { success: true, message: 'Connection successful!' };

    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, [integrationId]: 'failed' }));
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    } finally {
      setIsConnecting(null);
    }
  }, []);

  // Connect to selected integrations
  const connectSelectedIntegrations = useCallback(async () => {
    const results: Record<string, { success: boolean; message: string }> = {};

    for (const integrationId of selectedIntegrations) {
      const template = integrationTemplates.find(t => t.id === integrationId);
      if (!template) continue;

      // Get credentials from current integration data
      let credentials: Record<string, string> = {};

      switch (template.category) {
        case 'deputy':
          credentials = {
            apiKey: integrationData.deputy.apiKey || '',
            subdomain: integrationData.deputy.subdomain || ''
          };
          break;
        case 'accounting':
          credentials = integrationData.accounting.credentials || {};
          break;
        // Add other categories as needed
      }

      results[integrationId] = await testConnection(integrationId, credentials);
    }

    return results;
  }, [selectedIntegrations, integrationTemplates, integrationData, testConnection]);

  // Get integration setup status
  const getSetupStatus = useCallback(() => {
    const totalSelected = selectedIntegrations.size;
    const connected = Object.values(connectionStatus).filter(status => status === 'connected').length;
    const failed = Object.values(connectionStatus).filter(status => status === 'failed').length;
    const pending = Object.values(connectionStatus).filter(status => status === 'pending').length;

    return {
      totalSelected,
      connected,
      failed,
      pending,
      completionPercentage: totalSelected > 0 ? (connected / totalSelected) * 100 : 0,
      allConnected: totalSelected > 0 && connected === totalSelected,
      hasFailures: failed > 0
    };
  }, [selectedIntegrations, connectionStatus]);

  // Get recommended integrations based on company profile
  const getRecommendedIntegrations = useCallback((companySize: string, industry: string) => {
    const recommendations: string[] = [];

    // Always recommend Deputy for workforce management
    recommendations.push('deputy');

    // Recommend accounting based on company size
    if (companySize === 'SMALL') {
      recommendations.push('xero', 'zoho');
    } else if (companySize === 'MEDIUM') {
      recommendations.push('xero', 'quickbooks');
    } else {
      recommendations.push('sage', 'quickbooks');
    }

    // Always recommend communication tools
    recommendations.push('twilio', 'sendgrid');

    // Recommend payroll for larger companies
    if (companySize !== 'SMALL') {
      recommendations.push('adp');
    }

    return integrationTemplates.filter(template => recommendations.includes(template.id));
  }, [integrationTemplates]);

  // Generate final integration configuration for onboarding
  const generateIntegrationConfig = useCallback((): IntegrationsSetupData => {
    const config = { ...integrationData };

    // Enable selected integrations
    selectedIntegrations.forEach(integrationId => {
      const template = integrationTemplates.find(t => t.id === integrationId);
      if (!template) return;

      switch (template.category) {
        case 'deputy':
          config.deputy.enabled = true;
          break;
        case 'accounting':
          if (template.id !== 'none') {
            config.accounting.provider = template.id.toUpperCase() as AccountingProvider;
            config.accounting.enabled = true;
          }
          break;
        case 'payroll':
          config.payroll.provider = template.name;
          config.payroll.enabled = true;
          break;
        case 'communication':
          if (template.id === 'twilio') {
            config.communication.sms.enabled = true;
            config.communication.sms.provider = 'Twilio';
          } else if (template.id === 'sendgrid') {
            config.communication.email.enabled = true;
            config.communication.email.provider = 'SendGrid';
          } else if (template.id === 'whatsapp-business') {
            config.communication.whatsapp.enabled = true;
          }
          break;
      }
    });

    return config;
  }, [integrationData, selectedIntegrations, integrationTemplates]);

  // Bulk integration actions
  const selectRecommendedIntegrations = useCallback((companySize: string, industry: string) => {
    const recommended = getRecommendedIntegrations(companySize, industry);
    setSelectedIntegrations(new Set(recommended.map(r => r.id)));
  }, [getRecommendedIntegrations]);

  const selectPopularIntegrations = useCallback(() => {
    setSelectedIntegrations(new Set(popularIntegrations.map(p => p.id)));
  }, [popularIntegrations]);

  const clearAllSelections = useCallback(() => {
    setSelectedIntegrations(new Set());
    setConnectionStatus({});
  }, []);

  // Integration validation
  const validateIntegrations = useCallback(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if Deputy is enabled but missing credentials
    if (integrationData.deputy.enabled && (!integrationData.deputy.apiKey || !integrationData.deputy.subdomain)) {
      errors.push('Deputy integration requires API key and subdomain');
    }

    // Check accounting integration
    if (integrationData.accounting.enabled &&
        integrationData.accounting.provider !== AccountingProvider.NONE &&
        !integrationData.accounting.credentials) {
      errors.push('Accounting integration requires valid credentials');
    }

    // Warnings for no integrations selected
    if (selectedIntegrations.size === 0) {
      warnings.push('No integrations selected - you can add them later');
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }, [integrationData, selectedIntegrations]);

  return {
    // State
    selectedIntegrations,
    integrationData,
    isConnecting,
    connectionStatus,

    // Templates and recommendations
    integrationTemplates,
    popularIntegrations,
    getIntegrationsByCategory,
    getRecommendedIntegrations,

    // Selection management
    toggleIntegration,
    selectRecommendedIntegrations,
    selectPopularIntegrations,
    clearAllSelections,

    // Configuration updates
    updateDeputyConfig,
    updateAccountingConfig,
    updatePayrollConfig,
    updateCommunicationConfig,
    addCustomIntegration,
    removeCustomIntegration,

    // Connection management
    testConnection,
    connectSelectedIntegrations,

    // Status and validation
    getSetupStatus,
    validateIntegrations,

    // Final configuration
    generateIntegrationConfig,

    // Utilities
    isIntegrationSelected: (id: string) => selectedIntegrations.has(id),
    getIntegrationById: (id: string) => integrationTemplates.find(t => t.id === id),
    hasSelectedIntegrations: selectedIntegrations.size > 0
  };
}

export default useIntegrationSetup;