"""
Tests for the finance integrations app.

Run with:
    docker compose exec api python manage.py test finance_integrations -v 2

Always pass the `finance_integrations` label -- a bare `manage.py test`
discovers the standalone test_*.py scripts at backend/ root, which perform live
HTTP at import time and abort discovery.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import (
    BankHoliday, Invoice, InvoiceItem, SecurityCompany, Shift,
    UserCompanyMembership, Venue,
)

from .models import AccountingProvider, InvoiceExport, ProviderConnection
from .providers.base import AccountingProvider as BaseProvider, OAuthTokens
from .providers.factory import ProviderFactory
from .providers.xero import XeroProvider
from .services import ConnectionSetupService, FinanceIntegrationService

User = get_user_model()

DUMMY_CONFIG = {'client_id': 'cid', 'client_secret': 'secret'}


class ProviderFactoryTests(TestCase):
    """
    The registry must only advertise providers that actually work.

    QuickBooksProvider and SageProvider each left 11 of the base class's 17
    abstract methods unimplemented, so create_provider() raised
    `TypeError: Can't instantiate abstract class` before any network call --
    while the UI showed both as "Available". A single test would have caught it.
    """

    def test_every_registered_provider_is_instantiable(self):
        self.assertTrue(ProviderFactory._providers, "registry must not be empty")
        for key in ProviderFactory._providers:
            with self.subTest(provider=key):
                provider = ProviderFactory.create_provider(key, dict(DUMMY_CONFIG))
                self.assertIsInstance(provider, BaseProvider)

    def test_supported_providers_matches_registry(self):
        self.assertEqual(
            set(ProviderFactory.get_supported_providers()),
            set(ProviderFactory._providers),
        )

    def test_unknown_provider_raises_value_error(self):
        with self.assertRaises(ValueError):
            ProviderFactory.create_provider('definitely_not_a_provider', dict(DUMMY_CONFIG))

    def test_xero_implements_every_abstract_method(self):
        self.assertEqual(XeroProvider.__abstractmethods__, frozenset())


class XeroProviderOAuthTests(TestCase):
    """Pure string/paramater assertions -- no network."""

    def setUp(self):
        self.provider = XeroProvider(dict(DUMMY_CONFIG))

    def _scope_param(self):
        url = self.provider.get_oauth_url('state-123', 'https://example.test/cb')
        return parse_qs(urlparse(url).query)['scope'][0].split()

    def test_scopes_request_offline_access(self):
        # Without offline_access Xero returns no refresh token and the
        # connection dies roughly 30 minutes after consent.
        self.assertIn('offline_access', self._scope_param())

    def test_scopes_allow_contact_writes(self):
        # upsert_contact() POSTs contacts, so the read-only scope 403s.
        scopes = self._scope_param()
        self.assertIn('accounting.contacts', scopes)
        self.assertNotIn('accounting.contacts.read', scopes)

    def test_scopes_exclude_payroll(self):
        # The payroll client targets the Australian payroll.xro/1.0 API, so we
        # do not ask users to consent to something that cannot work.
        self.assertFalse([s for s in self._scope_param() if s.startswith('payroll')])

    def test_authorize_url_uses_login_host(self):
        url = self.provider.get_oauth_url('state-123', 'https://example.test/cb')
        self.assertTrue(
            url.startswith('https://login.xero.com/identity/connect/authorize'),
            f'unexpected authorize URL: {url}',
        )

    def test_token_url_uses_identity_host(self):
        self.assertEqual(
            self.provider.oauth_token_url,
            'https://identity.xero.com/connect/token',
        )

    def test_get_tenants_hits_api_host(self):
        with mock.patch.object(XeroProvider, '_make_request') as make_request:
            make_request.return_value.json.return_value = []
            self.provider.get_tenants()
        make_request.assert_called_once_with('GET', 'https://api.xero.com/connections')

    def test_exchange_oauth_code_returns_aware_expiry(self):
        payload = {'access_token': 'a', 'refresh_token': 'r', 'expires_in': 1800}
        with mock.patch('finance_integrations.providers.xero.requests.post') as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = payload
            tokens = self.provider.exchange_oauth_code('code', 'https://example.test/cb')
        self.assertTrue(timezone.is_aware(tokens.expires_at))

    def test_refresh_tokens_returns_aware_expiry(self):
        payload = {'access_token': 'a2', 'refresh_token': 'r2', 'expires_in': 1800}
        with mock.patch('finance_integrations.providers.xero.requests.post') as post:
            post.return_value.status_code = 200
            post.return_value.json.return_value = payload
            tokens = self.provider.refresh_tokens('old-refresh')
        self.assertTrue(timezone.is_aware(tokens.expires_at))


class ProviderConnectionModelTests(TestCase):
    def setUp(self):
        self.provider = AccountingProvider.objects.create(
            provider_key='xero', display_name='Xero'
        )

    def test_is_token_valid_with_provider_supplied_expiry(self):
        """
        Assign a provider-supplied expiry to an UNSAVED instance, exactly as the
        OAuth callback and refresh paths do. Saving and reloading would coerce
        the value and hide the naive-vs-aware TypeError this guards against.
        """
        tokens = OAuthTokens(
            access_token='a',
            refresh_token='r',
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        connection = ProviderConnection(
            provider=self.provider,
            tenant_id='t1',
            token_expires_at=tokens.expires_at,
        )
        self.assertTrue(connection.is_token_valid())


class OAuthStateTests(TestCase):
    def setUp(self):
        cache.clear()
        self.provider = AccountingProvider.objects.create(
            provider_key='xero', display_name='Xero',
            oauth_client_id='cid', oauth_client_secret='secret', is_active=True,
        )
        self.user = User.objects.create_user(
            username='oauthuser', email='oauth@test.com', password='pw', role='admin'
        )
        self.other = User.objects.create_user(
            username='oauthother', email='other@test.com', password='pw', role='admin'
        )

    def test_initiate_stores_state(self):
        _url, state = ConnectionSetupService.initiate_oauth_flow(
            'xero', self.user, 'https://example.test/cb'
        )
        self.assertIsNotNone(cache.get(f'finance_oauth_state:{state}'))

    def test_unknown_state_is_rejected(self):
        with self.assertRaises(ValueError):
            ConnectionSetupService._consume_oauth_state('never-issued', self.user, 'xero')

    def test_state_issued_to_another_user_is_rejected(self):
        _url, state = ConnectionSetupService.initiate_oauth_flow(
            'xero', self.user, 'https://example.test/cb'
        )
        with self.assertRaises(ValueError):
            ConnectionSetupService._consume_oauth_state(state, self.other, 'xero')

    def test_state_is_single_use(self):
        _url, state = ConnectionSetupService.initiate_oauth_flow(
            'xero', self.user, 'https://example.test/cb'
        )
        ConnectionSetupService._consume_oauth_state(state, self.user, 'xero')
        with self.assertRaises(ValueError):
            ConnectionSetupService._consume_oauth_state(state, self.user, 'xero')


class FinanceFixtureMixin:
    """Two companies, each with its own admin, connection, staff and invoice."""

    def build_world(self):
        self.provider = AccountingProvider.objects.create(
            provider_key='xero', display_name='Xero', is_active=True
        )
        self.company_a = SecurityCompany.objects.create(name='Alpha', registration_number='A1')
        self.company_b = SecurityCompany.objects.create(name='Bravo', registration_number='B1')

        self.admin_a = self._admin('admin_a', self.company_a)
        self.admin_b = self._admin('admin_b', self.company_b)
        # Belongs to BOTH, primary A. Essential: single-company admins are
        # already isolated by the old union fallback, so they cannot catch
        # the bug this suite exists for.
        self.admin_ab = self._admin('admin_ab', self.company_a, is_owner=True)
        UserCompanyMembership.objects.create(
            user=self.admin_ab, company=self.company_b, is_active=True
        )

        self.staff_a = self._staff('staff_a', self.company_a)
        self.staff_b = self._staff('staff_b', self.company_b)

        self.conn_a = self._connection(self.admin_a, 'tenant-a')
        self.conn_b = self._connection(self.admin_b, 'tenant-b')

        self.invoice_a = self._invoice(self.staff_a)
        self.invoice_b = self._invoice(self.staff_b)

    def _admin(self, username, company, is_owner=False):
        user = User.objects.create_user(
            username=username, email=f'{username}@test.com', password='pw', role='admin'
        )
        UserCompanyMembership.objects.create(
            user=user, company=company, is_active=True, is_owner=is_owner
        )
        return user

    def _staff(self, username, company):
        user = User.objects.create_user(
            username=username, email=f'{username}@test.com', password='pw', role='staff'
        )
        UserCompanyMembership.objects.create(user=user, company=company, is_active=True)
        return user

    def _connection(self, created_by, tenant_id):
        return ProviderConnection.objects.create(
            provider=self.provider,
            company_name=f'Org {tenant_id}',
            tenant_id=tenant_id,
            access_token='a',
            refresh_token='r',
            token_expires_at=timezone.now() + timedelta(minutes=30),
            status='connected',
            created_by=created_by,
        )

    def _invoice(self, staff_user):
        return Invoice.objects.create(
            staff_user=staff_user,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 7),
            total_hours=Decimal('10.00'),
            hourly_rate=Decimal('12.00'),
            total_amount=Decimal('120.00'),
            status='approved',
        )


class TenantIsolationTests(FinanceFixtureMixin, APITestCase):
    """
    Regression suite for the cross-tenant hole: export endpoints fetched the
    connection and the invoice by bare id with no company filter, so any admin
    could push another company's invoice into that company's accounting org.
    """

    CONNECTIONS = '/api/v1/finance/connections/'
    INVOICE_EXPORT = '/api/v1/finance/export/invoices/'
    PAYROLL_EXPORT = '/api/v1/finance/export/payroll/'
    ACCOUNT_MAPPINGS = '/api/v1/finance/account-mappings/'

    @staticmethod
    def _rows(response):
        """The list endpoints are paginated; unwrap when they are."""
        data = response.data
        return data['results'] if isinstance(data, dict) and 'results' in data else data

    def setUp(self):
        self.build_world()
        # Nothing in this suite may reach a provider.
        patcher = mock.patch(
            'finance_integrations.views.FinanceIntegrationService',
            autospec=True,
        )
        self.service_cls = patcher.start()
        self.addCleanup(patcher.stop)

        # Concrete, JSON-encodable return values. A bare MagicMock here means a
        # REGRESSION (export wrongly proceeding) renders MagicMock attributes
        # into the response, which hangs the JSON encoder and kills the test
        # process -- so the suite would die instead of reporting a clean
        # failure. With real values a regression fails as a readable assertion.
        self.service_cls.return_value.export_invoice.return_value = mock.Mock(
            id=1, status='completed', provider_invoice_id='provider-invoice-1'
        )

    def test_connection_list_excludes_other_company(self):
        self.client.force_authenticate(self.admin_a)
        ids = [row['id'] for row in self._rows(self.client.get(self.CONNECTIONS))]
        self.assertEqual(ids, [self.conn_a.id])

    def test_multi_company_admin_sees_only_primary_company(self):
        """
        The load-bearing case. Single-company admins were already isolated by
        the old union fallback; an admin of BOTH A and B saw both connections
        at once, which is what let one company's invoice reach the other's org.
        admin_ab owns A, so A is the resolved company.
        """
        self.client.force_authenticate(self.admin_ab)
        ids = [row['id'] for row in self._rows(self.client.get(self.CONNECTIONS))]
        self.assertEqual(ids, [self.conn_a.id])
        self.assertNotIn(self.conn_b.id, ids)

    def test_connection_detail_other_company_is_404(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.get(f'{self.CONNECTIONS}{self.conn_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_test_connection_action_other_company_is_404(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(f'{self.CONNECTIONS}{self.conn_b.id}/test_connection/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_with_no_membership_sees_nothing(self):
        stranger = User.objects.create_user(
            username='stranger', email='s@test.com', password='pw', role='admin'
        )
        self.client.force_authenticate(stranger)
        self.assertEqual(list(self._rows(self.client.get(self.CONNECTIONS))), [])

    def test_invoice_export_rejects_foreign_connection(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.INVOICE_EXPORT, {
            'connection_id': self.conn_b.id,
            'invoice_ids': [self.invoice_a.id],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.service_cls.assert_not_called()
        self.assertEqual(InvoiceExport.objects.count(), 0)

    def test_invoice_export_rejects_foreign_invoice(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.INVOICE_EXPORT, {
            'connection_id': self.conn_a.id,
            'invoice_ids': [self.invoice_b.id],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.service_cls.assert_not_called()
        self.assertEqual(InvoiceExport.objects.count(), 0)

    def test_invoice_export_rejects_mixed_batch(self):
        """One foreign id poisons the batch -- nothing is exported."""
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.INVOICE_EXPORT, {
            'connection_id': self.conn_a.id,
            'invoice_ids': [self.invoice_a.id, self.invoice_b.id],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.service_cls.assert_not_called()

    def test_payroll_export_rejects_foreign_connection(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.PAYROLL_EXPORT, {
            'connection_id': self.conn_b.id,
            'staff_user_ids': [self.staff_a.id],
            'start_date': '2026-01-01',
            'end_date': '2026-01-07',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.service_cls.assert_not_called()

    def test_payroll_export_rejects_foreign_staff(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.PAYROLL_EXPORT, {
            'connection_id': self.conn_a.id,
            'staff_user_ids': [self.staff_b.id],
            'start_date': '2026-01-01',
            'end_date': '2026-01-07',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.service_cls.assert_not_called()

    def test_payroll_export_reports_not_implemented_for_own_company(self):
        """
        A legitimate request gets an honest 501 -- the Xero payroll client
        targets the Australian payroll API and cannot work for a UK company.
        Cross-company requests still get 404 (see the two tests above), so the
        501 never confirms that another tenant's connection exists.
        """
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.PAYROLL_EXPORT, {
            'connection_id': self.conn_a.id,
            'staff_user_ids': [self.staff_a.id],
            'start_date': '2026-01-01',
            'end_date': '2026-01-07',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_501_NOT_IMPLEMENTED)
        self.service_cls.assert_not_called()

    def test_account_mapping_create_rejects_foreign_connection(self):
        self.client.force_authenticate(self.admin_a)
        response = self.client.post(self.ACCOUNT_MAPPINGS, {
            'connection': self.conn_b.id,
            'mapping_type': 'expense',
            'local_account_name': 'Wages',
            'provider_account_id': '400',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class InvoiceDraftTests(FinanceFixtureMixin, TestCase):
    def setUp(self):
        self.build_world()
        self.venue = Venue.objects.create(
            company=self.company_a, name='Test Venue', address='1 Test St',
            city='London', postal_code='SW1A 1AA', country='UK', capacity=10,
            contact_name='C', contact_phone='07700900000', contact_email='v@test.com',
            terms_and_conditions='T',
        )
        self.service = FinanceIntegrationService(self.conn_a)

    def test_draft_handles_leave_item_without_venue_or_hours(self):
        """
        Bank-holiday and leave items have null venue AND null hours_worked --
        the quantity lives in `days`. Building the draft used to raise
        AttributeError on item.venue.name and TypeError on float(None),
        failing the whole export for any invoice containing one.
        """
        holiday = BankHoliday.objects.create(
            company=self.company_a, name='Christmas Day', date=date(2026, 12, 25)
        )
        InvoiceItem.objects.create(
            invoice=self.invoice_a, item_type='bank_holiday', date=date(2026, 12, 25),
            bank_holiday=holiday, venue=None, hours_worked=None, days=Decimal('1.00'),
            description='Bank Holiday: Christmas Day',
            rate=Decimal('96.00'), amount=Decimal('96.00'),
        )
        draft = self.service._build_invoice_draft(self.invoice_a, 'contact-1')
        self.assertEqual(len(draft.line_items), 1)
        self.assertEqual(draft.line_items[0].description, 'Bank Holiday: Christmas Day')
        self.assertEqual(draft.line_items[0].quantity, 1.0)

    def test_draft_falls_back_to_item_type_when_venue_and_description_missing(self):
        """A `special` item legitimately has no venue -- describe it anyway."""
        InvoiceItem.objects.create(
            invoice=self.invoice_a, item_type='special', date=date(2026, 1, 4),
            venue=None, hours_worked=Decimal('4.00'),
            rate=Decimal('12.00'), amount=Decimal('48.00'),
        )
        draft = self.service._build_invoice_draft(self.invoice_a, 'contact-1')
        self.assertEqual(draft.line_items[0].description, 'Special Event - 2026-01-04 (4 hours)')
        self.assertEqual(draft.line_items[0].quantity, 4.0)

    def test_draft_describes_shift_items_with_venue_and_hours(self):
        now = timezone.now()
        shift = Shift.objects.create(
            staff_user=self.staff_a, venue=self.venue,
            start_time=now, end_time=now + timedelta(hours=8),
            status='completed', required_security_role='sg',
        )
        InvoiceItem.objects.create(
            invoice=self.invoice_a, item_type='shift', date=date(2026, 1, 2),
            shift=shift, venue=self.venue, hours_worked=Decimal('8.00'),
            rate=Decimal('12.00'), amount=Decimal('96.00'),
        )
        draft = self.service._build_invoice_draft(self.invoice_a, 'contact-1')
        self.assertEqual(draft.line_items[0].description, 'Test Venue - 2026-01-02 (8 hours)')
        self.assertEqual(draft.line_items[0].quantity, 8.0)

    def test_draft_prefers_stored_invoice_number(self):
        self.invoice_a.invoice_number = 'PAY-2026-00481'
        self.invoice_a.save(update_fields=['invoice_number'])
        draft = self.service._build_invoice_draft(self.invoice_a, 'contact-1')
        self.assertEqual(draft.invoice_number, 'PAY-2026-00481')

    def test_created_invoice_is_a_bill_not_a_sales_invoice(self):
        """Staff pay is money OUT: ACCPAY, matching the supplier contact."""
        provider = XeroProvider({**DUMMY_CONFIG, 'access_token': 'a', 'tenant_id': 't'})
        draft = self.service._build_invoice_draft(self.invoice_a, 'contact-1')
        with mock.patch.object(XeroProvider, '_make_request') as make_request:
            make_request.return_value.json.return_value = {
                'Invoices': [{
                    'InvoiceID': 'x', 'InvoiceNumber': 'INV-1',
                    'Status': 'DRAFT', 'Total': 120.0,
                }]
            }
            provider.create_invoice(draft)
        args, kwargs = make_request.call_args
        body = kwargs.get('data') if 'data' in kwargs else args[2]
        self.assertEqual(body['Invoices'][0]['Type'], 'ACCPAY')
