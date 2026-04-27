// ============================================================
// Mead Security — Attendance Data
// Grounded in backend Shift fields:
//   check_in_time, check_out_time, check_in_location (lat/lng),
//   check_in_photo, status (open|scheduled|active|in_progress|completed|no_show|...)
//   ShiftTimeAdjustment: original_/adjusted_check_in/out, reason, adjusted_by
//   Venue.is_location_verified + enforcement_radius
//   ComplianceViolation.violation_type: late_checkin | early_checkout | location_violation | shift_abandonment
// ============================================================

const { useState: aS, useMemo: aM, useEffect: aE, useRef: aR } = React;

// "Now" reference — Thursday 23 Apr 2026, 14:42
const NOW_HOUR = 14 + 42/60;          // float
const NOW_LABEL = "14:42";
const TODAY_LABEL = "Thursday 23 April 2026";
const TODAY_ISO = "2026-04-23";

// ---------- VENUES (subset matching scheduling) ----------
const A_VENUES = [
  { id: "sba", name: "Southbank Arena",     area: "SE1",  hue: 12,  geofence: true,  radius: 150 },
  { id: "khq", name: "Kensington HQ",       area: "SW7",  hue: 280, geofence: true,  radius: 120 },
  { id: "vpk", name: "Victoria Park",       area: "E9",   hue: 160, geofence: true,  radius: 250 },
  { id: "cwf", name: "Canary Wharf",        area: "E14",  hue: 32,  geofence: true,  radius: 100 },
  { id: "wsf", name: "Westfield Stratford", area: "E20",  hue: 210, geofence: true,  radius: 180 },
  { id: "rah", name: "Royal Albert Hall",   area: "SW7",  hue: 340, geofence: true,  radius: 130 },
  { id: "dok", name: "Docklands Estate",    area: "E16",  hue: 245, geofence: true,  radius: 200 },
  { id: "shm", name: "Shoreditch Ministry", area: "EC2",  hue: 14,  geofence: true,  radius: 110 },
  { id: "o2g", name: "O2 Greenwich",        area: "SE10", hue: 355, geofence: true,  radius: 220 },
];

// ---------- OFFICERS ----------
const A_OFFICERS = [
  { id: "u1",  name: "Jordan Okafor",   role: "Door Sup.",        sia: "DS",   hue: 12  },
  { id: "u2",  name: "Priya Shah",      role: "Control Room",     sia: "CCTV", hue: 280 },
  { id: "u3",  name: "Marcus Bell",     role: "Events Steward",   sia: "SG",   hue: 160 },
  { id: "u4",  name: "Siobhan Clarke",  role: "Close Protection", sia: "CP",   hue: 32  },
  { id: "u5",  name: "Haroon Idris",    role: "Retail Guard",     sia: "SG",   hue: 210 },
  { id: "u6",  name: "Lindiwe Msimang", role: "Front-of-House",   sia: "SG",   hue: 340 },
  { id: "u7",  name: "Aaron Whitfield", role: "Events Steward",   sia: "SG",   hue: 245 },
  { id: "u8",  name: "Danielle Roe",    role: "Events Steward",   sia: "SG",   hue: 90  },
  { id: "u9",  name: "Tomasz Krawczyk", role: "Door Sup.",        sia: "DS",   hue: 14  },
  { id: "u10", name: "Esi Mensah",      role: "Control Room",     sia: "CCTV", hue: 310 },
  { id: "u11", name: "Callum Drew",     role: "Retail Guard",     sia: "SG",   hue: 196 },
  { id: "u12", name: "Farida Hassan",   role: "Events Steward",   sia: "SG",   hue: 355 },
];

// ---------- SHIFT RECORDS (today + last 6 days) ----------
// Each shift: scheduled (sch_start/sch_end) and actual (act_start/act_end).
// Status reflects backend flow.
// Variances are minutes (positive = late or over).
// All times are floats (24h, supports overnight via >24).
//
// Variant codes:
//   'on_duty'        — currently working (act_start set, act_end null, in window)
//   'completed'      — both set, end_time passed
//   'pending_approval'— admin must approve actual hours
//   'approved'       — approved (read-only)
//   'no_show'        — past start +30m, never checked in
//   'late'           — checked in late (still on duty or done)
//   'early_out'      — checked out before scheduled end
//   'missing_out'    — checked in but never checked out (and end has passed)
//   'upcoming'       — future scheduled
//   'geofence_fail'  — checked in outside enforcement radius
//
// Plus rich metadata: photo (url stub), gps (lat/lng), distance_m from venue,
// patrol_done / patrol_total, breaks_taken, adjustments[].

const SHIFTS_TODAY = [
  // ---- ON DUTY now (NOW=14:42) ----
  { id: "t01", oid: "u1",  vid: "sba", sch_start: 14, sch_end: 22, act_start: 14.0, act_end: null,
    status: "on_duty", late_min: 0, photo: true, gps_ok: true, dist_m: 14, patrol: [3, 4], breaks: 0 },
  { id: "t02", oid: "u2",  vid: "khq", sch_start: 9,  sch_end: 17, act_start: 9.05, act_end: null,
    status: "on_duty", late_min: 3, photo: true, gps_ok: true, dist_m: 22, patrol: [6, 8], breaks: 1 },
  { id: "t03", oid: "u3",  vid: "vpk", sch_start: 9,  sch_end: 17, act_start: 9.20, act_end: null,
    status: "on_duty", late_min: 12, photo: true, gps_ok: true, dist_m: 78, patrol: [4, 6], breaks: 1 },
  { id: "t04", oid: "u4",  vid: "cwf", sch_start: 7,  sch_end: 19, act_start: 6.95, act_end: null,
    status: "on_duty", late_min: -3, photo: true, gps_ok: true, dist_m: 9, patrol: [9, 12], breaks: 2 },
  { id: "t05", oid: "u5",  vid: "wsf", sch_start: 10, sch_end: 18, act_start: 10.0, act_end: null,
    status: "on_duty", late_min: 0, photo: true, gps_ok: true, dist_m: 41, patrol: [5, 6], breaks: 1 },
  { id: "t06", oid: "u11", vid: "wsf", sch_start: 10, sch_end: 18, act_start: 10.5, act_end: null,
    status: "on_duty", late_min: 28, photo: true, gps_ok: true, dist_m: 38, patrol: [4, 6], breaks: 1, was_late: true },
  { id: "t07", oid: "u9",  vid: "shm", sch_start: 14, sch_end: 22, act_start: 14.10, act_end: null,
    status: "on_duty", late_min: 6, photo: true, gps_ok: true, dist_m: 18, patrol: [1, 4], breaks: 0 },

  // ---- EXCEPTIONS open right now ----
  { id: "t10", oid: "u7",  vid: "dok", sch_start: 6, sch_end: 14, act_start: null, act_end: null,
    status: "no_show", late_min: 522 /* 8h22m past start */, photo: false, gps_ok: null,
    note: "Tried calling 3×, voicemail. Backup officer dispatched 14:05." },
  { id: "t11", oid: "u6",  vid: "rah", sch_start: 10, sch_end: 14, act_start: 10.2, act_end: null,
    status: "missing_out", late_min: 12, photo: true, gps_ok: true, dist_m: 33, patrol: [3, 4], breaks: 1,
    note: "Shift ended 42 min ago — no check-out. Auto-checkout in 18 min." },
  { id: "t12", oid: "u12", vid: "o2g", sch_start: 11, sch_end: 19, act_start: 11.05, act_end: null,
    status: "on_duty", late_min: 3, photo: true, gps_ok: false, dist_m: 412, patrol: [2, 5], breaks: 1,
    geofence_fail: true,
    note: "Checked in 412m from venue boundary. Manager pinged for confirmation." },

  // ---- COMPLETED earlier today ----
  { id: "t20", oid: "u8",  vid: "vpk", sch_start: 5, sch_end: 11, act_start: 5.02, act_end: 11.05,
    status: "pending_approval", late_min: 1, photo: true, gps_ok: true, dist_m: 28, patrol: [4, 4], breaks: 1 },
  { id: "t21", oid: "u10", vid: "khq", sch_start: 5, sch_end: 9, act_start: 5.0, act_end: 8.40,
    status: "early_out", late_min: 0, early_min: 36, photo: true, gps_ok: true, dist_m: 19, patrol: [3, 3], breaks: 0,
    note: "Officer left early, cited equipment fault. Awaiting manager review." },

  // ---- UPCOMING tonight ----
  { id: "t30", oid: "u9",  vid: "dok", sch_start: 18, sch_end: 26, act_start: null, act_end: null, status: "upcoming" },
  { id: "t31", oid: null,  vid: "rah", sch_start: 18, sch_end: 23, act_start: null, act_end: null, status: "upcoming", open: true },
  { id: "t32", oid: "u3",  vid: "shm", sch_start: 20, sch_end: 28, act_start: null, act_end: null, status: "upcoming" },
  { id: "t33", oid: null,  vid: "o2g", sch_start: 17, sch_end: 23, act_start: null, act_end: null, status: "upcoming", open: true },
];

// ---------- ADJUSTMENTS audit (for drawer) ----------
const ADJUSTMENTS = {
  "t06": [
    { at: "2026-04-23T11:14:00", by: "Maya Chen (Manager)",
      field: "check_in_time", from: "10:30", to: "10:30",
      reason: "Officer reported app would not load — confirmed via radio at 10:32." },
  ],
  "t21": [
    { at: "2026-04-23T08:55:00", by: "Maya Chen (Manager)",
      field: "check_out_time", from: "08:40", to: "08:40",
      reason: "Faulty fire-panel forced site closure. Approved early dismissal." },
  ],
};

// ---------- WEEK ROLLUP (Mon 20 → today, Thu 23) ----------
// For Timesheets table — one row per officer-week.
// Each: officer, scheduled_h, actual_h, variance_h, late_count, no_show_count,
//        early_out_count, missing_out_count, geofence_count, status (draft/ready/approved),
//        per-day cells [{day, sch, act, status}].
const WEEK_DAYS = [
  { d: 0, label: "Mon",  date: "20" },
  { d: 1, label: "Tue",  date: "21" },
  { d: 2, label: "Wed",  date: "22" },
  { d: 3, label: "Thu",  date: "23", today: true },
  { d: 4, label: "Fri",  date: "24" },
  { d: 5, label: "Sat",  date: "25", bh: true },
  { d: 6, label: "Sun",  date: "26" },
];

// Helper to build day cells; status: ok|late|early|noshow|missing|geofence|absent|pending|approved|future
const dc = (sch, act, status) => ({ sch, act, status });

const TIMESHEETS = [
  { oid: "u1", scheduled: 32, actual: 31.92, variance: -0.08, status: "ready",
    flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(8,8,"approved"),
      dc(8,7.92,"pending"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u2", scheduled: 32, actual: 31.85, variance: -0.15, status: "ready",
    flags: { late: 1, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(8,8,"approved"),
      dc(8,7.85,"pending"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u3", scheduled: 34, actual: 33.55, variance: -0.45, status: "review",
    flags: { late: 2, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(10,9.83,"late"),
      dc(8,7.72,"late"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u4", scheduled: 48, actual: 48.05, variance: 0.05, status: "ready",
    flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(12,12,"approved"), dc(12,12,"approved"), dc(12,12.05,"approved"),
      dc(12,12,"pending"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u5", scheduled: 32, actual: 32.08, variance: 0.08, status: "ready",
    flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(8,8.08,"approved"), dc(8,8,"approved"), dc(8,8,"approved"),
      dc(8,8,"pending"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u6", scheduled: 16, actual: 8.30, variance: -7.70, status: "review",
    flags: { late: 0, early: 0, noshow: 0, missing: 1, geofence: 0 },
    days: [
      dc(0,0,"absent"), dc(0,0,"absent"), dc(8,8,"approved"),
      dc(4,0.30,"missing"), dc(0,0,"future"), dc(4,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u7", scheduled: 40, actual: 24.0, variance: -16.0, status: "blocked",
    flags: { late: 0, early: 0, noshow: 1, missing: 0, geofence: 0 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(8,8,"approved"),
      dc(8,0,"noshow"), dc(0,0,"future"), dc(8,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u8", scheduled: 24, actual: 24.05, variance: 0.05, status: "review",
    flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(6,6,"approved"), dc(6,6.05,"approved"), dc(6,6,"approved"),
      dc(6,6,"pending"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u9", scheduled: 32, actual: 31.90, variance: -0.10, status: "ready",
    flags: { late: 1, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(8,8,"approved"),
      dc(8,7.90,"late"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u10", scheduled: 16, actual: 11.40, variance: -4.60, status: "review",
    flags: { late: 0, early: 1, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(4,4,"approved"), dc(4,4,"approved"), dc(4,4,"approved"),
      dc(4,3.40,"early"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u11", scheduled: 32, actual: 31.50, variance: -0.50, status: "review",
    flags: { late: 1, early: 0, noshow: 0, missing: 0, geofence: 0 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(8,8,"approved"),
      dc(8,7.50,"late"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
  { oid: "u12", scheduled: 24, actual: 23.95, variance: -0.05, status: "blocked",
    flags: { late: 0, early: 0, noshow: 0, missing: 0, geofence: 1 },
    days: [
      dc(8,8,"approved"), dc(8,8,"approved"), dc(0,0,"absent"),
      dc(8,7.95,"geofence"), dc(0,0,"future"), dc(0,0,"future"), dc(0,0,"future")
    ]},
];

// ---------- DERIVED STATS ----------
const liveShifts = SHIFTS_TODAY.filter(s => s.status === "on_duty" || s.status === "missing_out");
const exceptionShifts = SHIFTS_TODAY.filter(s =>
  s.status === "no_show" || s.status === "missing_out" ||
  s.geofence_fail || s.status === "early_out" ||
  (s.was_late || s.late_min >= 10));

const ATT_STATS = {
  on_duty: SHIFTS_TODAY.filter(s => s.status === "on_duty").length,
  scheduled_today: SHIFTS_TODAY.filter(s => s.status !== "upcoming" || true).length,
  pending: SHIFTS_TODAY.filter(s => s.status === "pending_approval" || s.status === "early_out").length,
  exceptions: exceptionShifts.length,
  no_show: SHIFTS_TODAY.filter(s => s.status === "no_show").length,
  missing_out: SHIFTS_TODAY.filter(s => s.status === "missing_out").length,
  geofence: SHIFTS_TODAY.filter(s => s.geofence_fail).length,
  late: SHIFTS_TODAY.filter(s => (s.late_min||0) >= 10).length,
  early_out: SHIFTS_TODAY.filter(s => s.status === "early_out").length,

  // For attendance-rate gauge
  expected_so_far: 11, // shifts whose start_time has passed
  showed_up: 9,        // expected - no_shows - currently no-show late >30m
  // = 9/11 = 81.8%
};

// ---------- HELPERS ----------
const A_oById = (id) => A_OFFICERS.find(o => o.id === id);
const A_vById = (id) => A_VENUES.find(v => v.id === id);

const fmtHr = (h) => {
  if (h == null) return "—";
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
};
const fmtRange2 = (s, e) => `${fmtHr(s)} – ${fmtHr(e)}`;
const fmtVar = (m) => {
  if (!m) return "on time";
  const sign = m > 0 ? "+" : "−";
  const abs = Math.abs(m);
  if (abs < 60) return `${sign}${abs}m`;
  const h = Math.floor(abs / 60), mm = abs % 60;
  return `${sign}${h}h${mm ? " " + mm + "m" : ""}`;
};
const fmtH2 = (h) => h ? `${Math.floor(h)}h ${String(Math.round((h-Math.floor(h))*60)).padStart(2,"0")}m` : "—";

// ---------- ICONS (replicated from scheduling-data so Attendance is standalone) ----------
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
    "check":      <><path d="M5 12l4 4L19 7"/></>,
    "x":          <><path d="M6 6l12 12M18 6L6 18"/></>,
    "more":       <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    "edit":       <><path d="M4 20h4L20 8l-4-4L4 16v4z"/></>,
    "filter":     <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/></>,
    "file":       <><path d="M7 3h8l4 4v14H7V3z"/><path d="M15 3v4h4"/></>,
    "info":       <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></>,
    "pause":      <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
    "eye":        <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  };
  return <svg {...common}>{p[name]}</svg>;
};

Object.assign(window, {
  NOW_HOUR, NOW_LABEL, TODAY_LABEL, TODAY_ISO,
  A_VENUES, A_OFFICERS, SHIFTS_TODAY, ADJUSTMENTS, WEEK_DAYS, TIMESHEETS,
  liveShifts, exceptionShifts, ATT_STATS,
  A_oById, A_vById, fmtHr, fmtRange2, fmtVar, fmtH2,
  SIcon,
});
