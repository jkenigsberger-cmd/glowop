import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const normalize = (value) => String(value || '').trim().toLowerCase();
const ALLOWED_FIELDS = new Set([
  'auto_summary_json', 'manual_general_notes', 'manual_logistics_tasks', 'manual_housekeeping_tasks',
  'manual_maintenance_tasks', 'manual_duty_students_notes', 'manual_meals_notes',
  'manual_activity_spaces_notes', 'manual_final_notes', 'generated_message', 'status',
  'last_generated_at', 'last_copied_at',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const email = normalize(authUser.email);
    const users = await base44.asServiceRole.entities.InternalUser.list('-created_date', 500);
    const caller = users.find((item) => normalize(item.email) === email && item.active !== false);
    if (!caller || !['SUPER_ADMIN', 'ADMIN'].includes(caller.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    if (!body.date) return Response.json({ error: 'Missing date' }, { status: 400 });
    const existing = body.brief_id ? await base44.asServiceRole.entities.DailyStaffBrief.get(body.brief_id) :
      (await base44.asServiceRole.entities.DailyStaffBrief.filter({ date: body.date }))[0];
    if (body.action === 'get') return Response.json({ brief: existing || null });
    if (body.action !== 'save') return Response.json({ error: 'Unsupported action' }, { status: 400 });
    const payload = {};
    for (const [key, value] of Object.entries(body.payload || {})) if (ALLOWED_FIELDS.has(key)) payload[key] = value;
    payload.updated_by = email;
    const brief = existing
      ? await base44.asServiceRole.entities.DailyStaffBrief.update(existing.id, payload)
      : await base44.asServiceRole.entities.DailyStaffBrief.create({ date: body.date, status: payload.status || 'DRAFT', created_by: email, ...payload });
    return Response.json({ brief });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});