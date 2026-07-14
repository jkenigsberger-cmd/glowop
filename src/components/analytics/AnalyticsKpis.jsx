import { Users, LogIn, LogOut, UserRound, BedDouble, Moon, CalendarDays, UtensilsCrossed } from "lucide-react";

const cards = [
  ["total_active_groups", "קבוצות פעילות", Users, "text-blue-600"],
  ["arrivals_count", "כניסות", LogIn, "text-emerald-600"],
  ["departures_count", "יציאות", LogOut, "text-orange-600"],
  ["total_pax_unique_groups", "סה״כ משתתפים", UserRound, "text-slate-700"],
  ["bed_occupancy_rate", "תפוסת מיטות", BedDouble, "text-violet-600", "%"],
  ["person_nights", "לינות אדם", Moon, "text-indigo-600"],
  ["total_activities", "פעילויות", CalendarDays, "text-cyan-600"],
  ["total_meals", "ארוחות", UtensilsCrossed, "text-amber-600"],
  ["total_meal_pax", "משתתפי ארוחות", UserRound, "text-rose-600"],
];

export default function AnalyticsKpis({ kpis }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {cards.map(([key, label, Icon, color, suffix]) => {
      const value = key === "bed_occupancy_rate" ? (kpis[key] || 0).toFixed(1) : Math.round(kpis[key] || 0).toLocaleString("he-IL");
      return <div key={key} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div><p className="text-xs text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}{suffix}</p></div>
      </div>;
    })}
  </div>;
}