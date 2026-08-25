// Static catalog of integrations shown on the Integrations page.
//
// Three states:
//   - "finance"   → Connectable today via OAuth (financeIntegrationsService)
//   - "deputy"    → Connectable today via API key (deputyService)
//   - "soon"      → Backend support pending; tile shows a "Coming soon" notice
//
// IMPORTANT: only mark an entry "finance" when ProviderFactory._providers on
// the backend actually registers that provider key. Xero is currently the only
// one. The others were listed as connectable and rendered an enabled Connect
// button that always failed -- 400 "Unsupported provider" for the five with no
// code, and a raw TypeError for QuickBooks and Sage, whose provider classes
// leave 11 abstract methods unimplemented and cannot even be instantiated.
//
// Brand colors are display-only; logos resolve to /logos/* (legacy assets) or
// fall back to a monogram derived from the provider name.
import type { IconName } from "../../../design-system/Icon";

export type IntegrationKind = "finance" | "deputy" | "soon";
export type IntegrationCategory =
  | "finance"
  | "workforce"
  | "calendar"
  | "video"
  | "comms"
  | "payments";

export interface CatalogItem {
  /** Stable id used as React key + cache key */
  id: string;
  /** Maps to backend `provider_key` for finance integrations */
  providerKey?: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  kind: IntegrationKind;
  /** Brand-flavored hue used for the tile monogram badge */
  brandColor: string;
  /** Lucide-style icon (used when no /logos/*.svg exists) */
  icon: IconName;
  /** Optional official logo path. Renders only if file exists. */
  logoPath?: string;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  finance: "Finance & accounting",
  workforce: "Workforce & scheduling",
  calendar: "Calendars",
  video: "Video conferencing",
  comms: "Communications",
  payments: "Payments",
};

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "finance",
  "workforce",
  "calendar",
  "video",
  "comms",
  "payments",
];

export const CATALOG: CatalogItem[] = [
  // ── Finance / accounting (real, OAuth) ─────────────────────────────────
  {
    id: "xero",
    providerKey: "xero",
    name: "Xero",
    description: "Send invoices and payroll exports straight into Xero.",
    category: "finance",
    kind: "finance",
    brandColor: "#13b5ea",
    icon: "banknote",
    logoPath: "/logos/xero.svg",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync staff invoices and journals to QuickBooks Online.",
    category: "finance",
    kind: "soon",
    brandColor: "#2ca01c",
    icon: "banknote",
    logoPath: "/logos/quickbooks.svg",
  },
  {
    id: "freeagent",
    name: "FreeAgent",
    description: "Push approved invoices to FreeAgent for UK contractors.",
    category: "finance",
    kind: "soon",
    brandColor: "#3a8de5",
    icon: "banknote",
    logoPath: "/logos/freeagent.svg",
  },
  {
    id: "freshbooks",
    name: "FreshBooks",
    description: "Export invoices and time entries to FreshBooks.",
    category: "finance",
    kind: "soon",
    brandColor: "#0075dd",
    icon: "banknote",
    logoPath: "/logos/freshbooks.svg",
  },
  {
    id: "zoho",
    name: "Zoho Books",
    description: "Sync customers and invoices with Zoho Books.",
    category: "finance",
    kind: "soon",
    brandColor: "#e42527",
    icon: "banknote",
    logoPath: "/logos/zoho.svg",
  },
  {
    id: "sage",
    name: "Sage",
    description: "Push payroll runs and journals into Sage Business Cloud.",
    category: "finance",
    kind: "soon",
    brandColor: "#00d639",
    icon: "banknote",
    logoPath: "/logos/sage.svg",
  },
  {
    id: "wave",
    name: "Wave",
    description: "Sync invoices to Wave for free accounting.",
    category: "finance",
    kind: "soon",
    brandColor: "#1e3a5f",
    icon: "banknote",
    logoPath: "/logos/wave.svg",
  },
  {
    id: "netsuite",
    name: "NetSuite",
    description: "Enterprise-grade invoice and payroll exports.",
    category: "finance",
    kind: "soon",
    brandColor: "#1d3a5f",
    icon: "banknote",
    logoPath: "/logos/netsuite.svg",
  },

  // ── Workforce / scheduling (real, API key) ─────────────────────────────
  {
    id: "deputy",
    name: "Deputy",
    description: "Sync employees and import timesheets from Deputy.",
    category: "workforce",
    kind: "deputy",
    brandColor: "#ff5252",
    icon: "users",
  },

  // ── Calendars (aspirational) ───────────────────────────────────────────
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Push shifts to staff Google Calendars.",
    category: "calendar",
    kind: "soon",
    brandColor: "#4285f4",
    icon: "calendar",
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Push shifts to Outlook / Microsoft 365 calendars.",
    category: "calendar",
    kind: "soon",
    brandColor: "#0078d4",
    icon: "calendar",
  },

  // ── Video conferencing (aspirational) ──────────────────────────────────
  {
    id: "zoom",
    name: "Zoom",
    description: "Generate Zoom links for remote shift briefings.",
    category: "video",
    kind: "soon",
    brandColor: "#2d8cff",
    icon: "external",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Generate Teams meetings for remote briefings.",
    category: "video",
    kind: "soon",
    brandColor: "#5059c9",
    icon: "external",
  },

  // ── Communications (aspirational) ──────────────────────────────────────
  {
    id: "slack",
    name: "Slack",
    description: "Send shift notifications to Slack channels.",
    category: "comms",
    kind: "soon",
    brandColor: "#611f69",
    icon: "send",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send SMS reminders for upcoming shifts.",
    category: "comms",
    kind: "soon",
    brandColor: "#f22f46",
    icon: "send",
  },

  // ── Payments (aspirational) ────────────────────────────────────────────
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept card payments for client invoices.",
    category: "payments",
    kind: "soon",
    brandColor: "#635bff",
    icon: "credit-card",
  },
];

export function findCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}

export function findCatalogItemByProviderKey(
  providerKey: string,
): CatalogItem | undefined {
  return CATALOG.find((c) => c.providerKey === providerKey);
}
