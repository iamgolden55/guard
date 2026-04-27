// ============================================================
// Mead Security — Invoices Data
// Two ledgers:
//   STAFF invoices  → we PAY officers (mirror of Payroll output)
//   CLIENT invoices → we BILL venues for hours guarded
// Real model fields used: invoice_number, status, total_amount,
//   total_hours, hourly_rate, items[], pdf_url, payment_breakdown,
//   export_status, due_date
// ============================================================

const { useState: invS, useMemo: invM, useEffect: invE } = React;

const TODAY = new Date("2026-04-27"); // Monday after week 17
const TODAY_STR = "Mon 27 Apr 2026";

// ---------- HELPERS ----------
const money = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const dateGB = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const dateGBShort = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};
const daysFromToday = (iso) => Math.round((new Date(iso) - TODAY) / 86400000);

// ---------- ICONS ----------
const IIcon = ({ name, size = 18, stroke = 1.8 }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const p = {
    "squares-2x2": <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    "calendar":   <><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v4M16 3v4"/></>,
    "clock":      <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    "users":      <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17" cy="9" r="2.5"/><path d="M21.5 18.5c0-2.5-2-4.5-4.5-4.5"/></>,
    "user-plus":  <><circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M19 8v6M16 11h6"/></>,
    "sun":        <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    "map-pin":    <><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></>,
    "shield":     <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></>,
    "alert":      <><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></>,
    "receipt":    <><path d="M5 3h14v18l-3-2-3 2-2-2-3 2-3-2V3z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    "banknote":   <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></>,
    "plug":       <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8z"/><path d="M12 17v5"/></>,
    "bell":       <><path d="M6 10a6 6 0 0112 0v5l1.5 2H4.5L6 15v-5z"/><path d="M10 20a2 2 0 004 0"/></>,
    "search":     <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    "plus":       <><path d="M12 5v14M5 12h14"/></>,
    "download":   <><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></>,
    "send":       <><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></>,
    "mail":       <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>,
    "chevron-right": <><path d="M9 6l6 6-6 6"/></>,
    "chevron-left":  <><path d="M15 6l-6 6 6 6"/></>,
    "chevron-down":  <><path d="M6 9l6 6 6-6"/></>,
    "check":      <><path d="M5 12l4 4L19 7"/></>,
    "x":          <><path d="M6 6l12 12M18 6L6 18"/></>,
    "more":       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    "edit":       <><path d="M4 20h4L20 8l-4-4L4 16v4z"/></>,
    "filter":     <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/></>,
    "file":       <><path d="M7 3h8l4 4v14H7V3z"/><path d="M15 3v4h4"/></>,
    "info":       <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></>,
    "print":      <><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></>,
    "copy":       <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></>,
    "external":   <><path d="M14 3h7v7M21 3l-9 9M5 5h6v14H5z"/></>,
    "stack":      <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/></>,
    "warning":    <><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".8" fill="currentColor"/></>,
    "history":    <><path d="M3 12a9 9 0 109-9c-2.7 0-5.1 1.2-6.7 3.1"/><path d="M3 4v5h5M12 7v5l3 2"/></>,
    "arrow-right": <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    "credit-card": <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 11h20"/></>,
    "building":   <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4"/></>,
    "user":       <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    "stamp":      <><path d="M9 3h6v5l3 3v3H6v-3l3-3V3zM4 17h16M4 21h16"/></>,
  };
  return <svg {...common}>{p[name]}</svg>;
};

// ---------- COMPANY (the security firm) ----------
const COMPANY = {
  name: "Mead Security Ltd",
  tagline: "Licensed security & event services",
  address: ["44 Cornhill", "London EC3V 3ND", "United Kingdom"],
  phone: "+44 20 7946 0017",
  email: "accounts@meadsecurity.co.uk",
  vat: "GB 298 4471 02",
  reg: "08821445",
  bank: { name: "Lloyds Bank", sort: "30-95-41", acc: "78812094", iban: "GB29 LOYD 3095 4178 8120 94" },
};

// ---------- CLIENTS (venues we bill) ----------
const CLIENTS = [
  { id: "c1", name: "Southbank Arena Ltd",       contact: "Hannah Wright",    email: "ap@southbankarena.co.uk",    address: ["1 Belvedere Rd", "London SE1 8XX"], terms: 30, hue: 12  },
  { id: "c2", name: "Kensington HQ Estates",     contact: "Olu Adeyemi",       email: "finance@kensingtonhq.com",   address: ["27 High St Kensington", "London W8 5NP"], terms: 14, hue: 280 },
  { id: "c3", name: "Victoria Park Events Co.",  contact: "Sarah Voss",        email: "accounts@vpevents.uk",        address: ["Old Ford Rd", "London E9 7DE"], terms: 30, hue: 160 },
  { id: "c4", name: "Canary Wharf Group",        contact: "Daniel Park",       email: "ap@canarywharf.com",          address: ["One Canada Square", "London E14 5AB"], terms: 45, hue: 32  },
  { id: "c5", name: "Westfield Stratford",       contact: "Rashida Bhuiyan",   email: "ap.westfield@unibail.com",    address: ["Olympic Park", "London E20 1EJ"], terms: 30, hue: 210 },
  { id: "c6", name: "Royal Albert Hall",         contact: "Edward Mortimer",   email: "finance@royalalberthall.com", address: ["Kensington Gore", "London SW7 2AP"], terms: 30, hue: 340 },
  { id: "c7", name: "Docklands Estate Mgmt",     contact: "Tess Akinwale",     email: "accounts@docklands-em.co.uk", address: ["West India Quay", "London E14 4QT"], terms: 30, hue: 245 },
];

// ---------- STAFF (officers we pay) ----------
const STAFF = [
  { id: "s1", name: "Jordan Okafor",   role: "SIA Door Sup.",    hue: 12,  utr: "8821 9001",  bank: "12-34-56 / 88210011" },
  { id: "s2", name: "Priya Shah",      role: "Control Room",     hue: 280, utr: "8821 9002",  bank: "12-34-56 / 88210019" },
  { id: "s3", name: "Marcus Bell",     role: "Events Steward",   hue: 160, utr: "8821 9003",  bank: "12-34-56 / 88210027" },
  { id: "s4", name: "Siobhan Clarke",  role: "Close Protection", hue: 32,  utr: "8821 9004",  bank: "12-34-56 / 88210035" },
  { id: "s5", name: "Haroon Idris",    role: "Retail Guard",     hue: 210, utr: "8821 9005",  bank: "12-34-56 / 88210043" },
  { id: "s6", name: "Lindiwe Msimang", role: "Front-of-House",   hue: 340, utr: "8821 9006",  bank: "12-34-56 / 88210051" },
  { id: "s7", name: "Aaron Whitfield", role: "Events Steward",   hue: 245, utr: "8821 9007",  bank: "12-34-56 / 88210069" },
];

const sFind = (id) => STAFF.find(x => x.id === id);
const cFind = (id) => CLIENTS.find(x => x.id === id);

// ---------- INVOICES ----------
// Status → pending | sent | paid | rejected | overdue (computed from dueDate)
// exportStatus → null | pending | completed | failed
function computeStatus(inv) {
  if (inv.status === "paid" || inv.status === "rejected" || inv.status === "draft") return inv.status;
  // sent or pending → check overdue
  if (inv.dueDate && daysFromToday(inv.dueDate) < 0) return "overdue";
  return inv.status;
}

// CLIENT invoices: we bill venues
const CLIENT_INVOICES_RAW = [
  // Mix of paid, sent, overdue, draft to populate visualisations
  { id: "INV-2026-0481", clientId: "c4", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-22", dueDate: "2026-06-06", status: "sent",   exportStatus: "completed",
    items: [
      { date: "2026-04-13", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.50, amount: 684.00 },
      { date: "2026-04-14", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.50, amount: 684.00 },
      { date: "2026-04-15", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.50, amount: 684.00 },
      { date: "2026-04-16", desc: "Night patrol · 1 officer",          venue: "One Canada Sq", hours: 12, rate: 32.00, amount: 384.00 },
      { date: "2026-04-17", desc: "Reception desk · Day · 2 officers", venue: "One Canada Sq", hours: 24, rate: 28.50, amount: 684.00 },
      { date: "2026-04-18", desc: "Event coverage · Spring Gala",      venue: "One Canada Sq", hours: 36, rate: 34.00, amount: 1224.00 },
    ],
    note: "Spring Gala uplift charged at event rate per SLA §4.2.",
    history: [
      { at: "2026-04-22 09:14", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-22 09:15", by: "system",  action: "Sent to ap@canarywharf.com" },
      { at: "2026-04-23 14:02", by: "system",  action: "Synced to Xero · INV-3201" },
    ],
  },
  { id: "INV-2026-0480", clientId: "c1", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-21", dueDate: "2026-05-21", status: "sent",   exportStatus: "completed",
    items: [
      { date: "2026-04-15", desc: "Concert security · Doors team",    venue: "Southbank Arena", hours: 48, rate: 26.00, amount: 1248.00 },
      { date: "2026-04-17", desc: "Concert security · Doors team",    venue: "Southbank Arena", hours: 48, rate: 26.00, amount: 1248.00 },
      { date: "2026-04-18", desc: "VIP escort · Backstage",            venue: "Southbank Arena", hours: 16, rate: 38.00, amount: 608.00 },
      { date: "2026-04-19", desc: "Get-out & venue clear",             venue: "Southbank Arena", hours: 12, rate: 26.00, amount: 312.00 },
    ],
    history: [
      { at: "2026-04-21 11:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-21 11:00", by: "system",  action: "Sent to ap@southbankarena.co.uk" },
    ],
  },
  { id: "INV-2026-0466", clientId: "c2", periodStart: "2026-03-30", periodEnd: "2026-04-05", issueDate: "2026-04-06", dueDate: "2026-04-20", status: "sent",   exportStatus: "completed",
    items: [
      { date: "2026-03-30", desc: "Control room · 24/7 cover",  venue: "Kensington HQ", hours: 84, rate: 30.00, amount: 2520.00 },
      { date: "2026-04-06", desc: "Control room · 24/7 cover",  venue: "Kensington HQ", hours: 84, rate: 30.00, amount: 2520.00 },
    ],
    history: [
      { at: "2026-04-06 08:30", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-06 08:31", by: "system",  action: "Sent to finance@kensingtonhq.com" },
      { at: "2026-04-19 16:10", by: "system",  action: "Reminder sent (T-1 day)" },
      { at: "2026-04-26 09:00", by: "system",  action: "Reminder sent (overdue)" },
    ],
  },
  { id: "INV-2026-0459", clientId: "c6", periodStart: "2026-03-23", periodEnd: "2026-03-29", issueDate: "2026-03-30", dueDate: "2026-04-13", status: "sent",   exportStatus: "completed",
    items: [
      { date: "2026-03-26", desc: "Gala event · Crowd management",  venue: "Royal Albert Hall", hours: 72, rate: 32.00, amount: 2304.00 },
      { date: "2026-03-28", desc: "Concert · Doors team",            venue: "Royal Albert Hall", hours: 56, rate: 28.00, amount: 1568.00 },
    ],
    history: [
      { at: "2026-03-30 10:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-03-30 10:01", by: "system",  action: "Sent to finance@royalalberthall.com" },
      { at: "2026-04-12 16:00", by: "system",  action: "Reminder sent (T-1 day)" },
      { at: "2026-04-20 09:00", by: "system",  action: "Reminder sent (1w overdue)" },
    ],
  },
  { id: "INV-2026-0470", clientId: "c5", periodStart: "2026-04-06", periodEnd: "2026-04-12", issueDate: "2026-04-13", dueDate: "2026-05-13", status: "paid",   exportStatus: "completed", paidDate: "2026-04-24",
    items: [
      { date: "2026-04-06", desc: "Mall security · Day shift",   venue: "Westfield Stratford", hours: 84, rate: 22.50, amount: 1890.00 },
      { date: "2026-04-08", desc: "Mall security · Night shift", venue: "Westfield Stratford", hours: 56, rate: 26.00, amount: 1456.00 },
      { date: "2026-04-11", desc: "Saturday surge · Day",        venue: "Westfield Stratford", hours: 48, rate: 24.00, amount: 1152.00 },
    ],
    history: [
      { at: "2026-04-13 09:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-13 09:01", by: "system",  action: "Sent to ap.westfield@unibail.com" },
      { at: "2026-04-24 15:42", by: "system",  action: "Payment received · BACS ref WSF-298" },
      { at: "2026-04-24 15:42", by: "system",  action: "Marked paid in Xero" },
    ],
  },
  { id: "INV-2026-0475", clientId: "c3", periodStart: "2026-04-06", periodEnd: "2026-04-12", issueDate: "2026-04-15", dueDate: "2026-05-15", status: "paid",   exportStatus: "completed", paidDate: "2026-04-25",
    items: [
      { date: "2026-04-10", desc: "5k race · Course marshals",     venue: "Victoria Park", hours: 64, rate: 24.00, amount: 1536.00 },
      { date: "2026-04-12", desc: "Festival weekend · Gates team", venue: "Victoria Park", hours: 96, rate: 26.00, amount: 2496.00 },
    ],
    history: [
      { at: "2026-04-15 14:00", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-25 11:18", by: "system",  action: "Payment received · BACS" },
    ],
  },
  { id: "INV-2026-0445", clientId: "c7", periodStart: "2026-03-09", periodEnd: "2026-03-15", issueDate: "2026-03-16", dueDate: "2026-04-15", status: "sent",   exportStatus: "completed",
    items: [
      { date: "2026-03-09", desc: "Estate patrol · Night",  venue: "Docklands Estate", hours: 84, rate: 24.00, amount: 2016.00 },
      { date: "2026-03-12", desc: "Concierge cover · Day",  venue: "Docklands Estate", hours: 60, rate: 22.00, amount: 1320.00 },
    ],
    history: [
      { at: "2026-03-16 09:30", by: "M. Chen", action: "Invoice issued" },
      { at: "2026-04-14 16:00", by: "system",  action: "Reminder sent (T-1 day)" },
      { at: "2026-04-22 09:00", by: "system",  action: "Reminder sent (overdue 7d)" },
    ],
  },
  { id: "INV-2026-0492", clientId: "c1", periodStart: "2026-04-20", periodEnd: "2026-04-26", issueDate: null, dueDate: null, status: "draft", exportStatus: null,
    items: [
      { date: "2026-04-22", desc: "Concert · Doors team",     venue: "Southbank Arena", hours: 48, rate: 26.00, amount: 1248.00 },
      { date: "2026-04-24", desc: "Concert · Doors team",     venue: "Southbank Arena", hours: 48, rate: 26.00, amount: 1248.00 },
      { date: "2026-04-25", desc: "Comedy night · Foyer",     venue: "Southbank Arena", hours: 24, rate: 26.00, amount: 624.00 },
    ],
    note: "Auto-drafted from Week 17 timesheets · awaiting review",
    history: [
      { at: "2026-04-27 06:00", by: "system",  action: "Draft created from approved timesheets" },
    ],
  },
];

// STAFF invoices: we pay officers (their pay statement)
const STAFF_INVOICES_RAW = [
  { id: "PAY-W17-S04", staffId: "s4", periodStart: "2026-04-20", periodEnd: "2026-04-26", issueDate: "2026-04-27", dueDate: "2026-04-30", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-04-20", desc: "Day shift · Canary Wharf",        venue: "Canary Wharf",  hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-21", desc: "Day shift · Canary Wharf",        venue: "Canary Wharf",  hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-22", desc: "Day shift · Canary Wharf",        venue: "Canary Wharf",  hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-23", desc: "Day shift + 2h OT (1.5×)",        venue: "Canary Wharf",  hours: 10, rate: 24.00, amount: 240.00 },
      { date: "2026-04-24", desc: "Day shift + 4h OT (1.5×)",        venue: "Canary Wharf",  hours: 12, rate: 24.00, amount: 288.00 },
      { date: "2026-04-25", desc: "OT day (1.5×)",                    venue: "Canary Wharf",  hours: 8,  rate: 36.00, amount: 288.00 },
      { date: "2026-04-26", desc: "Sunday rate (2×)",                 venue: "Canary Wharf",  hours: 6,  rate: 48.00, amount: 288.00 },
    ],
    history: [
      { at: "2026-04-27 07:00", by: "system",  action: "Draft generated from Payroll W17" },
      { at: "2026-04-27 09:14", by: "M. Chen", action: "Issued to officer" },
    ],
  },
  { id: "PAY-W17-S01", staffId: "s1", periodStart: "2026-04-20", periodEnd: "2026-04-26", issueDate: "2026-04-27", dueDate: "2026-04-30", status: "sent", exportStatus: "completed",
    items: [
      { date: "2026-04-20", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-21", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-22", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-23", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-24", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-25", desc: "OT (1.5×) · Southbank", venue: "Southbank Arena", hours: 4, rate: 26.25, amount: 105.00 },
    ],
    history: [
      { at: "2026-04-27 07:00", by: "system",  action: "Draft generated from Payroll W17" },
      { at: "2026-04-27 09:14", by: "M. Chen", action: "Issued to officer" },
    ],
  },
  { id: "PAY-W16-S04", staffId: "s4", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-20", dueDate: "2026-04-23", status: "paid", exportStatus: "completed", paidDate: "2026-04-22",
    items: [
      { date: "2026-04-13", desc: "Day shift · Canary Wharf",  venue: "Canary Wharf", hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-14", desc: "Day shift · Canary Wharf",  venue: "Canary Wharf", hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-15", desc: "Day shift · Canary Wharf",  venue: "Canary Wharf", hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-16", desc: "Day shift · Canary Wharf",  venue: "Canary Wharf", hours: 8,  rate: 24.00, amount: 192.00 },
      { date: "2026-04-17", desc: "Day shift · Canary Wharf",  venue: "Canary Wharf", hours: 8,  rate: 24.00, amount: 192.00 },
    ],
    history: [
      { at: "2026-04-20 07:00", by: "system",  action: "Issued" },
      { at: "2026-04-22 14:30", by: "system",  action: "Paid · BACS run W16" },
    ],
  },
  { id: "PAY-W16-S01", staffId: "s1", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-20", dueDate: "2026-04-23", status: "paid", exportStatus: "completed", paidDate: "2026-04-22",
    items: [
      { date: "2026-04-13", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-14", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-15", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-16", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
      { date: "2026-04-17", desc: "Door sup · Southbank",  venue: "Southbank Arena", hours: 8, rate: 17.50, amount: 140.00 },
    ],
    history: [
      { at: "2026-04-20 07:00", by: "system",  action: "Issued" },
      { at: "2026-04-22 14:30", by: "system",  action: "Paid · BACS run W16" },
    ],
  },
  { id: "PAY-W16-S06", staffId: "s6", periodStart: "2026-04-13", periodEnd: "2026-04-19", issueDate: "2026-04-20", dueDate: "2026-04-23", status: "rejected", exportStatus: null,
    items: [
      { date: "2026-04-15", desc: "Front-of-house · Wed",  venue: "Royal Albert Hall", hours: 6, rate: 15.00, amount: 90.00 },
      { date: "2026-04-17", desc: "Front-of-house · Fri",  venue: "Royal Albert Hall", hours: 6, rate: 15.00, amount: 90.00 },
    ],
    note: "Officer disputed Wed clock-in; pending re-adjustment.",
    history: [
      { at: "2026-04-20 07:00", by: "system",  action: "Issued" },
      { at: "2026-04-20 14:11", by: "L. Msimang", action: "Disputed Wednesday hours" },
      { at: "2026-04-21 09:30", by: "M. Chen",    action: "Status set to rejected pending review" },
    ],
  },
];

// Compute totals & enrich
function enrich(inv, kind) {
  const subtotal = inv.items.reduce((s, x) => s + x.amount, 0);
  const totalHours = inv.items.reduce((s, x) => s + x.hours, 0);
  const vatable = kind === "client";  // we charge VAT to clients; payroll-style staff invoices are usually no VAT
  const vat = vatable ? subtotal * 0.20 : 0;
  const total = subtotal + vat;
  const party = kind === "client" ? cFind(inv.clientId) : sFind(inv.staffId);
  const status = computeStatus(inv);
  return { ...inv, kind, subtotal, vat, total, totalHours, party, status };
}

const CLIENT_INVOICES = CLIENT_INVOICES_RAW.map(i => enrich(i, "client"));
const STAFF_INVOICES  = STAFF_INVOICES_RAW.map(i => enrich(i, "staff"));

// ---------- AGGREGATE STATS ----------
function statsFor(invoices) {
  const byStatus = (s) => invoices.filter(i => i.status === s);
  const sum = (arr) => arr.reduce((s, i) => s + i.total, 0);
  const overdue = byStatus("overdue");
  const sent    = byStatus("sent");
  const paid    = byStatus("paid");
  const draft   = byStatus("draft");
  const rejected= byStatus("rejected");
  const outstanding = sum([...sent, ...overdue]);
  // Aging buckets (overdue only) for client invoices
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  overdue.forEach(i => {
    const d = -daysFromToday(i.dueDate);
    const key = d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
    buckets[key] += i.total;
  });
  return {
    counts: {
      total: invoices.length, draft: draft.length, sent: sent.length,
      overdue: overdue.length, paid: paid.length, rejected: rejected.length
    },
    totals: { sent: sum(sent), overdue: sum(overdue), paid: sum(paid), draft: sum(draft), outstanding },
    buckets,
  };
}

const CLIENT_STATS = statsFor(CLIENT_INVOICES);
const STAFF_STATS  = statsFor(STAFF_INVOICES);

// ---------- STATUS PALETTE ----------
const STATUS_COLOR = {
  draft:    { bg: "#f3f2f1", border: "#e1dfdd", fg: "#605e5c", label: "Draft" },
  sent:     { bg: "#e7f1fb", border: "#bcd9f2", fg: "#0b5c9b", label: "Sent" },
  paid:     { bg: "#e6f4ea", border: "#b8e0c2", fg: "#0f5132", label: "Paid" },
  overdue:  { bg: "#fde7e9", border: "#f7c0c5", fg: "#8a1820", label: "Overdue" },
  rejected: { bg: "#fff4e5", border: "#ffd4a3", fg: "#8a4b0a", label: "Rejected" },
  pending:  { bg: "#fff8e1", border: "#ffe0a3", fg: "#7a5500", label: "Pending" },
};

// ---------- EXPOSE ----------
Object.assign(window, {
  TODAY, TODAY_STR, money, moneyShort, dateGB, dateGBShort, daysFromToday,
  IIcon, COMPANY, CLIENTS, STAFF, sFind, cFind,
  CLIENT_INVOICES, STAFF_INVOICES, CLIENT_STATS, STAFF_STATS,
  STATUS_COLOR,
});
