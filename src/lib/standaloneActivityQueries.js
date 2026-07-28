export const STANDALONE_ACTIVITY_KEYS = [
  ["standaloneActivities"], ["standaloneActivityAssignments"], ["spaces-schedule-items"],
  ["allActivities"], ["cal-schedule"], ["groupScheduleItems"], ["activities-daily-print"],
  ["global-search-standalone"], ["dailyBrief"], ["spaces-groups"], ["cal-groups"],
  ["activitySpaces-daily-print"],
];

export function invalidateStandaloneActivityQueries(queryClient) {
  STANDALONE_ACTIVITY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}