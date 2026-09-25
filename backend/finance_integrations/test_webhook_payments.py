"""
Payments arriving from an accounting provider — AUDIT-2026-09-17, Phase 2C.

`sync_payment_status` set any exported invoice to paid: a draft, a rejected
one, one nobody had approved. It never set `paid_date`, and the webhook had no
replay protection, so one delivery could be processed any number of times.

The webhook route can't reach this code today (its two signature checks can
never both pass, and it doesn't read Xero's real payload), so none of this has
fired in production. It is made safe here, before anyone wires the route up.
"""
from datetime import date
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from api.models import AuditLog

from .models import InvoiceExport, SyncLog, WebhookEvent
from .services import FinanceIntegrationService
from .tests import FinanceFixtureMixin


def _paid_event(resource_id, event_id="evt-1", **extra):
    payload = {"eventType": "invoice.paid", "eventId": event_id, "resourceId": resource_id}
    payload.update(extra)
    return payload


class PaymentSyncTests(FinanceFixtureMixin, TestCase):
    def setUp(self):
        self.build_world()
        self.export = InvoiceExport.objects.create(
            connection=self.conn_a, local_invoice=self.invoice_a,
            provider_invoice_id="XERO-INV-1", exported_by=self.admin_a,
        )

    def _sync(self, payload):
        FinanceIntegrationService(self.conn_a).sync_payment_status(payload)
        self.invoice_a.refresh_from_db()

    def test_an_approved_invoice_is_marked_paid_with_a_date(self):
        self._sync(_paid_event("XERO-INV-1", paidDate="2026-09-18"))

        self.assertEqual(self.invoice_a.status, "paid")
        self.assertEqual(self.invoice_a.paid_date, date(2026, 9, 18))
        self.assertTrue(AuditLog.objects.filter(
            action="invoice_paid", resource_id=str(self.invoice_a.pk),
        ).exists())

    def test_the_paid_date_defaults_to_today(self):
        self._sync(_paid_event("XERO-INV-1"))

        self.assertEqual(self.invoice_a.status, "paid")
        self.assertIsNotNone(self.invoice_a.paid_date)

    def test_an_unapproved_invoice_is_not_marked_paid(self):
        for status in ("draft", "pending", "rejected"):
            with self.subTest(status=status):
                self.invoice_a.status = status
                self.invoice_a.save(update_fields=["status"])

                self._sync(_paid_event("XERO-INV-1"))

                self.assertEqual(self.invoice_a.status, status)
                self.assertIsNone(self.invoice_a.paid_date)
                self.assertTrue(SyncLog.objects.filter(
                    connection=self.conn_a, level="warning",
                    message__icontains="not approved",
                ).exists())

    def test_another_tenants_export_is_not_touched(self):
        InvoiceExport.objects.create(
            connection=self.conn_b, local_invoice=self.invoice_b,
            provider_invoice_id="XERO-INV-B", exported_by=self.admin_b,
        )

        self._sync(_paid_event("XERO-INV-B"))

        self.invoice_b.refresh_from_db()
        self.assertEqual(self.invoice_b.status, "approved")


@override_settings(WEBHOOK_SECRET="test-secret")
class WebhookReplayTests(FinanceFixtureMixin, APITestCase):
    def setUp(self):
        self.build_world()
        InvoiceExport.objects.create(
            connection=self.conn_a, local_invoice=self.invoice_a,
            provider_invoice_id="XERO-INV-1", exported_by=self.admin_a,
        )

    def _deliver(self, payload):
        import hashlib
        import hmac
        import json

        body = json.dumps(payload).encode()
        signature = hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
        # The provider-level check can't pass alongside the platform one (see
        # the module docstring); stand it in so the handler's own logic runs.
        with mock.patch(
            "finance_integrations.providers.xero.XeroProvider.verify_webhook_signature",
            return_value=True,
        ), mock.patch(
            "finance_integrations.services.FinanceIntegrationService.sync_payment_status",
        ) as sync:
            response = self.client.post(
                "/api/v1/finance/webhooks/xero/", body, content_type="application/json",
                HTTP_X_WEBHOOK_SIGNATURE=signature,
            )
        return response, sync

    def test_a_replayed_event_is_not_processed_twice(self):
        first, sync_first = self._deliver(_paid_event("XERO-INV-1", event_id="evt-42"))
        second, sync_second = self._deliver(_paid_event("XERO-INV-1", event_id="evt-42"))

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(sync_first.call_count, 2)  # once per connected tenant
        self.assertEqual(sync_second.call_count, 0)
        self.assertEqual(
            WebhookEvent.objects.filter(event_id="evt-42", status="ignored").count(), 2,
        )

    def test_distinct_events_are_each_processed(self):
        _, sync_first = self._deliver(_paid_event("XERO-INV-1", event_id="evt-1"))
        _, sync_second = self._deliver(_paid_event("XERO-INV-1", event_id="evt-2"))

        self.assertEqual(sync_first.call_count, 2)
        self.assertEqual(sync_second.call_count, 2)
