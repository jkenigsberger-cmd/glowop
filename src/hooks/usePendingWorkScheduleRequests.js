import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function usePendingWorkScheduleRequests(role) {
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const query = useQuery({
    queryKey: ["workScheduleRequestsPendingCount"],
    enabled: isAdmin,
    queryFn: async () => (await base44.functions.invoke("manageWorkScheduleRequests", { action: "pending_count" })).data.pending_count || 0,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  return isAdmin ? (query.data || 0) : 0;
}