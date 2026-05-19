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
    group_name:    group?.group_name    || "",
    group_type:    group?.group_type    || "LODGING",
    arrival_date:  group?.arrival_date  || "",
    departure_date: group?.departure_date || "",
    total_pax:     group?.total_pax     ?? "",
    staff_count:   group?.staff_count   ?? "",
    boys_count:    group?.boys_count    ?? "",
    girls_count:   group?.girls_count   ?? "",
    contact_name:  group?.contact_name  || "",
    contact_phone: group?.contact_phone || "",
    contact_email: group?.contact_email || "",
    internal_notes: group?.internal_notes || "",
    status:        group?.status        || "DRAFT",
  });
  const [saving, setSaving] = useState(false);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalPax   = Number(form.total_pax   || 0);
  const staffCount = Number(form.staff_count || 0);
  const boysCount  = Number(form.boys_count  || 0);
  const girlsCount = Number(form.girls_count || 0);

  // participant_count is always derived, never manually entered
  const participantCount = Math.max(0, totalPax - staffCount);

  // Validation warnings
  const staffExceedsTotal = staffCount > totalPax && totalPax > 0;
  const genderExceedsPax  = (boysCount + girlsCount) > participantCount && participantCount > 0;

  // ── Field setters with auto-fill logic ───────────────────────────────────
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleBoysChange = (val) => {
    const boys = Math.max(0, Math.min(Number(val || 0), participantCount));
    const girls = Math.max(0, participantCount - boys);
    setForm(f => ({ ...f, boys_count: boys, girls_count: girls }));
  };

  const handleGirlsChange = (val) => {
    const girls = Math.max(0, Math.min(Number(val || 0), participantCount));
    const boys = Math.max(0, participantCount - girls);
    setForm(f => ({ ...f, girls_count: girls, boys_count: boys }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      participant_count: participantCount,
    };
    // coerce numeric fields
    ["total_pax", "staff_count", "participant_count", "boys_count", "girls_count"].forEach(k => {
      if (payload[k] !== "" && payload[k] !== undefined) payload[k] = Number(payload[k]);
      else delete payload[k];
    });

    const profilePaxFields = {
      total_pax: payload.total_pax || null,
      participant_count: payload.participant_count || null,
      staff_count: payload.staff_count || null,
      boys_count: payload.boys_count || null,
      girls_count: payload.girls_count || null,
    };

    if (isEdit) {
      await base44.entities.Group.update(group.id, payload);
      // Keep OperationalGroupProfile in sync with group pax edits
      const existingProfiles = await base44.entities.OperationalGroupProfile.filter({ group_id: group.id });
      if (existingProfiles.length > 0) {
        await base44.entities.OperationalGroupProfile.update(existingProfiles[0].id, {
          ...profilePaxFields,
          is_sleeping_group: payload.group_type === "LODGING",
        });
      }
    } else {
      const newGroup = await base44.entities.Group.create(payload);
      // Auto-create minimal OperationalGroupProfile so Group Detail is immediately operational
      const existingProfiles = await base44.entities.OperationalGroupProfile.filter({ group_id: newGroup.id });
      if (existingProfiles.length === 0) {
        await base44.entities.OperationalGroupProfile.create({
          group_id: newGroup.id,
          quote_id: null,
          guest_form_submission_id: null,
          status: "ACCEPTED",
          accepted_at: new Date().toISOString(),
          ...profilePaxFields,
          general_notes: payload.internal_notes || null,
          is_sleeping_group: payload.group_type === "LODGING",
        });
      } else {
        // Profile already exists (race condition guard) — still sync pax
        await base44.entities.OperationalGroupProfile.update(existingProfiles[0].id, profilePaxFields);
      }
    }

    setSaving(false);
    onSaved();
  };

  const isDayUse = form.group_type === "DAY_USE";

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
              <Label>{isDayUse ? "תאריך האירוע (אופציונלי)" : "תאריך עזיבה"}</Label>
              <Input type="date" value={form.departure_date} onChange={e => set("departure_date", e.target.value)} />
            </div>
          </div>

          {/* Participant counts */}
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
              <Label>חניכים (מחושב)</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-medium">
                {participantCount}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {staffExceedsTotal && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ מספר הצוות ({staffCount}) גדול מסה"כ המשתתפים ({totalPax})
            </div>
          )}

          {/* Gender split */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>בנים</Label>
              <Input
                type="number" min="0" max={participantCount}
                value={form.boys_count}
                onChange={e => handleBoysChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>בנות</Label>
              <Input
                type="number" min="0" max={participantCount}
                value={form.girls_count}
                onChange={e => handleGirlsChange(e.target.value)}
              />
            </div>
          </div>

          {genderExceedsPax && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ סה"כ בנים + בנות ({boysCount + girlsCount}) עולה על מספר החניכים ({participantCount})
            </div>
          )}

          {/* Contact */}
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