import { Link, useLocation } from "react-router-dom";
import { Home, Users } from "lucide-react";

const links = [
  { to: "/", label: "מלאי פיזי", icon: Home },
  { to: "/groups", label: "קבוצות", icon: Users },
];

export default function AppNav() {
  const { pathname } = useLocation();
  return (
    <nav className="border-b border-border bg-card" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11">
        {links.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}