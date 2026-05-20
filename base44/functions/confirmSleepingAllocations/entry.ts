import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function datesOverlap(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Auth ─────────────────────────────────────────────────────────────────
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (authErr) {
      console.error('[confirmSleepingAllocations] auth error:', authErr?.message);
      return Response.json({
        success: false,
        error: 'הפעולה נכשלה. יש להתחבר מחדש או לבדוק הרשאות.',
        debug: { reasonCode: 'AUTH_ERROR', message: authErr?.message }
      }, { status: 401 });
    }

    if (!user) {
      return Response.json({
        success: false,
        error: 'אין הרשאה לבצע פעולה זו',
        debug: { reasonCode: 'NOT_AUTHENTICATED' }
      }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: 'בקשה לא תקינה — JSON שגוי' }, { status: 400 });
    }

    const { group_id, draft_allocation_ids } = body;

    console.log('[confirmSleepingAllocations] group_id:', group_id);
    console.log('[confirmSleepingAllocations] draft_allocation_ids:', JSON.stringify(draft_allocation_ids));

    if (!group_id) {
      return Response.json({ success: false, error: 'חסר group_id', debug: { reasonCode: 'NO_GROUP_ID' } }, { status: 400 });
    }
    if (!Array.isArray(draft_allocation_ids) || draft_allocation_ids.length === 0) {
      return Response.json({
        success: false,
        error: 'אין שיבוצי טיוטה לאישור',
        debug: { reasonCode: 'NO_DRAFT_IDS', received: draft_allocation_ids }
      }, { status: 400 });
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
      }, { status: 400 });
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

      // Rule 1: capacity
      if (draft.allocated_pax > tent.capacity) {
        errors.push(`אוהל ${tent.code}: הקצאת ${draft.allocated_pax} מקומות חורגת מהקיבולת (${tent.capacity}).`);
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
      return Response.json({ success: false, errors: uniqueErrors }, { status: 409 });
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