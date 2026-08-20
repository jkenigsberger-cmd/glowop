import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildOperationalDaySnapshot } from '../../shared/operationalDaySnapshot.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const normalize = (value) => String(value || '').trim().toLowerCase();

function dateInJerusalem(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user) {
      const internalUsers = await base44.asServiceRole.entities.InternalUser.list('-created_date', 500);
      const caller = internalUsers.find((item) => normalize(item.email) === normalize(user.email) && item.active !== false);
      if (user.role !== 'admin' && (!caller || !['SUPER_ADMIN', 'ADMIN'].includes(caller.role))) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
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

    const existing = await base44.asServiceRole.entities.OperationalDaySnapshot.filter({ date }, 'created_date', 10);
    if (existing.length > 0) {
      return Response.json({ ok: true, date, already_finalized: true, snapshot_id: existing[0].id, snapshot_version: existing[0].snapshot_version });
    }

    const payload = await buildOperationalDaySnapshot(base44, date);
    const created = await base44.asServiceRole.entities.OperationalDaySnapshot.create({
      date,
      snapshot_json: JSON.stringify(payload),
      finalized_at: new Date().toISOString(),
      snapshot_version: 1,
    });

    const afterCreate = await base44.asServiceRole.entities.OperationalDaySnapshot.filter({ date }, 'created_date', 10);
    const keep = afterCreate[0] || created;
    const duplicates = afterCreate.filter((item) => item.id !== keep.id);
    for (const duplicate of duplicates) await base44.asServiceRole.entities.OperationalDaySnapshot.delete(duplicate.id);

    return Response.json({ ok: true, date, already_finalized: keep.id !== created.id, snapshot_id: keep.id, snapshot_version: keep.snapshot_version || 1 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}