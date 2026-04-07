/**
 * Smart Retail OS — Permission System
 * Single source of truth for all permission keys, role defaults, and guard helpers.
 */

// ─── Permission Keys ───────────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Products
  VIEW_PRODUCTS: "products:view",
  ADD_PRODUCTS: "products:add",
  EDIT_PRODUCTS: "products:edit",
  DELETE_PRODUCTS: "products:delete",

  // Inventory
  VIEW_INVENTORY: "inventory:view",
  UPDATE_INVENTORY: "inventory:update",
  RESTOCK: "inventory:restock",

  // Orders
  VIEW_ORDERS: "orders:view",
  CREATE_ORDERS: "orders:create",
  CANCEL_ORDERS: "orders:cancel",

  // Customers
  VIEW_CUSTOMERS: "customers:view",
  ADD_CUSTOMERS: "customers:add",
  EDIT_CUSTOMERS: "customers:edit",
  DELETE_CUSTOMERS: "customers:delete",

  // Invoices
  VIEW_INVOICES: "invoices:view",
  DOWNLOAD_INVOICES: "invoices:download",

  // Returns
  VIEW_RETURNS: "returns:view",
  PROCESS_RETURNS: "returns:process",

  // Employees
  VIEW_EMPLOYEES: "employees:view",
  ADD_EMPLOYEES: "employees:add",
  EDIT_EMPLOYEES: "employees:edit",
  DELETE_EMPLOYEES: "employees:delete",

  // Analytics
  VIEW_ANALYTICS: "analytics:view",
  VIEW_RESTOCK_AI: "analytics:restock-ai",

  // IMEI
  VIEW_IMEI: "imei:view",
  MANAGE_IMEI: "imei:manage",

  // Settings
  VIEW_SETTINGS: "settings:view",
  EDIT_SETTINGS: "settings:edit",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Role Defaults ─────────────────────────────────────────────────────────────
export const ADMIN_PERMISSIONS: Permission[] = Object.values(PERMISSIONS) as Permission[];

export const EMPLOYEE_DEFAULT_PERMISSIONS: Permission[] = [
  PERMISSIONS.VIEW_PRODUCTS,
  PERMISSIONS.VIEW_INVENTORY,
  PERMISSIONS.VIEW_ORDERS,
  PERMISSIONS.CREATE_ORDERS,
  PERMISSIONS.VIEW_CUSTOMERS,
  PERMISSIONS.ADD_CUSTOMERS,
  PERMISSIONS.EDIT_CUSTOMERS,
  PERMISSIONS.VIEW_INVOICES,
  PERMISSIONS.DOWNLOAD_INVOICES,
  PERMISSIONS.VIEW_RETURNS,
  PERMISSIONS.PROCESS_RETURNS,
  PERMISSIONS.VIEW_IMEI,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the effective permissions for a user.
 * - Admin role always receives full access regardless of stored permissions array.
 * - Employee falls back to EMPLOYEE_DEFAULT_PERMISSIONS if no explicit array stored.
 * - Unknown/missing role gets empty array (safe fallback).
 */
export function resolvePermissions(
  role: string | null,
  storedPermissions?: string[] | null
): Permission[] {
  if (role === "Admin") return ADMIN_PERMISSIONS;
  if (storedPermissions && storedPermissions.length > 0) {
    return storedPermissions as Permission[];
  }
  // Any non-Admin role with no stored permissions gets the safe default set
  return EMPLOYEE_DEFAULT_PERMISSIONS;
}

/**
 * Check whether a single permission is granted.
 */
export function hasPermission(
  permissions: Permission[],
  permission: Permission
): boolean {
  return permissions.includes(permission);
}

/**
 * Check whether ALL of the given permissions are granted.
 */
export function hasAllPermissions(
  permissions: Permission[],
  required: Permission[]
): boolean {
  return required.every((p) => permissions.includes(p));
}

/**
 * Check whether ANY of the given permissions are granted.
 */
export function hasAnyPermission(
  permissions: Permission[],
  required: Permission[]
): boolean {
  return required.some((p) => permissions.includes(p));
}
