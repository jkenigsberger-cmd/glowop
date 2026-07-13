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

export function blockAppliesOnDate(block, date) {
  return block.status === "ACTIVE" && block.start_date <= date && block.end_date >= date;
}

export function findBlockingSpace(blocks, spaceId, date, startTime, endTime) {
  if (!spaceId || !date || !startTime || !endTime) return null;
  return blocks.find(block =>
    block.activity_space_id === spaceId &&
    blockAppliesOnDate(block, date) &&
    timesOverlap(startTime, endTime, block.start_time, block.end_time)
  ) || null;
}