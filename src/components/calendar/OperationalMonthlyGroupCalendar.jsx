/**
 * OperationalMonthlyGroupCalendar — reusable monthly calendar for Housekeeping & Allocation.
 * Props:
 *   groups        — all Group records
 *   selectedMonth — moment object (pivot month)
 *   onMonthChange — (newMoment) => void
 *   onGroupClick  — (group) => void
 *   getGroupLabel — (group, date) => { label, color } | null
 *   mode          — "housekeeping" | "allocation"
 */
import moment from "moment";
import "moment/locale/he";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

moment.locale("he");

const TODAY = new Date().toISOString().slice(0, 10);

// Returns all days that belong to the calendar grid (fills complete weeks)
function buildCalendarGrid(pivot) {
  const start = pivot.clone().startOf("month").startOf("week"); // Sunday
  const end   = pivot.clone().endOf("month").endOf("week");
  const days  = [];
  let cur = start.clone();
  while (cur.isSameOrBefore(end, "day")) {
    days.push(cur.format("YYYY-MM-DD"));
    cur.add(1, "day");
  }
  return days;
}

// Groups relevant to a given date: staying / arriving / departing
function groupsForDate(groups, dateStr) {
  return groups.filter(g => {
    const arr = g.arrival_date;
    const dep = g.departure_date;
    if (!arr) return false;
    if (g.status === "CANCELLED") return false;
    if (arr === dateStr) return true;
    if (dep === dateStr) return true;
    if (!dep) return false;
    return arr <= dateStr && dep > dateStr;
  });
}

function DayCell({ dateStr, inMonth, groups, onGroupClick, getGroupLabel }) {
  const isToday = dateStr === TODAY;
  const dayGroups = groupsForDate(groups, dateStr);

  return (
    <div className={`min-h-[90px] border-b border-r border-slate-200 p-1.5 ${
      inMonth ? "bg-white" : "bg-slate-50/60"
    } ${isToday ? "ring-2 ring-inset ring-primary/30" : ""}`}>
      {/* Day number */}
      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
        isToday ? "bg-primary text-white" : inMonth ? "text-slate-700" : "text-slate-300"
      }`}>
        {moment(dateStr).date()}
      </div>

      {/* Group chips */}
      <div className="space-y-0.5">
        {dayGroups.slice(0, 4).map(g => {
          const cfg = getGroupLabel ? getGroupLabel(g, dateStr) : null;
          const isArr = g.arrival_date === dateStr;
          const isDep = g.departure_date === dateStr;
          const label = cfg?.label || (isArr ? "הגעה" : isDep ? "עזיבה" : "שוהה");
          const color = cfg?.color || (isArr ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : isDep ? "bg-orange-100 text-orange-800 border-orange-200"
            : "bg-blue-50 text-blue-700 border-blue-200");

          return (
            <button
              key={g.id}
              onClick={() => onGroupClick(g)}
              className={`w-full text-right text-[10px] font-medium px-1.5 py-0.5 rounded border ${color} hover:opacity-80 transition-opacity truncate leading-tight`}
              title={g.group_name}
            >
              <span className="opacity-60">[{label}] </span>
              {g.group_name}
              {g.total_pax ? <span className="opacity-50 mr-0.5"> ·{g.total_pax}</span> : null}
            </button>
          );
        })}
        {dayGroups.length > 4 && (
          <p className="text-[9px] text-slate-400 pr-1">+{dayGroups.length - 4} נוספות</p>
        )}
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export default function OperationalMonthlyGroupCalendar({
  groups = [],
  selectedMonth,
  onMonthChange,
  onGroupClick,
  getGroupLabel,
}) {
  const pivot  = selectedMonth || moment();
  const grid   = buildCalendarGrid(pivot);
  const pivotMonth = pivot.format("YYYY-MM");

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onMonthChange(pivot.clone().subtract(1, "month"))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-base font-semibold text-slate-800 min-w-[140px] text-center">
          {pivot.format("MMMM YYYY")}
        </span>
        <button
          onClick={() => onMonthChange(pivot.clone().add(1, "month"))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMonthChange(moment())}
          className="text-xs"
        >
          החודש
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
          {WEEKDAY_LABELS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {grid.map(dateStr => (
            <DayCell
              key={dateStr}
              dateStr={dateStr}
              inMonth={dateStr.slice(0, 7) === pivotMonth}
              groups={groups}
              onGroupClick={onGroupClick}
              getGroupLabel={getGroupLabel}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border bg-emerald-100 border-emerald-200 inline-block" /> הגעה
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border bg-orange-100 border-orange-200 inline-block" /> עזיבה
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border bg-blue-50 border-blue-200 inline-block" /> שוהה
        </span>
      </div>
    </div>
  );
}