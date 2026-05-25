/**
 * useAlertCounts
 * Fetches all OPEN OperationalReviewAlerts and returns a count map by module.
 * Used by AppNav to show red badges.
 */
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useAlertCounts() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["openAlertCounts"],
    queryFn: () => base44.entities.OperationalReviewAlert.filter({ status: "OPEN" }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const counts = {};
  alerts.forEach(a => {
    if (a.module) counts[a.module] = (counts[a.module] || 0) + 1;
  });
  return counts;
}