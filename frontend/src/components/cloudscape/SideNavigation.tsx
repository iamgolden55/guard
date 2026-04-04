import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  text: string;
  href: string;
  icon: string; // LineIcons class name (e.g. 'lni-dashboard-square-1')
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface SideNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

function getNavSections(effectiveRole: string): NavSection[] {
  const sections: NavSection[] = [];

  sections.push({
    items: [
      { text: 'Dashboard', href: '/dashboard', icon: 'lni-dashboard-square-1' },
    ],
  });

  sections.push({
    title: 'Staff',
    items: [
      { text: 'My shifts', href: '/shifts', icon: 'lni-alarm-1' },
      { text: 'Shift exchange', href: '/shifts/exchange', icon: 'lni-arrow-both-direction-horizontal-1' },
      { text: 'My invoices', href: '/invoices', icon: 'lni-dollar-circle' },
      { text: 'Leave management', href: '/leave', icon: 'lni-calendar-days' },
    ],
  });

  if (effectiveRole === 'manager' || effectiveRole === 'admin') {
    sections.push({
      title: 'Management',
      items: [
        { text: 'Staff shifts', href: '/staff-shifts', icon: 'lni-user-multiple-4' },
        { text: 'Approvals', href: '/approvals', icon: 'lni-check-circle-1' },
        { text: 'Compliance', href: '/compliance', icon: 'lni-shield-2-check' },
      ],
    });
  }

  if (effectiveRole === 'admin') {
    sections.push({
      title: 'Administration',
      items: [
        { text: 'Staff management', href: '/admin/staff', icon: 'lni-user-4' },
        { text: 'Shift scheduling', href: '/admin/scheduling', icon: 'lni-calendar-days' },
        { text: 'Venues', href: '/admin/venues', icon: 'lni-map-marker-1' },
        { text: 'Recruitment', href: '/admin/recruitment', icon: 'lni-hand-taking-user' },
        { text: 'Invoices', href: '/admin/invoices', icon: 'lni-dollar-circle' },
        { text: 'Employment types', href: '/admin/employment-types', icon: 'lni-briefcase-1' },
        { text: 'Bank holidays', href: '/admin/bank-holidays', icon: 'lni-star-fat' },
        { text: 'Attendance', href: '/admin/attendance', icon: 'lni-clipboard' },
        { text: 'Reports', href: '/admin/reports', icon: 'lni-bar-chart-4' },
        { text: 'Analytics', href: '/admin/analytics', icon: 'lni-pie-chart-2' },
      ],
    });

    sections.push({
      title: 'Integrations',
      items: [
        { text: 'Deputy', href: '/admin/deputy', icon: 'lni-bolt-2' },
        { text: 'Finance', href: '/admin/finance-integrations', icon: 'lni-credit-card-multiple' },
      ],
    });

    sections.push({
      title: 'System',
      items: [
        { text: 'Compliance settings', href: '/admin/compliance-settings', icon: 'lni-shield-2' },
        { text: 'Settings', href: '/admin/settings', icon: 'lni-gear-1' },
      ],
    });
  }

  return sections;
}

const SideNavigation: React.FC<SideNavigationProps> = ({ isOpen, onClose, className = '' }) => {
  const { authState } = useAuth();
  const location = useLocation();

  const userRole = authState.user?.role?.toLowerCase() || 'staff';
  const membershipRole = authState.currentMembership?.role?.toLowerCase() || userRole;
  const effectiveRole = userRole === 'staff' ? 'staff' : (membershipRole === 'owner' ? 'admin' : membershipRole);

  const sections = getNavSections(effectiveRole);

  const isActive = (href: string): boolean => {
    if (href === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[260px] bg-white border-r border-[#EAEAF0]
          flex flex-col overflow-hidden
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${className}
        `}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-[#EAEAF0] flex-shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-[#DC2626] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-wide">MS</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-[14px] text-[#1A1A2E] leading-tight">Mead Security</span>
            <span className="text-[11px] text-[#9CA3AF] leading-tight">Workforce platform</span>
          </div>

          {/* Close button (mobile) */}
          <button
            onClick={onClose}
            className="lg:hidden ml-auto p-1.5 rounded-lg hover:bg-[#F7F7FA] text-[#9CA3AF] transition-colors"
            aria-label="Close navigation"
          >
            <i className="lni lni-xmark text-[14px]" />
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto py-4 px-4">
          {sections.map((section, sIndex) => (
            <div key={sIndex} className={sIndex > 0 ? 'mt-6' : ''}>
              {section.title && (
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[15px] font-bold
                          transition-all duration-150 no-underline
                          ${active
                            ? 'bg-[#FEF2F2] text-[#DC2626]'
                            : 'text-[#6B7280] hover:bg-[#F7F7FA] hover:text-[#1A1A2E]'
                          }
                        `}
                      >
                        <i className={`lni ${item.icon} text-[18px] flex-shrink-0 ${active ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}`} />
                        {item.text}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-4 border-t border-[#EAEAF0]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
              <span className="text-[#DC2626] font-semibold text-[11px]">
                {authState.user?.firstName?.[0]?.toUpperCase() || 'U'}
                {authState.user?.lastName?.[0]?.toUpperCase() || ''}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#1A1A2E] truncate">
                {authState.user?.firstName || 'User'} {authState.user?.lastName || ''}
              </p>
              <p className="text-[11px] text-[#9CA3AF] capitalize truncate">
                {authState.currentMembership?.role || authState.user?.role || 'Staff'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideNavigation;
