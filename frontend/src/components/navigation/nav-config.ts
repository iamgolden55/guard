import type { IconName } from "../../design-system/Icon";

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  path: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

// Sidebar navigation. Every path here resolves to a route in Router.tsx —
// keep the two in step when adding a screen.
export const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "squares-2x2",
        path: "/dashboard",
      },
      {
        id: "scheduling",
        label: "Scheduling",
        icon: "calendar",
        path: "/scheduling",
      },
      {
        id: "attendance",
        label: "Attendance",
        icon: "clock",
        path: "/attendance",
      },
    ],
  },
  {
    group: "People",
    items: [
      { id: "staff", label: "Staff", icon: "users", path: "/staff" },
      {
        id: "recruitment",
        label: "Recruitment",
        icon: "user-plus",
        path: "/recruitment",
      },
      { id: "leave", label: "Leave", icon: "sun", path: "/leave" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "venues", label: "Venues", icon: "map-pin", path: "/venues" },
      {
        id: "compliance",
        label: "Compliance",
        icon: "shield",
        path: "/compliance",
      },
      {
        id: "incidents",
        label: "Incidents",
        icon: "alert",
        path: "/incidents",
      },
      {
        id: "capacity-logs",
        label: "Capacity logs",
        icon: "history",
        path: "/capacity-logs",
      },
    ],
  },
  {
    group: "Finance",
    items: [
      { id: "invoices", label: "Invoices", icon: "receipt", path: "/invoices" },
      { id: "payroll", label: "Payroll", icon: "banknote", path: "/payroll" },
      {
        id: "pay-rates",
        label: "Pay rates",
        icon: "credit-card",
        path: "/settings/pay-rates",
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: "plug",
        path: "/integrations",
      },
    ],
  },
];
