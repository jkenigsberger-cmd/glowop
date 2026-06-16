import { Users, Clock, MapPin, UtensilsCrossed, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const MEAL_LABEL = {
  BREAKFAST: "ארוחת בוקר",
  LUNCH: "ארוחת צהריים",
  DINNER: "ארוחת ערב",
  COFFEE_CORNER: "פינת קפה",
  OTHER: "אחר",
};

/**
 * Read-only card for a day-use group in the Housekeeping view.
 * Shows arrival/departure, pax, meals, spaces used, notes.
 * No tent logic here.
 */
export default function DayUseGroupCard({ group, meals = [], scheduleItems = [], spacesMap = {} }) {
  const [expanded, setExpanded] = useState(false);

  if (!group) return null;

  const activeMeals   = meals.filter(m => m.status === "ACTIVE");
  const activeItems   = scheduleItems.filter(s => s.status === "ACTIVE");
  const usedSpaceIds  = [...new Set(activeItems.map(s => s.activity_space_id).filter(Boolean))];
  const usedSpaces    = usedSpaceIds.map(id => spacesMap[id]).filter(Boolean);

  return (
    <div className="border border-teal-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-teal-50/30 transition-colors"
      >
        {/* Dot */}
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0" />

        {/* Group name */}
        <span className="font-bold text-sm text-slate-800 flex-1 text-right truncate">
          {group.group_name}
        </span>

        {/* Pax */}
        <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {group.total_pax || "?"}
        </span>

        {/* Type badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-teal-100 text-teal-700 border-teal-300">
          קבוצת יום
        </span>

        {/* Meals count */}
        {activeMeals.length > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-amber-100 text-amber-700 border-amber-200">
            {activeMeals.length} ארוחות
          </span>
        )}

        {expanded
          ? <ChevronUp   className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        }
      </button>

      {expanded && (
        <div className="border-t border-teal-100 bg-teal-50/20 p-3 space-y-3 text-xs">

          {/* Times */}
          <div className="flex flex-wrap gap-4">
            {group.arrival_time && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span className="font-semibold">הגעה:</span> {group.arrival_time}
              </div>
            )}
            {group.departure_time && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-semibold">סיום:</span> {group.departure_time}
              </div>
            )}
            {!group.arrival_time && !group.departure_time && (
              <span className="text-slate-400">שעות הגעה/יציאה לא הוגדרו</span>
            )}
          </div>

          {/* Spaces */}
          {usedSpaces.length > 0 && (
            <div>
              <p className="font-semibold text-teal-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> מרחבים בשימוש
              </p>
              <div className="flex flex-wrap gap-1.5">
                {usedSpaces.map(s => (
                  <span key={s.id} className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full border border-teal-200">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meals */}
          {activeMeals.length > 0 && (
            <div>
              <p className="font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" /> ארוחות
              </p>
              <div className="space-y-1">
                {activeMeals.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-2 py-1 bg-white border border-amber-200 rounded-lg">
                    <span className="font-medium text-slate-700">{MEAL_LABEL[m.meal_type] || m.meal_type}</span>
                    <span className="text-slate-500">{m.start_time}{m.end_time ? ` – ${m.end_time}` : ""} · {m.pax} אנשים</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {activeItems.length > 0 && (
            <div>
              <p className="font-semibold text-slate-600 mb-1">פעילויות</p>
              <div className="space-y-1">
                {activeItems.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-lg">
                    <span className="font-medium text-slate-700">{s.activity_name}</span>
                    <span className="text-slate-400">{s.start_time} – {s.end_time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {group.internal_notes && (
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600">
              <span className="font-semibold">הערות: </span>{group.internal_notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}