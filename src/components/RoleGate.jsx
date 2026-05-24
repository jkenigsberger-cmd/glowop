/**
 * RoleGate — wraps content that should only render for specific roles/permissions.
 *
 * Usage:
 *   <RoleGate permission="CREATE_GROUP">
 *     <Button>צור קבוצה</Button>
 *   </RoleGate>
 *
 *   <RoleGate roles={["SUPER_ADMIN", "ADMIN"]}>
 *     <AdminPanel />
 *   </RoleGate>
 *
 *   <RoleGate permission="DELETE_GROUP" fallback={<span className="text-muted-foreground">אין הרשאה</span>}>
 *     ...
 *   </RoleGate>
 */
import { useRoleContext } from "@/lib/RoleContext";
import { hasPermission } from "@/lib/roles";

export default function RoleGate({ children, permission, roles, fallback = null }) {
  const { role } = useRoleContext();

  let allowed = false;

  if (permission) {
    allowed = hasPermission(role, permission);
  } else if (roles && roles.length > 0) {
    allowed = roles.includes(role);
  } else {
    // No restriction specified — show to all authenticated users with any role
    allowed = !!role;
  }

  if (!allowed) return fallback;
  return children;
}