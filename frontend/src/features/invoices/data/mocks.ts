// Invoice mock data — ported 1:1 from project/invoice-data.jsx.
// Phase 5 ships with mocks for visual review parity. Phase 5.5 wires
// real invoiceService calls.

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "rejected"
  | "resolved"
  | "pending";

export type InvoiceKind = "client" | "staff";

export type ExportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | null;

export interface InvoiceItem {
  date: string;
  desc: string;
  venue?: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface InvoiceHistoryEntry {
  at: string;
  by: string;
  action: string;
}

export interface ClientPartyDetails {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string[];
  terms: number;
  hue: number;
}

export interface StaffBankDetails {
  name: string;
  sort: string;
  account: string;
}

export interface StaffPartyDetails {
  id: string;
  /** StaffProfile.pk — used by the bank-details prompt modal to PATCH the profile. */
  staffProfileId?: number | null;
  name: string;
  role: string;
  hue: number;
  utr: string;
  bank: StaffBankDetails | null;
}

export interface InvoiceRecord {
  id: string;
  kind: InvoiceKind;
  clientId?: string;
  staffId?: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string | null;
  dueDate: string | null;
  paidDate?: string;
  status: InvoiceStatus;
  exportStatus: ExportStatus;
  /** When set, this invoice has been re-issued as a fresh draft. UI shows it
   * as 'Resolved' (neutral) instead of 'Rejected' (red). */
  supersededById?: string | null;
  items: InvoiceItem[];
  note?: string;
  history: InvoiceHistoryEntry[];
  // computed
  subtotal: number;
  vat: number;
  total: number;
  totalHours: number;
  party: ClientPartyDetails | StaffPartyDetails;
}

export const TODAY = new Date("2026-04-27");
export const TODAY_STR = "Mon 27 Apr 2026";

export const money = (n: number) =>
  "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moneyShort = (n: number) =>
  "£" + Math.round(n).toLocaleString("en-GB");

export const dateGB = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const dateGBShort = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export const daysFromToday = (iso: string | null | undefined) =>
  iso ? Math.round((new Date(iso).getTime() - TODAY.getTime()) / 86400000) : 0;

export const COMPANY = {
  name: "Mead Security Ltd",
  tagline: "Licensed security & event services",
  address: ["44 Cornhill", "London EC3V 3ND", "United Kingdom"],
  phone: "+44 20 7946 0017",
  email: "accounts@meadsecurity.co.uk",
  vat: "GB 298 4471 02",
  reg: "08821445",
  bank: {
    name: "Lloyds Bank",
    sort: "30-95-41",
    acc: "78812094",
    iban: "GB29 LOYD 3095 4178 8120 94",
  },
} as const;

export const CLIENTS: ClientPartyDetails[] = [
  { id: "c1", name: "Southbank Arena Ltd", contact: "Hannah Wright", email: "ap@southbankarena.co.uk", address: ["1 Belvedere Rd", "London SE1 8XX"], terms: 30, hue: 12 },
  { id: "c2", name: "Kensington HQ Estates", contact: "Olu Adeyemi", email: "finance@kensingtonhq.com", address: ["27 High St Kensington", "London W8 5NP"], terms: 14, hue: 280 },
  { id: "c3", name: "Victoria Park Events Co.", contact: "Sarah Voss", email: "accounts@vpevents.uk", address: ["Old Ford Rd", "London E9 7DE"], terms: 30, hue: 160 },
  { id: "c4", name: "Canary Wharf Group", contact: "Daniel Park", email: "ap@canarywharf.com", address: ["One Canada Square", "London E14 5AB"], terms: 45, hue: 32 },
  { id: "c5", name: "Westfield Stratford", contact: "Rashida Bhuiyan", email: "ap.westfield@unibail.com", address: ["Olympic Park", "London E20 1EJ"], terms: 30, hue: 210 },
  { id: "c6", name: "Royal Albert Hall", contact: "Edward Mortimer", email: "finance@royalalberthall.com", address: ["Kensington Gore", "London SW7 2AP"], terms: 30, hue: 340 },
  { id: "c7", name: "Docklands Estate Mgmt", contact: "Tess Akinwale", email: "accounts@docklands-em.co.uk", address: ["West India Quay", "London E14 4QT"], terms: 30, hue: 245 },
];

const _mockBank = (acc: string): StaffBankDetails => ({
  name: "Lloyds Bank",
  sort: "12-34-56",
  account: acc,
});

export const STAFF: StaffPartyDetails[] = [
  { id: "s1", name: "Jordan Okafor", role: "SIA Door Sup.", hue: 12, utr: "8821 9001", bank: _mockBank("88210011") },
  { id: "s2", name: "Priya Shah", role: "Control Room", hue: 280, utr: "8821 9002", bank: _mockBank("88210019") },
  { id: "s3", name: "Marcus Bell", role: "Events Steward", hue: 160, utr: "8821 9003", bank: _mockBank("88210027") },
  { id: "s4", name: "Siobhan Clarke", role: "Close Protection", hue: 32, utr: "8821 9004", bank: _mockBank("88210035") },
  { id: "s5", name: "Haroon Idris", role: "Retail Guard", hue: 210, utr: "8821 9005", bank: _mockBank("88210043") },
  { id: "s6", name: "Lindiwe Msimang", role: "Front-of-House", hue: 340, utr: "8821 9006", bank: _mockBank("88210051") },
  { id: "s7", name: "Aaron Whitfield", role: "Events Steward", hue: 245, utr: "8821 9007", bank: _mockBank("88210069") },
];

export const sFind = (id: string) => STAFF.find((x) => x.id === id);
export const cFind = (id: string) => CLIENTS.find((x) => x.id === id);

interface InvoiceRaw {
  id: string;
  clientId?: string;
  staffId?: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string | null;
  dueDate: string | null;
  paidDate?: string;
  status: Exclude<InvoiceStatus, "overdue">;
  exportStatus: ExportStatus;
  items: InvoiceItem[];
  note?: string;
  history: InvoiceHistoryEntry[];
}

const CLIENT_INVOICES_RAW: InvoiceRaw[] = [
  { id: "INV-2026-0481", clientId: "c4", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-22", dueDate: "2026-06-06", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-04-13", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.5, amount: 684.0 },
      { date: "2026-04-14", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.5, amount: 684.0 },
      { date: "2026-04-15", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.5, amount: 684.0 },
      { date: "2026-04-16", desc: "Night patrol · 1 officer", venue: "One Canada Sq", hours: 12, rate: 32.0, amount: 384.0 },
      { date: "2026-04-17", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.5, amount: 684.0 },
      { date: "2026-04-18", desc: "Event coverage · Spring Gala", venue: "One Canada Sq", hours: 36, rate: 34.0, amount: 1224.0 },
    ],
    note: "Spring Gala uplift charged at event rate per SLA §4.2.",
    history: [
      { at: "2026-04-22 09:14", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-22 09:15", by: "system", action: "Sent to ap@canarywharf.com" },
      { at: "2026-04-23 14:02", by: "system", action: "Synced to Xero · INV-3201" },
    ],
  },
  { id: "INV-2026-0480", clientId: "c1", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-21", dueDate: "2026-05-21", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-04-15", desc: "Concert security · Doors team", venue: "Southbank Arena", hours: 48, rate: 26.0, amount: 1248.0 },
      { date: "2026-04-17", desc: "Concert security · Doors team", venue: "Southbank Arena", hours: 48, rate: 26.0, amount: 1248.0 },
      { date: "2026-04-18", desc: "VIP escort · Backstage", venue: "Southbank Arena", hours: 16, rate: 38.0, amount: 608.0 },
      { date: "2026-04-19", desc: "Get-out & venue clear", venue: "Southbank Arena", hours: 12, rate: 26.0, amount: 312.0 },
    ],
    history: [
      { at: "2026-04-21 11:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-21 11:00", by: "system", action: "Sent to ap@southbankarena.co.uk" },
    ],
  },
  { id: "INV-2026-0466", clientId: "c2", periodStart: "2026-03-30", periodEnd: "2026-04-05", issueDate: "2026-04-06", dueDate: "2026-04-20", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-03-30", desc: "Control room · 24/7 cover", venue: "Kensington HQ", hours: 84, rate: 30.0, amount: 2520.0 },
      { date: "2026-04-06", desc: "Control room · 24/7 cover", venue: "Kensington HQ", hours: 84, rate: 30.0, amount: 2520.0 },
    ],
    history: [
      { at: "2026-04-06 08:30", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-06 08:31", by: "system", action: "Sent to finance@kensingtonhq.com" },
      { at: "2026-04-19 16:10", by: "system", action: "Reminder sent (T-1 day)" },
      { at: "2026-04-26 09:00", by: "system", action: "Reminder sent (overdue)" },
    ],
  },
  { id: "INV-2026-0459", clientId: "c6", periodStart: "2026-03-23", periodEnd: "2026-03-29", issueDate: "2026-03-30", dueDate: "2026-04-13", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-03-26", desc: "Gala event · Crowd management", venue: "Royal Albert Hall", hours: 72, rate: 32.0, amount: 2304.0 },
      { date: "2026-03-28", desc: "Concert · Doors team", venue: "Royal Albert Hall", hours: 56, rate: 28.0, amount: 1568.0 },
    ],
    history: [
      { at: "2026-03-30 10:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-03-30 10:01", by: "system", action: "Sent to finance@royalalberthall.com" },
      { at: "2026-04-12 16:00", by: "system", action: "Reminder sent (T-1 day)" },
      { at: "2026-04-20 09:00", by: "system", action: "Reminder sent (1w overdue)" },
    ],
  },
  { id: "INV-2026-0470", clientId: "c5", periodStart: "2026-04-06", periodEnd: "2026-04-12", issueDate: "2026-04-13", dueDate: "2026-05-13", status: "paid", exportStatus: "completed", paidDate: "2026-04-24",
    items: [
      { date: "2026-04-06", desc: "Mall security · Day shift", venue: "Westfield Stratford", hours: 84, rate: 22.5, amount: 1890.0 },
      { date: "2026-04-08", desc: "Mall security · Night shift", venue: "Westfield Stratford", hours: 56, rate: 26.0, amount: 1456.0 },
      { date: "2026-04-11", desc: "Saturday surge · Day", venue: "Westfield Stratford", hours: 48, rate: 24.0, amount: 1152.0 },
    ],
    history: [
      { at: "2026-04-13 09:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-13 09:01", by: "system", action: "Sent to ap.westfield@unibail.com" },
      { at: "2026-04-24 15:42", by: "system", action: "Payment received · BACS ref WSF-298" },
      { at: "2026-04-24 15:42", by: "system", action: "Marked paid in Xero" },
    ],
  },
  { id: "INV-2026-0475", clientId: "c3", periodStart: "2026-04-06", periodEnd: "2026-04-12", issueDate: "2026-04-15", dueDate: "2026-05-15", status: "paid", exportStatus: "completed", paidDate: "2026-04-25",
    items: [
      { date: "2026-04-10", desc: "5k race · Course marshals", venue: "Victoria Park", hours: 64, rate: 24.0, amount: 1536.0 },
      { date: "2026-04-12", desc: "Festival weekend · Gates team", venue: "Victoria Park", hours: 96, rate: 26.0, amount: 2496.0 },
    ],
    history: [
      { at: "2026-04-15 14:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-25 11:18", by: "system", action: "Payment received · BACS" },
    ],
  },
  { id: "INV-2026-0445", clientId: "c7", periodStart: "2026-03-09", periodEnd: "2026-03-15", issueDate: "2026-03-16", dueDate: "2026-04-15", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-03-09", desc: "Estate patrol · Night", venue: "Docklands Estate", hours: 84, rate: 24.0, amount: 2016.0 },
      { date: "2026-03-12", desc: "Concierge cover · Day", venue: "Docklands Estate", hours: 60, rate: 22.0, amount: 1320.0 },
    ],
    history: [
      { at: "2026-03-16 09:30", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-14 16:00", by: "system", action: "Reminder sent (T-1 day)" },
      { at: "2026-04-22 09:00", by: "system", action: "Reminder sent (overdue 7d)" },
    ],
  },
  { id: "INV-2026-0492", clientId: "c1", periodStart: "2026-04-20", periodEnd: "2026-04-26", issueDate: null, dueDate: null, status: "draft", exportStatus: null,
    items: [
      { date: "2026-04-22", desc: "Concert · Doors team", venue: "Southbank Arena", hours: 48, rate: 26.0, amount: 1248.0 },
      { date: "2026-04-24", desc: "Concert · Doors team", venue: "Southbank Arena", hours: 48, rate: 26.0, amount: 1248.0 },
      { date: "2026-04-25", desc: "Comedy night · Foyer", venue: "Southbank Arena", hours: 24, rate: 26.0, amount: 624.0 },
    ],
    note: "Auto-drafted from Week 17 timesheets · awaiting review",
    history: [{ at: "2026-04-27 06:00", by: "system", action: "Draft created from approved timesheets" }],
  },
];

const STAFF_INVOICES_RAW: InvoiceRaw[] = [
  { id: "PAY-W17-S04", staffId: "s4", periodStart: "2026-04-20", periodEnd: "2026-04-26", issueDate: "2026-04-27", dueDate: "2026-04-30", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-04-20", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-21", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-22", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-23", desc: "Day shift + 2h OT (1.5×)", venue: "Canary Wharf", hours: 10, rate: 24.0, amount: 240.0 },
      { date: "2026-04-24", desc: "Day shift + 4h OT (1.5×)", venue: "Canary Wharf", hours: 12, rate: 24.0, amount: 288.0 },
      { date: "2026-04-25", desc: "OT day (1.5×)", venue: "Canary Wharf", hours: 8, rate: 36.0, amount: 288.0 },
      { date: "2026-04-26", desc: "Sunday rate (2×)", venue: "Canary Wharf", hours: 6, rate: 48.0, amount: 288.0 },
    ],
    history: [
      { at: "2026-04-27 07:00", by: "system", action: "Draft generated from Payroll W17" },
      { at: "2026-04-27 09:14", by: "M. Chen", action: "Issued to officer" },
    ],
  },
  { id: "PAY-W17-S01", staffId: "s1", periodStart: "2026-04-20", periodEnd: "2026-04-26", issueDate: "2026-04-27", dueDate: "2026-04-30", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-04-20", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-21", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-22", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-23", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-24", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-25", desc: "OT (1.5×) · Southbank", venue: "Southbank Arena", hours: 4, rate: 26.25, amount: 105.0 },
    ],
    history: [
      { at: "2026-04-27 07:00", by: "system", action: "Draft generated from Payroll W17" },
      { at: "2026-04-27 09:14", by: "M. Chen", action: "Issued to officer" },
    ],
  },
  { id: "PAY-W16-S04", staffId: "s4", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-20", dueDate: "2026-04-23", status: "paid", exportStatus: "completed", paidDate: "2026-04-22",
    items: [
      { date: "2026-04-13", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-14", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-15", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-16", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
      { date: "2026-04-17", desc: "Day shift · Canary Wharf", venue: "Canary Wharf", hours: 8, rate: 24.0, amount: 192.0 },
    ],
    history: [
      { at: "2026-04-20 07:00", by: "system", action: "Issued" },
      { at: "2026-04-22 14:30", by: "system", action: "Paid · BACS run W16" },
    ],
  },
  { id: "PAY-W16-S01", staffId: "s1", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-20", dueDate: "2026-04-23", status: "paid", exportStatus: "completed", paidDate: "2026-04-22",
    items: [
      { date: "2026-04-13", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-14", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-15", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-16", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
      { date: "2026-04-17", desc: "Door sup · Southbank", venue: "Southbank Arena", hours: 8, rate: 17.5, amount: 140.0 },
    ],
    history: [
      { at: "2026-04-20 07:00", by: "system", action: "Issued" },
      { at: "2026-04-22 14:30", by: "system", action: "Paid · BACS run W16" },
    ],
  },
  { id: "PAY-W16-S06", staffId: "s6", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-20", dueDate: "2026-04-23", status: "rejected", exportStatus: null,
    items: [
      { date: "2026-04-15", desc: "Front-of-house · Wed", venue: "Royal Albert Hall", hours: 6, rate: 15.0, amount: 90.0 },
      { date: "2026-04-17", desc: "Front-of-house · Fri", venue: "Royal Albert Hall", hours: 6, rate: 15.0, amount: 90.0 },
    ],
    note: "Officer disputed Wed clock-in; pending re-adjustment.",
    history: [
      { at: "2026-04-20 07:00", by: "system", action: "Issued" },
      { at: "2026-04-20 14:11", by: "L. Msimang", action: "Disputed Wednesday hours" },
      { at: "2026-04-21 09:30", by: "M. Chen", action: "Status set to rejected pending review" },
    ],
  },
];

function computeStatus(inv: InvoiceRaw): InvoiceStatus {
  if (inv.status === "paid" || inv.status === "rejected" || inv.status === "draft") return inv.status;
  if (inv.dueDate && daysFromToday(inv.dueDate) < 0) return "overdue";
  return inv.status;
}

function enrich(inv: InvoiceRaw, kind: InvoiceKind): InvoiceRecord {
  const subtotal = inv.items.reduce((s, x) => s + x.amount, 0);
  const totalHours = inv.items.reduce((s, x) => s + x.hours, 0);
  const vat = kind === "client" ? subtotal * 0.2 : 0;
  const total = subtotal + vat;
  const status = computeStatus(inv);
  const party =
    kind === "client" ? cFind(inv.clientId!) : sFind(inv.staffId!);
  if (!party) {
    throw new Error(`Invoice ${inv.id} references missing party`);
  }
  return {
    ...inv,
    kind,
    subtotal,
    vat,
    total,
    totalHours,
    party,
    status,
  };
}

export const CLIENT_INVOICES: InvoiceRecord[] = CLIENT_INVOICES_RAW.map((i) => enrich(i, "client"));
export const STAFF_INVOICES: InvoiceRecord[] = STAFF_INVOICES_RAW.map((i) => enrich(i, "staff"));

export interface InvoiceStats {
  counts: {
    total: number;
    draft: number;
    sent: number;
    pending: number;
    overdue: number;
    paid: number;
    rejected: number;
    resolved: number;
  };
  totals: {
    sent: number;
    overdue: number;
    paid: number;
    draft: number;
    outstanding: number;
  };
  buckets: { "0-30": number; "31-60": number; "61-90": number; "90+": number };
}

export function statsFor(invoices: InvoiceRecord[]): InvoiceStats {
  const byStatus = (s: InvoiceStatus) => invoices.filter((i) => i.status === s);
  const sum = (arr: InvoiceRecord[]) => arr.reduce((s, i) => s + i.total, 0);
  const overdue = byStatus("overdue");
  const sent = byStatus("sent");
  const paid = byStatus("paid");
  const draft = byStatus("draft");
  const rejected = byStatus("rejected");
  const resolved = byStatus("resolved");
  const pending = byStatus("pending");
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  overdue.forEach((i) => {
    const d = -daysFromToday(i.dueDate);
    const key: keyof typeof buckets = d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
    buckets[key] += i.total;
  });
  return {
    counts: {
      total: invoices.length,
      draft: draft.length,
      sent: sent.length,
      overdue: overdue.length,
      paid: paid.length,
      pending: pending.length,
      rejected: rejected.length,
      resolved: resolved.length,
    },
    totals: {
      sent: sum(sent),
      overdue: sum(overdue),
      paid: sum(paid),
      draft: sum(draft),
      outstanding: sum([...sent, ...overdue]),
    },
    buckets,
  };
}

export const CLIENT_STATS = statsFor(CLIENT_INVOICES);
export const STAFF_STATS = statsFor(STAFF_INVOICES);

export interface StatusTone {
  bg: string;
  border: string;
  fg: string;
  label: string;
}

export const STATUS_COLOR: Record<InvoiceStatus, StatusTone> = {
  draft: { bg: "#f3f2f1", border: "#e1dfdd", fg: "#605e5c", label: "Draft" },
  sent: { bg: "#e7f1fb", border: "#bcd9f2", fg: "#0b5c9b", label: "Sent" },
  paid: { bg: "#e6f4ea", border: "#b8e0c2", fg: "#0f5132", label: "Paid" },
  overdue: { bg: "#fde7e9", border: "#f7c0c5", fg: "#8a1820", label: "Overdue" },
  rejected: { bg: "#fff4e5", border: "#ffd4a3", fg: "#8a4b0a", label: "Rejected" },
  resolved: { bg: "#eef2f7", border: "#c7d2e0", fg: "#3a4a5e", label: "Resolved" },
  pending: { bg: "#fff8e1", border: "#ffe0a3", fg: "#7a5500", label: "Pending" },
};

export function isClientParty(p: ClientPartyDetails | StaffPartyDetails): p is ClientPartyDetails {
  return (p as ClientPartyDetails).address !== undefined;
}
