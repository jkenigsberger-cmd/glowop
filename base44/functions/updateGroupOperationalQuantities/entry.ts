import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  QUANTITY_FIELDS, SLEEPING_QUANTITY_FIELDS, validateQuantityPayload,
  normalizeQuantities, quantityRequestFingerprint, operationDecision,
  classifyMealSource, classifyCoffeeSource, classifyActivitySource,
  changedQuantityFields, israelNowParts, serviceTiming, generalMealQuantity,
  activeAllocationSummary,
} from '../../shared/quantitySyncCore.js';

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const PHASE_NAMES = ['operation', 'group', 'profile', 'meals', 'coffee', 'prisa', 'activities', 'sleeping_review', 'review_alert'];
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const sameNumber = (a, b) => Number(a) === Number(b);
const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const descriptor = (entity, record, field, from, to, reason) => ({ entity, id: record.id, field, from, to, reason });

function baseResult(groupId) {
  return {
    success: false, group_id: groupId || null,
    phases: Object.fromEntries(PHASE_NAMES.map(name => [name, 'PENDING'])),
    updated: [], preserved_manual: [], skipped_historical: [], warnings: [],
  };
}

async function resolveRole(base44, user) {
  const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: normalizeEmail(user.email) });
  const internal = rows.find(item => normalizeEmail(item.email) === normalizeEmail(user.email) && item.active !== false);
  return internal?.role || user.role;
}

async function saveOperation(base44, operation, phases, status, errorMessage = null) {
  return await base44.asServiceRole.entities.GroupQuantitySyncOperation.update(operation.id, {
    phases_json: JSON.stringify(phases), status, error_message: errorMessage || '',
  });
}

function classifyTiming(record, result, entityName, nowParts) {
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
  const oldTotals = new Set([Number(previous.group.total_pax), Number(previous.profile.total_pax)]);
  const updates = [];
  for (const row of rows) {
    if (!classifyTiming(row, result, 'MealReservation', nowParts)) continue;
    const classification = classifyMealSource(row.source);
    if (classification !== 'AUTOMATIC') {
      const reason = classification === 'MANUAL' ? 'source=manual' : `unknown source=${row.source || 'missing'}`;
      result.preserved_manual.push({ entity: 'MealReservation', id: row.id, field: 'pax', value: row.pax, reason });
      if (classification === 'UNKNOWN') result.warnings.push(`MealReservation ${row.id}: מקור לא מוכר נשמר ללא שינוי`);
      continue;
    }
    if (!oldTotals.has(Number(row.pax))) {
      result.preserved_manual.push({ entity: 'MealReservation', id: row.id, field: 'pax', value: row.pax, reason: 'service-specific quantity' });
      continue;
    }
    if (!sameNumber(row.pax, quantities.total_pax)) {
      updates.push({ id: row.id, pax: quantities.total_pax });
      result.updated.push(descriptor('MealReservation', row, 'pax', row.pax, quantities.total_pax, row.source));
    }
  }
  if (updates.length) await base44.asServiceRole.entities.MealReservation.bulkUpdate(updates);
}

async function syncCoffee(base44, groupId, previous, quantities, result, nowParts) {
  const rows = await base44.asServiceRole.entities.CoffeeCornerRequest.filter({ group_id: groupId });
  const oldCandidates = new Set([generalMealQuantity(previous.group), generalMealQuantity(previous.profile)]);
  const target = generalMealQuantity(quantities);
  const updates = [];
  for (const row of rows) {
    if (!classifyTiming(row, result, 'CoffeeCornerRequest', nowParts)) continue;
    const classification = classifyCoffeeSource(row.source);
    if (classification !== 'AUTOMATIC') {
      const reason = classification === 'MANUAL' ? 'source=manual' : `unknown source=${row.source || 'missing'}`;
      result.preserved_manual.push({ entity: 'CoffeeCornerRequest', id: row.id, field: 'pax', value: row.pax, reason });
      if (classification === 'UNKNOWN') result.warnings.push(`CoffeeCornerRequest ${row.id}: מקור לא מוכר נשמר ללא שינוי`);
      continue;
    }
    if (!oldCandidates.has(Number(row.pax))) {
      result.preserved_manual.push({ entity: 'CoffeeCornerRequest', id: row.id, field: 'pax', value: row.pax, reason: 'service-specific quantity' });
      continue;
    }
    if (!sameNumber(row.pax, target)) {
      updates.push({ id: row.id, pax: target });
      result.updated.push(descriptor('CoffeeCornerRequest', row, 'pax', row.pax, target, row.source));
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
    if (row.date === nowParts.date) result.warnings.push(`PrisaRequest ${row.id}: אין שעת התחלה שמאפשרת לקבוע בבטחה אם השירות של היום התחיל`);
    result.preserved_manual.push({ entity: 'PrisaRequest', id: row.id, fields: ['quantity', 'effective_quantity'], reason: `source=${row.source || 'unknown'} אינו מוכיח ברירת מחדל אוטומטית` });
  }
  if (rows.some(row => row.status === 'ACTIVE' && row.date >= nowParts.date)) result.warnings.push('בקשות פריסה פעילות נשמרו ללא שינוי: V1 אינו יכול להוכיח מה אוטומטי ומה ידני');
}

async function syncActivities(base44, groupId, previous, quantities, result, nowParts) {
  const rows = await base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id: groupId });
  const oldTotals = new Set([Number(previous.group.total_pax), Number(previous.profile.total_pax)]);
  const oldParticipants = new Set([Number(previous.group.participant_count), Number(previous.profile.participant_count)]);
  const updates = [];
  for (const row of rows) {
    if (!classifyTiming(row, result, 'GroupScheduleItem', nowParts)) continue;
    const classification = classifyActivitySource(row);
    if (classification !== 'AUTOMATIC') {
      const reason = classification === 'SPECIAL' ? 'split/shared/quote-specific activity' : classification === 'MANUAL' ? 'source=manual' : `unknown source=${row.source || 'missing'}`;
      result.preserved_manual.push({ entity: 'GroupScheduleItem', id: row.id, field: 'pax', value: row.pax, reason });
      if (classification === 'UNKNOWN') result.warnings.push(`GroupScheduleItem ${row.id}: מקור לא מוכר נשמר ללא שינוי`);
      continue;
    }
    let target = null;
    if (oldParticipants.has(Number(row.pax))) target = quantities.participant_count;
    else if (oldTotals.has(Number(row.pax))) target = quantities.total_pax;
    if (target == null) {
      result.preserved_manual.push({ entity: 'GroupScheduleItem', id: row.id, field: 'pax', value: row.pax, reason: 'activity-specific quantity' });
      continue;
    }
    if (!sameNumber(row.pax, target)) {
      updates.push({ id: row.id, pax: target });
      result.updated.push(descriptor('GroupScheduleItem', row, 'pax', row.pax, target, row.source));
    }
  }
  if (updates.length) await base44.asServiceRole.entities.GroupScheduleItem.bulkUpdate(updates);
}

async function upsertQuantityReviewAlert(base44, groupId, previous, quantities, changedFields, warnings) {
  const sleepingWarnings = warnings.filter(message => message.includes('לינה') || message.includes('שיבו'));
  const message = [`השדות שהשתנו: ${changedFields.join(', ')}`, ...sleepingWarnings].join('\n');
  const existing = await base44.asServiceRole.entities.OperationalReviewAlert.filter({
    group_id: groupId, module: 'GROUP', source: 'GROUP_PAX_CHANGED', status: 'OPEN',
  });
  const payload = {
    title: 'שינוי בכמויות הקבוצה דורש בדיקה', message,
    previous_value_json: JSON.stringify(previous), new_value_json: JSON.stringify(quantities),
    severity: 'WARNING', status: 'OPEN',
  };
  if (existing[0]) await base44.asServiceRole.entities.OperationalReviewAlert.update(existing[0].id, payload);
  else await base44.asServiceRole.entities.OperationalReviewAlert.create({ group_id: groupId, module: 'GROUP', source: 'GROUP_PAX_CHANGED', ...payload });
}

export default async function(req) {
  const result = baseResult(null);
  let operation = null;
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
    const validation = validateQuantityPayload(quantities, group.group_type, source);
    if (validation) return Response.json({ ...result, error: 'VALIDATION_ERROR', message: validation.message, validation_rule: validation.rule }, { status: 400 });
    const requested = normalizeQuantities(quantities);

    const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: groupId });
    if (profiles.length !== 1) return Response.json({ ...result, error: 'OPERATIONAL_PROFILE_REPAIR_REQUIRED', message: profiles.length === 0 ? 'לא נמצא פרופיל תפעולי אחד לקבוצה — נדרש תיקון מנהל' : 'נמצאו מספר פרופילים תפעוליים לקבוצה — נדרש תיקון מנהל', profile_count: profiles.length }, { status: 409 });
    const profile = profiles[0];
    const fingerprint = await quantityRequestFingerprint(source, groupId, requested);
    const matching = await base44.asServiceRole.entities.GroupQuantitySyncOperation.filter({ group_id: groupId, idempotency_key: idempotencyKey });
    const decision = operationDecision(matching, fingerprint);
    if (decision.action === 'CONFLICT') return Response.json({ ...result, error: decision.error, message: 'מפתח השמירה כבר נמצא בשימוש בבקשה אחרת או מקבילה' }, { status: 409 });
    if (decision.action === 'REPLAY') {
      const phases = safeJson(decision.operation.phases_json, result.phases);
      return Response.json({ ...result, success: true, phases, idempotent_retry: true, operation_status: 'COMPLETED' });
    }

    let previous;
    if (decision.action === 'RESUME') {
      operation = decision.operation;
      previous = safeJson(operation.previous_quantities_json, null);
      if (!previous?.group || !previous?.profile) return Response.json({ ...result, error: 'INVALID_OPERATION_SNAPSHOT', message: 'תמונת הכמויות המקורית אינה תקינה' }, { status: 409 });
      result.phases = safeJson(operation.phases_json, result.phases);
      operation = await saveOperation(base44, operation, result.phases, 'IN_PROGRESS', null);
    } else {
      previous = { group: normalizeQuantities(group), profile: normalizeQuantities(profile) };
      const noDifference = QUANTITY_FIELDS.every(field => sameNumber(group[field] ?? 0, requested[field]) && sameNumber(profile[field] ?? 0, requested[field]));
      if (noDifference) return Response.json({ ...result, success: true, no_change: true, validation_rule: 'NO_ACTUAL_QUANTITY_DIFFERENCE' });
      operation = await base44.asServiceRole.entities.GroupQuantitySyncOperation.create({
        group_id: groupId, idempotency_key: idempotencyKey, request_fingerprint: fingerprint,
        previous_quantities_json: JSON.stringify(previous), requested_quantities_json: JSON.stringify(requested),
        phases_json: JSON.stringify(result.phases), status: 'IN_PROGRESS', error_message: '',
      });
      const afterCreate = await base44.asServiceRole.entities.GroupQuantitySyncOperation.filter({ group_id: groupId, idempotency_key: idempotencyKey });
      if (afterCreate.length !== 1) return Response.json({ ...result, error: 'CONCURRENT_DUPLICATE_OPERATIONS', message: 'זוהתה שמירה מקבילה עם אותו מפתח; לא בוצע עדכון כמויות' }, { status: 409 });
    }
    result.phases.operation = 'OK';
    operation = await saveOperation(base44, operation, result.phases, 'IN_PROGRESS');

    const changedFields = [...new Set([...changedQuantityFields(previous.group, requested), ...changedQuantityFields(previous.profile, requested)])];
    const sleepingChanged = group.group_type === 'LODGING' && SLEEPING_QUANTITY_FIELDS.some(field => changedFields.includes(field));
    const staffChanged = changedFields.includes('staff_count');

    try {
      await base44.asServiceRole.entities.Group.update(groupId, Object.fromEntries(QUANTITY_FIELDS.map(field => [field, requested[field]])));
      result.phases.group = 'OK';
      operation = await saveOperation(base44, operation, result.phases, 'IN_PROGRESS');
    } catch (error) {
      result.phases.group = 'FAILED';
      await saveOperation(base44, operation, result.phases, 'FAILED', error.message);
      return Response.json({ ...result, error: 'GROUP_UPDATE_FAILED', message: 'עדכון כמויות הקבוצה נכשל', details: error.message }, { status: 500 });
    }

    const profilePayload = Object.fromEntries(QUANTITY_FIELDS.map(field => [field, requested[field]]));
    if (staffChanged) {
      const splitMatchesRequested = profile.staff_men_count != null && profile.staff_women_count != null && Number(profile.staff_men_count) + Number(profile.staff_women_count) === requested.staff_count;
      if (!splitMatchesRequested) {
        profilePayload.staff_men_count = null;
        profilePayload.staff_women_count = null;
        result.warnings.push('מספר אנשי הצוות השתנה. יש לעדכן מחדש את חלוקת הלינה לצוות.');
      }
    }
    if (sleepingChanged) profilePayload.sleeping_requirements_completed = false;

    try {
      await base44.asServiceRole.entities.OperationalGroupProfile.update(profile.id, profilePayload);
      result.phases.profile = 'OK';
      operation = await saveOperation(base44, operation, result.phases, 'IN_PROGRESS');
    } catch (error) {
      result.phases.profile = 'FAILED';
      await saveOperation(base44, operation, result.phases, 'PARTIAL', error.message);
      return Response.json({ ...result, partial_failure: true, error: 'PROFILE_UPDATE_FAILED', message: 'הכמויות בקבוצה נשמרו אך עדכון הפרופיל התפעולי נכשל. ניתן לנסות שוב בבטחה.', details: error.message }, { status: 500 });
    }

    const nowParts = israelNowParts();
    for (const [name, action] of [
      ['meals', () => syncMeals(base44, groupId, previous, requested, result, nowParts)],
      ['coffee', () => syncCoffee(base44, groupId, previous, requested, result, nowParts)],
      ['prisa', () => inspectPrisa(base44, groupId, result, nowParts)],
      ['activities', () => syncActivities(base44, groupId, previous, requested, result, nowParts)],
    ]) {
      try { await action(); result.phases[name] = 'OK'; }
      catch (error) { result.phases[name] = 'FAILED'; result.warnings.push(`${name}: הסנכרון נכשל — ${error.message}`); }
      operation = await saveOperation(base44, operation, result.phases, 'IN_PROGRESS');
    }

    if (sleepingChanged) {
      try {
        const allocations = await base44.asServiceRole.entities.SleepingAllocation.filter({ group_id: groupId });
        const summary = activeAllocationSummary(allocations);
        result.warnings.push('דרישות הלינה סומנו לבדיקה מחדש; דרישות VIP, תכנוני אוהלים ושיבוצים קיימים נשמרו');
        if (summary.count > 0) {
          if (summary.staff !== requested.staff_count) result.warnings.push(`שיבוצי צוות קיימים נשמרו: שובצו ${summary.staff} מתוך ${requested.staff_count} אנשי צוות`);
          if (summary.students !== requested.participant_count) result.warnings.push(`שיבוצי חניכים קיימים נשמרו: שובצו ${summary.students} מתוך ${requested.participant_count} חניכים`);
          if (summary.mixed === 0 && summary.boys !== requested.boys_count) result.warnings.push(`שיבוצי בנים קיימים (${summary.boys}) אינם תואמים לדרישה החדשה (${requested.boys_count})`);
          if (summary.mixed === 0 && summary.girls !== requested.girls_count) result.warnings.push(`שיבוצי בנות קיימים (${summary.girls}) אינם תואמים לדרישה החדשה (${requested.girls_count})`);
        }
        result.phases.sleeping_review = 'REQUIRED';
      } catch (error) {
        result.phases.sleeping_review = 'FAILED';
        result.warnings.push(`בדיקת שיבוצי הלינה נכשלה — ${error.message}`);
      }
    } else result.phases.sleeping_review = 'OK';
    operation = await saveOperation(base44, operation, result.phases, 'IN_PROGRESS');

    const propagationFailed = Object.entries(result.phases).some(([name, value]) => name !== 'review_alert' && (value === 'FAILED' || value === 'PENDING'));
    if (!propagationFailed) {
      try {
        await upsertQuantityReviewAlert(base44, groupId, previous, requested, changedFields, result.warnings);
        result.phases.review_alert = 'OK';
      } catch (error) {
        result.phases.review_alert = 'FAILED';
        result.warnings.push(`יצירת התראת הבדיקה נכשלה — ${error.message}`);
      }
    }

    const failed = Object.values(result.phases).some(value => value === 'FAILED' || value === 'PENDING');
    result.success = !failed;
    operation = await saveOperation(base44, operation, result.phases, failed ? 'PARTIAL' : 'COMPLETED', failed ? 'One or more phases failed' : null);
    return Response.json({ ...result, partial_failure: failed, idempotent_retry: decision.action === 'RESUME', operation_status: failed ? 'PARTIAL' : 'COMPLETED', request_fingerprint: fingerprint }, { status: failed ? 500 : 200 });
  } catch (error) {
    return Response.json({ ...result, error: 'INTERNAL_ERROR', message: 'שגיאה פנימית בעדכון הכמויות', details: error.message }, { status: 500 });
  }
}