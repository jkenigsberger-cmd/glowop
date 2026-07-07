import { Plus } from "lucide-react";
import { ROW_TYPES, getWeekDays, fmtDM, DAY_NAMES } from "@/lib/workScheduleConfig";
import ShiftCard from "@/components/work-schedule/ShiftCard";

// Weekly Excel-like grid: columns = Sunday→Saturday, rows = fixed row types
export default function ScheduleGrid({ weekStart, shifts, teamFilter, canManage, onAddShift, onEditShift, onToggleNightOnCall }) {
  const days = getWeekDays(weekStart);
  const today = new Date().toISOString().slice(0, 10);

  const visibleRows = ROW_TYPES.filter(
    (r) => teamFilter === "ALL" || !r.team || r.team === teamFilter
  );

  const cellShifts = (date, rowType) =>
    shifts
      .filter((s) => s.date === date && s.row_type === rowType)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr>
            <th className="sticky right-0 z-10 bg-slate-100 border-b border-l border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 text-right w-32">
              אזור / משמרת
            </th>
            {days.map((d, i) => (
              <th
                key={d}
                className={`border-b border-l border-slate-200 px-2 py-2 text-xs font-bold text-center min-w-[110px]
                  ${d === today ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"}`}
              >
                <div>{DAY_NAMES[i]}</div>
                <div className="font-normal text-[10px]">{fmtDM(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.type}>
              <td className={`sticky right-0 z-10 border-b border-l border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 align-top ${row.cell}`}>
                {row.label}
              </td>
              {days.map((d) => {
                const items = cellShifts(d, row.type);
                return (
                  <td key={d} className={`border-b border-l border-slate-100 p-1 align-top ${row.cell} ${d === today ? "ring-1 ring-inset ring-primary/20" : ""}`}>
                    <div className="space-y-1 min-h-[34px]">
                      {items.map((s) => {
                        const linkedNightOnCall = shifts.some((n) =>
                          n.row_type === "NIGHT_ON_CALL" &&
                          n.status === "PLANNED" &&
                          n.linked_source_shift_id === s.id &&
                          n.auto_created_from === "OPERATIONS_EVENING_TO_NIGHT_ON_CALL"
                        );
                        return (
                          <ShiftCard
                            key={s.id}
                            shift={s}
                            clickable={canManage}
                            onClick={() => onEditShift(s)}
                            showNightOnCallToggle={canManage && s.row_type === "OPERATIONS_EVENING" && s.status === "PLANNED"}
                            nightOnCallLinked={linkedNightOnCall}
                            onToggleNightOnCall={onToggleNightOnCall}
                          />
                        );
                      })}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onAddShift(d, row.type)}
                          className="w-full flex items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-300 hover:text-primary hover:border-primary/50 py-0.5 transition-colors"
                          title="הוסף משמרת"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}