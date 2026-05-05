"""P0.1 read-only audit: surface duplicate-invoice damage already in DB.

Run via: docker compose exec api python scripts/payroll_damage_audit.py
Makes ZERO writes. Safe to run on prod.
"""
import os
import sys

import django

sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Q, Sum

from api.models import Invoice, InvoiceItem, StaffProfile


def hr(title):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


hr("1. INVOICE POPULATION OVERVIEW")
total = Invoice.objects.count()
linked = Invoice.objects.filter(payroll_run__isnull=False).count()
unlinked = Invoice.objects.filter(payroll_run__isnull=True).count()
print(f"Total invoices:                {total}")
print(f"  payroll_run set (System B):  {linked}")
print(f"  payroll_run NULL (System A): {unlinked}")
print()
print("Status breakdown:")
for row in (
    Invoice.objects.values("status")
    .annotate(c=Count("id"), s=Sum("total_amount"))
    .order_by("status")
):
    amt = row["s"] or Decimal("0")
    print(f"  {row['status']:<12} count={row['c']:<6} sum=£{amt:,.2f}")


hr("2. STRUCTURAL DUPLICATES: overlapping ACTIVE (non-superseded) invoices for same staff_user")
# Pull only NON-superseded invoices for overlap detection. Superseded invoices
# remain in the DB for audit but are excluded from active billing surfaces.
rows = list(
    Invoice.objects.filter(superseded_by__isnull=True)
    .values("id", "staff_user_id", "start_date", "end_date",
            "status", "total_amount", "payroll_run_id", "source")
    .order_by("staff_user_id", "start_date")
)
by_staff = defaultdict(list)
for r in rows:
    if r["staff_user_id"] and r["start_date"] and r["end_date"]:
        by_staff[r["staff_user_id"]].append(r)

overlap_pairs = []  # (staff_id, inv_a, inv_b)
for staff_id, invs in by_staff.items():
    invs.sort(key=lambda x: (x["start_date"], x["end_date"]))
    for i, a in enumerate(invs):
        for b in invs[i + 1:]:
            if b["start_date"] > a["end_date"]:
                break  # sorted; no further overlaps possible
            # overlap exists
            overlap_pairs.append((staff_id, a, b))

print(f"Overlapping invoice pairs found: {len(overlap_pairs)}")
affected_staff = {s for s, _, _ in overlap_pairs}
print(f"Distinct staff affected:         {len(affected_staff)}")

# Categorize by status mix
status_combos = defaultdict(int)
for _, a, b in overlap_pairs:
    key = tuple(sorted([a["status"], b["status"]]))
    status_combos[key] += 1
print("\nStatus combinations (sorted pair):")
for combo, n in sorted(status_combos.items(), key=lambda x: -x[1]):
    print(f"  {combo[0]:<10} + {combo[1]:<10}  count={n}")

# Money at risk: pairs where BOTH are paid
both_paid = [
    (s, a, b) for s, a, b in overlap_pairs
    if a["status"] == "paid" and b["status"] == "paid"
]
print(f"\nPairs where BOTH invoices are 'paid' (actual double-payment): {len(both_paid)}")
if both_paid:
    total_at_risk = sum(
        min(a["total_amount"] or 0, b["total_amount"] or 0)
        for _, a, b in both_paid
    )
    print(f"  Estimated double-paid amount (lower of pair): £{total_at_risk:,.2f}")
    print("  Sample (up to 10):")
    for _, a, b in both_paid[:10]:
        print(
            f"    staff={a['staff_user_id']:<5} "
            f"A=#{a['id']} {a['start_date']}..{a['end_date']} £{a['total_amount']}  "
            f"B=#{b['id']} {b['start_date']}..{b['end_date']} £{b['total_amount']}"
        )

# One-paid-one-pending = ticking time bomb
one_paid_one_pending = [
    (s, a, b) for s, a, b in overlap_pairs
    if {a["status"], b["status"]} == {"paid", "pending"}
]
print(f"\nPairs where one 'paid' + one 'pending' (ticking bomb): {len(one_paid_one_pending)}")
if one_paid_one_pending:
    pending_amt = sum(
        (a["total_amount"] if a["status"] == "pending" else b["total_amount"]) or 0
        for _, a, b in one_paid_one_pending
    )
    print(f"  Pending portion at risk: £{pending_amt:,.2f}")


hr("3. SMOKING GUN: shifts billed via >1 ACTIVE (non-superseded) invoice")
# Only count items belonging to invoices that are still active.
shift_dup_qs = (
    InvoiceItem.objects.filter(
        shift__isnull=False,
        invoice__superseded_by__isnull=True,
    )
    .values("shift_id")
    .annotate(n_invoices=Count("invoice_id", distinct=True))
    .filter(n_invoices__gt=1)
)
shift_dup = list(shift_dup_qs)
print(f"Shifts referenced by InvoiceItems in >1 invoice: {len(shift_dup)}")
if shift_dup:
    print("  Top 10 by invoice-count:")
    for row in sorted(shift_dup, key=lambda r: -r["n_invoices"])[:10]:
        # Pull the invoices for context
        items = (
            InvoiceItem.objects.filter(shift_id=row["shift_id"])
            .values("invoice_id", "item_type", "amount", "invoice__status",
                    "invoice__start_date", "invoice__end_date")
        )
        print(f"\n  shift_id={row['shift_id']}  in {row['n_invoices']} invoices:")
        for it in items:
            print(
                f"    inv=#{it['invoice_id']:<6} "
                f"{it['invoice__start_date']}..{it['invoice__end_date']} "
                f"status={it['invoice__status']:<8} "
                f"type={it['item_type']:<11} amt=£{it['amount']}"
            )


hr("4. PAY_FREQUENCY COVERAGE: who would regenerate silently skip?")
total_profiles = StaffProfile.objects.count()
null_pf = StaffProfile.objects.filter(
    Q(pay_frequency__isnull=True) | Q(pay_frequency="")
).count()
print(f"Total StaffProfiles:              {total_profiles}")
print(f"Profiles with NULL/empty pay_frequency: {null_pf}")
print()
print("Distribution of pay_frequency values:")
for row in (
    StaffProfile.objects.values("pay_frequency")
    .annotate(c=Count("id"))
    .order_by("-c")
):
    pf = row["pay_frequency"] or "<NULL>"
    print(f"  {pf:<15} count={row['c']}")


hr("5. AUTO-INVOICE vs PERIOD-INVOICE SHAPE")
# auto_generate_invoice creates start_date == end_date
# regenerate creates start_date < end_date (week or month)
from django.db.models import F
single_day = Invoice.objects.filter(start_date=F("end_date")).count()
multi_day = Invoice.objects.exclude(start_date=F("end_date")).count()
print(f"Single-day invoices (start==end, auto_generate signature): {single_day}")
print(f"Multi-day invoices  (start<end,  regenerate/manual):       {multi_day}")


hr("6. DONE")
print("All queries above are SELECT-only. No writes were issued.")
