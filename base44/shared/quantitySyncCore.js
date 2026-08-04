export const QUANTITY_FIELDS = ['total_pax', 'participant_count', 'staff_count', 'boys_count', 'girls_count'];
export const SLEEPING_QUANTITY_FIELDS = ['participant_count', 'staff_count', 'boys_count', 'girls_count'];
export const AUTOMATIC_MEAL_SOURCES = new Set(['groupSync', 'guestForm']);
export const AUTOMATIC_COFFEE_SOURCES = new Set(['external_form']);
export const AUTOMATIC_ACTIVITY_SOURCES = new Set(['groupSync']);
export const STALE_OPERATION_MS = 5 * 60 * 1000;

export function normalizeQuantities(record) {
  return Object.fromEntries(QUANTITY_FIELDS.map(field => [field, Number(record?.[field] ?? 0)]));
}

export function validateQuantityPayload(quantities, groupType, source = 'ADMIN_EDIT') {
  if (!quantities || typeof quantities !== 'object') return { message: 'חסרים נתוני כמויות', rule: 'QUANTITIES_OBJECT_REQUIRED' };
  for (const field of QUANTITY_FIELDS) {
    const value = quantities[field];
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      return { message: `השדה ${field} חייב להיות מספר שלם ולא שלילי`, rule: 'FINITE_NON_NEGATIVE_INTEGER' };
    }
  }
  if (source === 'ADMIN_EDIT') {
    const derivedParticipants = Math.max(0, quantities.total_pax - quantities.staff_count);
    if (quantities.participant_count !== derivedParticipants) {
      return { message: 'מספר החניכים חייב להתאים לחישוב הקיים בטופס עריכת קבוצה: max(0, סה״כ פחות צוות)', rule: 'GROUP_FORM_DERIVED_PARTICIPANTS' };
    }
    if (groupType === 'LODGING' && quantities.participant_count > 0 && quantities.boys_count + quantities.girls_count !== quantities.participant_count) {
      return { message: 'בקבוצת לינה עם חניכים, חלוקת הבנים והבנות חייבת להתאים למספר החניכים כפי שנדרש בטופס עריכת קבוצה', rule: 'GROUP_FORM_LODGING_GENDER_SPLIT' };
    }
  }
  return null;
}

export async function quantityRequestFingerprint(source, groupId, quantities) {
  const normalized = JSON.stringify({
    source: String(source || '').trim().toUpperCase(),
    group_id: String(groupId || '').trim(),
    quantities: normalizeQuantities(quantities),
  });
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function operationDecision(operations, fingerprint, nowMs = Date.now()) {
  if ((operations || []).length > 1) return {
    action: 'CONFLICT', error: 'CONCURRENT_DUPLICATE_OPERATIONS',
    duplicate_operation_ids: operations.map(item => item.id),
  };
  const operation = operations?.[0] || null;
  if (!operation) return { action: 'CREATE' };
  if (operation.request_fingerprint !== fingerprint) return { action: 'CONFLICT', error: 'IDEMPOTENCY_REQUEST_CONFLICT' };
  if (operation.status === 'IN_PROGRESS') {
    const updatedMs = Date.parse(operation.updated_date || '');
    const stale = Number.isFinite(updatedMs) && nowMs - updatedMs >= STALE_OPERATION_MS;
    return stale
      ? { action: 'RESUME', operation, resumed_from_stale: true }
      : { action: 'CONFLICT', error: 'IDEMPOTENCY_OPERATION_IN_PROGRESS' };
  }
  if (operation.status === 'COMPLETED') return { action: 'REPLAY', operation };
  return { action: 'RESUME', operation, resumed_from_stale: false };
}

export function operationFailureStatus(phases) {
  const workSucceeded = Object.entries(phases || {}).some(([name, value]) =>
    name !== 'operation' && (value === 'OK' || value === 'REQUIRED')
  );
  return workSucceeded ? 'PARTIAL' : 'FAILED';
}

export function classifyMealSource(source) {
  if (AUTOMATIC_MEAL_SOURCES.has(source)) return 'AUTOMATIC';
  if (source === 'manual') return 'MANUAL';
  return 'UNKNOWN';
}

export function classifyCoffeeSource(source) {
  if (AUTOMATIC_COFFEE_SOURCES.has(source)) return 'AUTOMATIC';
  if (source === 'manual') return 'MANUAL';
  return 'UNKNOWN';
}

export function classifyActivitySource(record) {
  if (record?.split_group_id || record?.shared_activity_id || record?.quote_item_id) return 'SPECIAL';
  if (AUTOMATIC_ACTIVITY_SOURCES.has(record?.source)) return 'AUTOMATIC';
  if (record?.source === 'manual') return 'MANUAL';
  return 'UNKNOWN';
}

export function activityPaxDecision(record, previous, requested) {
  if (record?.pax == null || record.pax === '') return { action: 'PRESERVE', reason: 'activity-specific quantity' };
  const pax = Number(record.pax);
  const oldTotals = new Set([Number(previous?.group?.total_pax), Number(previous?.profile?.total_pax)]);
  const oldParticipants = new Set([Number(previous?.group?.participant_count), Number(previous?.profile?.participant_count)]);
  const matchesTotal = oldTotals.has(pax);
  const matchesParticipants = oldParticipants.has(pax);
  if (matchesTotal && matchesParticipants && Number(requested.total_pax) !== Number(requested.participant_count)) {
    return { action: 'PRESERVE', warning: 'AMBIGUOUS_ACTIVITY_QUANTITY_SOURCE', reason: 'ambiguous total/participant source' };
  }
  if (matchesTotal && !matchesParticipants) return { action: 'UPDATE', target: Number(requested.total_pax), basis: 'total_pax' };
  if (matchesParticipants && !matchesTotal) return { action: 'UPDATE', target: Number(requested.participant_count), basis: 'participant_count' };
  if (matchesTotal && matchesParticipants) return { action: 'UPDATE', target: Number(requested.total_pax), basis: 'equal total_pax/participant_count' };
  return { action: 'PRESERVE', reason: 'activity-specific quantity' };
}

export function changedQuantityFields(previous, requested) {
  return QUANTITY_FIELDS.filter(field => Number(previous?.[field] ?? 0) !== Number(requested?.[field] ?? 0));
}

export function israelNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

export function serviceTiming(record, nowParts) {
  if (!record?.date) return { eligible: false, reason: 'MISSING_DATE' };
  if (record.date < nowParts.date) return { eligible: false, reason: 'HISTORICAL' };
  if (record.date > nowParts.date) return { eligible: true, reason: 'FUTURE' };
  if (!record.start_time) return { eligible: false, reason: 'TODAY_TIME_UNKNOWN' };
  return record.start_time > nowParts.time
    ? { eligible: true, reason: 'TODAY_NOT_STARTED' }
    : { eligible: false, reason: 'TODAY_STARTED' };
}

export const quantitySnapshot = normalizeQuantities;

export function generalMealQuantity(snapshot) {
  const participants = snapshot?.participant_count;
  const staff = snapshot?.staff_count;
  if (Number.isFinite(participants) && Number.isFinite(staff)) return participants + staff;
  return Number(snapshot?.total_pax ?? 0);
}

export function activeAllocationSummary(allocations) {
  const active = (allocations || []).filter(item => item.status !== 'CANCELLED');
  const sum = rows => rows.reduce((total, item) => total + (Number(item.allocated_pax) || 0), 0);
  return {
    staff: sum(active.filter(item => item.allocation_type === 'STAFF')),
    students: sum(active.filter(item => item.allocation_type === 'STUDENT')),
    boys: sum(active.filter(item => item.allocation_type === 'STUDENT' && item.gender_group === 'BOYS')),
    girls: sum(active.filter(item => item.allocation_type === 'STUDENT' && item.gender_group === 'GIRLS')),
    mixed: sum(active.filter(item => item.allocation_type === 'STUDENT' && item.gender_group === 'MIXED')),
    count: active.length,
  };
}