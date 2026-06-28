import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Roles allowed to manage activities (mirrors roles.js MANAGE_ACTIVITIES)
const MANAGE_ACTIVITIES_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);

// Fetch groups by ids safely — no $in, loop of .get()
async function fetchGroupsByIds(base44, ids) {
  const results = [];
  for (const id of ids) {
    try {
      const g = await base44.asServiceRole.entities.Group.get(id);
      if (g) results.push(g);
    } catch { /* not found — skip */ }
  }
  return results;
}

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

  // Safe loop — no $in
  const groupIds = [...new Set(linked.map(i => i.group_id))];
  const groups = await fetchGroupsByIds(base44, groupIds);
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

    // ── Auth & permission check ───────────────────────────────────────────────
    let user = null;
    try { user = await base44.auth.me(); } catch { /* unauthenticated */ }
    if (!user) {
      return Response.json({ success: false, error: 'נדרשת התחברות' }, { status: 401 });
    }
    if (!MANAGE_ACTIVITIES_ROLES.has(user.role)) {
      return Response.json({ success: false, error: 'אין הרשאה לניהול פעילויות' }, { status: 403 });
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