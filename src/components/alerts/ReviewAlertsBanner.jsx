/**
 * ReviewAlertsBanner
 *
 * Fetches and displays open OperationalReviewAlerts.
 * Props:
 *   groupId?  — filter to a specific group
 *   module?   — filter to a specific module (e.g. "KITCHEN")
 *   title?    — optional section title override
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ReviewAlertCard from "./ReviewAlertCard";
import { Bell } from "lucide-react";

export default function ReviewAlertsBanner({ groupId, module, title }) {
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

  const refetch = () => queryClient.invalidateQueries({ queryKey });

  if (isLoading || alerts.length === 0) return null;

  const sectionTitle = title || (
    module
      ? `התראות בדיקה — ${moduleLabel(module)} (${alerts.length})`
      : `שינויים הדורשים בדיקה (${alerts.length})`
  );

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
            onAcknowledged={refetch}
          />
        ))}
      </div>
    </div>
  );
}

function moduleLabel(module) {
  const map = {
    KITCHEN:              "מטבח",
    HOUSEKEEPING:         "משק בית",
    ALLOCATION:           "שיבוץ לינה",
    SLEEPING_REQUIREMENTS:"דרישות לינה",
    GROUP:                "קבוצה",
    ACTIVITIES:           "פעילויות",
    REPORTS:              "דוחות",
  };
  return map[module] || module;
}