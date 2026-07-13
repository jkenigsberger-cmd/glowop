import { Link } from "react-router-dom";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { BLOCK_REASON_LABELS, timesOverlap } from "@/lib/activitySpaceBlocks";

const shortDate = value => value?.split("-").slice(1).reverse().join("/") || "";

export default function DashboardSpaceBlocksAlert({ blocks, activities }) {
  const visibleBlocks = blocks.slice(0, 3);
  const conflictCount = blocks.filter(block =>
    block.status === "ACTIVE" && activities.some(activity =>
      activity.activity_space_id === block.activity_space_id &&
      activity.date >= block.start_date && activity.date <= block.end_date &&
      timesOverlap(activity.start_time, activity.end_time, block.start_time, block.end_time)
    )
  ).length;

  return (
    <Link to="/common-spaces" className="block rounded-xl border border-amber-300 border-r-4 border-r-amber-500 bg-amber-50 px-4 py-3 hover:bg-amber-100/70 transition-colors" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-950"><AlertTriangle className="h-4 w-4 text-amber-600" /> מרחבים חסומים / תחזוקה קרובה</p>
        <span className="flex items-center gap-1 text-xs font-medium text-amber-800">לניהול חסימות <ChevronLeft className="h-3.5 w-3.5" /></span>
      </div>
      {conflictCount > 0 && <p className="mt-1.5 text-xs font-bold text-destructive">⚠ קיימות פעילויות שמתנגשות עם חסימת מרחב</p>}
      <div className="mt-2 divide-y divide-amber-200">
        {visibleBlocks.map(block => (
          <div key={block.id} className="py-1.5 first:pt-0 last:pb-0 text-xs text-amber-950">
            <p className="font-semibold">{block.activity_space_name} — {BLOCK_REASON_LABELS[block.reason_type] || block.reason_type}</p>
            <p className="text-amber-800">{shortDate(block.start_date)}–{shortDate(block.end_date)} · {block.start_time}–{block.end_time}</p>
            {block.reason_notes && <p className="text-amber-700">הערה: {block.reason_notes}</p>}
          </div>
        ))}
      </div>
      {blocks.length > 3 && <p className="mt-1.5 text-xs font-semibold text-amber-800">ועוד {blocks.length - 3} חסימות</p>}
    </Link>
  );
}