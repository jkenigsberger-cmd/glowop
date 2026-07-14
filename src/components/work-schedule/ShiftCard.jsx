import { StickyNote, Moon, Copy } from "lucide-react";
import { ROW_BY_TYPE, fmtShiftTime } from "@/lib/workScheduleConfig";

// Small colored chip inside a grid cell — worker name + hours (+ note)
export default function ShiftCard({ shift, onClick, onCopy, clickable, copyable, showNightOnCallToggle, nightOnCallLinked, onToggleNightOnCall }) {
  const row = ROW_BY_TYPE[shift.row_type] || {};
  const cancelled = shift.status === "CANCELLED";
  const isTextOnly = row.textOnly;
  const isCountBased = row.countBased;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) onClick?.(); }}
      className={`w-full text-right rounded-lg border px-2 py-1 text-[11px] leading-tight transition-shadow
        ${row.chip || "bg-white border-slate-300 text-slate-700"}
        ${cancelled ? "opacity-40 line-through" : ""}
        ${clickable ? "hover:shadow cursor-pointer" : "cursor-default"}`}
    >
      {isTextOnly ? (
        <span className="whitespace-pre-line">{shift.notes || "—"}</span>
      ) : isCountBased ? (
        <>
          <span className="font-semibold block">{row.label}</span>
          <span className="block">{Number(shift.worker_count || 0)} מנקות</span>
          {shift.notes && (
            <span className="flex items-center gap-0.5 mt-0.5 opacity-70">
              <StickyNote className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{shift.notes}</span>
            </span>
          )}
        </>
      ) : (
        <>
          <span className="font-semibold">{shift.worker_name || "—"}</span>
          {(shift.start_time || shift.end_time) && (
            <span className="mr-1 font-mono" dir="ltr">{fmtShiftTime(shift.start_time, shift.end_time)}</span>
          )}
          {shift.notes && (
            <span className="flex items-center gap-0.5 mt-0.5 opacity-70">
              <StickyNote className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{shift.notes}</span>
            </span>
          )}
          {shift.auto_created_from === "OPERATIONS_EVENING_TO_NIGHT_ON_CALL" && (
            <span className="inline-flex mt-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">נוצר מתפעול ערב</span>
          )}
          {copyable && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onCopy?.(shift); }} className="mt-1 ml-1 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-primary" title="העתק לימים נוספים">
              <Copy className="w-2.5 h-2.5" /> העתק
            </button>
          )}
          {showNightOnCallToggle && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleNightOnCall?.(shift, !nightOnCallLinked); }}
              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                nightOnCallLinked
                  ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                  : "bg-white/70 border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-700"
              }`}
            >
              <Moon className="w-2.5 h-2.5" />
              כונן לילה
            </button>
          )}
        </>
      )}
    </div>
  );
}