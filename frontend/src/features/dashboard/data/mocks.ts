// Dashboard mock data — ported 1:1 from project/dashboard.jsx:11-61.
// Used by useDashboardData while real backend wiring is incremental
// (each section gets replaced by a TanStack Query call as the
// corresponding endpoint is verified). Marked clearly so the data
// layer can be ripped out once everything is wired.

export type StaffStatus = "on-shift" | "break" | "late" | "off-duty";
export type Urgency = "high" | "medium" | "low";
export type ActivityKind =
  | "check-in"
  | "check-out"
  | "incident"
  | "approval"
  | "license"
  | "invoice";

export interface DashboardStaff {
  id: number;
  name: string;
  role: string;
  venue: string;
  status: StaffStatus;
  license: string;
  expiresIn: number;
  hours: number;
  rating: number;
  avatarHue: number;
}

export interface DashboardVenue {
  name: string;
  staffed: number;
  required: number;
  coverage: number;
  incidents: number;
}

export interface DashboardApproval {
  id: number;
  type: string;
  who: string;
  when: string;
  venue: string;
  urgency: Urgency;
}

export interface DashboardActivity {
  t: string;
  kind: ActivityKind;
  text: string;
}

export const MOCK_STAFF: DashboardStaff[] = [
  { id: 1, name: "James Okafor", role: "Security Officer", venue: "Southbank Arena", status: "on-shift", license: "SIA-DS", expiresIn: 124, hours: 38, rating: 4.8, avatarHue: 12 },
  { id: 2, name: "Priya Shah", role: "Supervisor", venue: "Westfield Stratford", status: "on-shift", license: "SIA-DS", expiresIn: 58, hours: 42, rating: 4.9, avatarHue: 280 },
  { id: 3, name: "Marcus Bell", role: "Control Room", venue: "Canary Wharf Tower", status: "break", license: "SIA-CCTV", expiresIn: 9, hours: 40, rating: 4.6, avatarHue: 160 },
  { id: 4, name: "Siobhan Clarke", role: "Security Officer", venue: "The O2", status: "on-shift", license: "SIA-DS", expiresIn: 212, hours: 36, rating: 4.7, avatarHue: 32 },
  { id: 5, name: "Dmitri Novak", role: "Security Officer", venue: "Kings Cross Station", status: "late", license: "SIA-DS", expiresIn: 90, hours: 44, rating: 4.4, avatarHue: 200 },
  { id: 6, name: "Aisha Bello", role: "Manager", venue: "HQ — Operations", status: "off-duty", license: "SIA-SG", expiresIn: 300, hours: 45, rating: 5.0, avatarHue: 340 },
  { id: 7, name: "Tom Reilly", role: "Security Officer", venue: "Shoreditch Market", status: "on-shift", license: "SIA-DS", expiresIn: 4, hours: 32, rating: 4.3, avatarHue: 80 },
  { id: 8, name: "Elena Costa", role: "Supervisor", venue: "ExCeL London", status: "on-shift", license: "SIA-DS", expiresIn: 175, hours: 41, rating: 4.8, avatarHue: 220 },
];

export const MOCK_VENUES: DashboardVenue[] = [
  { name: "Southbank Arena", staffed: 14, required: 14, coverage: 100, incidents: 0 },
  { name: "Westfield Stratford", staffed: 22, required: 24, coverage: 92, incidents: 1 },
  { name: "The O2", staffed: 18, required: 20, coverage: 90, incidents: 0 },
  { name: "Canary Wharf Tower", staffed: 8, required: 8, coverage: 100, incidents: 0 },
  { name: "ExCeL London", staffed: 26, required: 30, coverage: 87, incidents: 2 },
  { name: "Kings Cross Station", staffed: 11, required: 14, coverage: 79, incidents: 0 },
];

export const MOCK_APPROVALS: DashboardApproval[] = [
  { id: 1, type: "Shift swap", who: "James Okafor → Tom Reilly", when: "Thu 26 Apr, 22:00–06:00", venue: "Southbank Arena", urgency: "high" },
  { id: 2, type: "Overtime", who: "Priya Shah", when: "+4h on Fri 27 Apr", venue: "Westfield Stratford", urgency: "medium" },
  { id: 3, type: "Leave request", who: "Siobhan Clarke", when: "6–10 May", venue: "The O2", urgency: "low" },
  { id: 4, type: "Expense claim", who: "Dmitri Novak", when: "£48.20 — Travel", venue: "Kings Cross Station", urgency: "low" },
];

export const MOCK_ACTIVITY: DashboardActivity[] = [
  { t: "2m", kind: "check-in", text: "Priya Shah checked in at Westfield Stratford" },
  { t: "7m", kind: "incident", text: "Minor incident logged — ExCeL London, zone B4" },
  { t: "14m", kind: "check-in", text: "Elena Costa checked in at ExCeL London" },
  { t: "22m", kind: "approval", text: "You approved 3 shift swaps for 26 Apr" },
  { t: "38m", kind: "license", text: "SIA license for Marcus Bell expires in 9 days" },
  { t: "1h", kind: "check-out", text: "Siobhan Clarke checked out — 8h 12m logged" },
  { t: "2h", kind: "invoice", text: "Payroll run drafted for w/c 20 Apr — £84,210" },
];

// 7 × 24 coverage heatmap, deterministic synthetic shape.
export const MOCK_HEATMAP: number[][] = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const base = Math.sin((h - 6) / 3.5) * 0.5 + 0.5;
    const dayWeight = d === 5 || d === 6 ? 1.15 : 1;
    const noise = ((Math.sin(d * 7 + h * 2.3) + 1) / 2) * 0.25;
    return Math.max(0, Math.min(1, base * dayWeight + noise * 0.4 - 0.05));
  }),
);

export const MOCK_HOURS_SERIES: number[] = [312, 298, 340, 355, 301, 412, 448, 388, 360, 395, 420, 465, 478, 502];
