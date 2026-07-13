import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ANALYTICS_VALID_GROUP_STATUSES = ["CONFIRMED", "COMPLETED"];
const TOTAL_FIXED_BEDS = 345;
const DAY_MS = 86400000;
const dateOnly = (date) => date.toISOString().slice(0, 10);
const utcDate = (value) => new Date(`${value}T00:00:00Z`);
const diffDays = (start, end) => Math.max(0, Math.round((utcDate(end) - utcDate(start)) / DAY_MS));
const maxDate = (a, b) => a > b ? a : b;
const minDate = (a, b) => a < b ? a : b;
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function monthBounds(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const end = new Date(next.getTime() - DAY_MS);
  return { start: dateOnly(start), end: dateOnly(end), next: dateOnly(next), days: end.getUTCDate() };
}

function normalizeGroup(group, profile, bounds) {
  const studentsCount = number(profile?.participant_count ?? group.participant_count ?? (number(profile?.boys_count ?? group.boys_count) + number(profile?.girls_count ?? group.girls_count)));
  const staffCount = number(profile?.staff_count ?? group.staff_count);
  const vipCount = number(profile?.vip_count ?? group.vip_count);
  const fallbackPax = studentsCount + staffCount + vipCount;
  const totalPax = number(profile?.total_pax ?? group.total_pax ?? fallbackPax);
  const groupType = group.group_type || (profile?.is_sleeping_group === true ? "LODGING" : profile?.is_sleeping_group === false ? "DAY_USE" : "UNKNOWN");
  const overlapStart = maxDate(group.arrival_date, bounds.start);
  const lodgingEndExclusive = minDate(group.departure_date || group.arrival_date, bounds.next);
  const nightsInsideMonth = groupType === "LODGING" ? diffDays(overlapStart, lodgingEndExclusive) : 0;
  const activeEnd = minDate(group.departure_date || group.arrival_date, bounds.end);
  const activeDaysInsideMonth = activeEnd >= overlapStart ? diffDays(overlapStart, activeEnd) + 1 : 0;
  return {
    id: group.id, group_name: group.group_name || "ללא שם", arrival_date: group.arrival_date,
    departure_date: group.departure_date || group.arrival_date, group_type: groupType, total_pax: totalPax,
    students_count: studentsCount, staff_count: staffCount, vip_count: vipCount,
    nights_inside_month: nightsInsideMonth, person_nights: totalPax * nightsInsideMonth,
    active_days_inside_month: activeDaysInsideMonth,
  };
}

function summarize(groups, profilesByGroup, bounds) {
  const rows = groups
    .filter(group => group.arrival_date && (group.departure_date || group.arrival_date) >= bounds.start && group.arrival_date <= bounds.end)
    .map(group => normalizeGroup(group, profilesByGroup[group.id], bounds));
  const lodging = rows.filter(row => row.group_type === "LODGING");
  const dayUse = rows.filter(row => row.group_type === "DAY_USE");
  const totalPax = rows.reduce((sum, row) => sum + row.total_pax, 0);
  const personNights = lodging.reduce((sum, row) => sum + row.person_nights, 0);
  const arrivals = rows.filter(row => row.arrival_date >= bounds.start && row.arrival_date <= bounds.end).length;
  const departures = rows.filter(row => row.departure_date >= bounds.start && row.departure_date <= bounds.end).length;
  return {
    rows,
    kpis: {
      total_active_groups: rows.length, arrivals_count: arrivals, departures_count: departures,
      total_pax_unique_groups: totalPax, average_pax_per_group: rows.length ? totalPax / rows.length : 0,
      lodging_groups_count: lodging.length, day_use_groups_count: dayUse.length,
      lodging_pax: lodging.reduce((sum, row) => sum + row.total_pax, 0),
      day_use_pax: dayUse.reduce((sum, row) => sum + row.total_pax, 0),
      average_stay_nights: lodging.length ? lodging.reduce((sum, row) => sum + row.nights_inside_month, 0) / lodging.length : 0,
      person_nights: personNights,
      bed_occupancy_rate: bounds.days ? (personNights / (TOTAL_FIXED_BEDS * bounds.days)) * 100 : 0,
      day_use_pax_visits: dayUse.reduce((sum, row) => sum + row.total_pax * row.active_days_inside_month, 0),
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email.trim().toLowerCase(), active: true });
    const internalUser = internalUsers.find(item => item.email?.trim().toLowerCase() === user.email.trim().toLowerCase());
    if (!internalUser || !["SUPER_ADMIN", "ADMIN"].includes(internalUser.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const payload = await req.json();
    const year = Number(payload.year);
    const month = Number(payload.month);
    const includeStandby = payload.includeStandby === true;
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ error: "year and month are required" }, { status: 400 });
    }

    const selectedBounds = monthBounds(year, month);
    const earliest = new Date(Date.UTC(year, month - 12, 1));
    const earliestDate = dateOnly(earliest);
    const validStatuses = includeStandby ? [...ANALYTICS_VALID_GROUP_STATUSES, "STANDBY"] : ANALYTICS_VALID_GROUP_STATUSES;
    const [allGroups, profiles, activities, meals, spaces] = await Promise.all([
      base44.asServiceRole.entities.Group.list("-arrival_date", 5000),
      base44.asServiceRole.entities.OperationalGroupProfile.list("-updated_date", 5000),
      base44.asServiceRole.entities.GroupScheduleItem.filter({ date: { $gte: selectedBounds.start, $lte: selectedBounds.end }, status: "ACTIVE" }, "date", 5000),
      base44.asServiceRole.entities.MealReservation.filter({ date: { $gte: selectedBounds.start, $lte: selectedBounds.end }, status: "ACTIVE" }, "date", 5000),
      base44.asServiceRole.entities.ActivitySpace.list("name", 500),
    ]);
    const groups = allGroups.filter(group => validStatuses.includes(group.status) && group.arrival_date && (group.departure_date || group.arrival_date) >= earliestDate);
    const profilesByGroup = {};
    for (const profile of profiles) if (profile.group_id && !profilesByGroup[profile.group_id]) profilesByGroup[profile.group_id] = profile;
    const selected = summarize(groups, profilesByGroup, selectedBounds);

    const monthlyTrend = [];
    for (let offset = 11; offset >= 0; offset--) {
      const date = new Date(Date.UTC(year, month - 1 - offset, 1));
      const bounds = monthBounds(date.getUTCFullYear(), date.getUTCMonth() + 1);
      const summary = summarize(groups, profilesByGroup, bounds);
      monthlyTrend.push({
        year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
        month_label: `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`,
        active_groups: summary.kpis.total_active_groups, arrivals: summary.kpis.arrivals_count,
        total_pax: summary.kpis.total_pax_unique_groups, lodging_pax: summary.kpis.lodging_pax,
        day_use_pax: summary.kpis.day_use_pax, person_nights: summary.kpis.person_nights,
        bed_occupancy_rate: summary.kpis.bed_occupancy_rate,
      });
    }

    const spaceMap = Object.fromEntries(spaces.map(space => [space.id, space.name]));
    const activitySpaceCounts = {};
    const activityTypeCounts = {};
    for (const item of activities) {
      const spaceName = spaceMap[item.activity_space_id] || item.activity_space_code || item.requested_location || "ללא מרחב";
      activitySpaceCounts[spaceName] = (activitySpaceCounts[spaceName] || 0) + 1;
      const type = item.activity_name || "אחר";
      activityTypeCounts[type] = (activityTypeCounts[type] || 0) + 1;
    }
    const mealCounts = {};
    for (const meal of meals) {
      const current = mealCounts[meal.meal_type] || { count: 0, pax: 0 };
      mealCounts[meal.meal_type] = { count: current.count + 1, pax: current.pax + number(meal.pax) };
    }
    const unknown = selected.rows.length - selected.kpis.lodging_groups_count - selected.kpis.day_use_groups_count;
    const warnings = [];
    const missingPax = selected.rows.filter(row => row.total_pax <= 0).length;
    if (missingPax) warnings.push({ code: "MISSING_PAX", count: missingPax, message: "קבוצות ללא נתוני משתתפים" });

    return Response.json({
      period: { year, month, month_start: selectedBounds.start, month_end: selectedBounds.end, days_in_month: selectedBounds.days },
      constants: { total_fixed_beds: TOTAL_FIXED_BEDS, valid_group_statuses: validStatuses },
      kpis: {
        ...selected.kpis, total_activities: activities.length, common_space_activities_count: activities.filter(item => item.activity_space_id).length,
        total_meals: meals.length, total_meal_pax: meals.reduce((sum, meal) => sum + number(meal.pax), 0),
      },
      arrivals_this_month: selected.rows.filter(row => row.arrival_date >= selectedBounds.start && row.arrival_date <= selectedBounds.end).map(row => row.id),
      departures_this_month: selected.rows.filter(row => row.departure_date >= selectedBounds.start && row.departure_date <= selectedBounds.end).map(row => row.id),
      active_groups_this_month: selected.rows.map(row => row.id),
      groups: selected.rows.sort((a, b) => a.arrival_date.localeCompare(b.arrival_date)),
      monthlyTrend,
      groupTypeDistribution: [
        { type: "LODGING", count: selected.kpis.lodging_groups_count },
        { type: "DAY_USE", count: selected.kpis.day_use_groups_count },
        { type: "OTHER/UNKNOWN", count: unknown },
      ],
      activities: { total: activities.length, common_space_activities_count: activities.filter(item => item.activity_space_id).length, activities_by_type: Object.entries(activityTypeCounts).map(([type, count]) => ({ type, count })) },
      activitiesBySpace: Object.entries(activitySpaceCounts).map(([space_name, count]) => ({ space_name, count })).sort((a, b) => b.count - a.count),
      meals: { available: true, total: meals.length, total_pax: meals.reduce((sum, meal) => sum + number(meal.pax), 0), meals_by_type: Object.entries(mealCounts).map(([meal_type, values]) => ({ meal_type, ...values })) },
      mealsByType: Object.entries(mealCounts).map(([meal_type, values]) => ({ meal_type, pax: values.pax })),
      warnings,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});