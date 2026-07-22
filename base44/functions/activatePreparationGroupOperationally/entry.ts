import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureExactlyOneOperationalProfile } from '../../shared/operationalProfile.js';

const ALLOWED_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL', 'CONFIRMED']);

Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const internal = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const role = internal[0]?.role || user.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });

    const { group_id } = await req.json().catch(() => ({}));
    if (!group_id) return Response.json({ success: false, error: 'MISSING_GROUP_ID' }, { status: 400 });
    const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
    const group = groups[0];
    if (!group) return Response.json({ success: false, error: 'GROUP_NOT_FOUND' }, { status: 404 });
    if (!group.quote_preparation_flow) return Response.json({ success: false, error: 'GROUP_NOT_IN_PREPARATION_FLOW' }, { status: 409 });
    if (!ALLOWED_STATUSES.has(group.status)) return Response.json({ success: false, error: 'GROUP_STATUS_NOT_ALLOWED_FOR_OPERATIONAL_ACTIVATION' }, { status: 409 });

    const { profile } = await ensureExactlyOneOperationalProfile(base44, group);
    const alreadyActive = group.status === 'CONFIRMED';
    const updatedGroup = alreadyActive ? group : await base44.asServiceRole.entities.Group.update(group.id, { status: 'CONFIRMED' });
    const quotes = await base44.asServiceRole.entities.Quote.filter({ group_id: group.id, preparation_flow_enabled: true }, '-updated_date', 1);

    return Response.json({ success: true, status: alreadyActive ? 'already_active' : 'activated', group: updatedGroup, profile, quote: quotes[0] || null });
  } catch (error) {
    console.error('[activatePreparationGroupOperationally]', error?.code || error?.message);
    return Response.json({ success: false, error: error?.code || 'INTERNAL_ERROR', profile_ids: error?.profile_ids }, { status: error?.code ? 409 : 500 });
  }
});