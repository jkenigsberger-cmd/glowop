import { Users, LogIn, LogOut, UserCheck, UtensilsCrossed, CalendarDays, AlertTriangle, Sun } from "lucide-react";

function Card({ icon: Icon, label, value, color = "text-primary", bg = "bg-card", onClick, isActive = false }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`${bg} border rounded-xl px-4 py-3 flex items-center gap-3 text-right transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]" : ""}
        ${isActive ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border"}
      `}
    >
      <Icon className={`w-5 h-5 shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </Comp>
  );
}

const SECTION_IDS = {
  occupancy:   "dashboard-occupancy",
  arriving:    "dashboard-arriving",
  sleeping:    "dashboard-sleeping",
  departing:   "dashboard-departing",
  dayUse:      "dashboard-dayuse",
  meals:       "dashboard-meals",
  activities:  "dashboard-activities",
  warnings:    "dashboard-warnings",
};

export { SECTION_IDS };

export default function DashboardSummaryCards({ stats, isToday = true, activeFilter, onFilterClick }) {
  const dayLabel = isToday ? "היום" : "ביום זה";

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/30", "rounded-xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/30", "rounded-xl"), 2500);
    }
    onFilterClick?.(id);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card icon={Users}           label="קבוצות באתר"               value={stats.activeGroups}        color="text-blue-600"   onClick={() => scrollTo(SECTION_IDS.sleeping)} isActive={activeFilter === SECTION_IDS.sleeping} />
      <Card icon={LogIn}           label={`צ׳ק-אין ${dayLabel}`}      value={stats.arrivingToday}       color="text-emerald-600" onClick={() => scrollTo(SECTION_IDS.arriving)} isActive={activeFilter === SECTION_IDS.arriving} />
      <Card icon={LogOut}          label={`צ׳ק-אאוט ${dayLabel}`}     value={stats.departingToday}      color="text-orange-600"  onClick={() => scrollTo(SECTION_IDS.departing)} isActive={activeFilter === SECTION_IDS.departing} />
      <Card icon={Sun}             label={`באי יום ${dayLabel}`}      value={stats.dayUseGroups || 0}   color="text-amber-600"   onClick={() => scrollTo(SECTION_IDS.dayUse)} isActive={activeFilter === SECTION_IDS.dayUse} />
      <Card icon={UserCheck}       label='סה"כ אנשים באתר'            value={stats.totalPaxOnSite}      color="text-slate-700" />
      <Card icon={UtensilsCrossed} label={`ארוחות ${dayLabel}`}       value={stats.mealsToday}          color="text-yellow-600"  onClick={() => scrollTo(SECTION_IDS.meals)} isActive={activeFilter === SECTION_IDS.meals} />
      <Card icon={CalendarDays}    label={`פעילויות ${dayLabel}`}     value={stats.activitiesToday}     color="text-violet-600"  onClick={() => scrollTo(SECTION_IDS.activities)} isActive={activeFilter === SECTION_IDS.activities} />
      <Card icon={AlertTriangle}   label="התראות"                     value={stats.pendingHousekeeping + stats.maintenanceIssues} color={stats.pendingHousekeeping + stats.maintenanceIssues > 0 ? "text-red-600" : "text-slate-400"} onClick={() => scrollTo(SECTION_IDS.warnings)} isActive={activeFilter === SECTION_IDS.warnings} />
    </div>
  );
}