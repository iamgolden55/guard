from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
import hashlib
import hmac
import json
import logging

from .models import (
    AccountingProvider, ProviderConnection, AccountMapping, VATCodeMapping,
    EarningsTypeMapping, ContactMapping, InvoiceExport, PayrollExport,
    WebhookEvent, SyncLog
)
from .serializers import (
    AccountingProviderSerializer, ProviderConnectionSerializer, AccountMappingSerializer,
    VATCodeMappingSerializer, EarningsTypeMappingSerializer, ContactMappingSerializer,
    InvoiceExportSerializer, PayrollExportSerializer, SyncLogSerializer,
    OAuthInitiateSerializer, OAuthCallbackSerializer, InvoiceExportRequestSerializer,
    PayrollExportRequestSerializer, TestConnectionSerializer, WebhookEventSerializer,
    ProviderAccountSerializer, ProviderVATCodeSerializer, ProviderEarningsTypeSerializer
)
from .services import FinanceIntegrationService, ConnectionSetupService
from .providers.factory import ProviderFactory
from api.models import Invoice
from api.middleware.tenant_middleware import resolve_request_company
from .scoping import company_connections

User = get_user_model()
logger = logging.getLogger(__name__)


class AccountingProviderViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for accounting providers"""
    
    queryset = AccountingProvider.objects.filter(is_active=True)
    serializer_class = AccountingProviderSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def supported(self, request):
        """Get list of supported providers"""
        supported_providers = ProviderFactory.get_supported_providers()
        return Response(supported_providers)


class ProviderConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for provider connections"""

    serializer_class = ProviderConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter connections by the request's company (multi-tenant isolation)"""
        return company_connections(self.request).select_related('provider', 'created_by')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test connection to accounting provider"""
        connection = self.get_object()
        
        try:
            service = FinanceIntegrationService(connection)
            success, error_message = service.test_connection()
            
            response_data = {'success': success}
            if error_message:
                response_data['error_message'] = error_message
            
            # Get company info if connection is successful
            if success:
                try:
                    company_info = service.provider.get_company_info()
                    response_data['company_info'] = {
                        'name': company_info.name,
                        'currency': company_info.currency,
                        'country_code': company_info.country_code
                    }
                except Exception as e:
                    logger.warning(f"Failed to get company info: {str(e)}")
            
            serializer = TestConnectionSerializer(data=response_data)
            serializer.is_valid(raise_exception=True)
            
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception(f"Connection test failed for connection {pk}")
            return Response(
                {'success': False, 'error_message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def refresh_token(self, request, pk=None):
        """Refresh OAuth token for connection"""
        connection = self.get_object()
        
        try:
            service = FinanceIntegrationService(connection)
            service.refresh_connection_token()
            
            # Return updated connection data
            serializer = self.get_serializer(connection)
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception(f"Token refresh failed for connection {pk}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def accounts(self, request, pk=None):
        """Get chart of accounts from provider"""
        connection = self.get_object()
        
        try:
            service = FinanceIntegrationService(connection)
            accounts = service.provider.list_accounts()
            
            serializer = ProviderAccountSerializer(accounts, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception(f"Failed to get accounts for connection {pk}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def vat_codes(self, request, pk=None):
        """Get VAT codes from provider"""
        connection = self.get_object()
        
        try:
            service = FinanceIntegrationService(connection)
            vat_codes = service.provider.list_vat_codes()
            
            serializer = ProviderVATCodeSerializer(vat_codes, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception(f"Failed to get VAT codes for connection {pk}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def earnings_types(self, request, pk=None):
        """Get earnings types from provider (if payroll supported)"""
        connection = self.get_object()
        
        try:
            service = FinanceIntegrationService(connection)
            
            if not service.provider.supports_payroll():
                return Response(
                    {'error': 'Provider does not support payroll'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            earnings_types = service.provider.list_earnings_types()
            
            serializer = ProviderEarningsTypeSerializer(earnings_types, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception(f"Failed to get earnings types for connection {pk}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def get_user_company_connection_filter(request):
    """
    IDs of the connections reachable from this request. Empty when no company
    is in scope -- see company_connections().
    """
    return company_connections(request).values_list('id', flat=True)


class AccountMappingViewSet(viewsets.ModelViewSet):
    """ViewSet for account mappings"""

    serializer_class = AccountMappingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Get company-filtered connections
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        queryset = AccountMapping.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)

        return queryset.select_related('connection')


class VATCodeMappingViewSet(viewsets.ModelViewSet):
    """ViewSet for VAT code mappings"""

    serializer_class = VATCodeMappingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        queryset = VATCodeMapping.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)

        return queryset.select_related('connection')


class EarningsTypeMappingViewSet(viewsets.ModelViewSet):
    """ViewSet for earnings type mappings"""

    serializer_class = EarningsTypeMappingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        queryset = EarningsTypeMapping.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)

        return queryset.select_related('connection')


class ContactMappingViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for contact mappings (read-only, created automatically)"""

    serializer_class = ContactMappingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        queryset = ContactMapping.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)

        return queryset.select_related('connection', 'local_user')


class InvoiceExportViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for invoice exports"""

    serializer_class = InvoiceExportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        queryset = InvoiceExport.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)

        return queryset.select_related('connection', 'local_invoice', 'exported_by')


class PayrollExportViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for payroll exports"""

    serializer_class = PayrollExportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        queryset = PayrollExport.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)

        return queryset.select_related('connection', 'exported_by').prefetch_related('staff_users')


class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for sync logs"""

    serializer_class = SyncLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        allowed_connection_ids = get_user_company_connection_filter(self.request)

        connection_id = self.request.query_params.get('connection')
        operation = self.request.query_params.get('operation')
        level = self.request.query_params.get('level')

        queryset = SyncLog.objects.filter(connection_id__in=allowed_connection_ids)

        if connection_id:
            queryset = queryset.filter(connection_id=connection_id)
        if operation:
            queryset = queryset.filter(operation=operation)
        if level:
            queryset = queryset.filter(level=level)

        return queryset.select_related('connection', 'created_by')[:100]  # Limit to recent 100


class OAuthView(APIView):
    """Handle OAuth flows"""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Initiate OAuth flow"""
        serializer = OAuthInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            oauth_url, state = ConnectionSetupService.initiate_oauth_flow(
                provider_key=serializer.validated_data['provider_key'],
                user=request.user,
                redirect_uri=serializer.validated_data['redirect_uri'],
                is_sandbox=serializer.validated_data.get('is_sandbox', False)
            )
            
            return Response({
                'oauth_url': oauth_url,
                'state': state
            })
            
        except Exception as e:
            logger.exception(f"OAuth initiation failed")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class OAuthCallbackView(APIView):
    """Handle OAuth callback"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Complete OAuth flow"""
        serializer = OAuthCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            connection = ConnectionSetupService.complete_oauth_flow(
                provider_key=serializer.validated_data['provider_key'],
                code=serializer.validated_data['code'],
                state=serializer.validated_data['state'],
                redirect_uri=serializer.validated_data['redirect_uri'],
                user=request.user,
                tenant_id=serializer.validated_data.get('tenant_id'),
                is_sandbox=serializer.validated_data.get('is_sandbox', False)
            )

            connection_serializer = ProviderConnectionSerializer(connection)
            return Response(connection_serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.exception(f"OAuth callback failed")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class OAuthTenantsView(APIView):
    """Fetch available tenants/organizations for provider (specifically Xero)"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Get list of available tenants after OAuth token exchange

        This is used when a provider (like Xero) requires the user to select
        which organization to connect to.
        """
        # Validate request data
        required_fields = ['provider_key', 'code', 'redirect_uri']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'Missing required field: {field}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            tenant_data = ConnectionSetupService.get_available_tenants(
                provider_key=request.data['provider_key'],
                code=request.data['code'],
                redirect_uri=request.data['redirect_uri'],
                is_sandbox=request.data.get('is_sandbox', False)
            )

            return Response(tenant_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Failed to fetch tenants")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class InvoiceExportView(APIView):
    """Export invoices to accounting provider"""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Export invoices"""
        serializer = InvoiceExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check permissions before any lookup.
        if hasattr(request.user, 'role') and request.user.role not in ['admin', 'manager']:
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Both lookups stay OUTSIDE the try below: Http404 subclasses Exception,
        # so a 404 raised inside would be swallowed and returned as a 500.
        company = resolve_request_company(request)
        connection = get_object_or_404(
            company_connections(request),
            id=serializer.validated_data['connection_id']
        )

        # Invoices must belong to the same company as the connection. Without
        # this, any admin could push another company's invoice into this org.
        invoice_scope = Invoice.objects.none() if not company else Invoice.objects.filter(
            staff_user__company_memberships__company=company,
            staff_user__company_memberships__is_active=True
        ).distinct()

        requested_ids = serializer.validated_data['invoice_ids']
        invoices = {i.id: i for i in invoice_scope.filter(id__in=requested_ids)}
        missing = [i for i in requested_ids if i not in invoices]
        if missing:
            # Reject the whole batch rather than exporting part of it: a foreign
            # id means the caller is reaching outside their company, and we do
            # not disclose whether it exists.
            return Response(
                {'error': 'One or more invoices were not found', 'invoice_ids': missing},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            service = FinanceIntegrationService(connection)
            export_results = []

            for invoice_id in requested_ids:
                invoice = invoices[invoice_id]
                
                try:
                    export_record = service.export_invoice(invoice, request.user)
                    export_results.append({
                        'invoice_id': invoice_id,
                        'export_id': export_record.id,
                        'status': export_record.status,
                        'provider_invoice_id': export_record.provider_invoice_id
                    })
                except Exception as e:
                    export_results.append({
                        'invoice_id': invoice_id,
                        'status': 'failed',
                        'error': str(e)
                    })
            
            return Response({'exports': export_results})
            
        except Exception as e:
            logger.exception(f"Invoice export failed")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PayrollExportView(APIView):
    """Export payroll to accounting provider"""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Export payroll"""
        serializer = PayrollExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check permissions before any lookup.
        if hasattr(request.user, 'role') and request.user.role not in ['admin']:
            return Response(
                {'error': 'Insufficient permissions'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Outside the try -- Http404 would otherwise surface as a 500.
        company = resolve_request_company(request)
        connection = get_object_or_404(
            company_connections(request),
            id=serializer.validated_data['connection_id']
        )

        # Staff must belong to the same company as the connection.
        requested_staff_ids = serializer.validated_data['staff_user_ids']
        staff_users = User.objects.none() if not company else User.objects.filter(
            id__in=requested_staff_ids,
            company_memberships__company=company,
            company_memberships__is_active=True
        ).distinct()

        missing_staff = set(requested_staff_ids) - set(staff_users.values_list('id', flat=True))
        if missing_staff:
            return Response(
                {'error': 'One or more staff users were not found',
                 'staff_user_ids': sorted(missing_staff)},
                status=status.HTTP_404_NOT_FOUND
            )

        # The Xero payroll client targets payroll.xro/1.0 -- the AUSTRALIAN
        # Payroll API. UK payroll is payroll.xro/2.0 with a different
        # employee/payrun model, so every call here 404s for a UK company.
        # Fail honestly rather than mysteriously.
        #
        # Deliberately placed AFTER the permission and tenant checks so a
        # cross-company request still gets 404 and learns nothing about what
        # exists. The service layer (FinanceIntegrationService.export_payroll_batch)
        # is left intact for whoever ports this to payroll.xro/2.0; re-wiring
        # this view is then a few lines.
        return Response(
            {'error': 'Payroll export is not yet supported for this provider.'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )


@method_decorator(csrf_exempt, name='dispatch')
class WebhookView(APIView):
    """Handle incoming webhooks from accounting providers"""
    
    authentication_classes = []  # Webhooks don't use standard auth
    permission_classes = []

    def verify_webhook_signature(self, request):
        """Verify HMAC-SHA256 webhook signature for request authenticity."""
        signature = request.headers.get('X-Webhook-Signature', '')
        if not signature:
            return False
        secret = getattr(settings, 'WEBHOOK_SECRET', '')
        if not secret:
            logger.warning("WEBHOOK_SECRET not configured")
            return False
        expected = hmac.new(
            secret.encode('utf-8'),
            request.body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)

    def post(self, request, provider_key):
        """Process webhook from accounting provider"""
        if not self.verify_webhook_signature(request):
            return HttpResponse(
                'Invalid or missing webhook signature',
                status=403
            )
        try:
            # Find the provider
            provider_model = get_object_or_404(
                AccountingProvider,
                provider_key=provider_key,
                is_active=True
            )
            
            # Get raw payload
            raw_payload = request.body
            signature = request.headers.get('X-Webhook-Signature', '')
            
            # Parse JSON payload
            try:
                payload_data = json.loads(raw_payload)
            except json.JSONDecodeError:
                return HttpResponse(
                    'Invalid JSON payload',
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Find relevant connections and verify signatures
            connections = ProviderConnection.objects.filter(
                provider=provider_model,
                status='connected'
            )
            
            webhook_events = []
            for connection in connections:
                # Create webhook event record
                webhook_event = WebhookEvent.objects.create(
                    connection=connection,
                    event_type=payload_data.get('eventType', 'unknown'),
                    event_id=payload_data.get('eventId', ''),
                    raw_payload=payload_data,
                    signature=signature,
                    status='pending'
                )
                webhook_events.append(webhook_event)
                
                try:
                    # Verify signature
                    service = FinanceIntegrationService(connection)
                    if not service.provider.verify_webhook_signature(raw_payload, signature):
                        webhook_event.status = 'failed'
                        webhook_event.error_message = 'Invalid signature'
                        webhook_event.save()
                        continue
                    
                    # Process webhook
                    webhook_event.status = 'processing'
                    webhook_event.save()
                    
                    service.sync_payment_status(payload_data)
                    
                    webhook_event.status = 'processed'
                    webhook_event.processed_at = timezone.now()
                    webhook_event.save()
                    
                except Exception as e:
                    webhook_event.status = 'failed'
                    webhook_event.error_message = str(e)
                    webhook_event.save()
                    logger.exception(f"Webhook processing failed for connection {connection.id}")
            
            return HttpResponse('OK', status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception(f"Webhook handler failed for provider {provider_key}")
            return HttpResponse(
                'Internal server error',
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )