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

    // ── Auth — REQUIRED. This standalone endpoint must not be openly callable ──
    let user = null;
    try { user = await base44.auth.me(); } catch { /* handled below */ }
    if (!user) {
      return Response.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'נדרשת התחברות',
      }, { status: 401 });
    }

    // Resolve effective role from InternalUser (falls back to platform role)
    const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);
    let effectiveRole = user.role;
    try {
      const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
      if (internalUsers[0]?.role) effectiveRole = internalUsers[0].role;
    } catch { /* fall back to platform role */ }

    if (!ALLOWED_ROLES.has(effectiveRole)) {
      return Response.json({
        success: false,
        error: 'FORBIDDEN',
        message: 'אין הרשאה לפעולה זו',
      }, { status: 403 });
    }
    console.log(`[ensureOperationalGroupProfile] caller: ${user.email} role: ${effectiveRole}`);

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
    // status "ACCEPTED" is the schema's only allowed enum value and is required.
    // accepted_at is intentionally OMITTED here — this profile is auto-ensured,
    // not explicitly accepted by an admin, so we avoid a misleading timestamp.
    const profileData = {
      group_id,
      status: 'ACCEPTED',
    };
    if (group.arrival_date   != null && group.arrival_date   !== '') profileData.arrival_date   = group.arrival_date;
    if (group.departure_date != null && group.departure_date !== '') profileData.departure_date = group.departure_date;
    if (group.total_pax      != null)                                profileData.total_pax      = group.total_pax;
    if (group.internal_notes != null && group.internal_notes !== '') profileData.general_notes  = group.internal_notes;

    const created = await base44.asServiceRole.entities.OperationalGroupProfile.create(profileData);
    console.log(`[ensureOperationalGroupProfile] created OGP ${created.id} for group ${group_id}`);

    // ── Post-create duplicate safety check (no DB transactions/unique keys) ──
    // A concurrent call could have created a second OGP. Re-query and verify.
    const afterCreate = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id });
    if (afterCreate.length > 1) {
      const profileIds = afterCreate.map(p => p.id);
      console.error(`[ensureOperationalGroupProfile] MULTIPLE_OPERATIONAL_PROFILES_AFTER_CREATE for group ${group_id}:`, profileIds);
      return Response.json({
        success: false,
        error: 'MULTIPLE_OPERATIONAL_PROFILES_AFTER_CREATE',
        message: 'נוצרו מספר פרופילים תפעוליים במקביל — נדרשת בדיקת מנהל (לא נמחק דבר)',
        group_id,
        profile_ids: profileIds,
        warnings: [`נמצאו ${afterCreate.length} פרופילים לאחר יצירה: ${profileIds.join(', ')}`],
      }, { status: 409 });
    }

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