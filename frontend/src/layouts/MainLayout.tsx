import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Persona,
  PersonaSize,
  Stack,
  Nav,
  type INavLink,
  type INavLinkGroup,
  CommandBar,
  type ICommandBarItemProps,
  useTheme
} from '@fluentui/react';
import {
  Grid24Filled,
  CalendarLtr24Regular,
  ArrowSwap24Regular,
  Receipt24Regular,
  PeopleTeam24Regular,
  Person24Regular
} from '@fluentui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { NavIcon } from '../components/navigation/NavIcon';

// Icon mapping for navigation items (separate from INavLink to avoid Fluent UI font icons)
const NAV_ICON_MAP: Record<string, string> = {
  '/': 'Tiles',
  '/shifts': 'Calendar',
  '/shifts/exchange': 'SwitcherStartEnd',
  '/invoices': 'PaymentCard',
  '/leave': 'Calendar',
  '/staff-shifts': 'PeopleAlert',
  '/approvals': 'ToDoLogoOutline',
  '/compliance': 'ComplianceAudit',
  '/admin/staff': 'People',
  '/admin/scheduling': 'ScheduleEventAction',
  '/admin/venues': 'MapPin',
  '/admin/recruitment': 'AddFriend',
  '/admin/invoices': 'Money',
  '/admin/bank-holidays': 'EventDateMissed12',
  '/admin/deputy': 'Plug',
  '/admin/settings': 'Settings',
};


interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { authState, logout, isUserRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Get user display name
  const userDisplayName = (() => {
    if (!authState.user) return 'User';

    const user = authState.user;
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';

    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    // Fallback to username if names aren't available
    return user.username || 'User';
  })();

  // Get the selected key based on current location
  const getSelectedKey = (): string => {
    const path = location.pathname;

    // Handle exact matches first
    if (path === '/') return '/';
    if (path === '/dashboard') return '/';

    // Handle staff-shifts specifically
    if (path === '/staff-shifts') return '/staff-shifts';

    // Handle leave management routes - all consolidated under /leave
    if (path.startsWith('/leave')) return '/leave';

    // Handle compliance routes
    if (path.startsWith('/compliance')) return '/compliance';

    // Reports routes removed

    // Handle admin routes
    if (path.startsWith('/admin/staff')) return '/admin/staff';
    if (path.startsWith('/admin/scheduling')) return '/admin/scheduling';
    if (path.startsWith('/admin/venues')) return '/admin/venues';
    if (path.startsWith('/admin/recruitment')) return '/admin/recruitment';
    if (path.startsWith('/admin/invoices')) return '/admin/invoices';
    if (path.startsWith('/admin/deputy')) return '/admin/deputy';
    if (path.startsWith('/admin/compliance-settings')) return '/admin/compliance-settings';
    if (path.startsWith('/admin/bank-holidays')) return '/admin/bank-holidays';
    if (path.startsWith('/admin/settings')) return '/admin/settings';

    // Handle other routes
    if (path.startsWith('/shifts/exchange')) return '/shifts/exchange';
    if (path.startsWith('/shifts')) return '/shifts';
    if (path.startsWith('/invoices')) return '/invoices';
    if (path.startsWith('/approvals')) return '/approvals';

    // Default fallback
    return path;
  };

  // Define navigation items based on role
  const getNavItems = (): INavLinkGroup[] => {
    // Common links for all users
    // NOTE: icon property removed to prevent Fluent UI from rendering broken font icons
    // Icons are rendered via NAV_ICON_MAP and onRenderLink using SVG components
    const commonLinks: INavLink[] = [
      {
        name: 'Dashboard',
        url: '/',
        key: '/',
        isExpanded: location.pathname === '/'
      }
    ];

    // Staff specific links
    const staffLinks: INavLink[] = [
      {
        name: 'My Shifts',
        url: '/shifts',
        key: '/shifts',
        isExpanded: location.pathname.startsWith('/shifts')
      },
      {
        name: 'Shift Exchange',
        url: '/shifts/exchange',
        key: '/shifts/exchange',
        isExpanded: location.pathname.startsWith('/shifts/exchange')
      },
      {
        name: 'My Invoices',
        url: '/invoices',
        key: '/invoices',
        isExpanded: location.pathname.startsWith('/invoices')
      },
      {
        name: 'Leave Management',
        url: '/leave',
        key: '/leave',
        isExpanded: location.pathname.startsWith('/leave')
      }
    ];

    // Manager specific links
    const managerLinks: INavLink[] = [
      {
        name: 'Staff Shifts',
        url: '/staff-shifts',
        key: '/staff-shifts',
        isExpanded: location.pathname.startsWith('/staff-shifts')
      },
      {
        name: 'Approvals',
        url: '/approvals',
        key: '/approvals',
        isExpanded: location.pathname.startsWith('/approvals')
      },
      {
        name: 'Compliance',
        url: '/compliance',
        key: '/compliance',
        isExpanded: location.pathname.startsWith('/compliance')
      }
    ];

    // Admin specific links
    const adminLinks: INavLink[] = [
      {
        name: 'Staff Management',
        url: '/admin/staff',
        key: '/admin/staff',
        isExpanded: location.pathname.startsWith('/admin/staff')
      },
      {
        name: 'Shift Scheduling',
        url: '/admin/scheduling',
        key: '/admin/scheduling',
        isExpanded: location.pathname.startsWith('/admin/scheduling')
      },
      {
        name: 'Venues',
        url: '/admin/venues',
        key: '/admin/venues',
        isExpanded: location.pathname.startsWith('/admin/venues')
      },
      {
        name: 'Recruitment',
        url: '/admin/recruitment',
        key: '/admin/recruitment',
        isExpanded: location.pathname.startsWith('/admin/recruitment')
      },
      {
        name: 'Invoices',
        url: '/admin/invoices',
        key: '/admin/invoices',
        isExpanded: location.pathname.startsWith('/admin/invoices')
      },
      {
        name: 'Bank Holidays',
        url: '/admin/bank-holidays',
        key: '/admin/bank-holidays',
        isExpanded: location.pathname.startsWith('/admin/bank-holidays')
      },
      {
        name: 'Deputy Integration',
        url: '/admin/deputy',
        key: '/admin/deputy',
        isExpanded: location.pathname.startsWith('/admin/deputy')
      },
      {
        name: 'Settings',
        url: '/admin/settings',
        key: '/admin/settings',
        isExpanded: location.pathname.startsWith('/admin/settings')
      }
    ];

    // Combine links based on user role
    let navLinks = [...commonLinks];

    if (authState.user && authState.currentMembership) {
      // CRITICAL SECURITY: Get role from BOTH user and membership for safety
      const userRole = authState.user.role.toLowerCase();
      const membershipRole = authState.currentMembership.role.toLowerCase();
      const effectiveRole = membershipRole === 'owner' ? 'admin' : membershipRole;

      // DEBUG: Log role information
      console.log('MainLayout - Sidebar Navigation Roles:', {
        userRole,
        membershipRole,
        effectiveRole,
        username: authState.user.username,
        timestamp: new Date().toISOString()
      });

      // SECURITY: Explicit role-based menu rendering
      // CRITICAL: Check userRole FIRST - staff users ALWAYS get staff menu only
      if (userRole === 'staff') {
        // Staff users ONLY see staff links, regardless of membership role
        console.log('MainLayout - Rendering STAFF menu (staff only) - userRole override');
        navLinks = [...navLinks, ...staffLinks];
      } else if (effectiveRole === 'manager') {
        // Managers see staff + manager links
        console.log('MainLayout - Rendering MANAGER menu (staff + manager)');
        navLinks = [...navLinks, ...staffLinks, ...managerLinks];
      } else if (effectiveRole === 'admin') {
        // Admins see all links
        console.log('MainLayout - Rendering ADMIN menu (staff + manager + admin)');
        navLinks = [...navLinks, ...staffLinks, ...managerLinks, ...adminLinks];
      } else {
        // Fallback: only show common links
        console.warn('MainLayout - Unknown role combination, showing only common links:', { userRole, effectiveRole });
      }
    } else {
      console.warn('MainLayout - User or membership not loaded yet', {
        hasUser: !!authState.user,
        hasMembership: !!authState.currentMembership
      });
    }

    return [{ links: navLinks }];
  };

  // Command bar items (top right)
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'profile',
      text: userDisplayName,
      iconProps: { iconName: 'Contact' },
      subMenuProps: {
        items: [
          {
            key: 'profile',
            text: 'My Profile',
            iconProps: { iconName: 'UserOptional' },
            onClick: () => {
              navigate('/profile');
              return void 0;
            }
          },
          {
            key: 'logout',
            text: 'Logout',
            iconProps: { iconName: 'SignOut' },
            onClick: () => {
              logout();
              navigate('/login');
              return void 0;
            }
          }
        ]
      }
    }
  ];

  // Toggle mobile nav
  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: theme.palette.themePrimary,
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: theme.effects.elevation4
        }}
      >
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          {/* Mobile menu button */}
          <button
            style={{
              display: 'none',
              color: theme.palette.white,
              padding: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px'
            }}
            className="md:block"
            onClick={toggleMobileNav}
          >
            ☰
          </button>

          <Link
            to="/"
            className="portal-title"
            style={{
              color: theme.palette.white,
              fontSize: '20px',
              fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '-0.02em'
            }}
          >
            Security Staff Portal
          </Link>
        </Stack>

        {/* Command bar for user menu */}
        <CommandBar
          items={commandBarItems}
          ariaLabel="User menu"
          styles={{
            root: {
              backgroundColor: 'transparent',
              padding: 0
            }
          }}
        />
      </header>

      <Stack horizontal styles={{ root: { flex: 1, minHeight: 0 } }}>
        {/* Sidebar - hidden on mobile unless toggled */}
        <aside
          className={`md:block ${isMobileNavOpen ? 'block absolute z-10 h-full' : 'hidden'}`}
          style={{
            width: 250,
            minWidth: 250,
            backgroundColor: theme.palette.neutralLighter,
            boxShadow: theme.effects.elevation4
          }}
        >
          <Stack
            styles={{
              root: {
                padding: 16,
                borderBottom: `1px solid ${theme.palette.neutralLight}`
              }
            }}
          >
            <Persona
              size={PersonaSize.size40}
              text={userDisplayName}
              secondaryText={authState.user?.role}
            />
          </Stack>

          <Nav
            groups={getNavItems()}
            selectedKey={getSelectedKey()}
            onRenderLink={(link) => {
              if (!link) return null;
              const isSelected = link.key === getSelectedKey();
              const iconName = link.key ? NAV_ICON_MAP[link.key] : undefined;
              return (
                <span style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {iconName && <NavIcon iconName={iconName} isSelected={isSelected} />}
                  <span>{link.name}</span>
                </span>
              );
            }}
            styles={{
              root: {
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto'
              },
              navItems: {
                margin: '4px 0'
              },
              link: {
                height: 42,
                lineHeight: 42,
                selectors: {
                  '&.is-selected': {
                    backgroundColor: theme.palette.themePrimary + '15',
                    color: theme.palette.neutralPrimary,
                    fontWeight: 600,
                    borderLeft: `3px solid ${theme.palette.themePrimary}`
                  },
                  '&.is-selected::after': {
                    borderLeft: 'none'
                  }
                }
              }
            }}
            onLinkClick={() => setIsMobileNavOpen(false)}
          />
        </aside>

        {/* Main content area */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 8,
            minHeight: 0,
            backgroundColor: theme.palette.neutralLighterAlt
          }}
        >
          <Stack styles={{ root: { minHeight: '100%' } }}>
            {children}
          </Stack>
        </main>
      </Stack>

      {/* Mobile bottom navigation */}
      <Stack
        horizontal
        horizontalAlign="space-around"
        className="md:hidden"
        styles={{
          root: {
            backgroundColor: theme.palette.neutralLighter,
            borderTop: `1px solid ${theme.palette.neutralLight}`,
            padding: 0
          }
        }}
      >
        <Link to="/" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: theme.palette.neutralPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Grid24Filled className="w-5 h-5" style={{ color: '#d13438' }} />
          <div style={{ fontSize: 12 }}>Home</div>
        </Link>
        <Link to="/shifts" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: theme.palette.neutralPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CalendarLtr24Regular className="w-5 h-5" style={{ color: '#c239b3' }} />
          <div style={{ fontSize: 12 }}>Shifts</div>
        </Link>
        {(() => {
          // SECURITY: Explicit role check for mobile navigation
          if (!authState.user || !authState.currentMembership) return null;
          const membershipRole = authState.currentMembership.role.toLowerCase();
          const effectiveRole = membershipRole === 'owner' ? 'admin' : membershipRole;

          return (effectiveRole === 'manager' || effectiveRole === 'admin') ? (
            <Link to="/leave/team-overview" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: theme.palette.neutralPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PeopleTeam24Regular className="w-5 h-5" style={{ color: '#498205' }} />
              <div style={{ fontSize: 12 }}>Team</div>
            </Link>
          ) : (
            <Link to="/shifts/exchange" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: theme.palette.neutralPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ArrowSwap24Regular className="w-5 h-5" style={{ color: '#ca5010' }} />
              <div style={{ fontSize: 12 }}>Exchange</div>
            </Link>
          );
        })()}
        <Link to="/invoices" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: theme.palette.neutralPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Receipt24Regular className="w-5 h-5" style={{ color: '#018574' }} />
          <div style={{ fontSize: 12 }}>Invoices</div>
        </Link>
        <Link to="/profile" style={{ padding: 12, textAlign: 'center', textDecoration: 'none', color: theme.palette.neutralPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Person24Regular className="w-5 h-5" style={{ color: '#605e5c' }} />
          <div style={{ fontSize: 12 }}>Profile</div>
        </Link>
      </Stack>
    </div>
  );
};

export default MainLayout;
