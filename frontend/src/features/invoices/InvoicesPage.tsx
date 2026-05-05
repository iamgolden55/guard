// InvoicesPage — composes the 3-pane Outbox view + tab routing.
// Ported from project/invoice-app.jsx (lines 5-181).
//
// Phase 5 ships Outbox in full visual fidelity; the Archive and
// My-invoices tabs render placeholder empty states. The Statement
// composer modal and full Archive table are Phase 5.5 polish.
import { useEffect, useMemo, useState } from "react";
import { useAccent } from "../../contexts/AccentContext";
import { tokens } from "../../design-system/tokens";
import { Icon } from "../../design-system/Icon";
import {
  CLIENT_INVOICES,
  CLIENT_STATS,
  STAFF_INVOICES,
  STAFF_STATS,
  type InvoiceKind,
  type InvoiceRecord,
} from "./data/mocks";
import { useInvoicesData } from "./hooks/useInvoicesData";
import { InvoicesHeader, type InvoicesTab } from "./components/InvoicesHeader";
import { InvLeftPane } from "./components/list/InvLeftPane";
import { InvRightPane, type InvoiceActionId } from "./components/right/InvRightPane";
import { InvoiceDocument, type InvoiceTemplate } from "./components/document/InvoiceDocument";
import { useAuth } from "../../contexts/AuthContext";
import { RejectInvoiceModal } from "./components/RejectInvoiceModal";
import { EditInvoiceModal } from "./components/EditInvoiceModal";
import { NewClientInvoiceModal } from "./components/NewClientInvoiceModal";
import {
  BankDetailsPromptModal,
  type BankDetailsPayload,
} from "./components/BankDetailsPromptModal";
import profileService from "../../services/profileService";
import type { StatusFilterValue } from "./components/list/StatusFilter";
import type { StaffPartyDetails } from "./data/mocks";

// Phase 8.5: real-API toggle — set VITE_USE_MOCKS=1 in .env to keep the mocks.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "1";

const ACTION_LABELS: Record<InvoiceActionId, string> = {
  issue: "Invoice issued & sent",
  paid: "Marked paid",
  remind: "Reminder sent",
  download: "PDF downloaded",
  email: "Payslip emailed",
  duplicate: "Duplicated to draft",
  resolve: "Re-issued",
  void: "Voided",
  delete: "Draft discarded",
  edit: "Editor opened",
  export: "Re-syncing to Xero…",
};

const LEFT_PANE_KEY = "ms-invoices-left-pane";
const RIGHT_PANE_KEY = "ms-invoices-right-pane";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // ignore
  }
  return fallback;
}

export default function InvoicesPage() {
  const { palette } = useAccent();
  const [tab, setTab] = useState<InvoicesTab>("outbox");
  const [ledger, setLedger] = useState<InvoiceKind>("client");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [search, setSearch] = useState("");
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [template] = useState<InvoiceTemplate>("modern");
  const [paperEffect] = useState(true);
  const [leftPaneOpen, setLeftPaneOpen] = useState<boolean>(() => readBool(LEFT_PANE_KEY, true));
  const [rightPaneOpen, setRightPaneOpen] = useState<boolean>(() => readBool(RIGHT_PANE_KEY, true));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [bankPromptOpen, setBankPromptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newClientInvoiceOpen, setNewClientInvoiceOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LEFT_PANE_KEY, leftPaneOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [leftPaneOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(RIGHT_PANE_KEY, rightPaneOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [rightPaneOpen]);

  const { authState } = useAuth();
  const currentUser = authState.user;
  const billing = useInvoicesData(ledger);
  const mockInvoices = ledger === "client" ? CLIENT_INVOICES : STAFF_INVOICES;
  const mockStats = ledger === "client" ? CLIENT_STATS : STAFF_STATS;
  const invoices = USE_MOCKS ? mockInvoices : billing.invoices;
  const stats = USE_MOCKS ? mockStats : billing.stats;

  // Per-tab filtering — Outbox is open work, Archive is settled, My is mine.
  const ACTIVE_STATUSES = useMemo(
    () => new Set(["draft", "pending", "sent", "overdue"]),
    [],
  );
  const ARCHIVED_STATUSES = useMemo(
    () => new Set(["paid", "rejected", "resolved", "cancelled"]),
    [],
  );
  const displayedInvoices = useMemo(() => {
    if (tab === "outbox") return invoices.filter((i) => ACTIVE_STATUSES.has(i.status));
    if (tab === "archive") return invoices.filter((i) => ARCHIVED_STATUSES.has(i.status));
    if (tab === "my") {
      // "My invoices" shows the current user's own staff invoices (their
      // payslip history). Doesn't apply to the client ledger.
      if (!currentUser || ledger !== "staff") return [];
      const me = String(currentUser.id);
      return invoices.filter((i) => i.staffId === me);
    }
    return invoices;
  }, [tab, invoices, currentUser, ledger, ACTIVE_STATUSES, ARCHIVED_STATUSES]);

  const initialId = displayedInvoices[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  // Reset selection when the displayed list changes (ledger or tab switch,
  // mutation that pushed an invoice out of the active filter, etc.).
  useEffect(() => {
    if (!displayedInvoices.find((i) => i.id === selectedId)) {
      setSelectedId(displayedInvoices[0]?.id ?? null);
    }
  }, [displayedInvoices, selectedId]);

  const selected: InvoiceRecord | undefined = useMemo(
    () => displayedInvoices.find((i) => i.id === selectedId),
    [displayedInvoices, selectedId],
  );

  const handleAct = (id: InvoiceActionId) => {
    if (USE_MOCKS) {
      setActionToast(ACTION_LABELS[id] ?? id);
      window.setTimeout(() => setActionToast(null), 2200);
      return;
    }
    if (!selectedId) return;
    const fireToast = (msg: string) => {
      setActionToast(msg);
      window.setTimeout(() => setActionToast(null), 2200);
    };
    switch (id) {
      case "paid":
        billing.markPaid.mutate(selectedId, {
          onSuccess: () => fireToast("Marked paid"),
          onError: (e) => fireToast(e instanceof Error ? e.message : "Mark paid failed"),
        });
        break;
      case "remind":
        billing.remind.mutate(selectedId, {
          onSuccess: () => fireToast("Reminder sent"),
          onError: (e) => fireToast(e instanceof Error ? e.message : "Reminder failed"),
        });
        break;
      case "void":
      case "delete":
        billing.voidInvoice.mutate(
          { invoiceId: selectedId, reason: "Voided from Invoices page" },
          {
            onSuccess: () => fireToast(id === "delete" ? "Draft discarded" : "Voided"),
            onError: (e) => fireToast(e instanceof Error ? e.message : "Void failed"),
          },
        );
        break;
      case "duplicate":
        billing.duplicate.mutate(selectedId, {
          onSuccess: (newInv) => {
            fireToast("Duplicated to draft");
            if (newInv?.id) setSelectedId(newInv.id);
          },
          onError: (e) => fireToast(e instanceof Error ? e.message : "Duplicate failed"),
        });
        break;
      case "resolve":
        // Duplicates the rejected invoice into a fresh draft AND marks the
        // original as superseded so it surfaces as 'Resolved' instead of
        // staying in the Rejected pile. Audit trail still preserved on the
        // original (reject_reason, history, etc.).
        billing.resolveAndReissue.mutate(selectedId, {
          onSuccess: (newInv) => {
            fireToast("Re-issued as draft — edit and send when ready");
            if (newInv?.id) setSelectedId(newInv.id);
          },
          onError: (e) =>
            fireToast(e instanceof Error ? e.message : "Re-issue failed"),
        });
        break;
      case "export":
        billing.exportToXero.mutate(selectedId, {
          onSuccess: () => fireToast("Re-syncing to Xero…"),
          onError: (e) => fireToast(e instanceof Error ? e.message : "Export failed"),
        });
        break;
      case "download":
        billing.downloadPdf.mutate(selectedId, {
          onSuccess: () => fireToast("PDF downloaded"),
          onError: (e) => fireToast(e instanceof Error ? e.message : "Download failed"),
        });
        break;
      case "email": {
        // Intercept if the officer has no bank details on file. Without them
        // the payslip PDF would just say "Bank details not on file" — better
        // to capture them inline before sending.
        const staffParty =
          selected && selected.kind === "staff"
            ? (selected.party as StaffPartyDetails)
            : null;
        if (staffParty && !staffParty.bank) {
          setBankPromptOpen(true);
          break;
        }
        billing.emailPayslip.mutate(selectedId, {
          onSuccess: (r) => fireToast(`Payslip emailed to ${r.recipient}`),
          onError: (e) => fireToast(e instanceof Error ? e.message : "Email failed"),
        });
        break;
      }
      case "issue":
        billing.issue.mutate(selectedId, {
          onSuccess: () => fireToast("Issued · status now Pending"),
          onError: (e) => fireToast(e instanceof Error ? e.message : "Issue failed"),
        });
        break;
      case "edit":
        setEditOpen(true);
        break;
      default:
        fireToast(ACTION_LABELS[id as InvoiceActionId] ?? String(id));
    }
  };

  const handleRejectSubmit = async (reason: string) => {
    if (!selectedId) return;
    await billing.reject.mutateAsync({ invoiceId: selectedId, reason });
    setActionToast("Invoice rejected");
    window.setTimeout(() => setActionToast(null), 2200);
  };

  const handleNoteSave = async (note: string) => {
    if (!selectedId) return;
    await billing.updateNote.mutateAsync({ invoiceId: selectedId, note });
    setActionToast("Note updated");
    window.setTimeout(() => setActionToast(null), 2200);
  };

  const handleCreateClientInvoice = async (payload: {
    venueId: string | number;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }) => {
    const created = await billing.createClientInvoice.mutateAsync(payload);
    if (created?.id) setSelectedId(created.id);
    setActionToast(`Draft ${created?.id ?? "invoice"} created`);
    window.setTimeout(() => setActionToast(null), 2400);
  };

  const handleBankDetailsSubmit = async (payload: BankDetailsPayload) => {
    const staffParty =
      selected && selected.kind === "staff"
        ? (selected.party as StaffPartyDetails)
        : null;
    const profileId = staffParty?.staffProfileId;
    if (!profileId || !selectedId) {
      throw new Error("Couldn't find the officer's staff profile.");
    }
    await profileService.patchStaffProfile(profileId, {
      bank_details: payload,
    });
    // Refetch the invoice so InvoiceDocument + right-pane reflect the new bank.
    await billing.refetchInvoices?.();
    // Now chain the email send the admin originally tried to do.
    billing.emailPayslip.mutate(selectedId, {
      onSuccess: (r) => {
        setActionToast(`Bank details saved · payslip emailed to ${r.recipient}`);
        window.setTimeout(() => setActionToast(null), 2600);
      },
      onError: (e) => {
        setActionToast(
          `Bank saved but email failed: ${e instanceof Error ? e.message : "unknown"}`,
        );
        window.setTimeout(() => setActionToast(null), 3200);
      },
    });
  };

  const handleStatement = () => {
    // P6 (M8 fix): was using ACTION_LABELS.remind ("Reminder sent") — wrong action.
    setActionToast("Statement sent");
    window.setTimeout(() => setActionToast(null), 2200);
    if (USE_MOCKS) return;
    const inv = invoices[0];
    if (!inv || inv.kind !== "client" || !inv.clientId) return;
    billing.createStatement.mutate({
      venueId: inv.clientId,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
    });
  };

  return (
    <>
      <InvoicesHeader
        tab={tab}
        onTabChange={setTab}
        ledger={ledger}
        onLedgerChange={setLedger}
        stats={stats}
        onNew={ledger === "client" ? () => setNewClientInvoiceOpen(true) : undefined}
        onStatement={handleStatement}
        leftPaneOpen={leftPaneOpen}
        rightPaneOpen={rightPaneOpen}
        onToggleLeftPane={() => setLeftPaneOpen((v) => !v)}
        onToggleRightPane={() => setRightPaneOpen((v) => !v)}
      />

      <div style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}>
        {leftPaneOpen && (
          <InvLeftPane
            invoices={displayedInvoices}
            stats={stats}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            search={search}
            setSearch={setSearch}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            ledger={ledger}
          />
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            padding: "32px 24px 64px",
            background: paperEffect
              ? "radial-gradient(ellipse at top, #f1eee8 0%, #e8e5df 100%)"
              : tokens.color.ink50,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            overflow: "auto",
            transition: "background .3s",
          }}
        >
          {selected ? (
            <div
              style={{
                width: 760,
                transform: "scale(0.92)",
                transformOrigin: "top center",
                marginBottom: -80,
              }}
            >
              <InvoiceDocument
                inv={selected}
                template={template}
                accent={palette}
                paperEffect={paperEffect}
              />
            </div>
          ) : (
            <div
              style={{
                marginTop: 80,
                color: tokens.color.ink500,
                fontFamily: tokens.font.body,
                fontSize: 13.5,
                textAlign: "center",
                maxWidth: 360,
                lineHeight: 1.55,
              }}
            >
              {tab === "my"
                ? ledger !== "staff"
                  ? "Switch to the Staff ledger to see your own payslips."
                  : "You don't have any payslips yet. They'll appear here once shifts you've worked are approved and the payroll cron runs."
                : tab === "archive"
                  ? "No settled invoices yet. Paid, rejected, or resolved invoices land here."
                  : "No invoices match the current filter."}
            </div>
          )}
        </main>

        {rightPaneOpen && <InvRightPane inv={selected} onAct={handleAct} />}
      </div>

      <RejectInvoiceModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={handleRejectSubmit}
        subject={selected?.id ? `Invoice ${selected.id}` : undefined}
      />

      <BankDetailsPromptModal
        open={bankPromptOpen}
        onClose={() => setBankPromptOpen(false)}
        officerName={
          (selected?.kind === "staff"
            ? (selected.party as StaffPartyDetails).name
            : "this officer") ?? "this officer"
        }
        pendingActionLabel="Email payslip"
        onSubmit={handleBankDetailsSubmit}
      />

      <EditInvoiceModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        invoice={selected ?? null}
        onSaveNote={handleNoteSave}
      />

      <NewClientInvoiceModal
        open={newClientInvoiceOpen}
        onClose={() => setNewClientInvoiceOpen(false)}
        onSubmit={handleCreateClientInvoice}
      />

      {actionToast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 20px",
            borderRadius: 999,
            background: tokens.color.ink900,
            color: "white",
            fontFamily: tokens.font.body,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 32px -8px rgba(32,31,30,0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            zIndex: tokens.z.toast,
          }}
        >
          <Icon name="check" size={14} />
          {actionToast}
        </div>
      )}
    </>
  );
}

