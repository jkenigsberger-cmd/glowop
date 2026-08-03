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
import { ChevronLeft, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isGroupOperationallyEnabled } from "@/lib/groupOperationalIsolation";

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
    if (!isGroupOperationallyEnabled(g)) return false;
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

// Icon + color config per event type
function getEventStyle(isArr, isDep) {
  if (isArr) return {
    icon: ArrowDownToLine,
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-300",
    iconColor: "text-emerald-600",
  };
  if (isDep) return {
    icon: ArrowUpFromLine,
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-800 border-orange-300",
    iconColor: "text-orange-600",
  };
  return {
    icon: Moon,
    dot: "bg-blue-400",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-500",
  };
}

function DayCell({ dateStr, inMonth, groups, onGroupClick, getGroupLabel }) {
  const isToday = dateStr === TODAY;
  const dayGroups = groupsForDate(groups, dateStr);
  const MAX_VISIBLE = 3;
  const overflow = dayGroups.length - MAX_VISIBLE;

  return (
    <div className={`min-h-[80px] border-b border-r border-slate-200 p-1 ${
      inMonth ? "bg-white" : "bg-slate-50/40"
    } ${isToday ? "bg-primary/5 ring-2 ring-inset ring-primary/40" : ""}`}>

      {/* Day number */}
      <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full leading-none ${
        isToday ? "bg-primary text-white shadow-sm" : inMonth ? "text-slate-700" : "text-slate-300"
      }`}>
        {moment(dateStr).date()}
      </div>

      {/* Group chips — icon-first, minimal text */}
      <div className="space-y-0.5">
        {dayGroups.slice(0, MAX_VISIBLE).map(g => {
          const isArr = g.arrival_date === dateStr;
          const isDep = g.departure_date === dateStr;
          const style = getEventStyle(isArr, isDep);
          const Icon = style.icon;
          // Custom label/color override from parent
          const cfg = getGroupLabel ? getGroupLabel(g, dateStr) : null;
          const chipColor = cfg?.color || style.chip;

          return (
            <button
              key={g.id}
              onClick={() => onGroupClick(g)}
              className={`w-full flex items-center gap-0.5 text-right text-[9px] font-semibold px-1 py-0.5 rounded border ${chipColor} active:opacity-60 transition-opacity`}
              title={g.group_name}
              style={{ minHeight: '20px' }}
            >
              <Icon className={`w-2.5 h-2.5 shrink-0 ${style.iconColor}`} />
              <span className="truncate leading-tight">{g.group_name}</span>
            </button>
          );
        })}
        {overflow > 0 && (
          <div className="flex items-center gap-0.5 px-1">
            {dayGroups.slice(MAX_VISIBLE).map((g, i) => {
              const isArr = g.arrival_date === dateStr;
              const isDep = g.departure_date === dateStr;
              const style = getEventStyle(isArr, isDep);
              return <span key={i} className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} title={g.group_name} />;
            })}
            <span className="text-[9px] text-slate-400 leading-none">+{overflow}</span>
          </div>
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
        <span className="flex items-center gap-1.5">
          <ArrowDownToLine className="w-3 h-3 text-emerald-600" /> הגעה
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowUpFromLine className="w-3 h-3 text-orange-600" /> עזיבה
        </span>
        <span className="flex items-center gap-1.5">
          <Moon className="w-3 h-3 text-blue-500" /> שוהה
        </span>
      </div>
    </div>
  );
}