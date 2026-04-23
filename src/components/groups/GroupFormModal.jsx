import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function GroupFormModal({ group, onClose, onSaved }) {
  const isEdit = !!group;
  const [form, setForm] = useState({
    group_name: group?.group_name || "",
    group_type: group?.group_type || "LODGING",
    arrival_date: group?.arrival_date || "",
    departure_date: group?.departure_date || "",
    total_pax: group?.total_pax || "",
    staff_count: group?.staff_count || "",
    participant_count: group?.participant_count || "",
    boys_count: group?.boys_count || "",
    girls_count: group?.girls_count || "",
    contact_name: group?.contact_name || "",
    contact_phone: group?.contact_phone || "",
    contact_email: group?.contact_email || "",
    internal_notes: group?.internal_notes || "",
    status: group?.status || "DRAFT",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
    const payload = { ...form };
    ["total_pax","staff_count","participant_count","boys_count","girls_count"].forEach(k => {
      if (payload[k] !== "") payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    if (isEdit) await base44.entities.Group.update(group.id, payload);
    else await base44.entities.Group.create(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? "עריכת קבוצה" : "קבוצה חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>שם קבוצה *</Label>
              <Input value={form.group_name} onChange={e => set("group_name", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>סוג</Label>
              <Select value={form.group_type} onValueChange={v => set("group_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LODGING">לינה</SelectItem>
                  <SelectItem value="DAY_USE">יום כיף</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">טיוטה</SelectItem>
                  <SelectItem value="CONFIRMED">מאושר</SelectItem>
                  <SelectItem value="CANCELLED">מבוטל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>תאריך הגעה *</Label>
              <Input type="date" value={form.arrival_date} onChange={e => set("arrival_date", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>תאריך עזיבה</Label>
              <Input type="date" value={form.departure_date} onChange={e => set("departure_date", e.target.value)} />
            </div>
          </div>

          {paxMismatch && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ סה"כ משתתפים ({form.total_pax}) אינו שווה לצוות + חניכים ({Number(form.staff_count) + Number(form.participant_count)})
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>סה"כ משתתפים</Label>
              <Input type="number" min="0" value={form.total_pax} onChange={e => set("total_pax", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>צוות</Label>
              <Input type="number" min="0" value={form.staff_count} onChange={e => set("staff_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>חניכים</Label>
              <Input type="number" min="0" value={form.participant_count} onChange={e => set("participant_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בנים</Label>
              <Input type="number" min="0" value={form.boys_count} onChange={e => set("boys_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בנות</Label>
              <Input type="number" min="0" value={form.girls_count} onChange={e => set("girls_count", e.target.value)} />
            </div>
          </div>

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

          <div className="space-y-1">
            <Label>הערות פנימיות</Label>
            <Textarea rows={3} value={form.internal_notes} onChange={e => set("internal_notes", e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={saving}>{saving ? "שומר..." : isEdit ? "שמור" : "צור קבוצה"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}