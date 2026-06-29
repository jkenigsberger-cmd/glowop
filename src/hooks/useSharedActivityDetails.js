import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * For each shared_activity_id, fetches all ACTIVE linked GroupScheduleItem records
 * and resolves group names from the provided groups list (or fetches individually).
 *
 * Returns a map:
 * {
 *   [shared_activity_id]: {
 *     items: [...],
 *     totalPax: number | null,
 *     groups: [{ group_id, group_name, pax }],
 *     missingPax: boolean,
 *   }
 * }
 */
export function useSharedActivityDetails(scheduleItems, knownGroups = []) {
  // Collect unique shared_activity_ids from ACTIVE shared items
  const sharedIds = [
    ...new Set(
      scheduleItems
        .filter(i => i.status === "ACTIVE" && i.shared_activity_id)
        .map(i => i.shared_activity_id)
    ),
  ];

  const groupNameMap = Object.fromEntries(
    (knownGroups || []).map(g => [g.id, g.group_name])
  );

  const { data: detailsMap = {} } = useQuery({
    queryKey: ["sharedActivityDetails", ...sharedIds.sort()],
    queryFn: async () => {
      if (sharedIds.length === 0) return {};

      const result = {};

      // Fetch linked items for each shared_activity_id individually (no $in needed)
      await Promise.all(
        sharedIds.map(async (sharedId) => {
          const linkedItems = await base44.entities.GroupScheduleItem.filter({
            shared_activity_id: sharedId,
            status: "ACTIVE",
          });

          // Collect group_ids we don't have names for
          const unknownGroupIds = [
            ...new Set(linkedItems.map(i => i.group_id).filter(gid => !groupNameMap[gid])),
          ];

          // Fetch missing group names individually
          const fetchedGroups = await Promise.all(
            unknownGroupIds.map(async (gid) => {
              try {
                const g = await base44.entities.Group.get(gid);
                return g ? { id: g.id, group_name: g.group_name } : null;
              } catch {
                return null;
              }
            })
          );

          const localNameMap = { ...groupNameMap };
          fetchedGroups.forEach(g => { if (g) localNameMap[g.id] = g.group_name; });

          const groups = linkedItems.map(item => ({
            group_id: item.group_id,
            group_name: localNameMap[item.group_id] || item.group_id,
            pax: item.pax != null ? Number(item.pax) : null,
            item_id: item.id,
          }));

          const missingPax = groups.some(g => g.pax == null || isNaN(g.pax));
          const totalPax = missingPax ? null : groups.reduce((sum, g) => sum + g.pax, 0);

          result[sharedId] = { items: linkedItems, totalPax, groups, missingPax };
        })
      );

      return result;
    },
    enabled: sharedIds.length > 0,
    staleTime: 15_000,
  });

  return detailsMap;
}