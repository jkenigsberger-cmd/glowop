import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtDM, fmtShiftTime, dayNameOf } from "@/lib/workScheduleConfig";
import { REQUEST_TYPE_LABELS } from "@/lib/workScheduleRequestLabels";

export default function WorkerShiftRequestModal({ open, onClose, shifts, onCreated }) {
  const [form, setForm] = useState({ request_type: "DAY_OFF", start_date: "", end_date: "", start_time: "", end_time: "", related_shift_id: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const needsDate = form.request_type !== "GENERAL_NOTE";
  const submit = async () => {
    if (!form.message.trim() || (needsDate && !form.start_date)) return;
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("manageWorkScheduleRequests", { action: "create", request: { ...form, date: form.start_date, end_date: form.end_date || form.start_date } });
      onCreated(); onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onClose}><DialogContent className="max-w-lg" dir="rtl"><DialogHeader><DialogTitle>בקשה חדשה</DialogTitle></DialogHeader><div className="space-y-3">
    <label className="text-sm font-semibold">סוג בקשה</label><select value={form.request_type} onChange={(e) => set("request_type", e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">{Object.entries(REQUEST_TYPE_LABELS).filter(([key]) => !["WANT_TO_WORK", "CANNOT_WORK", "CHANGE_SHIFT", "GENERAL"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    {needsDate && <div className="grid grid-cols-2 gap-2"><input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="rounded-md border px-3 py-2 text-sm" /><input type="date" value={form.end_date} min={form.start_date} onChange={(e) => set("end_date", e.target.value)} className="rounded-md border px-3 py-2 text-sm" /></div>}
    <div className="grid grid-cols-2 gap-2"><input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} className="rounded-md border px-3 py-2 text-sm" /><input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} className="rounded-md border px-3 py-2 text-sm" /></div>
    {form.request_type === "SHIFT_CHANGE" && <select value={form.related_shift_id} onChange={(e) => set("related_shift_id", e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm"><option value="">ללא משמרת מסוימת</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{dayNameOf(shift.date)} {fmtDM(shift.date)} · {shift.row_label} {fmtShiftTime(shift.start_time, shift.end_time)}</option>)}</select>}
    <Textarea value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="הודעה *" rows={4} />{error && <div className="text-xs text-red-600">{error}</div>}
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>ביטול</Button><Button onClick={submit} disabled={busy || !form.message.trim() || (needsDate && !form.start_date)}>שלח בקשה</Button></div>
  </div></DialogContent></Dialog>;
}