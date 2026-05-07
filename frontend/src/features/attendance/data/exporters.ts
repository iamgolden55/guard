// Client-side CSV exporters for the Attendance page tabs.
// Generated from the data already loaded by useAttendanceData — no extra
// network round-trip on download. Each tab gets columns shaped to what an
// admin would actually paste into payroll / a manager review email.
import {
  fmtH2,
  fmtHr,
  fmtRange2,
  type AttendanceOfficer,
  type AttendanceShift,
  type AttendanceVenue,
  type DayCellData,
  type TimesheetRow,
  type WeekDay,
} from "./mocks";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((cols) => cols.map(csvEscape).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function statusLabel(status: AttendanceShift["status"]): string {
  switch (status) {
    case "on_duty":
      return "On duty";
    case "no_show":
      return "No-show";
    case "missing_out":
      return "Missing checkout";
    case "early_out":
      return "Early checkout";
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    case "upcoming":
      return "Upcoming";
    default:
      return status;
  }
}

function exceptionReason(s: AttendanceShift): string {
  const reasons: string[] = [];
  if (s.status === "no_show") reasons.push("No-show");
  if (s.status === "missing_out") reasons.push("Missing checkout");
  if (s.status === "early_out") reasons.push(`Early checkout (${s.early_min ?? 0}m)`);
  if (s.geofence_fail) reasons.push(`Geofence (${s.dist_m ?? "?"}m off-site)`);
  if ((s.late_min ?? 0) >= 10) reasons.push(`Late check-in (+${s.late_min}m)`);
  return reasons.join(" · ");
}

interface ExportContext {
  shifts: AttendanceShift[];
  officers: AttendanceOfficer[];
  venues: AttendanceVenue[];
  timesheets: TimesheetRow[];
  weekDays: WeekDay[];
  officerById: (id: string | null | undefined) => AttendanceOfficer | undefined;
  venueById: (id: string) => AttendanceVenue | undefined;
}

export function exportLive(ctx: ExportContext): void {
  const header = [
    "Officer",
    "SIA",
    "Phone",
    "Venue",
    "Area",
    "Scheduled",
    "Actual",
    "Late (min)",
    "Status",
    "Photo",
    "GPS distance (m)",
    "Notes",
  ];
  const body = ctx.shifts.map((s) => {
    const o = ctx.officerById(s.oid);
    const v = ctx.venueById(s.vid);
    return [
      o?.name ?? "Unassigned",
      o?.sia ?? "",
      o?.phone ?? "",
      v?.name ?? "",
      v?.area ?? "",
      fmtRange2(s.sch_start, s.sch_end),
      s.act_start != null
        ? `${fmtHr(s.act_start)} – ${s.act_end != null ? fmtHr(s.act_end) : "—"}`
        : "—",
      s.late_min ?? "",
      statusLabel(s.status),
      s.photo ? "Yes" : "No",
      s.dist_m ?? "",
      s.note ?? "",
    ];
  });
  downloadCsv(
    `attendance-live-${dateStamp()}.csv`,
    rowsToCsv([header, ...body]),
  );
}

export function exportExceptions(ctx: ExportContext): void {
  const header = [
    "Officer",
    "Phone",
    "Venue",
    "Scheduled",
    "Actual",
    "Reason",
    "Late (min)",
    "Notes",
  ];
  const flagged = ctx.shifts.filter(
    (s) =>
      s.status === "no_show" ||
      s.status === "missing_out" ||
      s.geofence_fail ||
      s.status === "early_out" ||
      s.was_late ||
      (s.late_min ?? 0) >= 10,
  );
  const body = flagged.map((s) => {
    const o = ctx.officerById(s.oid);
    const v = ctx.venueById(s.vid);
    return [
      o?.name ?? "Unassigned",
      o?.phone ?? "",
      v?.name ?? "",
      fmtRange2(s.sch_start, s.sch_end),
      s.act_start != null
        ? `${fmtHr(s.act_start)} – ${s.act_end != null ? fmtHr(s.act_end) : "—"}`
        : "—",
      exceptionReason(s),
      s.late_min ?? "",
      s.note ?? "",
    ];
  });
  downloadCsv(
    `attendance-exceptions-${dateStamp()}.csv`,
    rowsToCsv([header, ...body]),
  );
}

export function exportTimesheets(ctx: ExportContext): void {
  const dayLabels = ctx.weekDays.length
    ? ctx.weekDays.map((d) => `${d.label} ${d.date}`)
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const header = [
    "Officer",
    "SIA",
    ...dayLabels.flatMap((label) => [`${label} sched`, `${label} actual`]),
    "Total scheduled",
    "Total actual",
    "Variance",
    "Status",
    "Late count",
    "Early count",
    "No-shows",
    "Missing out",
    "Geofence",
  ];
  const body = ctx.timesheets.map((t) => {
    const o = ctx.officerById(t.oid);
    const dayCells: (string | number)[] = t.days.flatMap((d: DayCellData) => [
      d.sch || "",
      d.act || "",
    ]);
    return [
      o?.name ?? `Officer ${t.oid}`,
      o?.sia ?? "",
      ...dayCells,
      t.scheduled,
      t.actual,
      t.variance,
      t.status,
      t.flags.late,
      t.flags.early,
      t.flags.noshow,
      t.flags.missing,
      t.flags.geofence,
    ];
  });
  downloadCsv(
    `attendance-timesheets-${dateStamp()}.csv`,
    rowsToCsv([header, ...body]),
  );
}

// Avoid an unused-import lint when fmtH2 is reserved for future totals export.
void fmtH2;
