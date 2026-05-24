import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, addDays } from "date-fns";
import { he } from "date-fns/locale";
import { useState, useMemo } from "react";
import DashboardSummaryCards from "@/components/dashboard/DashboardSummaryCards";
import DashboardGroupCard from "@/components/dashboard/DashboardGroupCard";
import DashboardWarnings from "@/components/dashboard/DashboardWarnings";
import DashboardMealsToday from "@/components/dashboard/DashboardMealsToday";
import DashboardActivitiesToday from "@/components/dashboard/DashboardActivitiesToday";
import DashboardQuickLinks from "@/components/dashboard/DashboardQuickLinks";
import { Button } from "@/components/ui/button";
import { FileText, ChevronRight, ChevronLeft } from "lucide-react";
import { useRoleContext } from "@/lib/RoleContext";

const toDateStr = (date) => format(date, "yyyy-MM-dd");
const TODAY = toDateStr(new Date());

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-base text-foreground border-b border-border pb-1">{title}</h2>
      {children}
    </section>
  );
}

function PaxDebugPanel({ activeGroups, profileByGroupId }) {
  const [open, setOpen] = useState(false);
  const { role } = useRoleContext();
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") return null;
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs" dir="rtl">
      <button
        className="font-semibold text-amber-800 hover:underline"
        onClick={() => setOpen(v => !v)}
      >
        🔍 ניפוי: אנשים באתר ({activeGroups.reduce((s, g) => {
          const p = profileByGroupId[g.id];
          return s + (p?.total_pax ?? g.total_pax ?? 0);
        }, 0)}) — {open ? "הסתר" : "הצג פירוט"}
      </button>
      {open && (
        <table className="mt-2 w-full text-right border-collapse">
          <thead>
            <tr className="text-amber-700">
              <th className="border border-amber-200 px-2 py-1">שם קבוצה</th>
              <th className="border border-amber-200 px-2 py-1">סוג</th>
              <th className="border border-amber-200 px-2 py-1">הגעה</th>
              <th className="border border-amber-200 px-2 py-1">עזיבה</th>
              <th className="border border-amber-200 px-2 py-1">סטטוס</th>
              <th className="border border-amber-200 px-2 py-1">pax</th>
            </tr>
          </thead>
          <tbody>
            {activeGroups.map(g => {
              const p = profileByGroupId[g.id];
              const pax = p?.total_pax ?? g.total_pax ?? 0;
              return (
                <tr key={g.id} className="even:bg-amber-100/40">
                  <td className="border border-amber-200 px-2 py-1">{g.group_name}</td>
                  <td className="border border-amber-200 px-2 py-1">{g.group_type}</td>
                  <td className="border border-amber-200 px-2 py-1">{g.arrival_date}</td>
                  <td className="border border-amber-200 px-2 py-1">{g.departure_date || "—"}</td>
                  <td className="border border-amber-200 px-2 py-1">{g.status}</td>
                  <td className="border border-amber-200 px-2 py-1 font-bold">{pax}</td>
                </tr>
              );
            })}
            {activeGroups.length === 0 && (
              <tr><td colSpan={6} className="text-center text-amber-600 py-2 border border-amber-200">אין קבוצות פעילות כרגע</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const isToday = selectedDate === TODAY;

  const shiftDate = (days) => {
    const d = new Date(selectedDate + "T00:00:00");
    setSelectedDate(toDateStr(addDays(d, days)));
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 300),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["operationalProfiles"],
    queryFn: () => base44.entities.OperationalGroupProfile.list("-accepted_at", 300),
  });

  const { data: meals = [] } = useQuery({
    queryKey: ["allMeals"],
    queryFn: () => base44.entities.MealReservation.filter({ status: "ACTIVE" }),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["allActivities"],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ status: "ACTIVE" }),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allAllocations"],
    queryFn: () => base44.entities.SleepingAllocation.filter({ status: "CONFIRMED" }),
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => base44.entities.Facility.list(),
  });

  const { data: tents = [] } = useQuery({
    queryKey: ["tents"],
    queryFn: () => base44.entities.Tent.list(),
  });

  const { data: activitySpaces = [] } = useQuery({
    queryKey: ["activitySpaces"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });

  // ── Lookup maps ────────────────────────────────────────────────────────────
  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const profileByGroupId = useMemo(() => Object.fromEntries(profiles.map(p => [p.group_id, p])), [profiles]);
  const profileById = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);
  const spaceById = useMemo(() => Object.fromEntries(activitySpaces.map(s => [s.id, s])), [activitySpaces]);
  const allocatedGroupIds = useMemo(() => new Set(allocations.map(a => a.group_id)), [allocations]);

  // ── Date-filtered data (all driven by selectedDate) ───────────────────────
  const EXCLUDED = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);
  const NEXT_DATE = toDateStr(addDays(new Date(selectedDate + "T00:00:00"), 1));

  const activeGroups = useMemo(() => groups.filter(g => {
    if (EXCLUDED.has(g.status)) return false;
    if (g.group_type === "DAY_USE") return g.arrival_date === selectedDate;
    const dep = g.departure_date && g.departure_date.trim() !== "" ? g.departure_date : null;
    if (!dep) return g.arrival_date === selectedDate;
    return g.arrival_date <= selectedDate && dep > selectedDate;
  }), [groups, selectedDate]);

  const arrivingToday = useMemo(() =>
    groups.filter(g => !EXCLUDED.has(g.status) && g.arrival_date === selectedDate),
    [groups, selectedDate]
  );

  const sleepingTonight = useMemo(() => groups.filter(g => {
    if (EXCLUDED.has(g.status)) return false;
    const dep = g.departure_date && g.departure_date.trim() !== "" ? g.departure_date : null;
    return dep && g.arrival_date <= selectedDate && dep > selectedDate;
  }), [groups, selectedDate]);

  const departingToday = useMemo(() =>
    groups.filter(g => !EXCLUDED.has(g.status) && g.departure_date === selectedDate),
    [groups, selectedDate]
  );

  const mealsForDate = useMemo(() =>
    meals.filter(m => m.date === selectedDate),
    [meals, selectedDate]
  );

  const activitiesForDate = useMemo(() =>
    activities.filter(a => a.date === selectedDate),
    [activities, selectedDate]
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPaxOnSite = useMemo(() =>
    activeGroups.reduce((sum, g) => {
      const p = profileByGroupId[g.id];
      return sum + (p?.total_pax ?? g.total_pax ?? 0);
    }, 0),
    [activeGroups, profileByGroupId]
  );

  const brokenFacilities = useMemo(() => facilities.filter(f => f.working_status !== "WORKING"), [facilities]);
  const brokenTents = useMemo(() => tents.filter(t => t.working_status !== "WORKING"), [tents]);
  const maintenanceIssues = brokenFacilities.length + brokenTents.length;

  const pendingHousekeepingProfiles = useMemo(() =>
    profiles.filter(p => p.sleeping_requirements_completed && !allocatedGroupIds.has(p.group_id)),
    [profiles, allocatedGroupIds]
  );

  const stats = {
    activeGroups:        activeGroups.length,
    arrivingToday:       arrivingToday.length,
    sleepingTonight:     sleepingTonight.length,
    departingToday:      departingToday.length,
    totalPaxOnSite,
    mealsToday:          mealsForDate.length,
    activitiesToday:     activitiesForDate.length,
    pendingHousekeeping: pendingHousekeepingProfiles.length,
    maintenanceIssues,
  };

  // ── Operational warnings ──────────────────────────────────────────────────
  const arrivingNoSleeping = useMemo(() =>
    arrivingToday
      .map(g => profileByGroupId[g.id])
      .filter(p => p && !p.sleeping_requirements_completed)
      .map(p => ({ id: p.group_id, label: groupById[p.group_id]?.group_name || p.group_id })),
    [arrivingToday, profileByGroupId, groupById]
  );

  const arrivingNextNoSleeping = useMemo(() =>
    groups
      .filter(g => g.arrival_date === NEXT_DATE)
      .map(g => profileByGroupId[g.id])
      .filter(p => p && !p.sleeping_requirements_completed)
      .map(p => ({ id: p.group_id, label: groupById[p.group_id]?.group_name || p.group_id })),
    [groups, NEXT_DATE, profileByGroupId, groupById]
  );

  const arrivingSoonGroupIds = useMemo(() =>
    new Set(groups.filter(g => g.arrival_date === selectedDate || g.arrival_date === NEXT_DATE).map(g => g.id)),
    [groups, selectedDate, NEXT_DATE]
  );

  const arrivingSoonPendingAllocation = useMemo(() =>
    profiles
      .filter(p => p.sleeping_requirements_completed && !allocatedGroupIds.has(p.group_id) && arrivingSoonGroupIds.has(p.group_id))
      .map(p => ({ id: p.group_id, label: groupById[p.group_id]?.group_name || p.group_id })),
    [profiles, allocatedGroupIds, arrivingSoonGroupIds, groupById]
  );

  const brokenItemsList = useMemo(() => [
    ...brokenFacilities.map(f => ({ id: f.id, label: `מתקן: ${f.label} (${f.working_status})` })),
    ...brokenTents.map(t => ({ id: t.id, label: `אוהל: ${t.code} (${t.working_status})` })),
  ], [brokenFacilities, brokenTents]);

  const warnings = { arrivingNoSleeping, arrivingNextNoSleeping, arrivingSoonPendingAllocation, brokenItems: brokenItemsList };

  // ── Per-group counts ───────────────────────────────────────────────────────
  const mealsByGroup = useMemo(() => {
    const map = {};
    mealsForDate.forEach(m => { map[m.group_id] = (map[m.group_id] || 0) + 1; });
    return map;
  }, [mealsForDate]);

  const activitiesByGroup = useMemo(() => {
    const map = {};
    activitiesForDate.forEach(a => { map[a.group_id] = (map[a.group_id] || 0) + 1; });
    return map;
  }, [activitiesForDate]);

  const selectedDateDisplay = format(new Date(selectedDate + "T00:00:00"), "EEEE, d בMMMM yyyy", { locale: he });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              דאשבורד יומי
              {isToday && (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">היום</span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">{selectedDateDisplay}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => window.open(`/daily-print?date=${selectedDate}`, "_blank")}
          >
            <FileText className="w-3.5 h-3.5" /> הפק סיכום יומי
          </Button>
        </div>

        {/* Date navigation */}
        <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => shiftDate(-1)} className="gap-1 flex-1 sm:flex-none h-9">
              <ChevronRight className="w-4 h-4" /> יום קודם
            </Button>
            <Button
              size="sm"
              variant={isToday ? "default" : "outline"}
              onClick={() => setSelectedDate(TODAY)}
              className="h-9 px-4"
            >
              היום
            </Button>
            <Button size="sm" variant="outline" onClick={() => shiftDate(1)} className="gap-1 flex-1 sm:flex-none h-9">
              יום הבא <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="w-full sm:w-auto border border-input bg-transparent rounded-md px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Summary cards */}
        <DashboardSummaryCards stats={stats} isToday={isToday} />

        {/* Admin pax debug panel */}
        <PaxDebugPanel activeGroups={activeGroups} profileByGroupId={profileByGroupId} />

        {/* Quick links */}
        <Section title="קישורים מהירים">
          <DashboardQuickLinks />
        </Section>

        {/* Operational warnings */}
        <Section title="התראות תפעוליות">
          <DashboardWarnings warnings={warnings} selectedDate={selectedDate} today={TODAY} />
        </Section>

        {/* Arriving */}
        {arrivingToday.length > 0 && (
          <Section title={`קבוצות נכנסות (${arrivingToday.length})`}>
            <div className="space-y-2">
              {arrivingToday.map(g => (
                <DashboardGroupCard
                  key={g.id}
                  group={g}
                  profile={profileByGroupId[g.id]}
                  mode="arriving"
                />
              ))}
            </div>
          </Section>
        )}

        {/* Sleeping */}
        {sleepingTonight.length > 0 && (
          <Section title={`לנים בלילה (${sleepingTonight.length})`}>
            <div className="space-y-2">
              {sleepingTonight.map(g => (
                <DashboardGroupCard
                  key={g.id}
                  group={g}
                  profile={profileByGroupId[g.id]}
                  mealsToday={mealsByGroup[g.id] || 0}
                  activitiesToday={activitiesByGroup[g.id] || 0}
                  mode="sleeping"
                />
              ))}
            </div>
          </Section>
        )}

        {/* Departing */}
        {departingToday.length > 0 && (
          <Section title={`קבוצות יוצאות (${departingToday.length})`}>
            <div className="space-y-2">
              {departingToday.map(g => (
                <DashboardGroupCard
                  key={g.id}
                  group={g}
                  profile={profileByGroupId[g.id]}
                  mode="departing"
                />
              ))}
            </div>
          </Section>
        )}

        {/* Meals */}
        <Section title={`ארוחות (${mealsForDate.length})`}>
          <DashboardMealsToday meals={mealsForDate} groupById={groupById} profileById={profileById} />
        </Section>

        {/* Activities */}
        <Section title={`פעילויות (${activitiesForDate.length})`}>
          <DashboardActivitiesToday activities={activitiesForDate} groupById={groupById} spaceById={spaceById} />
        </Section>

      </div>
    </div>
  );
}