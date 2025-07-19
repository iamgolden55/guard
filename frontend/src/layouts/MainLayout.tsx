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
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

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
    const firstName = user.firstName || user.first_name || '';
    const lastName = user.lastName || user.last_name || '';

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
    
    // Handle admin routes
    if (path.startsWith('/admin/staff')) return '/admin/staff';
    if (path.startsWith('/admin/scheduling')) return '/admin/scheduling';
    if (path.startsWith('/admin/venues')) return '/admin/venues';
    if (path.startsWith('/admin/recruitment')) return '/admin/recruitment';
    if (path.startsWith('/admin/invoices')) return '/admin/invoices';
    if (path.startsWith('/admin/deputy')) return '/admin/deputy';
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
    const commonLinks: INavLink[] = [
      {
        name: 'Dashboard',
        url: '/',
        key: '/',
        icon: 'ViewDashboard',
        isExpanded: location.pathname === '/'
      }
    ];

    // Staff specific links
    const staffLinks: INavLink[] = [
      {
        name: 'My Shifts',
        url: '/shifts',
        key: '/shifts',
        icon: 'Calendar',
        isExpanded: location.pathname.startsWith('/shifts')
      },
      {
        name: 'Shift Exchange',
        url: '/shifts/exchange',
        key: '/shifts/exchange',
        icon: 'SwitcherStartEnd',
        isExpanded: location.pathname.startsWith('/shifts/exchange')
      },
      {
        name: 'My Invoices',
        url: '/invoices',
        key: '/invoices',
        icon: 'PaymentCard',
        isExpanded: location.pathname.startsWith('/invoices')
      }
    ];

    // Manager specific links
    const managerLinks: INavLink[] = [
      {
        name: 'Staff Shifts',
        url: '/staff-shifts',
        key: '/staff-shifts',
        icon: 'PeopleAlert',
        isExpanded: location.pathname.startsWith('/staff-shifts')
      },
      {
        name: 'Approvals',
        url: '/approvals',
        key: '/approvals',
        icon: 'Checkmark',
        isExpanded: location.pathname.startsWith('/approvals')
      }
    ];

    // Admin specific links
    const adminLinks: INavLink[] = [
      {
        name: 'Staff Management',
        url: '/admin/staff',
        key: '/admin/staff',
        icon: 'People',
        isExpanded: location.pathname.startsWith('/admin/staff')
      },
      {
        name: 'Shift Scheduling',
        url: '/admin/scheduling',
        key: '/admin/scheduling',
        icon: 'ScheduleEventAction',
        isExpanded: location.pathname.startsWith('/admin/scheduling')
      },
      {
        name: 'Venues',
        url: '/admin/venues',
        key: '/admin/venues',
        icon: 'POI',
        isExpanded: location.pathname.startsWith('/admin/venues')
      },
      {
        name: 'Recruitment',
        url: '/admin/recruitment',
        key: '/admin/recruitment',
        icon: 'AddFriend',
        isExpanded: location.pathname.startsWith('/admin/recruitment')
      },
      {
        name: 'Invoices',
        url: '/admin/invoices',
        key: '/admin/invoices',
        icon: 'Money',
        isExpanded: location.pathname.startsWith('/admin/invoices')
      },
      {
        name: 'Deputy Integration',
        url: '/admin/deputy',
        key: '/admin/deputy',
        icon: 'Plug',
        isExpanded: location.pathname.startsWith('/admin/deputy')
      },
      {
        name: 'Settings',
        url: '/admin/settings',
        key: '/admin/settings',
        icon: 'Settings',
        isExpanded: location.pathname.startsWith('/admin/settings')
      }
    ];

    // Combine links based on user role
    let navLinks = [...commonLinks];

    if (authState.user) {
      // Always add staff links for all authenticated users
      navLinks = [...navLinks, ...staffLinks];

      // Add manager links for managers and admins
      if (isUserRole(UserRole.MANAGER) || isUserRole(UserRole.ADMIN)) {
        navLinks = [...navLinks, ...managerLinks];
      }

      // Add admin links only for admins
      if (isUserRole(UserRole.ADMIN)) {
        navLinks = [...navLinks, ...adminLinks];
      }
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header
        className="p-2 flex justify-between items-center shadow-md"
        style={{ backgroundColor: theme.palette.themePrimary }}
      >
        <div className="flex items-center">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-white p-2"
            onClick={toggleMobileNav}
          >
            ☰
          </button>

          <Link to="/" className="text-white text-xl font-bold ml-2">
            Security Staff Portal
          </Link>
        </div>

        {/* Command bar for user menu */}
        <div className="flex items-center">
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
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile unless toggled */}
        <aside
          className={`bg-gray-100 shadow-md md:block ${isMobileNavOpen ? 'block absolute z-10 h-full' : 'hidden'}`}
          style={{ width: 250, minWidth: 250 }}
        >
          <div className="p-4 border-b">
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 10 }}>
              <Persona
                size={PersonaSize.size40}
                text={userDisplayName}
                secondaryText={authState.user?.role}
              />
            </Stack>
          </div>

          <Nav
            groups={getNavItems()}
            selectedKey={getSelectedKey()}
            styles={{
              root: {
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto'
              },
              link: {
                selectors: {
                  '&.is-selected': {
                    backgroundColor: theme.palette.themePrimary + '20', // 20% opacity
                    color: theme.palette.themePrimary,
                    fontWeight: '600',
                    borderRight: `3px solid ${theme.palette.themePrimary}`
                  },
                  '&.is-selected::after': {
                    borderRight: `3px solid ${theme.palette.themePrimary}`
                  }
                }
              }
            }}
            onLinkClick={() => setIsMobileNavOpen(false)}
          />
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-2">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <div className="md:hidden bg-gray-100 border-t flex justify-around">
        <Link to="/" className="p-3 text-center">
          <i className="ms-Icon ms-Icon--ViewDashboard" />
          <div className="text-xs">Home</div>
        </Link>
        <Link to="/shifts" className="p-3 text-center">
          <i className="ms-Icon ms-Icon--Calendar" />
          <div className="text-xs">Shifts</div>
        </Link>
        <Link to="/shifts/exchange" className="p-3 text-center">
          <i className="ms-Icon ms-Icon--SwitcherStartEnd" />
          <div className="text-xs">Exchange</div>
        </Link>
        <Link to="/invoices" className="p-3 text-center">
          <i className="ms-Icon ms-Icon--PaymentCard" />
          <div className="text-xs">Invoices</div>
        </Link>
        <Link to="/profile" className="p-3 text-center">
          <i className="ms-Icon ms-Icon--Contact" />
          <div className="text-xs">Profile</div>
        </Link>
      </div>
    </div>
  );
};

export default MainLayout;
