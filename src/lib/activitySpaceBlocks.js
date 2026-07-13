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

export function parseBlockEndDateTime(block) {
  return parseBlockDateTime(block?.end_date, block?.end_time);
}

export function isBlockVisibleInDashboardAlert(block, now = new Date()) {
  const start = parseBlockStartDateTime(block);
  const end = parseBlockEndDateTime(block);
  const alertEnd = new Date(now);
  alertEnd.setDate(alertEnd.getDate() + 14);
  return block?.status === "ACTIVE" && !!start && !!end && end >= now && start <= alertEnd;
}

export function isBlockVisibleOnCalendarDate(block, selectedDate) {
  return block?.status === "ACTIVE" && block.start_date <= selectedDate && block.end_date >= selectedDate;
}

export function blockAppliesOnDate(block, date) {
  return isBlockVisibleOnCalendarDate(block, date);
}

export function findBlockingSpace(blocks, spaceId, date, startTime, endTime) {
  if (!spaceId || !date || !startTime || !endTime) return null;
  return blocks.find(block =>
    block.activity_space_id === spaceId &&
    blockAppliesOnDate(block, date) &&
    timesOverlap(startTime, endTime, block.start_time, block.end_time)
  ) || null;
}