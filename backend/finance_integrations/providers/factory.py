from typing import Dict, Any, Type
from .base import AccountingProvider
from .xero import XeroProvider
# NOT imported on purpose -- QuickBooksProvider and SageProvider each leave 11
# of the base class's 17 abstract methods unimplemented, so instantiating
# either raises TypeError. Registering them made the UI advertise providers
# that 500 the moment anyone clicks Connect. Re-add once they are finished and
# ProviderFactoryTests passes for them.
# from .quickbooks import QuickBooksProvider
# from .sage import SageProvider


class ProviderFactory:
    """Factory for creating accounting provider instances"""
    
    # Only providers that are actually implemented belong here: this dict is
    # the single source of truth for what the API advertises as connectable.
    _providers: Dict[str, Type[AccountingProvider]] = {
        'xero': XeroProvider,
    }

    # Display names for the keys above (and for any future provider).
    _display_names: Dict[str, str] = {
        'xero': 'Xero',
        'quickbooks': 'QuickBooks Online',
        'sage': 'Sage Business Cloud',
        'freeagent': 'FreeAgent',
        'freshbooks': 'FreshBooks',
        'zoho': 'Zoho Books',
        'wave': 'Wave Accounting',
        'netsuite': 'NetSuite',
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
        # Derived from the registry -- a hardcoded list drifts, and this
        # endpoint is what the admin UI trusts when deciding what to offer.
        return {
            key: cls._display_names.get(key, key.title())
            for key in cls._providers
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