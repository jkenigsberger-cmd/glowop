export const QUANTITY_FIELDS = ["total_pax", "participant_count", "staff_count", "boys_count", "girls_count"];

export function quantitySnapshot(record) {
  const snapshot = Object.fromEntries(QUANTITY_FIELDS.map(field => [field, Number(record?.[field] ?? 0)]));
  snapshot.participant_count = Math.max(0, snapshot.total_pax - snapshot.staff_count);
  return snapshot;
}

export function latestEffectiveQuantities(group, profile) {
  const profileIsLatest = !!profile && (profile.updated_date || "") > (group?.updated_date || "");
  return quantitySnapshot(profileIsLatest ? profile : group);
}

export function quantitiesChanged(current, requested) {
  return QUANTITY_FIELDS.some(field => Number(current?.[field] ?? 0) !== Number(requested?.[field] ?? 0));
}

export function isLifecycleExit(group, requestedStatus) {
  return !!group && requestedStatus !== group.status && ["CANCELLED", "ARCHIVED"].includes(requestedStatus);
}