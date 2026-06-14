import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_SPACE_CODES = new Set([
  'bunker_1', 'bunker_2', 'bunker_4', 'bunker_5',
  'bunker_6', 'bunker_7', 'bunker_8', 'ohel_moed', 'dining_hall',
  'outdoor_deck_lawn',
  // בולדרים
  'boulder_1', 'boulder_2', 'boulder_3', 'boulder_4',
  'boulder_5', 'boulder_6', 'boulder_8',
]);

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth — best-effort, same pattern as saveVipSleepingAllocation.
    // auth.me() can throw in published-URL context; we log but don't block
    // since all entity writes go through asServiceRole.
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (authErr) {
      console.warn('[saveGroupScheduleItem] auth.me() threw (non-fatal):', authErr?.message);
    }
    if (!user) {
      console.warn('[saveGroupScheduleItem] no authenticated user — proceeding with service role only');
    }

    const body = await req.json();
    const {
      id,
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
      coffee_corner,
      notes,
      source,
      status,
    } = body;

    if (!group_id || !operational_group_profile_id) {
      return Response.json({ success: false, error: 'חסרים פרטי קבוצה או פרופיל תפעולי' }, { status: 400 });
    }
    if (!activity_name) {
      return Response.json({ success: false, error: 'חסר שם פעילות' }, { status: 400 });
    }
    if (!date) {
      return Response.json({ success: false, error: 'חסר תאריך פעילות' }, { status: 400 });
    }
    if (!start_time || !end_time) {
      return Response.json({ success: false, error: 'חסרות שעות פעילות' }, { status: 400 });
    }
    if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
      return Response.json({ success: false, error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' }, { status: 400 });
    }

    // Validate date is within group booking window
    const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
    const group = groups[0];
    if (group && group.arrival_date && group.departure_date) {
      if (date < group.arrival_date || date > group.departure_date) {
        return Response.json({ success: false, error: 'לא ניתן לקבוע פעילות מחוץ לתאריכי הקבוצה' }, { status: 400 });
      }
    }

    let resolvedSpaceId = activity_space_id || null;
    let resolvedSpaceCode = null;

    // Only run conflict check when assigning an actual space
    if (resolvedSpaceId && status !== 'CANCELLED') {
      const spaces = await base44.asServiceRole.entities.ActivitySpace.filter({ id: resolvedSpaceId });
      const space = spaces[0];
      if (!space) {
        return Response.json({ success: false, error: 'מרחב הפעילות שנבחר אינו קיים.' }, { status: 400 });
      }
      if (!VALID_SPACE_CODES.has(space.code)) {
        return Response.json({ success: false, error: `הקוד "${space.code}" אינו מרחב פעילות תקני.` }, { status: 400 });
      }
      resolvedSpaceCode = space.code;

      const newStart = timeToMinutes(start_time);
      const newEnd   = timeToMinutes(end_time);

      const existingItems = await base44.asServiceRole.entities.GroupScheduleItem.filter({
        activity_space_id: resolvedSpaceId,
        date,
        status: 'ACTIVE',
      });

      const conflicts = existingItems.filter(item => {
        if (id && item.id === id) return false;
        const eStart = timeToMinutes(item.start_time);
        const eEnd   = timeToMinutes(item.end_time);
        // Real overlap only — back-to-back (A ends exactly when B starts) is allowed
        return newStart < eEnd && newEnd > eStart;
      });

      if (conflicts.length > 0) {
        const c = conflicts[0];
        return Response.json({
          success: false,
          error: `המרחב כבר תפוס בשעה הזו. יש לבחור שעה אחרת או מרחב אחר. (התנגשות עם ${c.start_time}–${c.end_time})`
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
      coffee_corner: !!coffee_corner,
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

    // Post-write race-condition check
    if (resolvedSpaceId && status !== 'CANCELLED') {
      const newStart = timeToMinutes(start_time);
      const newEnd   = timeToMinutes(end_time);

      const afterItems = await base44.asServiceRole.entities.GroupScheduleItem.filter({
        activity_space_id: resolvedSpaceId,
        date,
        status: 'ACTIVE',
      });

      const postConflicts = afterItems.filter(item => {
        if (item.id === result.id) return false;
        const eStart = timeToMinutes(item.start_time);
        const eEnd   = timeToMinutes(item.end_time);
        // Real overlap only
        return newStart < eEnd && newEnd > eStart;
      });

      if (postConflicts.length > 0) {
        await base44.asServiceRole.entities.GroupScheduleItem.update(result.id, { status: 'CANCELLED' });
        const c = postConflicts[0];
        return Response.json({
          success: false,
          error: `המרחב כבר תפוס בשעה הזו. יש לבחור שעה אחרת או מרחב אחר. (התנגשות עם ${c.start_time}–${c.end_time})`
        }, { status: 409 });
      }
    }

    return Response.json({ success: true, item: result });

  } catch (err) {
    console.error('[saveGroupScheduleItem] unexpected error:', err?.message, err?.stack);
    return Response.json({ success: false, error: 'שגיאה פנימית בשמירת פעילות', debug: { message: err?.message } }, { status: 500 });
  }
});