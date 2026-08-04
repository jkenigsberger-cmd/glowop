export const QUANTITY_FIELDS = ['total_pax', 'participant_count', 'staff_count', 'boys_count', 'girls_count'];

export function validateQuantityPayload(quantities, groupType) {
  if (!quantities || typeof quantities !== 'object') return 'חסרים נתוני כמויות';
  for (const field of QUANTITY_FIELDS) {
    const value = quantities[field];
    if (!Number.isFinite(value) || !Number.isInteger(value)) return `השדה ${field} חייב להיות מספר שלם`;
    if (value < 0) return `השדה ${field} לא יכול להיות שלילי`;
  }
  if (quantities.total_pax !== quantities.participant_count + quantities.staff_count) {
    return 'סה״כ האנשים חייב להיות שווה למספר החניכים ועוד מספר אנשי הצוות';
  }
  if (groupType === 'LODGING' && quantities.participant_count > 0 && quantities.boys_count + quantities.girls_count !== quantities.participant_count) {
    return 'חלוקת הבנים והבנות חייבת להיות שווה למספר החניכים';
  }
  return null;
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

export function quantitySnapshot(record) {
  return Object.fromEntries(QUANTITY_FIELDS.map(field => [field, Number(record?.[field] ?? 0)]));
}

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