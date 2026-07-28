import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { STANDALONE_ADMIN_ROLES, resolveStandaloneUser, syncStandaloneCalendar } from '../../shared/standaloneActivity.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await resolveStandaloneUser(base44, user, STANDALONE_ADMIN_ROLES);
    if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    if (!body.id) return Response.json({ error: 'MISSING_ID' }, { status: 400 });
    const reservation = await base44.asServiceRole.entities.StandaloneActivityReservation.get(body.id);
    const assignments = await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.filter({ reservation_id: reservation.id });
    const updated = await base44.asServiceRole.entities.StandaloneActivityReservation.update(reservation.id, { status: 'CANCELLED', cancellation_reason: String(body.reason || '').trim(), cancelled_by: actor.email, cancelled_at: new Date().toISOString(), updated_by: actor.email });
    await syncStandaloneCalendar(base44, updated, assignments, true).catch(() => null);
    return Response.json({ success: true, reservation: updated, assignments });
  } catch (error) {
    return Response.json({ error: error.message || 'CANCEL_FAILED' }, { status: 500 });
  }
}