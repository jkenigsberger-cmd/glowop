import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Recompute shared_activity snapshot for all items sharing a shared_activity_id.
async function recomputeSharedSnapshot(base44, sharedActivityId) {
  if (!sharedActivityId) return;
  const linked = await base44.asServiceRole.entities.GroupScheduleItem.filter({
    shared_activity_id: sharedActivityId,
    status: 'ACTIVE',
  });

  if (linked.length <= 1) {
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
    try { user = await base44.auth.me(); } catch (e) {
      console.warn('[deleteGroupScheduleItem] auth.me() threw (non-fatal):', e?.message);
    }
    if (!user) {
      console.warn('[deleteGroupScheduleItem] no authenticated user — proceeding with service role only');
    }

    const body = await req.json();
    const { id, delete_scope } = body;
    // delete_scope: "one" | "all"

    if (!id) return Response.json({ success: false, error: 'חסר מזהה פעילות' }, { status: 400 });

    let item = null;
    try {
      item = await base44.asServiceRole.entities.GroupScheduleItem.get(id);
    } catch {}
    if (!item) return Response.json({ success: false, error: 'הפעילות לא נמצאה' }, { status: 404 });

    const sharedId = item.shared_activity_id;

    if (delete_scope === 'all' && sharedId) {
      // Cancel all linked items
      const allLinked = await base44.asServiceRole.entities.GroupScheduleItem.filter({
        shared_activity_id: sharedId,
        status: 'ACTIVE',
      });
      for (const linked of allLinked) {
        await base44.asServiceRole.entities.GroupScheduleItem.update(linked.id, { status: 'CANCELLED' });
      }
      return Response.json({ success: true, cancelled_count: allLinked.length, scope: 'all' });
    }

    // Cancel only this item
    await base44.asServiceRole.entities.GroupScheduleItem.update(id, { status: 'CANCELLED' });

    // Recompute snapshots for remaining linked items
    if (sharedId) {
      await recomputeSharedSnapshot(base44, sharedId);
    }

    return Response.json({ success: true, scope: 'one' });

  } catch (err) {
    console.error('[deleteGroupScheduleItem] error:', err?.message);
    return Response.json({ success: false, error: 'שגיאה פנימית' }, { status: 500 });
  }
});