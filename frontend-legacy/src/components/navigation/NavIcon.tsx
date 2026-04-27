import type React from 'react';
import {
  Grid24Filled,
  CalendarLtr24Regular,
  ArrowSwap24Regular,
  Receipt24Regular,
  PeopleTeam24Regular,
  ClipboardTaskListLtr24Regular,
  ShieldCheckmark24Regular,
  People24Regular,
  Location24Regular,
  Money24Regular,
  CalendarStar24Regular,
  PlugConnected24Regular,
  PersonAdd24Regular,
  Settings24Regular,
  Person24Regular,
  Home24Regular,
  type FluentIconsProps
} from '@fluentui/react-icons';

// Map Fluent UI icon names to SVG components
const iconMap: Record<string, React.ComponentType<FluentIconsProps>> = {
  // Dashboard
  'Tiles': Grid24Filled,
  'ViewDashboard': Grid24Filled,
  'Home': Home24Regular,

  // Calendar/Shifts
  'Calendar': CalendarLtr24Regular,
  'ScheduleEventAction': CalendarLtr24Regular,

  // Exchange
  'SwitcherStartEnd': ArrowSwap24Regular,

  // Invoices/Payment
  'PaymentCard': Receipt24Regular,
  'Money': Money24Regular,

  // Staff/People
  'PeopleAlert': PeopleTeam24Regular,
  'People': People24Regular,
  'Contact': Person24Regular,

  // Approvals/Tasks
  'ToDoLogoOutline': ClipboardTaskListLtr24Regular,

  // Compliance
  'ComplianceAudit': ShieldCheckmark24Regular,

  // Venues
  'MapPin': Location24Regular,

  // Bank Holidays
  'EventDateMissed12': CalendarStar24Regular,

  // Integration
  'Plug': PlugConnected24Regular,

  // Recruitment
  'AddFriend': PersonAdd24Regular,

  // Settings
  'Settings': Settings24Regular,
};

// Icon color mapping based on category
const iconColorMap: Record<string, string> = {
  'Tiles': '#d13438',          // Dashboard - muted red
  'ViewDashboard': '#d13438',
  'Home': '#d13438',
  'Calendar': '#c239b3',       // Calendar - muted purple
  'ScheduleEventAction': '#c239b3',
  'SwitcherStartEnd': '#ca5010', // Exchange - muted orange
  'PaymentCard': '#018574',    // Invoices - teal
  'Money': '#018574',
  'PeopleAlert': '#498205',    // Staff - green
  'People': '#8764b8',         // People - purple
  'Contact': '#605e5c',        // Contact - gray
  'ToDoLogoOutline': '#8764b8', // Approvals - purple
  'ComplianceAudit': '#0078d4', // Compliance - blue
  'MapPin': '#107c10',         // Venues - green
  'EventDateMissed12': '#986f0b', // Bank Holidays - gold
  'Plug': '#986f0b',           // Integration - gold
  'AddFriend': '#498205',      // Recruitment - green
  'Settings': '#605e5c',       // Settings - gray
};

interface NavIconProps {
  iconName: string;
  className?: string;
  isSelected?: boolean;
}

export const NavIcon: React.FC<NavIconProps> = ({ iconName, className = '', isSelected = false }) => {
  const IconComponent = iconMap[iconName];

  if (!IconComponent) {
    // Fallback for unmapped icons
    console.warn(`NavIcon: No mapping found for icon "${iconName}"`);
    return null;
  }

  // Use brand red when selected, otherwise use category color
  const color = isSelected ? '#cb2431' : (iconColorMap[iconName] || '#605e5c');

  return (
    <IconComponent
      className={`nav-icon ${className}`}
      style={{
        color,
        width: 20,
        height: 20,
        flexShrink: 0,
        marginRight: 12,
        transition: 'all 0.15s ease'
      }}
    />
  );
};

export default NavIcon;
