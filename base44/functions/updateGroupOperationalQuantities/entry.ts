import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  QUANTITY_FIELDS, validateQuantityPayload, israelNowParts, serviceTiming,
  quantitySnapshot, generalMealQuantity, activeAllocationSummary,
} from '../../shared/quantitySyncCore.js';

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const PHASE_NAMES = ['group', 'profile', 'meals', 'coffee', 'prisa', 'activities', 'sleeping_review'];
const normalize = value => String(value || '').trim().toLowerCase();
const sameNumber = (a, b) => Number(a) === Number(b);
const changedFields = (before, after) => QUANTITY_FIELDS.filter(field => !sameNumber(before?.[field], after[field]));
const descriptor = (entity, record, field, from, to, reason) => ({ entity, id: record.id, field, from, to, reason });

function baseResult(groupId) {
  return {
    success: false,
    group_id: groupId || null,
    phases: Object.fromEntries(PHASE_NAMES.map(name => [name, 'PENDING'])),
    updated: [], preserved_manual: [], skipped_historical: [], warnings: [],
  };
}

async function resolveRole(base44, user) {
  const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: normalize(user.email) });
  const internal = rows.find(item => normalize(item.email) === normalize(user.email) && item.active !== false);
  return internal?.role || user.role;
}

async function ensureJournal(base44, groupId, key, oldGroup, oldProfile, quantities) {
  const rows = await base44.asServiceRole.entities.OperationalReviewAlert.filter({
    group_id: groupId, module: 'GROUP', source: 'GROUP_PAX_CHANGED', status: 'OPEN',
  });
  const current = rows[0] || null;
  if (current) {
    try {
      const stored = JSON.parse(current.new_value_json || '{}');
      if (stored.idempotency_key === key) {
        const previous = JSON.parse(current.previous_value_json || '{}');
        return { alert: current, previous, retry: true };
      }
    } catch { /* replace malformed journal below */ }
  }
  const previous = { group: quantitySnapshot(oldGroup), profile: quantitySnapshot(oldProfile) };
  const payload = {
    title: 'שינוי בכמויות הקבוצה דורש בדיקה',
    message: 'כמויות הקבוצה עודכנו בעריכת מנהל. יש לבדוק שירותים תפעוליים ושיבוצי לינה.',
    previous_value_json: JSON.stringify(previous),
    new_value_json: JSON.stringify({ idempotency_key: key, quantities }),
    severity: 'WARNING', status: 'OPEN',
  };
  const alert = current
    ? await base44.asServiceRole.entities.OperationalReviewAlert.update(current.id, payload)
    : await base44.asServiceRole.entities.OperationalReviewAlert.create({
        group_id: groupId, module: 'GROUP', source: 'GROUP_PAX_CHANGED', ...payload,
      });
  return { alert, previous, retry: false };
}

function classifyBase(record, result, entityName, nowParts) {
  if (record.status === 'CANCELLED') {
    result.skipped_historical.push({ entity: entityName, id: record.id, reason: 'CANCELLED' });
    return false;
  }
  const timing = serviceTiming(record, nowParts);
  if (!timing.eligible) {
    result.skipped_historical.push({ entity: entityName, id: record.id, reason: timing.reason });
    if (timing.reason === 'TODAY_TIME_UNKNOWN') result.warnings.push(`${entityName} ${record.id}: לא ניתן לקבוע אם השירות של היום כבר התחיל`);
    return false;
  }
  return true;
}

async function syncMeals(base44, groupId, previous, quantities, result, nowParts) {
  const rows = await base44.asServiceRole.entities.MealReservation.filter({ group_id: groupId });
  const oldCandidates = new Set([generalMealQuantity(previous.group), generalMealQuantity(previous.profile)]);
  const target = quantities.participant_count + quantities.staff_count;
  const updates = [];
  for (const row of rows) {
    if (!classifyBase(row, result, 'MealReservation', nowParts)) continue;
    if (row.source === 'manual') {
      result.preserved_manual.push({ entity: 'MealReservation', id: row.id, field: 'pax', value: row.pax, reason: 'source=manual' });
      continue;
    }
    if (!oldCandidates.has(Number(row.pax))) {
      result.preserved_manual.push({ entity: 'MealReservation', id: row.id, field: 'pax', value: row.pax, reason: 'service-specific quantity' });
      continue;
    }
    if (!sameNumber(row.pax, target)) {
      updates.push({ id: row.id, pax: target });
      result.updated.push(descriptor('MealReservation', row, 'pax', row.pax, target, row.source));
    }
  }
  if (updates.length) await base44.asServiceRole.entities.MealReservation.bulkUpdate(updates);
}

async function syncCoffee(base44, groupId, previous, quantities, result, nowParts) {
  const rows = await base44.asServiceRole.entities.CoffeeCornerRequest.filter({ group_id: groupId });
  const oldCandidates = new Set([generalMealQuantity(previous.group), generalMealQuantity(previous.profile)]);
  const target = quantities.participant_count + quantities.staff_count;
  const updates = [];
  for (const row of rows) {
    if (!classifyBase(row, result, 'CoffeeCornerRequest', nowParts)) continue;
    if (row.source !== 'external_form') {
      result.preserved_manual.push({ entity: 'CoffeeCornerRequest', id: row.id, field: 'pax', value: row.pax, reason: `source=${row.source || 'unknown'}` });
      continue;
    }
    if (!oldCandidates.has(Number(row.pax))) {
      result.preserved_manual.push({ entity: 'CoffeeCornerRequest', id: row.id, field: 'pax', value: row.pax, reason: 'service-specific quantity' });
      continue;
    }
    if (!sameNumber(row.pax, target)) {
      updates.push({ id: row.id, pax: target });
      result.updated.push(descriptor('CoffeeCornerRequest', row, 'pax', row.pax, target, 'external_form'));
    }
  }
  if (updates.length) await base44.asServiceRole.entities.CoffeeCornerRequest.bulkUpdate(updates);
}

async function inspectPrisa(base44, groupId, result, nowParts) {
  const rows = await base44.asServiceRole.entities.PrisaRequest.filter({ group_id: groupId });
  for (const row of rows) {
    if (row.status === 'CANCELLED' || row.date < nowParts.date) {
      result.skipped_historical.push({ entity: 'PrisaRequest', id: row.id, reason: row.status === 'CANCELLED' ? 'CANCELLED' : 'HISTORICAL' });
      continue;
    }
    if (row.date === nowParts.date) {
      result.warnings.push(`PrisaRequest ${row.id}: אין שעת התחלה שמאפשרת לקבוע בבטחה אם השירות של היום התחיל`);
    }
    result.preserved_manual.push({ entity: 'PrisaRequest', id: row.id, fields: ['quantity', 'effective_quantity'], reason: `source=${row.source || 'unknown'} אינו מבחין בין ברירת מחדל לחריגה ידנית` });
  }
  if (rows.some(row => row.status === 'ACTIVE' && row.date >= nowParts.date)) {
    result.warnings.push('בקשות פריסה פעילות נשמרו ללא שינוי: הסכמה הקיימת אינה מבדילה בבטחה בין כמות אוטומטית לחריגה ידנית');
  }
}

async function syncActivities(base44, groupId, previous, quantities, result, nowParts) {
  const rows = await base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id: groupId });
  const oldTotal = new Set([previous.group.total_pax, previous.profile.total_pax]);
  const oldParticipants = new Set([previous.group.participant_count, previous.profile.participant_count]);
  const updates = [];
  for (const row of rows) {
    if (!classifyBase(row, result, 'GroupScheduleItem', nowParts)) continue;
    if (row.source !== 'groupSync') {
      result.preserved_manual.push({ entity: 'GroupScheduleItem', id: row.id, field: 'pax', value: row.pax, reason: `source=${row.source || 'unknown'}` });
      continue;
    }
    let target = null;
    if (oldParticipants.has(Number(row.pax))) target = quantities.participant_count;
    else if (oldTotal.has(Number(row.pax))) target = quantities.total_pax;
    if (target == null) {
      result.preserved_manual.push({ entity: 'GroupScheduleItem', id: row.id, field: 'pax', value: row.pax, reason: 'activity-specific quantity' });
      continue;
    }
    if (!sameNumber(row.pax, target)) {
      updates.push({ id: row.id, pax: target });
      result.updated.push(descriptor('GroupScheduleItem', row, 'pax', row.pax, target, 'groupSync'));
    }
  }
  if (updates.length) await base44.asServiceRole.entities.GroupScheduleItem.bulkUpdate(updates);
}

export default async function(req) {
  const result = baseResult(null);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ...result, error: 'UNAUTHORIZED', message: 'נדרשת התחברות' }, { status: 401 });
    const role = await resolveRole(base44, user);
    if (!ALLOWED_ROLES.has(role)) return Response.json({ ...result, error: 'FORBIDDEN', message: 'אין הרשאה לעדכון כמויות קבוצה' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { group_id: groupId, quantities, source, idempotency_key: idempotencyKey } = body;
    result.group_id = groupId || null;
    if (source !== 'ADMIN_EDIT') return Response.json({ ...result, error: 'INVALID_SOURCE', message: 'מקור העדכון אינו מורשה בשלב זה' }, { status: 400 });
    if (!groupId) return Response.json({ ...result, error: 'MISSING_GROUP_ID', message: 'חסר מזהה קבוצה' }, { status: 400 });
    if (!idempotencyKey || typeof idempotencyKey !== 'string') return Response.json({ ...result, error: 'MISSING_IDEMPOTENCY_KEY', message: 'חסר מפתח שמירה ייחודי' }, { status: 400 });

    const group = await base44.asServiceRole.entities.Group.get(groupId).catch(() => null);
    if (!group) return Response.json({ ...result, error: 'GROUP_NOT_FOUND', message: 'הקבוצה לא נמצאה' }, { status: 404 });
    const validationMessage = validateQuantityPayload(quantities, group.group_type);
    if (validationMessage) return Response.json({ ...result, error: 'VALIDATION_ERROR', message: validationMessage }, { status: 400 });

    const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: groupId });
    if (profiles.length !== 1) {
      return Response.json({ ...result, error: 'OPERATIONAL_PROFILE_REPAIR_REQUIRED', message: profiles.length === 0 ? 'לא נמצא פרופיל תפעולי אחד לקבוצה — נדרש תיקון מנהל' : 'נמצאו מספר פרופילים תפעוליים לקבוצה — נדרש תיקון מנהל', profile_count: profiles.length }, { status: 409 });
    }
    const profile = profiles[0];

    let journal;
    try {
      journal = await ensureJournal(base44, groupId, idempotencyKey, group, profile, quantities);
    } catch (error) {
      return Response.json({ ...result, error: 'IDEMPOTENCY_JOURNAL_FAILED', message: 'לא ניתן להכין שמירה בטוחה לחזרה — לא בוצע עדכון', details: error.message }, { status: 500 });
    }
    const previous = journal.previous;
    const quantityChanges = [...new Set([...changedFields(previous.group, quantities), ...changedFields(previous.profile, quantities)])];
    if (previous.group && previous.profile && JSON.stringify(previous.group) !== JSON.stringify(previous.profile)) {
      result.warnings.push('לפני העדכון נמצאה אי-התאמה בין הקבוצה לפרופיל התפעולי');
    }

    try {
      await base44.asServiceRole.entities.Group.update(groupId, Object.fromEntries(QUANTITY_FIELDS.map(field => [field, quantities[field]])));
      result.phases.group = 'OK';
    } catch (error) {
      result.phases.group = 'FAILED';
      return Response.json({ ...result, partial_failure: false, error: 'GROUP_UPDATE_FAILED', message: 'עדכון כמויות הקבוצה נכשל', details: error.message }, { status: 500 });
    }

    const oldStaffSplitValid = Number(profile.staff_men_count ?? 0) + Number(profile.staff_women_count ?? 0) === quantities.staff_count
      && profile.staff_men_count != null && profile.staff_women_count != null;
    const sleepingRelevantChanged = group.group_type === 'LODGING' && quantityChanges.length > 0;
    const profilePayload = Object.fromEntries(QUANTITY_FIELDS.map(field => [field, quantities[field]]));
    if (!oldStaffSplitValid) {
      profilePayload.staff_men_count = null;
      profilePayload.staff_women_count = null;
      if (profile.staff_men_count != null || profile.staff_women_count != null) result.warnings.push('מספר אנשי הצוות השתנה. יש לעדכן מחדש את חלוקת הלינה לצוות.');
    }
    if (sleepingRelevantChanged) profilePayload.sleeping_requirements_completed = false;

    try {
      await base44.asServiceRole.entities.OperationalGroupProfile.update(profile.id, profilePayload);
      result.phases.profile = 'OK';
    } catch (error) {
      result.phases.profile = 'FAILED';
      return Response.json({ ...result, partial_failure: true, error: 'PROFILE_UPDATE_FAILED', message: 'הקבוצה עודכנה אך עדכון הפרופיל התפעולי נכשל. ניתן לנסות שוב בבטחה.', details: error.message }, { status: 500 });
    }

    const nowParts = israelNowParts();
    const phases = [
      ['meals', () => syncMeals(base44, groupId, previous, quantities, result, nowParts)],
      ['coffee', () => syncCoffee(base44, groupId, previous, quantities, result, nowParts)],
      ['prisa', () => inspectPrisa(base44, groupId, result, nowParts)],
      ['activities', () => syncActivities(base44, groupId, previous, quantities, result, nowParts)],
    ];
    for (const [name, operation] of phases) {
      try { await operation(); result.phases[name] = 'OK'; }
      catch (error) { result.phases[name] = 'FAILED'; result.warnings.push(`${name}: הסנכרון נכשל — ${error.message}`); }
    }

    try {
      const allocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id: groupId });
      const summary = activeAllocationSummary(allocations);
      if (summary.count > 0) {
        if (summary.staff !== quantities.staff_count) result.warnings.push(`שיבוצי צוות קיימים נשמרו: שובצו ${summary.staff} מתוך ${quantities.staff_count} אנשי צוות`);
        if (summary.students !== quantities.participant_count) result.warnings.push(`שיבוצי חניכים קיימים נשמרו: שובצו ${summary.students} מתוך ${quantities.participant_count} חניכים`);
        if (summary.mixed === 0 && summary.boys !== quantities.boys_count) result.warnings.push(`שיבוצי בנים קיימים (${summary.boys}) אינם תואמים לדרישה החדשה (${quantities.boys_count})`);
        if (summary.mixed === 0 && summary.girls !== quantities.girls_count) result.warnings.push(`שיבוצי בנות קיימים (${summary.girls}) אינם תואמים לדרישה החדשה (${quantities.girls_count})`);
        if (summary.mixed > 0) result.warnings.push('קיימים שיבוצי חניכים מעורבים שלא ניתן להשוות בבטחה לחלוקת בנים ובנות');
      }
      if (sleepingRelevantChanged) {
        result.warnings.push('דרישות הלינה סומנו לבדיקה מחדש; דרישות VIP, תכנוני אוהלים ושיבוצים קיימים נשמרו');
        result.phases.sleeping_review = 'REQUIRED';
      } else result.phases.sleeping_review = 'OK';
    } catch (error) {
      result.phases.sleeping_review = 'FAILED';
      result.warnings.push(`בדיקת שיבוצי הלינה נכשלה — ${error.message}`);
    }

    const failed = Object.values(result.phases).some(value => value === 'FAILED' || value === 'PENDING');
    result.success = !failed;
    return Response.json({ ...result, partial_failure: failed, idempotent_retry: journal.retry }, { status: failed ? 500 : 200 });
  } catch (error) {
    return Response.json({ ...result, error: 'INTERNAL_ERROR', message: 'שגיאה פנימית בעדכון הכמויות', details: error.message }, { status: 500 });
  }
}