import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, CalendarDays, BedDouble,
  UtensilsCrossed, Wrench, Users, FileText, ClipboardList,
  Boxes, TrendingUp, Settings, ChevronDown, ChevronUp
} from "lucide-react";

const OPS_LINKS = [
  { to: "/dashboard",        label: "דשבורד",          icon: LayoutDashboard },
  { to: "/approved-groups",  label: "קבוצות מאושרות",  icon: CheckSquare },
  { to: "/calendar",         label: "לוח שנה",          icon: CalendarDays },
  { to: "/housekeeping",     label: "משק בית",          icon: BedDouble },
  { to: "/kitchen",          label: "מטבח",             icon: UtensilsCrossed },
  { to: "/maintenance",      label: "תחזוקה",           icon: Wrench },
];

const ADMIN_LINKS = [
  { to: "/groups",           label: "כל הקבוצות",       icon: Users },
  { to: "/quotes",           label: "הצעות מחיר",       icon: FileText },
  { to: "/guest-forms",      label: "טפסי לקוח",        icon: ClipboardList },
  { to: "/",                 label: "מלאי / מתקנים",    icon: Boxes },
  { to: "/settings",         label: "הגדרות",           icon: Settings },
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
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <div dir="rtl">
      {/* ── Operations bar ────────────────────────────────────── */}
      <nav className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11 overflow-x-auto">
          {OPS_LINKS.map(link => (
            <NavLink key={link.to} {...link} pathname={pathname} />
          ))}

          {/* Admin toggle — pushed to left end */}
          <div className="mr-auto">
            <button
              onClick={() => setAdminOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              {adminOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              ניהול
            </button>
          </div>
        </div>
      </nav>

      {/* ── Admin secondary bar ───────────────────────────────── */}
      {adminOpen && (
        <nav className="border-b border-border bg-muted/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-10 overflow-x-auto">
            {ADMIN_LINKS.map(link => (
              <NavLink key={link.to + link.label} {...link} pathname={pathname} />
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}