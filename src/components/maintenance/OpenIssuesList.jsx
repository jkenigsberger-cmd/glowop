/**
 * OpenIssuesList — full list of all open maintenance issues, sorted by priority then date.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Wrench } from "lucide-react";
import IssueCard from "./IssueCard";

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function OpenIssuesList({ canEdit, canManageBlocks }) {
  const qc = useQueryClient();

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["maintenanceIssuesOpen"],
    queryFn: () =>
      base44.entities.MaintenanceIssue.filter(
        { status: { $in: ["OPEN", "IN_PROGRESS", "WAITING_PARTS"] } },
        "-created_date",
        200
      ),
    staleTime: 30_000,
  });

  const sorted = [...issues].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["maintenanceIssuesOpen"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
        <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-sm font-semibold text-slate-400">אין תקלות פתוחות</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map(issue => (
        <IssueCard
          key={issue.id}
          issue={issue}
          canEdit={canEdit}
          canManageBlocks={canManageBlocks}
          onUpdated={refresh}
          showLocation
        />
      ))}
    </div>
  );
}