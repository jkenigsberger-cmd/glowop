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
    quote_item_id,
    split_group_id,
    split_index,
    split_total,
    pax,
    notes,
    source,
    status,
  } = body;

  if (!group_id || !operational_group_profile_id || !date || !start_time || !end_time || !activity_name) {
    return Response.json({ error: 'שדות חובה חסרים' }, { status: 400 });
  }

  // Validate start_time < end_time
  if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return Response.json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' }, { status: 400 });
  }

  // Validate date is within group booking window
  const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
  const group = groups[0];
  if (group && group.arrival_date && group.departure_date) {
    if (date < group.arrival_date || date > group.departure_date) {
      return Response.json({ error: 'לא ניתן לקבוע פעילות מחוץ לתאריכי הקבוצה' }, { status: 400 });
    }
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
    quote_item_id: quote_item_id || null,
    split_group_id: split_group_id || null,
    split_index: split_index != null ? Number(split_index) : null,
    split_total: split_total != null ? Number(split_total) : null,
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

  // Post-write race-condition check: re-fetch and verify no conflict slipped through
  if (resolvedSpaceId && status !== 'CANCELLED') {
    const newStart = timeToMinutes(start_time);
    const newEnd   = timeToMinutes(end_time);
    const bufStart = newStart - 15;
    const bufEnd   = newEnd   + 15;

    const afterItems = await base44.asServiceRole.entities.GroupScheduleItem.filter({
      activity_space_id: resolvedSpaceId,
      date,
      status: 'ACTIVE',
    });

    const postConflicts = afterItems.filter(item => {
      if (item.id === result.id) return false; // exclude the item we just wrote
      const eStart = timeToMinutes(item.start_time);
      const eEnd   = timeToMinutes(item.end_time);
      return bufStart < eEnd && bufEnd > eStart;
    });

    if (postConflicts.length > 0) {
      // Roll back: cancel the item we just wrote
      await base44.asServiceRole.entities.GroupScheduleItem.update(result.id, { status: 'CANCELLED' });
      const c = postConflicts[0];
      return Response.json({
        error: `המרחב כבר תפוס בשעה הזו. יש לבחור שעה אחרת או מרחב אחר. (התנגשות עם ${c.start_time}–${c.end_time})`
      }, { status: 409 });
    }
  }

  return Response.json({ success: true, item: result });
});