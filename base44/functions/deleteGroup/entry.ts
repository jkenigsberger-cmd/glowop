import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { group_id } = await req.json();
  if (!group_id) return Response.json({ error: 'group_id required' }, { status: 400 });

  // Delete all related records in parallel
  const [quotes, submissions, profiles, holds, allocations] = await Promise.all([
    base44.asServiceRole.entities.Quote.filter({ group_id }),
    base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id }),
    base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id }),
    base44.asServiceRole.entities.OperationalHold.filter({ group_id }),
    base44.asServiceRole.entities.SleepingAllocation.filter({ group_id }),
  ]);

  await Promise.all([
    ...quotes.map(r => base44.asServiceRole.entities.Quote.delete(r.id)),
    ...submissions.map(r => base44.asServiceRole.entities.GuestFormSubmission.delete(r.id)),
    ...profiles.map(r => base44.asServiceRole.entities.OperationalGroupProfile.delete(r.id)),
    ...holds.map(r => base44.asServiceRole.entities.OperationalHold.delete(r.id)),
    ...allocations.map(r => base44.asServiceRole.entities.SleepingAllocation.delete(r.id)),
  ]);

  await base44.asServiceRole.entities.Group.delete(group_id);

  return Response.json({ success: true });
});