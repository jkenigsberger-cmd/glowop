import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addSleepingPlanConflicts, buildMultiPeriodSleepingPlan, validateSleepingAssignments } from '../../shared/multiPeriodSleepingPlan.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const body = await req.json();
    const groupId = body?.group_id;
    const assignments = body?.assignments;
    if (!groupId) return Response.json({ success: false, error: 'GROUP_ID_REQUIRED' }, { status: 400 });

    const group = await base44.asServiceRole.entities.Group.get(groupId).catch(() => null);
    if (!group) return Response.json({ success: false, error: 'GROUP_NOT_FOUND' }, { status: 404 });
    if (group.stay_mode !== 'MULTI_PERIOD') return Response.json({ success: false, error: 'GROUP_NOT_MULTI_PERIOD' }, { status: 409 });

    const [profiles, periods, tents, existingAllocations, neighborhoodReservations] = await Promise.all([
      base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: groupId }),
      base44.asServiceRole.entities.GroupStayPeriod.filter({ group_id: groupId, status: 'ACTIVE' }, 'start_date', 100),
      base44.asServiceRole.entities.Tent.list(),
      base44.asServiceRole.entities.SleepingAllocation.filter({ status: { $in: ['DRAFT', 'CONFIRMED'] } }),
      base44.asServiceRole.entities.NeighborhoodReservation.filter({ status: 'ACTIVE' }),
    ]);
    if (profiles.length !== 1) return Response.json({ success: false, error: 'EXACTLY_ONE_OGP_REQUIRED', profile_count: profiles.length }, { status: 409 });

    const assignmentErrors = validateSleepingAssignments(assignments, tents);
    if (assignmentErrors.length > 0) return Response.json({ success: false, error: 'INVALID_ASSIGNMENTS', errors: assignmentErrors }, { status: 400 });

    const plan = buildMultiPeriodSleepingPlan({ groupId, profileId: profiles[0].id, periods, assignments });
    if (!plan.valid) return Response.json({ success: false, error: 'INVALID_ACTIVE_PERIODS', errors: plan.errors }, { status: 409 });

    const sharedNeighborhoodIds = neighborhoodReservations
      .filter(reservation => reservation.group_id === groupId && reservation.shared_neighborhood_allowed === true)
      .map(reservation => reservation.neighborhood_id);
    const preview = addSleepingPlanConflicts({ plan, existingAllocations, existingNeighborhoodReservations: neighborhoodReservations, sharedNeighborhoodIds });
    return Response.json({ success: true, read_only: true, group_id: groupId, operational_group_profile_id: profiles[0].id, ...preview });
  } catch (error) {
    return Response.json({ success: false, error: error?.message || 'PREVIEW_FAILED' }, { status: 500 });
  }
}