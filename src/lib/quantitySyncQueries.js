export function invalidateQuantitySyncQueries(queryClient, groupId) {
  const keys = [
    ["group", groupId], ["groups"], ["operationalProfile", groupId],
    ["mealReservations", groupId], ["mealReservations_kitchen"], ["mealReservations_kitchenReport"],
    ["coffeeCornerRequests", groupId], ["coffeeCornerRequests_kitchen"], ["coffeeCornerRequests_kitchenReport"],
    ["prisaRequests", groupId], ["prisaRequests_kitchen"], ["prisaRequests_kitchenReport"],
    ["groupScheduleItems", groupId], ["sleepingAllocations", groupId],
    ["profiles_kitchen"], ["profiles_kitchenReport"], ["groups_kitchen"], ["groups_kitchenReport"],
  ];
  return Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
}