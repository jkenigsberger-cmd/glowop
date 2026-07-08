import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * createGroupWithOperationalProfile
 * ------------------------------------------------------------------
 * Phase B — manual group creation with guaranteed operational profile.
 *
 * When a manual group is created, this function creates BOTH:
 *   1. Group
 *   2. OperationalGroupProfile (OGP)
 *
 * so a manually created group can never exist without an OGP.
 *
 * Behaviour:
 *   - Validates required Group fields (per current schema).
 *   - Creates the Group.
 *   - Ensures EXACTLY ONE OGP for that group (reuses the same ensure logic
 *     as ensureOperationalGroupProfile — idempotent, duplicate-safe).
 *   - If ogp_data is provided, safely updates the created OGP with valid
 *     operational fields only.
 *
 * Safe-failure model (no DB transactions available):
 *   - If Group is created but OGP creation fails, we DO NOT hide it:
 *     we return an error that includes the created group_id so the partial
 *     state is visible and the caller can retry/repair.
 *   - Idempotency: the platform provides no client_request_id / unique key,
 *     so this function cannot detect "same logical create retried" by itself.
 *     It therefore does NOT dedupe groups by name (names may repeat).
 *     The ensure step still guarantees no duplicate OGP per group_id.
 *
 * This function ONLY writes Group + OperationalGroupProfile. It is NOT wired
 * to any UI in this phase.
 * ------------------------------------------------------------------
 */

// Roles allowed to create groups
const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);

// Valid Group fields we accept (mirrors Group schema — no invented fields)
const GROUP_FIELDS = [
  'group_name', 'group_type', 'arrival_date', 'departure_date',
  'arrival_time', 'departure_time',
  'total_pax', 'staff_count', 'participant_count', 'boys_count', 'girls_count',
  'contact_name', 'contact_phone', 'contact_email', 'internal_notes', 'status',
];

// Valid operational fields we accept into the OGP (mirrors OGP schema).
// group_id / quote_id / guest_form_submission_id / status / accepted_* are
// intentionally NOT in this list — they are managed by the ensure logic.
const OGP_FIELDS = [
  'total_pax', 'participant_count', 'staff_count',
  'staff_men_count', 'staff_women_count',
  'boys_count', 'girls_count',
  'drivers_men_count', 'drivers_women_count',
  'is_sleeping_group', 'arrival_lunch', 'departure_lunch',
  'special_diets', 'meal_plan', 'tent_distribution_notes',
  'schedule_requests', 'general_notes',
  'boys_beds_needed', 'girls_beds_needed',
  'estimated_student_tents_boys', 'estimated_student_tents_girls',
  'staff_men_beds_needed', 'staff_women_beds_needed',
  'vip_tents_men_needed', 'vip_tents_women_needed',
  'student_sleeping_notes', 'staff_sleeping_notes',
  'accessibility_sleeping_notes', 'housekeeping_sleeping_notes',
  'sleeping_requirements_completed',
  'boys_tent_distribution_json', 'girls_tent_distribution_json',
  'staff_men_tent_distribution_json', 'staff_women_tent_distribution_json',
  'vip_tent_requirements_json', 'staff_alt_tent_pax', 'staff_alt_tent_notes',
];

function pick(source, allowedKeys) {
  const out = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Auth — required ────────────────────────────────────────────────────
    let user = null;
    try { user = await base44.auth.me(); } catch { /* handled below */ }
    if (!user) {
      return Response.json({ success: false, error: 'UNAUTHORIZED', message: 'נדרשת התחברות' }, { status: 401 });
    }

    let effectiveRole = user.role;
    try {
      const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
      if (internalUsers[0]?.role) effectiveRole = internalUsers[0].role;
    } catch { /* fall back to platform role */ }

    if (!ALLOWED_ROLES.has(effectiveRole)) {
      return Response.json({ success: false, error: 'FORBIDDEN', message: 'אין הרשאה ליצירת קבוצה' }, { status: 403 });
    }

    // ── Input ──────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const group_data = body?.group_data;
    const ogp_data = body?.ogp_data;

    if (!group_data || typeof group_data !== 'object') {
      return Response.json({
        success: false, error: 'MISSING_GROUP_DATA', message: 'חסר group_data או שאינו תקין',
      }, { status: 400 });
    }
    if (ogp_data !== undefined && (ogp_data === null || typeof ogp_data !== 'object')) {
      return Response.json({
        success: false, error: 'INVALID_OGP_DATA', message: 'ogp_data חייב להיות אובייקט',
      }, { status: 400 });
    }

    // ── Validate required Group fields (per schema) ────────────────────────
    // Required: group_name, group_type, arrival_date, status.
    const missing = [];
    if (!group_data.group_name || String(group_data.group_name).trim() === '') missing.push('group_name');
    if (!group_data.arrival_date) missing.push('arrival_date');
    if (missing.length > 0) {
      return Response.json({
        success: false, error: 'MISSING_REQUIRED_GROUP_FIELDS',
        message: `חסרים שדות חובה בקבוצה: ${missing.join(', ')}`, missing_fields: missing,
      }, { status: 400 });
    }

    // group_type / status: default to safe schema values if not provided
    const groupPayload = pick(group_data, GROUP_FIELDS);
    if (!groupPayload.group_type) groupPayload.group_type = 'LODGING';
    if (!groupPayload.status) groupPayload.status = 'DRAFT';

    if (!['LODGING', 'DAY_USE'].includes(groupPayload.group_type)) {
      return Response.json({
        success: false, error: 'INVALID_GROUP_TYPE',
        message: 'group_type חייב להיות LODGING או DAY_USE',
      }, { status: 400 });
    }

    // ── Step 1: Create the Group ───────────────────────────────────────────
    let group;
    try {
      group = await base44.asServiceRole.entities.Group.create(groupPayload);
    } catch (err) {
      console.error('[createGroupWithOperationalProfile] group create failed:', err?.message);
      return Response.json({
        success: false, error: 'GROUP_CREATE_FAILED', message: 'יצירת הקבוצה נכשלה',
      }, { status: 500 });
    }
    const group_id = group.id;

    // ── Step 2: Ensure exactly one OGP (same logic as ensureOperationalGroupProfile) ──
    // A group we just created should have 0 OGPs; this creates a minimal one.
    // accepted_at intentionally omitted — auto-ensured, not explicitly accepted.
    const warnings = [];
    let ogp;
    try {
      const existing = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id });

      if (existing.length > 1) {
        const ids = existing.map(p => p.id);
        return Response.json({
          success: false, error: 'MULTIPLE_OPERATIONAL_PROFILES',
          message: 'נמצאו מספר פרופילים תפעוליים לקבוצה החדשה — נדרשת בדיקת מנהל',
          group_id, profile_ids: ids,
        }, { status: 409 });
      }

      if (existing.length === 1) {
        ogp = existing[0];
        warnings.push('קיים כבר פרופיל תפעולי לקבוצה — נעשה שימוש בקיים');
      } else {
        const profileData = { group_id, status: 'ACCEPTED' };
        if (group.arrival_date)   profileData.arrival_date   = group.arrival_date;
        if (group.departure_date) profileData.departure_date = group.departure_date;
        if (group.total_pax != null) profileData.total_pax   = group.total_pax;
        if (group.internal_notes) profileData.general_notes  = group.internal_notes;
        ogp = await base44.asServiceRole.entities.OperationalGroupProfile.create(profileData);

        // Post-create duplicate safety check
        const after = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id });
        if (after.length > 1) {
          const ids = after.map(p => p.id);
          console.error('[createGroupWithOperationalProfile] MULTIPLE_OPERATIONAL_PROFILES_AFTER_CREATE:', ids);
          return Response.json({
            success: false, error: 'MULTIPLE_OPERATIONAL_PROFILES_AFTER_CREATE',
            message: 'נוצרו מספר פרופילים תפעוליים במקביל — נדרשת בדיקת מנהל (לא נמחק דבר)',
            group_id, profile_ids: ids,
          }, { status: 409 });
        }
      }
    } catch (err) {
      // Group was created but OGP failed — DO NOT hide the partial state.
      console.error('[createGroupWithOperationalProfile] OGP ensure failed after group create:', err?.message);
      return Response.json({
        success: false, error: 'OGP_CREATE_FAILED_AFTER_GROUP',
        message: 'הקבוצה נוצרה אך יצירת הפרופיל התפעולי נכשלה — יש להריץ שוב או לתקן ידנית',
        group_id,
      }, { status: 500 });
    }

    // ── Step 3: Optionally apply ogp_data (valid operational fields only) ──
    if (ogp_data && typeof ogp_data === 'object') {
      const ogpUpdate = pick(ogp_data, OGP_FIELDS);
      if (Object.keys(ogpUpdate).length > 0) {
        try {
          ogp = await base44.asServiceRole.entities.OperationalGroupProfile.update(ogp.id, ogpUpdate);
        } catch (err) {
          console.warn('[createGroupWithOperationalProfile] ogp_data update failed (non-fatal):', err?.message);
          warnings.push('הקבוצה והפרופיל נוצרו, אך עדכון נתוני הפרופיל התפעולי נכשל');
        }
      }
    }

    return Response.json({
      success: true,
      group_id,
      operational_group_profile_id: ogp.id,
      status: 'created',
      ...(warnings.length > 0 ? { warnings } : {}),
    });

  } catch (error) {
    console.error('[createGroupWithOperationalProfile] unexpected error:', error?.message, error?.stack);
    return Response.json({
      success: false, error: 'INTERNAL_ERROR', message: 'שגיאה פנימית בשרת — אנא נסה שוב',
    }, { status: 500 });
  }
});