"""P0.3 reconciliation: deduplicate invoices that bill the same shift.

Strategy: for each shift_id appearing in InvoiceItems across multiple invoices,
pick a canonical invoice and mark the others as superseded. Refuses to touch
paid+paid duplicates — those need finance review (real double-payment).

Modes:
  python scripts/payroll_reconcile_duplicates.py            # dry-run
  python scripts/payroll_reconcile_duplicates.py --apply    # writes

Run via: docker compose exec api python scripts/payroll_reconcile_duplicates.py
"""
import argparse
import csv
import os
import sys
from collections import defaultdict
from io import StringIO

import django

sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction
from django.db.models import Count

from api.models import Invoice, InvoiceItem


# Status priority for picking the canonical invoice when multiple compete.
# Higher value wins. 'paid' is highest because real money already moved.
STATUS_RANK = {
    "paid": 100,
    "sent": 80,
    "pending": 60,
    "draft": 40,
    "rejected": 20,
}


def classify_group(invoices, allow_paid_supersede=False):
    """Given a list of Invoice objects all referencing the same shift, return:
    (canonical, supersede_list, flagged_for_review).

    'flagged_for_review' is non-None iff multiple paid invoices exist AND
    allow_paid_supersede is False — manual finance action is required in prod.
    With allow_paid_supersede=True (dev cleanup), the longest-period paid
    invoice wins and the others are superseded.
    """
    paid = [inv for inv in invoices if inv.status == "paid"]
    if len(paid) > 1 and not allow_paid_supersede:
        return None, [], paid  # flag and bail (production-safe default)

    # Pick canonical: highest STATUS_RANK, ties broken by longest period then newest.
    def sort_key(inv):
        period_days = (inv.end_date - inv.start_date).days
        return (
            STATUS_RANK.get(inv.status, 0),
            period_days,
            inv.created_at,
        )

    sorted_invs = sorted(invoices, key=sort_key, reverse=True)
    canonical = sorted_invs[0]
    supersede = [
        inv for inv in sorted_invs[1:]
        # Skip already-superseded; we don't need to supersede them again.
        if inv.superseded_by_id is None and inv.id != canonical.id
    ]
    return canonical, supersede, None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually write supersede links. Default is dry-run (read-only)."
    )
    parser.add_argument(
        "--allow-paid-supersede", action="store_true",
        help="Permit superseding paid invoices when multiple paid exist for "
             "the same shift. ONLY for dev cleanup. In prod, leave this off so "
             "finance reviews paid+paid duplicates manually."
    )
    args = parser.parse_args()
    apply = args.apply
    allow_paid = args.allow_paid_supersede
    if allow_paid:
        print("⚠  --allow-paid-supersede ENABLED: paid+paid duplicates will be auto-resolved")
        print("   (longest-period wins). This is destructive; only use on dev data.\n")

    print("=" * 78)
    print(f"PAYROLL RECONCILIATION — mode: {'APPLY (writes)' if apply else 'dry-run (read-only)'}")
    print("=" * 78)

    # 1. Find shifts that appear in InvoiceItems across multiple invoices.
    # Use distinct invoice_id count > 1 to identify the duplicates.
    shift_dup_qs = (
        InvoiceItem.objects.filter(shift__isnull=False)
        .values("shift_id")
        .annotate(n_invoices=Count("invoice_id", distinct=True))
        .filter(n_invoices__gt=1)
    )
    shift_ids = [row["shift_id"] for row in shift_dup_qs]
    print(f"\nShifts billed in >1 invoice: {len(shift_ids)}")
    if not shift_ids:
        print("Nothing to reconcile. Exit.")
        return

    # 2. Build {shift_id -> [invoices]}
    items = (
        InvoiceItem.objects.filter(shift_id__in=shift_ids)
        .select_related("invoice")
    )
    shift_to_invoices = defaultdict(set)
    for item in items:
        shift_to_invoices[item.shift_id].add(item.invoice)

    # 3. Classify each group; aggregate supersede plan and review-flag list
    plan_supersede = []   # (loser_invoice, canonical_invoice, shift_id)
    review_rows = []      # rows for the flagged CSV
    safe_groups = 0
    flagged_groups = 0
    for shift_id, inv_set in sorted(shift_to_invoices.items()):
        invoices = list(inv_set)
        canonical, supersede, flagged = classify_group(
            invoices, allow_paid_supersede=allow_paid
        )
        if flagged:
            flagged_groups += 1
            for inv in flagged:
                review_rows.append({
                    "shift_id": shift_id,
                    "staff_user_id": inv.staff_user_id,
                    "invoice_id": inv.id,
                    "invoice_period": f"{inv.start_date}..{inv.end_date}",
                    "invoice_status": inv.status,
                    "invoice_amount": str(inv.total_amount),
                    "paid_date": inv.paid_date.isoformat() if inv.paid_date else "",
                    "all_paid_invoice_ids_for_shift": ",".join(
                        str(i.id) for i in flagged
                    ),
                })
            print(f"\nshift={shift_id}: FLAGGED (multiple paid)")
            for inv in flagged:
                print(
                    f"  inv=#{inv.id} {inv.start_date}..{inv.end_date} "
                    f"status={inv.status} £{inv.total_amount} paid_date={inv.paid_date}"
                )
            continue

        safe_groups += 1
        for loser in supersede:
            plan_supersede.append((loser, canonical, shift_id))

    # 4. Print the safe plan
    if plan_supersede:
        print(f"\nSAFE supersede plan ({len(plan_supersede)} writes across {safe_groups} groups):")
        # Group by canonical for readable output
        by_canonical = defaultdict(list)
        for loser, canonical, shift_id in plan_supersede:
            by_canonical[canonical.id].append((loser, shift_id))
        for canonical_id, losers in by_canonical.items():
            canonical = next(c for _, c, _ in plan_supersede if c.id == canonical_id)
            unique_loser_ids = sorted({l.id for l, _ in losers})
            print(
                f"  canonical inv=#{canonical.id} ({canonical.status}, "
                f"{canonical.start_date}..{canonical.end_date}, £{canonical.total_amount}) "
                f"← supersede inv={unique_loser_ids}"
            )
    else:
        print("\nNo safe supersede actions — all duplicates need manual review.")

    # 5. Print review-flag CSV (always, even on dry-run)
    if review_rows:
        print(f"\n⚠  FLAGGED FOR FINANCE REVIEW: {flagged_groups} groups, {len(review_rows)} paid invoices")
        buf = StringIO()
        w = csv.DictWriter(buf, fieldnames=list(review_rows[0].keys()))
        w.writeheader()
        for r in review_rows:
            w.writerow(r)
        print("\n--- CSV (paid+paid duplicates needing manual refund decision) ---")
        print(buf.getvalue())
    else:
        print("\nNo paid+paid duplicates flagged.")

    # 6. Apply if requested. Use a dedup'd set keyed on loser invoice id.
    if not apply:
        print("\n(dry-run — no writes. Re-run with --apply to execute.)")
        return

    # Dedup: a single loser invoice may overlap multiple shifts in the same
    # canonical, but we only need to supersede it once.
    unique_writes = {}
    for loser, canonical, _shift_id in plan_supersede:
        if loser.id in unique_writes:
            # Verify the canonical is consistent. If two different canonicals
            # were chosen for the same loser, that's a logic bug — bail.
            existing_canon = unique_writes[loser.id][1]
            if existing_canon.id != canonical.id:
                raise RuntimeError(
                    f"Inconsistent canonical for invoice #{loser.id}: "
                    f"{existing_canon.id} vs {canonical.id}"
                )
            continue
        unique_writes[loser.id] = (loser, canonical)

    print(f"\n--- APPLYING {len(unique_writes)} supersede writes ---")
    with transaction.atomic():
        for loser, canonical in unique_writes.values():
            loser.superseded_by_id = canonical.id
            loser.save(update_fields=["superseded_by", "updated_at"])
            print(f"  inv=#{loser.id} now superseded_by inv=#{canonical.id}")

    print(f"\nDone. {len(unique_writes)} invoices superseded.")
    print(f"{flagged_groups} paid+paid groups still require manual finance review.")


if __name__ == "__main__":
    main()
