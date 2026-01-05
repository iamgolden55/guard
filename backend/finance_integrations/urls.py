from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create router and register viewsets
router = DefaultRouter()
router.register(r'providers', views.AccountingProviderViewSet, basename='accountingprovider')
router.register(r'connections', views.ProviderConnectionViewSet, basename='providerconnection')
router.register(r'account-mappings', views.AccountMappingViewSet, basename='accountmapping')
router.register(r'vat-mappings', views.VATCodeMappingViewSet, basename='vatcodemapping')
router.register(r'earnings-mappings', views.EarningsTypeMappingViewSet, basename='earningstypemapping')
router.register(r'contact-mappings', views.ContactMappingViewSet, basename='contactmapping')
router.register(r'invoice-exports', views.InvoiceExportViewSet, basename='invoiceexport')
router.register(r'payroll-exports', views.PayrollExportViewSet, basename='payrollexport')
router.register(r'logs', views.SyncLogViewSet, basename='synclog')

app_name = 'finance_integrations'

urlpatterns = [
    # API routes
    path('', include(router.urls)),
    
    # OAuth flows
    path('oauth/initiate/', views.OAuthView.as_view(), name='oauth-initiate'),
    path('oauth/callback/', views.OAuthCallbackView.as_view(), name='oauth-callback'),
    path('oauth/tenants/', views.OAuthTenantsView.as_view(), name='oauth-tenants'),

    # Export operations
    path('export/invoices/', views.InvoiceExportView.as_view(), name='export-invoices'),
    path('export/payroll/', views.PayrollExportView.as_view(), name='export-payroll'),
    
    # Webhooks (no authentication required)
    path('webhooks/<str:provider_key>/', views.WebhookView.as_view(), name='webhook'),
]