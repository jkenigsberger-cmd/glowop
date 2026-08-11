export function classifyHousekeepingAllocationsForDate(allocations = [], date, allowedGroupIds = null) {
  const checkInAllocsByGroup = {};
  const checkOutAllocsByGroup = {};
  const occupiedAllocsByGroup = {};

  allocations.forEach((allocation) => {
    if (allowedGroupIds && !allowedGroupIds.has(allocation.group_id)) return;
    if (allocation.arrival_date === date) addByGroup(checkInAllocsByGroup, allocation);
    if (allocation.departure_date === date) addByGroup(checkOutAllocsByGroup, allocation);
    if (allocation.arrival_date < date && allocation.departure_date > date) {
      addByGroup(occupiedAllocsByGroup, allocation);
    }
  });

  return { checkInAllocsByGroup, checkOutAllocsByGroup, occupiedAllocsByGroup };
}

export function isAllocationRelevantOnHousekeepingDate(allocation, date) {
  return allocation.arrival_date <= date && allocation.departure_date >= date;
}

export function filterRowsForHousekeepingEvent(rows = [], date, type) {
  if (type === "checkin") return rows.filter((row) => row.arrival_date === date);
  if (type === "checkout") return rows.filter((row) => row.departure_date === date);
  return rows.filter((row) => row.arrival_date < date && row.departure_date > date);
}

function addByGroup(map, allocation) {
  if (!map[allocation.group_id]) map[allocation.group_id] = [];
  map[allocation.group_id].push(allocation);
}