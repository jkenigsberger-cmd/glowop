/**
 * alertDateWindow — pure display helper for the Kitchen alerts date filter.
 *
 * Decides whether an alert's linked group is relevant within a rolling
 * [today, today + windowDays] window. Used ONLY as a display filter in the
 * Kitchen page — it never mutates, deletes, or changes alert status.
 *
 * Rules:
 *  - DAY_USE group: keep if arrival_date is within [today, today + windowDays].
 *  - LODGING group: keep if the stay overlaps the window
 *      (arrival_date <= windowEnd AND departure_date >= today).
 *      Missing departure_date falls back to arrival_date.
 *  - No valid group_id / group not loaded / no valid date: hidden by default
 *    (group-related alert without a usable date is not shown in the 2-week list).
 */

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export function isAlertInDateWindow(alert, group, windowDays = 14) {
  if (!group) return false;

  const today = toDateStr(new Date());
  const end = new Date();
  end.setDate(end.getDate() + windowDays);
  const windowEnd = toDateStr(end);

  const arrival = group.arrival_date || null;
  const departure = group.departure_date || arrival;

  if (group.group_type === "DAY_USE") {
    if (!arrival) return false;
    return arrival >= today && arrival <= windowEnd;
  }

  // LODGING (and any other type) — overlap check
  if (!arrival) return false;
  return arrival <= windowEnd && departure >= today;
}