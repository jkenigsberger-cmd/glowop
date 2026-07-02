/**
 * ReviewAlertsBanner
 *
 * Fetches and displays open OperationalReviewAlerts.
 * Props:
 *   groupId?   — filter to a specific group
 *   module?    — filter to a specific module (e.g. "KITCHEN")
 *   title?     — optional section title override
 *   grouped?   — when true (GroupDetail), collapse multiple alerts per source into one combined card
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ReviewAlertCard, { MODULE_LABELS } from "./ReviewAlertCard";
import GroupedAlertCard from "./GroupedAlertCard";
import { Bell } from "lucide-react";

export default function ReviewAlertsBanner({ groupId, module, title, grouped = false }) {
  const queryClient = useQueryClient();

  const queryKey = ["reviewAlerts", groupId || "all", module || "all"];

  const { data: alerts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const filter = { status: "OPEN" };
      if (groupId) filter.group_id = groupId;
      if (module)  filter.module   = module;
      return base44.entities.OperationalReviewAlert.filter(filter);
    },
    staleTime: 30_000,
  });

  // Fetch group names for all unique group_ids in the alerts
  const uniqueGroupIds = [...new Set(alerts.map(a => a.group_id).filter(Boolean))];

  // Fetch all groups to resolve group names
  const { data: groupsForAlerts = [] } = useQuery({
    queryKey: ["alertGroupNames", uniqueGroupIds.sort().join(",")],
    queryFn: async () => {
      if (uniqueGroupIds.length === 0) return [];
      // Fetch all groups and filter locally (avoids N+1)
      return base44.entities.Group.list();
    },
    enabled: uniqueGroupIds.length > 0,
    staleTime: 60_000,
  });

  const groupNameMap = {};
  const groupMap = {};
  groupsForAlerts.forEach(g => { groupNameMap[g.id] = g.group_name; groupMap[g.id] = g; });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["openAlertCounts"] });
  };

  if (isLoading || alerts.length === 0) return null;

  const sectionTitle = title || (
    module
      ? `התראות בדיקה — ${MODULE_LABELS[module] || module} (${alerts.length})`
      : `שינויים הדורשים בדיקה (${alerts.length})`
  );

  // In GroupDetail (grouped=true): collapse by source, show one combined card per source
  if (grouped && groupId) {
    const bySource = {};
    alerts.forEach(a => {
      const key = a.source || "UNKNOWN";
      if (!bySource[key]) bySource[key] = [];
      bySource[key].push(a);
    });

    return (
      <div className="space-y-2" dir="rtl">
        <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
          <Bell className="w-4 h-4" /> {sectionTitle}
        </h3>
        <div className="space-y-2">
          {Object.entries(bySource).map(([source, sourceAlerts]) => (
            <GroupedAlertCard
              key={source}
              alerts={sourceAlerts}
              groupName={groupNameMap[groupId] || null}
              group={groupMap[groupId] || null}
              onAcknowledged={refetch}
            />
          ))}
        </div>
      </div>
    );
  }

  // Default: one card per alert (module pages)
  return (
    <div className="space-y-2" dir="rtl">
      <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
        <Bell className="w-4 h-4" /> {sectionTitle}
      </h3>
      <div className="space-y-2">
        {alerts.map(alert => (
          <ReviewAlertCard
            key={alert.id}
            alert={alert}
            groupName={groupNameMap[alert.group_id] || null}
            group={groupMap[alert.group_id] || null}
            onAcknowledged={refetch}
          />
        ))}
      </div>
    </div>
  );
}