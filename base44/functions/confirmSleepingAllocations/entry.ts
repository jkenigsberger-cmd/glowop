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

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ success: false, error: 'בקשה לא תקינה — JSON שגוי' }, { status: 200 });
    }

    const { group_id, draft_allocation_ids, shared_neighborhood_allowed, shared_neighborhood_reason } = body;

    console.log('[confirmSleepingAllocations] group_id:', group_id);
    console.log('[confirmSleepingAllocations] draft_allocation_ids:', JSON.stringify(draft_allocation_ids));
    console.log('[confirmSleepingAllocations] shared_neighborhood_allowed:', shared_neighborhood_allowed);

    if (!group_id) {
      return Response.json({ success: false, error: 'חסר group_id', debug: { reasonCode: 'NO_GROUP_ID' } }, { status: 200 });
    }
    if (!Array.isArray(draft_allocation_ids) || draft_allocation_ids.length === 0) {
      return Response.json({
        success: false,
        error: 'אין הקצאות לאישור',
        debug: { reasonCode: 'NO_DRAFT_IDS', received: draft_allocation_ids }
      }, { status: 200 });
    }

    // Validate: if shared override requested, reason is mandatory
    if (shared_neighborhood_allowed && !shared_neighborhood_reason?.trim()) {
      return Response.json({
        success: false,
        error: 'יש לספק סיבה לאישור שכונה משותפת',
        debug: { reasonCode: 'SHARED_REASON_MISSING' }
      }, { status: 200 });
    }

    // ── 1. Load draft allocations for this group ──────────────────────────────
    const allGroupAllocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id });
    const draftsToConfirm = allGroupAllocations.filter(a =>
      draft_allocation_ids.includes(a.id) && a.status === 'DRAFT'
    );

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

    // ── 4. Load neighborhood reservations for shared override check ──────────
    // Check if the current group already has shared_neighborhood_allowed on any active reservation
    const myNhoodReservations = await base44.asServiceRole.entities.NeighborhoodReservation.filter({ group_id, status: 'ACTIVE' });
    const sharedNhoodIds = new Set(
      myNhoodReservations
        .filter(r => r.shared_neighborhood_allowed === true)
        .map(r => r.neighborhood_id)
    );

    // ── 5. Validate each draft ────────────────────────────────────────────────
    const errors = [];
    const neighborhoodConflictBlocked = []; // track nhood conflicts that need shared override

    for (const draft of draftsToConfirm) {
      const tent = tentMap[draft.tent_id];
      if (!tent) {
        errors.push(`שיבוץ לינה לא נמצא — אוהל חסר (id: ${draft.tent_id})`);
        continue;
      }
      const neighborhood = neighborhoodMap[draft.neighborhood_id];
      const isVip = neighborhood?.is_vip === true;

      // Rule 1: capacity
      const operationalMax = getOperationalMaxPax(tent, draft);
      if (draft.allocated_pax > operationalMax) {
        errors.push(`אוהל ${tent.code}: כמות האנשים (${draft.allocated_pax}) גדולה מהמקסימום התפעולי (${operationalMax}).`);
      }

      // Rule 2: EXACT TENT exclusivity — ALWAYS hard-blocked, even with shared override
      const tentConflicts = otherActive.filter(o =>
        o.tent_id === draft.tent_id &&
        datesOverlap(draft.arrival_date, draft.departure_date, o.arrival_date, o.departure_date)
      );
      if (tentConflicts.length > 0) {
        errors.push(`לא ניתן לשבץ את אותו אוהל לשתי קבוצות באותם תאריכים. (אוהל ${tent.code})`);
      }

      // Rule 3: student neighborhood exclusivity (non-VIP only)
      // Bypassed if: shared_neighborhood_allowed is true (passed in request) OR already stored on reservation
      if (draft.allocation_type === 'STUDENT' && !isVip) {
        const nhoodConflicts = otherActive.filter(o =>
          o.allocation_type === 'STUDENT' &&
          o.neighborhood_id === draft.neighborhood_id &&
          datesOverlap(draft.arrival_date, draft.departure_date, o.arrival_date, o.departure_date)
        );
        if (nhoodConflicts.length > 0) {
          const isSharedAllowed = shared_neighborhood_allowed || sharedNhoodIds.has(draft.neighborhood_id);
          if (!isSharedAllowed) {
            neighborhoodConflictBlocked.push(neighborhood?.name || draft.neighborhood_id);
            errors.push(`שכונה "${neighborhood?.name || draft.neighborhood_id}": כבר תפוסה על ידי קבוצת חניכים אחרת בתאריכים אלו.`);
          }
          // If shared allowed — pass through (tent check above still guards)
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
      const needsSharedOverride = neighborhoodConflictBlocked.length > 0 && !uniqueErrors.some(e => e.includes('לא ניתן לשבץ את אותו אוהל'));
      return Response.json({
        success: false,
        errors: uniqueErrors,
        needs_shared_override: needsSharedOverride,
        blocked_neighborhoods: [...new Set(neighborhoodConflictBlocked)],
      }, { status: 200 });
    }

    // ── 6. If shared override was used, update the neighborhood reservation ──
    if (shared_neighborhood_allowed && shared_neighborhood_reason?.trim()) {
      const now = new Date().toISOString();
      const approvedBy = user?.email || 'unknown';

      // Update all matching active NhoodReservations for this group that are in a shared context
      const nhoodIdsInBatch = new Set(draftsToConfirm.map(d => d.neighborhood_id));
      for (const nhoodId of nhoodIdsInBatch) {
        const res = myNhoodReservations.find(r => r.neighborhood_id === nhoodId);
        if (res) {
          await base44.asServiceRole.entities.NeighborhoodReservation.update(res.id, {
            shared_neighborhood_allowed: true,
            shared_neighborhood_reason: shared_neighborhood_reason.trim(),
            shared_neighborhood_approved_by: approvedBy,
            shared_neighborhood_approved_at: now,
          });
        }
      }
      console.log(`[confirmSleepingAllocations] shared override recorded by ${approvedBy} for neighborhoods: ${[...nhoodIdsInBatch].join(', ')}`);
    }

    // ── 7. Confirm all drafts ─────────────────────────────────────────────────
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
      shared_override_used: !!(shared_neighborhood_allowed && shared_neighborhood_reason),
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