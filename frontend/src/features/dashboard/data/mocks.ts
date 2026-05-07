// Dashboard type definitions.
//
// Shape contract between useDashboardData (which fetches /api/v1/admin/
// dashboard/overview/) and the dashboard components. Originally this file
// also held mock data; that has been replaced by the real API. The shapes
// are kept here because multiple components import them.

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
  /** Namespaced id from the backend, e.g. "leave:42" / "recruitment:7". */
  id: string;
  type: string;
  who: string;
  when: string;
  venue: string;
  urgency: Urgency;
  source: "leave" | "recruitment" | "shift";
  source_id: number;
}

export interface DashboardActivity {
  t: string;
  kind: ActivityKind;
  text: string;
}
