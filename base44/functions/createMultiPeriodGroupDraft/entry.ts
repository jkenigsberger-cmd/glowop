import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deriveStayEnvelope, normalizeStayPeriods, validateStayPeriods } from '../../shared/groupStayPeriods.js';

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const CONTROL_FIELDS = ['stay_mode', 'status', 'operationally_active', 'quote_preparation_flow', 'arrival_date', 'departure_date', 'arrival_time', 'departure_time', 'creation_token'];
const GROUP_FIELDS = ['group_name', 'group_type', 'total_pax', 'staff_count', 'participant_count', 'boys_count', 'girls_count', 'contact_name', 'contact_phone', 'contact_email', 'internal_notes'];
const OGP_FIELDS = ['total_pax', 'participant_count', 'staff_count', 'staff_men_count', 'staff_women_count', 'boys_count', 'girls_count', 'drivers_men_count', 'drivers_women_count', 'is_sleeping_group', 'arrival_lunch', 'departure_lunch', 'special_diets', 'meal_plan', 'tent_distribution_notes', 'schedule_requests', 'general_notes', 'boys_beds_needed', 'girls_beds_needed', 'estimated_student_tents_boys', 'estimated_student_tents_girls', 'staff_men_beds_needed', 'staff_women_beds_needed', 'vip_tents_men_needed', 'vip_tents_women_needed', 'student_sleeping_notes', 'staff_sleeping_notes', 'accessibility_sleeping_notes', 'housekeeping_sleeping_notes', 'sleeping_requirements_completed', 'boys_tent_distribution_json', 'girls_tent_distribution_json', 'staff_men_tent_distribution_json', 'staff_women_tent_distribution_json', 'vip_tent_requirements_json', 'staff_alt_tent_pax', 'staff_alt_tent_notes'];
const NUMBER_FIELDS = ['total_pax', 'staff_count', 'participant_count', 'boys_count', 'girls_count'];

function pick(source, fields) {
  return Object.fromEntries(fields.filter(key => source?.[key] !== undefined).map(key => [key, source[key]]));
}

function failure(error, message, status, groupId, phases, details = {}) {
  return Response.json({
    success: false,
    error,
    message,
    partial_failure: !!groupId,
    group_id: groupId || null,
    phases,
    retry_safe: true,
    transactional: false,
    ...details,
  }, { status });
}

export default async function(req) {
  let group = null;
  let phases = { group: 'PENDING', profile: 'PENDING', periods: 'PENDING' };
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return failure('UNAUTHORIZED', 'נדרשת התחברות למערכת', 401, null, phases);

    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const internalUser = internalUsers.find(item => item.active !== false);
    if (!internalUser || !ALLOWED_ROLES.has(internalUser.role)) {
      return failure('FORBIDDEN', 'אין הרשאה לשמירת טיוטת מכינה', 403, null, phases);
    }

    const body = await req.json();
    const groupData = body?.group_data;
    const profileData = body?.operational_profile_data ?? {};
    const idempotencyKey = String(body?.idempotency_key || '').trim();
    if (!groupData || typeof groupData !== 'object' || Array.isArray(groupData)) return failure('INVALID_GROUP_DATA', 'נתוני הקבוצה אינם תקינים', 400, null, phases);
    if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) return failure('INVALID_PROFILE_DATA', 'נתוני הפרופיל אינם תקינים', 400, null, phases);
    if (!idempotencyKey) return failure('MISSING_IDEMPOTENCY_KEY', 'חסר מפתח שמירה יציב', 400, null, phases);
    const suppliedControls = CONTROL_FIELDS.filter(key => Object.prototype.hasOwnProperty.call(groupData, key));
    if (suppliedControls.length) return failure('FORBIDDEN_OPERATIONAL_FIELDS', 'אין לשלוח ערכי שליטה תפעוליים או תאריכי מעטפת', 400, null, phases, { rejected_fields: suppliedControls });
    if (!String(groupData.group_name || '').trim()) return failure('MISSING_GROUP_NAME', 'יש להזין שם קבוצה', 400, null, phases);
    if (groupData.group_type !== 'LODGING') return failure('INVALID_GROUP_TYPE', 'טיוטת מכינה חייבת להיות קבוצת לינה', 400, null, phases);
    for (const key of NUMBER_FIELDS) {
      if (groupData[key] !== undefined && (!Number.isFinite(Number(groupData[key])) || Number(groupData[key]) < 0)) {
        return failure('INVALID_NUMBER', `הערך בשדה ${key} אינו תקין`, 400, null, phases);
      }
    }

    if (!Array.isArray(body?.periods)) return failure('PERIODS_NOT_ARRAY', 'רשימת התקופות אינה תקינה', 400, null, phases);
    if (body.periods.some(period => period?.status === 'CANCELLED')) return failure('CANCELLED_PERIOD_NOT_ALLOWED', 'לא ניתן לשמור תקופה מבוטלת ביצירה הראשונית', 400, null, phases);
    if (body.periods.some(period => period?.status && period.status !== 'ACTIVE')) return failure('INVALID_PERIOD_STATUS', 'סטטוס תקופה אינו תקין', 400, null, phases);

    const normalized = normalizeStayPeriods(body.periods).map(period => ({
      start_date: period.start_date,
      end_date: period.end_date,
      ...(period.arrival_time ? { arrival_time: String(period.arrival_time) } : {}),
      ...(period.departure_time ? { departure_time: String(period.departure_time) } : {}),
      status: 'ACTIVE',
      ...(period.notes ? { notes: String(period.notes) } : {}),
    }));
    if (!normalized.length) return failure('NO_ACTIVE_PERIODS', 'יש להוסיף לפחות תקופת שהייה פעילה אחת', 400, null, phases);
    const validation = validateStayPeriods(normalized);
    if (!validation.valid) return failure('INVALID_PERIODS', 'תקופות השהייה אינן תקינות', 400, null, phases, { validation_errors: validation.errors });
    const envelope = deriveStayEnvelope(normalized);
    const firstPeriod = normalized[0];
    const lastPeriod = normalized[normalized.length - 1];

    const groupPayload = {
      ...pick(groupData, GROUP_FIELDS),
      group_name: String(groupData.group_name).trim(),
      group_type: 'LODGING',
      stay_mode: 'MULTI_PERIOD',
      status: 'DRAFT',
      operationally_active: false,
      quote_preparation_flow: false,
      arrival_date: envelope.start_date,
      departure_date: envelope.end_date,
      ...(firstPeriod.arrival_time ? { arrival_time: firstPeriod.arrival_time } : {}),
      ...(lastPeriod.departure_time ? { departure_time: lastPeriod.departure_time } : {}),
      creation_token: idempotencyKey,
    };
    NUMBER_FIELDS.forEach(key => { if (groupPayload[key] !== undefined) groupPayload[key] = Number(groupPayload[key]); });

    const matchingGroups = await base44.asServiceRole.entities.Group.filter({ creation_token: idempotencyKey });
    if (matchingGroups.length > 1) return failure('IDEMPOTENCY_COLLISION', 'נמצאו מספר נסיונות שמירה עם אותו מפתח — נדרשת בדיקת מנהל', 409, matchingGroups[0].id, { group: 'FAILED', profile: 'PENDING', periods: 'PENDING' }, { group_ids: matchingGroups.map(item => item.id), retry_safe: false });
    let idempotent = matchingGroups.length === 1;
    if (idempotent) {
      group = matchingGroups[0];
      const sameRequest = group.group_name === groupPayload.group_name && group.arrival_date === groupPayload.arrival_date && group.departure_date === groupPayload.departure_date && group.stay_mode === 'MULTI_PERIOD' && group.status === 'DRAFT' && group.operationally_active === false && group.quote_preparation_flow === false;
      if (!sameRequest) return failure('IDEMPOTENCY_CONFLICT', 'מפתח השמירה כבר משויך לטיוטה אחרת', 409, group.id, { group: 'OK', profile: 'PENDING', periods: 'PENDING' });
    } else {
      group = await base44.asServiceRole.entities.Group.create(groupPayload);
      const afterCreate = await base44.asServiceRole.entities.Group.filter({ creation_token: idempotencyKey });
      if (afterCreate.length > 1) return failure('CONCURRENT_GROUP_DUPLICATE', 'נוצרה התנגשות שמירה מקבילית — נדרשת בדיקת מנהל', 409, group.id, { group: 'FAILED', profile: 'PENDING', periods: 'PENDING' }, { group_ids: afterCreate.map(item => item.id), retry_safe: false });
    }
    phases.group = 'OK';

    let profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: group.id });
    if (profiles.length > 1) return failure('MULTIPLE_OPERATIONAL_PROFILES', 'נמצאו מספר פרופילים לקבוצה — נדרשת בדיקת מנהל', 409, group.id, { ...phases, profile: 'FAILED' }, { profile_ids: profiles.map(item => item.id) });
    let profile = profiles[0] || null;
    if (!profile) {
      const profilePayload = { ...pick(profileData, OGP_FIELDS), group_id: group.id, status: 'ACCEPTED' };
      NUMBER_FIELDS.forEach(key => {
        if (profilePayload[key] === undefined && groupPayload[key] !== undefined) profilePayload[key] = groupPayload[key];
      });
      if (profilePayload.general_notes === undefined && groupPayload.internal_notes) profilePayload.general_notes = groupPayload.internal_notes;
      profile = await base44.asServiceRole.entities.OperationalGroupProfile.create(profilePayload);
      profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: group.id });
      if (profiles.length > 1) return failure('MULTIPLE_OPERATIONAL_PROFILES_AFTER_CREATE', 'נוצרו מספר פרופילים במקביל — נדרשת בדיקת מנהל', 409, group.id, { ...phases, profile: 'FAILED' }, { profile_ids: profiles.map(item => item.id) });
    }
    phases.profile = 'OK';

    const existingPeriods = await base44.asServiceRole.entities.GroupStayPeriod.filter({ group_id: group.id });
    const requestedByKey = new Map(normalized.map(period => [`${period.start_date}|${period.end_date}`, period]));
    const byStableKey = new Map();
    for (const period of existingPeriods) {
      const key = `${period.start_date}|${period.end_date}`;
      if (byStableKey.has(key)) return failure('DUPLICATE_STORED_PERIOD', 'נמצאו תקופות כפולות שמורות — נדרשת בדיקת מנהל', 409, group.id, { ...phases, periods: 'FAILED' }, { period_key: key });
      const requested = requestedByKey.get(key);
      if (!requested || (period.arrival_time || '') !== (requested.arrival_time || '') || (period.departure_time || '') !== (requested.departure_time || '')) {
        return failure('IDEMPOTENCY_PERIOD_CONFLICT', 'מפתח השמירה כבר משויך לרשימת תקופות אחרת', 409, group.id, { ...phases, periods: 'FAILED' }, { period_key: key });
      }
      byStableKey.set(key, period);
    }
    const savedPeriods = [];
    for (const period of normalized) {
      const key = `${period.start_date}|${period.end_date}`;
      let saved = byStableKey.get(key);
      if (!saved) {
        saved = await base44.asServiceRole.entities.GroupStayPeriod.create({ ...period, group_id: group.id });
        byStableKey.set(key, saved);
      }
      savedPeriods.push(saved);
    }
    phases.periods = 'OK';

    return Response.json({
      success: true,
      partial_failure: false,
      retry_safe: true,
      transactional: false,
      idempotent,
      group_id: group.id,
      phases,
      group,
      operational_group_profile: profile,
      periods: savedPeriods,
      idempotency: { mechanism: 'Group.creation_token + staged child checks', concurrent_uniqueness_guaranteed: false },
    });
  } catch (error) {
    const failedPhase = phases.group !== 'OK' ? 'group' : phases.profile !== 'OK' ? 'profile' : 'periods';
    phases = { ...phases, [failedPhase]: 'FAILED' };
    console.error('[createMultiPeriodGroupDraft] failed:', error?.message, error?.stack);
    return failure('SAVE_FAILED', 'שמירת טיוטת המכינה נכשלה. ניתן לנסות שוב עם אותו מפתח שמירה.', 500, group?.id || null, phases, { details: error?.message || 'Unknown error' });
  }
}