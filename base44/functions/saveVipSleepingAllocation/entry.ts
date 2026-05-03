import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Hotel-night overlap rule:
 *   Two allocations overlap if arrival_new < departure_existing AND departure_new > arrival_existing
 *   arrival_date is inclusive (first sleeping night)
 *   departure_date is exclusive (checkout day — does NOT block that night)
 *   Same-day checkout / check-in is therefore allowed.
 */
function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    allocation_id,            // string | null  — present when updating existing
    group_id,                 // required
    operational_group_profile_id, // required
    tent_id,                  // required
    requirement_index,        // required — integer, used in __vip_req_N__ marker
    gender_group,             // required — MEN or WOMEN
    allocated_pax,            // required — 1..3
    notes,                    // optional string
  } = body;

  // ── 1. Input validation ────────────────────────────────────────────────────

  if (!group_id || !operational_group_profile_id || !tent_id) {
    return Response.json({ error: 'group_id, operational_group_profile_id, tent_id הם שדות חובה' }, { status: 400 });
  }
  if (requirement_index == null || requirement_index < 0) {
    return Response.json({ error: 'requirement_index הוא שדה חובה' }, { status: 400 });
  }
  if (!gender_group || !['MEN', 'WOMEN'].includes(gender_group)) {
    return Response.json({ error: 'יש לבחור מגדר (גברים/נשים)' }, { status: 400 });
  }
  const pax = Number(allocated_pax);
  if (!pax || pax < 1 || pax > 3) {
    return Response.json({ error: 'מספר האנשים חייב להיות בין 1 ל-3' }, { status: 400 });
  }

  // ── 2. Load & validate tent ────────────────────────────────────────────────

  let tent, neighborhood, profile;
  try {
    const tents = await base44.asServiceRole.entities.Tent.filter({ id: tent_id });
    tent = tents[0];
  } catch (_) { tent = null; }
  if (!tent) return Response.json({ error: 'האוהל לא נמצא במערכת' }, { status: 404 });
  if (tent.tent_type !== 'VIP') {
    return Response.json({ error: `אוהל ${tent.code} אינו אוהל VIP` }, { status: 400 });
  }
  if (tent.working_status !== 'WORKING') {
    return Response.json({ error: `אוהל ${tent.code} אינו זמין (${tent.working_status})` }, { status: 400 });
  }
  if (pax > tent.capacity) {
    return Response.json({ error: `מספר האנשים (${pax}) חורג מקיבולת האוהל ${tent.code} (${tent.capacity})` }, { status: 400 });
  }

  // ── 3. Load VIP neighborhood for this tent ─────────────────────────────────

  try {
    const neighborhoods = await base44.asServiceRole.entities.Neighborhood.filter({ id: tent.neighborhood_id });
    neighborhood = neighborhoods[0];
  } catch (_) { neighborhood = null; }
  if (!neighborhood || !neighborhood.is_vip) {
    return Response.json({ error: `אוהל ${tent.code} אינו שייך לשכונת VIP` }, { status: 400 });
  }

  // ── 4. Load profile → get authoritative arrival/departure dates ────────────

  try {
    const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ id: operational_group_profile_id });
    profile = profiles[0];
  } catch (_) { profile = null; }
  if (!profile || profile.group_id !== group_id) {
    return Response.json({ error: 'פרופיל תפעולי לא נמצא או אינו שייך לקבוצה זו' }, { status: 404 });
  }

  // Derive dates from profile; fall back to Group if not set on profile
  let arrival_date   = profile.arrival_date;
  let departure_date = profile.departure_date;
  if (!arrival_date || !departure_date) {
    const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
    const group  = groups[0];
    arrival_date   = arrival_date   || group?.arrival_date;
    departure_date = departure_date || group?.departure_date;
  }
  if (!arrival_date || !departure_date) {
    return Response.json({ error: 'תאריכי לינה לא הוגדרו לקבוצה זו' }, { status: 400 });
  }

  // ── 5. Conflict check — no other active allocation may overlap this tent ───

  // Load all non-cancelled allocations for this tent
  const existingForTent = await base44.asServiceRole.entities.SleepingAllocation.filter({ tent_id });
  const activeForTent = existingForTent.filter(a =>
    a.status !== 'CANCELLED' &&
    a.id !== allocation_id           // exclude current row if updating
  );

  const conflict = activeForTent.find(a =>
    datesOverlap(arrival_date, departure_date, a.arrival_date, a.departure_date)
  );

  if (conflict) {
    // Try to get the conflicting group name for a helpful message
    let conflictGroupName = conflict.group_id;
    try {
      const conflictGroups = await base44.asServiceRole.entities.Group.filter({ id: conflict.group_id });
      conflictGroupName = conflictGroups[0]?.group_name || conflict.group_id;
    } catch (_) { /* non-fatal */ }

    const msg = conflict.group_id === group_id
      ? `אוהל ${tent.code} כבר משויך לדרישה אחרת של קבוצה זו בתאריכים ${conflict.arrival_date} — ${conflict.departure_date}`
      : `אוהל ${tent.code} כבר משויך לקבוצה אחרת (${conflictGroupName}) בתאריכים ${conflict.arrival_date} — ${conflict.departure_date}`;

    return Response.json({ error: msg }, { status: 409 });
  }

  // ── 6. Check for stale row: same group/req already on a DIFFERENT tent ─────
  // If we're creating new (not updating), see if this req_index already has a row → we should
  // update that row in place instead of creating a duplicate.
  const noteMarker = `__vip_req_${requirement_index}__`;
  const groupAllocs = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id });
  const staleRow = groupAllocs.find(a =>
    a.status !== 'CANCELLED' &&
    a.id !== allocation_id &&
    (a.notes || '').includes(noteMarker)
  );

  // ── 7. Build the payload ───────────────────────────────────────────────────

  const cleanNotes = (notes || '').replace(/__vip_req_\d+__\s*/g, '').trim();
  const payload = {
    tent_id,
    neighborhood_id:               neighborhood.id,
    group_id,
    operational_group_profile_id,
    arrival_date,
    departure_date,
    allocated_pax:                 pax,
    allocation_type:               'STAFF',
    gender_group,
    notes:                         `${noteMarker}${cleanNotes ? ' ' + cleanNotes : ''}`.trim(),
    status:                        'DRAFT',
  };

  // ── 8. Persist ─────────────────────────────────────────────────────────────

  let savedId;

  if (allocation_id) {
    // Updating existing row
    await base44.asServiceRole.entities.SleepingAllocation.update(allocation_id, payload);
    savedId = allocation_id;
    // If the tent changed, the staleRow IS allocation_id, already handled above.
    // If somehow there's a different stale row (shouldn't happen), clean it up.
    if (staleRow && staleRow.id !== allocation_id) {
      await base44.asServiceRole.entities.SleepingAllocation.delete(staleRow.id);
    }
  } else if (staleRow) {
    // Req already had a different tent — update that row in place (avoids duplicates)
    await base44.asServiceRole.entities.SleepingAllocation.update(staleRow.id, payload);
    savedId = staleRow.id;
  } else {
    // Brand new assignment
    const created = await base44.asServiceRole.entities.SleepingAllocation.create(payload);
    savedId = created.id;
  }

  return Response.json({
    success: true,
    allocation_id: savedId,
    tent_code: tent.code,
    message: `אוהל ${tent.code} שויך בהצלחה`,
  });
});