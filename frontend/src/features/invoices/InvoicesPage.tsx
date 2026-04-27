// InvoicesPage — composes the 3-pane Outbox view + tab routing.
// Ported from project/invoice-app.jsx (lines 5-181).
//
// Phase 5 ships Outbox in full visual fidelity; the Archive and
// My-invoices tabs render placeholder empty states. The Statement
// composer modal and full Archive table are Phase 5.5 polish.
import { useEffect, useMemo, useState } from "react";
import { useAccent } from "../../contexts/AccentContext";
import { tokens } from "../../design-system/tokens";
import { Card } from "../../design-system/primitives/Card";
import { Icon } from "../../design-system/Icon";
import {
  CLIENT_INVOICES,
  CLIENT_STATS,
  STAFF_INVOICES,
  STAFF_STATS,
  type InvoiceKind,
  type InvoiceRecord,
} from "./data/mocks";
import { InvoicesHeader, type InvoicesTab } from "./components/InvoicesHeader";
import { InvLeftPane } from "./components/list/InvLeftPane";
import { InvRightPane, type InvoiceActionId } from "./components/right/InvRightPane";
import { InvoiceDocument, type InvoiceTemplate } from "./components/document/InvoiceDocument";
import type { StatusFilterValue } from "./components/list/StatusFilter";

const ACTION_LABELS: Record<InvoiceActionId, string> = {
  issue: "Invoice issued & sent",
  paid: "Marked paid",
  remind: "Reminder sent",
  download: "PDF downloaded",
  duplicate: "Duplicated to draft",
  resolve: "Re-issued",
  void: "Voided",
  delete: "Draft discarded",
  edit: "Editor opened",
  export: "Re-syncing to Xero…",
};

export default function InvoicesPage() {
  const { palette } = useAccent();
  const [tab, setTab] = useState<InvoicesTab>("outbox");
  const [ledger, setLedger] = useState<InvoiceKind>("client");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [search, setSearch] = useState("");
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [template] = useState<InvoiceTemplate>("modern");
  const [paperEffect] = useState(true);

  const invoices = ledger === "client" ? CLIENT_INVOICES : STAFF_INVOICES;
  const stats = ledger === "client" ? CLIENT_STATS : STAFF_STATS;

  const initialId = invoices[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  // Reset selection when ledger changes and current selection is no longer valid.
  useEffect(() => {
    if (!invoices.find((i) => i.id === selectedId)) {
      setSelectedId(invoices[0]?.id ?? null);
    }
  }, [ledger, invoices, selectedId]);

  const selected: InvoiceRecord | undefined = useMemo(
    () => invoices.find((i) => i.id === selectedId),
    [invoices, selectedId],
  );

  const handleAct = (id: InvoiceActionId) => {
    setActionToast(ACTION_LABELS[id] ?? id);
    window.setTimeout(() => setActionToast(null), 2200);
  };

  return (
    <>
      <InvoicesHeader
        tab={tab}
        onTabChange={setTab}
        ledger={ledger}
        onLedgerChange={setLedger}
        stats={stats}
        onNew={() => handleAct("issue")}
        onStatement={() => handleAct("remind")}
      />

      {tab === "outbox" && (
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <InvLeftPane
            invoices={invoices}
            stats={stats}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            search={search}
            setSearch={setSearch}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            ledger={ledger}
          />

          <main
            style={{
              flex: 1,
              minWidth: 0,
              padding: "32px 24px 64px",
              background: paperEffect
                ? "radial-gradient(ellipse at top, #f1eee8 0%, #e8e5df 100%)"
                : tokens.color.ink50,
              display: "flex",
              justifyContent: "center",
              overflowX: "auto",
              transition: "background .3s",
            }}
          >
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
          </main>

          <InvRightPane inv={selected} onAct={handleAct} />
        </div>
      )}

      {tab === "my" && <PlaceholderTab title="My invoices" subtitle="Phase 5.5: per-officer view." />}
      {tab === "archive" && (
        <PlaceholderTab title="Archive" subtitle="Phase 5.5: paid-history table." />
      )}

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

function PlaceholderTab({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ flex: 1, padding: 24, background: tokens.color.ink50 }}>
      <Card padding={28}>
        <h2
          style={{
            margin: 0,
            fontFamily: tokens.font.display,
            fontSize: 18,
            fontWeight: 700,
            color: tokens.color.ink900,
          }}
        >
          {title}
        </h2>
        <p style={{ marginTop: 6, fontSize: 13, color: tokens.color.ink600 }}>{subtitle}</p>
      </Card>
    </div>
  );
}
