import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import DashboardSummaryCards from "@/components/dashboard/DashboardSummaryCards";
import DashboardGroupCard from "@/components/dashboard/DashboardGroupCard";
import DashboardWarnings from "@/components/dashboard/DashboardWarnings";
import DashboardMealsToday from "@/components/dashboard/DashboardMealsToday";
import DashboardActivitiesToday from "@/components/dashboard/DashboardActivitiesToday";
import DashboardQuickLinks from "@/components/dashboard/DashboardQuickLinks";

const TODAY = new Date().toISOString().slice(0, 10);

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-base text-foreground border-b border-border pb-1">{title}</h2>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 300),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["operationalProfiles"],
    queryFn: () => base44.entities.OperationalGroupProfile.list("-accepted_at", 300),
  });

  const { data: meals = [] } = useQuery({
    queryKey: ["mealsToday"],
    queryFn: () => base44.entities.MealReservation.filter({ date: TODAY, status: "ACTIVE" }),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activitiesToday"],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ date: TODAY, status: "ACTIVE" }),
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
  const groupById = Object.fromEntries(groups.map(g => [g.id, g]));
  const profileByGroupId = Object.fromEntries(profiles.map(p => [p.group_id, p]));
  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]));
  const spaceById = Object.fromEntries(activitySpaces.map(s => [s.id, s]));
  const allocatedGroupIds = new Set(allocations.map(a => a.group_id));

  // ── Date buckets ──────────────────────────────────────────────────────────
  // active:
  //   - LODGING: arrival <= today AND (departure >= today OR no departure)
  //   - DAY_USE: arrival === today (no departure = only active on arrival day)
  const activeGroups = groups.filter(g => {
    if (g.status === "CANCELLED") return false;
    if (g.group_type === "DAY_USE") {
      return g.arrival_date === TODAY;
    }
    return g.arrival_date <= TODAY && (!g.departure_date || g.departure_date >= TODAY);
  });
  const arrivingToday  = groups.filter(g => g.status !== "CANCELLED" && g.arrival_date === TODAY);
  // sleeping tonight: arrival <= today AND departure > today (departure is checkout, not sleeping night)
  const sleepingTonight = groups.filter(g => g.status !== "CANCELLED" && g.arrival_date <= TODAY && g.departure_date && g.departure_date > TODAY);
  const departingToday = groups.filter(g => g.status !== "CANCELLED" && g.departure_date === TODAY);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPaxOnSite = activeGroups.reduce((sum, g) => {
    const p = profileByGroupId[g.id];
    return sum + (p?.total_pax ?? g.total_pax ?? 0);
  }, 0);

  const brokenFacilities = facilities.filter(f => f.working_status !== "WORKING");
  const brokenTents = tents.filter(t => t.working_status !== "WORKING");
  const maintenanceIssues = brokenFacilities.length + brokenTents.length;

  // Groups with profile where sleeping is complete but no confirmed allocation yet
  const pendingHousekeepingProfiles = profiles.filter(p =>
    p.sleeping_requirements_completed && !allocatedGroupIds.has(p.group_id)
  );

  const stats = {
    activeGroups:       activeGroups.length,
    arrivingToday:      arrivingToday.length,
    sleepingTonight:    sleepingTonight.length,
    departingToday:     departingToday.length,
    totalPaxOnSite,
    mealsToday:         meals.length,
    activitiesToday:    activities.length,
    pendingHousekeeping: pendingHousekeepingProfiles.length,
    maintenanceIssues,
  };

  // ── Operational warnings — scoped to today/tomorrow only ─────────────────
  const TOMORROW = new Date(new Date().getTime() + 86400000).toISOString().slice(0, 10);

  // Groups arriving TODAY with no sleeping requirements completed
  const arrivingNoSleeping = arrivingToday
    .map(g => profileByGroupId[g.id])
    .filter(p => p && !p.sleeping_requirements_completed)
    .map(p => ({ id: p.group_id, label: groupById[p.group_id]?.group_name || p.group_id }));

  // Groups arriving TOMORROW with no sleeping requirements completed
  const arrivingTomorrowNoSleeping = groups
    .filter(g => g.arrival_date === TOMORROW)
    .map(g => profileByGroupId[g.id])
    .filter(p => p && !p.sleeping_requirements_completed)
    .map(p => ({ id: p.group_id, label: groupById[p.group_id]?.group_name || p.group_id }));

  // Groups arriving today or tomorrow: sleeping complete but no allocation yet
  const arrivingSoonGroupIds = new Set(
    groups.filter(g => g.arrival_date === TODAY || g.arrival_date === TOMORROW).map(g => g.id)
  );
  const arrivingSoonPendingAllocation = profiles
    .filter(p => p.sleeping_requirements_completed && !allocatedGroupIds.has(p.group_id) && arrivingSoonGroupIds.has(p.group_id))
    .map(p => ({ id: p.group_id, label: groupById[p.group_id]?.group_name || p.group_id }));

  // Broken facilities/tents — always show
  const brokenItemsList = [
    ...brokenFacilities.map(f => ({ id: f.id, label: `מתקן: ${f.label} (${f.working_status})` })),
    ...brokenTents.map(t => ({ id: t.id, label: `אוהל: ${t.code} (${t.working_status})` })),
  ];

  const warnings = { arrivingNoSleeping, arrivingTomorrowNoSleeping, arrivingSoonPendingAllocation, brokenItems: brokenItemsList };

  // ── Per-group counts for sleeping cards ───────────────────────────────────
  const mealsByGroup = {};
  meals.forEach(m => { mealsByGroup[m.group_id] = (mealsByGroup[m.group_id] || 0) + 1; });
  const activitiesByGroup = {};
  activities.forEach(a => { activitiesByGroup[a.group_id] = (activitiesByGroup[a.group_id] || 0) + 1; });

  const todayDisplay = format(new Date(), "EEEE, d בMMMM yyyy", { locale: he });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">בית</h1>
          <p className="text-muted-foreground text-sm mt-0.5">תמונת מצב תפעולית להיום — {todayDisplay}</p>
        </div>

        {/* Summary cards */}
        <DashboardSummaryCards stats={stats} />

        {/* Quick links */}
        <Section title="קישורים מהירים">
          <DashboardQuickLinks />
        </Section>

        {/* Operational warnings */}
        <Section title="התראות תפעוליות">
          <DashboardWarnings warnings={warnings} />
        </Section>

        {/* Arriving today */}
        {arrivingToday.length > 0 && (
          <Section title={`מגיעים היום (${arrivingToday.length})`}>
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

        {/* Sleeping tonight */}
        {sleepingTonight.length > 0 && (
          <Section title={`לנים הלילה (${sleepingTonight.length})`}>
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

        {/* Departing today */}
        {departingToday.length > 0 && (
          <Section title={`עוזבים היום (${departingToday.length})`}>
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

        {/* Today meals */}
        <Section title={`ארוחות היום (${meals.length})`}>
          <DashboardMealsToday meals={meals} groupById={groupById} profileById={profileById} />
        </Section>

        {/* Today activities */}
        <Section title={`פעילויות היום (${activities.length})`}>
          <DashboardActivitiesToday activities={activities} groupById={groupById} spaceById={spaceById} />
        </Section>

      </div>
    </div>
  );
}