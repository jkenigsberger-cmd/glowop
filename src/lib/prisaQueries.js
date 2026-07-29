export function invalidatePrisaQueries(queryClient, groupId) {
  const keys = [
    ["prisaRequests", groupId],
    ["prisaRequests_kitchen"],
    ["prisaRequests_kitchenReport"],
    ["prisa-daily-print"],
  ];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}