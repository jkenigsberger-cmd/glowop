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
  ["quoteCenter", "quoteCenterGroups", "quoteCenterProfiles", "preparationQuotes", "preparationProfiles", "groups", "operationalProfiles", "cal-groups", "groups_kitchen", "profiles_kitchen", "global-search-groups", "groups-daily-print", "profiles-daily-print", "spaces-groups", "groups_kitchenReport", "profiles_kitchenReport", "kc-groups", "cio-groups"].forEach(queryKey => queryClient.invalidateQueries({ queryKey: [queryKey] }));
  if (groupId) {
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["quotes", groupId] });
    queryClient.invalidateQueries({ queryKey: ["operationalProfile", groupId] });
  }
}

export function invalidateDeletedGroupCache(queryClient, groupId) {
  const removeGroup = rows => Array.isArray(rows) ? rows.filter(row => row.id !== groupId && row.group_id !== groupId) : rows;
  ["groups", "quoteCenterGroups", "cal-groups", "global-search-groups", "groups_kitchen", "groups-daily-print", "spaces-groups", "groups_kitchenReport", "kc-groups", "cio-groups"].forEach(key => queryClient.setQueryData([key], removeGroup));
  queryClient.removeQueries({ queryKey: ["group", groupId] });
  queryClient.removeQueries({ queryKey: ["quotes", groupId] });
  queryClient.removeQueries({ queryKey: ["operationalProfile", groupId] });
  ["quoteCenter", "quoteCenterGroups", "quoteCenterProfiles", "preparationQuotes", "preparationProfiles", "groups", "operationalProfiles", "global-search-groups", "cal-groups", "cal-meals", "cal-schedule", "cal-alerts", "cal-coffee", "groups_kitchen", "profiles_kitchen", "groups-daily-print", "profiles-daily-print", "spaces-groups", "groups_kitchenReport", "profiles_kitchenReport", "kc-groups", "cio-groups", "dashboard", "analytics"].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
}