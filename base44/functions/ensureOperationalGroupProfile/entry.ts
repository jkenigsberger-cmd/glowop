import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureExactlyOneOperationalProfile } from '../../shared/operationalProfile.js';

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
    const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
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

    const ensured = await ensureExactlyOneOperationalProfile(base44, group, 'MULTIPLE_OPERATIONAL_PROFILES');
    return Response.json({
      success: true,
      group_id,
      operational_group_profile_id: ensured.profile.id,
      status: ensured.created ? 'created' : 'existed',
      group,
      profile: ensured.profile,
    });

  } catch (error) {
    console.error('[ensureOperationalGroupProfile] unexpected error:', error?.message, error?.stack);
    return Response.json({
      success: false,
      error: error?.code || 'INTERNAL_ERROR',
      message: error?.code === 'MULTIPLE_OPERATIONAL_PROFILES' ? 'נמצאו מספר פרופילים תפעוליים לאותה קבוצה — נדרשת בדיקת מנהל' : 'שגיאה פנימית בשרת — אנא נסה שוב',
      profile_ids: error?.profile_ids,
    }, { status: error?.code ? 409 : 500 });
  }
});