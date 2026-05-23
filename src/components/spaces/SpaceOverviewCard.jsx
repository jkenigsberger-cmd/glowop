import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1);
}

const SPACE_TYPE_LABELS = {
  BUNKER:      "בונקר",
  OHEL_MOED:  "אוהל מועד",
  DINING_HALL: "חדר אוכל",
};

export default function SpaceOverviewCard({ space, items, onSelectDay }) {
  const [expanded, setExpanded] = useState(false);

  const today = moment().format("YYYY-MM-DD");
  const nowTime = moment().format("HH:mm");

  const todayItems = items.filter((i) => i.date === today);
  const occupiedNow = todayItems.some(
    (i) => i.start_time <= nowTime && i.end_time > nowTime
  );
  const nextItem = items
    .filter((i) => i.date > today || (i.date === today && i.start_time > nowTime))
    .sort((a, b) => a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date))[0];

  // Detect conflicts
  const conflicts = [];
  const byDate = {};
  items.forEach((i) => { (byDate[i.date] = byDate[i.date] || []).push(i); });
  Object.values(byDate).forEach((dayItems) => {
    for (let a = 0; a < dayItems.length; a++) {
      for (let b = a + 1; b < dayItems.length; b++) {
        if (timesOverlap(dayItems[a].start_time, dayItems[a].end_time, dayItems[b].start_time, dayItems[b].end_time)) {
          conflicts.push([dayItems[a], dayItems[b]]);
        }
      }
    }
  });
  const hasConflict = conflicts.length > 0;

  const upcomingItems = items
    .filter((i) => i.date >= today)
    .sort((a, b) => a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm flex flex-col",
      hasConflict ? "border-red-300" : "border-slate-200"
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-slate-800 text-sm">{space.name}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* Type badge */}
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {SPACE_TYPE_LABELS[space.space_type] || space.space_type}
            </span>
            {/* Conflict badge */}
            {hasConflict && (
              <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> קונפליקט
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            occupiedNow
              ? "bg-red-100 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          )}>
            {occupiedNow
              ? <><Clock className="w-3 h-3" /> תפוס כרגע</>
              : <><CheckCircle2 className="w-3 h-3" /> פנוי</>
            }
          </div>
          <span className="text-xs text-slate-400">{todayItems.length} הזמנות היום</span>
        </div>

        {/* Next booking */}
        {nextItem ? (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <span className="text-slate-400">הזמנה הבאה: </span>
            <span className="font-semibold text-slate-700">{nextItem.groupName}</span>
            {" · "}
            <span>{nextItem.date === today ? "היום" : moment(nextItem.date).format("DD/MM")}</span>
            {" · "}
            <span>{nextItem.start_time}–{nextItem.end_time}</span>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">אין הזמנות קרובות</div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-center gap-1 py-2 border-t border-slate-100 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors rounded-b-xl"
      >
        {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> סגור</> : <><ChevronDown className="w-3.5 h-3.5" /> הזמנות קרובות ({upcomingItems.length})</>}
      </button>

      {/* Upcoming list */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {upcomingItems.length === 0 && (
            <p className="text-xs text-slate-400 italic">אין הזמנות</p>
          )}
          {upcomingItems.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-700">{item.groupName}</div>
                <div className="text-slate-500">{item.activityName}</div>
                {item.pax && <div className="text-slate-400">{item.pax} 👤</div>}
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-slate-500">{moment(item.date).format("DD/MM")}</div>
                <div className="text-slate-400">{item.start_time}–{item.end_time}</div>
                <Link
                  to={`/groups/${item.groupId}`}
                  className="text-primary hover:underline text-[10px]"
                >
                  קבוצה ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}