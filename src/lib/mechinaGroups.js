// Central helper — which groups are selectable in the Mechina booking-request flow.
// A group is relevant only if it still exists in Group AND has an active status.
// Old/cancelled/archived/deleted groups stay in history but are not selectable.
export const RELEVANT_GROUP_STATUSES = ["CONFIRMED", "PENDING_APPROVAL"];

// assignments: MechinaGroupAssignment records; groupMap: { [group_id]: Group }
// Returns active assignments whose group exists and is relevant, deduped by group_id,
// sorted by group name (organization first, then cycle number).
export function filterRelevantMechinaAssignments(assignments, groupMap) {
  const seen = new Set();
  return assignments
    .filter(a => {
      if (!a.is_active) return false;
      const g = groupMap[a.group_id];
      if (!g || !RELEVANT_GROUP_STATUSES.includes(g.status)) return false;
      if (seen.has(a.group_id)) return false;
      seen.add(a.group_id);
      return true;
    })
    .sort((a, b) => {
      const na = groupMap[a.group_id]?.group_name || a.group_name || "";
      const nb = groupMap[b.group_id]?.group_name || b.group_name || "";
      return na.localeCompare(nb, "he", { numeric: true });
    });
}