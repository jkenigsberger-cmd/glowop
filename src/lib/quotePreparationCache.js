const upsert = (rows = [], item) => item ? [item, ...rows.filter(row => row.id !== item.id)] : rows;

export function updateQuotePreparationCache(queryClient, { quote, group, profile }) {
  if (quote) {
    queryClient.setQueryData(["quoteCenter"], rows => upsert(rows, quote));
    if (quote.preparation_flow_enabled) queryClient.setQueryData(["preparationQuotes"], rows => upsert(rows, quote));
    if (quote.group_id) queryClient.setQueryData(["quotes", quote.group_id], rows => upsert(rows, quote));
  }
  if (group) {
    queryClient.setQueryData(["groups"], rows => upsert(rows, group));
    queryClient.setQueryData(["quoteCenterGroups"], rows => upsert(rows, group));
    queryClient.setQueryData(["group", group.id], [group]);
  }
  if (profile) {
    queryClient.setQueryData(["preparationProfiles"], rows => upsert(rows, profile));
    queryClient.setQueryData(["quoteCenterProfiles"], rows => upsert(rows, profile));
    queryClient.setQueryData(["operationalProfiles"], rows => upsert(rows, profile));
    queryClient.setQueryData(["operationalProfile", profile.group_id], [profile]);
  }
}

export function invalidateQuotePreparationCache(queryClient, groupId) {
  ["quoteCenter", "quoteCenterGroups", "quoteCenterProfiles", "preparationQuotes", "preparationProfiles", "groups", "operationalProfiles", "cal-groups", "groups_kitchen", "profiles_kitchen", "global-search-groups", "groups-daily-print", "profiles-daily-print"].forEach(queryKey => queryClient.invalidateQueries({ queryKey: [queryKey] }));
  if (groupId) {
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["quotes", groupId] });
    queryClient.invalidateQueries({ queryKey: ["operationalProfile", groupId] });
  }
}