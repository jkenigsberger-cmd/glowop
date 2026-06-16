import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);

function getWeekEnd() {
  const d = new Date();
  d.setDate(d.getDate() + (6 - d.getDay()));
  return d.toISOString().slice(0, 10);
}

function getMonthEnd() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Props:
 *   startDate: string | null
 *   endDate: string | null
 *   onStartChange: (v: string | null) => void
 *   onEndChange: (v: string | null) => void
 *   showChips?: boolean  — show quick-pick chips (today/tomorrow/week/month)
 *   className?: string
 */
export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange, showChips = false, className }) {
  const hasFilter = startDate || endDate;

  const applyChip = (start, end) => {
    onStartChange(start);
    onEndChange(end);
  };

  const clear = () => {
    onStartChange(null);
    onEndChange(null);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 shrink-0">מתאריך</span>
        <input
          type="date"
          value={startDate || ""}
          onChange={e => onStartChange(e.target.value || null)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 shrink-0">עד תאריך</span>
        <input
          type="date"
          value={endDate || ""}
          onChange={e => onEndChange(e.target.value || null)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {hasFilter && (
        <button onClick={clear} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <X className="w-3 h-3" /> נקה
        </button>
      )}

      {showChips && (
        <div className="flex flex-wrap gap-1.5">
          <ChipBtn label="היום"   onClick={() => applyChip(TODAY, TODAY)} active={startDate === TODAY && endDate === TODAY} />
          <ChipBtn label="מחר"    onClick={() => applyChip(getTomorrow(), getTomorrow())} active={startDate === getTomorrow() && endDate === getTomorrow()} />
          <ChipBtn label="השבוע"  onClick={() => applyChip(TODAY, getWeekEnd())} active={startDate === TODAY && endDate === getWeekEnd()} />
          <ChipBtn label="החודש"  onClick={() => applyChip(TODAY, getMonthEnd())} active={startDate === TODAY && endDate === getMonthEnd()} />
        </div>
      )}
    </div>
  );
}

function ChipBtn({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-2.5 py-1 rounded-full border transition-colors font-medium",
        active
          ? "bg-primary text-white border-primary"
          : "bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary"
      )}
    >
      {label}
    </button>
  );
}