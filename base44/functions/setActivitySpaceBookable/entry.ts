import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const todayIL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    if (!ALLOWED_ROLES.includes(internalUsers[0]?.role)) {
      return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const { space_id, is_bookable, confirm_future_approved = false } = await req.json();
    if (!space_id || typeof is_bookable !== 'boolean') {
      return Response.json({ success: false, error: 'INVALID_REQUEST' }, { status: 400 });
    }

    const space = await base44.asServiceRole.entities.ActivitySpace.get(space_id).catch(() => null);
    if (!space) return Response.json({ success: false, error: 'SPACE_NOT_FOUND' }, { status: 404 });

    if (!is_bookable) {
      const approved = await base44.asServiceRole.entities.CommonSpaceBookingRequest.filter({
        space_id,
        status: 'APPROVED',
        date: { $gte: todayIL() },
      });
      if (approved.length > 0 && !confirm_future_approved) {
        return Response.json({ success: false, requires_confirmation: true, future_approved_count: approved.length });
      }
    }

    const updated = await base44.asServiceRole.entities.ActivitySpace.update(space_id, { is_bookable });
    return Response.json({ success: true, space: { id: updated.id, is_bookable: updated.is_bookable } });
  } catch (error) {
    return Response.json({ success: false, error: error?.message || 'UPDATE_FAILED' }, { status: 500 });
  }
}