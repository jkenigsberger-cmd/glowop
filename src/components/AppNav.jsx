import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, CalendarDays, BedDouble,
  UtensilsCrossed, Wrench, ShieldAlert, Layers, Lock, Menu, X, Users
} from "lucide-react";
import { revokeAccess } from "@/components/PilotAccessGate";
import { useRoleContext } from "@/lib/RoleContext";
import { ROLE_NAV_LINKS, ROLE_LABELS } from "@/lib/roles";

const ALL_LINKS = [
  { key: "dashboard",       to: "/dashboard",       label: "בית",              icon: LayoutDashboard },
  { key: "approved-groups", to: "/approved-groups", label: "קבוצות מאושרות",   icon: CheckSquare },
  { key: "calendar",        to: "/calendar",        label: "לוח שנה",           icon: CalendarDays },
  { key: "allocation",      to: "/allocation",      label: "שיבוץ לינה",        icon: BedDouble },
  { key: "common-spaces",   to: "/common-spaces",   label: "מרחבי פעילות",     icon: Layers },
  { key: "housekeeping",    to: "/housekeeping",    label: "משק בית",           icon: BedDouble },
  { key: "kitchen",         to: "/kitchen",         label: "מטבח",              icon: UtensilsCrossed },
  { key: "maintenance",     to: "/maintenance",     label: "תחזוקה",            icon: Wrench },
];

const PAGE_TITLES = {
  "/dashboard":       "בית",
  "/approved-groups": "קבוצות מאושרות",
  "/groups":          "קבוצות",
  "/calendar":        "לוח שנה",
  "/allocation":      "שיבוץ לינה",
  "/common-spaces":   "מרחבי פעילות",
  "/housekeeping":    "משק בית",
  "/kitchen":         "מטבח",
  "/maintenance":     "תחזוקה",
  "/admin":           "ניהול",
  "/admin/users":     "ניהול משתמשים",
};

function isActive(linkTo, pathname) {
  return linkTo === "/" ? pathname === "/" : pathname === linkTo || pathname.startsWith(linkTo + "/");
}

function NavLink({ to, label, icon: Icon, pathname, onClick }) {
  const active = isActive(to, pathname);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </Link>
  );
}

function DrawerNavLink({ to, label, icon: Icon, pathname, onClick }) {
  const active = isActive(to, pathname);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {label}
    </Link>
  );
}

export default function AppNav() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { role, internalUser } = useRoleContext();

  const currentTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/")
  )?.[1] || "";

  const closeDrawer = () => setDrawerOpen(false);

  // Filter visible links based on role
  const allowedKeys = role ? (ROLE_NAV_LINKS[role] || []) : [];
  const visibleLinks = ALL_LINKS.filter(l => allowedKeys.includes(l.key));
  const showAdmin = allowedKeys.includes("admin");
  const showUserManagement = role === "SUPER_ADMIN";

  return (
    <>
      {/* ── Desktop nav ──────────────────────────────────────────────────────── */}
      <nav className="hidden sm:block border-b border-border bg-card" dir="rtl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11 overflow-x-auto">
          {visibleLinks.map(link => (
            <NavLink key={link.to} {...link} pathname={pathname} />
          ))}

          <button
            onClick={() => { revokeAccess(); window.location.reload(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="נעילת מערכת"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            נעילה
          </button>

          {/* Role badge */}
          {role && (
            <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5 whitespace-nowrap">
              {internalUser?.name || ""} · {ROLE_LABELS[role] || role}
            </span>
          )}

          <div className="mr-auto shrink-0 flex items-center gap-1">
            {showUserManagement && (
              <Link
                to="/admin/users"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors border ${
                  pathname.startsWith("/admin/users")
                    ? "bg-red-700 text-white border-red-600"
                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                משתמשים
              </Link>
            )}
            {showAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors border ${
                  pathname.startsWith("/admin") && !pathname.startsWith("/admin/users")
                    ? "bg-slate-800 text-amber-400 border-slate-600"
                    : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-800 hover:text-amber-400 hover:border-slate-600"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                ניהול
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
      <div className="sm:hidden sticky top-0 z-40 border-b border-border bg-card shadow-sm" dir="rtl">
        <div className="flex items-center justify-between px-4 h-12">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-muted transition-colors"
            aria-label="פתח תפריט"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base font-bold text-slate-800">{currentTitle || "הדור הבא"}</span>
          <button
            onClick={() => { revokeAccess(); window.location.reload(); }}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="נעילה"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div className="relative mr-auto w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200">
              <div>
                <span className="text-base font-bold text-slate-800">תפריט ראשי</span>
                {role && (
                  <p className="text-xs text-slate-400">{internalUser?.name || ""} · {ROLE_LABELS[role] || role}</p>
                )}
              </div>
              <button onClick={closeDrawer} className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-3 space-y-1">
              {visibleLinks.map(link => (
                <DrawerNavLink key={link.to} {...link} pathname={pathname} onClick={closeDrawer} />
              ))}
            </div>
            <div className="p-3 border-t border-slate-200 space-y-1">
              {showUserManagement && (
                <Link
                  to="/admin/users"
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors border ${
                    pathname.startsWith("/admin/users")
                      ? "bg-red-700 text-white border-red-600"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  ניהול משתמשים
                </Link>
              )}
              {showAdmin && (
                <Link
                  to="/admin"
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors border ${
                    pathname.startsWith("/admin") && !pathname.startsWith("/admin/users")
                      ? "bg-slate-800 text-amber-400 border-slate-600"
                      : "bg-slate-100 text-slate-600 border-slate-300"
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                  ניהול
                </Link>
              )}
              <button
                onClick={() => { revokeAccess(); window.location.reload(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Lock className="w-5 h-5" />
                נעילת מערכת
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}