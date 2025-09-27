import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Text, Icon } from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
  description?: string;
}

const LeaveSidebar: React.FC = () => {
  const { authState, isUserRole } = useAuth();
  const location = useLocation();

  // Navigation sections organized by role
  const navigationSections: { title: string; items: NavigationItem[] }[] = [
    {
      title: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          path: '/leave',
          icon: 'ViewDashboard',
          roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
          description: 'Leave overview and summary'
        }
      ]
    },
    {
      title: 'My Leave',
      items: [
        {
          id: 'request',
          label: 'Request Leave',
          path: '/leave/request',
          icon: 'Add',
          roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
          description: 'Submit new leave request'
        },
        {
          id: 'balance',
          label: 'My Balance',
          path: '/leave/balance',
          icon: 'TimeEntry',
          roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
          description: 'View leave balances'
        },
        {
          id: 'history',
          label: 'Leave History',
          path: '/leave/history',
          icon: 'History',
          roles: [UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN],
          description: 'View past leave requests'
        }
      ]
    },
    {
      title: 'Team Management',
      items: [
        {
          id: 'approvals',
          label: 'Team Approvals',
          path: '/leave/approvals',
          icon: 'CalendarReply',
          roles: [UserRole.MANAGER, UserRole.ADMIN],
          description: 'Approve team leave requests'
        },
        {
          id: 'calendar',
          label: 'Team Calendar',
          path: '/leave/calendar',
          icon: 'CalendarWorkWeek',
          roles: [UserRole.MANAGER, UserRole.ADMIN],
          description: 'View team leave calendar'
        },
        {
          id: 'team-overview',
          label: 'Team Overview',
          path: '/leave/team-overview',
          icon: 'People',
          roles: [UserRole.MANAGER, UserRole.ADMIN],
          description: 'Team leave statistics'
        }
      ]
    },
    {
      title: 'Administration',
      items: [
        {
          id: 'policies',
          label: 'Leave Policies',
          path: '/leave/policies',
          icon: 'DocumentManagement',
          roles: [UserRole.ADMIN],
          description: 'Manage leave policies'
        },
        {
          id: 'reports',
          label: 'Leave Reports',
          path: '/leave/reports',
          icon: 'BarChart4',
          roles: [UserRole.ADMIN],
          description: 'Generate leave reports'
        },
        {
          id: 'settings',
          label: 'System Settings',
          path: '/leave/settings',
          icon: 'Settings',
          roles: [UserRole.ADMIN],
          description: 'Configure leave system'
        }
      ]
    }
  ];

  // Check if user has access to a navigation item
  const hasAccess = (item: NavigationItem): boolean => {
    return item.roles.some(role => isUserRole(role));
  };

  // Check if current path matches the item path
  const isActive = (path: string): boolean => {
    if (path === '/leave') {
      return location.pathname === '/leave' || location.pathname === '/leave/';
    }
    return location.pathname.startsWith(path);
  };

  // Get user display name
  const userDisplayName = (() => {
    if (!authState.user) return 'User';
    const { firstName, lastName, username } = authState.user;
    return firstName && lastName ? `${firstName} ${lastName}` : username;
  })();

  // Get user role display
  const userRole = authState.user?.role?.toUpperCase() || 'USER';

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          {/* Back arrow button */}
          <Link
            to="/dashboard"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 mr-1"
            title="Back to Dashboard"
          >
            <Icon
              iconName="ChevronLeft"
              className="text-gray-600 hover:text-gray-900"
              style={{ fontSize: '20px' }}
            />
          </Link>

          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon
              iconName="Calendar"
              className="text-blue-600"
              style={{ fontSize: '20px' }}
            />
          </div>
          <div>
            <Text variant="large" className="font-bold text-gray-900">
              Leave Management
            </Text><br />
            <Text variant="small" className="text-gray-600">
              Manage your time off
            </Text>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 bg-blue-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <Text variant="small" className="text-white font-semibold">
              {userDisplayName.charAt(0).toUpperCase()}
            </Text>
          </div>
          <div className="flex-1 min-w-0">
            <Text variant="medium" className="font-semibold text-gray-900 truncate">
              {userDisplayName}
            </Text>
            <Text variant="small" className="text-blue-700 uppercase tracking-wide">
              {userRole}
            </Text>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {navigationSections.map((section) => {
            // Filter items based on user access
            const accessibleItems = section.items.filter(hasAccess);
            
            // Don't render section if no accessible items
            if (accessibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <Text 
                  variant="small" 
                  className="font-semibold text-gray-500 uppercase tracking-wide mb-3 block px-2"
                >
                  {section.title}
                </Text>
                <div className="space-y-1">
                  {accessibleItems.map((item) => {
                    const active = isActive(item.path);
                    
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`
                          group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-out
                          ${active 
                            ? 'bg-blue-100 text-blue-700 shadow-sm border-l-4 border-blue-500' 
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                          }
                        `}
                      >
                        <Icon 
                          iconName={item.icon}
                          className={`
                            mr-3 flex-shrink-0 transition-colors duration-200
                            ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}
                          `}
                          style={{ fontSize: '16px' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`
                            font-medium transition-colors duration-200
                            ${active ? 'text-blue-700' : 'text-gray-900'}
                          `}>
                            {item.label}
                          </div>
                          {item.description && (
                            <div className={`
                              text-xs mt-0.5 transition-colors duration-200
                              ${active ? 'text-blue-600' : 'text-gray-500'}
                            `}>
                              {item.description}
                            </div>
                          )}
                        </div>
                        
                        {/* Active indicator */}
                        {active && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-25">
        <div className="text-center">
          <Text variant="small" className="text-gray-500">
            Leave Management System
          </Text>
          <div className="flex items-center justify-center gap-4 mt-2">
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Icon iconName="Help" style={{ fontSize: '14px' }} />
            </button>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Icon iconName="Info" style={{ fontSize: '14px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveSidebar;