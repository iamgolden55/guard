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
  const userDisplayName = authState.user
    ? `${authState.user.firstName} ${authState.user.lastName}`
    : 'User';

  // Define navigation items based on role
  const getNavItems = (): INavLinkGroup[] => {
    // Common links for all users
    const commonLinks: INavLink[] = [
      {
        name: 'Dashboard',
        url: '/',
        key: 'dashboard',
        icon: 'ViewDashboard',
        isExpanded: location.pathname === '/'
      }
    ];

    // Staff specific links
    const staffLinks: INavLink[] = [
      {
        name: 'My Shifts',
        url: '/shifts',
        key: 'shifts',
        icon: 'Calendar',
        isExpanded: location.pathname.startsWith('/shifts')
      },
      {
        name: 'Shift Exchange',
        url: '/shifts/exchange',
        key: 'shift-exchange',
        icon: 'SwitcherStartEnd',
        isExpanded: location.pathname.startsWith('/shifts/exchange')
      },
      {
        name: 'My Invoices',
        url: '/invoices',
        key: 'invoices',
        icon: 'PaymentCard',
        isExpanded: location.pathname.startsWith('/invoices')
      }
    ];

    // Manager specific links
    const managerLinks: INavLink[] = [
      {
        name: 'Staff Shifts',
        url: '/staff-shifts',
        key: 'staff-shifts',
        icon: 'PeopleAlert',
        isExpanded: location.pathname.startsWith('/staff-shifts')
      },
      {
        name: 'Approvals',
        url: '/approvals',
        key: 'approvals',
        icon: 'Checkmark',
        isExpanded: location.pathname.startsWith('/approvals')
      }
    ];

    // Admin specific links
    const adminLinks: INavLink[] = [
      {
        name: 'Staff Management',
        url: '/admin/staff',
        key: 'staff-management',
        icon: 'People',
        isExpanded: location.pathname.startsWith('/admin/staff')
      },
      {
        name: 'Shift Scheduling',
        url: '/admin/scheduling',
        key: 'scheduling',
        icon: 'ScheduleEventAction',
        isExpanded: location.pathname.startsWith('/admin/scheduling')
      },
      {
        name: 'Venues',
        url: '/admin/venues',
        key: 'venues',
        icon: 'POI',
        isExpanded: location.pathname.startsWith('/admin/venues')
      },
      {
        name: 'Invoices',
        url: '/admin/invoices',
        key: 'admin-invoices',
        icon: 'Money',
        isExpanded: location.pathname.startsWith('/admin/invoices')
      },
      {
        name: 'Deputy Integration',
        url: '/admin/deputy',
        key: 'deputy',
        icon: 'Plug',
        isExpanded: location.pathname.startsWith('/admin/deputy')
      },
      {
        name: 'Settings',
        url: '/admin/settings',
        key: 'settings',
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
            selectedKey={location.pathname}
            styles={{
              root: {
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto'
              }
            }}
            onLinkClick={() => setIsMobileNavOpen(false)}
          />
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
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
