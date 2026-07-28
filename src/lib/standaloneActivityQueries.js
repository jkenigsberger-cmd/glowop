export const STANDALONE_ACTIVITY_KEYS = [
  ["standaloneActivities"], ["standaloneActivityAssignments"], ["spaces-schedule-items"],
  ["allActivities"], ["cal-schedule"], ["groupScheduleItems"], ["activities-daily-print"],
  ["global-search-standalone"], ["dailyBrief"], ["spaces-groups"], ["cal-groups"],
  ["activitySpaces-daily-print"],
];

export function invalidateStandaloneActivityQueries(queryClient) {
  return Promise.all(STANDALONE_ACTIVITY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}