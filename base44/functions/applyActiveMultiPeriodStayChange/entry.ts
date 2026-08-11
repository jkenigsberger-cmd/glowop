import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { analyzeActiveMultiPeriodStayChange, authorizeActiveStayAdmin } from '../../shared/activeMultiPeriodStayChange.js';

const PERIOD_FIELDS = ['group_id', 'start_date', 'end_date', 'arrival_time', 'departure_time', 'status', 'notes'];
const ALLOCATION_FIELDS = ['stay_period_id', 'arrival_date', 'departure_date', 'status'];
const RESERVATION_FIELDS = ['stay_period_id', 'arrival_date', 'departure_date', 'gender_group', 'planned_tents', 'status'];
function pick(record, fields) { return Object.fromEntries(fields.filter(field => record?.[field] !== undefined).map(field => [field, record[field]])); }
function collection(base44, name) { return base44.asServiceRole.entities[name]; }

async function rollback(base44, updated, created) {
  const errors = [];
  for (const item of [...updated].reverse()) {
    try { await collection(base44, item.entity).update(item.id, item.snapshot); }
    catch (error) { errors.push({ entity: item.entity, id: item.id, error: error.message }); }
  }
  for (const item of [...created].reverse()) {
    try { await collection(base44, item.entity).delete(item.id); }
    catch (error) { errors.push({ entity: item.entity, id: item.id, error: error.message }); }
  }
  return { attempted: updated.length + created.length, complete: errors.length === 0, errors };
}

export default async function(req) {
  const updated = [];
  const created = [];
  let base44;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!await authorizeActiveStayAdmin(base44, user)) return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    const { group_id, periods, confirmed } = await req.json().catch(() => ({}));
    if (!group_id || !Array.isArray(periods) || confirmed !== true) return Response.json({ success: false, error: 'EXPLICIT_CONFIRMATION_REQUIRED' }, { status: 400 });

    const { result, plan } = await analyzeActiveMultiPeriodStayChange(base44, group_id, periods);
    if (!result.allowed) return Response.json({ success: false, error: 'CHANGE_BLOCKED_AFTER_FRESH_PREVIEW', preview: result }, { status: 409 });

    const periodIdByKey = new Map(plan.proposed.filter(period => period.id).map(period => [period.period_key, period.id]));
    for (const item of plan.periodUpdates) {
      const current = plan.currentPeriods.find(period => period.id === item.id);
      updated.push({ entity: 'GroupStayPeriod', id: item.id, snapshot: pick(current, PERIOD_FIELDS) });
      await base44.asServiceRole.entities.GroupStayPeriod.update(item.id, { start_date: item.period.start_date, end_date: item.period.end_date, arrival_time: item.period.arrival_time || null, departure_time: item.period.departure_time || null, notes: item.period.notes || null, status: 'ACTIVE' });
    }
    for (const period of plan.periodCreates) {
      const row = await base44.asServiceRole.entities.GroupStayPeriod.create({ group_id, start_date: period.start_date, end_date: period.end_date, arrival_time: period.arrival_time || null, departure_time: period.departure_time || null, notes: period.notes || null, status: 'ACTIVE' });
      created.push({ entity: 'GroupStayPeriod', id: row.id });
      periodIdByKey.set(period.period_key, row.id);
    }
    for (const period of plan.periodCancels) {
      updated.push({ entity: 'GroupStayPeriod', id: period.id, snapshot: pick(period, PERIOD_FIELDS) });
      await base44.asServiceRole.entities.GroupStayPeriod.update(period.id, { status: 'CANCELLED' });
    }

    for (const item of plan.allocationUpdates) {
      const current = plan.allAllocations.find(row => row.id === item.id);
      updated.push({ entity: 'SleepingAllocation', id: item.id, snapshot: pick(current, ALLOCATION_FIELDS) });
      await base44.asServiceRole.entities.SleepingAllocation.update(item.id, { stay_period_id: periodIdByKey.get(item.period_key), arrival_date: item.arrival_date, departure_date: item.departure_date });
    }
    for (const item of plan.allocationCreates) {
      const row = await base44.asServiceRole.entities.SleepingAllocation.create({ ...item.template, stay_period_id: periodIdByKey.get(item.period_key) });
      created.push({ entity: 'SleepingAllocation', id: row.id });
    }
    for (const item of plan.allocationCancels) {
      const current = plan.allAllocations.find(row => row.id === item.id);
      updated.push({ entity: 'SleepingAllocation', id: item.id, snapshot: pick(current, ALLOCATION_FIELDS) });
      await base44.asServiceRole.entities.SleepingAllocation.update(item.id, { status: 'CANCELLED' });
    }

    for (const item of plan.reservationUpdates) {
      const current = plan.allReservations.find(row => row.id === item.id);
      updated.push({ entity: 'NeighborhoodReservation', id: item.id, snapshot: pick(current, RESERVATION_FIELDS) });
      await base44.asServiceRole.entities.NeighborhoodReservation.update(item.id, { stay_period_id: periodIdByKey.get(item.period_key), arrival_date: item.arrival_date, departure_date: item.departure_date, gender_group: item.gender_group, planned_tents: item.planned_tents });
    }
    for (const item of plan.reservationCreates) {
      const row = await base44.asServiceRole.entities.NeighborhoodReservation.create({ ...item.template, stay_period_id: periodIdByKey.get(item.period_key) });
      created.push({ entity: 'NeighborhoodReservation', id: row.id });
    }
    for (const item of plan.reservationCancels) {
      const current = plan.allReservations.find(row => row.id === item.id);
      updated.push({ entity: 'NeighborhoodReservation', id: item.id, snapshot: pick(current, RESERVATION_FIELDS) });
      await base44.asServiceRole.entities.NeighborhoodReservation.update(item.id, { status: 'CANCELLED' });
    }

    for (const meal of plan.mealCancellations) {
      updated.push({ entity: 'MealReservation', id: meal.id, snapshot: { status: meal.status } });
      await base44.asServiceRole.entities.MealReservation.update(meal.id, { status: 'CANCELLED' });
    }
    updated.push({ entity: 'Group', id: plan.group.id, snapshot: { arrival_date: plan.group.arrival_date, departure_date: plan.group.departure_date, arrival_time: plan.group.arrival_time || null, departure_time: plan.group.departure_time || null } });
    const first = plan.proposed[0];
    const last = plan.proposed[plan.proposed.length - 1];
    await base44.asServiceRole.entities.Group.update(plan.group.id, { arrival_date: plan.envelope.start_date, departure_date: plan.envelope.end_date, arrival_time: first.arrival_time || null, departure_time: last.departure_time || null });

    const [periodsAfter, allocationsAfter] = await Promise.all([
      base44.asServiceRole.entities.GroupStayPeriod.filter({ group_id, status: 'ACTIVE' }, 'start_date', 100),
      base44.asServiceRole.entities.SleepingAllocation.filter({ group_id, status: { $in: ['DRAFT', 'CONFIRMED'] } }),
    ]);
    const expectedPhysicalRows = result.sleeping_impact.logical_series_count * periodsAfter.length;
    if (allocationsAfter.length !== expectedPhysicalRows) throw new Error('POST_APPLY_SLEEPING_SERIES_INTEGRITY_FAILED');

    return Response.json({ success: true, applied: true, group_id, periods: periodsAfter, summary: { periods_created: plan.periodCreates.length, periods_updated: plan.periodUpdates.length, periods_cancelled: plan.periodCancels.length, sleeping_rows_created: plan.allocationCreates.length, sleeping_rows_updated: plan.allocationUpdates.length, sleeping_rows_cancelled: plan.allocationCancels.length, neighborhood_rows_created: plan.reservationCreates.length, neighborhood_rows_updated: plan.reservationUpdates.length, neighborhood_rows_cancelled: plan.reservationCancels.length, meals_cancelled: plan.mealCancellations.length }, rollback: { needed: false, complete: true } });
  } catch (error) {
    const cleanup = base44 ? await rollback(base44, updated, created) : { attempted: 0, complete: true, errors: [] };
    return Response.json({ success: false, error: cleanup.complete ? 'APPLY_FAILED_ROLLED_BACK' : 'PARTIAL_FAILURE_ROLLBACK_INCOMPLETE', message: error.message, cleanup }, { status: 500 });
  }
}