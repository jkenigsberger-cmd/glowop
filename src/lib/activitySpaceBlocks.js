export const BLOCK_REASON_LABELS = {
  PAINTING: "צביעה",
  MAINTENANCE: "תחזוקה",
  REPAIR: "תיקון",
  SPECIAL_CLEANING: "ניקיון מיוחד",
  TEMPORARILY_CLOSED: "סגור זמנית",
  OTHER: "אחר",
};

export function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function parseBlockDateTime(date, time) {
  if (!date || !time) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseBlockStartDateTime(block) {
  return parseBlockDateTime(block?.start_date, block?.start_time);
}

export function isOpenEndedBlock(block) {
  return block?.is_open_ended === true;
}

export function parseBlockEndDateTime(block) {
  if (isOpenEndedBlock(block)) return null;
  return parseBlockDateTime(block?.end_date, block?.end_time);
}

export function doesBlockOverlapReservation(block, reservationDate, startTime, endTime) {
  if (block?.status !== "ACTIVE" || !reservationDate || !startTime || !endTime) return false;
  const blockStart = parseBlockStartDateTime(block);
  const reservationStart = parseBlockDateTime(reservationDate, startTime);
  const reservationEnd = parseBlockDateTime(reservationDate, endTime);
  if (!blockStart || !reservationStart || !reservationEnd) return false;
  if (isOpenEndedBlock(block)) return reservationEnd > blockStart;
  const blockEnd = parseBlockEndDateTime(block);
  return !!blockEnd && reservationStart < blockEnd && blockStart < reservationEnd;
}

export function isBlockVisibleInDashboardAlert(block, referenceDateTime = new Date(), alertEndDateTime = null) {
  const start = parseBlockStartDateTime(block);
  const end = parseBlockEndDateTime(block);
  const alertEnd = alertEndDateTime || new Date(referenceDateTime);
  if (!alertEndDateTime) alertEnd.setDate(alertEnd.getDate() + 14);
  if (block?.status !== "ACTIVE" || !start || start > alertEnd) return false;
  return isOpenEndedBlock(block) || (!!end && end >= referenceDateTime);
}

export function isBlockVisibleOnCalendarDate(block, selectedDate) {
  if (block?.status !== "ACTIVE" || !block.start_date || block.start_date > selectedDate) return false;
  return isOpenEndedBlock(block) || (!!block.end_date && block.end_date >= selectedDate);
}

export function blockAppliesOnDate(block, date) {
  return isBlockVisibleOnCalendarDate(block, date);
}

export function findBlockingSpace(blocks, spaceId, date, startTime, endTime) {
  if (!spaceId || !date || !startTime || !endTime) return null;
  return blocks.find(block =>
    block.activity_space_id === spaceId &&
    doesBlockOverlapReservation(block, date, startTime, endTime)
  ) || null;
}