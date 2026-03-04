import { useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AppUserRole } from '@/components/auth/AuthProvider';

// Define role-based page access rules (same as middleware)
const roleAccess: Record<AppUserRole, string[]> = {
  employee: ['dashboard', 'expenses'],
  manager: ['dashboard', 'expenses', 'budgets', 'audit-trail'],
  finance: ['dashboard', 'expenses', 'vendors', 'budgets', 'audit-trail'],
  admin: ['dashboard', 'expenses', 'vendors', 'budgets', 'audit-trail']
};

// Define role hierarchy for permission checking
const roleHierarchy: Record<AppUserRole, number> = {
  employee: 1,
  manager: 2,
  finance: 3,
  admin: 4
};

export function useRoleAccess() {
  const { user, loading } = useAuth();

  const canAccess = useMemo(() => {
    return (page: string): boolean => {
      if (loading || !user) return false;
      return roleAccess[user.role]?.includes(page) || false;
    };
  }, [user, loading]);

  const hasRole = useMemo(() => {
    return (role: AppUserRole): boolean => {
      if (loading || !user) return false;
      return user.role === role;
    };
  }, [user, loading]);

  const hasMinimumRole = useMemo(() => {
    return (minimumRole: AppUserRole): boolean => {
      if (loading || !user) return false;
      return roleHierarchy[user.role] >= roleHierarchy[minimumRole];
    };
  }, [user, loading]);

  const getAllowedPages = useMemo(() => {
    if (loading || !user) return [];
    return roleAccess[user.role] || [];
  }, [user, loading]);

  return {
    canAccess,
    hasRole,
    hasMinimumRole,
    getAllowedPages,
    userRole: user?.role || null,
    isLoading: loading
  };
}
