// ============================================================
// Mead Security — Scheduling Data
// Grounded in backend:
//   Shift:             is_published, status (draft|open|assigned|in_progress|completed)
//   RecurringShift:    simple weekly repeat for N weeks (no exceptions)
//   SIALicense:        number, type, expiry
//   StaffUnavailability: hard block (annual leave OR contractor unavailable)
//   BankHoliday:       real calendar dataset
//   WorkingHoursRegulation: 48h cap, 11h min rest, OT tiers, opt_out
// ============================================================

const { useState: uS, useMemo: uM, useEffect: uE, useRef: uR } = React;
const { MS_TOKENS: T, MS_ACCENTS, MSText, MSCard, MSSectionHeader,
        MSButton, MSPill, MSAvatar, MSModal, MSInput } = window;

// ---------- CURRENT WEEK (Mon–Sun) ----------
const WEEK = {
  id: "W17-2026",
  label: "Week 17 · w/c Mon 20 Apr 2026",
  start: "2026-04-20",
  end:   "2026-04-26",
  days: [
    { d: 0, date: "2026-04-20", day: "Mon", dd: "20" },
    { d: 1, date: "2026-04-21", day: "Tue", dd: "21" },
    { d: 2, date: "2026-04-22", day: "Wed", dd: "22" },
    { d: 3, date: "2026-04-23", day: "Thu", dd: "23" },
    { d: 4, date: "2026-04-24", day: "Thu", dd: "24", today: true }, // pretend today
    { d: 5, date: "2026-04-25", day: "Fri", dd: "25", bankHoliday: "St George's Day" },
    { d: 6, date: "2026-04-26", day: "Sat", dd: "26" },
  ],
};
// Recompute; pick Thu 23 Apr as active "today" day
WEEK.days = [
  { d: 0, date: "2026-04-20", day: "Mon", dd: "20" },
  { d: 1, date: "2026-04-21", day: "Tue", dd: "21" },
  { d: 2, date: "2026-04-22", day: "Wed", dd: "22" },
  { d: 3, date: "2026-04-23", day: "Thu", dd: "23", today: true },
  { d: 4, date: "2026-04-24", day: "Fri", dd: "24" },
  { d: 5, date: "2026-04-25", day: "Sat", dd: "25", bankHoliday: "St George's Day (obs.)" },
  { d: 6, date: "2026-04-26", day: "Sun", dd: "26" },
];

// ---------- VENUES ----------
const VENUES = [
  { id: "sba",  name: "Southbank Arena",      area: "SE1",  hue: 12,  req: "DS", color: "#cb2431" },
  { id: "khq",  name: "Kensington HQ",        area: "SW7",  hue: 280, req: "CCTV", color: "#5b21b6" },
  { id: "vpk",  name: "Victoria Park",        area: "E9",   hue: 160, req: "SG", color: "#0f766e" },
  { id: "cwf",  name: "Canary Wharf",         area: "E14",  hue: 32,  req: "CP", color: "#b45309" },
  { id: "wsf",  name: "Westfield Stratford",  area: "E20",  hue: 210, req: "SG", color: "#1e40af" },
  { id: "rah",  name: "Royal Albert Hall",    area: "SW7",  hue: 340, req: "SG", color: "#9d174d" },
  { id: "dok",  name: "Docklands Estate",     area: "E16",  hue: 245, req: "SG", color: "#3730a3" },
  { id: "shm",  name: "Shoreditch Ministry",  area: "EC2",  hue: 14,  req: "DS", color: "#9a3412" },
  { id: "o2g",  name: "O2 Greenwich",         area: "SE10", hue: 355, req: "SG", color: "#be123c" },
];

// ---------- OFFICERS (with SIA) ----------
// siaDaysLeft < 0 = expired (hard block for new shifts)
// siaDaysLeft <= 30 = expiring (soft warning)
const OFFICERS = [
  { id: "u1",  name: "Jordan Okafor",   role: "Door Sup.",       sia: { level: "DS",   no: "1220 7895 2331 4567", daysLeft: 184 }, hue: 12,  weeklyHrs: 44, cap: 48 },
  { id: "u2",  name: "Priya Shah",      role: "Control Room",    sia: { level: "CCTV", no: "1220 4423 9912 0011", daysLeft: 402 }, hue: 280, weeklyHrs: 40, cap: 48 },
  { id: "u3",  name: "Marcus Bell",     role: "Events Steward",  sia: { level: "SG",   no: "1220 0987 7821 5512", daysLeft: 9   }, hue: 160, weeklyHrs: 46, cap: 48 },
  { id: "u4",  name: "Siobhan Clarke",  role: "Close Protection",sia: { level: "CP",   no: "1220 3311 8867 2290", daysLeft: 221 }, hue: 32,  weeklyHrs: 54, cap: 48, optOut: true },
  { id: "u5",  name: "Haroon Idris",    role: "Retail Guard",    sia: { level: "SG",   no: "1220 8812 0044 1198", daysLeft: 561 }, hue: 210, weeklyHrs: 40, cap: 48 },
  { id: "u6",  name: "Lindiwe Msimang", role: "Front-of-House",  sia: { level: "SG",   no: "1220 0012 7765 9900", daysLeft: 45  }, hue: 340, weeklyHrs: 30, cap: 48 },
  { id: "u7",  name: "Aaron Whitfield", role: "Events Steward",  sia: { level: "SG",   no: "1220 4498 2235 7781", daysLeft: -3  }, hue: 245, weeklyHrs: 48, cap: 48 },
  { id: "u8",  name: "Danielle Roe",    role: "Events Steward",  sia: { level: "SG",   no: "1220 6677 4412 5500", daysLeft: 298 }, hue: 90,  weeklyHrs: 24, cap: 48 },
  { id: "u9",  name: "Tomasz Krawczyk", role: "Door Sup.",       sia: { level: "DS",   no: "1220 5523 8890 1129", daysLeft: 133 }, hue: 14,  weeklyHrs: 32, cap: 48 },
  { id: "u10", name: "Esi Mensah",      role: "Control Room",    sia: { level: "CCTV", no: "1220 0055 7711 3388", daysLeft: 512 }, hue: 310, weeklyHrs: 40, cap: 48 },
  { id: "u11", name: "Callum Drew",     role: "Retail Guard",    sia: { level: "SG",   no: "1220 9988 6655 2211", daysLeft: 77  }, hue: 196, weeklyHrs: 42, cap: 48 },
  { id: "u12", name: "Farida Hassan",   role: "Events Steward",  sia: { level: "SG",   no: "1220 3344 7788 9900", daysLeft: 612 }, hue: 355, weeklyHrs: 32, cap: 48 },
];

// ---------- UNAVAILABILITY (hard block) ----------
// type: leave | unavailable
const UNAVAIL = [
  { officerId: "u2",  day: 3, type: "leave",        reason: "Approved annual leave · 3d" },
  { officerId: "u8",  day: 5, type: "unavailable",  reason: "Contractor unavailable" },
  { officerId: "u10", day: 4, type: "leave",        reason: "Approved annual leave" },
];

// ---------- SHIFTS ----------
// One per venue/officer/day. start/end are 24h floats. published true = staff can see.
// violations: array of { tier: 'soft'|'hard', code, msg }
// Day index 3 = Thu 23 Apr (today)
const SHIFTS = [
  // Monday
  { id: "s01", venueId: "sba", officerId: "u1",  day: 0, start: 14, end: 22, published: true,  status: "assigned" },
  { id: "s02", venueId: "khq", officerId: "u2",  day: 0, start: 9,  end: 17, published: true,  status: "assigned" },
  { id: "s03", venueId: "vpk", officerId: "u3",  day: 0, start: 9,  end: 17, published: true,  status: "assigned" },
  { id: "s04", venueId: "cwf", officerId: "u4",  day: 0, start: 7,  end: 19, published: true,  status: "assigned" },
  { id: "s05", venueId: "wsf", officerId: "u5",  day: 0, start: 10, end: 18, published: true,  status: "assigned" },
  { id: "s06", venueId: "dok", officerId: "u7",  day: 0, start: 18, end: 26, published: true,  status: "assigned" }, // 18→02
  { id: "s07", venueId: "shm", officerId: "u9",  day: 0, start: 20, end: 28, published: true,  status: "assigned" },

  // Tuesday
  { id: "s10", venueId: "sba", officerId: "u1",  day: 1, start: 14, end: 22, published: true,  status: "assigned" },
  { id: "s11", venueId: "khq", officerId: "u2",  day: 1, start: 9,  end: 17, published: true,  status: "assigned" },
  { id: "s12", venueId: "vpk", officerId: "u3",  day: 1, start: 9,  end: 17, published: true,  status: "assigned" },
  { id: "s13", venueId: "cwf", officerId: "u4",  day: 1, start: 7,  end: 19, published: true,  status: "assigned" },
  { id: "s14", venueId: "wsf", officerId: "u11", day: 1, start: 10, end: 18, published: true,  status: "assigned" },
  { id: "s15", venueId: "dok", officerId: "u7",  day: 1, start: 18, end: 26, published: true,  status: "assigned" },
  { id: "s16", venueId: "o2g", officerId: null,  day: 1, start: 17, end: 23, published: true,  status: "open" },

  // Wednesday
  { id: "s20", venueId: "sba", officerId: "u1",  day: 2, start: 14, end: 22, published: true,  status: "assigned" },
  { id: "s21", venueId: "khq", officerId: "u2",  day: 2, start: 9,  end: 17, published: true,  status: "assigned" },
  { id: "s22", venueId: "vpk", officerId: "u3",  day: 2, start: 9,  end: 19, published: true,  status: "assigned" },
  { id: "s23", venueId: "cwf", officerId: "u4",  day: 2, start: 7,  end: 21, published: true,  status: "assigned",
    violations: [{ tier: "soft", code: "OT1", msg: "14h shift → OT tier 1 will apply after 10h" }] },
  { id: "s24", venueId: "rah", officerId: "u6",  day: 2, start: 18, end: 23, published: true,  status: "assigned" },
  { id: "s25", venueId: "shm", officerId: "u9",  day: 2, start: 20, end: 28, published: true,  status: "assigned" },

  // Thursday (today) — mix of draft + published + open
  { id: "s30", venueId: "sba", officerId: "u1",  day: 3, start: 14, end: 22, published: true,  status: "assigned" },
  { id: "s31", venueId: "khq", officerId: "u2",  day: 3, start: 9,  end: 17, published: false, status: "draft",
    violations: [{ tier: "hard", code: "LEAVE", msg: "Priya is on approved annual leave" }] },
  { id: "s32", venueId: "vpk", officerId: "u3",  day: 3, start: 9,  end: 17, published: true,  status: "assigned",
    violations: [{ tier: "soft", code: "SIA", msg: "Marcus's SIA expires in 9 days — renew before next week" }] },
  { id: "s33", venueId: "cwf", officerId: "u4",  day: 3, start: 5,  end: 11, published: false, status: "draft",
    violations: [{ tier: "soft", code: "OT2", msg: "Over 48h cap this week — WTR opt-out on file" }] },
  { id: "s34", venueId: "wsf", officerId: "u11", day: 3, start: 10, end: 18, published: true,  status: "assigned" },
  { id: "s35", venueId: "dok", officerId: "u7",  day: 3, start: 18, end: 26, published: false, status: "draft",
    violations: [{ tier: "hard", code: "SIA_EXP", msg: "Aaron's SIA expired 3 days ago — cannot assign" }] },
  { id: "s36", venueId: "o2g", officerId: null,  day: 3, start: 17, end: 23, published: false, status: "open" },
  { id: "s37", venueId: "rah", officerId: null,  day: 3, start: 18, end: 23, published: false, status: "open" },
  { id: "s38", venueId: "shm", officerId: "u9",  day: 3, start: 20, end: 28, published: false, status: "draft" },

  // Friday (bank holiday) — mostly draft, uplift applies
  { id: "s40", venueId: "sba", officerId: "u1",  day: 4, start: 14, end: 22, published: false, status: "draft" },
  { id: "s41", venueId: "vpk", officerId: "u3",  day: 4, start: 9,  end: 19, published: false, status: "draft",
    violations: [{ tier: "soft", code: "SIA", msg: "Marcus's SIA expires in 9 days" },
                 { tier: "soft", code: "BH",  msg: "Bank holiday uplift will apply" }] },
  { id: "s42", venueId: "cwf", officerId: "u4",  day: 4, start: 7,  end: 15, published: false, status: "draft" },
  { id: "s43", venueId: "rah", officerId: "u6",  day: 4, start: 18, end: 23, published: false, status: "draft" },
  { id: "s44", venueId: "khq", officerId: null,  day: 4, start: 9,  end: 17, published: false, status: "open" },
  { id: "s45", venueId: "shm", officerId: null,  day: 4, start: 20, end: 28, published: false, status: "open" },
  { id: "s46", venueId: "wsf", officerId: null,  day: 4, start: 10, end: 18, published: false, status: "open" },

  // Saturday — events
  { id: "s50", venueId: "vpk", officerId: "u3",  day: 5, start: 10, end: 18, published: false, status: "draft" },
  { id: "s51", venueId: "vpk", officerId: "u8",  day: 5, start: 10, end: 18, published: false, status: "draft",
    violations: [{ tier: "hard", code: "UNAVAIL", msg: "Danielle marked unavailable for Sat" }] },
  { id: "s52", venueId: "o2g", officerId: "u12", day: 5, start: 17, end: 27, published: false, status: "draft" },
  { id: "s53", venueId: "dok", officerId: "u7",  day: 5, start: 18, end: 24, published: false, status: "draft" },
  { id: "s54", venueId: "sba", officerId: null,  day: 5, start: 14, end: 22, published: false, status: "open" },

  // Sunday — light
  { id: "s60", venueId: "khq", officerId: "u10", day: 6, start: 9,  end: 17, published: false, status: "draft" },
  { id: "s61", venueId: "dok", officerId: "u7",  day: 6, start: 22, end: 26, published: false, status: "draft",
    violations: [{ tier: "soft", code: "REST", msg: "Less than 11h rest since previous shift" }] },
];

// ---------- VIOLATION META ----------
const VIOL_META = {
  soft: { color: "#d97706", bg: "#fff4e5", icon: "alert" },
  hard: { color: "#cb2431", bg: "#fde7e9", icon: "shield-x" },
};

// ---------- SHIFT STATE COLORS ----------
const SHIFT_STATE = {
  assigned:    { label: "Assigned",   bg: "var(--venue)",   fg: "white" },
  draft:       { label: "Draft",      bg: "var(--venue)",   fg: "white", draft: true },
  open:        { label: "Open shift", bg: "white",          fg: "#201f1e", open: true },
  in_progress: { label: "In progress",bg: "#0f9d58",        fg: "white" },
  completed:   { label: "Completed",  bg: "#a19f9d",        fg: "white" },
};

// ---------- TIMELINE ----------
const HOURS_START = 5;   // 05:00
const HOURS_END   = 29;  // 05:00 next day (showing overnight)

// ---------- ICONS ----------
const SIcon = ({ name, size = 18, stroke = 1.8 }) => {
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
    "shield-x":   <><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M9 9l6 6M15 9l-6 6"/></>,
    "alert":      <><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></>,
    "receipt":    <><path d="M5 3h14v18l-3-2-3 2-2-2-3 2-3-2V3z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    "banknote":   <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></>,
    "plug":       <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8z"/><path d="M12 17v5"/></>,
    "bell":       <><path d="M6 10a6 6 0 0112 0v5l1.5 2H4.5L6 15v-5z"/><path d="M10 20a2 2 0 004 0"/></>,
    "search":     <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    "plus":       <><path d="M12 5v14M5 12h14"/></>,
    "download":   <><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></>,
    "chevron-right": <><path d="M9 6l6 6-6 6"/></>,
    "chevron-left":  <><path d="M15 6l-6 6 6 6"/></>,
    "chevron-down":  <><path d="M6 9l6 6 6-6"/></>,
    "chevrons-left": <><path d="M11 6l-6 6 6 6M18 6l-6 6 6 6"/></>,
    "check":      <><path d="M5 12l4 4L19 7"/></>,
    "x":          <><path d="M6 6l12 12M18 6L6 18"/></>,
    "more":       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    "edit":       <><path d="M4 20h4L20 8l-4-4L4 16v4z"/></>,
    "filter":     <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/></>,
    "copy":       <><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></>,
    "grip":       <><circle cx="9" cy="5" r="1.2"/><circle cx="15" cy="5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="19" r="1.2"/><circle cx="15" cy="19" r="1.2"/></>,
    "send":       <><path d="M4 20l17-8L4 4l3 8-3 8z"/><path d="M7 12h14"/></>,
    "pin":        <><path d="M12 17v5M7 3h10v6l3 4H4l3-4V3z"/></>,
    "repeat":     <><path d="M17 2l3 3-3 3M3 11V9a4 4 0 014-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 01-4 4H4"/></>,
    "file":       <><path d="M7 3h8l4 4v14H7V3z"/><path d="M15 3v4h4"/></>,
    "info":       <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></>,
    "pause":      <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
    "eye":        <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    "eye-off":    <><path d="M3 3l18 18M10 10a3 3 0 004 4M6.5 6.5C4 8 2 12 2 12s4 7 10 7c2 0 3.8-.7 5.3-1.6M12 5c6 0 10 7 10 7-.4.7-1 1.5-1.7 2.3"/></>,
    "briefcase":  <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/></>,
  };
  return <svg {...common}>{p[name]}</svg>;
};

// ---------- HELPERS ----------
const fmtH = (h) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
};
const fmtRange = (s, e) => `${fmtH(s)}–${fmtH(e)}`;
const hrs = (s, e) => e - s;

// getByDay: group shifts by day
const shiftsByDay = (day) => SHIFTS.filter(s => s.day === day);

// Derived: officer weekly hours (recompute from shifts)
const officerWeeklyHrs = (oid) => SHIFTS
  .filter(s => s.officerId === oid && s.status !== "open")
  .reduce((sum, s) => sum + (s.end - s.start), 0);

// Counts for dashboard header
const WEEK_COUNTS = {
  total:      SHIFTS.length,
  published:  SHIFTS.filter(s => s.published).length,
  draft:      SHIFTS.filter(s => !s.published && s.status === "draft").length,
  open:       SHIFTS.filter(s => s.status === "open").length,
  hardViols:  SHIFTS.filter(s => (s.violations||[]).some(v => v.tier === "hard")).length,
  softViols:  SHIFTS.filter(s => (s.violations||[]).some(v => v.tier === "soft")).length,
  siaExpired: OFFICERS.filter(o => o.sia.daysLeft < 0).length,
  siaSoon:    OFFICERS.filter(o => o.sia.daysLeft >= 0 && o.sia.daysLeft <= 30).length,
};

Object.assign(window, {
  WEEK, VENUES, OFFICERS, UNAVAIL, SHIFTS,
  VIOL_META, SHIFT_STATE, HOURS_START, HOURS_END,
  SIcon, fmtH, fmtRange, hrs, shiftsByDay, officerWeeklyHrs, WEEK_COUNTS,
});
