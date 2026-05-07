import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyService } from '../services';
import {
  SecurityCompany,
  UserCompanyMembership,
  CompanyContextResponse,
  CompanyRole,
  CompanyPermission,
  SubscriptionDetails,
  CompanyLimits
} from '../types';

// Query Keys
export const companyKeys = {
  all: ['companies'] as const,
  current: () => [...companyKeys.all, 'current'] as const,
  context: () => [...companyKeys.all, 'context'] as const,
  user: () => [...companyKeys.all, 'user'] as const,
  byId: (id: string) => [...companyKeys.all, 'by-id', id] as const,
  subscription: (id?: string) => [...companyKeys.all, 'subscription', id || 'current'] as const,
  limits: (id?: string) => [...companyKeys.all, 'limits', id || 'current'] as const,
  members: (id?: string) => [...companyKeys.all, 'members', id || 'current'] as const,
  activity: (id?: string) => [...companyKeys.all, 'activity', id || 'current'] as const,
  settings: (id?: string) => [...companyKeys.all, 'settings', id || 'current'] as const,
  dashboard: (id?: string) => [...companyKeys.all, 'dashboard', id || 'current'] as const,
  compliance: (id?: string) => [...companyKeys.all, 'compliance', id || 'current'] as const,
  search: (query: string) => [...companyKeys.all, 'search', query] as const,
};

/**
 * Hook for getting current company context
 */
export function useCurrentCompanyContext() {
  return useQuery({
    queryKey: companyKeys.context(),
    queryFn: companyService.getCurrentCompanyContext,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook for getting user companies
 */
export function useUserCompanies() {
  return useQuery({
    queryKey: companyKeys.user(),
    queryFn: companyService.getUserCompanies,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook for switching company context
 */
export function useSwitchCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string) => companyService.switchCompany(companyId),
    onSuccess: (data) => {
      // Update the current company context
      queryClient.setQueryData(companyKeys.context(), data);

      // Invalidate all company-related queries to refresh with new company data
      queryClient.invalidateQueries({
        queryKey: companyKeys.all
      });

      // Also invalidate other data that might be company-specific
      queryClient.invalidateQueries({
        queryKey: ['venues']
      });
      queryClient.invalidateQueries({
        queryKey: ['staff']
      });
      queryClient.invalidateQueries({
        queryKey: ['shifts']
      });
      queryClient.invalidateQueries({
        queryKey: ['invoices']
      });
    },
  });
}

/**
 * Hook for getting company by ID
 */
export function useCompanyById(companyId: string) {
  return useQuery({
    queryKey: companyKeys.byId(companyId),
    queryFn: () => companyService.getCompanyById(companyId),
    enabled: !!companyId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook for updating company information
 */
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, updates }: {
      companyId: string;
      updates: Partial<SecurityCompany>;
    }) => companyService.updateCompany(companyId, updates),
    onSuccess: (updatedCompany, { companyId }) => {
      // Update the company in cache
      queryClient.setQueryData(companyKeys.byId(companyId), updatedCompany);

      // Update current context if this is the current company
      queryClient.setQueryData(
        companyKeys.context(),
        (old: CompanyContextResponse | undefined) => {
          if (old && old.company.id === companyId) {
            return {
              ...old,
              company: updatedCompany
            };
          }
          return old;
        }
      );

      // Update user companies list
      queryClient.setQueryData(
        companyKeys.user(),
        (old: { companies: SecurityCompany[]; memberships: UserCompanyMembership[] } | undefined) => {
          if (old) {
            return {
              ...old,
              companies: old.companies.map(company =>
                company.id === companyId ? updatedCompany : company
              )
            };
          }
          return old;
        }
      );
    },
  });
}

/**
 * Hook for getting subscription details
 */
export function useSubscriptionDetails(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.subscription(companyId),
    queryFn: () => companyService.getSubscriptionDetails(companyId),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook for getting company limits
 */
export function useCompanyLimits(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.limits(companyId),
    queryFn: () => companyService.getCompanyLimits(companyId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes to keep limits current
  });
}

/**
 * Hook for getting company members
 */
export function useCompanyMembers(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.members(companyId),
    queryFn: () => companyService.getCompanyMembers(companyId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for inviting users to company
 */
export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, email, role, permissions }: {
      companyId: string;
      email: string;
      role: CompanyRole;
      permissions: CompanyPermission[];
    }) => companyService.inviteUser(companyId, email, role, permissions),
    onSuccess: (_, { companyId }) => {
      // Refresh company members list
      queryClient.invalidateQueries({
        queryKey: companyKeys.members(companyId)
      });

      // Refresh activity log
      queryClient.invalidateQueries({
        queryKey: companyKeys.activity(companyId)
      });
    },
  });
}

/**
 * Hook for updating user role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, userId, role, permissions }: {
      companyId: string;
      userId: number;
      role: CompanyRole;
      permissions: CompanyPermission[];
    }) => companyService.updateUserRole(companyId, userId, role, permissions),
    onSuccess: (updatedMembership, { companyId }) => {
      // Update members list
      queryClient.setQueryData(
        companyKeys.members(companyId),
        (old: UserCompanyMembership[] | undefined) => {
          if (old) {
            return old.map(member =>
              member.userId === updatedMembership.userId ? updatedMembership : member
            );
          }
          return old;
        }
      );

      // Refresh activity log
      queryClient.invalidateQueries({
        queryKey: companyKeys.activity(companyId)
      });
    },
  });
}

/**
 * Hook for removing user from company
 */
export function useRemoveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, userId }: {
      companyId: string;
      userId: number;
    }) => companyService.removeUser(companyId, userId),
    onSuccess: (_, { companyId, userId }) => {
      // Remove user from members list
      queryClient.setQueryData(
        companyKeys.members(companyId),
        (old: UserCompanyMembership[] | undefined) => {
          if (old) {
            return old.filter(member => member.userId !== userId);
          }
          return old;
        }
      );

      // Refresh activity log
      queryClient.invalidateQueries({
        queryKey: companyKeys.activity(companyId)
      });
    },
  });
}

/**
 * Hook for accepting company invitation
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationToken: string) => companyService.acceptInvitation(invitationToken),
    onSuccess: () => {
      // Refresh user companies list
      queryClient.invalidateQueries({
        queryKey: companyKeys.user()
      });

      // Refresh current context if needed
      queryClient.invalidateQueries({
        queryKey: companyKeys.context()
      });
    },
  });
}

/**
 * Hook for leaving company
 */
export function useLeaveCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string) => companyService.leaveCompany(companyId),
    onSuccess: (_, companyId) => {
      // Remove company from user's companies
      queryClient.setQueryData(
        companyKeys.user(),
        (old: { companies: SecurityCompany[]; memberships: UserCompanyMembership[] } | undefined) => {
          if (old) {
            return {
              companies: old.companies.filter(company => company.id !== companyId),
              memberships: old.memberships.filter(membership => membership.companyId !== companyId)
            };
          }
          return old;
        }
      );

      // If this was the current company, clear context
      queryClient.setQueryData(
        companyKeys.context(),
        (old: CompanyContextResponse | undefined) => {
          if (old && old.company.id === companyId) {
            return undefined;
          }
          return old;
        }
      );
    },
  });
}

/**
 * Hook for getting company activity log
 */
export function useCompanyActivity(companyId?: string, page = 1, limit = 50) {
  return useQuery({
    queryKey: [...companyKeys.activity(companyId), page, limit],
    queryFn: () => companyService.getActivityLog(companyId, page, limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook for getting company settings
 */
export function useCompanySettings(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.settings(companyId),
    queryFn: () => companyService.getSettings(companyId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook for updating company settings
 */
export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, settings }: {
      companyId: string;
      settings: Record<string, any>;
    }) => companyService.updateSettings(companyId, settings),
    onSuccess: (_, { companyId }) => {
      // Invalidate settings to refresh
      queryClient.invalidateQueries({
        queryKey: companyKeys.settings(companyId)
      });
    },
  });
}

/**
 * Hook for checking resource limits
 */
export function useCheckResourceLimit() {
  return useMutation({
    mutationFn: ({ resource, quantity = 1, companyId }: {
      resource: string;
      quantity?: number;
      companyId?: string;
    }) => companyService.checkResourceLimit(resource, quantity, companyId),
  });
}

/**
 * Hook for getting company dashboard data
 */
export function useCompanyDashboard(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.dashboard(companyId),
    queryFn: () => companyService.getDashboardData(companyId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}

/**
 * Hook for uploading company logo
 */
export function useUploadCompanyLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, file }: {
      companyId: string;
      file: File;
    }) => companyService.uploadLogo(companyId, file),
    onSuccess: (data, { companyId }) => {
      // Update company data with new logo URL
      queryClient.setQueryData(
        companyKeys.byId(companyId),
        (old: SecurityCompany | undefined) => {
          if (old) {
            return { ...old, logoUrl: data.logoUrl };
          }
          return old;
        }
      );

      // Update current context if applicable
      queryClient.setQueryData(
        companyKeys.context(),
        (old: CompanyContextResponse | undefined) => {
          if (old && old.company.id === companyId) {
            return {
              ...old,
              company: { ...old.company, logoUrl: data.logoUrl }
            };
          }
          return old;
        }
      );
    },
  });
}

/**
 * Hook for searching companies (admin only)
 */
export function useSearchCompanies(query: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: [...companyKeys.search(query), page, limit],
    queryFn: () => companyService.searchCompanies(query, page, limit),
    enabled: query.length > 2, // Only search with 3+ characters
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for getting company compliance report
 */
export function useCompanyCompliance(companyId?: string) {
  return useQuery({
    queryKey: companyKeys.compliance(companyId),
    queryFn: () => companyService.getComplianceReport(companyId),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook for transferring company ownership
 */
export function useTransferOwnership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, newOwnerId }: {
      companyId: string;
      newOwnerId: number;
    }) => companyService.transferOwnership(companyId, newOwnerId),
    onSuccess: (_, { companyId }) => {
      // Refresh all company-related data
      queryClient.invalidateQueries({
        queryKey: companyKeys.byId(companyId)
      });
      queryClient.invalidateQueries({
        queryKey: companyKeys.members(companyId)
      });
      queryClient.invalidateQueries({
        queryKey: companyKeys.activity(companyId)
      });
    },
  });
}

/**
 * Hook for deleting company
 */
export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, confirmationText }: {
      companyId: string;
      confirmationText: string;
    }) => companyService.deleteCompany(companyId, confirmationText),
    onSuccess: (_, { companyId }) => {
      // Remove company from all caches
      queryClient.removeQueries({
        queryKey: companyKeys.byId(companyId)
      });

      // Remove from user companies
      queryClient.setQueryData(
        companyKeys.user(),
        (old: { companies: SecurityCompany[]; memberships: UserCompanyMembership[] } | undefined) => {
          if (old) {
            return {
              companies: old.companies.filter(company => company.id !== companyId),
              memberships: old.memberships.filter(membership => membership.companyId !== companyId)
            };
          }
          return old;
        }
      );

      // Clear current context if this was the current company
      queryClient.setQueryData(
        companyKeys.context(),
        (old: CompanyContextResponse | undefined) => {
          if (old && old.company.id === companyId) {
            return undefined;
          }
          return old;
        }
      );
    },
  });
}

/**
 * Combined hook for common company operations
 */
export function useCompanyOperations() {
  const switchCompany = useSwitchCompany();
  const updateCompany = useUpdateCompany();
  const inviteUser = useInviteUser();
  const updateUserRole = useUpdateUserRole();
  const removeUser = useRemoveUser();

  return {
    // Company management
    switchCompany: switchCompany.mutate,
    switchCompanyAsync: switchCompany.mutateAsync,
    isSwitching: switchCompany.isPending,

    // Company updates
    updateCompany: updateCompany.mutate,
    updateCompanyAsync: updateCompany.mutateAsync,
    isUpdating: updateCompany.isPending,

    // User management
    inviteUser: inviteUser.mutate,
    inviteUserAsync: inviteUser.mutateAsync,
    isInviting: inviteUser.isPending,

    updateUserRole: updateUserRole.mutate,
    updateUserRoleAsync: updateUserRole.mutateAsync,
    isUpdatingRole: updateUserRole.isPending,

    removeUser: removeUser.mutate,
    removeUserAsync: removeUser.mutateAsync,
    isRemoving: removeUser.isPending,

    // Combined loading state
    isLoading: switchCompany.isPending || updateCompany.isPending || inviteUser.isPending || updateUserRole.isPending || removeUser.isPending,
  };
}