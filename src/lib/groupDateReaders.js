import { isDateInsideStayPeriods } from "@/lib/groupStayPeriods";

const EXCLUDED = new Set(["CANCELLED", "ARCHIVED"]);

export function isGroupOnDashboardDate(group, date, periods = []) {
  if (group.stay_mode === "MULTI_PERIOD") return isDateInsideStayPeriods(date, periods);
  if (group.group_type === "DAY_USE") return group.arrival_date === date;
  const departure = group.departure_date?.trim() || null;
  if (!departure) return group.arrival_date === date;
  return group.arrival_date <= date && departure > date;
}

export function isGroupOnOperationalCalendarDate(group, date, periods = []) {
  if (group.stay_mode === "MULTI_PERIOD") return isDateInsideStayPeriods(date, periods);
  if (!group.arrival_date) return false;
  if (group.arrival_date === date || group.departure_date === date) return true;
  if (!group.departure_date) return false;
  return group.arrival_date <= date && group.departure_date > date;
}

export function classifyGroupsForDate(groups, date, periodsByGroupId = {}) {
  const arrivals = [], departures = [], staying = [];
  groups.forEach(group => {
    if (EXCLUDED.has(group.status)) return;
    if (group.stay_mode === "MULTI_PERIOD") {
      const periods = periodsByGroupId[group.id] || [];
      const arrives = periods.some(period => period.start_date === date);
      const departs = periods.some(period => period.end_date === date);
      if (arrives) arrivals.push(group);
      if (departs) departures.push(group);
      if (!arrives && !departs && isDateInsideStayPeriods(date, periods)) staying.push(group);
      return;
    }
    if (!group.arrival_date) return;
    const departure = group.departure_date || group.arrival_date;
    if (group.arrival_date === date) arrivals.push(group);
    else if (departure === date) departures.push(group);
    else if (group.arrival_date < date && departure > date) staying.push(group);
  });
  return { arrivals, departures, staying };
}