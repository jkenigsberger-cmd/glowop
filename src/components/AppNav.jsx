import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, CalendarDays, BedDouble,
  UtensilsCrossed, Wrench, ShieldAlert
} from "lucide-react";

const OPS_LINKS = [
  { to: "/dashboard",       label: "בית",            icon: LayoutDashboard },
  { to: "/approved-groups", label: "קבוצות מאושרות", icon: CheckSquare },
  { to: "/calendar",        label: "לוח שנה",         icon: CalendarDays },
  { to: "/housekeeping",    label: "משק בית",         icon: BedDouble },
  { to: "/kitchen",         label: "מטבח",            icon: UtensilsCrossed },
  { to: "/maintenance",     label: "תחזוקה",          icon: Wrench },
];

function NavLink({ to, label, icon: Icon, pathname }) {
  const active = to === "/"
    ? pathname === "/"
    : pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
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

export default function AppNav() {
  const { pathname } = useLocation();
  const adminActive = pathname.startsWith("/admin") || pathname === "/groups" || pathname === "/quotes" || pathname === "/guest-forms" || pathname === "/settings" || pathname === "/";

  return (
    <nav className="border-b border-border bg-card" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11 overflow-x-auto">
        {OPS_LINKS.map(link => (
          <NavLink key={link.to} {...link} pathname={pathname} />
        ))}

        {/* Admin link — visually distinct, pushed to left */}
        <div className="mr-auto shrink-0">
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors border ${
              pathname.startsWith("/admin")
                ? "bg-slate-800 text-amber-400 border-slate-600"
                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-800 hover:text-amber-400 hover:border-slate-600"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            ניהול
          </Link>
        </div>
      </div>
    </nav>
  );
}