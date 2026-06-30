/**
 * Housekeeping payroll HOURS calculator (MVP — hours only, no money/shekels).
 *
 * Splits a shift into time segments and assigns each segment a single rate:
 *   REGULAR        = 1.0
 *   FRIDAY_AFTER_14 / SATURDAY / HOLIDAY = 1.5  (never stacked → max 1.5)
 *
 * Formula:  regular_hours × 1.0 + premium_150_hours × 1.5 = payable_hours
 *
 * Time handling: shift.date + start_time/end_time are treated as Israel local
 * wall-clock time. We never convert to UTC — day-of-week and holiday decisions
 * are made on the local calendar date, which we advance manually across midnight.
 */

export const REASON_LABELS = {
  REGULAR: "רגיל",
  FRIDAY_AFTER_14: "שישי אחרי 14:00",
  SATURDAY: "שבת",
  HOLIDAY: "חג",
};

const PREMIUM_MULTIPLIER = 1.5;
const FRIDAY_PREMIUM_START_MIN = 14 * 60; // 14:00

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD string, computed on the local
 *  calendar date with no timezone conversion (UTC constructor avoids host-TZ drift,
 *  while getUTCDay reads back the exact date we put in). */
function dayOfWeek(dateStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Add N days to a YYYY-MM-DD string, returning a YYYY-MM-DD string. */
function addDays(dateStr, n) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Rate for a single instant, identified by its local date + minute-of-day. */
function rateFor(dateStr, minuteOfDay, holidaySet) {
  if (holidaySet.has(dateStr)) return "HOLIDAY";
  const dow = dayOfWeek(dateStr);
  if (dow === 6) return "SATURDAY"; // Saturday — whole day
  if (dow === 5 && minuteOfDay >= FRIDAY_PREMIUM_START_MIN) return "FRIDAY_AFTER_14";
  return "REGULAR";
}

/**
 * Calculate the hours breakdown for one shift (per single worker).
 *
 * @param {object} shift - { date, start_time, end_time, status }
 * @param {string[]|Set<string>} holidayDates - active holiday YYYY-MM-DD dates
 * @returns {{
 *   regular_hours, premium_150_hours, actual_hours, payable_hours,
 *   premium_reasons: string[], segments: Array, incomplete: boolean
 * }}
 */
export function calculateCleaningPayrollBreakdown(shift, holidayDates = []) {
  const holidaySet = holidayDates instanceof Set ? holidayDates : new Set(holidayDates);

  const startMin = timeToMinutes(shift?.start_time);
  const endMinRaw = timeToMinutes(shift?.end_time);

  const empty = {
    regular_hours: 0,
    premium_150_hours: 0,
    actual_hours: 0,
    payable_hours: 0,
    premium_reasons: [],
    segments: [],
    incomplete: true,
  };

  // Incomplete / invalid → excluded from totals
  if (shift?.status === "CANCELLED") return { ...empty };
  if (startMin == null || endMinRaw == null) return { ...empty };

  // If end <= start, the shift crossed midnight → ended next calendar day.
  let absStart = startMin;
  let absEnd = endMinRaw;
  if (absEnd <= absStart) absEnd += 1440;
  if (absEnd <= absStart) return { ...empty };

  // Walk minute boundaries, breaking at each midnight, Friday 14:00, and any
  // rate change. We accumulate contiguous same-reason runs into segments.
  const segments = [];
  let cursor = absStart;

  const flush = (segStart, segEnd, dateStr, reason) => {
    if (segEnd <= segStart) return;
    const hours = round2((segEnd - segStart) / 60);
    if (hours <= 0) return;
    segments.push({
      start: minutesToTime(segStart),
      end: minutesToTime(segEnd),
      date: dateStr,
      hours,
      rate_multiplier: reason === "REGULAR" ? 1.0 : PREMIUM_MULTIPLIER,
      reason,
    });
  };

  while (cursor < absEnd) {
    const dayOffset = Math.floor(cursor / 1440);
    const minuteOfDay = cursor % 1440;
    const dateStr = addDays(shift.date, dayOffset);
    const reason = rateFor(dateStr, minuteOfDay, holidaySet);

    // Determine the next boundary where the rate could change:
    //  - next midnight (day rollover)
    //  - Friday 14:00 (only relevant before it, on a Friday)
    const nextMidnight = (dayOffset + 1) * 1440;
    let nextBoundary = nextMidnight;
    if (dayOfWeek(dateStr) === 5 && minuteOfDay < FRIDAY_PREMIUM_START_MIN) {
      nextBoundary = Math.min(nextBoundary, dayOffset * 1440 + FRIDAY_PREMIUM_START_MIN);
    }
    const segEnd = Math.min(nextBoundary, absEnd);

    flush(cursor, segEnd, dateStr, reason);
    cursor = segEnd;
  }

  // Merge adjacent segments that share date + reason (cosmetic, keeps rows clean)
  const merged = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.date === seg.date && last.reason === seg.reason) {
      last.end = seg.end;
      last.hours = round2(last.hours + seg.hours);
    } else {
      merged.push({ ...seg });
    }
  }

  const regular_hours = round2(
    merged.filter((s) => s.reason === "REGULAR").reduce((sum, s) => sum + s.hours, 0)
  );
  const premium_150_hours = round2(
    merged.filter((s) => s.reason !== "REGULAR").reduce((sum, s) => sum + s.hours, 0)
  );
  const actual_hours = round2(regular_hours + premium_150_hours);
  const payable_hours = round2(regular_hours * 1.0 + premium_150_hours * PREMIUM_MULTIPLIER);

  const premium_reasons = [
    ...new Set(merged.filter((s) => s.reason !== "REGULAR").map((s) => s.reason)),
  ];

  return {
    regular_hours,
    premium_150_hours,
    actual_hours,
    payable_hours,
    premium_reasons,
    segments: merged,
    incomplete: false,
  };
}

/** Convenience: combined Hebrew reason text for a breakdown (or "רגיל"). */
export function reasonsText(premium_reasons) {
  if (!premium_reasons || premium_reasons.length === 0) return REASON_LABELS.REGULAR;
  return premium_reasons.map((r) => REASON_LABELS[r] || r).join(" + ");
}