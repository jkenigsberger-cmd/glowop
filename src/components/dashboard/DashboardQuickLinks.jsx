import { Link } from "react-router-dom";
import {
  CheckSquare, Users, CalendarDays, BedDouble,
  UtensilsCrossed, Wrench, FileText, ClipboardList, ChevronLeft
} from "lucide-react";

const LINKS = [
  { to: "/approved-groups", label: "קבוצות מאושרות", icon: CheckSquare, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { to: "/groups",          label: "כל הקבוצות",     icon: Users,       color: "text-blue-600 bg-blue-50 border-blue-200" },
  { to: "/calendar",        label: "לוח שנה",         icon: CalendarDays, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { to: "/housekeeping",    label: "משק בית",         icon: BedDouble,   color: "text-violet-600 bg-violet-50 border-violet-200" },
  { to: "/kitchen",         label: "מטבח",            icon: UtensilsCrossed, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { to: "/maintenance",     label: "תחזוקה",          icon: Wrench,      color: "text-rose-600 bg-rose-50 border-rose-200" },
  { to: "/quotes",          label: "הצעות מחיר",      icon: FileText,    color: "text-slate-600 bg-slate-50 border-slate-200" },
  { to: "/guest-forms",     label: "טפסי לקוח",       icon: ClipboardList, color: "text-teal-600 bg-teal-50 border-teal-200" },
];

export default function DashboardQuickLinks() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {LINKS.map(({ to, label, icon: Icon, color }) => (
        <Link
          key={to}
          to={to}
          className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 ${color}`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1">{label}</span>
          <ChevronLeft className="w-3.5 h-3.5 opacity-50 shrink-0" />
        </Link>
      ))}
    </div>
  );
}