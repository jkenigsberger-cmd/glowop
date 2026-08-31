import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dateInJerusalem, finalizeOperationalSnapshotForDate, previousDate } from '../../shared/operationalDaySnapshot.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const normalize = (value) => String(value || '').trim().toLowerCase();

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const internalUsers = await base44.asServiceRole.entities.InternalUser.list('-created_date', 500);
    const caller = internalUsers.find((item) => normalize(item.email) === normalize(user.email) && item.active !== false);
    if (!caller || !['SUPER_ADMIN', 'ADMIN'].includes(caller.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const today = dateInJerusalem();
    const schedulerDate = previousDate(today);
    if (body.mode === 'resolve_date') {
      return Response.json({ timezone: 'Asia/Jerusalem', today, target_date: schedulerDate });
    }

    const date = body.date || schedulerDate;
    if (!validDate(date)) return Response.json({ error: 'Invalid date; expected YYYY-MM-DD' }, { status: 400 });
    if (date >= today) return Response.json({ error: 'Only past operational dates can be finalized' }, { status: 400 });

    const result = await finalizeOperationalSnapshotForDate(base44, date);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}