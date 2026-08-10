import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function useGroupStayPeriods(groups = []) {
  const groupIds = useMemo(() => new Set(groups.map(group => group.id)), [groups]);
  const hasMultiPeriodGroups = groups.some(group => group.stay_mode === "MULTI_PERIOD");
  const { data: activePeriods = [], ...query } = useQuery({
    queryKey: ["groupStayPeriods", "active"],
    queryFn: () => base44.entities.GroupStayPeriod.filter({ status: "ACTIVE" }),
    enabled: hasMultiPeriodGroups,
  });

  const periodsByGroupId = useMemo(() => {
    const index = {};
    activePeriods.forEach(period => {
      if (!groupIds.has(period.group_id)) return;
      (index[period.group_id] ||= []).push(period);
    });
    return index;
  }, [activePeriods, groupIds]);

  return { periodsByGroupId, ...query };
}