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

function NavTab({ to, label, icon: Icon, pathname, onClick }) {
  const active = isActive(to, pathname);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-150 rounded-md ${
        active
          ? "text-primary bg-primary/8 font-semibold"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
      {active && (
        <span className="absolute bottom-0 right-2 left-2 h-0.5 bg-primary rounded-full" />
      )}
    </Link>
  );
}

function DrawerNavLink({ to, label, icon: Icon, pathname, onClick }) {
  const active = isActive(to, pathname);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon className="w-4.5 h-4.5 shrink-0" />
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

  const allowedKeys = role ? (ROLE_NAV_LINKS[role] || []) : [];
  const visibleLinks = ALL_LINKS.filter(l => allowedKeys.includes(l.key));
  const showAdmin = allowedKeys.includes("admin");
  const showUserManagement = role === "SUPER_ADMIN";

  const userName = internalUser?.name || "";
  const roleLabel = ROLE_LABELS[role] || role || "";

  return (
    <>
      {/* ── Desktop header ───────────────────────────────────────────────────── */}
      <header className="hidden sm:block bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm" dir="rtl">
        {/* Top strip: brand + user info */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-10 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase select-none">
            הדור הבא
          </span>
          <div className="flex items-center gap-3">
            {role && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{userName}</span>
                {userName && <span className="text-slate-300 text-xs">·</span>}
                <span className="text-[11px] font-semibold text-primary bg-primary/8 rounded-full px-2 py-0.5">
                  {roleLabel}
                </span>
              </div>
            )}
            <button
              onClick={() => { revokeAccess(); window.location.reload(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="נעילת מערכת"
            >
              <Lock className="w-3 h-3" />
              נעילה
            </button>
          </div>
        </div>

        {/* Nav tabs row */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-0.5 h-10 overflow-x-auto">
          {visibleLinks.map(link => (
            <NavTab key={link.to} {...link} pathname={pathname} />
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Admin / Users links — right-aligned */}
          <div className="flex items-center gap-1">
            {showUserManagement && (
              <Link
                to="/admin/users"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                  pathname.startsWith("/admin/users")
                    ? "text-red-700 bg-red-50 font-semibold"
                    : "text-slate-500 hover:text-red-700 hover:bg-red-50"
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                משתמשים
              </Link>
            )}
            {showAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                  pathname.startsWith("/admin") && !pathname.startsWith("/admin/users")
                    ? "text-amber-700 bg-amber-50 font-semibold"
                    : "text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                ניהול
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ───────────────────────────────────────────────────── */}
      <div className="sm:hidden sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm" dir="rtl">
        <div className="flex items-center justify-between px-2 h-14">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center w-12 h-12 -mx-1 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
            aria-label="פתח תפריט"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-center">
            <span className="text-sm font-bold text-slate-800">{currentTitle || "הדור הבא"}</span>
          </div>
          <button
            onClick={() => { revokeAccess(); window.location.reload(); }}
            className="flex items-center justify-center w-12 h-12 -mx-1 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
            aria-label="נעילה"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex" dir="rtl">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative mr-auto w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-800">תפריט ראשי</p>
                {role && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {userName}{userName ? " · " : ""}{roleLabel}
                  </p>
                )}
              </div>
              <button
                onClick={closeDrawer}
                className="flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {visibleLinks.map(link => (
                <DrawerNavLink key={link.to} {...link} pathname={pathname} onClick={closeDrawer} />
              ))}
            </div>

            {/* Bottom section */}
            <div className="shrink-0 p-3 border-t border-slate-100 space-y-0.5">
              {showUserManagement && (
                <Link
                  to="/admin/users"
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith("/admin/users")
                      ? "bg-red-50 text-red-700 font-semibold"
                      : "text-slate-600 hover:bg-red-50 hover:text-red-700"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  ניהול משתמשים
                </Link>
              )}
              {showAdmin && (
                <Link
                  to="/admin"
                  onClick={closeDrawer}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith("/admin") && !pathname.startsWith("/admin/users")
                      ? "bg-amber-50 text-amber-700 font-semibold"
                      : "text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  ניהול
                </Link>
              )}
              <button
                onClick={() => { revokeAccess(); window.location.reload(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Lock className="w-4 h-4" />
                נעילת מערכת
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}