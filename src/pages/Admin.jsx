import { Link } from "react-router-dom";
import {
  Users, FileText, ClipboardList, Boxes, Settings,
  TrendingUp, ChevronLeft, ShieldAlert
} from "lucide-react";

const ADMIN_TILES = [
  {
    to: "/groups",
    icon: Users,
    label: "כל הקבוצות",
    desc: "ניהול כל הקבוצות והזמנות",
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    to: "/quotes",
    icon: FileText,
    label: "הצעות מחיר",
    desc: "צור, שלח ואשר הצעות מחיר",
    color: "bg-violet-50 border-violet-200 hover:bg-violet-100",
    iconColor: "text-violet-600",
  },
  {
    to: "/guest-forms",
    icon: ClipboardList,
    label: "טפסי לקוח",
    desc: "סקירת טפסי קבלה שהוגשו",
    color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    iconColor: "text-amber-600",
  },
  {
    to: "/",
    icon: Boxes,
    label: "מלאי / מתקנים",
    desc: "שכונות, אוהלים, מתקנים, מרחבי פעילות",
    color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    to: "/settings",
    icon: Settings,
    label: "הגדרות",
    desc: "הגדרות אתר, משתמשים",
    color: "bg-slate-50 border-slate-200 hover:bg-slate-100",
    iconColor: "text-slate-600",
  },
];

export default function Admin() {
  return (
    <div className="min-h-screen bg-slate-900" dir="rtl">
      {/* Header — dark, distinct from ops */}
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ניהול ובק-אופיס</h1>
              <p className="text-xs text-slate-400">גישה מוגבלת — מנהלים בלבד</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            חזרה לתפעול
          </Link>
        </div>
      </div>

      {/* Tiles */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADMIN_TILES.map(({ to, icon: Icon, label, desc, color, iconColor }) => (
            <Link
              key={to + label}
              to={to}
              className={`flex items-center gap-4 border rounded-xl px-5 py-4 transition-colors ${color}`}
            >
              <div className={`shrink-0 ${iconColor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 mt-10">
          הרשאות מלאות יתווספו בעתיד — כרגע גישה פתוחה למנהלים רשומים
        </p>
      </div>
    </div>
  );
}