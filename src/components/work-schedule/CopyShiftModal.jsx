import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ROW_BY_TYPE, DAY_NAMES, getWeekDays, fmtDM, fmtShiftTime } from "@/lib/workScheduleConfig";

export default function CopyShiftModal({ shift, weekStart, shifts, onCopy, onClose }) {
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = getWeekDays(weekStart);
  const row = ROW_BY_TYPE[shift.row_type] || {};
  const blocked = shift.auto_created_from === "OPERATIONS_EVENING_TO_NIGHT_ON_CALL";
  const conflicts = useMemo(() => selected.filter((date) => shifts.some((item) =>
    item.id !== shift.id && item.status !== "CANCELLED" && item.date === date &&
    item.row_type === shift.row_type && (item.start_time || "") === (shift.start_time || "") &&
    (item.end_time || "") === (shift.end_time || "") && (item.worker_id || "") !== (shift.worker_id || "")
  )), [selected, shifts, shift]);

  const submit = async () => {
    setBusy(true); setError("");
    try { await onCopy(selected); } catch (e) { setError(e.response?.data?.error || e.message || "שגיאה בהעתקה"); setBusy(false); }
  };

  return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-md" dir="rtl">
    <DialogHeader><DialogTitle>העתקת משמרת</DialogTitle></DialogHeader>
    <div className="rounded-xl border bg-slate-50 p-3 text-sm space-y-1">
      <div><b>{shift.worker_name || (row.countBased ? `${shift.worker_count || 0} מנקות` : "—")}</b> · {shift.row_label || row.label}</div>
      <div>{fmtDM(shift.date)} · <span dir="ltr">{fmtShiftTime(shift.start_time, shift.end_time) || "—"}</span></div>
      {shift.notes && <div className="text-slate-500">{shift.notes}</div>}
    </div>
    {blocked ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">לא ניתן להעתיק כונן לילה אוטומטי ישירות. יש להעתיק את משמרת תפעול ערב או ליצור ידנית.</div> : <div className="grid grid-cols-2 gap-2">
      {days.map((date, index) => <label key={date} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${date === shift.date ? "opacity-40" : "cursor-pointer hover:bg-slate-50"}`}>
        <input type="checkbox" disabled={date === shift.date} checked={selected.includes(date)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, date] : current.filter((value) => value !== date))} />
        {DAY_NAMES[index]} · {fmtDM(date)}
      </label>)}
    </div>}
    {conflicts.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">כבר קיימת משמרת בשורה הזו ביום הזה ({conflicts.length})</div>}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
    <div className="flex gap-2"><Button onClick={submit} disabled={blocked || !selected.length || busy} className="flex-1">{busy ? "מעתיק..." : "העתק משמרת"}</Button><Button variant="outline" onClick={onClose}>ביטול</Button></div>
  </DialogContent></Dialog>;
}