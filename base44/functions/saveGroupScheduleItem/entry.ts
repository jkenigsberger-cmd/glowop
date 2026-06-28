import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const VALID_SPACE_CODES = new Set([
  'bunker_1', 'bunker_2', 'bunker_4', 'bunker_5',
  'bunker_6', 'bunker_7', 'bunker_8', 'ohel_moed', 'dining_hall',
  'outdoor_deck_lawn',
  'boulder_1', 'boulder_2', 'boulder_3', 'boulder_4',
  'boulder_5', 'boulder_6', 'boulder_8',
]);

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Recompute shared_activity snapshot for all items sharing a shared_activity_id.
// If only 1 item remains, clears shared metadata from it.
async function recomputeSharedSnapshot(base44, sharedActivityId) {
  if (!sharedActivityId) return;
  const linked = await base44.asServiceRole.entities.GroupScheduleItem.filter({
    shared_activity_id: sharedActivityId,
    status: 'ACTIVE',
  });

  if (linked.length <= 1) {
    // Clear shared metadata — not truly shared anymore
    for (const item of linked) {
      await base44.asServiceRole.entities.GroupScheduleItem.update(item.id, {
        shared_activity_id: null,
        shared_activity_created_from_group_id: null,
        shared_activity_group_ids: null,
        shared_activity_group_names: null,
        is_shared_activity: false,
      });
    }
    return;
  }

  // Fetch group names
  const groupIds = [...new Set(linked.map(i => i.group_id))];
  const groups = await base44.asServiceRole.entities.Group.filter({ id: { $in: groupIds } });
  const groupNameMap = Object.fromEntries(groups.map(g => [g.id, g.group_name]));

  const ids = linked.map(i => i.group_id);
  const names = linked.map(i => groupNameMap[i.group_id] || i.group_id);

  for (const item of linked) {
    await base44.asServiceRole.entities.GroupScheduleItem.update(item.id, {
      shared_activity_group_ids: JSON.stringify(ids),
      shared_activity_group_names: JSON.stringify(names),
      is_shared_activity: true,
    });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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
      // Shared activity fields
      shared_activity_id,
      shared_activity_created_from_group_id,
      // Extra groups for shared activity creation
      extra_group_ids,
      // Edit scope for shared activities
      edit_scope, // "one" | "all"
      // unlink flag — if true, unlink this item from shared activity
      unlink_from_shared,
      pax,
      notes,
      needs_projector,
      needs_screen,
      needs_microphone,
      needs_sound,
      needs_whiteboard,
      needs_chair_circle,
      chairs_count,
      logistics_other,
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

    // Determine the shared_activity_id that should be excluded from conflict checks
    // (linked clones of the same activity must not block each other)
    const excludeSharedId = shared_activity_id || null;

    // Conflict check helper — used for both single and shared creation
    const checkConflict = async (spaceId, excludeItemId, excludeSharedActivityId) => {
      if (!spaceId || status === 'CANCELLED') return null;

      const spaces = await base44.asServiceRole.entities.ActivitySpace.filter({ id: spaceId });
      const space = spaces[0];
      if (!space) return 'מרחב הפעילות שנבחר אינו קיים.';
      if (!VALID_SPACE_CODES.has(space.code)) return `הקוד "${space.code}" אינו מרחב פעילות תקני.`;

      const newStart = timeToMinutes(start_time);
      const newEnd   = timeToMinutes(end_time);

      const existingItems = await base44.asServiceRole.entities.GroupScheduleItem.filter({
        activity_space_id: spaceId,
        date,
        status: 'ACTIVE',
      });

      const conflicts = existingItems.filter(item => {
        if (excludeItemId && item.id === excludeItemId) return false;
        // Ignore items that are part of the same shared activity
        if (excludeSharedActivityId && item.shared_activity_id === excludeSharedActivityId) return false;
        const eStart = timeToMinutes(item.start_time);
        const eEnd   = timeToMinutes(item.end_time);
        return newStart < eEnd && newEnd > eStart;
      });

      if (conflicts.length > 0) {
        const c = conflicts[0];
        return `המרחב כבר תפוס בשעה הזו. יש לבחור שעה אחרת או מרחב אחר. (התנגשות עם ${c.start_time}–${c.end_time})`;
      }
      return null;
    };

    // Resolve space code
    if (resolvedSpaceId) {
      const spaceRows = await base44.asServiceRole.entities.ActivitySpace.filter({ id: resolvedSpaceId });
      const sp = spaceRows[0];
      if (sp && VALID_SPACE_CODES.has(sp.code)) resolvedSpaceCode = sp.code;
    }

    const basePayload = {
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
      needs_projector:    !!needs_projector,
      needs_screen:       !!needs_screen,
      needs_microphone:   !!needs_microphone,
      needs_sound:        !!needs_sound,
      needs_whiteboard:   !!needs_whiteboard,
      needs_chair_circle: !!needs_chair_circle,
      chairs_count:       chairs_count ? Number(chairs_count) : null,
      logistics_other:    logistics_other || null,
      source: source || 'manual',
      status: status || 'ACTIVE',
    };

    // ── CASE: Editing existing item with shared_activity_id ──────────────────
    if (id && edit_scope) {
      let currentItem = null;
      try { currentItem = await base44.asServiceRole.entities.GroupScheduleItem.get(id); } catch {}
      if (!currentItem) return Response.json({ success: false, error: 'הפעילות לא נמצאה' }, { status: 404 });

      const currentSharedId = currentItem.shared_activity_id;

      if (edit_scope === 'one') {
        // Check if we need to unlink (main shared fields changed)
        const sharedFieldsChanged = unlink_from_shared;

        const conflictErr = await checkConflict(resolvedSpaceId, id, sharedFieldsChanged ? null : currentSharedId);
        if (conflictErr) return Response.json({ success: false, error: conflictErr }, { status: 409 });

        if (sharedFieldsChanged && currentSharedId) {
          // Unlink this item from the shared activity
          const updatedItem = {
            ...basePayload,
            shared_activity_id: null,
            shared_activity_created_from_group_id: null,
            shared_activity_group_ids: null,
            shared_activity_group_names: null,
            is_shared_activity: false,
          };
          const result = await base44.asServiceRole.entities.GroupScheduleItem.update(id, updatedItem);
          // Recompute snapshot for remaining items
          await recomputeSharedSnapshot(base44, currentSharedId);
          return Response.json({ success: true, item: result, unlinked: true });
        } else {
          // Update only this item, keep its shared_activity_id
          const result = await base44.asServiceRole.entities.GroupScheduleItem.update(id, {
            ...basePayload,
            shared_activity_id: currentItem.shared_activity_id || null,
            shared_activity_created_from_group_id: currentItem.shared_activity_created_from_group_id || null,
            shared_activity_group_ids: currentItem.shared_activity_group_ids || null,
            shared_activity_group_names: currentItem.shared_activity_group_names || null,
            is_shared_activity: currentItem.is_shared_activity || false,
          });
          return Response.json({ success: true, item: result });
        }
      }

      if (edit_scope === 'all' && currentSharedId) {
        // Conflict check once for unrelated items
        const conflictErr = await checkConflict(resolvedSpaceId, null, currentSharedId);
        if (conflictErr) return Response.json({ success: false, error: conflictErr }, { status: 409 });

        // Get all linked items
        const allLinked = await base44.asServiceRole.entities.GroupScheduleItem.filter({
          shared_activity_id: currentSharedId,
          status: 'ACTIVE',
        });

        // Update all — preserve each item's group_id and operational_group_profile_id
        for (const linkedItem of allLinked) {
          await base44.asServiceRole.entities.GroupScheduleItem.update(linkedItem.id, {
            ...basePayload,
            group_id: linkedItem.group_id,
            operational_group_profile_id: linkedItem.operational_group_profile_id,
            shared_activity_id: currentSharedId,
            shared_activity_created_from_group_id: currentItem.shared_activity_created_from_group_id,
          });
        }

        await recomputeSharedSnapshot(base44, currentSharedId);
        return Response.json({ success: true, updated_all: true, count: allLinked.length });
      }

      // Fallback: normal update
      const conflictErr = await checkConflict(resolvedSpaceId, id, currentSharedId);
      if (conflictErr) return Response.json({ success: false, error: conflictErr }, { status: 409 });
      const result = await base44.asServiceRole.entities.GroupScheduleItem.update(id, basePayload);
      return Response.json({ success: true, item: result });
    }

    // ── CASE: Normal single item save (no extra groups) ──────────────────────
    if (!extra_group_ids || extra_group_ids.length === 0) {
      if (resolvedSpaceId && status !== 'CANCELLED') {
        const conflictErr = await checkConflict(resolvedSpaceId, id || null, excludeSharedId);
        if (conflictErr) return Response.json({ success: false, error: conflictErr }, { status: 409 });
      }

      let result;
      if (id) {
        result = await base44.asServiceRole.entities.GroupScheduleItem.update(id, basePayload);
      } else {
        result = await base44.asServiceRole.entities.GroupScheduleItem.create(basePayload);
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
          if (excludeSharedId && item.shared_activity_id === excludeSharedId) return false;
          const eStart = timeToMinutes(item.start_time);
          const eEnd   = timeToMinutes(item.end_time);
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
    }

    // ── CASE: Shared activity — create for current group + extra groups ───────
    // Validate conflict once (shared items won't block each other since we use the same sharedId)
    const newSharedId = crypto.randomUUID();

    if (resolvedSpaceId) {
      const conflictErr = await checkConflict(resolvedSpaceId, null, newSharedId);
      if (conflictErr) return Response.json({ success: false, error: conflictErr }, { status: 409 });
    }

    // Fetch extra groups' operational profiles
    const allGroupIds = [group_id, ...extra_group_ids];
    const allGroups = await base44.asServiceRole.entities.Group.filter({ id: { $in: allGroupIds } });
    const groupMap = Object.fromEntries(allGroups.map(g => [g.id, g]));

    // Get operational profiles for extra groups
    const extraProfiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({
      group_id: { $in: extra_group_ids },
    });
    const profileMap = Object.fromEntries(extraProfiles.map(p => [p.group_id, p]));

    const createdIds = [];
    try {
      // Create primary group item
      const primaryItem = await base44.asServiceRole.entities.GroupScheduleItem.create({
        ...basePayload,
        shared_activity_id: newSharedId,
        shared_activity_created_from_group_id: group_id,
        is_shared_activity: true,
      });
      createdIds.push(primaryItem.id);

      // Create clones for extra groups
      for (const extraGroupId of extra_group_ids) {
        const extraProfile = profileMap[extraGroupId];
        const clonePayload = {
          ...basePayload,
          group_id: extraGroupId,
          operational_group_profile_id: extraProfile?.id || operational_group_profile_id,
          shared_activity_id: newSharedId,
          shared_activity_created_from_group_id: group_id,
          is_shared_activity: true,
        };
        const cloneItem = await base44.asServiceRole.entities.GroupScheduleItem.create(clonePayload);
        createdIds.push(cloneItem.id);
      }

      // Compute snapshots
      const groupNames = allGroupIds.map(gid => groupMap[gid]?.group_name || gid);
      for (const createdId of createdIds) {
        await base44.asServiceRole.entities.GroupScheduleItem.update(createdId, {
          shared_activity_group_ids: JSON.stringify(allGroupIds),
          shared_activity_group_names: JSON.stringify(groupNames),
        });
      }

      return Response.json({
        success: true,
        shared_activity_id: newSharedId,
        created_count: createdIds.length,
        group_count: allGroupIds.length,
      });

    } catch (err) {
      // Rollback all created items
      for (const cid of createdIds) {
        await base44.asServiceRole.entities.GroupScheduleItem.update(cid, { status: 'CANCELLED' }).catch(() => {});
      }
      console.error('[saveGroupScheduleItem] shared activity creation failed, rolled back:', err?.message);
      return Response.json({
        success: false,
        error: 'יצירת הפעילות המשותפת נכשלה. כל הרשומות שנוצרו בוטלו. נסה שוב.',
      }, { status: 500 });
    }

  } catch (err) {
    console.error('[saveGroupScheduleItem] unexpected error:', err?.message, err?.stack);
    return Response.json({ success: false, error: 'שגיאה פנימית בשמירת פעילות', debug: { message: err?.message } }, { status: 500 });
  }
});