import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function datesOverlap(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

// Capacity is always the physical tent capacity — allocation_type never overrides it.
function getOperationalMaxPax(tent) {
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
    // Validate: if shared override requested, reason is mandatory
    if (shared_neighborhood_allowed && !shared_neighborhood_reason?.trim()) {
      return Response.json({
        success: false,
        error: 'יש לספק סיבה לאישור שכונה משותפת',
        debug: { reasonCode: 'SHARED_REASON_MISSING' }
      }, { status: 200 });
    }

    // ── 1. Load ALL draft allocations for this group from DB (source of truth) ─
    // We do NOT rely solely on frontend-supplied IDs — the frontend cache may be
    // stale and miss VIP / alt-tent rows saved in the same session.
    const allGroupAllocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id });
    const allGroupDrafts = allGroupAllocations.filter(a => a.status === 'DRAFT');

    // If frontend supplied IDs, use them as a hint; otherwise fall back to ALL group drafts.
    // Either way, the final set is every DRAFT row that belongs to this group.
    const requestedIds = Array.isArray(draft_allocation_ids) && draft_allocation_ids.length > 0
      ? new Set(draft_allocation_ids)
      : null;

    // Always confirm ALL active DRAFT rows for this group (source of truth is DB, not frontend cache)
    const finalDraftsToConfirm = allGroupDrafts;

    console.log(`[confirmSleepingAllocations] total group drafts found in DB: ${finalDraftsToConfirm.length}`);
    console.log(`[confirmSleepingAllocations] frontend requested IDs: ${draft_allocation_ids?.length ?? 0}`);

    if (finalDraftsToConfirm.length === 0) {
      return Response.json({
        success: false,
        error: 'לא נמצאו שיבוצי טיוטה לאישור — ייתכן שכבר אושרו או בוטלו',
        debug: {
          reasonCode: 'NO_DRAFTS_FOUND',
          all_statuses: allGroupAllocations.map(a => ({ id: a.id, status: a.status, type: a.allocation_type }))
        }
      }, { status: 200 });
    }

    // ── 2. Load other groups' allocations for conflict checking ──────────────
    const allConfirmed = await base44.asServiceRole.entities.SleepingAllocation.filter({ status: 'CONFIRMED' });
    const allDrafts    = await base44.asServiceRole.entities.SleepingAllocation.filter({ status: 'DRAFT' });
    const finalDraftIds = new Set(finalDraftsToConfirm.map(d => d.id));
    const otherActive  = [...allConfirmed, ...allDrafts].filter(a =>
      a.group_id !== group_id && !finalDraftIds.has(a.id)
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

    for (const draft of finalDraftsToConfirm) {
      const tent = tentMap[draft.tent_id];
      if (!tent) {
        errors.push(`שיבוץ לינה לא נמצא — אוהל חסר (id: ${draft.tent_id})`);
        continue;
      }
      const neighborhood = neighborhoodMap[draft.neighborhood_id];
      const isVip = neighborhood?.is_vip === true;

      // Rule 1: capacity
      const operationalMax = getOperationalMaxPax(tent);
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
      const genderConflict = finalDraftsToConfirm.some(other =>
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
      const nhoodIdsInBatch = new Set(finalDraftsToConfirm.map(d => d.neighborhood_id));
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
      finalDraftsToConfirm.map(draft =>
        base44.asServiceRole.entities.SleepingAllocation.update(draft.id, { status: 'CONFIRMED' })
      )
    );

    const confirmedIds = finalDraftsToConfirm.map(d => d.id);
    console.log('[confirmSleepingAllocations] confirmed IDs:', confirmedIds);

    const typeBreakdown = {
      student: finalDraftsToConfirm.filter(d => d.allocation_type === 'STUDENT').length,
      staff:   finalDraftsToConfirm.filter(d => d.allocation_type === 'STAFF').length,
    };
    console.log('[confirmSleepingAllocations] breakdown:', typeBreakdown);

    return Response.json({
      success: true,
      confirmed_count: finalDraftsToConfirm.length,
      confirmed_ids: confirmedIds,
      type_breakdown: typeBreakdown,
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