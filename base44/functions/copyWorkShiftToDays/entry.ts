import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const addDays = (date, days) => {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

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
    const source = await base44.asServiceRole.entities.WorkShift.get(body.shift_id);
    if (!source) return Response.json({ error: 'המשמרת לא נמצאה' }, { status: 404 });
    if (source.auto_created_from === 'OPERATIONS_EVENING_TO_NIGHT_ON_CALL') {
      return Response.json({ error: 'לא ניתן להעתיק כונן לילה אוטומטי ישירות. יש להעתיק את משמרת תפעול ערב או ליצור ידנית.' }, { status: 400 });
    }

    const countBased = ['HOUSEKEEPING_MORNING', 'HOUSEKEEPING_EVENING'].includes(source.row_type);
    if (!countBased && !source.worker_id) return Response.json({ error: 'עובד הוא שדה חובה במשמרת רגילה' }, { status: 400 });
    if (countBased && Number(source.worker_count || 0) < 1) return Response.json({ error: 'כמות מנקות אינה תקינה' }, { status: 400 });

    const schedules = await base44.asServiceRole.entities.WorkSchedule.filter({ id: source.work_schedule_id });
    const schedule = schedules[0];
    if (!schedule) return Response.json({ error: 'סידור העבודה לא נמצא' }, { status: 404 });
    const weekDates = new Set(Array.from({ length: 7 }, (_, index) => addDays(schedule.week_start_date, index)));
    const targetDates = [...new Set(Array.isArray(body.target_dates) ? body.target_dates : [])]
      .filter((date) => date !== source.date && weekDates.has(date));
    if (!targetDates.length) return Response.json({ error: 'יש לבחור לפחות יום יעד אחד באותו שבוע' }, { status: 400 });

    const shifts = await base44.asServiceRole.entities.WorkShift.filter({ work_schedule_id: source.work_schedule_id }, 'date', 500);
    const skippedDates = targetDates.filter((date) => shifts.some((item) =>
      item.status !== 'CANCELLED' && item.date === date && item.row_type === source.row_type &&
      String(item.worker_id || '') === String(source.worker_id || '') &&
      String(item.start_time || '') === String(source.start_time || '') &&
      String(item.end_time || '') === String(source.end_time || '')
    ));
    const createDates = targetDates.filter((date) => !skippedDates.includes(date));
    if (createDates.length) {
      await base44.asServiceRole.entities.WorkShift.bulkCreate(createDates.map((date) => ({
        work_schedule_id: source.work_schedule_id, date, row_type: source.row_type,
        row_label: source.row_label, row_order: source.row_order,
        worker_id: source.worker_id || '', worker_name: source.worker_name || '',
        start_time: source.start_time || '', end_time: source.end_time || '',
        notes: source.notes || '', color_key: source.color_key || '', status: source.status,
        worker_count: countBased ? Number(source.worker_count) : undefined,
        linked_source_shift_id: source.id, auto_created_from: 'COPY_SHIFT_TO_DAYS',
        created_by: callerEmail, updated_by: callerEmail,
      })));
    }
    return Response.json({ created_count: createDates.length, skipped_count: skippedDates.length, created_dates: createDates, skipped_dates: skippedDates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});