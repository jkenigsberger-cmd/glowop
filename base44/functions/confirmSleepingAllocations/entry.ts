import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Checks whether two date ranges overlap (departure_date is exclusive on both sides).
 * [a1, a2) overlaps [b1, b2) iff a1 < b2 && b1 < a2
 */
function datesOverlap(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { group_id, draft_allocation_ids } = body;

  if (!group_id || !Array.isArray(draft_allocation_ids) || draft_allocation_ids.length === 0) {
    return Response.json({ error: 'group_id and draft_allocation_ids are required' }, { status: 400 });
  }

  // 1. Load the draft allocations to confirm
  const allGroupAllocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id });
  const draftsToConfirm = allGroupAllocations.filter(a =>
    draft_allocation_ids.includes(a.id) && a.status === 'DRAFT'
  );

  if (draftsToConfirm.length === 0) {
    return Response.json({ error: 'No DRAFT allocations found for the given IDs' }, { status: 400 });
  }

  // 2. Load all CONFIRMED allocations from OTHER groups (for conflict checking)
  const allAllocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ status: 'CONFIRMED' });
  const otherConfirmed = allAllocations.filter(a => a.group_id !== group_id);

  // 3. Load neighborhoods for is_vip lookup
  const neighborhoods = await base44.asServiceRole.entities.Neighborhood.list();
  const neighborhoodMap = {};
  neighborhoods.forEach(n => { neighborhoodMap[n.id] = n; });

  // 4. Load tents for capacity lookup
  const tents = await base44.asServiceRole.entities.Tent.list();
  const tentMap = {};
  tents.forEach(t => { tentMap[t.id] = t; });

  const errors = [];

  for (const draft of draftsToConfirm) {
    const tent = tentMap[draft.tent_id];
    if (!tent) {
      errors.push(`אוהל לא נמצא עבור הקצאה ${draft.id}`);
      continue;
    }
    const neighborhood = neighborhoodMap[draft.neighborhood_id];
    const isVipNeighborhood = neighborhood?.is_vip === true;

    // ── Rule 1: Tent capacity ──────────────────────────────────────────────────
    if (draft.allocated_pax > tent.capacity) {
      errors.push(
        `אוהל ${tent.code}: הקצאת ${draft.allocated_pax} מקומות חורגת מהקיבולת (${tent.capacity}).`
      );
    }

    // ── Rule 2: Tent exclusivity — same tent cannot be used by another group on overlapping nights ──
    const tentConflicts = otherConfirmed.filter(o =>
      o.tent_id === draft.tent_id &&
      datesOverlap(draft.arrival_date, draft.departure_date, o.arrival_date, o.departure_date)
    );
    if (tentConflicts.length > 0) {
      errors.push(
        `אוהל ${tent.code}: כבר מוקצה לקבוצה אחרת בתאריכים אלו.`
      );
    }

    // ── Rule 3: Student neighborhood exclusivity ───────────────────────────────
    // Only applies to STUDENT allocations in non-VIP neighborhoods
    if (draft.allocation_type === 'STUDENT' && !isVipNeighborhood) {
      const neighborhoodConflicts = otherConfirmed.filter(o =>
        o.allocation_type === 'STUDENT' &&
        o.neighborhood_id === draft.neighborhood_id &&
        datesOverlap(draft.arrival_date, draft.departure_date, o.arrival_date, o.departure_date)
      );
      if (neighborhoodConflicts.length > 0) {
        errors.push(
          `שכונה "${neighborhood?.name || draft.neighborhood_id}": כבר תפוסה על ידי קבוצת חניכים אחרת בתאריכים אלו. שכונות חניכים הן בלעדיות לקבוצה אחת בכל זמן.`
        );
      }
    }

    // ── Rule 4: No mixed-gender tents ─────────────────────────────────────────
    // A tent allocated to this group in a different gender is a conflict
    // (Checked within this group's own drafts too)
    const sameGroupSameTentDifferentGender = draftsToConfirm.filter(other =>
      other.id !== draft.id &&
      other.tent_id === draft.tent_id &&
      other.gender_group !== draft.gender_group
    );
    if (sameGroupSameTentDifferentGender.length > 0) {
      errors.push(
        `אוהל ${tent.code}: לא ניתן לשבץ שני מגדרים שונים לאותו אוהל.`
      );
    }
  }

  // De-duplicate errors
  const uniqueErrors = [...new Set(errors)];

  if (uniqueErrors.length > 0) {
    return Response.json({ success: false, errors: uniqueErrors }, { status: 409 });
  }

  // 5. All checks passed — confirm all drafts
  await Promise.all(
    draftsToConfirm.map(draft =>
      base44.asServiceRole.entities.SleepingAllocation.update(draft.id, { status: 'CONFIRMED' })
    )
  );

  return Response.json({ success: true, confirmed_count: draftsToConfirm.length });
});