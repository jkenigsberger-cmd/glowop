/**
 * Finds and deletes orphaned operational records whose group_id
 * no longer references an existing Group.
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let user;
  try {
    user = await base44.auth.me();
  } catch (e) {
    return Response.json({ error: 'הפעולה נכשלה. יש להתחבר מחדש או לבדוק הרשאות.', detail: e?.message }, { status: 401 });
  }

  if (!user) {
    return Response.json({ error: 'הפעולה נכשלה. יש להתחבר מחדש או לבדוק הרשאות.' }, { status: 401 });
  }

  const role = (user.role || '').toLowerCase();
  if (role !== 'admin') {
    return Response.json({ error: 'אין הרשאה לבצע פעולה זו' }, { status: 403 });
  }

  // Load all existing group IDs
  const allGroups = await base44.asServiceRole.entities.Group.list();
  const validGroupIds = new Set(allGroups.map(g => g.id));

  const isOrphan = (r) => r.group_id && !validGroupIds.has(r.group_id);

  // Fetch all operational records in parallel
  const [
    scheduleItems,
    mealReservations,
    neighborhoodReservations,
    allocations,
    holds,
    profiles,
    submissions,
    quotes,
  ] = await Promise.all([
    base44.asServiceRole.entities.GroupScheduleItem.list(),
    base44.asServiceRole.entities.MealReservation.list(),
    base44.asServiceRole.entities.NeighborhoodReservation.list(),
    base44.asServiceRole.entities.SleepingAllocation.list(),
    base44.asServiceRole.entities.OperationalHold.list(),
    base44.asServiceRole.entities.OperationalGroupProfile.list(),
    base44.asServiceRole.entities.GuestFormSubmission.list(),
    base44.asServiceRole.entities.Quote.list(),
  ]);

  const orphans = {
    scheduleItems:            scheduleItems.filter(isOrphan),
    mealReservations:         mealReservations.filter(isOrphan),
    neighborhoodReservations: neighborhoodReservations.filter(isOrphan),
    allocations:              allocations.filter(isOrphan),
    holds:                    holds.filter(isOrphan),
    profiles:                 profiles.filter(isOrphan),
    submissions:              submissions.filter(isOrphan),
    quotes:                   quotes.filter(isOrphan),
  };

  const totals = Object.fromEntries(
    Object.entries(orphans).map(([k, v]) => [k, v.length])
  );

  // Dry-run mode: just return counts without deleting
  const body = await req.json().catch(() => ({}));
  if (body.dry_run) {
    return Response.json({ dry_run: true, orphans: totals });
  }

  // Delete all orphans in parallel
  await Promise.all([
    ...orphans.scheduleItems.map(r => base44.asServiceRole.entities.GroupScheduleItem.delete(r.id)),
    ...orphans.mealReservations.map(r => base44.asServiceRole.entities.MealReservation.delete(r.id)),
    ...orphans.neighborhoodReservations.map(r => base44.asServiceRole.entities.NeighborhoodReservation.delete(r.id)),
    ...orphans.allocations.map(r => base44.asServiceRole.entities.SleepingAllocation.delete(r.id)),
    ...orphans.holds.map(r => base44.asServiceRole.entities.OperationalHold.delete(r.id)),
    ...orphans.profiles.map(r => base44.asServiceRole.entities.OperationalGroupProfile.delete(r.id)),
    ...orphans.submissions.map(r => base44.asServiceRole.entities.GuestFormSubmission.delete(r.id)),
    ...orphans.quotes.map(r => base44.asServiceRole.entities.Quote.delete(r.id)),
  ]);

  return Response.json({ success: true, deleted: totals });
});