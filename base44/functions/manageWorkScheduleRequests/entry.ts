import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const normalize = (value) => String(value || '').trim().toLowerCase();
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const TYPES = new Set(['DAY_OFF', 'UNAVAILABLE', 'PREFERRED_SHIFT', 'SHIFT_CHANGE', 'GENERAL_NOTE']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const email = normalize(authUser.email);
    const users = await base44.asServiceRole.entities.InternalUser.list('-created_date', 500);
    const internalUser = users.find((item) => normalize(item.email) === email && item.active !== false) || null;
    const body = await req.json();
    const isAdmin = ADMIN_ROLES.has(internalUser?.role);

    if (body.action === 'admin_list' || body.action === 'admin_update' || body.action === 'pending_count') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (body.action === 'admin_list' || body.action === 'pending_count') {
        const requests = await base44.asServiceRole.entities.WorkScheduleRequest.list('-created_date', 500);
        if (body.action === 'pending_count') return Response.json({ pending_count: requests.filter((item) => item.status === 'PENDING').length });
        return Response.json({ requests });
      }
      const request = await base44.asServiceRole.entities.WorkScheduleRequest.get(body.request_id);
      if (!request) return Response.json({ error: 'הבקשה לא נמצאה' }, { status: 404 });
      const statuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
      if (!statuses.has(body.status)) return Response.json({ error: 'סטטוס לא תקין' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.WorkScheduleRequest.update(request.id, {
        status: body.status, admin_response: String(body.admin_response || ''),
        reviewed_by: email, reviewed_at: new Date().toISOString(), updated_by: email,
      });
      return Response.json({ request: updated });
    }

    const profiles = await base44.asServiceRole.entities.WorkerProfile.list('full_name', 500);
    const profile = profiles.find((item) => internalUser?.id && item.internal_user_id === internalUser.id) ||
      profiles.find((item) => normalize(item.internal_user_email) === email) || null;
    if (!profile) return Response.json({ error: 'לא נמצא פרופיל עובד מקושר למשתמש שלך' }, { status: 404 });

    if (body.action === 'mine') {
      const allRequests = await base44.asServiceRole.entities.WorkScheduleRequest.list('-created_date', 500);
      const requests = allRequests.filter((item) => item.worker_profile_id === profile.id || item.worker_id === profile.id);
      return Response.json({ requests, profile });
    }
    if (body.action === 'create') {
      const data = body.request || {};
      if (!TYPES.has(data.request_type)) return Response.json({ error: 'סוג בקשה לא תקין' }, { status: 400 });
      if (!String(data.message || '').trim()) return Response.json({ error: 'הודעה היא שדה חובה' }, { status: 400 });
      if (data.request_type !== 'GENERAL_NOTE' && !(data.start_date || data.date)) return Response.json({ error: 'יש לבחור תאריך' }, { status: 400 });
      if (data.start_date && data.end_date && data.end_date < data.start_date) return Response.json({ error: 'טווח התאריכים אינו תקין' }, { status: 400 });
      if (data.related_shift_id) {
        const shift = await base44.asServiceRole.entities.WorkShift.get(data.related_shift_id);
        if (!shift || shift.worker_id !== profile.id) return Response.json({ error: 'משמרת לא תקינה' }, { status: 400 });
      }
      const created = await base44.asServiceRole.entities.WorkScheduleRequest.create({
        worker_profile_id: profile.id, worker_name: profile.full_name,
        internal_user_id: internalUser?.id || '', internal_user_email: email,
        request_type: data.request_type,
        ...(data.date ? { date: data.date } : {}), ...(data.start_date ? { start_date: data.start_date } : {}),
        ...(data.end_date ? { end_date: data.end_date } : {}), start_time: data.start_time || '', end_time: data.end_time || '',
        related_shift_id: data.related_shift_id || '', title: String(data.title || ''), message: String(data.message).trim(),
        status: 'PENDING', created_by: email, updated_by: email,
      });
      return Response.json({ request: created });
    }
    if (body.action === 'cancel') {
      const request = await base44.asServiceRole.entities.WorkScheduleRequest.get(body.request_id);
      if (!request || (request.worker_profile_id !== profile.id && request.worker_id !== profile.id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (request.status !== 'PENDING') return Response.json({ error: 'ניתן לבטל רק בקשה ממתינה' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.WorkScheduleRequest.update(request.id, { status: 'CANCELLED', updated_by: email });
      return Response.json({ request: updated });
    }
    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});