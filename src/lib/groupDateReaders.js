import { isArrivalDate, isDepartureDate, occupiesSleepingNight } from "@/lib/groupStayPeriods";

const EXCLUDED = new Set(["CANCELLED", "ARCHIVED"]);

export function isGroupOperationallyPresent(group, date, periods = []) {
  if (group.stay_mode === "MULTI_PERIOD") return occupiesSleepingNight(date, periods);
  if (group.group_type === "DAY_USE") return group.arrival_date === date;
  const departure = group.departure_date?.trim() || null;
  if (!departure) return group.arrival_date === date;
  return group.arrival_date <= date && departure > date;
}

export const isGroupOnDashboardDate = isGroupOperationallyPresent;

export function isGroupArrivalOnDate(group, date, periods = []) {
  return group.stay_mode === "MULTI_PERIOD"
    ? isArrivalDate(date, periods)
    : group.arrival_date === date;
}

export function isGroupDepartureOnDate(group, date, periods = []) {
  return group.stay_mode === "MULTI_PERIOD"
    ? isDepartureDate(date, periods)
    : group.departure_date === date;
}

export function isGroupSleepingNightOnDate(group, date, periods = []) {
  if (group.group_type !== "LODGING") return false;
  if (group.stay_mode === "MULTI_PERIOD") return occupiesSleepingNight(date, periods);
  const departure = group.departure_date?.trim() || null;
  return !!departure && group.arrival_date <= date && departure > date;
}

export function isGroupOnOperationalCalendarDate(group, date, periods = []) {
  if (group.stay_mode === "MULTI_PERIOD") {
    return isGroupArrivalOnDate(group, date, periods)
      || isGroupDepartureOnDate(group, date, periods)
      || isGroupSleepingNightOnDate(group, date, periods);
  }
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
      const arrives = isGroupArrivalOnDate(group, date, periods);
      const departs = isGroupDepartureOnDate(group, date, periods);
      if (arrives) arrivals.push(group);
      if (departs) departures.push(group);
      if (!arrives && !departs && isGroupSleepingNightOnDate(group, date, periods)) staying.push(group);
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