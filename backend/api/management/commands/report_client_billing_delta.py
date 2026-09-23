"""
How much each existing client invoice under-billed, per line.

`ClientInvoice.generate_for_venue_period` priced every line at the officer's
pay rate instead of `Shift.bill_rate` (AUDIT-2026-09-17 P0-D; measured 1.45%
realised margin against 25% intended on one venue). New invoices are fixed.
Invoices already issued, sent or paid still carry the old prices, and whether
to re-issue them is the company's decision, not a code change.

This command produces the numbers that decision needs: for every shift-backed
line, the rate billed, the shift's bill rate, and the difference over the
line's hours.

    docker compose exec api python manage.py report_client_billing_delta
    docker compose exec api python manage.py report_client_billing_delta --csv /tmp/billing.csv
    docker compose exec api python manage.py report_client_billing_delta --company <uuid>

Read-only. It writes nothing to the database.
"""
import csv
import sys
from decimal import Decimal

from django.core.management.base import BaseCommand

from api.models import ClientInvoiceItem

EXCLUDED_STATUSES = ('cancelled', 'rejected')


class Command(BaseCommand):
    help = "Compare what client invoices billed against each shift's bill rate."

    def add_arguments(self, parser):
        parser.add_argument('--csv', help="Write per-line rows to this path.")
        parser.add_argument('--company', help="Limit to one SecurityCompany id.")

    def handle(self, *args, **options):
        items = (
            ClientInvoiceItem.objects
            .filter(shift__isnull=False)
            .exclude(invoice__status__in=EXCLUDED_STATUSES)
            .select_related('invoice', 'invoice__company', 'invoice__venue', 'shift')
            .order_by('invoice__company__name', 'invoice__invoice_number', 'date')
        )
        if options.get('company'):
            items = items.filter(invoice__company_id=options['company'])

        rows = []
        totals = {}
        no_bill_rate = 0
        for item in items:
            bill_rate = item.shift.bill_rate
            if bill_rate is None:
                no_bill_rate += 1
                continue
            delta = ((bill_rate - item.rate) * item.hours).quantize(Decimal('0.01'))
            rows.append({
                'company': item.invoice.company.name,
                'invoice': item.invoice.invoice_number,
                'status': item.invoice.status,
                'venue': item.invoice.venue.name if item.invoice.venue else '',
                'date': item.date.isoformat(),
                'shift_id': item.shift_id,
                'hours': item.hours,
                'billed_rate': item.rate,
                'bill_rate': bill_rate,
                'under_billed': delta,
            })
            company_total = totals.setdefault(item.invoice.company.name, {
                'lines': 0, 'billed': Decimal('0'), 'at_bill_rate': Decimal('0'),
            })
            company_total['lines'] += 1
            company_total['billed'] += (item.rate * item.hours).quantize(Decimal('0.01'))
            company_total['at_bill_rate'] += (bill_rate * item.hours).quantize(Decimal('0.01'))

        if options.get('csv'):
            with open(options['csv'], 'w', newline='') as fh:
                writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ['company'])
                writer.writeheader()
                writer.writerows(rows)
            self.stdout.write(f"Wrote {len(rows)} line(s) to {options['csv']}")

        out = sys.stdout
        out.write("Client billing at pay rate vs bill rate (read-only)\n")
        for company, t in totals.items():
            gap = t['at_bill_rate'] - t['billed']
            out.write(
                f"  {company}: {t['lines']} line(s) · billed £{t['billed']:,.2f} · "
                f"at bill rate £{t['at_bill_rate']:,.2f} · under-billed £{gap:,.2f}\n"
            )
        if not totals:
            out.write("  No shift-backed client invoice lines found.\n")
        if no_bill_rate:
            out.write(f"  {no_bill_rate} line(s) skipped: the shift has no bill rate to compare against.\n")
