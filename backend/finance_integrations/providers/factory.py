from typing import Dict, Any, Type
from .base import AccountingProvider
from .xero import XeroProvider
from .quickbooks import QuickBooksProvider
from .sage import SageProvider


class ProviderFactory:
    """Factory for creating accounting provider instances"""
    
    _providers: Dict[str, Type[AccountingProvider]] = {
        'xero': XeroProvider,
        'quickbooks': QuickBooksProvider,
        'sage': SageProvider,
        # Future providers will be added here:
        # 'freeagent': FreeAgentProvider,
        # 'freshbooks': FreshBooksProvider,
        # 'zoho': ZohoProvider,
        # 'wave': WaveProvider,
        # 'netsuite': NetSuiteProvider,
    }
    
    @classmethod
    def create_provider(cls, provider_key: str, connection_config: Dict[str, Any]) -> AccountingProvider:
        """
        Create a provider instance
        
        Args:
            provider_key: Provider identifier (e.g., 'xero', 'quickbooks')
            connection_config: Configuration dictionary
            
        Returns:
            AccountingProvider instance
            
        Raises:
            ValueError: If provider is not supported
        """
        if provider_key not in cls._providers:
            raise ValueError(f"Unsupported provider: {provider_key}")
        
        provider_class = cls._providers[provider_key]
        return provider_class(connection_config)
    
    @classmethod
    def get_supported_providers(cls) -> Dict[str, str]:
        """
        Get list of supported providers
        
        Returns:
            Dictionary mapping provider keys to display names
        """
        # Return hardcoded provider names to avoid instantiation issues
        return {
            'xero': 'Xero',
            'quickbooks': 'QuickBooks Online', 
            'sage': 'Sage Business Cloud'
        }
    
    @classmethod
    def register_provider(cls, provider_key: str, provider_class: Type[AccountingProvider]) -> None:
        """
        Register a new provider
        
        Args:
            provider_key: Provider identifier
            provider_class: Provider class
        """
        cls._providers[provider_key] = provider_class