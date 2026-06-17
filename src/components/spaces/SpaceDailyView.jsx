import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogisticsBadges } from "@/components/schedule/LogisticsFields";

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

export default function SpaceDailyView({ spaces, itemsBySpace, date }) {
  const hasAnyBooking = spaces.some((s) => (itemsBySpace[s.id] || []).length > 0);

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
        const dayItems = (itemsBySpace[space.id] || []).sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        );
        if (dayItems.length === 0) return null;

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
              <span className="text-xs text-slate-500">{dayItems.length} הזמנות</span>
            </div>

            {/* Bookings list */}
            <div className="divide-y divide-slate-100">
              {dayItems.map((item) => {
                const conflict = isConflicting(item, dayItems);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "px-4 py-3 flex items-start justify-between gap-3",
                      conflict ? "bg-red-50" : "bg-white"
                    )}
                  >
                    {/* Time */}
                    <div className="text-sm font-bold text-slate-700 shrink-0 min-w-[80px]">
                      {item.start_time}–{item.end_time}
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 text-sm">{item.groupName}</span>
                        {item.pax && (
                          <span className="text-xs text-slate-400">{item.pax} 👤</span>
                        )}
                        {conflict && (
                          <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                            <AlertTriangle className="w-2.5 h-2.5" /> חפיפה
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">{item.activityName}</div>
                      <LogisticsBadges item={item} />
                      {item.notes && (
                        <div className="text-xs text-slate-400 italic">{item.notes}</div>
                      )}
                    </div>

                    {/* Link */}
                    <Link
                      to={`/groups/${item.groupId}`}
                      className="text-xs text-primary hover:underline shrink-0 mt-0.5"
                    >
                      קבוצה ↗
                    </Link>
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