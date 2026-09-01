import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function StaffNoteDialog({ open, onClose, onSave, editingNote, defaultDate }) {
  const [date, setDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(editingNote?.date || defaultDate);
      setEndDate(editingNote?.end_date || "");
      setMessage(editingNote?.message || "");
    }
  }, [open, editingNote, defaultDate]);

  const submit = async () => {
    if (!date || !message.trim()) return;
    setSaving(true);
    try {
      await onSave({ date, end_date: endDate || null, message: message.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingNote ? "עריכת הודעה לצוות" : "הודעה חדשה לצוות"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>עד תאריך (אופציונלי)</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>הודעה</Label>
            <Textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="החלפת מזגן בחדר 6 במהלך היום. יש לעדכן את האורחים." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={submit} disabled={saving || !date || !message.trim()}>{saving ? "שומר…" : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}