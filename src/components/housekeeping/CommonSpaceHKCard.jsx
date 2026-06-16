import { Users, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const SPACE_TYPE_LABEL = {
  BUNKER: "בונקר",
  OHEL_MOED: "אוהל מועד",
  DINING_HALL: "חדר אוכל",
  FIREPLACE: "מדורה",
};

/**
 * Read-only card for a common/activity space in the Housekeeping view.
 * Shows the space name, all bookings (GroupScheduleItems) for the selected date,
 * time ranges, group names, and pax.
 *
 * Props:
 *   space        - ActivitySpace record
 *   items        - GroupScheduleItem[] for this space on the selected date
 *   groupsMap    - { [id]: Group }
 */
export default function CommonSpaceHKCard({ space, items = [], groupsMap = {} }) {
  const [expanded, setExpanded] = useState(false);

  if (!space) return null;

  const activeItems = items.filter(i => i.status === "ACTIVE");
  if (activeItems.length === 0) return null;

  // Sort by start_time
  const sorted = [...activeItems].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const totalPax = sorted.reduce((s, i) => s + (i.pax || 0), 0);

  return (
    <div className="border border-purple-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-purple-50/30 transition-colors"
      >
        {/* Dot */}
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />

        {/* Space name */}
        <span className="font-bold text-sm text-slate-800 flex-1 text-right truncate">
          {space.name}
        </span>

        {/* Type badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-purple-100 text-purple-700 border-purple-200">
          {SPACE_TYPE_LABEL[space.space_type] || space.space_type}
        </span>

        {/* Booking count */}
        <span className="text-xs text-slate-500 shrink-0">
          {sorted.length} הזמנות
        </span>

        {/* Total pax */}
        {totalPax > 0 && (
          <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {totalPax}
          </span>
        )}

        {expanded
          ? <ChevronUp   className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        }
      </button>

      {expanded && (
        <div className="border-t border-purple-100 bg-purple-50/20 p-3 space-y-2 text-xs">

          {/* Capacity note */}
          {space.capacity && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="w-3 h-3" />
              קיבולת מרחב: {space.capacity} אנשים
            </div>
          )}

          {/* Bookings list */}
          <div className="space-y-1.5">
            {sorted.map((item, idx) => {
              const group = groupsMap[item.group_id];
              return (
                <div key={item.id || idx} className="flex items-start justify-between px-3 py-2 bg-white border border-purple-200 rounded-lg gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {group
                        ? <Link to={`/groups/${group.id}`} className="hover:underline">{group.group_name}</Link>
                        : "קבוצה לא ידועה"
                      }
                    </div>
                    <div className="text-slate-500 mt-0.5">{item.activity_name}</div>
                  </div>
                  <div className="shrink-0 text-left space-y-0.5">
                    <div className="flex items-center gap-1 text-purple-700 font-medium">
                      <Clock className="w-3 h-3" />
                      {item.start_time} – {item.end_time}
                    </div>
                    {item.pax > 0 && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Users className="w-3 h-3" />
                        {item.pax}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          {space.notes && (
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600">
              <span className="font-semibold">הערות: </span>{space.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}