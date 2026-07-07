import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtDM, fmtShiftTime, dayNameOf } from "@/lib/workScheduleConfig";
import { REQUEST_TYPE_LABELS, SLOT_LABELS } from "@/lib/workScheduleRequestLabels";

export default function WorkerShiftRequestModal({ open, onClose, profile, email, shifts, onCreated }) {
  const [type, setType] = useState("WANT_TO_WORK");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("ANY");
  const [shiftId, setShiftId] = useState(shifts[0]?.id || "");
  const [changeText, setChangeText] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedShift = shifts.find((shift) => shift.id === shiftId);
  const shiftSummary = selectedShift ? `${dayNameOf(selectedShift.date)} ${fmtDM(selectedShift.date)} · ${selectedShift.row_label} ${fmtShiftTime(selectedShift.start_time, selectedShift.end_time)}`.trim() : "";
  const canSubmit = type === "GENERAL" ? changeText.trim() : type === "CHANGE_SHIFT" ? shiftId && changeText.trim() : !!date;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    await base44.entities.WorkScheduleRequest.create({
      worker_id: profile?.id,
      worker_name: profile?.full_name,
      worker_email: email,
      request_type: type,
      date: type === "WANT_TO_WORK" || type === "CANNOT_WORK" ? date : selectedShift?.date,
      preferred_slot: type === "WANT_TO_WORK" ? slot : undefined,
      related_shift_id: type === "CHANGE_SHIFT" ? shiftId : undefined,
      current_shift_summary: type === "CHANGE_SHIFT" ? shiftSummary : undefined,
      requested_change_text: type === "CHANGE_SHIFT" || type === "GENERAL" ? changeText : undefined,
      notes,
      status: "PENDING",
      created_by: email,
    });
    setBusy(false);
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>בקשה חדשה</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">סוג בקשה</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {(type === "WANT_TO_WORK" || type === "CANNOT_WORK") && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />}
          {type === "WANT_TO_WORK" && <select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{Object.entries(SLOT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}
          {type === "CHANGE_SHIFT" && <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{shifts.map((shift) => <option key={shift.id} value={shift.id}>{dayNameOf(shift.date)} {fmtDM(shift.date)} · {shift.row_label} {fmtShiftTime(shift.start_time, shift.end_time)}</option>)}</select>}
          {(type === "CHANGE_SHIFT" || type === "GENERAL") && <Textarea value={changeText} onChange={(e) => setChangeText(e.target.value)} placeholder={type === "GENERAL" ? "כתוב/כתבי את הבקשה" : "מה תרצה/י לשנות?"} rows={3} />}
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות נוספות" rows={3} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>ביטול</Button><Button onClick={submit} disabled={!canSubmit || busy}>שלח בקשה</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}