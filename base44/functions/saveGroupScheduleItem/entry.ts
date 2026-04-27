import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_SPACE_CODES = new Set([
  'bunker_1', 'bunker_2', 'bunker_4', 'bunker_5',
  'bunker_6', 'bunker_7', 'bunker_8', 'ohel_moed', 'dining_hall'
]);

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    id, // present when updating
    group_id,
    operational_group_profile_id,
    date,
    start_time,
    end_time,
    activity_name,
    requested_location,
    activity_space_id,
    pax,
    notes,
    source,
    status,
  } = body;

  if (!group_id || !operational_group_profile_id || !date || !start_time || !end_time || !activity_name) {
    return Response.json({ error: 'שדות חובה חסרים' }, { status: 400 });
  }

  let resolvedSpaceId = activity_space_id || null;
  let resolvedSpaceCode = null;

  // Only run conflict check when assigning an actual space
  if (resolvedSpaceId && status !== 'CANCELLED') {
    // Load and validate the activity space
    const spaces = await base44.asServiceRole.entities.ActivitySpace.filter({ id: resolvedSpaceId });
    const space = spaces[0];
    if (!space) {
      return Response.json({ error: 'מרחב הפעילות שנבחר אינו קיים.' }, { status: 400 });
    }
    if (!VALID_SPACE_CODES.has(space.code)) {
      return Response.json({ error: `הקוד "${space.code}" אינו מרחב פעילות תקני.` }, { status: 400 });
    }
    resolvedSpaceCode = space.code;

    // Conflict check with 15-minute buffer
    const newStart = timeToMinutes(start_time);
    const newEnd   = timeToMinutes(end_time);
    const bufStart = newStart - 15;
    const bufEnd   = newEnd   + 15;

    const existingItems = await base44.asServiceRole.entities.GroupScheduleItem.filter({
      activity_space_id: resolvedSpaceId,
      date,
      status: 'ACTIVE',
    });

    const conflicts = existingItems.filter(item => {
      if (id && item.id === id) return false; // exclude self on update
      const eStart = timeToMinutes(item.start_time);
      const eEnd   = timeToMinutes(item.end_time);
      return bufStart < eEnd && bufEnd > eStart;
    });

    if (conflicts.length > 0) {
      const c = conflicts[0];
      return Response.json({
        error: `שגיאת התנגשות: מרחב הפעילות כבר תפוס בין ${c.start_time}–${c.end_time} (כולל בופר 15 דקות).`
      }, { status: 409 });
    }
  }

  const payload = {
    group_id,
    operational_group_profile_id,
    date,
    start_time,
    end_time,
    activity_name,
    requested_location: requested_location || null,
    activity_space_id: resolvedSpaceId,
    activity_space_code: resolvedSpaceCode,
    pax: pax ? Number(pax) : null,
    notes: notes || null,
    source: source || 'manual',
    status: status || 'ACTIVE',
  };

  let result;
  if (id) {
    result = await base44.asServiceRole.entities.GroupScheduleItem.update(id, payload);
  } else {
    result = await base44.asServiceRole.entities.GroupScheduleItem.create(payload);
  }

  return Response.json({ success: true, item: result });
});