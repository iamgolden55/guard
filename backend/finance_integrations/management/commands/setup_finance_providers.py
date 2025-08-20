from django.core.management.base import BaseCommand
from finance_integrations.models import AccountingProvider


class Command(BaseCommand):
    help = 'Set up initial accounting provider records'

    def handle(self, *args, **options):
        providers = [
            {
                'provider_key': 'xero',
                'display_name': 'Xero',
                'oauth_scopes': 'accounting.transactions,accounting.contacts.read,accounting.settings,payroll.employees,payroll.payruns,payroll.settings,files',
                'api_base_url': 'https://api.xero.com',
            },
            {
                'provider_key': 'quickbooks',
                'display_name': 'QuickBooks Online',
                'oauth_scopes': 'com.intuit.quickbooks.accounting,openid,profile',
                'api_base_url': 'https://sandbox-quickbooks.api.intuit.com',
            },
            {
                'provider_key': 'freeagent',
                'display_name': 'FreeAgent',
                'oauth_scopes': 'client_credentials',
                'api_base_url': 'https://api.freeagent.com',
            },
            {
                'provider_key': 'freshbooks',
                'display_name': 'FreshBooks',
                'oauth_scopes': 'user:profile:read,user:invoice:write,user:payment:read',
                'api_base_url': 'https://api.freshbooks.com',
            },
            {
                'provider_key': 'zoho',
                'display_name': 'Zoho Books',
                'oauth_scopes': 'ZohoBooks.fullaccess.all',
                'api_base_url': 'https://books.zoho.com/api/v3',
            },
            {
                'provider_key': 'sage',
                'display_name': 'Sage Business Cloud',
                'oauth_scopes': 'full_access',
                'api_base_url': 'https://api.accounting.sage.com',
            },
            {
                'provider_key': 'wave',
                'display_name': 'Wave Accounting',
                'oauth_scopes': 'wave.business:read,wave.business:write',
                'api_base_url': 'https://gql.waveapps.com',
            },
            {
                'provider_key': 'netsuite',
                'display_name': 'NetSuite',
                'oauth_scopes': 'restlets,rest_webservices',
                'api_base_url': 'https://rest.na3.netsuite.com',
            },
        ]

        for provider_data in providers:
            provider, created = AccountingProvider.objects.get_or_create(
                provider_key=provider_data['provider_key'],
                defaults={
                    'display_name': provider_data['display_name'],
                    'oauth_scopes': provider_data['oauth_scopes'],
                    'api_base_url': provider_data['api_base_url'],
                    'is_active': True,
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created provider: {provider.display_name}')
                )
            else:
                self.stdout.write(f'Provider already exists: {provider.display_name}')

        self.stdout.write(
            self.style.SUCCESS('Successfully set up accounting providers')
        )