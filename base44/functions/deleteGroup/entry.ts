import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { group_id } = await req.json();
  if (!group_id) return Response.json({ error: 'group_id required' }, { status: 400 });

  // Verify group exists
  const allGroups = await base44.asServiceRole.entities.Group.list();
  if (!allGroups.some(g => g.id === group_id)) {
    return Response.json({ error: 'Group not found' }, { status: 404 });
  }

  // Fetch all related records in parallel
  const [
    quotes,
    submissions,
    profiles,
    holds,
    allocations,
    scheduleItems,
    mealReservations,
    neighborhoodReservations,
  ] = await Promise.all([
    base44.asServiceRole.entities.Quote.filter({ group_id }),
    base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id }),
    base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id }),
    base44.asServiceRole.entities.OperationalHold.filter({ group_id }),
    base44.asServiceRole.entities.SleepingAllocation.filter({ group_id }),
    base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id }),
    base44.asServiceRole.entities.MealReservation.filter({ group_id }),
    base44.asServiceRole.entities.NeighborhoodReservation.filter({ group_id }),
  ]);

  // Delete / cancel all related records in parallel
  await Promise.all([
    ...quotes.map(r => base44.asServiceRole.entities.Quote.delete(r.id)),
    ...submissions.map(r => base44.asServiceRole.entities.GuestFormSubmission.delete(r.id)),
    ...profiles.map(r => base44.asServiceRole.entities.OperationalGroupProfile.delete(r.id)),
    ...holds.map(r => base44.asServiceRole.entities.OperationalHold.delete(r.id)),
    ...allocations.map(r => base44.asServiceRole.entities.SleepingAllocation.delete(r.id)),
    ...scheduleItems.map(r => base44.asServiceRole.entities.GroupScheduleItem.delete(r.id)),
    ...mealReservations.map(r => base44.asServiceRole.entities.MealReservation.delete(r.id)),
    ...neighborhoodReservations.map(r => base44.asServiceRole.entities.NeighborhoodReservation.delete(r.id)),
  ]);

  // Delete the group last
  await base44.asServiceRole.entities.Group.delete(group_id);

  return Response.json({
    success: true,
    deleted: {
      quotes: quotes.length,
      submissions: submissions.length,
      profiles: profiles.length,
      holds: holds.length,
      allocations: allocations.length,
      scheduleItems: scheduleItems.length,
      mealReservations: mealReservations.length,
      neighborhoodReservations: neighborhoodReservations.length,
    },
  });
});