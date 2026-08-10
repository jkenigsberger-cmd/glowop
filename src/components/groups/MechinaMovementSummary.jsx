import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { normalizeStayPeriods } from "@/lib/groupStayPeriods";
import { ArrowDownToLine, ArrowUpFromLine, Moon } from "lucide-react";

const fmtHeb = (dateStr) => {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
};

export default function MechinaMovementSummary({ groupId }) {
  const { data: periods = [] } = useQuery({
    queryKey: ["groupStayPeriods", groupId],
    queryFn: () => base44.entities.GroupStayPeriod.filter({ group_id: groupId, status: "ACTIVE" }),
    enabled: !!groupId,
  });

  const sorted = useMemo(() => normalizeStayPeriods(periods), [periods]);

  if (sorted.length === 0) return null;

  const entryDates = sorted.map(p => p.start_date);
  const exitDates = sorted.map(p => p.end_date);

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
      <p className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-1.5">
        <Moon className="w-4 h-4" /> תקופות שהייה ותנועות
      </p>
      <div className="space-y-2.5">
        {/* Period ranges */}
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((p, i) => (
            <span key={i} className="text-xs bg-white border border-indigo-200 text-indigo-700 rounded-lg px-2 py-1 font-medium">
              {fmtHeb(p.start_date)} — {fmtHeb(p.end_date)}
            </span>
          ))}
        </div>
        {/* Entries */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">כניסות:</span>
          <span>{entryDates.map(fmtHeb).join(", ")}</span>
        </div>
        {/* Exits */}
        <div className="flex items-center gap-1.5 text-xs text-orange-700">
          <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold">יציאות:</span>
          <span>{exitDates.map(fmtHeb).join(", ")}</span>
        </div>
      </div>
    </div>
  );
}