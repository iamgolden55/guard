// ============================================================
// Mead Security — Payroll Data
// Grounded in real backend: Invoice + InvoiceItem model
// Invoice.status:     pending | paid | rejected
// Export state:       pending | processing | completed | failed | cancelled
// InvoiceItem.type:   shift | bank_holiday | annual_leave
// Overtime:           two-tier via WorkingHoursRegulation (1.5x / 2x)
// Adjustments:        ShiftTimeAdjustment per-shift
// ============================================================

const { MS_TOKENS: T, MS_ACCENTS, MSText, MSCard, MSSectionHeader,
        MSButton, MSPill, MSAvatar, MSModal, MSInput } = window;

const { useState, useMemo, useEffect } = React;

// ============================================================
// CURRENT WEEKLY RUN
// ============================================================
const CURRENT_RUN = {
  id: "W17-2026",
  label: "Week 17 · w/c Mon 20 Apr 2026",
  periodStart: "2026-04-20",
  periodEnd:   "2026-04-26",
  processDate: "2026-04-27", // processed on Monday
  status: "pending",         // invoice status
  exportStatus: null,        // not yet exported
  invoices: 48,              // distinct officers
  lineItems: 132,
  hoursBilled: 4218,
  grossTotal: 84210.40,
  prevGross:  82780.15,
  timeAdjustments: 6,        // ShiftTimeAdjustment count
  siaBlocks: 2,              // officers w/ expired/expiring SIA
};

// ============================================================
// OFFICERS (one Invoice per officer for this week)
// ============================================================
// Fields grounded in real model:
//   baseHrs, ot1Hrs (tier 1 @ 1.5x), ot2Hrs (tier 2 @ 2x)
//   bhDays (bank holiday), alDays (annual leave), special (special_event uplift)
//   rate (£/h base), bhRate (£/day), alRate (£/day)
//   gross = computed
//   status = pending|paid|rejected (Invoice.status)
//   exportStatus = null | pending | processing | completed | failed
//   sia = {number, level, expiresInDays, expired}
//   adjustments = # ShiftTimeAdjustment this week
const OFFICERS = [
  { id: 1, name: "Jordan Okafor",   role: "SIA Door Sup.",    hue: 12,  venue: "Southbank Arena",
    baseHrs: 40, ot1Hrs: 4, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 17.50, bhRate: 140, alRate: 120,
    gross: 805.00, status: "pending", exportStatus: null, adjustments: 1,
    sia: { number: "1220 7895 2331 4567", level: "DS", expiresInDays: 184, expired: false } },

  { id: 2, name: "Priya Shah",      role: "Control Room",     hue: 280, venue: "Kensington HQ",
    baseHrs: 40, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 19.00, bhRate: 152, alRate: 120,
    gross: 760.00, status: "pending", exportStatus: null, adjustments: 0,
    sia: { number: "1220 4423 9912 0011", level: "CCTV", expiresInDays: 402, expired: false } },

  { id: 3, name: "Marcus Bell",     role: "Events Steward",   hue: 160, venue: "Victoria Park",
    baseHrs: 38, ot1Hrs: 0, ot2Hrs: 0, bhDays: 1, alDays: 0, special: 8, rate: 16.00, bhRate: 128, alRate: 120,
    gross: 752.00, status: "pending", exportStatus: null, adjustments: 0,
    sia: { number: "1220 0987 7821 5512", level: "SG", expiresInDays: 9, expired: false } },

  { id: 4, name: "Siobhan Clarke",  role: "Close Protection", hue: 32,  venue: "Canary Wharf",
    baseHrs: 40, ot1Hrs: 8, ot2Hrs: 6, bhDays: 0, alDays: 0, special: 0, rate: 24.00, bhRate: 192, alRate: 160,
    gross: 1536.00, status: "pending", exportStatus: null, adjustments: 2,
    sia: { number: "1220 3311 8867 2290", level: "CP", expiresInDays: 221, expired: false } },

  { id: 5, name: "Haroon Idris",    role: "Retail Guard",     hue: 210, venue: "Westfield Stratford",
    baseHrs: 40, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 15.50, bhRate: 124, alRate: 120,
    gross: 620.00, status: "pending", exportStatus: null, adjustments: 0,
    sia: { number: "1220 8812 0044 1198", level: "SG", expiresInDays: 561, expired: false } },

  { id: 6, name: "Lindiwe Msimang", role: "Front-of-House",   hue: 340, venue: "Royal Albert Hall",
    baseHrs: 30, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 1, special: 0, rate: 15.00, bhRate: 120, alRate: 120,
    gross: 570.00, status: "rejected", exportStatus: null, adjustments: 1,
    sia: { number: "1220 0012 7765 9900", level: "SG", expiresInDays: 45, expired: false },
    rejectReason: "Officer disputed Wed clock-in; requires re-adjustment" },

  { id: 7, name: "Aaron Whitfield", role: "Events Steward",   hue: 245, venue: "Docklands Estate",
    baseHrs: 40, ot1Hrs: 6, ot2Hrs: 2, bhDays: 0, alDays: 0, special: 0, rate: 18.00, bhRate: 144, alRate: 130,
    gross: 954.00, status: "pending", exportStatus: null, adjustments: 1,
    sia: { number: "1220 4498 2235 7781", level: "SG", expiresInDays: -3, expired: true } },

  { id: 8, name: "Danielle Roe",    role: "Events Steward",   hue: 90,  venue: "Victoria Park",
    baseHrs: 24, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 8, rate: 16.00, bhRate: 128, alRate: 120,
    gross: 448.00, status: "paid", exportStatus: "completed", adjustments: 0,
    sia: { number: "1220 6677 4412 5500", level: "SG", expiresInDays: 298, expired: false } },

  { id: 9, name: "Tomasz Krawczyk", role: "Door Sup.",        hue: 14,  venue: "Shoreditch Ministry",
    baseHrs: 32, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 17.50, bhRate: 140, alRate: 120,
    gross: 560.00, status: "paid", exportStatus: "completed", adjustments: 0,
    sia: { number: "1220 5523 8890 1129", level: "DS", expiresInDays: 133, expired: false } },

  { id: 10, name: "Esi Mensah",     role: "Control Room",     hue: 310, venue: "Kensington HQ",
    baseHrs: 40, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 19.00, bhRate: 152, alRate: 120,
    gross: 760.00, status: "paid", exportStatus: "completed", adjustments: 0,
    sia: { number: "1220 0055 7711 3388", level: "CCTV", expiresInDays: 512, expired: false } },

  { id: 11, name: "Callum Drew",    role: "Retail Guard",     hue: 196, venue: "Westfield Stratford",
    baseHrs: 40, ot1Hrs: 2, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 0, rate: 15.50, bhRate: 124, alRate: 120,
    gross: 666.50, status: "pending", exportStatus: null, adjustments: 1,
    sia: { number: "1220 9988 6655 2211", level: "SG", expiresInDays: 77, expired: false } },

  { id: 12, name: "Farida Hassan",  role: "Events Steward",   hue: 355, venue: "O2 Greenwich",
    baseHrs: 32, ot1Hrs: 0, ot2Hrs: 0, bhDays: 0, alDays: 0, special: 8, rate: 16.00, bhRate: 128, alRate: 120,
    gross: 576.00, status: "paid", exportStatus: "failed", adjustments: 0,
    sia: { number: "1220 3344 7788 9900", level: "SG", expiresInDays: 612, expired: false } },
];

// ============================================================
// Per-officer InvoiceItems (shift, bank_holiday, annual_leave)
// Plus ShiftTimeAdjustment audit rows.
// ============================================================
const ITEMS_BY_OFFICER = {
  1: {
    items: [
      { type: "shift",        date: "Mon 21 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00",                hrs: 8.0,  rate: 17.50, amount: 140.00 },
      { type: "shift",        date: "Tue 22 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00",                hrs: 8.0,  rate: 17.50, amount: 140.00 },
      { type: "shift",        date: "Wed 23 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00",                hrs: 8.0,  rate: 17.50, amount: 140.00 },
      { type: "shift",        date: "Thu 24 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00",                hrs: 8.0,  rate: 17.50, amount: 140.00 },
      { type: "shift",        date: "Fri 25 Apr", venue: "Southbank Arena", detail: "14:00 → 22:00 · base",         hrs: 8.0,  rate: 17.50, amount: 140.00 },
      { type: "overtime_1",   date: "Fri 25 Apr", venue: "Southbank Arena", detail: "22:00 → 02:00 · OT tier 1 (1.5×)", hrs: 4.0, rate: 26.25, amount: 105.00 },
    ],
    adjustments: [
      { date: "Wed 23 Apr", shift: "Southbank Arena", before: "14:00 → 22:00", after: "13:45 → 22:15", delta: "+0.50h", by: "Priya Shah (Ops)", on: "Thu 24 Apr 09:14" },
    ],
  },
  3: {
    items: [
      { type: "shift",         date: "Mon 21 Apr", venue: "Victoria Park", detail: "09:00 → 17:00",  hrs: 8.0, rate: 16.00, amount: 128.00 },
      { type: "shift",         date: "Tue 22 Apr", venue: "Victoria Park", detail: "09:00 → 17:00",  hrs: 8.0, rate: 16.00, amount: 128.00 },
      { type: "shift",         date: "Wed 23 Apr", venue: "Victoria Park", detail: "09:00 → 19:00",  hrs: 10.0,rate: 16.00, amount: 160.00 },
      { type: "shift",         date: "Thu 24 Apr", venue: "Victoria Park", detail: "09:00 → 17:00",  hrs: 8.0, rate: 16.00, amount: 128.00 },
      { type: "bank_holiday",  date: "Fri 25 Apr", venue: "Victoria Park", detail: "Bank holiday — single-day rate", hrs: null, rate: null, amount: 128.00 },
      { type: "special",       date: "Sat 26 Apr", venue: "Victoria Park", detail: "Special event · festival main stage", hrs: 8.0, rate: 20.00, amount: 80.00 },
    ],
    adjustments: [],
  },
  4: {
    items: [
      { type: "shift",         date: "Mon 21 Apr", venue: "Canary Wharf",   detail: "07:00 → 19:00 · CP",  hrs: 12.0, rate: 24.00, amount: 288.00 },
      { type: "shift",         date: "Tue 22 Apr", venue: "Canary Wharf",   detail: "07:00 → 19:00 · CP",  hrs: 12.0, rate: 24.00, amount: 288.00 },
      { type: "shift",         date: "Wed 23 Apr", venue: "Canary Wharf",   detail: "07:00 → 15:00 · base",hrs: 8.0,  rate: 24.00, amount: 192.00 },
      { type: "overtime_1",    date: "Wed 23 Apr", venue: "Canary Wharf",   detail: "15:00 → 21:00 · OT tier 1 (1.5×)", hrs: 6.0, rate: 36.00, amount: 216.00 },
      { type: "overtime_2",    date: "Thu 24 Apr", venue: "Canary Wharf",   detail: "05:00 → 11:00 · OT tier 2 (2×) · beyond 58h cap", hrs: 6.0, rate: 48.00, amount: 288.00 },
      { type: "shift",         date: "Fri 25 Apr", venue: "Canary Wharf",   detail: "07:00 → 15:00",                     hrs: 8.0, rate: 24.00, amount: 192.00 },
    ],
    adjustments: [
      { date: "Wed 23 Apr", shift: "Canary Wharf", before: "07:00 → 19:00", after: "07:00 → 21:00", delta: "+2.00h · moved to OT1", by: "Alex Mead (Director)", on: "Wed 23 Apr 21:12" },
      { date: "Thu 24 Apr", shift: "Canary Wharf", before: "07:00 → 17:00", after: "05:00 → 11:00", delta: "hrs split; OT2 triggered", by: "Alex Mead (Director)", on: "Thu 24 Apr 11:40" },
    ],
  },
  7: {
    items: [
      { type: "shift",        date: "Mon 21 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.00, amount: 144.00 },
      { type: "shift",        date: "Tue 22 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.00, amount: 144.00 },
      { type: "shift",        date: "Wed 23 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.00, amount: 144.00 },
      { type: "shift",        date: "Thu 24 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00", hrs: 8.0, rate: 18.00, amount: 144.00 },
      { type: "shift",        date: "Fri 25 Apr", venue: "Docklands Estate", detail: "18:00 → 02:00 · base", hrs: 8.0, rate: 18.00, amount: 144.00 },
      { type: "overtime_1",   date: "Sat 26 Apr", venue: "Docklands Estate", detail: "18:00 → 00:00 · OT1 (1.5×)", hrs: 6.0, rate: 27.00, amount: 162.00 },
      { type: "overtime_2",   date: "Sun 27 Apr", venue: "Docklands Estate", detail: "22:00 → 00:00 · OT2 (2×)",   hrs: 2.0, rate: 36.00, amount: 72.00 },
    ],
    adjustments: [
      { date: "Sat 26 Apr", shift: "Docklands Estate", before: "18:00 → 00:00", after: "17:45 → 00:15", delta: "+0.50h", by: "Priya Shah (Ops)", on: "Sun 27 Apr 08:02" },
    ],
  },
};

// ============================================================
// STATUSES & EXPORT PROVIDERS
// ============================================================
// Invoice.status — pending | paid | rejected (real)
const STATUS_META = {
  pending:  { tone: "warning",  label: "Pending",  dot: "#d97706" },
  paid:     { tone: "positive", label: "Paid",     dot: "#0f9d58" },
  rejected: { tone: "danger",   label: "Rejected", dot: "#cb2431" },
};

// Export-state — independent machine: pending|processing|completed|failed|cancelled
const EXPORT_META = {
  pending:    { tone: "neutral",  label: "Queued",    dot: "#a19f9d" },
  processing: { tone: "info",     label: "Exporting", dot: "#2563eb" },
  completed:  { tone: "positive", label: "Exported",  dot: "#0f9d58" },
  failed:     { tone: "danger",   label: "Export err",dot: "#cb2431" },
  cancelled:  { tone: "neutral",  label: "Cancelled", dot: "#a19f9d" },
};

// Finance connectors — what the real export actually targets
const PROVIDERS = [
  { id: "xero",       name: "Xero",        color: "#13B5EA", connected: true,  default: true  },
  { id: "quickbooks", name: "QuickBooks",  color: "#2CA01C", connected: true,  default: false },
  { id: "sage",       name: "Sage",        color: "#00D639", connected: false, default: false },
  { id: "freeagent",  name: "FreeAgent",   color: "#4C984A", connected: false, default: false },
  { id: "freshbooks", name: "FreshBooks",  color: "#0075DD", connected: false, default: false },
  { id: "zoho",       name: "Zoho Books",  color: "#E42527", connected: false, default: false },
  { id: "wave",       name: "Wave",        color: "#1E77D3", connected: false, default: false },
  { id: "netsuite",   name: "NetSuite",    color: "#125CA1", connected: false, default: false },
];

// InvoiceItem type labels
const ITEM_TYPE_META = {
  shift:        { label: "Shift",        bg: "#f3f2f1", fg: "#323130" },
  overtime_1:   { label: "OT 1.5×",      bg: "#fff4e5", fg: "#7a4a00" },
  overtime_2:   { label: "OT 2×",        bg: "#fde7e9", fg: "#5b0a10" },
  bank_holiday: { label: "Bank holiday", bg: "#eef2ff", fg: "#312e81" },
  annual_leave: { label: "Annual leave", bg: "#e6f4ea", fg: "#0f5132" },
  special:      { label: "Special event",bg: "#fef3c7", fg: "#78350f" },
};

// Previous weekly runs (Invoice aggregates)
const RUN_HISTORY = [
  { id: "W16-2026", label: "w/c 13 Apr 2026", gross: 82780.15, status: "paid",     exported: "Xero · 24 Apr" },
  { id: "W15-2026", label: "w/c 06 Apr 2026", gross: 79410.00, status: "paid",     exported: "Xero · 17 Apr" },
  { id: "W14-2026", label: "w/c 30 Mar 2026", gross: 88250.75, status: "paid",     exported: "Xero · 10 Apr" },
  { id: "W13-2026", label: "w/c 23 Mar 2026", gross: 81920.40, status: "paid",     exported: "Xero · 03 Apr" },
];

// ============================================================
// ICONS
// ============================================================
const PIcon = ({ name, size = 18 }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    "squares-2x2": <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    "calendar":   <><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v4M16 3v4"/></>,
    "clock":      <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    "users":      <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17" cy="9" r="2.5"/><path d="M21.5 18.5c0-2.5-2-4.5-4.5-4.5"/></>,
    "user-plus":  <><circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M19 8v6M16 11h6"/></>,
    "sun":        <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    "map-pin":    <><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></>,
    "shield":     <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></>,
    "shield-x":   <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 9l6 6M15 9l-6 6"/></>,
    "alert":      <><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></>,
    "receipt":    <><path d="M5 3h14v18l-3-2-3 2-2-2-3 2-3-2V3z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    "banknote":   <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/></>,
    "plug":       <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8z"/><path d="M12 17v5"/></>,
    "bell":       <><path d="M6 10a6 6 0 0112 0v5l1.5 2H4.5L6 15v-5z"/><path d="M10 20a2 2 0 004 0"/></>,
    "search":     <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    "plus":       <><path d="M12 5v14M5 12h14"/></>,
    "download":   <><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></>,
    "chevron-right": <><path d="M9 6l6 6-6 6"/></>,
    "chevron-down":  <><path d="M6 9l6 6 6-6"/></>,
    "check":      <><path d="M5 12l4 4L19 7"/></>,
    "x":          <><path d="M6 6l12 12M18 6L6 18"/></>,
    "arrow-up":   <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    "arrow-down": <><path d="M12 5v14M19 12l-7 7-7-7"/></>,
    "filter":     <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/></>,
    "more":       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    "edit":       <><path d="M4 20h4L20 8l-4-4L4 16v4z"/></>,
    "flag":       <><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></>,
    "send":       <><path d="M4 20l17-8L4 4l3 8-3 8z"/><path d="M7 12h14"/></>,
    "lock":       <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></>,
    "info":       <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></>,
    "bank":       <><path d="M3 10l9-6 9 6"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18"/></>,
    "file":       <><path d="M7 3h8l4 4v14H7V3z"/><path d="M15 3v4h4"/></>,
    "external":   <><path d="M14 4h6v6M10 14L20 4M18 14v6H4V6h6"/></>,
    "history":    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M3 8l2-3 3 2"/></>,
    "refresh":    <><path d="M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16"/><path d="M21 3v5h-5M3 21v-5h5"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

Object.assign(window, {
  CURRENT_RUN, OFFICERS, ITEMS_BY_OFFICER,
  STATUS_META, EXPORT_META, ITEM_TYPE_META, PROVIDERS, RUN_HISTORY, PIcon,
});
