import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Clock, ArrowLeftRight, DollarSign, CalendarDays,
  Users, CheckCircle, ShieldCheck, UserCog, MapPin, UserPlus,
  Briefcase, Star, ClipboardList, BarChart3, PieChart,
  Zap, CreditCard, Shield, Settings, X,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  text: string;
  href: string;
  icon: LucideIcon;
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
      { text: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  });

  sections.push({
    title: 'Staff',
    items: [
      { text: 'My shifts', href: '/shifts', icon: Clock },
      { text: 'Shift exchange', href: '/shifts/exchange', icon: ArrowLeftRight },
      { text: 'My invoices', href: '/invoices', icon: DollarSign },
      { text: 'Leave management', href: '/leave', icon: CalendarDays },
    ],
  });

  if (effectiveRole === 'manager' || effectiveRole === 'admin') {
    sections.push({
      title: 'Management',
      items: [
        { text: 'Staff shifts', href: '/staff-shifts', icon: Users },
        { text: 'Approvals', href: '/approvals', icon: CheckCircle },
        { text: 'Compliance', href: '/compliance', icon: ShieldCheck },
      ],
    });
  }

  if (effectiveRole === 'admin') {
    sections.push({
      title: 'Administration',
      items: [
        { text: 'Staff management', href: '/admin/staff', icon: UserCog },
        { text: 'Shift scheduling', href: '/admin/scheduling', icon: CalendarDays },
        { text: 'Venues', href: '/admin/venues', icon: MapPin },
        { text: 'Recruitment', href: '/admin/recruitment', icon: UserPlus },
        { text: 'Invoices', href: '/admin/invoices', icon: DollarSign },
        { text: 'Employment types', href: '/admin/employment-types', icon: Briefcase },
        { text: 'Bank holidays', href: '/admin/bank-holidays', icon: Star },
        { text: 'Attendance', href: '/admin/attendance', icon: ClipboardList },
        { text: 'Reports', href: '/admin/reports', icon: BarChart3 },
        { text: 'Analytics', href: '/admin/analytics', icon: PieChart },
      ],
    });

    sections.push({
      title: 'Integrations',
      items: [
        { text: 'Deputy', href: '/admin/deputy', icon: Zap },
        { text: 'Finance', href: '/admin/finance-integrations', icon: CreditCard },
      ],
    });

    sections.push({
      title: 'System',
      items: [
        { text: 'Compliance settings', href: '/admin/compliance-settings', icon: Shield },
        { text: 'Settings', href: '/admin/settings', icon: Settings },
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
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

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
        <div className="flex items-center gap-3 h-16 px-6 border-b border-[#EAEAF0] flex-shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-[#DC2626] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-wide">MS</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-[14px] text-[#1A1A2E] leading-tight">Mead Security</span>
            <span className="text-[11px] text-[#9CA3AF] leading-tight">Workforce platform</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden ml-auto p-1.5 rounded-lg hover:bg-[#F7F7FA] text-[#9CA3AF] transition-colors"
            aria-label="Close navigation"
          >
            <X size={14} />
          </button>
        </div>

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
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        onClick={onClose}
                        className={`
                          flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[14px] font-semibold
                          transition-all duration-150 no-underline
                          ${active
                            ? 'bg-[#FEF2F2] text-[#DC2626]'
                            : 'text-[#6B7280] hover:bg-[#F7F7FA] hover:text-[#1A1A2E]'
                          }
                        `}
                      >
                        <Icon size={18} className={`flex-shrink-0 ${active ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}`} strokeWidth={1.8} />
                        {item.text}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

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
