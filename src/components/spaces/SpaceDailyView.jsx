import { Link } from "react-router-dom";
import { AlertTriangle, Users, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCK_REASON_LABELS, timesOverlap } from "@/lib/activitySpaceBlocks";
import { mergeSharedActivities } from "@/lib/mergeSharedActivities";

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isConflicting(item, allDayItems) {
  return allDayItems.some(
    (other) =>
      other.id !== item.id &&
      timeToMinutes(item.start_time) < timeToMinutes(other.end_time) &&
      timeToMinutes(other.start_time) < timeToMinutes(item.end_time)
  );
}

const SPACE_TYPE_LABELS = { BUNKER: "בונקר", OHEL_MOED: "אוהל מועד", DINING_HALL: "חדר אוכל", FIREPLACE: "בולדר" };

export default function SpaceDailyView({ spaces, itemsBySpace, blocks = [], date }) {
  const hasAnyBooking = spaces.some((s) => (itemsBySpace[s.id] || []).length > 0 || blocks.some(b => b.activity_space_id === s.id));

  if (!hasAnyBooking) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        אין הזמנות ב-{date}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {spaces.map((space) => {
        const rawDayItems = (itemsBySpace[space.id] || []).sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );
        const spaceBlocks = blocks.filter(b => b.activity_space_id === space.id);
        if (rawDayItems.length === 0 && spaceBlocks.length === 0) return null;

        const dayItems = mergeSharedActivities(rawDayItems);

        return (
          <div key={space.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Space header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">{space.name}</span>
                <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                  {SPACE_TYPE_LABELS[space.space_type] || space.space_type}
                </span>
              </div>
              <span className="text-xs text-slate-500">{dayItems.length} הזמנות · {spaceBlocks.length} חסימות</span>
            </div>

            {/* Bookings list */}
            <div className="divide-y divide-slate-100">
              {spaceBlocks.map(block => (
                <div key={block.id} className="px-4 py-3 flex gap-3 items-start bg-amber-50 border-r-4 border-amber-500">
                  <div className="text-sm font-bold text-amber-800 shrink-0 min-w-[80px]">{block.start_time}–{block.end_time}</div>
                  <div className="flex-1"><p className="font-semibold text-sm text-amber-900 flex items-center gap-1"><Ban className="w-4 h-4" /> לא זמין — {BLOCK_REASON_LABELS[block.reason_type] || block.reason_type}</p>{block.reason_notes && <p className="text-xs text-amber-700 mt-1">{block.reason_notes}</p>}</div>
                </div>
              ))}
              {dayItems.map((item) => {
                const blockConflict = spaceBlocks.some(block => timesOverlap(item.start_time, item.end_time, block.start_time, block.end_time));
                const conflict = blockConflict || (!item.isShared && isConflicting(item, rawDayItems));
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "px-4 py-3 flex items-start justify-between gap-3",
                      item.isShared ? "bg-violet-50 border-r-2 border-violet-400" : conflict ? "bg-red-50" : "bg-white"
                    )}
                  >
                    {/* Time */}
                    <div className={cn("text-sm font-bold shrink-0 min-w-[80px]", item.isShared ? "text-violet-700" : "text-slate-700")}>
                      {item.start_time}–{item.end_time}
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-1">
                      {item.isShared ? (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] bg-violet-600 text-white font-bold px-2 py-0.5 rounded-full">פעילות משותפת</span>
                            <span className="text-[10px] text-violet-500">מאוחד מ-{item.linkedGroups.length} קבוצות</span>
                          </div>
                          <div className="text-xs font-semibold text-slate-800">{item.activity_name || item.activityName}</div>
                          <div className="flex items-center gap-1 text-xs font-bold text-violet-700">
                            <Users className="w-3 h-3" /> סה״כ: {item.totalPax} משתתפים
                          </div>
                          <ul className="space-y-0.5">
                            {item.linkedGroups.map(g => (
                              <li key={g.groupId} className="text-xs text-slate-500">
                                · {g.groupName}{g.pax ? ` — ${g.pax}` : ""}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 text-sm">{item.groupName}</span>
                            {item.pax && (
                              <span className="text-xs text-slate-400">{item.pax} 👤</span>
                            )}
                            {conflict && (
                              <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                                <AlertTriangle className="w-2.5 h-2.5" /> {blockConflict ? "התנגשות עם חסימה" : "חפיפה"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600">{item.activityName || item.activity_name}</div>
                          {item.notes && (
                            <div className="text-xs text-slate-400 italic">{item.notes}</div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Link — only for non-shared (shared has no single group to link to) */}
                    {!item.isShared && (
                      <Link
                        to={`/groups/${item.groupId || item.group_id}`}
                        className="text-xs text-primary hover:underline shrink-0 mt-0.5"
                      >
                        קבוצה ↗
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}