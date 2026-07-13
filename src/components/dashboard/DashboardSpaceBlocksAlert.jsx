import { AlertTriangle, Ban } from "lucide-react";
import { BLOCK_REASON_LABELS, timesOverlap } from "@/lib/activitySpaceBlocks";

export default function DashboardSpaceBlocksAlert({ blocks, activities, groupById, selectedDate }) {
  const conflicts = blocks.flatMap(block => activities
    .filter(activity => activity.activity_space_id === block.activity_space_id && timesOverlap(activity.start_time, activity.end_time, block.start_time, block.end_time))
    .map(activity => ({ block, activity, group: groupById[activity.group_id] })));

  return (
    <div className="space-y-3">
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive"><AlertTriangle className="h-4 w-4" /> קיימות פעילויות שמתנגשות עם חסימת מרחב</p>
          <div className="space-y-1.5">
            {conflicts.map(({ block, activity, group }) => (
              <div key={`${block.id}-${activity.id}`} className="rounded-lg border border-destructive/20 bg-card px-3 py-2 text-xs text-foreground">
                <span className="font-semibold">{block.activity_space_name}</span> — {group?.group_name || "קבוצה לא ידועה"} — {activity.activity_name} — {selectedDate} — {activity.start_time}–{activity.end_time}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
        {blocks.map(block => (
          <div key={block.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-card px-3 py-2 text-sm text-amber-950">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div><p><span className="font-semibold">{block.activity_space_name}</span> — {BLOCK_REASON_LABELS[block.reason_type] || block.reason_type} — {block.start_time}–{block.end_time}</p>{block.reason_notes && <p className="mt-0.5 text-xs text-amber-800">הערה: {block.reason_notes}</p>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}