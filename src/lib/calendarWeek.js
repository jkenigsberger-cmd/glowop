/**
 * Israel-style Sunday-first week helpers (using moment.js).
 * week: Sunday=0 … Saturday=6
 */
import moment from "moment";

/** Start of week containing `pivot` — always Sunday */
export function startOfSundayWeek(pivot) {
  const d = moment(pivot);
  const dow = d.day(); // 0=Sun … 6=Sat
  return d.clone().subtract(dow, "days").startOf("day");
}

/** Array of 7 moment days for the week containing `pivot` (Sun–Sat) */
export function getWeekDatesSunday(pivot) {
  const start = startOfSundayWeek(pivot);
  return Array.from({ length: 7 }, (_, i) => start.clone().add(i, "days"));
}

/**
 * Array of moment days for the full calendar grid of the month containing `pivot`.
 * Grid rows start on Sunday and end on Saturday.
 */
export function getMonthDatesSunday(pivot) {
  const m = moment(pivot);
  const monthStart = m.clone().startOf("month");
  const monthEnd   = m.clone().endOf("month");

  // Go back to the nearest Sunday on or before monthStart
  const gridStart = monthStart.clone().subtract(monthStart.day(), "days");
  // Go forward to the nearest Saturday on or after monthEnd
  const gridEnd   = monthEnd.clone().add(6 - monthEnd.day(), "days");

  const days = [];
  let cur = gridStart.clone();
  while (cur.isSameOrBefore(gridEnd, "day")) {
    days.push(cur.clone());
    cur.add(1, "day");
  }
  return days;
}

// Hebrew weekday names Sun→Sat
export const HEB_DAYS_SUN = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];