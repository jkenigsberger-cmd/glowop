import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * ensureOperationalGroupProfile
 * ------------------------------------------------------------------
 * Guarantees a Group has EXACTLY ONE OperationalGroupProfile (OGP).
 *
 * Idempotent + duplicate-safe:
 *   - 0 OGP  → create a minimal OGP linked to the group   → status "created"
 *   - 1 OGP  → return it untouched (no overwrite)          → status "existed"
 *   - >1 OGP → do NOT modify anything, return critical err → "MULTIPLE_OPERATIONAL_PROFILES"
 *
 * This function ONLY reads/writes OperationalGroupProfile (and reads Group).
 * It never mutates Group, Quote, meals, activities, or any other entity.
 *
 * It is NOT wired to any UI. It is meant to be called from write flows only:
 *   create group · approve quote · submit guest form · admin repair action.
 * ------------------------------------------------------------------
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Auth (non-fatal, service role does the work) ──────────────────────
    let user = null;
    try { user = await base44.auth.me(); } catch { /* unauthenticated — proceed with service role */ }
    if (user) {
      console.log(`[ensureOperationalGroupProfile] caller: ${user.email} role: ${user.role}`);
    }

    // ── Input ─────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { group_id } = body;

    if (!group_id || typeof group_id !== 'string') {
      return Response.json({
        success: false,
        error: 'MISSING_GROUP_ID',
        message: 'חסר מזהה קבוצה (group_id) או שאינו תקין',
      }, { status: 400 });
    }

    // ── Rule 1: Validate the group exists ─────────────────────────────────
    let group = null;
    try {
      group = await base44.asServiceRole.entities.Group.get(group_id);
    } catch { /* not found → handled below */ }

    if (!group) {
      return Response.json({
        success: false,
        error: 'GROUP_NOT_FOUND',
        message: 'הקבוצה לא נמצאה במערכת',
        group_id,
      }, { status: 404 });
    }

    // ── Rule 2: Query existing OGP by group_id ────────────────────────────
    const existingProfiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id });

    // ── Rule 5: More than one profile → critical error, no mutation ───────
    if (existingProfiles.length > 1) {
      const profileIds = existingProfiles.map(p => p.id);
      console.error(`[ensureOperationalGroupProfile] MULTIPLE_OPERATIONAL_PROFILES for group ${group_id}:`, profileIds);
      return Response.json({
        success: false,
        error: 'MULTIPLE_OPERATIONAL_PROFILES',
        message: 'נמצאו מספר פרופילים תפעוליים לאותה קבוצה — נדרשת בדיקת מנהל',
        group_id,
        profile_ids: profileIds,
        warnings: [`נמצאו ${existingProfiles.length} פרופילים תפעוליים לקבוצה זו: ${profileIds.join(', ')}`],
      }, { status: 409 });
    }

    // ── Rule 4: Exactly one profile → return it, do NOT overwrite ─────────
    if (existingProfiles.length === 1) {
      const profile = existingProfiles[0];
      return Response.json({
        success: true,
        group_id,
        operational_group_profile_id: profile.id,
        status: 'existed',
      });
    }

    // ── Rule 3: Zero profiles → create a minimal OGP ──────────────────────
    // Copy only SAFE default fields from Group when available. Never invent data.
    const now = new Date().toISOString();
    const profileData = {
      group_id,
      status: 'ACCEPTED',
      accepted_at: now,
    };
    if (group.arrival_date   != null && group.arrival_date   !== '') profileData.arrival_date   = group.arrival_date;
    if (group.departure_date != null && group.departure_date !== '') profileData.departure_date = group.departure_date;
    if (group.total_pax      != null)                                profileData.total_pax      = group.total_pax;
    if (group.internal_notes != null && group.internal_notes !== '') profileData.general_notes  = group.internal_notes;

    const created = await base44.asServiceRole.entities.OperationalGroupProfile.create(profileData);
    console.log(`[ensureOperationalGroupProfile] created OGP ${created.id} for group ${group_id}`);

    return Response.json({
      success: true,
      group_id,
      operational_group_profile_id: created.id,
      status: 'created',
    });

  } catch (error) {
    console.error('[ensureOperationalGroupProfile] unexpected error:', error?.message, error?.stack);
    return Response.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'שגיאה פנימית בשרת — אנא נסה שוב',
    }, { status: 500 });
  }
});