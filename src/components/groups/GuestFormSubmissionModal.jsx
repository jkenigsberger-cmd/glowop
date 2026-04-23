import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function GuestFormSubmissionModal({ submission, quoteId, groupId, onClose, onSaved }) {
  const isEdit = !!submission;
  const [form, setForm] = useState({
    contact_name: submission?.contact_name || "",
    contact_phone: submission?.contact_phone || "",
    contact_email: submission?.contact_email || "",
    total_pax: submission?.total_pax || "",
    staff_count: submission?.staff_count || "",
    participant_count: submission?.participant_count || "",
    boys_count: submission?.boys_count || "",
    girls_count: submission?.girls_count || "",
    special_diets: submission?.special_diets || "",
    tent_distribution_notes: submission?.tent_distribution_notes || "",
    schedule_notes: submission?.schedule_notes || "",
    general_notes: submission?.general_notes || "",
    source: submission?.source || "MANUAL",
    status: submission?.status || "SUBMITTED",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const paxMismatch = (() => {
    const total = Number(form.total_pax);
    const staff = Number(form.staff_count);
    const pax = Number(form.participant_count);
    if (!total || (!staff && !pax)) return false;
    return (staff + pax) !== total;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, quote_id: quoteId, group_id: groupId };
    ["total_pax","staff_count","participant_count","boys_count","girls_count"].forEach(k => {
      if (payload[k] !== "") payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    if (!isEdit) payload.submitted_at = new Date().toISOString();
    if (isEdit) await base44.entities.GuestFormSubmission.update(submission.id, payload);
    else await base44.entities.GuestFormSubmission.create(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? "עריכת טופס קבלה" : "טופס קבלה חדש"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>איש קשר</Label>
              <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>טלפון</Label>
              <Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>אימייל</Label>
              <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
            </div>
          </div>

          {paxMismatch && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ סה"כ ({form.total_pax}) אינו שווה לצוות + חניכים ({Number(form.staff_count) + Number(form.participant_count)})
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[["total_pax","סה\"כ"],["staff_count","צוות"],["participant_count","חניכים"],["boys_count","בנים"],["girls_count","בנות"]].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label>{label}</Label>
                <Input type="number" min="0" value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label>דיאטות מיוחדות</Label>
            <Textarea rows={2} value={form.special_diets} onChange={e => set("special_diets", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>הערות חלוקת אוהלים</Label>
            <Textarea rows={2} value={form.tent_distribution_notes} onChange={e => set("tent_distribution_notes", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>הערות לוח זמנים</Label>
            <Textarea rows={2} value={form.schedule_notes} onChange={e => set("schedule_notes", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>הערות כלליות</Label>
            <Textarea rows={2} value={form.general_notes} onChange={e => set("general_notes", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>מקור</Label>
              <Select value={form.source} onValueChange={v => set("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">ידני</SelectItem>
                  <SelectItem value="LINK">קישור</SelectItem>
                  <SelectItem value="WHATSAPP">וואטסאפ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">ממתין</SelectItem>
                  <SelectItem value="SUBMITTED">הוגש</SelectItem>
                  <SelectItem value="REVIEWED">נבדק</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={saving}>{saving ? "שומר..." : isEdit ? "שמור" : "הגש טופס"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}