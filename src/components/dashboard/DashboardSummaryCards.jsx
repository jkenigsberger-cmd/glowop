import { Users, LogIn, Moon, LogOut, UserCheck, UtensilsCrossed, CalendarDays, BedDouble, AlertTriangle } from "lucide-react";

function Card({ icon: Icon, label, value, color = "text-primary", bg = "bg-card" }) {
  return (
    <div className={`${bg} border border-border rounded-xl px-4 py-3 flex items-center gap-3`}>
      <Icon className={`w-5 h-5 shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

export default function DashboardSummaryCards({ stats, isToday = true }) {
  const dayLabel = isToday ? "היום" : "ביום זה";
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card icon={Users}           label="קבוצות פעילות"             value={stats.activeGroups}        color="text-blue-600" />
      <Card icon={LogIn}           label={`מגיעים ${dayLabel}`}       value={stats.arrivingToday}       color="text-emerald-600" />
      <Card icon={Moon}            label={`לנים ${dayLabel}`}         value={stats.sleepingTonight}     color="text-indigo-600" />
      <Card icon={LogOut}          label={`עוזבים ${dayLabel}`}       value={stats.departingToday}      color="text-orange-600" />
      <Card icon={UserCheck}       label='סה"כ אנשים באתר'            value={stats.totalPaxOnSite}      color="text-slate-700" />
      <Card icon={UtensilsCrossed} label={`ארוחות ${dayLabel}`}       value={stats.mealsToday}          color="text-amber-600" />
      <Card icon={CalendarDays}    label={`פעילויות ${dayLabel}`}     value={stats.activitiesToday}     color="text-violet-600" />
      <Card icon={BedDouble}       label="ממתינים למשק בית"           value={stats.pendingHousekeeping} color={stats.pendingHousekeeping > 0 ? "text-rose-600" : "text-slate-400"} />
      <Card icon={AlertTriangle}   label="תקלות תחזוקה"               value={stats.maintenanceIssues}   color={stats.maintenanceIssues > 0 ? "text-red-600" : "text-slate-400"} />
    </div>
  );
}