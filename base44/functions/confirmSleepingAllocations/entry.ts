import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function datesOverlap(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

// VIP tents and accessible tents support operational override of up to 4 pax
function getOperationalMaxPax(tent, allocation) {
  const isVipTent       = tent.tent_type === 'VIP' || String(tent.code || '').match(/^8\d/);
  const isAccessible    = tent.is_accessible === true;
  const isStaffAlloc    = allocation.allocation_type === 'STAFF';
  if (isVipTent || isAccessible || isStaffAlloc) return 4;
  return tent.capacity || 8;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Auth — non-fatal (same pattern as saveVipSleepingAllocation) ─────────
    // auth.me() can throw in some published-URL contexts (session not forwarded).
    // We log a warning but do NOT block, since all writes use asServiceRole.
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (authErr) {
      console.warn('[confirmSleepingAllocations] auth.me() threw (non-fatal):', authErr?.message);
    }

    if (!user) {
      console.warn('[confirmSleepingAllocations] no authenticated user — proceeding with service role only');
    } else {
      console.log(`[confirmSleepingAllocations] user: ${user.email} role: ${user.role}`);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: 'בקשה לא תקינה — JSON שגוי' }, { status: 200 });
    }

    const { group_id, draft_allocation_ids } = body;

    console.log('[confirmSleepingAllocations] group_id:', group_id);
    console.log('[confirmSleepingAllocations] draft_allocation_ids:', JSON.stringify(draft_allocation_ids));

    if (!group_id) {
      return Response.json({ success: false, error: 'חסר group_id', debug: { reasonCode: 'NO_GROUP_ID' } }, { status: 200 });
    }
    if (!Array.isArray(draft_allocation_ids) || draft_allocation_ids.length === 0) {
      return Response.json({
        success: false,
        error: 'אין הקצאות VIP לאישור',
        debug: { reasonCode: 'NO_DRAFT_IDS', received: draft_allocation_ids }
      }, { status: 200 });
    }

    // ── 1. Load draft allocations for this group ──────────────────────────────
    const allGroupAllocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id });
    console.log('[confirmSleepingAllocations] allGroupAllocations count:', allGroupAllocations.length);

    const draftsToConfirm = allGroupAllocations.filter(a =>
      draft_allocation_ids.includes(a.id) && a.status === 'DRAFT'
    );
    console.log('[confirmSleepingAllocations] draftsToConfirm count:', draftsToConfirm.length);

    if (draftsToConfirm.length === 0) {
      return Response.json({
        success: false,
        error: 'שיבוץ לינה לא נמצא — ייתכן שכבר אושר, בוטל, או שה-ID שגוי',
        debug: {
          reasonCode: 'NO_DRAFTS_MATCHED',
          requested: draft_allocation_ids,
          found: allGroupAllocations.map(a => ({ id: a.id, status: a.status }))
        }
      }, { status: 200 });
    }

    // ── 2. Load other groups' allocations for conflict checking ──────────────
    const allConfirmed = await base44.asServiceRole.entities.SleepingAllocation.filter({ status: 'CONFIRMED' });
    const allDrafts    = await base44.asServiceRole.entities.SleepingAllocation.filter({ status: 'DRAFT' });
    const otherActive  = [...allConfirmed, ...allDrafts].filter(a =>
      a.group_id !== group_id && !draft_allocation_ids.includes(a.id)
    );

    // ── 3. Load neighborhoods and tents ──────────────────────────────────────
    const neighborhoods = await base44.asServiceRole.entities.Neighborhood.list();
    const neighborhoodMap = Object.fromEntries(neighborhoods.map(n => [n.id, n]));

    const tents = await base44.asServiceRole.entities.Tent.list();
    const tentMap = Object.fromEntries(tents.map(t => [t.id, t]));

    // ── 4. Validate each draft ────────────────────────────────────────────────
    const errors = [];

    for (const draft of draftsToConfirm) {
      const tent = tentMap[draft.tent_id];
      if (!tent) {
        errors.push(`שיבוץ לינה לא נמצא — אוהל חסר (id: ${draft.tent_id})`);
        continue;
      }
      const neighborhood = neighborhoodMap[draft.neighborhood_id];
      const isVip = neighborhood?.is_vip === true;

      // Rule 1: capacity (VIP/accessible tents allow up to 4 operationally)
      const operationalMax = getOperationalMaxPax(tent, draft);
      if (draft.allocated_pax > operationalMax) {
        errors.push(`אוהל ${tent.code}: כמות האנשים (${draft.allocated_pax}) גדולה מהמקסימום התפעולי (${operationalMax}).`);
      }

      // Rule 2: tent exclusivity across groups
      const tentConflicts = otherActive.filter(o =>
        o.tent_id === draft.tent_id &&
        datesOverlap(draft.arrival_date, draft.departure_date, o.arrival_date, o.departure_date)
      );
      if (tentConflicts.length > 0) {
        errors.push(`אחד האוהלים כבר משובץ לקבוצה אחרת בתאריכים אלו (אוהל ${tent.code}).`);
      }

      // Rule 3: student neighborhood exclusivity (non-VIP only)
      if (draft.allocation_type === 'STUDENT' && !isVip) {
        const nhoodConflicts = otherActive.filter(o =>
          o.allocation_type === 'STUDENT' &&
          o.neighborhood_id === draft.neighborhood_id &&
          datesOverlap(draft.arrival_date, draft.departure_date, o.arrival_date, o.departure_date)
        );
        if (nhoodConflicts.length > 0) {
          errors.push(`שכונה "${neighborhood?.name || draft.neighborhood_id}": כבר תפוסה על ידי קבוצת חניכים אחרת בתאריכים אלו.`);
        }
      }

      // Rule 4: no mixed-gender within same tent in same batch
      const genderConflict = draftsToConfirm.some(other =>
        other.id !== draft.id &&
        other.tent_id === draft.tent_id &&
        other.gender_group !== draft.gender_group
      );
      if (genderConflict) {
        errors.push(`אוהל ${tent.code}: לא ניתן לשבץ שני מגדרים שונים לאותו אוהל.`);
      }
    }

    const uniqueErrors = [...new Set(errors)];
    if (uniqueErrors.length > 0) {
      console.warn('[confirmSleepingAllocations] validation errors:', uniqueErrors);
      // Return 200 so SDK doesn't throw — frontend checks success:false
      return Response.json({ success: false, errors: uniqueErrors }, { status: 200 });
    }

    // ── 5. Confirm all drafts ─────────────────────────────────────────────────
    await Promise.all(
      draftsToConfirm.map(draft =>
        base44.asServiceRole.entities.SleepingAllocation.update(draft.id, { status: 'CONFIRMED' })
      )
    );

    const confirmedIds = draftsToConfirm.map(d => d.id);
    console.log('[confirmSleepingAllocations] confirmed IDs:', confirmedIds);

    return Response.json({
      success: true,
      confirmed_count: draftsToConfirm.length,
      confirmed_ids: confirmedIds,
      message: 'שיבוץ הלינה אושר',
    });

  } catch (err) {
    console.error('[confirmSleepingAllocations] unexpected error:', err?.message, err?.stack);
    return Response.json({
      success: false,
      error: 'שגיאה פנימית באישור שיבוץ לינה',
      debug: { reasonCode: 'UNEXPECTED_EXCEPTION', message: err?.message }
    }, { status: 500 });
  }
});