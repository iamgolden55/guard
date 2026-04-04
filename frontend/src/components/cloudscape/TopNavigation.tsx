import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface TopNavigationProps {
  onMenuToggle: () => void;
  className?: string;
}

const TopNavigation: React.FC<TopNavigationProps> = ({ onMenuToggle, className = '' }) => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userDisplayName = (() => {
    if (!authState.user) return 'User';
    const { firstName, lastName, username } = authState.user;
    if (firstName || lastName) return `${firstName || ''} ${lastName || ''}`.trim();
    return username || 'User';
  })();

  const userInitials = (() => {
    if (!authState.user) return 'U';
    const { firstName, lastName, username } = authState.user;
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName[0].toUpperCase();
    return username?.[0]?.toUpperCase() || 'U';
  })();

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  // Close menu on outside click
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isUserMenuOpen]);

  return (
    <header className={`h-14 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 flex-shrink-0 ${className}`}>
      {/* Left: Hamburger + Search */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F7F7FA] text-[#6B7280] transition-colors"
          aria-label="Toggle navigation"
        >
          <i className="lni lni-menu-hamburger-1 text-[18px]" />
        </button>

        {/* Search */}
        <div className="relative w-full max-w-sm">
          <i className="lni lni-search-1 absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search"
            className="w-full h-9 pl-9 pr-4 text-[13px] bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] placeholder-[#9CA3AF] transition-all"
          />
        </div>
      </div>

      {/* Right: Icon buttons + User avatar */}
      <div className="flex items-center gap-1">
        {/* Quick actions grid */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F7F7FA] text-[#6B7280] transition-colors"
          aria-label="Quick actions"
          title="Quick actions"
        >
          <i className="lni lni-layout-9 text-[18px]" />
        </button>

        {/* Help */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F7F7FA] text-[#6B7280] transition-colors"
          aria-label="Help"
          title="Help"
        >
          <i className="lni lni-question-mark-circle text-[18px]" />
        </button>

        {/* Notifications */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F7F7FA] text-[#6B7280] relative transition-colors"
          aria-label="Notifications"
          title="Notifications"
        >
          <i className="lni lni-bell-1 text-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#DC2626] rounded-full ring-2 ring-white" />
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate('/admin/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F7F7FA] text-[#6B7280] transition-colors"
          aria-label="Settings"
          title="Settings"
        >
          <i className="lni lni-gear-1 text-[18px]" />
        </button>

        {/* User avatar / menu */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center hover:opacity-90 transition-opacity"
            title={userDisplayName}
          >
            <span className="text-white font-semibold text-[11px]">{userInitials}</span>
          </button>

          {isUserMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[#E5E7EB] py-1.5 z-[1000] animate-fade-in"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
            >
              <div className="px-4 py-3 border-b border-[#F0F0F5]">
                <p className="text-[13px] font-semibold text-[#1A1A2E]">{userDisplayName}</p>
                <p className="text-[11px] text-[#9CA3AF] capitalize mt-0.5">
                  {authState.currentMembership?.role || authState.user?.role || 'User'}
                </p>
              </div>
              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#6B7280] hover:bg-[#F7F7FA] hover:text-[#1A1A2E] no-underline transition-colors"
                >
                  <i className="lni lni-user-4 text-[15px]" />
                  Profile
                </Link>
                <Link
                  to="/admin/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#6B7280] hover:bg-[#F7F7FA] hover:text-[#1A1A2E] no-underline transition-colors"
                >
                  <i className="lni lni-gear-1 text-[15px]" />
                  Settings
                </Link>
              </div>
              <div className="border-t border-[#F0F0F5] pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  <i className="lni lni-exit text-[15px]" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNavigation;
