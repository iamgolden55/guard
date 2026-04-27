import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  text: string;
  href?: string;
}

interface BreadcrumbGroupProps {
  items: BreadcrumbItem[];
  className?: string;
}

const BreadcrumbGroup: React.FC<BreadcrumbGroupProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`${className}`}>
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !item.href ? (
                <span className={isLast ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                  {item.text}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-gray-500 hover:text-gray-700 hover:underline transition-colors"
                >
                  {item.text}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Route-to-breadcrumb configuration
export const routeBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Dashboard' }],
  '/shifts': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'My shifts' }],
  '/shifts/exchange': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Shifts', href: '/shifts' }, { text: 'Shift exchange' }],
  '/shifts/new': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Shifts', href: '/shifts' }, { text: 'Start shift' }],
  '/invoices': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'My invoices' }],
  '/profile': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Profile' }],
  '/leave': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Leave management' }],
  '/staff-shifts': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Staff shifts' }],
  '/approvals': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Approvals' }],
  '/compliance': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Compliance' }],
  '/admin/staff': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Staff management' }],
  '/admin/scheduling': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Shift scheduling' }],
  '/admin/venues': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Venues' }],
  '/admin/recruitment': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Recruitment' }],
  '/admin/invoices': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Invoices' }],
  '/admin/bank-holidays': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Bank holidays' }],
  '/admin/deputy': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Deputy integration' }],
  '/admin/employment-types': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Employment types' }],
  '/admin/attendance': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Attendance' }],
  '/admin/reports': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Reports' }],
  '/admin/leave-reports': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Leave reports' }],
  '/admin/finance-integrations': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Finance integrations' }],
  '/admin/compliance-settings': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Compliance settings' }],
  '/admin/settings': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Settings' }],
  '/admin/analytics': [{ text: 'Mead Security', href: '/dashboard' }, { text: 'Analytics' }],
};

/** Get breadcrumbs for a given pathname, with fallback for dynamic routes */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Exact match
  if (routeBreadcrumbs[pathname]) return routeBreadcrumbs[pathname];

  // Try matching with dynamic segments (e.g., /shifts/:id)
  for (const [pattern, crumbs] of Object.entries(routeBreadcrumbs)) {
    if (pathname.startsWith(pattern + '/')) {
      return [...crumbs];
    }
  }

  // Fallback: try prefix matching for nested routes
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const prefix = '/' + segments.slice(0, i).join('/');
    if (routeBreadcrumbs[prefix]) {
      return routeBreadcrumbs[prefix];
    }
  }

  return [{ text: 'Mead Security', href: '/dashboard' }];
}

export default BreadcrumbGroup;
