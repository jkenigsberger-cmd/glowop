import { normalizeStayPeriods, validateStayPeriods } from './groupStayPeriods.js';

const ALLOCATION_TYPES = new Set(['STUDENT', 'STAFF']);
const GENDER_GROUPS = new Set(['BOYS', 'GIRLS', 'MEN', 'WOMEN', 'MIXED']);

export function sleepingIntervalsOverlap(aArrival, aDeparture, bArrival, bDeparture) {
  return aArrival < bDeparture && bArrival < aDeparture;
}

export function findLegacyEnvelopeAllocations(groupId, periods, allocations = []) {
  const active = normalizeStayPeriods(periods).filter(period => period.status !== 'CANCELLED');
  if (active.length === 0) return [];
  const envelopeArrival = active[0].start_date;
  const envelopeDeparture = active[active.length - 1].end_date;
  return allocations.filter(allocation =>
    allocation.group_id === groupId &&
    allocation.status !== 'CANCELLED' &&
    !allocation.stay_period_id &&
    !allocation.allocation_series_id &&
    allocation.arrival_date === envelopeArrival &&
    allocation.departure_date === envelopeDeparture
  );
}

export function validateSleepingAssignments(assignments, tents = []) {
  const tentById = Object.fromEntries(tents.map(tent => [tent.id, tent]));
  const errors = [];
  if (!Array.isArray(assignments) || assignments.length === 0) return [{ code: 'ASSIGNMENTS_REQUIRED' }];
  const seenTentIds = new Set();
  assignments.forEach((assignment, index) => {
    const tent = tentById[assignment?.tent_id];
    if (!assignment?.tent_id || !assignment?.neighborhood_id) errors.push({ code: 'ASSIGNMENT_LOCATION_REQUIRED', index });
    if (!tent) errors.push({ code: 'TENT_NOT_FOUND', index, tent_id: assignment?.tent_id });
    else {
      if (tent.working_status !== 'WORKING') errors.push({ code: 'TENT_NOT_WORKING', index, tent_id: tent.id });
      if (tent.neighborhood_id !== assignment.neighborhood_id) errors.push({ code: 'TENT_NEIGHBORHOOD_MISMATCH', index, tent_id: tent.id });
      if (Number(assignment.allocated_pax) > Number(tent.capacity || 0)) errors.push({ code: 'PAX_EXCEEDS_TENT_CAPACITY', index, tent_id: tent.id });
    }
    if (!Number.isFinite(Number(assignment?.allocated_pax)) || Number(assignment.allocated_pax) <= 0) errors.push({ code: 'INVALID_ALLOCATED_PAX', index });
    if (!ALLOCATION_TYPES.has(assignment?.allocation_type)) errors.push({ code: 'INVALID_ALLOCATION_TYPE', index });
    if (!GENDER_GROUPS.has(assignment?.gender_group)) errors.push({ code: 'INVALID_GENDER_GROUP', index });
    if (assignment?.notes != null && typeof assignment.notes !== 'string') errors.push({ code: 'INVALID_NOTES', index });
    if (seenTentIds.has(assignment?.tent_id)) errors.push({ code: 'DUPLICATE_LOGICAL_TENT_ASSIGNMENT', index, tent_id: assignment?.tent_id });
    seenTentIds.add(assignment?.tent_id);
  });
  return errors;
}

export function buildMultiPeriodSleepingPlan({ groupId, profileId, periods, assignments }) {
  const periodValidation = validateStayPeriods(periods);
  const activePeriods = normalizeStayPeriods(periods).filter(period => period.status !== 'CANCELLED');
  const periodErrors = [...periodValidation.errors];
  activePeriods.forEach((period, index) => {
    if (period.end_date <= period.start_date) periodErrors.push({ code: 'SLEEPING_PERIOD_MUST_HAVE_NIGHT', index });
  });
  if (activePeriods.length === 0) periodErrors.push({ code: 'ACTIVE_PERIODS_REQUIRED' });
  if (periodErrors.length > 0) return { valid: false, errors: periodErrors, planned_rows: [], planned_neighborhood_intervals: [] };

  const plannedRows = [];
  assignments.forEach((assignment, assignmentIndex) => {
    activePeriods.forEach(period => {
      plannedRows.push({
        plan_key: `${assignmentIndex}:${period.id || period.start_date}`,
        source_stay_period_id: period.id || null,
        logical_assignment_index: assignmentIndex,
        sleeping_allocation: {
          operational_group_profile_id: profileId,
          group_id: groupId,
          tent_id: assignment.tent_id,
          neighborhood_id: assignment.neighborhood_id,
          arrival_date: period.start_date,
          departure_date: period.end_date,
          allocated_pax: Number(assignment.allocated_pax),
          allocation_type: assignment.allocation_type,
          gender_group: assignment.gender_group,
          notes: assignment.notes || '',
          status: 'DRAFT',
          housekeeping_status: 'PENDING',
        },
      });
    });
  });

  const plannedNeighborhoodIntervals = [];
  activePeriods.forEach(period => {
    const byNeighborhood = {};
    assignments.filter(a => a.allocation_type === 'STUDENT').forEach(assignment => {
      const entry = byNeighborhood[assignment.neighborhood_id] ||= { tentIds: new Set(), genders: new Set() };
      entry.tentIds.add(assignment.tent_id);
      entry.genders.add(assignment.gender_group);
    });
    Object.entries(byNeighborhood).forEach(([neighborhoodId, entry]) => {
      const genders = [...entry.genders];
      plannedNeighborhoodIntervals.push({
        plan_key: `neighborhood:${neighborhoodId}:${period.id || period.start_date}`,
        source_stay_period_id: period.id || null,
        neighborhood_reservation: {
          group_id: groupId,
          operational_group_profile_id: profileId,
          neighborhood_id: neighborhoodId,
          arrival_date: period.start_date,
          departure_date: period.end_date,
          gender_group: genders.length === 1 ? genders[0] : 'MIXED',
          planned_tents: entry.tentIds.size,
          status: 'ACTIVE',
          source: 'allocation',
        },
      });
    });
  });

  const sameTentPreserved = assignments.every((assignment, index) =>
    plannedRows.filter(row => row.logical_assignment_index === index).every(row => row.sleeping_allocation.tent_id === assignment.tent_id)
  );
  return { valid: true, errors: [], planned_rows: plannedRows, planned_neighborhood_intervals: plannedNeighborhoodIntervals, same_tent_preserved: sameTentPreserved };
}

export function addSleepingPlanConflicts({ plan, existingAllocations = [], existingNeighborhoodReservations = [], sharedNeighborhoodIds = [] }) {
  const exactTentConflicts = [];
  plan.planned_rows.forEach(planned => {
    const row = planned.sleeping_allocation;
    existingAllocations.filter(existing =>
      existing.status !== 'CANCELLED' &&
      existing.group_id !== row.group_id &&
      existing.tent_id === row.tent_id &&
      sleepingIntervalsOverlap(row.arrival_date, row.departure_date, existing.arrival_date, existing.departure_date)
    ).forEach(existing => exactTentConflicts.push({
      plan_key: planned.plan_key,
      tent_id: row.tent_id,
      planned_period: { arrival_date: row.arrival_date, departure_date: row.departure_date },
      conflicting_group_id: existing.group_id,
      conflicting_allocation_id: existing.id,
      conflicting_arrival_date: existing.arrival_date,
      conflicting_departure_date: existing.departure_date,
    }));
  });

  const sharedSet = new Set(sharedNeighborhoodIds);
  const neighborhoodConflicts = [];
  plan.planned_neighborhood_intervals.forEach(planned => {
    const row = planned.neighborhood_reservation;
    existingNeighborhoodReservations.filter(existing =>
      existing.status === 'ACTIVE' &&
      existing.group_id !== row.group_id &&
      existing.neighborhood_id === row.neighborhood_id &&
      sleepingIntervalsOverlap(row.arrival_date, row.departure_date, existing.arrival_date, existing.departure_date)
    ).forEach(existing => neighborhoodConflicts.push({
      plan_key: planned.plan_key,
      neighborhood_id: row.neighborhood_id,
      planned_period: { arrival_date: row.arrival_date, departure_date: row.departure_date },
      conflicting_group_id: existing.group_id,
      conflicting_reservation_id: existing.id,
      conflicting_arrival_date: existing.arrival_date,
      conflicting_departure_date: existing.departure_date,
      shared_neighborhood_allowed: sharedSet.has(row.neighborhood_id),
      blocked: !sharedSet.has(row.neighborhood_id),
    }));
  });

  return {
    ...plan,
    exact_tent_conflicts: exactTentConflicts,
    neighborhood_conflicts: neighborhoodConflicts,
    allowed: exactTentConflicts.length === 0 && !neighborhoodConflicts.some(conflict => conflict.blocked),
    linkage_recommendation: {
      stay_period_id: { recommended: true, reason: 'Dates identify a period today, but date edits or reordered periods would make row-to-period ownership ambiguous.' },
      logical_assignment_series_id: { recommended: true, reason: 'Current tent- and notes-marker readers collapse repeated return rows; a stable series is needed to edit or cancel one logical tent assignment across all periods.' },
    },
  };
}