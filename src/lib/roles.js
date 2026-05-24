// Role hierarchy and permission definitions

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  OPERATIONS: "OPERATIONS",
  HOUSEKEEPING_MANAGER: "HOUSEKEEPING_MANAGER",
  HOUSEKEEPING_STAFF: "HOUSEKEEPING_STAFF",
  KITCHEN: "KITCHEN",
  VIEWER: "VIEWER",
};

export const ROLE_LABELS = {
  SUPER_ADMIN: "סופר מנהל",
  ADMIN: "מנהל",
  OPERATIONS: "תפעול",
  HOUSEKEEPING_MANAGER: "מנהל משק בית",
  HOUSEKEEPING_STAFF: "צוות משק בית",
  KITCHEN: "מטבח",
  VIEWER: "צופה",
};

// Navigation links each role can see
// Format: { to, label, icon_name }
export const ROLE_NAV_LINKS = {
  SUPER_ADMIN: ["dashboard", "approved-groups", "calendar", "allocation", "common-spaces", "housekeeping", "kitchen", "maintenance", "admin"],
  ADMIN:       ["dashboard", "approved-groups", "calendar", "allocation", "common-spaces", "housekeeping", "kitchen", "maintenance", "admin"],
  OPERATIONS:  ["dashboard", "approved-groups", "calendar", "allocation", "common-spaces", "housekeeping", "kitchen", "maintenance"],
  HOUSEKEEPING_MANAGER: ["dashboard", "calendar", "allocation", "housekeeping", "approved-groups"],
  HOUSEKEEPING_STAFF:   ["dashboard", "calendar", "housekeeping"],
  KITCHEN:              ["dashboard", "calendar", "kitchen"],
  VIEWER:               ["dashboard", "calendar"],
};

// Pages (route prefixes) each role can access
export const ROLE_ALLOWED_ROUTES = {
  SUPER_ADMIN: "*", // all
  ADMIN:       ["dashboard", "approved-groups", "calendar", "allocation", "common-spaces", "housekeeping", "kitchen", "maintenance", "admin", "groups", "inventory"],
  OPERATIONS:  ["dashboard", "approved-groups", "calendar", "allocation", "common-spaces", "housekeeping", "kitchen", "maintenance", "groups"],
  HOUSEKEEPING_MANAGER: ["dashboard", "calendar", "allocation", "housekeeping", "approved-groups"],
  HOUSEKEEPING_STAFF:   ["dashboard", "calendar", "housekeeping"],
  KITCHEN:              ["dashboard", "calendar", "kitchen"],
  VIEWER:               ["dashboard", "calendar"],
};

// Permissions — what actions a role can perform
export const PERMISSIONS = {
  // Group actions
  CREATE_GROUP:      ["SUPER_ADMIN", "ADMIN"],
  EDIT_GROUP:        ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  DELETE_GROUP:      ["SUPER_ADMIN"],
  ARCHIVE_GROUP:     ["SUPER_ADMIN", "ADMIN"],
  APPROVE_PROFILE:   ["SUPER_ADMIN", "ADMIN"],

  // Commercial
  CREATE_QUOTE:      ["SUPER_ADMIN", "ADMIN"],
  EDIT_QUOTE:        ["SUPER_ADMIN", "ADMIN"],
  APPROVE_QUOTE:     ["SUPER_ADMIN", "ADMIN"],
  EDIT_PRICES:       ["SUPER_ADMIN", "ADMIN"],

  // Operational
  MANAGE_MEALS:      ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  MANAGE_ACTIVITIES: ["SUPER_ADMIN", "ADMIN", "OPERATIONS"],
  MANAGE_ALLOCATION: ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER"],
  CONFIRM_ALLOCATION:["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER"],

  // Housekeeping
  HOUSEKEEPING_ACTIONS: ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER", "HOUSEKEEPING_STAFF"],
  MARK_TENT_READY:      ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER", "HOUSEKEEPING_STAFF"],

  // Kitchen
  KITCHEN_ACTIONS:   ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "KITCHEN"],

  // Admin / system
  MANAGE_USERS:      ["SUPER_ADMIN"],
  SYSTEM_SETTINGS:   ["SUPER_ADMIN"],
  VIEW_ADMIN:        ["SUPER_ADMIN", "ADMIN"],

  // Reports / PDFs
  GENERATE_REPORTS:  ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "HOUSEKEEPING_MANAGER"],
};

export function hasPermission(role, permission) {
  if (!role) return false;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function canAccessRoute(role, pathname) {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_ROUTES[role];
  if (allowed === "*") return true;
  // Extract route key from pathname (strip leading /)
  const key = pathname.replace(/^\//, "").split("/")[0] || "dashboard";
  // root "/" maps to dashboard
  if (key === "") return allowed.includes("dashboard");
  return allowed.includes(key);
}