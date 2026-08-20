const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (!DATE_PATTERN.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function activePeriods(periods) {
  return normalizeStayPeriods(periods).filter(period => period.status !== "CANCELLED");
}

function nextDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function normalizeStayPeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods
    .map(period => ({
      ...period,
      start_date: String(period?.start_date || ""),
      end_date: String(period?.end_date || ""),
      status: period?.status || "ACTIVE",
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));
}

export function validateStayPeriods(periods) {
  if (!Array.isArray(periods)) {
    return { valid: false, errors: [{ code: "PERIODS_NOT_ARRAY" }] };
  }

  const normalized = normalizeStayPeriods(periods);
  const errors = [];

  normalized.forEach((period, index) => {
    if (!isValidDateString(period.start_date) || !isValidDateString(period.end_date)) {
      errors.push({ code: "INVALID_DATE", index });
      return;
    }
    if (period.end_date < period.start_date) errors.push({ code: "END_BEFORE_START", index });
  });

  const active = normalized
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => period.status !== "CANCELLED");
  const seen = new Set();

  active.forEach(({ period, index }) => {
    const key = `${period.start_date}|${period.end_date}`;
    if (seen.has(key)) errors.push({ code: "DUPLICATE_PERIOD", index });
    seen.add(key);
  });

  for (let position = 1; position < active.length; position += 1) {
    const previous = active[position - 1];
    const current = active[position];
    if (
      isValidDateString(previous.period.end_date) &&
      isValidDateString(current.period.start_date) &&
      current.period.start_date <= previous.period.end_date
    ) {
      errors.push({ code: "OVERLAPPING_PERIODS", index: current.index, previous_index: previous.index });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function deriveStayEnvelope(periods) {
  const active = activePeriods(periods);
  if (active.length === 0) return null;
  return { start_date: active[0].start_date, end_date: active[active.length - 1].end_date };
}

export function isDateInsideStayPeriods(date, periods) {
  if (!isValidDateString(date)) return false;
  return activePeriods(periods).some(period => period.start_date <= date && date <= period.end_date);
}

export function isArrivalDate(date, periods) {
  if (!isValidDateString(date)) return false;
  return activePeriods(periods).some(period => period.start_date === date);
}

export function isDepartureDate(date, periods) {
  if (!isValidDateString(date)) return false;
  return activePeriods(periods).some(period => period.end_date === date);
}

export function occupiesSleepingNight(date, periods) {
  if (!isValidDateString(date)) return false;
  return activePeriods(periods).some(period => period.start_date <= date && date < period.end_date);
}

export function getOperationalStayDates(periods) {
  const dates = new Set();
  activePeriods(periods).forEach(period => {
    if (!isValidDateString(period.start_date) || !isValidDateString(period.end_date) || period.end_date < period.start_date) return;
    for (let date = period.start_date; date <= period.end_date; date = nextDate(date)) dates.add(date);
  });
  return [...dates].sort();
}