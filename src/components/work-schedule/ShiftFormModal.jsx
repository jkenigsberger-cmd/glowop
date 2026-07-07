import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Trash2, Ban } from "lucide-react";
import { ROW_TYPES, ROW_BY_TYPE, WORKER_TEAMS } from "@/lib/workScheduleConfig";

const NEW_WORKER = "__new__";

export default function ShiftFormModal({ shift, defaults, workers, isPublished, userEmail, onSave, onDelete, onCancelShift, onClose }) {
  const isEdit = !!shift;
  const [form, setForm] = useState({
    date:       shift?.date       || defaults?.date     || "",
    row_type:   shift?.row_type   || defaults?.row_type || "OPERATIONS_MORNING",
    worker_id:  shift?.worker_id  || "",
    start_time: shift?.start_time || "",
    end_time:   shift?.end_time   || "",
    notes:      shift?.notes      || "",
  });
  const [newWorker, setNewWorker] = useState({ full_name: "", phone: "", default_team: "OTHER", internal_user_email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const row = ROW_BY_TYPE[form.row_type] || {};
  const isActivity = !!row.textOnly;
  const isNewWorker = form.worker_id === NEW_WORKER;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.date) { setError("יש לבחור תאריך"); return; }
    if (isActivity) {
      if (!form.notes.trim()) { setError("יש להזין טקסט לפעילות המתוכננת"); return; }
    } else {
      if (!form.worker_id) { setError("יש לבחור עובד"); return; }
      if (isNewWorker && !newWorker.full_name.trim()) { setError("יש להזין שם עובד"); return; }
      if (!form.start_time || !form.end_time) { setError("יש להזין שעות התחלה וסיום"); return; }
    }

    setSaving(true);
    try {
      let workerId = form.worker_id;
      let workerName = "";
      if (!isActivity) {
        if (isNewWorker) {
          const created = await base44.entities.WorkerProfile.create({
            full_name: newWorker.full_name.trim(),
            phone: newWorker.phone || undefined,
            default_team: newWorker.default_team,
            internal_user_email: newWorker.internal_user_email ? newWorker.internal_user_email.trim().toLowerCase() : undefined,
            is_active: true,
            created_by: userEmail || undefined,
          });
          workerId = created.id;
          workerName = created.full_name;
        } else {
          workerName = workers.find((w) => w.id === form.worker_id)?.full_name || shift?.worker_name || "";
        }
      }

      await onSave({
        date: form.date,
        row_type: form.row_type,
        row_label: row.label,
        row_order: row.order,
        worker_id: isActivity ? undefined : workerId,
        worker_name: isActivity ? undefined : workerName,
        start_time: isActivity ? (form.start_time || undefined) : form.start_time,
        end_time: isActivity ? (form.end_time || undefined) : form.end_time,
        notes: form.notes || undefined,
        status: shift?.status || "PLANNED",
      });
      onClose();
    } catch (err) {
      setError(err.message || "שגיאה בשמירה");
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base">{isEdit ? "עריכת משמרת" : "הוספת משמרת"}</DialogTitle>
        </DialogHeader>

        {isPublished && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            הסידור כבר פורסם. שינוי זה ישפיע על מה שהעובדים רואים.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">תאריך</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">אזור / משמרת</Label>
              <Select value={form.row_type} onValueChange={(v) => set("row_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROW_TYPES.map((r) => <SelectItem key={r.type} value={r.type}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isActivity && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">עובד</Label>
                <Select value={form.worker_id} onValueChange={(v) => set("worker_id", v)}>
                  <SelectTrigger><SelectValue placeholder="בחר עובד" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                    <SelectItem value={NEW_WORKER}>➕ עובד חדש...</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isNewWorker && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-600">עובד חדש</div>
                  <Input placeholder="שם מלא *" value={newWorker.full_name} onChange={(e) => setNewWorker((w) => ({ ...w, full_name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="טלפון (אופציונלי)" value={newWorker.phone} onChange={(e) => setNewWorker((w) => ({ ...w, phone: e.target.value }))} />
                    <Select value={newWorker.default_team} onValueChange={(v) => setNewWorker((w) => ({ ...w, default_team: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WORKER_TEAMS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="אימייל משתמש מערכת (אופציונלי — לצפייה במשמרות שלי)" value={newWorker.internal_user_email} onChange={(e) => setNewWorker((w) => ({ ...w, internal_user_email: e.target.value }))} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">שעת התחלה</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">שעת סיום</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">{isActivity ? "טקסט הפעילות *" : "הערות"}</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder={isActivity ? "לדוגמה: קבוצה גדולה באתר / ביקור 11:00–13:00" : ""} />
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={saving} className="flex-1">{saving ? "שומר..." : "שמירה"}</Button>
            {isEdit && shift.status === "PLANNED" && (
              <Button type="button" variant="outline" size="icon" title="בטל משמרת" onClick={() => { onCancelShift(shift); onClose(); }}>
                <Ban className="w-4 h-4 text-amber-600" />
              </Button>
            )}
            {isEdit && (
              <Button type="button" variant="outline" size="icon" title="מחק" onClick={() => { onDelete(shift); onClose(); }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}