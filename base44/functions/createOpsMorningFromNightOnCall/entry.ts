import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const addDays = (date, days) => {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const getWeekStartUTC = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};

const SOURCE = 'NIGHT_ON_CALL_TO_OPERATIONS_MORNING';
const OPS_MORNING = { row_type: 'OPERATIONS_MORNING', row_label: 'תפעול בוקר', row_order: 1, start_time: '07:00', end_time: '16:00' };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const callerEmail = normalizeEmail(authUser.email);
    const internalUsers = await base44.asServiceRole.entities.InternalUser.list('-created_date', 500);
    const caller = internalUsers.find((item) => normalizeEmail(item.email) === callerEmail && item.active !== false);
    if (!caller || !['SUPER_ADMIN', 'ADMIN'].includes(caller.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const force = body.force === true;
    const night = await base44.asServiceRole.entities.WorkShift.get(body.night_shift_id);
    if (!night) return Response.json({ error: 'המשמרת לא נמצאה' }, { status: 404 });
    if (night.row_type !== 'NIGHT_ON_CALL') {
      return Response.json({ error: 'ניתן לשבץ תפעול בוקר רק ממשמרת כונן לילה' }, { status: 400 });
    }
    if (!night.worker_id) {
      return Response.json({ error: 'כונן הלילה אינו משויך לעובד' }, { status: 400 });
    }

    const nextDay = addDays(night.date, 1);
    const nightWeek = getWeekStartUTC(night.date);
    const nextWeek = getWeekStartUTC(nextDay);

    // Determine target schedule (same week or next week)
    let targetScheduleId = night.work_schedule_id;
    if (nextWeek !== nightWeek) {
      const nextSchedules = await base44.asServiceRole.entities.WorkSchedule.filter({ week_start_date: nextWeek });
      const nextSchedule = nextSchedules[0];
      if (!nextSchedule) {
        return Response.json({
          status: 'next_week_missing',
          message: 'תפעול בוקר למחרת נמצא בשבוע הבא. יש ליצור אותו בסידור העבודה של השבוע הבא.',
        });
      }
      targetScheduleId = nextSchedule.id;
    }

    // Load existing shifts of target schedule
    const targetShifts = await base44.asServiceRole.entities.WorkShift.filter({ work_schedule_id: targetScheduleId }, 'date', 500);

    // Duplicate check — same worker, OPERATIONS_MORNING, next day, 07:00–16:00, not cancelled
    const duplicate = targetShifts.some((s) =>
      s.status !== 'CANCELLED' &&
      s.date === nextDay &&
      s.row_type === OPS_MORNING.row_type &&
      String(s.worker_id || '') === String(night.worker_id || '') &&
      String(s.start_time || '') === OPS_MORNING.start_time &&
      String(s.end_time || '') === OPS_MORNING.end_time
    );
    if (duplicate) {
      return Response.json({
        status: 'duplicate',
        message: 'כבר קיימת משמרת תפעול בוקר למחרת לעובד הזה',
      });
    }

    // Other worker already assigned to OPERATIONS_MORNING next day
    const otherWorkers = targetShifts.filter((s) =>
      s.status !== 'CANCELLED' &&
      s.date === nextDay &&
      s.row_type === OPS_MORNING.row_type &&
      String(s.worker_id || '') !== String(night.worker_id || '')
    ).map((s) => s.worker_name).filter(Boolean);

    // Worker requests — DAY_OFF / UNAVAILABLE for next day, PENDING or APPROVED
    const workerRequests = await base44.asServiceRole.entities.WorkScheduleRequest.filter({
      worker_profile_id: night.worker_id,
    }, '-created_date', 200);
    const conflictingRequests = workerRequests.filter((r) => {
      if (!['DAY_OFF', 'UNAVAILABLE'].includes(r.request_type)) return false;
      if (!['PENDING', 'APPROVED'].includes(r.status)) return false;
      const start = r.start_date || r.date || '';
      const end = r.end_date || start;
      return start <= nextDay && end >= nextDay;
    });

    if (!force && (otherWorkers.length > 0 || conflictingRequests.length > 0)) {
      return Response.json({
        status: 'warning',
        other_workers: otherWorkers,
        requests: conflictingRequests.map((r) => ({
          request_type: r.request_type,
          status: r.status,
          message: r.message || '',
        })),
        message: 'יש לאשר למרות ההתראות',
      });
    }

    await base44.asServiceRole.entities.WorkShift.create({
      work_schedule_id: targetScheduleId,
      date: nextDay,
      row_type: OPS_MORNING.row_type,
      row_label: OPS_MORNING.row_label,
      row_order: OPS_MORNING.row_order,
      worker_id: night.worker_id,
      worker_name: night.worker_name || '',
      start_time: OPS_MORNING.start_time,
      end_time: OPS_MORNING.end_time,
      notes: 'נוצר מכונן לילה',
      status: 'PLANNED',
      linked_source_shift_id: night.id,
      auto_created_from: SOURCE,
      created_by: callerEmail,
      updated_by: callerEmail,
    });

    return Response.json({
      status: 'created',
      date: nextDay,
      worker_name: night.worker_name || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});