import { StickyNote } from "lucide-react";
import { ROW_BY_TYPE, fmtShiftTime } from "@/lib/workScheduleConfig";

// Small colored chip inside a grid cell — worker name + hours (+ note)
export default function ShiftCard({ shift, onClick, clickable }) {
  const row = ROW_BY_TYPE[shift.row_type] || {};
  const cancelled = shift.status === "CANCELLED";
  const isTextOnly = row.textOnly;

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      className={`w-full text-right rounded-lg border px-2 py-1 text-[11px] leading-tight transition-shadow
        ${row.chip || "bg-white border-slate-300 text-slate-700"}
        ${cancelled ? "opacity-40 line-through" : ""}
        ${clickable ? "hover:shadow cursor-pointer" : "cursor-default"}`}
    >
      {isTextOnly ? (
        <span className="whitespace-pre-line">{shift.notes || "—"}</span>
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
        </>
      )}
    </button>
  );
}