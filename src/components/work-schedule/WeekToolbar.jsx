import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Copy, Save, Send } from "lucide-react";
import { addDays, fmtDM, getWeekStart } from "@/lib/workScheduleConfig";

const STATUS_BADGE = {
  DRAFT:     { label: "טיוטה",  cls: "bg-amber-100 text-amber-700" },
  PUBLISHED: { label: "פורסם",  cls: "bg-green-100 text-green-700" },
  ARCHIVED:  { label: "בארכיון", cls: "bg-slate-100 text-slate-500" },
};

export default function WeekToolbar({ weekStart, setWeekStart, schedule, onCopyPrev, onCreateDraft, onPublish, busy }) {
  const badge = schedule ? STATUS_BADGE[schedule.status] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Week navigation */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1 py-1 shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, -7))} title="שבוע קודם">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => e.target.value && setWeekStart(getWeekStart(new Date(e.target.value + "T12:00:00")))}
          className="text-xs border-0 bg-transparent focus:outline-none w-[110px] text-center"
        />
        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap px-1">
          {fmtDM(weekStart)} – {fmtDM(addDays(weekStart, 6))}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, 7))} title="שבוע הבא">
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Status badge */}
      {badge ? (
        <span className={`text-xs font-semibold rounded-full px-3 py-1 ${badge.cls}`}>{badge.label}</span>
      ) : (
        <span className="text-xs font-semibold rounded-full px-3 py-1 bg-slate-100 text-slate-400">אין סידור לשבוע זה</span>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onCopyPrev} disabled={busy}>
        <Copy className="w-3.5 h-3.5" /> העתק משבוע קודם
      </Button>
      {!schedule && (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onCreateDraft} disabled={busy}>
          <Save className="w-3.5 h-3.5" /> שמור טיוטה
        </Button>
      )}
      {schedule?.status === "DRAFT" && (
        <Button size="sm" className="gap-1.5 text-xs" onClick={onPublish} disabled={busy}>
          <Send className="w-3.5 h-3.5" /> פרסם סידור
        </Button>
      )}
    </div>
  );
}