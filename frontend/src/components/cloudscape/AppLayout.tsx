import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TopNavigation from './TopNavigation';
import SideNavigation from './SideNavigation';
import BreadcrumbGroup, { getBreadcrumbs } from './BreadcrumbGroup';
import '../../styles/cloudscape-tokens.css';

// === Mobile Bottom Nav Icons ===
const bottomNavIcons = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  shifts: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  team: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  exchange: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  invoices: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { authState, isUserRole } = useAuth();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const breadcrumbs = getBreadcrumbs(location.pathname);

  // Determine if user is staff (to show Exchange vs Team)
  const isStaff = authState.user?.role === 'staff';

  // Mobile bottom nav items
  const bottomNavItems = [
    { label: 'Home', icon: bottomNavIcons.home, href: '/dashboard' },
    { label: 'Shifts', icon: bottomNavIcons.shifts, href: '/shifts' },
    isStaff
      ? { label: 'Exchange', icon: bottomNavIcons.exchange, href: '/shifts/exchange' }
      : { label: 'Team', icon: bottomNavIcons.team, href: '/staff-shifts' },
    { label: 'Invoices', icon: bottomNavIcons.invoices, href: '/invoices' },
    { label: 'Profile', icon: bottomNavIcons.profile, href: '/profile' },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-[#f2f3f3]">
      {/* Sidebar */}
      <SideNavigation isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation */}
        <TopNavigation onMenuToggle={toggleSidebar} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-auto">
          <BreadcrumbGroup items={breadcrumbs} className="px-5 lg:px-6 pt-4" />
          <div className="px-5 lg:px-6 py-4 pb-20 lg:pb-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom navigation - visible below lg breakpoint */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
          <div className="flex items-center justify-around h-14">
            {bottomNavItems.map((item) => {
              const active = isActiveRoute(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
                    active
                      ? 'text-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default AppLayout;
