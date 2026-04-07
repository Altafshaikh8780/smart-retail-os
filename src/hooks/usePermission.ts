/**
 * Thin permission hooks — consume the resolved permissions from AuthContext.
 */
import { useAuth } from "../lib/auth";
import {
  type Permission,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from "../lib/permissions";

/**
 * Returns true if the current user has the given permission.
 * Admins always have all permissions; safe fallback returns false for empty sets.
 */
export function usePermission(permission: Permission): boolean {
  const { permissions } = useAuth();
  return hasPermission(permissions, permission);
}

/**
 * Returns true only if the user holds ALL listed permissions.
 */
export function useAllPermissions(required: Permission[]): boolean {
  const { permissions } = useAuth();
  return hasAllPermissions(permissions, required);
}

/**
 * Returns true if the user holds ANY of the listed permissions.
 */
export function useAnyPermission(required: Permission[]): boolean {
  const { permissions } = useAuth();
  return hasAnyPermission(permissions, required);
}

/**
 * Returns the full resolved permissions array for the current user.
 * Useful for conditional rendering of multiple elements.
 */
export function usePermissions(): Permission[] {
  const { permissions } = useAuth();
  return permissions;
}
