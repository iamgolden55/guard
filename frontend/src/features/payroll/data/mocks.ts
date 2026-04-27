// Payroll mock data — ported 1:1 from project/payroll-data.jsx.
// Phase 6 ships with mocks. Phase 6.5 wires real invoiceService.payroll
// endpoints (admin/payroll/preview/, admin/payroll/generate/).

export type PayrollStatus = "pending" | "paid" | "rejected";
export type ExportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | null;

export type ItemType =
  | "shift"
  | "overtime_1"
  | "overtime_2"
  | "bank_holiday"
  | "annual_leave"
  | "special";

export interface Sia {
  number: string;
  level: string;
  expiresInDays: number;
  expired: boolean;
}

export interface Officer {
  id: number;
  name: string;
  role: string;
  hue: number;
  venue: string;
  baseHrs: number;
  ot1Hrs: number;
  ot2Hrs: number;
  bhDays: number;
  alDays: number;
  special: number;
  rate: number;
  bhRate: number;
  alRate: number;
  gross: number;
  status: PayrollStatus;
  exportStatus: ExportStatus;
  adjustments: number;
  sia: Sia;
  rejectReason?: string;
}

export interface InvoiceLineItem {
  type: ItemType;
  date: string;
  venue: string;
  detail: string;
  hrs: number | null;
  rate: number | null;
  amount: number;
}

export interface ShiftAdjustment {
  date: string;
  shift: string;
  before: string;
  after: string;
  delta: string;
  by: string;
  on: string;
}

export interface OfficerBundle {
  items: InvoiceLineItem[];
  adjustments: ShiftAdjustment[];
}

export interface PayrollRun {
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  processDate: string;
  status: PayrollStatus;
  exportStatus: ExportStatus;
  invoices: number;
  lineItems: number;
  hoursBilled: number;
  grossTotal: number;
  prevGross: number;
  timeAdjustments: number;
  siaBlocks: number;
}

export const CURRENT_RUN: PayrollRun = {
  id: "W17-2026",
  label: "Week 17 · w/c Mon 20 Apr 2026",
  periodStart: "2026-04-20",
  periodEnd: "2026-04-26",
  processDate: "2026-04-27",
  status: "pending",
  exportStatus: null,
  invoices: 48,
  lineItems: 132,
  hoursBilled: 4218,
  grossTotal: 84210.4,
  prevGross: 82780.15,
  timeAdjustments: 6,
  siaBlocks: 2,
};

export const OFFICERS: Officer[] = [
  { id: 1, name: "Jordan Okafor", role: "SIA Door Sup.", hue: 12, venue: "Southbank Arena", baseHrs: 40, ot1Hrs: 4, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 17.5, bhRate: 140, alRate: 120, gross: 805.0, status: "pending", exportStatus: null, adjustments: 1, sia: { number: "1220 7895 2331 4567", level: "DS", expiresInDays: 184, expired: false } },
  { id: 2, name: "Priya Shah", role: "Control Room", hue: 280, venue: "Kensington HQ", baseHrs: 40, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 19.0, bhRate: 152, alRate: 120, gross: 760.0, status: "pending", exportStatus: null, adjustments: 0, sia: { number: "1220 4423 9912 0011", level: "CCTV", expiresInDays: 402, expired: false } },
  { id: 3, name: "Marcus Bell", role: "Events Steward", hue: 160, venue: "Victoria Park", baseHrs: 38, ot1Hrs: 0, ot2Hrs: 0, bhDays: 1, alDays: 0, special: 8, rate: 16.0, bhRate: 128, alRate: 120, gross: 752.0, status: "pending", exportStatus: null, adjustments: 0, sia: { number: "1220 0987 7821 5512", level: "SG", expiresInDays: 9, expired: false } },
  { id: 4, name: "Siobhan Clarke", role: "Close Protection", hue: 32, venue: "Canary Wharf", baseHrs: 40, ot1Hrs: 8, ot2Hrs: 6, bhDays: 0, alDays: 0, special: 0, rate: 24.0, bhRate: 192, alRate: 160, gross: 1536.0, status: "pending", exportStatus: null, adjustments: 2, sia: { number: "1220 3311 8867 2290", level: "CP", expiresInDays: 221, expired: false } },
  { id: 5, name: "Haroon Idris", role: "Retail Guard", hue: 210, venue: "Westfield Stratford", baseHrs: 40, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 15.5, bhRate: 124, alRate: 120, gross: 620.0, status: "pending", exportStatus: null, adjustments: 0, sia: { number: "1220 8812 0044 1198", level: "SG", expiresInDays: 561, expired: false } },
  { id: 6, name: "Lindiwe Msimang", role: "Front-of-House", hue: 340, venue: "Royal Albert Hall", baseHrs: 30, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 1, special: 0, rate: 15.0, bhRate: 120, alRate: 120, gross: 570.0, status: "rejected", exportStatus: null, adjustments: 1, sia: { number: "1220 0012 7765 9900", level: "SG", expiresInDays: 45, expired: false }, rejectReason: "Officer disputed Wed clock-in; requires re-adjustment" },
  { id: 7, name: "Aaron Whitfield", role: "Events Steward", hue: 245, venue: "Docklands Estate", baseHrs: 40, ot1Hrs: 6, ot2Hrs: 2, bhDays: 0, alDays: 0, special: 0, rate: 18.0, bhRate: 144, alRate: 130, gross: 954.0, status: "pending", exportStatus: null, adjustments: 1, sia: { number: "1220 4498 2235 7781", level: "SG", expiresInDays: -3, expired: true } },
  { id: 8, name: "Danielle Roe", role: "Events Steward", hue: 90, venue: "Victoria Park", baseHrs: 24, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 8, rate: 16.0, bhRate: 128, alRate: 120, gross: 448.0, status: "paid", exportStatus: "completed", adjustments: 0, sia: { number: "1220 6677 4412 5500", level: "SG", expiresInDays: 298, expired: false } },
  { id: 9, name: "Tomasz Krawczyk", role: "Door Sup.", hue: 14, venue: "Shoreditch Ministry", baseHrs: 32, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 17.5, bhRate: 140, alRate: 120, gross: 560.0, status: "paid", exportStatus: "completed", adjustments: 0, sia: { number: "1220 5523 8890 1129", level: "DS", expiresInDays: 133, expired: false } },
  { id: 10, name: "Esi Mensah", role: "Control Room", hue: 310, venue: "Kensington HQ", baseHrs: 40, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 19.0, bhRate: 152, alRate: 120, gross: 760.0, status: "paid", exportStatus: "completed", adjustments: 0, sia: { number: "1220 0055 7711 3388", level: "CCTV", expiresInDays: 512, expired: false } },
  { id: 11, name: "Callum Drew", role: "Retail Guard", hue: 196, venue: "Westfield Stratford", baseHrs: 40, ot1Hrs: 2, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 15.5, bhRate: 124, alRate: 120, gross: 666.5, status: "pending", exportStatus: null, adjustments: 1, sia: { number: "1220 9988 6655 2211", level: "SG", expiresInDays: 77, expired: false } },
  { id: 12, name: "Farida Hassan", role: "Events Steward", hue: 355, venue: "O2 Greenwich", baseHrs: 32, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 8, rate: 16.0, bhRate: 128, alRate: 120, gross: 576.0, status: "paid", exportStatus: "failed", adjustments: 0, sia: { number: "1220 3344 7788 9900", level: "SG", expiresInDays: 612, expired: false } },
];

export const ITEMS_BY_OFFICER: Record<number, OfficerBundle> = {
  1: {
    items: [
      { type: "shift", date: "Mon 21 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00", hrs: 8.0, rate: 17.5, amount: 140.0 },
      { type: "shift", date: "Tue 22 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00", hrs: 8.0, rate: 17.5, amount: 140.0 },
      { type: "shift", date: "Wed 23 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00", hrs: 8.0, rate: 17.5, amount: 140.0 },
      { type: "shift", date: "Thu 24 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00", hrs: 8.0, rate: 17.5, amount: 140.0 },
      { type: "shift", date: "Fri 25 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00 · base", hrs: 8.0, rate: 17.5, amount: 140.0 },
      { type: "overtime_1", date: "Fri 25 Apr", venue: "Southbank Arena", detail: "22:00 → 02:00 · OT tier 1 (1.5×)", hrs: 4.0, rate: 26.25, amount: 105.0 },
    ],
    adjustments: [
      { date: "Wed 23 Apr", shift: "Southbank Arena", before: "14:00 → 22:00", after: "13:45 → 22:15", delta: "+0.50h", by: "Priya Shah (Ops)", on: "Thu 24 Apr 09:14" },
    ],
  },
  3: {
    items: [
      { type: "shift", date: "Mon 21 Apr", venue: "Victoria Park", detail: "09:00 → 17:00", hrs: 8.0, rate: 16.0, amount: 128.0 },
      { type: "shift", date: "Tue 22 Apr", venue: "Victoria Park", detail: "09:00 → 17:00", hrs: 8.0, rate: 16.0, amount: 128.0 },
      { type: "shift", date: "Wed 23 Apr", venue: "Victoria Park", detail: "09:00 → 19:00", hrs: 10.0, rate: 16.0, amount: 160.0 },
      { type: "shift", date: "Thu 24 Apr", venue: "Victoria Park", detail: "09:00 → 17:00", hrs: 8.0, rate: 16.0, amount: 128.0 },
      { type: "bank_holiday", date: "Fri 25 Apr", venue: "Victoria Park", detail: "Bank holiday — single-day rate", hrs: null, rate: null, amount: 128.0 },
      { type: "special", date: "Sat 26 Apr", venue: "Victoria Park", detail: "Special event · festival main stage", hrs: 8.0, rate: 20.0, amount: 80.0 },
    ],
    adjustments: [],
  },
  4: {
    items: [
      { type: "shift", date: "Mon 21 Apr", venue: "Canary Wharf", detail: "07:00 → 19:00 · CP", hrs: 12.0, rate: 24.0, amount: 288.0 },
      { type: "shift", date: "Tue 22 Apr", venue: "Canary Wharf", detail: "07:00 → 19:00 · CP", hrs: 12.0, rate: 24.0, amount: 288.0 },
      { type: "shift", date: "Wed 23 Apr", venue: "Canary Wharf", detail: "07:00 → 15:00 · base", hrs: 8.0, rate: 24.0, amount: 192.0 },
      { type: "overtime_1", date: "Wed 23 Apr", venue: "Canary Wharf", detail: "15:00 → 21:00 · OT tier 1 (1.5×)", hrs: 6.0, rate: 36.0, amount: 216.0 },
      { type: "overtime_2", date: "Thu 24 Apr", venue: "Canary Wharf", detail: "05:00 → 11:00 · OT tier 2 (2×) · beyond 58h cap", hrs: 6.0, rate: 48.0, amount: 288.0 },
      { type: "shift", date: "Fri 25 Apr", venue: "Canary Wharf", detail: "07:00 → 15:00", hrs: 8.0, rate: 24.0, amount: 192.0 },
    ],
    adjustments: [
      { date: "Wed 23 Apr", shift: "Canary Wharf", before: "07:00 → 19:00", after: "07:00 → 21:00", delta: "+2.00h · moved to OT1", by: "Alex Mead (Director)", on: "Wed 23 Apr 21:12" },
      { date: "Thu 24 Apr", shift: "Canary Wharf", before: "07:00 → 17:00", after: "05:00 → 11:00", delta: "hrs split; OT2 triggered", by: "Alex Mead (Director)", on: "Thu 24 Apr 11:40" },
    ],
  },
  7: {
    items: [
      { type: "shift", date: "Mon 21 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.0, amount: 144.0 },
      { type: "shift", date: "Tue 22 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.0, amount: 144.0 },
      { type: "shift", date: "Wed 23 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.0, amount: 144.0 },
      { type: "shift", date: "Thu 24 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.0, amount: 144.0 },
      { type: "shift", date: "Fri 25 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00 · base", hrs: 8.0, rate: 18.0, amount: 144.0 },
      { type: "overtime_1", date: "Sat 26 Apr", venue: "Docklands Estate", detail: "18:00 → 00:00 · OT1 (1.5×)", hrs: 6.0, rate: 27.0, amount: 162.0 },
      { type: "overtime_2", date: "Sun 27 Apr", venue: "Docklands Estate", detail: "22:00 → 00:00 · OT2 (2×)", hrs: 2.0, rate: 36.0, amount: 72.0 },
    ],
    adjustments: [
      { date: "Sat 26 Apr", shift: "Docklands Estate", before: "18:00 → 00:00", after: "17:45 → 00:15", delta: "+0.50h", by: "Priya Shah (Ops)", on: "Sun 27 Apr 08:02" },
    ],
  },
};

import type { PillTone } from "../../../design-system/primitives/Pill";

export const STATUS_META: Record<PayrollStatus, { tone: PillTone; label: string; dot: string }> = {
  pending: { tone: "warning", label: "Pending", dot: "#d97706" },
  paid: { tone: "positive", label: "Paid", dot: "#0f9d58" },
  rejected: { tone: "danger", label: "Rejected", dot: "#cb2431" },
};

export const EXPORT_META: Record<NonNullable<ExportStatus>, { tone: PillTone; label: string; dot: string }> = {
  pending: { tone: "neutral", label: "Queued", dot: "#a19f9d" },
  processing: { tone: "info", label: "Exporting", dot: "#2563eb" },
  completed: { tone: "positive", label: "Exported", dot: "#0f9d58" },
  failed: { tone: "danger", label: "Export err", dot: "#cb2431" },
  cancelled: { tone: "neutral", label: "Cancelled", dot: "#a19f9d" },
};

export interface FinanceProvider {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  default: boolean;
}

export const PROVIDERS: FinanceProvider[] = [
  { id: "xero", name: "Xero", color: "#13B5EA", connected: true, default: true },
  { id: "quickbooks", name: "QuickBooks", color: "#2CA01C", connected: true, default: false },
  { id: "sage", name: "Sage", color: "#00D639", connected: false, default: false },
  { id: "freeagent", name: "FreeAgent", color: "#4C984A", connected: false, default: false },
  { id: "freshbooks", name: "FreshBooks", color: "#0075DD", connected: false, default: false },
  { id: "zoho", name: "Zoho Books", color: "#E42527", connected: false, default: false },
  { id: "wave", name: "Wave", color: "#1E77D3", connected: false, default: false },
  { id: "netsuite", name: "NetSuite", color: "#125CA1", connected: false, default: false },
];

export const ITEM_TYPE_META: Record<ItemType, { label: string; bg: string; fg: string }> = {
  shift: { label: "Shift", bg: "#f3f2f1", fg: "#323130" },
  overtime_1: { label: "OT 1.5×", bg: "#fff4e5", fg: "#7a4a00" },
  overtime_2: { label: "OT 2×", bg: "#fde7e9", fg: "#5b0a10" },
  bank_holiday: { label: "Bank holiday", bg: "#eef2ff", fg: "#312e81" },
  annual_leave: { label: "Annual leave", bg: "#e6f4ea", fg: "#0f5132" },
  special: { label: "Special event", bg: "#fef3c7", fg: "#78350f" },
};

export interface PayrollHistoryRun {
  id: string;
  label: string;
  gross: number;
  status: PayrollStatus;
  exported: string;
}

export const RUN_HISTORY: PayrollHistoryRun[] = [
  { id: "W16-2026", label: "w/c 13 Apr 2026", gross: 82780.15, status: "paid", exported: "Xero · 24 Apr" },
  { id: "W15-2026", label: "w/c 06 Apr 2026", gross: 79410.0, status: "paid", exported: "Xero · 17 Apr" },
  { id: "W14-2026", label: "w/c 30 Mar 2026", gross: 88250.75, status: "paid", exported: "Xero · 10 Apr" },
  { id: "W13-2026", label: "w/c 23 Mar 2026", gross: 81920.4, status: "paid", exported: "Xero · 03 Apr" },
];

// Helpers
export const fmtGBP = (n: number) =>
  "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtGBPshort = (n: number) =>
  "£" + Math.round(n).toLocaleString("en-GB");

export const fmtGBPbig = (n: number) => {
  const rounded = Math.round(n);
  if (rounded >= 1000) return "£" + rounded.toLocaleString("en-GB");
  return fmtGBP(n);
};

export function siaTone(sia: Sia): { tone: PillTone; label: string; tip: string } | null {
  if (sia.expired) return { tone: "danger", label: "SIA expired", tip: `${Math.abs(sia.expiresInDays)}d ago` };
  if (sia.expiresInDays <= 30) return { tone: "warning", label: "SIA expiring", tip: `${sia.expiresInDays}d` };
  return null;
}
