import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const MANAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const VIEW_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'MAINTENANCE']);
const REASONS = new Set(['PAINTING', 'MAINTENANCE', 'REPAIR', 'SPECIAL_CLEANING', 'TEMPORARILY_CLOSED', 'OTHER']);

function reservationOverlapsBlock(block, date, startTime, endTime) {
  const reservationStart = `${date}T${startTime}`;
  const reservationEnd = `${date}T${endTime}`;
  const blockStart = `${block.start_date}T${block.start_time}`;
  if (block.is_open_ended) return reservationEnd > blockStart;
  const blockEnd = `${block.end_date}T${block.end_time}`;
  return reservationStart < blockEnd && blockStart < reservationEnd;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function findConflicts(base44, input) {
  const [items, requests] = await Promise.all([
    base44.asServiceRole.entities.GroupScheduleItem.filter({ activity_space_id: input.activity_space_id, status: 'ACTIVE' }, '-date', 500),
    base44.asServiceRole.entities.CommonSpaceBookingRequest.filter({ space_id: input.activity_space_id }, '-date', 500),
  ]);
  const conflictEndDate = input.is_open_ended ? '9999-12-31' : input.end_date;
  const activeRequests = requests.filter(r => ['PENDING', 'APPROVED', 'CHANGE_REQUESTED', 'CANCELLATION_REQUESTED'].includes(r.status));
  const matchingItems = items.filter(i => i.date >= input.start_date && i.date <= conflictEndDate && reservationOverlapsBlock(input, i.date, i.start_time, i.end_time));
  const matchingRequests = activeRequests.filter(r => r.date >= input.start_date && r.date <= conflictEndDate && reservationOverlapsBlock(input, r.date, r.start_time, r.end_time));
  const groupIds = [...new Set(matchingItems.map(i => i.group_id))];
  const groups = await Promise.all(groupIds.map(id => base44.asServiceRole.entities.Group.get(id).catch(() => null)));
  const groupMap = Object.fromEntries(groups.filter(Boolean).map(g => [g.id, g.group_name]));
  const syncRows = await Promise.all(matchingItems.map(i => base44.asServiceRole.entities.CalendarSync.filter({ group_schedule_item_id: i.id }).catch(() => [])));
  return [
    ...matchingItems.map((i, index) => ({ type: 'GROUP_ACTIVITY', group_name: groupMap[i.group_id] || '—', activity_name: i.activity_name, date: i.date, start_time: i.start_time, end_time: i.end_time, space_name: input.activity_space_name, group_schedule_item_id: i.id, calendar_sync_id: syncRows[index]?.[0]?.id || null })),
    ...matchingRequests.map(r => ({ type: 'BOOKING_REQUEST', request_status: r.status, group_name: r.requested_by_name || r.requested_by_email || '—', activity_name: r.activity_title, date: r.date, start_time: r.start_time, end_time: r.end_time, space_name: r.space_name || input.activity_space_name, common_space_booking_request_id: r.id, group_schedule_item_id: r.approved_schedule_item_id || null })),
  ];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'לא מחובר' }, { status: 401 });
    const internalRows = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const role = internalRows[0]?.role || user.role;
    const body = await req.json();
    const action = body.action;
    if (action === 'list_conflicts') {
      if (!VIEW_ROLES.has(role)) return Response.json({ success: false, error: 'אין הרשאה לצפות בחסימות' }, { status: 403 });
      return Response.json({ success: true, conflicts: await findConflicts(base44, body.block) });
    }
    if (!MANAGE_ROLES.has(role)) return Response.json({ success: false, error: 'אין הרשאה לנהל חסימות' }, { status: 403 });
    if (action === 'cancel') {
      const existing = await base44.asServiceRole.entities.ActivitySpaceBlock.get(body.id);
      if (!existing) return Response.json({ success: false, error: 'החסימה לא נמצאה' }, { status: 404 });
      const resolvedAt = new Date().toISOString();
      const block = await base44.asServiceRole.entities.ActivitySpaceBlock.update(body.id, {
        status: 'CANCELLED', cancelled_by: user.email, cancelled_at: resolvedAt,
        resolved_by: user.email, resolved_at: resolvedAt, resolution_notes: body.resolution_notes || ''
      });
      return Response.json({ success: true, block });
    }
    if (!['preview', 'save'].includes(action)) return Response.json({ success: false, error: 'פעולה לא תקינה' }, { status: 400 });
    const input = body.block || {};
    const isOpenEnded = input.is_open_ended === true;
    if (!input.activity_space_id || !input.start_date || !input.start_time || !REASONS.has(input.reason_type)) return Response.json({ success: false, error: 'חסרים פרטי חסימה' }, { status: 400 });
    if (!isOpenEnded && (!input.end_date || !input.end_time)) return Response.json({ success: false, error: 'יש להזין תאריך ושעת סיום' }, { status: 400 });
    if (!isOpenEnded && `${input.start_date}T${input.start_time}` >= `${input.end_date}T${input.end_time}`) return Response.json({ success: false, error: 'טווח התאריכים או השעות אינו תקין' }, { status: 400 });
    const space = await base44.asServiceRole.entities.ActivitySpace.get(input.activity_space_id).catch(() => null);
    if (!space) return Response.json({ success: false, error: 'המרחב לא נמצא' }, { status: 404 });
    const payload = { activity_space_id: space.id, activity_space_name: space.name, start_date: input.start_date, end_date: isOpenEnded ? null : input.end_date, start_time: input.start_time, end_time: isOpenEnded ? null : input.end_time, is_open_ended: isOpenEnded, reason_type: input.reason_type, reason_notes: input.reason_notes || '', status: 'ACTIVE', created_from_maintenance_issue_id: input.created_from_maintenance_issue_id || null };
    const conflicts = await findConflicts(base44, payload);
    if (action === 'preview') return Response.json({ success: true, conflicts });
    if (conflicts.length > 0 && !body.confirm_conflicts) return Response.json({ success: false, needs_confirmation: true, error: 'קיימות פעילויות קיימות בטווח החסימה', conflicts }, { status: 409 });
    const saved = body.id
      ? await base44.asServiceRole.entities.ActivitySpaceBlock.update(body.id, { ...payload, conflict_acknowledged: conflicts.length > 0 })
      : await base44.asServiceRole.entities.ActivitySpaceBlock.create({ ...payload, created_by: user.email, conflict_acknowledged: conflicts.length > 0 });
    return Response.json({ success: true, block: saved, conflicts });
  } catch (error) {
    return Response.json({ success: false, error: error.message || 'שגיאה בניהול החסימה' }, { status: 500 });
  }
});