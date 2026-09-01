import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isGroupOperationallyEnabled } from '../../shared/groupOperationalIsolation.js';
import { isDateInsideStayPeriods, isArrivalDate, isDepartureDate, occupiesSleepingNight } from '../../shared/groupStayPeriods.js';
import { readOperationalSnapshot } from '../../shared/operationalSnapshotReader.js';

const VALID_STATUSES = ["CONFIRMED", "COMPLETED"];
const TOTAL_FIXED_BEDS = 345;
const DAY_MS = 86400000;
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateOnly = date => date.toISOString().slice(0, 10);
const utcDate = value => new Date(`${value}T00:00:00Z`);
const minDate = (...values) => values.filter(Boolean).sort()[0];

function todayJerusalem() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function addDays(value, amount) { const date = utcDate(value); date.setUTCDate(date.getUTCDate() + amount); return dateOnly(date); }
function datesBetween(start, end) { const dates = []; for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date); return dates; }
function diffDays(start, end) { return Math.max(0, Math.round((utcDate(end) - utcDate(start)) / DAY_MS)); }
function monthBounds(year, month) {
  const start = dateOnly(new Date(Date.UTC(year, month - 1, 1)));
  const next = dateOnly(new Date(Date.UTC(year, month, 1)));
  return { start, end: addDays(next, -1), next, year, month };
}
function parsePeriod(payload) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate || "") && /^\d{4}-\d{2}-\d{2}$/.test(payload.endDate || "") && payload.startDate <= payload.endDate) {
    const startDate = utcDate(payload.startDate), endDate = utcDate(payload.endDate);
    return { mode: "range", start: payload.startDate, end: payload.endDate, startYear: startDate.getUTCFullYear(), startMonth: startDate.getUTCMonth() + 1, endYear: endDate.getUTCFullYear(), endMonth: endDate.getUTCMonth() + 1 };
  }
  const single = payload.year !== undefined || payload.month !== undefined;
  const sy = Number(single ? payload.year : payload.startYear), sm = Number(single ? payload.month : payload.startMonth);
  const ey = Number(single ? payload.year : payload.endYear), em = Number(single ? payload.month : payload.endMonth);
  if (![sy, ey].every(y => Number.isInteger(y) && y >= 2000 && y <= 2100) || ![sm, em].every(m => Number.isInteger(m) && m >= 1 && m <= 12)) return null;
  const first = monthBounds(sy, sm), last = monthBounds(ey, em);
  if (first.start > last.start) return null;
  return { mode: single ? "single" : "range", start: first.start, end: last.end, startYear: sy, startMonth: sm, endYear: ey, endMonth: em };
}
function normalizeType(group, profile) {
  const raw = String(group.group_type || "").trim().toUpperCase().replace(/[ -]/g, "_");
  if (["LODGING", "SLEEPING", "OVERNIGHT", "LINA", "לינה"].includes(raw)) return "LODGING";
  if (["DAY_USE", "DAY", "DAYUSE", "יום", "פעילות_יום"].includes(raw)) return "DAY_USE";
  if (profile?.is_sleeping_group === true) return "LODGING";
  if (profile?.is_sleeping_group === false) return "DAY_USE";
  return "UNKNOWN";
}
function periodsIndex(periods) { const index = {}; for (const period of periods || []) (index[period.group_id] ||= []).push(period); return index; }
function profileIndex(profiles) { const index = {}; for (const profile of profiles || []) if (profile.group_id && !index[profile.group_id]) index[profile.group_id] = profile; return index; }
function groupPax(group, profile) {
  const students = number(profile?.participant_count ?? group.participant_count ?? (number(profile?.boys_count ?? group.boys_count) + number(profile?.girls_count ?? group.girls_count)));
  const staff = number(profile?.staff_count ?? group.staff_count), vip = number(profile?.vip_count ?? group.vip_count);
  return { students, staff, vip, total: number(profile?.total_pax ?? group.total_pax ?? (students + staff + vip)) };
}
function groupFacts(group, profile, periods, date) {
  const multi = group.stay_mode === "MULTI_PERIOD";
  const present = multi ? isDateInsideStayPeriods(date, periods) : !!group.arrival_date && group.arrival_date <= date && date <= (group.departure_date || group.arrival_date);
  const sleeping = normalizeType(group, profile) === "LODGING" && (multi ? occupiesSleepingNight(date, periods) : !!group.arrival_date && group.arrival_date <= date && date < (group.departure_date || group.arrival_date));
  return {
    present, sleeping,
    arrival: multi ? isArrivalDate(date, periods) : group.arrival_date === date,
    departure: multi ? isDepartureDate(date, periods) : (group.departure_date || group.arrival_date) === date,
  };
}
function uniqueItems(items) {
  const map = new Map();
  (items || []).forEach((item, index) => map.set(item.id || `${item.group_id || ""}|${item.date || item.event_date || ""}|${item.start_time || ""}|${item.activity_name || item.title || ""}|${index}`, item));
  return [...map.values()];
}
function liveSource(live) { return { ...live, activities: live.activities, activity_spaces: live.activity_spaces }; }
function snapshotSource(data) {
  return {
    groups: data.groups || [], group_stay_periods: data.group_stay_periods || [], profiles: data.profiles || [], meals: data.meals || [],
    activities: uniqueItems([...(data.activities || []), ...(data.alert_activities || [])]), allocations: data.allocations || [], tents: data.tents || [],
    neighborhoods: data.neighborhoods || [], activity_spaces: data.activity_spaces || [],
  };
}
function emptyUsageItem(tent, allocation, neighborhoodMap) {
  const neighborhoodId = allocation.neighborhood_id || tent.neighborhood_id;
  return { tent_id: tent.id, tent_number: tent.code || `${tent.tent_number || ""}${tent.sub_label || ""}`, neighborhood_id: neighborhoodId, neighborhood: neighborhoodMap[neighborhoodId]?.name || neighborhoodMap[neighborhoodId]?.code || "לא ידוע", capacity: number(tent.capacity), uses: new Set(), occupied_nights: 0, allocated_pax: 0, bed_nights: 0, groupIds: new Set(), groupNames: new Set() };
}
function buildDailyMap(snapshotRecords, live, start, end, today) {
  const snapshots = {};
  for (const record of snapshotRecords) if (!snapshots[record.date]) snapshots[record.date] = record;
  const map = {};
  for (const date of datesBetween(start, end)) {
    if (date === today) map[date] = { source: "LIVE", data: liveSource(live) };
    else if (date < today && snapshots[date]) {
      const parsed = readOperationalSnapshot(snapshots[date]);
      map[date] = parsed.valid ? { source: "SNAPSHOT", data: snapshotSource(parsed.data), chunk_count: parsed.chunk_count } : { source: "SNAPSHOT_ERROR", data: null, error: parsed.error, chunk_count: parsed.chunk_count };
    } else if (date < today) map[date] = { source: "RECONSTRUCTED", data: liveSource(live) };
  }
  return map;
}
function aggregateRange(bounds, dailyMap, validStatuses) {
  const firstGroups = new Map(), tentStats = {}, neighborhoodCapacities = {}, spaceCounts = {}, nameCounts = {}, mealCounts = {};
  const arrivalEvents = new Set(), departureEvents = new Set();
  let personNights = 0, dayUseVisits = 0, totalMeals = 0, totalMealPax = 0, totalActivities = 0, commonActivities = 0;
  const quality = { snapshot_dates: [], reconstructed_dates: [], live_dates: [], missing_snapshot_dates: [], snapshot_error_dates: [], snapshot_errors: [] };
  const dailySources = [];
  const effectiveDates = bounds.effectiveEnd >= bounds.start ? datesBetween(bounds.start, bounds.effectiveEnd) : [];
  for (const date of effectiveDates) {
    const daily = dailyMap[date];
    if (!daily) continue;
    if (daily.source === "SNAPSHOT") quality.snapshot_dates.push(date);
    if (daily.source === "LIVE") quality.live_dates.push(date);
    if (daily.source === "RECONSTRUCTED") { quality.reconstructed_dates.push(date); quality.missing_snapshot_dates.push(date); }
    if (daily.source === "SNAPSHOT_ERROR") { quality.snapshot_error_dates.push(date); quality.snapshot_errors.push({ date, error: daily.error, chunk_count: daily.chunk_count }); continue; }
    const source = daily.data, profiles = profileIndex(source.profiles), periods = periodsIndex(source.group_stay_periods);
    dailySources.push({ date, source: daily.source, chunk_count: daily.chunk_count || null, groups: (source.groups || []).length, meals: uniqueItems((source.meals || []).filter(item => item.date === date)).length, activities: uniqueItems((source.activities || []).filter(item => item.date === date)).length, sleeping_allocations: uniqueItems(source.allocations || []).length });
    const groups = (source.groups || []).filter(group => isGroupOperationallyEnabled(group) && validStatuses.includes(group.status));
    const groupsById = Object.fromEntries(groups.map(group => [group.id, group]));
    const factsById = {};
    for (const group of groups) {
      const profile = profiles[group.id], facts = groupFacts(group, profile, periods[group.id] || [], date); factsById[group.id] = facts;
      const pax = groupPax(group, profile), type = normalizeType(group, profile);
      if (facts.present && !firstGroups.has(group.id)) {
        const stayPeriods = (periods[group.id] || []).filter(p => p.status !== "CANCELLED").map(p => ({ start_date: p.start_date, end_date: p.end_date })).sort((a, b) => a.start_date.localeCompare(b.start_date));
        firstGroups.set(group.id, { id: group.id, group_name: group.group_name || "ללא שם", arrival_date: group.arrival_date, departure_date: group.departure_date || group.arrival_date, group_type: type, stay_mode: group.stay_mode || "CONTINUOUS", stay_periods: stayPeriods, total_pax: pax.total, students_count: pax.students, staff_count: pax.staff, vip_count: pax.vip, nights_inside_period: 0, nights_inside_month: 0, person_nights: 0, active_days_inside_period: 0 });
      }
      const row = firstGroups.get(group.id);
      if (facts.present && row) { row.active_days_inside_period += 1; if (type === "DAY_USE") dayUseVisits += pax.total; }
      if (facts.sleeping) { personNights += pax.total; if (row) { row.nights_inside_period += 1; row.nights_inside_month += 1; row.person_nights += pax.total; } }
      if (facts.arrival) arrivalEvents.add(`${group.id}|${date}`);
      if (facts.departure) departureEvents.add(`${group.id}|${date}`);
    }
    const meals = uniqueItems((source.meals || []).filter(item => item.date === date && item.status !== "CANCELLED" && groupsById[item.group_id]));
    for (const meal of meals) { const current = mealCounts[meal.meal_type] || { count: 0, pax: 0 }; current.count += 1; current.pax += number(meal.pax); mealCounts[meal.meal_type] = current; totalMeals += 1; totalMealPax += number(meal.pax); }
    const spaces = Object.fromEntries((source.activity_spaces || []).map(space => [space.id, space.name]));
    const activities = uniqueItems((source.activities || []).filter(item => item.date === date && item.status !== "CANCELLED" && groupsById[item.group_id]));
    for (const item of activities) { const space = spaces[item.activity_space_id] || item.activity_space_code || item.requested_location || "ללא מרחב"; spaceCounts[space] = (spaceCounts[space] || 0) + 1; const name = item.activity_name || "אחר"; nameCounts[name] = (nameCounts[name] || 0) + 1; totalActivities += 1; if (item.activity_space_id) commonActivities += 1; }
    const tents = Object.fromEntries((source.tents || []).map(tent => [tent.id, tent]));
    const neighborhoods = Object.fromEntries((source.neighborhoods || []).map(item => [item.id, item]));
    for (const tent of source.tents || []) neighborhoodCapacities[tent.neighborhood_id] = Math.max(neighborhoodCapacities[tent.neighborhood_id] || 0, number(tent.capacity));
    for (const allocation of uniqueItems(source.allocations || [])) {
      const group = groupsById[allocation.group_id], tent = tents[allocation.tent_id];
      if (!group || !tent || allocation.status === "CANCELLED" || allocation.status === "DRAFT" || !factsById[group.id]?.sleeping || !(allocation.arrival_date <= date && date < allocation.departure_date)) continue;
      const current = tentStats[tent.id] || emptyUsageItem(tent, allocation, neighborhoods), pax = number(allocation.allocated_pax);
      current.uses.add(`${allocation.id || `${group.id}|${tent.id}|${allocation.arrival_date}|${allocation.departure_date}`}`); current.occupied_nights += 1; current.allocated_pax += pax; current.bed_nights += pax; current.groupIds.add(group.id); current.groupNames.add(group.group_name || "ללא שם"); tentStats[tent.id] = current;
    }
  }
  const rows = [...firstGroups.values()];
  const lodging = rows.filter(row => row.group_type === "LODGING"), dayUse = rows.filter(row => row.group_type === "DAY_USE");
  const totalPax = rows.reduce((sum, row) => sum + row.total_pax, 0), countedDays = effectiveDates.length;
  const tentUsage = Object.values(tentStats).map(item => ({ tent_id: item.tent_id, tent_number: item.tent_number, neighborhood_id: item.neighborhood_id, neighborhood: item.neighborhood, capacity: item.capacity, uses_count: item.uses.size, groups_count: item.groupIds.size, occupied_nights: item.occupied_nights, allocated_pax: item.allocated_pax, bed_nights: item.bed_nights, occupancy_rate: item.capacity && countedDays ? item.bed_nights / (item.capacity * countedDays) * 100 : null, group_names: [...item.groupNames].slice(0, 5) })).sort((a, b) => b.bed_nights - a.bed_nights);
  const neighborhoodStats = {};
  for (const tent of tentUsage) { const current = neighborhoodStats[tent.neighborhood_id] || { neighborhood_id: tent.neighborhood_id, neighborhood_name: tent.neighborhood, tentIds: new Set(), uses: 0, groups: new Set(), pax: 0, bed_nights: 0 }; current.tentIds.add(tent.tent_id); current.uses += tent.uses_count; current.pax += tent.allocated_pax; current.bed_nights += tent.bed_nights; tent.group_names.forEach(name => current.groups.add(name)); neighborhoodStats[tent.neighborhood_id] = current; }
  const neighborhoodUsage = Object.values(neighborhoodStats).map(item => {
    const capacity = tentUsage.filter(tent => tent.neighborhood_id === item.neighborhood_id).reduce((sum, tent) => sum + tent.capacity, 0);
    return { neighborhood_id: item.neighborhood_id, neighborhood_number: "", neighborhood_name: item.neighborhood_name, tents_used_count: item.tentIds.size, total_tent_uses: item.uses, groups_count: item.groups.size, pax_count: item.pax, bed_nights: item.bed_nights, person_nights: item.bed_nights, occupancy_rate: capacity && countedDays ? item.bed_nights / (capacity * countedDays) * 100 : null };
  }).sort((a, b) => b.bed_nights - a.bed_nights);
  const historicalDates = effectiveDates.filter(date => date < bounds.today), partial = quality.reconstructed_dates.length > 0 || quality.snapshot_error_dates.length > 0;
  quality.history_quality = historicalDates.length === 0 ? "LIVE" : partial ? "PARTIAL" : "FULL";
  const kpis = { total_active_groups: rows.length, arrivals_count: arrivalEvents.size, departures_count: departureEvents.size, total_pax_unique_groups: totalPax, average_pax_per_group: rows.length ? totalPax / rows.length : 0, lodging_groups_count: lodging.length, day_use_groups_count: dayUse.length, lodging_pax: lodging.reduce((sum, row) => sum + row.total_pax, 0), day_use_pax: dayUse.reduce((sum, row) => sum + row.total_pax, 0), average_stay_nights: lodging.length ? lodging.reduce((sum, row) => sum + row.nights_inside_period, 0) / lodging.length : 0, person_nights: personNights, bed_occupancy_rate: countedDays ? personNights / (TOTAL_FIXED_BEDS * countedDays) * 100 : 0, day_use_pax_visits: dayUseVisits, total_activities: totalActivities, common_space_activities_count: commonActivities, total_meals: totalMeals, total_meal_pax: totalMealPax };
  return { rows, kpis, quality, dailySources, tentUsage, neighborhoodUsage, spaceCounts, nameCounts, mealCounts, countedDays };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const users = await base44.asServiceRole.entities.InternalUser.list("-updated_date", 500);
    const internalUser = users.find(item => item.active && item.email?.trim().toLowerCase() === user.email.trim().toLowerCase());
    if (!internalUser || internalUser.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });
    const payload = await req.json(), period = parsePeriod(payload);
    if (!period) return Response.json({ error: "Invalid month or range" }, { status: 400 });
    const today = todayJerusalem(), effectiveEnd = minDate(period.end, today);
    const trendStart = period.mode === "single" ? dateOnly(new Date(Date.UTC(period.startYear, period.startMonth - 12, 1))) : period.start;
    const fetchEnd = effectiveEnd >= trendStart ? effectiveEnd : trendStart;
    const validStatuses = payload.includeStandby === true ? [...VALID_STATUSES, "STANDBY"] : VALID_STATUSES;
    const [snapshotRecords, allGroups, profiles, stayPeriods, activities, meals, spaces, allocations, tents, neighborhoods] = await Promise.all([
      base44.asServiceRole.entities.OperationalDaySnapshot.filter({ date: { $gte: trendStart, $lte: fetchEnd } }, "date", 1000),
      base44.asServiceRole.entities.Group.list("-arrival_date", 5000), base44.asServiceRole.entities.OperationalGroupProfile.list("-updated_date", 5000),
      base44.asServiceRole.entities.GroupStayPeriod.list("start_date", 5000), base44.asServiceRole.entities.GroupScheduleItem.filter({ date: { $gte: trendStart, $lte: fetchEnd }, status: "ACTIVE" }, "date", 5000),
      base44.asServiceRole.entities.MealReservation.filter({ date: { $gte: trendStart, $lte: fetchEnd }, status: "ACTIVE" }, "date", 5000),
      base44.asServiceRole.entities.ActivitySpace.list("name", 500), base44.asServiceRole.entities.SleepingAllocation.list("-arrival_date", 5000),
      base44.asServiceRole.entities.Tent.list("code", 1000), base44.asServiceRole.entities.Neighborhood.list("sort_order", 500),
    ]);
    const live = { groups: allGroups, profiles, group_stay_periods: stayPeriods, activities, meals, activity_spaces: spaces, allocations, tents, neighborhoods };
    const dailyMap = buildDailyMap(snapshotRecords, live, trendStart, fetchEnd, today);
    const selectedBounds = { ...period, effectiveEnd, today }, selected = aggregateRange(selectedBounds, dailyMap, validStatuses);
    const monthlyTrend = [];
    const trendEnd = new Date(Date.UTC(period.endYear, period.endMonth - 1, 1));
    for (let cursor = utcDate(trendStart); cursor <= trendEnd; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
      const month = monthBounds(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1), monthEffectiveEnd = minDate(month.end, today);
      const summary = aggregateRange({ ...month, effectiveEnd: monthEffectiveEnd, today }, dailyMap, validStatuses);
      monthlyTrend.push({ year: month.year, month: month.month, month_label: `${String(month.month).padStart(2, "0")}/${month.year}`, active_groups: summary.kpis.total_active_groups, arrivals: summary.kpis.arrivals_count, total_pax: summary.kpis.total_pax_unique_groups, lodging_pax: summary.kpis.lodging_pax, day_use_pax: summary.kpis.day_use_pax, person_nights: summary.kpis.person_nights, bed_occupancy_rate: summary.kpis.bed_occupancy_rate, history_quality: summary.quality.history_quality });
    }
    const unknown = selected.rows.length - selected.kpis.lodging_groups_count - selected.kpis.day_use_groups_count;
    const missingPax = selected.rows.filter(row => row.total_pax <= 0).length;
    const mealsByType = Object.entries(selected.mealCounts).map(([meal_type, values]) => ({ meal_type, pax: values.pax }));
    return Response.json({
      period: { mode: period.mode, start: period.start, end: period.end, effective_end: effectiveEnd, days: selected.countedDays, start_year: period.startYear, start_month: period.startMonth, end_year: period.endYear, end_month: period.endMonth },
      constants: { total_fixed_beds: TOTAL_FIXED_BEDS, valid_group_statuses: validStatuses }, participant_count_method: "FIRST_PRESENCE_PAX",
      history_quality: selected.quality.history_quality, snapshot_dates: selected.quality.snapshot_dates, reconstructed_dates: selected.quality.reconstructed_dates, live_dates: selected.quality.live_dates, missing_snapshot_dates: selected.quality.missing_snapshot_dates, snapshot_error_dates: selected.quality.snapshot_error_dates, snapshot_errors: selected.quality.snapshot_errors, daily_sources: selected.dailySources,
      kpis: selected.kpis, groups: selected.rows.sort((a, b) => a.arrival_date.localeCompare(b.arrival_date)), monthlyTrend,
      groupTypeDistribution: [{ type: "LODGING", count: selected.kpis.lodging_groups_count }, { type: "DAY_USE", count: selected.kpis.day_use_groups_count }, { type: "OTHER/UNKNOWN", count: unknown }],
      activities: { total: selected.kpis.total_activities, common_space_activities_count: selected.kpis.common_space_activities_count, activities_by_name: Object.entries(selected.nameCounts).map(([name, count]) => ({ name, count })) },
      activitiesBySpace: Object.entries(selected.spaceCounts).map(([space_name, count]) => ({ space_name, count })).sort((a, b) => b.count - a.count),
      meals: { available: true, total: selected.kpis.total_meals, total_pax: selected.kpis.total_meal_pax, meals_by_type: Object.entries(selected.mealCounts).map(([meal_type, values]) => ({ meal_type, ...values })) }, mealsByType,
      neighborhoodUsage: selected.neighborhoodUsage, tentUsage: selected.tentUsage,
      warnings: missingPax ? [{ code: "MISSING_PAX", count: missingPax, message: "קבוצות ללא נתוני משתתפים" }] : [],
    });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}