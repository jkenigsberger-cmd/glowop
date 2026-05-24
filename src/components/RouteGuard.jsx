/**
 * RouteGuard — wraps a page route and blocks access if the user's role
 * is not permitted to view it. Shows a friendly Hebrew error page instead of crashing.
 */
import { useRoleContext } from "@/lib/RoleContext";
import { canAccessRoute } from "@/lib/roles";
import { useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";

export default function RouteGuard({ children }) {
  const { role, isLoadingRole, roleError } = useRoleContext();
  const { pathname } = useLocation();

  if (isLoadingRole) return null;

  // Role error states
  if (roleError === "inactive") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3 max-w-sm">
          <ShieldOff className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">המשתמש אינו פעיל</h1>
          <p className="text-muted-foreground text-sm">חשבונך הושבת. פנה למנהל המערכת.</p>
        </div>
      </div>
    );
  }

  if (roleError === "not_found" || !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3 max-w-sm">
          <ShieldOff className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">אין לך הרשאה למערכת</h1>
          <p className="text-muted-foreground text-sm">
            המשתמש שלך אינו רשום במערכת. פנה למנהל לקבלת גישה.
          </p>
        </div>
      </div>
    );
  }

  if (!canAccessRoute(role, pathname)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3 max-w-sm">
          <ShieldOff className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">אין הרשאה לצפייה בדף זה</h1>
          <p className="text-muted-foreground text-sm">אין לך הרשאה לגשת לדף זה עם התפקיד הנוכחי שלך.</p>
        </div>
      </div>
    );
  }

  return children;
}