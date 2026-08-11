import {
  deriveStayEnvelope,
  getOperationalStayDates,
  isDateInsideStayPeriods,
  normalizeStayPeriods,
  occupiesSleepingNight,
  validateStayPeriods,
} from './groupStayPeriods.js';
import { groupLogicalSleepingAssignments, validateLinkedSeriesCompleteness } from './logicalSleepingSeries.js';
import { isGroupOperationallyEnabled } from './groupOperationalIsolation.js';

const ACTIVE_GROUP_STATUSES = new Set(['CONFIRMED', 'COMPLETED']);
const ACTIVE_ALLOCATION_STATUSES = new Set(['DRAFT', 'CONFIRMED']);

function uniq(values) { return [...new Set(values)].sort(); }
function difference(a, b) { const other = new Set(b); return a.filter(value => !other.has(value)); }
function overlap(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }
function nextDate(value) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function sleepingNights(periods) {
  const nights = [];
  for (const period of periods) {
    for (let date = period.start_date; date < period.end_date;) {
      nights.push(date);
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
  }
  return uniq(nights);
}
function publicPeriod(period) {
  return {
    ...(period.id ? { id: period.id } : {}),
    period_key: period._period_key,
    start_date: period.start_date,
    end_date: period.end_date,
    arrival_time: period.arrival_time || null,
    departure_time: period.departure_time || null,
    notes: period.notes || null,
    status: 'ACTIVE',
  };
}
function periodChanges(current, proposed) {
  const changes = [];
  if (current.start_date !== proposed.start_date) changes.push('MOVED_START');
  if (current.end_date < proposed.end_date) changes.push('EXTENDED_END');
  if (current.end_date > proposed.end_date) changes.push('SHORTENED_END');
  if ((current.arrival_time || '') !== (proposed.arrival_time || '')) changes.push('ARRIVAL_TIME_CHANGED');
  if ((current.departure_time || '') !== (proposed.departure_time || '')) changes.push('DEPARTURE_TIME_CHANGED');
  return changes;
}
function error(code, details = {}) { return { code, ...details }; }

export async function authorizeActiveStayAdmin(base44, user) {
  const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email }, '-created_date', 1);
  const internal = rows[0];
  const role = internal?.role || user.role;
  return !!internal?.active && ['SUPER_ADMIN', 'ADMIN'].includes(role);
}

export async function analyzeActiveMultiPeriodStayChange(base44, groupId, rawProposedPeriods, today = new Date().toISOString().slice(0, 10)) {
  const [groups, profiles, currentPeriods, allGroups, allProfiles, allPeriods, allAllocations, allReservations, settingsRows, holds, meals, scheduleItems, coffeeRequests, prisaRequests] = await Promise.all([
    base44.asServiceRole.entities.Group.filter({ id: groupId }),
    base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: groupId }),
    base44.asServiceRole.entities.GroupStayPeriod.filter({ group_id: groupId, status: 'ACTIVE' }, 'start_date', 100),
    base44.asServiceRole.entities.Group.list('-arrival_date', 1000),
    base44.asServiceRole.entities.OperationalGroupProfile.list(),
    base44.asServiceRole.entities.GroupStayPeriod.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.SleepingAllocation.filter({ status: { $in: ['DRAFT', 'CONFIRMED'] } }),
    base44.asServiceRole.entities.NeighborhoodReservation.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.SiteSettings.list(),
    base44.asServiceRole.entities.OperationalHold.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.MealReservation.filter({ group_id: groupId, status: 'ACTIVE' }),
    base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id: groupId, status: 'ACTIVE' }),
    base44.asServiceRole.entities.CoffeeCornerRequest.filter({ group_id: groupId, status: 'ACTIVE' }),
    base44.asServiceRole.entities.PrisaRequest.filter({ group_id: groupId, status: 'ACTIVE' }),
  ]);

  const group = groups[0];
  const blockingErrors = [];
  const warnings = [];
  if (!group) blockingErrors.push(error('GROUP_NOT_FOUND'));
  if (group && group.stay_mode !== 'MULTI_PERIOD') blockingErrors.push(error('NOT_MULTI_PERIOD'));
  if (group && (group.status !== 'CONFIRMED' || group.operationally_active !== true)) blockingErrors.push(error('NOT_ACTIVE_CONFIRMED_MULTI_PERIOD'));
  if (profiles.length !== 1) blockingErrors.push(error('EXPECTED_EXACTLY_ONE_OGP', { profile_count: profiles.length }));

  const supplied = Array.isArray(rawProposedPeriods) ? rawProposedPeriods : [];
  const proposedWithKeys = supplied.map((period, index) => ({
    ...period,
    _period_key: period.id ? `id:${period.id}` : `new:${period.client_key || index}`,
    status: 'ACTIVE',
  }));
  const proposed = normalizeStayPeriods(proposedWithKeys).map(publicPeriod);
  const validation = validateStayPeriods(proposed);
  validation.errors.forEach(item => blockingErrors.push(item));
  if (proposed.length < 2) blockingErrors.push(error('MIN_TWO_ACTIVE_PERIODS'));
  proposed.forEach((period, index) => {
    if (period.start_date >= period.end_date) blockingErrors.push(error('PERIOD_MUST_INCLUDE_SLEEPING_NIGHT', { index, period_key: period.period_key }));
  });

  const currentById = new Map(currentPeriods.map(period => [period.id, period]));
  const suppliedIds = proposed.map(period => period.id).filter(Boolean);
  if (new Set(suppliedIds).size !== suppliedIds.length) blockingErrors.push(error('DUPLICATE_PERIOD_IDS'));
  for (const id of suppliedIds) if (!currentById.has(id)) blockingErrors.push(error('INVALID_PERIOD_ID', { period_id: id }));

  const proposedById = new Map(proposed.filter(period => period.id).map(period => [period.id, period]));
  const addedPeriods = proposed.filter(period => !period.id);
  const removedPeriods = currentPeriods.filter(period => !proposedById.has(period.id));
  const changedPeriods = proposed.filter(period => period.id && currentById.has(period.id))
    .map(period => ({ current: currentById.get(period.id), proposed: period, changes: periodChanges(currentById.get(period.id), period) }))
    .filter(item => item.changes.length > 0);

  for (const item of [...removedPeriods.map(current => ({ current, proposed: null })), ...changedPeriods]) {
    const current = item.current;
    if (current.end_date <= today) blockingErrors.push(error('HISTORICAL_PERIOD_IMMUTABLE', { period_id: current.id, start_date: current.start_date, end_date: current.end_date }));
    else if (current.start_date < today && (!item.proposed || item.proposed.start_date !== current.start_date || item.proposed.end_date < current.end_date)) {
      blockingErrors.push(error('STARTED_PERIOD_CANNOT_BE_REMOVED_OR_REWRITTEN', { period_id: current.id, start_date: current.start_date, end_date: current.end_date }));
    }
  }
  addedPeriods.filter(period => period.start_date < today).forEach(period => blockingErrors.push(error('NEW_PERIOD_CANNOT_START_IN_PAST', { period_key: period.period_key })));

  const currentNights = sleepingNights(currentPeriods);
  const proposedNights = sleepingNights(proposed);
  const addedNights = difference(proposedNights, currentNights);
  const removedNights = difference(currentNights, proposedNights);
  const currentArrivals = uniq(currentPeriods.map(period => period.start_date));
  const proposedArrivals = uniq(proposed.map(period => period.start_date));
  const currentCheckouts = uniq(currentPeriods.map(period => period.end_date));
  const proposedCheckouts = uniq(proposed.map(period => period.end_date));

  const myAllocations = allAllocations.filter(row => row.group_id === groupId && ACTIVE_ALLOCATION_STATUSES.has(row.status));
  const unlinkedAllocations = myAllocations.filter(row => !row.stay_period_id || !row.allocation_series_id);
  if (unlinkedAllocations.length) blockingErrors.push(error('LEGACY_SLEEPING_LINKAGE_REQUIRED', { allocation_ids: unlinkedAllocations.map(row => row.id) }));
  const seriesValidation = validateLinkedSeriesCompleteness(myAllocations, currentPeriods, groupId);
  if (!seriesValidation.valid) blockingErrors.push(error('INCOMPLETE_SLEEPING_SERIES', { details: seriesValidation.errors }));
  const logical = groupLogicalSleepingAssignments(myAllocations).logical_assignments;
  const allocationUpdates = [];
  const allocationCreates = [];
  const allocationCancels = [];
  const exactTentConflicts = [];
  for (const series of logical) {
    if (series.inconsistent || !series.linked) continue;
    const rowByPeriod = new Map(series.period_rows.map(row => [row.stay_period_id, row]));
    for (const period of proposed) {
      const existing = period.id ? rowByPeriod.get(period.id) : null;
      const baseRow = series.period_rows[0];
      const conflicting = allAllocations.filter(row => row.group_id !== groupId && ACTIVE_ALLOCATION_STATUSES.has(row.status) && row.tent_id === series.tent_id && overlap(period.start_date, period.end_date, row.arrival_date, row.departure_date));
      conflicting.forEach(row => exactTentConflicts.push({ allocation_series_id: series.allocation_series_id, tent_id: series.tent_id, period_key: period.period_key, proposed_start_date: period.start_date, proposed_end_date: period.end_date, conflicting_group_id: row.group_id, conflicting_allocation_id: row.id, conflicting_start_date: row.arrival_date, conflicting_end_date: row.departure_date }));
      if (existing) {
        if (existing.arrival_date !== period.start_date || existing.departure_date !== period.end_date) allocationUpdates.push({ id: existing.id, period_key: period.period_key, arrival_date: period.start_date, departure_date: period.end_date });
      } else allocationCreates.push({ period_key: period.period_key, template: { operational_group_profile_id: baseRow.operational_group_profile_id, group_id: groupId, tent_id: baseRow.tent_id, neighborhood_id: baseRow.neighborhood_id, allocated_pax: Number(baseRow.allocated_pax), allocation_type: baseRow.allocation_type, gender_group: baseRow.gender_group, notes: baseRow.notes || '', status: series.all_confirmed ? 'CONFIRMED' : 'DRAFT', housekeeping_status: 'PENDING', allocation_series_id: series.allocation_series_id, arrival_date: period.start_date, departure_date: period.end_date } });
    }
    const proposedIds = new Set(suppliedIds);
    series.period_rows.filter(row => !proposedIds.has(row.stay_period_id)).forEach(row => allocationCancels.push({ id: row.id, stay_period_id: row.stay_period_id }));
  }
  if (exactTentConflicts.length) blockingErrors.push(error('SAME_TENT_CONFLICT', { conflicts: exactTentConflicts }));

  const myReservations = allReservations.filter(row => row.group_id === groupId && row.status === 'ACTIVE');
  const unlinkedReservations = myReservations.filter(row => !row.stay_period_id);
  if (unlinkedReservations.length) blockingErrors.push(error('LEGACY_NEIGHBORHOOD_LINKAGE_REQUIRED', { reservation_ids: unlinkedReservations.map(row => row.id) }));
  const desiredReservations = [];
  for (const period of proposed) {
    const byNeighborhood = new Map();
    logical.filter(series => series.allocation_type === 'STUDENT').forEach(series => {
      const item = byNeighborhood.get(series.neighborhood_id) || { tentIds: new Set(), genders: new Set() };
      item.tentIds.add(series.tent_id); item.genders.add(series.gender_group); byNeighborhood.set(series.neighborhood_id, item);
    });
    for (const [neighborhoodId, item] of byNeighborhood.entries()) desiredReservations.push({ period_key: period.period_key, period_id: period.id || null, start_date: period.start_date, end_date: period.end_date, neighborhood_id: neighborhoodId, gender_group: item.genders.size === 1 ? [...item.genders][0] : 'MIXED', planned_tents: item.tentIds.size });
  }
  if (myReservations.length && !logical.some(series => series.allocation_type === 'STUDENT')) blockingErrors.push(error('NEIGHBORHOOD_WITHOUT_STUDENT_SERIES'));
  const reservationUpdates = [];
  const reservationCreates = [];
  const matchedReservationIds = new Set();
  const neighborhoodConflicts = [];
  const overrideByNeighborhood = new Map();
  myReservations.filter(row => row.shared_neighborhood_allowed === true).forEach(row => overrideByNeighborhood.set(row.neighborhood_id, row));
  for (const desired of desiredReservations) {
    const existing = desired.period_id ? myReservations.find(row => row.stay_period_id === desired.period_id && row.neighborhood_id === desired.neighborhood_id) : null;
    if (existing) {
      matchedReservationIds.add(existing.id);
      if (existing.arrival_date !== desired.start_date || existing.departure_date !== desired.end_date || existing.gender_group !== desired.gender_group || Number(existing.planned_tents) !== desired.planned_tents) reservationUpdates.push({ id: existing.id, period_key: desired.period_key, arrival_date: desired.start_date, departure_date: desired.end_date, gender_group: desired.gender_group, planned_tents: desired.planned_tents });
    } else {
      const override = overrideByNeighborhood.get(desired.neighborhood_id);
      reservationCreates.push({ period_key: desired.period_key, template: { group_id: groupId, operational_group_profile_id: profiles[0]?.id, neighborhood_id: desired.neighborhood_id, arrival_date: desired.start_date, departure_date: desired.end_date, gender_group: desired.gender_group, planned_tents: desired.planned_tents, status: 'ACTIVE', source: 'allocation', shared_neighborhood_allowed: override?.shared_neighborhood_allowed === true, shared_neighborhood_reason: override?.shared_neighborhood_reason || null, shared_neighborhood_approved_by: override?.shared_neighborhood_approved_by || null, shared_neighborhood_approved_at: override?.shared_neighborhood_approved_at || null } });
    }
    const override = overrideByNeighborhood.get(desired.neighborhood_id);
    allReservations.filter(row => row.group_id !== groupId && row.status === 'ACTIVE' && row.neighborhood_id === desired.neighborhood_id && overlap(desired.start_date, desired.end_date, row.arrival_date, row.departure_date)).forEach(row => neighborhoodConflicts.push({ period_key: desired.period_key, neighborhood_id: desired.neighborhood_id, conflicting_group_id: row.group_id, conflicting_reservation_id: row.id, conflicting_start_date: row.arrival_date, conflicting_end_date: row.departure_date, shared_neighborhood_allowed: override?.shared_neighborhood_allowed === true, blocked: override?.shared_neighborhood_allowed !== true }));
  }
  const reservationCancels = myReservations.filter(row => !matchedReservationIds.has(row.id) && !desiredReservations.some(desired => desired.period_id === row.stay_period_id && desired.neighborhood_id === row.neighborhood_id)).map(row => ({ id: row.id, stay_period_id: row.stay_period_id }));
  const blockedNeighborhoods = neighborhoodConflicts.filter(item => item.blocked);
  if (blockedNeighborhoods.length) blockingErrors.push(error('NEIGHBORHOOD_CONFLICT', { conflicts: blockedNeighborhoods }));
  neighborhoodConflicts.filter(item => !item.blocked).forEach(item => warnings.push({ code: 'SHARED_NEIGHBORHOOD_OVERRIDE_USED', ...item }));

  const periodsByGroup = {};
  allPeriods.forEach(period => { (periodsByGroup[period.group_id] ||= []).push(period); });
  const profileByGroup = Object.fromEntries(allProfiles.map(profile => [profile.group_id, profile]));
  const maxSleepingPax = Number(settingsRows[0]?.max_sleeping_pax || 0);
  const requestedPax = Number(group?.total_pax || profiles[0]?.total_pax || 0);
  const capacityNights = [];
  for (const night of addedNights) {
    let existingPax = 0;
    const sources = [];
    const countedGroupIds = new Set();
    const nightEnd = nextDate(night);
    for (const other of allGroups) {
      if (other.id === groupId || other.group_type !== 'LODGING' || !ACTIVE_GROUP_STATUSES.has(other.status) || !isGroupOperationallyEnabled(other)) continue;
      const present = other.stay_mode === 'MULTI_PERIOD' ? occupiesSleepingNight(night, periodsByGroup[other.id] || []) : overlap(night, nightEnd, other.arrival_date, other.departure_date || other.arrival_date);
      if (!present) continue;
      countedGroupIds.add(other.id);
      const pax = Number(other.total_pax || profileByGroup[other.id]?.total_pax || 0);
      existingPax += pax; sources.push({ group_id: other.id, pax });
    }
    for (const hold of holds) {
      if (hold.group_type !== 'LODGING' || hold.group_id === groupId || (hold.group_id && countedGroupIds.has(hold.group_id))) continue;
      if (overlap(night, nightEnd, hold.arrival_date, hold.departure_date || hold.arrival_date)) existingPax += Number(hold.total_pax || 0);
    }
    const total = existingPax + requestedPax;
    const blocked = maxSleepingPax > 0 && total > maxSleepingPax;
    capacityNights.push({ night, existing_pax: existingPax, group_pax: requestedPax, total, capacity: maxSleepingPax, blocked, sources });
    if (blocked) blockingErrors.push(error('SITE_SLEEPING_CAPACITY_EXCEEDED', { night, existing_pax: existingPax, group_pax: requestedPax, total, capacity: maxSleepingPax }));
  }
  if (addedNights.length && maxSleepingPax === 0) warnings.push({ code: 'SITE_SLEEPING_CAPACITY_UNCONFIGURED' });

  const currentStayDates = getOperationalStayDates(currentPeriods);
  const proposedStayDates = getOperationalStayDates(proposed);
  const mealCancellations = meals.filter(meal => !isDateInsideStayPeriods(meal.date, proposed));
  const newlyEligibleDates = difference(proposedStayDates, currentStayDates);
  const outside = rows => rows.filter(row => !isDateInsideStayPeriods(row.date, proposed)).map(row => ({ id: row.id, date: row.date }));
  const activityWarnings = outside(scheduleItems);
  const coffeeWarnings = outside(coffeeRequests);
  const prisaWarnings = outside(prisaRequests);
  if (activityWarnings.length) warnings.push({ code: 'ACTIVITIES_IN_PROPOSED_GAP', count: activityWarnings.length });
  if (coffeeWarnings.length) warnings.push({ code: 'COFFEE_REQUESTS_IN_PROPOSED_GAP', count: coffeeWarnings.length });
  if (prisaWarnings.length) warnings.push({ code: 'PRISA_REQUESTS_IN_PROPOSED_GAP', count: prisaWarnings.length });

  const envelope = deriveStayEnvelope(proposed);
  const result = {
    success: true,
    allowed: blockingErrors.length === 0,
    blocking_errors: blockingErrors,
    warnings,
    period_diff: { added: addedPeriods, removed: removedPeriods.map(publicPeriod), changed: changedPeriods.map(item => ({ period_id: item.current.id, before: publicPeriod({ ...item.current, _period_key: `id:${item.current.id}` }), after: item.proposed, changes: item.changes })), added_sleeping_nights: addedNights, removed_sleeping_nights: removedNights },
    sleeping_impact: { logical_series_count: logical.length, same_tent_policy: true, rows_to_update: allocationUpdates.length, rows_to_create: allocationCreates.length, rows_to_cancel: allocationCancels.length, exact_tent_conflicts: exactTentConflicts },
    neighborhood_impact: { rows_to_update: reservationUpdates.length, rows_to_create: reservationCreates.length, rows_to_cancel: reservationCancels.length, conflicts: neighborhoodConflicts },
    capacity_impact: { configured_capacity: maxSleepingPax, added_nights: capacityNights },
    meal_impact: { cancellations: mealCancellations.map(meal => ({ id: meal.id, date: meal.date, meal_type: meal.meal_type })), newly_eligible_dates: newlyEligibleDates, automatic_creation: false, cancellation_mode: 'STATUS_CANCELLED' },
    housekeeping_impact: { new_preparation_dates: difference(proposedArrivals, currentArrivals), removed_preparation_dates: difference(currentArrivals, proposedArrivals), new_cleaning_dates: difference(proposedCheckouts, currentCheckouts), removed_cleaning_dates: difference(currentCheckouts, proposedCheckouts) },
    movement_impact: { added_check_ins: difference(proposedArrivals, currentArrivals), removed_check_ins: difference(currentArrivals, proposedArrivals), added_check_outs: difference(proposedCheckouts, currentCheckouts), removed_check_outs: difference(currentCheckouts, proposedCheckouts) },
    other_dated_children_impact: { activities: activityWarnings, coffee_corner_requests: coffeeWarnings, prisa_requests: prisaWarnings, action: 'WARNING_ONLY' },
    derived_envelope: envelope,
    historical_policy: { today, completed_periods_immutable: true, started_period_start_immutable: true },
  };
  const plan = { group, profile: profiles[0], currentPeriods, proposed, envelope, periodUpdates: changedPeriods.map(item => ({ id: item.current.id, period: item.proposed })), periodCreates: addedPeriods, periodCancels: removedPeriods, allocationUpdates, allocationCreates, allocationCancels, reservationUpdates, reservationCreates, reservationCancels, mealCancellations, allAllocations, allReservations };
  return { result, plan };
}