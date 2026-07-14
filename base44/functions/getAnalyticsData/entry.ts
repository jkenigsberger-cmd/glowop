import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ANALYTICS_VALID_GROUP_STATUSES = ["CONFIRMED", "COMPLETED"];
const TOTAL_FIXED_BEDS = 345;
const DAY_MS = 86400000;
const dateOnly = date => date.toISOString().slice(0, 10);
const utcDate = value => new Date(`${value}T00:00:00Z`);
const diffDays = (start, end) => Math.max(0, Math.round((utcDate(end) - utcDate(start)) / DAY_MS));
const maxDate = (...values) => values.filter(Boolean).sort().at(-1);
const minDate = (...values) => values.filter(Boolean).sort().at(0);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function monthBounds(year, month) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const nextDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(nextDate.getTime() - DAY_MS);
  return { start: dateOnly(startDate), end: dateOnly(endDate), next: dateOnly(nextDate), days: endDate.getUTCDate(), year, month };
}

function parsePeriod(payload) {
  const single = payload.year !== undefined || payload.month !== undefined;
  const sy = Number(single ? payload.year : payload.startYear);
  const sm = Number(single ? payload.month : payload.startMonth);
  const ey = Number(single ? payload.year : payload.endYear);
  const em = Number(single ? payload.month : payload.endMonth);
  const valid = [sy, ey].every(y => Number.isInteger(y) && y >= 2000 && y <= 2100) && [sm, em].every(m => Number.isInteger(m) && m >= 1 && m <= 12);
  if (!valid) return null;
  const first = monthBounds(sy, sm);
  const last = monthBounds(ey, em);
  if (first.start > last.start) return null;
  return { mode: single ? "single" : "range", start: first.start, end: last.end, next: last.next, days: diffDays(first.start, last.next), startYear: sy, startMonth: sm, endYear: ey, endMonth: em };
}

function normalizeType(group, profile) {
  const raw = String(group.group_type || "").trim().toUpperCase().replace(/[ -]/g, "_");
  if (["LODGING", "SLEEPING", "OVERNIGHT", "LINA", "לינה"].includes(raw)) return "LODGING";
  if (["DAY_USE", "DAY", "DAYUSE", "יום", "פעילות_יום"].includes(raw)) return "DAY_USE";
  if (profile?.is_sleeping_group === true) return "LODGING";
  if (profile?.is_sleeping_group === false) return "DAY_USE";
  return "UNKNOWN";
}

function normalizeGroup(group, profile, bounds) {
  const students = number(profile?.participant_count ?? group.participant_count ?? (number(profile?.boys_count ?? group.boys_count) + number(profile?.girls_count ?? group.girls_count)));
  const staff = number(profile?.staff_count ?? group.staff_count);
  const vip = number(profile?.vip_count ?? group.vip_count);
  const totalPax = number(profile?.total_pax ?? group.total_pax ?? (students + staff + vip));
  const groupType = normalizeType(group, profile);
  const departure = group.departure_date || group.arrival_date;
  const overlapStart = maxDate(group.arrival_date, bounds.start);
  const lodgingEnd = minDate(departure, bounds.next);
  const nights = groupType === "LODGING" ? diffDays(overlapStart, lodgingEnd) : 0;
  const activeEnd = minDate(departure, bounds.end);
  const activeDays = activeEnd >= overlapStart ? diffDays(overlapStart, activeEnd) + 1 : 0;
  return { id: group.id, group_name: group.group_name || "ללא שם", arrival_date: group.arrival_date, departure_date: departure, group_type: groupType, total_pax: totalPax, students_count: students, staff_count: staff, vip_count: vip, nights_inside_period: nights, nights_inside_month: nights, person_nights: totalPax * nights, active_days_inside_period: activeDays };
}

function summarize(groups, profilesByGroup, bounds) {
  const rows = groups.filter(group => group.arrival_date && (group.departure_date || group.arrival_date) >= bounds.start && group.arrival_date <= bounds.end).map(group => normalizeGroup(group, profilesByGroup[group.id], bounds));
  const lodging = rows.filter(row => row.group_type === "LODGING");
  const dayUse = rows.filter(row => row.group_type === "DAY_USE");
  const totalPax = rows.reduce((sum, row) => sum + row.total_pax, 0);
  const personNights = lodging.reduce((sum, row) => sum + row.person_nights, 0);
  return { rows, kpis: {
    total_active_groups: rows.length,
    arrivals_count: rows.filter(row => row.arrival_date >= bounds.start && row.arrival_date <= bounds.end).length,
    departures_count: rows.filter(row => row.departure_date >= bounds.start && row.departure_date <= bounds.end).length,
    total_pax_unique_groups: totalPax, average_pax_per_group: rows.length ? totalPax / rows.length : 0,
    lodging_groups_count: lodging.length, day_use_groups_count: dayUse.length,
    lodging_pax: lodging.reduce((sum, row) => sum + row.total_pax, 0), day_use_pax: dayUse.reduce((sum, row) => sum + row.total_pax, 0),
    average_stay_nights: lodging.length ? lodging.reduce((sum, row) => sum + row.nights_inside_period, 0) / lodging.length : 0,
    person_nights: personNights, bed_occupancy_rate: bounds.days ? personNights / (TOTAL_FIXED_BEDS * bounds.days) * 100 : 0,
    day_use_pax_visits: dayUse.reduce((sum, row) => sum + row.total_pax * row.active_days_inside_period, 0),
  }};
}

function sleepingUsage(allocations, groupsById, tents, neighborhoods, bounds) {
  const tentMap = Object.fromEntries(tents.map(tent => [tent.id, tent]));
  const neighborhoodMap = Object.fromEntries(neighborhoods.map(item => [item.id, item]));
  const tentStats = {};
  for (const allocation of allocations) {
    const group = groupsById[allocation.group_id];
    const tent = tentMap[allocation.tent_id];
    if (!group || !tent || allocation.status === "CANCELLED") continue;
    const start = maxDate(bounds.start, group.arrival_date, allocation.arrival_date);
    const end = minDate(bounds.next, group.departure_date || group.arrival_date, allocation.departure_date || group.departure_date);
    const nights = diffDays(start, end);
    if (nights <= 0) continue;
    const pax = number(allocation.allocated_pax);
    const current = tentStats[tent.id] || { tent_id: tent.id, tent_number: tent.code || `${tent.tent_number || ""}${tent.sub_label || ""}`, neighborhood_id: allocation.neighborhood_id || tent.neighborhood_id, capacity: number(tent.capacity), uses_count: 0, occupied_nights: 0, allocated_pax: 0, bed_nights: 0, groupIds: new Set(), groupNames: new Set() };
    current.uses_count += 1; current.occupied_nights += nights; current.allocated_pax += pax; current.bed_nights += pax * nights; current.groupIds.add(group.id); current.groupNames.add(group.group_name || "ללא שם");
    tentStats[tent.id] = current;
  }
  const tentUsage = Object.values(tentStats).map(item => ({ tent_id: item.tent_id, tent_number: item.tent_number, neighborhood_id: item.neighborhood_id, neighborhood: neighborhoodMap[item.neighborhood_id]?.name || neighborhoodMap[item.neighborhood_id]?.code || "לא ידוע", capacity: item.capacity, uses_count: item.uses_count, groups_count: item.groupIds.size, occupied_nights: item.occupied_nights, allocated_pax: item.allocated_pax, bed_nights: item.bed_nights, occupancy_rate: item.capacity && bounds.days ? item.bed_nights / (item.capacity * bounds.days) * 100 : null, group_names: [...item.groupNames].slice(0, 5) })).sort((a, b) => b.bed_nights - a.bed_nights);
  const neighborhoodStats = {};
  for (const tent of tentUsage) {
    const current = neighborhoodStats[tent.neighborhood_id] || { neighborhood_id: tent.neighborhood_id, neighborhood_name: tent.neighborhood, tentIds: new Set(), total_tent_uses: 0, groupNames: new Set(), pax_count: 0, bed_nights: 0 };
    current.tentIds.add(tent.tent_id); current.total_tent_uses += tent.uses_count; current.pax_count += tent.allocated_pax; current.bed_nights += tent.bed_nights; tent.group_names.forEach(name => current.groupNames.add(name)); neighborhoodStats[tent.neighborhood_id] = current;
  }
  const neighborhoodCapacity = {};
  tents.forEach(tent => { neighborhoodCapacity[tent.neighborhood_id] = (neighborhoodCapacity[tent.neighborhood_id] || 0) + number(tent.capacity); });
  const neighborhoodUsage = Object.values(neighborhoodStats).map(item => ({ neighborhood_id: item.neighborhood_id, neighborhood_number: neighborhoodMap[item.neighborhood_id]?.code || "", neighborhood_name: item.neighborhood_name, tents_used_count: item.tentIds.size, total_tent_uses: item.total_tent_uses, groups_count: item.groupNames.size, pax_count: item.pax_count, bed_nights: item.bed_nights, person_nights: item.bed_nights, occupancy_rate: neighborhoodCapacity[item.neighborhood_id] && bounds.days ? item.bed_nights / (neighborhoodCapacity[item.neighborhood_id] * bounds.days) * 100 : null })).sort((a, b) => b.bed_nights - a.bed_nights);
  return { tentUsage, neighborhoodUsage };
}

Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const users = await base44.asServiceRole.entities.InternalUser.list("-updated_date", 500);
    const internalUser = users.find(item => item.active && item.email?.trim().toLowerCase() === user.email.trim().toLowerCase());
    if (!internalUser || internalUser.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });
    const payload = await req.json();
    const period = parsePeriod(payload);
    if (!period) return Response.json({ error: "Invalid month or range" }, { status: 400 });
    const validStatuses = payload.includeStandby === true ? [...ANALYTICS_VALID_GROUP_STATUSES, "STANDBY"] : ANALYTICS_VALID_GROUP_STATUSES;
    const [allGroups, profiles, activities, meals, spaces, allocations, tents, neighborhoods] = await Promise.all([
      base44.asServiceRole.entities.Group.list("-arrival_date", 5000), base44.asServiceRole.entities.OperationalGroupProfile.list("-updated_date", 5000),
      base44.asServiceRole.entities.GroupScheduleItem.filter({ date: { $gte: period.start, $lte: period.end }, status: "ACTIVE" }, "date", 5000),
      base44.asServiceRole.entities.MealReservation.filter({ date: { $gte: period.start, $lte: period.end }, status: "ACTIVE" }, "date", 5000),
      base44.asServiceRole.entities.ActivitySpace.list("name", 500), base44.asServiceRole.entities.SleepingAllocation.list("-arrival_date", 5000),
      base44.asServiceRole.entities.Tent.list("code", 1000), base44.asServiceRole.entities.Neighborhood.list("sort_order", 500),
    ]);
    const groups = allGroups.filter(group => validStatuses.includes(group.status));
    const groupsById = Object.fromEntries(groups.map(group => [group.id, group]));
    const profilesByGroup = {};
    profiles.forEach(profile => { if (profile.group_id && !profilesByGroup[profile.group_id]) profilesByGroup[profile.group_id] = profile; });
    const selected = summarize(groups, profilesByGroup, period);
    const trendStartDate = period.mode === "single" ? new Date(Date.UTC(period.startYear, period.startMonth - 12, 1)) : utcDate(period.start);
    const trendEndDate = new Date(Date.UTC(period.endYear, period.endMonth - 1, 1));
    const monthlyTrend = [];
    for (let cursor = trendStartDate; cursor <= trendEndDate; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
      const bounds = monthBounds(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1); const summary = summarize(groups, profilesByGroup, bounds);
      monthlyTrend.push({ year: bounds.year, month: bounds.month, month_label: `${String(bounds.month).padStart(2, "0")}/${bounds.year}`, active_groups: summary.kpis.total_active_groups, arrivals: summary.kpis.arrivals_count, total_pax: summary.kpis.total_pax_unique_groups, lodging_pax: summary.kpis.lodging_pax, day_use_pax: summary.kpis.day_use_pax, person_nights: summary.kpis.person_nights, bed_occupancy_rate: summary.kpis.bed_occupancy_rate });
    }
    const spaceMap = Object.fromEntries(spaces.map(space => [space.id, space.name]));
    const spaceCounts = {}, nameCounts = {}, mealCounts = {};
    activities.forEach(item => { const space = spaceMap[item.activity_space_id] || item.activity_space_code || item.requested_location || "ללא מרחב"; spaceCounts[space] = (spaceCounts[space] || 0) + 1; const name = item.activity_name || "אחר"; nameCounts[name] = (nameCounts[name] || 0) + 1; });
    meals.forEach(meal => { const current = mealCounts[meal.meal_type] || { count: 0, pax: 0 }; mealCounts[meal.meal_type] = { count: current.count + 1, pax: current.pax + number(meal.pax) }; });
    const usage = sleepingUsage(allocations, groupsById, tents, neighborhoods, period);
    const missingPax = selected.rows.filter(row => row.total_pax <= 0).length;
    const unknown = selected.rows.length - selected.kpis.lodging_groups_count - selected.kpis.day_use_groups_count;
    return Response.json({
      period: { mode: period.mode, start: period.start, end: period.end, days: period.days, start_year: period.startYear, start_month: period.startMonth, end_year: period.endYear, end_month: period.endMonth }, constants: { total_fixed_beds: TOTAL_FIXED_BEDS, valid_group_statuses: validStatuses },
      kpis: { ...selected.kpis, total_activities: activities.length, common_space_activities_count: activities.filter(item => item.activity_space_id).length, total_meals: meals.length, total_meal_pax: meals.reduce((sum, meal) => sum + number(meal.pax), 0) },
      groups: selected.rows.sort((a, b) => a.arrival_date.localeCompare(b.arrival_date)), monthlyTrend,
      groupTypeDistribution: [{ type: "LODGING", count: selected.kpis.lodging_groups_count }, { type: "DAY_USE", count: selected.kpis.day_use_groups_count }, { type: "OTHER/UNKNOWN", count: unknown }],
      activities: { total: activities.length, common_space_activities_count: activities.filter(item => item.activity_space_id).length, activities_by_name: Object.entries(nameCounts).map(([name, count]) => ({ name, count })) },
      activitiesBySpace: Object.entries(spaceCounts).map(([space_name, count]) => ({ space_name, count })).sort((a, b) => b.count - a.count),
      meals: { available: true, total: meals.length, total_pax: meals.reduce((sum, meal) => sum + number(meal.pax), 0), meals_by_type: Object.entries(mealCounts).map(([meal_type, values]) => ({ meal_type, ...values })) },
      mealsByType: Object.entries(mealCounts).map(([meal_type, values]) => ({ meal_type, pax: values.pax })),
      neighborhoodUsage: usage.neighborhoodUsage, tentUsage: usage.tentUsage,
      warnings: missingPax ? [{ code: "MISSING_PAX", count: missingPax, message: "קבוצות ללא נתוני משתתפים" }] : [],
    });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});