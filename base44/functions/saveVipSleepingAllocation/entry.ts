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

function isValidDate(str) {
  if (!str || typeof str !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

function fail(reasonCode, errorMsg, debugPayload) {
  return Response.json({
    error: errorMsg,
    debug: { reasonCode, ...debugPayload },
  }, { status: 400 });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    allocation_id,
    group_id,
    operational_group_profile_id,
    tent_id,
    requirement_index,
    gender_group,
    allocated_pax,
    notes,
  } = body;

  // Base debug context (grows as we load data)
  const dbg = {
    tent_id:                      tent_id        ?? null,
    tent_code:                    null,
    tent_is_vip:                  null,
    tent_capacity:                null,
    tent_working_status:          null,
    tent_neighborhood_id:         null,
    group_id:                     group_id       ?? null,
    operational_group_profile_id: operational_group_profile_id ?? null,
    arrival_date:                 null,
    departure_date:               null,
    allocated_pax:                allocated_pax  ?? null,
    gender_group:                 gender_group   ?? null,
    requirement_index:            requirement_index ?? null,
    existingActiveAllocationsCount: null,
    conflictingAllocationIds:     [],
  };

  // ── 1. Input validation ────────────────────────────────────────────────────

  if (!group_id || !operational_group_profile_id || !tent_id || requirement_index == null) {
    return fail('MISSING_INPUT', 'חסרים פרטי שיבוץ VIP', dbg);
  }
  if (!gender_group || !['MEN', 'WOMEN'].includes(gender_group)) {
    return fail('INVALID_GENDER', 'יש לבחור מגדר (גברים/נשים)', dbg);
  }
  const pax = Number(allocated_pax);
  if (!pax || pax < 1 || pax > 3) {
    return fail('INVALID_PAX', 'מספר האנשים חייב להיות בין 1 ל-3', dbg);
  }

  // ── 2. Load & validate tent ────────────────────────────────────────────────

  let tent;
  try {
    const tents = await base44.asServiceRole.entities.Tent.filter({ id: tent_id });
    tent = tents[0];
  } catch (_) { tent = null; }

  if (!tent) return fail('TENT_NOT_FOUND', 'האוהל לא נמצא במערכת', dbg);

  // Update debug with tent metadata
  dbg.tent_code           = tent.code;
  dbg.tent_is_vip         = tent.tent_type;
  dbg.tent_capacity       = tent.capacity;
  dbg.tent_working_status = tent.working_status;
  dbg.tent_neighborhood_id = tent.neighborhood_id;

  if (tent.tent_type !== 'VIP') {
    return fail('TENT_NOT_VIP', 'האוהל שנבחר אינו אוהל VIP', dbg);
  }
  if (tent.working_status !== 'WORKING') {
    return fail('TENT_NOT_WORKING', 'האוהל אינו זמין לשימוש', dbg);
  }
  if (pax > tent.capacity) {
    return fail('PAX_EXCEEDS_CAPACITY', 'כמות האנשים גדולה מקיבולת האוהל', dbg);
  }

  // ── 3. Load VIP neighborhood for this tent ─────────────────────────────────

  let neighborhood;
  try {
    const neighborhoods = await base44.asServiceRole.entities.Neighborhood.filter({ id: tent.neighborhood_id });
    neighborhood = neighborhoods[0];
  } catch (_) { neighborhood = null; }

  if (!neighborhood || !neighborhood.is_vip) {
    return fail('NOT_VIP_NEIGHBORHOOD', 'האוהל שנבחר אינו נמצא במתחם VIP', dbg);
  }

  // ── 4. Load profile → get authoritative arrival/departure dates ────────────

  let profile;
  try {
    const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ id: operational_group_profile_id });
    profile = profiles[0];
  } catch (_) { profile = null; }

  if (!profile || profile.group_id !== group_id) {
    return fail('PROFILE_NOT_FOUND', 'חסרים פרטי קבוצה או פרופיל תפעולי', dbg);
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

  dbg.arrival_date   = arrival_date   ?? null;
  dbg.departure_date = departure_date ?? null;

  if (!arrival_date || !departure_date) {
    return fail('DATES_MISSING', 'חסרים תאריכי הגעה או עזיבה לקבוצה', dbg);
  }
  if (!isValidDate(arrival_date) || !isValidDate(departure_date)) {
    return fail('DATES_INVALID', 'תאריכי השיבוץ אינם תקינים', dbg);
  }
  if (departure_date <= arrival_date) {
    return fail('DATES_DEPARTURE_BEFORE_ARRIVAL', 'תאריך העזיבה חייב להיות אחרי תאריך ההגעה', dbg);
  }

  // ── 5. Conflict check — no other active allocation may overlap this tent ───

  const existingForTent = await base44.asServiceRole.entities.SleepingAllocation.filter({ tent_id });
  const activeForTent = existingForTent.filter(a =>
    a.status !== 'CANCELLED' &&
    a.id !== allocation_id
  );

  dbg.existingActiveAllocationsCount = activeForTent.length;

  const conflicting = activeForTent.filter(a =>
    datesOverlap(arrival_date, departure_date, a.arrival_date, a.departure_date)
  );

  dbg.conflictingAllocationIds = conflicting.map(a => a.id);

  if (conflicting.length > 0) {
    const conflict = conflicting[0];
    let conflictGroupName = conflict.group_id;
    try {
      const cgs = await base44.asServiceRole.entities.Group.filter({ id: conflict.group_id });
      conflictGroupName = cgs[0]?.group_name || conflict.group_id;
    } catch (_) { /* non-fatal */ }

    const msg = conflict.group_id === group_id
      ? `אוהל ${tent.code} כבר משויך לדרישה אחרת של קבוצה זו (${conflict.arrival_date} — ${conflict.departure_date})`
      : `האוהל כבר משובץ לקבוצה אחרת (${conflictGroupName}) בתאריכים ${conflict.arrival_date} — ${conflict.departure_date}`;

    return fail('CONFLICT', msg, dbg);
  }

  // ── 6. Check for stale row: same group/req already on a DIFFERENT tent ─────

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
    await base44.asServiceRole.entities.SleepingAllocation.update(allocation_id, payload);
    savedId = allocation_id;
    if (staleRow && staleRow.id !== allocation_id) {
      await base44.asServiceRole.entities.SleepingAllocation.delete(staleRow.id);
    }
  } else if (staleRow) {
    await base44.asServiceRole.entities.SleepingAllocation.update(staleRow.id, payload);
    savedId = staleRow.id;
  } else {
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